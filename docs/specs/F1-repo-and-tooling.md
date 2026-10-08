# F1 — Repo and tooling

## Goal
A working Next.js project in the repo with every check the pipeline relies on, so later slices only add product code.

## Acceptance criteria
1. Next.js + React + TypeScript + Tailwind project builds as a static export into `out/`.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm size`, `pnpm i18n:check` and `pnpm build` all exist and pass.
3. End-to-end tests run at a 360px-wide touch viewport.
4. `pnpm size` fails when a page loads more than 200 KB of gzipped JavaScript up front.
5. `pnpm i18n:check` fails when a key is missing from any of the four message files.
6. The product name appears in exactly one source file, `src/config/brand.ts`.
7. CI runs all of the above on every pull request.
8. `.env.example` lists variable names only. `design/` is excluded from lint and type-check.

## Out of scope
Design tokens and components (F2), next-intl wiring (F3), Supabase and Vercel projects (F4).

## Technical plan
- Generated with `create-next-app` 16.4 (App Router, `src/`, Tailwind 4, Turbopack), then set `output: "export"`, `trailingSlash: true`, unoptimised images.
- Removed `cacheComponents` and `partialPrefetching` from the generated config: the build fails with "PPR cannot be enabled in export mode".
- Vitest with jsdom for unit tests beside the code; Playwright project `phone` (360×740, touch) served from `out/` by `scripts/serve-out.mjs`, or from a deployed URL when `E2E_BASE_URL` is set.
- `scripts/size.mjs` sums the gzipped size of every script a page's HTML references, ignoring `nomodule` polyfills.

## Finding to carry forward
An empty page already loads about 132 KB of gzipped JavaScript (React and the Next.js runtime). That leaves roughly 68 KB per route for our own code before the PRD's 200 KB limit. Supabase, next-intl, PostHog and Sentry must be added with care: load analytics and error reporting after first paint, and keep the PDF and spreadsheet code out of the first load.

## Test by hand
Nothing user-visible yet: the home page shows only the product name.
