# R0-4 — Waitlist

## Goal
A visitor on the landing page, in any of the four languages, can put their name, WhatsApp number, city and rough student count on the waitlist, and the row lands in a `waitlist` table that only the founder can read. Nobody can read the list from the browser, and a bot cannot fill it with junk.

Size: S, as in the build plan. One pull request: one migration, one Edge Function (`waitlist-join`), one swapped component.

## Users and moment
- **A tutor on a low-end Android, between classes,** who tapped "Join the waitlist" from the hero, the header, or the yellow block on a tool page. They have one thumb and about 30 seconds. They want to type four things and be told it worked.
- **The founder,** who needs real, clean phone numbers to message on launch day, and needs to trust that nobody else can read them.
- **A bot or a curious person** who finds the Edge Function address and posts to it directly. The page is not the only way in; the function must defend itself.

## What exists today (checked)
- `src/components/landing/waitlist-slot.tsx` is the placeholder R0-1 left for this slice (criterion 13 of R0-1). Section `id="waitlist"`, the header and hero buttons, and the tool-page yellow blocks already point at `#waitlist`. Keys `landing.waitlist.{title,body,soon,button,reason}` exist in all four message files; `soon` and `reason` are to be removed here.
- `supabase/CLAUDE.md`: `waitlist` is written only by an Edge Function and has **no anonymous policies**; public write functions use zod and are rate-limited per IP. The "every table has `tutor_id`" rule does not apply: the PRD's `waitlist` has no `tutor_id` (a visitor is not a tutor yet).
- PRD §7: `waitlist(id, name, phone, city, students_count, language, created_at)`. No email column, no source column, no consent column.
- Canvas (`Landing-m.dc.html`): fields Your name, WhatsApp number (`+91` placeholder), City, How many students? (four bands: Under 10, 10 to 30, 30 to 60, More than 60), button "Join the waitlist"; line "We will message you on WhatsApp the day the app opens."
- No Edge Function exists except `health`. No privacy page, no support contact, no email address anywhere on the site.
- Production holds no tables yet; the first production migration needs human approval, and F4 recommended the paid Supabase plan (daily backups) before any real phone numbers are stored.

## Acceptance criteria
Tags: **[unit]**, **[e2e]** (Playwright, 360px, against `out/` with the function stubbed unless said), **[db]** (pgTAP), **[fn]** (Edge Function test), **[manual]**.

### Data and access
1. A migration creates `waitlist(id uuid pk, name text, phone text, city text, students_count smallint, language text, created_at timestamptz default now())` and nothing else. Check constraints: `phone ~ '^\+91[6-9][0-9]{9}$'`; `language in ('en','hi','kn','te')`; `students_count in (0,10,30,60)` (the lower bound of each canvas band: under 10, 10 to 30, 30 to 60, more than 60); `char_length(name)` 1 to 60; `char_length(city)` 1 to 40. `unique(phone)`. [db]
2. RLS is enabled with **no policies**, and no grant to `anon` or `authenticated`. As anon, as tutor A and as tutor B, `select`, `insert`, `update` and `delete` on `waitlist` all fail or return zero rows. `020_public_tables_have_rls` and `030_default_privileges` still pass. [db]
3. Only the Edge Function (service role) writes. The browser never talks to the table, and no other table or function is added. [db, reviewer]

### The form
4. The body of `waitlist-slot.tsx` is replaced by the form; `#waitlist` and every link to it are unchanged; `landing.waitlist.soon` and `.reason` are removed from all four message files and no longer used anywhere. [e2e, unit key scan]
5. Fields in canvas order: Your name, WhatsApp number (`type="tel"`, `inputmode="tel"`, `autocomplete="tel"`), City, How many students? (native `select`, four bands, none pre-chosen, first option "Choose"), then the button. Each has a visible label, is at least 44px high, text at least 14px; the button is at least 56px high and full width at 360px. [e2e]
6. **Name** and **City:** required; spaces trimmed and runs of spaces made one; name 1 to 60 and city 1 to 40 characters; any script allowed; control characters and anything that looks like a tag (`<` or `>`) are rejected as "Check this". Same rules in the page and in the function. [unit, fn]
7. **WhatsApp number:** accepts a 10-digit Indian mobile starting 6 to 9, with or without `+91`, `91`, `0`, spaces, dashes or brackets, and Devanagari, Kannada and Telugu digits (read as 0-9). Stored as `+91XXXXXXXXXX`. Everything else is rejected: fewer or more digits, landline-style starts (0 to 5), another country code, letters. On blur the field shows the number grouped `+91 98765 43210` (`formatPhone`). [unit, fn, e2e]
8. **Errors:** on blur and on submit; each is a state word plus a mark plus a plain sentence in the page language ("Missing" / "Type your name.", "Check this" / "Use a 10-digit mobile number."), never colour alone; clears as soon as valid; the first error gets focus on submit; no request is sent while any field is invalid. [e2e]
9. **Consent line**, always visible directly above the button, not a link to a page that does not exist: "We will use your number only to message you on WhatsApp when the app opens. Nothing is sold or shared." No pre-ticked box. Exact wording confirmed by the founder (Open question Q3). [e2e]
10. Fields start empty; no autofocus on load (it would pop the keyboard and scroll past the heading). A hidden honeypot field is not in the tab order, has `aria-hidden`, and is not announced. [e2e]

