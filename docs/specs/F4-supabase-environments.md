# F4 — Supabase and environments

## Goal
After this slice there are three places the app can run (local, staging, production), each with its own database, and a fixed, tested way for a database change to travel from a developer's machine to staging to production. A page served from a preview deployment talks to staging; a production build talks to production; neither can reach the other, and no secret key ever reaches a browser.

Size: S, as in the build plan. It is setup, one empty-of-product migration, one tiny health check, and CI. No product table, no screen a tutor or parent sees.

## Users and moment
- **The founder.** Creates the accounts and projects, holds the keys, and is the only one who approves a change to production. Does this once, at a desk, with the checklist below.
- **The agents** (`backend-dev`, `release-manager`, `preprod-qa`, `test-engineer`, `frontend-dev`). They need a database to build against, a staging to test on, and rules that stop them from touching production.
- **Later, indirectly:** the tutor on a low-end Android and the parent arriving from WhatsApp. They are protected by what this slice gets right: separate data per environment, no key leak, no schema change that skipped review. F4 shows them nothing.

## What I checked
- `supabase/` holds only `CLAUDE.md`. No `config.toml`, no migrations. (Checked with a file listing.)
- I had no shell in this session, so I could not run `which supabase docker` or `docker ps`. I am relying on the brief: Supabase CLI not installed, Docker present. `tech-lead` or `backend-dev` must confirm `docker ps` works before the first `supabase start`.
- `.github/workflows/ci.yml` has one job (`check`). No database, no Supabase secrets. `pnpm check:leak` already exists and means the **language** leak check (F3). The new secret check must have a different name.
- `vercel.json` turns off auto-deploy for `main` only. Previews on other branches are on.
- `.env.example` already has `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, plus PostHog and Sentry names. Nothing in `src/` calls Supabase yet.
- `.gitignore` covers `supabase/.branches/` and `supabase/.temp/` only.
- The PRD says nothing about where data lives, has no health endpoint, and lists the Edge Functions by name (`pay-page`, `receipt`, `submit-claim`, `record-consent`, plus the waitlist function). See Open questions.

## Who does what
| Step | Who |
| --- | --- |
| Create Supabase organisation and both projects, choose plan, billing | **Founder only** |
| Copy project URL and public (anon) key from each project | **Founder only** |
| Create the Supabase access token and the database passwords | **Founder only** |
| Set variables in the Vercel dashboard (Preview and Production scopes) | **Founder only** |
| Turn on or off anything in the Supabase or Vercel dashboard (auth providers, deployment protection, deploy hooks) | **Founder only** |
| Approve running a migration on production, and promoting a build to production | **Founder only**, in the conversation, per release |
| Write migrations and tests, run them locally | `backend-dev` |
| Apply migrations and deploy functions to **staging** | `release-manager` |
| Apply migrations and deploy functions to **production** | `release-manager`, only after the founder's yes for that release |
| Check staging matches the migrations folder | `preprod-qa` (read only) |

Agents never ask the founder to paste a secret into chat. The access token goes into the shell environment of this machine only.

## Acceptance criteria

Tags: **[unit]** Vitest or a script test, **[e2e]** Playwright at 360px, **[ci]** a CI step that fails the pull request, **[manual]** a person or agent runs a command or reads a dashboard and records the result.

### Local stack
1. `supabase/` contains `config.toml`, `migrations/`, `functions/`, `seed.sql` and `tests/`, as the `supabase init` layout and `supabase/CLAUDE.md` describe. [unit, reads the folder]
2. From a clean clone with Docker running, `pnpm install` and then the one documented start command brings the local stack up. The exact commands are written in `supabase/CLAUDE.md` (Running section) and nowhere need a global tool the file does not name. [manual]
3. `supabase db reset` exits 0 on an empty local database: it applies every migration, then the seed. [ci]
4. `seed.sql` is valid and contains no product rows and no phone number, name or email that looks real. (The "try with sample data" tutor is R1-x; F4 leaves the file as a comment.) [unit]
5. The CLI is the pinned dev-only dependency `supabase` run through pnpm (founder decision 1, 2026-10-10), and `pnpm lint`, `typecheck`, `test`, `build`, `size` and `check:leak` are unchanged and green. F4 adds no runtime dependency and the initial JS of every route is unchanged (`pnpm size`). [ci]
6. Local ports do not clash with `pnpm dev` (3000) and `pnpm serve:lan` (4173). [manual]

### First migration and the RLS test harness
7. Exactly one migration is added. It proves the workflow and creates **no table** and no part of the PRD §7 data model. It may only enable database extensions the architecture already needs (for example `pg_cron` for dues generation, and what the database needs to make random tokens). The migration author states in the pull request which extension and why. [manual, reviewed by `lead-reviewer`]
8. Migration files are named by the CLI's timestamp rule (`supabase migration new`). A script rejects any file in `supabase/migrations/` that does not match `<14 digits>_<snake_case>.sql`. [unit] (See Open question 3: `supabase/CLAUDE.md` currently shows `0004_payments.sql`.)
9. A pgTAP test in `supabase/tests/` builds a throw-away table with `tutor_id`, RLS on, and the four `tutor_id = auth.uid()` policies, **inside a transaction that rolls back**. It proves: tutor A reads own row; tutor B reads zero rows; B's insert, update and delete of A's row change zero rows or fail; a request with no session (the `anon` role) reads zero rows. [ci]
10. The "act as tutor A / tutor B / nobody" steps from criterion 9 live in one shared helper under `supabase/tests/`, with a two-line explanation in `supabase/CLAUDE.md`, so R1-2 calls it instead of rewriting it. [unit, reads the files]
11. A second pgTAP test fails if any table in the `public` schema has row-level security off. It passes today because there are no tables. It must not be deleted when R1-2 adds tables. [ci]
12. The tests prove they can fail: the pull request description shows `supabase test db` exiting non-zero once with a deliberately broken policy, then green again. [manual]
13. After the test run, the local database holds no leftover test table or test user. [ci, run `supabase test db` twice in a row; both pass]

### CI for the database
14. `ci.yml` gets a database job that runs `supabase db reset` then `supabase test db` on every pull request and on push to `main`. It fails the pull request if either fails. It needs no GitHub secret. It stops after 15 minutes. [ci]
15. The existing `check` job still runs on its own and is not slowed by the database job (they run side by side). [ci]
16. CI fails a pull request that **edits, renames or deletes** a migration file that already exists on `main`. Adding a file is allowed. [ci, with a unit test of the script on a fixture git history]
17. Nothing outside `supabase/migrations/` may change the schema. Two checks: (a) a script fails if a `create table`, `alter table`, `drop`, `create policy` or `create function` statement appears in `supabase/functions/`, `supabase/seed.sql` or `src/`; (b) `release-manager` runs `supabase migration list` before every push and stops if staging or production lists a migration the repo does not have (someone used the dashboard SQL editor). [unit for (a); manual for (b)]

### Remote projects
18. Two Supabase projects exist, one called staging, one production, in Mumbai (`ap-south-1`, founder decision 2, 2026-10-10), each with its own database password, URL and keys. [manual, founder]
19. Neither project holds any real tutor or parent data. Test data on staging is made-up. [manual]
20. After `release-manager` applies the first migration to **staging**, `supabase migration list` shows local and staging identical, and `preprod-qa` records that output. [manual]
21. The first migration is applied to **production** only after the founder says yes in the conversation for this step, and `release-manager` records the founder's words and the `migration list` output in the pull request. If the founder prefers to wait for R0-4, this criterion moves to that slice (Open question 4). [manual, founder approval]
22. No agent runs `db push`, `db reset` or `functions deploy` against production without that yes. The production database URL and password are not stored in any file on this machine; the founder supplies them at the moment of an approved release. [manual, written in the workflow doc]

### Migration workflow (written down, then followed)
23. One page, `docs/ENVIRONMENTS.md`, states the steps below, the commands for each, and who runs each. `supabase/CLAUDE.md` links to it and its "Running" section matches it. [unit, file exists and is linked]
    1. `backend-dev` runs `supabase migration new <name>`, writes SQL and pgTAP tests, runs `supabase db reset` and `supabase test db`.
    2. Pull request. CI runs criterion 14. `code-reviewer` and `lead-reviewer` read the SQL.
    3. After merge to `main`: `release-manager` applies to **staging**, reading each migration first and stopping on any drop or data rewrite.
    4. `preprod-qa` checks staging against the migrations folder.
    5. With the founder's yes: `release-manager` takes a backup (criterion 24), applies to **production**, records it.
24. Before each production migration, `release-manager` takes a database dump and stores it **outside the repo** (it holds real data). The free plan has no automatic backups (Open question 5); the dump is how the "confirm a recent backup" step in `release-manager` is met until the plan changes. [manual]
25. Rollback is a **forward fix**: a new migration, through the same pipeline. There are no "down" migrations. A migration must work with the front end that is live right now, because the database changes first. This matches `release-manager` and is written in the workflow page. [manual, doc review]
26. Seed data runs only on the local stack. `config.toml` does not seed remote projects, and the workflow page says so. [unit, reads `config.toml`]

### Keys and secrets
27. Where each value lives, as a table in `docs/ENVIRONMENTS.md`:

    | Value | Local | Vercel Preview | Vercel Production | Supabase function secrets | GitHub secrets |
    | --- | --- | --- | --- | --- | --- |
    | Project URL (public) | `.env.local` | staging URL | production URL | not needed | none |
    | Anon key (public) | `.env.local` | staging key | production key | not needed | none |
    | Service-role key | nowhere in files | **never** | **never** | injected by Supabase itself | **never** |
    | Access token, database password | shell only | never | never | never | none in F4 |

    The static export has no server, so there is no place the service-role key could be used outside an Edge Function. [manual, doc review]
28. `.env.example` has placeholders only: the two public Supabase names (already there), and, in a clearly separate "command line only, never in Vercel" block, the CLI variables the workflow needs. It has no real value, and no variable whose name contains `SERVICE`, `SECRET` or `PASSWORD` starts with `NEXT_PUBLIC_`. PostHog and Sentry lines are left as they are; they belong to R0-5 and R1-14. [unit]
29. `.gitignore` also covers `supabase/.env*` and any `.env*` except `.env.example`. [unit]
30. A new script, named differently from the language check (suggested `pnpm check:secrets`), fails when it finds, in `out/`, in `src/`, and in every git-tracked file except fixtures: the text `service_role` or `SERVICE_ROLE`; a token that begins `sb_secret_`; or a JWT (three dot-separated base64url parts) whose decoded payload has `"role":"service_role"`. It **allows** a JWT with `"role":"anon"` and the prefix `sb_publishable_`, because the public key is meant to be in the browser bundle. It prints the file and line, never the value. [unit with fixtures: one passing, and one failing per rule; test fixtures build the fake secret at run time so the scanner does not flag its own tests]
31. That script runs in CI after `pnpm build`, once on the normal build and once on the `VERCEL_ENV=production` build. [ci]
32. On Vercel only (`VERCEL=1`), the build fails if the two public Supabase values are missing, or if the "anon" key decodes to a role other than `anon`. Locally and in CI without those values the build still succeeds, so existing CI steps are not broken. [unit]
33. The only Edge Function secret F4 sets is `APP_ENV` (`staging` or `production`), set by `release-manager` with `supabase secrets set` on each project. Nothing secret is written into SQL or function source. [manual]
34. CI uses no repository secret in F4. [ci, a test reads `ci.yml` and fails on `secrets.`]

### Vercel
35. "Wired to the repo" means: the existing Vercel project builds every non-`main` branch as a preview, and the environment variables are set by scope. **Preview** holds the staging URL and anon key. **Production** holds the production URL and anon key. The **Development** scope is not used. No variable is set per branch. [manual, founder]
36. `vercel.json` still disables auto-deploy for `main`, and F4 changes nothing else in it. (The `/p/*` rewrite is R1-9.) [unit, reads the file]
37. The preview for the F4 branch loads and its smoke page (criterion 41) reports `staging`, not `production` and not `local`. [e2e or manual, recorded in the pull request]
38. A production deploy needs the founder's yes and is done by `release-manager`. `docs/ENVIRONMENTS.md` names the exact mechanism chosen in Open question 6 and lists the steps. F4 does **not** perform a production deploy unless the founder says so in this slice. [manual]
39. The Vercel CLI is not installed. The workflow page says what that means: agents cannot list deployments, read env vars or deploy from the terminal; they use the GitHub pull request page for preview URLs, and the founder uses the Vercel dashboard for anything else. [manual, doc review]
40. Preview deployments sit behind Vercel's login by default, which blocks `preprod-qa` and Playwright. The founder's choice from Open question 7 is applied and written down. Production is never behind that login. [manual, founder]

### Smoke test: can this environment reach its own Supabase?
(Open question 8 was answered yes on 2026-10-10, so the fallback is not used.)

41. A `health` Edge Function answers a GET with exactly `{"ok":true,"env":"<APP_ENV>"}` and nothing else: no version, commit, project id, timestamp, database result or header that names the project. Any other method except `OPTIONS` answers 405; `OPTIONS` answers 204 with the CORS headers and no body. [unit]
42. It never reads the database and never uses the service-role key. [manual, code review]
43. A script (suggested `pnpm smoke:env`) reads the project URL and anon key from the environment, calls `health`, and exits non-zero if the answer is not 200, is not the exact shape, or names a different environment from the one passed in. [unit, with a fake network]
44. A developer-only page (suggested `/dev/supabase`, same rules as `/dev/components`) calls `health` from the browser and shows the environment name in words. If Supabase cannot be reached, it shows a plain "cannot reach" message instead of crashing. It uses a plain `fetch`; F4 adds no Supabase client library (Open question 9). [e2e]
45. That page and its words are absent from the `VERCEL_ENV=production` build, and CI's existing production-build check gets a sentinel for it. A production visitor cannot reach it. [ci]
46. The browser call works from `localhost`, from a `*.vercel.app` preview and from the LAN address used for phone testing; the browser reports no blocked-request error. [manual]
47. `preprod-qa` and `release-manager` use `pnpm smoke:env` as the first environment check: staging before testing, production after a release (replacing a line in the release-manager smoke list, which today has nothing for this). [manual]

### Auth settings (only what the PRD needs later)
48. `config.toml` and both remote projects: email sign-in is on (magic link is how R1-1 will sign tutors in), phone / SMS sign-in is **off**, anonymous sign-ins are **off**, the Google provider is **off**. No SMS provider is set up. [unit for `config.toml`; manual for the two projects]
49. F4 asks for and enables nothing that needs the founder's Google Cloud credentials. That is a founder task for R1-1 (create the OAuth client, paste its ID and secret into each project's Google provider, add the redirect URLs). F4 does not set the site URL, redirect allow-list or email sender; R1-1 does. [manual, review of the pull request]

## Edge cases
- **Clean clone, first run.** `supabase start` downloads several large images and can take many minutes and several GB on a slow link. The doc says so. If Docker is not running, the command's own error must be quoted in the doc with the fix ("start Docker").
- **Low-memory laptop.** The full local stack is heavy. The doc names which parts can be left out for pgTAP-only work.
- **CI cold start.** The database job pulls images every run; the 15-minute cap (criterion 14) must hold, or the job caches images.
- **Two branches add a migration at once.** Timestamps keep order. A later-dated migration that lands earlier on `main` is applied in timestamp order on a fresh database but is **skipped** by `db push` on a database already past that date. The workflow page tells the author to rebase and re-stamp before merge.
- **A migration PR whose preview needs the new schema.** Previews use staging, and staging only gets a migration after merge (Gate B comes after Gate A). A branch that depends on a new column will break on its preview. Open question 10.
- **Preview points at production by mistake.** The `health` answer is the only defence the browser can show. Criterion 37 and the Vercel scope rules cover it; criterion 43 makes it a failing command.
- **Production build without keys.** On Vercel it fails loudly (criterion 32); it must never deploy a site that silently has no backend.
- **Anon key looks like a secret to a scanner.** The check allows only a JWT whose role is `anon`. A pasted service-role JWT fails even if it is renamed.
- **Staging asleep.** On the free plan, a project with no activity for about a week is paused. A paused staging makes previews and `preprod-qa` fail. The doc says how the founder wakes it, and the smoke script's error says "project may be paused".
- **Offline or slow network on the smoke page.** Plain message, no spinner forever, no crash (criterion 44).
- **Very long names, large font, second language, partial payment, duplicates, old links.** No screen a tutor or parent sees changes in F4. The dev page uses `t()` for its words like every other page, or is exempt the same way `/dev/components` is; `tech-lead` follows what F2 did.
- **Someone edits the schema in the Supabase dashboard.** Caught by criterion 17(b) at the next push. The founder is asked not to use the SQL editor to change structure.
- **`pg_cron` extension.** It must exist on both hosted projects before R1-5. If the dashboard needs it switched on by hand, that is a founder step; the migration author says so in the pull request.

## Out of scope
- Any product table, policy or function, and the PRD §7 model: **R1-2** (and `waitlist` in **R0-4**).
- Edge Functions other than `health`: `waitlist-join` in R0-4; `pay-page`, `receipt`, `record-consent`, `submit-claim` in R1-7 to R1-10.
- The `/p/*`, `/r/*` and `/join/*` rewrites: R1-7 and R1-9.
- Google OAuth setup, site URL, redirect allow-list, email sender (Resend), sign-in screens: **R1-1**.
- PostHog and Sentry keys and code: **R0-5** and **R1-14**.
- Custom domain.
- Running the Playwright suite against the preview deployment inside CI (build plan section 4). F4 makes it possible by hand (criteria 37 and 40); the CI wiring is Open question 11.
- Storage buckets and their policies: **R1-9 / R1-10**.
- Subscriptions, webhooks, WhatsApp API keys: Release 2.
- Upgrading the Supabase plan beyond what Open question 5 settles.

## Design references
None. No tutor-facing or parent-facing screen. The developer-only page follows `docs/DESIGN.md` tokens but is not on the canvas (`design/project/canvas.json` has no artboard for it).

## Analytics
None. No PostHog event from PRD §4 fires in this slice. PostHog is not installed before R0-5.

## Test by hand on a phone
None needed. The founder has deferred phone checks, and F4 changes nothing a phone user sees. If the founder wants one check: open the preview URL's `/dev/supabase/` on the phone over mobile data and confirm it says `staging`.

## Founder checklist (only the founder can do these)
1. Go to supabase.com. Sign up or sign in. Create an organisation. Choose the plan (Open question 5).
2. New project, named `feedost-staging`. Region: the one you pick in Open question 2. Generate a database password, save it in your password manager. Do not paste it in chat or a file in this repo.
3. New project, named `feedost-production`, same region, a different password.
4. In each project: Project Settings, then API. Copy **Project URL** and the **anon / publishable** key. Never copy or share the `service_role` / secret key anywhere.
5. Account menu, then Access Tokens, then Generate new token, named `feedost-cli`. In the terminal of this machine, `export SUPABASE_ACCESS_TOKEN=...` for the session. Do not write it to a file.
6. In each project: Authentication, then Sign In / Providers. Confirm Email is on, Phone is off, Anonymous sign-ins are off, Google is off. Do not create Google credentials yet.
7. Vercel dashboard, the project, Settings, Environment Variables. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` **twice**: tick only **Preview** for the staging values; tick only **Production** for the production values. Leave Development unticked. Add nothing else.
8. Vercel, Settings, Git: confirm the repo is connected and that `main` is not auto-deployed (it is off in `vercel.json`). If Open question 6 is answered "deploy hook": Settings, Git, Deploy Hooks, create one for branch `main`, keep the URL private.
9. Vercel, Settings, Deployment Protection: apply your answer to Open question 7.
10. Tell the agents "keys are in place". Agents then link and push to staging themselves. Production waits for your yes.

## Decided by the founder, 2026-10-10
1. **Supabase CLI:** a pinned, dev-only `supabase` dependency run through pnpm. Approved as a dependency; the version must be at least two weeks old. (Open question 1.)
2. **Region:** Mumbai, `ap-south-1`, for both projects. (Open question 2.)
3. **`health` Edge Function:** allowed. It returns only `{"ok":true,"env":...}`, reads no data and uses no service-role key. (Open question 8.)
4. **Release rule:** production is a **fresh build of the same commit with the Production-scope variables**, not "promote the same build". The old wording in `release-manager.md` and the build plan is to be replaced (see the technical plan, section 17). (Open question 12.)
5. Every other open question: **proceeding on the recommendation** (3, 4, 5, 7, 9, 10, 11, 13). Open question 3 is fixed in the technical plan (migrations use the CLI's timestamp names; the two examples that show `0004_payments.sql` are to be corrected). Open question 6 was researched by `tech-lead`; the result and what is still unverified are in the technical plan, section 10.

## Open questions
1. **How is the Supabase CLI provided?** Dependency policy says ask. Recommendation: a pinned dev-only dependency (`pnpm add -D supabase`, exact version). It is maintained by Supabase the company, and every agent and CI get the same version with no global install. It needs one pnpm setting to allow its install script, and it is dev-only, so it adds nothing to the app bundle. The alternative is a documented global install (Homebrew), which drifts between machines.
2. **Which region?** The PRD is silent on data location. Recommendation: Mumbai (`ap-south-1`) for both projects: closest to tutors and parents, and keeps Indian users' data in India while DPDP rules are being finalised. It cannot be changed later without moving the database. Confirm Mumbai is offered when you create the project.
3. **Migration file names.** `supabase/CLAUDE.md` and a `lead-reviewer` example use `0004_payments.sql`, but the CLI makes timestamp names. Recommendation: use the CLI's timestamps, and `product-manager` or `tech-lead` fixes those two examples. Mixed styles sort wrongly.
4. **Apply the first (empty) migration to production now, or at R0-4?** Recommendation: now. It creates no table, and it proves the whole approval path before any real phone number lands in the waitlist.
5. **Supabase plan.** Free plan: no automatic backups, and a quiet project pauses after about a week. Recommendation: free for both during F4 to R0-3; move **production** to the paid plan before R0-4 ships (it will hold waitlist phone numbers), which gives daily backups. Staging can stay free. Please confirm current prices yourself.
6. **How does a production deploy happen, with no Vercel CLI and `main` not auto-deployed?** Recommendation: a Vercel **deploy hook** for `main` that you give to `release-manager` at release time only (no CLI to install). Whether a hook builds `main` while `git.deploymentEnabled.main` is false is something I could not confirm; `tech-lead` must test it on a harmless commit. Fallback: install the Vercel CLI as a dev-only dependency.
7. **Preview protection.** Previews are login-gated by default, which blocks `preprod-qa` and Playwright. Recommendation: keep protection on and create a "Protection Bypass for Automation" secret that `release-manager` and `preprod-qa` get at test time. Turning protection off exposes unreleased pages at guessable URLs (low harm now, but they would run against staging).
8. **Is a `health` Edge Function allowed?** It is not in the PRD's function list. Recommendation: yes. It is the only way to prove, before R0-4, that Edge Function deploys, `APP_ENV` and browser access to the right project all work, and it returns nothing but the environment name. Fallback if no: drop criteria 41 to 47 and prove reachability only with Supabase's built-in auth health URL, which cannot tell staging from production by itself (the URL would be the only evidence).
9. **Supabase client library.** `@supabase/supabase-js` is not in the build plan's dependency table, and F1 measured about 68 KB of gzipped budget left per route. Recommendation: no library in F4 (plain `fetch`); `tech-lead` checks the library and its size at R1-1 and adds it to the table then.
10. **Previews of a branch that adds a migration.** Previews hit staging, but staging only gets a migration after merge. Recommendation: accept it; migrations are additive and the front end ships after the database. CI covers the branch against the local stack. Say if you want staging migrated before merge instead (it breaks "staging matches `main`").
11. **Playwright against the preview in CI** (build plan section 4). Recommendation: after R0-1, when there are real pages; F4 only makes a manual run possible.
12. **Promote versus rebuild (conflict in the docs).** `release-manager` says "promote the same build that was tested on staging, do not rebuild". But `NEXT_PUBLIC_*` values are baked into the static files at build time, so a preview build carries the staging URL and cannot become the production site. Recommendation: production is a fresh build **of the same commit** with the Production scope variables, and the release note records the commit. `release-manager`'s step 5 and the build plan wording need the founder's OK to change. Alternative: read the Supabase URL at run time from the page's host name, which adds code and risk.
13. **One access token reaches both projects.** A personal Supabase access token is account-wide, so the "no production without a yes" rule is a working rule, not a technical wall. Recommendation: keep the token in the session only, keep the production database URL and password out of this machine (criterion 22), and accept the rule for now. Separate accounts for staging and production would be a technical wall but cost more effort.

## Gaps and contradictions found in the PRD, build plan and agent files
- PRD: no data-residency statement, no health endpoint (Questions 2, 8).
- Build plan section 2 dependency table: no Supabase client library (Question 9).
- `release-manager` "promote, do not rebuild" versus static `NEXT_PUBLIC_*` values (Question 12).
- `release-manager` asks to "confirm a recent production backup exists", which the free plan cannot give (Question 5).
- Build plan: Gate B (staging migration) comes after Gate A (merge), but previews of the PR already use staging (Question 10).
- `supabase/CLAUDE.md` and `lead-reviewer` examples use numbered migration names; the CLI does not (Question 3).
- `release-manager` production smoke list has no environment check (criterion 47 adds one).
- CI already has `pnpm check:leak` for languages; the new secret check needs another name.

## Hand-off: decisions for `tech-lead`
Hand off to `tech-lead`. Spec file: `/Users/nithin/1-person-busnes/FeeDost/docs/specs/F4-supabase-environments.md`. Add the technical plan under it. Decide and record:
- Which extensions the first migration enables (criterion 7), and whether to revoke default `anon` privileges on the `public` schema as a second line of defence behind RLS.
- How the shared pgTAP helper simulates tutor A, tutor B and no session (criteria 9, 10).
- How CI runs the database job (full `supabase start`, or only the services pgTAP needs) and caches images, inside the 15-minute cap.
- How the "existing migration changed" check (criterion 16) gets the `main` history in a pull request build.
- The exact patterns and file scope for the secret scanner, and how fixtures avoid tripping it (criteria 30, 31).
- How the Vercel-only build guard (criterion 32) avoids breaking the existing `VERCEL_ENV=production pnpm build` CI step, which has no Supabase values.
- The CORS rule for `health` (criterion 46), and whether the Deno test for it runs in CI.
- Whether the dev page's words go through next-intl or follow the `/dev/components` exemption.
- The production deploy mechanism after testing a deploy hook (Question 6), and the wording change for Question 12 once the founder answers.
- Contents and layout of `docs/ENVIRONMENTS.md`, and the edits to `supabase/CLAUDE.md`, `.env.example`, `.gitignore` and `ci.yml`.

---

## Technical plan — F4

Written by `tech-lead`, 2026-10-10. Nothing here is application code. Claims are marked **verified** (I ran it or read it today) or **unverified** (could not be checked from this machine; the step that will settle it is named).

### 1. Approach

Put the Supabase CLI in the repo as a pinned dev dependency, add the `supabase/` project (config, one small migration, a pgTAP harness, a `health` function), and make three small Node scripts do the policing that a human would forget: `check:db` (migration names, no edits to old migrations, no schema change outside `supabase/migrations/`), `check:secrets` (no service-role material in anything we ship) and `smoke:env` (is this environment talking to the Supabase it should). CI gets a second job that starts a reduced local stack on the GitHub runner and runs `db reset` and `test db` twice; no secrets are used anywhere. The browser side is one dev-only page (`/dev/supabase`) that does a plain `fetch` to `health`, built only outside a Vercel production build, plus a build guard that is written and tested in F4a but switched on in F4b, once the Vercel variables exist. Everything that needs a Supabase or Vercel login waits for F4b.

### 2. Split and size: F4a and F4b

**Recommendation: split.** F4a needs no keys and no Docker on this machine; F4b needs the founder's accounts. Doing it as one slice would hold roughly 85% finished, mergeable work behind a dashboard session.

| | F4a: the project, the checks, CI | F4b: the two remote projects and Vercel |
| --- | --- | --- |
| Needs the founder | one decision only (Docker, section 14, optional) | yes: accounts, projects, login, Vercel variables |
| Criteria | 1, 2 (in CI), 3, 4, 5, 7 to 11, 13 to 17, 23, 26, 28 to 31, 34, 36, 41 to 45 (unit and e2e parts), 48 (config part), 49 | 12 (if not shown in F4a), 18 to 22, 24, 25 (doc is F4a), 27 (doc is F4a), 32 (switched on), 33, 35, 37, 38, 39, 40, 46, 47, 48 (remote part) |
| Size | S+ (about 1.5 days) | S- (about half a day, mostly waiting on the dashboard) |
| Ends with | merged to `main`; preview builds unchanged | staging and (with a yes) production verified; `smoke:env` green against them |

Nothing in F4a changes what a Vercel preview does, so merging F4a cannot break anyone's preview. That is why the build guard is not wired until F4b (section 7).

### 3. What I checked on this machine

| Claim | Result |
| --- | --- |
| Supabase CLI installed globally | **Verified: no** (`which supabase`: not found). Not needed; the pinned dependency replaces it. |
| Docker CLI present | **Verified: yes**, `/usr/local/bin/docker`. |
| Docker works | **Verified: no, not now.** `docker ps` and `docker info`: "Cannot connect to the Docker daemon". `/var/run/docker.sock` is a link to `/Users/apple/.docker/run/docker.sock`, another account's folder (this account is `nithin`). `~/.docker` holds only `contexts`, so this account has never run a Docker VM. Docker Desktop 4.20.1 (dated June 2023) is in `/Applications` and is old. |
| Disk for images | **Verified: not enough.** 2.2 GiB free of 228 GiB (99% used). The local stack's images are several GB (the spec says so; I did not pull them: **unverified** exact size). The CLI binary alone is 126 MB. |
| RAM | **Verified: 8 GB** total. A full local stack is heavy at that size; the reduced start list in section 9 is the way. |
| Ports | **Verified free:** nothing listens on 54321 to 54324. The CLI's defaults (54321 to 54329) do not touch 3000 or 4173. |
| The CLI runs and `init` produces the layout I describe | **Verified** in a scratch folder outside the repo: `pnpm add -D --save-exact supabase@2.118.0` (8 packages, no build-script prompt), `pnpm exec supabase --version` printed `2.118.0`, `supabase init` wrote `config.toml` (Postgres 17, ports above, `[auth.email] enable_signup = true`, `enable_anonymous_sign_ins = false`, `[auth.sms] enable_signup = false`, `[auth.external.apple] enabled = false`), `supabase migration new` wrote `20261009185201_first_check.sql`. `supabase init` writes no `seed.sql`, `migrations/` or `functions/`; we create them. |
| `supabase start`, `db reset`, `test db` work | **Unverified here** (no Docker). They are proved by the CI database job. If the founder gets Docker working (section 14) they can also be run locally. |
| GitHub | **Verified:** `gh` is logged in as `nithinvukkusila`; the repo is private. Private repos use GitHub's free minutes (2,000 a month, **unverified for this account**); a database job of about 8 minutes per push is acceptable. |
| Vercel CLI, `deno` | **Verified: not installed.** Vercel behaviour below is from Vercel's current documentation, not from a test. |

Consequence: until Docker is fixed, no agent on this machine can run `supabase test db`. CI is the runner, and a loop is one push (about 8 to 10 minutes). `backend-dev` should write SQL in small steps because of that.

### 4. The dependency: `supabase` 2.118.0 (policy check, `docs/BUILD_PLAN.md` section 2)

- **Version:** `supabase@2.118.0`, published 2026-09-25, 15 days old. The newest stable, 2.120.0 (2026-10-06), and 2.119.0 (2026-09-30) fail the two-week rule. 2.117.0 (2026-09-07) would also pass; I take the newest that passes. `3.0.0-next.*` and `*-beta.*` are not used.
- **Dev only:** `pnpm add -D --save-exact supabase@2.118.0`. Not imported by any file in `src/`.
- **Checks:** released within 12 months (yes); company behind it (Supabase; 3 npm maintainers; repo `supabase/cli`; MIT); no known high advisory (**verified only as far as** `npm audit` on the package and its tree: 0 vulnerabilities; I did not read the GitHub advisories page for `supabase/cli`).
- **What the install does (verified):** the package is a 11 KB Node shim (`dist/supabase.js`) plus two small dependencies (`eciesjs`, `jose`). The real program is a binary in an **optional dependency per platform** (`@supabase/cli-darwin-arm64`, `-darwin-x64`, `-linux-x64`, `-linux-arm64`, `-linux-*-musl`, `-windows-*`), all at the same version; the package manager installs only the one that matches the machine (126 MB unpacked on this Mac, 152 MB on the CI Linux runner). **There is no `postinstall` script and no package in the tree has an install script** (`hasInstallScript` appears zero times in the lockfile I generated). So pnpm's build-script approval is not involved: **`pnpm-workspace.yaml` does not change**, nothing goes in `onlyBuiltDependencies` or `ignoredBuiltDependencies`, and `pnpm approve-builds` is never needed. The old "download the binary in postinstall" design (older CLI versions) is gone; if a future bump brings it back, `pnpm install` will print "Ignored build scripts" and the bump must be reviewed, not approved by reflex.
- **Cost:** the lockfile gains the eight platform entries; `pnpm install --frozen-lockfile` in CI downloads about 150 MB for `check` too. Measure the install time before and after; if the `check` job slows by more than a minute, the lever is to run `check` with `pnpm install --frozen-lockfile --no-optional` (tested before use; the CLI is not needed by `check`).
- **Nag line:** the CLI prints "a new version is available" on every call. Set `SUPABASE_NO_UPDATE_CHECK=1` in the `db:*` package scripts and in `ci.yml` (**unverified** that the variable is honoured; harmless if not; I used it in my scratch run and the line still printed, so do not rely on it).
- Policy item 4 ("wrap behind one file in `src/lib/`") does not apply: this is a tool, not a library the app imports.
- Update rule: review monthly; bump deliberately, one version at a time, and re-run the F4 CI.

### 5. Files

**Owners:** `backend-dev` = everything under `supabase/`, the `check:db` and `smoke:env` scripts, the CI database job and `docs/ENVIRONMENTS.md`. `frontend-dev` = `check:secrets`, the build guard, the dev page, `src/lib` and CI sentinels. `test-engineer` = the Playwright spec and a gap review of every unit test. `release-manager` = every remote step in F4b.

**Create (F4a)**

| File | Owner | What goes in it |
| --- | --- | --- |
| `supabase/config.toml` | backend-dev | From `supabase init`, then: `project_id = "feedost"`; `[auth]` `enable_anonymous_sign_ins = false`; `[auth.email] enable_signup = true`; `[auth.sms] enable_signup = false`, no `[auth.sms.*]` provider enabled; an explicit `[auth.external.google] enabled = false`; `[functions.health] verify_jwt = false`; `[edge_runtime.secrets]` with `APP_ENV = "local"` (**unverified** that a literal is accepted; the template shows `env(NAME)`; if not, use `env(APP_ENV)` and a git-ignored `supabase/.env`); `[db.seed] sql_paths = ["./seed.sql"]` untouched. Site URL, redirect list, email sender: **not touched** (R1-1). `auto_expose_new_tables` left unset (see section 6). |
| `supabase/migrations/<timestamp>_f4_baseline.sql` | backend-dev | Section 6. Timestamp from `pnpm exec supabase migration new f4_baseline`. |
| `supabase/seed.sql` | backend-dev | Comment only. |
| `supabase/tests/000_helpers.sql` | backend-dev | Section 6, the shared helper, written as a normal TAP file. |
| `supabase/tests/010_rls_probe.sql` | backend-dev | Criterion 9. |
| `supabase/tests/020_public_tables_have_rls.sql` | backend-dev | Criterion 11. |
| `supabase/tests/030_default_privileges.sql` | backend-dev | A table made by `postgres` in `public` is not readable by `anon` unless granted (section 6). |
| `supabase/functions/health/index.ts` | backend-dev | Five lines: `Deno.serve((req) => handle(req, Deno.env.get("APP_ENV")))`. |
| `supabase/functions/health/handler.ts` | backend-dev | The whole behaviour as a pure function `handle(req: Request, appEnv: string \| undefined): Response`. No `Deno` global, so Node can test it. Relative import in `index.ts` is `./handler.ts` (Deno needs the extension). |
| `supabase/functions/health/handler.test.ts` | backend-dev | Vitest, `// @vitest-environment node`. Criterion 41. |
| `scripts/check-db.mjs`, `scripts/check-db-lib.mjs` | backend-dev | Section 9: naming, immutability, ordering, no DDL outside migrations. |
| `scripts/smoke-env.mjs`, `scripts/smoke-env-lib.mjs` | backend-dev | Section 7. Plain `fetch`, Node 22. |
| `supabase/environments.json` | backend-dev | `{"local":{"url":"http://127.0.0.1:54321"},"staging":{"ref":null},"production":{"ref":null}}`. Public identifiers only. Refs filled in F4b. |
| `scripts/check-secrets.mjs`, `scripts/check-secrets-lib.mjs` | frontend-dev | Section 8. |
| `scripts/check-build-env-lib.mjs`, `scripts/check-build-env.mjs` | frontend-dev | Section 7. Written and tested in F4a, **not** in the `build` script until F4b. |
| `src/lib/supabase-env.ts` | frontend-dev | The one place the project URL is read: `export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""`. Written literally so Next inlines it. The anon key is **not** exported in F4 (nothing uses it; R1-1 adds it with the client library). |
| `src/app/dev/supabase/page.dev.tsx` | frontend-dev | Server page: title, one sentence, `<EnvCheck />`. `robots: noindex`. English copy in a `copy` object like `/dev/components` (that folder is exempt from `no-strings.test.ts`; same here). |
| `src/app/dev/supabase/env-check.tsx` | frontend-dev | `"use client"`. On mount `fetch(`${supabaseUrl}/functions/v1/health`)` with no custom headers (a "simple" request, so no preflight), 5 s timeout through `AbortController`. States, each a word plus a mark: not configured, checking, `local`, `staging`, `production`, cannot reach (the message says "the project may be paused" when the failure is a network error), unexpected answer (wrong status or shape). Result element `data-testid="env-check-result"`. Uses `src/components/ui/` (`Banner`). |
| `src/app/dev/supabase/env-check.test.tsx` | frontend-dev | jsdom, mocked `fetch`: every state, including "not configured" with an empty URL. |
| `src/lib/db-scripts.test.ts`, `src/lib/secrets-script.test.ts`, `src/lib/smoke-env.test.ts`, `src/lib/build-env.test.ts`, `src/lib/supabase-files.test.ts` | owners as above | Section 12. Commands run in throwaway folders and throwaway git repos, as `i18n-check.test.ts` does. |
| `e2e/supabase-env.spec.ts` | test-engineer | Section 12. |
| `docs/ENVIRONMENTS.md` | backend-dev | Section 13, step 9. |

**Change (F4a)**

| File | Owner | Change |
| --- | --- | --- |
| `package.json`, `pnpm-lock.yaml` | backend-dev | `supabase` 2.118.0 exact, dev. Scripts: `check:db`, `check:secrets`, `smoke:env`, `db:start`, `db:stop`, `db:reset`, `db:test`. `db:start` = `supabase start -x studio,imgproxy,mailpit,logflare,vector,realtime,storage-api,edge-runtime,postgrest,postgres-meta,supavisor` (**unverified** combination, section 9). `build` is **unchanged** in F4a. |
| `.github/workflows/ci.yml` | backend-dev (db job) and frontend-dev (check job lines) | Section 9. |
| `.gitignore` | backend-dev | Add `supabase/.env*` and `supabase/functions/.env*` for clarity. The existing `.env` and `.env.*` lines (no slash, so they match in every folder) already cover them; the unit test uses `git check-ignore` to prove it. |
| `.env.example` | backend-dev | Keep the Supabase public pair and the PostHog and Sentry lines. Add a block headed "Command line only. Never in Vercel. Never in a file on this machine" naming `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET`, all empty. No `NEXT_PUBLIC_` name contains `SERVICE`, `SECRET` or `PASSWORD`. |
| `tsconfig.json` | frontend-dev | `"allowImportingTsExtensions": true` (valid because `noEmit` is set) and `exclude` gains `supabase/functions/**/index.ts` (it uses the `Deno` global; `handler.ts` stays type-checked). |
| `vitest.config.mts` | frontend-dev | `include` gains `supabase/functions/**/*.test.ts`. |
| `src/app/dev/...` CI sentinels in `ci.yml` | frontend-dev | Section 9. |
| `supabase/CLAUDE.md` | backend-dev | Layout line says "SQL migrations named by the CLI (`<timestamp>_name.sql`)"; Running section matches `docs/ENVIRONMENTS.md`; two lines on the RLS helper; rule "explicit `grant` to `authenticated` in every table migration; never to `anon`"; rule "never run `supabase config push`, `db push --include-seed`, or `supabase link` on production". **Blocked on the founder's direct confirmation** (section 17). |

**Create or change (F4b)**

| File | Owner | Change |
| --- | --- | --- |
| `supabase/environments.json` | release-manager | Fill both refs (public). |
| `package.json` | frontend-dev | `"build": "node scripts/check-build-env.mjs && next build"`. |
| `playwright.config.ts` | test-engineer | When `VERCEL_AUTOMATION_BYPASS_SECRET` is set, add it as the `x-vercel-protection-bypass` header (Vercel's documented header). Nothing changes when it is not set. |
| `docs/ENVIRONMENTS.md` | release-manager | Record the real outputs and the mechanism test result (section 10). |
| `docs/releases/2026-10-<day>-F4.md` | release-manager | Per the release-manager file. |

### 6. Data

**One migration, `<timestamp>_f4_baseline.sql`.** No table. Intent:
1. `create extension if not exists pgcrypto with schema extensions;` for the random tokens (`gen_random_bytes`) that R1-2 needs. Already present on hosted projects, so it is a no-op there and real locally.
2. Second line of defence behind RLS: `alter default privileges for role postgres in schema public revoke all on tables from anon;` and the same for sequences. After this, a table a later migration creates in `public` is not readable by `anon` even if its author forgets RLS; reads by `anon` can only happen where a migration grants them explicitly (there should be none: public pages go through Edge Functions). `authenticated` keeps the default, so RLS is still the control for tutors. The reason to do it in a migration and not with `auto_expose_new_tables = false` in `config.toml`: the migration travels to staging and production, the setting is local only (and may not exist on the hosted side: **unverified**).
3. `pg_cron` is **not** enabled here. R1-5 owns it. F4 does not take the risk that hosted permissions make the first push fail; if the dashboard needs it switched on by hand, R1-5 tells the founder then. (The spec allowed it; it did not require it.)

`seed.sql` stays a comment. No Storage policy, no auth hook, no cron job.

**RLS harness (criteria 9, 10, 11, 13).**
- `supabase/tests/000_helpers.sql` is a normal TAP file (`select plan(n)` ... `select * from finish()`) that is **not** wrapped in a transaction, so what it creates stays for the files that run after it. It creates schema `tests` with: `tests.tutor_a()` and `tests.tutor_b()` (fixed UUIDs, so no `auth.users` rows and no gotrue are needed); `tests.act_as(uuid)` (`set local role authenticated` and `set_config('request.jwt.claims', '{"sub": "...", "role": "authenticated"}', true)`, which is what `auth.uid()` reads); `tests.act_as_anon()` (role `anon`, claims `{"role":"anon"}`); `tests.reset()` (`reset role` and clear the claim). All `create or replace`, so a second `supabase test db` run passes (criterion 13). It is test-environment only: it lives in a schema that no migration creates, and `supabase db reset` removes it.
- Order: files run in name order (`000_` first). **Unverified** that the CLI's `pg_prove` sorts them; every later file starts with `select tests.assert_ready()` (one line in the helper file) so a wrong order fails with a clear message, not a confusing one. Fallback if the order is not guaranteed: put the five `pg_temp` functions at the top of each test file (duplication; criterion 10 then needs a note), decided by `backend-dev` after the first CI run.
- `010_rls_probe.sql`: `begin;` create `public.rls_probe(id, tutor_id uuid not null, note)`, enable RLS, four `tutor_id = auth.uid()` policies, `grant select, insert, update, delete ... to authenticated, anon` (so a zero result for `anon` proves RLS, not a missing grant); insert one row for A as `postgres`; assert A reads it; B reads zero; B's `insert` with A's `tutor_id` fails (`throws_ok` with `42501`); B's update and delete change zero rows (counted through `with u as (update ... returning 1) select count(*) from u`); `anon` reads zero; `tests.reset()`; `rollback;`.
- `020_public_tables_have_rls.sql`: asserts the set of `public` tables with `rowsecurity = false` is empty (`is_empty`). Its header comment says "do not delete or loosen; R1-2 relies on it".
- `030_default_privileges.sql`: inside a transaction create a table as `postgres`, assert `has_table_privilege('anon', ..., 'select')` is false, roll back.
- Criterion 12 (the test can fail): `backend-dev` pushes one commit with the probe's policy broken, shows the red CI run in the PR description, then the fix. Done in CI, because there is no local stack.

**Auth settings (criteria 48, 49).** `config.toml` as in section 5. A unit test (`supabase-files.test.ts`) reads the file with a small section-aware line reader (no TOML library) and asserts: `enable_anonymous_sign_ins = false`, `[auth.sms] enable_signup = false`, no `[auth.sms.<provider>] enabled = true`, `[auth.external.google] enabled = false`, `[auth.email] enable_signup = true`. The hosted projects are set by the founder in the dashboard (checklist) and read back with the `smoke:env`-adjacent manual look in F4b. **`supabase config push` is forbidden** in the workflow: it would overwrite the hosted auth settings with local values (site URL `127.0.0.1`).

**Edge Function `health`.**
- Behaviour of `handle(req, appEnv)`: `GET` and `appEnv` in `local | staging | production` gives 200, `Content-Type: application/json`, body exactly `{"ok":true,"env":"<appEnv>"}`, `Cache-Control: no-store`, `Access-Control-Allow-Origin: *`. `OPTIONS` gives 204, no body, `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Methods: GET, OPTIONS`, `Access-Control-Allow-Headers: apikey, authorization, content-type`. Any other method gives 405 with `Allow: GET, OPTIONS` and body `{"ok":false}`. `appEnv` unset or not one of the three values gives 500 and `{"ok":false}`: a project that has no `APP_ENV` must fail the smoke check, never answer "local". No version, no commit, no project id, no timestamp, no database call, no `SUPABASE_*` variable read.
- `verify_jwt = false` in `config.toml`: the function is public by design and returns one word. With the new publishable keys the gateway's JWT check would reject the call. **Unverified** on the hosted gateway; the first staging deploy in F4b settles it. If the gateway insists on a key, `smoke:env` and the page add the `apikey` header (the preflight is already answered), a two-line change.
- Deploy without Docker: `supabase functions deploy health --use-api --project-ref <ref>` (server-side bundling). **Unverified**; the CLI's default bundles with Docker, which this machine lacks.
- Secret: `supabase secrets set APP_ENV=staging --project-ref <staging ref>`; `production` likewise. Local: `APP_ENV = "local"` in `config.toml`.

**RLS isolation test for new tables:** F4 adds no product table. The probe is the only table and it is rolled back.

### 7. Keys, environment variables and the build guard

**Where the values are read (the whole list).**
- `src/lib/supabase-env.ts`: `NEXT_PUBLIC_SUPABASE_URL`, only. Imported only by the dev page in F4, so no other route's chunks change.
- `scripts/check-build-env-lib.mjs`: both public values, at build time, in Node.
- `scripts/smoke-env-lib.mjs`: the URL comes from `supabase/environments.json` for a named environment, or `--url`; the anon key is optional (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and, when present, is only checked for shape.

**The exact build-guard rule** (`check-build-env-lib.mjs`, a pure function of an environment object; the command wraps it).
1. **Active only when `VERCEL === "1"` and `VERCEL_ENV` is `preview` or `production`.** Anything else prints one line, "build guard skipped: not a Vercel build", and exits 0. The CI step `VERCEL_ENV=production pnpm build` has `VERCEL_ENV` but not `VERCEL`, so it is skipped and CI is not broken. A normal CI build and a local build also skip.
2. When active, it fails (exit 1, message names the variable and the rule, never prints the value) if any of these is true:
   - `NEXT_PUBLIC_SUPABASE_URL` is missing, is not `https://`, is `localhost` or `127.0.0.1`, or its host is not `<ref>.supabase.co`.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing; or starts with `sb_secret_`; or is a JWT whose payload `role` is not `anon`; or is neither a JWT nor an `sb_publishable_` key. A JWT payload that carries a `ref` must equal the URL's `<ref>`.
   - The URL's ref is not the one recorded for this environment in `supabase/environments.json`: `preview` must equal `staging.ref`, `production` must equal `production.ref`. If the recorded ref is `null` the build fails ("record the project ref first"). The two refs must differ. This is what stops a Preview variable holding the production URL, or the reverse.
   - Any variable named `NEXT_PUBLIC_*SERVICE*`, `NEXT_PUBLIC_*SECRET*` or `NEXT_PUBLIC_*PASSWORD*` exists in the build environment.
