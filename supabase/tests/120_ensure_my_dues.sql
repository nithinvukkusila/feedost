-- R1-5 criterion 29 (docs/specs/R1-5-dues.md section 4 and plan section 5). ensure_my_dues(): no arguments, the same
-- rule as the nightly job, only for the signed-in tutor's own students, and it works although the tutor holds
-- no insert right on dues. Self-contained; rolls back.
-- now() does not move inside this transaction, so the students' due day is worked out from the same instant the
-- function will use: today's India day of month, or 28 when that is later (a student's due day is 1 to 28). On the
-- 29th to 31st the due date is the 28th, 1 to 3 days ago, still inside the 8-day window.
begin;
select tests.assert_ready();
select plan(18);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'tutor-c@example.test');

insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at)
select v.tutor, v.name, least(extract(day from public.india_day(now()))::int, 28), v.fee, v.active, now() - interval '60 days'
from (values
  (tests.tutor_a(), 'e1', 120000, true),
  (tests.tutor_a(), 'e2', 150000, true),
  (tests.tutor_a(), 'earch', 100000, false),
  (tests.tutor_a(), 'ezero', 0, true),
  (tests.tutor_b(), 'b1', 100000, true)
) as v(tutor, name, fee, active);

-- The function itself
select is(pg_get_function_result('public.ensure_my_dues()'::regprocedure), 'integer', 'ensure_my_dues returns integer');
select is((select pronargs::int from pg_proc where oid = 'public.ensure_my_dues()'::regprocedure), 0, 'ensure_my_dues takes no arguments');
select ok((select prosecdef and coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.ensure_my_dues()'::regprocedure),
  'ensure_my_dues is security definer with a fixed search_path');
select throws_ok($$select public.ensure_my_dues(timestamptz '2026-01-01')$$, '42883', null, 'ensure_my_dues cannot be given a date');
select ok(not has_table_privilege('authenticated', 'public.dues', 'insert'), 'a tutor holds no insert right on dues');

-- Tutor A
select tests.act_as(tests.tutor_a());
select is(public.ensure_my_dues(), 2, 'A: the first call creates the two dues of A active students (although A cannot insert into dues)');
select is(public.ensure_my_dues(), 0, 'A: a second call right after creates none');
select tests.reset();
select is((select count(*) from public.dues where tutor_id = tests.tutor_a())::int, 2, 'A has two dues');
select is((select count(*) from public.dues where tutor_id = tests.tutor_b())::int, 0, 'A call created nothing for B');
select is_empty(
  $$select d.id from public.dues d join public.students s on s.id = d.student_id
    where s.tutor_id <> d.tutor_id or d.kind <> 'monthly' or d.status <> 'due' or d.amount <> s.monthly_fee$$,
  'the dues are monthly, unpaid and carry the fee and their student tutor');

-- A tutor with no students
select tests.act_as('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select is(public.ensure_my_dues(), 0, 'a tutor with no students gets 0 and no error');
select tests.reset();

-- No session, and a session with no sub
select tests.act_as_anon();
select throws_ok($$select public.ensure_my_dues()$$, '42501', null, 'no session cannot call ensure_my_dues');
select tests.reset();
select tests.act_as(tests.tutor_a());
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok($$select public.ensure_my_dues()$$, '42501', null, 'a token with no sub does nothing (not "all tutors")');
select tests.reset();

-- Tutor B
select tests.act_as(tests.tutor_b());
select is(public.ensure_my_dues(), 1, 'B: the call creates the one due of B student');
select tests.reset();
select is((select count(*) from public.dues where tutor_id = tests.tutor_a())::int, 2, 'B call created nothing for A');
select is((select count(*) from public.dues where tutor_id = tests.tutor_b())::int, 1, 'B has one due');

-- The nightly job applies the same rule
insert into public.students (tutor_id, name, due_day, monthly_fee, created_at)
  values (tests.tutor_b(), 'b2', least(extract(day from public.india_day(now()))::int, 28), 90000, now() - interval '60 days');
select is(public.generate_dues(now()), 1, 'the job creates the one due that is missing (everything else exists)');
select is((select d.due_date from public.dues d join public.students s on s.id = d.student_id where s.name = 'b2'),
  (select d.due_date from public.dues d join public.students s on s.id = d.student_id where s.name = 'e1'),
  'the job and ensure_my_dues choose the same due date');

select * from finish();
rollback;
