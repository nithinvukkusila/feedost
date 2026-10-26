# UX-review-fixes-2: fixes and polish from the founder's review of 25 Oct 2026

Requested by the founder on 2026-10-25 (a 26-item UX/UI list plus accessibility notes), with binding decisions given the same day. This slice is the **fixes and polish** part only. The new features on the list become their own slices (section 5). Like round 1 (`UX-review-fixes.md`), it changes words, layout, one pure status helper and one read; it needs **no migration, no new table, no new Edge Function and no new dependency**.

Tags: [unit] Vitest, [e2e] Playwright at the phone viewport unless a width is named, [manual] by hand on a phone. "Four languages" means the key exists in `messages/{en,hi,kn,te}.json` (non-English `TODO-translate` where unsure) and `pnpm i18n:check` passes.

Rules every criterion below inherits, and which no item may weaken (PRD section 9, CLAUDE.md, docs/DESIGN.md): status is a word plus a mark, never colour alone; no text under 14px; every control at least 44 by 44px; tokens only, no hex or arbitrary text sizes; money is integer paise, shown with `formatRupees()`; dates with `formatDate()` (DD MMM YYYY); every new string in all four files; works at 360px and with the largest system font; blue sends and pays, black records, red is never a button.

## 1. Goal

The tutor can trust what Home says about who owes what (no false "Overdue", part payments counted, a summary that reads correctly), and the screens she uses every day (add/edit student, Students, Batches, More, Language) behave predictably: buttons do not jump, disabled things look disabled, errors stay visible, and the look is one consistent system.

## 2. Users and moment

The tutor, on a low-end Android at 360 to 412px, between classes: opening Home to see who to chase, recording a part payment a parent handed over, adding a batch of students one after another, or fixing a parent's number. Every item here came from the founder using the live app as that tutor. The parent's pages (`/p/`, `/r/`) are not changed in PR1 to PR3 apart from one shared constant (item 1), which has no visible effect. PR4's global tokens do reach them visually: the label size and colour (22.1, 22.2), the error banner's shadow colour (21.1) and the 60% sheet backdrop from 768px on the claim sheet (25.1). No parent-facing wording changes in any PR, so the signed language review records stay valid (question 10).

## 3. What I found before writing (code and specs read on `main` at `fdeb962`)

Several items are already true, or rest on a reading that the code explains. The criteria in section 4 are written against what is actually there.

