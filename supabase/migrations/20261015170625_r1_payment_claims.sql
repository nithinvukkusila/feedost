-- R1-10 Part A (docs/specs/R1-10-paid-claims-inbox.md, "Technical plan, R1-10", section 3): "I've paid" claims.
-- A claim is a parent telling the tutor "I paid". It proves nothing and moves no money; only the tutor's Confirm records a payment.
--
-- =============================================================================================================
-- THE CONTRACT THE FRONT END READS (the same block is appended to the spec)
-- =============================================================================================================
--
-- submit_claim(p_token text, p_upi_ref text, p_screenshot_path text) returns text      the Edge Functions admin role ONLY (the submit-claim function)
--   One code, no data: 'ok', 'not_found', 'consent_needed', 'nothing_owed', 'bad_reference', 'no_proof',
--   'already_pending', 'duplicate_reference'. Every refusal writes nothing. There is no amount, student, tutor or time argument:
--   the amount is what the student still owes at that moment (all open fees, as bigint, capped at 2,000,000,000 paise), the due is
--   the oldest open fee (an earlier balance first), the tutor and student come from the token.
--
-- confirm_claim(p_claim uuid, p_request_id uuid) returns payment_claims                signed-in tutors ONLY
-- reject_claim(p_claim uuid) returns payment_claims                                    signed-in tutors ONLY
--   Both return ONE payment_claims row as a JSON object with exactly these keys (tutor_id and confirm_request_id are not hidden
--   in the row: a client reads the table by named columns and never asks for them; the functions return the whole row, as
--   record_payment does):
--   id, tutor_id, student_id, due_id, amount, fee_count, upi_ref, screenshot_path, status, created_at, handled_at,
--   confirm_request_id, confirmed_receipt_from, confirmed_receipt_count
--   A confirmed claim made `confirmed_receipt_count` payments with receipt numbers confirmed_receipt_from, +1, +2 ... (no gap:
--   the tutor's receipt counter is locked for the whole call). The app finds them by that number range.
--   Confirm with the SAME request id twice returns the same row and records nothing more.
--
-- Errors (machine words, never shown). Over PostgREST: { code: 'P0001', message: '<word>', details: '<detail or null>' }
-- except not_signed_in, which is code '42501'.
--
--   word                  when                                                           details
--   not_signed_in         no session                                                     null (code 42501)
--   invalid_argument      an argument is null                                            null
--   claim_not_found       the claim does not exist OR is another tutor's (same word)     null
--   already_handled       the claim is already confirmed or rejected (and, for confirm,  null
--                         this request id did not confirm it)
--   request_reused        confirm: this request id already confirmed a different claim   null
--   student_archived      confirm: the student is archived                               null
--   date_out_of_range     confirm: the claim was sent more than 90 days ago (India day)  null
--   amount_over_remaining confirm: the claim is more than what is owed now               the paise owed now, as text
--   (record_payment's own words can never reach a client from confirm_claim: every record_payment refusal is pre-empted above.)
--
-- =============================================================================================================
--
-- What is in here
-- * dues gets unique (tutor_id, student_id, id), so a claim's foreign key forces its fee to belong to the same student AND tutor.
-- * public.payment_claims: written only by submit_claim (insert), confirm_claim and reject_claim (status change). A client can
--   only READ it. It has ONE policy (select), not the four of supabase/CLAUDE.md: the same documented departure as payments,
--   dues and consents, because no client write grant exists. A trigger lets a claim go pending -> confirmed or rejected once
--   and changes nothing else about it. It holds no parent name, phone or other personal column.
-- * public.claim_hits and claim_hit(): the hourly counter for the submit-claim function's rate limits (a copy of paypage_hits).
--   Hashes only. No tutor_id on purpose: the rows belong to no tutor. RLS on, no policy, no grant.
-- * open_dues_oldest_first(): the ONE definition of "the open fees, oldest first", used by submit_claim and confirm_claim and
--   pinned equal to the order get_pay_page lists them in (see 275_open_dues_order.sql).
-- * confirm_claim takes the tutor's receipt-counter lock (the same lock record_payment takes, first, so no deadlock with Mark
--   paid), then calls record_payment once per fee, oldest first, with a request id derived from its own.
--   confirm_claim pre-empts, does not replace, three of record_payment's checks (student archived, the 90-day window, the
--   amount owed), so that a refusal changes nothing and costs no receipt number. record_payment still runs every check and does
--   the numbering and the due update. If R1-7's date or amount rule changes, change both functions; 280_confirm_claim.sql pins
--   them together.
-- * get_pay_page gains one key after consent: pending_claim.
-- * sync_opening_due() is re-created: an opening due named by a pending claim is not changed or deleted.

