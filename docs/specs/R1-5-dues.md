# R1-5 and R1-6: dues, and the dues board

Slices R1-5 "Dues: table, daily generation job, opening balance" and R1-6 "Dues board (home): month switcher, tabs, batch filter, student strip" (docs/BUILD_PLAN.md section 5). They depend on R1-2 (live on staging) and R1-3 (students and batches, being built).

Process: full process (stage 1 of 7), because this slice handles money. Next stage: `tech-lead` appends the technical plan to this file.

Two pull requests, in this order. Each ships alone.

- **R1-5 (database first).** The `dues` table, its security, the generation function, the opening-balance rule, the on-demand function, and the schedule. No screen changes. It can be merged and applied to staging by itself.
- **R1-6 (the board).** The home screen. Needs R1-5 on staging.

Tags: [unit] Vitest, [e2e] Playwright at 360px with the fake Supabase host, [db] pgTAP in the `database` CI job, [manual] by hand on a phone against staging.

## 1. Goal

A tutor opens the app and sees who owes what this month: one amount "still to come in", a strip of every student, and the unpaid fees sorted into Overdue, Due and Paid. The fees appear on their own on each student's due day, and a student who already owes money shows up as overdue from the first minute. Before this slice the home only counts students.

## 2. Users and moment

The tutor, on a low-end Android between classes, one thumb, often on slow 4G. She opens the app to answer one question: who has not paid, and how much. She does not type anything on this screen.

The parent is not a user of these slices. Nothing here is visible to a parent. (Reminders, Mark paid and the pay page come later: R1-7, R1-8, R1-9.)

## 3. Decisions made here (no founder input needed)

