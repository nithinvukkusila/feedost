-- R1-2 (docs/specs/R1-1-signin-and-data-model.md section 8.6). public.tutors: a tutor reads and edits only
-- their own row, only four columns, and can neither create nor remove a row. Self-contained: it makes its
-- own two users (the trigger makes their tutors rows) and rolls everything back.
begin;
select tests.assert_ready();
select plan(37);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
update public.tutors set name = 'B original' where id = tests.tutor_b();

-- Tutor A reads
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.tutors where id = tests.tutor_a())::int, 1, 'A reads own row');
select ok((select email = 'tutor-a@example.test' and language = 'en' from public.tutors where id = tests.tutor_a()),
  'A sees own email and language en');
select is((select count(*) from public.tutors)::int, 1, 'A sees only own row with B present');

-- A updates the four granted columns
select lives_ok(
  $$update public.tutors set name = 'Meena', subjects = array['maths','hindi'], upi_id = 'meena@okhdfc', language = 'hi'
    where id = tests.tutor_a()$$,
  'A updates name, subjects, upi_id and language');
select ok((select name = 'Meena' and subjects = array['maths','hindi'] and upi_id = 'meena@okhdfc' and language = 'hi'
  from public.tutors where id = tests.tutor_a()), 'A sees the new values');

-- A against B's row
select lives_ok($$update public.tutors set name = 'hijacked' where id = tests.tutor_b()$$, 'A update of B row runs');
select is((select count(*) from public.tutors where id = tests.tutor_b())::int, 0, 'A reads none of B row');

-- Columns A may not write
select throws_ok($$update public.tutors set email = 'x@example.test' where id = tests.tutor_a()$$, '42501', null, 'A cannot update email');
select throws_ok($$update public.tutors set id = tests.tutor_b() where id = tests.tutor_a()$$, '42501', null, 'A cannot update id');
select throws_ok($$update public.tutors set created_at = now() where id = tests.tutor_a()$$, '42501', null, 'A cannot update created_at');

-- No insert, no delete
select throws_ok($$insert into public.tutors (id, email) values (tests.tutor_a(), 'again@example.test')$$, '42501', null, 'A cannot insert a row for self');
select throws_ok($$insert into public.tutors (id, email) values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'c@example.test')$$, '42501', null, 'A cannot insert a row for someone else');
select throws_ok($$delete from public.tutors where id = tests.tutor_a()$$, '42501', null, 'A cannot delete own row');
select throws_ok($$delete from public.tutors where id = tests.tutor_b()$$, '42501', null, 'A cannot delete B row');
select tests.reset();

-- B's row is untouched by A
select is((select name from public.tutors where id = tests.tutor_b()), 'B original', 'A changed nothing of B');

-- B reads zero of A's
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.tutors where id = tests.tutor_a())::int, 0, 'B reads zero of A rows');
select tests.reset();

-- No session
select tests.act_as_anon();
select throws_ok($$select count(*) from public.tutors$$, '42501', null, 'no session cannot select');
select throws_ok($$insert into public.tutors (id, email) values (tests.tutor_a(), 'x@example.test')$$, '42501', null, 'no session cannot insert');
select throws_ok($$update public.tutors set name = 'x'$$, '42501', null, 'no session cannot update');
select throws_ok($$delete from public.tutors$$, '42501', null, 'no session cannot delete');
select tests.reset();

select ok(not has_table_privilege('anon', 'public.tutors', 'select'), 'anon has no select privilege');
select ok(not has_table_privilege('anon', 'public.tutors', 'insert'), 'anon has no insert privilege');
select ok(not has_table_privilege('anon', 'public.tutors', 'update'), 'anon has no update privilege');
select ok(not has_table_privilege('anon', 'public.tutors', 'delete'), 'anon has no delete privilege');

-- Constraints (as the test runner, so only the constraint can refuse)
select throws_ok($$update public.tutors set language = 'xx' where id = tests.tutor_a()$$, '23514', null, 'language outside en, hi, kn, te is refused');
select throws_ok($$update public.tutors set name = '  ' where id = tests.tutor_a()$$, '23514', null, 'blank name is refused');
select throws_ok($$update public.tutors set name = repeat('x', 81) where id = tests.tutor_a()$$, '23514', null, 'name of 81 characters is refused');
select throws_ok($$update public.tutors set upi_id = 'abc' where id = tests.tutor_a()$$, '23514', null, 'UPI ID without @ is refused');
select throws_ok($$update public.tutors set upi_id = 'a b@okhdfc' where id = tests.tutor_a()$$, '23514', null, 'UPI ID with a space is refused');
select throws_ok($$update public.tutors set upi_id = 'name@' where id = tests.tutor_a()$$, '23514', null, 'UPI ID with no bank is refused');
select throws_ok($$update public.tutors set subjects = array['a','b','c','d','e','f','g','h','i'] where id = tests.tutor_a()$$, '23514', null, 'nine subjects are refused');
select lives_ok($$update public.tutors set upi_id = 'meena.tuitions@okhdfc' where id = tests.tutor_a()$$, 'a dotted UPI ID is accepted');
select lives_ok($$update public.tutors set upi_id = 'ravi-9@ybl' where id = tests.tutor_a()$$, 'a UPI ID with a dash and a digit is accepted');
-- The length of the part before the @ is 2 to 256 (the PRD pattern); the edges are where a regex limit hid a bug.
select lives_ok(format('update public.tutors set upi_id = %L where id = tests.tutor_a()', repeat('a', 256) || '@okhdfc'), 'a 256-character UPI name is accepted');
select throws_ok(format('update public.tutors set upi_id = %L where id = tests.tutor_a()', repeat('a', 257) || '@okhdfc'), '23514', null, 'a 257-character UPI name is refused');
select throws_ok($$update public.tutors set upi_id = 'a@okhdfc' where id = tests.tutor_a()$$, '23514', null, 'a 1-character UPI name is refused');

-- updated_at moves forward on update
create temp table updated_before as select updated_at from public.tutors where id = tests.tutor_a();
update public.tutors set name = 'Later' where id = tests.tutor_a();
select ok((select t.updated_at > b.updated_at from public.tutors t, updated_before b where t.id = tests.tutor_a()),
  'updated_at moves forward on update');

select * from finish();
rollback;