-- ---------------------------------------------------------------------------------------------
-- dues: the key a claim's foreign key needs
-- ---------------------------------------------------------------------------------------------

alter table public.dues add constraint dues_tutor_id_student_id_id_key unique (tutor_id, student_id, id);

-- ---------------------------------------------------------------------------------------------
-- The claims table
-- ---------------------------------------------------------------------------------------------

create table public.payment_claims (
  id uuid primary key default gen_random_uuid(),
  -- No default: no client ever inserts a claim.
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  student_id uuid not null,
  -- The oldest open fee when the claim was sent.
  due_id uuid not null,
  -- Integer paise: what the student owed over all open fees when the claim was sent (capped at the column's ceiling).
  amount integer not null check (amount > 0 and amount <= 2000000000),
  -- How many open fees that amount spanned, for the card's "{n} fees".
  fee_count integer not null check (fee_count >= 1),
  -- Exactly 12 ASCII digits, spaces and hyphens already removed. [0-9], never \d.
  upi_ref text check (upi_ref ~ '^[0-9]{12}$'),
  -- <tutor id>/<uuid>.<ext>. Set by the function only (Part D); always null in Part A.
  screenshot_path text check (screenshot_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  confirm_request_id uuid,
  confirmed_receipt_from integer,
  confirmed_receipt_count integer,
  constraint payment_claims_one_proof_check check (upi_ref is not null or screenshot_path is not null),
  constraint payment_claims_handled_check check ((status = 'pending') = (handled_at is null)),
  -- "is true" so a null inside cannot make the check pass.
  constraint payment_claims_confirmed_check check (
    (status = 'confirmed' and confirm_request_id is not null and confirmed_receipt_from > 0 and confirmed_receipt_count >= 1) is true
    or (status <> 'confirmed' and confirm_request_id is null and confirmed_receipt_from is null and confirmed_receipt_count is null) is true
  ),
  -- A claim names a student and a fee of the SAME tutor, and the fee must be that student's. Cascade (nothing references
  -- claims): deleting a student or a tutor removes the claims in any order. The cascade on payment_claims_due_fkey is reached
  -- only when sync_opening_due deletes an opening due with no payment and no pending claim (it freezes a due a pending claim
  -- names, below), so only rejected claims can go with it: a confirmed claim always made a payment on its fee.
  constraint payment_claims_student_fkey
    foreign key (tutor_id, student_id) references public.students (tutor_id, id)
    on delete cascade,
  constraint payment_claims_due_fkey
    foreign key (tutor_id, student_id, due_id) references public.dues (tutor_id, student_id, id)
    on delete cascade
);

comment on table public.payment_claims is
  'A parent says she paid. Written only by submit_claim, confirm_claim and reject_claim. Clients read it and nothing else. Holds no parent name or phone.';

-- At most one pending claim per student, enforced here and not only in submit_claim.
create unique index payment_claims_one_pending_per_student on public.payment_claims (student_id) where status = 'pending';
-- A UPI reference can be on one live (pending or confirmed) claim per tutor. A rejected claim frees it.
create unique index payment_claims_live_ref_key on public.payment_claims (tutor_id, upi_ref)
  where upi_ref is not null and status in ('pending', 'confirmed');
create unique index payment_claims_confirm_request_key on public.payment_claims (tutor_id, confirm_request_id)
  where confirm_request_id is not null;
-- The inbox (pending, newest first) and Earlier (handled, newest first).
create index payment_claims_inbox_idx on public.payment_claims (tutor_id, status, created_at desc);
create index payment_claims_handled_idx on public.payment_claims (tutor_id, handled_at desc);

-- ---------------------------------------------------------------------------------------------
-- sync_opening_due: a pending claim freezes the opening due it names
-- ---------------------------------------------------------------------------------------------

-- Re-created from 20261012135000_r1_opening_due_with_payments.sql with one change: an opening due named by a pending claim is,
-- like one with a payment, never changed or deleted by the trigger. The claim says "I paid what the page showed", so its due
-- must keep that amount, and cascade on payment_claims_due_fkey must never remove a pending claim. Everything else is as
-- before. The triggers already point at this function name, so create or replace is enough; its privileges (revoked from
-- public, anon, authenticated) stay.
create or replace function public.sync_opening_due()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
    values (new.tutor_id, new.id, 'opening', null, new.opening_balance, 0, 'due', public.india_day(now()))
    on conflict do nothing;
  else
    if new.opening_balance > 0 then
      insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
      values (new.tutor_id, new.id, 'opening', null, new.opening_balance, 0, 'due', public.india_day(now()))
      on conflict do nothing;
      update public.dues
         set amount = new.opening_balance
       where student_id = new.id and kind = 'opening' and amount_paid = 0
         and not exists (select 1 from public.payments p where p.due_id = dues.id)
         and not exists (select 1 from public.payment_claims c where c.student_id = new.id and c.due_id = dues.id and c.status = 'pending');
    else
      delete from public.dues
       where student_id = new.id and kind = 'opening' and amount_paid = 0
         and not exists (select 1 from public.payments p where p.due_id = dues.id)
         and not exists (select 1 from public.payment_claims c where c.student_id = new.id and c.due_id = dues.id and c.status = 'pending');
    end if;
  end if;
  return null;
end;
$$;

-- A claim goes pending -> confirmed or pending -> rejected, once, and nothing about what was claimed ever changes. Applies to
-- the table owner too, so a later function or a hand-run statement cannot rewrite a claim.
create function public.payment_claims_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'pending' or new.status not in ('confirmed', 'rejected') then
    raise exception 'claim_immutable' using errcode = 'P0001';
  end if;
  if (new.id, new.tutor_id, new.student_id, new.due_id, new.amount, new.fee_count, new.upi_ref, new.screenshot_path, new.created_at)
     is distinct from
     (old.id, old.tutor_id, old.student_id, old.due_id, old.amount, old.fee_count, old.upi_ref, old.screenshot_path, old.created_at) then
    raise exception 'claim_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger payment_claims_guard
  before update on public.payment_claims
  for each row execute function public.payment_claims_guard();

alter table public.payment_claims enable row level security;

-- The only policy. There is deliberately no insert, update or delete policy: no client may write claims (the same documented
-- departure from the four-policy rule as payments, dues and consents).
create policy payment_claims_select on public.payment_claims
  for select to authenticated
  using (tutor_id = (select auth.uid()));

revoke all on public.payment_claims from public, anon, authenticated;
grant select on public.payment_claims to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The rate-limit counter for submit-claim (a copy of paypage_hits and paypage_hit)
-- ---------------------------------------------------------------------------------------------

create table public.claim_hits (
  key_hash    text        not null,
  hour_bucket timestamptz not null,
  n           integer     not null check (n >= 0),
  primary key (key_hash, hour_bucket)
);

create index claim_hits_hour_bucket_idx on public.claim_hits (hour_bucket);

alter table public.claim_hits enable row level security;

revoke all on public.claim_hits from public, anon, authenticated;

comment on table public.claim_hits is
  'HMAC hashes only, per hour, for the submit-claim rate limits. No tutor_id: the rows belong to no tutor.';

create function public.claim_hit(p_hash text, p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  hits integer;
begin
  delete from public.claim_hits where hour_bucket < now() - interval '24 hours';

  insert into public.claim_hits (key_hash, hour_bucket, n)
  values (p_hash, date_trunc('hour', now()), 1)
  on conflict (key_hash, hour_bucket) do update set n = public.claim_hits.n + 1
  returning n into hits;

  return hits <= p_limit;
end;
$$;

revoke all on function public.claim_hit(text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The open fees, oldest first (internal)
-- ---------------------------------------------------------------------------------------------

-- The same order get_pay_page lists open_dues in: an earlier balance first, then by due date, then month.
create function public.open_dues_oldest_first(p_tutor uuid, p_student uuid)
returns setof public.dues
language sql
stable
set search_path = ''
as $$
  select d.*
    from public.dues d
   where d.tutor_id = p_tutor and d.student_id = p_student and d.status in ('due', 'partial')
   order by (d.kind <> 'opening'), d.due_date, d.month
$$;

revoke all on function public.open_dues_oldest_first(uuid, uuid) from public, anon, authenticated;
revoke all on function public.payment_claims_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- submit_claim
-- ---------------------------------------------------------------------------------------------

create function public.submit_claim(p_token text, p_upi_ref text, p_screenshot_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  v_ref text;
  v_count integer;
  v_total bigint;
  v_first uuid;
  v_constraint text;
begin
  -- Exact match on the token only. A value that could never be a token is the same as an unknown one.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22,64}$' then
    return 'not_found';
  end if;

  -- The student row is locked, so two submissions for one student at the same moment queue here.
  select s0.id as student_id, s0.tutor_id
    into s
    from public.students s0
    join public.tutors t on t.id = s0.tutor_id
   where s0.pay_token = p_token and s0.active
     for update of s0;
  if not found then
    return 'not_found';
  end if;

  if not exists (
    select 1 from public.consents c
     where c.tutor_id = s.tutor_id and c.student_id = s.student_id and c.notice_version = public.current_notice_version()
  ) then
    return 'consent_needed';
  end if;

  select count(*), coalesce(sum(d.amount - d.amount_paid), 0)
    into v_count, v_total
    from public.open_dues_oldest_first(s.tutor_id, s.student_id) d;
  if v_count = 0 then
    return 'nothing_owed';
  end if;

  -- Spaces and hyphens only are removed; whatever is left must be exactly 12 ASCII digits.
  v_ref := translate(coalesce(p_upi_ref, ''), ' -', '');
  if p_screenshot_path is not null
     and (p_screenshot_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' or split_part(p_screenshot_path, '/', 1) <> s.tutor_id::text) then
    -- A file path that is not under this tutor's folder is never accepted.
    return 'no_proof';
  end if;
  if v_ref = '' then
    if p_screenshot_path is null then
      return 'no_proof';
    end if;
    v_ref := null;
  elsif v_ref !~ '^[0-9]{12}$' then
    return 'bad_reference';
  end if;

  -- A lost-answer retry (same reference) lands here, on "already waiting", before the duplicate check.
  if exists (select 1 from public.payment_claims c where c.student_id = s.student_id and c.status = 'pending') then
    return 'already_pending';
  end if;
  if v_ref is not null and exists (
    select 1 from public.payment_claims c
     where c.tutor_id = s.tutor_id and c.upi_ref = v_ref and c.status in ('pending', 'confirmed')
  ) then
    return 'duplicate_reference';
  end if;

  select d.id into v_first from public.open_dues_oldest_first(s.tutor_id, s.student_id) d limit 1;

  begin
    insert into public.payment_claims (tutor_id, student_id, due_id, amount, fee_count, upi_ref, screenshot_path)
    values (s.tutor_id, s.student_id, v_first, least(v_total, 2000000000)::integer, v_count, v_ref, p_screenshot_path);
  exception when unique_violation then
    -- A race the checks above did not see. Map by index name; nothing was written.
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'payment_claims_live_ref_key' then
      return 'duplicate_reference';
    end if;
    return 'already_pending';
  end;

  return 'ok';
end;
$$;

revoke all on function public.submit_claim(text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- confirm_claim
-- ---------------------------------------------------------------------------------------------

-- Lock order: the tutor's receipt counter (as record_payment), then the claim, then (inside record_payment) the fees. Mark paid
-- takes the counter first too, so the two serialise per tutor and cannot deadlock. submit_claim locks only the student row and
-- reject_claim only the claim.
create function public.confirm_claim(p_claim uuid, p_request_id uuid)
returns public.payment_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor uuid;
  v_claim public.payment_claims;
  v_active boolean;
  v_paid_on date;
  v_total bigint;
  v_left integer;
  v_take integer;
  v_n integer := 0;
  v_first integer;
  v_due public.dues;
  v_pay public.payments;
  v_row public.payment_claims;
begin
  v_tutor := (select auth.uid());
  if v_tutor is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_claim is null or p_request_id is null then
    raise exception 'invalid_argument' using errcode = 'P0001';
  end if;

  -- The counter lock first, exactly as record_payment: everything below is serialised per tutor with Mark paid.
  insert into public.receipt_counters (tutor_id) values (v_tutor) on conflict do nothing;
  perform 1 from public.receipt_counters where tutor_id = v_tutor for update;

  select * into v_claim from public.payment_claims where id = p_claim and tutor_id = v_tutor for update;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0001';
  end if;

  -- A retry of the confirm that worked returns the same row, whatever has happened to the fees since.
  if v_claim.status = 'confirmed' and v_claim.confirm_request_id = p_request_id then
    return v_claim;
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'already_handled' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payment_claims c where c.tutor_id = v_tutor and c.confirm_request_id = p_request_id) then
    raise exception 'request_reused' using errcode = 'P0001';
  end if;

  select s.active into v_active from public.students s where s.id = v_claim.student_id and s.tutor_id = v_tutor;
  if not coalesce(v_active, false) then
    raise exception 'student_archived' using errcode = 'P0001';
  end if;

  v_paid_on := public.india_day(v_claim.created_at);
  if v_paid_on < public.india_day(now()) - 90 then
    raise exception 'date_out_of_range' using errcode = 'P0001';
  end if;

  select coalesce(sum(d.amount - d.amount_paid), 0) into v_total
    from public.open_dues_oldest_first(v_tutor, v_claim.student_id) d;
  if v_total < v_claim.amount then
    raise exception 'amount_over_remaining' using errcode = 'P0001', detail = v_total::text;
  end if;

  -- One payment per fee, oldest first, until the claim is used up. record_payment decides every rule; any raise rolls back
  -- every payment and the counter, so a refusal never uses a receipt number.
  v_left := v_claim.amount;
  for v_due in select * from public.open_dues_oldest_first(v_tutor, v_claim.student_id) loop
    if v_left = 0 then
      exit;
    end if;
    v_take := least(v_left, v_due.amount - v_due.amount_paid);
    v_pay := public.record_payment(v_due.id, v_take, 'upi', v_paid_on, md5(p_request_id::text || ':' || (v_n + 1)::text)::uuid);
    v_n := v_n + 1;
    if v_n = 1 then
      v_first := v_pay.receipt_no;
    end if;
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'amount_over_remaining' using errcode = 'P0001', detail = (v_claim.amount - v_left)::text;
  end if;

  update public.payment_claims
     set status = 'confirmed', handled_at = now(), confirm_request_id = p_request_id,
         confirmed_receipt_from = v_first, confirmed_receipt_count = v_n
   where id = p_claim
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- reject_claim
-- ---------------------------------------------------------------------------------------------

create function public.reject_claim(p_claim uuid)
returns public.payment_claims
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor uuid;
  v_claim public.payment_claims;
  v_row public.payment_claims;
begin
  v_tutor := (select auth.uid());
  if v_tutor is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_claim is null then
    raise exception 'invalid_argument' using errcode = 'P0001';
  end if;

  -- Another tutor's claim and an unknown id give the same word. Only the claim is locked; no due, payment or counter.
  select * into v_claim from public.payment_claims where id = p_claim and tutor_id = v_tutor for update;
  if not found then
    raise exception 'claim_not_found' using errcode = 'P0001';
  end if;
  if v_claim.status <> 'pending' then
    raise exception 'already_handled' using errcode = 'P0001';
  end if;

  update public.payment_claims set status = 'rejected', handled_at = now() where id = p_claim returning * into v_row;
  return v_row;
end;
$$;

-- New public functions are executable by anon and authenticated by default (Supabase grants them directly, so revoking from
-- public alone is not enough). Only the two tutor functions are for clients; submit_claim keeps only the service role.
revoke execute on function public.confirm_claim(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.reject_claim(uuid) from public, anon, authenticated;
grant execute on function public.confirm_claim(uuid, uuid) to authenticated;
grant execute on function public.reject_claim(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- get_pay_page: the body of 20261012230218_r1_pay_page.sql plus one key after consent, pending_claim
-- ---------------------------------------------------------------------------------------------

create or replace function public.get_pay_page(p_token text)
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
  v_pending jsonb;
begin
  -- Exact match on the token only. A value that could never be a token is the same as an unknown one.
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{22,64}$' then
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

  -- The one waiting claim, if any: only how much and on which India day. Never the reference, the file, the id or the status.
  select jsonb_build_object('amount', c.amount, 'submitted_on', to_char(public.india_day(c.created_at), 'YYYY-MM-DD'))
    into v_pending
    from public.payment_claims c
   where c.tutor_id = s.tutor_id and c.student_id = s.student_id and c.status = 'pending';

  return jsonb_build_object(
    'consent_needed', false,
    'notice_version', v_version,
    'tutor_name', s.tutor_name,
    'tutor_subjects', to_jsonb(s.tutor_subjects),
    'student_name', s.student_name,
    'language', s.language,
    'upi_id', s.upi_id,
    'today', to_char(public.india_day(now()), 'YYYY-MM-DD'),
    'total_remaining', v_total,
    'open_dues', v_dues,
    'open_dues_more', greatest(v_due_count - 24, 0),
    'receipts', v_receipts,
    'receipts_more', v_receipt_count > 12,
    'pending_claim', v_pending
  );
end;
$$;

revoke all on function public.get_pay_page(text) from public, anon, authenticated;
