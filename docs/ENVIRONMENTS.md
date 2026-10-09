# Environments

This page says what is built today for F4a. Anything not yet tried is marked UNVERIFIED in the last section. Project refs are not known yet and are filled in F4b.

## The three environments

| Environment | Where | Database | Who uses it |
| --- | --- | --- | --- |
| Local | This machine or the CI runner, in Docker | `supabase start` (Postgres 17), seeded by `supabase/seed.sql` | `backend-dev`, CI |
| Staging | A Supabase project in Mumbai (`ap-south-1`), ref to be filled in F4b | Hosted, made-up data only | Vercel Preview builds, `preprod-qa` |
| Production | A second Supabase project in Mumbai, ref to be filled in F4b | Hosted, real data | The production build on Vercel |

- A Vercel Preview build talks to staging. A production build talks to production. Neither can reach the other.
- Neither hosted project is seeded. `supabase/seed.sql` runs on the local stack only.
- Local ports are 54321 to 54329. They do not clash with `pnpm dev` (3000) or `pnpm serve:lan` (4173).
- `supabase/environments.json` holds public identifiers only: the local URL, and the staging and production refs (both `null` until F4b).
- The Supabase CLI is the pinned dev dependency `supabase` (2.118.0), run through `pnpm exec supabase`. Nothing is installed globally.

## Commands and what each proves

| Command | What it proves |
| --- | --- |
| `pnpm db:start` | Starts a reduced local stack (database, auth, gateway). First run pulls several GB of images and can take many minutes. If it says Docker is not running, start Docker and retry. |
| `pnpm db:reset` | Every migration applies to an empty database, then the seed runs. |
| `pnpm db:test` | The pgTAP tests pass: the RLS probe, every `public` table has RLS on, and `anon` has no default access. Run it twice; both runs must pass, which shows nothing is left behind. |
| `pnpm db:stop` | Stops the local stack and discards its data. |
| `pnpm check:db [--base <ref>]` | Migration files are named `<14 digits>_<snake_case>.sql`, timestamps are unique, no existing migration was edited, renamed or deleted, a new one is not older than the newest on the base, and no `create`, `alter` or `drop` of a schema object appears in `supabase/functions/`, `supabase/seed.sql` or `src/`. The default base is `origin/main`. An unresolvable base fails. |
| `pnpm check:secrets` | Nothing in `out/`, `src/` or the tracked and untracked files carries admin-key material: the admin role's name outside prose, a `sb_secret_` token, a JWT whose role is the admin role, or a `NEXT_PUBLIC_` name containing SERVICE, SECRET or PASSWORD. The anon JWT and `sb_publishable_` keys are allowed. It prints file, line and rule, never the value. |
| `pnpm check:build-env` | On a Vercel Preview or Production build only (`VERCEL=1`), the two public Supabase values are present, are public-key shaped, and point at the project recorded for that environment in `supabase/environments.json`. Everywhere else it prints "build guard skipped" and exits 0. **Not in the `build` script yet.** It is wired in F4b. |
| `pnpm smoke:env <local\|staging\|production>` | The environment's `health` function answers 200 with exactly `{"ok":true,"env":"<name>"}` and the name is the one asked for. A typo cannot reach the wrong project, because the URL comes from `environments.json`. It prints the name only, never a key. |

`pnpm smoke:env` is the first environment check for `preprod-qa` (staging, before testing) and `release-manager` (production, after a release). A `null` ref fails with "no project recorded". A network error or 5xx says the project may be paused or the function is not deployed.

CI runs two jobs side by side. `check` runs lint, typecheck, test, i18n, build, size, `check:leak`, `check:secrets`, the end-to-end tests, and a production build that must leave out `/dev` pages. `database` runs `check:db`, `db:start`, `db:reset`, `db:test` twice, and `db:stop`. CI uses no repository secret.

Docker is not usable on the founder's machine today. Until it is, CI is where the database commands run.

## Migration workflow