### Submitting
11. **Success:** the form is replaced by a confirmation with the Stamp mark and words ("You are on the list." / "We will message you on WhatsApp the day the app opens."). The phone number is not repeated back. Focus moves to the confirmation; it is `role="status"`. Nothing is written to local storage or cookies. [e2e]
12. **While sending:** the button shows a working state, is not tappable again, and at most one request is in flight (double tap sends one). [e2e]
13. **Duplicate number:** the function inserts with `on conflict (phone) do nothing` and returns the **same success** as a new number, so the page cannot be used to learn who is on the list. No second row; the first row's name, city and count are not overwritten. [fn, db]
14. **Honeypot filled:** the function returns the same success and writes nothing. [fn]
15. **Rate limit:** at most 5 requests per IP per hour (founder-changeable constant). The sixth gets HTTP 429 and the page says "Too many tries. Please try again in an hour." The page keeps the typed values. The raw IP is never written to `waitlist`; whatever counter the function keeps stores a hash and expires within a day. [fn, reviewer]
16. **Function validation:** the function re-checks every field with zod using the same test vectors as the page, accepts only `POST` with JSON of at most 2 KB, ignores unknown fields, and answers with a code only (`ok`, `invalid`, `rate_limited`, `error`), never an error message from the database, never a stack trace, never another person's data. CORS allows only the site's own origins. [fn]
17. **Failure:** if the network is down, the request times out after 15 seconds, or the function answers `error`, the page shows the error mark and "Could not save. Check your connection and try again.", keeps every typed value, and the button works again. [e2e with the route blocked]

