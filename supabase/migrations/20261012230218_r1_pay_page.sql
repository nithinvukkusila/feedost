-- R1-9 Part A (docs/specs/R1-9-parent-pay-page.md, Technical plan, sections A3 and A4): what the public pay page reads and writes.
--
-- * public.current_notice_version(): the one place the privacy notice version lives. Changing the notice text means a new
--   migration that replaces this body; every parent is then asked again.
-- * public.consents: one row per student and notice version, written only by record_consent. It holds no phone, name or other
--   personal column. The tutor may read her own students' rows (select policy); no client can write.
-- * public.paypage_hits + paypage_hit(): the per-hash, per-hour counter for the rate limits of the `pay-page` and `record-consent`
--   Edge Functions. Same pattern as receipt_hits. It holds only HMAC hashes, never a raw IP or token. It has no tutor_id on
--   purpose: its rows belong to no tutor. RLS is on, no policy, no client grant.
-- * public.get_pay_page(p_token) and public.record_consent(p_token, p_notice_version): executable by the Edge Functions' admin role only.
--   The migration revokes execute from public, anon and authenticated; the admin role keeps the platform's default execute right
--   (the same way receipt_hit and get_receipt work), and 230_pay_page.sql pins both sides.
--
-- get_pay_page answer (jsonb), or null for a token that is malformed, unknown, archived or without a tutor:
--   before consent: consent_needed (true), notice_version, tutor_name, tutor_subjects, student_name, language
--   after consent:  the six above (consent_needed false) plus upi_id, today (YYYY-MM-DD, India day), total_remaining (integer paise),
--                   open_dues (<= 24 of kind, month, due_date, amount, amount_paid, remaining), open_dues_more (integer),
--                   receipts (<= 12 of receipt_no, receipt_token, month, amount, paid_on, balance_after), receipts_more (boolean)
-- record_consent answer (text): 'ok', 'stale_notice' or 'not_found'.

create function public.current_notice_version()
returns text
language sql
immutable
set search_path = ''
as $$ select 'v1'::text $$;

revoke all on function public.current_notice_version() from public, anon, authenticated;

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  -- No default: no client ever inserts a consent.
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  student_id uuid not null,
  notice_version text not null check (notice_version ~ '^[a-z0-9._-]{1,16}$'),
  accepted_at timestamptz not null default now(),
  constraint consents_student_id_notice_version_key unique (student_id, notice_version),
  -- A consent names a student of the SAME tutor. Cascade (nothing references consents): deleting a student or a tutor
  -- removes the rows in either order.
  constraint consents_student_fkey
    foreign key (tutor_id, student_id) references public.students (tutor_id, id)
    on delete cascade
);

create index consents_tutor_id_student_id_idx on public.consents (tutor_id, student_id);

comment on table public.consents is
  'A parent agreed to the privacy notice for one student and notice version. Written only by record_consent. Holds no personal data about the parent.';

alter table public.consents enable row level security;

-- The only policy. Like payments, dues and reminders, this is a deliberate departure from the four-policy rule: the tutor
-- may read her own consents, and no client may write them (record_consent, called by an Edge Function, is the only writer).
create policy consents_select on public.consents
  for select to authenticated
  using (tutor_id = (select auth.uid()));

revoke all on public.consents from public, anon, authenticated;
grant select on public.consents to authenticated;

create table public.paypage_hits (
  key_hash    text        not null,
  hour_bucket timestamptz not null,
  n           integer     not null check (n >= 0),
  primary key (key_hash, hour_bucket)
);

-- paypage_hit purges old hours on every public request; the primary key (key_hash first) cannot serve that.
create index paypage_hits_hour_bucket_idx on public.paypage_hits (hour_bucket);

alter table public.paypage_hits enable row level security;

revoke all on public.paypage_hits from public, anon, authenticated;

comment on table public.paypage_hits is
  'HMAC hashes only, per hour, for the pay-page and record-consent rate limits. No tutor_id: the rows belong to no tutor.';

