-- R1-5 criteria 17 to 28 (docs/specs/R1-5-dues.md section 4 and plan section 5). generate_dues(p_now) and the one worker
-- behind it, create_dues_for: what it creates, what it refuses to create, idempotence, catch-up, the fee snapshot,
-- due-day changes, February and leap years, India midnight under two session time zones, restore, and two tutors.
-- It is called as the test runner with a fixed p_now, so the clock never matters. Self-contained; rolls back.
-- Groups are labelled by rule: if the founder later chooses "create every fee on the 1st" (spec Q1), only groups
-- A, B, D, I (and the date tests inside C, E, F, G, H) change; the table and the policies do not.
-- Between cases the dues and students are deleted (allowed: the foreign key is deferred and nothing commits).
begin;
select tests.assert_ready();
select plan(69);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');

-- ---------------------------------------------------------------------------------------------
-- A. The rule (criteria 17 and 18). p_now 2026-10-12 05:00 UTC is 12 Oct, 10:30 in India.
-- ---------------------------------------------------------------------------------------------
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'd12', 12, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'd5', 5, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'd4', 4, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'd13', 13, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'archived', 12, 100000, false, '2026-01-01'),
  (tests.tutor_a(), 'zero', 12, 0, true, '2026-01-01'),
  (tests.tutor_a(), 'max', 12, 100000000, true, '2026-01-01');
select is(public.generate_dues('2026-10-12 05:00+00'), 3, 'A: the run creates exactly three dues (today, the oldest day in the window, the largest fee)');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'd12'), '2026-10-01 2026-10-12', 'A: due day 12 gets the 12 Oct due');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'd5'), '2026-10-01 2026-10-05', 'A: due day 5 (7 days ago, the oldest day in the window) gets its due');
select is((select d.amount from public.dues d join public.students s on s.id = d.student_id where s.name = 'max'), 100000000, 'A: a fee of 100000000 becomes a due of 100000000');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'd4')::int, 0, 'A: due day 4 (8 days ago) gets nothing');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'd13')::int, 0, 'A: due day 13 (tomorrow) gets nothing');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'archived')::int, 0, 'A: an archived student gets nothing');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'zero')::int, 0, 'A: a fee of 0 gets nothing');
select is_empty(
  $$select d.id from public.dues d join public.students s on s.id = d.student_id
    where not (d.kind = 'monthly' and d.amount_paid = 0 and d.status = 'due' and d.amount = s.monthly_fee and d.tutor_id = s.tutor_id)$$,
  'A: every due is monthly, unpaid, status due, the fee as it was, and carries its student tutor');

-- ---------------------------------------------------------------------------------------------
-- B. Added on the day (criterion 26). A student's first due is on or after the India day they were added.
-- 08:00 UTC on 12 Oct is 13:30 in India, the same India day.
-- ---------------------------------------------------------------------------------------------
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'sameday', 12, 100000, true, '2026-10-12 08:00+00'),
  (tests.tutor_a(), 'nextday', 11, 100000, true, '2026-10-12 08:00+00');
select is(public.generate_dues('2026-10-12 10:00+00'), 1, 'B: one due is created');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'sameday'), '2026-10-01 2026-10-12', 'B: a student added on their due day gets that month due');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'nextday')::int, 0, 'B: a student added the day after their due day gets none for that month');

-- ---------------------------------------------------------------------------------------------
-- C. Idempotence and the daily run (criterion 19)
-- ---------------------------------------------------------------------------------------------
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'c5', 5, 100000, true, '2026-09-01');
select is(public.generate_dues('2026-10-05 05:00+00'), 1, 'C: the first run at the due day creates the due');
select is(public.generate_dues('2026-10-05 05:00+00'), 0, 'C: the second run at the same instant creates 0 and raises nothing');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'c5')::int, 1, 'C: still one due');
delete from public.dues;
select is((select sum(public.generate_dues(timestamptz '2026-09-01 05:00+00' + g * interval '24 hours'))::int from generate_series(0, 61) as g), 2,
  'C: a run every day for 62 days creates exactly two dues for due day 5');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'c5')::int, 2, 'C: and there are exactly two rows (5 Sep and 5 Oct)');
delete from public.dues;
insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date)
  select s.tutor_id, s.id, 'monthly', '2026-10-01', 100000, 0, 'due', '2026-10-05' from public.students s where s.name = 'c5';
select is(public.generate_dues('2026-10-05 05:00+00'), 0, 'C: a due already made by a run that got there first is not made again, and raises nothing');

-- ---------------------------------------------------------------------------------------------
-- D. Catch-up (criterion 20)
-- ---------------------------------------------------------------------------------------------
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'k10', 10, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'k11', 11, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'k12', 12, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'k13', 13, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'k4', 4, 100000, true, '2026-01-01');
select is(public.generate_dues('2026-10-13 05:00+00'), 4, 'D: one run on the 13th creates the dues of the 10th to the 13th');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'k4')::int, 0, 'D: a due day 9 days before today gets nothing');
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'm10', 10, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'm11', 11, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'm12', 12, 100000, true, '2026-01-01'),
  (tests.tutor_a(), 'm13', 13, 100000, true, '2026-01-01');
