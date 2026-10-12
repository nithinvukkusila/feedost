-- R1-7 Part A: payments, receipt numbers, record_payment and void_payment.
-- Plan: docs/specs/R1-7-record-payment.md, "Technical plan, R1-7", section 2 (migration A).
--
-- =============================================================================================================
-- THE CONTRACT THE FRONT END READS (the same block is appended to the spec)
-- =============================================================================================================
--
-- Both functions are called with client.rpc(...) by a signed-in user. Nothing else writes payments or dues.
--
--   record_payment(p_due uuid, p_amount integer, p_method text, p_paid_on date, p_request_id uuid)
--     p_amount   paise, integer, 1 .. what is left on the fee
--     p_method   'upi' or 'cash'
--     p_paid_on  a calendar day (India): not after today in India, not more than 90 days before today in India
--     p_request_id  a uuid the client makes once per open sheet and reuses on every "Try again"
--   void_payment(p_payment uuid)
--
-- Both return ONE payments row as a JSON object, with exactly these keys:
--   id, tutor_id, due_id, amount, method, paid_on, receipt_no, receipt_token, request_id,
--   balance_after, created_at, voided_at
--   (amount and balance_after are integer paise; paid_on is 'YYYY-MM-DD'; created_at and voided_at are
--   ISO timestamps with a time zone; voided_at is null for a live payment.)
--   The due after a record is: amount_paid = due.amount - balance_after, status 'paid' when balance_after = 0,
--   else 'partial'. After a void the payment row has voided_at set; the due's amount_paid drops by
--   payment.amount and its status is 'due' when that leaves 0, else 'partial'. (balance_after on the payment
--   never changes: it is what was true when the receipt was made.)
--   A retry with the same request id returns the SAME row as the first call (same receipt_no, same
--   receipt_token), even if the fee has since been paid.
--
-- Errors. The database message is a machine word, never shown to the user. Over PostgREST it arrives as
--   { code: 'P0001', message: '<word>', details: '<detail or null>' }   (HTTP 400)
-- except not_signed_in, which arrives as code '42501' (HTTP 401 or 403).
--
--   word                  when                                                          details
--   not_signed_in         no session, or a session with no user                         null   (code 42501)
--   invalid_argument      an argument is null, amount < 1, method not 'upi' or 'cash'   null
--   due_not_found         the due does not exist OR belongs to another tutor (same      null
--                         word, so ids cannot be probed)
--   student_archived      the due's student is archived                                 null
--   already_paid          the due is already paid in full                               null
--   amount_over_remaining amount is more than is left on the fee                        the paise left, as text
--   date_out_of_range     paid_on is after today (India) or more than 90 days back      null
--   request_reused        this request id was used before for a different due or amount null
--   payment_not_found     (void) the payment does not exist OR is another tutor's       null
--   already_voided        (void) it was undone before                                   null
--   undo_window_over      (void) more than 24 hours since it was recorded               null
--
-- Receipt numbers: 1, 2, 3 ... per tutor, no gap and no repeat. A refused or rolled-back call uses no number.
-- A voided payment keeps its number; numbers are never reused.
-- =============================================================================================================
--
-- What is in here
-- * dues gets unique (tutor_id, id), so a payment can carry a composite foreign key that forces its due to
--   belong to the same tutor (the same pattern as dues_student_fkey). Additive; nothing else on dues changes.
-- * public.receipt_counters: one row per tutor, the last receipt number taken. No policy and no grant: only the
--   two definer functions below touch it (like public.waitlist). Its key is tutor_id, so it is tenant-keyed.
-- * public.payments: one row per payment. A client can only READ it. It has ONE policy (select) and not the four
--   of supabase/CLAUDE.md, the same departure as public.tutors and public.dues: no client write grant exists.
--   A trigger lets only voided_at change, and only from null to a time, so no later bug can rewrite history.
-- * record_payment and void_payment are the only writers of payments, of dues.amount_paid and of dues.status.
--   Do not use a sequence (sequences are not rolled back and leave gaps) and do not compute max(receipt_no)+1
--   (it races): the per-tutor counter row is locked first, every check runs under that lock, and the counter is
--   moved in the same transaction as the insert.

-- ---------------------------------------------------------------------------------------------
-- dues: the key a payment's foreign key needs
-- ---------------------------------------------------------------------------------------------

alter table public.dues add constraint dues_tutor_id_id_key unique (tutor_id, id);

