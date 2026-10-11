-- R1-5: dues. Plan: docs/specs/R1-5-dues.md, "Technical plan", sections 4 and 5.
--
-- * public.dues: what each student owes, one row per student and month (kind 'monthly'), plus at most one
--   "opening" row per student (what they owed before the tutor began). A client can only READ it.
-- * Rows are made by three things, all inside the database and all running as the function owner:
--     1. create_dues_for(), the one place the generation rule lives, called by generate_dues() (the nightly
--        job, all tutors) and by ensure_my_dues() (the signed-in tutor, only their own students);
--     2. sync_opening_due(), a trigger on students that keeps the opening balance in step;
--     3. from R1-7, record_payment(), which will change amount_paid and status (and nothing else).
-- * Nothing here needs pg_cron. The schedule is a separate, later migration.
-- * No client write policy and no client write grant on dues, so this table has ONE policy (select) and not
--   the four of supabase/CLAUDE.md. Same departure as public.tutors.

-- ---------------------------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------------------------

create table public.dues (
  id uuid primary key default gen_random_uuid(),
  -- No default: no client ever inserts a due.
  tutor_id uuid not null references public.tutors (id) on delete cascade,
  student_id uuid not null,
  kind text not null default 'monthly',
  -- First day of the month for a monthly due; null for an opening balance.
  month date,
  -- Money is integer paise.
  amount integer not null,
  amount_paid integer not null default 0,
  status text not null default 'due',
  -- A calendar day with no time zone. "Overdue" is never stored: it is worked out from this and today.
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dues_kind_check check (kind in ('monthly', 'opening')),
  constraint dues_status_check check (status in ('due', 'partial', 'paid')),
  -- The same ceiling as a student's monthly_fee and opening_balance.
  constraint dues_amount_check check (amount > 0 and amount <= 100000000),
  constraint dues_amount_paid_check check (amount_paid >= 0 and amount_paid <= amount),
  constraint dues_status_agrees_check check (
    (status = 'due' and amount_paid = 0)
    or (status = 'partial' and amount_paid > 0 and amount_paid < amount)
    or (status = 'paid' and amount_paid = amount)
  ),
  -- extract(day from date) is immutable and has no time zone in it (date_trunc would go through timestamptz).
  constraint dues_month_check check (
    (kind = 'monthly' and month is not null and extract(day from month) = 1)
    or (kind = 'opening' and month is null)
  ),
  -- The PRD's key. Nulls are distinct, so opening dues (month null) never collide on it.
  constraint dues_student_id_month_key unique (student_id, month),
  -- A due points at a student of the SAME tutor. "no action" and not "restrict", and deferred: deleting a
  -- tutor cascades to students and to dues as two separate cascade statements, and an immediate "no action"
  -- check at the end of the students cascade would see dues that the other cascade has not removed yet,
  -- depending on which cascade runs first. Deferred, the check runs at commit, when both are gone. A direct
  -- delete of a student that still has dues is still refused (23503), at commit.
  constraint dues_student_fkey
    foreign key (tutor_id, student_id) references public.students (tutor_id, id)
    on delete no action
    deferrable initially deferred
);

-- At most one opening due per student.
create unique index dues_one_opening_per_student on public.dues (student_id) where kind = 'opening';

-- The month read, the "earliest month" read, and the tutor-delete cascade.
create index dues_tutor_id_month_idx on public.dues (tutor_id, month);

-- The board's "everything unpaid" read (status <> 'paid').
create index dues_tutor_id_unpaid_idx on public.dues (tutor_id, due_date) where status <> 'paid';

create trigger dues_set_updated_at
  before update on public.dues
  for each row execute function public.set_updated_at();

comment on table public.dues is
  'Written only by create_dues_for (via generate_dues and ensure_my_dues), sync_opening_due and, from R1-7, record_payment. Clients read it and nothing else.';

alter table public.dues enable row level security;

-- The only policy. There is deliberately no insert, update or delete policy: no client may write dues.
create policy dues_select on public.dues
  for select to authenticated
  using (tutor_id = (select auth.uid()));

revoke all on public.dues from anon, authenticated;
grant select on public.dues to authenticated;

-- ---------------------------------------------------------------------------------------------
-- The India day
-- ---------------------------------------------------------------------------------------------

