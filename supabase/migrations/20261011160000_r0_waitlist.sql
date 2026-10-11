-- R0-4: the waitlist.
-- Plan: docs/specs/R0-4-waitlist.md, sections 4 and 10 (Q10).
--
-- * waitlist: one row per visitor who joined. No tutor_id: a visitor is not a tutor yet.
--   RLS on, NO policies, no grant to anon or authenticated. Only the Edge Function writes, with the
--   platform's admin role (which bypasses RLS and keeps the platform's default grants on new public
--   objects, so nothing is granted to it here). The founder reads it in the dashboard.
-- * waitlist_hits + waitlist_hit(): the per-IP, per-hour counter for the rate limit. It stores only
--   an HMAC hash of the IP (made in the Edge Function with a secret), never the raw address.
--   Same lock-down. Rows older than 24 hours are removed on each call.

-- ---------------------------------------------------------------------------------------------
-- waitlist
-- ---------------------------------------------------------------------------------------------

create table public.waitlist (
  id             uuid primary key default gen_random_uuid(),
  name           text        not null check (char_length(name) between 1 and 60),
  phone          text        not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  city           text        not null check (char_length(city) between 1 and 40),
  -- Lower bound of the band the visitor chose: under 10, 10 to 30, 30 to 60, more than 60.
  students_count smallint    not null check (students_count in (0, 10, 30, 60)),
  language       text        not null check (language in ('en', 'hi', 'kn', 'te')),
  created_at     timestamptz not null default now(),
  constraint waitlist_phone_key unique (phone)
);

alter table public.waitlist enable row level security;

-- No policy on purpose. Stated so the test pins it even if a default ever changes.
revoke all on public.waitlist from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- waitlist_hits: the rate-limit counter
-- ---------------------------------------------------------------------------------------------

create table public.waitlist_hits (
  ip_hash     text        not null,
  hour_bucket timestamptz not null,
  n           integer     not null check (n >= 0),
  primary key (ip_hash, hour_bucket)
);

alter table public.waitlist_hits enable row level security;

revoke all on public.waitlist_hits from public, anon, authenticated;

-- Counts one request for this hash in the current hour and says whether it is still within the limit.
-- One statement does the increment, so two simultaneous requests cannot both slip under the limit.
-- security invoker: it runs with the caller's rights, and only the Edge Function's admin role keeps the right to call it.
create function public.waitlist_hit(p_hash text, p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  hits integer;
begin
  -- Expiry without pg_cron: every call clears what is more than a day old.
  delete from public.waitlist_hits where hour_bucket < now() - interval '24 hours';

  insert into public.waitlist_hits (ip_hash, hour_bucket, n)
  values (p_hash, date_trunc('hour', now()), 1)
  on conflict (ip_hash, hour_bucket) do update set n = public.waitlist_hits.n + 1
  returning n into hits;

  return hits <= p_limit;
end;
$$;

revoke all on function public.waitlist_hit(text, integer) from public, anon, authenticated;
