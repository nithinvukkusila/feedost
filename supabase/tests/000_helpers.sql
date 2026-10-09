-- Shared helpers for every pgTAP file (F4 criterion 10). Runs first (name order).
-- This file is NOT wrapped in a transaction on purpose (a rollback would remove the helpers): the schema "tests" stays for the files
-- that run after it. It is create-or-replace throughout, so a second run passes (criterion 13).
-- Only the test run uses it: no migration creates it, and "supabase db reset" removes it.
--
-- How a test acts as someone, inside its own begin ... rollback:
--   select tests.act_as(tests.tutor_a());   -- signed in as tutor A (auth.uid() = A)
--   select tests.act_as(tests.tutor_b());   -- signed in as tutor B
--   select tests.act_as_anon();             -- no session (the anon role)
--   select tests.reset();                   -- back to the test runner's own role
-- (010_rls_probe.sql exercises act_as, act_as_anon and reset.) Tutors are fixed UUIDs. No auth.users row is needed for RLS that compares tutor_id = auth.uid().
-- Every later file starts with: select tests.assert_ready();

select plan(3);

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.tutor_a() returns uuid
  language sql immutable as $$ select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid $$;

create or replace function tests.tutor_b() returns uuid
  language sql immutable as $$ select 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid $$;

create or replace function tests.act_as(who uuid) returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create or replace function tests.act_as_anon() returns void
  language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  set local role anon;
end $$;

create or replace function tests.reset() returns void
  language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function tests.assert_ready() returns void
  language plpgsql as $$
begin
  if to_regprocedure('tests.act_as(uuid)') is null then
    raise exception 'tests helpers are missing: supabase/tests/000_helpers.sql must run first';
  end if;
end $$;

grant execute on all functions in schema tests to anon, authenticated;

select has_function('tests', 'tutor_a', array[]::text[], 'tutor A exists');
select has_function('tests', 'tutor_b', array[]::text[], 'tutor B exists');
select isnt(tests.tutor_a(), tests.tutor_b(), 'the two tutors differ');

select * from finish();
