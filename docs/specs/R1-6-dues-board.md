# R1-6: the dues board (home)

Slice R1-6 "Dues board (home): month switcher, tabs, batch filter, student strip" (docs/BUILD_PLAN.md section 5). Depends on R1-3 (roster, `BatchFilter`; merged) and R1-5 (the `dues` table, `generate_dues`, `ensure_my_dues`; migration `20261012100000_r1_dues.sql`).

Process: full process (money screen). This is the stage-1 spec for the board alone. `docs/specs/R1-5-dues.md` already holds the long R1-5 and R1-6 spec and the technical plan (its section 6 is the front-end plan, its criteria 40 to 84 are the long form of the ones below). Where this file and that one differ, this file wins for R1-6 and the differences are listed in section 12. `tech-lead` does not need a new plan unless something in section 12 changes the files; it appends only what differs.

Tags: [unit] Vitest, [e2e] Playwright at 360px with the fake Supabase host, [db] pgTAP, [manual] by hand on a phone against staging.

## 1. Goal

A tutor opens the app and sees, in one glance, who still owes money this month and how much: one amount "Still to come in", a strip with one block per student, and the fees sorted into Overdue, Due and Paid. She can go back to earlier months and narrow it to one batch. Before this slice the home only counts students.

## 2. Users and moment

The tutor, on a low-end Android between classes, one thumb, often on slow 4G, usually just opened from the home-screen icon. One question: who has not paid, and how much. She types nothing on this screen. The parent never sees it. Recording a payment (R1-7) and reminding (R1-8) come next; until they land this screen is read-only.

## 3. Defaults chosen (no founder input needed)

These are the open questions, answered so work is not blocked. The founder can reverse any.

1. **Fee appears on the student's due day (PRD rule), not on the 1st.** Already decided by the lead on 2026-10-12 (R1-5 spec, "Decided by the founder"). The board therefore shows only fees already reached. Switching to "everything on the 1st" is a one-function change in the database and an empty-state copy change here; it is not built.
2. **Overdue starts the day after the due date.** No grace days. On the due date the tag says "Due today".
3. **Today is today in India (Asia/Kolkata)**, never the phone's date or time zone.
4. **One row per due, not per student.** A student with two unpaid dues has two rows. Student counts and row counts are labelled separately.
5. **Carried-over dues:** the current month also lists every unpaid earlier-month due and every unpaid opening balance, each marked. Past months show only that month's own dues. Paid earlier dues leave the board.
6. **Opening balance is overdue at once**, labelled "Earlier balance", no "days late".
7. **Batch filter is the R1-3 `BatchFilter`, forced to its select form** (tabs would sit under two other tab rows). Hidden when the tutor has no batch.
8. **A "collected" line under the amount** ("{amount} collected") shows only when above ₹0. It is not on the main canvas; the founder can delete it.
9. **Read-only.** No Remind, Mark paid, "to confirm", "Remind all". One quiet line says they are coming. No sample data link.
10. **Header scrolls away.** The collapsed-header canvas (`Home-scrolled`) is not built.
11. **A row opens the student's edit screen** (`students/edit/?id=`) until a real Student detail exists.
12. **Month, tab and batch filter are remembered while the tutor stays in the book** (open a student, come back: same view). They reset on sign-out. No storage on the phone.
13. **No client write to `dues`.** The only request that is not a read is the empty-bodied call to `ensure_my_dues`, made each time the board opens, which asks the database to create any due that is missing. A slow or failed call changes nothing on screen.
14. **The empty home (no active students) is unchanged**, and sends no dues request.
15. **Removed from the R1-3 filled home:** the slip, "See all students", the second "Add a student", and "Who owes what appears here in a later update." The Students tab is the way to those.

## 4. Acceptance criteria

PRD criterion, word for word: "Month switcher; header "₹X pending from N students"; tabs Overdue / Due / Paid; partial status; batch filter". The header wording follows the canvas ("Still to come in" and "from n of m students"); it carries the same two numbers.

Route `home/`, inside the sign-in gate and the roster provider. Tests use the fake Supabase host, a fixed clock of 2026-10-12 05:00 UTC (10:30 India) unless stated.

### Days, status and money (pure code)