-- ---------------------------------------------------------------------------------------------
-- The per-tutor receipt counter
-- ---------------------------------------------------------------------------------------------

create table public.receipt_counters (
  tutor_id uuid primary key references public.tutors (id) on delete cascade,
  last_no integer not null default 0 check (last_no >= 0)
);

comment on table public.receipt_counters is
  'The last receipt number taken per tutor. Locked by record_payment. No client policy and no client grant.';

-- Row-level security on and no policy: a client sees nothing even if a grant were added by mistake.
alter table public.receipt_counters enable row level security;
revoke all on public.receipt_counters from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The payments table
-- ---------------------------------------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  -- No default: no client ever inserts a payment.
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  due_id uuid not null,
  -- Integer paise, above 0, with the same ceiling as a due.
  amount integer not null check (amount > 0 and amount <= 100000000),
  -- 'gateway' arrives in R2 and 'bank' is not offered: widen this check in a later migration if that changes.
  method text not null check (method in ('upi', 'cash')),
  -- A calendar day with no time zone. record_payment keeps it between india_day(now()) - 90 and india_day(now()).
  paid_on date not null,
  receipt_no integer not null check (receipt_no > 0),
  -- 18 random bytes give exactly 24 base64 characters; + and / become - and _ (the same recipe as students.pay_token).
  receipt_token text not null unique
    default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_')
    check (receipt_token ~ '^[A-Za-z0-9_-]{22,}$'),
  -- Made by the client once per open sheet; the same id on a retry returns the same receipt.
  request_id uuid not null,
  -- What was left on that fee right after this payment. Fixed for good: never recalculated.
  balance_after integer not null check (balance_after >= 0),
  created_at timestamptz not null default now(),
  -- null = live. Set once by void_payment.
  voided_at timestamptz,
  constraint payments_tutor_id_receipt_no_key unique (tutor_id, receipt_no),
  constraint payments_tutor_id_request_id_key unique (tutor_id, request_id),
  -- A payment points at a due of the SAME tutor. "no action" and deferred for the same reason as
  -- dues_student_fkey: deleting a tutor cascades to dues and to payments as separate statements.
  constraint payments_due_fkey
    foreign key (tutor_id, due_id) references public.dues (tutor_id, id)
    on delete no action
    deferrable initially deferred
);

create index payments_tutor_id_due_id_idx on public.payments (tutor_id, due_id);

comment on table public.payments is
  'Written only by record_payment and (voided_at only) void_payment. Clients read it and nothing else. Never deleted except by deleting the tutor.';

-- Only voided_at may change, and only from null to a time. Applies to the table owner too, so a future function
-- or a hand-run statement cannot rewrite what money was received. (A test that needs an old created_at disables
-- this trigger inside its own transaction.)
create function public.payments_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.voided_at is not null or new.voided_at is null then
    raise exception 'payment_immutable' using errcode = 'P0001';
  end if;
  if (new.id, new.tutor_id, new.due_id, new.amount, new.method, new.paid_on, new.receipt_no,
      new.receipt_token, new.request_id, new.balance_after, new.created_at)
     is distinct from
     (old.id, old.tutor_id, old.due_id, old.amount, old.method, old.paid_on, old.receipt_no,
      old.receipt_token, old.request_id, old.balance_after, old.created_at) then
    raise exception 'payment_immutable' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger payments_immutable
  before update on public.payments
  for each row execute function public.payments_immutable();

alter table public.payments enable row level security;

-- The only policy. There is deliberately no insert, update or delete policy: no client may write payments.
create policy payments_select on public.payments
  for select to authenticated
  using (tutor_id = (select auth.uid()));

revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

-- ---------------------------------------------------------------------------------------------
-- record_payment
-- ---------------------------------------------------------------------------------------------