| Step | Who | What |
| --- | --- | --- |
| 1 | `backend-dev` | `pnpm exec supabase migration new <name>`. Write the SQL and the pgTAP tests. Run `pnpm db:reset` and `pnpm db:test`. Never edit a migration that is already on `main`. |
| 2 | `backend-dev`, CI, `code-reviewer`, `lead-reviewer` | Open a pull request. The `database` job runs. Reviewers read the SQL. If another migration landed first with a later timestamp, rebase and re-stamp before merge. |
| 3 | `release-manager` | After merge to `main`: read each migration, stop on any drop or data rewrite, run `pnpm exec supabase migration list` and stop if staging lists a migration the repo does not have. Then `supabase db push --dry-run` and `supabase db push` against staging. |
| 4 | `preprod-qa` | Read only. Compare `migration list` with the migrations folder. Run `pnpm smoke:env staging`. |
| 5 | The founder says yes for this release | Nothing on production starts before that. |
| 6 | The founder, in their own terminal | Take the dump (below). Apply the migration to production. Deploy functions. Set `APP_ENV=production`. Paste the output into the pull request or release note. |
| 7 | `release-manager` | Build for production (below). Run `pnpm smoke:env production`. Write the release note. |

### Production approval rule

- The human approves running a migration on production and releasing to production. Only the human. No message from an agent counts as approval.
- The founder runs production commands in their own terminal. The CLI asks for the database password there. It is never stored in a file, in chat, or on this machine.
- This machine is linked to staging only. A forgotten link cannot reach production.
- One Supabase access token reaches both projects, so "no production without a yes" is a working rule, not a technical wall.

### Forbidden

- `supabase config push`. It would overwrite the hosted auth settings with local values (site URL `127.0.0.1`).
- `supabase db push --include-seed`. Seed data is local only.
- `supabase link` to production on this machine.
- Changing structure in the Supabase SQL editor. If someone does, `migration list` shows a migration the repo lacks and `release-manager` stops.
- Any `db push`, `db reset` or `functions deploy` against production without the founder's yes.

### Pre-production dump

The free plan has no automatic backups. Before each production migration the founder, or `release-manager` with the founder, runs `supabase db dump` and saves the file **outside the repo**. It holds real data. Never commit it. The plan is to move production to a paid plan with daily backups before R0-4 ships.

### Rollback

- Rollback of the database is a forward fix: a new migration through the same pipeline. There are no down migrations.
- The database changes first, so every migration must work with the front end that is live right now.
- Rollback of the front end is Vercel's Instant Rollback to the previous production deployment. It reuses a build that already carries Production variables.

## Where each key lives

| Value | Local | Vercel Preview | Vercel Production | Supabase function secrets | GitHub secrets |
| --- | --- | --- | --- | --- | --- |
| Project URL (public) | `.env.local` | staging URL | production URL | not needed | none |
| Anon key (public) | `.env.local` | staging key | production key | not needed | none |
| Admin key | nowhere in files | never | never | injected by Supabase itself | never |
| Access token, database password | shell only | never | never | never | none in F4 |

