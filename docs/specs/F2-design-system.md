# F2 — Design system in code

## Goal
The "Bahi-khata" look exists in code: tokens, self-hosted fonts for four scripts, and all thirteen components from `docs/DESIGN.md` with their states, shown together on one page, `/dev/components`. After this slice a screen can be built from parts instead of one-off styles, and the founder can check the look, the Indian scripts and the ₹ sign on a real phone.

Size: the build plan sized this slice M for eight components. With thirteen it is L. See "Split" under Open questions.

## Users and moment
- **Now:** the founder (checking the look on a phone), `frontend-dev` (building R0 and R1 screens from these parts), `test-engineer` (one page to test every state).
- **Later, through every screen:** the tutor on a low-end Android between classes, and the parent arriving from WhatsApp. Nothing in F2 is reachable by them yet.

## Acceptance criteria

Each criterion is marked with how it is proved: **[unit]** Vitest, **[e2e]** Playwright at 360px wide against `/dev/components`, **[manual]** a named check in "Test by hand on a phone".

### Tokens
1. Every colour in the `docs/DESIGN.md` colour table exists as a Tailwind token with the same name and hex value (17 tokens, `cloth` to `bubble`). [unit]
2. No file under `src/components/` or `src/app/` contains a raw hex colour or an arbitrary pixel font size; the check fails the build or lint when one is added. [unit]
3. Type roles exist as tokens: headline/amount (Bricolage Grotesque 800, letter-spacing -0.04em, line-height 0.9–0.95), reading text (Bricolage 400–700, 15–18px, line-height 1.4), label (DM Mono 400–500, 14px, uppercase, letter-spacing 0.04em). [unit]
4. The smallest font-size token is 14px. On `/dev/components` no rendered text has a computed font size below 14px. [e2e]
5. Radius tokens are limited to 0, 4px, 6px (top corners of index tabs only) and full circle (stamps, round button). No other radius is available. [unit]
6. Shadow tokens are solid offsets with zero blur: button `5px 5px 0 ink`, record button `5px 5px 0 ink-label`, slip `6px 6px 0 ink`, and `cloth-deep` as the shadow colour on cloth. No token or component has a blurred shadow or a gradient. [unit]
7. Size tokens exist for the minimums the docs set: tap target 44px, button height 48px, ledger row 64px. Spacing otherwise uses the Tailwind default scale (see Open question 9). [unit]
8. Every text and background pair used by the thirteen components passes WCAG AA (4.5:1 for text, 3:1 for the focus ring and for outlines that carry meaning). If a pair fails, it is reported, not fixed by changing a token. [unit]

### Fonts
9. Bricolage Grotesque, DM Mono, Anek Devanagari, Anek Kannada and Anek Telugu are served from our own origin. Loading any page makes no request to a third-party font host. [e2e]
10. Fonts are subset at build time. `tech-lead` records each file's size in this spec once measured (see Open question 10). [manual: read the recorded sizes]
    - **Measured on the F2a build:** 14 font files, 730,604 bytes in all.
    - Preloaded on the home page: 59,976 bytes (Bricolage Grotesque latin 41,236 and latin-ext 18,740).
    - DM Mono 500: latin 8,724 and latin-ext 5,700. Not preloaded.
    - Anek Devanagari: 257,340 + 45,388 + 2,936 = 305,664.
    - Anek Kannada: 113,420 + 39,608 + 2,920 = 155,948.
    - Anek Telugu: 139,724 + 43,400 + 2,816 = 185,940.
    - The remaining 8,652 bytes match the Bricolage Grotesque Vietnamese file in the technical plan's table, which no page is expected to request.
    - No ceiling is set yet (Open question 10).
11. The home page (English) requests no Hindi, Kannada or Telugu font file. An Indian-script font file is requested only when text in that script is on the page. [e2e]
12. Text shows straight away in a fallback face and swaps when the font arrives; nothing is invisible while a font loads on a throttled connection. Every web font is declared `swap`. The one generated local fallback face is exempt: it is not downloaded, so it has nothing to wait for. [e2e]
13. Inside an element marked `lang="hi"`, `lang="kn"` or `lang="te"`: the face is the matching Anek font, letter-spacing is 0 on all text except amounts (which keep -0.04em under criterion 14), nothing is uppercased, headlines are weight 700 with line-height ≥1.25, reading text is 17px at line-height 1.6, and small labels are Anek 600 at 15px. [e2e, computed styles]
14. An amount keeps the headline face (Bricolage Grotesque, -0.04em, digits 0–9) when it sits inside Hindi, Kannada or Telugu text. [e2e, computed styles]
15. Font stacks end in `'Anek Latin', system-ui`, as `docs/DESIGN.md` says, so a missing ₹ falls back cleanly. [unit]
16. The ₹ sign and the digits 0–9 render correctly at headline size (about 68px), at reading size and in a ledger row, on a real Android phone. The result, and which face actually drew the ₹, is written into this spec. [manual: check H3]

### Button
17. Three variants and no others: `send` (fill `blue`, text `slip`, shadow `ink`), `record` (fill `ink`, text `slip`, shadow `ink-label`), `outline` (fill `slip`, text `ink`, shadow `ink`). All have a 2px `ink` border and 4px corners. There is no red variant. [unit + e2e]
18. Height is at least 48px. A label that does not fit on one line wraps and the button grows taller; it is never cut off and never shrinks its text. [e2e]
19. A button can carry an icon before or after its label, and can render as a link with the same look (the canvas uses both). [unit]
20. Pressed: the shadow disappears at once and the button moves into its place (5px right and down). Only the move takes 80ms. [e2e]
21. Keyboard focus: a 3px ring, 4px away from the edge, `blue` on `page` and `slip` grounds and yellow on cloth, blue and dark grounds. The ring shows on keyboard focus, not on tap. Tested in F2a on `page`, `slip`, cloth and the dark ground. The blue-ground case has nothing to be tested on: neither F2a nor the Direction A canvas has a surface with a blue ground. The rule stands, and the first slice that puts a focusable control on a blue ground adds the test. [e2e]
22. Busy: the button stays in the pressed position, shows the busy label it was given, sets `aria-busy`, shows no spinner, and ignores further taps. [unit + e2e]
23. Disabled: 2px dashed `ink-label` outline, no fill, no shadow, text `ink-soft`, does not respond to tap or keyboard. An optional line of text beneath says why, and is tied to the button for screen readers. [unit + e2e]
24. A round icon-only form exists for the row action: 48px circle, `send` colours, 3px shadow. It cannot be rendered without an accessible name. [unit]
25. On a cloth ground the shadow colour is `cloth-deep`. [e2e]

### Field
The field as built is a one-line field that wraps: it holds one line of meaning, but a value too long for the width continues on the next line so the tutor can see all of it.

26. A visible label sits above the input and is programmatically tied to it. The value is written on a 2px `ink` line with no box. The field is at least 48px tall. A long value (a long UPI ID, a long name) wraps and the field grows; it is never cut off or scrolled out of view sideways. Enter never adds a line: it submits the form the field is in. Line breaks in pasted text become spaces. [unit + e2e]
27. Empty: 2px `ink` line, placeholder in `ink-label`. [e2e]
28. Typing (focused): 4px `blue` line, label and value in `blue`. [e2e]
29. Correct: `stamp` green line, a tick mark beside the value, and an optional message beneath. The tick stays beside the value when the value wraps. The tick is not the only signal for a screen reader. [unit + e2e]
30. Needs fixing: 3px `cloth` line, an error mark beside the value, the label in `cloth` with the words it was given for "needs fixing", and a message beneath that says how to fix it. The mark stays beside the value when the value wraps. The input is marked invalid and tied to the message. [unit + e2e]
31. The field's outer height and the position of everything below it do not change between the four states, for a value that fits on one line and a message that fits on one line. A wrapped value or a wrapped message makes the field taller; that is intended. [e2e]
32. One line of text beneath, 14px or larger: the state's message when there is one, otherwise the helper text, never both. A long label, helper or message wraps. [e2e]

### Slip
33. `slip` surface, 2px `ink` border, square corners, `6px 6px 0 ink` shadow. [e2e]
34. A joined form exists for sitting under index tabs: no shadow, and no line between the selected tab and the slip. [e2e]
35. A slip at full width on a 360px screen, shadow included, causes no sideways scroll. [e2e]

### Row
36. A ledger row is at least 64px tall, with a 1px `rule` divider below: name and a meta line on the left, an optional amount on the right, and an optional trailing item (round action button, small stamp, or status tag). [unit + e2e]
37. The meta line takes a tone: overdue (`cloth`), due (`ink-soft`), paid (`stamp`). The tone never carries meaning by itself; the meta text always says it in words. [unit]
38. The name and meta wrap and the row grows. Neither is truncated. A word too long for the space may break in the middle. The amount and the trailing item never shrink or wrap. [e2e]
39. When the row is a link and also has an action, they are two separate targets, each at least 44px tall, and each reachable by keyboard. [e2e]
40. The row amount is set in DM Mono in every language, including inside Hindi, Kannada and Telugu rows, with digits 0–9. Headline amounts stay in Bricolage Grotesque (criterion 14). [e2e]
94. (Added after the F2a build; numbered 94 so earlier numbers do not move.) A row does not carry both an amount and a status tag. Together they squeeze the name into a narrow column at large font sizes, and no canvas screen combines them: the dues board rows have an amount and an action or stamp, the students list rows have a tag and no amount. A screen that needs both puts the status in the meta line as words. `Row` takes an amount or a `tag`, never both, by type; a `StatusTag` passed as the trailing item beside an amount logs an error in development. [unit]

### StatusTag
41. Four statuses and no others: Overdue (2px solid `cloth` outline, `cloth` text), Due (`highlight` fill, `ink` text), Part paid (2px dashed `blue` outline, `blue` text), Paid (double `stamp` outline, `stamp` text). [unit + e2e]
42. Every tag shows its word. With colour removed, the four are still told apart by outline style and fill. The double outline reads as two lines on a phone. [e2e greyscale screenshot + manual: check H5]
43. The tag text is passed in, so it can carry detail ("Overdue 7 days", "Due 12 Oct"). Label style in English; Anek 600, 15px, no capitals, no letter-spacing in the Indian scripts. A long tag wraps; it is never truncated. [e2e]

### Stamp
44. A double-ring circle in three sizes: sm, md, lg (Open question 5). The ring itself is not rotated; only the words inside tilt about -12°. Sizes are set in rem (52, 132 and 232px at the default text size), so the stamp grows with the text. A word too long for the ring makes the stamp larger; it stays a circle and the word is not cut or shrunk. [unit + e2e]
45. Text is passed in (PAID, SENT, ALL PAID). PAID and ALL PAID are `stamp` green; SENT is `blue`, as on the canvas. An optional second line (a date, or "1 of 5") shows on md and lg only and is 14px or larger; sm has no second line. [unit + e2e]
46. The stamp has a text alternative that says what it means (for example "Stamped paid on 08 Oct 2026"), or is hidden from screen readers when the same words are already beside it. [unit]
47. When asked to animate, it plays once: 200ms, scale 1.15 to 1 with a slight rotation settle. By default it does not animate. [e2e]
48. In an Indian script the stamp text has no letter-spacing and no forced capitals. [e2e]

### Tabs (called `IndexTabs` in `docs/DESIGN.md`)
49. Folder tabs joined to the slip below: 2px `ink` border on three sides, 6px top corners. The selected tab is 48px tall, `slip` coloured, `ink` text. Unselected tabs are 44px tall, `tab-idle`, `ink-soft` text. [e2e]
50. Each tab shows a label and an optional count. The selected tab is marked by height and fill, not colour alone, and is exposed to screen readers as selected. [unit + e2e]
51. Tabs work by tap and by keyboard, and report the chosen tab to the screen that uses them. [unit]
52. Three tabs with long translated labels at 360px: no label is truncated and the page does not scroll sideways (behaviour: Open question 7). A word too long for its tab may break in the middle. [e2e]