3. Wired into `package.json` (`"build": "node scripts/check-build-env.mjs && next build"`) in **F4b only**, after the founder has set the variables and the refs are recorded. Before then every Vercel preview would fail, for no benefit, because nothing reads Supabase yet.
4. Vercel runs `pnpm build` by default (**unverified** for this project: the dashboard may hold an override; the founder checks Settings, Build and Development, in the checklist).

**`pnpm smoke:env <local|staging|production>`** (or `--url <url> --expect <env>`):
1. Resolve the URL (named environment through `environments.json`, which is why a typo cannot reach the wrong project). A `null` ref fails with "no project recorded".
2. If an anon key is in the environment, check its shape and `ref` against the URL, locally, no network.
3. `GET <url>/functions/v1/health` with `fetch`, 8 s timeout, no headers. Exit non-zero unless: status 200, `content-type` JSON, parsed body has exactly the keys `ok` (true) and `env`, and `env` equals the expected name. On a network error or 5xx the message says "project may be paused or the function is not deployed".
4. Prints the environment name and nothing else. It never prints a key.
Plain `fetch`, no `@supabase/supabase-js` (founder-approved recommendation 9).

**The dev page and the production build.** `src/app/dev/supabase/page.dev.tsx` uses the same `.dev.tsx` page-extension trick as `/dev/components` (`next.config.ts` drops `dev.tsx` when `VERCEL_ENV === "production"`), so there is no route in a production build, and `env-check.tsx` is imported only by that page, so its code is not in any chunk either. It sits under the existing `src/app/dev/layout.dev.tsx` root layout; no fourth root layout and no change to `(jump)` or `[locale]`. In CI the normal build gets `NEXT_PUBLIC_SUPABASE_URL=https://cicicicicicicicicici.supabase.co` (fake, 20 letters; the e2e test intercepts it), and the production-build step gets none, which is the real "no values" case.

