# R1-3: students, batches, and the home that shows them

Slice R1-3 "Students: list, add one, batches" (docs/BUILD_PLAN.md section 5). Depends on R1-1 and R1-2, which are built and live on staging.

Process: the lighter one the founder approved on 2026-10-11. This one file is the short spec and the technical plan. Branch `r1-signin-and-data`. Staging only.

Goal: after sign-in and setup, the tutor puts students in the book. Add one student, see the list, search it, group students into batches, edit, archive. All of it works against the real tables on staging.

Tags: [unit] Vitest, [e2e] Playwright at 360px with the fake Supabase host, [db] pgTAP, [manual] by hand on a phone against staging.

## 1. Decisions made here (no founder input needed)

1. **No migration. No `backend-dev` work.** Everything this slice needs is in the R1-2 migration: the columns, the grants, the unique batch name, the composite batch key, and `on delete set null (batch_id)`. pgTAP already covers batch delete nulling `batch_id` (`050_batches.sql`) and cross-tutor isolation (`060_students.sql`). The client writes only the granted columns (section 8.4).
2. **Routes are static shells. A record is named by a query string, not a path.** A static export cannot prerender `/students/<uuid>/`. So the edit screens are `students/edit/?id=<uuid>` and `batches/edit/?id=<uuid>`, one shell each, reading `id` from `window.location` in an effect (the pattern the token routes use; no `useSearchParams`, as in R1-1 8.4).
3. **"Student detail" is the edit screen for now.** The canvas "Student" screen is mostly dues, reminders, receipts and attendance, which do not exist yet. R1-3 builds the part that exists: the name, the fields, and Archive. R1-6 and R1-8 grow it. No Remind, Mark paid, Share pay link, history or attendance here.
4. **Online-only writes, a recorded exception to the outbox rule** (same as R1-1 decision 9). Every write is one function in `src/lib/students.ts` or `src/lib/batches.ts`. R1-12 swaps those functions. Components never call `supabase.from(...)`. Ids for new rows are made in the browser (`crypto.randomUUID()`), once per form, so R1-12 needs no change and a double tap or retry cannot make two rows.
5. **Everything is read once and filtered in the browser.** A tutor has 10 to 60 students (a centre, at most 300). One read of all students and one of all batches. Search, batch filter, counts and totals are computed on the phone. PostgREST returns at most 1000 rows by default; that is far above the limit, so there is no paging.
6. **The roster is cached for the signed-in session** in one context (`RosterProvider`). Screens show the cached list at once and refresh it quietly on open. A write updates the cache from the row the database returned.
7. **Archive, not delete, for students.** Archive sets `active = false`. The student leaves the list and (later) dues and reminders; the row, token and history stay. It can be undone ("Restore"). There is no hard delete of a student in R1-3 (the grant exists; the only delete is account delete, R1-13). Batches are the opposite: really deleted, their students stay with no batch.
8. **Phone is optional. Money is whole rupees.** A student with no phone is saved (a parent without WhatsApp is real); Remind will say "add a number first" in R1-8. Fee and "Already owes" are typed in whole rupees and stored as integer paise (x100). Paise typed by hand are refused with words, not rounded.
9. **Same phone twice is allowed, with a note.** Siblings share a parent's number. There is no unique constraint and none is added. The form shows a non-blocking line: "This number is already saved for {name}."
10. **The Contact Picker, paste-a-list and CSV are R1-4.** Not here. No button for them is shown. The Add form is built so R1-4 can fill its name and phone fields from a contact.
11. **No setup step 3 screen yet.** R1-1 made step 3 the empty home. The canvas step 3 ("Add your students": paste, contacts, CSV, one at a time) is a chooser where three of four ways are R1-4. The empty home's black "Add a student" button goes straight to the add form. R1-4 adds the chooser and repoints that button.
12. **Bottom nav arrives now** (R1-1 decision 10). It needs four destinations. Attendance does not exist, so `attendance/` is a one-line placeholder page ("Attendance arrives in a later update.") with the nav on it. R1-11 replaces it. The alternative, changing `BottomNav` to take three items, edits a finished design-system component for a few weeks of use; not worth it.
13. **No "Try with sample data".** Not in R1-3 (open question 1).
14. **Batches are managed from the Students screen**, not from More. The canvas "Batch" screen backs out to More, but More is being built in parallel and R1-3 must not depend on it. The Students screen has a "Batches" link. If More later wants a link too, that is one line.
15. **The canvas truncates names with an ellipsis; the repo rules say never.** Rows grow and wrap (`wrap-anywhere`). The rules win (`src/CLAUDE.md`).
16. **Batch filter: tabs for up to 3 batches, a select above that.** The canvas draws tabs and they cannot hold more than about three at 360px. R1-6 (dues board) needs the same filter; this component is built once (`BatchFilter`) so R1-6 reuses it.
17. **"I have this parent's permission to save their number" is a required tick when a phone is typed.** PRD section 9 asks the tutor to confirm. It is not stored (no column; the PRD data model has none). It is asked again only when a phone is newly added or changed.

## 2. Open questions for the founder

Only one is really his.

1. **Where does "Try with sample data" go?** PRD section 5 and two canvases (Setup-add, State-empty) show it. BUILD_PLAN does not give it a slice. It needs a way to insert about 8 made-up students and a way to remove them, and there is no `sample` flag column. **Recommendation: leave it out of R1-3 and R1-4.** You will test with real names, and the reminder to a made-up parent cannot be sent anyway. If you want it, add it as a small slice after R1-8, with a `is_sample` column and a "Remove sample students" button.

Not asked, decided above: whole rupees only; fee must be at least ₹1; no stored permission tick; archive not delete; the placeholder Attendance page.

## 3. Acceptance criteria

Routes are under `/{locale}/`, inside the `(app)` group (so inside the gate), all prerendered shells, all `noindex`.

### Nav and routes

1. New app places: `students/`, `students/new/`, `students/edit/`, `batches/`, `batches/edit/`, `attendance/`. Each is added to `Place`, `placePath` and the `nextRoute` list of app places, so a signed-out visitor is sent to sign-in and an unfinished profile is sent to its setup step, exactly as for `home/`. [unit] [e2e]
2. The bottom nav (Home, Students, Attendance, More) shows on `home/`, `students/`, `batches/`, `attendance/` and `more/`, with the right item current (`aria-current="page"`). It does not show on `students/new/`, `students/edit/`, `batches/edit/` or setup. Each item is at least 44px and its label wraps. [e2e]
3. `attendance/` shows the title and one line "Attendance arrives in a later update." and the nav. Nothing else. [e2e]