1. **One table, `dues`. R1-7 owns `payments`.** `dues` carries what the board needs: the amount, what has been paid so far (`amount_paid`), and the stored status. R1-7's `record_payment()` will add to `amount_paid` and set `status` in its own transaction. R1-7 must not need to change `dues`. The PRD data model has no `amount_paid`; it is added now because "Part paid" cannot be shown without it (gap 3).
2. **Stored status is payment progress only: `due`, `partial`, `paid`** (as the PRD). **Overdue is never stored.** It is worked out from the due date and today. The words the tutor sees are Overdue, Due, Part paid, Paid (the canvas and the `StatusTag` component). "Pending" is a total in a sentence, not a status.
3. **Overdue has no grace.** A due is overdue from the day after its due date. On its due date it is "Due today". (The canvas says "3 days late", PRD and plan say nothing about grace.)
4. **Today means today in India (`Asia/Kolkata`), everywhere.** In the database, in the job, and in the browser (never the phone's own date). R1 is India-only.
5. **A due is created on its due date, as the PRD says.** (Founder question 1 asks whether to change this; it is the main question. Everything below is written for the PRD's rule. Criteria marked "(Q1)" change if he says yes.)
6. **Catch-up window of 7 days.** The generation function creates any due whose due date fell in the last 7 days and does not yet exist. So a missed night, or a few days without the job, repairs itself. Nothing older than 7 days is ever created: a student archived for six months and restored must not suddenly owe six months.
7. **A student's first due is on or after the day they were added.** A student added on 12 Oct with due day 5 gets their first monthly due on 5 Nov. What they owed before is what the tutor types in "Already owes" (the opening balance). A student added on their own due day gets that month's due the same day.
8. **Amounts are a snapshot.** A due keeps the fee it was created with. Editing a student's fee or due day later changes only dues not yet created. (R1-3 already says "A new fee applies from the next month.")
9. **Opening balance is its own due**, `kind = 'opening'`, with no month. At most one per student. It is created by the database the moment a student is saved with "Already owes" above 0 (no job, no wait). While nothing has been paid against it, editing "Already owes" in the student form changes or removes it. After a payment it is frozen (R1-7 must lock the field in the form; gap 6).
10. **An opening balance is overdue from the start.** It was owed before the tutor began; showing it as "Due" would be wrong. Its row says "Earlier balance" with no "days late" count.
11. **The board for month M shows that month's own dues.** For the current month it also shows every unpaid earlier due and every unpaid opening balance as separate rows, each marked with its month. Without this, an unpaid September fee would vanish on 1 October. Paid earlier dues leave the board (history is the student screen, later).
12. **Rows are per due, not per student.** The canvas shows "2 months pending ₹2,400" as one row. That is not built: R1-7 must pay one specific due. A student with two unpaid dues has two rows. Counts of rows and counts of students are both shown where the canvas shows a count, and each is labelled for what it counts.
13. **The batch filter applies to everything under the month switcher**: the amount, the strip, the tab counts and the rows. So the tutor can read the total of one class.
14. **The board shows no Remind, no Mark paid, no "to confirm", no "Remind all".** A button that cannot work is not shown (R1-1 rule). One quiet line says they are coming.
15. **The board replaces the filled home of R1-3** (the slip with the student count and "each month" total). That slip, its two links and its "soon" line go. The Students tab in the bottom nav is the way to the list and to adding. The empty home (no students) stays as built.
16. **A row opens the student's existing edit screen** (`students/edit/?id=`) until the Student detail screen is assembled (R1-3 gap).
17. **No client write to `dues`, ever, in these slices.** The browser reads dues, and calls one function that asks the database to create what is missing. Rows are created by the job, the opening-balance rule, and that function, which all run in the database.
18. **A function the client calls takes no arguments.** It cannot name a date or a tutor, so it cannot forge a due.
19. **The schedule is a second migration, separate from the table.** pg_cron is not enabled on the hosted projects (F4 left it to this slice). If it needs a dashboard switch, the table migration must not wait for it. The app works without the schedule (the on-demand function), so the founder can test before pg_cron is proven.
20. **The board reads the roster already in memory** (students and batches, R1-3) and joins dues to it in the browser. Dues rows carry no names or phones.
21. **Dues are read in pages of 1000.** The database returns at most 1000 rows per request; a centre with 300 students and months of unpaid dues can pass that.
22. **No new dependency. No new `ui/` component.** `StatusTag`, `Tabs`, `StudentStrip`, `Stamp`, `Banner`, `Slip`, `SelectField` and R1-3's `BatchFilter` are used as built.

## 4. Acceptance criteria

PRD criteria, word for word:

- PRD Release 1, "Dues generation": "On the student's due day each month a `dues` row is created (scheduled job). Opening balance becomes a due on import." (criteria 17 to 33 and 40 to 46)
- PRD Release 1, "Dues board (home)": "Month switcher; header "₹X pending from N students"; tabs Overdue / Due / Paid; partial status; batch filter" (criteria 55 to 82)
- PRD section 7: `dues(id, tutor_id, student_id fk, month date (first of month), amount int, status ('due'|'partial'|'paid'), due_date, created_at)   unique(student_id, month)`. Money is integer paise. Row-level security on every table, `tutor_id = auth.uid()`. (criteria 1 to 16)
- BUILD_PLAN decision 6: "A daily job creates `dues` rows for students whose due day is today, idempotent through `unique(student_id, month)`." (criteria 17, 22, 34 to 38)

### The table (R1-5)

1. [db] `public.dues` exists with these columns. `id` uuid primary key, default `gen_random_uuid()`. `tutor_id` uuid not null. `student_id` uuid not null. `kind` text not null default `'monthly'`, one of `monthly`, `opening`. `month` date, null for an opening balance. `amount` integer not null. `amount_paid` integer not null default 0. `status` text not null default `'due'`, one of `due`, `partial`, `paid`. `due_date` date not null (a calendar day, no time zone). `created_at` and `updated_at` timestamptz not null, default now.
2. [db] Money is integer paise and is checked: `amount` is more than 0 and at most 100000000 (the same ceiling as a student's fee); `amount_paid` is 0 up to and including `amount`. A zero amount, a negative amount, an `amount_paid` above `amount`, and a decimal are all refused.
3. [db] Status always agrees with the money, enforced by a check: `due` means `amount_paid = 0`; `partial` means `0 < amount_paid < amount`; `paid` means `amount_paid = amount`. A row that says `paid` with `amount_paid = 0` is refused.
4. [db] A monthly due has a `month` that is the first day of a month; an opening due has `month` null. A monthly due with a null month, an opening due with a month, and a month that is not a first day are refused.
5. [db] `unique (student_id, month)` as in the PRD: a second monthly due for the same student and month is refused. A student cannot have two opening dues (a second is refused). A student can have one opening due and a monthly due for any month.
6. [db] A due points at a student of the same tutor (composite key `(tutor_id, student_id)` to `students (tutor_id, id)`). Tutor B cannot insert a due for tutor A's student even as the table owner would. Deleting a student that has dues is refused. Deleting a tutor (their `auth.users` row) removes their students and their dues without error and leaves tutor B's rows. (The R1-2 note says `on delete restrict`; use `no action`, which is checked at the end of the statement, so the account-delete cascade in R1-13 works. Plan item.)
7. [db] `updated_at` moves forward on update (the shared `set_updated_at()` trigger).

### Security (R1-5)

8. [db] Row-level security is on. The only policy is select, `tutor_id = (select auth.uid())`. There is no insert, update or delete policy. (This departs from "four policies" in `supabase/CLAUDE.md`, as `tutors` does, because no client may write dues. The migration says so in a comment.)
9. [db] Tutor A reads only A's dues. Tutor B reads zero of A's dues, whichever filter B uses.
10. [db] A signed-in tutor cannot insert a due (not for their own student, not with their own `tutor_id`), cannot update any column (not `amount`, `amount_paid`, `status`, `due_date`), and cannot delete. Each is refused with privilege error 42501. `has_table_privilege('authenticated', 'public.dues', ...)` is false for insert, update, delete, truncate, references and trigger; true for select only.
11. [db] Without a session (`anon`) the table returns nothing and has no privilege of any kind.
12. [db] `public.generate_dues(...)`, and the trigger functions in criteria 40 to 43, cannot be executed by `anon` or `authenticated` (`has_function_privilege` false, and a call as a tutor fails). The on-demand function `public.ensure_my_dues()` can be executed by `authenticated` and not by `anon` or public.
13. [db] `020_public_tables_have_rls.sql` and `030_default_privileges.sql` still pass. `pnpm check:db --base origin/main` passes on both new migrations (names, order, nothing earlier edited).
14. [db] The pgTAP files are new: they do not edit `040` to `080`. Run twice in CI.
15. [manual] Staging: signed in as the founder, the Network tab shows the dues request returns only his rows, and a request for a made-up `tutor_id` returns an empty list.
16. [unit] No file under `src/components` calls `.from(` or `.rpc(` (the R1-3 test is extended). The board code reads dues only through `src/lib/dues.ts`.

### Generation (R1-5)

Rule, in plain words. Look at the 8 days ending today (today and the 7 before). For every active student whose monthly fee is above 0: work out this month's and last month's due date (the first of the month plus due day minus 1). If that date is inside the 8 days, and is not before the day the student was added, and no due exists for that student and month, create it with the student's fee as it is now.

17. [db] `public.generate_dues(p_now timestamptz default now())` follows the rule. "Today" is the India calendar day of `p_now`. It creates, for the right students, exactly one row: `kind monthly`, `month` the first of that month, `amount` the fee in paise, `amount_paid` 0, `status due`, `due_date` the due date, `tutor_id` the student's tutor. It returns how many rows it created.
18. [db] It creates no due for: a student with `active = false`; a fee of 0; a due date after today; a due date more than 7 days before today; a due date before the day the student was added (India day of `created_at`). One test each.
19. [db] It is idempotent. Run twice at the same instant: the second creates 0 and raises nothing. Run once a day for 62 days over a student: exactly 2 dues for a student with due day 5 (one per month). A concurrent second run is safe (the unique key plus `on conflict do nothing`).
20. [db] Catch-up. With the job not run on 3 days, a run on the 4th creates every due that fell on the 3 missed days. A student whose due day is 9 days before today gets nothing.
21. [db] Fee snapshot. Create a due, change the student's fee, run again: the existing due's amount is unchanged and no second row is made. The next month's due has the new fee.
22. [db] Due-day change. After a due exists, changing the student's due day does not move, change or duplicate it. The next month's due uses the new due day. (Known edge: moving the due day earlier than today, in a month with no due yet, creates that month's due on the next run if its new date is within 7 days. Accepted; see edge cases.)
23. [db] February and leap years. Due day 28 in February 2027 gives a due on 28 Feb 2027 and in February 2028 (leap year) gives 28 Feb 2028; 29 Feb 2028 is not a due date for anyone. No student can have a due day above 28 (R1-2).
24. [db] India midnight. At `2026-10-31 18:29:59+00` (23:59:59 IST on 31 Oct) "today" is 31 Oct, so a student with due day 1 gets no November due. At `2026-10-31 18:30:00+00` (00:00 IST on 1 Nov) "today" is 1 Nov and that student gets the November due with `due_date` 2026-11-01. The test is run with the database session time zone set to UTC and to America/Los_Angeles: same answers.
25. [db] Restore. A student archived on their due day and restored 3 days later gets that due on the next run. One restored 10 days later gets nothing for that month and the next month's due arrives normally.
26. [db] A student added on their due day (India day) gets that month's due on the next run. A student added the day after their due day gets none for that month.
27. [db] Both tutors in one run: each due's `tutor_id` equals its student's `tutor_id`; tutor B's students never produce a due under tutor A.
28. [db] The India-day calculation is one small function of an instant (`p_now`), so criterion 24 can be tested without changing the clock. The client-callable function never takes it as an argument.

### The on-demand function and the schedule (R1-5)

29. [db] `public.ensure_my_dues()` takes no arguments, runs the same rule as criterion 17 with the server's clock, and only for the students of `auth.uid()`. It returns the number of dues it created. A second call right after returns 0. Called as tutor A it creates nothing for tutor B's students. Called as `anon` it is refused. It runs with the right to insert into `dues`, which the caller does not have, and with an empty `search_path`.
30. [db] A separate, later migration schedules the job: name `generate-dues-daily`, schedule `0 19 * * *` in UTC (00:30 India time), command `select public.generate_dues()`. Running the migration again does not make a second job (the job is created by name). The comment in the file says why 19:00 UTC.
31. [db] With pg_cron available (the CI image): a test finds exactly one row in `cron.job` with that name, that schedule, and `active`.
32. [manual] pg_cron is proven on staging (section 8): the extension is on, the job is listed, and the morning after, `cron.job_run_details` shows a run that succeeded. Until it is, the on-demand function carries the load and nothing else is needed from the founder.
33. [db] The table migration does not need pg_cron. It applies on a database without the extension.

### Opening balance (R1-5)

34. [db] Saving a student with `opening_balance` above 0 creates, in the same transaction, one due: `kind opening`, `month` null, `amount` equal to the balance, `amount_paid` 0, `status due`, `due_date` the India day it was saved, `tutor_id` the student's. A balance of 0 creates none. (A database rule on `students`, not a job.)
35. [db] Changing a student's `opening_balance` afterwards, while the opening due has `amount_paid = 0`: a new positive value updates the due's `amount`; 0 removes the due; from 0 to a positive value creates it. While `amount_paid` is above 0, a change leaves the due as it is.
36. [db] Existing students on staging who already have `opening_balance` above 0 and no opening due get one when the migration runs, once. Running the backfill again creates nothing. `due_date` for these is the India day of the migration.
37. [db] An archived student's opening due is kept. Archiving does not change it.
38. [db] The trigger functions are not callable by clients (criterion 12). A failing trigger must not stop a student being saved for any reason except a true constraint failure: it uses `on conflict do nothing` and is tested with a student of `opening_balance` 100000000 (the largest) and with 0.
39. [db] The opening due's amount follows the paise stored on the student; no rounding. A student saved with ₹1,200.00 "Already owes" has an opening due of `120000`.

### Status, today and money in the browser (R1-6 libraries)

40. [unit] `indiaToday(now)` returns the India calendar day as `YYYY-MM-DD` for any instant, with no `Intl`, no `toLocale*` and no local-time getters (the F3 rule). `18:29:59Z` gives that UTC date; `18:30:00Z` gives the next. Run under `TZ` UTC, America/Los_Angeles, Asia/Kolkata and Pacific/Kiritimati, with the process time zone really changed and asserted (as F3 does).
41. [unit] `dueState(due, today)` gives one of `paid`, `overdue`, `part-paid`, `due`, and a tab (`overdue`, `due`, `paid`):
    - `status paid` is `paid`, tab Paid, whatever the date.
    - Unpaid or part paid with `due_date` before today is tab Overdue, `daysLate` = today minus due date (1 or more). Part paid keeps the Overdue tag and shows its part paid amount in the line.
    - `due_date` equal to today is tab Due, tag "Due today", `daysLate` 0.
    - `due_date` after today is tab Due. (Only possible under Q1.)
    - Part paid and not late is tab Due, tag `part-paid`.
    - `kind opening` and not paid is tab Overdue from the first day, `daysLate` null, whatever its date.
    One table row for each of these and for the boundaries (yesterday, today, tomorrow) and a month-end crossing (31 Oct to 1 Nov).
42. [unit] `remaining(due)` is `amount - amount_paid`. Every sum is an integer sum of paise; a test sums 300 dues of 100000000 and gets the exact integer.
43. [unit] `boardView(dues, students, month, today, filter)` returns the rows for month M:
    - the dues whose `month` is M;
    - when M is the current India month: also every due with `status` not `paid` and `month` before M, and every unpaid opening due;
    - never a due of an archived student, or of a student not in the roster;
    - the batch filter applied through the student's batch (`all`, `none`, or a batch id);
    - paid earlier-month dues and paid opening dues are not included.
44. [unit] Within a tab: Overdue is most days late first (opening balances first of all), then name; Due is soonest due date first, then name; Paid is name. Name is compared as R1-3's `sortStudents` does (lower-case, by character code). Ties end on the due id so the order never flickers.
45. [unit] Default tab: Overdue if it has rows, else Due if it has rows, else Paid. Once the tutor taps a tab, it stays until the tutor taps another (it does not jump when data refreshes).
46. [unit] Totals for the view: `pending` is the sum of `remaining` of every unpaid row; `collected` is the sum of `amount_paid` of the rows whose `month` is M (carried-over rows do not count); `students` is the count of different students with an unpaid row; `studentsInView` is the count of different students with any row; `rows per tab` are counts of rows. A student with two rows counts once in the student numbers and twice in the tab numbers.
47. [unit] Strip blocks: one per student with a row in the view; the block is `overdue` if any of their rows is overdue, else `due` if any is unpaid, else `paid`. Drawn paid first, then due, then overdue (as the canvas). The three legend numbers add up to the number of blocks.
48. [unit] Month moves. `previous` is allowed while the month is after the earliest month that has a monthly due for this tutor; `next` is allowed while the month is before the current India month. With no dues at all, both are disabled. The current month rolls forward by itself when the India date changes (criterion 82).
49. [unit] The dues reader reads every page: given a fake that holds 2,350 rows and returns 1,000 at most per request, it returns all 2,350, in order, and stops. A failed page fails the whole read.
50. [unit] The reader names its columns (`id, student_id, kind, month, amount, amount_paid, status, due_date`), never `select=*`, never sends `tutor_id`, and the opening-balance and generation rules are not repeated in the browser (it never makes a due).

### The board (R1-6)

Route `home/`. Everything is inside the sign-in gate and the roster provider. `HomeScreen` chooses: no active students gives the empty home exactly as R1-3 left it; one or more gives the board. Loading and error use the same states as the list.

51. [e2e] A tutor with no active students (none, or all archived) sees the empty home of R1-3, unchanged, with no month switcher and no request for dues.
52. [e2e] A tutor with active students sees the board: month switcher, the amount, the strip, the tabs, the list, and the bottom nav with Home current. The R1-3 filled home (the slip, "See all students", the second "Add a student" button and "Who owes what appears here in a later update.") is gone.
53. [e2e] Month switcher. A previous-month button and a next-month button, each at least 44px square, each with an accessible name ("Previous month", "Next month"), around the month and year, for example "October 2026" (month words from the page's language, year in digits). The next button is disabled in the current month and the previous button on the earliest month; a disabled button is still drawn at 44px and says it is disabled to a screen reader. Tapping previous shows that month's rows. The month label never wraps in a way that hides the year.
54. [e2e] The big amount. A label "Still to come in", then the total of what is still owed in this view as one amount in the headline face with Indian grouping and 0-9 digits in every language (for example `₹18,500`), then "from {n} of {m} students" (n = students with something unpaid, m = students with any row in this view). One further line, "{amount} collected", shows the collected total (criterion 46); it is shown only when that total is above ₹0. The amount fits at 360px and at large font up to `₹10,00,00,000` without sideways scroll (the `amountFit` helper).
55. [e2e] The strip and its words. `StudentStrip` shows one block per student in the view with its text legend under it ("14 paid", "4 due, hollow", "5 overdue, tall") and the text alternative ("23 students: 14 paid, 4 due, 5 overdue"). With no rows in the view, nothing is drawn (no strip of zeros).
56. [e2e] Tabs. Three tabs, Overdue, Due, Paid, each with the number of rows in it, in the canvas order, using the `Tabs` component (the tab list, the selected tab taller). The panel under them is the list. Tapping a tab shows only its rows and does not read anything from the network. The default tab is criterion 45.
57. [e2e] A row, in every tab, shows: the student's name; a status tag with a word and a mark (Overdue "Overdue 7 days", Due "Due" or "Due today", Part paid "Part paid", Paid "Paid"); a line with the due date as `DD MMM YYYY` ("Due 10 Oct 2026"), the batch name when there is one, and for a part paid row "Part paid ₹500"; and on the right the amount in the mono face with Indian grouping: the remaining amount for Overdue and Due rows, the amount for Paid rows. An earlier month's row says "{Month} fee" in its line; an opening balance says "Earlier balance" and no "days late". A student with two rows has two rows.
58. [e2e] The whole row is one link to `students/edit/?id=<student id>`. It is at least 66px high, and grows with long names, long batch names, the largest system font, and Hindi, Kannada and Telugu. Nothing is cut with an ellipsis (`wrap-anywhere`). No button or link sits inside the row link.
59. [e2e] Batch filter. When the tutor has at least one batch, a control lets them choose All batches, one batch, or No batch (when some students have none); it shows how many students each holds, and its tap target is at least 44px. With no batches the control is not drawn. Choosing a filter changes the amount, the strip, the tab counts and the rows together (decision 13) and reads nothing from the network. If the chosen batch is deleted elsewhere, the board falls back to All batches. (R1-3's `BatchFilter` is reused, `effectiveFilter` and `batchCounts` included. Its tabs variant is not used here: two rows of tabs would confuse. Plan item: force the select variant or give it a sheet form.)
60. [e2e] The month, the tab and the batch filter are kept when the tutor opens a student from a row and comes back (same session). They reset on sign-out.
61. [e2e] Empty list in a tab (the month has rows, this tab has none): Overdue "Nobody is overdue.", Due "Nothing else is due this month.", Paid "Nobody has paid yet this month." (for a past month the words say "that month" instead of "this month" through a separate key).
62. [e2e] Nothing in the view at all, the filter is All, and the month is the current one: the heading "Nothing is due yet." and "A student's fee appears here on their due day." and a link "See your students" to `students/`. (Q1: under the 1st-of-month rule this state only happens on the 1st before the first run.) For a past month with no rows: "No fees were due in {month}."
63. [e2e] Nothing in the view because of the batch filter: "Nothing in {batch} for {month}." with a button "Show all batches".
64. [e2e] All paid: when the view has rows and nothing is unpaid, the amount is replaced by the stamp (ALL PAID with the month), "Nothing left to collect.", "Collected {amount}" and "Students {n} of {n}", and "{Month} fees will appear here on each student's due day. You do not need to do anything." (the canvas State-allpaid). The tabs and the list stay below it, so the tutor can open the Paid tab. (Reachable only after R1-7; tested here with made-up data.)
65. [e2e] End of list line under each tab with rows: "That is everyone who is overdue." (Due: "That is everyone who is due."; Paid: "That is everyone who has paid.").
66. [e2e] Absent on purpose: no round Remind button on rows, no "Remind all" button, no "{n} to confirm" button, no Mark paid. One line, `Reminders and Mark paid arrive in a later update.`, sits under the amount. (R1-8, R1-7 and R1-10 add them.) No sample data link.
67. [e2e] Loading. Until the first read of dues and the roster is back, the board draws the canvas "State: loading": the month, "Still to come in", grey blocks in the shapes of the amount and rows, and "Opening your book…" (not a spinner alone). If the roster and a previous read are cached, they show at once and refresh quietly.
68. [e2e] Read failed with nothing cached: the error banner "Couldn't load your fees", "The network dropped. Nothing is lost.", and "Try again". Tapping it reads again. With something cached, the board stays and a quiet line says "Showing what was saved on this phone." It never signs the tutor out.
69. [e2e] Offline. With the network off after the first load, the cached board stays, the quiet line shows, and no request is sent for dues. The "You are offline, 3 changes saved" banner of the canvas is R1-12's, not drawn here. Opening the app with no network and nothing cached shows the error state of criterion 68.
70. [e2e] The on-demand function is called on every opening of the board, while online, at the same time as the read. It sends an empty body. If it returns more than 0, the dues are read again once. If it fails or is slow, nothing is shown and nothing is delayed.
71. [e2e] The board reads dues for the month in view, plus the unpaid earlier dues when it is the current month (criterion 43), and the earliest month with a due (for criterion 48). Moving between months already read does not read again within 60 seconds; the quiet refresh on opening a screen (R1-3 criterion 31) also refreshes the board.
72. [e2e] A due whose student is not yet in the roster (added on another phone) is left out and makes the roster read again once; it shows on the next render.
73. [e2e] The Home nav item is current (`aria-current="page"`). Tab order: month previous, next, batch filter, tabs, rows.
74. [e2e] When the phone's browser time zone is America/Los_Angeles, and again Pacific/Kiritimati, with the clock fixed to 2026-10-12 at 05:00 UTC (10:30 India time), the board shows exactly the same days late, month label and tab counts as in India time.
75. [e2e] Day change. With the board open on the evening of 12 Oct India time, then the clock moved past midnight India time and the page made visible again, the board recomputes: a due on 12 Oct that was "Due today" is now "Overdue 1 day", the tab counts update, and the on-demand function is called again.
76. [e2e] Writes. The board sends no insert, update or delete to any table. The only POST is the empty-bodied call to `ensure_my_dues`.
77. [e2e] Privacy. The requests carry no `pay_token`, no parent phone, no parent name from the dues read. No cookie is set. The only hosts are the page's own and the fake Supabase host.
78. [e2e] 360px and large font, in all four languages, with these data: 60 students; one name of 80 characters with no spaces; Hindi, Kannada and Telugu names; a batch name of 60 characters; a part paid row; an opening balance row; amounts of `₹10,00,000` on a row and `₹1,00,00,000` in total. No sideways scroll; nothing wider than its box; every button, link and tab at least 44px; nothing under 14px; the strip wraps onto more rows above 28 students without a block under 8px wide.
79. [e2e] The strip, tags and tabs carry words, not colour alone: with the page's colours removed (forced grayscale), each row still says Overdue, Due, Part paid or Paid in words and each has its mark (solid outline, fill, dashed outline, double outline).
80. [unit] Hindi, Kannada and Telugu pages use their own faces and rules (line height, no letter spacing, no upper case); amounts, the year and counts use 0-9 digits and the Latin faces (headline for the big amount, mono for rows).
81. [e2e] `pnpm size` for `home` (all four languages): initial JS at most 200 KB gzipped, target 170 KB or less. The board code is in the `home` route only. No new dependency.
82. [unit] The board's "today" is read when it opens and again when the page becomes visible (`visibilitychange`); a timer is not used.

### Words and tests that cut across

83. [unit] All new words are in `messages/{en,hi,kn,te}.json` under `board` (section 7) and `pnpm i18n:check` passes. The canvas words are filled in (Hindi from `Home-hi`); everything else in hi, kn and te is `TODO-translate`. No English in JSX, no "FeeDost" outside `brand.ts`. The R1-3 keys `home.filled.*` and `home.seeAll` are removed from all four files if nothing else uses them.
84. [unit] No money is a float anywhere: amounts are integers in the reader, the helpers, the props and the test data; display only through `formatRupees`; dates only through `formatDate`. A test greps `src/lib/dues*` and the board components for `parseFloat`, `toFixed`, `Math.round`, `new Date(` without a fixed argument, `getDate`, `getMonth`, `getFullYear`, `getHours`, `toLocale` and `Intl.`.
85. [db] Run in the CI `database` job, twice. The new pgTAP files: `090_dues_table.sql` (criteria 1 to 7), `100_dues_rls.sql` (8 to 12), `110_dues_generation.sql` (17 to 28), `120_ensure_my_dues.sql` (29), `130_opening_balance.sql` (34 to 39), `140_dues_schedule.sql` (30, 31). `plan(n)` is the author's.

## 5. Edge cases

- **Opening balance of 0 or blank:** no due, no row on the board.
- **Opening balance and a due on the same day:** a student added on their due day with "Already owes" gets both an opening due and that month's due. The tutor sees two rows. If the tutor meant the opening amount to be this month's fee, it is counted twice; the "Already owes" label says it is what they owe from before (copy review item).
- **Typo in the fee when adding:** the first due copies it. There is no way to correct a due in these slices (question 3).
- **Fee changed on the 12th, due day was 5th:** this month's due keeps its old amount; the next one has the new amount.
- **Fee changed to 0:** no new dues. Existing dues stay.
- **Due day changed to an earlier day than today, with no due yet this month:** if the new date is within the last 7 days, the next run creates this month's due with that date, so it shows overdue at once. Accepted for now; the R1-3 line "A new fee applies from the next month" should also say "and the new due day" (copy review item for R1-3's words, not a change to this slice).
- **Student archived with unpaid dues:** their rows leave the board and the amounts leave the totals; restoring brings them back. Dues are never deleted by archiving.
- **Student deleted:** not possible in R1-3 (no delete), and refused by the database while dues exist.
- **Student with no phone:** a due is made as usual; the row looks the same. ("Add a number first" is R1-8's reminder message.)
- **Due day 28 in February, leap years:** criterion 23. Due days cannot be 29 to 31, so no month is short of a due date.
- **Midnight in India:** criterion 24 and 75. A tutor travelling abroad still sees India days; the board does not use the phone's date.
- **Phone clock wrong by days:** the board's "days late" and tab for a due can be wrong; creating dues is not affected (the server's clock is used). Accepted.
- **Hundreds of students:** the board reads dues in pages of 1000; the list is not virtualised (about 300 short rows, the same call as R1-3). The strip wraps at 28 per row.
- **Many months unpaid:** every unpaid earlier due is a row in the current month's Overdue tab. A tutor with 60 students who stopped using the app for six months would see up to 360 overdue rows. Accepted; a "write off" action is a founder question later (question 3).
- **A student with two unpaid rows:** two rows; counts in section 4, criterion 46.
- **Same name twice:** both rows show; the batch and the due date tell them apart.
- **Very long names:** wrap, never cut.
- **Large font:** the month switcher grows taller; the tabs wrap their labels; the amount shrinks to fit (`amountFit`), never cut.
- **Second language:** month names, tags, tab words and "days late" plurals are all in messages. Months for Kannada and Telugu are `TODO-translate` until reviewed. The year and every number stay 0-9.
- **Partial payment:** `amount_paid` above 0 and below `amount`: tag "Part paid" (or "Overdue" if late), the line shows what was paid, the amount on the right is what is left. Partial payments cannot be made until R1-7; tested with made-up rows.
- **Duplicates:** the unique keys stop a second due per student and month, and a second opening due. The job, the on-demand function and the opening-balance rule can all run at once with no duplicates and no error.
- **Job not running (pg_cron off or failing):** the on-demand function makes the tutor's own dues when the board opens. A tutor who never opens the app has no new dues until they do; nothing is lost, because the 7-day catch-up covers a tutor who opens within a week. Opening after more than 7 days misses a due whose date is older than that (it is not created). Accepted; the schedule is what removes this.
- **Slow network:** the roster and the board show what they have; the dues read has its own loading state; a slow on-demand call never delays the board.
- **Parent opening an old link:** not applicable; no parent page exists yet.
- **Two phones, one tutor:** the second phone refreshes when a screen opens (R1-3); last write wins is not involved because the board does not write.
- **Staging has no pg_cron and no dues yet:** the founder adds a student with due day = today; opening the board shows it as "Due today" (on-demand function). A student with "Already owes" shows as Overdue at once.
- **A due exists for a student the tutor later moves to another batch:** the row follows the student's current batch (the filter uses the roster).
- **A tutor in another time zone:** criterion 74.

## 6. Out of scope (do not add)

| Not here | Where it goes |
| --- | --- |
| Mark paid, `payments`, `record_payment()`, receipts, the undo banner, locking "Already owes" after a payment | R1-7 |
| Remind, "Remind all N", bulk remind, "reminded 2 days ago", `reminders` | R1-8 |
| "{n} to confirm" button, claims, notifications | R1-10 |
| Pay link, pay page, `pay_token` reads | R1-9 |
| The offline banner, queued changes, a stored cache after closing the app | R1-12 |
| Editing, waiving or deleting a due | founder question 3 |
| The Student detail screen (history, "Earlier entries") | not owned by any slice (R1-3 gap) |
| Sample data | R1-3 question 1 |
| Automatic reminders on due day, +3 and +7 | Release 2 |
| Reports, yearly statement | Release 2 |
| The desktop dues board (`Home-desktop`) | not in Release 1 |
| Search on the board | not in the PRD |
| Sorting options, paging of the list | not in the PRD |
| Grace days, late fees, interest | not in the PRD |
| Analytics events | R1-14 |
| A dues export | R1-13 |
| Tamil, Malayalam | Release 3 |
| Any change to `payments`, `reminders`, `payment_claims` tables | their own slices |
| Any new dependency | not allowed |

## 7. Design references

Canvas files in `design/project/` (names from `canvas.json`).

- `Home.dc.html` ("4 Home: dues board"): month switcher, "Still to come in", the strip and legend, tabs with counts, row layout, "All batches". Rows are 66px, name 17px, line 14px, amount in mono. The blue "Remind all 5", the round blue Remind buttons and "2 to confirm" are not built (criterion 66).
- `Home-hi.dc.html` ("Dues board in Hindi"): the Hindi words used in the copy table; row height 70px; the amount in the headline face (this one differs from `Home`, which uses mono; DESIGN.md says mono in rows, so mono is used).
- `Home-scrolled.dc.html`: the collapsed header (amount and "Remind all" stay on top while scrolling). Not required in R1-6. If the plan can do it cheaply with the amount only (no button), it may; otherwise the header scrolls away.
- `State-allpaid.dc.html`: the all-paid state (criterion 64).
- `State-loading.dc.html`: loading (criterion 67).
- `State-error.dc.html`: the error banner pattern (criterion 68).
- `State-offline.dc.html`: for R1-12, not drawn here.
- `State-undo.dc.html`: R1-7; shows rows' "Part paid ₹500 · 5 days late" and "7 days late" wording.
- `State-empty.dc.html`: the empty home, unchanged.
- `Student.dc.html`: the student detail where "Overdue 7 days" tag wording comes from. Not built here.
- `Nav.dc.html`, `Main.dc.html` (design system), `Interaction.dc.html`: nav, tags, press and focus.
- `Type-indic.dc.html`: Hindi, Kannada and Telugu type rules.

## 8. Copy

English, with Hindi where the canvas draws it. Every other hi, kn, te value is `TODO-translate`. Add all keys to the four files together. New namespace `board`; `ClientMessages` for the namespace goes on the `home` page.

| Key | English | Hindi (canvas) |
| --- | --- | --- |
| board.prev / next | Previous month / Next month | पिछला महीना / अगला महीना |
| board.months.1 ... 12 | January ... December | अक्टूबर for October; the rest TODO-translate |
| board.hero.label | Still to come in | अभी आना बाकी |
| board.hero.from | from {n} of {m} students | {m} में से {n} छात्रों से |
| board.hero.collected | {amount} collected | |
| board.tabsLabel | Fees | |
| board.tab.overdue / due / paid | Overdue / Due / Paid | देर से / बाकी / जमा |
| board.legend.paid / due / overdue | {n} paid / {n} due, hollow / {n} overdue, tall | {n} जमा / {n} बाकी / {n} देर से |
| board.strip.label | {total} students: {paid} paid, {due} due, {overdue} overdue | {total} छात्र: {paid} जमा, {due} बाकी, {overdue} देर से |
| board.tag.overdue | Overdue {n, plural, one {# day} other {# days}} | |
| board.tag.overdueOpening | Overdue | |
| board.tag.due / dueToday / partPaid / paid | Due / Due today / Part paid / Paid | |
| board.row.dueOn | Due {date} | |
| board.row.partPaid | Part paid {amount} | ₹500 जमा |
| board.row.monthFee | {month} fee | |
| board.row.earlier | Earlier balance | |
| board.empty.tab.overdue / due / paid | Nobody is overdue. / Nothing else is due this month. / Nobody has paid yet this month. | |
| board.empty.tab.dueOld / paidOld | Nothing else was due that month. / Nobody paid that month. | |
| board.end.overdue / due / paid | That is everyone who is overdue. / That is everyone who is due. / That is everyone who has paid. | |
| board.empty.none.title / body / link | Nothing is due yet. / A student's fee appears here on their due day. / See your students | |
| board.empty.monthOld | No fees were due in {month}. | |
| board.empty.filter / showAll | Nothing in {batch} for {month}. / Show all batches | |
| board.allPaid.stamp / title / collected / students | ALL PAID / Nothing left to collect. / Collected / Students | |
| board.allPaid.of | {n} of {m} | |
| board.allPaid.next | {month} fees will appear here on each student's due day. You do not need to do anything. | |
| board.soon | Reminders and Mark paid arrive in a later update. | |
| board.loadError.title / body / retry | Couldn't load your fees / The network dropped. Nothing is lost. / Try again | |
| board.stale | Showing what was saved on this phone. | |
| board.batch | Show | (reuse `students.filterLabel`) |

The loading line reuses `appState.loading` ("Opening your book…").

Legend note: the Hindi canvas legend omits "hollow" and "tall"; English draws them. Each language follows its own canvas; Kannada and Telugu follow English and say the shapes (`TODO-translate`).

## 9. Analytics

None of the PostHog events in PRD section 4 fires in these slices (`signed_up`, `profile_done`, `students_added`, `first_reminder_sent`, `reminder_sent`, `payment_marked`, `claim_submitted`, `claim_confirmed`, `paypage_viewed`, `upi_button_tapped`, `referral_signup`). The ones nearest here, `reminder_sent` and `payment_marked`, belong to R1-8 and R1-7; all events are wired in R1-14. No event carries a name, phone or amount. No new event is invented (a "board viewed" event is not in the PRD). Nothing is sent to analytics in these slices (criterion 77).

## 10. Test by hand on a phone

On the staging-backed preview, signed in with Google, 360px wide, then again with the largest system font. The tutor has at least three students. Do the database steps (A) after the lead has applied the R1-5 migration to staging.

A. After R1-5 only (no screen change yet, ask the lead to check in the dashboard):
1. Table editor, `dues`: the table exists and is empty or holds only the opening balances of students you already added.
2. In the SQL editor (read only): `select jobname, schedule, active from cron.job;` shows `generate-dues-daily`, `0 19 * * *`, active. If the query errors, pg_cron is off: Database, Extensions, switch on `pg_cron`, then ask the lead to apply the schedule migration.
3. The morning after the schedule is on: `select status, start_time from cron.job_run_details order by start_time desc limit 3;` shows `succeeded` at about 19:00 UTC (00:30 India time).

B. After R1-6:
4. Open Home with students. You see the month name and year, "Still to come in", an amount, the strip with its words under it, three tabs and the list. No Remind button and no Mark paid. The line about reminders arriving later is there.
5. Add a student with "Already owes ₹2,400" and due day anything. Go to Home: the student is in Overdue with "Earlier balance" and "Overdue", amount `₹2,400`, and the big amount went up by ₹2,400.
6. Add a student whose due day is today's date, fee `1200`. Go to Home: within a second or two a row "Due today" with `₹1,200` appears in the Due tab, and the strip gets a hollow block.
7. Edit the student's "Already owes" to `1,500`: Home now shows `₹1,500`. Edit it to `0`: the row is gone.
8. Tap a row: it opens that student's edit screen. Go Back: the same month and tab are showing.
9. Tap the previous-month arrow: if no month has dues yet, it is disabled. The next arrow is disabled in the current month.
10. Add a batch and put a student in it. A batch control appears; pick the batch: the amount, strip and rows change to that batch only. Pick All batches. Delete the batch elsewhere and come back: All batches.
11. Archive a student who has a due: their row and amount leave Home. Restore: it returns.
12. Tomorrow, open Home again: the "Due today" row now says "Overdue 1 day" and has moved to the Overdue tab.
13. Switch the phone to a different time zone (Settings, Date and time, turn off automatic, pick London) and open Home: the labels and days late do not change. Switch it back.
14. Airplane mode, then open another screen and return to Home: the board stays and says "Showing what was saved on this phone." Turn the network back on and tap Try again if offered.
15. Switch the app to Hindi, Kannada, Telugu: month, tabs, tags and the amount read cleanly, amounts keep 0-9 digits, nothing is cut.
16. In Supabase (Table editor, staging), `dues`: rows have the right `tutor_id`, `kind`, `amount` in paise (`120000` for ₹1,200), `due_date` as a plain date.
17. You cannot see overdue "days late", part paid or paid rows on staging yet (they need days to pass and R1-7). The e2e tests cover them with made-up data. If you want to try them on staging earlier, say so (question 2).

## 11. Open questions for the founder

1. **When does a student's monthly fee appear? (Needed before the plan starts.)** The PRD says "On the student's due day each month a dues row is created", and the screen "State: everyone has paid" agrees ("November fees will appear here on each student's due day"). But the main Home canvas shows fees that are not yet due ("Due 15 Oct", "Due 20 Oct" in the Due tab, "from 9 of your 23 students"). They cannot both be true. Built as the PRD says: a student's fee appears on their due day, so early in the month the board shows only the fees already reached, and "Due" holds only fees due today. **Recommendation: change the rule so that every active student's fee for the month appears on the 1st, each keeping its own due date.** Then the board is the full month at a glance, as drawn, "Due" means "not late yet", and "from 9 of 23 students" is true. The cost is small: the generation rule changes from "the 8 days ending today" to "every due date in this month", a student added mid-month gets this month's fee only if their due day is still ahead, and criteria 17 to 20, 26, 62 and 41's "after today" row change. If you say yes, I update the spec before the plan starts.
2. **Do you want a way to see Overdue-by-days, Part paid and Paid on staging before real days pass?** The honest way to see them is time and R1-7. The tests prove them with made-up data. A shortcut is "sample data" (R1-3 question 1, still undecided) or a one-off script the lead runs against staging that moves a test student's due date back. **Recommendation: no shortcut. Test Overdue with an opening balance (instant), Due with a due day of today, and the rest after R1-7.**
3. **How does a tutor fix a wrong amount, or drop a fee, on a due?** The PRD has no way. A typo in the fee on the first day creates a wrong first due; a student who left leaves unpaid dues the tutor cannot clear (archiving hides them, which does solve the board but not the history). **Recommendation: not in R1-5 or R1-6; add a small slice after R1-7 ("Adjust or waive this due" on the student screen, one function, reason recorded). Before real tutors use it, archive is the way out.** This is a PRD scope decision, so it is yours.
4. Not asked, decided: no grace days; "Due" and "Part paid" not "Pending" and "Partial"; India time for everyone; opening balances overdue at once; rows per due not per student; "N collected" line added under the amount (not on the canvas; delete it if you do not want it).

## 12. Gaps and conflicts found in the source documents

1. **PRD and the canvases disagree on when a fee appears** (question 1). The PRD, BUILD_PLAN decision 6 and `State-allpaid` say the due day; `Home` shows future due dates.
2. **PRD header "₹X pending from N students" versus the canvas "Still to come in ... from 9 of your 23 students".** Followed the canvas wording and layout; the PRD sentence is covered by the same two numbers.
3. **The PRD `dues` table has no amount paid, no kind, and no place for an opening balance.** Added `amount_paid`, `kind` and a null `month` for opening dues. `unique(student_id, month)` is kept as written; nulls do not collide, so a separate unique index limits an opening due to one per student.
4. **PRD status words** (`due`, `partial`, `paid`) versus the canvas tags (Overdue, Due, Part paid, Paid) versus the founder's "Pending, Overdue, Paid". Canvas and `StatusTag` words used; Overdue is derived.
5. **BUILD_PLAN decision 6 has no catch-up** (only "students whose due day is today"). The 7-day window is added here so a missed night repairs itself.
6. **R1-3 lets the tutor edit "Already owes" at any time.** Now it changes the opening due while unpaid, and after a payment it cannot. R1-7 must lock the field in the student form and say why. Nothing is needed in R1-3 now because no payment can exist before R1-7.
7. **R1-3's note says dues use `on delete restrict`.** That would block account deletion (R1-13) because `tutors` cascades to students and dues in one statement. Use `no action`.
8. **`supabase/CLAUDE.md` says four policies on every table.** `dues` has one (select), by design: only database functions write. Same departure as `tutors`. The `supabase/CLAUDE.md` rule "dues are created by the pg_cron job and by import" gets a third creator, the on-demand function, because pg_cron is unproven (the lead may amend that sentence).
9. **The canvas Home combines older unpaid months in one row** ("2 months pending ₹2,400"). Built as separate rows (decision 12).
10. **The canvas row meta "reminded 2 days ago"** needs the `reminders` table (R1-8). Not shown.
11. **The canvas amounts: `Home` uses mono in rows, `Home-hi` uses the headline face in rows.** DESIGN.md decides (mono in rows).
12. **The canvas short date "Due 10 Oct" versus the rule DD MMM YYYY.** The rule wins: "Due 10 Oct 2026".
13. **The canvas "All batches" is an underlined text button**; R1-3 built a tabs-or-select filter. Reused; look decided in the plan.
14. **`BatchFilter`'s tab variant** cannot sit above the status tabs; the plan must use the select form on the board.
15. **No slice owns the whole Student detail screen** (R1-3 noted it). The board's rows go to the edit screen meanwhile.
16. **Slice dependencies in BUILD_PLAN:** R1-6 lists R1-5 only, but it also needs R1-3's roster and `BatchFilter`. R1-7 depends on R1-5 and needs `amount_paid` and the check in criterion 3 (decision 1).
17. **pg_cron is unverified on both hosted projects.** F4 left it to this slice. It is a founder step if the dashboard needs it switched on (criterion 32).
18. **Neither the PRD nor the canvas `Home` shows a collected total**; only `State-allpaid` does. A "collected" line is added under the amount (listed in question 4 so the founder can remove it).
19. **`docs/BUILD_PLAN.md` R1-12 (offline)** says writes queue; the board has none. Overdue and "days late" offline come from the phone's clock (criterion 69, edge cases).
20. **Month names** have no formatter (F3 has dates, not month words); they are message keys.

## 13. Hand-off to `tech-lead`

Append the technical plan to this file. The plan must decide and write down:

1. **Migrations.** Two files after `20261011140000`: (a) `dues` table, checks, indexes, RLS (select only), grants, `generate_dues(p_now)`, the India-day helper, `ensure_my_dues()`, the opening-balance trigger on `students` and the one-time backfill, with all `revoke execute` lines; (b) the schedule, with `create extension if not exists pg_cron` and the named job. Decide the extension's schema, and how migration (b) behaves where the extension cannot be created (it must fail loudly on staging, not silently skip). Say in the pull request which extension and what the founder must switch on.
2. **Indexes**: at least `(tutor_id, month)` and a partial index on unpaid dues; the unique key and the one-opening-per-student index.
3. **Trigger details**: definer functions with an empty `search_path`, `on conflict do nothing`, behaviour when `opening_balance` changes (criterion 35), how `students` update of `opening_balance` is detected, and a test that a failing trigger cannot block saving a student.
4. **Data access**: `src/lib/dues.ts` (the reader with paging, the `ensureMyDues()` call, the `Due` type, `dueFromRow`), `src/lib/dues-board.ts` (pure: `indiaToday`, `dueState`, `boardView`, totals, strip, tab default, month moves). Whether dues live in the existing `RosterProvider` or a sibling `BoardProvider` that keeps month, tab and filter across navigation (criterion 60).
5. **Reuse and changes to R1-3 pieces**: `BatchFilter` (a way to force the select form or a sheet), `HomeScreen` and removing `FilledHome`, `empty-home.tsx`, the `home/page.tsx` namespaces, and that these files are also touched by other work. Check the branch state before editing.
6. **Test strategy with a made-up session**: as R1-3 section 9. A build made with the CI fake Supabase address; `stubSupabase` for auth; the R1-3 `roster-helpers.ts` for students and batches; a new `e2e/dues-helpers.ts` answering `GET /rest/v1/dues` (honours `month=eq.`, `month=lt.`, `status=neq.paid`, `kind=eq.`, `order`, `limit`, and the `Range` header for paging), and `POST /rest/v1/rpc/ensure_my_dues` (returns a count; switches for failure, delay and "created N"). Fix the browser clock with Playwright's clock (`2026-10-12T05:00:00Z`) and set `timezoneId` to America/Los_Angeles and Pacific/Kiritimati for criterion 74. The unit tests pass `today` explicitly. The database rules are proven only by pgTAP in CI (Docker does not run here), run twice; the fake host proves request shape, not SQL.
7. **pgTAP**: the six files named in criterion 85, using `tests.act_as(...)`; a time test through `p_now`; session time zone set to UTC and America/Los_Angeles; the cron test guarded so it runs only where pg_cron exists in the CI image, and a note on how to tell if CI skipped it.
8. **Size**: whether `home` stays within 170 KB gzipped with the board's code; the `size` script already lists `home`.
9. **Build order** (suggested):
   1. `backend-dev`: migration (a) and pgTAP files 090 to 130. Push, read the `database` job until green twice. Lead applies to staging. R1-5 can merge here.
   2. `backend-dev`: migration (b) and `140`. Founder switches on pg_cron if needed; lead applies; the next-morning check (hand test A3). Not blocking.
   3. `frontend-dev`: pure libraries, reader, `ensureMyDues`, fake host, unit tests (criteria 16, 40 to 50, 82, 84).
   4. `frontend-dev`: the board (criteria 51 to 81), messages, size list, the removal of the R1-3 filled home.
   5. `frontend-dev`, then `test-engineer`: four languages by 360px by large font loop, the time-zone e2e, coverage against the criteria.
10. **Cut line**: after step 4. The founder can add students and see Overdue (opening balance) and Due (due day today) on his own phone.
11. **Risks to record**: the function with insert rights is reachable by tutors (criterion 29 tests it can only act on `auth.uid()`); trigger errors blocking student saves; paging past 1000 rows; the phone's clock for "days late"; pg_cron unproven.

Start: `backend-dev` takes step 1. `frontend-dev` can begin step 3 against the fake host while step 1 runs.

## Decided by the founder, 2026-10-12

The founder was asleep and said not to wait. The lead decided the four questions below on his standing instruction and recorded them here. The founder can reverse any of them; Q1 is the one he is most likely to want to look at.

1. **Q1, when a fee appears: the PRD's rule stands.** A student's monthly due is created on the student's due day (with the 7-day catch-up). It is what the spec's criteria 17 to 29 are written for and what this plan builds.
   - **The alternative is the founder's to choose later:** create every active student's fee for the month on the 1st, each keeping its own due date, so the board shows the whole month at a glance. Say so plainly: it is NOT built, and building it later is a small change, not a rewrite.
   - **What it would change:** the generation rule (`public.create_dues_for`, one `where` clause, see Technical plan section 4.4), criteria 17, 18, 19, 20, 26, 41 (the "after today" row becomes a normal case, the code already handles it) and 62 (the "Nothing is due yet." state), and the pgTAP file `110_dues_generation.sql` and one e2e. It changes no table, no policy, no front-end code beyond the copy of one empty state.
   - **How the plan keeps that change small:** the rule lives in exactly one SQL function (the shared worker `create_dues_for`), `generate_dues` and `ensure_my_dues` are thin wrappers, the front end already draws a due that is after today (tab Due, tag "Due"), and `110` is grouped by rule so the groups that change are named in the file.
2. **Q2, a way to see Overdue days, Part paid and Paid on staging before time passes: no shortcut.** No sample data, no script that moves a due date. Overdue is tested on staging with an opening balance (instant) or, on the 29th to 31st, a student with due day 28; Due with a due day of today; the rest are proved by e2e with made-up data and by R1-7.
3. **Q3, fixing or waiving a wrong due: a later slice.** Not in R1-5 or R1-6. Until then, archiving the student is the way out (it hides their rows and removes them from the totals; nothing is deleted). Recorded in "Not doing".
4. **The process:** lighter process does NOT apply. Money stays on the full process: this plan, then build (two pull requests for R1-5, one for R1-6), then a separate `test-engineer` pass, then `code-reviewer`, then `lead-reviewer` decides the merge. Nothing is applied to production without the founder's own yes.

## Technical plan — R1-5 and R1-6

Written by `tech-lead` on 2026-10-12. Read this with the spec above; where this plan differs from the spec, section 2 lists it.

### 1. Approach

R1-5 is one table (`dues`) that clients can only read, plus a small set of database functions that are the only writers: one shared worker (`create_dues_for`) that applies the generation rule to "all tutors" (the nightly job, via `generate_dues`) or to one tutor (the tap-to-open call, `ensure_my_dues`, which can only name `auth.uid()`), and one trigger on `students` that keeps the opening balance in step. The rule, the India day and the money checks all live in the database and are proved by pgTAP in CI; the schedule is a separate second migration so pg_cron can never block the table. R1-6 adds two pure libraries (`dues.ts`: a typed, paged reader and the one RPC call; `dues-board.ts`: India-day arithmetic with no `Date`, status, view, totals, strip, tab, month moves), one provider that keeps the board's data and the tutor's month, tab and filter across navigation, and the board components under `src/components/board/`. The board replaces `FilledHome`, reuses the roster already in memory and `BatchFilter` (with a forced select form), sends no write except the empty `ensure_my_dues` call, and adds no dependency and no `ui/` component.

### 2. Differences from the spec

Each of these is deliberate. The spec criterion number is given.

| # | Spec | This plan | Why |
| --- | --- | --- | --- |
| 1 | Crit. 6: foreign key `no action` | `no action` **deferrable initially deferred** | With an immediate `no action` key, deleting a tutor cascades to `students` and `dues` as two separate cascade statements; PostgreSQL fires the `no action` check at the end of the inner students-cascade statement, and which cascade runs first depends on trigger names (they carry OIDs). If students go first, dues still exist and the account delete fails, order-dependently. Deferred makes the check run at commit, when both are gone. A direct delete of a student that has dues is still refused (23503) at commit. Tests use `set constraints all immediate`. This is reasoned from PostgreSQL's trigger semantics and cannot be run here; the CI `database` job proves it, and if CI shows the immediate form also passes, we keep deferred anyway because the order is not guaranteed. |
| 2 | Crit. 2: "a decimal is refused" | A decimal **text** is refused with 22P02 (invalid input syntax for integer); a typed numeric `12.5` is rounded by PostgreSQL's assignment cast and cannot be refused by a check. | A client can never insert (no privilege), the functions only insert integers, so the real exposure is nil. The test uses `'12.5'` as text and expects 22P02. |
| 3 | Crit. 17, 29 | Three extra internal functions, all revoked from clients: `india_day(timestamptz)`, `create_dues_for(timestamptz, uuid)` (the shared worker), `create_missing_opening_dues(timestamptz)` (the backfill, so it can be tested). | The spec's crit. 28 asks for the India day as one small function. One worker means `generate_dues` and `ensure_my_dues` cannot drift and Q1 is a one-place change. |
| 4 | Crit. 29 | `ensure_my_dues()` raises 42501 when `auth.uid()` is null. | A token with no `sub` must do nothing, not "all tutors". |
| 5 | Crit. 31 and hand-off 7: cron test guarded | **Not guarded.** Migration 2 does `create extension pg_cron` and fails loudly where it is unavailable, so a green `db:reset` is the proof the CI image has it; `140` then asserts without a skip. | A guard that can silently skip proves nothing. Nothing in CI can "skip" this test. |
| 6 | Hand-off 6: paging "with the `Range` header" | The pinned `@supabase/postgrest-js` 2.117.3 sends `.range(a, b)` as the query parameters `offset=a&limit=b-a+1`, **not** a `Range` header (read in `node_modules/.pnpm/@supabase+postgrest-js@2.117.3/.../dist/index.cjs`, `range()`). The fake host honours `limit`/`offset` and a `Range` header both, and also enforces a server cap of 1,000 rows. | Evidence from the installed source. |
| 7 | Crit. 70: "sends an empty body" | `rpc('ensure_my_dues')` with no arguments sends a POST whose body is `{}` (read in the same source: `args = {}`). The test asserts the parsed body equals `{}` (or is empty). | Evidence from the installed source. |
| 8 | Crit. 71 (reads) | Per open: `month=eq.M` read, `status=neq.paid` read (current month only), and a one-row earliest-month read, in parallel, plus the RPC; no `or=` filter. | Simple filters the fake host and the planner both handle; the partial index matches `status <> 'paid'` exactly. |
| 9 | Crit. 54 copy | `board.hero.from` gets plural forms on the number of students (`{m, plural, one {from {n} of # student} other {from {n} of # students}}`), and a new key `board.monthYear` = `{month} {year}` is added (the year is passed as a string, so ICU never groups it as `2,026`). | "1 of 1 students" reads wrong; a year as a number could be grouped. Two copy-review items, not scope. |
| 10 | Crit. 14 vs size script | `scripts/size.mjs` needs no change for R1-6 (`home` is listed). It warns above 150 KB (its `TARGET`); this slice's own target is 170 KB, limit 200. | Do not edit the script in this slice. |
| 11 | Crit. 84 grep | `dues-board.ts` uses no `Date` at all (integer day arithmetic), so the grep needs no exceptions there; the one `Date.now()` is in a hook in a component file under `src/components/board/` and is not in the grep list. | Keeps the F3 rule literally. |
| 12 | Crit. 6 / 3 | One check **not** added: a "monthly due_date lies inside its month" check. | Not in the criteria; the only writers are our functions, and an extra check is one more way for CI to fail for a reason the spec does not ask for. |

### 3. Files

Create (R1-5, `backend-dev`):

| File | What goes in it |
| --- | --- |
| `supabase/migrations/20261012100000_r1_dues.sql` | Migration 1: table, checks, indexes, RLS, grants, the five functions, the two triggers, the backfill call. Section 4. |
| `supabase/migrations/20261012100100_r1_dues_schedule.sql` | Migration 2: `create extension if not exists pg_cron` and the named job. Separate pull request. Section 4.7. |
| `supabase/tests/090_dues_table.sql`, `100_dues_rls.sql`, `110_dues_generation.sql`, `120_ensure_my_dues.sql`, `130_opening_balance.sql` | pgTAP, section 5. Pull request A. |
| `supabase/tests/140_dues_schedule.sql` | pgTAP for the schedule. Pull request B with migration 2. |

If another migration lands on `main` first with a later stamp, re-stamp (`check:db` rule 3). Nothing else under `supabase/` changes. The lead amends `supabase/CLAUDE.md` (dues have a select policy only, like `tutors`; dues have three creators: the job, the on-demand function, the opening-balance trigger) and tells R1-7 and R1-13 what section 9 says.

Create (R1-6, `frontend-dev`):

| File | What goes in it |
| --- | --- |
| `src/lib/dues.ts` | `Due` type, `DUE_COLUMNS`, `dueFromRow` (validates kind, status, integers; a bad row fails the whole read), `DuesLoadError`, `readMonth(month)`, `readUnpaid()`, `readEarliestMonth()` (each paged at 1,000, ordered `due_date, id`), `ensureMyDues()`. The only file that reads `dues`. |
| `src/lib/dues-board.ts` | Pure, no React, no `Date`: `indiaToday(nowMs)`, day and month arithmetic, `dueState`, `remaining`, `boardView`, `totals`, `stripBlocks`, `defaultTab`, `monthMoves`, `needsRead`. Section 6.1. |
| `src/components/board/board-state.tsx` | `BoardProvider` and `useBoard()`: cached dues, the month, tab and filter, the open policy. No words. Section 6.2. |
| `src/components/board/board-screen.tsx` | The board for a tutor with students: chooses states, runs the open effect, the day-change listener. |
| `src/components/board/month-switcher.tsx`, `hero-amount.tsx`, `due-row.tsx`, `board-list.tsx`, `board-states.tsx` | The switcher; the amount, its two lines and the "soon" line; one row (a single link); the tab panel with end-of-list and per-tab empties; loading, error, nothing-yet, filter-empty and all-paid. Small files, each with a test beside it where it has logic. |
| `src/lib/dues.test.ts`, `src/lib/dues-board.test.ts`, component tests | Section 8. |
| `e2e/dues-helpers.ts`, `e2e/board.spec.ts`, `e2e/board-layout.spec.ts` | Fake host and flows. Section 6.5. |

Change (R1-6):

| File | Change |
| --- | --- |
| `src/components/home/home-screen.tsx` | `Chosen`: no active students gives `EmptyHome`; one or more gives `BoardScreen`. |
| `src/components/home/filled-home.tsx`, `filled-home.test.tsx` | Deleted. `firstName` stays exported from `empty-home.tsx` (the empty home uses it). |
| `src/components/students/batch-filter.tsx` | New optional prop `variant?: "auto" \| "select"` (default `"auto"`, so the Students screen is unchanged); `"select"` draws the select form whatever the batch count; `panelId` becomes optional (unused in the select form). A test for both variants. |
| `src/app/[locale]/(app)/(book)/layout.tsx` | Wrap children in `BoardProvider`, inside `RosterProvider`. Leaving the book group (sign-out, More) unmounts it, which resets month, tab and filter (criterion 60). |
| `src/app/[locale]/(app)/(book)/home/page.tsx` | Wrap `HomeScreen` in `ClientMessages` with `["appState","home","nav","students","board"]` (an inner provider replaces the outer words, so it names all of them). The `board` words then travel on the home page only, not on the student and batch pages. |
| `src/lib/db-fake.test-util.ts` | Add the chain ops the reader uses (`neq`, `not`, `limit`, `range`) and an `rpc` call. Additive. |
| `e2e/auth-helpers.ts` | `stubSupabase` answers `GET /rest/v1/dues` with `[]` and `POST /rest/v1/rpc/ensure_my_dues` with `0` by default, as it already does for students and batches, so every existing spec that opens Home with students keeps passing. Do this after R1-3 has merged: that file is being changed on the R1-3 branch. |
| `e2e/students.spec.ts` and the R1-3 home e2e | Replace the filled-home assertions (the slip, "See all students", "each month", "Who owes what appears here in a later update.") with the board's. Also after R1-3 merges. |
| `src/components/students/student-list-screen.test.tsx` | Extend the "no component calls `.from(`" test to `.rpc(` (criterion 16). |
| `messages/{en,hi,kn,te}.json` | The `board` namespace, section 6.6; remove `home.filled.*` and `home.seeAll`. |

R1-3 is still being built in this checkout. `frontend-dev` for R1-6 starts the pure files (new, no conflict) at once, and does every edit to a file in the "Change" table after R1-3 has merged and the branch is rebased.

### 4. Data

#### 4.1 The table

`public.dues`, exactly the spec's columns. Decisions:

- `id uuid primary key default gen_random_uuid()`. `tutor_id uuid not null references public.tutors (id) on delete cascade` with **no default** (no client ever inserts). `student_id uuid not null`.
- `constraint dues_student_fkey foreign key (tutor_id, student_id) references public.students (tutor_id, id) on delete no action deferrable initially deferred` (difference 1). The target `students_tutor_id_id_key` exists.
- Named checks (all SQLSTATE 23514):
  - `dues_kind_check`: `kind in ('monthly','opening')`.
  - `dues_status_check`: `status in ('due','partial','paid')`.
  - `dues_amount_check`: `amount > 0 and amount <= 100000000`.
  - `dues_amount_paid_check`: `amount_paid >= 0 and amount_paid <= amount`.
  - `dues_status_agrees_check`: `(status = 'due' and amount_paid = 0) or (status = 'partial' and amount_paid > 0 and amount_paid < amount) or (status = 'paid' and amount_paid = amount)`.
  - `dues_month_check`: `(kind = 'monthly' and month is not null and extract(day from month) = 1) or (kind = 'opening' and month is null)`. `extract(day from date)` is immutable and tied to no time zone; `date_trunc` is not used, because it would go through `timestamptz` and the session time zone.
- Uniques: `constraint dues_student_id_month_key unique (student_id, month)` (the PRD's key; nulls are distinct, so opening dues never collide on it), and `create unique index dues_one_opening_per_student on public.dues (student_id) where kind = 'opening'`.
- `created_at`, `updated_at` as the other tables; trigger `dues_set_updated_at` (before update, `public.set_updated_at()`).
- `comment on table` says: written only by `create_dues_for`, `sync_opening_due` and, from R1-7, `record_payment`.

#### 4.2 Indexes, RLS, grants

- `dues_tutor_id_month_idx on (tutor_id, month)`: the month read, the "earliest month" read (nulls sort last, so `month is not null order by month limit 1` is an index scan) and the tutor-delete cascade.
- `dues_tutor_id_unpaid_idx on (tutor_id, due_date) where status <> 'paid'`: matches the board's `status=neq.paid` read exactly.
- No index on `(tutor_id, student_id)`: the `(tutor_id, month)` index serves the key check's `tutor_id` prefix, and the table is small.
- `alter table ... enable row level security`; one policy `dues_select ... for select to authenticated using (tutor_id = (select auth.uid()))`. A comment in the migration says why there is no insert, update or delete policy (same departure as `tutors`).
- `revoke all on public.dues from anon, authenticated; grant select on public.dues to authenticated;`. No column grants. The migration states `grant` itself, as `supabase/CLAUDE.md` requires.

#### 4.3 The India day

`public.india_day(p_at timestamptz) returns date`, `language sql immutable`, `set search_path = ''`, body `(p_at at time zone 'Asia/Kolkata')::date`. `timestamptz AT TIME ZONE zone` gives the wall clock in that zone; the reverse form (`timestamp AT TIME ZONE`) would be the classic mistake and is not used. Independent of the session `TimeZone` (tested under UTC and America/Los_Angeles). Nothing anywhere uses `current_date`, `now()::date` or `date_trunc` on a date.

#### 4.4 The worker (the one place the rule lives)

`public.create_dues_for(p_now timestamptz, p_tutor uuid) returns integer`, `language plpgsql security definer set search_path = ''`.

- Raises 22004 when `p_now` is null.
- `v_today := public.india_day(p_now)`; `v_first := v_today - (extract(day from v_today)::int - 1)`; `v_prev := (v_first - 1) - (extract(day from (v_first - 1))::int - 1)`. Pure date arithmetic, so no time zone and no month-length table; 1 March 2028 gives 1 Feb 2028 (leap), 1 March 2027 gives 1 Feb 2027.
- One statement: `insert into public.dues (tutor_id, student_id, kind, month, amount, amount_paid, status, due_date) select s.tutor_id, s.id, 'monthly', c.first_of_month, s.monthly_fee, 0, 'due', c.first_of_month + (s.due_day - 1) from public.students s cross join (values (v_first), (v_prev)) as c(first_of_month) where s.active and s.monthly_fee > 0 and (p_tutor is null or s.tutor_id = p_tutor) and due date between v_today - 7 and v_today and due date >= public.india_day(s.created_at) order by s.tutor_id, s.id, c.first_of_month on conflict do nothing`.
- The window is 8 days, so it touches at most two calendar months: this one and the one before. That is why two candidate months are enough.
- `on conflict do nothing` **with no conflict target**: it covers the key `(student_id, month)`, the primary key and the partial opening index without naming a partial-index predicate (the inference trap: `on conflict (student_id)` alone does not match a partial index). Check failures are not swallowed.
- `order by s.tutor_id, s.id, c.first_of_month` makes every run take its row locks in the same order, so the nightly job and a tutor's `ensure_my_dues` running at once cannot deadlock on each other's unique keys.
- `get diagnostics v_count = row_count` is the number of rows inserted (conflicts do not count). Returned.
- **Q1 change point:** the `where` clause on the due date and the `values` list. Under the alternative, candidates become this month only, the date test becomes "due date on or after the student's created day", and the 7-day window goes.

#### 4.5 The two entry points

- `public.generate_dues(p_now timestamptz default now()) returns integer`: `select public.create_dues_for(p_now, null)`. Security definer, empty `search_path`. Executed by the cron job (postgres) only.
- `public.ensure_my_dues() returns integer`: no arguments. Security definer, empty `search_path`. Reads `v_tutor := (select auth.uid())`; if null raises 42501 "not signed in"; returns `public.create_dues_for(now(), v_tutor)`. Uses `now()` (the transaction start), which is the request for a PostgREST call, so one call is one instant.
- Privileges: `revoke execute on function` every one of `india_day`, `create_dues_for`, `generate_dues`, `sync_opening_due`, `create_missing_opening_dues`, `ensure_my_dues` `from public, anon, authenticated` (the Supabase default grants `execute` to `anon` and `authenticated` directly, so revoking from `public` alone is not enough, as `20261011100000` already does). Then `grant execute on function public.ensure_my_dues() to authenticated`. Only that one.

#### 4.6 The opening balance

- `public.sync_opening_due() returns trigger`, security definer, empty `search_path`. Two triggers on `public.students`:
  - `students_sync_opening_due_insert`: `after insert ... for each row when (new.opening_balance > 0)`.
  - `students_sync_opening_due_update`: `after update of opening_balance ... for each row when (old.opening_balance is distinct from new.opening_balance)`. (One trigger cannot do both: an insert trigger's `when` may not mention `old`.)
- Insert: `insert into public.dues (...) values (new.tutor_id, new.id, 'opening', null, new.opening_balance, 0, 'due', public.india_day(now())) on conflict do nothing`.
- Update, balance now above 0: the same insert with `on conflict do nothing` (creates it when there is none), then `update public.dues set amount = new.opening_balance where student_id = new.id and kind = 'opening' and amount_paid = 0`. Balance now 0: `delete from public.dues where student_id = new.id and kind = 'opening' and amount_paid = 0`. Anything with `amount_paid > 0` is untouched (frozen, criterion 35). Known consequence, accepted: a fully paid opening due plus the tutor editing "Already owes" leaves the student's field and the due disagreeing; R1-7 locks the field.
- Archiving (`active`) is not in `update of opening_balance`, so the trigger does not fire (criterion 37).
- **No `exception when others` handler.** A trigger that swallowed an error would silently lose an opening balance, which is worse than a failed save. The only things that can fail are true constraint failures, and the trigger cannot trip any: amount is at most the same 100,000,000 ceiling as the student's own check, and the key conflicts are `do nothing`. Tests cover 100000000, 0, and the conflict path (criterion 38).
- The trigger is a definer function, so a tutor saving a student needs no right on `dues`. A trigger's function is checked for execute rights when the trigger is made, not when it fires, so revoking `execute` from clients is safe.
- Backfill: `public.create_missing_opening_dues(p_now timestamptz) returns integer` does `insert ... select ... from public.students where opening_balance > 0 ... on conflict do nothing` with `due_date = public.india_day(p_now)` (archived students included) and returns the count. The migration ends with `select public.create_missing_opening_dues(now());`. Run again it returns 0. It is a function only so the test can call the exact statement the migration runs.

#### 4.7 Migration 2: the schedule

- `create extension if not exists pg_cron;` with no `with schema`: the extension's control file fixes its own schema, and naming another would error. It must **not** be wrapped in an exception handler or a `do` block that skips: if the extension cannot be created, the migration fails and the founder hears about it. The pull request says: extension `pg_cron`, and that if staging refuses, the founder switches it on in Database, Extensions, and the lead re-runs the push.
- `select cron.schedule('generate-dues-daily', '0 19 * * *', $$select public.generate_dues()$$);`. `cron.schedule` with a name updates a job of that name rather than adding one (pg_cron 1.3 and later), so a second run leaves one job. A comment in the file: 19:00 UTC is 00:30 India time, so the India day has just turned, every due that opens today is created within the hour, and the 7-day catch-up covers a missed night. pg_cron's default `cron.timezone` is GMT, so the expression is in UTC; the hand test checks it.
- The job runs as the role that scheduled it (postgres), which owns `generate_dues`, so no grant is needed.
- Migration 1 does not mention pg_cron (criterion 33).

#### 4.8 PostgreSQL traps, and how the plan avoids each

- Regex repeat count over 255: no regex in this slice. (Any later check that needs `{n,m}` above 255 must be split, as `tutors_upi_id_check` does.)
- `now()` is constant inside a transaction: pgTAP files are one transaction, so `now()` never moves in a test. Tests of the rule use `p_now`; tests of `ensure_my_dues` and the opening balance read `public.india_day(now())` for their expected values and set `created_at` explicitly (`created_at` is not client-writable but the test runs as the owner). Function bodies use `now()` only as a default and in `ensure_my_dues`.
- Day-of-month in tests of `ensure_my_dues`: a student's due day is `least(extract(day from public.india_day(now()))::int, 28)`, with `created_at` 60 days back. On the 29th to 31st that is day 28, 1 to 3 days ago, still inside the window; on any other day it is today.
- `security definer` and `search_path`: every function sets `search_path = ''`, and every name in the bodies is schema-qualified (`public.`, `auth.`). Operators and `extract`, `least`, `now` live in `pg_catalog`, which is always searched.
- `on conflict` with a partial unique index: targetless `do nothing`.
- Time zones: only `at time zone 'Asia/Kolkata'` applied to a `timestamptz`; dates are `date`, never cast through `timestamptz`. India has no daylight saving, but nothing assumes the server's zone, and `110` re-runs the midnight case under UTC and America/Los_Angeles.
- `date + smallint`: `due_day` is `smallint`; `(s.due_day - 1)` is `integer`, and `date + integer` is `date`.
- Plpgsql variable names clash with column names: every variable is `v_`-prefixed, parameters `p_`-prefixed.
- Deferred foreign key: the insert of a due for a missing student fails at commit, not at the statement. Tests force the check with `set constraints all immediate` inside a `do` block (so `throws_ok` sees the 23503), and clients see the error as a failed request.
- Cascade on account delete: the deferred key lets `auth.users`, `tutors`, `students` and `dues` all go in one statement. R1-13's delete-account function must delete the `tutors` row (or the user) in a single statement, or delete `dues` before `students` if it ever deletes in steps.
- Concurrency: two runs inserting the same `(student_id, month)` block on each other and the second does nothing; the fixed insert order prevents deadlock.

### 5. pgTAP files (nothing here can run locally; CI proves it)

Rules for all six: start `begin; select tests.assert_ready(); select plan(n);`, end `select * from finish(); rollback;`, make their own users in `auth.users` (the trigger makes the `tutors` rows), insert fixtures as the test runner with explicit `created_at`, and use `tests.act_as(...)` only for what a client does. Each file runs twice in CI, so nothing may depend on leftover state. SQLSTATEs: 23514 check, 23505 unique, 23503 foreign key, 22P02 bad text for an integer, 22004 null not allowed, 42501 no privilege, 42883 no such function. `plan(n)` is the author's. Where several checks could refuse one row, the test asserts the SQLSTATE only (all are 23514) and one extra assertion lists the six check names in `pg_constraint`, so a missing check cannot hide behind another.

A `do` block form is used wherever a deferred key must be forced: `$$do $b$ begin <statement>; set constraints all immediate; end $b$$$`.

**`090_dues_table.sql` (criteria 1 to 7).** Fixture: tutors A and B, one student each.
- Shape: `has_table`, `columns_are` (the 11 names), `col_type_is` for `amount` integer, `amount_paid` integer, `month` date, `due_date` date, `created_at` timestamptz; `col_not_null` for all but `month`; `col_has_default` for `id, kind, amount_paid, status, created_at, updated_at`; `col_is_pk('id')`.
- The six check names exist (`is_empty` over a list).
- Accepts (`lives_ok`): a monthly due; an opening due; a partial due (`amount 1000, amount_paid 400`); a paid due; `amount` 100000000.
- Refuses 23514: `amount` 0; -1; 100000001; `amount_paid` above `amount` (with status `paid`); `amount_paid` -1; status `paid` with `amount_paid` 0; `due` with `amount_paid` above 0; `partial` with `amount_paid` 0; `partial` with `amount_paid` equal to `amount`; status `overdue`; kind `other`; monthly with null month; opening with a month; month `2026-10-15`.
- Refuses 22P02: `amount` as the text `'12.5'`.
- Unique 23505: a second monthly due for the same student and month; a second opening due for one student. Accepts (`lives_ok`): an opening due and monthly dues for two different months for one student; the same month for two students.
- Keys (in `do` blocks): a due for a student id that does not exist gives 23503; tutor B's `tutor_id` with tutor A's student gives 23503; deleting a student that has a due gives 23503.
- Cascade: `do $b$ begin delete from auth.users where id = tests.tutor_a(); set constraints all immediate; end $b$` runs (`lives_ok`); A's tutors, students and dues are zero; B's student and due remain.
- `updated_at`: after an `update`, `updated_at > created_at`.

**`100_dues_rls.sql` (criteria 8 to 12).** Fixture: A and B, a student and a due each (A also an opening due).
- `relrowsecurity` is true; `policies_are('public','dues', array['dues_select'])`; `policy_cmd_is(... 'SELECT')`; `policy_roles_are(... array['authenticated'])`.
- As A: reads its own 2 dues. As B: `count(*)` is 1 (its own); filtered by `tutor_id = A`, by `student_id = A's student`, by `id = A's due`, by `kind = 'opening'` each return 0.
- As A, each `throws_ok ... '42501'`: insert (own tutor, own student, with and without `tutor_id`); update `amount`; update `amount_paid`; update `status`; update `due_date`; update `tutor_id`; delete. As B: insert for A's student 42501.
- Privileges: `has_table_privilege('authenticated','public.dues','select')` true; `not has_table_privilege(... 'insert,update,delete,truncate,references,trigger')`; `not has_any_column_privilege('authenticated','public.dues','insert,update,references')`. For `anon`: `not has_table_privilege(... all seven)`, `not has_any_column_privilege`, and as anon `select count(*)`, insert, update, delete each 42501.
- Functions: `has_function_privilege` false for `anon` and `authenticated` on `generate_dues(timestamptz)`, `create_dues_for(timestamptz, uuid)`, `create_missing_opening_dues(timestamptz)`, `india_day(timestamptz)`, `sync_opening_due()`; true for `authenticated` and false for `anon` on `ensure_my_dues()`.
- As A, `select public.generate_dues()`, `generate_dues('2026-10-12 05:00+00')`, `create_dues_for(now(), null)` and `select public.sync_opening_due()` each 42501 (the privilege check comes before the "trigger function" error). As anon, `select public.ensure_my_dues()` 42501.
- `is_definer` for `ensure_my_dues`, `generate_dues`, `create_dues_for`, `sync_opening_due`; each `proconfig::text like '%search_path%'`.

**`110_dues_generation.sql` (criteria 17 to 28).** Called as the owner with a fixed `p_now`. Students for tutor A are inserted with `created_at` `2026-01-01` unless the case says otherwise. Between cases, `delete from public.dues; delete from public.students;` (allowed: the key is deferred and nothing is committed). Groups are labelled by rule so the Q1 change touches only groups A, B, D, K and L.
- **A. The rule (17, 18), `p_now = 2026-10-12 05:00+00` (12 Oct, 10:30 India).** Students: due day 12 (today); 5 (7 days ago, the oldest day in the window); 4 (8 days ago); 13 (tomorrow); due day 12 but `active = false`; due day 12 with fee 0; due day 12 fee 100000000. `generate_dues` returns 3. `set_eq` on (name, month, due_date): due 12 gives `2026-10-01, 2026-10-12`; due 5 gives `2026-10-01, 2026-10-05`; the 100000000 student gives amount 100000000. Nothing for the due-4, due-13, archived and zero-fee students (one assertion each). Every row has `kind 'monthly'`, `amount_paid 0`, `status 'due'`, `amount` equal to the student's fee at the time, and `tutor_id` equal to its student's (`is_empty` over mismatches).
- **B. Added on the day (26).** Due day 12 with `created_at 2026-10-12 08:00+00` (13:30 India, the same India day): created. Due day 11 with the same `created_at`: none.
- **C. Idempotence and the daily run (19).** Run twice at the same instant: the second returns 0, `lives_ok`, row count unchanged. Run it daily for 62 days: `select sum(public.generate_dues(timestamptz '2026-09-01 05:00+00' + g * interval '24 hours')) from generate_series(0, 61) g` for one due-day-5 student created `2026-09-01` gives exactly 2 (5 Sep and 5 Oct), and `count(*)` is 2. (24 hours, not `1 day`, so the session time zone cannot change the step.) A row inserted by hand just before a run (what a concurrent run would have done) gives 0 and no error.
- **D. Catch-up (20).** One run at `2026-10-13 05:00+00` over students with due days 10, 11, 12, 13 and 4: returns 4, none for day 4 (9 days back). A second scenario: a run on the 9th (creates what is due), nothing on the 10th to 12th, a run on the 13th creates days 10, 11, 12 and 13.
- **E. Fee snapshot (21).** Due day 12 fee 120000, run at 12 Oct: amount 120000. Set fee 150000, run again: returns 0, still one row, amount 120000. Run at `2026-11-12 05:00+00`: November row has 150000, October row still 120000.
- **F. Due-day change (22).** Due day 5, run at 5 Oct (row due 5 Oct). Set due day 8, run at 8 Oct: returns 0, still one October row dated 5 Oct. Run at 8 Nov: a November row dated `2026-11-08`.
- **G. February and leap years (23).** A student with due day 28 created `2026-01-01`: run at `2027-02-28 05:00+00` gives `due_date 2027-02-28`, month `2027-02-01`; run at `2028-02-28` gives `2028-02-28`; run on `2028-02-29` returns 0. Twenty-eight students with due days 1 to 28 created `2028-01-01`, run daily from `2028-02-01` to `2028-03-05`: 28 February dues, none dated `2028-02-29`. A due-day-28 student first run at `2028-03-01 05:00+00` gets the February due (month `2028-02-01`), which proves `v_prev` across a leap February; the same at `2027-03-01` gives `2027-02-01`.
- **H. India midnight (24).** Due day 1 created `2026-01-01`. `p_now = 2026-10-31 18:29:59+00` returns 0; `2026-10-31 18:30:00+00` returns 1 with `due_date 2026-11-01`, month `2026-11-01`. Repeated after `set local timezone to 'UTC'` and again after `set local timezone to 'America/Los_Angeles'`, with the dues deleted between, same answers. Direct: `india_day('2026-10-31 18:29:59+00')` is `2026-10-31`, `'2026-10-31 18:30:00+00'` is `2026-11-01`, `'2026-12-31 18:30:00+00'` is `2027-01-01`, under both session zones and under `'Pacific/Kiritimati'`.
- **I. Restore (25).** Due day 12, archived before the run on 12 Oct: none. Set `active = true`, run at 15 Oct: created (month October, due 12 Oct). A second student restored and run at 22 Oct: none for October; run at 12 Nov: a November due.
- **J. Two tutors (27).** Students of A and B with the same due day; one run; each tutor gets its own count; `is_empty` over `dues d join students s on s.id = d.student_id where s.tutor_id <> d.tutor_id`.
- **K. Signature and nulls.** `function_returns('public','generate_dues', array['timestamp with time zone'], 'integer')`; `generate_dues(null)` gives 22004.

**`120_ensure_my_dues.sql` (criterion 29).** Fixture: A with two students due "today by the formula in 4.8" (one with fee 120000, one with 150000), one archived, one with fee 0; B with one due-today student. All `created_at` 60 days back.
- `function_returns('public','ensure_my_dues', array[]::text[], 'integer')`; `is_definer`; `search_path` fixed; `ensure_my_dues(timestamptz '2026-01-01')` throws 42883 (no such function: it takes no argument).
- As A: returns 2; second call returns 0. As the owner: A has 2 dues, B has 0 of B's student's. `generate_dues(now())` afterwards returns 1 (B's), which shows `ensure_my_dues` and the job apply one rule.
- As A the call works although `not has_table_privilege('authenticated','public.dues','insert')`.
- A with no students: returns 0, no error. As anon: 42501. As A with `request.jwt.claims` set to `{"role":"authenticated"}` (no `sub`): 42501 "not signed in".
- As B: returns 1 and creates nothing for A.

**`130_opening_balance.sql` (criteria 34 to 39).** All done through `tests.act_as(A)` for inserts and updates (the realistic path), checked as the owner.
- Insert with balance 120000: exactly one due: `kind 'opening'`, `month` null, `amount 120000`, `amount_paid 0`, `status 'due'`, `due_date = public.india_day(now())`, `tutor_id` A. Balance 0 or omitted: none. A reads its own opening due; B reads none.
- Update to 150000: amount 150000. Update to 0: no due. Update 0 to 80000: due again. Update `name` only, or the same balance: due unchanged.
- Frozen: owner sets `amount_paid 40000, status 'partial'`; then A updates the balance to 90000, to 0, to 500000: the due keeps its amount and `amount_paid`, still one row, all `lives_ok`. The same with a fully paid opening due.
- Archive: `update active = false` leaves the due as is; restore too.
- Limits (criterion 38): insert with 100000000 `lives_ok`, due amount 100000000; update to the same, to 0, to 100000000 again; insert 0. 100000001 is refused by the student's own check (23514) and no due is left.
- Backfill (36): trigger disabled with `alter table public.students disable trigger user` (rolls back with the test), three students with balances (one archived) and one without, one student that already has a due made normally before the disable; `enable trigger user`; `create_missing_opening_dues('2026-10-12 05:00+00')` returns 3, due dates `2026-10-12`, no duplicate for the pre-existing one; a second call returns 0.
- `has_trigger` for both trigger names; `is_definer('sync_opening_due')`.

**`140_dues_schedule.sql` (criteria 30, 31).** `has_extension('pg_cron')`; `count(*) from cron.job where jobname = 'generate-dues-daily'` is 1; its `schedule` is `0 19 * * *`, `command` is `select public.generate_dues()`, `active` is true; calling `cron.schedule('generate-dues-daily', '0 19 * * *', $$select public.generate_dues()$$)` again leaves the count at 1; `lives_ok($$select public.generate_dues()$$)` as the owner. There is no skip: if the CI image lacked pg_cron, migration 2 would already have failed `db:reset`, which is the signal.

### 6. Front end (R1-6)

#### 6.1 `src/lib/dues-board.ts` (pure) and its exact test values

No React, no `Date`, no `Intl`. Days are `YYYY-MM-DD` strings; months are the first of the month, `YYYY-MM-01`. Integer day numbers come from the days-from-civil algorithm, so there is no local-time getter anywhere.

Signatures:
- `indiaToday(nowMs: number): string`. `Math.floor((nowMs + 19_800_000) / 86_400_000)` to a civil date. Floor, not truncate, so instants before 1970 are right.
- `daysBetween(a: string, b: string): number` (b minus a), `currentMonth(today)`, `shiftMonth(month, delta)`, `monthParts(month): { year: number; month: number }`.
- `type DueState = { tab: "overdue" | "due" | "paid"; tag: "overdue" | "due" | "part-paid" | "paid"; daysLate: number | null; isToday: boolean }`. `dueState(due, today)`.
- `remaining(due) = due.amount - due.amountPaid`.
- `boardView(dues, students, month, today, filter): BoardView` where `BoardView = { rows: Row[]; tabs: Record<Tab, Row[]> (sorted); counts: Record<Tab, number>; pending; collected; students; studentsInView; blocks: StripBlock[]; legend: { paid; due; overdue }; missing: string[] }` and `Row = { due: Due; student: Student; state: DueState }`. `students` is the whole roster (active and archived); `filter` is the already-effective `BatchFilterValue`.
- `defaultTab(counts)`, `monthMoves(month, earliest, today): { prev: boolean; next: boolean }`, `needsRead(slice, nowMs): boolean` (`slice` missing or older than 60,000 ms).

`dueState` table (today `2026-10-12`; amounts `amount/amountPaid`):

| Case | Result (tab, tag, daysLate, isToday) |
| --- | --- |
| paid monthly, due 2026-09-05 | paid, paid, null, false |
| paid opening | paid, paid, null, false |
| due 0/120000, due 2026-10-11 (yesterday) | overdue, overdue, 1, false |
| due, due 2026-10-12 | due, due, 0, true |
| due, due 2026-10-13 (tomorrow) | due, due, 0, false |
| due, due 2026-10-05 | overdue, overdue, 7, false |
| partial 50000/120000, due 2026-10-05 | overdue, overdue, 7, false |
| partial, due 2026-10-12 | due, part-paid, 0, true |
| partial, due 2026-10-13 | due, part-paid, 0, false |
| opening, due 2026-10-12, unpaid | overdue, overdue, null, false |
| opening partial, due 2020-01-01 | overdue, overdue, null, false |
| today 2026-11-01, due 2026-10-31 | overdue, overdue, 1, false |
| today 2026-10-31, due 2026-10-31 | due, due, 0, true |
| today 2026-03-01, due 2026-02-28 | overdue, overdue, 1, false |
| today 2028-03-01, due 2028-02-28 | overdue, overdue, 2, false |
| today 2027-01-01, due 2026-01-01 | overdue, overdue, 365, false |

`indiaToday` table (each also run with `process.env.TZ` set to UTC, America/Los_Angeles, Asia/Kolkata and Pacific/Kiritimati, asserting the offset really changed, as `format.test.ts` does):

| Instant (UTC) | Result |
| --- | --- |
| 1970-01-01T00:00:00Z | 1970-01-01 |
| 1969-12-31T18:29:59Z | 1969-12-31 |
| 1969-12-31T18:30:00Z | 1970-01-01 |
| 2026-10-12T05:00:00Z | 2026-10-12 |
| 2026-10-11T23:59:59Z | 2026-10-12 |
| 2026-10-31T18:29:59Z | 2026-10-31 |
| 2026-10-31T18:30:00Z | 2026-11-01 |
| 2026-12-31T18:30:00Z | 2027-01-01 |
| 2028-02-28T18:30:00Z | 2028-02-29 |
| 2028-02-29T18:30:00Z | 2028-03-01 |
| 2027-02-28T18:30:00Z | 2027-03-01 |
| 2100-02-28T18:30:00Z | 2100-03-01 |

`shiftMonth`: (`2026-01-01`, -1) gives `2025-12-01`; (`2026-12-01`, 1) gives `2027-01-01`; (`2026-10-01`, -13) gives `2025-09-01`. `monthMoves` with earliest `2026-08-01`, today in October: October gives prev true, next false; September true, true; August false, true; earliest null: October false, false.

`boardView` fixture: roster S1 "asha" (batch B1, active), S2 "Bina" (no batch, active), S3 "Chitra" (archived), S5 "dev" (no batch, active); S4 is not in the roster. Today `2026-10-12`, view month `2026-10-01` (the current month). Dues (amount, paid in paise):

| id | student | kind | month | due_date | amount/paid | status |
| --- | --- | --- | --- | --- | --- | --- |
| d1 | S1 | monthly | 2026-10-01 | 2026-10-05 | 120000/0 | due |
| d2 | S2 | monthly | 2026-10-01 | 2026-10-12 | 100000/40000 | partial |
| d3 | S1 | monthly | 2026-09-01 | 2026-09-05 | 120000/0 | due |
| d4 | S2 | opening | null | 2026-09-30 | 240000/0 | due |
| d5 | S2 | monthly | 2026-09-01 | 2026-09-05 | 100000/100000 | paid |
| d6 | S3 | monthly | 2026-10-01 | 2026-10-05 | 90000/0 | due |
| d7 | S4 | monthly | 2026-10-01 | 2026-10-05 | 80000/0 | due |
| d8 | S5 | monthly | 2026-10-01 | 2026-10-12 | 50000/50000 | paid |

Expected, filter `all`, October (current): rows d1, d2, d3, d4, d8 (d5 paid and earlier, d6 archived, d7 not in roster are out). Overdue tab order `[d4, d3, d1]` (opening first, then 37 days late, then 7). Due tab `[d2]`, tag part-paid. Paid tab `[d8]`. `counts` `{overdue 3, due 1, paid 1}`. `pending` 540000 (120000 + 60000 + 120000 + 240000). `collected` 90000 (d2's 40000 plus d8's 50000; d3 and d4 are not October). `students` 2 (S1, S2). `studentsInView` 3. `blocks` `["paid","overdue","overdue"]`; `legend` `{paid 1, due 0, overdue 2}`, adding to 3. `missing` `["S4"]` (S3 is archived, so not missing).
- September (past month): rows d3, d5 only; `pending` 120000; `collected` 100000; no carried rows.
- Filter `none`: rows d2, d4, d8, `pending` 300000, `collected` 90000. Filter B1: rows d3, d1 in that order, `pending` 240000, `collected` 0, `students` 1, `studentsInView` 1.
- Ties: two overdue rows with equal days late sort by lower-case name then id; two Due rows by due date then name then id; Paid by name then id.
- `defaultTab`: counts `{3,1,1}` gives overdue; `{0,2,1}` gives due; `{0,0,4}` gives paid; `{0,0,0}` gives overdue.
- Money: the sum of 300 dues of 100000000 is `30000000000`, an integer; `formatRupees` of it is `₹30,00,00,000`.

#### 6.2 `src/lib/dues.ts` and the reader

- `DUE_COLUMNS = "id,student_id,kind,month,amount,amount_paid,status,due_date"`. Never `*`, never `tutor_id`.
- `readMonth(month)`: `from("dues").select(DUE_COLUMNS).eq("month", month).order("due_date").order("id").range(from, from + 999)`; `readUnpaid()`: `.neq("status", "paid")` with the same order; `readEarliestMonth()`: `.select("month").not("month", "is", null).order("month").limit(1)`, returns `string | null`.
- Paging: a loop of pages of 1,000, stopping when a page returns fewer than 1,000 (so exactly 1,000 rows costs one extra request that returns 0). The order is a total order (`due_date, id`), otherwise rows could repeat or be skipped across pages. The page size equals the server's `max_rows` (1,000 in `supabase/config.toml` and the hosted default); a comment says that lowering `max_rows` means lowering the page size. A failed page throws `DuesLoadError` and returns nothing partial. `classifyLoadFailure` is reused for a refused session.
- `dueFromRow` throws on an unknown kind or status, a non-integer or negative amount, or an `amount_paid` above `amount`: the read fails loudly rather than drawing a wrong amount.
- `ensureMyDues(): Promise<number>`: `client.rpc("ensure_my_dues")`, never throws, returns 0 on any failure or a non-integer answer. POST, not retried by the library (only GET and HEAD are, on 503 and 520).
- Unit tests (fake client, `db-fake.test-util.ts` extended): 2,350 rows served at most 1,000 per request come back as 2,350 in order with 3 requests, with `offset` 0, 1000, 2000 and `limit` 1000; exactly 1,000 rows costs 2 requests; a failing second page rejects the whole read; the select string equals `DUE_COLUMNS`; no `tutor_id` anywhere in the calls; `ensureMyDues` returns 3 for `3`, 0 for an error, 0 for `"x"`; `dueFromRow` refuses `status: "overdue"`.

#### 6.3 Where board state lives, and the call policy

- **One `BoardProvider` in the `(book)` layout**, inside `RosterProvider`. It holds, in a ref-backed store with a version counter: `months: Record<month, { rows: Due[]; at: number }>`, `unpaid: { rows; at } | null`, `earliest: { month: string | null; at: number } | null`, `failed: boolean`, and the tutor's `settings: { month: string | null; tab: Tab | null; filter: BatchFilterValue }`. `month: null` means "the current month", so when the India day rolls over and the tutor has not moved, the view rolls with it; choosing the current month stores `null`. `tab: null` means "the default tab" (criterion 45); a tap stores the tab until the tutor taps another.
- **Why a provider and not module state:** leaving the book group (sign-out, More) unmounts it and resets the settings and the cache, as the roster does; a module-level store would survive sign-out. Its code (state, reader, pure functions, a few KB gzipped) loads on every book route; the board components load on `home` only. If the Students route's measured size passes 170 KB because of this, move the provider's reader to a dynamic import.
- **Open policy (criterion 70).** `BoardScreen` mounts only when the roster is ready and has an active student, so with none there is no request (criterion 51). On mount and when the day changes it calls `board.open(today)`:
  1. If `navigator.onLine === false`: send nothing. With a cache, set `failed` (the quiet line shows); with none, the error state.
  2. Otherwise, in parallel: `ensureMyDues()`; `readMonth(viewMonth)`; `readEarliestMonth()`; and, when the view month is the current month, `readUnpaid()`.
  3. If `ensureMyDues()` returns more than 0, read again once (the same reads). Its failure or slowness is ignored: the board never waits for it.
  4. A request that is not the newest for its key (a ticket number per key) is dropped when it returns, so a slow older answer cannot overwrite a newer one.
  5. A successful read replaces its slice wholesale (an opening due the database removed disappears); a failed read keeps the cache, sets `failed`.
- **Opening a month.** Choosing a month that is not cached, or older than 60 seconds (`needsRead`), reads just that month (and nothing else); otherwise no request (criterion 71). Opening the Home screen always runs `open`, which is the "quiet refresh on opening a screen"; the 60-second rule is only for moving between months.
- **The view of a month.** Current month: the union of `months[M]` and `unpaid` (deduplicated by id). Past month: `months[M]` only.
- **A due whose student is not in the roster** (criterion 72): `boardView` returns `missing`; `BoardScreen` calls `roster.reload()` once per read (a flag reset by each read).
- **Today.** `BoardScreen` keeps `today` in state, set from `indiaToday(Date.now())` in an effect on mount, and set again on `visibilitychange` when the page becomes visible; if it changed, `open` runs again (criterion 75). No timer (criterion 82). Tests use Playwright's `page.clock.setFixedTime`, not `install`, so timers stay real and the Supabase library's refresh timer is not frozen.
- **Where words and numbers are formed.** Components only: `useTranslations("board")`, `formatRupees`, `formatDate`. The month label is `t("monthYear", { month: t(`months.${n}`), year: String(year) })`.
- **Stale text.** The quiet line `board.stale` shows when `failed` and there is a cache, with a Try again button (same pattern as the list). The roster's own `stale` is also honoured.

#### 6.4 The home screen

- `HomeScreen` keeps `RosterGate`; `Chosen` returns `EmptyHome` when there is no active student (unchanged, with no month switcher and no dues request) and `BoardScreen` otherwise. `FilledHome` and its slip, two links and "soon" line are deleted (criterion 52). `BoardScreen` renders `AppScreen nav="home"` (the Home item is `aria-current`).
- Order on screen: month switcher; the hero (label, amount, "from n of m students", the quiet "collected" line only when above ₹0, the one soon-line); the batch select (only when the tutor has a batch); the strip with its legend; the tabs; the panel (rows, then the end-of-list line). The canvas file `Home.dc.html` decides the exact order of the select and the strip; the greeting line of the old home is dropped unless the canvas draws it. Tab order: previous, next, batch select, tabs, rows (criterion 73).
- The month arrows are plain `<button>`s with an inline chevron (`BackIcon` and a mirrored copy in `src/components/app/icons.tsx`), at least 44px by 44px, native `disabled`, accessible names `board.prev` and `board.next`. No new `ui/` component.
- **BatchFilter reuse.** Pass `variant="select"`, `batches`, `counts = batchCounts(activeStudents, batches)`, `value`, `onChange`. The current value is `effectiveFilter(filter, batches, counts)`; `boardView` gets the effective value, so a deleted batch falls back to All (criterion 59). Its label is `students.filterLabel` ("Show"). Not drawn with no batches. The tab panel's `id` and `aria-labelledby` come from the status tabs, not from the filter (`filterPanelProps` is not used here).
- **Student edit link.** Each row is one `<a>` built with `editHref(locale, student.id)` from `student-row.tsx` and `useSoftLink`; at least `min-h-16` (66px), `wrap-anywhere`, no control inside it. Move `editHref` to `src/lib/` only if importing it from a component file looks wrong in review; do not copy it.
- **Row content** (criterion 57) is `StatusTag` (the status passed to `StatusTag` is the tag, `part-paid` included), the name, the line (`board.row.dueOn` with `formatDate`, the batch name, and `board.row.partPaid` or `board.row.monthFee` or `board.row.earlier`), and the amount in `type-amount-row` (remaining for Overdue and Due rows, the amount for Paid rows). No Remind, no Mark paid (criterion 66); the inert line `board.soon` sits under the hero.
- **All paid (criterion 64)** uses `Stamp` (`size="lg"`, `tone="stamp"`, `label` = the stamp word, `secondLine` = the month and year), the three lines, and the tabs and list below.
- **Loading** reuses `BookBlocks`/`LoadingBook` with the month and "Still to come in" above the blocks; **error** reuses `Banner kind="error"` with `board.loadError.*`.
- **Home-scrolled (collapsed header)**: not built. The header scrolls away. Cutting it keeps the step small; it can follow.

#### 6.5 The fake host, `e2e/dues-helpers.ts`

`stubDues(page, initial)` registers after `stubSupabase` (a later `page.route` wins), for `GET /rest/v1/dues` and `POST /rest/v1/rpc/ensure_my_dues`; `OPTIONS` falls back as `roster-helpers.ts` does. It returns a handle:
- `dues: DueRow[]` (the table's eight columns plus `tutor_id`), `addDue(partial)`, `requests` (method, path, query, body, headers, in order), `bodies()`.
- `GET` honours: `select` (only the named columns come back), `month=eq.X`, `status=neq.paid`, `month=not.is.null`, `order=` of `due_date,id` and `month`, `limit` and `offset` (and a `Range` header if present), and a **server cap of 1,000 rows** (`maxRows`), so the paging loop is proved against a server that truncates. A request that asks for `*` or names `tutor_id` is refused with 400 so a spec fails if the reader changes.
- `POST ensure_my_dues`: records the parsed body (the spec asserts it equals `{}`), answers the integer count. Switches: `ensure: { returns: number; add: DueRow[]; fail: boolean; delayMs: number }` (when called it appends `add` to `dues` and answers `add.length` unless `returns` is set), `networkDown`, `readStatus` (use 500; 503 and 520 make the library retry with delays), `listDelayMs`, `refuseWrites`. Any `POST`, `PATCH` or `DELETE` to `/rest/v1/dues` is logged and answered 403 `42501`, so criterion 76 can assert none were sent.
- The clock: `page.clock.setFixedTime(new Date("2026-10-12T05:00:00Z"))` before `goto`; the session is seeded with `fakeSession(email, 30 * 86400)` so the made-up token is still valid at the fixed time (its expiry is computed from the real clock). Time zone per spec: `test.use({ timezoneId: "America/Los_Angeles" })` and again `"Pacific/Kiritimati"`, with the same assertions as India time (criterion 74). Day change: `setFixedTime` to `2026-10-12T18:31:00Z` (00:01 on the 13th India) then `page.evaluate` dispatches `visibilitychange` (the page's `document.visibilityState` is overridden to `visible` first).
- `stubSupabase` (not this file) gets the default empty answers, section 3.

#### 6.6 Size, copy, leak check

- **Size.** The `home` route today is whatever `pnpm size` printed for the R1-3 branch; `frontend-dev` copies that number into the first R1-6 commit message. The board adds no dependency and no heavy library; expect roughly 10 to 15 KB gzipped (pure libraries, provider, nine small components, `Tabs`, `StudentStrip`, `StatusTag` and `Stamp`, which are small). Stop and report if `home` passes 170 KB (limit 200). The `board` words go in the page as `ClientMessages` on `home` only. `scripts/size.mjs` already lists `home`; its 150 KB warning is not a failure.
- **Copy.** All keys of spec section 8 under `board`, in `en`, `hi`, `kn`, `te` together, plus `board.monthYear`; the plural on `board.hero.from`; `board.months.1` to `12` (Hindi October from the canvas); the rest of hi, kn, te `TODO-translate: <English>`. Remove `home.filled.total`, `home.filled.soon`, `home.seeAll` from all four files. `pnpm i18n:check` is the gate.
- **`check:leak` caveat.** It fails a page that carries a value unique to another language. Keep every month name and every word in messages, none in `.ts` or `.tsx` (English month names in code would one day be "unique to English" once the others are translated, and then flag as a leak on a Hindi page). Pass the year and counts as strings or integers into ICU plural only; do not format digits in components. It needs a build, so `frontend-dev` runs it with the CI fake address.

### 7. Work split and order

Each step ends with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`, and, where the step touches the app, `pnpm build` with the CI fake address, `pnpm size` and `pnpm test:e2e` green, and `pnpm check:db --base origin/main` where it touches `supabase/`. One commit per step. `backend-dev` should work in a checkout or branch separate from the R1-3 branch (that work is uncommitted here); R1-5 needs only what is on `main`.

| # | Owner | Task | Done when |
| --- | --- | --- | --- |
| 1 | `backend-dev` | **R1-5 pull request A.** Migration 1 (`20261012100000_r1_dues.sql`, section 4) and pgTAP `090` to `130`. Push; read the `database` job until it is green with both `db:test` runs; `check:db` green. | Criteria 1 to 14 and 17 to 29, 33 to 39, 85 (the `140` part excepted). |
| 2 | `code-reviewer`, `lead-reviewer`; the lead | Review and merge A. Then the lead runs `supabase migration list`, `supabase db push --dry-run`, `supabase db push` against staging only, after the CI job is green and the dry run shows exactly this migration. The lead then runs the read-only checks in section 12, part A. | **R1-5 can ship here.** Staging has the table, the functions, the founder's opening dues. |
| 3 | `backend-dev` | **Pull request B.** Migration 2 (schedule) and `140`. | CI green; criteria 30, 31. |
| 4 | the founder, the lead | If the push of migration 2 to staging errors on `pg_cron`, the founder switches it on (Database, Extensions) and the lead pushes again. The next morning, hand test A3. | Criterion 32. Not blocking R1-6. |
| 5 | `frontend-dev` | (can start at once, new files only) `dues-board.ts` and `dues.ts` with their unit tables; `db-fake.test-util.ts` additions; `e2e/dues-helpers.ts`. | Criteria 16 (library part), 40 to 50, 82, 84 pass as unit tests. |
| 6 | `frontend-dev` | (after R1-3 merges and the branch is rebased) `BoardProvider`, `BatchFilter` `variant`, the board components, `HomeScreen` change, deletion of `FilledHome`, messages, `stubSupabase` defaults, updated R1-3 home e2e, `board.spec.ts`. | Criteria 51 to 79, 81, 83. **Cut line:** the founder can add a student with "Already owes" and see it Overdue at once, add one with a due day of today and see it Due, on his phone. |
| 7 | `frontend-dev`, then `test-engineer` | Four languages by 360px by large-font loop (`board-layout.spec.ts`), the two time-zone runs, size report; `test-engineer` checks every criterion has a test and fills gaps, including pgTAP coverage. | Criteria 74, 78, 79, 80 and the coverage pass. |

If time is short, stop at step 6. Step 7's layout loop must still run before the founder shows anyone.

### 8. Tests required

| Criteria | Where |
| --- | --- |
| 1 to 7 | `090_dues_table.sql` |
| 8 to 12 | `100_dues_rls.sql` (and the existing `020`, `030` stay green) |
| 13, 14 | `pnpm check:db --base origin/main`; CI runs every file twice |
| 15 | [manual] hand test A and B16 |
| 16 | `student-list-screen.test.tsx` extended to `.rpc(`; `dues.test.ts` |
| 17 to 28 | `110_dues_generation.sql` |
| 29 | `120_ensure_my_dues.sql` |
| 30, 31 | `140_dues_schedule.sql` |
| 32 | [manual] hand test A2 and A3 |
| 33 | the CI `database` job runs migration 1 alone before migration 2 only in pull request A (migration 2 is not yet on the branch) |
| 34 to 39 | `130_opening_balance.sql` |
| 40 to 48 | `dues-board.test.ts` (tables in 6.1) |
| 49, 50 | `dues.test.ts` |
| 51 to 53, 55, 56, 61 to 66 | `board.spec.ts` with `stubDues`, plus component tests for the rows and states |
| 54, 57 to 60 | `board.spec.ts`, `board-row.test.tsx` |
| 67 to 69 | `board.spec.ts` (`listDelayMs`, `networkDown`, `context.setOffline`) |
| 70 to 72 | `board.spec.ts` (`ensure.returns`, `add`, `fail`, `delayMs`; the request log) |
| 73, 76, 77 | `board.spec.ts` (tab order; no `POST` but `ensure_my_dues`; no cookie, no other host, no `pay_token` in any URL or body) |
| 74, 75 | `board.spec.ts` with `timezoneId` and `setFixedTime` |
| 78, 79 | `board-layout.spec.ts` (60 students, an 80-character name, Indian-script names, a 60-character batch name, amounts of `₹10,00,000` and `₹1,00,00,000`, four languages, large font, forced grayscale) |
| 80 | `language-rules.test.ts` extended, and the layout spec |
| 81 | `pnpm size` |
| 82 | `dues-board.test.ts` and `board-screen.test.tsx` (`visibilitychange` recomputes; no `setInterval` or `setTimeout` in the board files) |
| 83 | `pnpm i18n:check`; the no-strings and no-marker specs |
| 84 | a grep test over `src/lib/dues*` and `src/components/board/*` |
| 85 | CI `database` job |

### 9. Risks and traps

| Risk | How the plan avoids it |
| --- | --- |
| The function that writes dues is reachable by any signed-in tutor (`ensure_my_dues`). | It takes no argument, acts on `auth.uid()` only (a null uid raises 42501), calls a worker that is revoked from clients; `120` proves A creates nothing for B and anon is refused. |
| Account deletion blocked by a nested cascade. | Deferred key (difference 1); `090` deletes an `auth.users` row and forces the check. R1-13 must delete the user or tutor in one statement. |
| A trigger error stops a student being saved. | No error path except true constraint failures; `on conflict do nothing`; tested at 100000000, 0 and the frozen case. |
| Opening balance and "Already owes" disagree after a payment. | Frozen by design; R1-7 must lock the field in the student form and say why. R1-7's `record_payment` must set `amount_paid` and `status` together (the check enforces it) and is the only writer of those. |
| Duplicate dues from the job, the on-demand call and the trigger at once. | The keys plus targetless `do nothing`; fixed insert order; the opening index. |
| Wrong day near midnight or in another zone. | One `india_day` function; no `current_date`; the browser uses its own integer arithmetic, never the phone's date; tests in four process time zones and two session time zones. |
| A first run on staging surprises the founder: his existing students whose due day fell in the last 7 days get a due, and appear Overdue at once. | Expected and by design (criterion 20); the hand-test list says so. A student added after their due day gets none for that month. |
| Paging past 1,000 rows repeats or loses rows. | A total order (`due_date, id`), page size equal to `max_rows`, the fake host enforces the cap. |
| Dues for a student the phone has not seen yet, or the roster is stale. | `missing` triggers one roster reload; the row appears on the next render. |
| Phone clock wrong. | "Days late" use the phone's clock; creation uses the server's. Accepted in the spec. |
| Existing e2e specs break because Home now asks for dues. | `stubSupabase` answers the dues routes by default; the R1-3 home assertions are replaced in step 6. |
| The library retries a failing GET on 503 or 520, so an error test would wait or flake. | `stubDues` uses 500 for read failures; the one retry-status test waits as `students.spec.ts` does. |
| The made-up token expires under the fixed clock, and the library signs the tutor out. | Session seeded with a 30-day lifetime; `setFixedTime` only (timers stay real). |
| `BoardProvider` in the book layout enlarges every book route. | Measured per route in the pull request; fallback in 6.3. |
| ICU formats a number as `2,026` or in another script. | Year passed as a string; counts only in plural arguments; e2e reads the rendered digits in all four languages (criterion 80). |
| Ellipsis or clipping of long names, 60 rows, large font. | `wrap-anywhere`, rows grow, the layout spec. |
| `check:leak` flags a word in code. | All words in messages (6.6). |

### 10. What cannot be verified here, and how each is verified later

- **All SQL.** No Docker and no `supabase` command here. The CI `database` job runs `db:reset` and `db:test` twice; the author's job is to read it until green. Every SQLSTATE above is reasoned from PostgreSQL behaviour, not observed. The two most likely surprises: the deferred-key timing (a test fails if a check fires at the statement instead of at `set constraints`), and `auth.uid()` with no `sub`.
- **pg_cron on the hosted projects.** That `create extension pg_cron` works from a migration on staging, that the job runs at 19:00 UTC, and `cron.timezone` being GMT. Verified by the lead's `db push`, the founder's read-only queries (hand test A2, A3), and `cron.job_run_details` the morning after. If production differs, found at the production migration, which the founder approves separately.
- **The real behaviour on the founder's data.** The backfill, and the first-run catch-up on his existing students. Verified by the lead's read-only counts after the push (section 12 part A) before the founder opens the app.
- **Real timing on a phone in India**, large font on real devices, and the Indian-script rendering: the founder's hand test.
- **Facts read from the installed source and not run:** `range` sends `limit` and `offset`; `rpc` with no arguments sends `{}`; GET retries on 503 and 520 only. Re-checked by the unit and e2e tests.
- **Bundle size.** The R1-3 baseline for `home` is not known here; measured by `pnpm size` in step 6.

### 11. Not doing

- Fixing, editing, waiving or deleting a due, or a "write off" action (Q3). Archive is the way out.
- Create-on-the-1st (Q1's alternative).
- Mark paid, `payments`, `record_payment`, receipts, Remind, "to confirm", claims, the pay page, offline queue, analytics events, the collapsed header (`Home-scrolled`), a desktop board, search or sort on the board, grace days.
- Sample data or a script to fake statuses on staging (Q2).
- A check that a monthly `due_date` lies inside its month; a `(tutor_id, student_id)` index; a stored "overdue" status.
- Rate limiting `ensure_my_dues` (it is bounded by one tutor's own students).
- Any new dependency, any new `ui/` component, any edit to `supabase/config.toml`, any edit to the pgTAP files `040` to `080`.
- Touching production.

### 12. What the founder tests by hand on a phone (only what exists)

Staging, signed in, 360px wide, then again at the largest system font.

**A. After R1-5 only (read-only, done by the lead in the Supabase dashboard; the founder watches):**
1. `dues` exists; `select count(*) from dues` equals the number of students with "Already owes" above 0 (his existing students, if any); each such row is `kind = 'opening'`, `month` null, `amount` = the balance in paise, `due_date` the day of the push.
2. After the schedule is applied: `select jobname, schedule, active from cron.job;` shows `generate-dues-daily`, `0 19 * * *`, active. If the query errors or the push failed, switch on `pg_cron` in Database, Extensions and tell the lead.
3. The morning after: `select status, start_time from cron.job_run_details order by start_time desc limit 3;` shows `succeeded` at about 19:00 UTC (00:30 India).

**B. After R1-6:**
4. Open Home with students. You see the month and year, "Still to come in", an amount, the strip with its words, three tabs and the list. No Remind or Mark paid; one line says they arrive later.
5. Existing students whose due day fell in the last 7 days now show a due, Overdue, the first time you open Home. That is the catch-up, on purpose.
6. Add a student with "Already owes ₹2,400". Home: they are in Overdue as "Earlier balance", `₹2,400`, and the big amount rose by `₹2,400`.
7. Add a student whose due day is today's date (if today is the 29th, 30th or 31st, use 28: it shows as Overdue 1 to 3 days, which tries "days late"), fee `1200`. Home, within a second or two: a row `₹1,200` in Due ("Due today"), and a hollow block in the strip. Add one with a due day of yesterday: no due for this month (a student's first due is on or after the day they were added).
8. Edit "Already owes" to `1,500`: Home shows `₹1,500`. Edit to `0`: the row is gone.
9. Tap a row: it opens that student's edit screen. Go back: the same month, tab and batch are showing.
10. The previous-month arrow is disabled while only this month has dues; the next arrow is disabled in the current month.
11. Add a batch and put a student in it. The Show control appears with counts; pick the batch: amount, strip, tab counts and rows change together; pick All batches. Delete the batch elsewhere and come back: All batches.
12. Archive a student who has a due: their row and amount leave Home. Restore: they return.
13. Tomorrow, open Home: the "Due today" row says "Overdue 1 day" and has moved to Overdue.
14. Phone time zone set to London (automatic off): labels, days late and the month do not change. Set it back.
15. Airplane mode, open another screen and return to Home: the board stays and says "Showing what was saved on this phone." Back online, tap Try again.
16. Hindi, Kannada, Telugu: month, tabs, tags and amounts read cleanly, digits 0 to 9, nothing cut.
17. Table editor, `dues`: the new rows have the right `tutor_id`, `kind`, `amount` in paise (`120000` for ₹1,200), and `due_date` as a plain date.
18. Overdue days beyond what time gives, Part paid and Paid cannot be seen on staging yet (they need days to pass and R1-7); the e2e tests cover them with made-up data. No shortcut (Q2).

### 13. Needs from the founder, and who starts

- Nothing blocks the build. Possible asks: switch on `pg_cron` in the Supabase dashboard only if migration 2 fails on staging; later, choose Q1 (create-on-the-1st) and Q3 (fix or waive a due); later, approve each production migration and the release himself.
- For the lead: amend `supabase/CLAUDE.md` (a select-only policy on `dues`, three creators of dues); give R1-7 the rules in section 9 (lock "Already owes" after a payment; `record_payment` is the only writer of `amount_paid` and `status`); give R1-13 the deferred-key note.
- **Start:** `backend-dev` takes step 1 (migration 1 and pgTAP `090` to `130`, on a branch from `main`, separate from the R1-3 working tree). `frontend-dev` may start step 5 (pure libraries, fake host) in new files while step 1 runs, and starts step 6 only after R1-3 has merged.