select is(public.generate_dues('2026-10-09 05:00+00'), 0, 'D: a run on the 9th has nothing due yet');
select is(public.generate_dues('2026-10-13 05:00+00'), 4, 'D: no run on the 10th, 11th or 12th; the run on the 13th makes all four');
select is((select count(*) from public.dues)::int, 4, 'D: four rows');

-- ---------------------------------------------------------------------------------------------
-- E. The fee is a snapshot (criterion 21)
-- ---------------------------------------------------------------------------------------------
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'e12', 12, 120000, true, '2026-01-01');
select is(public.generate_dues('2026-10-12 05:00+00'), 1, 'E: the October due is created');
update public.students set monthly_fee = 150000 where name = 'e12';
select is(public.generate_dues('2026-10-12 05:00+00'), 0, 'E: after the fee changes, the same day makes no second row');
select is((select d.amount from public.dues d where d.month = '2026-10-01'), 120000, 'E: the existing due keeps its amount');
select is(public.generate_dues('2026-11-12 05:00+00'), 1, 'E: the next month run creates one due');
select is((select d.amount from public.dues d where d.month = '2026-11-01'), 150000, 'E: the November due has the new fee');
select is((select d.amount from public.dues d where d.month = '2026-10-01'), 120000, 'E: the October due still has the old fee');

-- ---------------------------------------------------------------------------------------------
-- F. Changing the due day (criterion 22)
-- ---------------------------------------------------------------------------------------------
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'f5', 5, 100000, true, '2026-01-01');
select is(public.generate_dues('2026-10-05 05:00+00'), 1, 'F: the October due is created on the 5th');
update public.students set due_day = 8 where name = 'f5';
select is(public.generate_dues('2026-10-08 05:00+00'), 0, 'F: after the due day moves, the 8th creates no second October due');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'f5' and d.month = '2026-10-01'), '2026-10-01 2026-10-05', 'F: the existing due did not move');
select is(public.generate_dues('2026-11-08 05:00+00'), 1, 'F: November creates one due');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'f5' and d.month = '2026-11-01'), '2026-11-01 2026-11-08', 'F: it uses the new due day');

-- ---------------------------------------------------------------------------------------------
-- G. February and leap years (criterion 23)
-- ---------------------------------------------------------------------------------------------
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'g28', 28, 100000, true, '2026-01-01');
select is(public.generate_dues('2027-02-28 05:00+00'), 1, 'G: due day 28 gets a due on 28 Feb 2027');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'g28' and d.month = '2027-02-01'), '2027-02-01 2027-02-28', 'G: dated 28 Feb 2027');
select is(public.generate_dues('2028-02-28 05:00+00'), 1, 'G: and a due on 28 Feb 2028, a leap year');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'g28' and d.month = '2028-02-01'), '2028-02-01 2028-02-28', 'G: dated 28 Feb 2028');
select is(public.generate_dues('2028-02-29 05:00+00'), 0, 'G: 29 Feb 2028 is a due date for nobody');
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, created_at)
  select tests.tutor_a(), 'g' || g, g, 100000, '2028-01-01'::timestamptz from generate_series(1, 28) as g;
select ok((select sum(public.generate_dues(timestamptz '2028-02-01 05:00+00' + g * interval '24 hours')) from generate_series(0, 33) as g) > 0,
  'G: 28 students with due days 1 to 28, a run every day from 1 Feb to 5 Mar 2028');
select is((select count(*) from public.dues where month = '2028-02-01')::int, 28, 'G: 28 February dues');
select is((select count(*) from public.dues where due_date = '2028-02-29')::int, 0, 'G: none dated 29 Feb 2028');
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'g28', 28, 100000, true, '2026-01-01');
select is(public.generate_dues('2028-03-01 05:00+00'), 1, 'G: a first run on 1 Mar 2028 creates the February due (last month across a leap February)');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'g28'), '2028-02-01 2028-02-28', 'G: month 1 Feb 2028, dated 28 Feb 2028');
delete from public.dues;
select is(public.generate_dues('2027-03-01 05:00+00'), 1, 'G: the same on 1 Mar 2027 creates the February due');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'g28'), '2027-02-01 2027-02-28', 'G: month 1 Feb 2027, dated 28 Feb 2027');