1. [unit] `indiaToday(now)` returns the India calendar day. 18:29:59 UTC gives that UTC date; 18:30:00 UTC gives the next. Same answer when the test process runs under UTC, America/Los_Angeles, Asia/Kolkata and Pacific/Kiritimati (time zone really changed and asserted). No `Date` local getters, no `Intl`.
2. [unit] Status of a due given today: `paid` is Paid whatever the date. Unpaid or part paid with due date before today is Overdue with days late (1 or more). Due date equal to today is Due, tag "Due today". Due date after today is Due. Part paid and not late is Due with the Part paid tag. An unpaid opening due is Overdue with no day count. Table rows for yesterday, today, tomorrow, 31 Oct to 1 Nov, and 28 Feb to 1 Mar in a leap and a non-leap year.
3. [unit] The view of month M contains M's own dues; when M is the current India month it also contains every unpaid earlier due and every unpaid opening due. Never a due of an archived student or of a student not in the roster. Paid earlier dues are not included. The batch filter (All, No batch, one batch) applies through the student's current batch.
4. [unit] Order inside a tab. Overdue: opening balances first, then most days late, then name. Due: soonest due date, then name. Paid: name. Name compares as R1-3's `sortStudents` does. Ties end on the due id so the order never flickers.
5. [unit] Totals, all integer paise: pending is the sum of (amount minus amount paid) of unpaid rows; collected is the sum of amount paid of rows whose month is M (carried rows do not count); students counts distinct students with an unpaid row; students in view counts distinct students with any row; tab counts are rows. Sum of 300 dues of ₹10,00,000 is exact.
6. [unit] Strip: one block per student in the view, Overdue if any row is overdue, else Due if any row is unpaid, else Paid. The three legend numbers add up to the block count.
7. [unit] Default tab is Overdue if it has rows, else Due, else Paid. After the tutor taps a tab it stays until she taps another, even when data refreshes.
8. [unit] Month moves: previous is allowed while the month is after the earliest month that has a monthly due; next is allowed while the month is before the current India month. With no dues, both are off.
9. [unit] The dues reader names its columns (`id, student_id, kind, month, amount, amount_paid, status, due_date`), never `*`, never sends `tutor_id`, reads in pages of 1,000 (a fake holding 2,350 rows returns all 2,350 in order), and fails whole if any page fails. A row with an unknown status or kind, or a non-integer amount, fails the read rather than drawing a wrong amount.

### The screen