### Sheet
53. A bottom sheet: a `slip` panel with a 2px `ink` top edge, anchored to the bottom of the screen, on the dark ground. [e2e]
54. It has an optional context header on the dark ground (a small label and a title in `on-cloth`), a title inside the panel, and a text close control at least 44px tall whose words are passed in ("Cancel", "Close"). [unit + e2e]
55. It is announced as a dialog with a name. Focus moves into it on open and returns to the control that opened it on close. While it is open, focus never lands on anything in the page behind (it may pass through the browser's own controls, as with any modal dialog). The page behind cannot be reached or scrolled. Escape closes it. [unit + e2e]
56. When the content is taller than the screen, the panel scrolls inside itself and the close control stays reachable. [e2e]
57. The context header on the dark ground holds text only; nothing in it takes focus. The dark ground still carries the yellow-ring rule of criterion 21 for anything a later screen places on it; the first real focusable controls on a dark ground are the undo banner's (criterion 93). [unit: the header contains no focusable element]

### Five more components (added 2026-10-09; numbered from 70 so that 1 to 69 keep their numbers)

The rules already stated apply to these too: text is passed in (66), no text under 14px (4), targets at least 44px (62), nothing truncated at 130% (63), Indian-script styling (13), focus ring as in criterion 21. None of the five has a disabled state on the canvas, so none is built (Open question 18).

**Segmented**

70. A group of two to four choices inside one 2px `ink` border with 4px corners. Segments are equal width, with a 2px `ink` line between them. Exactly one is selected: `ink` fill with `slip` text. The others have no fill and `ink` text. [unit + e2e]
71. (Changed after the F2b build.) Each segment is at least 48px tall, the same minimum as a button. The tap target sits inside the segment's 2px line, so a 44px segment gave a 42px target; at 48px the target is at least 44px. A segment's text can have a second, smaller line (14px or larger), as in `Tool-reminder.dc.html`. Long text wraps and all segments grow to the same height; nothing is truncated. [e2e]
72. When four segments do not fit side by side at 360px, the group becomes two rows of two, with the lines kept between them, as in `Tool-reminder-m.dc.html`. [e2e]
73. (Changed after the F2b build.) The group has a visible label in the label style, tied to it. Each choice is a real radio input laid over its whole segment, not hidden, so the segment itself is the tap target and a tap anywhere in it chooses it. The input draws nothing of its own except the focus ring. The chosen segment is exposed to screen readers as the chosen one. It works by tap and by keyboard and reports the choice to the screen. [unit + e2e]
74. The focus ring is visible on a selected and on an unselected segment and is not clipped by the group's border. In a greyscale screenshot the selected segment is still obvious. [e2e]

**StudentStrip**

75. One block per student in a single line with 3px gaps, bottoms aligned: paid is short (14px) and filled `stamp`; due is short and hollow (`slip` fill, `ink` outline); overdue is tall (24px) and filled `cloth`. [unit + e2e]
76. A text legend is always shown with it, using the three passed-in texts (canvas: "14 paid", "4 due, hollow", "5 overdue, tall"). The strip cannot be rendered without its legend. The legend wraps; it is label style in English and Anek 600 at 15px in the Indian scripts. [unit + e2e]
77. The strip has one passed-in text alternative that gives the counts. The blocks themselves are hidden from screen readers, are not tappable and take no keyboard focus. [unit]
78. In a greyscale screenshot the three kinds are told apart by height and fill. [e2e + manual: check H13]
79. With 1, 23 and 60 students at 360px: no sideways scroll, and a hollow block still looks hollow (how: Open question 15). With no students it renders nothing. [e2e]

**Switch**

80. A square switch, 76px by 44px, 2px `ink` border, 4px corners. On: `stamp` green track with the knob at the right. The knob is a `slip` block with a 2px `ink` border that carries the passed-in word (canvas: "ON") at 14px, weight 800. (Changed after the F2b build.) On the green track the knob's shape is shown by its `slip` fill, which is 6.00:1 against `stamp`. Its `ink` edge is 2.80:1 against `stamp`, under 3:1; it is a reported pair under criterion 8 and no token was changed (Open question 21). [e2e]
81. Off: the knob is at the left and carries the passed-in off word; the track is not green (exact look: Open question 14). On and off are told apart by the knob's position and its word, never by colour alone. [e2e]
82. It is exposed to screen readers as a switch with a passed-in name and its on or off state. It works by tap and by keyboard and reports the change. The knob moves without animation. [unit + e2e]
83. A longer knob word in Hindi, Kannada or Telugu is not truncated and not shrunk below 14px; the switch grows wider instead. [e2e]

**BottomNav**

84. A bar with `slip` background and a 2px `ink` top border, at least 64px tall, in four equal columns in this order: Home, Students, Attendance, More. Each item is a link with a 24px icon above a passed-in label (14px or larger, weight 700). The link targets are passed in. [unit + e2e]
85. The current item has a 5px `cloth` bar across its top and `ink` text; the others have no bar and `ink-label` text. The bar is the mark, so the current item is still clear in greyscale, and it is exposed to screen readers as the current page. [unit + e2e]
86. The bar is a navigation landmark with a passed-in name. Each item's target is its whole column at the bar's full height. Icons are hidden from screen readers. The focus ring is visible and not clipped. [unit + e2e]
87. Labels wrap and the bar grows taller; no label is truncated in any of the four languages or at 130% text. [e2e]

**Banner**

88. Three kinds and no others: offline, error, undo. All words are passed in. Each kind is recognisable by its words and shape, not by colour alone. [unit]
89. Offline: a full-width `ink` strip, a leading mark in `highlight`, a title in `slip` (16px, weight 700) and a detail line in `on-cloth` (14px or larger). No actions. It is announced politely as a status. [unit + e2e]
90. Error: `slip` background, 2px `cloth` border, a solid `cloth` offset shadow, a title in `cloth` (18px, weight 800) and a detail line in `ink-soft` that says what happened and what is safe. Up to two actions, each at least 48px tall: the main one in `record` colours, the other outlined. It is announced at once as an alert. Red appears only in the border, title and shadow; there is no red button. [unit + e2e]
91. Undo: `ink` background with 4px corners, a message in `slip` (16px, weight 700), and two actions at least 48px tall: one outlined in `slip` on the dark ground, one filled `slip` with `ink` text. The second can carry an icon and can be a link. It is announced politely as a status. [unit + e2e]
92. (Changed after the F2b build.) Titles, details and action labels wrap and the banner grows with them. Two actions that sit side by side share one height, the taller one's. When both labels are too long to share a row, the second action drops below the first; each then fills the row and takes its own height, at least 48px. Nothing is truncated. [e2e]
93. Focus rings inside the offline and undo banners (dark ground) are yellow. Actions are reachable by keyboard. The banner has no timer and never closes itself in F2; the screen that shows it decides (Open question 17). [unit + e2e]

### The `/dev/components` page
58. `/dev/components` exists in the static export and shows: the colour tokens with names; the type roles; and each of the thirteen components in every variant and state listed above (criteria 17 to 57 and 70 to 93), with forced examples of pressed, focus, busy and disabled so they can be seen without interacting. [e2e]
59. It shows a type sample and the components with text in English, Hindi, Kannada and Telugu, each block marked with its `lang`, including one deliberately long label per script. [e2e]
60. It shows the ₹ sign with digits 0–9 at headline size, reading size and row size, alone and inside each Indian script. [e2e + manual]
61. At 360px wide the page has no sideways scroll. [e2e]
62. Every interactive element on the page is at least 44px by 44px. For a segment, the interactive element is its radio input, which covers the whole segment (criteria 71 and 73; note added after the F2b build). [e2e]
63. With text scaled to 130% at 360px wide, nothing is clipped, overlapped or truncated, and there is still no sideways scroll. A headline amount never breaks inside the number: it stays on one line and shrinks to fit its container, never below 14px. [e2e + manual: check H4]
64. With "reduce motion" on: the stamp does not animate and nothing else moves except state changes. [e2e]
65. The page is marked `noindex` and is not linked from the home page. It is in local, CI and preview builds and is left out of the production build: a production build has no `/dev/components` route and requesting it gives "not found". [e2e for noindex; build check for production]

### Whole slice
66. The thirteen components contain no user-visible words of their own: every label, message and screen-reader name is passed in. The product name is not typed anywhere outside `src/config/brand.ts`. `pnpm i18n:check` still passes. [unit]
67. `pnpm size` passes for `/` and `/dev/components`. The home page loads no component code it does not use; its JavaScript does not grow by more than a few KB over the F1 figure of about 132 KB. `tech-lead` records both numbers here. [`pnpm size`]
    - **Measured on the F2a build:** `/` 132.1 KB and `/dev/components` 136.4 KB of gzipped JavaScript, against the 200 KB limit.
    - **Measured on the F2b build:** `/` 132.1 KB (unchanged) and `/dev/components` 138.7 KB of gzipped JavaScript, against the 200 KB limit.
95. (Added after the F2a build.) Fitting an amount to its container is for headline amounts only. The `amount-size-*` classes exist only at headline sizes; row amounts and amounts in reading text are never fitted and always grow with the phone's font-size setting. The two sizes are 60px and 72px (`amount-size-6xl` and `amount-size-7xl`). Reason: small text must always follow the phone's font-size setting without being resized by us (see Open question 19). [unit]
68. No runtime dependency is added. If `tech-lead` finds one is needed (for example for font subsetting or the sheet's focus handling), the dependency-policy check is written into this spec and the founder is asked first. [review]
69. The only motion in the slice is the button press and the stamp. [review]

## Edge cases
- **Long translated labels.** Translations run 20 to 40 percent longer than English. Buttons, tabs, tags, row text, field labels and messages wrap and grow in height. No ellipsis anywhere in the thirteen components. Segments, bottom-nav labels, switch words and banner actions follow the same rule. The canvas truncates row text in English (`Home.dc.html`, `Students.dc.html`); this spec follows the rule in `CLAUDE.md` instead (Open question 3).
- **A very long single word or name** (a 40-character student name, a long UPI ID in a field): it breaks in the middle of the word rather than pushing the amount or the action off screen. Breaking mid-word is allowed; cutting off is not.
- **Large system font.** Covered by criterion 63 and hand check H4. Headlines with line-height 0.9 must not overlap when they wrap at 130%.
- **A headline amount that does not fit** (₹1,23,456 at 68px in a 320px column, or any amount at 130% text). It never breaks inside the number and never runs off the screen: it stays on one line and gets smaller until it fits, down to 14px at the least. Only headline amounts do this (criterion 95). Whether they also ignore the phone's font-size setting is Open question 19.
- **Typing a long value in a field.** The field grows a line at a time as the value wraps; the mark stays beside the value; Enter submits and never adds a line; pasted line breaks become spaces.
- **A row with both an amount and a tag.** Not allowed (criterion 94).
- **14px floor.** Covered by criterion 4. The 10px date on the stamp in `Main.dc.html` is not built (criterion 45).
- **44px targets.** Unselected tabs are exactly 44px; the sheet's close link and the row's link area must not fall below it when text is small. A segment is 48px so that its target, inside the 2px line, stays at or above 44px (criterion 71).
- **Status without colour.** Red and green are close in lightness. Tags, row meta, field states, the selected tab, the selected segment, the student strip, the switch, the current bottom-nav item and the three banners must all read correctly in a greyscale screenshot.
- **Student strip at the extremes.** One student, 60 students (the PRD's upper end for a tutor), and none. A part-paid student has no shape of its own (Open question 15).
- **Bottom nav with long labels.** Four columns of 90px at 360px; a long translated "Attendance" wraps and the bar grows.
- **Banners.** A long error detail in Telugu at 130% must not push the actions off screen. Two action labels too long to sit side by side stack, one above the other (criterion 92). Two banners at once is a screen matter, not F2's.
- **Pressed, busy, disabled, focus.** A busy button must not fire twice. A disabled button must not look merely pale: dashed outline and no shadow. Focus must be visible on `page`, `slip`, cloth and the dark sheet ground.
- **Reduced motion.** No stamp animation. Whether the 80ms press movement becomes instant is Open question 11.
- **₹ and digits.** ₹ may be missing from Bricolage Grotesque or DM Mono; the fallback must not change the line height or look like a different weight. Amounts never switch to Devanagari, Kannada or Telugu digits.
- **Slow network.** Fallback text first, then the font; the swap must not push a button or row to a different height by more than a line.
- **Offline, partial payment, duplicates, a parent opening an old link.** Not applicable: F2 has no data and no public page. "Part paid" exists only as a tag.

## Out of scope
- **next-intl wiring, locale routing, `formatRupees()` and `formatDate()`**: F3. In F2 the sample text on `/dev/components` (four scripts, amounts already written as "₹1,23,456", dates as "08 Oct 2026") lives in one sample-data file beside the page and is passed into the components as props. The components hold no strings, so the rule "user-facing text goes through message files" is not broken by them; the page itself is treated as an internal tool, not a user-facing screen. The docs do not settle this, so it is Open question 1. F3 must keep `/dev/components` working outside the locale routes.
- **Supabase, environments, Vercel project**: F4.
- **Product screens**: R0 and R1. F2 builds no landing page, tool, dues board, pay page or receipt.
- **Things near the five added components that F2 does not build**: the wide text switch on the Pro screen ("Sending / Paused / Opted out", `Auto-reminders.dc.html`, Release 2); the larger student strip on the desktop dues board (`Home-desktop.dc.html`; no slice owns it yet); the "Opening your book…" loading strip (`State-loading.dc.html`, R1-6); where banners sit on a screen, when they appear and when they go (R1-7 for undo, R1-12 for offline and save errors); the routes the bottom nav points to (R1).
- **Field variants seen on the canvas**: the large ₹ amount entry (`Pay-sheet`, R1-7), the mono reference-number entry (`Claim-sheet`, R1-10), search (`Students`, R1-3), multi-line paste (`Paste-list`, R1-4), checkboxes (`Export`, R1-13). F2 builds one field only: the one-line field that wraps (criteria 26 to 32).
- **Chips and small buttons seen on the canvas**: the yellow "2 to confirm" chip, "Full / Half / Other" amount chips, the language button on cloth. Built with the screens that need them.
- **Cloth surfaces with the stitched outline, the ruled website background, loading blocks**: tokens exist after F2; the surfaces are built in R0-1 and later.
- **Native-speaker review of the sample strings**: they are the canvas drafts. Review happens before Release 0 ships (build plan §7 item 5).
- **PDF fonts** (Noto Sans in the receipt PDF): R0-3.

## Design references
In `design/project/` (read-only). Direction A only.
- `Main.dc.html` — design-system board: colours, type, buttons, tags, stamp, row, field.
- `Interaction.dc.html` — button rest, pressed, focus, busy, disabled; field empty, typing, correct, needs fixing.
- `Type-indic.dc.html` — settings for Hindi, Kannada, Telugu; the note that ₹ must be checked on a phone.
- `Home.dc.html`, `Home-hi.dc.html` — Tabs joined to a Slip, Rows with round action and small stamp, the same in Hindi.
- `Student.dc.html` — Slip, StatusTag, `send` and `record` buttons side by side.
- `Students.dc.html` — Rows with all four StatusTags.
- `Setup-upi.dc.html`, `State-error.dc.html` — Field correct and needs fixing, with messages.
- `Pay-sheet.dc.html`, `Claim-sheet.dc.html`, `Export.dc.html` — Sheet.
- `Receipt.dc.html`, `Sent.dc.html`, `State-allpaid.dc.html` — Stamp at medium and large, PAID, SENT, ALL PAID.
- `Pay-sheet.dc.html`, `Export.dc.html`, `Remind.dc.html`, `Add-student.dc.html`, `Tool-reminder.dc.html`, `Tool-reminder-m.dc.html` — Segmented with two, three and four segments, two-line segments, and the two-by-two form on a phone.
- `Home.dc.html`, `Home-hi.dc.html` — StudentStrip with its legend, in English and Hindi.
- `Auto-reminders.dc.html`, `Parent-report.dc.html` — Switch, on state only (both are Release 2 screens).
- `Nav.dc.html`, `Home-hi.dc.html` — BottomNav, with icons in English and without in Hindi.
- `State-offline.dc.html`, `State-error.dc.html`, `State-undo.dc.html` — Banner: offline, error, undo.

## Analytics
None. No PostHog event from PRD §4 fires in this slice, and PostHog is not installed yet.

## Test by hand on a phone
There is no deployed site until F4, so the phone opens the page from the laptop over the same Wi-Fi. `tech-lead` adds the exact command and address here.

Use a real Android phone with Chrome, a low-end one if there is one. Open `/dev/components`.

- **H1. First look.** The page is yellow paper, black ink, blue buttons, hard shadows. No blurry shadow, no rounded pill, no red button anywhere.
- **H2. Press.** Tap each button variant. It drops into its shadow and comes back, quickly, with no fade. The busy example stays down and shows its working label. The disabled example does nothing and has a dashed outline.
- **H3. ₹ and digits.** Look at "₹1,23,456" at the large size, at reading size and in the ledger row, in English and inside the Hindi, Kannada and Telugu blocks. The ₹ must look like part of the same typeface (same weight, sitting on the same line as the digits), not a thin or boxy substitute. Digits must be 0–9 everywhere. Take a screenshot and tell us which sizes, if any, look wrong.
- **H4. Large font.** First, at the normal font size, take a screenshot of the top of the page and of the large "₹1,23,456". Then in Android Settings set font size to the largest and reopen the page. Nothing is cut off, nothing overlaps, no "…", no sideways scroll. Buttons and rows are taller, not clipped. Then answer these two questions separately, comparing with the first screenshots (they settle Open question 19):
  - **H4a. Did ordinary text get bigger?** Look at a button label, a row name and a paragraph. If they look exactly the same size as before, tell us: it may mean the whole site is ignoring the phone's font-size setting, which would be a fault. If so, also try Chrome's own setting (Chrome menu, Settings, Accessibility, text scaling) at its largest and say whether that one changes the text.
  - **H4b. Did the large headline amount change size?** Say whether "₹1,23,456" at the top got bigger, stayed the same or got smaller, and whether all of it is still on one line and on the screen.
- **H5. Status without colour.** Turn on greyscale (Digital Wellbeing "Bedtime mode" or the colour-correction setting). You can still tell Overdue, Due, Part paid and Paid apart, and the Paid tag's outline shows as two lines.
- **H6. Indian scripts.** In the Hindi, Kannada and Telugu blocks, no vowel mark is clipped at the top or bottom of a headline, button, tab or tag. Lines do not touch each other.
- **H7. Tabs.** Tap each tab: the chosen one is taller and joins the slip below with no line between.
- **H8. Field.** Tap into the field: the line turns thick blue and the keyboard does not cover it. Look at the correct and needs-fixing examples: each has a mark and words, not just a colour.
  - **H8a. A long UPI ID with the keyboard open.** Type a long UPI ID, for example `meena.iyer.maths.tuitions@okhdfcbank`. When it reaches the edge it continues on a second line and the field grows; you can see every character; the field stays above the keyboard and the page does not jump. Press Enter on the keyboard: no blank line is added. Paste two lines of text from a note: they arrive as one line with a space between.
- **H9. Sheet.** Open the sheet. The page behind is dark and does not scroll. Close it with the close control and with the phone's back gesture (see Open question 8).
- **H10. Reduce motion.** Turn on "Remove animations" in Accessibility. The stamp example appears without the pop.
- **H11. Slow network.** If possible, on mobile data: text appears at once and the fonts follow; nothing jumps badly.
  - **H11a. Labels on a first load.** The small capital labels (DM Mono) are no longer loaded ahead of time, so on a first visit they appear in another face and then change. Clear Chrome's data for the site, or use an incognito tab, and load the page on mobile data. Watch the small labels: say whether you notice the change, and whether anything near them moves when it happens.
- **H12. Segmented.** Tap each choice in the two-, three- and four-part groups. The chosen one turns black with light text; only one is chosen at a time. A tap anywhere in a segment chooses it, including near its edge and on the second line of a two-line segment. The four-language group shows as two rows of two and nothing is cut off.
- **H13. Student strip.** With greyscale still on from H5, you can pick out paid (short, filled), due (short, hollow) and overdue (tall) blocks, and the words under the strip say the same. Look at the 60-student example: hollow blocks still look hollow.
- **H14. Switch.** Tap it. The knob jumps to the other side and its word changes. You can tell on from off without relying on the green. When it is on, look at the knob against the green: say whether its light block stands out clearly and whether its edge looks weak (this settles Open question 21).
- **H15. Bottom nav.** The four items have an icon and a word; the current one has a red bar on top. With the largest font size and in the Hindi, Kannada and Telugu examples, every word is whole and the bar is taller, not clipped.
- **H16. Banners.** Read the offline, error and undo examples. Each says in plain words what happened; the error one also says what is safe. Buttons inside them are easy to hit with a thumb. Two buttons side by side are the same height. In the long-text examples, and at the largest font size, the second button may sit below the first: each is then whole, full width and not squeezed. No banner is told apart by colour alone.

## Decided by the founder, 2026-10-09
These were open questions 2, 4 and 12. The numbers of the remaining questions are unchanged.

- **Row amounts (was question 2).** DM Mono for row amounts in every language; Bricolage Grotesque for headline amounts. Criterion 40 states it. `docs/DESIGN.md` and `CLAUDE.md` still say "amounts are always in the headline face"; that wording needs correcting to "amounts never use Anek and always use digits 0–9".
- **Thirteen components (was question 4).** F2 builds all thirteen components in `docs/DESIGN.md`, not the eight in the build plan's F2 row. Criteria 70 to 93 cover `Segmented`, `StudentStrip`, `Switch`, `BottomNav` and `Banner`. "Tabs" in the build plan is `IndexTabs`. The F2 row in `docs/BUILD_PLAN.md` (the list of components and the size M) is now out of date.
- **`/dev/components` in production (was question 12).** Left out of the production build; present in local, CI and preview builds; `noindex` everywhere; kept out of the sitemap (R0-5). Criterion 65 states it. `release-manager` adds "`/dev/components` is not found" to the production smoke test.

## Open questions
Only the founder can settle these. Each has a recommendation. Until answered, the criteria above follow the recommendation.

1. **Sample text on `/dev/components` and the message-files rule.** The page needs strings in four scripts before next-intl exists (F3). Recommendation: treat the page as an internal tool; keep its sample strings in one file beside the page, not in `messages/*.json`, so dev-only text is never sent to translators or shipped in the locale bundles. The thirteen components themselves hold no strings.
2. Decided. See the list above.
3. **Truncating row text.** `Home.dc.html` and `Students.dc.html` cut the name and meta line with "…"; `CLAUDE.md` and `Type-indic.dc.html` say rows grow and never truncate. Recommendation: wrap and grow, no ellipsis, in all languages.
4. Decided. See the list above.
5. **Stamp sizes.** `docs/DESIGN.md` says sm, md, lg; the canvas uses 52, 66, 84, 132, 196 and 232px. Recommendation: sm 52px (row), md 132px (receipt), lg 232px (all paid, sent); the 66px and 196px uses snap to the nearest. Also confirm SENT is blue (canvas) and that the faint 0.9 opacity on the receipt stamp is wanted.
6. **A green button?** `Pay-sheet.dc.html` ("Mark as paid") and `Claims.dc.html` ("Confirm paid") use a green fill. `docs/DESIGN.md` says Mark paid and Confirm are black, and lists no green variant. Recommendation: F2 ships the three documented variants only; decide before R1-7. Related: the canvas shows flat buttons with no shadow inside slips and banners ("Not received", "Later") and smaller shadows (4px, 3px) on compact buttons. Recommendation: compact shadows only on the round row button. Now that `Banner` is in F2, flat buttons are needed after all: the error banner has a black and an outlined button with no shadow, and the undo banner has two flat buttons on black. Recommendation: allow a flat form (no shadow) only inside `Banner` for now, in the existing three variants plus the two on-dark looks in criterion 91; do not offer it to screens until the green-button question is settled. The canvas draws no pressed state for a flat button; recommend a 2px move in the same 80ms.
7. **Tabs that do not fit.** Three long translated tab labels at 360px with large font. Recommendation: the labels wrap inside their tabs and all tabs grow to the same height; no sideways scrolling strip.
8. **How a sheet closes.** The canvas shows only a Cancel or Close link. Recommendation: the close control, Escape and the phone's back gesture close it; tapping the dark ground does not, so a tutor cannot lose a half-entered amount by a stray tap. If back-gesture handling is costly in a static export, it may move to R1-7 where the first real sheet appears.
9. **Spacing scale.** `docs/DESIGN.md` defines no spacing tokens. Recommendation: use Tailwind's default 4px scale and add named sizes only for the three minimums (44, 48, 64).
10. **Fonts: Anek Latin and a size ceiling.** The build plan lists five self-hosted families; `docs/DESIGN.md` ends the font stacks in Anek Latin, which is a sixth. Recommendation: do the phone check (H3) first; ship Anek Latin only if ₹ is missing or wrong in Bricolage or DM Mono, and then only the ₹ glyph. The PRD sets no limit on font bytes (the 200 KB limit is JavaScript only). Recommendation: `tech-lead` measures the subset files, and the founder then sets a per-language ceiling so a tutor on slow 4G is not left waiting. **Update after the F2a build:** Anek Latin is not shipped; Bricolage Grotesque has the ₹ sign and supplies it where DM Mono lacks it, pending phone check H3. Sizes are now measured (under criterion 10): an English first visit preloads about 60 KB of fonts and fetches about 9 KB more for labels; Hindi adds up to about 306 KB, Kannada about 156 KB, Telugu about 186 KB. Recommendation: accept these for F2 and set the ceilings just above today's figures (English 80 KB; each Indian script no more than 310 KB on top of English) so that CI catches any growth; look again at the Hindi figure before Release 0 ships, when a first load can be timed on a real slow connection.
11. **Details the docs leave out.** (a) Which yellow is the focus ring on dark grounds: recommend `highlight`, and use it on cloth as well as on blue and black. (b) The pressed blue on the canvas is `#14206B` and the sheet ground is `#2A0709`; neither is in the token table, and components may not use raw hex. Recommend adding both as tokens (`blue-pressed`, `sheet-ground`) to `docs/DESIGN.md`. (c) `Interaction.dc.html` mentions "a short buzz on phones that support it"; it is not in `docs/DESIGN.md`. Recommend leaving it out for now. (d) Under reduced motion, recommend the button still moves into its shadow but instantly. (e) `CLAUDE.md` says corners are 4px at most while index tabs are 6px; recommend naming the tab tops as the one exception. (f) `Main.dc.html` labels `#F8ECB8` "Page" and `#E6D38A` "Rule"; this spec follows the names in `docs/DESIGN.md`. (g) Field line weights differ between the boards (`Interaction` 4px typing and 2px green correct; `Setup-upi` 3px blue with a tick); this spec follows `docs/DESIGN.md` and `Interaction.dc.html`.
12. Decided. See the list above.
13. **Split.** With thirteen components the slice is L, not M. Recommendation: split it into two pull requests. **F2a** is criteria 1 to 69: tokens, fonts, the first eight components, `/dev/components`, and leaving the page out of production. **F2b** is criteria 70 to 93: `Segmented`, `StudentStrip`, `Switch`, `BottomNav`, `Banner`, added to the same page. Reasons: F2a is what F3 and the phone check of the ₹ sign wait on; the five added components carry all the unsettled design points (questions 6 and 14 to 18); and none of them is used before R0-2 (`Segmented` in the reminder tool), with `Switch` not used until Release 2. F2b depends only on F2a and can be built alongside F3 and F4. Cost: one more review round, and criteria 58, 61, 62, 63 and 66 are checked again in F2b. If the founder prefers one pull request, the slice still holds together as a single L slice, but the review will be large.
14. **Switch: no off state, and two forms.** The canvas shows the switch only switched on, and only on two Release 2 screens (`Auto-reminders.dc.html`, `Parent-report.dc.html`). The same Pro screen also has a second, wider form (88px, the words "Sending / Paused / Opted out" in place of a knob). Recommendation: build the 76 by 44 knob form only; off is the knob at the left carrying the off word on a `tab-idle` track; leave the wide form to Release 2.
15. **StudentStrip: part paid, and many students.** `docs/DESIGN.md` gives three shapes (paid, due, overdue) but the PRD has a part-paid status. At 360px, 60 students leaves about 2px per block, too thin for a hollow block to read as hollow. Recommendation: a part-paid student is drawn as due or overdue by its date, with no fourth shape; blocks are never narrower than 6px and the strip wraps onto a second line when they would be. The 300-student Centre case is decided in Release 3.
16. **BottomNav: icons or words only.** `Nav.dc.html` has an icon above each label at 14px; `Home-hi.dc.html` shows the Hindi bar with words only at 15px. Recommendation: icon and word in every language, Indian-script labels at 15px, and the bar grows past 64px when it needs to.
17. **Banner details.** (a) The error banner's shadow is `cloth` red; the shadow list in `docs/DESIGN.md` has only `ink`, `ink-label` and `cloth-deep`. Recommend adding it to the list, for the error banner only. (b) Nothing says how long the undo banner stays. Recommend no timer in F2 and deciding the time in R1-7, where a tutor's real pace can be tested. (c) The offline banner is a square full-width strip at the top and the undo banner is a rounded block near the bottom; recommend the banner kind fixes the shape and the screen fixes the position.
18. **Disabled states that were never drawn.** Only `Button` has a drawn disabled state. Recommendation: build none for `Segmented`, `Switch`, `BottomNav`, `Banner` or `Tabs` in F2; when a screen first needs one, reuse the button's language (dashed `ink-label` outline, no fill, a line saying why).
19. **Headline amounts and the phone's font-size setting.** A fitted headline amount is sized by CSS to fit its container on one line. An earlier build also set `text-size-adjust: none` on it; review found that declaration had no effect on any real page (Tailwind's base styles already set 100% on the whole page), so it was removed. No exception to PRD §9 is being asked for.
    - **What is unknown:** nothing in the code now stops a phone's text-scaling multiplier from enlarging a fitted amount after CSS has sized it. If Android Chrome applies that multiplier, a six-digit headline amount can run off the screen at the largest font setting. The automated tests cannot reproduce the phone's setting; only hand check H4b can show what happens.
    - **If H4b shows the amount running off the screen:** fix it by measuring the rendered amount, before any screen uses a fitted amount (R0-1 at the latest). Do not bring back `text-size-adjust`.
    - **If H4a shows ordinary text does not grow:** the whole site is ignoring the phone's font-size setting. That is a failure of PRD §9 and of criterion 63 and must be fixed before any screen a tutor or parent uses ships. Neither result holds up merging F2a, which has no such screen. Until H4 is run, the manual half of criterion 63 is not proven.
20. **Oldest phones supported.** The build works on Chrome and Android WebView 111 and later and on iOS 16.4 and later (the floor set by Tailwind 4, chosen in F1). Android 6 and older, and iPhones older than the iPhone 8, will show broken styling. The PRD says "low-end Android" without a version. Recommendation: accept this floor, since Chrome updates itself on Android 8 and later and Android 7 reaches Chrome 119; write the floor into PRD §9 so it is a stated decision; and check the share of older phones in PostHog once Release 0 has traffic.
21. **Switch knob edge on the green track (found during the F2b build).** When the switch is on, the knob's 2px `ink` edge sits on the `stamp` green track at 2.80:1. The usual minimum for an edge that carries meaning is 3:1 (criterion 8). The knob's `slip` fill on the same track is 6.00:1, and that fill is what shows the knob's shape there. On and off are also told apart by the knob's position and its word, which is `ink` on `slip`. When the switch is off it is the other way round: the fill is close to the `tab-idle` track and the `ink` edge (12.2:1) shows the shape. The pair is recorded in `src/styles/contrast.ts` as reported, and a unit test keeps it on record. No token was changed. Recommendation: accept it as built, because the edge is not the only thing that shows the knob in either state; confirm by eye in hand check H14 before the first screen uses the switch (Release 2). If the founder wants every edge at 3:1 regardless, that is a change to the `stamp` or `ink` token or to the knob's design, and it goes back to design, not to a quiet fix in code.

## Carry forward to later slices
- **R1-7 and R1-12 (banners):** keep a live-region wrapper mounted on the screen at all times and put the banner inside it when it appears. A banner that mounts together with its own live region is often not announced by screen readers.
- **Every amount on a real screen:** a headline amount needs the `amount-box` wrapper, an `amount-size-*` class and `amountFit()`; without all three it can break inside the number or overflow. Row amounts use none of them (criterion 95).
- **R1-1 (sign-in):** decide whether the email field needs a plain single-line input so that the browser's and the keyboard's autofill work; the wrapping field of criteria 26 to 32 may not get autofill.
- **R0-1 (landing page):** revisit preloading DM Mono once labels sit above the fold; today it is not preloaded and labels swap face on a first load (hand check H11a).
- **Rows:** a screen must not give a row both an amount and a status tag (criterion 94).
- **Blue grounds:** the first slice that puts a focusable control on a blue ground adds the yellow-ring test left open in criterion 21.
- **Before the first screen uses `Switch` (Release 2):** the founder's answer to Open question 21 (knob edge on the green track) and hand check H14.
- **Needs the founder before Release 0:** the browser floor (Open question 20), a per-language font-bytes ceiling (Open question 10), and the phone checks H3 and H4.

## Hand-off
F2a (criteria 1 to 69) merged as pull request #2. Criteria 94 and 95 were added after that build and still need to be checked against it. F2b (criteria 70 to 93) is built and is pull request #3 on `f2b-components`. Criteria 62, 71, 73, 80 and 92 were reworded after the F2b build to match it; the reasons are in section 9a of the F2b technical plan. Open question 21 is new and is for the founder. Hand checks H12 to H16 have not been run on a phone yet. The technical plans are below.

## Technical plan

Written by `tech-lead` on 2026-10-09. **This plan covers criteria 1 to 69** (tokens, fonts, the first eight components, `/dev/components`, the production exclusion). **The plan for criteria 70 to 93 (the five added components) is still owed** and will be appended as "Technical plan, part 2"; shared decisions below already allow for thirteen components. There is no backend work in this slice: no table, migration, RLS policy, database function or Edge Function. Every task belongs to `frontend-dev`.

Things marked **(verified)** were checked on 2026-10-09 against the bundled Next.js 16.4.0 docs (`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md`, `.../02-guides/static-exports.md`, `.../05-config/01-next-config-js/pageExtensions.md`) and by a throwaway build of a copy of this repo outside the working tree (Next 16.4.0, Tailwind 4.3.3, Turbopack). Nothing in the repo was changed for it.

### 1. Approach

Tokens are CSS variables in a Tailwind 4 `@theme` block with the default colour, radius, shadow, blur and smallest text tokens removed, so a class outside the design system does not exist. Fonts come through `next/font/google`, which downloads Google's per-script subset files at build time and serves them from our own origin; the browser fetches a file only when a character in its `unicode-range` is drawn, so an Indian-script file loads only when that script is on the page. The eight components are plain React with native elements (`<button>`, `<input>`, `<dialog>`); `/dev/components` is a page file with a `.dev.tsx` extension that the production build does not recognise as a page. No dependency is added at runtime.

### 2. Split and size

I agree with open question 13 as `product-manager` wrote it: two pull requests. **F2a** = criteria 1 to 69 (this plan). **F2b** = criteria 70 to 93. With thirteen components the slice is L. F2a alone is a full M. Inside F2a the build order (section 11) puts tokens, fonts and the type and ₹ part of the page first, so hand check H3 can be run on the phone after step 4, before any component exists. If F2a drags, the fallback cut is after step 4 (foundations) and before step 5 (components).

### 3. Files (all `frontend-dev`)

Create:

| File | What goes in it |
| --- | --- |
| `src/styles/tokens.css` | The `@theme` block: 17 colours plus `blue-pressed` and `sheet-ground`, text sizes, radii, shadows, the three size minimums, font-family tokens. The only file in `src/` that contains hex values. It sits outside `src/app/` and `src/components/` on purpose, so criterion 2 needs no exemption. |
| `src/styles/type.css` | Type-role utilities (`@utility`), the per-script variable overrides for `lang="hi"`, `"kn"`, `"te"`. |
| `src/styles/states.css` | Custom variants for pressed and focus ring, the ground utilities (`on-cloth-ground`, `on-dark-ground`), the stamp keyframes, the page scroll lock for an open sheet. |
| `src/styles/fonts.ts` | The five `next/font/google` calls and one exported `fontVariables` class string. The only place fonts are declared (Next's "font definitions file" pattern). |
| `src/styles/read-tokens.ts` | Node-only helper that parses `tokens.css` into `{ name: value }`. Used by the unit tests and by the dev page (a server component, so it runs at build time). One source of truth, no TypeScript copy of the tokens. |
| `src/styles/tokens.test.ts` | Criteria 1, 3, 5, 6, 7, 15: compares `tokens.css` with the colour table parsed from `docs/DESIGN.md`, and checks roles, radii, shadows (third length is `0`), sizes, stack endings. |
| `src/styles/contrast.ts`, `contrast.test.ts` | WCAG contrast function (about 15 lines, no library) and the list of text/ground pairs the components use; criterion 8. |
| `src/lib/cx.ts`, `cx.test.ts` | Joins class names (`filter(Boolean).join(" ")`). No `clsx`. |
| `src/components/ui/button.tsx` | `Button` and `RoundButton`. |
| `src/components/ui/field.tsx`, `slip.tsx`, `row.tsx`, `status-tag.tsx`, `stamp.tsx`, `tabs.tsx`, `sheet.tsx` | One component each. Only `tabs.tsx` and `sheet.tsx` start with `"use client"`. |
| `src/components/ui/*.test.tsx` | One test file beside each component. |
| `src/app/dev/components/page.dev.tsx` | The page: `metadata.robots = { index: false, follow: false }`, then the sections in order. Server component. |
| `src/app/dev/components/sections/*.tsx` | `tokens`, `type`, `rupee`, then one per component. Server components where possible. |
| `src/app/dev/components/demos.tsx` | `"use client"`: the few examples that need state (tabs, open-sheet button, replay stamp, tap-to-busy button). |
| `src/app/dev/components/sample-data.ts` | All sample text in four scripts, keyed by `en`, `hi`, `kn`, `te`, including one long label per script, "₹1,23,456" and "08 Oct 2026" as plain strings. |
| `src/app/dev/components/sample-icons.tsx` | Two or three inline SVG icons for the button examples. No icon library. |
| `scripts/check-tokens.mjs` | The scanner for criterion 2 (section 4). Its detector function is exported. |
| `src/styles/check-tokens.test.ts` | Unit test of that detector against good and bad sample strings. |
| `scripts/font-report.mjs` | Reads `out/`'s CSS, prints one line per font file: family, subset (from `unicode-range`), weight, bytes, preloaded or not. `pnpm fonts:report`. |
| `public/licenses/fonts.txt` | The SIL Open Font License 1.1 text and the copyright line of each of the five families. |
| `e2e/dev-components.spec.ts`, `e2e/fonts.spec.ts` | Playwright flows (section 10). |

Change:

| File | Change |
| --- | --- |
| `src/app/globals.css` | Becomes imports only: `@import "tailwindcss" source("..");` then the three files in `src/styles/`. The `source("..")` limits class scanning to `src/`; without it Tailwind 4 scans every non-ignored file in the repo, including `docs/` and the 80-odd HTML files in `design/`. |
| `src/app/layout.tsx` | Adds `fontVariables` to `<html>`, and the base classes (ground `page`, text `ink`, reading role) to `<body>`. |
| `src/app/page.tsx` | Swap `text-3xl font-extrabold` for the headline role. No link to the dev page. |
| `next.config.ts` | `pageExtensions` (section 8). |
| `package.json` | `lint` becomes `eslint . && node scripts/check-tokens.mjs`; add `fonts:report` and `serve:lan`; add the Testing Library dev dependencies (section 9). |
| `scripts/serve-out.mjs` | Listen on `process.env.HOST ?? "127.0.0.1"` instead of a fixed `127.0.0.1`. Default behaviour unchanged. |
| `vitest.config.mts` | Nothing unless the dialog stub (section 7, Sheet) needs a setup file. |
| `.github/workflows/ci.yml` | One step after `pnpm test:e2e`: `VERCEL_ENV=production pnpm build && test ! -e out/dev`. It runs last because it overwrites `out/`. |

Not touched: `messages/*.json` (no component holds a string; open question 1), `scripts/size.mjs`, `playwright.config.ts`, `eslint.config.mjs`.

### 4. Tokens in Tailwind 4, and how criterion 2 is enforced

Tailwind 4.3.3 has no `tailwind.config.js` here; the theme is CSS. `@theme { --color-*: initial; ... }` removes a whole default namespace, and each `--color-x` then creates `bg-x`, `text-x`, `border-x`, `shadow-x`, `outline-x` **(verified: with the namespaces cleared, `bg-red-500`, `rounded-lg` and `text-xs` produce no CSS; `bg-blue`, `rounded-sm`, `shadow-button`, `min-h-control` do)**.

| Group | Definition |
| --- | --- |
| Colour | `--color-*: initial`, then the 17 from `docs/DESIGN.md` with the same names, plus `blue-pressed` `#14206B` and `sheet-ground` `#2A0709` (open question 11b). The unit test demands the 17 match the doc table exactly and allows exactly these two extras by name. |
| Text size | `--text-xs: initial` (nothing under 14px exists). Keep Tailwind's names from `text-sm` (0.875rem) upward. **All font sizes are rem**, never px, so the 130% check and Android's font-size setting scale them. |
| Type roles | `@utility` classes in `type.css`, each reading variables that the script rules override: `type-headline` (Bricolage, 800, -0.04em, line-height 0.92; size comes from a `text-*` class), `type-amount` (same face and tracking, **ignores the script variables**), `type-amount-row` (DM Mono 500, **ignores the script variables**), `type-body-sm` / `type-body` / `type-body-lg` (15 / 16 / 18px at 1.4), `type-label` (DM Mono 500, 14px, uppercase, 0.04em). Components use role classes; they never set `font-family`, `tracking-*` or `uppercase` themselves. |
| Indian scripts | Defaults on `:root, [lang]`; overrides on `[lang|="hi"]`, `[lang|="kn"]`, `[lang|="te"]`: script font variable, headline weight 700 and line-height 1.3, tracking 0, label transform `none`, label Anek 600 at 15px, body 17px at 1.6. Defaults are repeated on `[lang]` because custom properties inherit: an English block nested in a Hindi one must reset. Because the two amount roles do not read these variables, criterion 14 holds without any per-language code in a component. |
| Radius | `--radius-*: initial`, then `none` 0, `sm` 4px, `tab` 6px, `full`. |
| Shadow | `--shadow-*`, `--inset-shadow-*`, `--drop-shadow-*`, `--blur-*: initial`, then `button` `5px 5px 0 ink`, `record` `5px 5px 0 ink-label`, `slip` `6px 6px 0 ink`, `round` `3px 3px 0 ink`. On cloth the colour changes through the ground utility (below), not a second set of tokens. |
| Sizes | `--spacing-tap: 2.75rem`, `--spacing-control: 3rem`, `--spacing-row: 4rem`, giving `min-h-tap`, `min-h-control`, `min-h-row`, `size-control`. Default 4px spacing scale otherwise (open question 9). Borders and shadow offsets stay px. |
| Grounds | `on-cloth-ground` and `on-dark-ground` are utilities a surface puts on itself. They set two variables its descendants read: the button shadow colour (`cloth-deep`) and the focus-ring colour (`highlight`). Default ring is `blue`. A button therefore needs no "which ground am I on" prop, and criteria 21, 25 and 57 are one mechanism. |
| Forced states | `@custom-variant pressed (&:active, &[data-force~="pressed"], &[aria-busy="true"])` and `@custom-variant ring (&:focus-visible, &[data-force~="focus"])`. The dev page shows a frozen state by passing `data-force="pressed"`; components get no test-only prop. |

**Criterion 2 enforcement: a script, not an ESLint rule.** `scripts/check-tokens.mjs` reads every `.ts`, `.tsx` and `.css` file under `src/app/` and `src/components/` (test files excluded) and fails on: a hex colour, `rgb(`/`hsl(`/`oklch(`, a px font size (`text-[..px]`, `font-size: ..px`, `fontSize: 13`), any arbitrary `text-[`, `rounded-[`, `shadow-[`, `bg-[#`, and `blur`, `drop-shadow`, `bg-linear`, `bg-gradient`, `bg-radial`, `bg-conic`. Reason for a script: ESLint here does not lint CSS, and one scanner for both file kinds is simpler than a rule plus a second check. It runs inside `pnpm lint`, which CI already runs first, so no workflow change is needed for it. The detector is unit-tested against good and bad sample strings (that is the `[unit]` for criterion 2).

### 5. Fonts

**Mechanism.** `next/font/google` in `src/styles/fonts.ts`, exposed as CSS variables and mapped in `tokens.css` with `@theme inline`. The docs state that fonts are "downloaded at build time and self-hosted" and that "no requests are sent to Google by the browser". **(verified: the build writes the files to `out/_next/static/media/` with hashed names; the HTML and CSS reference only our origin.)** "Subset at build time" is met by taking Google's published per-script subset files at build; we do not run a subsetting tool of our own, because the next step down (a glyph-level subset) cannot be done safely for names typed by tutors in any script.

| Family | Call | Preloaded |
| --- | --- | --- |
| Bricolage Grotesque (variable 200–800) | `subsets: ["latin", "latin-ext"]` | yes, both files |
| DM Mono (static 400, 500) | `subsets: ["latin"]`, `fallback: ["Bricolage Grotesque"]` | yes, both weights |
| Anek Devanagari / Kannada / Telugu (variable 100–800) | `subsets: [<script>]`, `preload: false`, `fallback: ["Bricolage Grotesque"]` | no |

All use `display: "swap"` (also the documented default): text shows at once in the fallback and swaps. In `next/font/google`, `subsets` only chooses what is preloaded; every subset's `@font-face` is emitted with its `unicode-range`, and the browser downloads by range. That is the whole mechanism for criterion 11, and it keeps working in F3 without per-locale code.

**Sources and licences.** Google Fonts, fetched by Next at build. All five are SIL Open Font License 1.1 (checked in `github.com/google/fonts/ofl/<family>/OFL.txt`). The licence text ships in `public/licenses/fonts.txt`.

**Measured sizes** (the files Google serves today, identical byte counts in the throwaway build's `out/`; `frontend-dev` re-runs `pnpm fonts:report` on the real build and corrects this table if anything differs):

| File | Bytes | Loads when |
| --- | --- | --- |
| Bricolage Grotesque, latin | 41,236 | every page (preloaded) |
| Bricolage Grotesque, latin-ext | 18,740 | every page (preloaded); **this is the file that holds ₹** |
| Bricolage Grotesque, vietnamese | 8,652 | never in practice |
| DM Mono 400, latin | 8,688 | every page (preloaded) |
| DM Mono 500, latin | 8,724 | every page (preloaded) |
| DM Mono 400 / 500, latin-ext | 5,700 each | only for accented Latin |
| Anek Devanagari, devanagari | **257,340** | Hindi text on the page |
| Anek Devanagari, latin | 45,388 | Latin letters, digits or punctuation inside Hindi text |
| Anek Kannada, kannada | 113,420 | Kannada text on the page |
| Anek Kannada, latin | 39,608 | as above, in Kannada text |
| Anek Telugu, telugu | 139,724 | Telugu text on the page |
| Anek Telugu, latin | 43,400 | as above, in Telugu text |
| Anek `latin-ext` files | about 2,900 each | rarely |

Per language, first visit: English about **77 KB**; Hindi about **380 KB** (77 + 257 + 45); Kannada about **230 KB**; Telugu about **260 KB**. Fonts are cached with immutable hashed names after that. The Hindi figure is large and is a founder decision (see "For the founder" below).

**The ₹ sign, checked in the font files.** I read the character maps of the upstream fonts: **Bricolage Grotesque has ₹ (U+20B9). DM Mono does not.** Consequences:

- Headline and reading amounts: ₹ and digits are both Bricolage. Google puts U+20B9 in the `latin-ext` file, which is why that file is preloaded.
- Row amounts (DM Mono, as the founder decided): digits are DM Mono, **the ₹ is drawn by the next face in the stack**. The plan makes that face Bricolage Grotesque at the same weight, by giving DM Mono `fallback: ["Bricolage Grotesque"]`. Without that, Next inserts a generated "DM Mono Fallback" face (Arial scaled to 134%) ahead of it, and the ₹ would be an oversized Arial glyph on desktops and a system glyph on Android. **(verified: with `fallback` set, the variable is `"DM Mono", Bricolage Grotesque` and no Arial face is generated. `adjustFontFallback: false` alone did not remove it in this build, so use `fallback`.)**
- Inside Hindi and Kannada running text, ₹ is drawn by the Anek face (their script files include U+20B9). Google's Telugu file does not list U+20B9, so in Telugu running text it falls to Bricolage. Amounts in the two amount roles are unaffected.

**Open question 10, settled technically: Anek Latin is not shipped.** It is not needed: the only missing ₹ is in DM Mono, and Bricolage, which is already loaded, covers it. "Only the ₹ glyph of Anek Latin" would also need a subsetting tool. To meet criterion 15 as written, the stacks still end in the names `'Anek Latin', system-ui`:

- headline / reading: `Bricolage Grotesque, <its generated fallback>, 'Anek Latin', system-ui, sans-serif`
- label / row amount: `DM Mono, Bricolage Grotesque, <its fallback>, 'Anek Latin', system-ui, monospace`
- Indian scripts: `Anek <script>, Bricolage Grotesque, <its fallback>, 'Anek Latin', system-ui, sans-serif`

`'Anek Latin'` there is a name that matches nothing unless the phone happens to have it installed. I recommend `docs/DESIGN.md` drops it once H3 passes.

**Automatic part of criterion 16.** Chromium can report which font actually drew a node (`CSS.getPlatformFontsForNode` over a CDP session). `e2e/fonts.spec.ts` asserts: headline ₹ and digits are Bricolage Grotesque; a row amount is DM Mono plus Bricolage Grotesque and nothing else; each Indian-script sample is its Anek face. This catches a silent change in Google's files or in Next's fallback behaviour. How it looks is still H3.

**Serving the build to a phone (for H3 and all hand checks, before F4).** Laptop and phone on the same Wi-Fi:

```
pnpm build && pnpm serve:lan
```

where `serve:lan` is `HOST=0.0.0.0 PORT=4173 node scripts/serve-out.mjs`. Get the laptop's address with `ipconfig getifaddr en0` and open `http://<that address>:4173/dev/components/` in Chrome on the phone. macOS may ask once to allow incoming connections for `node`: allow it. Before the `serve-out.mjs` change lands, this works with nothing added: `pnpm build && python3 -m http.server 4173 --bind 0.0.0.0 --directory out`. Use the built `out/`, not `pnpm dev`: dev mode loads fonts and scripts differently. The result of H3, and which face drew each ₹, is written under criterion 16 by whoever runs it.

### 6. Browser support floor

Tailwind 4 (chosen in F1) already sets the floor: **Chrome and Android WebView 111, Safari and iOS 16.4, Firefox 128**. Everything this plan uses is at or below it: `<dialog>.showModal()` (Chrome 37, Safari 15.4), `:has()` (Chrome 105, Safari 15.4), `:modal` (Chrome 105, Safari 15.6), `dvh` units (Chrome 108, Safari 15.4), `unicode-range`, `size-adjust`. The `inert` attribute is not needed: a modal dialog makes the rest of the page inert by itself.

Against the PRD: it names "Android phone", "low-end Android", "Android Chrome" and a Bubblewrap TWA (which runs in Chrome), with no version. Chrome updates itself on Android 8 and later, so those phones are far above 111. Android 7 stops at Chrome 119, still above. **Android 6 and older stop at Chrome 106, below the floor: styling would break there.** iPhone parents need iOS 16.4 (iPhone 8 or later). The PRD does not say this is acceptable; it is listed for the founder below.

### 7. The eight components

Shared rules: no string literals; every word, message and accessible name is a prop. Variants are a lookup object of complete class strings (Tailwind must see whole class names). No component takes `className` for colours; `Slip` and `Row` accept `className` for layout only. Motion: `transition` on transform only, 80ms linear, `motion-reduce:transition-none` (open question 11d: still moves, instantly).

**Button** (`button.tsx`, no client directive)
- Props: `variant: "send" | "record" | "outline"`; `children`; `iconStart?`, `iconEnd?` (nodes, wrapped `aria-hidden`); `href?` (renders `<a>`); `busy?` with `busyLabel` (a union type makes `busyLabel` required when `busy` can be true); `disabled?`; `disabledReason?`; native attributes pass through.
- Element: `<button type="button">` by default, `<a href>` with `href`.
- States: rest by variant classes; pressed by the `pressed` variant (`translate 5px 5px`, shadow none); focus by the `ring` variant (`outline` 3px, offset 4px, colour from the ground variable); busy sets `aria-busy="true"` and `aria-disabled="true"`, swaps the label for `busyLabel`, and the click handler returns early (the button stays focusable, so focus is not lost mid-save); disabled uses the native `disabled` attribute and the dashed look; `disabledReason` renders a line below with an id from `useId`, joined by `aria-describedby`. A disabled link renders as `<span role="link" aria-disabled="true">` with no `href`.
- `RoundButton`: `label: string` (required, becomes `aria-label`), `icon`, optional `href`. 48px circle, `send` colours, `shadow-round`. Criterion 24 is met by the type plus a unit test with `@ts-expect-error`.
- Text wraps (`whitespace-normal`, `overflow-wrap: anywhere`), `min-h-control`, vertical padding so it grows.

**Field** (`field.tsx`)
- Props: `label`; `state?: "idle" | "correct" | "error"`; `stateLabel?` (the words for "needs fixing" or "correct", required by type when `state` is not idle); `message?`; `helper?`; native `<input>` attributes.
- Element: `<label htmlFor>` above an `<input>`; ids from `useId`. `aria-describedby` lists helper and message; `aria-invalid="true"` in error. The tick and the error mark are inline SVG, `aria-hidden`; `stateLabel` is real text (visible in error next to the label, visually hidden in correct), so the mark is never the only signal.
- States: typing is `focus-within` (or `data-force="focus"`). Line weight is 2, 4 or 3px: the input has a fixed 4px bottom slot, `border-bottom-width` changes and `padding-bottom` makes up the difference, so the height never moves (criterion 31). The message line reserves one line of height in every state.

**Slip** (`slip.tsx`)
- Props: `joined?: boolean`; `as?: "div" | "section" | "article"`; `id`, `role`, `aria-labelledby` pass through (it is the tab panel under Tabs).
- `joined` drops the shadow; the selected tab overlaps the slip's top border by 2px, which is what removes the line.

**Row** (`row.tsx`)
- Exports `Rows` (`<ul>`) and `Row` (`<li>`). Props: `name`; `meta`; `tone: "overdue" | "due" | "paid"`; `amount?: string`; `trailing?` (node); `href?`.
- With `href`, name, meta and amount sit inside one `<a>` (`min-h-tap`, `flex-1`, `min-w-0`) and `trailing` is its sibling, outside the link: two targets, no nested interactive elements (criterion 39). Amount and trailing are `shrink-0` and `whitespace-nowrap`; name and meta wrap with `overflow-wrap: anywhere`.
- Amount uses `type-amount-row` and `translate="no"`.

**StatusTag** (`status-tag.tsx`)
- Props: `status: "overdue" | "due" | "part-paid" | "paid"`; `children` (the words). A `<span>`. No role: it is text.
- Border style is the mark: solid, none plus fill, dashed, double. The double border must be wide enough that both lines show on a phone (start at 6px; confirm in H5).

**Stamp** (`stamp.tsx`)
- Props: `size: "sm" | "md" | "lg"`; `tone: "stamp" | "blue"`; `children` (the word); `secondLine?` (not allowed by type on `sm`); either `label: string` or `decorative: true` (a union: one is required); `animate?`.
- Element: `<span role="img" aria-label={label}>`, or `aria-hidden="true"` when decorative.
- Sizes in rem so the circle grows with text: 3.25 / 8.25 / 14.5rem (52 / 132 / 232px at default size; open question 5). Rotation -12°. `animate` adds a 200ms keyframe class defined only inside `@media (prefers-reduced-motion: no-preference)`.

**Tabs** (`tabs.tsx`, client)
- Props: `tabs: { id; label; count? }[]`; `value`; `onChange(id)`; `label` (name of the tab list); `panelId`. Controlled only.
- Pattern: WAI-ARIA tabs. `<div role="tablist" aria-label>`; each tab a `<button role="tab" aria-selected aria-controls>` with roving `tabIndex`; Left, Right, Home, End move and select. The `Slip` below gets `role="tabpanel"` from the screen.
- Layout: grid, equal columns (`minmax(0, 1fr)`), items stretched, so all tabs share the tallest height; unselected tabs have a 4px top margin, which keeps the selected one 4px taller at any text size (48 against 44 at default). Labels wrap (open question 7).
- The count on an unselected tab uses `ink-soft`, not `ink-label` (section 12).

**Sheet** (`sheet.tsx`, client)
- Props: `open`; `onClose()`; `title`; `closeLabel`; `context?: { label; title }`; `children`.
- Element: native `<dialog aria-labelledby={titleId}>` opened with `showModal()`. No library, no hand-written focus trap.

| Requirement (criterion 55) | How |
| --- | --- |
| Announced as a named dialog | `<dialog>` has the dialog role; `aria-labelledby` points at the `<h2>` title. |
| Focus moves in | `showModal()` focuses the first focusable element, or the one the screen marks `autoFocus`. |
| Focus stays in | A modal dialog makes everything outside it inert; Tab cannot leave. |
| Focus returns | The browser restores focus to the opener when the dialog closes. |
| Escape | Native: fires `cancel`, then `close`. The component listens for `close` and calls `onClose`, so every way of closing takes one path. |
| Page behind cannot be reached | Inert, as above; taps on the dark ground do nothing (native default; matches open question 8). |
| Page behind cannot scroll | `html:has(dialog:modal) { overflow: hidden }` in `states.css`, and `overscroll-behavior: contain` on the panel. This is the one part the platform does not do for us. |
| Back gesture (open question 8) | Chrome on Android 126 and later closes a modal dialog on back by itself. We add no history handling in F2. On older Chrome, back leaves the page; revisit in R1-7 if H9 shows it matters. |

- Structure: the dialog fills the screen (`sheet-ground` fill, no default border or padding, `max-width`/`max-height` reset), a column aligned to the bottom: the optional context header (`on-dark-ground`, so rings inside are yellow), then the panel (`slip`, 2px `ink` top border, `max-height` in `dvh`, `overflow-y: auto`) with a sticky top bar holding the title and the close `<button>` (`min-h-tap`). Sticky is what keeps the close control reachable when content is long (criterion 56).
- An effect syncs `open` to `showModal()` / `close()`. Children render only while open.

### 8. `/dev/components`

**Structure.** One long page, sections in this order: colour tokens (swatch, name, hex read from `tokens.css` at build), type roles, the ₹ block (headline, reading and row size; alone and inside each script), then one section per component. Each component section shows its variants in English, then repeats the text-bearing examples inside `<div lang="hi">`, `lang="kn">`, `lang="te">` blocks with the long label. Sections carry `data-testid` so tests can scope to them. F2b appends five sections; nothing else changes.

**Forced states.** Pressed and focus: `data-force="pressed"` / `data-force="focus"` on the example (section 4). Busy and disabled: the real props. Field "typing": `data-force="focus"` on the field. A cloth block and a dark block (`on-cloth-ground`, `on-dark-ground`) repeat a button with forced focus to show the yellow ring and the `cloth-deep` shadow. Sheet: an "open" button, plus a static, non-modal copy of the panel markup so the look is visible without opening it. Stamp: one static, one with a replay button.

**Keeping it out of production (verified by build).** In `next.config.ts`:

```ts
const includeDevRoutes = process.env.VERCEL_ENV !== "production";
pageExtensions: includeDevRoutes ? ["dev.tsx", "tsx", "ts", "jsx", "js"] : ["tsx", "ts", "jsx", "js"],
```

The page file is `page.dev.tsx`. With `dev.tsx` in the list Next treats it as the page for `/dev/components`; without it the file is not a page and the route does not exist. Results of the two builds: with the extension, the route table lists `/dev/components` and `out/dev/components/index.html` exists with `<meta name="robots" content="noindex, nofollow">`; without it, the route table has only `/` and `/_not-found`, there is no `out/dev/`, and the sample text appears nowhere in `out/`. A request for it gets `404.html`. `pageExtensions` is a documented option for the App Router; the docs describe this "extra extension" use only in their Pages Router section, which is why I tested it rather than trusting it.

`VERCEL_ENV` is set by Vercel during its builds (`production` or `preview`); it is unset locally and in CI, so the page is present there. The CI step in section 3 proves the production build has no `out/dev`. The files beside the page are ordinary modules; with the page gone nothing imports them, so none of their code ships.

Fallback if a later Next version stops honouring this: a post-build step that deletes `out/dev/` when `VERCEL_ENV=production`. It is worse (the chunks stay in `out/_next/`, unreachable but present), so it is only a fallback.

### 9. Dependencies

**Runtime: none added.** Fonts use `next/font`, part of Next. The sheet uses `<dialog>`. Class joining is a five-line helper. No font subsetting tool: not at build time either.

**Dev-only, already approved:** `@testing-library/react` and `@testing-library/user-event`. The build plan's dependency table approved "Vitest + Testing Library" on 2026-10-09, but F1 installed only Vitest. `frontend-dev` installs both at exact pinned versions. Policy check: dev-only, so nothing reaches users; maintained by the Testing Library organisation with several maintainers; replaceable without touching product code. No `jest-dom`: plain assertions are enough. This is not a new request, but the founder should know it is the first install since F1.

### 10. Bundle budget

- `/`: fonts and tokens add **no JavaScript** (a class string on `<html>`). The throwaway build with all five families and a partial theme measured **132.1 KB** for `/`, unchanged from F1. The home page imports no component. Expect 132 to 133 KB.
- `/dev/components`: only `tabs.tsx`, `sheet.tsx` and `demos.tsx` are client code; the other components and all sample text render at build time and add HTML, not script. Estimate **+3 to 5 KB** for F2a (about 136 KB) and **+6 to 9 KB** with all thirteen after F2b (about 140 KB), well inside 200 KB. The HTML itself will be large (four scripts times thirteen components); that is not in the budget and does not matter for an internal page.
- CSS: about 3.5 KB gzipped in the test build, expected 8 to 12 KB with everything. Not counted by the PRD.
- **`scripts/size.mjs` stays JavaScript-only.** The PRD's limit is JavaScript. Fonts are reported separately by `pnpm fonts:report`; once the founder sets a per-language ceiling (open question 10) that script gains a limit and joins CI. Until then it does not fail the build.
- `frontend-dev` records the real `pnpm size` figures for both routes under criterion 67.

### 11. Build order (each step leaves lint, typecheck, unit tests, build, size and e2e green)

1. Tokens: `src/styles/tokens.css`, `read-tokens.ts`, `tokens.test.ts`, `contrast.ts` and its test, `globals.css` as imports, `scripts/check-tokens.mjs` wired into `pnpm lint`, home page moved off `text-3xl`. (Criteria 1, 2, 5, 6, 7, 8.)
2. Fonts and type: `fonts.ts`, `layout.tsx`, `type.css`, `states.css`, `public/licenses/fonts.txt`, `scripts/font-report.mjs`. (3, 9, 10, 12, 13, 14, 15.)
3. Dev page shell: `pageExtensions`, `page.dev.tsx` with the tokens, type and ₹ sections, `sample-data.ts`, the CI production-build step, `e2e/fonts.spec.ts` and the first part of `e2e/dev-components.spec.ts`. (4, 11, 58 in part, 59, 60, 61, 65.)
4. `serve:lan` and the `HOST` change. **Stop here for H3 on the phone** and record the result and the font report in this spec. If the ₹ beside DM Mono digits looks wrong, the change is one line (section 13, first risk).
5. Testing Library installed; `cx`; `Button` and `RoundButton` with tests and their page section. (17 to 25.)
6. `Slip`, `StatusTag`, `Stamp`. (33 to 35, 41 to 48.)
7. `Field`, `Row`. (26 to 32, 36 to 40.)
8. `Tabs`, then `Sheet`. (49 to 57.)
9. Whole-page checks: 130% scale, reduced motion, target sizes, greyscale, no-strings test, `pnpm size` recorded. (62, 63, 64, 66, 67.) Then hand checks H1 to H11.

`frontend-dev` owns the code and the unit tests written beside it in steps 1 to 8; `test-engineer` owns `e2e/` and fills any gap in section 12's map.

### 12. Tests required

Playwright runs in the existing `phone` project (360 by 740, touch, Chromium) against `out/`.

| Criteria | Proved by | How |
| --- | --- | --- |
| 1, 3, 5, 6, 7, 15 | Vitest, `tokens.test.ts` | Parse `tokens.css`; compare colours with the table parsed from `docs/DESIGN.md`; assert roles, the four radii, zero third length in every shadow, the three sizes, the stack endings. |
| 2 | Vitest for the detector, `pnpm lint` for the repo | Sample strings that must and must not be flagged. |
| 8 | Vitest, `contrast.test.ts` | Every listed pair at 4.5 or 3. A failing pair fails the test and is reported, not "fixed". Current results below. |
| 4, 62 | Playwright | Walk every text node for computed `font-size` ≥ 14; every `a`, `button`, `input`, `[role=tab]` box ≥ 44 by 44. |
| 9, 11 | Playwright, `fonts.spec.ts` | Record every request: all same-origin. On `/`: no `FontFace` whose family starts with "Anek" has status `loaded`. On the dev page: all three do. |
| 12 | Playwright | Delay `**/*.woff2` by 3 s with `page.route`; text has a non-empty box and is visible before the fonts arrive; every `document.fonts` entry has `display === "swap"`. |
| 13, 14, 43, 48 | Playwright, computed styles | Inside each `lang` block: first family is the Anek face (compare with the family names in `fonts.ts`, not literals), `letter-spacing` 0, `text-transform` none, weights, sizes and line-heights; the amount inside keeps Bricolage and -0.04em. |
| 16, 40, 60 | Playwright via CDP `CSS.getPlatformFontsForNode`, plus manual H3 | Which face drew ₹ and the digits at the three sizes. Look and weight: H3 on the phone. |
| 10 | Manual | Read the table in section 5 against `pnpm fonts:report`. |
| 17, 19, 22, 23, 24 | Vitest + Testing Library | Variant classes; renders `<a>` with `href`; icon order; busy sets `aria-busy`, shows `busyLabel`, a second click does not call the handler; disabled; `aria-describedby`; `RoundButton` without `label` is a type error. |
| 18, 20, 21, 25 | Playwright | Long label: button height grows, `scrollWidth` equals `clientWidth`. Pressed: `mouse.down()` then read transform and shadow, and `transition-duration` is 80ms. Focus: Tab shows a 3px outline at 4px offset, a tap does not; ring colour on page, cloth and dark blocks. Shadow colour on cloth. |
| 26, 29, 30 | Vitest | Label tied to input; `aria-invalid`; `aria-describedby`; state words present as text. |
| 27, 28, 31, 32 | Playwright | Line width and colour per state; the four fields have equal outer height and the element after each sits at the same offset. |
| 33, 34, 35, 61 | Playwright | Border, shadow; joined form; `scrollWidth - clientWidth` is 0 for the page. |
| 36, 37 | Vitest | Structure; tone class; meta text always rendered. |
| 38, 39 | Playwright | Long name wraps and the row grows; amount stays on one line; link and action are separate, each ≥ 44px, each reached by Tab. |
| 41, 42 | Vitest for the four statuses; Playwright for border style (solid, dashed, double) and fill | Greyscale: apply `filter: grayscale(1)` and attach a screenshot to the report for a person to look at; **no pixel comparison in CI** (baselines differ between macOS and the Linux runner). H5 is the real check. |
| 44, 45, 46 | Vitest | Sizes, tone, second line only on md and lg, `role="img"` with label or `aria-hidden`. |
| 47, 64 | Playwright | With `animate`: `animation-duration` 200ms, one iteration. With `emulateMedia({ reducedMotion: "reduce" })`: `animation-name` is `none`, button `transition-duration` is 0s. |
| 50, 51 | Vitest | `aria-selected`, roving tabindex, arrow keys, `onChange` called with the id. |
| 49, 52 | Playwright | Heights 48 and 44, fills; three long labels: no overflow, equal tab bottoms. |
| 54 | Vitest (with a small `showModal`/`close` stub if jsdom lacks them) | Title, close words, context header rendered from props. |
| 53, 55, 56, 57 | Playwright (real browser; do not rely on jsdom for dialog behaviour) | Role dialog with a name; focus inside after open; Tab ten times stays inside; Escape closes; focus back on the opener; `window.scrollY` unchanged after a wheel event while open; tall content: close control still in view after scrolling the panel; ring colour in the header. |
| 58, 59, 65 | Playwright | Each section test id present; each `lang` block present; robots meta; home page has no link to `/dev`. Production exclusion: the CI build step. |
| 63 | Playwright + manual H4 | Set `document.documentElement.style.fontSize = "130%"`, then: no sideways scroll, and for every element `scrollWidth ≤ clientWidth` and no `text-overflow: ellipsis`. This is only an approximation of Android's font-size setting, which is why all sizes are rem and why H4 on a phone stays mandatory. |
| 66 | Vitest | A test reads each file in `src/components/ui/` and fails on JSX text or string-literal attribute values for `aria-label`, `title`, `placeholder`, `alt`; `rg` for the product name outside `brand.ts`. `pnpm i18n:check` unchanged. |
| 67 | `pnpm size` | Both routes; numbers recorded here. |
| 68, 69 | Review | `package.json` diff; a search for `transition`, `animate` and `@keyframes`. |

**Contrast results so far** (computed from the token values; the unit test will repeat them). All text pairs the eight components use pass 4.5:1; the lowest are `on-cloth` on `cloth` 5.92, `stamp` on `page` 5.83 and `ink-label` on `page` 5.97. Focus rings: `blue` on `page` 10.5, `highlight` on `cloth` 4.48, on `blue` 7.15, on `ink` 11.1, on `sheet-ground` 11.3; all pass 3:1. Two things to report, as criterion 8 asks:

- `ink-label` on `tab-idle` is **4.45:1, just under AA**. The plan avoids the pair (unselected tab text and count use `ink-soft`, 6.95:1). Nobody should put `ink-label` text on `tab-idle`.
- The Due tag's `highlight` fill against `slip` is 1.5:1, so its edge is faint. The tag's words (`ink` on `highlight`, 11.1:1) carry the meaning, so I read this as a pass, but the founder may want a look in H5.

### 13. Risks and traps

| Risk | Mitigation |
| --- | --- |
| ₹ from Bricolage beside DM Mono digits looks mismatched in rows | H3 after step 4, before components. If it fails: change `type-amount-row` to Bricolage with `font-variant-numeric: tabular-nums` (one utility in `type.css`, no component change), and ask the founder, since it reverses the row-amount decision. |
| Hindi needs about 300 KB of Anek font on top of the 77 KB every page loads | Not preloaded, `swap`, so Hindi text shows at once in the phone's own Devanagari face. Reported to the founder for a ceiling. The lever, if a ceiling demands it, is section 14's "committed files" route. |
| The build needs `fonts.googleapis.com` every time; CI has no cache | Accepted for now: it is Next's documented path. If CI flakes on it, or Google ships a new font version that changes a checked glyph, switch to font files committed under `src/styles/fonts/` with hand-written `@font-face` rules. That keeps the same CSS variables, so nothing outside `src/styles/` changes. The CDP font test catches a silent change. |
| Next's generated fallback faces: observed, not documented, that `fallback` removes them | The CDP test in `fonts.spec.ts` fails if the ₹ in a row is ever drawn by anything but Bricolage. |
| Tailwind 4 cannot switch off arbitrary values (`text-[13px]`) | `check-tokens.mjs` in `pnpm lint`. |
| Tailwind scanning `design/` and `docs/` and emitting stray classes | `source("..")` on the import. |
| A class name built from pieces (`"bg-" + variant`) is never generated | Variant lookup objects with whole class strings; reviewers reject concatenation. |
| The pressed button's 5px move adds sideways scroll when the button touches the right edge (transforms count towards scroll width; shadows do not) | The dev page and every screen keep at least 20px side padding; criterion 61 is tested with a button held pressed. |
| A small stamp (52px) cannot hold a long word at 14px | sm takes one short word; the page shows the longest sample per script; if a script's word does not fit, report it rather than shrink the text. Sizes are rem so the ring grows with the text. |
| jsdom may not implement `showModal()` | Dialog behaviour is tested in Playwright; the unit test stubs the two methods if needed. |
| Vercel "promote" could reuse a preview build that contains the dev page | F4 and `release-manager`: production must be its own build with `VERCEL_ENV=production`; the smoke test already checks the route is not found. Carry this into the F4 spec. |
| F3 moves pages under `[locale]` | The dev page stays at `src/app/dev/components/` outside the locale segment and sets `lang` per block itself; the font and type rules key off `lang` attributes, not routes, so they carry over. |
| Indian-script vowel marks clipped by tight line-height or `overflow: hidden` | No component sets `overflow: hidden` on text; headline line-height is 1.3 in the three scripts; H6. |
| 130% emulation differs from Android's real setting | rem everywhere; H4. |

### 14. Not doing

- The five added components (planned separately; F2b).
- Anek Latin as a font file. A subsetting tool. Committed font files (kept as the fallback route only).
- A font byte budget in CI, until the founder sets the ceiling.
- History handling for the back gesture, a tap-outside-to-close, a drag handle or a slide-in animation on the sheet.
- A flat button form, a green variant, compact shadows other than on the round button (open question 6; the flat form arrives with `Banner` in F2b).
- An icon set or icon library. `clsx`, `tailwind-merge`, a variants library, a headless UI library.
- Pixel-comparison screenshot tests.
- Dark mode, a theme switch, `className` colour overrides on components.
- Wiring `messages/*.json` or next-intl (F3). Editing `docs/DESIGN.md`, `CLAUDE.md` or `docs/BUILD_PLAN.md`: the corrections below are for `product-manager` and the founder.

### 15. Where I differ from the spec, and what the founder should know

1. **Open question 10 and criterion 15.** Anek Latin is not needed and is not shipped; DM Mono has no ₹ and Bricolage supplies it. The stack still ends in the name `'Anek Latin', system-ui` so criterion 15 passes as written. Recommend removing the name from `docs/DESIGN.md` after H3.
2. **Criterion 10, "subset at build time".** Met with Google's per-script subset files fetched at build, not by a tool of ours.
3. **Font weight per language** (section 5): English 77 KB, Kannada about 230 KB, Telugu about 260 KB, Hindi about 380 KB on a first visit. The founder sets the ceiling. If Hindi must come down, the options are committed files without Anek's Latin subset (saves about 45 KB per language, costs hand-kept `@font-face` rules) or a lighter Devanagari face (a design change).
4. **Browser floor** (section 6): Chrome 111, iOS 16.4. Android 6 and older, and iPhones older than the iPhone 8, are not supported. The PRD does not say so; confirm.
5. **Criterion 2** is a script inside `pnpm lint` plus a unit test of its detector, not an ESLint rule.
6. **Criterion 42**: the greyscale screenshot is attached for a person; the automatic assertion is on border style and fill.
7. **Criterion 31**: the field reserves one line for its message in every state. A message that wraps to two lines makes that field taller; I do not think that can be avoided without truncating.
8. **Open question 8**: the back gesture is whatever Chrome does natively (closes the sheet on Chrome 126 and later). No code of ours.
9. **Open question 5**: stamp sizes are in rem (52 / 132 / 232px at default text size) so they grow with the text.
10. **Two tokens added** beyond the 17: `blue-pressed`, `sheet-ground` (open question 11b). `docs/DESIGN.md` should list them.
11. **Token files live in `src/styles/`**, a folder `src/CLAUDE.md` does not list yet. It should be added to that file's layout block.
12. **Testing Library** gets installed (approved in the build plan, never installed).
13. Remaining open questions (1, 3, 6, 7, 9, 11): planned on the recommendations as written; no technical objection.

### 16. Start

`frontend-dev` starts with **step 1 (tokens)** of section 11. No `backend-dev` task exists in this slice. `test-engineer` can begin `e2e/fonts.spec.ts` as soon as step 3 lands. The plan for criteria 70 to 93 follows from `tech-lead` once requested.

## Technical plan — F2b

Written by `tech-lead` on 2026-10-09. Covers criteria 70 to 93: `Segmented`, `StudentStrip`, `Switch`, `BottomNav`, `Banner`. It is a second pull request that starts after F2a has merged, and it builds on the F2a plan above without changing it: same tokens, type roles, ground utilities, forced-state variants, check script and dev page. Planned on the recommendations in open questions 6 and 14 to 18; where I differ it is said in section 9. There is no backend work; every task is `frontend-dev`. No dependency is added.

### 1. Approach

Each of the five is a native element with the matching ARIA pattern and no hooks, so none needs `"use client"`: a group of real radio inputs for `Segmented`, a `<button role="switch">` for `Switch`, a `<nav>` of links for `BottomNav`, a labelled image for `StudentStrip`, and `role="status"` or `role="alert"` for `Banner`. Selected and current looks are driven by the native state (`:checked`, `aria-checked`, `aria-current`) in CSS, not by duplicated class logic. The flat buttons that `Banner` needs are one small addition to `button.tsx`, kept away from screens until open question 6 is settled.

### 2. Files (all `frontend-dev`)

Create:

| File | What goes in it |
| --- | --- |
| `src/components/ui/segmented.tsx`, `segmented.test.tsx` | `Segmented`. |
| `src/components/ui/student-strip.tsx`, `student-strip.test.tsx` | `StudentStrip` and the pure function `stripColumns(count)`. |
| `src/components/ui/switch.tsx`, `switch.test.tsx` | `Switch`. |
| `src/components/ui/bottom-nav.tsx`, `bottom-nav.test.tsx` | `BottomNav`. |
| `src/components/ui/banner.tsx`, `banner.test.tsx` | `Banner`, with its offline mark as an inline SVG (a picture, not a word). |
| `src/app/dev/components/sections/segmented.tsx`, `student-strip.tsx`, `switch.tsx`, `bottom-nav.tsx`, `banner.tsx` | One section each, appended after the Sheet section, each with a `data-testid`. |
| `e2e/dev-components-f2b.spec.ts` | Playwright flows for 70 to 93 (section 6). |

Change:

| File | Change |
| --- | --- |
| `src/styles/tokens.css` | One shadow: `--shadow-banner-error: 5px 5px 0 var(--color-cloth)` (open question 17a). No new colour: the Switch's off track is the existing `tab-idle` (open question 14). |
| `src/styles/type.css` | Nothing, if F2a takes the correction in section 10 (a 14px reading role, `type-caption`). If F2a merged without it, add it here. |
| `src/styles/states.css` | `@utility strip-grid` (grid whose column count comes from a `--cols` variable) and an inset form of the focus ring, `ring-inset` (section 3). |
| `src/styles/tokens.test.ts`, `contrast.ts` | Allow the new shadow by name; add the pairs in section 6. |
| `src/components/ui/button.tsx`, `button.test.tsx` | Add `FlatButton` (section 3, Banner). `Button` itself is unchanged. |
| `src/app/dev/components/page.dev.tsx` | Import the five sections. |
| `src/app/dev/components/demos.tsx` | The examples that need state or handlers: a working Switch, a controlled Segmented, banner actions. |
| `src/app/dev/components/sample-data.ts` | Words for the five in four scripts, each with one long label; strip data for 0, 1, 23 and 60 students. |
| `src/app/dev/components/sample-icons.tsx` | The four bottom-nav icons, redrawn from `Nav.dc.html`, 24px, `currentColor`. They move to a shared place when R1-6 builds the real bar. |

Not touched: `next.config.ts`, `package.json`, CI, `scripts/`, `messages/*.json`, fonts.

### 3. The five components

Shared with F2a: no words of their own; lookup objects of whole class strings; text wraps with `overflow-wrap: anywhere`; sizes in rem so they grow with text; no disabled state (open question 18); no motion at all in these five.

**Focus ring inside a bordered group.** Criterion 21's ring sits 4px outside the control. For a segment inside the group border and for a bottom-nav item at the screen edge, an outside ring is either clipped or lands on the neighbour. Both use `ring-inset`: the same 3px ring drawn 3px inside the item. Colour is chosen for the fill it sits on: `blue` on `slip` (10.8:1), `highlight` on an `ink` fill (11.1:1). `blue` on `ink` is 1.5:1 and must not be used.

**Segmented** (`segmented.tsx`)
- Props: `label` (visible legend); `name`; `options: { value; label; detail? }[]` (two to four, enforced by a tuple type); `value` with `onChange(value)`, or `defaultValue` for uncontrolled use.
- Element and ARIA: `<fieldset>` with `<legend>` in the label role; each segment is a `<label>` wrapping a visually hidden `<input type="radio">` and its text. This is a native radio group: the browser gives arrow keys, one-of-many selection, "selected, 2 of 4" to screen readers, and form submission, with no script of ours. The canvas uses `aria-pressed` buttons; radios are the correct pattern for "exactly one".
- States: selected is `has-[:checked]:bg-ink has-[:checked]:text-slip` on the label; focus is `has-[:focus-visible]` (or `data-force="focus"`) with `ring-inset`, `blue` on an unselected segment and `highlight` on the selected one.
- Layout: the group is a 2px `ink` border, 4px corners, `overflow: hidden` (safe, because the ring is inset). Inside is a grid pulled up and left by 2px, and every segment has a 2px top and left border; the group border hides the outer ones. This draws the lines between segments for any arrangement and needs no fill on unselected segments. Two or three options: one row of equal columns. **Four options: two columns, becoming four when the group's own width is at least 28rem** (a container query, inside the browser floor). Segments are `min-h-tap`, stretched to equal height; `detail` is a second line in `type-caption`.

**StudentStrip** (`student-strip.tsx`)
- Props: `blocks: ("paid" | "due" | "overdue")[]`, in the order to draw; `legend: { paid; due; overdue }` (all three required by type, so it cannot render without its legend); `label` (the text alternative, required).
- Element and ARIA: a wrapper `<div>`; inside it `<div role="img" aria-label={label}>` holding one `<span aria-hidden="true">` per block, then the legend as ordinary text. Blocks are spans: not focusable, not tappable. `blocks.length === 0` renders nothing.
- Layout: `strip-grid`, 3px gap, items aligned to the bottom, row height 1.5rem. Paid: 0.875rem tall, `stamp` fill. Due: 0.875rem tall, `slip` fill, 2px `ink` border. Overdue: 1.5rem tall, `cloth` fill. Part paid has no shape (open question 15): the screen passes `due` or `overdue`.
- Many students (open question 15): `stripColumns(count)` returns the columns per row: `count` up to 28; above that, the count is split into equal rows of at most 28 (60 students gives 3 rows of 20). At 360px with 20px page padding a block is then never narrower than 8px, so a hollow block keeps at least 4px of hollow inside its 2px border. A block is capped at 1.5rem wide so one student is not a 320px bar. The number 28 assumes the strip is at least 20rem wide; that is every phone layout we have.

**Switch** (`switch.tsx`)
- Props: `checked`; `onChange(next)`; `onText`; `offText`; and either `label` (becomes `aria-label`) or `labelledBy` (id of visible text on the screen). One of the two is required by a union type.
- Element and ARIA: `<button type="button" role="switch" aria-checked>`. Space and Enter work because it is a button. The knob's word is `aria-hidden`: the state is already announced from `aria-checked`, and "Automatic reminders, switch, on, ON" would say it twice.
- States: from `aria-checked` in CSS. On: `stamp` track, knob at the right. Off: `tab-idle` track, knob at the left. No transition (criterion 82).
- Layout: minimum 4.75rem by 2.75rem (76 by 44px at default text size), 2px `ink` border, 4px corners, 3px padding. The knob is a `slip` block with a 2px `ink` border holding **both words stacked in one grid cell, the inactive one invisible**. The knob is therefore as wide as the longer word, the switch grows wider for a long Hindi, Kannada or Telugu word (criterion 83), and its width does not change when it is toggled. Knob text is `type-caption` at weight 800.

**BottomNav** (`bottom-nav.tsx`)
- Props: `label` (the landmark's name); `items: { home; students; attendance; more }`, each `{ href; label; icon }`; `current: "home" | "students" | "attendance" | "more"`. Named keys, not an array, fix the order the criterion demands.
- Element and ARIA: `<nav aria-label={label}>` with a four-column grid of `<a href>`; the current one has `aria-current="page"`. Icons are wrapped `aria-hidden`.
- States: current is driven by `aria-current` in CSS: 5px `cloth` top bar and `ink` text; the others have a 5px transparent bar (so labels line up) and `ink-label` text. Focus: `ring-inset` in `blue`.
- Layout: `slip` ground, 2px `ink` top border, `min-h-row`, each link fills its whole cell (`min-h-row`, stretched), icon above label, label in `type-caption` at weight 700, wrapping. Bottom padding of `env(safe-area-inset-bottom)`. The component does not position itself; the screen pins it (R1-6).
- Links are plain `<a>`, as in F2a's `Button`. When F3 and R1 bring a locale-aware client-side link, both components get it in the same change.

**Banner** (`banner.tsx`)
- Props, a union on `kind`:
  - `{ kind: "offline"; title; detail }`
  - `{ kind: "error"; title; detail; actions?: [Action] | [Action, Action] }` — first is the main action.
  - `{ kind: "undo"; message; actions: [Action, Action] }` — first is the outlined one, second the filled one.
  - `Action = { label; onClick?; href?; icon? }`.
- Element and ARIA: offline and undo are `<div role="status">` (polite). Error is `<div role="alert">` (announced at once). The offline mark is an inline SVG, `aria-hidden`, in `highlight`.
- Looks: offline is a square full-width `ink` strip, title `slip` 16px bold, detail `on-cloth` in `type-caption`. Error is `slip` with a 2px `cloth` border and `shadow-banner-error`, title `cloth` 18px at weight 800, detail `ink-soft`. Undo is `ink` with 4px corners, message `slip` 16px bold. Offline and undo carry `on-dark-ground`, so any focus ring inside is `highlight` (criterion 93) by the F2a mechanism.
- Actions use `FlatButton`. They sit in a wrapping flex row, stretched to equal height; the main action takes the spare width. If both labels are too long to share a row at 130%, the second drops below instead of being squeezed or cut. The canvas's fixed 96px and 110px columns are not copied: they cannot hold a translated label.
- No timer, no close logic, no positioning (open question 17b, 17c).

**`FlatButton`** (added to `button.tsx`; open question 6)
- Props: `look: "record" | "outline" | "outline-on-dark" | "slip-on-dark"`; `children`; `icon?`; `href?`; native attributes. Shares `Button`'s base classes through one constant in the file: 2px border, 4px corners, `min-h-control`, wrapping text, the same ring.
- No shadow. Pressed: moves 2px right and down in 80ms through the `pressed` variant, instant under reduced motion. No busy and no disabled form.
- It is exported only because `Banner` lives in another file. A unit test fails if any file other than `banner.tsx`, its test, and the dev page imports `FlatButton`. That is how "not offered to screens yet" is kept true.

### 4. Adding them to `/dev/components`

Five sections after Sheet, same shape as the F2a sections: English first, then `lang="hi"`, `lang="kn"`, `lang="te"` blocks with the long label.

- Segmented: two, three and four options; one with two-line segments; the four-language group (shows the two-by-two form at 360px); forced-focus examples on a selected and on an unselected segment.
- StudentStrip: 1, 23 and 60 students, and a note where the empty one would be (it renders nothing; the test checks the container is empty).
- Switch: on and off side by side, one working example, and the long-word examples per script.
- BottomNav: shown in the page flow, not pinned, once per language, with a different current item in each; one forced-focus item.
- Banner: the three kinds; error with one action and with two; undo with a link and icon as its second action; each kind once per script with long text.

Static examples render from the server sections. Anything that takes a function (a working Switch, banner actions, a controlled Segmented) renders from `demos.tsx`. Note for whoever opens the page with a screen reader: the three banners are live regions and may all be announced on load. That is expected on this page only.

### 5. Bundle

None of the five has client code of its own, but the examples in `demos.tsx` pull `Switch`, `Banner`, `FlatButton`, `Segmented` and their sample words into the client bundle. Estimate **+3 to 4 KB** on `/dev/components` over F2a, about **139 to 141 KB** in all, in line with the F2a estimate for thirteen. `/` does not change. `frontend-dev` records the real `pnpm size` figures under criterion 67 again.

### 6. Tests required

Playwright in the existing `phone` project at 360px against `out/`. Criteria 58, 61, 62, 63 and 66 from F2a are re-run over the longer page; the F2a tests already walk the whole page, so they need no new code, only to stay green.

| Criteria | Proved by | How |
| --- | --- | --- |
| 70 | Vitest + Playwright | Renders one radio per option, exactly one checked. Computed fill and text colour of checked and unchecked; 2px lines between; equal widths. |
| 71, 72 | Playwright | Every segment ≥ 44px; long and two-line labels: all segments in a row share one height, no overflow. Four options at 360px: two rows of two (compare bounding boxes). |
| 73 | Vitest | `fieldset` named by its legend; radios share `name`; clicking and arrow keys call `onChange` with the value. |
| 74 | Playwright | Tab to the group: outline is 3px and inside the segment's box, on a selected and on a forced unselected segment. Greyscale: computed fills differ (`ink` against none); screenshot attached for a person. |
| 75 | Vitest + Playwright | One span per block with its kind; computed heights 14px and 24px, fills, the hollow one has a 2px border; bottoms equal. |
| 76, 77 | Vitest | Omitting `legend` or `label` is a type error (`@ts-expect-error`); `role="img"` with the label; blocks `aria-hidden`, no `tabindex`, no handlers; the three legend texts present. |
| 78 | Playwright + manual H13 | Heights and fills as above under `filter: grayscale(1)`; screenshot attached. |
| 79 | Vitest for `stripColumns` (0, 1, 23, 28, 29, 60); Playwright | No sideways scroll for 1, 23, 60; every block ≥ 8px wide; empty input leaves the container empty. |
| 80, 81 | Playwright | Box ≥ 76 by 44; track colour on and off; knob left or right of centre; knob text 14px at weight 800. |
| 82 | Vitest + Playwright | `role="switch"`, `aria-checked`, the passed-in name; click, Space and Enter call `onChange` with the opposite value. `transition-duration` is 0s. |
| 83 | Playwright | Long word per script: knob `scrollWidth` equals `clientWidth`, font size ≥ 14px, switch wider than 76px, and the same width in both states. |
| 84, 85, 86 | Vitest | `nav` with the name; four links in order with their `href`; `aria-current="page"` on exactly one; icons `aria-hidden`. |
| 84, 85, 86, 87 | Playwright | Height ≥ 64px; four equal columns; each link's box is its whole column; current item has a 5px top bar and the others none visible; inset ring on Tab; long labels in four languages and at 130%: bar taller, no overflow. |
| 88, 89, 90, 91 | Vitest | A fourth `kind` is a type error; roles `status`, `alert`, `status`; offline has no buttons; error takes zero, one or two actions; undo's second action renders `<a>` with `href` and its icon; no red class on any action. |
| 89, 90, 91, 92 | Playwright | Grounds, borders, the error shadow has zero blur and `cloth` colour; actions ≥ 48px and equal height; long Telugu detail at 130%: actions still inside the viewport width, nothing cut. |
| 93 | Vitest + Playwright | Ring colour inside the undo banner is `highlight`; actions reached by Tab. A fake-timer test advances 60 seconds and the banner is still rendered. |
| FlatButton | Vitest + Playwright | Four looks; no shadow; pressed moves 2px in 80ms; the import-restriction test. |
| Contrast (criterion 8) | Vitest, `contrast.test.ts` | Added pairs, all passing today: `slip` on `ink` 16.8, `on-cloth` on `ink`, `ink` on `slip`, `cloth` on `slip` 6.8, `ink-soft` on `slip` 9.6, `ink-label` on `slip` 6.1 (idle nav label), `highlight` on `ink` 11.1, `blue` on `slip` 10.8, `ink` on `tab-idle` 12.2. |
| H12 to H16 | Manual, on the phone | As written above. H13 and H14 are the real checks for "hollow still looks hollow" and "on and off without the green". |

### 7. Build order (each step leaves the checks green)

1. Shared additions: the error shadow token, `strip-grid`, `ring-inset`, contrast pairs, `tokens.test.ts` updated. `type-caption` if F2a did not add it.
2. `Segmented`, its tests and section. (70 to 74.)
3. `Switch`. (80 to 83.)
4. `StudentStrip`. (75 to 79.)
5. `BottomNav` and the four sample icons. (84 to 87.)
6. `FlatButton`, then `Banner`. (88 to 93.)
7. Whole-page re-run of 58, 61, 62, 63, 66; `pnpm size` recorded; hand checks H12 to H16.

`frontend-dev` starts with step 1 once F2a is merged. `test-engineer` owns `e2e/dev-components-f2b.spec.ts`.

### 8. Risks and traps

| Risk | Mitigation |
| --- | --- |
| A banner mounted already holding its text is announced unreliably by some screen readers (`role="status"` more than `role="alert"`) | F2 only sets the roles. The screens that show banners (R1-7, R1-12) keep one live-region wrapper mounted and put the banner into it. Carry this note into those specs; it cannot be proved on a static dev page. |
| The visually hidden radio makes the page jump or scroll when focused | Hide it with the standard clip pattern inside a `position: relative` label, not with `display: none` (which would also remove it from the keyboard). |
| Blue focus ring on a black segment is invisible | `ring-inset` uses `highlight` on the selected segment; a contrast pair in the unit test guards it. |
| `:has()` drives the segment's look | Inside the floor (Chrome 105, Safari 15.4). jsdom does not style, so unit tests assert `checked`, and Playwright asserts the colours. |
| Switch changes width between on and off | Both words always laid out in the knob. Tested. |
| A screen-reader user hears the strip twice (the label, then the legend) | Accepted for now; see section 9, point 3. |
| `FlatButton` spreads to screens before the green-button question is settled | The import-restriction test. |
| Bottom nav hidden behind the phone's gesture bar | Safe-area bottom padding in the component; pinning and page padding are R1-6's job. |
| Full page reloads from plain `<a>` links in the signed-in app | Out of scope here; one change for `Button` and `BottomNav` when the app shell gets its link component. |
| 60 blocks in a narrow container | `stripColumns` assumes at least 20rem; stated in the component's comment and tested at 360px. |

### 9. Where I differ from the spec

1. **Criteria 74 and 86, focus ring.** "As in criterion 21" would be a ring 4px outside. For segments and bottom-nav items the ring is 3px inside, and `highlight` on the selected (black) segment. An outside ring is clipped at the group border or the screen edge, and blue on black is 1.5:1.
2. **Criterion 72, "when four segments do not fit".** Not measured from the text. The rule is fixed: four options show two-by-two unless the group is at least 28rem wide. It is predictable and needs no script. Three long options never go two-by-two; they wrap inside their segments.
3. **Criterion 77.** The passed-in text alternative and the visible legend say nearly the same thing, so a screen reader reads the counts twice. Built as written. I would drop the separate alternative and let the legend be the text (blocks hidden), if `product-manager` agrees.
4. **Criterion 80.** 76 by 44 are minimums in rem, not fixed pixels, so the switch grows with text size and with a longer word. The knob word is hidden from screen readers.
5. **Criterion 93.** The offline banner has nothing focusable, so "focus rings inside the offline banner" has nothing to test. It still carries the dark-ground utility for whatever a screen puts beside it.
6. **Open question 15.** Minimum block width is 8px, not 6px, and rows are equal (60 gives 20, 20, 20) instead of filling the first row and leaving a short second one. Same intent, steadier look.
7. **Open question 6.** The flat form is a separate `FlatButton`, not a prop on `Button`, so `Button`'s API does not grow a switch that screens could reach.
8. Open questions 14, 16, 17, 18: planned exactly as recommended; no objection. Question 16's "Indian-script labels at 15px" comes from the `type-caption` role's script settings.

### 9a. Departures found during the build, 2026-10-09

Added by `product-manager` after the build, from pull request #3 and the code at `1ff123e`. Section 9 above is the plan as written and is unchanged. Where this section and sections 3, 6 or 8 disagree, this section says what was built.

1. **Criterion 71, segment height.** Segments are `min-h-control` (48px), not `min-h-tap` (44px). The tap target is the radio input, and it sits inside the segment's 2px line, so a 44px segment gave a 42px target. Criterion 71 now says 48px.
2. **Criteria 73 and 62, the radio input.** The radio is not visually hidden, as sections 3 and 8 planned. It is laid over its whole segment (`absolute inset-0`, `appearance-none`) and draws nothing of its own. The segment itself is therefore the real tap target, and focusing it cannot scroll the page. The focus ring is drawn on the radio with `ring-inset`, not on the label with `has-[:focus-visible]`; the forced-focus example puts `data-force="focus"` on the radio. The selected segment marks itself `on-dark-ground`, which is what makes its ring yellow.
3. **Criterion 92, banner actions.** Side by side the two actions stretch to one height. When both labels are too long to share a row, the second drops below the first; each then fills the row and takes its own height. Section 3 already planned the drop; the criterion's words "grow to the same height" did not allow for it, and now do. The lesser action is never narrower than 96px.
4. **How criterion 63 is checked (`e2e/helpers.ts`).** The cut-off-text check (`textProblems`) no longer treats a radio or a checkbox as a control that shows a value. Because of point 2, a segment's radio covers its own label, and counted as a "value" it was reported as overlapping that label. A radio's words are its label's, and the label is still walked as text. This is a change to a test helper only; criterion 63 itself is unchanged.
5. **Criteria 8, 80 and 81, one contrast number under 3:1.** The switch knob's `ink` edge on the green (`stamp`) track is 2.80:1. The knob's `slip` fill on that track is 6.00:1 and is what shows the knob's shape. The pair is listed in `src/styles/contrast.ts` under `reportedPairs`, with `slip` on `stamp` and `ink` on `tab-idle` added to the pairs that must pass. No token was changed, as criterion 8 requires. It is Open question 21 for the founder.

Not yet matched by a test: the Playwright check for criterion 71 still asserts 44px for the segment and for its target. It passes, but it would also pass if segments went back to 44px. A unit test does assert the `min-h-control` class. `test-engineer` should raise the segment figure in the Playwright check to 48.

### 10. One correction for the F2a plan

The F2a type roles have no 14px reading role: `type-label` is DM Mono uppercase and the smallest reading role, `type-body-sm`, is 15px. F2a itself needs 14px Bricolage text (the row's meta line and the field's helper text are 14px on the canvas), and F2b needs it for nav labels, the switch word, a segment's second line and the offline detail. Add to `src/styles/type.css` in F2a step 2: **`type-caption`: Bricolage, 0.875rem, line-height 1.35; in Hindi, Kannada and Telugu: the Anek face, 0.9375rem (15px), line-height 1.5.** Nothing else in the F2a plan changes.

### 11. Not doing

- Disabled states for any of the five. The wide three-word switch (Release 2). A fourth strip shape for part paid. The desktop strip.
- Pinning, stacking, timers, swipe-to-dismiss or auto-close for banners. A toast queue.
- A fixed-position bottom nav, route matching, or a client-side link component.
- An icon library or shared icon file. A green button. Offering `FlatButton` to screens.
- Animation on the switch knob or the selected segment.
- Any new dependency.
