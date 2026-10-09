# supabase/ — database and Edge Functions

Read the root `CLAUDE.md` first. These rules are specific to the backend.

## Layout

```
supabase/migrations/      SQL migrations named <timestamp>_name.sql by `supabase migration new`, the only way the schema changes
supabase/functions/       Edge Functions (Deno)
supabase/tests/           pgTAP tests for RLS and database functions
supabase/seed.sql         local sample data (the "try with sample data" tutor)
```

## Rules

- Never edit a migration that has been applied to staging or production. Add a new one.
- Every new table in the same migration gets: `tutor_id uuid not null`, `enable row level security`, and policies for select, insert, update and delete of the form `tutor_id = auth.uid()`. `waitlist` and `consents` are written only by Edge Functions and have no anonymous policies.
- Every new table gets a pgTAP test proving a second tutor reads and writes zero rows.
- Money columns are `integer` paise with a `check (amount >= 0)`.
- Phone columns hold E.164 and have a check constraint for `+91` followed by 10 digits.
- `pay_token` and `receipt_token` are at least 22 URL-safe random characters, generated in the database, unique, and never derived from an id.
- Recording a payment is the database function `record_payment(...)`: it inserts the payment, takes the tutor's next `receipt_no` under a row lock, and updates the due's status, all in one transaction. Do not reimplement any part of that in the client or in an Edge Function.
- Dues are created by the `pg_cron` job and by import (opening balance). Both rely on `unique(student_id, month)` and `on conflict do nothing`.
- Edge Functions that serve public pages use the service role, look up by token only, return only the fields the page shows, and never return another student's data, the parent's phone, or internal ids.
- Public write functions (`submit-claim`, `record-consent`, `waitlist-join`) validate input with zod and are rate-limited per token or IP.
- Payment screenshots go to a private bucket. Storage policy: only the owning tutor can read. The pay page gets a short-lived signed upload URL from the Edge Function.
- No secrets in SQL or function source. Use `supabase secrets`.

## Running

- `supabase start`, `supabase db reset` — local stack with migrations and seed.
- `supabase test db` — pgTAP tests.
- `supabase db push` against staging is done by `release-manager`, never ad hoc. Production needs the human's approval first.
