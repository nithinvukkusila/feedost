# R0-3 — Fee receipt maker

## Goal
A tutor opens `/en/tools/fee-receipt/` (or `/hi/`, `/kn/`, `/te/`), types their name, the student's name, the amount, the fee month and how it was paid, picks the receipt language, and gets a one-page PDF receipt they can download or share on WhatsApp. No sign-in, no database, nothing sent to us. The PDF is made on the phone.

Size: M, as in the build plan, **but it starts with a spike that can change the plan** (task 0). Propose two pull requests: **R0-3a** is the spike and its written result only; **R0-3b** is the tool. If the spike fails every option, R0-3b does not start (see task 0).

## Users and moment
- **A tutor on a low-end Android, just after being paid.** A parent paid by UPI or cash and asked "can you give me a receipt?". The tutor wants a clean page in under a minute, in the parent's language.
- **The parent, on WhatsApp.** They receive a PDF or a link-less file. The printed words are the product for them, so the hi, kn and te wording and the way names are drawn matter more than any other text in this slice. A broken Kannada or Telugu name on a receipt is worse than no receipt.
- **The founder.** Wants this out fast; drafts are allowed and the unreviewed ones are named (criterion 26).

## What exists today (checked)
- Landing tool card 1 ("Fee receipt maker") is tagged "Coming soon" and is not a link; its comment says R0-3 turns it into one. Card 2 already links to the reminder writer (R0-2).
- R0-2 spec defines the tool-page pattern this slice copies: static route per language, one client island, words passed as a typed prop, `Segmented`, `Field`, `Button`, footer language links, `check:leak`, `pnpm size`, the privacy line, the "needs JavaScript" line. R0-2 says it adds no header link to the receipt maker "until R0-3". This slice adds the cross-links both ways.
- `src/lib/format.ts` has `formatRupees(paise)`. Fonts today are the app's web fonts; none is a PDF font.
- No PDF library is installed. `docs/BUILD_PLAN.md` says the library is chosen by a spike at the start of this slice, and names `jsPDF`, `@cantoo/pdf-lib` (and `pdf-lib`, which has had no release in years) as candidates, with "draw on a canvas and place the image in the PDF" as the fallback.
- Design: `Tool-receipt.dc.html` is **desktop only**. There is no phone artboard for this tool; the phone layout follows the R0-2 phone canvas pattern (single column, full-width buttons). The paper receipt itself is drawn in `Tool-receipt.dc.html` and `Receipt.dc.html`.

## Task 0 — the PDF spike (do this first; half a day, time-boxed)
**Question:** which way of making a PDF in the browser draws Hindi, Kannada and Telugu correctly?

**Why it is a risk:** the three scripts need shaping: letters join into conjuncts, vowel signs move before or around the consonant, and some marks stack. Many PDF libraries place glyphs one by one and do none of that, so a name looks wrong without any error. I have not verified which candidate does or does not shape; the spike decides by looking, not by reading documentation.

**Options to try, in this order, stopping at the first that passes:**
1. `@cantoo/pdf-lib` with an embedded Noto font per script.
2. `jsPDF` with an embedded Noto font per script.
3. The fallback: draw the receipt with the browser onto a canvas (the browser shapes the text), then put the image in a PDF with whichever library is smallest.

**Test input (the pass/fail test).** Draw each of these on a receipt in its own script, as the student's name and as the tutor's name, at the sizes the receipt uses and zoomed in to 300%:
- Hindi: `क्षत्रिय`, `श्रीनिवास`, `द्वारका`, `ज्ञानेश`, `प्रिया कुमारी`
- Kannada: `ಕೃಷ್ಣ`, `ಶ್ರೀನಿವಾಸ್`, `ಪ್ರಜ್ವಲ್`, `ರಾಜೇಶ್ವರಿ`, `ಲಕ್ಷ್ಮಿ`
- Telugu: `శ్రీనివాస్`, `కృష్ణ`, `ప్రజ్ఞ`, `లక్ష్మి`, `సుబ్రహ్మణ్యం`
- A mixed line: `Ravi Kumar (ರವಿ)` and a name with an emoji, to see what happens to a glyph the font lacks.

**A candidate passes only if all of these hold, judged by a person who can read the script, on the PDF opened on an Android phone (the default viewer and the WhatsApp preview), not on a laptop:**
- Every conjunct is joined (for example `ಕೃಷ್ಣ` is one cluster, not `ಕ ೃ ಷ ್ ಣ`).
- Every vowel sign sits where the script puts it (Hindi short-i `ि` before the consonant; Telugu and Kannada signs above, below or after).
- No dotted circle, no empty box, no gap, no overlapping letters.
- Digits are 0-9 and the rupee sign draws in every language's receipt.
- A glyph the font lacks (the emoji) is replaced by a visible placeholder or dropped by a rule written down; it never crashes the download.

**Also measure and record:** file size of one receipt per language (target 300 KB or less, hard limit 1 MB, because it goes over WhatsApp on slow data); gzipped size of the library chunk and of each font file; time to produce a PDF on a low-end Android (target under 3 seconds after tap); whether the text in the PDF can be selected (nice to have, not a pass condition).

**Output of the spike:** a short "Spike result" section appended to this file with the chosen option, the numbers, a photo or screenshot per script, and the reason for each rejection. The chosen library goes into the `docs/BUILD_PLAN.md` dependency table (the build plan allows it). No spike code is merged into the app.

**If every option fails:** stop. Do not ship a receipt that draws any of the three scripts wrongly. Report to the founder with the options below (Founder decision D1). Do not quietly ship English-only.

## Acceptance criteria
Marked **[unit]**, **[e2e]** (Playwright, 360px phone project, against `out/`) or **[manual]**.

### Task 0 and the library
1. The spike result is written into this file before any tool code is merged, and the library chosen is the one that passed the test above. [manual, reviewer]
2. The PDF library, its fonts, and the receipt-drawing code are loaded **only after the tutor taps Download or Share**, never on page load. Initial JavaScript for each of the four receipt routes is 150 KB gzipped or less (target), 200 KB hard limit, by `pnpm size`, which must list the new routes. The heavy chunk is measured and recorded separately. [CI]
3. Fonts for the PDF are static files on our own origin. No font or script is fetched from a third party, now or at tap. The only requests the page ever makes are same-origin static files, and none carries typed data. [e2e: request log]