-- The calendar day in India at an instant. timestamptz AT TIME ZONE gives the wall clock in that zone, so the
-- answer does not depend on the session's TimeZone setting. India has no daylight saving.
create function public.india_day(p_at timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select (p_at at time zone 'Asia/Kolkata')::date
$$;

-- ---------------------------------------------------------------------------------------------
-- The worker: the one place the generation rule lives
-- ---------------------------------------------------------------------------------------------

-- Look at the 8 days ending today (India) . For every active student with a fee above 0, take this month's and
-- last month's due date (first of the month + due day - 1). If it is inside the 8 days, is not before the day
-- the student was added, and no due exists for that student and month, create it with the fee as it is now.
-- p_tutor null means every tutor (the nightly job); otherwise only that tutor's students.
-- Returns how many rows it created.
create function public.create_dues_for(p_now timestamptz, p_tutor uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
  v_first date;
  v_prev date;
  v_count integer;
begin
  if p_now is null then
    raise exception 'p_now must not be null' using errcode = '22004';
  end if;

  v_today := public.india_day(p_now);
  -- Pure date arithmetic: no time zone and no table of month lengths.
  v_first := v_today - (extract(day from v_today)::int - 1);
  v_prev := (v_first - 1) - (extract(day from (v_first - 1))::int - 1);

  -- The window is 8 days, so it touches at most two calendar months: this one and the one before.
  -- Fixed row order, so a nightly run and a tutor's own call running at once take their locks in the same
  -- order and cannot deadlock. "on conflict do nothing" with no target covers the (student_id, month) key.
  insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
  select s.tutor_id, s.id, 'monthly'::text, c.first_of_month, s.monthly_fee, 0, 'due'::text,
         c.first_of_month + (s.due_day - 1)
  from public.students s
  cross join (values (v_first), (v_prev)) as c(first_of_month)
  where s.active
    and s.monthly_fee > 0
    and (p_tutor is null or s.tutor_id = p_tutor)
    and c.first_of_month + (s.due_day - 1) between v_today - 7 and v_today
    and c.first_of_month + (s.due_day - 1) >= public.india_day(s.created_at)
  order by s.tutor_id, s.id, c.first_of_month
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The nightly job's entry point. Every tutor.
create function public.generate_dues(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.create_dues_for(p_now, null);
end;
$$;

-- The signed-in tutor's entry point. It takes no argument, so it cannot name a date or a tutor.
create function public.ensure_my_dues()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tutor uuid;
begin
  v_tutor := (select auth.uid());
  if v_tutor is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return public.create_dues_for(now(), v_tutor);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- The opening balance
-- ---------------------------------------------------------------------------------------------

-- Keeps the one opening due in step with students.opening_balance. No exception handler on purpose: a trigger
-- that swallowed an error would silently lose an opening balance. The amount is held to the same ceiling as
-- the student's own check, and the key conflicts are "do nothing", so only a true constraint failure can stop
-- a student being saved.
-- While nothing has been paid against the opening due (amount_paid = 0) a change follows the balance; once
-- something is paid it is frozen. Archiving does not touch it (the update trigger is on opening_balance only).
create function public.sync_opening_due()
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
       where student_id = new.id and kind = 'opening' and amount_paid = 0;
    else
      delete from public.dues
       where student_id = new.id and kind = 'opening' and amount_paid = 0;
    end if;
  end if;
  return null;
end;
$$;

-- An insert trigger's "when" may not mention old, so insert and update are two triggers.
create trigger students_sync_opening_due_insert
  after insert on public.students
  for each row
  when (new.opening_balance > 0)
  execute function public.sync_opening_due();

create trigger students_sync_opening_due_update
  after update of opening_balance on public.students
  for each row
  when (old.opening_balance is distinct from new.opening_balance)
  execute function public.sync_opening_due();

-- One-time backfill, and the exact statement the test runs. Students who already owe (archived ones too) and
-- have no opening due get one, dated the India day of p_now. Run again it creates nothing.
create function public.create_missing_opening_dues(p_now timestamptz)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
  select s.tutor_id, s.id, 'opening'::text, null::date, s.opening_balance, 0, 'due'::text, public.india_day(p_now)
  from public.students s
  where s.opening_balance > 0
  order by s.tutor_id, s.id
  on conflict do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Who may run what
-- ---------------------------------------------------------------------------------------------

-- New public functions are executable by anon and authenticated by default (Supabase grants them directly, so
-- revoking from public alone is not enough). Only ensure_my_dues is for clients. (A trigger's function is
-- checked for execute rights only when the trigger is made.)
revoke execute on function public.india_day(timestamptz) from public, anon, authenticated;
revoke execute on function public.create_dues_for(timestamptz, uuid) from public, anon, authenticated;
revoke execute on function public.generate_dues(timestamptz) from public, anon, authenticated;
revoke execute on function public.sync_opening_due() from public, anon, authenticated;
revoke execute on function public.create_missing_opening_dues(timestamptz) from public, anon, authenticated;
revoke execute on function public.ensure_my_dues() from public, anon, authenticated;
grant execute on function public.ensure_my_dues() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Backfill: students who already owe money (staging has some) get their opening due, once.
-- ---------------------------------------------------------------------------------------------

select public.create_missing_opening_dues(now());