-- ---------------------------------------------------------------------------------------------
-- H. India midnight (criteria 24 and 28). 18:30 UTC is 00:00 in India. Same answers in every session time zone.
-- ---------------------------------------------------------------------------------------------
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'h1', 1, 100000, true, '2026-01-01');
set local timezone to 'UTC';
delete from public.dues;
select is(public.generate_dues('2026-10-31 18:29:59+00'), 0, 'H (UTC): at 23:59:59 India time on 31 Oct nothing is due on 1 Nov');
select is(public.generate_dues('2026-10-31 18:30:00+00'), 1, 'H (UTC): at 00:00:00 India time on 1 Nov the November due is created');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'h1'), '2026-11-01 2026-11-01', 'H (UTC): month and due date are 1 Nov 2026');
set local timezone to 'America/Los_Angeles';
delete from public.dues;
select is(public.generate_dues('2026-10-31 18:29:59+00'), 0, 'H (America/Los_Angeles): at 23:59:59 India time on 31 Oct nothing is due on 1 Nov');
select is(public.generate_dues('2026-10-31 18:30:00+00'), 1, 'H (America/Los_Angeles): at 00:00:00 India time on 1 Nov the November due is created');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'h1'), '2026-11-01 2026-11-01', 'H (America/Los_Angeles): month and due date are 1 Nov 2026');
set local timezone to 'UTC';
select is(public.india_day('2026-10-31 18:29:59+00')::text || ' ' || public.india_day('2026-10-31 18:30:00+00')::text || ' ' || public.india_day('2026-12-31 18:30:00+00')::text,
  '2026-10-31 2026-11-01 2027-01-01', 'H: india_day gives the India calendar day (session time zone UTC)');
set local timezone to 'America/Los_Angeles';
select is(public.india_day('2026-10-31 18:29:59+00')::text || ' ' || public.india_day('2026-10-31 18:30:00+00')::text || ' ' || public.india_day('2026-12-31 18:30:00+00')::text,
  '2026-10-31 2026-11-01 2027-01-01', 'H: india_day gives the India calendar day (session time zone America/Los_Angeles)');
set local timezone to 'Pacific/Kiritimati';
select is(public.india_day('2026-10-31 18:29:59+00')::text || ' ' || public.india_day('2026-10-31 18:30:00+00')::text || ' ' || public.india_day('2026-12-31 18:30:00+00')::text,
  '2026-10-31 2026-11-01 2027-01-01', 'H: india_day gives the India calendar day (session time zone Pacific/Kiritimati)');
reset timezone;

-- ---------------------------------------------------------------------------------------------
-- I. Restore (criterion 25)
-- ---------------------------------------------------------------------------------------------
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'r1', 12, 100000, false, '2026-01-01'),
  (tests.tutor_a(), 'r2', 12, 100000, false, '2026-01-01');
select is(public.generate_dues('2026-10-12 05:00+00'), 0, 'I: archived on their due day, they get nothing');
update public.students set active = true where name = 'r1';
select is(public.generate_dues('2026-10-15 05:00+00'), 1, 'I: restored 3 days later, the due is created on the next run');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'r1'), '2026-10-01 2026-10-12', 'I: it is the 12 Oct due');
update public.students set active = true where name = 'r2';
select is(public.generate_dues('2026-10-22 05:00+00'), 0, 'I: restored 10 days later, nothing for that month');
select is((select count(*) from public.dues d join public.students s on s.id = d.student_id where s.name = 'r2')::int, 0, 'I: r2 has no due');
select is(public.generate_dues('2026-11-12 05:00+00'), 2, 'I: in November both get their due normally');
select is((select d.month::text || ' ' || d.due_date::text from public.dues d join public.students s on s.id = d.student_id where s.name = 'r2'), '2026-11-01 2026-11-12', 'I: r2 November due');

-- ---------------------------------------------------------------------------------------------
-- J. Two tutors in one run (criterion 27)
-- ---------------------------------------------------------------------------------------------
delete from public.dues;
delete from public.students;
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_a(), 'ja', 12, 100000, true, '2026-01-01');
insert into public.students (tutor_id, name, due_day, monthly_fee, active, created_at) values
  (tests.tutor_b(), 'jb', 12, 200000, true, '2026-01-01');
select is(public.generate_dues('2026-10-12 05:00+00'), 2, 'J: one run creates one due for each tutor');
select is((select count(*) from public.dues where tutor_id = tests.tutor_a())::int, 1, 'J: A has one due');
select is((select count(*) from public.dues where tutor_id = tests.tutor_b())::int, 1, 'J: B has one due');
select is_empty($$select d.id from public.dues d join public.students s on s.id = d.student_id where s.tutor_id <> d.tutor_id$$, 'J: no due carries another tutor id than its student');
select is((select d.amount from public.dues d join public.students s on s.id = d.student_id where s.name = 'jb'), 200000, 'J: B own student produced B due with B fee');

-- ---------------------------------------------------------------------------------------------
-- K. Signature and nulls
-- ---------------------------------------------------------------------------------------------
select is(pg_get_function_result('public.generate_dues(timestamptz)'::regprocedure), 'integer', 'K: generate_dues(timestamptz) returns integer');
select throws_ok($$select public.generate_dues(null)$$, '22004', null, 'K: a null instant is refused');

select * from finish();
rollback;
