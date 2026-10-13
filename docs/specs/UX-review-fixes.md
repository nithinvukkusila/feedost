# UX-review-fixes: fixes from the live-site review of 14 Oct 2026

Requested by the founder on 2026-10-14 after a UI/UX review of https://feedost.vercel.app (main `1332486`, backed by staging). The founder approved acting on the eight items below, in this order. It is a small polish slice: copy, one landing link, one placeholder screen, a form layout, one small pure helper and a load-time change. No new table, no migration, no new dependency, no new Edge Function.

Scope rule applied: anything the PRD does not contain is listed under "Open questions for the founder" and is not built here. Tags: [unit] Vitest, [e2e] Playwright, [manual] by hand on a phone, [db] read-only database check.

## 1. Items and acceptance criteria

The PRD text these rest on: section 4 "Dues generation: On the student's due day each month a `dues` row is created (scheduled job). Opening balance becomes a due on import"; section 5 onboarding "add students ... home shows pending total"; section 6 "Bottom nav: Home, Students, Attendance, More. Mobile-first, works at 360px width, large tap targets (>=44px)".

1. [e2e][unit] Home with students and nothing due says why and when the first fee appears (the date), and says what to do for a fee already owed from before. It never says only "Nothing is due yet." (criteria U1 to U4 below).
2. [e2e] The landing page header and footer each carry a quiet "Sign in" link to the sign-in screen, in all four languages, tap target at least 44px, passing the design rules.
3. [e2e] First-run guidance on Home: no students keeps today's empty book (title, one line, the black "Add a student" button); students but nothing due gets the line from item 1. No checklist is built (founder question 2).
4. [e2e] The Attendance tab shows a proper coming-soon state with a way back, not a bare line.
5. [e2e] The add-student form is grouped Who / Fee / Opening balance, each group with a heading, and "Already owes" and the permission tick each have a one-line hint, in all four languages.
6. [manual][unit] The first paint of app screens does less in sequence; the time to the first real row is measured before and after on a throttled profile.
7. [unit] Landing body text on the cloth passes WCAG AA (measured, result below). No change.
8. Desktop: no change in this slice (reason below).

## 2. Technical plan

### 2.1 Approach

Eight items, two pull requests, no database change. PR 1 (copy and screens: items 1 to 5) is front end only plus one pure date helper; PR 2 (item 6) changes when requests start, not what they ask. Items 7 and 8 are decisions with no code. The critical item 1 is not a bug in the database: it is the generation rule as the spec decided it, plus a Home that does not explain it, so the fix is words and a computed date, and any change to the rule itself is a founder decision (question 1).

### 2.2 Item 1 diagnosis (from the code; staging could not be read)

I could not read staging: no `.env.local` or service key is on this machine, and the existing scripts (`smoke:env`, `check:db`) only ask which environment answers. So the diagnosis is from the migrations and the front end, and the founder or `release-manager` should run the read-only check in 2.2.3 to confirm which of the two cases below it is.

**2.2.1 What the code does.** The Home board (`src/components/board/board-store.ts`, `open()`) reads the month's dues and calls `ensure_my_dues()` in parallel on every open (never waited for). `ensure_my_dues()` calls `create_dues_for(now(), tutor)` (`supabase/migrations/20261012100000_r1_dues.sql`). That function creates a monthly due only when all of these hold:

- the due date (first of the month plus due day minus 1) is inside the 8 days ending today (India), that is 7 to 14 Oct on 14 Oct; and
- the due date is not before the India day the student was added (`created_at`); and
- the student is active with a fee above 0.

The nightly `pg_cron` job (`20261012120000_r1_dues_schedule.sql`, 00:30 India) runs the same function, so it behaves identically.

**2.2.2 Why this tutor sees nothing.** Due days 4 and 1 of October are 10 and 13 days before 14 Oct. Both are outside the 8-day window, so they can never be created now, by the job or by Home. Separately, if the students were added after the 4th (and the 1st), the "first due is on or after the day they were added" rule (R1-5 decision 7) also excludes October. Their next fees are 1 Nov and 4 Nov. "Nothing is due yet" is therefore what the rule produces, and the database is behaving as specified. The student's opening balance is 0, so there is no opening due either (that is created by trigger `sync_opening_due`, only when "Already owes" is above 0).

