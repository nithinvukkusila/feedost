-- R1-2 (docs/specs/R1-1-signin-and-data-model.md section 8.6). public.students: tutor_id = auth.uid() on all four
-- operations, a student can only point at a batch of the same tutor, the pay token and a few columns are not
-- client-writable, and the constraints hold. Self-contained: makes its own two users and rolls everything back.
begin;
select tests.assert_ready();
select plan(48);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
insert into public.batches (id, tutor_id, name) values
  ('a0000000-0000-4000-8000-000000000001', tests.tutor_a(), 'A batch'),
  ('b0000000-0000-4000-8000-000000000001', tests.tutor_b(), 'B batch');

-- Tutor A (tutor_id and pay_token are left out: the database fills them)
select tests.act_as(tests.tutor_a());
select lives_ok(
  $$insert into public.students (id, name, parent_phone, monthly_fee) values ('a1000000-0000-4000-8000-000000000001', 'Asha', '+919845012345', 150000)$$,
  'A inserts a student');
select is((select count(*) from public.students where tutor_id = tests.tutor_a())::int, 1, 'A reads the student, and the default tutor_id is A');
select ok((select pay_token ~ '^[A-Za-z0-9_-]{24}$' from public.students where id = 'a1000000-0000-4000-8000-000000000001'),
  'pay_token is set, 24 URL-safe characters');
select lives_ok(
  $$insert into public.students (id, batch_id, name) values ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'Ravi')$$,
  'A puts a student in A own batch');
select tests.reset();

-- Tutor B
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.students)::int, 0, 'B reads zero students');
select throws_ok(
  $$insert into public.students (tutor_id, name) values (tests.tutor_a(), 'forged')$$,
  '42501', null, 'B cannot insert a student for A');
select lives_ok($$update public.students set name = 'b-changed' where id = 'a1000000-0000-4000-8000-000000000001'$$, 'B update of A student runs');
select lives_ok($$delete from public.students where id = 'a1000000-0000-4000-8000-000000000001'$$, 'B delete of A student runs');
select throws_ok(
  $$insert into public.students (name, batch_id) values ('sneaky', 'a0000000-0000-4000-8000-000000000001')$$,
  '23503', null, 'B cannot attach a student to A batch');
select lives_ok(
  $$insert into public.students (id, name, batch_id) values ('b1000000-0000-4000-8000-000000000001', 'Bina', 'b0000000-0000-4000-8000-000000000001')$$,
  'B inserts a student into B own batch');
select lives_ok(
  $$insert into public.students (id, name) values ('b1000000-0000-4000-8000-000000000002', 'No batch')$$,
  'a student with no batch is fine');
select tests.reset();

select is((select name from public.students where id = 'a1000000-0000-4000-8000-000000000001'), 'Asha',
  'A student is intact after B tried to change and delete it');

-- B changing batch_id on A's student: the update policy hides the row, so it runs and changes zero rows
select tests.act_as(tests.tutor_b());
select lives_ok($$update public.students set batch_id = 'b0000000-0000-4000-8000-000000000001' where id = 'a1000000-0000-4000-8000-000000000001'$$,
  'B update of batch_id on A student runs and matches no row');
select tests.reset();
select ok((select batch_id is null and tutor_id = tests.tutor_a() from public.students where id = 'a1000000-0000-4000-8000-000000000001'),
  'A student still has no batch and is still A');

-- Columns A may not write
select tests.act_as(tests.tutor_a());
select throws_ok(
  $$insert into public.students (name, pay_token) values ('chosen', 'AAAAAAAAAAAAAAAAAAAAAAAA')$$,
  '42501', null, 'A cannot choose pay_token on insert');
