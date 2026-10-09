-- F4 criterion 11. Fails if any table in the public schema has row-level security off.
-- Do not delete or loosen this file: R1-2 and every later table migration rely on it.
begin;
select tests.assert_ready();
select plan(1);

select is_empty(
  $$select tablename from pg_tables where schemaname = 'public' and not rowsecurity$$,
  'every table in public has row-level security on');

select * from finish();
rollback;