### Privacy, speed, language
18. The function logs no name, phone or city, and Sentry or PostHog never receive them (`data-ph-no-capture` and `data-sentry-mask` on the fields). The page makes no request until the tutor submits. [e2e request log, reviewer]
19. Landing initial JS stays at or under the budget of `pnpm size` (200 KB hard limit; today's number must not grow by more than 10 KB gzipped). `supabase-js` is not loaded for this form; one `fetch` to the function is enough. [CI]
20. All four languages: every new word is in all four message files and `pnpm i18n:check` passes. The consent line, success and error sentences are drafted in hi, kn and te (not `TODO-translate`) because they are a promise about someone's number, and are added to the review record so `i18n:check --strict` fails until a named reader signs them off. Amounts do not appear; digits are 0-9. [CI, unit]
21. At 360px in all four languages, with empty fields, with the longest allowed values, and with the root font at 200%: no sideways scroll, nothing clipped, labels never truncated, the select's band words fit (they wrap). Hindi, Kannada and Telugu use Anek with letter-spacing 0. [e2e]
22. With JavaScript off, the section shows its heading and "This form needs JavaScript turned on." and no dead inputs. [e2e JS-off]
23. The page sends the visitor's page language (`en`, `hi`, `kn`, `te`) as `language`; a hand-edited value outside the four is rejected. [unit, fn]
24. `pnpm lint`, `typecheck`, `test`, `build`, `test:e2e`, `size`, `i18n:check`, `check:leak`, `check:db`, `db:test` pass, and no new dependency is added except `zod` if it is not already in (it is on the approved list). [CI]

## Edge cases
- **Duplicates.** Same number twice, or typed with `+91` the second time: one row (7, 13). Same person, different number: two rows; we do not try to merge.
- **Bad phone.** Landline, 9 digits, 11 digits, `+1…`, `00` prefixes, letters, emoji: rejected with the same sentence. A number copied from WhatsApp with a hidden left-to-right mark is cleaned before checking.
- **Email.** Not collected (PRD has no email field). A tutor who types an email in the name field gets it saved as a name; not policed.
- **Bots.** Honeypot (14), rate limit (15), size cap and strict JSON (16). No CAPTCHA in this slice: it needs a third-party script and breaks "no third party" on the page. Not stopped: a patient bot with many IPs filling 5 numbers an hour each. Cost is junk rows the founder deletes; flagged in Q5.
- **Rate limit hit by a shared network** (a coaching centre, college wifi, mobile carrier NAT). Several real tutors may share an IP and the sixth is told to wait. Accepted; the message is honest and values are kept.
- **Very long names.** 60 characters of Telugu wraps in the field and nothing is cut; the 61st character is blocked, not silently dropped.
- **Names in another script.** Any script is accepted and stored as typed. Stored with its script intact (UTF-8); no transliteration.
- **Slow network.** Working state stays until answer or 15 seconds. The person is never shown success before the function says `ok`.
- **Offline.** Typing works; submit shows criterion 17. There is no offline queue in Release 0, and nothing is stored on the phone.
- **The parent opening an old link.** Not applicable; no tokens in this slice.
- **Back button after success.** The page reloads to an empty form; submitting again hits the duplicate path (13).
- **Student count left unchosen.** Blocked as "Missing" / "Choose a number." It is in the PRD row, so it is required.
- **Tool pages.** Their yellow blocks still only link to `#waitlist` (see Q1).
- **Language of the later message.** We store the page language so the launch message can go out in it; it is not a promise about which language the tutor teaches in.
- **Deleting someone.** There is no self-service delete (no accounts). See Q3 and Q4.
- **Partial payment, large amounts.** Not applicable.

## Out of scope
- **The form on the two tool pages.** The PRD says "Form on both tools"; those pages keep a link to `#waitlist` (Q1). Embedding would also change R0-2 and R0-3's promise that nothing typed on the tool is sent anywhere.
- **Sending messages to the waitlist,** a "launch" mailing, an unsubscribe flow, a double opt-in message. Founder does it by hand on launch day; automation belongs to Release 1 or later.
- **A privacy page, a support email or WhatsApp link.** None is in the PRD. The consent line is self-contained (Q3).
- **Email, referral code, "how did you hear", UTM source, page URL.** Not in the PRD's table.
- **An admin screen or CSV export in the app.** The founder reads the table in the Supabase dashboard (a production data read; done in the founder's own session).
- **CAPTCHA, email verification, WhatsApp verification of the number.** Third-party or sends messages.
- **PostHog events** (see Analytics) and the sitemap: R0-5.
- **Edit or remove my entry.** No accounts; handled by hand on request (Q4).
- **Applying the migration to production.** Human approval, Gate C.

## Design references
- `design/project/Landing-m.dc.html`: section `m-waitlist`, the phone layout. Cloth-red block, cream form slip, four fields, black "Join the waitlist" button. This is the layout to build.
- `design/project/Landing.dc.html`: section `waitlist`, desktop two-column version. Must not break wider than 360px.
- Deliberate differences from the canvas: a "Choose" first option on the select; honeypot field (invisible); error words and marks, a consent line, a success state, a working state, a failure line and a no-JavaScript line, none of which the canvas draws; the "Join the waitlist" button uses the `record` (black) variant as drawn, not blue, because it records a name rather than sends or pays. Design should confirm the success and error look; frontend-dev uses the `Stamp`, `Banner` and `Field` components meanwhile.

## Analytics
None in this slice. The PRD §4 event list has no waitlist event, and PostHog is wired in R0-5. The founder can count signups from the table. Nothing typed is ever sent to PostHog or Sentry (18). If the founder wants a `waitlist_joined` event (count only, no values), it is a PRD change (Q6).

## Test by hand on a phone
- **H1.** On a real Android phone, open `/en/` on the preview, tap the header button, then the hero button: both scroll to the form. Fill it with a real number and join. See the confirmation. Check the new row in the staging dashboard: number is `+91…`, language is `en`.
- **H2.** Join again with the same number written `098765 43210`. You see success again, and there is still one row, the first values untouched.
- **H3.** Type `12345`, a number starting with 5, a number with a letter. Each shows the error word and sentence, not colour alone; the keyboard stays usable.
- **H4.** Repeat in Hindi, Kannada and Telugu, typing a name in that script and the number in that script's digits. The row shows the name intact and the number in 0-9.
- **H5.** Largest system font size, Telugu page: nothing is cut off, no sideways scroll, every field and the button are easy to hit with a thumb.
- **H6.** Turn on airplane mode, tap Join: the failure line shows and your typing is still there. Turn it off, tap again: success.
- **H7.** From a laptop, post to the function address six times with a script: sixth is refused. Post a body with the hidden field filled: success is returned and no row appears.
- **H8.** Open the staging table through the app's own anon key (not the dashboard): you cannot read it.
- **H9.** Have a reader of each of hi, kn, te read the consent line and the success sentence aloud. They sound like a promise a tutor would trust.
- **H10.** Switch JavaScript off and reload: heading and the "needs JavaScript" line, no dead boxes.

## Open questions
Founder decisions. Each has a default; the next stage proceeds on it unless told otherwise. None blocks the build.

- **Q1. Form on the two tool pages.** PRD says "on both tools". Default: **form lives once, on the landing page; both tool pages keep their yellow block that links to `#waitlist`.** Keeps the tools "nothing is sent to us" true and avoids two copies of the form. If you want it inline, it becomes a follow-up slice that edits R0-2 and R0-3 and their privacy line.
- **Q2. "Approx. number of students".** Default: the canvas's four bands, stored as the band's lower bound (0, 10, 30, 60) in `students_count`. Alternative: a free number field.
- **Q3. Consent wording and withdrawal.** Default: the one line in criterion 9, no ticked box, no link, and the founder deletes a number on request. The site has no contact address, so a person cannot ask. Needs from you: a contact (a WhatsApp number or an email) to add to the line, or confirmation that you accept a line without one. A required unticked checkbox is the stricter alternative under DPDP; costs conversions.
- **Q4. How long we keep numbers.** Default: until 30 days after the app opens, then the founder deletes the rows by hand. Say a different period if you prefer.
- **Q5. Rate-limit numbers and junk.** Default: 5 per IP per hour, no CAPTCHA, founder deletes junk rows. Say if a stricter limit or a daily global cap is wanted.
- **Q6. A waitlist PostHog event.** Default: none (not in the PRD).
- **Q7. Paid Supabase plan before production.** F4 recommended it before real numbers are stored (daily backups). Default: yes, move production to the paid plan before the production migration for this slice is approved. Please check the current price yourself.
- **Q8. Native review.** Default: same readers as R0-2 and R0-3 (D8); the consent line and success sentence go to them with the templates. No reader is named yet; this blocks the Release 0 `--strict` gate, not the build.

## Hand-off
Next: `tech-lead` appends the technical plan to `docs/specs/R0-4-waitlist.md`. Decisions that are theirs:
1. Where the rate-limit counter lives (a small table, or function memory) and how the IP hash is made, so criterion 15 holds with no raw IP stored.
2. How the page calls the function with a plain `fetch` and whether the function needs `verify_jwt` off or the public anon key (19, 16).
3. Keeping one set of validation test vectors shared by the Next unit tests and the Deno function tests (6, 7, 16).
4. How the consent, success and error sentences join the review record and `--strict` (20).
5. A staging-only end-to-end check against the real function (H1, H7), since Docker is unavailable locally.

## Technical plan — R0-4

Written by `tech-lead` on 2026-10-11. Lean, in the layout of the R0-3 plan. Nothing here was run against a database or a phone; the pgTAP files run in CI (no Docker here) and H1 to H10 run on staging.

### Assumed unless the founder says otherwise
Q1 to Q8 are proposals from the spec, not decisions. The plan is built on these defaults.

| # | Assumed default | If the founder flips it |
| --- | --- | --- |
| Q1 | One form, on the landing page; tool pages keep the link to `#waitlist` | A follow-up slice edits R0-2 and R0-3 and their privacy line |
| Q2 | Four bands stored as 0, 10, 30, 60 | A number field: one column check and one control change |
| Q3 | One consent line, no box, no link, no contact; founder deletes on request | A contact is one more word in the line, in four languages, and a new review entry. A required unticked box adds a field to the form, the function and the table (`consent boolean`) |
| Q4 | Keep until 30 days after the app opens, delete by hand | No code change |
| Q5 | 5 per IP per hour, no CAPTCHA, no daily cap | Limit is the constant `LIMIT_PER_HOUR`; a daily cap is one more call to the counter function |
| Q6 | No PostHog event | A PRD change first (R0-5) |
| Q7 | Production moves to the paid plan before the production migration is approved | Founder accepts no daily backups on a table of phone numbers, in writing |
| Q8 | Same readers as R0-2 and R0-3; none named; blocks `--strict`, not the build | None |

Two new questions from this plan, with defaults (Open questions, Q9 and Q10, below).

### 1. Approach
One migration creates `waitlist` (RLS on, no policies, no grants) and a small `waitlist_hits` counter with one function, `waitlist_hit`, that only the service role can run. One Edge Function, `waitlist-join`, written as a pure `handler.ts` (tested in Vitest like `health`) plus a thin `index.ts` for Deno: it checks method, size, origin, honeypot, then the rate limit, then validates, then inserts with `on conflict (phone) do nothing`. The page swaps `waitlist-slot.tsx` for a client island that does a plain `fetch` to `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/waitlist-join`; no `supabase-js`, no key. One pure rules file does cleaning and validation for both sides.

### 2. Dependencies and the policy check
**No new dependency.** `zod` is on the approved list but is not installed, and registry facts on 2026-10-11 are: 4.6.5, released 2026-10-02, MIT, **one** npm maintainer. That fails policy point 2 (more than one maintainer or a company), as `next-intl` did before the founder approved it as an exception. The rules are already needed in the page in hand-written form (zod would add to landing JS, criterion 19), so one hand-written pure file serves both sides and the "same test vectors" requirement becomes "same code". Cost: this departs from `supabase/CLAUDE.md` ("validate with zod"). See Q9. The function imports `npm:@supabase/supabase-js@2.117.3` (the version already approved and pinned for the app; it runs in Deno only, not in any page bundle). `pnpm audit` is not affected.

### 3. Files

New:

| File | What goes in it |
| --- | --- |
| `supabase/migrations/<stamp>_r0_waitlist.sql` | Section 4. Created with `pnpm exec supabase migration new r0_waitlist` |
| `supabase/functions/_shared/waitlist-rules.ts`, `.test.ts` | Pure, no imports, no DOM. `cleanText`, `checkName`, `checkCity`, `normalizePhone` (strips LRM and other format marks, maps Devanagari, Kannada and Telugu digits to 0-9, accepts `+91`, `91`, `0`, spaces, dashes, brackets, returns `+91XXXXXXXXXX` or null), `formatPhone`, `BANDS = [0,10,30,60]`, `LANGUAGES`, `parseBody`. The test reads `waitlist-vectors.json` (below) |
| `supabase/functions/_shared/waitlist-vectors.json` | The one list of cases (input, expected) for criteria 6, 7, 23, used by both the page's unit test and the function's test |
| `supabase/functions/waitlist-join/handler.ts`, `handler.test.ts` | `handle(req, deps)`, `deps = { env, now, hashIp(ip,hour), hit(hash): Promise<boolean>, insert(row): Promise<void> }`. Order: `OPTIONS` (CORS), non-`POST` 405, `content-length` or read over 2048 bytes 413, not JSON `invalid`, honeypot filled returns `ok` and stops, rate limit (429 `rate_limited`), validate (`invalid`), insert (`ok`), any throw returns `{"code":"error"}` and logs only a fixed word. Tests: criteria 13 to 16 through fake deps, plus "no log line contains the phone" |
| `supabase/functions/waitlist-join/index.ts` | Deno wiring only: builds the service-role client from the injected `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, `hashIp` with Web Crypto HMAC-SHA256, `hit` calls `rpc('waitlist_hit')`, `insert` is `.upsert(row, { onConflict: 'phone', ignoreDuplicates: true })`. Real IP from `x-forwarded-for` (first entry) |
| `supabase/tests/090_waitlist.sql` | pgTAP, section 7 |
| `src/lib/waitlist/rules.ts` | Re-exports `supabase/functions/_shared/waitlist-rules.ts` so components import from `@/lib`. If the build or tsconfig refuses a path outside `src/`, frontend-dev instead keeps a copy here and a test that fails if the two files differ byte for byte (one line in the plan to flag, not a redesign) |
| `src/lib/waitlist/join.ts`, `join.test.ts` | `joinWaitlist(values, language, signal)`: one `fetch` POST, 15 s `AbortController` timeout, maps the answer to `ok`, `invalid`, `rate_limited`, `error`; any network failure is `error`. URL from `supabaseUrl` in `src/lib/supabase-env.ts`. No other import |
| `src/lib/waitlist/copy.review.json` | Review record for the promise sentences (consent, success, failure, rate limit, per language hi, kn, te: "not reviewed"), same shape as `templates.review.json` |
| `src/components/landing/waitlist-form.tsx`, `.test.tsx` | `"use client"` island; props `words`, `locale`. Fields in canvas order, `Field` and `SelectField`, honeypot, `Button variant="record"`, `Stamp` on success, `Banner` for failure. States: idle, sending (one request, `useRef` guard), done, rate limited, error. Fields carry `data-ph-no-capture` and `data-sentry-mask` via `src/lib/data-attributes.ts`. Nothing in storage |
| `e2e/waitlist.spec.ts` (`test-engineer`) | Section 7 |

Changed:

| File | Change |
| --- | --- |
| `src/components/landing/waitlist-slot.tsx` | Body replaced: renders `WaitlistForm`. The page passes words from `getWords("landing.waitlist")`, so `src/app/[locale]/page.tsx` changes by those two lines only. `#waitlist` and the heading stay |
| `src/i18n/words.ts` | Add `"landing.waitlist"` to the plain namespaces, if it takes dotted names; otherwise a `waitlistForm` namespace (decision for frontend-dev, one line either way) |
| `messages/en.json`, `hi.json`, `kn.json`, `te.json` | Together. Remove `landing.waitlist.soon` and `.reason`; reword `landing.waitlist.body` ("The waitlist opens soon..." is now false); add labels, band words, "Choose", error words and sentences, consent, success, failure, rate limit, working, no-JavaScript line. Consent, success, failure and rate-limit sentences drafted in hi, kn, te, not `TODO-translate` (criterion 20) |
| `scripts/i18n-check.mjs`, `scripts/i18n-check-lib.mjs`, `src/lib/i18n-check.test.ts` | New small `checkReviewRecord(path, keys)`: `--strict` fails while `copy.review.json` has any unreviewed language; the summary line counts it. Does not touch `checkTemplates` |
| `supabase/config.toml` | `[functions.waitlist-join] verify_jwt = false` (the browser sends no token), and `WAITLIST_HASH_SALT` for local under `[edge_runtime.secrets]` with a fixed dummy value |
| `docs/ENVIRONMENTS.md`, `supabase/CLAUDE.md` | One line each: the new secret `WAITLIST_HASH_SALT` and that `waitlist-join` is deployed with `verify_jwt` off (config.toml carries it) |
| `scripts/smoke-env*.mjs` | No change. (A real-write smoke is not added; see section 7, staging check) |

No change: `next.config.ts`, CI workflow, `supabase-js` wrapper, the tool pages.

### 4. Data (migration intent)
- **`public.waitlist`**: exactly the columns and checks in criterion 1. `id uuid default gen_random_uuid()`, `created_at timestamptz not null default now()`, all other columns `not null`, `unique (phone)`. `enable row level security`; **no policy; no grant** to `anon` or `authenticated`. The baseline revokes default `anon` access, so nothing needs granting; the migration states `revoke all on public.waitlist from anon, authenticated` anyway so the test pins it. The service role bypasses RLS. No `tutor_id` (spec, supabase/CLAUDE.md).
- **`public.waitlist_hits`** (`ip_hash text`, `hour_bucket timestamptz`, `n integer`, primary key `(ip_hash, hour_bucket)`): same lock-down (RLS on, no policy, no grant). **This adds one table and one function that criteria 1 and 3 say are not added; see Q10.**
- **`public.waitlist_hit(p_hash text, p_limit int) returns boolean`**: `security invoker`, one statement `insert ... on conflict (ip_hash, hour_bucket) do update set n = waitlist_hits.n + 1 returning n` for `date_trunc('hour', now())`, returns `n <= p_limit`. Also deletes rows older than 24 hours on each call (cheap, no `pg_cron`; expiry within a day, criterion 15). `revoke all on function ... from public, anon, authenticated; grant execute ... to service_role`. Atomic, so two tabs cannot both slip under the limit.
- **IP hash.** `hex(HMAC-SHA256(key = WAITLIST_HASH_SALT, message = ip + "|" + hour_bucket))`. The key is a function secret set with `supabase secrets set` per environment (never in SQL or source). Plain SHA-256 of an IP is reversible by trying all addresses; the secret key is what stops that. The hour is in the message so the same visitor hashes differently each hour, and a stale row is useless. The raw IP is never logged, stored, or sent to `rpc`.
- **Edge Function** `waitlist-join`: service role from the platform-injected variables; own secret `WAITLIST_HASH_SALT`. Response bodies are exactly `{"code":"ok"|"invalid"|"rate_limited"|"error"}`. CORS: allow-list by exact origin (the production domain, and `https://*.vercel.app` project previews by pattern, plus `http://localhost:3000` only when `APP_ENV=local`); anything else gets no CORS header. CORS is a browser courtesy, not a defence; the limit and validation are.
- **Storage of nothing else**: no log of body, headers or IP; the function's only `console` output is a fixed word per outcome.

### 5. Work split (ordered)
1. `backend-dev`: migration, `090_waitlist.sql`, run `pnpm check:db`; `waitlist_hit` and both tables. Confirm `020` and `030` still pass (CI `database` job).
2. `backend-dev`: `_shared/waitlist-rules.ts` + vectors + test (Vitest, Node).
3. `backend-dev`: `waitlist-join` `handler.ts`, `handler.test.ts`, `index.ts`, `config.toml`, docs lines. Deploy to staging via `release-manager` (`functions deploy waitlist-join --use-api`, `secrets set WAITLIST_HASH_SALT`, migration push), then `curl` it: `ok`, duplicate, honeypot, sixth call 429.
4. `frontend-dev`: `src/lib/waitlist/` (`rules.ts`, `join.ts`, tests), messages in four files, review record and `i18n-check` change. Needs step 2 only.
5. `frontend-dev`: `waitlist-form.tsx`, swap in `waitlist-slot.tsx`, words wiring. Cut line: after this the form works against a stub.
6. `test-engineer`: `e2e/waitlist.spec.ts` with the function stubbed by `page.route`; the one staging-only flow (section 7). `frontend-dev` and `backend-dev` fix findings.
7. Founder and QA: H1 to H10 on the preview that points at staging.

Steps 1 to 3 and 4 can run in parallel after step 2. One pull request.

### 6. Risks and traps
- **Counter and the "no other table" criterion.** Function memory does not survive Deno isolates, so a memory counter lets a bot through; a table is the smallest thing that works. Raised as Q10 so the founder, not the build, widens criteria 1 and 3.
- **Raw IP leak.** A hash without a secret is reversible. Mitigated by HMAC with `WAITLIST_HASH_SALT`; a handler test asserts the fake `hit` never receives a string containing the IP, and that no log call contains the IP or phone.
- **Cannot tell who is on the list.** Duplicate returns the same `ok` and the same timing path (no early return before insert). `ignoreDuplicates` ensures the first row is not overwritten (criterion 13, db test with two inserts).
- **Gateway rejects the browser** if `verify_jwt` is on. The `config.toml` entry is the same pattern as `health`, and the staging `curl` with no headers proves it. If a deploy forgets the config, `--no-verify-jwt` is the fallback and is written in the step 3 note.
- **CORS preflight fails** on the `content-type: application/json` request. `OPTIONS` handled before anything else, tested.
- **Number rules drift between page and function.** One file, one vectors file; the copy-fallback has a byte-equality test.
- **Hidden marks in pasted numbers** (LRM, non-breaking space): `normalizePhone` strips Unicode format and space characters before checking; vectors include them.
- **Phone or name reaches Sentry or PostHog.** Mask attributes, no logging, no analytics call in the island; e2e request log checks only one request, to the function.
- **Double tap and slow network.** A ref guard, not just `disabled` state, because state updates are async; 15 s abort; success only on `ok`.
- **Landing initial JS grows.** The island is small and imports only `rules.ts` and `join.ts`; if `pnpm size` shows more than +10 KB, load the island with `next/dynamic` on first focus (frontend-dev, only if needed).
- **Production has no backups yet.** Q7: the production migration is not requested until the paid plan is on.
- **Sentry or the platform logs request bodies.** Not enabled for functions here; stated so reviewer checks the function dashboard setting at release.
- **Docker is unavailable locally.** pgTAP and the function's DB path run only in CI and on staging; the Vitest handler tests run locally with fake deps.

### 7. Tests required

| Criterion | Test |
| --- | --- |
| 1, 2, 3 | pgTAP `090_waitlist.sql`: columns and each check rejects (phone `+915...`, `+9198765`, language `fr`, count 5, name empty and 61 chars, city 41 chars) and accepts valid; `unique(phone)`; `relrowsecurity` true and `pg_policies` count 0 for both tables; as anon, tutor A and tutor B: select returns 0 or errors, insert, update, delete fail (`throws_ok` 42501), `has_table_privilege` false for both roles on both tables; `waitlist_hit` not executable by anon or authenticated, executable by service_role; counter returns true 5 times then false, old rows deleted. Tutor B isolation is the same test, because there is no `tutor_id` to separate by. `020`, `030`, `080` unchanged and green |
| 4, 5, 10 | e2e: field order, types, labels, 44 px and 56 px heights, no autofocus, honeypot attributes; unit key scan that `soon` and `reason` are gone from all four files and unused |
| 6, 7, 23 | unit: vectors through `rules.ts`; function test: the same vectors through `handler` |
| 8, 9 | e2e: error words on blur and submit, focus goes to first error, no request while invalid, consent line visible above the button, no checkbox |
| 11, 12, 17 | e2e: success panel with `role="status"` and focus, nothing in storage or cookies, no phone on screen; double tap gives one request; route blocked and a 15 s stall give the failure line, values kept, button works again |
| 13, 14 | handler test with fake `insert`: duplicate and honeypot give the same body as a new number; honeypot never calls `insert` or `hit` |
| 15 | handler test: sixth call 429 `rate_limited`, page shows the sentence and keeps values (e2e with stub); the hash passed to `hit` is hex and does not contain the IP |
| 16 | handler test: GET 405, body over 2 KB 413, unknown fields ignored, non-JSON `invalid`, body never contains an error text, disallowed origin gets no CORS header |
| 18 | e2e: request log has zero requests before submit and one on submit, to the function only; handler test: no log contains phone, name or city |
| 19 | `pnpm size`: landing within +10 KB of today's number, under 200 KB; unit test that no file under `src/` other than `src/lib/supabase.ts` imports `supabase-js` (exists) and `join.ts` does not |
| 20 | `pnpm i18n:check`, `--strict` fails on the review record until signed (unit) |
| 21, 22 | e2e: 360 px, four languages, longest values, 200% font; JavaScript off |
| 24 | Full command list in the spec, including `check:db` and `db:test`; reviewer: `package.json` unchanged |
| H1, H7, H8 | **Staging-only check** (no Docker): a Playwright project or script `e2e/waitlist-staging.spec.ts`, skipped unless `WAITLIST_STAGING_URL` is set, that posts one valid unique number to the real staging function, expects `ok`, posts it again, expects `ok`, posts six times from one origin and expects the sixth `rate_limited`, and a body with the honeypot. Run by `release-manager` after deploy. It never runs against production |

### 8. Needs the founder and what the human approves for production
- Answer Q1 to Q8, or say "defaults are fine"; and Q9 and Q10 below.
- **Production approvals (only the human, Gate C):**
  1. Move production to the paid Supabase plan first (Q7).
  2. Dump the database to a place outside the repo, then apply the `r0_waitlist` migration to production in your own terminal.
  3. Set the secret `WAITLIST_HASH_SALT` on production (a long random value; never paste it into a chat, a commit or a pull request) and deploy `waitlist-join` there, `verify_jwt` off via `config.toml`.
  4. Release the front end only after the function answers on production, so the form never points at nothing.
  5. Reading the list is yours alone, in the Supabase dashboard; deleting a person on request is yours too.
- A reader per language (hi, kn, te) for the consent and success sentences before the Release 0 `--strict` gate (Q8).

### 9. Not doing
A CAPTCHA, email or WhatsApp verification, any message to the list, an unsubscribe or export screen, source or UTM columns, PostHog events, a `consent` column (unless Q3 flips), a daily global cap, `pg_cron` for the counter, `zod` in the page, the form on the tool pages (Q1), a privacy page, a service worker, a retry queue for offline submits.

### 10. Open questions raised by this plan
- **Q9. Skip `zod`?** Default: yes, one hand-written validator shared by page and function, no new dependency. `zod` has one npm maintainer, which fails dependency policy point 2, and would add to the landing bundle if used in the page. Alternative: zod in the function only, with the founder approving the maintainer exception, and a second validator in the page kept equal by the shared vectors. This departs from the wording in `supabase/CLAUDE.md`, which should then be updated to "validate with a shared pure checker".
- **Q10. One counter table and one function.** Default: add `waitlist_hits` and `waitlist_hit` (criteria 1 and 3 amended from "nothing else" to "nothing else except the counter"). Alternative: no limit in the database, only the in-memory counter, which is weak, or Supabase's own limit plus Vercel's firewall, neither of which is under our test. `product-manager` should update criteria 1, 3 and 15 if the default holds.

### 11. Start
`backend-dev` starts with **task 1: the migration and `090_waitlist.sql`** (tables, `waitlist_hit`, lock-down, pgTAP), then task 2 (the shared rules). `frontend-dev` can begin task 4 once task 2 is merged to the branch.
