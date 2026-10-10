# R1-1 and R1-2: sign-in, tutor profile, and the data base

Slices R1-1 "Language picker, sign-in, tutor profile, setup steps" and R1-2 "Data model and RLS for tutors, batches, students" (docs/BUILD_PLAN.md section 5), built as one pair.

Process: the lighter one the founder approved on 2026-10-11. This one file is the short spec and the technical plan. There is no separate spec stage and no separate plan stage. Branch `r1-signin-and-data`. Staging only: no production project exists.

Goal: the founder opens the real app on his phone, signs in with Google, sets up a tutor profile, and sees an empty home. The tables that every later slice uses exist, with row-level security.

Tags: [unit] Vitest, [e2e] Playwright at 360px, [db] pgTAP in the `database` CI job, [manual] by hand on a phone.

## 1. Decisions made here (no founder input needed)

1. **Setup is two screens now, not three.** The canvas has three steps: name and subjects, UPI ID, add students. Add students is R1-3 and R1-4. After step 2 the tutor lands on the empty home. The step counter says "Step 1 of 3" and "Step 2 of 3", as drawn. Step 3 is the empty home's "Add students" slot, filled in R1-3. (PRD section 5 says "name/subject/UPI (one screen)"; PRD section 6 and the canvas say three steps. The canvas wins.)
2. **No photo yet.** The PRD profile has an optional photo and canvas step 1 draws "Add your photo". It needs a Storage bucket and a read policy, and it only shows on the pay page (R1-9). It ships with R1-9. No `photo_url` column now.
3. **No email magic link in this slice.** The founder chose Google first. Also, the free-plan built-in email sender only delivers to the project's own team members and sends 2 messages an hour (Supabase docs, auth-smtp). A real sender (Resend) needs a domain we own to verify, and we are on `*.vercel.app`. So the magic link ships when there is a domain. The sign-in canvas draws an email field; it is left out, not shown disabled.
4. **Auth is client-side only.** A static export cannot gate a route on a server. The signed-in guard is a React wrapper. It is a convenience, not security. The real wall is row-level security: a signed-out visitor gets zero rows whatever the page shows.
5. **Session lives in the browser's localStorage.** supabase-js with PKCE. `@supabase/ssr` is not needed: it exists to keep sessions in cookies for server rendering, and there is no server.
6. **The Supabase library is loaded lazily.** Only `src/lib/supabase.ts` imports it, with `await import()`. A first-time visitor on the sign-in page loads none of it until they tap the button (see criterion 12). This keeps every route's initial JS inside budget.
7. **The tutor row is created by a database trigger on `auth.users`**, not by a client call. Reason: the client then needs no insert right on `tutors` at all, so no client can ever make a row, pick an id, or set a plan. It is atomic with sign-up. The cost: a broken trigger blocks all sign-ups, so it is tiny, has `on conflict do nothing`, and has tests.
8. **No soft delete column.** Students use `active` (the PRD's archive flag). Batches are deleted for real; their students keep existing with no batch. Offline sync (R1-12) uses client-generated ids and last write wins, so it needs no tombstones.
9. **Profile saves are direct, online-only calls** through one function in `src/lib/tutor.ts`. This is a recorded exception to `src/CLAUDE.md` "writes go through the outbox": the outbox does not exist until R1-12, and profile setup needs the server anyway. R1-12 swaps this one function. When offline, Save says so; it never pretends to have saved.
10. **No bottom nav yet.** The component needs all four items and Students and Attendance do not exist. Home has a "More" link; More has a "Back to home" link. The nav arrives with R1-3.
11. **No link to the app from the landing page.** The landing is a coming-soon waitlist page. The founder opens `/en/language/` or `/en/sign-in/` directly. Linking it is a launch decision.
12. **E2E tests never touch Google or any real Supabase project.** They build with the made-up address CI already uses (`https://cicicicicicicicicici.supabase.co`) and Playwright answers every request to it. Details in section 9.

## 2. Open questions for the founder

Only two are really his. Both have a recommendation.

1. **Approve the dependency `@supabase/supabase-js`, exact version 2.117.3 (released 2026-10-09).** It is the only new package. Supabase is in the stack in CLAUDE.md, but the client library is not in the BUILD_PLAN dependency table, so it needs your yes. Policy check: released in the last 12 months (yes, two days ago), company behind it (Supabase), more than one npm maintainer (two listed). Open advisories: not checked yet; `frontend-dev` runs `pnpm audit` after install and stops if there is a high one. It is wrapped in one file (`src/lib/supabase.ts`). Alternative: use `@supabase/auth-js` and `@supabase/postgrest-js` separately: two packages instead of one, a little smaller, no other gain. **Recommendation: yes, the single package.** The tutor-side code would be a lot longer without it, and the auth flow (PKCE, refresh, storage) is exactly what we should not hand-write.
2. **Privacy notice and terms for tutors at sign-up.** The PRD asks for parent consent on the pay page (R1-9), a tutor confirmation when adding parents' numbers (R1-3), and delete-account and export (R1-13). It says nothing about a notice or checkbox at tutor sign-up, and no notice text exists. I will not write legal text. **Recommendation: nothing at sign-up for your own testing; get a notice written and linked on the sign-in screen before any other tutor is invited.** (The consent canvas and the More canvas both link to a notice page that does not exist yet.)

## 3. Acceptance criteria

### Language picker (`/{locale}/language/`)

1. The page lists English, हिन्दी, ಕನ್ನಡ, తెలుగు (endonyms from `src/config/locales.ts`), each row at least 64px high, each with its own `lang`. The current language's row is marked "Chosen" in words and by the highlight, never colour alone. [e2e]
2. Tapping a language is a plain link to `/{code}/language/`. It saves the choice (`saveLocale`) and the page reloads in that language. With JavaScript off it still navigates. [e2e]
3. "Continue" is a plain link to `/{locale}/sign-in/`, and is at least 48px high. Its label is in the page's language. [e2e]
4. Opening the page alone never saves a language. Only a tap does (F3 criterion 18). [e2e]
5. The page is prerendered per language, has the right `<html lang>`, `noindex`, one `<h1>`, and no horizontal scroll at 360px at large font in all four. [e2e]

### Sign-in (`/{locale}/sign-in/`, callback `/{locale}/auth/callback/`)

6. The screen shows the brand (from `brand.ts`), a language link (the current language's endonym, at least 44px, going to `/{locale}/language/`), the headline, the three "TAP 1 / TAP 2 / PAID" rows from the canvas, one black "Continue with Google" button (at least 60px), and the line "Free for tutors. No password, no OTP." There is no email field. [e2e]
7. Tapping the button starts Google sign-in with PKCE. The browser goes to `<project>/auth/v1/authorize?provider=google&…` with `code_challenge`, `code_challenge_method=s256`, and `redirect_to` equal to `<current origin>/{locale}/auth/callback/`. [e2e]
8. While it starts, the button is in its busy state and says "Opening Google…". A second tap does nothing. [unit]
9. If the phone is offline when tapped, nothing starts, and the page says "You are offline. Connect to the internet to sign in." [e2e]
10. The callback page reads `?code=` from `window.location` (no `useSearchParams`), exchanges it exactly once (also under React strict mode double effects), removes the code from the address bar, then goes on (criteria 16 and 17). It shows "Signing you in…" meanwhile. [unit] [e2e]
11. If the callback has `error` in the query or the hash (Google "Cancel", or a refused redirect), the tutor lands on the sign-in screen with "Sign-in was cancelled. Tap Continue with Google to try again." For any other failure: "Google sign-in did not finish. Nothing was saved. Try again." No error code is shown. [e2e]
12. A first-time visitor (no stored session key) is shown the sign-in screen without the Supabase library being downloaded. The library is fetched only when the button is tapped, or when a stored session exists. [e2e: count requests for the chunk] [unit: `hasStoredSession`]
13. A visitor who is already signed in and opens the sign-in page is sent on (criterion 16 or 17) without seeing the form flash. [e2e]
14. The Supabase client is created with `flowType: 'pkce'`, `detectSessionInUrl: false`, `persistSession: true`, `autoRefreshToken: true`. (The library's default flow is `implicit`; the default must not be used.) [unit]

### Where a signed-in tutor goes (the guard)

15. Every app route (`home`, `more`, `setup/*`) renders nothing but "Opening your book…" until the session is known, then either its content or a redirect. A signed-out visitor never sees tutor content. [e2e]
16. Signed out on an app route: replaced with `/{locale}/sign-in/` (history replaced, so Back does not loop). [e2e]
17. Signed in, profile not complete: sent to `setup/profile/` if name or subjects are missing, else `setup/upi/` if the UPI ID is missing. Signed in, profile complete: sent to `home/` from sign-in, callback and the setup routes' "finish". The setup routes stay open to a complete profile (that is how Edit works). One pure function decides all of this and is unit tested as a table. [unit] [e2e]
18. Signing out (More, "Sign out") ends this device's session only (`scope: 'local'`), clears the stored session even if the network call fails, and goes to sign-in. [unit] [e2e]
19. If the session ends on its own (refresh fails, token revoked), the tutor goes to sign-in and sees "You were signed out. Sign in again to carry on." once. Nothing saved earlier is lost; it is in the database. [unit] [e2e]
20. If the session check or the tutor fetch fails because the network is down, the screen shows the error banner "Couldn't load your details. The network dropped. Nothing is lost." with "Try again". It does not sign the tutor out. [e2e]

### Setup step 1: name and subjects (`setup/profile/`)

21. Shows "Step 1 of 3", the title, the body, a name field, subject chips, "+ Other", and a black "Next: your UPI ID" button. No photo row. [e2e]
22. The name field starts empty (it is not copied from Google). Trimmed, runs of spaces collapsed, 1 to 80 characters, any script. Empty: "Missing" and "Type your name." Too long: "Too long" and "Use 80 characters or fewer." [unit]
23. Chips: Maths, Science, English, Hindi, Physics, Chemistry, Accounts, each a toggle at least 44px with the selected state shown by a tick mark plus fill, `aria-pressed`. "+ Other" opens a one-line field with an Add button; an added subject becomes a chip. At least 1 and at most 8 subjects, each 1 to 30 characters. None chosen: "Pick at least one subject." [unit] [e2e]
24. Preset subjects are stored as stable keys (`maths`, `science`, `english`, `hindi`, `physics`, `chemistry`, `accounts`); typed ones as the typed text. Display maps a key to the page's language. A typed subject equal (ignoring case) to a preset's name in the page language is stored as the key. [unit]
25. Next saves `name`, `subjects` and `language` (the page's language) to the tutor's own row, then goes to `setup/upi/`. While saving the button is busy. On failure the form keeps what was typed, shows "Couldn't save just now. Your changes were not saved. Check your connection and tap Next again.", and does not move on. [unit] [e2e]
26. If the tutor row comes back missing (update changed 0 rows), the screen shows an error that says to sign out and in again, with a Sign out button. It does not loop. [unit]

### Setup step 2: UPI ID (`setup/upi/`)

27. Shows "Step 2 of 3", "Where should the fees land?", the body ("Your UPI ID. Parents pay you directly. {brand} never touches the money."), a field "Your UPI ID" with placeholder `name@bank`, and a black "Save and finish" button. Value drawn in the Latin face (`latinValue`). [e2e]
28. The field starts with the saved UPI ID if there is one, else empty. It is checked as the tutor types, after the first blur. Valid (exact PRD pattern `^[\w.\-]{2,256}@[a-zA-Z]{2,64}$`, spaces trimmed first): state "correct", message "That looks like a valid UPI ID." [unit]
29. Invalid, with words that say how to fix it: empty: "Type your UPI ID."; no `@`: "This is missing the part after @. A UPI ID looks like name@bank"; anything else: "A UPI ID has letters, digits, dots and dashes, then @, then the bank's name. Check for spaces." [unit]
30. Save and finish stores `upi_id` and goes to `home/`. Same busy and failure behaviour as criterion 25. [unit] [e2e]
31. A "Back" link goes to step 1. A tutor who arrives from More ("Edit") sees the same two screens with their saved values; after saving step 2 they go to `home/`. [e2e]

### Home, empty (`home/`)

32. Shows the brand, the tutor's first name ("Hello, Meena"), a "More" link (at least 44px), the heading "Your book is empty.", the body "Add your students and you will see who owes what, with one tap to remind each parent.", and the line "Adding students arrives in the next update." There is no "Add students" button and no sample-data link: they cannot work yet, and a button that cannot work is not shown. R1-3 replaces that line. [e2e]
33. The same page is the loading state ("Opening your book…", grey blocks, no spinner-only) and the error state (criterion 20). [e2e]

### More (`more/`)

34. Shows: "Your profile" with name, subjects (in the page's language), UPI ID, and an "Edit" link to `setup/profile/`; a "Language" row showing the current endonym, linking to `/{locale}/language/`; a "Sign out" button; a "Back to home" link. Nothing else: no Pro, no export, no help, no delete account. They arrive with their own slices. [e2e]
35. Changing the language here: the picker's Continue goes to sign-in, which sends a signed-in tutor straight to `home/` in the new language (criteria 13 and 17). The tutor's `language` column follows the language of the page in use (criterion 36). [e2e]
36. When any app screen loads a tutor whose `language` differs from the page's language, it updates `language` quietly in the background. A failure is ignored. [unit]

### Data (R1-2)

Everything below is [db], run by the `database` CI job (Docker does not work on the founder's machine).

37. Tables `public.tutors`, `public.batches`, `public.students` exist, each with row-level security on, and each of the grants and policies in section 8.5. `020_public_tables_have_rls.sql` still passes.
38. A new row in `auth.users` creates exactly one `tutors` row with the same id and email, language `en`, name, UPI ID and subjects empty. Doing it again, or a repeat run of the migration's backfill, creates no second row and no error.
39. A signed-in tutor reads and updates only their own `tutors` row, and only `name`, `subjects`, `upi_id`, `language`. They cannot insert or delete a `tutors` row, change `id`, `email`, `created_at`, or move the row to another id.
40. Tutor B cannot select, insert for, update or delete tutor A's batches or students, including inserting a row that carries A's `tutor_id`. A student cannot point at another tutor's batch.
41. Without a session (`anon`) every table returns nothing and refuses writes, and has no table privilege at all.
42. Constraints refuse: a negative amount; a phone that is not `+91` and 10 digits; a language outside en, hi, kn, te; a due day outside 1 to 28; a blank name; an invalid UPI ID.
43. `pay_token` is generated by the database, at least 22 URL-safe characters, unique, not editable and not choosable by the client.
44. The migration file passes `pnpm check:db` (name `<14 digits>_<snake_case>.sql`, newer than `20261009195132`, not editing the baseline).

### Cross-cutting

45. All new words are in `messages/{en,hi,kn,te}.json`; `pnpm i18n:check` passes. Hindi, Kannada and Telugu strings not yet reviewed are `TODO-translate`. The words quoted from the canvas (section 6) are filled in. No English in JSX; no "FeeDost" outside `brand.ts`. [unit]
46. Every new page works at 360px and at the system's large font size in all four languages: no sideways scroll, no clipped label, tap targets at least 44px, nothing below 14px. [e2e]
47. Initial JS for each new route is at most 200 KB gzipped (`pnpm size`), target 170 KB or less. The lazily loaded Supabase chunk is measured and reported in the pull request; it must be at most 70 KB gzipped, or `frontend-dev` stops and tells `tech-lead`. The landing and tool pages stay about 132 and 141 KB. [e2e: `pnpm size`]
48. `pnpm check:secrets` still passes on the build (the library's source mentions its admin key in comments only; if a built chunk trips the rule, report it and do not loosen the check). [manual: CI]
49. Nothing is sent to analytics. No cookies are set. [e2e]

## 4. Edge cases

- Code used twice (strict mode, double tap, refresh on the callback): the second exchange must not run, and a reloaded callback URL without a stored verifier goes to sign-in with the "did not finish" message.
- Browser storage blocked (private mode): sign-in cannot keep a session. The callback ends at sign-in with the "did not finish" message. No crash.
- A tutor signs in on a second phone: same data, no merge needed.
- Tutor row exists but `name` was cleared by an old client: treated as incomplete; goes to step 1.
- Very long name or UPI ID: the Field wraps; nothing is cut.
- Google account with an email already used by an earlier staging test user: Supabase links by email; the existing tutor row is kept (the trigger only fires on a new user).
- Staging already has `auth.users` rows from dashboard testing: the migration backfills their tutor rows.
- A second tab signs out: the first tab gets the `SIGNED_OUT` event and goes to sign-in (criterion 19).
- Subject text in Kannada or Telugu typed in "Other": stored as typed, shown as typed.
- Hindi digits typed into the UPI field: not valid (the pattern is Latin); the message says so.

## 5. Out of scope (do not add)

Email magic link; photo upload; Add students (one by one, paste, contacts, CSV); sample data; batches screens; bottom nav; delete account; export; referral and `/join`; any consent text; PostHog and Sentry; service worker and outbox; Tamil and Malayalam; "What parents will see" preview card on UPI step; "Where do I find it?" help page; the `plan`, `trial_ends_at`, `referral_code`, `referred_by` and `phone` columns (each is added by the slice that uses it); `dues`, `payments` and the rest; a link from the landing page; any change to `supabase/config.toml` (it is the local stack only).

## 6. Copy

English below. Hindi, Kannada and Telugu: use the canvas words where shown, mark every other value `TODO-translate`. `{brand}` always comes from `brand.ts`. Namespaces: `language`, `signIn`, `setup`, `home`, `more`, `appState`, `subjects`.

| Key | English |
|---|---|
| language.title | Choose your language |
| language.subtitle | अपनी भाषा चुनें · ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ · మీ భాషను ఎంచుకోండి (same in all four files) |
| language.chosen | Chosen |
| language.continue | Continue (hi: आगे बढ़ें, kn: ಮುಂದುವರಿಸಿ, te: కొనసాగించండి) |
| language.name.en/hi/kn/te | English, Hindi, Kannada, Telugu (the line under each endonym; translated per page language) |
| signIn.headline | Fees collected. Not chased. |
| signIn.tap1 / tap2 / paid | You tap Remind. WhatsApp opens, message ready. / The parent taps Pay. UPI opens, amount filled. / Straight to your UPI. We never hold it. |
| signIn.google | Continue with Google |
| signIn.busy | Opening Google… |
| signIn.note | Free for tutors. No password, no OTP. |
| signIn.offline | You are offline. Connect to the internet to sign in. |
| signIn.cancelled | Sign-in was cancelled. Tap Continue with Google to try again. |
| signIn.failed | Google sign-in did not finish. Nothing was saved. Try again. |
| signIn.expired | You were signed out. Sign in again to carry on. |
| signIn.callback | Signing you in… |
| setup.stepOf | Step {n} of {total} |
| setup.profile.title | What should parents call you? |
| setup.profile.body | This name goes on every reminder, pay page and receipt. |
| setup.profile.name | Your name |
| setup.profile.subjects | What do you teach? |
| setup.profile.other | + Other |
| setup.profile.otherLabel | Another subject |
| setup.profile.add | Add |
| setup.profile.next | Next: your UPI ID |
| setup.name.missing / tooLong | Type your name. / Use 80 characters or fewer. |
| setup.subjects.missing | Pick at least one subject. |
| setup.upi.title | Where should the fees land? |
| setup.upi.body | Your UPI ID. Parents pay you directly. {brand} never touches the money. |
| setup.upi.label | Your UPI ID |
| setup.upi.ok | That looks like a valid UPI ID. |
| setup.upi.missing / noAt / bad | as in criterion 29 |
| setup.upi.save | Save and finish |
| setup.back | Back |
| setup.saveFailed | Couldn't save just now. Your changes were not saved. Check your connection and tap {action} again. |
| setup.rowMissing | We could not find your profile. Sign out, then sign in again. |
| home.hello | Hello, {name} |
| home.more | More |
| home.empty.title / body | Your book is empty. / Add your students and you will see who owes what, with one tap to remind each parent. |
| home.empty.soon | Adding students arrives in the next update. (R1-3 deletes this key) |
| more.title / profile / edit | More / Your profile / Edit |
| more.language / signOut / back | Language / Sign out / Back to home |
| appState.loading | Opening your book… |
| appState.errorTitle / errorBody / retry | Couldn't load your details / The network dropped. Nothing is lost. / Try again |
| appState.offlineTitle / offlineBody | You are offline / Connect to the internet to save your details. |
| subjects.maths … accounts | Maths, Science, English, Hindi, Physics, Chemistry, Accounts |

Status is always a word plus a mark: "Chosen" with a tick, "correct" and "needs fixing" through the Field's own state words, errors with the Banner's mark. Red is never a button.

## 7. Privacy

- **Stored in our database:** the tutor's id and email (from Google), name, subjects, UPI ID, language, timestamps. The `batches` and `students` tables exist but nothing writes to them yet. Supabase Auth itself keeps the Google profile (name, picture link) in `auth.users`; we do not copy it.
- **Stored in the browser:** `ui-language` and the Supabase session token (localStorage). No cookies.
- **Not collected:** photo, phone number, anything about students or parents in this slice. No analytics, no error tracking (PostHog and Sentry are R1-14).
- **Scopes asked of Google:** the Supabase default (openid, email, profile). Nothing else.
- **DPDP:** the PRD requires, in section 9, minimal student data, parent consent on the pay page, a tutor's confirmation when adding parents' numbers, and delete-account and export buttons. None of that is in this slice. The PRD does not require anything at tutor sign-up. No notice text exists, and none is invented here (open question 2).

## 8. Technical plan

### 8.1 Approach

Sign-in is supabase-js with PKCE in the browser. One file, `src/lib/supabase.ts`, creates the client (lazily) and everything else asks `src/lib/auth.ts` and `src/lib/tutor.ts`. App routes sit in one route group with a client guard that shows "Opening your book…" until the session and the tutor row are known, then shows the page or redirects. In the database, one migration creates three tables with tight grants and `(select auth.uid())` policies, plus a trigger that creates the tutor row when Google creates the user. Composite foreign keys stop one tutor from pointing at another's batch.

### 8.2 Routes

All under `/{locale}/`, all prerendered shells, all `noindex`.

| Route | Group | Signed out | Signed in |
|---|---|---|---|
| `language/` | root | picker | picker |
| `sign-in/` | root | the form | redirect (criteria 13, 17) |
| `auth/callback/` | root | exchange the code | same (a stray code is not reused) |
| `setup/profile/`, `setup/upi/` | `(app)` | redirect to sign-in | the form |
| `home/` | `(app)` | redirect to sign-in | empty home (redirect to setup if incomplete) |
| `more/` | `(app)` | redirect to sign-in | More |

The existing `/`, landing, tools, `/dev/*`, 404 are untouched.

### 8.3 Files

Create:

| File | What goes in it |
|---|---|
| `src/lib/supabase.ts` | The only importer of `@supabase/supabase-js`. `getClient()` returns a promise of the client, created on first call by `await import()`, once. Options as in criterion 14, `storageKey` left to the library's default (`sb-<ref>-auth-token`). Reads `supabaseUrl` from `supabase-env.ts` and the anon key from a new `supabaseAnonKey` export there, written literally so Next inlines it. Throws a plain error if either is empty. |
| `src/lib/supabase-env.ts` (change) | Add `supabaseAnonKey`; add `storedSessionKey()` that returns `sb-<first label of the URL host>-auth-token`. |
| `src/lib/auth.ts` | `hasStoredSession()` (reads localStorage for the key above, no library load; false when storage is blocked), `startGoogleSignIn(locale)`, `finishSignIn()` (single-flight code exchange; reads `code` and `error` from query and hash; strips the address bar), `signOut()`, `useSession()` hook (loading, signed-out, signed-in; subscribes to `onAuthStateChange`; sets a one-time `expired` flag in sessionStorage when it sees `SIGNED_OUT` that the tutor did not ask for). |
| `src/lib/tutor.ts` | `getTutor()`, `saveProfile({name, subjects, language})`, `saveUpi(upiId)`, `syncLanguage(locale)`. The one place that writes the profile (R1-12 swaps it for the outbox). Each update ends with `.select().single()` so a 0-row update is an error, not silence. Sends only granted columns. |
| `src/lib/profile.ts` | Pure: `normalizeName`, `normalizeSubjects`, `presetKeys`, `isProfileComplete`, `nextRoute(state)` (the criterion 17 table). No React. |
| `src/lib/upi.ts` | Pure: `UPI_PATTERN` (the PRD regex), `checkUpi(text)` returning `ok`, `missing`, `noAt` or `bad`. |
| `src/components/app/app-gate.tsx` | Client. Uses `useSession`, `getTutor`, `nextRoute`, `router.replace`. Renders the loading state, the error banner with "Try again", or `children`. Also runs `syncLanguage`. Provides the tutor to children through a small context. |
| `src/components/app/loading-book.tsx`, `load-error.tsx` | The loading and error states from the canvas. |
| `src/components/auth/sign-in-screen.tsx` | The sign-in client island (button, busy, offline, error and expired messages). |
| `src/components/auth/callback-screen.tsx` | The callback client island. |
| `src/components/setup/profile-form.tsx`, `upi-form.tsx`, `step-header.tsx` | The two forms and the "Step n of 3" strip. Use `Field`, `Button`, `Banner`. |
| `src/components/setup/subject-chips.tsx` | The toggle chips and "+ Other". New UI piece; needs rest, pressed, focus and disabled states. If it is generic enough, add it to `src/components/ui/` with a dev-page section. |
| `src/components/home/empty-home.tsx`, `src/components/more/more-screen.tsx` | The two screens. |
| `src/components/language/language-list.tsx` | The four rows. Check `Segmented` first; if it cannot draw the stacked canvas rows, add a variant there rather than one-off styling. |
| `src/app/[locale]/language/page.tsx`, `sign-in/page.tsx`, `auth/callback/page.tsx` | Server pages: metadata (`robots: { index: false }`, title from messages), `ClientMessages` for the namespaces the island needs, the island. |
| `src/app/[locale]/(app)/layout.tsx` | Wraps children in `ClientMessages` and `AppGate`. |
| `src/app/[locale]/(app)/home/page.tsx`, `more/page.tsx`, `setup/profile/page.tsx`, `setup/upi/page.tsx` | Thin server pages, metadata as above. |
| `src/config/routes.ts` (change) | Add `signInPath`, `languagePath`, `callbackPath`, `homePath`, `morePath`, `setupProfilePath`, `setupUpiPath`. |
| `e2e/auth-helpers.ts` | `fakeSession()`, `seedSession(page)` (writes the localStorage key before load with `addInitScript`), `stubSupabase(page, {tutor, …})` answering `/auth/v1/*` and `/rest/v1/tutors`, and a log of requests made. Same fake host as `e2e/supabase-env.spec.ts`. |
| `e2e/sign-in.spec.ts`, `e2e/setup.spec.ts`, `e2e/app-guard.spec.ts`, `e2e/language-picker.spec.ts` | The flows in section 9. |
| `src/lib/*.test.ts`, `src/components/**/*.test.tsx` | Next to each file, as in section 9. |

Change:

| File | Change |
|---|---|
| `package.json`, `pnpm-lock.yaml` | Add `@supabase/supabase-js` 2.117.3, exact. After the founder's yes only. |
| `docs/BUILD_PLAN.md` | Add a row for it in the dependency table. |
| `messages/{en,hi,kn,te}.json` | The keys in section 6. All four together. |
| `scripts/size.mjs` | Add the new routes (all four languages) to `REQUIRED`: `language`, `sign-in`, `auth/callback`, `home`, `more`, `setup/profile`, `setup/upi`. |
| `.github/workflows/ci.yml` | The Build step also sets `NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-anon-key` (a made-up string; the library does not check its shape). |
| `src/i18n/words.ts` | Only if a namespace is plain text; `setup` has `{n}` and `{brand}`, so it goes through `ClientMessages` (about +12 KB). Do not add it to `plainNamespaces`. |

`/dev/components` gets a section for any new `ui/` piece (rule from F2).

### 8.4 Auth details to follow exactly

- `startGoogleSignIn` calls `signInOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/{locale}/auth/callback/' } })`. `window.location.origin` keeps start and finish on the same origin, which PKCE needs (the verifier is in this origin's localStorage). It works on localhost, on every Vercel preview and later on the production domain.
- `finishSignIn` holds a module-level promise so a second call returns the first. `detectSessionInUrl` is false, so only this function ever exchanges a code.
- After the exchange: fetch the tutor, call `nextRoute`, `router.replace`. Do not use `useSearchParams`.
- `signOut` uses `{ scope: 'local' }`. If it throws (offline), remove the stored key by hand and carry on.
- The guard uses `getSession()` (a local read, with a refresh when the token is old). It is UX only. Never treat it as a check that protects data.
- `hasStoredSession()` runs before the library is loaded. No key means signed out at once, with no network.
- The library is imported inside `getClient()` only. No other file may import it (add a unit test that greps `src/` for the package name outside `src/lib/supabase.ts`).

### 8.5 Data (one migration)

File: `supabase/migrations/<timestamp>_r1_tutors_batches_students.sql`, made with `pnpm exec supabase migration new r1_tutors_batches_students`. The timestamp must be newer than `20261009195132` (F4 rule 3). Never edit it after it reaches staging.

Shared pieces:

- `public.set_updated_at()` trigger function: sets `updated_at = now()` before update. Used on all three tables.
- `public.handle_new_user()`: `security definer`, `set search_path = ''`, inserts `(id, email)` into `public.tutors` with `on conflict (id) do nothing`, returns new. Trigger `on_auth_user_created` after insert on `auth.users`, for each row.
- Both functions: `revoke execute on function … from public, anon, authenticated`. Supabase's default function privileges give `anon` and `authenticated` execute on new public functions; the baseline only revoked tables and sequences.
- The migration ends with a backfill: insert a tutors row for every existing `auth.users` row that has none.

`tutors` (the tutor, id = their auth id):

| Column | Type and rule |
|---|---|
| `id` | `uuid primary key references auth.users(id) on delete cascade` |
| `email` | `text` |
| `name` | `text`, null until set; check: null or trimmed length 1 to 80 |
| `language` | `text not null default 'en'`, check in `en, hi, kn, te` |
| `upi_id` | `text`, null until set; check: null or matches `^[A-Za-z0-9_.-]{2,256}@[A-Za-z]{2,64}$` (the PRD pattern with `\w` written out, so SQL and JavaScript agree) |
| `subjects` | `text[] not null default '{}'`; check: `cardinality(subjects) <= 8` and `octet_length(array_to_string(subjects, ',')) <= 400` |
| `created_at`, `updated_at` | `timestamptz not null default now()` |

RLS on. Policies: **select** `id = (select auth.uid())`; **update** using and with check the same. **No insert policy and no delete policy**: tutors are made by the trigger, and removed by delete-account (R1-13, through an Edge Function). This is the one place that departs from "four policies" in `supabase/CLAUDE.md`, because `tutors` has no `tutor_id` (the id is the tutor) and the client must never create or remove it. Grants: `revoke all on public.tutors from anon, authenticated; grant select on public.tutors to authenticated; grant update (name, subjects, upi_id, language) on public.tutors to authenticated;`.

`batches`:

| Column | Type and rule |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` (clients may supply it: offline ids) |
| `tutor_id` | `uuid not null default auth.uid() references tutors(id) on delete cascade` |
| `name` | `text not null`, check trimmed length 1 to 60 |
| `timings` | `text`, check null or length at most 100 |
| `created_at`, `updated_at` | as above |

Constraints and indexes: `unique (tutor_id, id)` (the target for composite foreign keys, also the tutor index); `unique (tutor_id, lower(name))` as a unique index (two batches of one tutor cannot share a name). RLS on, four policies on `tutor_id = (select auth.uid())` (insert and update with check as well as using). Grants: `revoke all … from anon, authenticated; grant select, insert, update, delete on public.batches to authenticated;`.

`students`:

| Column | Type and rule |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `tutor_id` | `uuid not null default auth.uid() references tutors(id) on delete cascade` |
| `batch_id` | `uuid`, null; composite `foreign key (tutor_id, batch_id) references batches (tutor_id, id) on delete set null (batch_id)` (needs Postgres 15 or later; the project is 17). This is the trap fix: a plain `batch_id` foreign key is checked without row-level security, so tutor B could attach a student to tutor A's batch id. |
| `name` | `text not null`, trimmed length 1 to 80 |
| `parent_name` | `text`, null or length at most 80 |
| `parent_phone` | `text`, check null or `^\+91[0-9]{10}$` |
| `parent_language` | `text not null default 'en'`, check in the four |
| `monthly_fee` | `integer not null default 0`, check `>= 0` and `<= 100000000` (paise; at most ₹10 lakh) |
| `opening_balance` | `integer not null default 0`, same check |
| `due_day` | `smallint not null default 1`, check 1 to 28 |
| `pay_token` | `text not null unique default` 24 URL-safe characters from 18 random bytes (`extensions.gen_random_bytes(18)`, base64, `+` to `-`, `/` to `_`; 18 bytes gives no padding). Generated here so R1-9 needs no backfill. |
| `active` | `boolean not null default true` |
| `created_at`, `updated_at` | as above |

Constraints and indexes: `unique (tutor_id, id)`; index `(tutor_id, batch_id)`. RLS on, four policies on `tutor_id = (select auth.uid())`. Grants: `revoke all … from anon, authenticated; grant select, delete on public.students to authenticated;` plus **column-level** `insert (id, tutor_id, batch_id, name, parent_name, parent_phone, parent_language, monthly_fee, opening_balance, due_day, active)` and `update (batch_id, name, parent_name, parent_phone, parent_language, monthly_fee, opening_balance, due_day, active)`. The token, `tutor_id` after creation, and `created_at` are not client-writable. (When R1-5 adds `dues` with a foreign key to students, it uses `references students (tutor_id, id)` and `on delete restrict`: a student with dues is archived, not deleted.)

Why the trigger and not an insert right (decision 7), checked against RLS: with a trigger, `tutors` needs no insert policy. If a client could insert, `with check (id = auth.uid())` would work, but it would also let a tutor create a row for a half-signed-up state, and later columns (`plan`, `referral_code`) would need extra column grants. Trigger wins.

Seed: `supabase/seed.sql` stays a comment. No sample tutor.

### 8.6 pgTAP tests (`supabase/tests/`, each in `begin … rollback`, each starts `select tests.assert_ready();`)

Setup used by the files below: insert `auth.users` rows for `tests.tutor_a()` and `tests.tutor_b()` (id and email only; the trigger makes their tutors rows). `backend-dev` checks which `auth.users` columns the local stack requires. These tests cannot run on the founder's machine: push the branch and read the `database` job. Run twice (the job does).

`040_tutors.sql`

1. A reads own row (count 1) and sees `email` and language `en`.
2. A sees only own row: `select count(*)` is 1, not 2, with B present.
3. B reads zero of A's rows (`where id = tests.tutor_a()`).
4. A can update own `name`, `subjects`, `upi_id`, `language` (lives_ok, values change).
5. A updating B's row changes zero rows (B's values unchanged, checked after `tests.reset()`).
6. A cannot update `email` (error 42501), `id`, `created_at`.
7. A cannot insert a tutors row, for self or for B (42501).
8. A cannot delete own row or B's (42501).
9. `anon`: select returns zero rows or is refused (privilege error); insert, update, delete refused.
10. `has_table_privilege('anon', 'public.tutors', …)` false for select, insert, update, delete.
11. Constraint failures (as the owner): `language = 'xx'`; `name = '  '`; `name` of 81 characters; `upi_id = 'abc'`, `'a b@okhdfc'`, `'name@'`; `subjects` with 9 items. Passing values: `'meena.tuitions@okhdfc'`, `'ravi-9@ybl'`.
12. `updated_at` moves forward on update.

`050_batches.sql`

1. A inserts a batch (lives_ok); A reads it.
2. B reads zero; B insert with `tutor_id = A` fails (42501); B insert with own id works.
3. B update and delete of A's batch change zero rows (A's batch intact after reset).
4. A cannot change `tutor_id` of a batch to B (error).
5. `anon`: zero rows, writes refused, no table privilege.
6. Same name for the same tutor, different case: refused. Same name for A and B: allowed.
7. Blank name, name over 60 characters, `timings` over 100: refused.
8. Deleting a batch leaves its students and sets their `batch_id` to null, and does not null `tutor_id` (this is the `set null (batch_id)` column list).

`060_students.sql`

1. A inserts a student; A reads it; `pay_token` is set, is 24 characters, matches `^[A-Za-z0-9_-]{24}$`.
2. B reads zero; B insert with `tutor_id = A` fails (42501); B update and delete change zero rows.
3. B inserts a student whose `batch_id` is A's batch: refused (foreign key, 23503). A student with a null batch is fine.
4. A cannot insert or update `pay_token` (42501), cannot update `tutor_id`, `created_at`.
5. Two students get different tokens (insert 20, all distinct).
6. `anon`: zero rows, writes refused, no privilege.
7. Constraints: `monthly_fee = -1`, `opening_balance = -1`, `monthly_fee = 100000001`, `due_day = 0` and `29`, `parent_phone = '9845012345'`, `'+919845012'`, `'+91984501234a'`, `parent_language = 'ta'`, blank name: all refused. Valid: `'+919845012345'`, due day 1 and 28, fee 0.
8. Deleting a tutor's `auth.users` row removes their tutors, batches and students (cascade); B's rows stay.

`070_new_user_trigger.sql`

1. Insert into `auth.users` (id, email) as the owner: exactly one tutors row appears with the same id, same email, language `en`, `name` null, `upi_id` null, `subjects` empty.
2. Repeating the insert of the same tutors row through the function path (call the trigger body's insert with the same id) creates no second row and raises nothing.
3. The new tutor can read their own row after `tests.act_as(id)`; tutor B cannot read it.
4. `has_function_privilege` is false for `anon` and `authenticated` on `handle_new_user()` and `set_updated_at()`.
5. A user created with no email (null) still gets a tutors row.

`080_grants_after_migration.sql`

1. For each of the three tables: `anon` has no privilege of any kind; `authenticated` lacks `truncate`, `references`, `trigger`.
2. The column-level grants are exactly as listed (check `has_column_privilege` for `pay_token`, `plan`-like columns not granted, `name` granted).

`020_public_tables_have_rls.sql` and `030_default_privileges.sql` run unchanged and must still pass.

Rough count: about 60 assertions. The `plan(n)` numbers are the file author's to set.

### 8.7 Work split and order

Each step ends with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`, `pnpm build`, `pnpm size`, and `pnpm test:e2e` green (build with the CI fake address, as the e2e comment says). Steps 2 to 6 are one pull request or several small ones; the lead decides. Commits per step.

| # | Owner | Task | Done when |
|---|---|---|---|
| 1 | `backend-dev` | The migration (8.5) and the five pgTAP files (8.6). Push the branch and read the `database` CI job; fix until it is green twice. Run `pnpm check:db --base origin/main` locally. | `database` job green. Then the lead decides when to run `supabase db push` to staging (staging only, never `--include-seed`, never `config push`). Staging must have it before the founder signs in. |
| 2 | `frontend-dev` | Auth core, no screens: after the founder's yes, install the library; `supabase-env.ts`, `supabase.ts`, `auth.ts`, `profile.ts`, `upi.ts`, `tutor.ts`, `routes.ts`; unit tests with a fake client; `e2e/auth-helpers.ts`; the CI env line; `size.mjs` list; BUILD_PLAN table row. | Unit tests green; `pnpm audit` has no high finding; bundle unchanged for existing routes. |
| 3 | `frontend-dev` | Language picker, sign-in screen, callback, messages for `language` and `signIn` in all four files, e2e for criteria 1 to 14. After sign-in, `home/` is a bare page that shows the tutor's email and a Sign out button (temporary). | First click-through: language, Google, signed in, sign out. Needs step 1 on staging and the founder's dashboard settings (section 10). |
| 4 | `frontend-dev` | `AppGate`, setup step 1 and 2, the empty home (with a plain Sign out button in its header, until step 5), messages `setup`, `home`, `appState`, `subjects`; e2e for criteria 15 to 33. | **Cut line.** The founder can sign in, set up his profile and see the empty home. Everything after this is polish he can try later. |
| 5 | `frontend-dev` | More screen (profile summary, Edit, Language, Sign out moves here, Back to home); `syncLanguage`; messages `more`; e2e for criteria 34 to 36. | |
| 6 | `frontend-dev` | States and hardening: session expired, offline, error banner and retry, second-tab sign-out; large-font and four-language screenshots at 360px; `pnpm size` report with the lazy chunk figure; `check:secrets` on the build. Then `test-engineer` reviews coverage against the criteria and fills gaps. | Criteria 19, 20, 45 to 49. |

Why backend first: the app cannot be tried without the tables on staging. Step 1 can run while the founder does his dashboard list (section 10) and answers question 1.

## 9. Tests required

| Criteria | Where |
|---|---|
| 1 to 5 | `e2e/language-picker.spec.ts` (four languages, 360px, large font, no save on open, save on tap); `language-list.test.tsx` |
| 6 to 14 | `e2e/sign-in.spec.ts` (authorize URL parameters, offline, cancelled and failed callbacks, first-visit makes no library request, already-signed-in redirect); `auth.test.ts` (single-flight exchange, error parsing from query and hash, `hasStoredSession`, client options); `sign-in-screen.test.tsx` (busy and double tap) |
| 15 to 20 | `e2e/app-guard.spec.ts` (signed out on each app route, setup redirect for incomplete profiles, sign-out, expired, network down); `profile.test.ts` (the `nextRoute` table: signed out; loading; incomplete name; incomplete subjects; incomplete UPI; complete on each route) |
| 21 to 31 | `e2e/setup.spec.ts` (full flow; the PATCH body holds only the granted columns; the request carries the bearer token; failure keeps typed values); `profile.test.ts` (name and subject normalising, preset keys); `upi.test.ts` (PRD regex: 12 valid and 12 invalid examples incl. trailing space, no `@`, Hindi digits, 257 characters); `profile-form.test.tsx`, `upi-form.test.tsx` |
| 32, 33 | `e2e/app-guard.spec.ts`; `empty-home.test.tsx` |
| 34 to 36 | `e2e/app-guard.spec.ts` (More flow, language change); `tutor.test.ts` (`syncLanguage` only when different, failure ignored) |
| 37 to 44 | pgTAP files in 8.6, run by CI |
| 45 | `pnpm i18n:check`; `no-strings` style check already in `src/components/ui/no-strings.test.ts`; a new test that no file under `src/` imports the Supabase package outside `src/lib/supabase.ts` |
| 46 | one e2e loop over the seven routes by four languages at 360px and a large root font size: no sideways scroll, no label wider than its box, every link and button at least 44px |
| 47 | `pnpm size` (new routes in `REQUIRED`); the lazy chunk's size printed in the pull request |
| 48 | `pnpm check:secrets` in CI |
| 49 | e2e asserts no cookie is set and no request goes to any host except the page's own and the fake Supabase host |

Test method (the answer to "how do we test without Google"): a build made with the CI fake Supabase address. Playwright answers `https://cicicicicicicicicici.supabase.co/**`: `/auth/v1/authorize` is captured and checked then aborted (a real Google page is never opened), `/auth/v1/token?grant_type=pkce` returns a made-up session, `/auth/v1/logout` returns 204, `/rest/v1/tutors` GET and PATCH are answered from a small in-test object. For tests that start signed in, `addInitScript` writes the made-up session under `sb-cicicicicicicicicici-auth-token` before the page loads; the library's local `getSession` reads it without a network call. Why this and not a real staging session: it needs no secret, never uses the founder's account, adds no rows to staging, runs in CI, and it still runs the real supabase-js code (storage, PKCE, request shape). What it cannot prove is Google's side and the real database; those are the manual list and the pgTAP tests. Unit tests use a small fake of the three `supabase.ts` calls and never import the library.

Not tested by e2e: the real Google screen, real token refresh, real RLS. Those are [manual] on staging and [db].

## 10. What the founder must do

Do these once. Never paste a secret into chat or a file.

1. Answer open question 1 (the dependency) so `frontend-dev` can start step 2.
2. Supabase dashboard, staging project (`cujjgadbdqbxcsseogfx`), Authentication, URL Configuration:
   - Site URL: `http://localhost:3000`. It is only the fallback if a redirect is refused.
   - Additional redirect URLs: `http://localhost:3000/**` and `https://feedost-*-<your-vercel-scope>.vercel.app/**`. Read the scope from the end of any preview address, for example `feedost-git-r1-signin-and-data-<scope>.vercel.app`. A single `*` stops at a dot or slash, so this pattern is right for preview addresses; `**` crosses them.
   - Optional, for testing on a phone over Wi-Fi with `pnpm serve:lan`: `http://192.168.*.*:4173/**`.
   - If a redirect is not on the list, Supabase silently sends the tutor to the Site URL instead. That is the first thing to check if sign-in lands on the wrong address.
3. Same page, Authentication, Providers, Google: confirm it is on, with the client ID and secret you pasted. Do not touch Phone or Anonymous.
4. Google Cloud console, the OAuth client: Authorised redirect URIs must contain exactly `https://cujjgadbdqbxcsseogfx.supabase.co/auth/v1/callback`. No JavaScript origins are needed.
5. Google Cloud, OAuth consent screen: while it is in "Testing", only the Google accounts listed as test users can sign in. Add yours, and any account you will test with. Publishing the screen is needed before other tutors can sign in, and Google may show an "unverified app" warning until it is verified.
6. When `backend-dev`'s migration is green in CI, tell the lead "apply to staging". The lead runs the push (staging only). You do not run anything.
7. Open the Vercel preview of this branch. Previews sit behind Vercel's login, so your phone's browser must be logged in to Vercel. Alternatively run `pnpm build` then `pnpm serve:lan` on the laptop (with `.env.local` filled in) and open the Wi-Fi address on the phone (add the optional redirect URL above).

## 11. What to test by hand on a phone

On the staging-backed preview, at 360px width, then again with the system font size set to large.

1. Open `/en/language/`. Tap Hindi: the page changes to Hindi and Hindi is marked "Chosen". Tap Kannada, then Telugu, then English. Each reads cleanly, no cut-off words.
2. Tap Continue, then "Continue with Google". Google opens. Pick your account. You return to the app, not to a blank page or localhost.
3. First time: you land on "What should parents call you?" with the name empty. Tap Next with nothing typed: the message says what to fix. Type a name, pick two subjects, add one with "+ Other", tap Next.
4. UPI step: type `abc` and tap Save: the message says it is missing the part after @. Type a real UPI ID: the field shows the tick and the words "That looks like a valid UPI ID." Save.
5. You land on "Your book is empty." There are no buttons that do nothing.
6. Tap More: your name, subjects and UPI ID are right. Edit changes them. Language switches the page. Sign out takes you to sign-in.
7. Sign in again: you go straight to the empty home, not to setup.
8. Close the browser tab, reopen `/en/home/`: still signed in.
9. Turn on aeroplane mode on the sign-in screen and tap the button: it says you are offline. Open home while online, then switch the network off in DevTools (or turn on aeroplane mode) and tap an action that needs the network: it says the network dropped and offers Try again and Sign out; it does not sign you out by itself. Switch the network back on and tap Try again: the screen carries on. (Reloading while offline cannot work before R1-12: there is no service worker until then. With no network and a token that has run out, the library retries for about 26 seconds, which the screen shortens to a moment; after a failed token renewal it also holds the failure for a 60 second cooldown, so Try again may need to wait that long. A token the server refuses outright signs you out with the "You were signed out" message.)
10. On the sign-in screen, in Google tap Cancel (or Back): you return with "Sign-in was cancelled."
11. Check in Supabase (Table editor, staging): one `tutors` row for you, with your name, subjects, UPI ID and language. Nothing in `batches` or `students`.

## 12. Risks and traps

| Risk | How the plan avoids it |
|---|---|
| The library's default flow is `implicit`, not PKCE. | Criterion 14 sets `pkce` and a unit test pins it. |
| The code is exchanged twice (strict mode, double render) and the second try fails. | `detectSessionInUrl: false` and one single-flight exchange (criterion 10). |
| The sign-in starts on one origin and returns to another (preview address changes with every commit). | `redirectTo` is `window.location.origin` plus the path, and the allow-list uses the `**` pattern. |
| A refused `redirect_to` silently falls back to the Site URL. | Founder list item 2; the by-hand test 2 checks where you land. |
| The static page is served to a signed-out visitor, and the guard flashes content. | The gate renders nothing but the loading state until the session is known. Data safety rests on RLS, not on the gate. |
| Initial JS grows past budget. | The library is a lazy chunk, `hasStoredSession` avoids loading it for first-time visitors, `ClientMessages` wraps only the island, and `size.mjs` lists the new routes. |
| `pnpm check:secrets` trips on the library's comments about its admin key. | Comments are stripped by the build; criterion 48 makes CI prove it. Do not loosen the check. |
| Foreign key checks skip RLS, so a tutor could attach a student to another's batch. | Composite foreign keys `(tutor_id, batch_id)`, with a pgTAP test. |
| A tutor writes to columns they should not (plan, token, id). | `revoke all`, then column-level grants. The client cannot even name a forbidden column. |
| New public functions are executable by `anon` and `authenticated` by default. | `revoke execute` on both new functions; a test checks it. |
| The `auth.users` trigger fails and every sign-up breaks ("Database error saving new user"). | The function is two lines with `on conflict do nothing`, `search_path` empty, a test with a null email, and the migration runs on staging before any front-end code relies on it. |
| Staging already has users from dashboard testing, with no tutors row. | The migration backfills. |
| A 0-row update looks like success. | `.select().single()` after each write (criterion 26). |
| The free-plan email sender and its 2-an-hour limit. | The magic link is not in this slice (decision 3). Google sign-in sends no email. |
| Tokyo region latency for a phone in India (a few hundred milliseconds per round trip is plausible; not measured). | Each screen makes one tutor read; the session check is local; saves are one call. If it feels slow, the answer is the Mumbai production project, not tuning this slice. |
| Local `.env.local` bakes the real staging URL, so e2e would not find the fake host. | The e2e files say to build with the CI address, as `supabase-env.spec.ts` already does; the first test asserts the authorize host and fails with that message. |
| Local database commands cannot run (no Docker). | CI's `database` job is the only runner; `backend-dev` pushes early and reads it. |
| Google consent screen still in "Testing". | Founder item 5. |
| An applied migration is edited later. | `check:db` forbids it; fixes are new migrations. |
| Adding Tamil or Malayalam later breaks the language checks. | A new migration alters those checks then. Noted, not built. |

## 13. Gaps and conflicts found in the source documents

- PRD section 5 says name, subject and UPI are one screen; PRD section 6 and the canvas say three steps. Followed the canvas.
- PRD data model lists `photo_url`, `plan`, `trial_ends_at`, `referral_code`, `referred_by`, `phone` on `tutors`. Left out until used (each is a nullable or defaulted column, so a later migration is cheap).
- The sign-in canvas draws an email field, the PRD says magic link; both deferred (decision 3).
- `supabase/CLAUDE.md` wants four policies on every table; `tutors` gets two and explains why (8.5). `src/CLAUDE.md` wants writes through the outbox; decision 9.
- BUILD_PLAN's dependency table does not list the Supabase client library.
- `docs/ENVIRONMENTS.md` still describes staging as Mumbai in its first table; the F4b section later says staging is Tokyo. The Tokyo statement is the true one. `frontend-dev` does not touch that page; the lead may tidy it.
- No privacy notice or terms text exists, though two canvases link to one.
- The landing page has no way into the app (decision 11).
- No sign-in error wording exists in the canvases; section 6 adds it.
- `supabase/config.toml` has Google off and Site URL `127.0.0.1`: correct for the local stack, and it is never pushed to the hosted project.

## 14. Start

`backend-dev` starts with task 1 (the migration and the pgTAP tests). `frontend-dev` starts task 2 as soon as the founder answers open question 1.