| Item | Finding | Consequence |
| --- | --- | --- |
| 1 Overdue on a fee due today | "Due today" **already exists** (`dueState()` in `src/lib/dues-board.ts`; R1-6 decision 2: overdue starts the day after, tag "Due today"). A monthly fee due today is in the Due tab with "Due today". The only path that shows a plain "OVERDUE" (no day count) next to "Due 25 Oct 2026" on 25 Oct is an **earlier balance** ("Already owes"): the trigger `sync_opening_due` dates it the day it is entered, and R1-6 decision 6 makes it overdue at once. The row then prints "Earlier balance · Due 25 Oct 2026", which reads as a contradiction. Not a date bug. | Fix the row's words for an earlier balance, add the grace constant, keep the rule (criteria 1.1 to 1.6). Founder to confirm the row said "Earlier balance" (question 1). |
| 1 Grace days | R1-6 lists grace days as "not in the PRD". A constant set to 0 changes no behaviour and adds nothing a tutor sees. | Add it, default 0, used by the board and the pay page from one place. No setting screen. |
| 2 Hero subtitle | "from {n} of {m} students": `m` is students with any fee row this month, not the students in the filter. The batch select beside it says "All 25" (roster count). Two different denominators on one screen. | Change `m` to active students in the filter. |
| 3 Part paid | The "Part paid" tag exists (DESIGN.md StatusTag, blue dashed outline) but is used only on a part-paid fee that is **not late**. A late part-paid fee shows "Overdue N days" and the paid amount only as a blue caption line. "Collected" counts only payments on **this month's own monthly fees**, so ₹250 paid on an earlier balance or last month's fee is never counted. The Paid tab already means fully paid. | Two tags on a part-paid row; Collected becomes money received in the month (criteria 3.x). |
| 4 Legend | The "0 due, hollow · 2 overdue, tall" legend and the square strip are the canvas (`Home.dc.html`) and R1-6 criterion 14. The founder's item overrides the canvas. | Replace with the labelled bar. |
| 5 Month arrows | Disabled arrows already have `disabled`, a dashed outline and `cursor-not-allowed`, but the icon is `ink-label`, close to the enabled `ink`. They are drawn even when there is no other month. | Hide when no other month; mute the icon. |
| 6 "Saved X." | It sits in a `role="status"` paragraph between the form and the buttons with `empty:hidden`, so its appearance pushes both buttons down by a line. Confirmed. | Move it. |
| 7 Consent unticked on edit | **Misreading of storage, real UX problem.** The tick is **not stored anywhere** (R1-3 decision 17: no column, the PRD data model has none) and R1-3 criterion 24 says it "is unticked each time the form opens". A saved number can only have been saved with the tick (the form refuses otherwise). | Show it ticked when a number is saved; unticking removes the number. No migration (criteria 7.x). |
| 12 "Save and add another" | It **already keeps** batch, fee day, fee **and** the message language; it resets name, parent, phone, opening balance and the tick. The founder's item allows either reset or "show it carried over". | Keep carrying it and say so. |
| 17 Move students | The count is **already** on the confirm button ("Move {n} here"). There are two Cancels (the sheet's own close at the top and an outline button at the foot). No search, no select-all. | Remove the foot Cancel; add search and select-all. |
| 18 Attendance | Round 1 item 4 **already** built the coming-soon screen. It has a "Back to Home" button. | Add "Soon" on the nav item; remove the back button (founder: no "Back to home" on top-level tabs). |
| 18 Subjects show "All" | No code produces "All": the seven presets are Maths, Science, English, Hindi, Physics, Chemistry, Accounts. "All" appears only if the tutor typed it as her own subject. The "All 25" the founder saw is the batch filter. | No change; question 6. |
| 22 Labels "11 to 12px" | **Computed size is 14px** (`type-label`, `--label-size: 0.875rem`; 15px in Hindi, Kannada, Telugu). DM Mono capitals have a cap height of about 0.7em, so 14px capitals look like about 10px letters; that is the founder's impression, not a rule breach. `ink-label` `#6B5B2A` on `page` `#FAF3D3` is 5.96:1 (computed with the WCAG formula), so it already passes AA 4.5:1; it fails only on `tab-idle`, where the tabs already use `ink-soft`. | Raise Latin labels to 15px and darken them anyway, as asked; record the measurement in a test (criteria 22.x). |
| Accessibility: phone field "labelled only by placeholder" | On the add/edit form the phone field **has** a real `<label>` ("Parent's WhatsApp number"); the placeholder is an example. The search box on Students has an `sr-only` label. | Keep; add an e2e check over every input on the listed screens so this cannot regress, and fix any it finds. |
| Accessibility: language radios read "en/hi/kn/te" | The "Send messages in" radios are labelled with each language's own name (English, हिन्दी, ಕನ್ನಡ, తెలుగు). A screen reader set to English may skip or spell out the Indic script, which can sound like codes. | Add the language's name in the page's language as screen-reader text. |
| 21 Colour roles | Founder decided: keep DESIGN.md colour rules. | Not changed. |

## 4. Acceptance criteria, by pull request

Four pull requests, each releasable alone, in this order. PR1 must merge first (PR3's student-list chip and PR4's hero spacing build on it).

### PR1: status and money correctness (items 1, 2, 3, 4, 10)

**Item 1. Due today, overdue, grace.**

1.1 [unit] A monthly fee not fully paid is "Due" when its due date is after today, "Due today" (Due tab) when it is today, and "Overdue N days" (Overdue tab) only from the day after the due date. Table tests for yesterday, today, tomorrow, 31 Oct to 1 Nov, 28 Feb to 1 Mar in a leap and a non-leap year (extends the existing R1-6 criterion 2 tests).
1.2 [unit] A single constant `GRACE_DAYS`, default `0`, lives in one module that both `src/lib/dues-board.ts` and `src/lib/pay-page-view.ts` import. A fee is overdue when days late is greater than `GRACE_DAYS`. A test proves that with grace 2 (passed as an argument, the constant unchanged) a fee 2 days late is still Due and 3 days late is "Overdue 3 days". With the constant at 0 every existing board, reminder and pay-page test passes unchanged.
1.3 [unit] Grace does not apply to an earlier balance: it stays Overdue from the day it is entered, with no day count (R1-6 decision 6 unchanged; question 1).
1.4 [e2e] An earlier-balance row no longer says "Due {date}". It says "Earlier balance · Added {date}" (date through `formatDate`), with the Overdue tag. A monthly row keeps "Due {date}".
1.5 [e2e] With the clock fixed to 25 Oct 2026 India time, a student with due day 25 shows "Due today" in the Due tab, and the next morning "Overdue 1 day" (R1-6 criterion 29 still passes).
1.6 [unit] The bulk "Remind all overdue" list and the pay page's "Overdue / Due today" words follow the same rule (they read the same constant).

**Item 2. Hero subtitle.**

2.1 [unit] `boardView` returns `studentsInFilter`: active students whose current batch matches the filter (All, No batch, one batch), whether or not they have a fee this month.
2.2 [e2e] The line under the amount reads "{n} of {m} students still owe", where `n` is students with something unpaid in view and `m` is `studentsInFilter`. With 25 active students and 2 owing under "All 25": "2 of 25 students still owe". Changing the Show filter to a batch of 6 with 1 owing: "1 of 6 students still owe". Plural forms correct in all four languages (`hero.owe` replaces `hero.from`; the old key is removed from all four files once unused).

**Item 3. Part payments.** (Founder decision: a part-paid student stays in Due or Overdue; received money counts as collected; Paid means fully paid.)

3.1 [unit] A part-paid fee stays in the Due tab (not late) or the Overdue tab (late). The Paid tab holds only fully paid fees (already true; pinned by a test).
3.2 [e2e] A part-paid row shows two tags side by side, each a word plus its mark: the lateness tag ("Overdue 3 days" red solid outline, "Due today" / "Due" highlight fill) and "Part paid ₹250" (blue dashed outline, the amount in DM Mono with 0 to 9 digits). The blue caption line "Part paid ₹250" is removed. The amount on the right is what is still owed. Tags wrap onto two lines at large text and never cut.
3.3 [unit] "Collected" for a month is the sum of payments, not voided, whose paid-on date is in that month (India day), for students in the filter (archived students included, through their current batch). It counts part payments and payments on earlier balances and earlier months' fees. Integer paise; a voided payment is never counted.
3.4 [e2e] Record ₹250 of a ₹500 earlier balance today: the row stays in Overdue with "Part paid ₹250" and ₹250 owed; Collected rises by ₹250; the Paid tab count does not change. Record the other ₹250: the row moves out (an earlier balance leaves the board when paid), Collected is now ₹500, and it does not drop.
3.5 [e2e] Undo a payment within 24 hours: Collected falls by that amount and the row returns to its earlier state.
3.6 [unit] The "All paid" state shows the same Collected figure as 3.3.

**Item 4. Home summary bar.** (Replaces the strip and its legend, R1-6 criterion 14, and the canvas legend.)

4.1 [e2e] The student strip and the "paid / due, hollow / overdue, tall" legend are gone from Home. Their message keys are removed from all four files once unused; `StudentStrip` stays in `ui/` only if something else uses it, otherwise it and its dev section are removed.
4.2 [e2e] Under the hero, one horizontal bar for the selected month and filter with three segments, Collected, Due, Overdue, in that order, widths proportional to their paise. Beneath it, three visible labels, each a word, an amount and the same mark as its segment: "Collected ₹X", "Due ₹Y", "Overdue ₹Z". Due is what is still owed on fees in the Due tab; Overdue on fees in the Overdue tab; Collected as 3.3.
4.3 [unit] The marks follow DESIGN.md roles: Collected `stamp` solid fill, Due `highlight` fill, Overdue `cloth` with a pattern or edge that differs from the others by shape, not only colour. A non-zero segment is at least 4px wide. A zero segment is not drawn but its label still shows "₹0".
4.4 [e2e] The bar itself is hidden from screen readers; the three labels are the text equivalent, read in order. Labels wrap at 360px and largest font in all four languages; amounts never use Anek.
4.5 [e2e] The bar follows the Show filter and the month switcher. Nothing is drawn when the month has no rows (the existing empty states stand).

**Item 10. Status chip on Students rows.** (Does not need the profile page: it reuses the board's cached dues.)

10.1 [unit] One pure function gives one chip per active student from the current month's view (own fees plus unpaid earlier ones), in this order of precedence: "Overdue ₹X" (sum still owed on overdue fees, part-paid ones included) → "Due today" → "Part paid ₹X" (paid so far on a not-late part-paid fee) → "Due {date}" (the soonest open fee) → "Paid" (this month's fee fully paid and nothing open).
10.2 [e2e] A student with no open fee and no fee yet this month shows no status tag, only the caption "Next fee {date}" (from the existing `nextDueDate`). A status tag is never shown for a fee that does not exist yet. An archived student shows no chip.
10.3 [e2e] Each chip is a `StatusTag` (word plus mark). The Students screen reads the dues through the board's existing store and cache (no new endpoint); until they arrive the rows show without chips and nothing jumps more than the chip's own line; if the read fails, rows show without chips and the existing stale note covers it.
10.4 [e2e] `pnpm size` for the Students route stays at or under 200 KB gzipped.

### PR2: forms and controls (items 5, 6, 7, 12, 17, 24, accessibility)

**Item 5. Disabled controls and month arrows.**

5.1 [e2e] When there is no other month to go to (no monthly fee before this month), the month switcher shows the month label with no arrow buttons.
5.2 [e2e] When only one direction can move, the other arrow is still 44px, has `disabled`, `cursor-not-allowed`, no shadow, a dashed outline (dashed is the disabled mark, item 21), and its icon in a muted token (`rule`). The enabled arrow is `ink`. Inactive controls are exempt from WCAG 1.4.11, but the disabled state is never shown by colour alone (the dashed outline carries it).
5.3 [unit] Every disabled `Button` variant: no shadow, dashed outline, no fill, does not move when pressed, `cursor-not-allowed`, and its text in the existing `ink-label` token (today `ink-soft`; no new token is added). Pinned by the existing button tests, extended to the text colour. The difference from 5.2 is deliberate: a disabled Button keeps readable `ink-label` text because its label is a word the tutor must still read, while a disabled month arrow is an icon only, so it uses the fainter `rule`.

**Item 6. Buttons do not move after "Save and add another".**

6.1 [e2e] After "Save and add another", the "Saved {name}." message (12.3 wording) appears as a toast pinned at the foot of the screen through `AppScreen above`, the same place and pattern as the Undo banner; it is not in the form's flow. Focus moves to the student's name field. The two buttons stay exactly where they were: their bounding boxes in page coordinates before and after the save differ by 0px, checked at 360px with the default font and again at the largest system font with an 80-character name with no spaces.
6.2 [e2e] The toast is `role="status"`, is announced once, and goes when the next save starts, after 10 seconds (the Undo banner's `BANNER_MS`), or when the tutor leaves the screen. Its appearing and going never move anything on the page.
6.4 [e2e] While the toast shows, the page keeps room at its foot equal to the toast's height, so "Save student" and "Save and add another" can always be scrolled fully into view above it and are never covered. At 360px and largest font in Hindi the toast's text wraps, is never cut, and stays inside the screen.
6.3 [e2e] Double-tapping "Save and add another" quickly creates one student and does not trigger "Save student" (the existing one-id-per-fill rule holds).

**Item 7. Permission tick on edit.** (R1-3 criterion 24 is amended for edit; decision 17, "not stored", stands.)

7.1 [e2e] Editing a student who has a saved number: the tick starts **ticked**. Editing a student with no number: it starts unticked and is not required unless a number is typed.
7.2 [e2e] Changing the saved number to a different one unticks the tick and requires it again before Save (the existing rule for a new or changed number). If the field is then changed back so it again normalizes to the saved number, and the tick was taken off only by this rule (the tutor did not untick it by hand), the tick turns back on: no 7.3 warning, and Save changes nothing. After a hand untick it stays off and 7.3 applies.
7.3 [e2e] Unticking while the saved number is unchanged shows, under the tick: "Without the parent's OK the number can't be kept. Saving will remove it, and you won't be able to send reminders to this parent until you add it again." Save then saves the student with **no parent number** (the same update as clearing the field). Re-ticking before Save removes the warning and keeps the number.
7.4 [unit] No migration and no new column. The stored number is either kept (tick on) or set to empty (tick off); nothing else in the database changes. The parent's own pay-page consent (`consents` table) is untouched.
7.5 [e2e] After the number is removed, the board row offers "Add number" instead of Remind (existing R1-8 behaviour).

**Item 12. Add student form.**

12.1 [e2e] The phone field shows "+91" as a fixed prefix inside the field's line, before the typed digits, in DM Mono with 0 to 9 digits; it is not part of the value and cannot be deleted. The prefix is announced with the field (part of its accessible description). This needs a `prefix` option on `ui/Field` with its states on `/dev/components` (src/CLAUDE.md rule).
12.2 [unit] While typing, ten digits are shown as "98765 43210" (a space after the fifth). Pasting "+91 98765-43210", "098765 43210" or Hindi, Kannada or Telugu digits ends as "98765 43210". The caret stays after the last typed digit. The saved value is still E.164 `+919876543210`.
12.3 [e2e] After "Save and add another", batch, fee day, fee and message language are kept, and the "Saved {name}." toast (6.1) says so: "Saved {name}. Batch, fee, due day and language kept for the next one." (founder's "or shows it carried over").
12.4 [e2e] The three section headings (Who, Fee, Opening balance) are visibly stronger than field labels (headline face, at least 20px, ink) with 32px space above each (except the first). They remain `<legend>`s of their fieldsets.
12.5 [e2e] A select (Batch, Fee due on) shows the 3px blue focus ring (offset 4px) around its line when focused by keyboard, in addition to the blue line, and keeps its chevron so it never looks exactly like a text field.

**Item 17. Move students sheet.**

17.1 [e2e] One Cancel only: the sheet's own close control at the top. The outline Cancel at the foot is removed.
17.2 [e2e] A search field (real label, `sr-only` allowed) filters the list by name as the tutor types, using the same matching as the Students search. With no match it says so and offers "Clear search".
17.3 [e2e] A "Select all shown ({n})" tick at the top selects or clears every student currently shown by the search. Its state is a word plus the tick ("Selected" / "Not selected"), as `ui/Check`.
17.4 [e2e] The confirm button keeps the count ("Move {n} here"), counts only students still shown or still ticked from before the search, and stays disabled at 0.

**Item 24. Error and focus.**

24.1 [e2e] A field in the error state that gets focus keeps its red line (3px, or 4px while focused) and red label with the state words; it never turns blue. Applies to `Field`, `SelectField` and the Students search box.
24.2 [unit] No blue focus line or label is drawn above red error text in any form (Field states test).

**Accessibility (throughout PR2's screens and PR3's).**

A.1 [e2e] On Home, Students, Add/Edit student, Batches, Batch, Move students, Mark paid, Receipt, More and Language, every `input`, `select` and `textarea` has an accessible name from a `<label>` or `aria-labelledby`, never from its placeholder alone (asserted with Playwright's accessible-name query).
A.2 [e2e] The "Send messages in" radios are announced with the language's own name and its name in the page's language (for example "ಕನ್ನಡ, Kannada"); the extra name is screen-reader text only.
A.3 [e2e] Every toast or short notice (Saved, Undo banner, write notices) is `role="status"` (or the equivalent `aria-live="polite"` on a container that is always present).
A.4 [e2e] Every control on those screens is at least 44 by 44px and shows a visible focus ring by keyboard.

### PR3: lists, navigation and loading (items 8-undo, 11, 13, 16, 18, 19, 20)

**Item 8 (fix part only). Receipt screen Undo.**

8.1 [e2e] "Undo this payment" is no longer inside the receipt card. It sits below the card as a secondary control (outline, compact, or an underlined text button at least 44px), with the same confirm step ("Undo this payment?" Yes / Keep) and the same 24-hour rule. The dashed rule inside the card that framed it is removed.

**Item 11. Students list cleanup.**

11.1 [e2e] Rows have no "01, 02…" numbers.
11.2 [e2e] While searching, the batch tab counts show the number of matches in each tab, and a `role="status"` line says "{n} results" (plural forms in four languages). Clearing the search restores the counts.
11.3 [e2e] When a specific batch tab is selected, rows do not repeat the batch name. Under All and No batch they still show it.
11.4 [e2e] "Batches" is an outline button in the header next to "+ Add" (both 44px or more; they wrap under the title at 360px and large text). The "Manage batches" button at the foot is removed.

**Item 13 (fix part only). Home rows.** (Moving Receipt to the profile goes with the profile slice.)

13.1 [e2e] Every Home row has one layout: status tags, name, caption, amount owed on the right; actions on one line below or beside: "Mark paid" (black, the main action) last; "Remind" as the round blue icon button (`RoundButton`, 48px, accessible name "Remind {name}'s parent"); "Receipt" as a quiet text link when something is paid. "Add number" and "Add UPI ID" keep their words.
13.2 [e2e] At 360px and largest font, actions wrap below the text, never cut, never overlap.

**Item 16. Batches page.**

16.1 [e2e] The list of batches comes first. A "+ New batch" button (black, records) in the header reveals the create form under the header with focus in the name field; Cancel hides it again. With no batches, the form is shown open with the empty-state line.
16.2 [e2e] Saving a new batch closes the form and the batch appears in the list.

**Item 18. Navigation and More.** (Founder decision: keep Attendance, labelled "Soon".)

18.1 [e2e] The Attendance nav item (bottom bar and side navigation) shows its label and a "Soon" word under or beside it; its accessible name is "Attendance, coming soon". It still opens the coming-soon screen. The nav still has four items in PRD order.
18.2 [e2e] Top-level screens (Home, Students, Attendance, More) have no "Back to home" link or button. The Attendance screen keeps its title and sentence only (round 1 item 4's back button is removed).
18.3 [e2e] More has a plain header like Students: a small label line and the headline "More", on the page ground, inside the content column. No cloth block and no dashed stitch. The profile slip sits below it on the page.
18.4 [e2e] From More, "Language" opens a simple list of the four languages (own name plus the name in the page's language, the current one marked with a word and a tick). Tapping a language applies it at once: it saves the choice, updates the tutor's saved language, and returns to More in that language, with no "Continue" and no trip through sign-in. The first-run picker before sign-in is unchanged.

**Item 19. One rule for sub-pages.**

19.1 [e2e] Rule: the four top-level screens show the bottom bar on phones and tablets. Every other signed-in screen (Add student, Edit student, Batches, Batch, Receipt, Remind, Claims) shows a back link and no bottom bar below 1024px, and from 1024px every signed-in screen shows the side navigation with its section marked current (Students for student and batch screens, Home for Receipt, Remind and Claims).
19.2 [e2e] The navigation e2e covers each listed screen at 390px and 1440px.

**Item 20. Loading without the flash.**

20.1 [e2e] On a direct load, each screen's loading state is a skeleton in that screen's shape: Home (board), Students and Batches (list), Add/Edit student and Batch (form), More and Attendance (plain). No spinner.
20.2 [e2e] "Opening your book…" is `role="status"` screen-reader text, not shown on screen. If loading passes 5 seconds, the words appear visibly under the skeleton (slow 4G; question 4).
20.3 [manual] On a throttled load the skeleton and the arrived page line up: the header and first rows do not jump by more than one row height.

### PR4: visual tokens (items 21, 22, 23, 25, 26b)

**Item 21. Tokens.** (Founder decision: one shadow colour, dashed only for disabled or placeholder, an 8-point spacing scale. Colour roles unchanged. Offsets stay as DESIGN.md: 5px buttons, 6px slips, 3px round.)

21.1 [unit] Every shadow token on paper uses `ink`. `--shadow-record` (today `ink-label`) and `--shadow-banner-error` (today `cloth`) become `ink`. The on-cloth ground rule (`cloth-deep` shadow) stays, because it is the same rule for a different ground. DESIGN.md "Shape and depth" is updated in the same PR.
21.2 [unit] Dashed borders and outlines appear only on disabled controls and placeholders (empty slots, loading blocks), with two recorded exceptions by default (question 3): the "Part paid" status mark (it is a status mark; taking the dash away would leave it differing from Overdue by colour only) and the cloth stitch on the landing page and the 1024px book ground. A unit test scans `src/components` for `dashed` and fails on anything outside that list.
21.3 [unit] Spacing on the screens this slice touches (Home, Students, Add/Edit student, Batches, Batch, Move students, Receipt, More, Language, Attendance) uses only 0, 4, 8, 16, 24, 32, 40 and 56px (`*-0, 1, 2, 4, 6, 8, 10, 14`). Exceptions: the 6px room kept for a 5 or 6px shadow (`pr-1.5 pb-1.5`), and component internals in `ui/` whose sizes DESIGN.md fixes. A unit test lists the files and fails on other spacing classes.

**Item 22. Typography.**

22.1 [unit] Latin `type-label` is 15px (`--label-size: 0.9375rem`), weight 500, uppercase, 0.04em; Hindi, Kannada and Telugu stay 15px weight 600. DESIGN.md "Type" is updated.
22.2 [unit] Label text uses `ink-soft` on `page`, `slip` and `page-ruled`. A contrast unit test computes every label colour on every ground it is used on and requires at least 4.5:1 (extends `src/styles/contrast.test.ts`; records today's `ink-label` on `page` at 5.96:1).
22.3 [e2e] Computed `font-size` of every label, status tag and caption on the listed screens is at least 14px (asserted with `getComputedStyle`, not by reading classes).
22.4 [e2e] Home hero: 8px between the "Still to come in" label and the amount, 8px between amount and subtitle, 24px to the Show filter, 16px to the summary bar, and 40px below the summary bar before the tabs.

**Item 23. Tabs.**

23.1 [e2e] Inactive folder tabs are lighter: `page-ruled` fill, `rule` border, `ink-soft` text (contrast at least 4.5:1, in the 22.2 test).
23.2 [e2e] The active tab keeps its slip fill, its join to the slip below and its extra height, and gains a 4px `ink` bar along its top edge (the bottom edge is joined to the slip, so an underline cannot go there; the founder's item says "e.g."). `aria-selected` is unchanged.

**Item 25. Modal backdrop.**

25.1 [e2e] From 768px, behind a centred dialog, the page shows through a `sheet-ground` backdrop at 60% opacity. Below 768px the bottom sheet keeps its dark context header as the canvas draws it (question 5). Focus trap, Escape and inert page unchanged.

**Item 26b. Desktop dead space.**

26.1 [e2e] At 1024, 1280 and 1440px the book is no wider than the side navigation plus the content column plus its padding, centred on the cloth; the content column has no empty band wider than 24px to its right. Below 1024px nothing changes (screenshots at 360 and 390 match before and after).

## 5. Out of scope, next slices (in the order I would do them)

1. **Student profile page** (item 9; PRD screen 5 "Student detail"). List rows and Home names open it; includes item 13's Receipt move and a row menu if still wanted. In the PRD; needs a slice id in BUILD_PLAN.
2. **Receipt send and number** (item 8's WhatsApp send in the parent's language, Download/Print, "FD-0002"; R1-7 Part C). WhatsApp send and PDF are PRD; the "FD-" prefix and padding are not (question 7).
3. **D1b desktop two-pane board and Students table** (item 26a). Already specified in `D1-desktop-layouts.md` criteria 12 to 18.
4. **"₹X collected of ₹Y" hero** (item 15). Not in PRD wording (PRD: "₹X pending from N students"); founder approval of the change to the header.
5. **Empty Home "Next 7 days: N students, ₹X"** (item 14). Not in the PRD; small once 4 exists.

Also not done here: a grace-days setting screen; late fees; changing when dues are generated; the 4px shadow offset and "no shadow on list containers" (dropped by the founder's item 21 decision); any new colour role.

## 6. Edge cases

- **Empty:** no students → empty Home unchanged; students but nothing due → round 1's "next fee" line unchanged; no bar drawn. Students screen with no dues read yet → rows without chips.
- **Offline:** Collected (3.3) comes from a payments read; offline it shows the last cached value with the existing stale note, or is omitted from the bar's Collected label with "—" if never read. The Language list (18.4) works offline for the screen but the saved language syncs when back online. Unticking consent offline (7.3) uses the existing offline save path and banner.
- **Slow network:** the payments read for Collected never blocks the board: the board draws with Collected pending (label shows a skeleton block), then fills in.
- **Very long names:** 80-character name with no spaces on Home rows with two tags (3.2), in the Move sheet with search, and in the "Saved {name}." toast at the foot of the add form: wraps, nothing cut, no sideways scroll, and the form's buttons do not move (6.1).
- **Large font:** two tags plus the round Remind button plus Mark paid at 360px largest font in Hindi; the summary bar labels; tab top bar; "Soon" under Attendance in the side and bottom nav.
- **Second language:** every new key in four files; plural forms for "{n} of {m} students still owe", "{n} results", "Select all shown ({n})"; Indic labels have no capitals and no letter-spacing; amounts and dates always 0 to 9 digits.
- **Partial payment:** late and not late (3.2); part payment on an earlier balance (3.4); part payment then undo (3.5); a student with two part-paid fees (two rows, chip on Students is "Overdue ₹X" with the sum).
- **Duplicates:** two quick taps on "Save and add another" (6.3); selecting all then searching in Move students (17.4).
- **Parent opening an old link:** pay page lateness words come from the same constant; at 0 nothing changes. Removing a parent's number (7.3) does not invalidate their pay link.
- **Clock and zone:** grace and "Due today" computed on the India day; phone set to London shows the same tags.
- **Payment dated in an earlier month:** a payment recorded today but dated 30 Sep counts in September's Collected, not October's (paid-on date rules).

## 7. Design references

`design/project/Home.dc.html` (rows, hero, strip being replaced), `State-allpaid.dc.html` (Collected), `Students.dc.html` (rows, header), `Add-student.dc.html` (groups, phone field), `Batch.dc.html` (batches list and Move students), `More.dc.html` (header being replaced per item 18), `Language.dc.html` (list), `Attendance.dc.html`, `Nav.dc.html` (Soon label), `Receipt.dc.html` and `State-undo.dc.html` (Undo placement), `State-loading.dc.html` (skeletons), `Interaction.dc.html` (disabled, focus, error states), `Pay-sheet.dc.html` (sheet ground), `Home-desktop.dc.html` (desktop book). Where the founder's items differ from the canvas (strip legend, More header, tab marker, label size), the founder's 25 Oct decision wins and the canvas should be republished later as a separate design request.

## 8. Analytics

No new PostHog events and no change to the PRD section 4 list. `payment_marked`, `reminder_sent` and the claim events keep firing where they do today; moving Remind to an icon button must keep `reminder_sent` on the same action. No event carries a name, phone or amount typed by the tutor.

## 9. Test by hand on a phone (360px, then largest system font, then Hindi)

1. Add a student with due day = today: Home shows "Due today" in the Due tab. Tomorrow it says "Overdue 1 day".
2. Add a student with "Already owes ₹500": the row says "Earlier balance · Added {today}" with Overdue, not "Due {today}".
3. Mark ₹250 paid on that earlier balance: the row shows "Overdue" and "Part paid ₹250" tags, ₹250 owed; Collected goes up by ₹250; Paid tab unchanged. Pay the rest: Collected shows ₹500 and does not drop.
4. Read the line under the amount with Show = All, then a batch: "{n} of {m} students still owe" matches the filter's count.
5. The bar under the hero: three labelled amounts you can read without colour.
6. Month arrows: with only this month, no arrows; with older months, Next is clearly dead (dashed, faint) in the current month.
7. Add students quickly with "Save and add another", once at normal text and once at the largest system font with a very long name: the buttons never move; a message at the foot of the screen says who was saved and what was kept, and it never covers a button (scroll down: both buttons sit above it).
8. Type a phone: "+91" stays in front, digits group as 98765 43210.
9. Edit a student with a number: the tick is on. Untick: the warning says the number will go. Save: Home offers "Add number".
10. Make a field wrong, tap into it: it stays red.
11. Students: no row numbers; search shows "N results" and counts change; a batch tab hides batch names; Batches is in the header; each row has a status chip.
12. Batches: list first, "+ New batch" opens the form. Move students: one Cancel, search, select all, count on the button.
13. Attendance in the nav says "Soon"; no Back buttons on top-level tabs; More's header looks like Students'; Language applies at once and returns to More.
14. Open Add student and Receipt: back link, no bottom bar on the phone. On a laptop at 1440: side navigation on every screen, no wide empty band.
15. Close the tab and open Home on mobile data: a Home-shaped skeleton, no "Opening your book…" flash.
16. Labels look larger and darker; tabs: inactive lighter, active has a black bar on top; a sheet on a tablet shows the page dimmed behind it.
17. Turn on TalkBack: language radios say the language names; the summary bar is read as three labelled amounts; "Saved" is announced.
18. Open Home online, wait over a minute, then open Students on a connection that fails without the phone being offline (mobile data on, no signal): its re-read of this month fails, yet the status chips still show from the older saved fees and Students itself shows no stale note (Home shows it when opened next). Check the chips match the saved data and note whether that is acceptable.

## 10. Open questions for the founder (each has a default that will be built if you do not answer)

1. **The "OVERDUE on 25 Oct" row.** I believe it was an earlier balance ("Already owes"), which by the R1-6 rule is overdue at once. Default: keep that rule, change the row to say "Earlier balance · Added 25 Oct 2026". Alternative: treat an earlier balance as "Due today" on the day it is entered and overdue from the next day. Can you confirm the row said "Earlier balance"? If it did not, tell us the student, and we will look for a real bug before PR1 merges.
2. **What "Collected" means.** Default: money received in the month by paid-on date (cash you actually got in October, including part payments and old balances). Alternative: money paid against October's fees whenever it arrived. The default can make October's Collected plus still owed differ from October's billed total; that total is item 15, a later slice.
3. **Dashed lines.** Default exceptions to "dashed only for disabled or placeholder": the Part paid status mark (otherwise it differs from Overdue by colour only) and the cloth stitch on the landing page and desktop background. Remove either?
4. **Loading words.** Default: "Opening your book…" is screen-reader only, and becomes visible only if loading takes more than 5 seconds. Or never visible?
5. **Backdrop on phones.** Default: 60% backdrop for centred dialogs from 768px; the phone bottom sheet keeps its dark header as designed. Want the page visible behind phone sheets too? (Bigger change to the sheet layout.)
6. **"All" in subjects.** No code adds "All"; it shows only if typed as a subject. Default: no change. Do you want an "All subjects" choice that cannot be combined with others? (New behaviour, not in the PRD.)
7. **Receipt number format "FD-0002".** PRD says only "sequential number per tutor". The prefix would come from the brand constant. Confirm for the receipt slice (R1-7 Part C), not this one.
8. **Label size.** Default: Latin labels 15px (from 14px) and darker, which updates DESIGN.md. OK to change the design system's table?
9. **Still open from before:** "she" for the tutor in `payPage.claim.help`, `payPage.claim.sent` and `payPage.claim.pending`. Default: keep until you decide; not touched here.
10. **Global or app-only tokens for the parent pages?** PR4's label size and colour, error-banner shadow colour and 768px+ sheet backdrop are global tokens, so `/p/` and `/r/` change visually too (no wording change). Default: global, one design system; `preprod-qa` checks `/p/` and `/r/` at 360 and 768px before release, and because no parent wording changes, the signed language review records stay valid. Alternative: scope those tokens to the signed-in app, which leaves two label sizes in the product.

## 11. Specs this amends

R1-6 criteria 13 (hero words), 14 (strip and legend replaced), 16 (row tags and earlier-balance caption), 34 (strip wrap check dropped); R1-3 criteria 5 (row numbers), 24 (tick on edit); UX-review-fixes item 4 (back button removed); D1 criterion 5 (book width) and DESIGN.md "Type" and "Shape and depth". Each change is recorded here so `test-engineer` updates those tests' wording without deleting a behaviour assertion.

## 12. Sources read

`PRD.md` sections 4 to 9; `docs/BUILD_PLAN.md`; `docs/DESIGN.md`; `docs/specs/UX-review-fixes.md`, `R1-3-students.md`, `R1-6-dues-board.md`, `D1-desktop-layouts.md`; `src/lib/dues-board.ts`, `dues.ts`, `pay-page-view.ts`, `payments.ts`, `payments-view.ts`, `profile.ts`, `student-form.ts`; `src/components/board/*` (board-screen, due-row, hero-amount, month-switcher, board-states), `students/*` (student-form, student-list-screen, student-row), `batches/*` (batch-list-screen, move-sheet), `more/more-screen.tsx`, `language/language-list.tsx`, `attendance/attendance-placeholder.tsx`, `app/app-screen.tsx`, `app/app-nav.tsx`, `app/loading-book.tsx`, `pay/receipt-screen.tsx`, `ui/*` (button, field, select-field, segmented, status-tag, tabs, sheet); `src/styles/tokens.css`, `type.css`, `states.css`; `supabase/migrations/20261012135000_r1_opening_due_with_payments.sql`; `messages/en.json`; `design/project/canvas.json`, `Home.dc.html`, `More.dc.html`.

## 13. Technical plan (tech-lead, 2026-10-25, against `main` at `fdeb962`)

Written against the defaults of section 10. Nothing here needs a migration, a new table, a new Edge Function, a new Next.js API or a new dependency. Section 13.8 lists the three spec points that conflict with the code or with each other, each with the default this plan builds.

### 13.1 Approach

Keep the money logic in pure helpers and add to them: one shared `GRACE_DAYS` constant; a `dueState` that gives lateness and "part paid" as two separate facts; a `collectedInMonth` that adds up non-voided payments by paid-on date; and one `studentChip` per student. The board store gets one more read (the month's payments), and a light read the Students screen can trigger. Everything else is presentation inside the components that already exist. Shared `ui/` components get new props that are **off by default**, so screens that do not ask for them render exactly as they do today. PR4 is the only sweeping PR, so it goes last.

### 13.2 Cross-cutting decisions (each defined once)

| Decision | Where it lives | Why |
| --- | --- | --- |
| `export const GRACE_DAYS = 0;` | **new `src/lib/grace.ts`**, with no imports | `pay-page-code-rules.test.ts` blocks the pay page from importing anything whose path contains `@/lib/dues` (it is a substring match, so `@/lib/dues-board` counts too). A file with no imports keeps the parent's shell free of the roster, the Supabase client and the board. `dueState(due, today, grace = GRACE_DAYS)` and `lateness(today, dueDate, grace = GRACE_DAYS)` take it as a defaulted argument, so criterion 1.2 can pass 2 without touching the constant. |
| Lateness with grace | `dueState` in `src/lib/dues-board.ts`; `lateness` in `src/lib/pay-page-view.ts` | `late = daysBetween(dueDate, today)`. Overdue when `late > grace`, with `daysLate = late`, so 3 days late shows "Overdue 3 days" and not 1. If `0 < late <= grace`: Due tab, tag `due`, `daysLate: 0`, `isToday: false` (inside grace a reminder never says "late"). `late === 0`: "Due today". An opening due ignores grace (1.3). |
| Part paid is a second fact, not a tag value | `DueState` gains `partPaid: boolean` (`due.status === "partial"`); `tag` becomes lateness only (`overdue` / `due` / `paid`) | Today a not-late partial fee gets tag `part-paid` and a late one loses it. Separating the two lets the row draw two tags (3.2). The only consumer of `state.tag === "part-paid"` is `due-row.tsx`. `Mark` keeps `part-paid` for `StatusTag`. |
| "Collected" | pure `collectedInMonth(payments, studentOfDue, students, filter)` in `dues-board.ts`; the read is `readPaymentsInMonth(month)` in `src/lib/payments.ts`, still the only file that reads `payments` | See 13.4. `BoardView.collected` (this month's own fees only) is removed so nothing keeps the old meaning by accident. |
| Status chip on Students | pure `studentChips(dues, students, today): Map<studentId, Chip>` in `dues-board.ts`. It builds on `boardView(..., currentMonth(today), today, "all")`, so it uses the same `dueState` and grace. | One rule for Home and Students (10.1). |
| `StatusTag` | unchanged API | The two tags in a row are just two `StatusTag`s in a `flex flex-wrap gap-2` line. |
| New `ui/SummaryBar` | `src/components/ui/summary-bar.tsx` plus a `/dev/components` section (src/CLAUDE.md rule) | Takes `{collected, due, overdue}` in paise (collected may be `null` while pending) and three label strings that are already formatted. Segments are flex children with `style={{ flexGrow: paise }}` and `min-w-1` (4px), so there is no percentage arithmetic and no rounding. A zero segment is not rendered. The overdue mark differs by shape: the segment is taller than the other two, like the old "tall" block (gradients and patterns are banned by `check-tokens.mjs`). The bar is `aria-hidden`, and the labels are a `<ul>` in reading order. |
| `StudentStrip` | **deleted** with its test, its dev section and its `strip-grid` utility | Only `board-screen.tsx` uses it. The DESIGN.md components table replaces its row with SummaryBar. |
| Sub-pages and side navigation (item 19) | `AppScreen` gets `sub?: boolean` (default `false`) | `nav` already names the section. With `sub`, the nav wrapper is `hidden lg:contents`, so there is no bottom bar below 1024 and the side nav shows from 1024. `above` then renders through the existing no-nav pinned path. Screens that pass neither prop render as today. |
| Skeleton shape (item 20) | `BookBlocks` / `LoadingBook` get `shape?: "board" \| "list" \| "form" \| "plain"`; a pure `skeletonShape(pathname, locale)` in **new `src/components/app/skeleton-shape.ts`** | When `shape` is omitted, `LoadingBook` reads `usePathname()` (already used by the gate) and maps it. So the gate, `RosterGate` and every screen's own loading state agree with no change at the call sites. `/receipt/`, `/remind/` and `/claims/` map to `plain` (the gate's `placeOf` would otherwise call them home). |
| "Opening your book…" (20.2) | a CSS utility `reveal-after-slow` in `src/styles/states.css` | The words are `sr-only` with a 0s animation delayed 5s that removes the clip. There is no JS timer and nothing to clean up, and the `role="status"` element is present from the first paint, so it is announced once. |
| Book width (26b) | new token `--container-book` in `src/styles/tokens.css` (`calc(var(--spacing-sidenav) + 42rem + 4px)`), used as `lg:max-w-book` in `AppScreen`'s `book` | One token that D1b can widen later. `layout-rules.test.ts` keeps "only AppScreen sets width". The D1 criterion 5 test is reworded. |
| Language names for screen readers (A.2, 18.4) | reuse `language.name.{en,hi,kn,te}` | Add the `language` namespace to the book layout's `ClientMessages` list (Add/Edit student) and to More's page list. That is about 10 short strings and a fraction of a KB, with no duplicated keys. |

### 13.3 PR1: status and money (items 1, 2, 3, 4, 10)

**Files**

- `src/lib/grace.ts` (new): the constant and one comment.
- `src/lib/dues-board.ts`: the grace argument on `dueState`; `partPaid`; `BoardView` gains `studentsInFilter` (active students where `inFilter` holds, with or without a fee), `dueOwed` and `overdueOwed` (paise remaining per tab) and loses `collected`, `blocks` and `legend`. `studentsInView` stays for `AllPaid`'s "{n} of {m}" (see the risks). New `collectedInMonth` and `studentChips`.
- `src/lib/pay-page-view.ts`: `lateness(today, dueDate, grace = GRACE_DAYS)`, overdue when `-difference > grace`. `feeLine` passes the default. The pay page's words do not change at grace 0.
- `src/lib/payments.ts` (backend-dev): `readPaymentsInMonth(month)` selects `PAYMENT_COLUMNS` with `.gte("paid_on", month).lt("paid_on", shiftMonth(month, 1)).is("voided_at", null)`, ordered by `paid_on, id`, and pages at 1,000 the way `dues.ts readAll` does. It fails whole on a bad row.
- `src/lib/dues.ts`: no change. `readDuesByIds` is reused for payments whose fee is in neither cached slice (13.4).
- `src/components/board/board-store.ts`: a `collected: Record<month, {payments: Payment[]; studentOf: Record<dueId, studentId>; at}>` slice. It is read in `open`, `selectMonth`, `retry` and `refresh` beside the month read, and it is **non-fatal** (like `earliest`): a failure leaves the cached value or `null` and never sets `failed`. `applyPayment` adds the payment to the slice when its `paidOn` falls in that month and maps its fee to the student. `applyVoid` removes it by id. Both mark the slice old so the next read replaces it (3.5). New `ensureCurrent(today)`: reads the current month and the unpaid fees only if `needsRead` says so. It makes no `ensureMyDues` call and reads no reminders and no collected, and it is used by Students.
- `src/components/board/board-state.tsx`: exposes `ensureCurrent` and the collected slice.
- `src/components/board/use-board-view.ts`: passes collected through.
- `src/components/board/board-screen.tsx`: the strip block becomes `<SummaryBar>`, drawn only when `!empty` (4.5). Collected comes from `collectedInMonth`, with `null` while the read is pending. The stale note already covers a failed read.
- `src/components/board/hero-amount.tsx`: `hero.owe` with `{n: view.students, m: view.studentsInFilter}`. The collected caption is removed because the bar carries it.
- `src/components/board/board-states.tsx`: `AllPaid` takes the same collected figure (3.6); its student count is unchanged.
- `src/components/board/due-row.tsx`: a tag line with the lateness tag plus a `part-paid` StatusTag reading "Part paid {amount}", with the amount in a `type-amount-row` span with `translate="no"`. The blue caption is removed. An opening fee shows `row.earlier · row.addedOn {formatDate(dueDate)}`, and a monthly fee keeps `row.dueOn`.
- `src/components/ui/summary-bar.tsx` (new), its test, and `src/app/dev/components/sections/summary-bar.tsx` (new) with states for all three, one zero, all zero, collected pending, and long Hindi labels.
- Deleted: `ui/student-strip.tsx`, `student-strip.test.tsx`, `dev/components/sections/student-strip.tsx`, and the `strip-grid` utility in `states.css`. The dev page index entry is removed too.
- `src/components/students/student-list-screen.tsx` and `student-row.tsx`: `useBoard().ensureCurrent(today)` on mount; `studentChips` gives a `StatusTag` per row; "Next fee {date}" from `nextDueDate` when there is no chip; nothing for archived students. Rows render immediately and the chip line appears when the data does (10.3). The chip words live in the `students` namespace so the `board` namespace stays off the Students route.
- `pay-page-code-rules.test.ts`: no change needed. It scans the importer (`pay-page-view.ts`), and `@/lib/grace` matches none of its forbidden import strings. Add one assertion that `src/lib/grace.ts` has no `import` line, so the parent's shell cannot grow through it later.
- `docs/DESIGN.md`: the components table (StudentStrip becomes SummaryBar) and the StatusTag note that two tags may sit side by side.

**Data and RLS.** No migration. `payments` has the single policy `payments_select … using (tutor_id = (select auth.uid()))` and `grant select … to authenticated` (`20261012130000_r1_payments.sql`). `dues` has its select policy, which `readDuesByIds` already relies on. A month filter on `paid_on` plus `voided_at is null` is a plain select under both. `supabase/tests/150_payments_rls.sql` already proves tutor B reads no payments of tutor A. Backend-dev adds one assertion with the exact range filter the app sends (tutor B, `paid_on` in A's month, zero rows). There is no index on `paid_on`. A tutor's payments are hundreds a year, and RLS narrows by `tutor_id` first, so a scan is fine. **No index migration now.** Revisit at R2 scale.

**Message keys (all four files; non-English `TODO-translate` where unsure)**

- Add: `board.hero.owe` (ICU plural on `m`, with `n` inside), `board.row.addedOn` ("Added {date}"), `board.tag.partPaidAmount` ("Part paid {amount}"), `board.summary.collected` / `.due` / `.overdue` ("Collected {amount}" and so on), `board.summary.pending` (screen-reader words for the collected skeleton), `students.chip.overdue` ("Overdue {amount}"), `.dueToday`, `.partPaid` ("Part paid {amount}"), `.due` ("Due {date}"), `.paid`, `students.nextFee` ("Next fee {date}").
- Remove once unused: `board.hero.from`, `board.hero.collected`, `board.legend.*`, `board.strip.label`, `board.row.partPaid`, and `board.tag.partPaid` if the dev section no longer reads it (the dev section has its own words).

**Size.** Baseline from the last local build (24 Oct, before #36 and #37; re-measure on `main` before starting): `/en/home` 173.9 KB, `/en/students` 164.0 KB, `/p/` 144.8 of 151 KB. Expected: Home about +0.5 KB (the bar replaces the strip, and the payments read adds a few lines to a module Home already loads through `UndoBanner`). **Students about +6 to 10 KB**, because the board store, `dues.ts`, `dues-board.ts`, `payments-view.ts` and `reminders.ts` (imported by the store) become part of its first load. Target ≤ 175 KB, limit 200 (10.4). If it comes in over 180, split the read half of the store (`readMonth` and `readUnpaid` plus the slices) so Students does not pull `reminders.ts`. `/p/`: +0.1 KB. Record before and after in the PR.

**Tests**

- Unit `dues-board.test.ts`: the 1.1 table (yesterday, today, tomorrow, 31 Oct to 1 Nov, 28 Feb to 1 Mar in 2027 and 2028); grace 2 gives 2 days late = Due, 3 = "Overdue 3 days"; an opening fee with grace stays overdue with `daysLate: null`; `partPaid` late and not late; the Paid tab holds only fully paid (3.1); `studentsInFilter` for all, none and a batch, with and without fees (2.1); `dueOwed` and `overdueOwed`; `collectedInMonth` covering voided excluded, a 30 Sep payment not counted in October, an earlier balance and an earlier month counted, an archived student in their batch counted, a filter applied, and a fee unknown to the map counted under All only; `studentChips` precedence (10.1) plus none for archived and none when no fee exists.
- Unit `pay-page-view.test.ts`: lateness with the default, and with grace passed. Every existing pay-page, reminder and board test passes unchanged (1.2, 1.6).
- Unit `board-store.test.ts` (extend `board-state.test.tsx`): the collected slice on read, on `applyPayment` in and out of the month, on `applyVoid`, and a non-fatal failure; `ensureCurrent` makes no `ensure_my_dues` call.
- Unit `payments.test.ts`: `readPaymentsInMonth` sends the named columns and the range, pages, and fails whole.
- Unit `summary-bar.test.tsx`: segment order, a zero segment absent with "₹0" in its label, `aria-hidden` on the bar, labels in order.
- pgTAP `150_payments_rls.sql`: the range-filter assertion.
- e2e (extend `board.spec.ts`, `board-layout.spec.ts`, `students.spec.ts`, and the payments fake in `e2e/pay-helpers.ts`, which must now answer `gte`, `lt` and `is` on `paid_on` / `voided_at`): 1.4, 1.5 (clock 25 Oct, then 26 Oct), 2.2, 3.2, 3.4, 3.5, 4.1, 4.2, 4.4, 4.5, 10.2, 10.3, plus the 80-character name with two tags at 360px and the largest font in Hindi. Delete the strip assertions in `board-layout.spec.ts` and `dev-components-f2b.spec.ts`, recording that R1-6 criteria 14 and 34 were amended.

### 13.4 How "Collected" is read (PR1 detail)

1. `readPaymentsInMonth(month)` returns non-voided payments with `month <= paid_on < next month`. `paid_on` is a `date` that `record_payment` sets on the India day, so the comparison is on text and no time zone is involved.
2. Student of each payment: look up `payment.dueId` in the fees already cached (`months[*]` and `unpaid`). For the rest (fees since paid in full, from earlier months or opening balances), call `readDuesByIds` in chunks of 100 ids, to keep the URL short. A fee that comes back missing is counted under "All" and skipped under a batch filter.
3. `collectedInMonth` sums `amount` (integer paise) for payments whose student matches the filter, archived students included through `batchId`.
4. Offline or failed: show the last cached value, or `null`. `SummaryBar` then shows "Collected —" with no segment. The skeleton shows only while the first read is out (section 6, "slow network").

I chose this over a PostgREST embed (`dues!inner(student_id)`). It adds no new query pattern, keeps "named columns" true, and the existing e2e table fakes can answer it.

### 13.5 PR2: forms and controls (items 5, 6, 7, 12, 17, 24, A.1 to A.4)

**Files**

- `src/components/board/month-switcher.tsx`: when `!canPrev && !canNext`, render the label only. A disabled arrow uses `disabled:text-rule`, keeps its dashed `ink-label` outline and has no shadow (it has none today).
- `src/components/ui/button.tsx`: the `unavailable` text becomes `text-ink-label` (the muted text token; no new colour). Dashed outline, no fill, no shadow and no movement are already there. The 5.3 tests pin all of them.
- `src/components/ui/field.tsx`:
  - Error and focus (24.1): the typing variants (`group-typing/field:text-blue` on the label, `group-typing/field:border-blue` on the line, blue on the value) are applied only when `state !== "error"`. In error, the line keeps `border-cloth` and goes to `field-line-4` while focused.
  - New `prefix?: ReactNode` (12.1), off by default. With it, the line grid becomes `grid-cols-[auto_minmax(0,1fr)_auto]` and the control and its mirror move to column 2. The prefix is a `type-amount-row` span with `translate="no"` and an id, and that id is prepended to `aria-describedby`. Without `prefix`, the class strings are byte-for-byte what they are today.
  - States for the prefix and for "error while focused" go on `/dev/components` (`sections/field.tsx`).
- `src/components/ui/select-field.tsx`: `has-[select:focus-visible]:ground-ring` on the line wrapper (12.5). The chevron stays.
- `src/components/ui/segmented.tsx`: no API change. The option `label` is already a `ReactNode`, so the student form passes `<span lang>own name</span><span className="sr-only">, {language.name.x}</span>` (A.2).
- `src/lib/phone.ts`: new pure `formatPhoneTyping(text, caret): {text, caret}`. It applies `latinDigits`, strips a leading `+91`, `91` (12 digits) or `0` (11 digits), groups as `5 + space + 5` up to 10 digits, leaves anything longer or invalid as typed (so the existing errors still show), and maps the caret by counting digits before it.
- `src/lib/student-form.ts`, item 7, through the **existing write path**. `checkStudent` adds one branch: when `phone.ok && phone.value !== null && phone.value === savedPhone && !draft.permission`, the result is `ok` with `fields.parentPhone = null` (not an error). A new number without the tick is still `permissionNeeded`. `changedFields` then yields `{parentPhone: null}`, and `updateStudent` sends `parent_phone: null`. That is the same update as clearing the field, through `src/lib/students.ts` and its offline handling. No migration, no new column, and `consents` is untouched (7.4). New pure `permissionWarning(draft, savedPhone): boolean` for 7.3.
- `src/components/students/student-form.tsx`:
  - Edit draft: `permission: s.parentPhone !== null` (7.1).
  - On a phone change, if the normalized value differs from the saved one, set `permission` to false (7.2). The 7.3 warning sits under the tick, tied by `aria-describedby`.
  - The phone `TextField` gets `prefix="+91"`, the `onChange` runs `formatPhoneTyping` and sets the caret in a layout effect, and the `+91` helper goes.
  - Section legends: `type-headline` at ≥20px in `text-ink`; the form gap goes from `gap-6` to `gap-8` (12.4).
  - "Saved…" uses `students.form.savedKept` (12.3) and leaves the form: it is a toast passed to `AppScreen above` by `student-new-screen.tsx` (the form reports the saved name upward), drawn at the foot like the Undo banner, `role="status"`, cleared on the next save, after `BANNER_MS` or on leaving the screen. While it shows, the content keeps foot room equal to its height (6.4). The in-form status paragraph is removed. See 13.8 item 1.
- `src/components/app/text-field.tsx`: passes `prefix` through (it already spreads props).
- `src/components/batches/move-sheet.tsx`:
  - Remove the foot Cancel (17.1).
  - Add a search field (real `<label>`, `sr-only`) using `searchStudents` from `src/lib/student-list.ts`, the same matching as Students (17.2).
  - Add "Select all shown ({n})" as `ui/Check` (17.3).
  - The confirm count is `others.filter(ticked)`, which already ignores stale ticks. Search does not clear ticks, and the count includes ticked students who are hidden by the search (17.4). Clearing the search is a button.
- A.1 and A.3 audit: every `input`, `select` and `textarea` on the listed screens has a label, and toasts are `role="status"`. Fix whatever the new e2e finds. Expected suspects: the Mark paid sheet's date picker and `WriteNotice` (check whether its container is always present).

**Data.** None (item 7 is above).

**Message keys.** Add `students.form.savedKept`, `students.form.permissionRemove` (the 7.3 sentence), `batches.move.searchLabel`, `.searchPlaceholder`, `.noMatch` ("No student matches {text}"), `.clearSearch`, `.selectAll` (plural, "Select all shown ({n})"). Check's own "Selected" / "Not selected" words already exist under `remind`. Either reuse them by passing words, or add `batches.move.selected` / `.notSelected` (Check takes words as props). Remove `students.form.saved` once unused. `batches.move.cancel` stays because it is the sheet's close label.

**Size.** `/students/new` 166.8 and `/students/edit` 169.7 KB: +about 1 KB (the formatter and prefix). `/batches/edit` 166.6: +about 1 KB (search and Check, if Check is not already in the chunk). `/home`: about 0. All are well inside 200.

**Tests.** Unit: `phone.test.ts` for `formatPhoneTyping` (typing digit by digit, caret mid-string, the three paste vectors from 12.2, Indic digits, 11+ digits left alone); `student-form.test.ts` for the removal branch, new number unticked = error, and add mode unchanged; `field.test.tsx` for the prefix markup and describedby, error + typing classes (no `border-blue` and no `text-blue` in error, 24.2), and the default render unchanged (snapshot of the class list without `prefix`); `select-field.test.tsx` for the focus ring class; `button.test.tsx` for disabled `text-ink-label` (5.3); `month-switcher` unit tests for no arrows, one disabled arrow and `text-rule`. e2e: 5.1, 5.2, 6.1 to 6.4 (the 0px check at default font and at the largest font with an 80-character name), 7.1 to 7.3, 7.5, 12.1 to 12.5, 17.1 to 17.4, 24.1, A.1 to A.4 (one new `a11y-forms.spec.ts` that walks the listed screens with `getByRole(..., { name })` and a bounding-box check of 44px).

### 13.6 PR3: lists, navigation, loading (items 8-undo, 11, 13, 16, 18, 19, 20)

**Files**

- `src/components/pay/receipt-screen.tsx` and `receipt-card.tsx`: `UndoControl` renders after the card, not in its action slot, and the `border-dashed` rule goes (8.1). The confirm step and the 24-hour check are unchanged.
- `src/components/students/student-list-screen.tsx`:
  - No `number` (11.1); remove the `number` prop from `StudentRow`.
  - Counts come from `batchCounts(searchStudents(active, text), batches)` while searching, plus a `role="status"` line reading `students.results` (11.2). A present-but-empty container keeps the announcement reliable.
  - `batchName` is passed only when `current` is `all` or `none` (11.3).
  - The header gets a "Batches" outline `Button` beside "+ Add" in a `flex-wrap` group, and the foot button goes (11.4).
- `src/components/board/due-row.tsx`: actions are one wrapping line: Receipt as an underlined text link (≥44px), Remind as `RoundButton` (48px, `aria-label` = `remind.buttonFor`, same handler, so `reminder_sent` is unchanged), and Mark paid last (13.1, 13.2). "Add number" and "Add UPI ID" keep their words.
- `src/components/batches/batch-list-screen.tsx` and `batch-form.tsx`: a header "+ New batch" (`record`) toggles the form. `BatchForm` gains `onDone?` / `onCancel?` and a ref that focuses the name field. The form is open when there are no batches (16.1, 16.2).
- `src/components/ui/bottom-nav.tsx`: `BottomNavItem` gains `note?: ReactNode` (a visible small word under the label, or beside it from `lg`) and `aria-label?: string`, both off by default. `src/components/app/app-nav.tsx` sets them for Attendance (18.1).
- `src/components/attendance/attendance-placeholder.tsx` and `src/components/more/more-screen.tsx`: remove the back button and the back link (18.2).
- More: a plain header (small label line plus the `type-headline` "More") on the page, inside the content column, with no cloth and no stitch. The profile slip moves below it (18.3).
- The More Language row becomes a disclosure (`aria-expanded`) that shows `LanguageList` in place (18.4). `src/components/language/language-list.tsx` gains `to?: string` (default `languagePath`, so the first-run picker is unchanged). From More it is `morePath`, so a tap runs `saveLocale(code)` and loads `/{code}/more/`, and the gate's existing `syncLanguage` updates the tutor's saved language. There is no Continue and no trip through sign-in. Offline (`isOffline()`), the tap is stopped and the existing offline words show (13.8 item 3).
- `src/components/app/app-screen.tsx`: `sub` (13.2). Screens set `nav` and `sub` per 19.1: Add and Edit student, Batches and Batch use `nav="students" sub`; Receipt, Remind (`remind-run.tsx`, `pick-list.tsx`) and Claims use `nav="home" sub`. Each keeps or gets a `BackLink`; Claims already has its back arrow.
- `src/components/app/loading-book.tsx`, `skeleton-shape.ts` (new) and `src/styles/states.css` (`reveal-after-slow`): four block layouts. `board` is today's. `list` is a header plus a search line plus rows. `form` is a heading plus 4 field lines. `plain` is a heading plus 2 lines. The words become `sr-only` and then visible after 5s (20.1, 20.2).

**Message keys.** Add `students.results` (plural), `students.batchesButton` (or reuse `students.manageBatches` text; then rename it), `batches.newBatch`, `batches.cancelNew`, `nav.soon`, `nav.attendanceSoon` ("Attendance, coming soon"), `more.kicker` (the small label line; see 13.8 item 4). Remove `attendance.back`, `more.back`, and `students.manageBatches` if renamed. The `language` namespace is added to More's `ClientMessages` list.

**Size.** `/more` 153.6 KB: +about 2 KB (LanguageList and the namespace). Every book route: +about 0.5 KB (skeleton shapes). `/batches`: +about 0.5 KB. All are inside 200.

**Tests.** Unit: `skeleton-shape.test.ts` (every route maps, and unknown routes are plain); `app-screen` (`layout-rules.test.ts`): `sub` hides the bar below lg and leaves screens without the prop unchanged; `bottom-nav.test.tsx` for `note` and `aria-label`; `language-list.test.tsx` for `to` and the default; `more-screen.test.tsx` and `attendance-placeholder.test.tsx` lose their back-link tests (spec amendment recorded). e2e: 8.1, 11.1 to 11.4, 13.1, 13.2, 16.1, 16.2, 18.1 to 18.4, 19.1 and 19.2 (extend `wide-shell.spec.ts` with each listed screen at 390 and 1440), 20.1 and 20.2 (assert the shape's data attribute and that the words are `sr-only` at first; for the 5s reveal, assert the computed `animation-delay` rather than sleeping, plus one test that waits 5.5s), and `states.spec.ts` updated.

### 13.7 PR4: visual tokens (items 21, 22, 23, 25, 26b)

**Files**

- `src/styles/tokens.css`: `--shadow-record` and `--shadow-banner-error` become `var(--color-ink)` (21.1); `--container-book` (26b). The `ground-shadow` cloth-deep rule is unchanged.
- `src/styles/type.css`: Latin `--label-size: 0.9375rem` (22.1). Indic is already 15px at 600.
- Sweep for label colour (22.2): every `type-label … text-ink-label` becomes `text-ink-soft`, including the label tone in `Field` and `SelectField` and the legend in `Segmented`. Placeholders stay `ink-label`. A unit test fails on `type-label` combined with `text-ink-label` in one class string under `src/components`.
- `src/components/ui/tabs.tsx`: idle becomes `bg-page-ruled border-rule text-ink-soft`. Selected gets `before:` with a 4px `ink` bar on the top edge, inside the 6px corner radius (23.1, 23.2).
- `src/components/ui/sheet.tsx`: `md:backdrop:bg-sheet-ground/60`. The phone keeps the full ground (25.1). Check that `check-tokens.mjs` accepts a token colour with an opacity modifier. It bans raw colour functions, not modifiers. If it does not, add a `--color-sheet-scrim` token in `tokens.css` instead of loosening the check.
- Dashed sweep (21.2) under `src/components`. Allowed: disabled controls (`Button`, `SelectField`, month arrow), placeholders (`empty-home` slots, `reminder-tool` blank, loading blocks), the `part-paid` StatusTag, and **every** cloth stitch (`outline-stitch outline-dashed`; see 13.8 item 2). To convert to solid: `ArchivedTag` (2px solid `ink-label`; the word carries the status), `landing/ledger-card` and `landing/tools` tags, the `setup/subject-chips` add chip, the `remind/pick-list` note, the `claims/claim-card` divider (solid `rule`), and the `remind/remind-run` "skipped" card (it gets `bg-slip` plus its word; check that its state still has a word). New `src/components/dashed-rules.test.ts` with an allow-list of file and class pairs.
- Spacing sweep (21.3) on the listed screens: replace `*-0.5`, `*-1.5` (except `pr-1.5` and `pb-1.5`), `*-2.5`, `*-3`, `*-3.5`, `*-4.5`, `*-5`, `*-5.5`, `*-7` and `*-12` with the nearest of 0, 1, 2, 4, 6, 8, 10, 14. The column inset `pr-5.5 pl-5` becomes `pr-6 pl-4` or `px-6`; pick one and use it everywhere. New `src/components/spacing-rules.test.ts`: it lists the screen files and matches `\b-?(?:p|m)[trblxyse]?-|gap(?:-[xy])?-|space-[xy]-` values, excluding `ui/` internals.
- Hero spacing (22.4) in `hero-amount.tsx` and `board-screen.tsx`: `mt-2` / `mt-2` / `mt-6` / `mt-4` / `mb-10`.
- `src/components/app/app-screen.tsx`: `lg:max-w-book` instead of `lg:max-w-7xl` (26b).
- `docs/DESIGN.md`: "Type" (labels 15px, `ink-soft`), "Shape and depth" (one shadow colour; dashed only for disabled and placeholders, plus the recorded exceptions), IndexTabs, Sheet backdrop, and Wide screens (book width).
- `src/styles/contrast.ts` and its test: add `ink-soft` on `page`, `slip` and `page-ruled` for labels and idle tabs; record `ink-label` on `page` at 5.96:1.

**Message keys.** None.

**Size.** CSS only. JS changes by roughly 0 on every route. The CSS file grows by well under 1 KB.

**Tests.** Unit: the contrast pairs (22.2, 23.1); `dashed-rules.test.ts` (21.2); `spacing-rules.test.ts` (21.3); `tokens` test that every paper shadow uses `ink` (21.1); `type` test for the label size (22.1). e2e: 22.3 (`getComputedStyle` font-size ≥ 14px across labels, tags and captions on the listed screens, in en and hi), 22.4 (measured gaps), 23.1, 23.2, 25.1 (computed backdrop at 768 and none at 390), 26.1 (1024, 1280, 1440 book width and right band ≤ 24px; screenshots at 360 and 390 unchanged, so update `wide-shell.spec.ts` for D1 criterion 5).

### 13.8 Spec points that need an answer (sent back to `product-manager`; each has a default this plan builds)

1. **Item 6 (6.1) as first written could not guarantee 0px.** Any "Saved…" message drawn in the form's flow moves the buttons by its own height at some font size. The founder's item allows "toast or fixed-height slot". **Resolved (see "Answered" below):** a toast pinned at the foot through `AppScreen above`, the same place and pattern as the Undo banner, out of the flow, so the 0px check holds at every font size (6.1, 6.2, 6.4).
2. **Item 21.2's stitch exception is too narrow.** The cloth stitch is also on the tool header, the language picker, `ClothGround` (sign-in, setup), and the parent's pay page frame and receipt footer. Removing it there would change the parent pages, which section 2 says are unchanged, and would contradict DESIGN.md ("Cloth surfaces carry a 2px dashed stitch"). **Default built:** the exception is "every cloth surface's stitch" (any `outline-stitch outline-dashed`). More loses its stitch only because item 18.3 removes its cloth.
3. **PR4 changes the parent pages visually.** `--label-size`, the label colour, `--shadow-banner-error` and the Sheet backdrop at 768+ are global tokens, and `/p/` and `/r/` use them (labels, the error banner, the claim sheet). Section 2's "the parent's pages are not changed" holds for PR1 to PR3, not for PR4. **Default built:** apply them globally (one design system). `preprod-qa` checks `/p/` and `/r/` at 360 and 768, and no parent wording changes, so the signed language review records are unaffected. The alternative is to scope the tokens to the app, which would create two label sizes. Question for PM and the founder: global (default) or app-only?
4. **18.3 "a small label line"** above "More" has no content defined. **Default built:** the tutor's name is already the profile slip's headline, so the label line is the brand-free word "Settings" (`more.kicker`). PM to confirm the words.
5. **18.4 offline.** There is no service worker yet (R1-12), so loading `/{code}/more/` offline fails. **Default built:** offline, a tap shows the existing offline line and does nothing. Section 6's "works offline for the screen" is met by the disclosure itself.


**Answered 2026-10-25:** item 1 takes the alternative: the "Saved…" line is a toast pinned at the foot through `AppScreen above`, like the Undo banner, so the buttons never move at any font size (the founder's list offered "the existing toast component"). Items 2 to 5 keep the defaults built above; item 3 (global tokens on the parent pages) stands unless the founder says otherwise.

None of these needs a new dependency or a migration.

### 13.9 Work split and order

PR1 merges first. PR2 touches none of PR1's files apart from the message files, so it can be built in parallel with PR1 and merged right after it. PR3 starts after PR1 merges (Students list and `due-row.tsx`). PR4 goes last, after PR2 and PR3, because its sweeps touch every file those two change.

PR1
1. `backend-dev`: `readPaymentsInMonth` in `src/lib/payments.ts` with unit tests; the pgTAP range assertion in `150_payments_rls.sql`; extend the e2e payments fake for `gte`, `lt` and `is` filters.
2. `frontend-dev`: `src/lib/grace.ts`; `dueState` and `lateness` with grace and `partPaid`; `studentsInFilter`, `dueOwed`, `overdueOwed`, `collectedInMonth`, `studentChips`, all with unit tests. (Can start alongside task 1; it only needs the `Payment` type.)
3. `frontend-dev`: the board store's collected slice, `ensureCurrent`, and the apply and void bookkeeping.
4. `frontend-dev`: `ui/SummaryBar` plus its dev section; delete StudentStrip; Home hero, row tags, earlier-balance caption, AllPaid.
5. `frontend-dev`: chips on Students; message keys in four files; DESIGN.md components table; size before and after.

PR2 (parallel with PR1)
1. `frontend-dev`: `formatPhoneTyping` and the item 7 branch in `student-form.ts`, with unit tests.
2. `frontend-dev`: `Field` error-focus and `prefix`; `SelectField` ring; `Button` disabled text; dev sections.
3. `frontend-dev`: student form (7, 6, 12, A.2), month switcher, Move sheet, the A.1 and A.3 audit fixes; keys.

PR3 (after PR1)
1. `frontend-dev`: `AppScreen sub` and per-screen nav and back links; skeleton shapes and `reveal-after-slow`.
2. `frontend-dev`: Students cleanup, Home row actions, Batches, Receipt Undo.
3. `frontend-dev`: nav "Soon", More header and Language disclosure, Attendance; keys.

PR4 (last)
1. `frontend-dev`: tokens, type, tabs, sheet, book width, DESIGN.md, contrast table.
2. `frontend-dev`: the dashed and spacing sweeps with their rule tests.

### 13.10 Risks and traps

- **The pay-page import guard is a substring match.** Put the constant anywhere under `@/lib/dues…` and `pay-page-code-rules.test.ts` fails. Worse, if the guard is "fixed" the parent's shell can pull in the roster. `src/lib/grace.ts` must have no imports.
- **Removing `BoardView.collected`.** It meant "paid on this month's own fees". Delete the field rather than redefine it, so a missed caller fails `pnpm typecheck` instead of showing a different number. `AllPaid` and the hero are the two callers.
- **The `studentsInView` denominator.** `AllPaid` says "{n} of {m}" with `studentsInView`. Switch it to `studentsInFilter` only if PM wants "25 of 25" on the stamp screen. Otherwise keep `allPaid.of` as is and keep computing `studentsInView`. Do not silently change it. Default: keep it.
- **Undo and Collected.** The void must update the collected slice locally (`applyVoid`) **and** mark it old. If only the dues are patched, Collected stays high until the next read and 3.5 fails.
- **A payment dated into another month.** `applyPayment` adds it to the slice of the month of `paidOn`, not the viewed month (section 6, last edge case).
- **Students reading the board store.** `ensureCurrent` must not call `ensureMyDues` or bump `reads` in a way that makes Home's missing-student effect reload the roster twice. Its failure is non-fatal on Students (no chips) but sets `failed` in the shared snapshot, which is true information when Home opens next. That is acceptable and should be documented in the store.
- **The Students route bundle.** Importing `board-state.tsx` breaks the "only Home imports the board" cut line documented in `board-holder.tsx`. Update that comment, and measure. The fallback split is in 13.3.
- **`readDuesByIds` URL length.** Chunk at 100 ids. A tutor with many fully paid old fees in one month would otherwise send a very long GET.
- **Field default render.** `Field` has eleven call sites, including the parent's claim sheet. The `prefix` and error-focus changes must leave the non-prefixed class strings identical. Pin them with a snapshot test in PR2.
- **Caret on live phone formatting.** It works on the `<textarea>` Field (it has `setSelectionRange`). Do **not** switch the phone field to `type="tel"`: the Field comment notes a tel input's caret cannot be read. Set the caret in a layout effect after the controlled value updates, or Android Chrome jumps it to the end.
- **`AppScreen sub` and the `above` banner.** Claims passes `above` with no nav today. With `sub`, `above` must still pin at the foot below 1024 and at the content column from 1024. Test the Claims Undo banner at 390 and 1440.
- **The 5s reveal.** CSS animations ignore Playwright's fake clock, so assert the declared delay plus one real wait. Do not add a JS timer.
- **The PR4 spacing sweep moves layouts by 2 to 4px everywhere.** Run the whole e2e suite. Screenshot baselines at 360 and 390 change by design except where 26.1 requires "unchanged" (that applies to 26b only; record it).
- **Message parity.** Four PRs edit the same four files. Each PR rebases, runs `pnpm i18n:check`, and deletes keys only when `grep` finds no use.

### 13.11 Not doing

A grace-days setting; any index or migration on `payments` (revisit at R2 scale); a PostgREST embed for Collected; the student profile page or the Receipt move (next slice); a language sub-route under More; a service worker for offline language switching; new colour tokens (an opacity scrim token only if `check-tokens.mjs` refuses the modifier); a 4px shadow offset; redesigning the phone bottom sheet's backdrop; Tamil or Malayalam; and any change to PostHog events (`reminder_sent` stays on the Remind screen, not the row button).

### 13.12 Who starts

`backend-dev` starts PR1 task 1 (`readPaymentsInMonth`, the pgTAP range assertion and the e2e payments fake). At the same time, `frontend-dev` starts PR1 task 2 (`src/lib/grace.ts` and the pure helpers in `dues-board.ts` and `pay-page-view.ts`). A second `frontend-dev` session may start PR2 task 1 in parallel, on its own branch.