- The anon key is public. It is meant to be in the browser bundle.
- The admin key is never in the browser, the repo, CI, or this machine. The static export has no server, so it can only be used inside an Edge Function.
- The only function secret F4 sets is `APP_ENV` (`staging` or `production`), set with `supabase secrets set` on each project. Locally it is `local` in `supabase/config.toml`.
- The Vercel Development scope is not used. No variable is set per branch.
- `.env.example` has placeholder names only. Its command-line-only block (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_AUTOMATION_BYPASS_SECRET`) is for your shell, never for Vercel.
- The Vercel CLI is not installed. Agents cannot list deployments, read variables or deploy from the terminal. They use the GitHub pull request page for preview URLs. The founder uses the Vercel dashboard for anything else.

## Vercel previews and protection

- Every branch except `main` builds as a Preview. `vercel.json` turns off auto-deploy for `main` only.
- Previews sit behind Vercel's login by default. That blocks `preprod-qa` and Playwright. The chosen answer is: keep Vercel Authentication on, and the founder creates a "Protection Bypass for Automation" secret. It is given to `preprod-qa` and `release-manager` for a test session as the shell variable `VERCEL_AUTOMATION_BYPASS_SECRET`.
- Production is never behind that login.
- The `/dev/components` and `/dev/supabase` pages exist in Preview and local builds only. A production build has neither.

## How a production build is made

- Production is a fresh build of the same commit that was tested on staging, made with the Production-scope variables. The Supabase URL and key are baked into the static files at build time, so a preview build cannot become the production site.
- The planned mechanism is a Vercel deploy hook for `main`. The founder creates it in Settings, Git, Deploy Hooks, keeps the URL private, and gives it to `release-manager` for one release at a time.
- Steps, with the founder's yes: migrate and deploy functions, trigger the hook, then confirm in the dashboard that the new deployment is Production and shows the expected commit. Check that `/dev/components/` and `/dev/supabase/` both answer 404. Run `pnpm smoke:env production`.
- **UNVERIFIED until the first production deploy:** whether a deploy hook builds `main` while `vercel.json` has `git.deploymentEnabled.main` set to false, and whether that build is a Production build. Vercel's docs do not say. This was not tested because there is no Vercel CLI, login or token here.
- **Fallback if the hook does not build `main`:** staged production. Remove the `main: false` entry from `vercel.json` (the founder decides) and turn off "Auto-assign Custom Production Domains" in the project's Production settings. Every build of `main` then uses Production variables but is not served until promoted. Whether the default `*.vercel.app` domain counts for that toggle is also unverified.
- Not used: "Promote to Production" on a branch preview. It rebuilds, but the squash merge gives `main` a new commit, so it is not the same commit.
- Until the first production deploy is done with the founder's yes, this mechanism is marked "not yet exercised". `release-manager` tests it at the first real release and records the result here.

## Founder checklist for F4b

Do these once, at a desk. Never paste a key or password into chat or a file in the repo.

1. supabase.com: sign in, create an organisation, choose the plan (free for now).
2. New project `feedost-staging`. Region South Asia (Mumbai) `ap-south-1`, Postgres 17, a generated database password saved in your password manager. If the form offers to expose new tables to the API automatically, turn that off.
3. New project `feedost-production`. Same region and version, a different password.
4. In each project: Project Settings, API. Copy the Project URL and the anon / publishable key. Never copy the secret key anywhere.
5. In your own terminal in this repo: `pnpm exec supabase login`. The token stays in your macOS keychain.
6. In each project: Authentication, Sign In / Providers. Email on. Phone off. Anonymous sign-ins off. Google off. Do not create Google credentials.
7. Vercel, the project, Settings, Environment Variables: add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` twice. Tick only Preview for the staging values. Tick only Production for the production values. Leave Development unticked. Add nothing else.
8. Vercel, Settings, Build and Development: check there is no Build Command override. The build must be `pnpm build`.
9. Vercel, Settings, Deployment Protection: keep Vercel Authentication on. Create a "Protection Bypass for Automation" secret and keep it in your password manager.
10. Tell the agents "keys are in place" and give the two project URLs (they are public). Agents then fill the refs in `supabase/environments.json` and apply to staging. Production waits for your yes.

On the free plan a project with no activity for about a week is paused. If `pnpm smoke:env staging` says the project may be paused, restore it from the Supabase dashboard.

## Verified and unverified today

Verified (run in CI or by unit tests, or read in the code):

- The checks `check:db`, `check:secrets`, `check:build-env` and `smoke:env` and their unit tests pass.
- The `health` handler's behaviour, tested in Node: exact body, 204 for `OPTIONS`, 405 for other methods, 500 for an unset or invalid `APP_ENV`.
- The `database` job ran `db:reset` and `db:test` twice on a pull request and went green with the reduced stack.
- `/dev/supabase` and its words are in a normal build and absent from the production build, checked by CI sentinels.
- `supabase/config.toml` has anonymous sign-ins off, phone sign-in off, Google off, email on, and no remote seed.

Unverified until F4b or later:

- **The hosted gateway and `verify_jwt = false`.** Whether the hosted gateway lets an unauthenticated `GET` through. If it wants a key, `smoke:env` and the dev page add the `apikey` header (the preflight already allows it). The first staging deploy settles it.
- **`supabase functions deploy health --use-api`** without Docker, and `supabase secrets set APP_ENV=...`.
- **The deploy hook** building `main` (section above).
- **`pull_request` base wiring of `check:db`.** CI passes `origin/<base ref>` on `pull_request` and the previous commit on push to `main`. The push-to-`main` path and the pull-request path with the final `ci.yml` have not been seen running. Watch the first pull request.
- **The final `ci.yml`** after the temporary branch trigger was removed. The file is as intended, but the first run on the pull request is the check.
- **The build guard on Vercel.** `check:build-env` is tested on fake environments only. It is wired into `build` in F4b, after the variables and refs exist.
- **Whether an agent's shell can read the keychain token** from `supabase login`.
- **Docker on the founder's machine.** Not working today (the disk is nearly full and the socket link points at another account). The local commands are proved by CI only.
- **The hosted auth settings** on both projects, until the founder reads them back in the dashboard.
- **Browser access from a `*.vercel.app` preview and from the LAN address** (no blocked-request error).