### 8. `pnpm check:secrets`

Name: `check:secrets` (the language check keeps `check:leak`). Command: `node scripts/check-secrets.mjs`; rules in `check-secrets-lib.mjs`; it prints `path:line  rule  explanation`, never the matched text. Files scanned: everything in `out/` plus `git ls-files --cached --others --exclude-standard` (tracked and not-yet-committed, so a pasted key is caught before it is committed), minus binary files (a NUL byte in the first 8 KB), `node_modules`, `.git`.

| Rule | Looks for | Where |
| --- | --- | --- |
| S1 | the words `service_role` / `service-role` / `SERVICE_ROLE` (any case) | `out/`, `src/`, `public/`, `messages/`, `e2e/`, `.github/`, `supabase/config.toml`, `supabase/seed.sql`, root config files (`package.json`, `vercel.json`, `.env.example`, `*.mjs`). **Not** in `*.md`, `docs/`, `design/`, `.claude/`, `PRD.md` (they discuss the key by name), and **not** in `supabase/functions/` and `supabase/tests/` (a function legitimately reads `SUPABASE_SERVICE_ROLE_KEY`; R1-7 needs it). |
| S2 | `sb_secret_` followed by at least 16 token characters | everywhere scanned. The prefix alone in prose does not match. |
| S3 | a JWT-shaped token (`eyJ...` dot `eyJ...` dot signature) whose decoded payload has `"role":"service_role"` (a token that does not decode is ignored) | everywhere scanned, including docs. Allowed: `"role":"anon"` and the `sb_publishable_` prefix. |
| S4 | a name `NEXT_PUBLIC_<anything>` containing `SERVICE`, `SECRET` or `PASSWORD` | everywhere scanned except `*.md`. (Criterion 28.) |

