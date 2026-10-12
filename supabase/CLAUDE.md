# supabase/ — database and Edge Functions

Read the root `CLAUDE.md` first. These rules are specific to the backend.

## Layout

```
supabase/migrations/      SQL migrations named <timestamp>_name.sql by `pnpm exec supabase migration new`, the only way the schema changes
supabase/functions/       Edge Functions (Deno)
supabase/tests/           pgTAP tests for RLS and database functions
supabase/seed.sql         local sample data (the "try with sample data" tutor); a comment only until R1
supabase/environments.json  public identifiers per environment (staging and production refs are filled in F4b)
```

## Rules

- Never edit a migration that has been applied to staging or production. Add a new one.
- Every new table in the same migration gets: `tutor_id uuid not null`, `enable row level security`, and policies for select, insert, update and delete of the form `tutor_id = auth.uid()`. `waitlist` and `consents` are written only by Edge Functions and have no anonymous policies.
- Every new table gets a pgTAP test proving a second tutor reads and writes zero rows.
- Money columns are `integer` paise with a `check (amount >= 0)`.
- Phone columns hold E.164 and have a check constraint for `+91` followed by 10 digits.
- `pay_token` and `receipt_token` are at least 22 URL-safe random characters, generated in the database, unique, and never derived from an id.
- Recording a payment is the database function `record_payment(...)`: it inserts the payment, takes the tutor's next `receipt_no` under a row lock, and updates the due's status, all in one transaction. Do not reimplement any part of that in the client or in an Edge Function.
- `dues` has a select-only policy (`tutor_id = auth.uid()`) and no client write grant, like `tutors`: only database functions write it. It has three creators: the nightly job through `generate_dues`, the signed-in tutor's `ensure_my_dues()` (both call `create_dues_for`), and the opening-balance trigger `sync_opening_due` on `students`. All rely on `unique(student_id, month)` and a targetless `on conflict do nothing`. From R1-7, `record_payment` is the only writer of `amount_paid` and `status`.
- Edge Functions that serve public pages use the service role, look up by token only, return only the fields the page shows, and never return another student's data, the parent's phone, or internal ids.
- Public write functions (`submit-claim`, `record-consent`, `waitlist-join`) validate input with a shared pure checker (one hand-written file the page and the function both import, with one vectors file; `zod` is not used because it has a single npm maintainer and would grow the landing bundle) and are rate-limited per token or IP.
- Payment screenshots go to a private bucket. Storage policy: only the owning tutor can read. The pay page gets a short-lived signed upload URL from the Edge Function.
- Every table migration says `grant ... to authenticated` itself. Never grant to `anon`. The baseline migration revokes the default `anon` access on new `public` tables, and `supabase/tests/030_default_privileges.sql` pins that.
- Never run `supabase config push`, `supabase db push --include-seed`, or `supabase link` to production. Never change structure in the Supabase SQL editor.
- No secrets in SQL or function source. Use `supabase secrets`. Function secrets so far: `APP_ENV`, and `WAITLIST_HASH_SALT` (the HMAC key for the waitlist rate-limit hash; `waitlist-join` is deployed with `verify_jwt` off, which `config.toml` carries), and `RECEIPT_HASH_SALT` (the HMAC key for the `receipt` function's IP and token hashes; a different value from the waitlist's; `receipt` is also `verify_jwt` off and reads only through `get_receipt`, which only `service_role` can execute).

## Test helper

`supabase/tests/000_helpers.sql` creates the schema `tests`. Inside a test's own `begin ... rollback`, call `tests.act_as(tests.tutor_a())` or `tests.act_as(tests.tutor_b())` to act as a tutor, `tests.act_as_anon()` for no session, and `tests.reset()` to go back. Start every later file with `select tests.assert_ready();`. `010_rls_probe.sql` is the worked example. `020_public_tables_have_rls.sql` fails if any `public` table has RLS off; never delete or loosen it.

## Running

The full workflow, who runs each step, and the production approval rule are in [docs/ENVIRONMENTS.md](../docs/ENVIRONMENTS.md). This section matches it.

- `pnpm db:start` starts the reduced local stack. The first run pulls several GB of images. If it says Docker is not running, start Docker.
- `pnpm db:reset` applies every migration, then the seed. `pnpm db:test` runs the pgTAP tests; run it twice. `pnpm db:stop` stops the stack.
- `pnpm check:db --base origin/main` checks migration names, that no applied migration was changed, and that no schema change sits outside `supabase/migrations/`.
- `pnpm smoke:env <local|staging|production>` asks that environment's `health` function which environment it is.
- Seed data runs on the local stack only.
- Rollback is a forward fix: a new migration. There are no down migrations. A migration must work with the front end that is live now.
- `release-manager` applies migrations and functions to staging, never ad hoc. This machine is linked to staging only.
- Production: the human approves each migration and release, and the founder runs the production commands in their own terminal, after a database dump saved outside the repo. No agent runs `db push`, `db reset` or `functions deploy` against production.
- Docker does not work on the founder's machine today, so CI's `database` job is where `db:reset` and `db:test` run.