10. [e2e] A tutor with no active students (none, or all archived) sees the empty home exactly as before, no month switcher, and no request for dues is made.
11. [e2e] A tutor with active students sees, top to bottom: month switcher, the amount block, the batch select (only when she has a batch), the strip with its words, the three tabs, the list, and the bottom nav with Home current (`aria-current="page"`). The R1-3 filled home items (decision 15) are gone.
12. [e2e] Month switcher: "Previous month" and "Next month" buttons, each at least 44px square with that accessible name, around the month and year ("October 2026": month word from the page's language, year in 0-9 digits). Next is disabled in the current month; previous is disabled on the earliest month. A disabled button is still drawn at 44px and is announced as disabled. Tapping moves the whole screen to that month. The year is never hidden by wrapping.
13. [e2e] Amount block: "Still to come in", the pending total in the headline face with Indian grouping and 0-9 digits (`₹18,500`), then "from {n} of {m} students". The collected line shows only when collected is above ₹0. It fits at 360px and at the largest font up to `₹10,00,00,000`, never cut, never sideways scroll.
14. [e2e] Strip: one block per student, with the text legend under it ("14 paid", "4 due, hollow", "5 overdue, tall") and a text alternative ("23 students: 14 paid, 4 due, 5 overdue"). With no rows in the view nothing is drawn (no strip of zeros).
15. [e2e] Tabs: Overdue, Due, Paid, each with its row count. Tapping a tab shows only its rows and makes no network request. A tab with no rows says, for the current month: "Nobody is overdue." / "Nothing else is due this month." / "Nobody has paid yet this month."; for a past month: Overdue "Nobody is overdue." / Due "Nothing else was due that month." / Paid "Nobody paid that month."
16. [e2e] Row: status tag (word plus mark: "Overdue 7 days", "Due", "Due today", "Part paid", "Paid"), the student's name, a line with "Due 10 Oct 2026" (DD MMM YYYY), the batch name when there is one, and "Part paid ₹500" when part paid; an earlier month's row says "{Month} fee" and an opening balance says "Earlier balance". On the right, the remaining amount for Overdue and Due rows and the full amount for Paid rows, in the mono face with Indian grouping. A student with two dues has two rows.
17. [e2e] A whole row is one link to `students/edit/?id=<student id>`, at least 66px high, growing with long names, long batch names, the largest font, and Hindi, Kannada and Telugu. Nothing is cut with an ellipsis. No button or link inside it. No Remind or Mark paid anywhere.
18. [e2e] Batch select: when the tutor has at least one batch it offers All batches, each batch with its student count, and "No batch" when some active students have none; 44px target. Choosing one changes the amount, strip, tab counts and rows together, with no network request. If the chosen batch is deleted elsewhere the board falls back to All batches. Hidden with no batches.
19. [e2e] Remembered view: month, tab and batch choice are the same after opening a student from a row and coming back. They reset after sign-out.
20. [e2e] End of list: under a tab that has rows, one line: "That is everyone who is overdue." / "...who is due." / "...who has paid."
21. [e2e] Nothing at all in the view, filter All, current month: "Nothing is due yet." / "A student's fee appears here on their due day." and a link "See your students" to `students/`. A past month with no rows: "No fees were due in {month}."
22. [e2e] Nothing in the view only because of the batch filter: "Nothing in {batch} for {month}." and a "Show all batches" button that clears the filter.
23. [e2e] All paid (rows exist, none unpaid): the amount is replaced by the stamp (ALL PAID and the month), "Nothing left to collect.", "Collected {amount}", "Students {n} of {n}", and "{Month} fees will appear here on each student's due day. You do not need to do anything." Tabs and list stay below so the Paid tab can be opened. Tested with made-up data (reachable on staging only after R1-7).
24. [e2e] The quiet line "Reminders and Mark paid arrive in a later update." sits under the amount block.

### Loading, failure, freshness

25. [e2e] Loading: until the roster and the first dues read are back, the month, "Still to come in", grey blocks in the shapes of the amount and rows, and "Opening your book…" (never a spinner alone). With a cached roster and cached dues they show at once and refresh quietly.
26. [e2e] Read failed with nothing cached: banner "Couldn't load your fees" / "The network dropped. Nothing is lost." and "Try again", which reads again. With a cache the board stays and a quiet line says "Showing what was saved on this phone." Never signs the tutor out.
27. [e2e] Offline after the first load: the cached board stays with the quiet line and no dues request is sent. Opened offline with nothing cached: the error state of criterion 26.
28. [e2e] On every opening of the board, while online, `ensure_my_dues` is called (POST, empty body) in parallel with the reads. If it returns more than 0 the dues are read once more. If it fails or is slow, nothing is shown and nothing waits for it. Moving between months already read within 60 seconds sends no request.
29. [e2e] Day change: with the board open on the evening of 12 Oct India time, then the clock moved past midnight India time and the page made visible again, a due that was "Due today" says "Overdue 1 day", tab counts update, and `ensure_my_dues` is called again. No timer is used.
30. [e2e] A due whose student is not yet in the roster (added on another phone) is left out and makes the roster re-read once; it shows afterwards.

### Safety and cross-cutting

31. [e2e] Time zone: with the browser set to America/Los_Angeles and again to Pacific/Kiritimati and the clock at 2026-10-12 05:00 UTC, days late, the month label and tab counts are identical to India time.
32. [e2e] The board sends no insert, update or delete to any table. Requests carry no `pay_token`, no parent phone, no parent name from the dues read. No cookie. Only the page's own host and the Supabase host are contacted. No analytics event fires.
33. [db] RLS on `dues` already proves tutor B reads none of tutor A's dues (R1-5 files 090 to 130, unchanged here). This slice adds no migration. [manual] On staging, the Network tab shows the dues request returns only the founder's rows.
34. [e2e] 360px and largest system font, in en, hi, kn and te, with 60 students, an 80-character name with no spaces, Hindi, Kannada and Telugu names, a 60-character batch name, a part paid row, an opening-balance row, `₹10,00,000` on a row and `₹1,00,00,000` in total: no sideways scroll, nothing wider than its box, every button, link and tab at least 44px, nothing under 14px, the strip wraps past 28 students with no block under 8px.
35. [e2e] Status is never colour alone: with forced grayscale each row still says its word and has its mark (solid outline, fill, dashed outline, double outline).
36. [unit] Every new word is in `messages/{en,hi,kn,te}.json` (namespace `board`; section 9) and `pnpm i18n:check` passes. Amounts, the year and counts use 0-9 digits and the Latin faces in every language; Hindi, Kannada and Telugu use their own faces and rules. No English in components, no brand name outside `brand.ts`. No money is a float: a test searches the board code for `parseFloat`, `toFixed`, `Math.round`, local-time `Date` getters and `Intl.`.
37. [e2e] `pnpm size`: initial JS for `home` at most 200 KB gzipped (target 170 KB), all four languages. No new dependency, no new `ui/` component.

## 5. Edge cases

- **Empty month, current:** "Nothing is due yet." (criterion 21). This is normal for a new tutor whose students' due days have not come, and on the 1st before the first run.
- **Empty month, past:** "No fees were due in {month}." The next button still works.
- **A month with nothing due but students exist and a carried balance:** the current month shows the carried rows, so it is not empty.
- **A month where everything is paid:** criterion 23.
- **Future months:** not reachable. Next is disabled in the current month; nothing is generated for the future.
- **Large amounts:** `₹1,23,456`, `₹10,00,000` on a row, `₹10,00,00,000` in the headline. Indian grouping only, display only through `formatRupees`. The headline shrinks to fit; it never cuts or scrolls.
- **Archived students:** their rows and amounts are out of every number, the strip and the filter counts. Restoring brings them back. Their dues are never deleted.
- **Students with no batch:** they belong to "No batch" in the select and show no batch name on the row. Deleting a batch moves its students there and the board follows after the next read.
- **A student's batch changed:** the row follows the student's current batch.
- **Same name twice:** both rows show; due date and batch tell them apart.
- **Very long name or batch name:** wraps, never cut.
- **Offline or slow network:** criteria 25 to 28. The cached board shows; "days late" use the phone's clock for the India day from the instant, which is wrong only if the phone's clock is wrong (accepted).
- **Partial payment:** a part paid row shows "Part paid ₹500" and the remaining amount; Overdue keeps its Overdue tag if late. Cannot exist before R1-7; tested with made-up rows.
- **Duplicates:** database keys prevent a second due per student and month and a second opening due; the board shows what the database holds. Calling `ensure_my_dues` twice is safe.
- **Student with no phone:** same row. ("Add a number first" is R1-8.)
- **More than 1,000 dues:** read in pages; a failed page fails the whole read.
- **Many months unpaid:** every unpaid earlier due is its own Overdue row (a tutor away for six months may see hundreds). Accepted; fixing or waiving a due is a later slice.
- **Second language:** month names, tags, tabs and plurals come from messages; kn and te values are English placeholders until reviewed.
- **Two phones, one tutor:** the board refreshes on opening; it writes nothing, so no conflict.
- **Parent opening an old link:** not applicable, no parent page exists yet.
- **Day rolls over while open:** criterion 29. The view moves with the current month if the tutor has not picked another.

## 6. Out of scope

| Not here | Where |
| --- | --- |
| Mark paid, payments, receipts, undo banner, locking "Already owes" after a payment | R1-7 |
| Remind, "Remind all", "reminded 2 days ago" | R1-8 |
| "{n} to confirm", claims | R1-10 |
| Pay link and pay page | R1-9 |
| Offline banner and queued changes, a cache kept after closing the app | R1-12 |
| Editing, waiving or deleting a due | later slice (founder question, answered "later") |
| A real Student detail screen | unowned; rows go to the edit screen meanwhile |
| Collapsed sticky header (`Home-scrolled`) and desktop board (`Home-desktop`) | not in Release 1 |
| Search on the board, sort options, paging of the list | not in the PRD |
| Grace days, late fees | not in the PRD |
| Sample data | R1-3 question 1 |
| Analytics events | R1-14 |
| Any migration, any change to `dues` | R1-5 is done; none needed |
| Any new dependency or `ui/` component | not allowed |

## 7. Design references

`design/project/` (from `canvas.json`):

- `Home.dc.html` ("4 Home: dues board"): month switcher, "Still to come in", strip and legend, tabs with counts, row layout. Not built from it: the blue "Remind all", round Remind buttons, "2 to confirm", future due dates (decision 1), "2 months pending" combined row (decision 4).
- `Home-hi.dc.html` ("Dues board in Hindi"): Hindi words. Its headline-face amounts in rows are overruled by DESIGN.md (mono in rows).
- `State-allpaid.dc.html`: criterion 23.
- `State-loading.dc.html`: criterion 25.
- `State-error.dc.html`: criterion 26.
- `State-empty.dc.html`: the empty home, unchanged.
- `State-offline.dc.html`: R1-12, not drawn.
- `State-undo.dc.html`, `Student.dc.html`: wording "Part paid ₹500" and "Overdue 7 days"; the screens are R1-7.
- `Home-scrolled.dc.html`, `Home-desktop.dc.html`: not built.
- `Nav.dc.html`, `Main.dc.html`, `Interaction.dc.html`, `Type-indic.dc.html`: nav, tags, press and focus, Indic type rules.

## 8. Analytics

None of the PRD section 4 events fires in this slice. `reminder_sent` (R1-8) and `payment_marked` (R1-7) are the nearest. A "board viewed" event is not in the PRD and is not added. All events are wired in R1-14. No event may carry a name, phone or amount.

## 9. Copy

English; Hindi where the canvas draws it (`Home-hi`). Every other Hindi, Kannada and Telugu value is `TODO-translate: <English>` until a reviewer fills it. Add every key to all four files together. Namespace `board`; the `home` page's `ClientMessages` lists it. Loading line reuses `appState.loading`; the filter label reuses `students.filterLabel`. Remove `home.filled.*` and `home.seeAll` if nothing else uses them.

| Key | English | Hindi (canvas) |
| --- | --- | --- |
| board.prev / next | Previous month / Next month | पिछला महीना / अगला महीना |
| board.months.1 to 12 | January to December | अक्टूबर only; rest TODO |
| board.monthYear | {month} {year} (year passed as text) | |
| board.hero.label | Still to come in | अभी आना बाकी |
| board.hero.from | {m, plural, one {from {n} of # student} other {from {n} of # students}} | {m} में से {n} छात्रों से |
| board.hero.collected | {amount} collected | |
| board.tab.overdue / due / paid | Overdue / Due / Paid | देर से / बाकी / जमा |
| board.legend.paid / due / overdue | {n} paid / {n} due, hollow / {n} overdue, tall | {n} जमा / {n} बाकी / {n} देर से |
| board.strip.label | {total} students: {paid} paid, {due} due, {overdue} overdue | {total} छात्र: {paid} जमा, {due} बाकी, {overdue} देर से |
| board.tag.overdue | Overdue {n, plural, one {# day} other {# days}} | |
| board.tag.overdueOpening / due / dueToday / partPaid / paid | Overdue / Due / Due today / Part paid / Paid | |
| board.row.dueOn | Due {date} | |
| board.row.partPaid | Part paid {amount} | ₹500 जमा |
| board.row.monthFee / earlier | {month} fee / Earlier balance | |
| board.empty.tab.overdue / due / paid | Nobody is overdue. / Nothing else is due this month. / Nobody has paid yet this month. | |
| board.empty.tab.dueOld / paidOld | Nothing else was due that month. / Nobody paid that month. | |
| board.end.overdue / due / paid | That is everyone who is overdue. / ...who is due. / ...who has paid. | |
| board.empty.none.title / body / link | Nothing is due yet. / A student's fee appears here on their due day. / See your students | |
| board.empty.monthOld | No fees were due in {month}. | |
| board.empty.filter / showAll | Nothing in {batch} for {month}. / Show all batches | |
| board.allPaid.stamp / title / collected / students / of / next | ALL PAID / Nothing left to collect. / Collected / Students / {n} of {m} / {month} fees will appear here on each student's due day. You do not need to do anything. | |
| board.soon | Reminders and Mark paid arrive in a later update. | |
| board.loadError.title / body / retry | Couldn't load your fees / The network dropped. Nothing is lost. / Try again | |
| board.stale | Showing what was saved on this phone. | |

## 10. Privacy

The board reads only what the PRD already stores about a student and a fee: names, batch, amounts, dates. It shows the tutor's own data to the tutor and never a phone number. Dues reads never include parent name or phone, `pay_token`, or `tutor_id`. Another tutor's rows are kept out by row-level security (R1-5). Nothing is visible to a parent. No cookies, no analytics, no new third party.

## 11. Test by hand on a phone

Staging-backed build, signed in with Google, 360px wide, then again with the largest system font. At least three students. R1-5's migration is already on staging.

1. Open Home with no students: the empty home, unchanged.
2. Add a student with "Already owes ₹2,400". Go to Home: you see the month and year, "Still to come in", `₹2,400`, "from 1 of 1 student", a strip with one tall block and words under it, three tabs, and a row in Overdue saying "Earlier balance" and `₹2,400`. No Remind, no Mark paid. The "arrive in a later update" line is there.
3. Add a student whose due day is today, fee `1200`. Back on Home, within a second or two a row "Due today" with `₹1,200` is in the Due tab and the strip gets a hollow block. The amount is now `₹3,600`.
4. Edit the first student's "Already owes" to `1,500`: Home shows `₹1,500`. Set it to `0`: the row is gone.
5. Tap a row: that student's edit screen opens. Go back: same month and tab.
6. Previous month arrow: disabled when no earlier month has dues. Next arrow: disabled in the current month.
7. Add a batch and put one student in it. The batch select appears; pick it: amount, strip, tabs and rows show that batch only. Pick All batches. Delete the batch on another phone, return: All batches.
8. Archive a student with a due: the row and amount leave Home. Restore: it returns.
9. Tomorrow, open Home: the "Due today" row says "Overdue 1 day" and sits under Overdue.
10. Change the phone to London time and open Home: month label, days late and counts do not change. Change it back.
11. Airplane mode, open another screen, return to Home: the board stays with "Showing what was saved on this phone." Turn the network on and tap Try again if shown.
12. Switch the app to Hindi, Kannada and Telugu: month, tabs, tags read cleanly, amounts keep 0-9 digits, nothing is cut or runs off the screen, tap targets feel at least as big as a thumb.
13. Table editor, `dues` on staging: `amount` is in paise (`120000` for ₹1,200), `due_date` a plain date, `tutor_id` yours.
14. Not testable on staging yet: Overdue by days after a due day passes (wait a day or use step 9), Part paid and Paid (R1-7). The e2e tests cover them with made-up data.

## 12. Open questions and differences from the R1-5 spec

Open questions, each with a default. Nothing blocks.

1. **When does a fee appear (due day versus the 1st)?** Default: due day, as decided on 2026-10-12. Reversible in one database function. Early in the month the board will look sparse; if that disappoints on the founder's first look, say so and the generation rule changes (R1-5 spec, section "Decided by the founder").
2. **Keep the "{amount} collected" line?** Default: keep. One line to delete.
3. **How does a tutor drop or fix a wrong due?** Default: later slice after R1-7; archive the student meanwhile.
4. **Should a tutor with many old unpaid months get a "write off older than N months" action?** Default: no; same later slice as question 3.
5. **Sticky collapsed header?** Default: not in this slice.

Differences from `docs/specs/R1-5-dues.md` (section 4, criteria 51 to 82), none that change the plan's files:

- The long-form board criteria (R1-5 spec 40 to 84) are merged into 37 here (R1-5's 76 and 77 are one criterion, 32; 79 is 35; 80 is folded into 36; 82 "no timer" is folded into 29). R1-5's 73 (tab order: month buttons, batch select, tabs, rows) is no longer its own criterion; it follows the on-screen order in criterion 11 and is checked by hand (step 12 also covers focus). Nothing else is weakened.
- The "Paid earlier dues leave the board" rule, the 60-second re-read rule, and the roster re-read on a missing student are kept as stated.
- Empty-state copy for a past month in the Due and Paid tabs is spelled out in criterion 15.
- The R1-5 spec's "8 days" generation window and the `ensure_my_dues` function are used as built in `20261012100000_r1_dues.sql`; no change.

## 13. Hand-off

`tech-lead` appends only what differs from the technical plan in `docs/specs/R1-5-dues.md` (section 6 there). Likely nothing beyond confirming file names and that `BatchFilter` gains a forced-select variant.

## Technical plan, R1-6

Written by `tech-lead` on 2026-10-12. This is the delta. The full front-end plan is `docs/specs/R1-5-dues.md`, "Technical plan - R1-5 and R1-6", sections 3 (Files, R1-6 tables), 6 (Front end, with the exact test tables in 6.1), 7 (order) and 9 (risks). Everything there stands unless it is listed below. The 15 defaults in section 3 of this spec are assumed.

### 1. Confirmed, with no backend work

No migration, no Edge Function, no pgTAP, no change to `supabase/`. `20261012100000_r1_dues.sql` (table, RLS, `ensure_my_dues`) is on `main` and is all this slice reads. R1-5 part B (the pg_cron schedule, `20261012100100_r1_dues_schedule.sql` and `140_dues_schedule.sql`) is a separate item. It is not on `main` and R1-6 does not depend on it: the board calls `ensure_my_dues` on open, so a missing nightly job only means a due appears when the tutor next opens the app instead of at 00:30. Do not hold R1-6 for it, and do not bundle it.

No new dependency and no new `ui/` component. Nothing in `src/` for dues exists yet (`src/lib/dues*.ts`, `src/components/board/` are all new), so there is nothing to conflict with. R1-3 is merged, so the "after R1-3 merges" caveat in the old plan is gone: the Change-table edits can be done in the same branch as the new files.

### 2. Files (names as in the old plan, section 3)

New, all `frontend-dev`:
- `src/lib/dues.ts`, `src/lib/dues.test.ts`: `Due`, `DUE_COLUMNS`, `dueFromRow`, `DuesLoadError`, `readMonth`, `readUnpaid`, `readEarliestMonth`, `ensureMyDues`.
- `src/lib/dues-board.ts`, `src/lib/dues-board.test.ts`: pure, no `Date`, no `Intl` (tables in old plan 6.1).
- `src/components/board/board-state.tsx` (`BoardProvider`, `useBoard`), `board-screen.tsx`, `month-switcher.tsx`, `hero-amount.tsx`, `due-row.tsx`, `board-list.tsx`, `board-states.tsx`, with a test beside each that has logic.
- `e2e/dues-helpers.ts` (`stubDues`), `e2e/board.spec.ts`, `e2e/board-layout.spec.ts`.

Change:
- `src/components/home/home-screen.tsx`: `Chosen` gives `EmptyHome` for no active students, else `BoardScreen`.
- `src/components/home/filled-home.tsx` and `filled-home.test.tsx`: delete (decision 15). `firstName` stays in `empty-home.tsx`.
- `src/components/students/batch-filter.tsx`: add `variant?: "auto" | "select"` (default `"auto"`, so the Students screen is untouched). `"select"` takes the existing select branch whatever the batch count, and `panelId` becomes optional. The `"select"` branch already exists in the file, so this is a two-line change plus a test for both variants.
- `src/app/[locale]/(app)/(book)/layout.tsx`: wrap children in `BoardProvider`, inside `RosterProvider`.
- `src/app/[locale]/(app)/(book)/home/page.tsx`: `ClientMessages` list gains `"board"` (it must still name `appState`, `home`, `nav`, `students`).
- `src/lib/db-fake.test-util.ts`: add `neq`, `not`, `limit`, `range`, `rpc`. Additive.
- `e2e/auth-helpers.ts`: `stubSupabase` answers `GET /rest/v1/dues` with `[]` and `POST /rest/v1/rpc/ensure_my_dues` with `0` by default, so every spec that opens Home with students still passes.
- `e2e/students.spec.ts` and any other spec asserting the old filled home (the slip, "See all students", "Who owes what appears here in a later update."): replace with board assertions. Grep `e2e/` for those strings.
- `src/components/students/student-list-screen.test.tsx`: extend the "no component calls `.from(`" test to `.rpc(`.
- `messages/{en,hi,kn,te}.json`: the `board` namespace from section 9 of this spec, plus `board.monthYear`; remove `home.filled.*` and `home.seeAll` if unused (grep first). Change all four together; `pnpm i18n:check` is the gate.

### 3. How dues are read

- Reader: `src/lib/dues.ts` is the only file that touches `dues`. Select the named columns only, never `*`, never `tutor_id`. Order by `due_date, id` (a total order) and page with `.range(a, a+999)`. The installed postgrest-js sends that as `offset` and `limit`, not a `Range` header. Stop when a page has fewer than 1,000 rows. Any failed page throws `DuesLoadError` and returns nothing partial. A row with an unknown kind or status, or a non-integer amount, throws. Go through RLS with the signed-in client; no Edge Function.
- Reads per open, in parallel: `readMonth(viewMonth)`, `readEarliestMonth()`, and, only when the view month is the current India month, `readUnpaid()` (carried-over dues). The current month view is the id-deduplicated union of the month rows and the unpaid rows; a past month is its own rows only.
- `ensureMyDues()`: `client.rpc("ensure_my_dues")`, never throws, returns 0 on any failure. It runs in parallel with the reads, and the board never waits for it. If it returns more than 0, repeat the reads once.
- When it is called (this settles the wording "once per day-change" against criterion 28): once each time `BoardScreen` mounts while online (that includes coming back from a student's edit screen, which remounts it), and once more when the India day changes. It is not called on a month, tab or batch change, nor on a roster reload. Offline: no request at all. The call is in `open(today)` in `board-state.tsx` and nowhere else.
- Month changes use the cache. `needsRead(slice, now)` is true when a month is missing or older than 60 seconds, and only then is that single month read.
- Stale answers: a ticket number per slice, so a slow older read cannot overwrite a newer one. A successful read replaces its slice whole. A failed read keeps the cache and sets `failed`.
- A due whose student is not in the roster is left out (`boardView().missing`) and triggers one `roster.reload()` per read.

### 4. The forced-select BatchFilter

`<BatchFilter variant="select" batches counts value onChange />` with `counts = batchCounts(activeStudents, batches)`. The shown value is `effectiveFilter(filter, batches, counts)`, and `boardView` gets that effective value, so a batch deleted elsewhere falls back to All. Label is the existing `students.filterLabel`. It already returns null with no batches. Do not use `filterPanelProps` for the board. The status tabs own the tab panel's `id` and `aria-labelledby`.

### 5. The remembered view, in memory

`BoardProvider` holds `settings: { month: string | null; tab: Tab | null; filter: BatchFilterValue }` in a ref-backed store with a version counter, next to the cached slices. `month: null` means the current month, so after midnight it rolls forward on its own. Picking the current month stores `null`. `tab: null` means the default tab (Overdue, else Due, else Paid); a tap stores that tab until she taps another, even across refreshes. No `localStorage`, `sessionStorage`, cookie or IndexedDB. The provider sits in the `(book)` layout, so leaving the book group (sign-out, More) unmounts it and everything resets. A module-level variable must not be used: it would survive sign-out and leak one tutor's view to the next.

### 6. Build steps for `frontend-dev`

Each step ends with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`. From step 5 on, also `pnpm build` (with the CI fake address), `pnpm size` and `pnpm test:e2e`. One commit per step, on one feature branch from `main`.

1. Record the baseline: run `pnpm build && pnpm size` before changing anything and put the `home` and `students/edit` numbers in the first commit message.
2. `src/lib/dues-board.ts` and its test, using the tables in old plan 6.1 (indiaToday in four process time zones, dueState, boardView with the 8-due fixture, totals, strip, defaultTab, monthMoves, 300 x ₹10,00,000 sum). Add the no-`parseFloat`/`toFixed`/`Math.round`/local `Date` getter/`Intl.` grep test (criterion 36).
3. `db-fake.test-util.ts` additions, then `src/lib/dues.ts` and its test (2,350 rows in 3 requests, exactly 1,000 in 2, failed second page rejects all, select string equals `DUE_COLUMNS`, no `tutor_id`, `ensureMyDues` 3 / error / `"x"`, bad status refused).
4. `BatchFilter` `variant` plus test. Messages: the whole `board` namespace in all four files. Delete `home.filled.*` and `home.seeAll` only when step 6 removes their last use.
5. `BoardProvider` (open policy, tickets, 60-second rule, settings) and its unit test, wired in the `(book)` layout. Measure the size of `students` and the other book routes here (see risks).
6. Board components, `HomeScreen` change, delete `FilledHome`, `home/page.tsx` messages, `stubSupabase` defaults, `e2e/dues-helpers.ts`, update the old home assertions, extend the `.rpc(` test. Cut line: the founder can add a student with "Already owes" and see it Overdue at once.
7. `e2e/board.spec.ts` for criteria 10 to 32 and `e2e/board-layout.spec.ts` for criteria 34 and 35 (four languages, 360px, largest font, 60 students, long names, forced grayscale). Run the time-zone cases with `timezoneId` and `page.clock.setFixedTime` (not `install`).
8. Final: `pnpm size`, `check:leak` after a build, and hand off to `test-engineer`.

### 7. Tests required, mapped

| Criteria | Where |
| --- | --- |
| 1 to 8 | `dues-board.test.ts` |
| 9 | `dues.test.ts` |
| 36 | `messages.test.ts`/`i18n:check`, `language-rules.test.ts`, the grep test |
| 10, 11, 13 to 24 | `board.spec.ts` plus component tests for row and states |
| 12, 29 | `board.spec.ts` (month buttons; `setFixedTime` then `visibilitychange`) |
| 18, 19 | `board.spec.ts` (no request on filter change; remembered view survives open student and back; resets after sign-out) |
| 25 to 28, 30 | `board.spec.ts` with `stubDues` (`listDelayMs`, `networkDown`, `ensure.returns`, `ensure.delayMs`, `ensure.fail`, request log) |
| 31 | `board.spec.ts` under two `timezoneId`s |
| 32 | `board.spec.ts`: log has no write to any table, only the one `POST` to `rpc/ensure_my_dues`, no `pay_token`, no cookie, no other host |
| 33 | existing pgTAP `100_dues_rls.sql`, unchanged; no new database test |
| 34, 35 | `board-layout.spec.ts` |
| 37 | `pnpm size` |

### 8. Risks and traps

- Bundle size. `students/edit` is already 161 KB against the 150 KB warning target, and the `home` limit is 200 KB gzipped (this slice's own target 170 KB). The `BoardProvider` sits in the `(book)` layout, so its code (state, reader, pure functions, a few KB) loads on every book route, including `students/edit`. Measure in step 5. If `students/edit` or any book route grows by more than about 3 KB, or `home` passes 170 KB, move `dues.ts` and `dues-board.ts` behind a dynamic `import()` called from `open()`, so only `home` pays. Do not import them at the top of the layout or the provider if that is what it takes. Words are already scoped: `board` goes in `home/page.tsx` only. Stop and report if `home` passes 190 KB. Do not raise any limit or edit `scripts/size.mjs`.
- India-day boundary. All day work uses `indiaToday(Date.now())` with integer arithmetic. No `new Date()` getters, no `toLocaleDateString`, no `Intl`. The unit test runs under four process time zones, and the e2e under two browser time zones. `today` is state set on mount and on `visibilitychange`, and no timer is used. The month shown is derived from `today`, never from the phone's date.
- Large lists. Reading is paged at 1,000 with a total order and the fake host enforces the 1,000 cap, so a 2,350-row tutor is covered. Rendering: a tutor with hundreds of overdue rows renders all of them (no virtualization, no new dependency); `boardView` must be computed once per change with `useMemo` keyed on the store version, filter, month and today, not per row. The layout spec uses 60 students; add one unit-level run of `boardView` with 3,000 rows and assert it completes (a sanity bound, not a benchmark).
- The reader fails whole, and the error path must never sign the tutor out: use `classifyLoadFailure` as the roster does, and use status 500 in the fake host (the library retries 503 and 520 with delay).
- The made-up session token expires under the fixed clock: seed the session with a 30-day lifetime (`fakeSession(email, 30 * 86400)`).
- `ensure_my_dues` is the only non-read request. Be careful that nothing else uses `.rpc(` or writes to `dues`; the extended `no-direct-writes` and `.rpc(` tests are the guard.
- `check:leak` flags words in code: month names, tags and every sentence come from messages, and the year goes in as a string.
- Existing e2e specs that open Home with students break if `stubSupabase` has no dues default. Do that default before step 6's component work.

### 9. Not doing

Everything in section 6 of this spec, plus: no migration; no part B pg_cron work; no `localStorage`; no timer or polling for the day change; no virtualized list; no new `ui/` component or dependency; no change to `scripts/size.mjs`; no edit to the Students screen's behaviour (the `variant` default keeps it as is).

### 10. What the founder tests on staging

Section 11 of this spec stands unchanged as the hand test, run against the staging-backed build after merge, signed in with Google, at 360px and again at the largest system font. The parts that need the most care on a real phone:
1. Steps 2 and 3: "Already owes ₹2,400" appears as Overdue "Earlier balance" at once, and a student whose due day is today appears as "Due today" within a second or two.
2. Step 5: tap a row, press back, and the same month, tab and batch show.
3. Step 9 (the next morning) and step 10 (London time): "Due today" becomes "Overdue 1 day", and the labels do not move when the phone's zone changes.
4. Step 11 (airplane mode): the board stays with the quiet "Showing what was saved on this phone." line.
5. Step 12: the three Indian languages, digits 0 to 9, nothing cut, thumb-sized targets.
6. Existing students whose due day fell in the last 7 days already show Overdue the first time (catch-up on purpose, R1-5 criterion 20). The Network tab shows the dues request returns only his rows (criterion 33). Part paid and Paid cannot be seen on staging until R1-7.

Founder decision most likely to matter on first look: default 1 (fees appear on the due day, so early in the month the board looks sparse). Reversible later in one database function.

### 11. Open questions

None new. No dependency requested.

### 12. Hand-off

`frontend-dev` starts with step 1 (record the `pnpm size` baseline), then step 2 (`src/lib/dues-board.ts` and its test). No `backend-dev` task. R1-5 part B stays its own item for `backend-dev`, whenever the lead schedules it.
