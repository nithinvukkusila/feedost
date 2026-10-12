# D1: desktop and laptop layouts for the tutor app

New slice, requested by the founder on 2026-10-12: "in the UI I can see the UI is for phones; also develop screens for desktop, laptops". `PRD.md` §6 says only "Mobile-first, works at 360px width, large tap targets (>=44px)". It does not forbid wider screens; the founder's request is the approval to add this scope. It is a layout slice: no new feature, no new data, no migration.

Process: standard (no money logic changes; the Mark paid and Remind screens change shape only). Tags: [unit] Vitest, [e2e] Playwright, [manual] by hand. `tech-lead` writes the technical plan; this file does not.

## 1. Goal

A tutor who opens the app on a laptop, desktop or tablet gets screens that use the width: a side navigation, the dues board as a summary pane beside a table of fees, sheets that open as centred dialogs, and forms that do not stretch. Before this slice every screen is one 448px column in the middle of a wide window. On a phone nothing changes.

## 2. Users and moment

The tutor at home in the evening, or in a centre office, on a laptop or a shared desktop, doing the month's accounts: checking who has not paid, marking cash payments, sending a run of WhatsApp reminders (WhatsApp Web), editing the student list. Mouse, trackpad, keyboard, sometimes a tablet on a stand. The phone remains the primary device (low-end Android, between classes); every choice below protects it first. Parents are not users of this slice (their pages are phone-first; section 6).

## 3. Defaults chosen (no founder input needed)

Each is an open question answered so work is not blocked. The founder can reverse any; section 12 lists them in order.

