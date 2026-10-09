# FeeDost build plan

Written jointly from two seats: product (what ships, in what order, and how we know it worked) and tech lead (how it is built so each slice is safe to ship). Scope comes from `PRD.md`; this file only orders and structures it.

## 1. What "done" looks like for each release

| Release | Goal | Ship when |
| --- | --- | --- |
| 0. Free tools | Tutors find us by search, use a tool, join the waitlist | Both tools work in 4 languages; waitlist rows land in the database; pages are static and indexable |
| 1. MVP | A new tutor sends a first reminder within 5 minutes and collects a month's fees | The full monthly cycle works on a low-end Android, online and offline |
| 2. Pro | Tutors pay for automation | Subscriptions, automatic reminders and gateway payments work with real money in test mode, then live |
| 3. Scale | Larger users and new regions | Each feature ships on its own once Release 2 is stable |

Product metric to watch from day one (PRD §10): **activation = first reminder sent within 7 days of sign-up**. North star: reminders sent per active tutor per month.

## 2. Architecture decisions

These are settled unless marked "needs your OK".

1. **Static export, client-rendered app.** `next build` with `output: 'export'`. Marketing and tool pages are prerendered per language for SEO. The signed-in app is client-rendered and talks to Supabase directly under row-level security.
2. **Token routes on a static host.** `/p/{token}`, `/r/{token}` and `/join/{code}` cannot be prerendered because the tokens are not known at build time. Each is one static shell page; a rewrite in the Vercel project config sends `/p/*` to that shell, and the page reads the token from the URL and calls an Edge Function. This is the single biggest "static export" trap in the PRD.
3. **Public data only through Edge Functions.** `pay-page`, `receipt`, `submit-claim`, `record-consent`. They use the service role, look up by token, and return only the fields that page shows. Tables are never exposed to anonymous users.
4. **Row-level security everywhere.** `tutor_id = auth.uid()` on every tutor-owned table, with a test per table that a second tutor reads zero rows.
5. **Money and receipts in the database, not the client.** Recording a payment is one Postgres function: insert payment, take the next receipt number under a lock, update the due's status. The client never computes a receipt number.
6. **Dues generation by `pg_cron`.** A daily job creates `dues` rows for students whose due day is today, idempotent through `unique(student_id, month)`.
7. **Offline.** App shell cached by a service worker. Writes go to an IndexedDB outbox and replay in order when online; conflict rule is last write wins per row (PRD). Reminders are blocked offline with a clear message, because they need WhatsApp.
8. **Languages.** `next-intl` with one route segment per locale for the public pages. Each locale loads only its own script font.
9. **Fonts.** Self-hosted, subset at build time. Bricolage Grotesque (Latin display), DM Mono (labels), Anek Devanagari / Kannada / Telugu. Verify the ₹ glyph on a real phone in slice F2.
10. **PDF.** Generated in the browser, loaded only on the receipt screens. The library is chosen by a spike in R0-3 (see the dependency table below).

### Dependencies beyond the stack in CLAUDE.md

The founder approved adding libraries on 2026-10-09 on one condition: each must stay available and supported for the long term. Checked that day:

| Need | Decision | Long-term standing |
| --- | --- | --- |
| Unit tests | Vitest + Testing Library | Backed by the Vite team; dev-only, so replaceable without touching the product |
| End-to-end tests | Playwright | Maintained by Microsoft; dev-only |
| Validation | `zod` | Very widely used and actively released |
| IndexedDB | `idb` | Tiny and stable; about 1 KB, easy to replace with our own wrapper if it is ever abandoned |
| Service worker | **Workbox** (`workbox-build`, `workbox-precaching`), run after `next build` | Google's library, still releasing. Chosen over Serwist: a smaller community project whose upkeep and static-export support could not be confirmed |
| Spreadsheets | **SheetJS, vendored**: the tarball from `cdn.sheetjs.com`, version 0.20.2 or later, committed under `vendor/` | The `xlsx` package on npm is frozen at 0.18.5 with two known vulnerabilities and will not be updated. SheetJS publishes fixes only on its own CDN, so we keep the exact file in the repo. Never `pnpm add xlsx` |
| PDF | **Decide in a half-day spike at the start of R0-3** | `pdf-lib` (named in the PRD) has had no release in years. Candidates: `jsPDF` (the PRD's other option) or the company-maintained fork `@cantoo/pdf-lib`. The spike must also prove Hindi, Kannada and Telugu render correctly, because PDF libraries generally do not shape these scripts; the fallback is to draw the receipt with the browser onto a canvas and place that image in the PDF |

### Dependency policy

1. Prefer the platform (browser APIs, Postgres, Supabase) over a library.
2. A runtime dependency needs: a release in the last 12 months, more than one maintainer or a company behind it, and no open high-severity advisory.
3. Pin exact versions. Review updates monthly, not automatically.
4. Wrap each third-party library behind one file in `src/lib/` so it can be swapped without touching screens.
5. `tech-lead` checks these points before proposing any new dependency, and records the check in the slice spec.

## 3. Environments

| Environment | Front end | Backend | Used for |
| --- | --- | --- | --- |
| Local | `pnpm dev` | `supabase start` | Building and unit tests |
| Preview | Vercel preview deployment per branch | Supabase **staging** project | Review, end-to-end tests, pre-production QA |
| Production | Vercel production | Supabase **production** project | Real tutors |

Staging and production are separate Supabase projects with separate keys. Migrations run on staging first, always.

## 4. Branching, CI and release gates

- Trunk-based. One short-lived branch per slice, one pull request per slice.
- CI on every pull request: lint, type-check, unit tests, i18n key parity, bundle size, build, then Playwright against the built `out/` folder (and against the preview deployment once slice F4 wires up Vercel).
- **Gate A, merge:** CI green, `code-reviewer` has no open must-fix, and `lead-reviewer` has read the change, run the checks and merged it.
- **Gate B, staging:** migration applied to staging, `preprod-qa` returns "go".
- **Gate C, production:** human approves; `release-manager` applies the migration, promotes the build, runs the smoke test, records the rollback step.

## 5. Slices, in build order

Sizes are relative effort (S about a day, M a few days, L about a week of focused work). They are estimates to order the work, not commitments.

### Foundation

| ID | Slice | Size | Notes |
| --- | --- | --- | --- |
| F1 | Repo and tooling | S | Next.js + TS + Tailwind + pnpm, lint, type-check, Vitest, Playwright, CI, `.env.example`, brand constant |
| F2 | Design system in code | L | Tailwind tokens from `docs/DESIGN.md`, fonts, all thirteen components in `docs/DESIGN.md`, a `/dev/components` page. Two pull requests: F2a (tokens, fonts, Button, Field, Slip, Row, Stamp, Tabs, StatusTag, Sheet, the page) and F2b (Segmented, StudentStrip, Switch, BottomNav, Banner) |
| F3 | Languages | S | next-intl, 4 message files, locale routing, `pnpm i18n:check`, number and date formatters (₹1,23,456, DD MMM YYYY) |
| F4 | Supabase and environments | S | Local project, staging and production projects, migration workflow, Vercel project wired to the repo |

### Release 0 — free tools

| ID | Slice | Size | Acceptance comes from |
| --- | --- | --- | --- |
| R0-1 | Landing page | M | PRD §4 R0 "SEO"; design: Landing, Landing on a phone |
| R0-2 | Fee reminder generator | M | PRD R0 row 2; `wa.me` link and `upi://pay` link |
| R0-3 | Fee receipt maker | M | PRD R0 row 1; client-side PDF in 4 languages |
| R0-4 | Waitlist | S | `waitlist` table, insert-only Edge Function with rate limit |
| R0-5 | SEO and analytics | S | Per-language titles and descriptions, sitemap, PostHog page events |

**Ship Release 0 here.** It is useful on its own and starts search traffic while Release 1 is built.

### Release 1 — MVP

| ID | Slice | Size | Depends on |
| --- | --- | --- | --- |
| R1-1 | Language picker, sign-in, tutor profile, setup steps | M | F3, F4 |
| R1-2 | Data model and RLS for tutors, batches, students | M | F4 |
| R1-3 | Students: list, add one, batches | M | R1-2 |
| R1-4 | Import: paste a list, Contact Picker, CSV/XLSX mapping | L | R1-3 |
| R1-5 | Dues: table, daily generation job, opening balance | M | R1-2 |
| R1-6 | Dues board (home): month switcher, tabs, batch filter, student strip | M | R1-5 |
| R1-7 | Record payment, receipts, `/r/{token}`, receipt PDF | L | R1-5 |
| R1-8 | One-tap reminder and bulk remind | M | R1-6 |
| R1-9 | Parent pay page `/p/{token}`, consent, UPI fallback | L | R1-5 |
| R1-10 | "I've paid" claims and the notifications inbox | M | R1-9, R1-7 |
| R1-11 | Attendance | M | R1-3 |
| R1-12 | Offline: service worker, outbox, sync states | L | R1-7, R1-11 |
| R1-13 | Export, referral `/join/{code}`, delete account | M | R1-7 |
| R1-14 | Analytics events and Sentry | S | all above |
| R1-15 | Android wrapper (Bubblewrap TWA), `assetlinks.json`, Play listing | M | R1-12 |

Checkpoint after R1-8: a tutor can sign up, add students, see dues and send reminders. Put it in front of 5 tutors before building the parent side.

### Release 2 — Pro (outline; detailed after Release 1 ships)

Subscriptions and trial → automatic reminders through the WhatsApp Cloud API → online payments with a sub-merchant → monthly parent report → reports → branding. The WhatsApp templates and the payment partner both need approval from outside companies; start those applications during Release 1.

### Release 3 — Scale (outline)

UPI AutoPay, Centre plan, notebook-photo import, public tutor profile, Tamil and Malayalam.

## 6. Risks

| Risk | What we do about it |
| --- | --- |
| `upi://` links do not open on some devices | Copy-UPI-ID and QR fallback on the pay page (already designed); test on 5 real phones in pre-production |
| Receipt numbers collide or skip | One database function with a lock; a concurrency test |
| Offline writes lost or duplicated | Outbox with client-generated ids; idempotent upserts; end-to-end test with the network switched off |
| Indian-script text clips or overflows | Per-script type settings; screenshot tests in all four languages at large font size |
| Bundle grows past 200 KB | `pnpm size` in CI; PDF and spreadsheet code loaded on demand |
| Parents distrust an unfamiliar link | Tutor's name leads the page; test with real parents at the R1-9 checkpoint |
| DPDP compliance | Consent recorded per student and notice version; delete-account and export in R1-13; no data on students beyond name, batch, fee, attendance |

## 7. What we need from you

1. A GitHub repository (or permission to `git init` here and push).
2. Accounts and keys: Supabase (two projects), Vercel, Google OAuth client, PostHog, Sentry, Resend.
3. The final product name, domain and logo, or confirmation to build with the placeholders.
4. ~~A yes or no on the dependency table in section 2.~~ Approved 2026-10-09, subject to the dependency policy.
5. Native speakers to review Hindi, Kannada and Telugu before Release 0 ships.
6. For Release 2, started early: a Meta WhatsApp Business account and a Razorpay or Cashfree partner application.