### Route and links
4. The tool is served at `/en/tools/fee-receipt/`, `/hi/…`, `/kn/…`, `/te/…`, prerendered static HTML with the right `<html lang>`. The unprefixed `/tools/fee-receipt` is not served and shows the existing 404 (same decision as R0-2 question 7). [e2e]
5. On the landing, tool card 1 is a link to `/{locale}/tools/fee-receipt/` in each language, has no "Coming soon" tag, and is at least 44px high. [e2e]
6. The header of both tool pages shows two links, "Receipt maker" and "Reminder writer", at least 44px high, the current one marked `aria-current="page"` and not a link. The R0-2 page gains the receipt link; R0-2's "no receipt link" test is updated for this. [e2e]
7. The page has one `<header>`, one `<main>`, one `<footer>`, one `<h1>`; the footer has the four language links to this tool in each language, current one not a link. Every link resolves (R0-1 check covers the new page). [e2e]

### Inputs
Form order: language, your name, student's name, amount, fee month, paid by.

8. **Receipt language.** `Segmented`, four endonyms, starts as the page's language. Changing it changes only the receipt, never the page's words or address. [e2e]
9. **Your name** and **Student's name.** `Field`, required, 1 to 40 characters after trimming; leading and trailing spaces removed, runs of spaces become one. Any script, emoji allowed (see criterion 12 for emoji on the PDF). Errors use the state word plus a message, as in R0-2: "Missing" / "Type your name." and "Missing" / "Type the student's name."; "Too long" / "Use 40 characters or fewer." `autocomplete="off"`. [unit, e2e]
10. **Amount.** Same rules and error words as R0-2 criterion 14 and 15: whole rupees, ₹1 to ₹1,00,000; `₹`, commas, spaces and Devanagari, Kannada, Telugu digits accepted and read as 0-9; held as integer paise; shown with Indian grouping on blur. [unit, e2e]
11. **Fee month.** A native select of 12 entries: the current month and the 11 before it, each shown as month name and year in the page's language, for example "October 2026". The current month is chosen once the page has loaded (phone's clock). Year is part of the receipt. [unit with a fixed clock, e2e]
12. **Paid by.** `Segmented`, three options: UPI, Cash, Bank (as the canvas). UPI is chosen at the start. No transaction reference field in this slice. [e2e]
13. Fields start empty (no real-looking example prefilled); errors appear on blur and clear as soon as valid; every input has a visible label; errors are a state word plus a mark, never colour alone. [e2e]

### The receipt
14. The receipt is one A5-or-A4 page (the spike picks one; A4 default) with: the tutor's name as the heading; "Fee receipt" and the issue date; the amount in large figures `₹1,200/-`; the sentence "Received with thanks ₹{amount} from the family of {student} by {mode} towards the tuition fee for {month}."; a "PAID" stamp with the date; and a one-line footer. No receipt number (Founder decision D3). [unit on the text builder, manual on the PDF]
15. The issue date is today's date on the phone, written `DD MMM YYYY` with the month's short name in the receipt language and 0-9 digits (`08 Oct 2026`, `08 अक्टू 2026`). It is the issue date, not a "paid on" date the tutor chose (Founder decision D4). [unit with a fixed clock]
16. The wording comes from one template per receipt language (four templates, plus 12 month names and 12 short month names per language, plus the three payment-mode words). Amounts, dates and digits are always 0-9 and `₹` in every language. [unit]
17. The receipt never says "verified", "official", "GST", "tax invoice" or "tracked", and never shows a UPI ID, phone number or bank detail. The only payment fact on it is the mode word the tutor picked. [unit]
18. The footer line reads, in the receipt language, "Made with {brand}, a free tool for tutors" using the brand constant and domain, no link to a referral, no tracking pixel. (Founder decision D5.) [unit]
19. **Names are drawn correctly in all four scripts.** Every item in the spike's test input appears correctly on the final PDF in the production build, not only in the spike. A name in a script that is not the receipt language's script (for example a Kannada name on an English receipt) is drawn in its own script's font. A name that needs two scripts in one line draws both. [manual, per H1 to H3]
20. A character no embedded font can draw (such as an emoji) is dropped from the PDF and a line under the preview says "Some characters cannot be printed and were left out." naming nothing else. The download is never blocked. [unit, e2e]
21. Long names (40 characters, widest script) wrap onto a second line on the receipt; nothing runs off the page or overlaps the amount or the stamp. [manual, e2e screenshot of the preview]

### Preview, Download and Share
22. Below the form, under "Your receipt", an on-page preview shows the receipt text as it will be printed, updating as the tutor types, with `lang`, `translate="no"` and the receipt language's own font. A missing or wrong value shows a drawn blank, not colour alone. The preview is HTML for speed; the PDF is the product (see Edge cases). [e2e]
23. **Download PDF** is the `record` (black) `Button`, large, full width at 360px. It is in the unavailable form (dashed, no shadow, reason "Fill in the fields above first.") until all four text fields are valid. On tap it shows a working state ("Making your PDF…", `role="status"`), then saves `fee-receipt-{Mon}-{YYYY}.pdf` (English short month, ASCII only: no student name in the file name). Tapping it twice makes at most one file at a time. [e2e: download event]
24. If making the PDF fails (library or font fails to load, offline, out of memory), an error line with the error mark says "Could not make the PDF. Check your connection and try again." and the button is usable again. The rest of the page keeps working. [e2e with the chunk blocked]
25. **Share on WhatsApp** is the `send` (blue) `Button`, same size, same unavailable rule. On a phone that supports sharing a file (Web Share with files), it makes the PDF and opens the phone's share sheet with the PDF attached. Where file sharing is not supported, it downloads the PDF and opens `https://wa.me/?text={text}` with a short receipt message in the receipt language, and a line says "The PDF has been saved. Attach it in WhatsApp." Cancelling the share sheet is not an error. [unit on the fallback choice, manual H4]
26. **Review status recorded.** The hi, kn and te receipt templates, month names, short month names and mode words in this spec's build record are "not reviewed" until a named native reader signs each off. `pnpm i18n:check --strict` (the Release 0 gate, from R0-2 criterion 30) fails while any is "not reviewed". English is the only language marked reviewed at the start. [unit]
27. After Download or Share the fields keep their values so the next student's receipt is quick. No "sent" or "downloaded" count or stamp is shown on the page. [e2e]