False positives handled: the anon key and `sb_publishable_` are allowed by S3 and by having no S2 pattern; messages and docs by the scope column; the scanner's own source and tests never contain the literal words (the lib builds the patterns from pieces, e.g. `["service", "role"].join("_")`, and tests write fixtures into temp folders at run time), so there is no fixture exemption list at all. The same rule binds `src/`: no file there may contain the literal (a `src` test uses the same trick).

CI: `pnpm check:secrets` runs after `pnpm check:leak` on the normal build and again in the last step after the `VERCEL_ENV=production` build, so both `out/` trees are scanned. A third run (no `out/`) is not needed.

### 9. CI

**`check` job:** add `pnpm check:secrets` (after `check:leak`) and again after the production build. Add the two new sentinels (below). Set `NEXT_PUBLIC_SUPABASE_URL` on the normal `pnpm build` step only. A unit test fails if `ci.yml` contains `secrets.` (criterion 34).

**New `database` job** (sibling of `check`, so they run side by side, criterion 15):
- `runs-on: ubuntu-latest`, `timeout-minutes: 15`, same `permissions: contents: read`.
- `actions/checkout@v4` with `fetch-depth: 0` (the migration check needs history), then `pnpm/action-setup@v4`, `actions/setup-node@v4` (node 22, pnpm cache), `pnpm install --frozen-lockfile`. No third-party action: the CLI comes from the lockfile (this is why `supabase/setup-cli` is not used).
- `pnpm check:db`. On `pull_request`, base = `origin/${{ github.base_ref }}`; on `push` to `main`, base = `${{ github.event.before }}` (skipped with a printed reason when it is all zeros).
- `pnpm db:start`, `pnpm db:reset`, `pnpm db:test`, `pnpm db:test` (twice: criterion 13), and `pnpm exec supabase stop --no-backup` under `if: always()`.
- The reduced start list keeps Postgres, auth (gotrue) and the gateway, and leaves out studio, storage, realtime, mailpit, imgproxy, postgrest, edge-runtime, logs and pooler, so images are fewer and smaller. **Unverified:** that `supabase start -x ...` with that exact list comes up healthy and that `db reset` works with it. If the first run shows otherwise, fall back to a plain `supabase start` and measure; the 15-minute cap stays. Add storage back when R1-9 needs buckets in tests.
- Image caching is **not** done in F4a (no extra action, no cache key to maintain). The first run's time is recorded in the PR; if it is over 10 minutes, add caching then.
- GitHub-hosted private-repo runner is about 2 CPU and 7 GB RAM (**unverified for this account**); the reduced stack fits.

