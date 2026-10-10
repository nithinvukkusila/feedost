-- R1-2: tutors, batches, students, with row-level security.
-- Plan: docs/specs/R1-1-signin-and-data-model.md section 8.5.
--
-- * tutors: one row per signed-in tutor, id = their auth id. Made by a trigger on auth.users,
--   never by a client: no insert or delete policy, and no insert or delete grant.
-- * batches, students: tutor_id = auth.uid() on all four operations.
-- * Every table: revoke all from anon and authenticated, then grant back to authenticated only,
--   with column-level grants where a column must not be client-writable.
-- * A student can only point at a batch of the same tutor (composite foreign key).

-- ---------------------------------------------------------------------------------------------
-- Shared functions
-- ---------------------------------------------------------------------------------------------

-- Keeps updated_at honest. clock_timestamp() rather than now(): inside one transaction now() does
-- not move, and a test (or a batch import) that updates a row it just made would see no change.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

-- Creates the tutor row when auth creates the user. Runs as the function owner so it needs no
-- insert right for clients. Empty search_path: every name below is schema-qualified.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tutors (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- New public functions are executable by anon and authenticated by default. Neither function is
-- for clients. (A trigger's function is checked for execute rights only when the trigger is made.)
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- tutors
-- ---------------------------------------------------------------------------------------------

create table public.tutors (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  language text not null default 'en',
  upi_id text,
  subjects text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tutors_name_check
    check (name is null or char_length(btrim(name)) between 1 and 80),
  constraint tutors_language_check
    check (language in ('en', 'hi', 'kn', 'te')),
  -- The PRD pattern ^[\w.\-]{2,256}@[a-zA-Z]{2,64}$ with \w written out, so SQL and JavaScript agree.
  constraint tutors_upi_id_check
    check (upi_id is null or upi_id ~ '^[A-Za-z0-9_.-]{2,256}@[A-Za-z]{2,64}$'),
  constraint tutors_subjects_check
    check (
      cardinality(subjects) <= 8
      and octet_length(array_to_string(subjects, ',')) <= 400
    )
);

create trigger tutors_set_updated_at
  before update on public.tutors
  for each row execute function public.set_updated_at();

alter table public.tutors enable row level security;

create policy tutors_select on public.tutors
  for select to authenticated
  using (id = (select auth.uid()));

create policy tutors_update on public.tutors
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke all on public.tutors from anon, authenticated;
grant select on public.tutors to authenticated;
grant update (name, subjects, upi_id, language) on public.tutors to authenticated;

-- The trigger that makes the tutor row. After the table exists.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------------------------
-- batches
-- ---------------------------------------------------------------------------------------------

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references public.tutors (id) on delete cascade,
  name text not null,
  timings text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The target of composite foreign keys; also the tutor index.
  constraint batches_tutor_id_id_key unique (tutor_id, id),
  constraint batches_name_check check (char_length(btrim(name)) between 1 and 60),
  constraint batches_timings_check check (timings is null or char_length(timings) <= 100)
);

-- Two batches of one tutor cannot share a name, whatever the case.
create unique index batches_tutor_id_lower_name_key on public.batches (tutor_id, lower(name));

create trigger batches_set_updated_at
  before update on public.batches
  for each row execute function public.set_updated_at();

alter table public.batches enable row level security;

create policy batches_select on public.batches
  for select to authenticated
  using (tutor_id = (select auth.uid()));

create policy batches_insert on public.batches
  for insert to authenticated
  with check (tutor_id = (select auth.uid()));

create policy batches_update on public.batches
  for update to authenticated
  using (tutor_id = (select auth.uid()))
  with check (tutor_id = (select auth.uid()));

create policy batches_delete on public.batches
  for delete to authenticated
  using (tutor_id = (select auth.uid()));

revoke all on public.batches from anon, authenticated;
grant select, insert, update, delete on public.batches to authenticated;

-- ---------------------------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------------------------

create table public.students (
  id uuid primary key default gen_random_uuid(),
  tutor_id uuid not null default auth.uid() references public.tutors (id) on delete cascade,
  batch_id uuid,
  name text not null,
  parent_name text,
  parent_phone text,
  parent_language text not null default 'en',
  monthly_fee integer not null default 0,
  opening_balance integer not null default 0,
  due_day smallint not null default 1,
  -- 18 random bytes give exactly 24 base64 characters (no padding); + and / become - and _.
  pay_token text not null unique
    default translate(encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_tutor_id_id_key unique (tutor_id, id),
  -- A plain batch_id foreign key is checked without row-level security, so tutor B could attach a
  -- student to tutor A's batch id. Matching tutor_id as well closes that. With batch_id null the
  -- key is not checked (match simple). Deleting a batch nulls batch_id only, never tutor_id.
  constraint students_batch_fkey
    foreign key (tutor_id, batch_id) references public.batches (tutor_id, id)
    on delete set null (batch_id),
  constraint students_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint students_parent_name_check check (parent_name is null or char_length(parent_name) <= 80),
  constraint students_parent_phone_check check (parent_phone is null or parent_phone ~ '^\+91[0-9]{10}$'),
  constraint students_parent_language_check check (parent_language in ('en', 'hi', 'kn', 'te')),
  constraint students_monthly_fee_check check (monthly_fee >= 0 and monthly_fee <= 100000000),
  constraint students_opening_balance_check check (opening_balance >= 0 and opening_balance <= 100000000),
  constraint students_due_day_check check (due_day between 1 and 28)
);

create index students_tutor_id_batch_id_idx on public.students (tutor_id, batch_id);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

alter table public.students enable row level security;

create policy students_select on public.students
  for select to authenticated
  using (tutor_id = (select auth.uid()));

create policy students_insert on public.students
  for insert to authenticated
  with check (tutor_id = (select auth.uid()));

create policy students_update on public.students
  for update to authenticated
  using (tutor_id = (select auth.uid()))
  with check (tutor_id = (select auth.uid()));

create policy students_delete on public.students
  for delete to authenticated
  using (tutor_id = (select auth.uid()));

-- Column-level writes: the token, created_at and updated_at are never client-writable, and
-- tutor_id can be given on insert (it must equal the session) but never changed afterwards.
revoke all on public.students from anon, authenticated;
grant select, delete on public.students to authenticated;
grant insert (id, tutor_id, batch_id, name, parent_name, parent_phone, parent_language,
              monthly_fee, opening_balance, due_day, active)
  on public.students to authenticated;
grant update (batch_id, name, parent_name, parent_phone, parent_language,
              monthly_fee, opening_balance, due_day, active)
  on public.students to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Backfill: users that already exist (staging has some from dashboard testing) get a tutor row.
-- Safe to run again: on conflict do nothing.
-- ---------------------------------------------------------------------------------------------

insert into public.tutors (id, email)
select u.id, u.email
from auth.users u
on conflict (id) do nothing;
