-- R1-7 Part B (docs/specs/R1-7-record-payment.md, Technical plan section 2, "Migration B"): what the public receipt page reads.
--
-- * public.receipt_hits + receipt_hit(): the per-hash, per-hour counter for the rate limit of the `receipt` Edge Function.
--   Same pattern as waitlist_hits. It holds only HMAC hashes (of the caller's IP, or of a receipt token), never a raw IP or
--   token. It has no tutor_id on purpose: its rows belong to no tutor. RLS is on, no policy, no client grant.
-- * public.get_receipt(p_token): the one door from a receipt token to a receipt. Executable by the Edge Function's admin role
--   only. It builds the answer itself with a fixed list of keys, so the exposure rule lives in one place
--   and a pgTAP test pins it. It selects no phone, email, UPI id, id or tutor_id, and no other payment.
--
-- get_receipt answer (jsonb), or null for a token that is malformed or unknown:
--   live:      receipt_no, status ('paid' or 'part_paid'), tutor_name, tutor_subjects, student_name, parent_name,
--              month (YYYY-MM-DD first of month, or null for an earlier balance), amount, method, paid_on,
--              balance_after, language
--   cancelled: receipt_no, status ('cancelled'), tutor_name, student_name, language      (nothing else)

create table public.receipt_hits (
  key_hash    text        not null,
  hour_bucket timestamptz not null,
  n           integer     not null check (n >= 0),
  primary key (key_hash, hour_bucket)
);

-- receipt_hit purges old hours on every public request (delete where hour_bucket < ...), which the primary key
-- (key_hash first) cannot serve. Without this index each request scans the table.
create index receipt_hits_hour_bucket_idx on public.receipt_hits (hour_bucket);

alter table public.receipt_hits enable row level security;

revoke all on public.receipt_hits from public, anon, authenticated;

-- Counts one request for this hash in the current hour; true while still within p_limit.
-- Deletes the stale hours, then an atomic upsert-increment, so two simultaneous requests cannot both slip under the limit.
create function public.receipt_hit(p_hash text, p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  hits integer;
begin
  delete from public.receipt_hits where hour_bucket < now() - interval '24 hours';

  insert into public.receipt_hits (key_hash, hour_bucket, n)
  values (p_hash, date_trunc('hour', now()), 1)
  on conflict (key_hash, hour_bucket) do update set n = public.receipt_hits.n + 1
  returning n into hits;

  return hits <= p_limit;
end;
$$;

revoke all on function public.receipt_hit(text, integer) from public, anon, authenticated;

create function public.get_receipt(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  r record;
begin
  -- Exact match on the token only. A value that could never be a token is the same as an unknown one.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22,}$' then
    return null;
  end if;

  select p.receipt_no, p.amount, p.method, p.paid_on, p.balance_after, p.voided_at,
         d.month,
         s.name as student_name, s.parent_name,
         t.name as tutor_name, t.subjects as tutor_subjects,
         coalesce(s.parent_language, t.language, 'en') as language
    into r
    from public.payments p
    join public.dues d on d.tutor_id = p.tutor_id and d.id = p.due_id
    join public.students s on s.tutor_id = d.tutor_id and s.id = d.student_id
    join public.tutors t on t.id = p.tutor_id
   where p.receipt_token = p_token;

  if not found then
    return null;
  end if;

  if r.voided_at is not null then
    return jsonb_build_object(
      'receipt_no', r.receipt_no,
      'status', 'cancelled',
      'tutor_name', r.tutor_name,
      'student_name', r.student_name,
      'language', r.language
    );
  end if;

  return jsonb_build_object(
    'receipt_no', r.receipt_no,
    'status', case when r.balance_after = 0 then 'paid' else 'part_paid' end,
    'tutor_name', r.tutor_name,
    'tutor_subjects', to_jsonb(r.tutor_subjects),
    'student_name', r.student_name,
    'parent_name', r.parent_name,
    'month', r.month,
    'amount', r.amount,
    'method', r.method,
    'paid_on', r.paid_on,
    'balance_after', r.balance_after,
    'language', r.language
  );
end;
$$;

-- New public functions are executable by anon and authenticated by default: take it away. The admin role the Edge
-- Function uses keeps the platform's default execute right (the same way receipt_hit and waitlist_hit work), and
-- 200_receipt_public.sql pins both sides: it can execute, and neither client role can.
revoke all on function public.get_receipt(text) from public, anon, authenticated;
