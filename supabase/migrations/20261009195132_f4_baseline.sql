-- F4 baseline. Creates no table. Two things only:
--
-- 1. pgcrypto, for gen_random_bytes(): R1-2 builds pay_token and receipt_token from it.
--    Hosted projects already have it, so there this line changes nothing.
-- 2. Second line of defence behind row-level security. A table that postgres creates in
--    public from now on is not readable or writable by the anon role unless a later migration
--    grants it on purpose. Public pages go through Edge Functions, so nothing should.
--    The authenticated role keeps its defaults: RLS is the control for tutors.
--    Every later table migration must say "grant ... to authenticated" itself.
--    pg_cron is left to R1-5.

create extension if not exists pgcrypto with schema extensions;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