**Sentinels** (dev-only strings that must be in the normal build and absent from the production one): add the page sentence `Which Supabase does this build talk to?` (in the HTML) and the test id `env-check-result` (only in the client chunk) to both lists in `ci.yml`, as F2 did.

**`check:db` rules** (`check-db-lib.mjs`; the command takes `--base <ref>`, default `origin/main`; if the ref cannot be resolved it fails, it never passes silently):
1. Every file in `supabase/migrations/` matches `^\d{14}_[a-z][a-z0-9_]*\.sql$`; timestamps are unique.
2. Against `git diff --name-status -M <base>...HEAD -- supabase/migrations`: status `A` is allowed; `M`, `D`, `R` (either side) fail. (Three-dot diff needs history, hence `fetch-depth: 0`.)
3. A new file whose timestamp is lower than the highest one on the base fails: "re-stamp it after rebasing" (the spec's two-branches edge case).
4. DDL outside migrations (criterion 17a): in `supabase/functions/**`, `supabase/seed.sql`, `src/**`, a line (comments stripped) matching `\b(create|alter|drop)\s+(table|policy|function|schema|extension|trigger|index|type|view)\b` fails. `supabase/tests/` is exempt (the probe table lives there, rolled back).
The unit test builds a throwaway git repo (`git init`, a base commit, a branch) for each case.

### 10. Production deploy mechanism (Open question 6)

Evidence, from Vercel's documentation read today (the pages were last updated 2026-08 and 2026-09):
- **Verified in the docs:** a deploy hook is a URL, created in Settings, Git, for one branch, that deploys that branch on a GET or POST with no other authentication; 5 hooks per project, 60 triggers an hour. The docs say hooks are **not triggered if the deprecated `github.enabled = false` is in `vercel.json`**. They say nothing about `git.deploymentEnabled.main = false`, which is what we use and which is documented as "branches that should not trigger a deployment upon commits".
- **Verified in the docs:** "Promote to Production" on a **preview** deployment does a **complete rebuild** with the Production-scope variables (the docs say preview variables are not used). So the founder's rule is also how Vercel's own promote behaves.
- **Verified in the docs:** a "staged production build" exists: turn off "Auto-assign Custom Production Domains" (Settings, Environments, Production, Branch Tracking); every build of the production branch is then made with Production variables but not served until someone promotes it, and promotion needs no rebuild.
- **Unverified (cannot be tested from here: no Vercel CLI, no Vercel login, no token):** whether a deploy hook builds `main` while `git.deploymentEnabled.main` is false; whether such a build is a Production-environment build (`VERCEL_ENV=production`, so no `/dev` routes); whether the project's default `*.vercel.app` domain counts as a "custom production domain" for the staged-build toggle.

Decision for `docs/ENVIRONMENTS.md`:
1. **Primary: deploy hook for `main`** (created by the founder, URL kept private, passed to `release-manager` for one release at a time). Release steps: founder says yes; `release-manager` migrates and deploys functions; triggers the hook; confirms in the dashboard (founder) that the new deployment is **Production**, shows the commit SHA, and that `curl -I <prod url>/dev/components/` and `/dev/supabase/` both return 404; runs `pnpm smoke:env production`.
2. **Fallback if the hook does not build `main`: staged production.** Remove `main: false` from `vercel.json` (a founder decision, since criterion 36 says F4 changes nothing else there) and turn off auto-assign. Needs the `.vercel.app` question above answered first.
3. **Ruled out: "Promote to Production" on the branch's preview.** It rebuilds, but a different commit: the squash merge gives `main` a new SHA, so "the same commit" is not what runs.
4. **The test is part of F4b and needs a production deploy.** It is only done if the founder says yes to a first production deploy of the placeholder site (the Production variables must already be set, and the build guard must be wired). If he says no, criterion 38 is met by the documentation, marked "mechanism not yet exercised", and `release-manager` runs the test at the first real release.
5. Rollback for the front end stays as in `release-manager`: Vercel's Instant Rollback to the previous production deployment. It reuses a build that already carries Production variables, so it is safe.

### 11. Bundle

- No runtime dependency, no `@supabase/supabase-js`. `/`, `/en/`, `/hi/`, `/kn/`, `/te/` are untouched: `supabase-env.ts` is imported only by the dev page.
- New route `/dev/supabase/`: the shared Next runtime (about 132 KB gzipped on every route today) plus one small client component, expected within the 132 to 139 KB band of `/dev/components/` (138.7 KB). **Estimate;** `frontend-dev` records the `pnpm size` figure for it and for the five existing routes under this section.
- Production builds have neither the route nor the component.
- Lazy loading: nothing heavy added.

### 12. Tests required

| Criteria | Proved by |
| --- | --- |
| 1 | unit `supabase-files.test.ts`: `config.toml`, `migrations/` (one file), `functions/health/`, `seed.sql`, `tests/` exist |
| 2 | Documented command is `pnpm db:start`; proved by CI's database job; local run only if Docker is fixed (section 14). **Cannot be demonstrated on this machine today.** |
| 3, 13, 14 | CI `database` job: `db:reset`, `db:test` twice |
| 4, 26 | unit: `seed.sql` has no `insert`/`copy`/phone/email patterns; `config.toml` seed path is local; no script or doc contains `--include-seed` |
| 5 | CI: lint, typecheck, test, build, size, check:leak unchanged and green; `pnpm size` figures recorded |
| 6 | **Verified** above (ports free); documented |
| 7 | review by `lead-reviewer` against the PR statement |
| 8, 16, 17a | unit `db-scripts.test.ts` on throwaway git repos: bad name; duplicate timestamp; `M`, `D`, `R` fail; `A` passes; older timestamp fails; DDL in `src/`, `functions/`, `seed.sql` fails, in `tests/` and `migrations/` passes; unresolvable base fails |
| 9, 10, 11 | pgTAP `010`, `020`, plus unit test that `supabase/CLAUDE.md` mentions the helper and the file exists |
| 12 | red CI run shown in the PR |
| 15 | CI: two jobs, no `needs:` between them (unit test reads `ci.yml`) |
| 17b | manual, `release-manager` |
| 18 to 22, 24, 25, 33, 35, 37 to 40, 46, 47 | manual in F4b (section 13), outputs pasted in the PR |
| 23 | unit: `docs/ENVIRONMENTS.md` exists and `supabase/CLAUDE.md` links it |
| 27 | doc review |
| 28, 29 | unit `supabase-files.test.ts`: `.env.example` placeholders only and no forbidden `NEXT_PUBLIC_` name; `git check-ignore` for `.env`, `supabase/.env.local`, `.env.production`; `.env.example` not ignored |
| 30, 31 | unit `secrets-script.test.ts`: one pass and one fail per rule S1 to S4, anon JWT and `sb_publishable_` pass, output never contains the secret, scope exemptions; CI lines |
| 32 | unit `build-env.test.ts`: every branch of section 7 (not Vercel, preview ok, production ok, missing URL, `http`, localhost, secret key, service JWT, wrong ref, null ref, equal refs, `NEXT_PUBLIC_*SECRET*` present); plus a test that runs `VERCEL_ENV=production` **without** `VERCEL` and expects exit 0 |
| 34 | unit: `ci.yml` has no `secrets.` |
| 36 | unit: `vercel.json` unchanged (exact content) |
| 41, 42 | unit `handler.test.ts`: exact body bytes, 405s, 204 for `OPTIONS`, 500 for unset or bad env, no extra headers, code review for "no database, no service key" (plus a test that `handler.ts` and `index.ts` do not mention `SUPABASE_` or the service-role word) |
| 43 | unit `smoke-env.test.ts` with a fake `fetch`: pass; 404; 500; wrong env; extra key; missing key; timeout; unknown environment; null ref; key with wrong ref |
| 44 | unit `env-check.test.tsx` (all states) and e2e `supabase-env.spec.ts` at 360 px: Playwright intercepts the fake project host, answers `{"ok":true,"env":"staging"}`, asserts the word "staging" in `env-check-result`; `route.abort()` gives the "cannot reach" text; a 200 with a wrong body gives "unexpected answer"; no sideways scroll; text at least 14 px |
| 45 | CI sentinels (section 9) |
| 48 | unit `supabase-files.test.ts` (config); manual read-back of the two dashboards in F4b |
| 49 | PR review: config has no Google client id or secret, no site URL change |
`test-engineer` also reviews every test above for one that cannot fail (the scanner and the guard are the likeliest).

### 13. Build order

Each step ends with `pnpm lint`, `typecheck`, `test`, `build`, `size`, `check:leak` and `test:e2e` green (the `database` job is checked in CI on the push).

**F4a (no keys)**
1. **backend-dev:** `pnpm add -D --save-exact supabase@2.118.0`; confirm `pnpm exec supabase --version`, that `pnpm install --frozen-lockfile` prints no "Ignored build scripts" warning, and that `pnpm-workspace.yaml` is unchanged; `supabase init` then the config edits; `seed.sql`, `.gitignore`, `.env.example`; the `db:*` scripts; `supabase-files.test.ts`. (1, 4, 5, 26, 28, 29, 36, 48.)
2. **backend-dev:** `check-db` script, lib and its throwaway-repo tests. Not yet in CI. (8, 16, 17a.)
3. **frontend-dev:** `check-secrets` script, lib, tests; CI lines in `check`. (30, 31, 34.)
4. **backend-dev:** the migration, the three pgTAP files, and the CI `database` job with `check:db`, together, because the job has nothing to run without them. Push, read the log, repeat. Then the broken-policy commit and the fix (12). Record the job time. (3, 7, 9 to 11, 13 to 15.)
5. **backend-dev:** `health` handler, tests, `index.ts`, `config.toml` entries, `tsconfig` and `vitest` edits (with `frontend-dev`), `smoke-env` script, lib and tests, `environments.json`. (41 to 43.)
6. **frontend-dev:** `supabase-env.ts`, the dev page and component, unit test, CI sentinels and fake URL on the normal build; `test-engineer` writes `e2e/supabase-env.spec.ts`. `pnpm size` figures recorded. (44, 45.)
7. **frontend-dev:** `check-build-env` lib, command and tests; **not** wired. (32, unit part.)
8. **backend-dev:** `docs/ENVIRONMENTS.md`, `supabase/CLAUDE.md` edits (once the founder has confirmed section 17). (23, 25, 27, 38 to 40, 47 as text.)
9. `test-engineer` gap review; `code-reviewer`; `lead-reviewer`. **F4a merges.**

**F4b (needs the founder)**
10. **Founder:** checklist, section 14. Tells agents "keys are in place" and the two project URLs (public).
11. **release-manager:** `supabase login` check (`pnpm exec supabase projects list`); fill the two refs in `environments.json`; open the F4b branch.
12. **release-manager:** `pnpm exec supabase link --project-ref <staging>` (this machine links **staging only**); `supabase db push --dry-run`, then `db push`; `functions deploy health --use-api`; `secrets set APP_ENV=staging`; `migration list` output saved. (18, 20, 33.)
13. **backend-dev or release-manager:** `pnpm smoke:env staging` green. If the gateway needs a key header, the two-line fix (section 6). (43.)
14. **frontend-dev:** wire the build guard into `build`; push; the preview must build and `/dev/supabase/` must say "staging" (browser or Playwright with the bypass header). Also prove the guard fails when it should, by running the lib with the production URL in a Preview-style environment object (unit, already) and by one deliberate bad-variable preview if the founder agrees. (32, 37, 46.)
15. **preprod-qa:** first environment check with `pnpm smoke:env staging`; compare `migration list`. (20, 47.)
16. **With the founder's yes only:** production migration, function, `APP_ENV=production`, then the deploy-hook test (section 10). The founder runs the production commands himself in his own terminal (the CLI prompts for the database password; it is never stored). Outputs pasted into the PR. (21, 22, 24, 38.)
17. Release note; `lead-reviewer` merges F4b.

### 14. Founder checklist and timing

Nothing in F4a needs a login, a key or a dashboard. Agents may do **no** remote step until the founder says "keys are in place" (step 10).

**Optional, any time, makes F4a faster (not required):**
- A. Docker is not usable on this account today (section 3). To run `supabase start` and `test db` on this machine: free at least 15 GB of disk (2.2 GB free now), update Docker Desktop (4.20.1 installed), start it once as `nithin` (it fixes the `/var/run/docker.sock` link and may ask for the administrator password), and tell the agents. If you do not, CI runs the database tests and each try takes about 8 to 10 minutes.

**Before F4b (the spec's checklist, corrected):**
1. supabase.com: sign in, create an organisation, choose the plan (free for now; Open question 5 stands).
2. New project `feedost-staging`, region **South Asia (Mumbai) `ap-south-1`**, Postgres version **17**, a generated database password saved in your password manager. If the form offers to expose new tables to the API automatically, turn that off. Not in chat, not in a file in the repo.
3. New project `feedost-production`, same region and version, a different password.
4. In each: Project Settings, API. Copy the **Project URL** and the **anon / publishable** key. Never copy the `service_role` / secret key anywhere. The URLs may be told to the agents in chat (they are public); the keys go only into Vercel.
5. In your own terminal in this repo run `pnpm exec supabase login` (opens the browser; the CLI keeps the token in your macOS keychain, not in a file or in chat). This replaces "export the token for the session": agents' shells cannot see variables you export in your terminal. The first agent use may show a keychain prompt; choose "Always allow" only if you accept that the token reaches both projects (Open question 13, accepted). **Unverified** that an agent's shell can read the keychain.
6. In each project: Authentication, Sign In / Providers: Email on, Phone off, Anonymous sign-ins off, Google off. Do not create Google credentials.
7. Vercel, the project, Settings, Environment Variables: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` **twice**: Preview only = staging values; Production only = production values; Development unticked. Add nothing else.
8. Vercel, Settings, Build and Development: check there is no Build Command override (the build must be `pnpm build`).
9. Vercel, Settings, Deployment Protection: keep Vercel Authentication on; create a "Protection Bypass for Automation" secret (available on all plans, documented). Keep it in your password manager; it is given to `preprod-qa` and `release-manager` for a test session only, as the shell variable `VERCEL_AUTOMATION_BYPASS_SECRET`.
10. Say "keys are in place" and give the two project URLs.
**At release time, with your yes:** run the production migration and function commands the agent prepares, in your own terminal; create the Vercel deploy hook for `main` (Settings, Git, Deploy Hooks) only when you say yes to the first production deploy, and keep its URL private.
**Never:** use the Supabase SQL editor to change structure; run `supabase config push`.

### 15. Risks and traps

1. **No local Docker.** pgTAP can only run in CI for now. Mitigation: small SQL steps, a 15-minute cap, the optional Docker fix in section 14. The harness is the likeliest thing to need two or three pushes.
2. **`-x` list and test order are unverified.** Both have fallbacks in section 6 and 9.
3. **A guard that breaks CI or every preview.** Both of the spec's worries are met: the guard keys on `VERCEL=1` (CI never sets it), and it is not wired until the variables exist (F4b).
4. **The wrong environment on a preview.** The `environments.json` ref check makes "staging value in Production scope" and the reverse a failed build, which a dashboard typo would otherwise hide.
5. **Scanner flags its own tests or the docs.** No literals in code (built from pieces); word rule scoped away from prose; S2 needs a body after the prefix.
6. **Scanner misses a key.** It reads `out/` and untracked files too; S3 decodes, so renaming a service JWT does not hide it. It cannot see a secret typed into Vercel; the guard (name rule and role rule) covers that.
7. **Edge Function wiring is untested until staging.** `index.ts` is five lines, and the logic is tested in Node. The gateway's key handling and the `APP_ENV` secret are the unverified parts; step 13 settles both.
8. **Free-plan pause.** A paused staging gives "cannot reach" and `smoke:env` says "project may be paused"; the checklist tells the founder to restore it from the dashboard.
9. **`supabase link` pointing at production by accident.** This machine links staging only; production commands are run by the founder with `--db-url`/prompt, so a forgotten link cannot hit production. `config push`, `--include-seed` and `link` to production are written down as forbidden.
10. **A migration author edits an applied migration.** `check:db` fails the PR; `lead-reviewer`'s rule stays.
11. **Default-privilege revoke surprises R1-2.** A new table needs an explicit `grant ... to authenticated`. Written in `supabase/CLAUDE.md` and pinned by test `030`.
12. **Tool version drift.** Exact version, lockfile, monthly review; the install has no scripts to run.
13. **`tsconfig` change.** `allowImportingTsExtensions` is only legal with `noEmit` (set today). If `next build` rewrites `tsconfig.json`, `frontend-dev` checks `git diff` after the first build.

### 16. Where I differ from the spec

1. **Criteria 2, 3, 13, 14:** cannot be shown on this machine today; CI is the proof until Docker is fixed.
2. **Criterion 5:** the CLI's version is fixed (2.118.0); `pnpm-workspace.yaml` needs no change.
3. **Criterion 7:** the migration also revokes default `anon` privileges (the hand-off asked me to decide; the criterion said "may only enable extensions"). `pg_cron` is left to R1-5; `pgcrypto` is the only extension.
4. **Criterion 17(a):** `supabase/tests/` is exempt from the DDL scan.
5. **Criterion 16:** also rejects a new migration older than the newest on the base.
6. **Criterion 30:** word rule is scoped (not docs, not `supabase/functions` or `supabase/tests`); untracked files are scanned; S4 added to cover criterion 28's name rule in code, not only in `.env.example`.
7. **Criterion 32:** the guard also checks the project ref against `supabase/environments.json` and accepts `sb_publishable_` keys; it is switched on in F4b, not F4a; it keys on `VERCEL=1` and `VERCEL_ENV`.
8. **Criterion 41:** `OPTIONS` answers 204 (edited in the criterion); unset or invalid `APP_ENV` answers 500.
9. **Criterion 43:** the script gets the URL from `environments.json` by environment name, does not send the anon key, and only checks its shape; the key is not needed for `health`.
10. **Criteria 21, 22 and the founder checklist step 5:** `supabase login` replaces exporting a token, and the production commands are run by the founder in his terminal (the password is prompted), because an agent's shell cannot receive what he types.
11. **Criterion 38:** the mechanism is a deploy hook, **not yet verified** against `main:false`; the fallback is a staged production build. Reported in section 10.
12. **Criterion 45:** CI's normal build sets a fake `NEXT_PUBLIC_SUPABASE_URL` so the e2e test can exercise the page; the production step sets none.
13. **Criterion 1:** `functions/` and `tests/` hold real files, so no `.gitkeep` is needed.
14. **Edge case "CI cold start":** no image caching in F4a; measured, then decided.
15. **Spec edits I made:** the new "Decided by the founder" block, and the wording of criteria 5, 18, 41 and the note above criterion 41. Nothing was renumbered or removed.
16. **Open question 3 is decided:** timestamps. The two examples that show `0004_payments.sql` (`supabase/CLAUDE.md` layout is "numbered", `lead-reviewer.md` example) and `backend-dev.md` ("numbered migration") need fixing; see section 17.

### 17. Documents that must change, and who may change them

The founder's release-rule decision (production is a fresh build of the same commit with Production variables) and the migration-name decision change instructions that live in the agents' own configuration and in `CLAUDE.md` files. I was told the founder decided this in chat, but the instruction reached me through another agent, not from the founder in this conversation, so **I have not edited any `CLAUDE.md` or any file in `.claude/agents/`.** The exact edits are below. They are applied by whoever receives the founder's own confirmation (one line from him is enough). `docs/BUILD_PLAN.md` is a project document and its edit is also listed here for the same hand-off.

| File | Old text | New text |
| --- | --- | --- |
| `.claude/agents/release-manager.md`, step 5 | `5. **Promote.** Promote the same build that was tested on staging to Vercel production. Do not rebuild.` | `5. **Build for production.** Production is a fresh build of the same commit that was tested on staging, made with the Production-scope variables (the Supabase URL and key are baked in at build time, so a preview build cannot be reused). Use the mechanism in docs/ENVIRONMENTS.md. Confirm the deployment is Production, record the commit SHA in the release note, and check that /dev/components/ and /dev/supabase/ answer 404.` |
| `.claude/agents/release-manager.md`, step 2 | `Confirm a recent production database backup exists, or take one.` | `Take a database dump with the CLI and store it outside the repo (the free plan has no automatic backups). Never commit it.` |
| `.claude/agents/release-manager.md`, step 6 | first bullet | add `run pnpm smoke:env production and expect "production"` as the first bullet; and in Deploy to staging add `pnpm smoke:env staging` after step 3. |
| `.claude/agents/release-manager.md`, Rollback | "roll the front end back to the previous Vercel deployment first" | unchanged (Instant Rollback reuses a build that already has Production variables). |
| `docs/BUILD_PLAN.md` section 4, Gate C | `applies the migration, promotes the build, runs the smoke test` | `applies the migration, builds the same commit for production with the Production variables, runs the smoke test` |
| `CLAUDE.md` line 32 and `.claude/agents/lead-reviewer.md` line 73 | `promoting a build to production` | `releasing to production` |
| `supabase/CLAUDE.md` Layout | `numbered SQL migrations, the only way the schema changes` | `SQL migrations named <timestamp>_name.sql by "supabase migration new", the only way the schema changes` |
| `.claude/agents/lead-reviewer.md` line 64 | `supabase/migrations/0004_payments.sql:31` | `supabase/migrations/20261015093000_payments.sql:31` |
| `.claude/agents/backend-dev.md` line 16 | `Write a new numbered migration in supabase/migrations/.` | `Create a migration with "pnpm exec supabase migration new <name>" in supabase/migrations/.` |
| `.claude/agents/preprod-qa.md` | (not read in detail) | `release-manager` and `preprod-qa` run `pnpm smoke:env staging` first. |
| `docs/specs/F2-design-system.md` risk row on "promote" | already says production is its own build | no change. |

### 18. Not doing

- `@supabase/supabase-js`, any client wrapper, any sign-in code (R1-1).
- `pg_cron`, any table, grant for `authenticated`, storage bucket, auth hook (R1-2 onwards).
- Site URL, redirect list, email sender, Google credentials.
- A `/p`, `/r` or `/join` rewrite.
- Playwright against the preview inside CI (Open question 11).
- Docker image caching in CI, a matrix of Postgres versions.
- A separate Supabase account per environment (Open question 13, accepted).
- Reading the hosted auth settings by API in `smoke:env` (the dashboard read-back is enough).
- Any change to `next.config.ts` or the three root layouts.
- Moving the project to a paid plan (Open question 5: before R0-4).

### 19. Start

`backend-dev` starts with **step 1** of section 13 (add `supabase@2.118.0`, `supabase init`, the `config.toml` edits, `.gitignore`, `.env.example`, the `db:*` scripts and `supabase-files.test.ts`). `frontend-dev` can start step 3 (`check:secrets`) in parallel, since the two touch different files; they meet at `ci.yml` and `package.json`, so `backend-dev` lands step 1 first. The founder is asked for nothing before F4a merges, except the optional Docker fix and the one-line confirmation for the document edits in section 17.