select throws_ok($$update public.students set pay_token = 'AAAAAAAAAAAAAAAAAAAAAAAA' where id = 'a1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'A cannot update pay_token');
select throws_ok($$update public.students set tutor_id = tests.tutor_b() where id = 'a1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'A cannot update tutor_id');
select throws_ok($$update public.students set created_at = now() where id = 'a1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'A cannot update created_at');
-- A moving own student onto B's batch: the composite key (tutor_id, batch_id) has no row (A, B batch)
select throws_ok($$update public.students set batch_id = 'b0000000-0000-4000-8000-000000000001' where id = 'a1000000-0000-4000-8000-000000000001'$$,
  '23503', null, 'A cannot move own student onto B batch');
select tests.reset();

-- Tokens are distinct
insert into public.students (tutor_id, name)
  select tests.tutor_a(), 'bulk ' || g from generate_series(1, 20) as g;
select is((select count(distinct pay_token) from public.students where name like 'bulk %')::int, 20, 'twenty students get twenty different tokens');

-- No session
select tests.act_as_anon();
select throws_ok($$select count(*) from public.students$$, '42501', null, 'no session cannot select');
select throws_ok($$insert into public.students (tutor_id, name) values (tests.tutor_a(), 'anon')$$, '42501', null, 'no session cannot insert');
select throws_ok($$update public.students set name = 'anon'$$, '42501', null, 'no session cannot update');
select throws_ok($$delete from public.students$$, '42501', null, 'no session cannot delete');
select tests.reset();

select ok(not has_table_privilege('anon', 'public.students', 'select'), 'anon has no select privilege');
select ok(not has_table_privilege('anon', 'public.students', 'insert'), 'anon has no insert privilege');
select ok(not has_table_privilege('anon', 'public.students', 'update'), 'anon has no update privilege');
select ok(not has_table_privilege('anon', 'public.students', 'delete'), 'anon has no delete privilege');

-- Constraints (as the test runner, so only the constraint can refuse)
select throws_ok($$insert into public.students (tutor_id, name, monthly_fee) values (tests.tutor_a(), 'x', -1)$$, '23514', null, 'negative monthly_fee is refused');
select throws_ok($$insert into public.students (tutor_id, name, opening_balance) values (tests.tutor_a(), 'x', -1)$$, '23514', null, 'negative opening_balance is refused');
select throws_ok($$insert into public.students (tutor_id, name, monthly_fee) values (tests.tutor_a(), 'x', 100000001)$$, '23514', null, 'monthly_fee over the cap is refused');
select throws_ok($$insert into public.students (tutor_id, name, due_day) values (tests.tutor_a(), 'x', 0)$$, '23514', null, 'due_day 0 is refused');
select throws_ok($$insert into public.students (tutor_id, name, due_day) values (tests.tutor_a(), 'x', 29)$$, '23514', null, 'due_day 29 is refused');
select throws_ok($$insert into public.students (tutor_id, name, parent_phone) values (tests.tutor_a(), 'x', '9845012345')$$, '23514', null, 'phone without +91 is refused');
select throws_ok($$insert into public.students (tutor_id, name, parent_phone) values (tests.tutor_a(), 'x', '+919845012')$$, '23514', null, 'short phone is refused');
select throws_ok($$insert into public.students (tutor_id, name, parent_phone) values (tests.tutor_a(), 'x', '+91984501234a')$$, '23514', null, 'phone with a letter is refused');
select throws_ok($$insert into public.students (tutor_id, name, parent_language) values (tests.tutor_a(), 'x', 'ta')$$, '23514', null, 'parent_language outside the four is refused');
select throws_ok($$insert into public.students (tutor_id, name) values (tests.tutor_a(), '  ')$$, '23514', null, 'blank name is refused');
select lives_ok($$insert into public.students (tutor_id, name, parent_phone, monthly_fee, due_day) values (tests.tutor_a(), 'ok1', '+919845012345', 0, 1)$$, 'valid phone, fee 0 and due day 1 are accepted');
select lives_ok($$insert into public.students (tutor_id, name, due_day) values (tests.tutor_a(), 'ok28', 28)$$, 'due day 28 is accepted');

-- The raw length is capped too: padding does not count towards the 80 but does towards 400
select throws_ok(format('insert into public.students (tutor_id, name) values (tests.tutor_a(), %L)', repeat(' ', 400) || 'x'), '23514', null, 'a name of 401 raw characters is refused');
select lives_ok(format('insert into public.students (tutor_id, name) values (tests.tutor_a(), %L)', repeat(' ', 399) || 'x'), 'a name of 400 raw characters is accepted');
select throws_ok(format('insert into public.students (tutor_id, name) values (tests.tutor_a(), %L)', repeat(' ', 5000) || 'a'), '23514', null, 'a name of 5000 spaces then a letter is refused');

-- Removing a user removes their tutor, batches and students, and only theirs
delete from auth.users where id = tests.tutor_a();
select is((select count(*) from public.tutors where id = tests.tutor_a())::int, 0, 'A tutor row is gone');
select is((select count(*) from public.batches where tutor_id = tests.tutor_a())::int, 0, 'A batches are gone');
select is((select count(*) from public.students where tutor_id = tests.tutor_a())::int, 0, 'A students are gone');
select is((select count(*) from public.students where tutor_id = tests.tutor_b())::int, 2, 'B students stay');
select is((select count(*) from public.batches where tutor_id = tests.tutor_b())::int, 1, 'B batch stays');

select * from finish();
rollback;