create function public.paypage_hit(p_hash text, p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  hits integer;
begin
  delete from public.paypage_hits where hour_bucket < now() - interval '24 hours';

  insert into public.paypage_hits (key_hash, hour_bucket, n)
  values (p_hash, date_trunc('hour', now()), 1)
  on conflict (key_hash, hour_bucket) do update set n = public.paypage_hits.n + 1
  returning n into hits;

  return hits <= p_limit;
end;
$$;

revoke all on function public.paypage_hit(text, integer) from public, anon, authenticated;

create function public.get_pay_page(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  s record;
  consent_needed boolean;
  v_version text := public.current_notice_version();
  v_dues jsonb;
  v_due_count integer;
  v_total bigint;
  v_receipts jsonb;
  v_receipt_count integer;
begin
  -- Exact match on the token only. A value that could never be a token is the same as an unknown one.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22,}$' then
    return null;
  end if;

  select s0.id as student_id, s0.tutor_id, s0.name as student_name,
         t.name as tutor_name, t.subjects as tutor_subjects, t.upi_id,
         coalesce(s0.parent_language, t.language, 'en') as language
    into s
    from public.students s0
    join public.tutors t on t.id = s0.tutor_id
   where s0.pay_token = p_token and s0.active;

  if not found then
    return null;
  end if;

  consent_needed := not exists (
    select 1 from public.consents c
     where c.tutor_id = s.tutor_id and c.student_id = s.student_id and c.notice_version = v_version
  );

  -- Before consent nothing about money is read at all, so there is nothing for a later bug to leak.
  if consent_needed then
    return jsonb_build_object(
      'consent_needed', true,
      'notice_version', v_version,
      'tutor_name', s.tutor_name,
      'tutor_subjects', to_jsonb(s.tutor_subjects),
      'student_name', s.student_name,
      'language', s.language
    );
  end if;

  select count(*), coalesce(sum(d.amount - d.amount_paid), 0)
    into v_due_count, v_total
    from public.dues d
   where d.tutor_id = s.tutor_id and d.student_id = s.student_id and d.status in ('due', 'partial');

  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', x.kind,
           'month', x.month,
           'due_date', x.due_date,
           'amount', x.amount,
           'amount_paid', x.amount_paid,
           'remaining', x.amount - x.amount_paid
         ) order by x.ord), '[]'::jsonb)
    into v_dues
    from (
      select d.kind, d.month, d.due_date, d.amount, d.amount_paid,
             row_number() over (order by (d.kind <> 'opening'), d.due_date, d.month) as ord
        from public.dues d
       where d.tutor_id = s.tutor_id and d.student_id = s.student_id and d.status in ('due', 'partial')
       order by (d.kind <> 'opening'), d.due_date, d.month
       limit 24
    ) x;

  select count(*)
    into v_receipt_count
    from public.payments p
    join public.dues d on d.tutor_id = p.tutor_id and d.id = p.due_id
   where d.tutor_id = s.tutor_id and d.student_id = s.student_id and p.voided_at is null;

  select coalesce(jsonb_agg(jsonb_build_object(
           'receipt_no', r.receipt_no,
           'receipt_token', r.receipt_token,
           'month', r.month,
           'amount', r.amount,
           'paid_on', r.paid_on,
           'balance_after', r.balance_after
         ) order by r.ord), '[]'::jsonb)
    into v_receipts
    from (
      select p.receipt_no, p.receipt_token, d.month, p.amount, p.paid_on, p.balance_after,
             row_number() over (order by p.created_at desc, p.receipt_no desc) as ord
        from public.payments p
        join public.dues d on d.tutor_id = p.tutor_id and d.id = p.due_id
       where d.tutor_id = s.tutor_id and d.student_id = s.student_id and p.voided_at is null
       order by p.created_at desc, p.receipt_no desc
       limit 12
    ) r;

  return jsonb_build_object(
    'consent_needed', false,
    'notice_version', v_version,
    'tutor_name', s.tutor_name,
    'tutor_subjects', to_jsonb(s.tutor_subjects),
    'student_name', s.student_name,
    'language', s.language,
    'upi_id', s.upi_id,
    'today', to_char(public.india_day(now()), 'YYYY-MM-DD'),
    'total_remaining', v_total::integer,
    'open_dues', v_dues,
    'open_dues_more', greatest(v_due_count - 24, 0),
    'receipts', v_receipts,
    'receipts_more', v_receipt_count > 12
  );
end;
$$;

revoke all on function public.get_pay_page(text) from public, anon, authenticated;

create function public.record_consent(p_token text, p_notice_version text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
begin
  -- The token is checked first, so an unknown token cannot be used to learn the current version.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22,}$' then
    return 'not_found';
  end if;

  select s0.id as student_id, s0.tutor_id
    into s
    from public.students s0
    join public.tutors t on t.id = s0.tutor_id
   where s0.pay_token = p_token and s0.active;

  if not found then
    return 'not_found';
  end if;

  if p_notice_version is null or p_notice_version <> public.current_notice_version() then
    return 'stale_notice';
  end if;

  -- tutor_id comes from the student row, never from an argument. The unique constraint, not a prior select, makes two
  -- simultaneous calls safe.
  insert into public.consents (tutor_id, student_id, notice_version)
  values (s.tutor_id, s.student_id, p_notice_version)
  on conflict (student_id, notice_version) do nothing;

  return 'ok';
end;
$$;

revoke all on function public.record_consent(text, text) from public, anon, authenticated;