### Privacy, honesty and no JavaScript
28. Nothing typed is sent anywhere. No analytics, error reporter or third-party script loads. Typed values are never in the address, history, title, cookie or the PDF's metadata (title is the generic "Fee receipt", author empty, no creator tag with the brand version). A line under the form, always visible: "Nothing you type is sent to us or saved on our servers. The PDF is made on your phone." Fields and preview carry `data-ph-no-capture` and `data-sentry-mask`. The student's name is a child's name: it is never stored by this slice (criterion 29 does not store it either). [e2e: request log; reviewer]
29. Remembering: none in this slice, except that if R0-2's "Remember my name" switch is already on, the tutor's name field is filled from that stored name on load, read-only to the switch (this tool adds no switch, writes nothing and never reads or stores the student's name, amount or month). If the founder says no (D6) this criterion is dropped with no other change. [e2e]
30. With JavaScript off, the page shows its heading, form (inert) and text in the page's language, plus "This tool needs JavaScript turned on." Copy mentions no receipt numbering, no payment tracking, no price, no automatic anything. The yellow block follows the R0-2 pattern: "Writing these every month?" / "The {brand} app is coming soon. It will make and send receipts when you mark a fee as paid." / "Join the waitlist" linking to `/{locale}/#waitlist`, no form. [e2e JS-off]

### Layout, type, language, SEO
31. At 360px in all four languages there is no sideways scroll, with empty fields and with the longest allowed values; with root font at 200% nothing is clipped, overlaps or is cut; every control is at least 44px by 44px and no text is under 14px. Hindi, Kannada and Telugu page text uses Anek with letter-spacing 0 and no uppercase; amounts always use 0-9 digits and never Anek. [e2e, all four pages]
32. Every word on the page is from the message files; all four files have every new key (`TODO-translate` allowed for interface text only; the build shows English, never the marker; **never** used for receipt wording, which must follow criterion 26). `pnpm i18n:check`, `pnpm check:leak` (receipt templates are the named exception), the no-strings scan and the product-name test pass. [CI]
33. Each language's page has its own `<title>`, meta description, canonical and five hreflang links (`en`, `hi`, `kn`, `te`, `x-default` to `/en/tools/fee-receipt/`), absolute with trailing slash, plus `og:title`, `og:description`, `og:url`, `og:locale`, no `og:image`. English title (60 chars or fewer): "Free fee receipt maker for tutors: PDF in 4 languages". English description (155 or fewer): "Make a fee receipt PDF in English, Hindi, Kannada or Telugu. Free, no sign-up, made on your phone and not saved anywhere." [e2e: raw HTML, four different values]
34. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm size`, `pnpm i18n:check`, `pnpm check:404` pass. The only new dependency is the one the spike chose, and it is listed in `docs/BUILD_PLAN.md`. [CI, reviewer]

## Edge cases
- **Very long names.** 40 characters; wrap in preview and on the PDF (21).
- **Names in a different script from the receipt language.** Drawn in their own script (19). A Hindi receipt for a student with an English name is the common case.
- **Emoji or a symbol no font has.** Dropped, the tutor is told (20).
- **Name already has "Mr", "Master", "ji".** Printed as typed.
- **Same student, two months, two receipts.** The tutor makes two. Nothing warns of duplicates; nothing is stored.
- **Partial payment.** The tutor types what was received. The receipt says "Received", not "fee paid in full", and has no balance line.
- **Amount 0, empty, paise, huge, commas, Indic digits.** As R0-2 (10).
- **Month in the future or more than 11 months back.** Not offered. A tutor who needs an older month types nothing and cannot; noted as a limit (Founder decision D2).
- **Phone clock wrong.** Issue date and default month are wrong; the tutor can pick another month but not the date (D4).
- **Offline after the page loaded.** Typing and preview work. Download works only if the library and fonts were fetched earlier; otherwise criterion 24. There is no service worker in Release 0, so a fresh offline open is impossible.
- **Slow network.** The first tap fetches the library and one script's fonts; the working state shows. Fetch only the fonts the receipt needs (the receipt language plus the scripts present in the two names).
- **Low-end phone memory.** One PDF at a time (23). If the spike's option exceeds the time or size target on a low-end device, record it.
- **iOS Safari.** Downloads open in a viewer; file sharing through the share sheet works on recent versions. Checked on a phone (H5), not a pass condition for Android.
- **WhatsApp cannot attach a file from a link.** True of `wa.me`; hence criterion 25's two paths.
- **The parent opens the PDF later.** It is a plain file with no link back to us. It cannot be revoked or corrected; the tutor makes a new one.
- **Anyone can make a receipt for any amount.** It is a self-issued paper from the tutor, like a handwritten slip. We do not verify payment and the receipt does not claim to (17).
- **Large font, second language, JavaScript off.** Criteria 30 and 31.
- **Right-to-left.** Not needed.

## Out of scope
- **Sequential receipt numbers, a stored receipt, `/r/{token}` link, receipt history.** R1-7. The free tool has no memory. (D3)
- **Amount in words** (canvas draws "one thousand two hundred only"). Needs correct lakh and crore wording in four languages and native review; not in the PRD. (D7)
- **Tutor logo, signature, a UPI ID or phone on the receipt.** Branding is a Pro feature in the PRD.
- **A "paid on" date or a transaction reference.** Not in the PRD row. (D4)
- **Sending to a parent's number (`wa.me/91…`).** R1-8.
- **Batch receipts for many students at once.** Release 1 app.
- **The waitlist form on this page.** R0-4.
- **Sitemap, robots, og:image, structured data, PostHog page events.** R0-5.
- **Native-speaker review.** Before Release 0 ships; tracked by 26.
- **Desktop two-column layout.** Must not break wider than 360px; not designed here.
- **A phone canvas for this tool.** None exists. The phone layout follows the R0-2 phone canvas; design may add one later.

## Design references
- `design/project/Tool-receipt.dc.html`: form fields, labels, the paper receipt, Download PDF (black) and Share on WhatsApp (blue), the yellow waitlist block. **Desktop only.**
- `design/project/Receipt.dc.html`: the parent's public receipt page (R1-7); read for how a receipt looks, not built here.
- `design/project/Tool-reminder-m.dc.html`: phone layout pattern to follow (R0-2).
- `design/project/Landing-m.dc.html`: tool card 1.
- Components: `Segmented`, `Field`, `Button`, `Slip`. Tokens: `cloth`, `stitch`, `page-ruled`, `slip`, `highlight`, `blue`, `ink`.
- Deliberate differences from the canvas: fields start empty; "Language" legend becomes "Receipt language" with endonyms; month includes the year as a select of 12; no receipt number; no amount in words; "from the family of" wording; no "Reminder writer" tab styling beyond a plain link; the privacy line; the yellow block says "coming soon"; the PAID stamp stays green-free in the PDF if the spike's print colour is not reliable (use ink black; colour alone never carries meaning).

## Analytics
None in this slice. The PRD's events belong to the signed-in app, and PostHog is wired in R0-5. This page loads no script but its own. R0-5 must keep criterion 28 true (no capture of typed values).

## Test by hand on a phone
- **H1.** On an Android phone, make an English receipt with the test names above. Open the downloaded PDF in the default viewer and in Google Drive. Every line is whole, `₹` and digits are right.
- **H2.** Repeat in Hindi, Kannada and Telugu with the spike's test names. A reader of each language confirms every name and the sentence read correctly (criterion 19). This is the real test of the slice.
- **H3.** Make a Kannada receipt with an English student name, and an English receipt with a Telugu student name. Both scripts are right.
- **H4.** Tap "Share on WhatsApp" in Chrome on Android. The share sheet opens with the PDF attached; send it to a second phone; it opens and looks the same. Then try on a phone or browser that cannot share files and check the fallback line and the `wa.me` text.
- **H5.** Repeat H1 and H4 on an iPhone (note the result; not a pass condition).
- **H6.** Largest phone font size, page in Telugu: nothing cut off or sideways; every control easy to hit with a thumb.
- **H7.** Turn on airplane mode after the page loads, then tap Download. Read the error line; turn the network on and retry.
- **H8.** Time the first tap on a low-end phone on slow data. Note seconds and the file size.
- **H9.** Read the three non-English templates with someone who reads each language. The wording sounds like something a tutor would sign.
- **H10.** Look at the PDF file's properties: no student name, tutor name or app version in them.

## Open questions
Founder decisions. Each has a default; the implementer proceeds on it unless told otherwise. None blocks the spike.

- **D1. If the spike fails every option.** Default: ship the **canvas fallback** (browser draws, image goes into PDF) even though text in the PDF cannot be selected. Alternative: ship English and Hindi only and keep Kannada and Telugu "coming soon". Not acceptable: shipping a script that draws wrongly.
- **D2. Months offered.** Default: current month and 11 before (criterion 11), year shown. Alternative: also let the tutor pick any year.
- **D3. Receipt number.** The canvas shows "No. 001". The free tool has no memory, so every receipt would say 001. Default: **no number** on the free tool; numbering starts in R1-7.
- **D4. Dates.** Default: the printed date is today (issue date) and cannot be changed. Alternative: add a "Paid on" date field, default today, no future dates.
- **D5. Brand line on the receipt.** Default: one small footer line "Made with {brand}, a free tool for tutors". It is the only growth hook on the free receipt. Alternative: no line.
- **D6. Reuse R0-2's remembered tutor name** (criterion 29). Default: yes, read-only; drop if no.
- **D7. Amount in words.** Default: not in this slice (out of scope). Alternative: English only, but that breaks "every string translated" on a hi/kn/te receipt, so not recommended.
- **D8. Who reads Hindi, Kannada and Telugu.** Default: the same readers as R0-2; send them the three receipt templates after the six reminder templates. No reader named yet.
- **D9. A4 or A5.** Default: A4 (prints anywhere). The spike may report A5 as lighter for WhatsApp; the founder picks only if the file size target is missed.
- **D10. Library licence and font licence.** The spike names them (Noto fonts are open licence). Default: proceed on the open-licence options only; flag anything else to the founder before adding it.

## Hand-off
Next: `tech-lead` appends the technical plan to `docs/specs/R0-3-receipt-maker.md`. Decisions that are theirs:
1. How the spike is run and recorded, and the split into R0-3a and R0-3b.
2. Lazy-loading the library and fonts on tap, per-script font subsetting, and how `pnpm size` measures the on-demand chunk (2, 3).
3. One pure module for cleaning, validation, receipt text, dates and file name; the preview and the PDF both read it (14 to 17).
4. Where the receipt templates and month names live so every page has them without breaking `check:leak` (reuse R0-2's approach), and the "not reviewed" record for `--strict` (26, 32).
5. Reusing the R0-2 header, footer, SEO helper and island pattern, and which R0-1 and R0-2 tests change (5, 6).
6. The Web Share with files check and its fallback (25), and the glyph-missing rule (20).

## Technical plan — R0-3

Written by `tech-lead` on 2026-10-11. No database, migration, policy or Edge Function: every task is `frontend-dev` (plus `test-engineer` for `e2e/`). The founder wants speed, so this plan is lean and copies the R0-2 pattern wherever it can. Nothing here was checked on a phone; the spike and H1 to H10 do that.

### Assumed unless the founder says otherwise
D1 to D10 are proposals from the spec, not decisions. The plan is built on these defaults and says what changes if one flips.

| # | Assumed default | If the founder flips it |
| --- | --- | --- |
| D1 | If every spike option fails: ship the canvas fallback (browser draws, image in PDF), not English-only | R0-3b scope becomes English and Hindi only; Kannada and Telugu stay "coming soon" (needs product-manager) |
| D2 | Current month and the 11 before, year shown | Add a year select: one more control and test |
| D3 | No receipt number | A number needs state; not possible without R1-7 |
| D4 | Printed date is today, not editable | One more `Field` (date) and its validation, no future dates |
| D5 | One footer line "Made with {brand}, a free tool for tutors" | Delete one template line and criterion 18's test |
| D6 | Reuse R0-2's remembered tutor name, read-only | Drop `readRemembered` call; criterion 29 test goes |
| D7 | No amount in words | Out of scope; a separate slice with native review |
| D8 | Same native readers as R0-2; three receipt templates sent after the six reminder ones | None named yet; blocks only the Release 0 `--strict` gate, not the build |
| D9 | A4 | A5 only if file size misses 300 KB (the spike reports it) |
| D10 | Open-licence library and Noto fonts only | Anything else goes back to the founder before it is added |

### 1. Approach
Two pull requests. **R0-3a** is the spike: a throwaway page outside the app proves which option draws hi, kn and te correctly on a real Android phone, and the only things merged are the written "Spike result" in this file and one row in the `docs/BUILD_PLAN.md` dependency table. **R0-3b** is the tool, built exactly like R0-2: a static route per language, one client island, words as a prop, one pure module for text and validation that the preview and the PDF both read. The PDF library, the fonts and the drawing code sit behind one file, `src/lib/receipt/make-pdf.ts`, and are reached only by `await import()` after the tutor taps, so the initial route stays near R0-2's 140 KB.

### 2. Dependencies and the dependency-policy check
R0-3a installs nothing in the app: the spike lives in the scratchpad or an untracked folder and installs there. R0-3b adds **at most one** runtime dependency, the one the spike names. The check is recorded here for the candidates (facts read from the npm registry on 2026-10-11; the spike adds `pnpm audit` and the pinned size):

| Candidate | Release in last 12 months | More than one maintainer or a company | Licence | Advisories | Verdict |
| --- | --- | --- | --- | --- | --- |
| `@cantoo/pdf-lib` 2.11.1 | Yes (2026-09-15) | Yes (6 npm maintainers, company fork) | MIT | Not checked: spike runs `pnpm audit` on it | Passes on registry facts; first to try |
| `jsPDF` 4.2.1 | Yes (2026-03-17) | **One** npm maintainer | MIT | Not checked; it has had advisories in the past, so the spike must run `pnpm audit` and read them | Fails the maintainer test on registry facts. Only chosen if it is the sole option that draws the scripts, and then the founder is asked, as `next-intl` was |
| `pdf-lib` 1.17.1 | **No** (last release 2022-05-12) | One | MIT | n/a | Rejected by the policy; do not try |
| Canvas fallback (browser draws, image in PDF) | n/a | n/a | n/a | n/a | Needs a PDF writer for one image. Prefer writing the roughly 60-line PDF wrapper for a JPEG ourselves (no dependency) over adding a library; the spike decides if that is safe |

Fonts: Noto Sans Devanagari, Kannada, Telugu and a Latin face, all SIL Open Font Licence, committed under `public/pdf-fonts/` with their licence files in `public/licenses/` (D10). Subset or not is decided by the spike's size numbers. Rules that hold either way: pinned exact version, imported only from `src/lib/receipt/make-pdf.ts`, a row in the `docs/BUILD_PLAN.md` table written by the spike PR. If the spike picks anything that fails the policy, the founder is asked in the PR before R0-3b starts.

### 3. Files

**R0-3a (spike, no app code merged)**

| File | What goes in it |
| --- | --- |
| `docs/specs/R0-3-receipt-maker.md` | The "Spike result" section: option chosen, numbers (file size per language, library and font gzipped size, seconds on a low-end Android), a screenshot per script, one reason per rejection, `pnpm audit` result, licences |
| `docs/BUILD_PLAN.md` | PDF row of the dependency table filled in with the chosen library, version and standing |

**R0-3b (the tool)**, copying the R0-2 layout:

| File | What goes in it |
| --- | --- |
| `src/lib/receipt/receipt.ts`, `receipt.test.ts` | Pure, no React or DOM. `checkName` and `checkAmount` are imported from `src/lib/reminder/reminder.ts` (same rules, criteria 9 and 10; do not copy them). New here: `feeMonths(now)` (12 entries), `issueDate(now, lang)` (`DD MMM YYYY`, localized short month, 0-9 digits), `receiptLines(input, lang)` (the heading, sentence, stamp, footer as plain strings both the preview and the PDF read), `fileName(now)`, `chooseShare(env)` (file share or fallback, criterion 25), `waText(lang)`, `splitRuns(text)` (cut a string into runs by script: latin, devanagari, kannada, telugu, other) and `dropUnprintable(text, canDraw)` (criterion 20). Unit tests for 9 to 11, 14 to 18, 20, 23, 25 with a fixed clock |
| `src/lib/receipt/templates.json`, `templates.review.json`, `templates.test.ts` | Per language: the sentence template, heading words, stamp word, footer line, 12 month names, 12 short month names, three mode words. Same pattern as `src/lib/reminder/templates.json`: one copy, not in the message files, never `TODO-translate`. Review record "not reviewed" for hi, kn, te, English the source. Test: placeholders each exactly once, scripts present, no forbidden words from criterion 17 |
| `src/lib/receipt/make-pdf.ts`, `make-pdf.test.ts` | The only importer of the PDF library. `export async function makePdf(input, lang): Promise<Blob>` that does `await import()` of the library and fetches fonts from `/pdf-fonts/`. Unit test with the library mocked: generic metadata (title "Fee receipt", empty author, no creator), text from `receiptLines`, a font fetch that fails rejects with a typed error, a run with no glyph is dropped and reported |
| `src/lib/receipt/share.ts`, `share.test.ts` | `shareOrDownload(blob, fileName, text)`: `navigator.canShare({files})` path; fallback saves and opens `https://wa.me/?text=`; a cancelled share (`AbortError`) is not an error. Reuses `chooseShare` |
| `public/pdf-fonts/*.ttf` (or `.woff`), `public/licenses/` | Fonts and licences from the spike |
| `src/components/receipt/receipt-tool.tsx`, `receipt-tool.test.tsx` | `"use client"` island, props `words: Messages["receiptForm"]`, `pageLocale`. Order: receipt language, your name, student's name, amount, fee month, paid by, privacy line, "Your receipt" preview, Download, Share, reason line, status region. Disabled `fieldset` until hydrated and no `<form>` (R0-2 pattern). Never imports `make-pdf.ts` statically |
| `src/components/receipt/receipt-preview.tsx` | The HTML paper preview from `receiptLines`, with `lang`, `translate="no"`, drawn blanks, the line "Some characters cannot be printed and were left out." |
| `src/app/[locale]/tools/fee-receipt/page.tsx`, `metadata.test.ts` | Server page: metadata, shell, `<noscript>` line, yellow block, footer, `getWords("receiptForm")`. Copy `fee-reminder/page.tsx` |
| `e2e/fee-receipt.spec.ts` (`test-engineer`) | Section 7 |

Changes:

| File | Change |
| --- | --- |
| `messages/en.json`, `hi.json`, `kn.json`, `te.json` | All four together: `receipt` (server: meta, kicker, title, noscript, promo) and `receiptForm` (plain text only: labels, error words, Download, Share, working, error, "saved" line, privacy, preview title, unprintable line), plus `toolNav.receipt` and `toolNav.reminder` for the header, and `landing.tools.t1.open`. The page `title` and `description` must be drafted in all four (distinct values, criterion 33), not `TODO-translate` |
| `src/i18n/words.ts` | Add `"receiptForm"` to `plainNamespaces`; `words.test.ts` covers it |
| `src/components/tools/tool-header.tsx` | Add the two links "Receipt maker" and "Reminder writer", current one `aria-current="page"` and not a link, 44px high. Takes a `current` prop. The R0-2 page passes `"reminder"` |
| `src/components/landing/tools.tsx`, `landing.test.tsx`, `e2e/landing.spec.ts` | Card 1 becomes a link like card 2 and loses the "Coming soon" tag; tag now appears zero times. The heading stays "Two free tools." |
| `src/config/routes.ts` | `feeReceiptPath = "tools/fee-receipt/"` |
| `src/app/[locale]/tools/fee-reminder/page.tsx`, `e2e/fee-reminder.spec.ts` | The R0-2 test "no receipt link" becomes "has the receipt link, 44px high" (criterion 6). Nothing else in R0-2 changes |
| `scripts/check-locale-leak.mjs` | `EXCEPTIONS` gains `{ pages: "tools/fee-receipt/", file: "src/lib/receipt/templates.json", name: "fee receipt" }`; its unit cases in `src/lib/size-scripts.test.ts` grow by the receipt pages. A reminder page must not carry receipt templates and the reverse (leak both ways) |
| `scripts/i18n-check-lib.mjs`, `scripts/i18n-check.mjs`, `src/lib/i18n-check.test.ts` | `checkTemplates` generalised to take a shape (reminder or receipt) and run on both files; `--strict` fails while either review record has an unreviewed language. Summary line counts both |
| `scripts/size.mjs`, `src/lib/size-scripts.test.ts` | `REQUIRED` gains the four `tools/fee-receipt/index.html`. New report block "on demand": gzipped size of the PDF chunk (the chunk the page's HTML does not reference but that `make-pdf.ts` imports) and of each font file, printed and recorded in the build record; warn over a limit the spike sets, never counted in the 150/200 KB initial budget |
| `src/styles/*`, `docs/DESIGN.md` | Only if the paper preview needs a token that does not exist; prefer existing tokens (`slip`, `page-ruled`, `ink`). Stamp stays ink black (spec design note) |
| `src/CLAUDE.md` | One line: `src/lib/receipt/` and the rule that a PDF library is imported only by `make-pdf.ts`, only through `await import()` |

No change: `next.config.ts`, `supabase/`, CI workflow, the layout and `request.ts`.

### 4. Data
None. No table, no RLS, no Edge Function, no storage of the student's name, amount or month. The only stored value anywhere is R0-2's remembered tutor name, read-only (D6).

### 5. Work split (ordered)

**R0-3a, spike (half a day, time-boxed)**
1. `frontend-dev`: in the scratchpad (not the repo), build a one-page prototype that draws the spec's test names in each script at receipt sizes, per option in the spec's order: `@cantoo/pdf-lib` with Noto, then `jsPDF` with Noto, then the canvas fallback. Stop at the first that passes on the founder's or a tester's Android phone, default viewer and WhatsApp preview. Judge conjuncts and signs by a reader of each script (H2 starts here, early).
2. `frontend-dev`: measure file size per language, gzipped library and font size, seconds on a low-end phone, run `pnpm audit` on the winner, record licences.
3. `frontend-dev`: open the R0-3a PR with only the "Spike result" section and the BUILD_PLAN row. Decide A4 or A5 from the file size. If all options fail, stop and report to the founder under D1.

**R0-3b, tool (starts only when R0-3a is merged)**
4. `frontend-dev`: `pnpm add` the chosen library, exact version. `src/lib/receipt/templates.json` + review record + `receipt.ts` + tests; reuse `checkName` and `checkAmount`. Extend `i18n-check` and `check-locale-leak` for the receipt templates.
5. `frontend-dev`: copy fonts to `public/pdf-fonts/`, write `make-pdf.ts`, `share.ts` and their tests. Confirm with `pnpm build` and `pnpm size` that the library and fonts are in no route's initial JS.
6. `frontend-dev`: messages in all four files, `getWords` namespace, the island, the preview, the server page, metadata, `routes.ts`, `size.mjs` change. Cut line: after this step the tool works in four languages.
7. `frontend-dev`: cross-links: header with two links, landing card 1 as a link, edits to R0-2's page and landing tests, `CLAUDE.md` line.
8. `test-engineer`: `e2e/fee-receipt.spec.ts`, edits to `e2e/fee-reminder.spec.ts` and `e2e/landing.spec.ts`; check every criterion in section 7 has a test that can fail. `frontend-dev` fixes anything it finds.
9. Founder/QA: H1 to H10 on a phone, in particular H2, before Release 0 ships.

### 6. PR split
- **R0-3a "spike", docs only.** Spike result section, BUILD_PLAN row, nothing in `src/`. Merging it is the gate for R0-3b (criterion 1).
- **R0-3b "tool".** Steps 4 to 8. One PR, size M, because the cross-links touch R0-2's tests and must not be red between commits. If it grows, split step 7 into its own small PR, but only after step 6 is merged.

### 7. Tests required

| Criterion | Test |
| --- | --- |
| 1 | Reviewer: spike section exists before R0-3b merges |
| 2, 3 | `pnpm size` lists the four receipt routes at 150 KB or less; e2e request log before the tap: no `.pdf`-library chunk and no font requested; after Download: only same-origin requests, none with typed data; unit: no file other than `make-pdf.ts` imports the library (source scan, as R0-2 section 9) |
| 4 to 7 | e2e: four routes, right `<html lang>`, unprefixed address is the 404, landing card link, header links with `aria-current`, landmarks, footer links, link resolver |
| 8 to 13 | unit on `receipt.ts` and `receipt-tool.test.tsx`; e2e for blur, errors, amount grouping, month select, mode default |
| 14 to 18 | unit on `receiptLines`, `issueDate` with a fixed clock, forbidden-word scan, footer uses brand constant |
| 19 | manual H2, H3; unit: `splitRuns` gives the right font per run for the spike's names |
| 20, 21 | unit `dropUnprintable`; e2e emoji shows the line, download still works; screenshot of long names in the preview |
| 22 to 25 | e2e: preview updates, Download unavailable then available, download event and file name, double tap one file, route blocked gives the error line and the button recovers, `chooseShare` unit, share fallback e2e with `navigator.canShare` stubbed |
| 26 | unit on the review record and `i18n:check --strict` |
| 27, 28, 29 | e2e: values kept; request log; no `<form>`, nothing in address or title; stored tutor name prefilled; PDF metadata unit with the library mocked, H10 by hand |
| 30 | e2e JavaScript off |
| 31 | e2e: 360px and 200% font in four languages, 44px, 14px, fonts |
| 32, 33 | `pnpm i18n:check`, `pnpm check:leak`, no-strings scan, product-name test; e2e raw HTML title, description, canonical, hreflang |
| 34 | The full command list passes; reviewer: one new dependency, listed in BUILD_PLAN |

### 8. Risks and traps
- **The spike result may be "none of the libraries shape these scripts".** The plan has the canvas fallback and D1; R0-3b does not start on a fail. A canvas image PDF is larger: the spike measures it against the 300 KB / 1 MB limits and may need JPEG at a set quality.
- **Fonts and library leak into the first load.** A static `import` anywhere pulls the chunk into the route. Mitigation: only `make-pdf.ts` imports the library, only inside a function; a source-scan unit test and `pnpm size` before and after step 5.
- **Which fonts to fetch.** Fetching all four scripts is megabytes on slow data. Mitigation: `splitRuns` on the receipt language plus both names, fetch only the scripts present; test that an English receipt with English names fetches only the Latin font.
- **Wrong shaping that looks fine on a laptop.** The pass test is on a phone viewer and WhatsApp preview, by a reader. No developer-only judgement.
- **Drop rule hides a real name.** A missing glyph is dropped and the tutor is told in words (criterion 20); the glyph test uses the font's own coverage, not a regex list that goes stale.
- **Typed values leak** through the file name, the PDF metadata, the title or the URL. File name is generic (criterion 23), metadata set explicitly, no `<form>`.
- **R0-2 and landing tests go red** when the header and card change. Mitigation: step 7 edits code and the named tests together.
- **A second copy of validation drifts from R0-2.** Reuse `checkName` and `checkAmount`; do not copy.
- **Share sheet quirks:** `navigator.canShare` is true but `share` rejects on some Androids. Treat any non-`AbortError` rejection as a fallback to download plus `wa.me`.
- **Receipt wording is a promise to a parent.** Templates are drafts; `--strict` blocks Release 0 until a named reader signs (D8). Criterion 17's forbidden words are a unit test.

### 9. Not doing
Receipt numbers, a stored receipt, a public link, receipt history (R1-7); amount in words (D7); a "paid on" date or transaction reference (D4); logo, signature, UPI ID or phone on the receipt; batch receipts; the waitlist form (R0-4); sitemap, og:image, analytics (R0-5); a service worker or offline PDF; a new select or year picker (D2); an A5/A4 toggle; a desktop layout; any PDF editing or preview inside a PDF viewer.

### 10. Needs the founder
- Answer D1 to D10, or say "defaults are fine". Only D1 can change what R0-3b contains; D8 (readers) blocks the Release 0 gate, not the build.
- A real Android phone for the spike, and a reader of Hindi, Kannada and Telugu for H2. The spike cannot finish without both.
- If the spike picks `jsPDF`: approval of a one-maintainer package (fails policy point 2).

### 11. Start
`frontend-dev` starts with **task 1: the spike (R0-3a)**, in the scratchpad, trying `@cantoo/pdf-lib` first. Nothing in `src/` changes until its result is merged.

## Spike result

Written by `frontend-dev`, 2026-10-11, branch `r0-3a-spike`. **Status: PROVISIONAL.** Everything a machine can check was checked. **The native-reader checks and the real-Android checks have NOT been done.** No one who reads Hindi, Kannada or Telugu has looked at these PDFs, and no PDF was opened on a phone, in the Android default viewer or in the WhatsApp preview. Criterion 1 ("passed on an Android phone, judged by a reader") is therefore **not yet met**. R0-3b should not merge until it is.

### Option chosen (provisionally): option 1, `@cantoo/pdf-lib` with Noto fonts
- Option 1 passed every check a machine can make, so options 2 (`jsPDF`) and 3 (canvas) were not tried and `jsPDF` was not installed.
- **It needs a second package.** `@cantoo/pdf-lib` 2.11.1 does not shape on its own; it calls whichever fontkit is registered. `@pdf-lib/fontkit` 1.1.1 (one maintainer, last release 2020) **crashed** on Hindi with `ReferenceError: regeneratorRuntime is not defined`, so it is rejected. `@cantoo/fontkit` 2.0.12 (the same company's fork of fontkit, released 2026-09-11, MIT, six npm maintainers) shapes all three scripts. R0-3b therefore adds **two** runtime packages, both from one org. The tech plan said "at most one"; this needs the founder's nod or the tech-lead's note.
- Both packages pass the dependency policy on registry facts. `pnpm audit` and `pnpm audit --prod` in the spike folder: "No known vulnerabilities found".

### What was tested
Receipts in `hi`, `kn` and `te`, A4, each with the spec's five test names at 14, 24 and 48 pt, the line `Fee receipt  ₹1,200/-  0123456789` in Noto Sans, the mixed line `Ravi Kumar (ರವಿ)` (Latin plus Kannada in separate font runs), and `Asha 😀 Kumar`. The PDFs were rendered to PNG with `pdftoppm` (poppler) at 100 to 300 dpi and read by eye by me, not by a reader of the scripts. Kannada and Telugu pages were also compared against HarfBuzz (`hb-view`) renderings of the same words in the same fonts.

| Check | Result |
| --- | --- |
| Hindi conjuncts (`क्षत्रिय`, `श्रीनिवास`, `द्वारका`, `ज्ञानेश`) and short-i before the consonant (`प्रिया`) | Joined and placed correctly in the poppler render |
| Kannada (`ಕೃಷ್ಣ`, `ಶ್ರೀನಿವಾಸ್`, `ಪ್ರಜ್ವಲ್`, `ರಾಜೇಶ್ವರಿ`, `ಲಕ್ಷ್ಮಿ`) | Joined; matches the HarfBuzz reference |
| Telugu (`శ్రీనివాస్`, `కృష్ణ`, `ప్రజ్ఞ`, `లక్ష్మి`, `సుబ్రహ్మణ్యం`) | Joined; matches the HarfBuzz reference |
| Dotted circle, box, gap, overlap in the three scripts | None seen |
| Digits 0-9 and `₹` | Draw correctly (Noto Sans) |
| Mixed line, Latin plus Kannada | Draws correctly when each run is drawn with its own font (the code must split runs by script; this is `splitRuns` in the tech plan) |
| Emoji | **No crash.** With the full Noto Sans it draws an empty box; with the subset font it draws a blank gap. R0-3b must apply a written rule (strip or replace with a visible placeholder) before drawing |
| Selectable text | The text is present, but copy or search order is wrong for conjuncts (for example Kannada `ಶ್ರೀ` extracts as `ಶಿ್ರೕ`, Hindi `श्रीनिवास` as `श्रीिनवास`). It looks right but must not be promised as searchable |

### Numbers (measured on a Mac with Node 22, not on a phone)
- **File size per receipt:** hi 18,159 bytes, kn 19,784, te 19,899 with subset fonts (hi 18,402, kn 20,046, te 20,131 with full fonts). Target 300 KB: met by more than 10 times. These are test pages, not the final layout; a name using all three scripts adds a few KB. **A4 stays; A5 gives no benefit.**
- **Time to make a PDF:** 90 to 290 ms on the Mac including font parsing. **Not measured on a low-end Android.** The 3-second target is unverified there.
- **Library code, loaded only on tap** (esbuild, minified, browser, ESM): `@cantoo/pdf-lib` + `@cantoo/fontkit` together 978,776 bytes raw, **405,629 bytes gzipped**. Alone: pdf-lib 251,556 gz, fontkit 156,787 gz. Stubbing the unused brotli decoder saves only about 60 KB gzipped (345 KB). The library is 2 to 3 times larger than the whole initial route budget, so it must never enter the initial JS and `pnpm size` needs the "on demand" report in the tech plan. Suggested warn limit: 450 KB gzipped for the library chunk.
- **Fonts, gzipped:** full files Noto Sans 393,421 (the Latin face is large, subset it), Devanagari 121,223, Kannada 94,190, Telugu 112,589. Subset (Basic Latin, Latin-1, common punctuation, the `₹` sign for Latin; the script's own Unicode block plus Basic Latin, ZWJ, ZWNJ and the dotted circle for each Indic font, all layout features kept with `fontTools.subset`): **Latin 28,821, Devanagari 86,365, Kannada 63,137, Telugu 81,745**. The subset PDFs rendered pixel-identical to the full-font PDFs on the name pages, so subsetting keeps the shaping. Only the fonts a receipt needs should be fetched on tap (one script font plus Latin, plus another script font if a name needs it).
- **Licences:** `@cantoo/pdf-lib` MIT, `@cantoo/fontkit` MIT, Noto fonts SIL Open Font License 1.1 (text in `OFL.txt` from github.com/notofonts). Open licences only (D10).

### Rejections
- `@pdf-lib/fontkit` 1.1.1: crashes on Indic shaping, one maintainer, last release 2020.
- `jsPDF`: not tried, not installed. It is only needed if option 1 fails, and it fails the maintainer test.
- Canvas fallback: not needed. It remains the plan if the pending native checks fail.

### Still to do before this is final (not done)
1. **Native-reader check (H2):** a reader of Hindi, Kannada and Telugu looks at the PDFs listed below, at 100% and 300%, and confirms every name. I only compared with a reference renderer; I cannot read the scripts.
2. **Real Android check:** open the three PDFs in the default viewer and in the WhatsApp preview on a real phone; some Android viewers draw differently from poppler. Also time making the PDF on a low-end phone.
3. **Founder or tech-lead:** accept two packages (`@cantoo/pdf-lib` and `@cantoo/fontkit`) in place of the "at most one" in the tech plan.
4. If 1 or 2 fails, fall back to option 3 (canvas) under D1; do not ship a script that draws wrongly.

### Files (spike, not in the repo)
Folder `/private/tmp/claude-502/-Users-nithin-1-person-busnes-feedost-1/72bcbb2c-17ba-4fe2-9c7d-3f746a729b16/scratchpad/spike/`:
- Generator: `gen.mjs` (full fonts), `gen-sub.mjs` (subset fonts).
- PDFs: `out/hi.pdf`, `out/kn.pdf`, `out/te.pdf` (full fonts); `outsub/hi.pdf`, `outsub/kn.pdf`, `outsub/te.pdf` (subset fonts, the ones to send to a phone).
- PNGs: `out/{hi,kn,te}-{1,2,3}.png`, `out/{hi,kn,te}-zoom300-1.png`, `cmp/`; HarfBuzz references `ref/{hi,kn,te}.png`.
- Fonts: `fonts/` (full), `sub/` (subset), `OFL.txt`.

## Build result (R0-3b), 2026-10-11

Built on branch `r0-3b-receipt-maker` by `frontend-dev`. The PDF library is the one in the spike result; the founder approved the two packages on 2026-10-11 (recorded in `docs/BUILD_PLAN.md`).

### Review record: wording NOT reviewed by a native reader
- **Receipt wording** (`src/lib/receipt/templates.json`): hi, kn, te drafted by `frontend-dev`; **not reviewed** (`templates.review.json`, `pnpm i18n:check --strict` fails until signed). English is the source.
- **Interface wording** for kn and te in the receipt tool, written as real sentences and no longer marked `TODO-translate`, but **not reviewed by a reader**: `landing.tools.t1.title`, `t1.body`, `t2.title`, `receipt.promo.body`, `receiptForm.privacy`, `receiptForm.preview.unprintable`, `receiptForm.failed`, `receiptForm.saved`, `toolNav.receipt`, `toolNav.reminder`. Hindi interface wording is also an unreviewed draft.
- Removed key: `landing.tools.tag` ("Coming soon"), unused now that card 1 is a link.

### Changes beyond the plan
- `Segmented` with three options stacks to one column below 16rem of group width (so at very large text), because Kannada and Telugu "Cash" and "Bank" were clipped at 200% text. At normal size nothing changes.
- The preview amount is `text-2xl` (was 4xl) and may wrap, for the same reason.
- `pnpm size` now requires the four receipt pages, reports the on-demand PDF chunks (390 KB gzipped, warn above 450 KB) and the four fonts, and fails if the library text appears in any page's initial scripts.

### Not verified
Native-reader check of the PDFs (criterion 1, H2), the Android default viewer and the WhatsApp preview, and PDF make time on a low-end phone. Only Chromium on a Mac was used.

