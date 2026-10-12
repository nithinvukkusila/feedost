-- R1-5 criteria 30 and 31. The nightly job exists once, at 19:00 UTC (00:30 India), active, runs as postgres,
-- re-scheduling does not duplicate it, and clients cannot run the function or reach cron. No skip: if the image
-- had no pg_cron, the migration would already have failed db reset. Self-contained; rolls back.
begin;
select tests.assert_ready();
select plan(14);

select has_extension('pg_cron', 'pg_cron is installed');
select is((select count(*) from cron.job where jobname = 'generate-dues-daily')::int, 1, 'exactly one generate-dues-daily job');
select is((select schedule from cron.job where jobname = 'generate-dues-daily'), '0 19 * * *', 'it runs at 19:00 UTC, 00:30 India time');
select is((select command from cron.job where jobname = 'generate-dues-daily'), 'select public.generate_dues()', 'it runs generate_dues()');
select ok((select active from cron.job where jobname = 'generate-dues-daily'), 'it is active');
select is((select username from cron.job where jobname = 'generate-dues-daily'), 'postgres', 'it runs as postgres');
select is((select pg_get_userbyid(proowner) from pg_proc where oid = 'public.generate_dues(timestamptz)'::regprocedure), 'postgres',
  'postgres owns generate_dues, so the job needs no grant');
select is((select count(*) from cron.job where command like '%generate_dues%')::int, 1, 'no other job calls generate_dues');

-- Idempotent: scheduling again by the same name leaves one job
select lives_ok($$select cron.schedule('generate-dues-daily', '0 19 * * *', $q$select public.generate_dues()$q$)$$, 'scheduling again works');
select is((select count(*) from cron.job where jobname = 'generate-dues-daily')::int, 1, 'still exactly one job after scheduling again');

-- The command itself runs as the owner, as the job does
select lives_ok($$select public.generate_dues()$$, 'generate_dues() runs as the job owner');

-- Clients cannot call it or see the scheduler
select ok(not has_function_privilege('anon', 'public.generate_dues(timestamptz)', 'execute'), 'anon cannot execute generate_dues');
select ok(not has_function_privilege('authenticated', 'public.generate_dues(timestamptz)', 'execute'), 'authenticated cannot execute generate_dues');
select ok(not has_schema_privilege('anon', 'cron', 'usage') and not has_schema_privilege('authenticated', 'cron', 'usage'),
  'neither anon nor authenticated can use the cron schema');

select * from finish();
rollback;