1. **Breakpoints, measured in CSS pixels of the window:** phone below 768, tablet 768 to 1023, laptop/desktop 1024 and up. Tested at 768, 1024, 1280 and 1440, plus 360 (primary), 320 and 1920 for overflow.
2. **360px is unchanged.** Below 768 every screen looks and behaves as it does on `main` today, including the 448px centred column between 449 and 767. The phone is changed by nothing in this slice.
3. **Side navigation at 1024 and up.** The founder's brief asks for a left side navigation. The `Home-desktop` canvas draws the same four links as folder tabs across the top of the cloth instead. Default: build the left side navigation (labels get room in Hindi, Kannada and Telugu; four tabs in a row would wrap). If the founder prefers the canvas, only the nav arrangement changes; every other criterion stands.
4. **Tablet (768 to 1023) keeps the bottom navigation** and the single column, widened to 42rem (672px) and centred, with sheets as centred dialogs.
5. **Content width:** at 1024 and up the whole app is one "book" at most 80rem (1280px) wide, centred, with the cloth showing on both sides on wider windows. This matches the 1280px max width on the landing and tool canvases.
6. **No list-and-detail panes.** `Home-desktop` shows two panes (a summary and a table), not a list beside a student's detail. There is no Student detail screen in the app yet (rows open the edit screen). A row opens the same screen as on the phone.
7. **The sheet becomes a centred modal dialog from 768 up**, not a side panel. Same content, same buttons, same Esc and focus handling (it is already a native `<dialog>`).
8. **Breakpoints in rem** (Tailwind's own: 48rem and 64rem), so a browser set to a larger text size, or zoomed to 200%, stays on the roomier layout only when it truly has room.
9. **Print, a dark mode, a separate desktop-only feature set, drag and drop, table editing, keyboard shortcuts beyond Tab, Enter and Esc: not built.**
10. **No skip-to-content link.** The navigation is four links; adding it would add a string. Open question 5.
11. **No new copy.** Every label on a wide screen is the label already on the phone.

## 4. Acceptance criteria

PRD text, word for word, for the layout requirement this slice extends: "Mobile-first, works at 360px width, large tap targets (>=44px)." That sentence stays true everywhere and is criterion 1.

Fake Supabase host, as in `board.spec.ts`. Wide-screen e2e tests run as extra Playwright projects at 768x1024, 1024x768, 1280x800 and 1440x900; the existing phone project stays the default and is not edited.

### Breakpoints and the phone

1. [e2e] 360px stays the primary target: the whole existing phone e2e suite (project `phone`, 360x740) passes with no assertion edited and no test deleted. [manual] On a real phone nothing looks different from before this slice.
2. [e2e] Between 320 and 767 wide the layout is the phone layout: single column, bottom navigation, bottom sheets, at most 448px content width. At 767 and at 768 the screenshot structure differs (side-by-side checks in criterion 4); at 1023 and 1024 likewise for the navigation.
3. [e2e] The layout depends on window width only, never on the device: a window resized across 768 and 1024 (in both directions) changes layout live, loses no typed text in an open form, and leaves the open screen, tab, month and filter as they were.
4. [e2e] Tablet, 768 to 1023: single column, bottom navigation, content centred at most 42rem wide, no side navigation. Both orientations (768x1024 and 1024x768 minus a pixel, that is 1023x768) hold.
5. [e2e] Laptop and desktop, 1024 and up, at 1024, 1280 and 1440: side navigation on the left, no bottom navigation anywhere, content in the book at most 80rem wide, centred.
6. [e2e] Breakpoints follow rem: with the browser's root font size at 200% (32px) at 1280 wide, the app shows the tablet or phone layout it would show at 640 CSS px, with no overflow. Browser zoom to 200% at 1440 and 1280 wide does the same.

### App shell

7. [e2e] Side navigation (1024 and up): the same four links in the same order (Home, Students, Attendance, More), as a `<nav>` with the existing accessible name, the current one with `aria-current="page"` and the red mark, each at least 44px high and as wide as the column, labels wrapping and never cut (en, hi, kn, te, at 200% root font). It stays in view while the content scrolls.
8. [e2e] The cloth: at 1024 and up the cloth is the page ground with its dashed stitch outline inset, as in `Home-desktop`; the product name (from the brand constant) sits at the top of the side navigation; the book sits on the cloth with its 2px ink border and hard offset shadow. No blur, no gradient, corners 4px at most. Below 1024 the cloth appears only where it does today (screen headers).
9. [e2e] Language: the picker stays reachable from More (the language row, as today) at every width; there is no second picker in the shell. The public pages keep the picker where they have it today (criterion 27).
10. [e2e] Undo banner (and any `above` block): at 1024 and up it sits at the foot of the content pane, as wide as the content, not under the side navigation; below 1024 it sits above the bottom navigation as today. It does not cover the last row: the last row can always be scrolled fully into view.
11. [e2e] Loading, error, empty-home and all-paid states fit inside the same shell at every width: centred in the content pane, readable line length (no line of reading text longer than about 70 characters at 1440), nothing stretched edge to edge.

### Home and the dues board

12. [e2e] Home at 1024 and up shows two panes as in `Home-desktop`: left, the summary (month switcher, "Still to come in" amount, "from n of m students", the strip with its legend, the "collected" line, and the Remind all button when it has rows); right, the tabs with counts, the batch select, and the fees as a table with columns for number, student (name and the parent or batch line), status, reminded, amount and actions. On a phone and tablet it is the single column of today. The same data, the same words.
13. [e2e] What the canvas shows and is not built: the "To confirm" navigation item and the "Parents say paid" tile are not drawn (they belong to R1-10); "Remind all" and "Mark paid" appear only because R1-7 and R1-8 exist. Nothing in the layout shows a control that does nothing.
14. [e2e] The headline amount shrinks to fit its pane, from 72px upward as in the canvas up to the existing amount token cap; `₹10,00,00,000` fits the left pane at 1024 without cutting or overflow. Amounts keep 0-9 digits and Indian grouping; headline face for the headline amount, mono in rows.
15. [e2e] Table rows: the whole row is still one link to the student's edit screen on the name cell and the status and amount are in the same row; Remind and Mark paid stay buttons that are not inside that link (as today); a row is at least 66px high and grows with long names, long batch names, large text and Indic scripts; nothing is ellipsised. If a row's cells cannot fit at a width, the row stacks its cells (the tablet and phone row) rather than scrolling sideways.
16. [e2e] Tabs, month switcher and batch select behave exactly as on the phone (counts, remembered view, no request on tab change, disabled months drawn at 44px); the tab folder look is kept (selected tab taller and slip coloured, joined to the table).
17. [e2e] The strip draws one block per student at any width; at 1024 it uses the pane's width with no block under 8px and wraps past the count that fits.
18. [e2e] Status stays a word plus a mark on every row (Overdue, Due, Due today, Part paid, Paid), checked in forced grayscale at 1280.

### Other tutor screens

19. [e2e] Students list: at 1024 and up the rows use the width as a table (name with parent or phone line, batch, fee, due day, archived tag) with the batch filter above and "Add a student" at the top right; Archived list the same. Below 1024 the phone rows.
20. [e2e] Student new and edit, Batch edit, Setup profile and UPI: the form sits in one slip at most 40rem wide, centred in the content pane (setup: on the cloth ground), short fields (fee and due day; name and phone) may sit side by side from 768 up, the labels above the fields are unchanged, Save and the other buttons sit at the foot of the form, not stretched to the window width.
21. [e2e] Batches list and the batch detail: rows in one slip at most 48rem, Add a batch at the top right from 1024.
22. [e2e] Sheets (Mark paid, Remind again, Move students, Delete batch): below 768 a bottom sheet exactly as today; from 768 up a centred modal dialog, at most 32rem wide, with the dark sheet ground as the backdrop, the context header (batch, month, student) and the slip panel inside, scrolling inside itself when taller than the window. Focus moves in, Tab stays inside, Esc and the close control close it and return focus to what opened it, the page behind is inert. One open sheet at a time.
23. [e2e] Receipt screen (tutor's): receipt cards in one column at most 40rem wide, centred in the book, Back link at the top of the pane; the Undo this payment control and its confirm stay beside the card.
24. [e2e] Remind, one student: at 1024 and up the WhatsApp message preview is on the left and the actions (Open WhatsApp, skip, the count of the run, Not now) on the right, as the free reminder tool's canvas does; below 1024 the phone order (preview, then actions). Remind, pick list: one column at most 48rem; the "Remind N" action sits in a bar at the foot of the content pane, not stretched under the side navigation. Every tick row is a whole-row target, 44px or more.
25. [e2e] More: the profile slip, Edit link, language row and Sign out in one column at most 40rem under the cloth header; Sign out is not near the Edit link in a way that can be mis-tapped (at least 16px apart), as today.
26. [e2e] Sign-in and language picker: a single slip at most 28rem, centred on the cloth ground at 768 and up; at 360 as today.

### Public pages

27. [e2e] Landing and the free tools at 1024 and up use the canvases (`Landing`, `Tool-reminder`, `Tool-receipt`): content width at most 80rem; the landing hero in two columns (text left, the ledger card right); the tool page's form and message preview side by side; the header's links on one row, with the language picker where it is today; nothing stretched. At 768 to 1023 they are one column at most 42rem. Below 768, as today. Tool-receipt applies when that page is built; it does not exist in the app yet.
28. [e2e] No `max-w-2xl` or `max-w-md` is left wrapping a whole signed-in screen: the width limit comes from the one shell (criterion 5), so a later slice cannot forget it. [unit] a test fails if a new screen component outside the shell sets its own page-width class. (The 25 uses today are listed in the technical plan.)
29. [manual] `/r/{token}` (receipt) and `/p/{token}` (pay) do not exist yet. When R1-9 builds them they stay a single centred column at most 28rem on the page ground at every width; they are never stretched, and they have no side navigation. D1 does not build or test them (section 6); this criterion records the rule for R1-9.

### Keyboard, pointer and type

30. [e2e] Keyboard: from a fresh load at 1280 the Tab order is the visual order (side navigation, then the pane's controls left to right, top to bottom); every control reachable and operable by Tab, Enter and Space; Esc closes a dialog; Enter submits a form. Arrow keys on the tabs behave as they do today and are not regressed. No control exists only on hover or only under a hover menu; every hover style also appears on focus.
31. [e2e] Focus is always visible: the existing 3px blue ring offset 4px on paper, yellow on the cloth and on the dark sheet ground, on every control including the side navigation links and table cells that are links, at 1024, 1280 and 1440; the ring is never clipped by an overflow edge.
32. [e2e] Targets: every button, link, tab, select and tick row is at least 44px high and 44px wide at every width including 1440 (desktop does not shrink targets, since a touch laptop or a tablet in landscape counts). [e2e] Nothing is under 14px at any width, any language, any root font size.
33. [e2e] No sideways scroll at 320, 360, 768, 1024, 1280, 1440 and 1920 on every screen in section 8, in en, hi, kn and te, with the largest root font size (200%): `scrollWidth` equals `clientWidth` on the document and on the book. A table that cannot fit stacks (criterion 15).
34. [e2e] Large font: at 360 with the largest font (as the existing layout specs) and at 1280 with the root font at 200%, all labels wrap, none is cut, the primary action on each screen is still on the screen without scrolling sideways.
35. [e2e] Tokens: [unit] a test over the changed files finds no raw hex or rgb value, no arbitrary `text-[Npx]` under 14, no arbitrary pixel width; every colour, shadow and radius is a token. No new dependency (`package.json` is unchanged).
36. [e2e] Bundle: `pnpm size` limits are unchanged: initial JS for every route at most 200 KB gzipped; `home` at most its present 171.7 KB plus 1 KB; no other route grows by more than 1 KB. The layout is CSS only; the sheet becoming a dialog is CSS on the existing `<dialog>`; no resize listener, no `matchMedia` and no layout state in JS. [unit] a test finds no `matchMedia`, `innerWidth` or `ResizeObserver` in the layout files.
37. [unit] Every key is already in `messages/{en,hi,kn,te}.json`; `pnpm i18n:check` passes with no key added or changed. [e2e] The Android wrapper and the PWA install are unaffected: below 768 the screen is identical (criterion 1), and the web app manifest is unchanged.

## 5. Edge cases

- **Empty home, first run, no students:** the empty home sits in the shell on a wide screen, centred, at most 40rem; no two-pane board until students exist.
- **Offline:** the offline banner and the "Showing what was saved on this phone." line (R1-12) sit in the content pane header; the layout does not shift when they appear.
- **Slow network, loading:** the loading state is drawn in the shell; skeleton blocks take the final pane shapes (summary left, table right) at 1024 and up so nothing jumps when data arrives.
- **Very long names, 60-character batch names, 80-character names with no spaces:** wrap inside their cells; the table stacks before it scrolls sideways.
- **Largest font or 200% zoom:** the layout falls back to tablet or phone width through rem breakpoints (criteria 6, 34). It is not an error that a 1440px window zoomed to 200% shows the phone layout.
- **Second language:** Indic labels are longer; the side navigation is 15rem wide and wraps labels. Table headers wrap.
- **Partial payment:** the Part paid row and the amount remaining show in the table as on the phone.
- **Duplicates:** two rows for one student (two unpaid months) are two table rows with different due dates, as today.
- **Many rows:** 300 overdue rows render as today; the table header does not need to stay sticky (not built).
- **Window resized while a sheet is open:** the dialog switches between bottom sheet and centred modal without closing and without losing focus.
- **Browser back and forward, and a bookmark:** a screen opened directly at any width shows the right layout on first paint (no flash of the phone layout on a laptop). Static export, so this is a CSS requirement, not a JS one.
- **Tablet rotation:** portrait 768 and landscape 1024 are two different layouts; rotating keeps the open screen and its state.
- **A touch laptop at 1280:** touch targets are 44px, so the same layout works for touch and mouse.
- **Parent opening an old link:** parents are not in this slice. When `/r/` and `/p/` are built they keep the phone column (criterion 29).
- **Mouse wheel and trackpad:** only the content pane and the side navigation scroll independently if the page is taller than the window; the page itself must not trap scrolling in a nested scroller that is smaller than 120px high.
- **Scrollbar width:** a permanent scrollbar on Windows (about 17px) must not cause sideways scroll at 1024.

## 6. Out of scope

| Not here | Where |
| --- | --- |
| Print styles for receipts, reports or the board | Not planned; separate request |
| A separate desktop-only feature set (multi-select actions beyond what the phone has, bulk table editing, inline editing in the table, export from the table) | Not in the PRD; Export is a Release 2 or 3 item |
| Drag and drop, column sorting and resizing, search on the board | Not in the PRD |
| Keyboard shortcuts beyond Tab, Enter, Space, Esc and arrow keys on tabs | Not in the PRD |
| A list-and-detail pane (student detail beside the list) | After a real Student detail screen exists (unowned today) |
| A collapsed sticky header on scroll (`Home-scrolled`) | Not in Release 1 (R1-6 default 10) |
| The "To confirm" nav item and "Parents say paid" tile on the desktop board | R1-10 |
| `/p/{token}` and `/r/{token}` pages themselves | R1-9 (Part B); D1 records only the width rule (criterion 29) |
| The Free receipt maker tool page | R0 later slice; its desktop layout is the `Tool-receipt` canvas |
| Pro and Scale screens (Plans, Reports, Centre, Branding and so on) | Their own slices; they inherit the shell and the patterns in section 8 |
| Dark mode | Not in the design system |
| Skip-to-content link | Open question 5 |
| Changes to the Android wrapper or the manifest | None needed |
| Any new copy, dependency, migration, table, Edge Function or analytics event | Not allowed in this slice |

## 7. Copy changes

None. Every word on a wide screen is the word on the phone. If `tech-lead` finds a layout that needs a new word (for example a table column heading the phone does not show), stop and list it as a question. The table headings in `Home-desktop` (No., Student, Status, Reminded, Amount, Do) reuse existing keys where they exist; where one does not ("No." and "Do"), the default is to leave that column heading out rather than add a string (open question 6).

## 8. Screens and defaults ("Screens with no canvas")

Only two tutor screens have a desktop canvas: the dues board (`Home-desktop`) and, for the free tools, `Landing`, `Tool-reminder`, `Tool-receipt`. Every other tutor screen is drawn at 360 only. The defaults below follow `Home-desktop` and `docs/DESIGN.md` and are the proposal for the founder to accept or change. The rule behind all of them: **width goes to a second column only when there are two things to show; otherwise the content stays one readable column and is centred.**

Widths below are "at most"; every screen is full width below its limit.

| Screen (file) | Phone canvas | Proposed default at 1024 and up | At 768 to 1023 |
| --- | --- | --- | --- |
| Home, dues board (`Home-desktop`) | `Home` | Canvas: two panes, summary left, table right (criterion 12) | One column, 42rem; rows as phone rows with the Remind and Mark paid buttons on the row |
| Home, empty (`State-empty`) | yes | One slip, 40rem, centred in the book | Same |
| Home, loading and error (`State-loading`, `State-error`) | yes | Same two-pane skeleton, then the error banner centred, 40rem | One column |
| Home, all paid (`State-allpaid`) | yes | Stamp and "Nothing left to collect" in the left pane; tabs and table right | One column |
| Students list (`Students`) | yes | One slip at most 64rem: a table with name and parent or phone, batch, fee and due day; filter above; Add a student top right; Archived list below, same table | 42rem rows |
| Add and edit student (`Add-student`) | yes | One slip, 40rem; fee and due day side by side; Save at the foot | One slip, 36rem |
| Batches list and Batch detail (`Batch`) | yes | One slip, 48rem; students in the batch as a list; Move and Delete as buttons at the foot | 42rem |
| Mark paid (`Pay-sheet`) | yes | Centred modal, 32rem (criterion 22) | Same modal |
| Remind again, Move students, Delete batch sheets | no | Centred modal, 32rem | Same modal |
| Remind, one student (`Remind`, single) | pick list only | Two columns: message preview left, actions right (criterion 24) | One column |
| Remind, bulk pick list (`Remind`) | yes | One slip, 48rem; "Remind N" bar at the foot of the pane | 42rem |
| Tutor receipt screen (`Receipt`) | the parent's receipt only | One column of cards, 40rem; Undo beside the card | 42rem |
| More (`More`) | yes | One column, 40rem, profile slip on the cloth header | 42rem |
| Attendance placeholder (`Attendance`) | yes | One slip, 40rem with the one line; the real screen is R1-11 and is drawn then | Same |
| Setup profile, Setup UPI (`Setup-profile`, `Setup-upi`) | yes | One slip, 36rem, on the cloth ground, step header above, no side navigation | 36rem |
| Setup add students (`Setup-add`, `Paste-list`, `Csv-map`) | yes | Not built yet; same one slip, 40rem | Same |
| Sign-in (`Signin`) and auth callback | yes | One slip, 28rem, centred on the cloth ground | Same |
| Language picker (`Language`) | yes | One slip, 28rem, centred; the list stays one column | Same |
| Not-found | no | Existing page, centred, 42rem | Same |
| Undo banner (`State-undo`) | yes | Foot of the content pane, content width | Above the bottom navigation |
| Later screens (Claims, Student detail, Reports, Plans, Auto-reminders and so on) | yes | Each slice picks from the same patterns: one column, two columns, table or modal; add a desktop canvas only if none fits | Same |

Setup, sign-in, language, callback and not-found are before the book exists (no side navigation); they sit on the cloth ground alone.

Not a decision here and not shown: a design for a student detail pane. That needs the Student detail screen first.

## 9. Design references

From `design/project/canvas.json`:

- `Home-desktop.dc.html` ("Dues board on desktop", 1440x900): the two panes, the top navigation, the table, the cloth ground. Shows: a summary pane (month, amount, strip, Collected, Parents say paid, Remind all) and a table pane (tabs, batch select, six columns). Does not show: any other screen, a sheet, a side navigation (it uses top folder tabs; default 3), a list-and-detail, the loading, empty, error, offline or all-paid state, a width below about 900, or the 768 to 1023 range.
- `Landing.dc.html` (1440x3700), `Tool-reminder.dc.html` (1440x1160), `Tool-receipt.dc.html` (1440x1160): public pages at 1280 max width; two columns that wrap at about 940. Phone variants `Landing-m` and `Tool-reminder-m`.
- Phone canvases for every other screen (listed in section 8) for words, order and component details.
- `Nav.dc.html`, `Interaction.dc.html`, `Main.dc.html`, `Type-indic.dc.html`: nav, focus ring, press, Indic rules (unchanged).
- `docs/DESIGN.md`: tokens and rules; no change proposed. If section 8 is accepted, the document gains one short "Wide screens" section (breakpoints, shell, modal) through the normal design-change route; no canvas file is edited in this slice.

## 10. Analytics

None. No PRD section 4 event fires from a layout. No viewport width, device type or "desktop" flag is sent anywhere (no new device data; privacy rules unchanged). Existing events (`reminder_sent`, `payment_marked`) fire exactly as on the phone, once per action.

## 11. Test by hand

On the staging-backed build, signed in with Google, at least five students (two overdue, one with a long name, one in Hindi).

1. Laptop at 1280 wide and again 1440: Home shows the side navigation on the left, the summary left and the table right on the cloth with the stitch. Click through Home, Students, Attendance, More with the mouse, then with Tab and Enter only.
2. Tab through the board from the top: the order is navigation, month arrows, tabs, batch select, then the rows' buttons. The ring is visible on every stop.
3. Click Mark paid on a row: a centred dialog appears. Press Esc: it closes and focus returns to the button. Open it again, Tab around, it does not leave the dialog. Mark paid; the banner appears at the foot of the content, not under the navigation; Undo works.
4. Remind one overdue student, then Remind all: preview and actions side by side for one; a single list and a bar at the foot for the bulk.
5. Students: the table; add a student; edit one; the form is not stretched.
6. Browser zoom to 200% at 1440: the phone layout appears, nothing overflows sideways. Zoom back to 100%.
7. Drag the window from 1440 to 360 slowly: the layout changes at 1024 and at 768, an open form keeps what you typed, no sideways scrollbar at any width.
8. Tablet, portrait (768 wide) and landscape (1024): bottom navigation in portrait, side navigation in landscape; sheets are dialogs; every target comfortable to hit with a finger.
9. Switch to Hindi, Kannada and Telugu at 1280: labels wrap, nothing cut, amounts keep 0-9 digits.
10. Set the browser's text size to Very large (or root 200%) at 1280: the roomier layout falls back, nothing overflows.
11. Landing and the Reminder tool on the laptop: two columns, the content not stretched; language picker still found.
12. Phone, 360 wide, normal and largest font: nothing looks different from before this slice.

## 12. Open questions (each with a default; nothing blocks)

1. **Left side navigation (default) or the canvas's top folder-tab navigation?** The canvas `Home-desktop` draws top tabs; the founder's brief asked for a side navigation. Default: side navigation at 1024 and up. Say if you prefer the canvas, and `tech-lead` swaps the nav only.
2. **Is a centred modal right for the Mark paid sheet on a laptop, or a right-hand side panel?** Default: centred modal, from 768 up (default 7).
3. **Cap the book at 1280px, or let it fill a 1920 screen like the canvas does?** Default: cap at 80rem and show cloth either side (the canvas fills the window, the landing caps at 1280).
4. **Table for Students at desktop, or keep phone rows?** Default: table at 1024 and up (criterion 19), phone rows below. Cheap to drop.
5. **Skip-to-content link?** Default: none (adds one string; the navigation is four links).
6. **Canvas table headings "No." and "Do" have no words in the app today.** Default: omit both columns' headings (the column keeps its content and gets an accessible name from existing keys); add strings only if you want them.
7. **Is the cloth ground the whole window background on wide screens (as in the canvas), or only a frame around the book?** Default: whole window, as in the canvas.
8. **Should the 449 to 767 band stay a 448px centred column?** Default: yes, unchanged, so the phone is untouched.
9. **Wide screens for the parent pages (`/p/`, `/r/`) when R1-9 builds them?** Default: single centred 28rem column (criterion 29); revisit if parents use laptops.
10. **After D1, should `docs/DESIGN.md` gain a "Wide screens" section, and should the canvas get desktop artboards for the screens in section 8?** Default: yes to DESIGN.md at merge; canvas artboards only for the screens you change your mind on.
11. **Split?** This slice is large (shell plus eleven screen families). Default proposal to ship in three parts, each releasable alone and phone-safe: D1a the shell (side navigation, book width, dialog sheets, public page widths, criteria 1 to 11, 22, 26 to 28, 30 to 37); D1b the board two-pane table (12 to 18); D1c the other screens (19 to 21, 23 to 25). Criteria 30 to 37 are checked at the end of each part.

## 13. Hand-off

To `tech-lead`: write the technical plan, appended to this file. Things to settle first: whether the breakpoints, shell and dialog placement can be done with CSS and the existing `<dialog>` only (criteria 22 and 36); how the 25 `max-w-*` uses move into one shell; the split in open question 11; the size of the table row against the 66px and no-sideways-scroll rules (criteria 15 and 33); the extra Playwright projects and how the phone project stays untouched (criterion 1).

## Founder answers, 2026-10-12

Q1 left side navigation (not the canvas's top tabs). Q2 centred modal for sheets. Q3 book capped at 80rem, centred on a cloth ground. Q4 a table for Students at 1024 and up. Every other default in section 12 stands (Q11: three PRs).

## Technical plan, D1

### Approach

CSS only, one DOM. Tailwind's default screens already apply here (`tokens.css` resets only colours, radii, shadows, blur and sub-14px text; it does not reset `--breakpoint-*` or `--container-*`), so `md:` is 48rem (768px) and `lg:` is 64rem (1024px), both in rem, and `max-w-7xl` is 80rem. No new token and no raw value: use `md:`, `lg:`, `max-w-7xl`, and the existing `max-w-2xl`, `max-w-xl`, `max-w-md` utilities. The shell (`AppScreen`) becomes a CSS grid whose areas change at `lg:`; the `<dialog>` in `Sheet` gets `md:` classes that turn it from a full-window bottom sheet into a centred modal; the board and Students list get a table layout at `lg:` and keep today's markup below it. First paint is right because it is plain CSS in a static page. Backend: none. No migration, no Edge Function, no pgTAP, no new key, no dependency.

### Files

D1a (shell, dialogs, public widths)
- `src/components/app/app-screen.tsx`: the one place for page width. Outer `min-h-dvh bg-page` below `lg`; from `lg:` the outer is `bg-cloth` (the cloth ground, with the dashed stitch as an inset pseudo-element or border using existing `stitch` token) and the inner "book" is `lg:mx-auto lg:max-w-7xl lg:grid lg:grid-cols-[15rem_1fr] lg:border-2 lg:border-ink lg:shadow-<existing hard shadow token> bg-page`. Below `lg:` the column is `mx-auto w-full max-w-md` (phone, 449 to 767 unchanged) and `md:max-w-2xl` for tablet (42rem). The 15rem column width is an arbitrary value: use a spacing token added once in `tokens.css` (`--spacing-sidenav: 15rem`), not `lg:grid-cols-[15rem_1fr]` (criterion 35 forbids arbitrary pixel widths; rem arbitrary values are also avoided, so define the token).
- - Nav switch, one DOM, no JS: the pinned wrapper (`data-sticky-nav`) stays `sticky bottom-0 z-10` below `lg` and becomes `lg:contents`. Its children are placed by grid area at `lg:`: `above` (undo banner) in the content column, `lg:sticky lg:bottom-0`; the `<nav>` in column 1, `lg:sticky lg:top-0 lg:h-dvh`. Sticky is set on the children, because `display: contents` removes the wrapper's own box. DOM order: the wrapper comes BEFORE `<main>` (so Tab order is nav then content on desktop, criterion 30) and below `lg` is drawn last with `order-last` on a flex column. Consequence: on a phone, keyboard Tab order becomes nav before content (no visible change; touch users do not Tab). If an existing phone test depends on that order, stop and report; do not edit the test (open question 2).
- Duplicate nav and the tests that count nav links: there is exactly one `<nav aria-label>` element, restyled, so nothing is duplicated in the accessibility tree and `getByRole("navigation", { name: "Main" }).getByRole("link", …)` in `board.spec.ts`, `batches.spec.ts`, `more.spec.ts`, `app-guard.spec.ts` still resolves to one element. Do not render a second nav hidden with `display:none` (Playwright would ignore it, but unit tests with jsdom, which has no CSS, would see two and fail).
- `src/components/ui/bottom-nav.tsx`: add `lg:` variants only: `lg:flex lg:flex-col lg:items-stretch lg:border-t-0 lg:border-r-2 lg:pb-0 lg:bg-slip`; the item link gets `lg:flex-row lg:justify-start lg:gap-3 lg:border-t-0 lg:border-l-5 lg:px-4 lg:text-left` (the red bar moves from top to left; still a mark, not colour). The product name at the top of the side nav comes from `src/config/brand.ts` through a small `lg:block hidden` element inside the nav wrapper, outside the `<nav>` so the link count stays four. Update `bottom-nav.test.tsx` only by adding assertions; the phone classes stay.
- `src/components/ui/sheet.tsx`: `<dialog>` className becomes: unchanged below `md`; from `md:` `md:inset-auto md:m-auto md:h-auto md:max-h-[...]` expressed with tokens (`md:max-h-dvh` is not enough; use `md:max-h-9/10` is not a Tailwind utility, so use `md:my-8` with `md:max-h-[calc(100dvh-4rem)]`; a calc in rem is allowed, it is not a pixel) and `md:w-full md:max-w-lg` (32rem), `md:border-2 md:border-ink md:shadow-<token>`, `md:backdrop:bg-sheet-ground`. `SheetFrame` already scrolls inside itself; at `md:` change `justify-end` to `md:justify-start`. Focus trap, Esc, focus return, inert page and scroll lock are native to `showModal()` and `states.css` (`html:has(dialog:modal)`), unchanged and not re-implemented. Resizing across 768 with the dialog open needs nothing: the same open dialog is restyled.
- Undo banner: no new code; it is `above`, covered by the shell grid.
- `src/app/[locale]/(app)` and `src/components/*` screens: remove the 25 page-width wrappers from signed-in screens (list below); the shell owns width. Public pages keep their own width classes (they are outside the shell) but move to `max-w-7xl` at `lg:` and `max-w-2xl` at `md:`.
- `src/components/auth/*`, `setup/*`, `language`, `global-not-found.tsx`, `callback-screen`: a small `CenteredCard` pattern is NOT added; they keep `max-w-md` (28rem) and sit on `lg:bg-cloth`/`md:` cloth ground through the root layout's body class only if no shell wraps them. Keep it to a `<main className="mx-auto w-full max-w-md md:my-12 …">`. These are the allowed exceptions to criterion 28's unit test: the test (see below) scans only components rendered inside `AppScreen`.
- `src/components/landing/*`, `src/components/tools/tool-header.tsx`, `src/app/[locale]/tools/fee-reminder/page.tsx`: widths and the hero two-column at `lg:`. Only classes change. `/r/{token}` is built on PR #18 (not on main): do nothing for it here; criterion 29 stays a rule for R1-9 (its shell must not use `AppScreen`).
- `src/styles/tokens.css`: add `--spacing-sidenav` (15rem) and, only if no existing hard-shadow token fits the book, none (reuse the existing offset shadow token; check `shadow-*` in tokens before adding).
- `playwright.config.ts`: new projects (below). The existing `phone` project object is not edited.
- `e2e/wide-helpers.ts` (new), `e2e/wide-shell.spec.ts` (new), `src/components/app/layout-rules.test.ts` (new, unit).
- `docs/DESIGN.md`: add the "Wide screens" section at the end of D1a's PR.

D1b (board, Home)
- `src/components/board/board-screen.tsx`: wrap summary (month switcher, hero amount, strip, collected line, Remind all) in `<section class="lg:col-span…">` and the tabs, batch select and list in a second section; `lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]` expressed with existing fraction utilities (`lg:grid-cols-5` with `lg:col-span-2` and `lg:col-span-3`, no arbitrary values). Same DOM order as the phone (summary, then list), which equals the visual order, so Tab order is right.
- `src/components/board/board-list.tsx` and `due-row.tsx`: see "Tables" below.
- `src/components/board/hero-amount.tsx`: the existing shrink-to-fit logic must be checked first (read it before touching; if it is JS-measured, leave it and only check `₹10,00,00,000` at 1024 in the left pane, which is about 28rem; the plan expects it to fit because the pane is wider than the phone's 448px minus padding. If it does not fit, fix inside hero-amount with a container query `@container` on its wrapper, not a resize listener).
- `src/components/board/board-states.tsx`, `home/empty-home.tsx`, `app/loading-book.tsx`: skeleton in two panes at `lg:`; empty and error centred `lg:max-w-xl lg:mx-auto`.

D1c (other tutor screens)
- `src/components/students/*` (Students list, student form, archived list), `batches/*` (list, screen, form), `setup/*` forms (`profile-form.tsx`, `upi-form.tsx` already have `max-w`), `remind/*` (single: `lg:grid lg:grid-cols-2` preview left, actions right; pick list: foot bar `sticky bottom-0` inside the content pane), `pay/*` receipt screen, `more/*`, `attendance-placeholder.tsx`: class changes only; each form wrapper `mx-auto w-full max-w-xl`; two-field rows `md:grid md:grid-cols-2`. Students table as below.
- `e2e/wide-screens.spec.ts` (new).

### Tables (criteria 15 and 19)

Board (D1b): keep the existing row markup (one link on the name cell, buttons outside it) so row behaviour, tests and a11y are untouched. At `lg:` the row's container becomes `grid` with column template from existing utilities. Decision: a CSS grid on the same rows, not a native `<table>`, with a column header row built from existing keys (Student, Status, Reminded, Amount; "No." and "Do" omitted, Q6 default). Reason: a native `<table>` forces `display: table-row` and would break the "row is one link plus two buttons that are not inside it" structure and the stacking fallback; a CSS grid on a list keeps one DOM for phone and desktop. The header row is `hidden lg:grid` and `aria-hidden="true"` (each cell already carries its own words: status word, amount). Frontend-dev: confirm that; if a cell is unclear without the header, drop the header row.
Stacking: use a container query on the list pane (`@container` on the pane, `@3xl:` or the nearest default container token) rather than `lg:` for the grid, so a 1024 window with a narrow pane or large font stacks the row instead of scrolling sideways. Tailwind v4 has container queries built in (no plugin); container widths are rem (`--container-3xl` 48rem).
Students (D1c): Same approach, same data. One `<ul>` of rows, `@container` grid, no sort, whole row a link to edit as today, keyboard identical (one tab stop per row). No `<table>` for the same reason; this satisfies "a table" visually. If the founder wants a real `<table>` for screen-reader column navigation, that is a follow-up (open question below).

### Data

None. No tables, columns, RLS, functions or Edge Functions. No backend-dev task. Edge Function and RLS tests are unchanged.

### Work split

All `frontend-dev`. Nothing for `backend-dev`.

D1a
1. Add `--spacing-sidenav` to `tokens.css` if needed; extend `bottom-nav.tsx` with `lg:` classes; unit test additions.
2. Rewrite `app-screen.tsx` to the grid shell (nav first in DOM, `order-last` below `lg`, `lg:contents` wrapper). Remove page-width wrappers from signed-in screens. Run the whole existing phone e2e locally; zero assertion edits.
3. `sheet.tsx` `md:` modal classes; check Esc, focus return, Tab trap, resize with open dialog.
4. Auth, setup, language, callback, not-found, landing, tools widths.
5. Playwright wide projects and `wide-shell.spec.ts`; `layout-rules.test.ts`; size and i18n checks; screenshots; `docs/DESIGN.md`.
D1b
6. Two-pane board, skeleton, hero fit, row grid with container query, header row decision.
7. `wide-board.spec.ts` and grayscale status check; size check.
D1c
8. Students table, forms, batches, remind (two columns, foot bar), receipt, more, attendance.
9. `wide-screens.spec.ts`; the 320 to 1920 overflow sweep over all screens.

### Tests required

- Unit (Vitest, `layout-rules.test.ts`): no `matchMedia`, `innerWidth`, `ResizeObserver` in `src/components/app`, `ui/sheet.tsx`, `ui/bottom-nav.tsx`, `board`, `students` (criterion 36); no signed-in screen component sets `max-w-*` page width outside `app-screen.tsx` (criterion 28; scans files rendered inside `AppScreen`, with a short allow-list of the pre-shell and public screens); the changed-file scan for raw hex, `text-[Npx]` under 14 and arbitrary pixel widths (criterion 35; extend the existing `check-tokens` script rather than a new one if it already scans classes); `bottom-nav.test.tsx` still finds four links and one `nav`.
- Playwright: **no new projects and no config change.** Wide specs run inside the existing `phone` project and call `page.setViewportSize` through a helper `setWidth(page, 1280)` in `e2e/wide-helpers.ts` (touch emulation stays on; that is harmless for layout, and the 44px-target rule is the same). This keeps the phone project object untouched (criterion 1) and avoids multiplying the suite. Criterion 4's "extra projects" wording is met in intent; see open question 3.
- Targeted set to protect the 45-minute cap (CI is about 29 minutes): the wide specs sample, they do not repeat the phone suite. Per screen group, one test, one viewport matrix (1024, 1280, 1440 in `en`; hi/kn/te only for the nav, Home and Students; 320 to 1920 overflow sweep as ONE test per screen that loops widths inside a single page load using `setViewportSize`, not one test per width). Budget: at most 40 new tests, each under 10 seconds, at most 5 extra minutes in CI. If CI goes past 34 minutes, frontend-dev stops and reports.
- Mapping: criteria 2 to 11 in `wide-shell.spec.ts` (boundaries at 767/768 and 1023/1024; criterion 22 through the Mark paid dialog: Esc, focus return, Tab stays inside, resize while open); 12 to 18 in `wide-board.spec.ts` (with a forced-grayscale status check); 19 to 21 and 23 to 26 in `wide-screens.spec.ts`; 27 in `wide-public.spec.ts`; 30 and 31 Tab order and focus ring at 1280; 32 target sizes by iterating `a, button, select, [role=tab]`; 33 overflow as above; 34 and 6 root font 200% by `addStyleTag` setting `html { font-size: 200% }`, which moves rem and so the rem breakpoints exactly as the browser setting does. Browser page zoom 200% is the same as halving the CSS viewport, so test it by setting 640 wide at 1280 and 720 at 1440, with a comment saying so. Criterion 36 by `pnpm size`; 37 by `pnpm i18n:check` and an unchanged manifest; criterion 1 by the existing suite, unedited.
- Not tested: criterion 29 (manual rule for R1-9).

### Visual verification

The founder's Chrome extension is not connected. `test-engineer` or `frontend-dev` writes a throwaway script in the scratchpad (not the repo) that opens the built `out/` with headless Playwright and saves PNGs of Home, Students, Mark paid dialog, More, Remind, Landing at 768, 1024, 1280, 1440 and 1920 in en and hi; the agent reads them (image Read) against `Home-desktop` and notes differences in the PR description. The PNGs are not committed.

### Risks and traps

- Bundle: home is 171.7 KB gzipped, allowed +1 KB. CSS-only means JS should not move; `size.mjs` counts JS only. Tailwind CSS grows by some KB, which `size.mjs` ignores, but keep the new classes few and watch the CSS file (target under +6 KB gzipped).
- Tab order: see the shell note above; nav first in DOM changes phone keyboard order. Alternatively keep the phone DOM order and, at `lg:`, accept nav last in Tab order; the founder-facing criterion 30 says nav first, so nav-first is the plan.
- `sticky` inside `grid` and `lg:contents`: `display: contents` on the sticky wrapper removes its box, so `sticky` on the children must be set on the children themselves (done above). Test that the nav stays in view while the content scrolls and that the undo banner does not cover the last row: `html:has([data-sticky-nav]) scroll-padding-bottom: 8rem` in `globals.css` keeps working on the phone; at `lg:` reset it to the banner's height.
- Native `<dialog>` positioning: Tailwind preflight sets `margin: 0` on dialog and the UA sets `inset: 0` and `max-width/height: calc(100% - 6px - 2em)`; the current classes override with `max-w-none max-h-none`. The `md:` classes must undo all of these explicitly (`md:max-w-lg md:max-h-...`), or the modal sticks to the top-left. Test at 768 and 1280.
- Scroll lock: `html:has(dialog:modal)` stays. With a permanent scrollbar on Windows, hiding overflow shifts the layout by 17px; add `scrollbar-gutter: stable` on `html` at `lg:` only if the screenshots show a jump.
- Scrollbar width and sideways scroll at 1024: `100vw` is never used; the shell is `w-full`.
- Collisions: PR #12 (receipt maker) and PR #18 (public receipt) are open and touch `messages/*.json`, `scripts/size.mjs`. D1 adds no key and does not touch `size.mjs` (no new route), so there is no conflict there. D1a does edit `landing/*` and `tools/*`; if #12 lands first and adds a tool page, D1a's width classes apply to it by the same rule (rebase, do not duplicate). `/r/[token]` from #18 must not be wrapped in `AppScreen`; add a one-line note to #18's author through the spec's criterion 29. Rebase before each D1 PR.
- Existing component tests in jsdom do not apply CSS, so they cannot catch layout; the Playwright tests are the guard.
- Unit test `no-strings.test.ts` and the token check scan class strings: the `calc()` in `md:max-h-[...]` may trip the arbitrary-value rule; if it does, add one token `--spacing-modal-max: calc(100dvh - 4rem)` in `tokens.css` and use `md:max-h-modal-max`.
- The cloth ground with the stitch outline: the canvas stitch is dashed with the `stitch` token; draw with `outline`/`border-dashed` on a pseudo-element using existing tokens; no gradient, no blur.
- Resize while a form is open loses nothing because nothing remounts (no JS branch on width). Keep it so: never render two versions of a screen.

### Not doing

A real `<table>` element for the board and Students (list rows in a grid instead, see above), sticky table header, sorting, a skip link, a "Wide screens" canvas artboard, `/r` and `/p` pages, the "To confirm" item, any new string, any new project or device matrix beyond the helper, a second language picker, and any JS that reads the window width.

### Open questions

1. Students and the board use a CSS grid on list rows, not a native `<table>`. If the founder wants screen-reader column navigation, a native table is a follow-up that costs the stacking fallback. Default: grid.
2. Phone Tab order for keyboard users changes (nav before content) because the side nav must come first on desktop in one DOM. No visible change on a phone. Default: accept.
3. The criterion text says "extra Playwright projects"; this plan uses a viewport helper in the existing phone project to keep CI time. Default: helper.

### Page-width wrappers to move (25 uses, `max-w-md` or `max-w-2xl`)

Signed-in, move into `app-screen.tsx`: `src/components/app/app-screen.tsx`, `src/components/app/loading-book.tsx`, `src/components/setup/profile-form.tsx`, `src/components/setup/upi-form.tsx` (setup is pre-book; they keep their own 28 to 36rem column on the cloth ground, not the shell). Pre-shell or public, keep their own: `src/app/[locale]/sign-in/page.tsx`, `auth/callback/page.tsx`, `language/page.tsx`, `src/app/global-not-found.tsx`, `src/app/(jump)/page.tsx`, and the landing, tools and tool-header files, which get `lg:max-w-7xl`. `src/app/dev/*` is untouched. The rest of the 25 are inside these files; frontend-dev runs `grep -rn "max-w-\(md\|2xl\)" src` and walks the list.

### Order and hand-off

`frontend-dev` starts with task 1 then 2 (D1a, branch `d1a-shell`; the first D1 PR commits this spec file). `backend-dev` is not needed.

### Phone checklist for the founder (add to the PR)

Section 11 of this spec, items 1 to 12, split: D1a items 1 to 3, 6 to 8, 10 to 12; D1b items 1, 2, 4 (single), 9; D1c items 4 (bulk), 5.