create function public.record_payment(
  p_due uuid,
  p_amount integer,
  p_method text,
  p_paid_on date,
  p_request_id uuid
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor uuid;
  v_today date;
  v_last integer;
  v_prior public.payments;
  v_due public.dues;
  v_active boolean;
  v_remaining integer;
  v_after integer;
  v_row public.payments;
begin
  v_tutor := (select auth.uid());
  if v_tutor is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  -- Cheap checks first, before any lock is taken.
  if p_due is null or p_amount is null or p_amount < 1 or p_paid_on is null or p_request_id is null
     or p_method is null or p_method not in ('upi', 'cash') then
    raise exception 'invalid_argument' using errcode = 'P0001';
  end if;

  -- The per-tutor lock. Every step below is serialised per tutor: two calls at the same moment queue here, so
  -- they cannot both take a number and two calls with one request id cannot both insert.
  insert into public.receipt_counters (tutor_id) values (v_tutor) on conflict do nothing;
  select last_no into v_last from public.receipt_counters where tutor_id = v_tutor for update;

  -- A retry returns the same receipt, before the due checks, so a retry after the fee became paid still works.
  select * into v_prior from public.payments where tutor_id = v_tutor and request_id = p_request_id;
  if found then
    if v_prior.due_id <> p_due or v_prior.amount <> p_amount or v_prior.method <> p_method or v_prior.paid_on <> p_paid_on then
      raise exception 'request_reused' using errcode = 'P0001';
    end if;
    return v_prior;
  end if;

  -- The due must be this tutor's. Another tutor's due and an unknown id give the same word.
  select d.* into v_due from public.dues d where d.id = p_due and d.tutor_id = v_tutor for update;
  if not found then
    raise exception 'due_not_found' using errcode = 'P0001';
  end if;

  select s.active into v_active from public.students s where s.id = v_due.student_id and s.tutor_id = v_tutor;
  if not coalesce(v_active, false) then
    raise exception 'student_archived' using errcode = 'P0001';
  end if;

  if v_due.status = 'paid' then
    raise exception 'already_paid' using errcode = 'P0001';
  end if;

  v_remaining := v_due.amount - v_due.amount_paid;
  if p_amount > v_remaining then
    raise exception 'amount_over_remaining' using errcode = 'P0001', detail = v_remaining::text;
  end if;

  v_today := public.india_day(now());
  if p_paid_on > v_today or p_paid_on < v_today - 90 then
    raise exception 'date_out_of_range' using errcode = 'P0001';
  end if;

  v_after := v_remaining - p_amount;

  insert into public.payments (tutor_id, due_id, amount, method, paid_on, receipt_no, request_id, balance_after)
  values (v_tutor, p_due, p_amount, p_method, p_paid_on, v_last + 1, p_request_id, v_after)
  returning * into v_row;

  update public.dues
     set amount_paid = amount_paid + p_amount,
         status = case when v_after = 0 then 'paid' else 'partial' end
   where id = p_due;

  update public.receipt_counters set last_no = v_last + 1 where tutor_id = v_tutor;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- void_payment
-- ---------------------------------------------------------------------------------------------

-- Lock order is counter then due (record_payment) and due then payment (here), and this function never takes the
-- counter, so the two cannot deadlock. The receipt number stays used.
create function public.void_payment(p_payment uuid)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor uuid;
  v_due_id uuid;
  v_pay public.payments;
  v_row public.payments;
begin
  v_tutor := (select auth.uid());
  if v_tutor is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if p_payment is null then
    raise exception 'invalid_argument' using errcode = 'P0001';
  end if;

  select due_id into v_due_id from public.payments where id = p_payment and tutor_id = v_tutor;
  if not found then
    raise exception 'payment_not_found' using errcode = 'P0001';
  end if;

  -- Lock the due first, then re-read the payment under the lock (two voids at once: the second sees voided_at).
  perform 1 from public.dues where id = v_due_id and tutor_id = v_tutor for update;
  select * into v_pay from public.payments where id = p_payment and tutor_id = v_tutor for update;

  if v_pay.voided_at is not null then
    raise exception 'already_voided' using errcode = 'P0001';
  end if;
  if now() - v_pay.created_at > interval '24 hours' then
    raise exception 'undo_window_over' using errcode = 'P0001';
  end if;

  update public.payments set voided_at = now() where id = p_payment returning * into v_row;

  update public.dues
     set amount_paid = amount_paid - v_pay.amount,
         status = case when amount_paid - v_pay.amount = 0 then 'due' else 'partial' end
   where id = v_due_id;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Who may run what
-- ---------------------------------------------------------------------------------------------

-- New public functions are executable by anon and authenticated by default (Supabase grants them directly, so
-- revoking from public alone is not enough). Only the two money functions are for clients.
revoke execute on function public.payments_immutable() from public, anon, authenticated;
revoke execute on function public.record_payment(uuid, integer, text, date, uuid) from public, anon, authenticated;
revoke execute on function public.void_payment(uuid) from public, anon, authenticated;
grant execute on function public.record_payment(uuid, integer, text, date, uuid) to authenticated;
grant execute on function public.void_payment(uuid) to authenticated;
