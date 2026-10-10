-- R1-2 (docs/specs/R1-1-signin-and-data-model.md section 8.6). public.batches: tutor_id = auth.uid() on all four
-- operations, a tutor's batch names are unique ignoring case, and deleting a batch frees its students.
-- Self-contained: makes its own two users and rolls everything back.
begin;
select tests.assert_ready();
select plan(24);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');

-- Tutor A (tutor_id is left out on purpose: its default is the session's id)
select tests.act_as(tests.tutor_a());
select lives_ok(
  $$insert into public.batches (id, name, timings) values ('a0000000-0000-4000-8000-000000000001', 'Class 10 Maths', 'Mon Wed Fri 5pm')$$,
  'A inserts a batch');
select is((select count(*) from public.batches where tutor_id = tests.tutor_a())::int, 1, 'A reads the batch, and the default tutor_id is A');
select tests.reset();

-- Tutor B
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.batches)::int, 0, 'B reads zero batches');
select throws_ok(
  $$insert into public.batches (tutor_id, name) values (tests.tutor_a(), 'forged')$$,
  '42501', null, 'B cannot insert a batch for A');
select lives_ok(
  $$insert into public.batches (id, name) values ('b0000000-0000-4000-8000-000000000001', 'Class 10 Maths')$$,
  'B inserts own batch, and may reuse A batch name');
select lives_ok($$update public.batches set name = 'b-changed' where id = 'a0000000-0000-4000-8000-000000000001'$$, 'B update of A batch runs');
select lives_ok($$delete from public.batches where id = 'a0000000-0000-4000-8000-000000000001'$$, 'B delete of A batch runs');
select tests.reset();

select is((select name from public.batches where id = 'a0000000-0000-4000-8000-000000000001'), 'Class 10 Maths',
  'A batch is intact after B tried to change and delete it');

-- A cannot hand a batch to B
select tests.act_as(tests.tutor_a());
select throws_ok($$update public.batches set tutor_id = tests.tutor_b() where id = 'a0000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'A cannot move a batch to B');
select tests.reset();

-- No session
select tests.act_as_anon();
select throws_ok($$select count(*) from public.batches$$, '42501', null, 'no session cannot select');
select throws_ok($$insert into public.batches (tutor_id, name) values (tests.tutor_a(), 'anon')$$, '42501', null, 'no session cannot insert');
select throws_ok($$update public.batches set name = 'anon'$$, '42501', null, 'no session cannot update');
select throws_ok($$delete from public.batches$$, '42501', null, 'no session cannot delete');
select tests.reset();

select ok(not has_table_privilege('anon', 'public.batches', 'select'), 'anon has no select privilege');
select ok(not has_table_privilege('anon', 'public.batches', 'insert'), 'anon has no insert privilege');
select ok(not has_table_privilege('anon', 'public.batches', 'update'), 'anon has no update privilege');
select ok(not has_table_privilege('anon', 'public.batches', 'delete'), 'anon has no delete privilege');

-- Names and lengths (as the test runner, so only the constraint can refuse)
select throws_ok(
  $$insert into public.batches (tutor_id, name) values (tests.tutor_a(), 'class 10 MATHS')$$,
  '23505', null, 'same name in another case for the same tutor is refused');
select is((select count(*) from public.batches where lower(name) = 'class 10 maths')::int, 2, 'A and B each hold a batch with that name');
select throws_ok($$insert into public.batches (tutor_id, name) values (tests.tutor_a(), '   ')$$, '23514', null, 'blank name is refused');
select throws_ok($$insert into public.batches (tutor_id, name) values (tests.tutor_a(), repeat('x', 61))$$, '23514', null, 'name over 60 characters is refused');
select throws_ok($$insert into public.batches (tutor_id, name, timings) values (tests.tutor_a(), 'Timed', repeat('x', 101))$$, '23514', null, 'timings over 100 characters are refused');

-- Deleting a batch keeps its students, frees them, and keeps their tutor_id
insert into public.students (id, tutor_id, batch_id, name)
  values ('a1000000-0000-4000-8000-000000000001', tests.tutor_a(), 'a0000000-0000-4000-8000-000000000001', 'Asha');
select tests.act_as(tests.tutor_a());
select lives_ok($$delete from public.batches where id = 'a0000000-0000-4000-8000-000000000001'$$, 'A deletes own batch');
select tests.reset();
select ok((select batch_id is null and tutor_id = tests.tutor_a() from public.students where id = 'a1000000-0000-4000-8000-000000000001'),
  'the student stays, with no batch and the same tutor');

select * from finish();
rollback;
