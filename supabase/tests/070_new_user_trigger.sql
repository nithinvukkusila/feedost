-- R1-2 (docs/specs/R1-1-signin-and-data-model.md section 8.6). The trigger on auth.users that creates the tutor
-- row: one row per new user, safe to repeat, works with no email, and its functions are not callable by clients.
-- Self-contained: makes its own users and rolls everything back.
begin;
select tests.assert_ready();
select plan(16);

insert into auth.users (id, email) values
  (tests.tutor_a(), 'tutor-a@example.test'),
  (tests.tutor_b(), 'tutor-b@example.test');
-- A user with no email (null).
insert into auth.users (id, email) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', null);

select has_trigger('auth', 'users', 'on_auth_user_created', 'auth.users has the tutor trigger');

-- One row per new user, with the empty profile
select is((select count(*) from public.tutors where id = tests.tutor_a())::int, 1, 'a new user gets exactly one tutors row');
select ok((select email = 'tutor-a@example.test' and language = 'en' and name is null and upi_id is null and subjects = '{}'
  from public.tutors where id = tests.tutor_a()), 'the row has the same email, language en, and an empty profile');
select ok((select email is null and name is null from public.tutors where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'),
  'a user with no email still gets a tutors row');

-- Repeating changes nothing and raises nothing
select lives_ok(
  $$insert into public.tutors (id, email) values (tests.tutor_a(), 'other@example.test') on conflict (id) do nothing$$,
  'inserting the same tutor again raises nothing');
select ok((select count(*) = 1 and min(email) = 'tutor-a@example.test' from public.tutors where id = tests.tutor_a()),
  'still one row, email unchanged');
select lives_ok(
  $$insert into public.tutors (id, email) select u.id, u.email from auth.users u on conflict (id) do nothing$$,
  'the migration backfill statement can run again');
select is((select count(*) from public.tutors)::int, (select count(*) from auth.users)::int,
  'one tutors row per user, no more');

-- Visibility
select tests.act_as(tests.tutor_a());
select is((select count(*) from public.tutors where id = tests.tutor_a())::int, 1, 'the new tutor reads own row');
select tests.reset();
select tests.act_as(tests.tutor_b());
select is((select count(*) from public.tutors where id = tests.tutor_a())::int, 0, 'tutor B cannot read it');
select tests.reset();

-- Neither function is callable by clients
select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'), 'anon cannot execute handle_new_user');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'), 'authenticated cannot execute handle_new_user');
select ok(not has_function_privilege('anon', 'public.set_updated_at()', 'execute'), 'anon cannot execute set_updated_at');
select ok(not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'), 'authenticated cannot execute set_updated_at');

-- The trigger function runs as its owner with a fixed search_path
select ok((select prosecdef from pg_proc where oid = 'public.handle_new_user()'::regprocedure), 'handle_new_user is security definer');
select ok((select coalesce(proconfig::text, '') like '%search_path%' from pg_proc where oid = 'public.handle_new_user()'::regprocedure),
  'handle_new_user fixes its search_path');

select * from finish();
rollback;
