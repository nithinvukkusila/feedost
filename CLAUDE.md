# CLAUDE.md — FeeDost

You are building FeeDost, a fee-collection web app for Indian home tutors. Read these before any task:

- `PRD.md` — what to build and the acceptance criteria. The source of truth for scope.
- `docs/BUILD_PLAN.md` — the order to build it in, the architecture decisions, and the release gates.
- `docs/DESIGN.md` — the visual system ("Bahi-khata") as tokens and rules. The design canvas is the source of truth for layout.

## How to work in this repo

- Build in release order from PRD.md §4: Release 0 → Release 1 → Release 2 → Release 3. Do not start a later release until the earlier one works end to end.
- Work one slice at a time from `docs/BUILD_PLAN.md`. A slice is done only when it meets the Definition of Done below.
- Before writing code for a feature, restate its acceptance criteria from PRD.md and plan the smallest implementation that meets them.
- After each feature: run lint, type-check and tests; fix failures before moving on. Then summarise what changed and what to test manually on a phone.
- Keep the scope tight. If something isn't in PRD.md, ask before adding it.

## The pipeline and who does what

Every slice moves through these stages. Each stage has an agent in `.claude/agents/`. Do not skip a stage; do not let one agent do another's job.

| Stage | Agent | Output |
| --- | --- | --- |
| 1. Plan | `product-manager` | `docs/specs/<slice>.md`: acceptance criteria, edge cases, out of scope |
| 2. Design the build | `tech-lead` | Technical plan appended to the spec: files, data, migrations, risks |
| 3. Build | `frontend-dev`, `backend-dev` | Code on a feature branch |
| 4. Test | `test-engineer` | Unit and end-to-end tests; all green |
| 5. Review | `code-reviewer` | Findings; nothing merges with an open "must fix" |
| 6. Pre-production | `preprod-qa` | Go or no-go report against the staging deployment |
| 7. Ship | `release-manager` | Production release, smoke test, rollback note |

The human approves three things and only the human: merging to `main`, running a migration on production, and promoting a build to production.

## Stack (do not swap without asking)

Next.js (static export) + TypeScript + Tailwind, next-intl (en, hi, kn, te), Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron), Cloudflare Pages, PostHog, Sentry. Package manager: pnpm.

Do not add a dependency that is not listed in `docs/BUILD_PLAN.md` without asking. Hosting is Cloudflare Pages, not Vercel.

## Conventions

- Mobile-first UI at 360px width; tap targets ≥44px.
- All user-facing text goes through next-intl message files in `messages/{en,hi,kn,te}.json`. No hard-coded strings in components. When adding a key, add it to all four files (mark non-English as `TODO-translate` if unsure).
- Money is integer paise in the database and code; format with Indian grouping (₹1,23,456) only at display time.
- Phone numbers stored in E.164 (+91…).
- Dates display as DD MMM YYYY.
- Every table has row-level security: `tutor_id = auth.uid()`. Public pages (`/p/[token]`, `/r/[token]`) read data only through Edge Functions using unguessable tokens.
- Database changes only through SQL migrations in `supabase/migrations/`.
- Never store card or bank details. Never route money through our accounts.
- No SMS/OTP providers; auth is Google OAuth + email magic link.
- The product name lives in one constant (`src/config/brand.ts`). Never type "FeeDost" in a component.

## Design rules that code must follow

Full detail in `docs/DESIGN.md`. The ones that are easy to get wrong:

- Use the Tailwind tokens. No raw hex values in components.
- Blue is for sending and paying. Black is for recording. Red is never a button: it is the cloth cover and it marks overdue.
- Status is always a word plus a mark, never colour alone.
- No text below 14px. Rows and buttons grow in height; they never truncate a translated label.
- Hindi, Kannada and Telugu use Anek with their own line-height and no letter-spacing. Amounts stay in the headline face with 0–9 digits.
- Buttons have a solid offset shadow and move into it when pressed. No blur shadows, no gradients, corners 4px at most.

## Definition of Done (per slice)

1. Every acceptance criterion in the slice's spec is met and demonstrated.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass.
3. All four message files have every new key.
4. Works at 360px wide and with the system font size set to large.
5. New tables have RLS and a test that proves another tutor cannot read them.
6. Initial JS for any changed route is ≤200 KB gzipped (`pnpm size`).
7. `code-reviewer` has no open "must fix" findings.
8. The spec lists what to test by hand on a phone.

## Commands

- `pnpm dev` — local dev server
- `pnpm lint` / `pnpm typecheck` / `pnpm test` — static checks and unit tests
- `pnpm test:e2e` — Playwright, phone viewport
- `pnpm size` — bundle size check
- `pnpm i18n:check` — every key exists in all four message files
- `pnpm build` — static export to `out/`
- `supabase start` / `supabase db reset` — local database

These are set up in slice F1 of the build plan. Until then they do not exist.

## Secrets

Keep keys in `.env.local` (never committed). Provide `.env.example` with placeholder names only. Never print a secret in a log, a test, or a commit.

## Repository map

```
PRD.md                 product spec
docs/                  build plan, design tokens, per-slice specs
design/                working files for the design canvas (not app code; see design/CLAUDE.md)
src/                   Next.js app (see src/CLAUDE.md)
messages/              next-intl strings, one file per language
supabase/              migrations, Edge Functions, seed (see supabase/CLAUDE.md)
e2e/                   Playwright tests
.claude/agents/        the pipeline agents
```