### Students list (`students/`)

4. Header shows "{n} students" (or "1 student") and, after a dot, "{m} batches" ("1 batch", "No batches"), the title "Students", and a black "Add" button (at least 48px high) to `students/new/`. [e2e]
5. Rows show: number, name, parent name when there is one, and "₹1,200 on the 5th" (fee in DM Mono with Indian grouping, due day with its ordinal in the page's language) and the batch name or nothing. No status tag yet (dues arrive in R1-5). The whole row is one link to `students/edit/?id=...`, at least 60px high, and grows with long or translated text. Nothing is cut with an ellipsis. [e2e]
6. Order: by name, case-insensitive, by character code. Archived students are not in the list. [unit]
7. Search box labelled "Search student or parent". Matches name or parent name (case-insensitive, any script, substring) or phone digits (typing `98860` finds `+91 98860 44321`). Whitespace only means no filter. A search with no match shows "No student matches “{text}”." and a "Clear search" button. [unit] [e2e]
8. Batch filter: "All {n}", then each batch with its count, then "No batch {n}" when some students have none. Up to 3 batches draw as tabs; more than 3 draw as one select field (criterion in decision 16). Search and batch filter combine. Choosing a filter does not reload data. [unit] [e2e]
9. A "Batches" link (at least 44px) goes to `batches/`. At the bottom, when archived students exist, a link "Archived students ({n})" shows or hides them below the list, each marked with the word "Archived". [e2e]
10. Empty (no students at all, nothing archived): the heading "No students yet.", one line, and a black "Add a student" button. Not shown when a search or filter merely finds nothing. [e2e]
11. Loading: until the first read comes back, grey blocks in the shape of rows and the words "Opening your book…" (no spinner alone). If cached, the list shows at once and refreshes quietly. [e2e]
12. Read failed: the error banner "Couldn't load your students" / "The network dropped. Nothing is lost." and a "Try again" button; the cached list, if any, stays visible under a quiet note. Never signs the tutor out. [e2e]

### Home (`home/`)

13. No students: the empty home as built in R1-1 (hello line, "Your book is empty.", body), with the dashed rows and the black "Add a student" button to `students/new/`. The line "Adding students arrives in the next update." is removed. [e2e]
14. One or more students: hello line, then one slip showing "{n} students" and "{amount} each month" (sum of all active students' fees, paise summed as integers, headline face), a black "See all students" link to `students/` and a black "Add a student" link, and the line "Who owes what appears here in a later update." No placeholder rows. [unit] [e2e]
15. Home reads the same roster (criterion 31) and has the same loading and error states as the list. [e2e]

### Add a student (`students/new/`)

16. Back link (44px, accessible name "Back to students") and title "Add a student". Fields in order, as the canvas: Student's name, Parent's name, Parent's WhatsApp number (with a fixed "+91"), "Send messages in" (four segments, English, Hindi, Kannada, Telugu), Batch (select; "No batch" first and default), "Fee due on" (select, 1st to 28th), "Monthly fee ₹", "Already owes ₹", the permission tick, and two buttons: black "Save student", outline "Save and add another". [e2e]
17. Defaults: parent language is the page's language; batch is "No batch" (or the batch in `?batch=<id>` when it is one of the tutor's; the batch screen links with it); due day 1st; fee and "Already owes" empty ("Already owes" placeholder 0). [e2e]
18. Student's name is required. Trimmed, runs of spaces collapsed, 1 to 80 characters counted as characters (not UTF-16 units), any script. Empty: tag "Missing", "Type the student's name." Too long: "Too long", "Use 80 characters or fewer." [unit]
19. Parent's name is optional, same cleaning, at most 80. [unit]
20. Phone is optional. Cleaned then normalised to `+91` and ten digits. Accepted inputs: `9886044321`, `98860 44321`, `098860 44321`, `+91 98860-44321`, `+919886044321`, `91 9886044321`, `(98860) 44321`, and the same with Devanagari, Kannada or Telugu digits. The field shows the typed text; on blur it shows the tidy form `98860 44321`. Stored value is `+919886044321`. [unit]
21. A phone that cannot be made into an Indian mobile number is refused: not 10 digits after cleaning ("Too short" or "Too long" and "An Indian mobile number has 10 digits. You typed {n}."), or it starts with 0 to 5 ("Check number", "Indian mobile numbers start with 6, 7, 8 or 9."), or it has letters ("Check number", "Use digits only."). The database only checks `+91` and 10 digits; the first-digit rule is the app's, because a landline cannot receive WhatsApp. [unit]
22. If the cleaned phone is already saved for another active or archived student, a non-blocking line under the field says "This number is already saved for {name}. Siblings can share a number." Saving is not blocked. Not shown when editing a student against their own number. [unit] [e2e]
23. Monthly fee is required: whole rupees from ₹1 to ₹10,00,000. "Already owes" is optional (empty means 0): whole rupees from 0 to ₹10,00,000. Typing accepts digits, commas, spaces, a leading ₹, a trailing ".00" or ".0", and non-Latin digits; on blur the value shows Indian grouping without the ₹ (`1,00,000`). Stored as integer paise: ₹1,200 is `120000`. Errors: empty fee "Missing", "Type the monthly fee in rupees."; `0` "Check amount", "The fee must be at least ₹1."; `12.50` "Whole rupees only", "Type whole rupees, like 1200."; over the limit "Too big", "The most is ₹10,00,000."; anything else "Check amount", "Use digits only." Amount fields use the Latin face. [unit]
24. The permission tick is required when a phone is typed ("Tick this to save the number." shown beside the tick when Save is tapped without it). With no phone it is not required. It is unticked each time the form opens. After "Save and add another" it resets. [unit] [e2e]
25. Save student: checks every field, shows all errors at once and focuses the first. When all are fine: busy button, one insert, then goes to `students/`. The new student is in the list. [e2e]
26. Save and add another: same insert, then the form clears except batch, due day, language and fee (a tutor adds a class in a run), the name field is focused, and a status line says "Saved {name}." (`role="status"`). [e2e]
27. One tap only: while an insert runs, both buttons are busy and a second tap does nothing; the id is made once per form fill, and if a retry hits "already exists" for that id the app reads the row and counts it as saved. [unit] [e2e]
28. The insert body holds only these keys: `id`, `batch_id`, `name`, `parent_name`, `parent_phone`, `parent_language`, `monthly_fee`, `opening_balance`, `due_day`, `active`. Not `tutor_id`, `pay_token`, `created_at`, `updated_at`. Empty parent name and phone are sent as null, not as empty strings (an empty phone would fail the database check). [unit] [e2e]
29. Save fails (network, server): the form keeps everything typed and a banner says "Couldn't save just now. Nothing was saved. Check your connection and tap Save again." Offline (`navigator.onLine` false): "You are offline. Connect to the internet to save." The tutor is not moved. [unit] [e2e]
30. A batch that was deleted in another tab or phone while this form was open: the insert fails on the batch key; the form says "That batch no longer exists. Pick another batch or No batch." and re-reads the batches. [unit]

### Roster and edit (`students/edit/?id=`)

31. The roster (all students including archived, and all batches) is read once per signed-in session by `RosterProvider` and shared by every screen. A write puts the row the database returned into the cache. Signing out clears it. [unit]
32. The edit screen reads `id` from the address. No `id`, or an id that is not a student of this tutor: a plain "We couldn't find this student." with a link back to the list. It does not loop. [e2e]
33. The edit screen is the add form with the saved values, titled with the student's name, and one black "Save changes" button. All validation, formats and the failure behaviour are those of criteria 18 to 30. Save goes back to `students/`. Nothing is sent if nothing changed ("Save changes" just goes back). [unit] [e2e]
34. The update sends only the granted, changed columns (`batch_id`, `name`, `parent_name`, `parent_phone`, `parent_language`, `monthly_fee`, `opening_balance`, `due_day`, `active`) and ends with `.select().single()`, so an update that changed 0 rows is an error "We couldn't find this student." not silence. [unit]
35. Changing the monthly fee or due day does not touch past or present dues (none exist yet). A line under the fee field says "A new fee applies from the next month." This line is shown on edit only. [e2e]
36. Archive: an outline "Archive student" button below the form, with the note "Hidden from your list and from reminders. Their history stays. You can restore them." One tap archives (no confirm: it is reversible), shows the screen as archived and goes back to the list. [e2e]
37. An archived student's edit screen shows the word "Archived" in a tag and "Restore student" (black) instead of Archive. Restore sets `active = true` and goes back to the list. Archived students can still be opened from the "Archived students" link, and edited. [e2e]
38. There is no way to delete a student in this slice. [e2e]

### Batches (`batches/`, `batches/edit/?id=`)

39. `batches/` lists every batch: name, timings (if any), "{n} students", monthly total of its active students as an amount. Whole row is a link to `batches/edit/?id=`. Back link to `students/`. No batches: "No batches yet." and a line "A batch is a class or group, like Class 10 Maths." [e2e]
40. Create: a field "Batch name" and a field "Timings (optional)" with a black "Add batch" button on the same screen. Name is trimmed, collapsed, 1 to 60 characters; timings at most 100, optional. Empty name: "Missing", "Type the batch name." Too long: "Too long", "Use 60 characters or fewer." The new batch appears in the list at once. [unit] [e2e]
41. A second batch with the same name (any letter case) is refused by the database. The screen says "Name taken", "You already have a batch called {name}. Pick another name." and keeps what was typed. The check is also made in the browser first, against the roster. [unit] [e2e]
42. The batch edit screen shows the name as the title, a "Rename" action that turns the name into an editable field with Save and Cancel, a Timings field (saved with a "Save timings" button or with the rename), and "{n} students" and "{amount} each month" for its active students. No "Pending", no "Take attendance": they arrive with R1-5 and R1-11. [e2e]
43. The batch's students are listed (name, fee, due day), each a link to its edit screen. None: "No students in this batch yet." A black "Add a student" link goes to `students/new/?batch=<id>`. [e2e]
44. "Move students": opens a sheet (the `Sheet` component) listing the tutor's active students who are not in this batch, each with a tick (at least 44px, `aria-pressed` or a checkbox), with the name of their current batch or "No batch". "Move {n} here" (black) moves them in one update. A student leaves a batch by being moved into another or by setting their batch to "No batch" in their form. Nothing is moved while none is ticked. [unit] [e2e]
45. Delete batch: a red text link (never a button) "Delete batch" with the line "Deleting keeps the students." It opens a confirm sheet: "Delete {name}? {n} students stay in your book with no batch." with a black "Delete batch" and an outline "Cancel". After deleting, goes to `batches/` and the students show "No batch". [e2e]
46. The batch write functions send only: `name`, `timings` (insert also `id`). `tutor_id` comes from the database default. Same failure, offline and double-tap behaviour as criteria 27 and 29. [unit] [e2e]
47. Archived students do not count in a batch's number or total. They stay in the batch (so Restore returns them to it). [unit]

### Data (nothing new)

48. No new migration. `pnpm check:db` is unchanged. The existing pgTAP files still pass. [db]
49. Staging check, by hand: RLS really keeps tutor B out of tutor A's students (already proved by `060_students.sql`); in this slice only confirm on staging that the app sees only the signed-in tutor's rows. [manual]

### Cross-cutting

50. All new words are in `messages/{en,hi,kn,te}.json` (namespaces `students`, `batches`, `nav`, and new keys in `home`, `appState`). `pnpm i18n:check` passes. The canvas words are filled in; the rest are `TODO-translate` in hi, kn, te. No English in JSX; no "FeeDost" outside `brand.ts`. [unit]
51. Every new screen works at 360px and at the system's large font size in all four languages: no sideways scroll, no clipped label, tap targets at least 44px, nothing below 14px, nothing cut with an ellipsis. A name in Hindi, Kannada or Telugu, and a 80-character name with no spaces, wrap inside the row and the field. [e2e]
52. Initial JS per new route at most 200 KB gzipped (`pnpm size`), target at most 170 KB. Routes are added to `APP_ROUTES` in `scripts/size.mjs` (all four languages). No new dependency. [e2e: `pnpm size`]
53. Money everywhere is integer paise in code and the request bodies, shown only through `formatRupees`; phone shown only through `formatPhone`. No float math on money. [unit]
54. Nothing is sent to analytics. No cookies. The only hosts the page talks to are its own and the Supabase host. The `students_added` event is R1-14. [e2e]
55. Every read and write is made with the signed-in session and names no `tutor_id`; another tutor's rows are kept out by row-level security, proved by `060_students.sql` and checked by hand (criterion 49). [db] [manual]

## 4. Edge cases

- **Very long name** (80 characters, no spaces): wraps (`wrap-anywhere`) in rows, in the field and on the edit title. 81 characters: refused with "Too long".
- **Emoji or combining marks** in a name: counted by characters (`[...text].length`), so a name the database accepts is never refused by the app, and the reverse.
- **Names in Hindi, Kannada, Telugu on an English page**: drawn in the page's face with the phone's own font filling in (the Anek faces are loaded only for their own page language). Names and phones carry `translate="no"`. The list row and title have a line-height that holds a vowel mark (existing `type-*` roles; the page's script rules apply, no per-name logic).
- **Same name twice** ("Ravi" and "Ravi"): allowed, no warning. Rows show the parent and the batch so they can be told apart.
- **Same phone twice:** allowed with a note (criterion 22).
- **No phone:** saved. Row shows no phone anywhere (the list never shows phones; only the edit form does).
- **Phone typed with a country code of another country** (`+44…`): refused as "Check number" (only `+91` is accepted in R1).
- **Fee of 0 or blank:** refused. **Opening balance blank:** 0.
- **Due day 29 to 31:** cannot be picked (select 1 to 28).
- **Two phones, one tutor:** the second phone's cache is stale until it reopens a screen; the quiet refresh on open fixes it. Last write wins (PRD).
- **A student's batch deleted elsewhere:** shows "No batch" after the next refresh; saving a form that still names it is criterion 30.
- **Tutor with 300 students:** one read, filtering is instant; the list is not virtualised (about 300 short rows).
- **`?id=` is not a UUID** or is another tutor's: "We couldn't find this student." (RLS returns nothing).
- **Reload on an edit address:** the gate runs, the roster reads, the screen finds the id. No state was in memory.
- **Double tap Save / Enter pressed twice:** one row (criterion 27).
- **Back after Save:** the browser goes to the previous screen; the list is fresh because the cache was updated.
- **Archived student's batch deleted:** the student has no batch; Restore returns them to "No batch".
- **What a parent sees:** nothing. There is no pay page yet (R1-9). `pay_token` is created by the database and is never read or sent by this slice.

## 5. Out of scope (do not add)

Contact Picker, paste a list, CSV/XLSX and column mapping (R1-4); setup step 3 chooser; sample data; dues, status tags, pending amounts, month switcher, Remind, Mark paid, receipts, history (R1-5 to R1-8); attendance (R1-11); share pay link and `pay_token` reads (R1-8, R1-9); offline outbox, service worker (R1-12); hard delete of a student; bulk archive; sort options; paging; a student photo; a "note" field; student email; a parent's second phone; a unique phone constraint; storing the permission tick; export (R1-13); analytics events (R1-14); any migration; any new dependency; any edit to `BottomNav` or other `ui/` components except what a new `ui/` piece needs (section 8.2); the More screen (another task owns it).

## 6. Copy

English below. Hindi, Kannada, Telugu: use canvas words where they appear, mark every other value `TODO-translate`. `{brand}` comes from `brand.ts`. Add to all four files together. Namespaces: `students`, `batches`, `nav`; new keys in `home` and `appState`. Words with arguments (`{n}`, `{name}`, `{amount}`, ordinals) go through `ClientMessages`; the layout's list of namespaces grows.

| Key | English |
|---|---|
| nav.label | Main |
| nav.home / students / attendance / more | Home / Students / Attendance / More |
| attendance.title / attendance.soon | Attendance / Attendance arrives in a later update. |
| students.title | Students |
| students.count | {n, plural, one {# student} other {# students}} |
| students.batchCount | {n, plural, =0 {No batches} one {# batch} other {# batches}} |
| students.add | Add |
| students.addFirst | Add a student |
| students.searchLabel / searchPlaceholder | Search student or parent / Search student or parent |
| students.noMatch | No student matches “{text}”. |
| students.clearSearch | Clear search |
| students.filterAll / filterNone / filterLabel | All {n} / No batch {n} / Show |
| students.meta | {amount} on the {day} |
| students.manageBatches | Batches |
| students.archivedLink / archivedTag | Archived students ({n}) / Archived |
| students.empty.title / body | No students yet. / Add your first student. It takes a minute. |
| students.loading | Opening your book… (appState.loading) |
| students.loadError.title / body / retry | Couldn't load your students / The network dropped. Nothing is lost. / Try again |
| students.stale | Showing what was saved on this phone. |
| students.form.addTitle / back | Add a student / Back to students |
| students.form.name / parentName / phone / language / batch / dueDay / fee / owes | Student's name / Parent's name / Parent's WhatsApp number / Send messages in / Batch / Fee due on / Monthly fee ₹ / Already owes ₹ |
| students.form.noBatch | No batch |
| students.form.permission | I have this parent's permission to save their number. |
| students.form.permissionNeeded | Tick this to save the number. |
| students.form.save / saveChanges / saveAnother | Save student / Save changes / Save and add another |
| students.form.saved | Saved {name}. |
| students.form.feeFromNextMonth | A new fee applies from the next month. |
| students.form.sameNumber | This number is already saved for {name}. Siblings can share a number. |
| students.form.saveFailed | Couldn't save just now. Nothing was saved. Check your connection and tap Save again. |
| students.form.offline | You are offline. Connect to the internet to save. |
| students.form.batchGone | That batch no longer exists. Pick another batch or No batch. |
| students.state.missing / missingBody | Missing / (per field below) |
| students.err.nameMissing / nameLong | Type the student's name. / Use 80 characters or fewer. |
| students.err.parentLong | Use 80 characters or fewer. |
| students.err.phoneShort / phoneLong | An Indian mobile number has 10 digits. You typed {n}. |
| students.err.phoneStart / phoneChars | Indian mobile numbers start with 6, 7, 8 or 9. / Use digits only. |
| students.err.feeMissing / feeZero / feeDecimal / feeBig / feeChars | Type the monthly fee in rupees. / The fee must be at least ₹1. / Type whole rupees, like 1200. / The most is ₹10,00,000. / Use digits only. |
| students.err.owesDecimal / owesBig / owesChars | as fee |
| students.tags | Missing, Too long, Too short, Check number, Check amount, Whole rupees only, Too big |
| students.edit.notFound / notFoundBody / backLink | Couldn't find this student / It may have been removed on another phone. / Back to students |
| students.edit.archive / archiveNote / restore | Archive student / Hidden from your list and from reminders. Their history stays. You can restore them. / Restore student |
| students.days.ordinal | {day, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} (English); the other three languages: `TODO-translate` with `{day}` kept |
| batches.title / empty.title / empty.body | Batches / No batches yet. / A batch is a class or group, like Class 10 Maths. |
| batches.studentsCount / monthly | {n, plural, one {# student} other {# students}} / {amount} each month |
| batches.name / timings / add | Batch name / Timings (optional) / Add batch |
| batches.err.nameMissing / nameLong / nameTaken | Type the batch name. / Use 60 characters or fewer. / You already have a batch called {name}. Pick another name. |
| batches.rename / save / cancel / saveTimings | Rename / Save / Cancel / Save timings |
| batches.noStudents / addStudent | No students in this batch yet. / Add a student |
| batches.move.open / title / count / none / noBatch | Move students / Move students to {name} / Move {n} here / Everyone is already in this batch. / No batch |
| batches.delete.link / note | Delete batch / Deleting keeps the students. |
| batches.delete.title / body / confirm / cancel | Delete {name}? / {n, plural, one {# student stays} other {# students stay}} in your book with no batch. / Delete batch / Cancel |
| batches.saveFailed | Couldn't save just now. Nothing was saved. Check your connection and tap Save again. |
| home.addStudent / seeAll / filled.total / filled.soon | Add a student / See all students / {amount} each month / Who owes what appears here in a later update. |
| home.empty.soon | (remove) |
| appState.errorStudentsTitle | (use students.loadError) |

## 7. Privacy

Only what the PRD allows is stored about a student: name, parent name, parent phone, batch, fee, due day, opening balance, language. The tutor confirms permission for a parent's number on the form (criterion 24); the tick is not stored. No analytics event carries a name or a phone. The list screen never prints a phone; the edit form does, to its own tutor. Nothing here is visible to a parent.

## 8. Technical plan

### 8.1 Approach

One roster context holds the tutor's students and batches, read once with two selects of explicit columns. Screens filter and total it in the browser with small pure functions. Writes go through two data modules (`students.ts`, `batches.ts`) that send only granted columns, end each call with `.select().single()` and return a typed result, as `tutor.ts` does. The add and edit screens are one form component with two modes. The edit screens are static shells that read an `id` from the address. No migration.

### 8.2 Routes

| Route | Signed out | Signed in |
|---|---|---|
| `students/` | sign-in | list (nav) |
| `students/new/` | sign-in | add form (no nav); reads optional `?batch=` |
| `students/edit/` | sign-in | edit form for `?id=` (no nav) |
| `batches/` | sign-in | list and create (nav) |
| `batches/edit/` | sign-in | batch screen for `?id=` (no nav) |
| `attendance/` | sign-in | placeholder (nav) |
| `home/` (change) | sign-in | empty or filled home (nav) |

`more/` gets the nav when the More task lands (see section 8.8).

### 8.3 Files

Create (each with its test next to it where it has logic):

| File | What goes in it |
|---|---|
| `src/lib/phone.ts` | Pure. `normalizePhone(text)` returns `{ ok: true, value: "+91…" \| null }` (empty is fine, value null) or `{ ok: false, error: "short" \| "long" \| "start" \| "chars", count }`. Maps Devanagari, Kannada and Telugu digits to 0 to 9, strips spaces, dashes, dots, brackets; drops a leading `+91`, `91` (when 12 digits) or `0` (when 11). `tidyPhone(value)` for the blur display. `digitsOf(text)` for search. |
| `src/lib/rupees.ts` | Pure. `parseRupees(text, { min, max })` returns `{ ok: true, paise }` or `{ ok: false, error: "missing" \| "zero" \| "decimal" \| "big" \| "chars" }`. Strips ₹, commas, spaces, a trailing `.00`/`.0`; maps non-Latin digits; integer math only. `groupRupees(paise)` returns `1,00,000` (reuse `formatRupees` and strip the `₹`; do not write a second grouper). |
| `src/lib/student-form.ts` | Pure. `checkStudent(draft, context)` validates the whole draft (criteria 18 to 24), returns either the clean row (`StudentInput`) or the list of field errors with their tag and message keys; `samePhone(roster, phone, exceptId)`; `changedColumns(old, new)` for the edit patch. Name counting uses `[...text].length`. |
| `src/lib/student-list.ts` | Pure. `sortStudents`, `searchStudents(list, text)`, `filterByBatch(list, filter)`, `batchCounts`, `monthlyTotal(list)` (integer sum of paise), `batchSummary`. No React. |
| `src/lib/students.ts` | `Student` type (`id, batchId, name, parentName, parentPhone, parentLanguage, monthlyFee, openingBalance, dueDay, active`), `listStudents()` (explicit column list, never `pay_token`, throws `RosterLoadError`), `createStudent(input)`, `updateStudent(id, patch)`, `setActive(id, active)`, `moveStudents(ids, batchId)`. Each write returns `{ ok: true, student } \| { ok: false, reason: "failed" \| "missing" \| "batch-gone" \| "offline" }`. Maps PostgREST codes: `PGRST116` missing, `23503` batch gone, `23505` on `id` means "already saved: re-read it". |
| `src/lib/batches.ts` | `Batch` type, `listBatches()`, `createBatch({id, name, timings})`, `updateBatch(id, {name, timings})`, `deleteBatch(id)`. A `23505` on `batches_tutor_id_lower_name_key` returns reason `"name-taken"`. Only `name`, `timings` (and `id` on insert) are sent. |
| `src/components/app/roster.tsx` | Client. `RosterProvider` and `useRoster()`: `{ status: "loading" \| "ready" \| "error", students, batches, reload(), put(student), putBatch(batch), removeBatch(id) }`. Reads both lists with `Promise.all` when first used and again quietly on each screen open; keeps the cached lists on a failed refresh. Clears when the signed-in user changes. |
| `src/components/app/app-nav.tsx` | Client. `AppNav({ current })` builds `BottomNav` with the four hrefs and icons. Move the four nav icons out of `src/app/dev/components/sample-icons.tsx` into `src/components/app/nav-icons.tsx` and import them from both places (do not import from `src/app/dev` in production code: it is outside production builds). |
| `src/components/students/student-list-screen.tsx` | The list screen: header, search, `BatchFilter`, rows, empty, loading, error, archived link. |
| `src/components/students/batch-filter.tsx` | Tabs up to 3 batches, `SelectField` above. Controlled; written once for R1-6 to reuse. |
| `src/components/students/student-form.tsx` | Add and edit form (`mode: "add" \| "edit"`), controlled fields, language `Segmented`, batch and due-day `SelectField`, amount and phone fields with blur tidy, permission tick, buttons, banners, the one-id-per-fill rule. |
| `src/components/students/student-edit-screen.tsx` | Reads `id`, finds the student in the roster, renders the form, Archive and Restore, the not-found state. |
| `src/components/students/archived-list.tsx` | The folded list of archived students. |
| `src/components/batches/batch-list-screen.tsx`, `batch-screen.tsx`, `batch-form.tsx`, `move-sheet.tsx`, `delete-sheet.tsx` | The batch list with create, the batch screen (rename, timings, totals, students), the move sheet, the delete confirm sheet. Use `Sheet`. |
| `src/components/attendance/attendance-placeholder.tsx` | Title and one line. |
| `src/components/home/filled-home.tsx` | The home with students; `EmptyHome` stays for none. A small `HomeScreen` chooses between them from the roster. |
| `src/components/app/read-id.ts` | `useQueryParam(name)`: reads `window.location.search` in an effect (null until read). One tiny hook shared by the three edit/new screens; no `useSearchParams`. |
| `src/app/[locale]/(app)/students/page.tsx`, `students/new/page.tsx`, `students/edit/page.tsx`, `batches/page.tsx`, `batches/edit/page.tsx`, `attendance/page.tsx` | Thin server pages, metadata `robots: { index: false }`, the island. |
| `e2e/roster-helpers.ts` | Registers routes for `GET/POST/PATCH/DELETE /rest/v1/students*` and `/rest/v1/batches*` on the fake host (a later `page.route` wins over `stubSupabase`'s, so `auth-helpers.ts` is not edited). In-memory tables; honours `id=eq.`, `in.(…)`, `order`, `Prefer: return=representation`, and answers a single object when `Accept` has `application/vnd.pgrst.object+json` (a 406 with `PGRST116` when there is no row); logs each body so a spec can assert granted columns only; switches: `networkDown`, `refuseWrites`, `listDelayMs`, `batchNameTaken`, `batchGone`. |
| `e2e/students.spec.ts`, `e2e/batches.spec.ts`, `e2e/students-layout.spec.ts` | Section 9. |

Change:

| File | Change |
|---|---|
| `src/config/routes.ts` | Add `studentsPath`, `studentNewPath`, `studentEditPath`, `batchesPath`, `batchEditPath`, `attendancePath`; add them to `placePath` with place names `students`, `student-new`, `student-edit`, `batches`, `batch-edit`, `attendance`. |
| `src/lib/profile.ts` | `appPlaces` gets the six new places. Extend the `nextRoute` unit table. (Trap: if a place is missing from `appPlaces`, a signed-out visitor stays on it.) |
| `src/components/app/app-gate.tsx` | `placeOf` already works from `placePath`. Nothing else, except wrap children in `RosterProvider` (inside the gate, so it only runs for a known tutor). |
| `src/app/[locale]/(app)/layout.tsx` | Add `students`, `batches`, `nav`, `attendance` to the namespaces. |
| `src/app/[locale]/(app)/home/page.tsx`, `src/components/home/empty-home.tsx` | Home chooses empty or filled; empty home loses the "soon" line and gets the button; nav added. Touch these only after the More task has merged or the lead says it is safe: both files are being changed there (Sign out moves out of the header). |
| `messages/{en,hi,kn,te}.json` | The keys in section 6, all four together. |
| `scripts/size.mjs` | Add `students`, `students/new`, `students/edit`, `batches`, `batches/edit`, `attendance` to `APP_ROUTES` (it already lists `home`; `more` joins with the More task). |

`/dev/components` gets a section only if a new `ui/` piece is added. Planned: none. If the amount-with-ticks "permission" checkbox or the batch tick list needs a reusable checkbox, check `Switch` first; if it cannot serve, add a `Check` to `src/components/ui/` with rest, pressed, focus, disabled states and a dev section, as F2 requires.

### 8.4 Which columns the client may write (from the R1-2 migration)

| Table | Insert | Update | Never sent |
|---|---|---|---|
| `students` | `id, batch_id, name, parent_name, parent_phone, parent_language, monthly_fee, opening_balance, due_day, active` (`tutor_id` defaults to `auth.uid()`; not sent) | `batch_id, name, parent_name, parent_phone, parent_language, monthly_fee, opening_balance, due_day, active` | `tutor_id`, `pay_token`, `created_at`, `updated_at` |
| `batches` | `id, name, timings` | `name, timings` | `tutor_id`, `created_at`, `updated_at` |

Reads name their columns (`id,batch_id,name,parent_name,parent_phone,parent_language,monthly_fee,opening_balance,due_day,active`; `id,name,timings`). Never `select=*`, so `pay_token` never reaches this app's memory in R1-3.

Constraints the app mirrors so the tutor gets words, not a database error: name 1 to 80; parent name at most 80; phone `^\+91[0-9]{10}$` or null; language in en, hi, kn, te; fee and opening balance 0 to 100000000 paise (the app also requires fee at least 100); due day 1 to 28; batch name 1 to 60 unique ignoring case; timings at most 100.

### 8.5 Data

No tables, columns, policies, functions or Edge Functions are added. No migration. `backend-dev` has no task. `supabase/` is not touched.

### 8.6 Loading, empty, error and retry

- One roster status for all screens: `loading` (first read, nothing cached), `ready`, `error` (first read failed, nothing cached). A failed quiet refresh leaves `ready` and the cached data, and shows the quiet note `students.stale` on the list.
- Each screen uses the same three states: grey row-shaped blocks plus "Opening your book…"; the error banner with "Try again" (calls `reload()`); the empty state.
- A write never shows success it does not have: the button is busy until the database answers; the cache is updated from the returned row only.
- Offline: before a write, `navigator.onLine === false` shows the offline banner and sends nothing. Reads that fail keep what is cached.

### 8.7 Work split and order

Each step ends with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`, `pnpm build` (with the CI fake address, as `e2e/auth-helpers.ts` says), `pnpm size` and `pnpm test:e2e` green. One commit per step. Every step is `frontend-dev`; none is `backend-dev` (no migration).

| # | Owner | Task | Done when |
|---|---|---|---|
| 1 | `frontend-dev` | Pure libraries and data modules, no screens: `phone.ts`, `rupees.ts`, `student-form.ts`, `student-list.ts`, `students.ts`, `batches.ts` with unit tests (fake client, as `tutor.test.ts`); new places in `routes.ts` and `profile.ts` with the extended `nextRoute` table; `e2e/roster-helpers.ts`; a test that no file under `src/components` calls `.from(`. | Criteria 1 (unit part), 6, 7, 18 to 21, 23, 27 (unit), 28, 34, 41 (unit), 53 pass as unit tests. |
| 2 | `frontend-dev` | `RosterProvider`, `AppNav` and nav icons, the `attendance/` placeholder, the Students list screen (search, `BatchFilter`, archived fold, empty, loading, error), the Home choice (empty and filled), messages for `nav`, `students` (list part), `attendance`, `home`; size list; e2e for criteria 2 to 15, 31. | Founder opens the list on staging; with no students sees the empty state. |
| 3 | `frontend-dev` | Batch screens: list and create, batch screen (rename, timings, totals, student list), delete with confirm sheet; messages `batches`; e2e for criteria 39 to 43, 45 to 47. | Batches can be made, renamed and deleted on staging. |
| 4 | `frontend-dev` | The student form: add (both buttons, `?batch=`), edit, Archive and Restore, not-found, duplicate-phone note, permission tick, failure and offline banners; messages `students.form`, `students.err`; e2e for criteria 16 to 30, 32 to 38. | **Cut line.** The founder can add students, see and search them, edit, archive and restore, and group them in batches, on staging. |
| 5 | `frontend-dev` | "Move students" sheet (criterion 44), `BatchFilter` select variant above 3 batches (criterion 8), the "batch deleted elsewhere" path (30), the nav on More once the More task has merged. | Criteria 8, 30, 44 and the nav on `more/`. |
| 6 | `frontend-dev`, then `test-engineer` | Hardening: four languages by 360px by large font loop over all new routes (criterion 51), long and Indian-script names, `pnpm size` report per route (criterion 52), `check:secrets`; `test-engineer` checks coverage against the criteria and fills gaps. | Criteria 50 to 55. |

If time is short, stop at step 4. Step 5's move-many is a convenience (a student can already be moved by editing them), and step 6 is polish that must still happen before the founder shows anyone.

### 8.8 Coordination with the More task

Another agent is building `more/` in this checkout now. R1-3 must not edit `more/` files, `src/lib/auth.ts`, `src/components/app/app-gate.tsx` beyond the roster wrapper, or `empty-home.tsx` until that work is merged. Steps 1 to 3 do not touch any of those. Step 4 and later wrap `AppGate` children and edit the home: do these after the More commit lands, and rebase first. `src/components/app/app-gate.tsx`'s `placeOf` and `nextRoute` need `more` to stay in `appPlaces`.

## 9. Tests required

| Criteria | Where |
|---|---|
| 1 | `profile.test.ts` (the `nextRoute` table: each new place signed out, loading, incomplete profile, complete); `e2e/students.spec.ts` (signed out on each new route goes to sign-in) |
| 2, 3 | `e2e/students.spec.ts` (nav present and current on five screens, absent on three); `attendance-placeholder.test.tsx` |
| 4 to 12 | `student-list.test.ts` (sort, search by name, parent, phone digits, Indian-script substring, filter, counts, combined); `student-list-screen.test.tsx` (states); `e2e/students.spec.ts` (list, search, tab filter, select filter at 4 batches, archived fold, empty, loading by `listDelayMs`, error and Try again by `networkDown`) |
| 13 to 15 | `filled-home.test.tsx` (sum of paise, plural); `e2e/students.spec.ts` (home empty, home filled, button targets) |
| 16, 17 | `e2e/students.spec.ts` (field order, defaults, `?batch=`) |
| 18 to 24 | `phone.test.ts` (the 8 accepted inputs of criterion 20 plus Hindi, Kannada, Telugu digits, and 12 refusals: short, long, `0123456789`, letters, `+44…`, `+91` alone, empty, 11 digits not starting with 0), `rupees.test.ts` (`1200`, `1,200`, `₹1,200`, `1,00,000`, `1200.00`, `1200.5`, `0`, `-5`, `10,00,001`, `abc`, Hindi digits, empty; checks `120000` paise), `student-form.test.ts` (each rule, 80 vs 81 characters by code points, same-phone note, permission rule) |
| 25 to 30 | `e2e/students.spec.ts` (full add; save and add another keeps batch, due day, language and fee; the POST body holds only the ten granted keys and paise integers; null for empty parent and phone; failure keeps typed values; offline banner; double tap sends one POST; `23505` on id counts as saved; batch gone); `students.test.ts` (result mapping) |
| 31 to 38 | `roster.test.tsx` (read once, refresh keeps cache on failure, clears on user change); `e2e/students.spec.ts` (edit; PATCH holds only changed granted columns; nothing sent when unchanged; not found; archive then restore; no delete control) |
| 39 to 47 | `batches.test.ts` (result mapping, name-taken code); `e2e/batches.spec.ts` (create, duplicate name any case, rename, timings, totals count active only, move sheet, delete confirm and students keep existing with no batch) |
| 48 | `pnpm check:db`; the `database` CI job (unchanged files) |
| 49, 55 | [manual] on staging (section 11); `060_students.sql` already proves RLS |
| 50 | `pnpm i18n:check`; the existing no-strings test |
| 51 | `e2e/students-layout.spec.ts`: loop over the six new routes by four languages at 360px and a large root font size, with a 80-character name and Hindi, Kannada and Telugu names in the data: no sideways scroll, nothing wider than its box, every link and button at least 44px |
| 52 | `pnpm size` with the six routes in `APP_ROUTES`; the numbers go in the pull request |
| 53 | `student-list.test.ts` (integer sums), the POST body assertion |
| 54 | e2e asserts no cookie and no request to any host except the page's own and the fake Supabase host |

Test method: as R1-1 section 9. A build made with the CI fake address; Playwright answers every request to `https://cicicicicicicicicici.supabase.co/**` (auth by `stubSupabase`, tables by `roster-helpers.ts`); a made-up session is seeded in localStorage. The real supabase-js code still runs, so request shape, headers and the single-object `Accept` are real. What this cannot prove: the real database's constraints, RLS, and speed from a phone in India. Those are the pgTAP files and the manual list.

## 10. What the founder must do

1. Answer open question 1 (sample data) with "defer" or "build".
2. Before step 2 is tried on his phone: staging already has the R1-2 migration, so nothing else. Sign in with Google on the staging build as before.

## 11. What to test by hand on a phone (staging, real database)

1. Open the app, signed in. Home with no students shows "Your book is empty." and a black "Add a student" button. Tap it.
2. Add "Ravi Kumar", parent "Suresh Kumar", phone `98450 12345`, language Kannada, no batch, due on the 5th, fee `1200`. Leave the tick off and tap Save: it asks for the tick. Tick it and save. You land on the list and Ravi is there: "₹1,200 on the 5th".
3. Add a second student with the same phone. The note about siblings shows; it still saves.
4. Add a student with no phone and no parent name. It saves.
5. Type `0` as the fee: it refuses with words. Type `1,00,000`: it shows grouped and is accepted. Type `12.5`: it refuses.
6. Type a name of 80 letters with no space, then a Hindi or Kannada name. Nothing is cut or runs off the screen. Turn the phone's font size to the largest and open the list and the form again.
7. Search by the first letters of a name, then by part of a phone number, then by a parent's name. Clear the search.
8. Go to Batches. Add "Class 10 Maths" with timings. Add "class 10 maths": it is refused with words. Add "Class 8 Science".
9. Open a student, set the batch to Class 10 Maths, save. The list now shows the batch tab with a count. Tap the tab; tap All. Add two more batches: the tabs turn into a select.
10. On the batch screen tap Move students: the button says "Move here" and is dimmed until you tick someone. Tick two students from other batches (each shows its present batch or "No batch"), tap "Move 2 students here". The sheet closes and the batch shows the new count and monthly total. Rename the batch. Check the totals.
11. Archive a student. They leave the list; "Archived students (1)" appears. Open them, Restore.
12. Delete a batch. The confirm sheet says its students stay. They show no batch afterwards.
13. Turn on airplane mode and try to save a student: the offline words show, nothing is lost. Turn it off and save again.
14. Sign in on a second phone or browser: the same students show.
15. Reload on a student's edit screen: it opens that student. Change the address to a made-up id: "Couldn't find this student."
16. Open More: the bottom nav shows with More marked; Home, Students and Attendance go to their screens.
17. With a batch open on a second phone, delete that batch there. On the first phone, try Save on a new student in that batch: it says the batch no longer exists, and the batch list refreshes.
18. Switch the app to Hindi, Kannada and Telugu: new screens show the canvas words or English placeholders (marked `TODO-translate`), and no layout breaks.

## 12. Risks and traps

| Risk | How the plan avoids it |
|---|---|
| A static export cannot prerender `/students/<id>/`. | Query-string shells (`edit/?id=`), read in an effect. No `generateStaticParams`, no `useSearchParams`. |
| A new app place is missing from `appPlaces`, so a signed-out visitor stays on it. | Criterion 1 and a unit table row per place. |
| PostgREST returns an array for a single-row PATCH unless asked for one object. | `.select().single()`; the fake host answers an object when `Accept` says so. |
| Empty strings fail the phone check (`''` is not null). | Empty parent name and phone are sent as null (criterion 28). |
| Counting characters differently from the database (UTF-16 vs code points). | `[...text].length` in `student-form.ts`, tested at 80 and 81 with emoji and combining marks. |
| Money done in floats. | `parseRupees` is integer math on digit strings; sums are integer paise; test `1200.5` and large sums. |
| Double tap on Save makes two students. | One id per form fill; busy buttons; `23505` on id means saved (criterion 27). |
| The list rows are cut with an ellipsis as in the canvas. | Rows grow; `wrap-anywhere`; the layout e2e uses an 80-character no-space name. |
| `select=*` leaks `pay_token` into the app. | Explicit column lists (section 8.4). |
| A student's batch deleted elsewhere makes inserts fail on the composite key (`23503`). | Mapped to words; the batch list is re-read (criterion 30). |
| Two screens each read the roster again and flicker. | One cached `RosterProvider`; a quiet refresh keeps what is shown. |
| The tutor's `tutor_id` is sent from the client. | Never sent; the database default fills it; a test checks the body. |
| Initial JS grows past budget. | No new dependency; all new code is small and in route chunks; `ClientMessages` namespaces grow (words travel in the page, not in JS); report each route's size per step and stop at 170 KB. |
| The More task edits `app-gate.tsx`, `empty-home.tsx` and `routes.ts` at the same time. | Section 8.8: steps 1 to 3 avoid contested files except `routes.ts` and `profile.ts` (additive); rebase before step 4. |
| Whole-row link plus a nested control (the canvas puts a status tag inside the link). | No nested interactive element in a row. |
| Same-phone detection treats an unsaved edit of the student's own number as a duplicate. | `samePhone` takes the student's id to ignore. |
| Offline looks like a save failure and loses typed data. | Typed values are kept on every failure; the offline check runs before the call. |
| The dev-only sample icons are imported by production code. | Icons move to `src/components/app/nav-icons.tsx` (section 8.3). |
| Archived students are counted in dues or reminders later. | Recorded here for R1-5 and R1-8: they must read `active = true` only. |

## 13. Gaps and conflicts found in the source documents

- PRD section 6 lists "Batch detail" as screen 8 with "move students"; the canvas Batch screen backs out to More, and shows Pending and Take attendance, which need R1-5 and R1-11. Built without those two.
- The canvas Students and Batch rows carry a status tag (Paid/Due/Overdue). Dues do not exist until R1-5, so the tag is left out here and added in R1-6.
- The canvas truncates names with an ellipsis; `src/CLAUDE.md` forbids it. The rule wins.
- The canvas Student screen (detail) is almost all later slices; R1-3 builds the edit part only. `docs/BUILD_PLAN.md` has no slice that builds the rest of that screen explicitly: R1-6 (strip), R1-7 (Mark paid), R1-8 (Remind) and R1-11 (attendance) each add a part. The lead should note that someone owns "assemble the Student detail screen".
- "Try with sample data" appears in PRD section 5 and two canvases and has no slice (question 1).
- The canvas Add-student has Save student and Save and add another; the Setup-add canvas puts the permission tick on the chooser (step 3). Here the tick is on the form because there is no chooser yet.
- The PRD says "tutor confirms they have parents' permission" and gives no column; it is not stored (decision 17). If DPDP advice later says to keep a record, it is a new column and a new migration.
- BUILD_PLAN R1-4 includes Contact Picker; the PRD Add students row lists four ways. Consistent: one-by-one is R1-3, the other three R1-4.
- PRD section 6 nav lists Attendance; R1-11 builds it. The placeholder bridges the gap (decision 12).

## 14. Start

`frontend-dev` starts step 1 (the pure libraries, data modules, the new places and `e2e/roster-helpers.ts`). `backend-dev` has nothing to do in this slice.
