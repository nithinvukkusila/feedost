-- R1-5 part B (docs/specs/R1-5-dues.md criteria 30 to 33, plan section 4.7): run generate_dues() every day.
--
-- Separate from the dues table on purpose: the table migration does not need pg_cron, so the app works through
-- ensure_my_dues() even where this extension is off. If this migration errors on a hosted project because pg_cron
-- is not enabled, switch it on in Database, Extensions and push again. It is deliberately not wrapped in a handler.
create extension if not exists pg_cron;

-- 19:00 UTC is 00:30 India time (UTC+5:30, no daylight saving). pg_cron reads the expression in cron.timezone,
-- which is GMT by default, so this is UTC. The India day has just turned, so every due that opens today is
-- created within the hour, and generate_dues()'s 7-day catch-up repairs a missed night.
-- cron.schedule with a job name updates the job of that name instead of adding one, so running this again
-- leaves one job. The job runs as the role that schedules it (postgres), which owns generate_dues(), so no
-- grant is needed and none is given to clients.
select cron.schedule('generate-dues-daily', '0 19 * * *', $$select public.generate_dues()$$);