Two cases, which the check in 2.2.3 separates:

- **Case A (expected, by design):** students were created after 4 Oct and after 1 Oct, or before them but the app was not opened and the nightly job did not run within 7 days. If the job is running, a student created before 1 Oct would have had the due created on the day; if created between 2 and 4 Oct, the 4th's due only. Nothing is wrong in the code.
- **Case B (a real defect):** a student was created on or before the due date (for example created 29 Sep with due day 1, or 2 Oct with due day 4), the job should have made the due, and there is no `dues` row. That means the `generate-dues-daily` cron job does not exist or is failing on staging. The fix then is a forward migration or enabling `pg_cron` (the migration comment says to switch it on in Database, Extensions), not a rule change.

**2.2.3 The read-only check (task B1).** In the staging SQL editor or `psql`, select only:

- `select id, name, due_day, monthly_fee, active, created_at, opening_balance from public.students where tutor_id = '<founder tutor id>';`
- `select student_id, kind, month, due_date, amount, status from public.dues where tutor_id = '<founder tutor id>' order by due_date;`
- `select jobname, schedule, active from cron.job;` and `select status, start_time, return_message from cron.job_run_details order by start_time desc limit 10;`

If the cron job is missing, inactive or failing: Case B, `backend-dev` writes a forward migration (or the founder enables the extension); tell the lead. If it is healthy and the students were created after their due dates: Case A.

**2.2.4 The smallest correct fix.** None to the generation rule, and no migration. Reasons: generating "the current month's due when a student is added" would charge for a month the tutor may already have collected in cash before adopting the app; that is exactly what decision 7 and 6 exist to prevent (a 6-month-old archived student restored must not owe 6 months). The rule has a defined escape hatch, "Already owes", and the problem is that the tutor does not know it exists. So:

- Home states the next fee date when nothing is due (item 3's helper, section 2.3), and points to "Already owes" for anything owed from before.
- The add form's hints (item 5) tell the tutor, at the moment of adding, that "Already owes" is where a fee not yet paid for this month or earlier goes.

A stronger fix (ask at save time: "This month's fee was due on 4 Oct. Has it been paid?" and pre-fill "Already owes" if not) is new behaviour, not in the PRD, and changes the R1-5 first-due rule; it is founder question 1 and is not built.

### 2.3 Files

PR 1 (frontend-dev):

- `src/lib/dues-board.ts` (existing, holds `indiaToday`, `currentMonth`): add `nextDueDate(dueDay: number, today: string): string`, a pure function on `YYYY-MM-DD` strings. Returns this month's due day when it is after today's day, else next month's (rolling the year). Due day is 1 to 28, so no month-length table is needed. Today's day is excluded because a due on today's date is already created. Also `earliestNextDue(students, today)` returning the soonest date over active students with a fee above 0, or null. Put it beside its tests in `src/lib/dues-board.test.ts`.
- `src/components/board/board-states.tsx` (`NothingYet`): take the active students (or the computed date) as a prop; when the month is current and a date exists, show title "Nothing is due yet." (keep), then "{date}: the next fee appears on that day." and a second line about "Already owes", and the existing "See your students" button. Date through `formatDate()`. No hard-coded strings.
- `src/components/board/board-screen.tsx`: pass the roster's active students into `NothingYet` (it already holds `roster`).
- `src/components/landing/landing-header.tsx`: add a quiet text link "Sign in" next to the "Join waitlist" button, `href={localeHref(locale, signInPath)}` (a plain `<a>`; it is a server component, so use `useLocale()` as the hero does), `min-h-tap`, underline, `font-bold`, `text-on-cloth`, `ring:ground-ring` focus ring (as the hero's tool link). Wraps under the button when narrow; never truncates.
- `src/components/landing/landing-footer.tsx`: add the same link above the language list, `min-h-tap min-w-tap`, `text-on-cloth underline`, `ring:ground-ring`. The footer is shared with tool pages, so they get it too (intended).
- `src/components/attendance/attendance-placeholder.tsx`: coming-soon state (decision 2.4): heading, one sentence, and a `Button variant="outline"` "Back to Home" using `useSoftLink`. Not a new component in `ui/`: it only composes the Button and existing type roles.
- `src/components/students/student-form.tsx`: wrap the fields in three groups, each a `<fieldset>` with a `<legend>` styled with the existing `type-label` role (not smaller than 14px): Who (student's name, parent's name, parent's WhatsApp number, send messages in, the permission tick with its hint, batch), Fee (monthly fee, fee due on), Opening balance (already owes). The order of the existing fields within and across groups is otherwise kept so tab order and error summary behaviour do not change. One-line hint under "Already owes" and under the permission tick, using the same hint style the form already uses for `feeFromNextMonth`. Check that the hint is wired through `aria-describedby` with the field's error id too (the field component already supports a hint; reuse it).
- `messages/en.json`, `messages/hi.json`, `messages/kn.json`, `messages/te.json` (all four together; non-English `TODO-translate` where unsure):
  - `landing.header.signIn`, `landing.footer.signIn`
  - `board.empty.none.next` (with `{date}`), `board.empty.none.owed` (replaces the current `board.empty.none.body`; keep the old key until nothing uses it, then remove it from all four)
  - `attendance.soon` (reworded), `attendance.back`
  - `students.form.groupWho`, `students.form.groupFee`, `students.form.groupOwes`, `students.form.owesHint`, `students.form.permissionHint`

  Draft English: `owesHint` "What they owed before you started, or for this month if it is not paid yet. It shows on Home as an earlier balance." `permissionHint` "Tick once you have the parent's OK to keep their number here and message it on WhatsApp." `none.next` "Your next fee comes in on {date}." `none.owed` "Fees appear on each student's due day. If a parent still owes from before, add it under Already owes." Final wording belongs to `product-manager` copy review.
- Existing tests that mention the old strings or the form's field order (`src/components/students/student-form*.test.tsx`, `e2e/student-form.spec.ts`, `e2e/board.spec.ts` near "Nothing is due yet", `e2e/landing.spec.ts`, any attendance e2e) are updated for the new words. No assertion about behaviour is deleted.

PR 2 (frontend-dev), item 6:

- `src/lib/supabase.ts`: no change to the dynamic import.
- `src/app/[locale]/(app)/layout.tsx` (or `src/components/app/app-gate.tsx`): call `preconnect(supabaseUrl)` from `react-dom` (no dependency; it is React's own API) so DNS and TLS to the Supabase host start while the JS loads. Supabase URL comes from `src/lib/supabase-env.ts`.
- `src/components/app/roster.tsx` and `src/components/app/app-gate.tsx`: only if measurement (task F6a) shows the sequence below costs more than about one second: start the students and batches read as soon as `userId` is known, in parallel with `getTutor()`, through a small module-level promise keyed by `userId` that `RosterState.read` consumes once; discarded on sign-out. Rejected: starting it before the session is known (a signed-out visitor must make no data call).

### 2.4 Decisions made here

- **Item 4, Attendance: keep the item and build a proper coming-soon state; do not hide it.** Reasons: PRD section 6 fixes the bottom navigation as Home, Students, Attendance, More; R1-3 criterion 2, D1 criterion 7 and the e2e navigation tests all assert four items; hiding it changes the PRD's navigation and must be undone in R1-11, and the parent pay page already promises an attendance count. The link works (it opens a screen), so the "never show a button that cannot work" rule is met by making the screen honest and giving a way back. If the founder prefers hiding (question 3), it is one change in `app-nav.tsx` and the nav tests.
- **Item 3, first-run guidance: nothing beyond the PRD.** PRD section 5 gives the onboarding path (language, sign-in, setup, add students, "home shows pending total"). There is no checklist or "next step" widget in PRD.md. The no-students state already has a title, a line and the "Add a student" button, so it stays. The students-but-nothing-due state gets the date line (item 1). A multi-step checklist (add students, set UPI, send first reminder) is not built: founder question 2. The PRD's "big 'Send reminders now'" belongs to a state with dues.
- **Item 7, contrast: passes, no change.** Computed with the WCAG relative luminance formula on `src/styles/tokens.css`: `on-cloth-soft` `#FBF1C8` (hero body, `text-on-cloth-soft`) on `cloth` `#A81C22` is 6.49:1; `on-cloth` `#F7E7A0` on cloth is 5.92:1; both on `cloth-deep` `#5E0D11` are 12.01 and 10.96. AA needs 4.5:1 for body text; all pass (and 6.49 passes for normal text without any large-text allowance). The review impression comes from the red's saturation, not the ratio. A regression guard is cheap: add a unit test that computes these ratios from the token file so a future token edit cannot break AA (task F7).
- **Item 8, desktop: leave it, because D1 already owns it.** D1a (side navigation, book, dialogs; merged in #21) is on main. The remaining improvement is D1b, the two-pane board, already specified in `docs/specs/D1-desktop-layouts.md` (criteria 12 to 18) and not yet built. A "smallest tasteful tweak" now would be throwaway work that D1b replaces. Recommendation: schedule D1b; nothing in this slice. Founder question 4 asks whether D1b should be next.
- **Item 6 safety rule:** nothing starts a data call before a session exists, nothing is skipped, RLS stays the wall. The change only moves when calls start.

### 2.5 Data

None. No migration, table, policy, function or Edge Function. The one possible database follow-up is conditional on the check in 2.2.3 (Case B: cron missing or failing): a forward migration or enabling `pg_cron`, written by `backend-dev`, run on staging by `release-manager`, and on production only with the founder's approval. If it turns out to be needed, the plan is amended here before work starts.

### 2.6 Work split

1. `backend-dev` (B1), read-only, no code: run the checks in 2.2.3 against staging with `release-manager` (this machine is linked to staging only) and write the answer (Case A or B, with the rows) under "Findings" at the end of this file. If Case B, stop and tell the lead before PR 1 is merged; the fix is a forward migration, not a rule change.
2. `frontend-dev` (F1): `nextDueDate` and `earliestNextDue` in `src/lib/dues-board.ts` with unit tests.
3. `frontend-dev` (F2): the four message files, all new keys together (do this in one commit to avoid conflicts with R1-9 Part C, which also edits `messages/*.json`; rebase first).
4. `frontend-dev` (F3): `NothingYet` and `board-screen.tsx` (item 1 and the students-but-nothing-due part of item 3).
5. `frontend-dev` (F4): landing header and footer "Sign in" links (item 2).
6. `frontend-dev` (F5): Attendance coming-soon state (item 4) and the add-student form grouping and hints (item 5).
7. `frontend-dev` (F7): AA contrast unit test over the tokens (item 7).
8. `test-engineer`: tests below; then `code-reviewer`, then `lead-reviewer`. This ends PR 1.
9. `frontend-dev` (F6a): measure first paint on staging, throttled (Slow 4G, 4x CPU) with the Playwright trace or DevTools: record time to JS, to `getSession`, to `getTutor`, to the roster, to the first dues row, before any change. Write the numbers under "Findings".
10. `frontend-dev` (F6b): `preconnect` and, only if F6a justifies it, the roster prefetch. Re-measure; keep the change only if it saves at least 15 percent or 500 ms; otherwise revert and report. This is PR 2.

### 2.7 Tests required

- [unit] `src/lib/dues-board.test.ts`: `nextDueDate` for due day after today (same month), equal to today (next month), before today (next month), 28 in December (rolls to January of next year), due day 1 on the last day of a month; `earliestNextDue` ignores archived students and fee 0, returns null when none. Maps to criteria U1, U2.
- [unit] `src/components/board/board-states.test.tsx`: `NothingYet` current month with a date shows the date through `formatDate`; with no date shows the plain title; past month unchanged. U1 to U3.
- [unit] `src/components/students/student-form.test.tsx`: the three groups exist with legends; both hints are described-by their fields; the order of fields inside groups is unchanged; error behaviour unchanged. Item 5.
- [unit] token contrast test: every on-cloth pair at least 4.5. Item 7.
- [unit] `src/components/no-direct-writes.test.ts` still passes (no new write call; the roster prefetch only reads).
- [e2e] `e2e/board.spec.ts`: a tutor with two students due on days 1 and 4, no dues, today fixed to 14 Oct 2026 (the existing fake clock): Home shows "Nothing is due yet." with "1 Nov 2026" and the "Already owes" line and the "See your students" link; the same at 360px and with large text, in Hindi too (no cut text, amounts and dates with 0 to 9 digits). U1 to U4.
- [e2e] `e2e/landing.spec.ts`: header and footer each have a "Sign in" link that is at least 44px high, goes to `/en/sign-in/` (and each other language's), is reachable by keyboard with a visible focus ring, and the header does not overflow at 360px or at large text in `hi`, `kn`, `te`. Item 2.
- [e2e] Attendance screen: title, the sentence, a "Back to Home" button that goes to Home; the bottom navigation still has four items with Attendance current. Item 4.
- [e2e] `e2e/student-form.spec.ts`: groups in order, both hints visible, the permission tick still blocks saving until ticked, saving still works. Item 5.
- [e2e] Existing phone suite passes with no assertion about behaviour removed (wording updates only). `pnpm i18n:check` passes; `pnpm size` for `/[locale]` landing, `home` and `students/new` is within 200 KB gzipped (the change adds about 1 KB of words and one pure function).
- [e2e] PR 2: signed-out visit to an app route makes no request to the data host other than the session check (the gate test already covers it; confirm it still passes with the preconnect); the app still reaches Home with the roster prefetch on, and the prefetch is discarded on sign-out.
- [db] None. No pgTAP change (no table, no function change). The existing `110_dues_generation.sql` and `120_ensure_my_dues.sql` stay green and prove the rule is unchanged.

Criteria referred to above: U1 the date shown is the earliest next due date over active students with a fee; U2 it is formatted `DD MMM YYYY` in the page's language with 0 to 9 digits; U3 it is shown only for the current month with filter All and nothing in view; U4 the "Already owes" line and "See your students" link are present and at least 44px.

### 2.8 Risks and traps

- **Fixing the wrong thing.** Changing generation so the add flow or Home creates a past-due current-month row would bill months already collected. The plan changes no generation code and puts the choice to the founder (question 1).
- **Date maths in a client.** Do not use `Date` with the phone's time zone: `nextDueDate` works on `YYYY-MM-DD` strings and takes today from `indiaToday()`, as the board does, so a phone set to London shows the same date.
- **Form regrouping breaks the tests and the error summary.** Keep field ids and names; only wrap in fieldsets. Run the e2e form flows.
- **Fieldset legends on small screens and in Indic scripts.** Let legends wrap; no fixed heights; at least 14px.
- **The footer link also appears on tool pages.** Intended; the tool-page e2e must not count footer links exactly.
- **Message files collide with R1-9 Part C.** One commit for all four files, rebased immediately before the pull request.
- **Prefetch leaks data across accounts.** Key the promise by `userId`, consume once, drop on sign-out and on a different `userId`.
- **"Faster" that is only a guess.** F6a measures first. The staging region may be the real cost (a far-away project), which code cannot fix; if so, report it as a founder question and revert F6b.
- **The 5 s may be a cold staging database or an expired token refresh** (one more round trip before anything). `preconnect` helps both only partly. Report honestly.

### 2.9 Not doing

- Changing the dues generation rule, the 8-day window, or generating the current month's due at add time.
- A "has this month's fee been paid?" question at save time (founder question 1).
- A getting-started checklist or progress widget (founder question 2), "try with sample data", or a Send reminders prompt on an empty board.
- Hiding the Attendance item or building any attendance feature (R1-11).
- The two-pane desktop board (D1b), any other desktop change, a dark mode.
- A service worker, skeleton rework, or caching the board (R1-12 offline).
- New dependencies. `preconnect` is part of `react-dom`, already installed.
- Changing tokens or colours (contrast passes).
- Translating the new keys beyond what the translators already provide; unsure ones are `TODO-translate`.

## 3. Rollout order

1. B1 (read-only staging check) first; it can run while F1 starts. If Case B, stop and fix cron before anything else.
2. PR 1: F1, F2, F3, F4, F5, F7, then tests and review. Ships to staging via `release-manager`; no migration, so nothing needs the founder's production approval beyond the usual release.
3. PR 2: F6a measure, F6b change, re-measure, decide. Separate pull request so it can be reverted alone.
4. D1b stays in its own slice (question 4).

## 4. What to test by hand on a phone (360px, then large system font)

1. Open the landing page in each language: "Sign in" is in the top bar and at the foot, easy to tap with a thumb, readable on the red, not cut off in Hindi, Kannada or Telugu. Tap it: the sign-in screen opens in the same language.
2. Sign in as the tutor with two students due on the 1st and 4th. Home says nothing is due, names the next date (1 Nov 2026) and tells you where to put an earlier balance. The wording is clear to someone who does not know the app.
3. Open a student, put ₹2,000 under "Already owes", save: Home now shows an Overdue "Earlier balance" row for ₹2,000.
4. Add a student: three groups with headings; each hint is one line (two at large text); tick the permission box; save. Try each language.
5. Tap Attendance: the screen says it is not ready, nothing looks broken, "Back to Home" works, the bottom bar still has four items.
6. Cold start: close the app tab, reopen Home on mobile data. Note the seconds until the first student row appears, before and after PR 2.
7. Airplane mode, open Home: the offline behaviour is unchanged.
8. Change the phone's time zone to London and open Home: the next-fee date does not change.

## 5. Open questions for the founder

1. **The tutor who joins mid-month.** Today a student added after their due day gets no fee for that month; the tutor must type it under "Already owes". Do you want a question at save time ("This month's fee was due on 4 Oct. Paid already? If not, add it as owed") or do you prefer the rule as it is with better words? Recommendation: better words now (this slice), the save-time question only if tutors in the 5-tutor checkpoint trip on it. The question changes R1-5 decision 7 and is not in the PRD. Also still open from R1-5: should every month's fees appear on the 1st instead of on each due day (R1-5 question 1; the lead kept the PRD rule on your standing instruction)? That would show the whole month at once but would not fix this case either.
2. **A first-run checklist.** The PRD has an onboarding flow but no on-screen checklist. Do you want one (for example: add students, set UPI, send the first reminder)? Recommendation: wait until the 5-tutor checkpoint shows where people stop. Not built.
3. **Attendance in the navigation.** Keep the item with a proper coming-soon screen (recommended, because the PRD's navigation has four items) or hide it until R1-11?
4. **Desktop.** Leave the app as it is on wide screens until D1b (the two-pane board), which is specified but not built. Should D1b be next, or after R1-10 and R1-11?
5. **Staging speed.** If F6a shows the wait is mostly the Supabase region (distance to India), do you want to move the staging and production projects to the Mumbai region (ap-south-1)? That is a project change on your Supabase account, not a code change, and production needs your approval.

## 6. Findings (filled in during the work)

- B1: (staging check result, Case A or B)
- F6a: (before numbers)
- F6b: (after numbers, kept or reverted)

## 7. Sources read

`PRD.md` sections 4 to 6; `docs/BUILD_PLAN.md` (decisions 5 and 6, slice table); `docs/specs/R1-5-dues.md` (decisions 5 to 7, criteria 17 to 29, question 1, risks); `docs/specs/D1-desktop-layouts.md`; `supabase/migrations/20261012100000_r1_dues.sql`, `20261012120000_r1_dues_schedule.sql`; `src/components/board/board-store.ts`, `board-states.tsx`, `board-screen.tsx`; `src/components/home/*`; `src/components/app/app-gate.tsx`, `roster.tsx`, `loading-book.tsx`, `app-nav.tsx`; `src/lib/auth.ts`, `supabase.ts`, `dues.ts`; `src/components/landing/*`; `src/components/attendance/attendance-placeholder.tsx`; `src/styles/tokens.css`; `messages/en.json`.
