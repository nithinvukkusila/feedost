# Parent pages are English-only until a person reviews each language

Cross-slice decision, written 2026-10-16. It changes R0-3, R1-7 (Parts B and C), R1-9 (Parts B and C) and R1-10 (the claim sheet). Each of those specs points here. Where they disagree with this file, this file wins.

**The founder's decision (2026-10-16, given to the lead in that day's session):** parent-facing surfaces are English-only until a human reviewer signs off each language. Why: no Hindi, Kannada or Telugu reader is available yet, the founder does not want to wait, and so far hi/kn/te text has only had a model review. The tutor's own app stays in all four languages (low risk).

## 1. Goal

A parent never sees Hindi, Kannada or Telugu text from us that a person has not read and signed off. Each language turns on for a surface when a named person signs that surface's review record, with no code change. This unblocks PR #12 (R0-3) and PR #25 (R1-9 Part C), which were waiting on a native-language review.

## 2. Users and moment

- **The parent:** opens a link from WhatsApp, or a PDF the tutor sent. Until a language is signed off, they see English words. Names stay in whatever script the tutor typed. Amounts and dates are always 0-9 digits.
- **The tutor:** keeps her app and the free tools in her own language. The only change she sees is that the receipt PDF from the free tool is in English for now.

## 3. Which surfaces are parent-facing, and the rule for each

A surface is **parent-facing** if FeeDost puts it in front of the parent, under our name, and the tutor cannot read or edit the words first.

| # | Surface | Parent-facing? | Rule |
| --- | --- | --- | --- |
| S1 | `/p/{token}`, every state: opening, consent (asking), privacy notice (read only), fee page, all paid, not found, rate limited, failed. This includes the QR code block (R1-9 Part C) and the "I've paid" claim sheet with its states (R1-10) | Yes | English only. The header language button is hidden while English is the only unlocked language. |
| S2 | `/r/{token}`, every state, cancelled included | Yes | English only. |
| S3 | Receipt PDF from the app: Download on the in-app receipt and on `/r/` (R1-7 Part C) | Yes: the parent keeps it, and the tutor cannot edit its words | English only. It follows S2's language. |
| S4 | Receipt PDF from the free tool `/tools/fee-receipt` (R0-3) | Yes: the tutor makes it, but it is a fixed document under our name that she gives to the parent and cannot edit | English only. **The language choice offers only unlocked languages**, so today the PDF language picker is not drawn and the PDF is English. The tool page itself (labels, help, buttons) stays in all four languages. |
| S5 | Reminder message (R0-2 free tool and R1-8 in the app) | **No, not covered by this decision** | Unchanged: in the language the tutor picked (R1-8 criterion 9, R0-2 criterion 28). |
| S6 | WhatsApp text that goes with a receipt (R1-7 criterion 35, R0-3 "Share on WhatsApp") | **No, same reasons as S5** | Unchanged: in the parent's language. |
| S7 | The tutor app, the landing page, the free tools' page words | No | Unchanged: all four languages. |

**Why S4 drops the languages instead of keeping them behind a "not reviewed" label.** A label still puts unreviewed text in front of a parent, which is what the decision rules out. It also needs new words and a new control. Dropping the languages is the smaller change: the picker reads the same review record as S1 to S3, so it comes back by itself when a language is signed.

**Why S5 and S6 are outside the decision.** Four reasons:

1. The tutor reads the whole message in the preview before it goes.
2. She sends it from her own WhatsApp, in her own name, and can edit it there.
3. She chose the language for that parent, so she is the person who reads every message before it is sent.
4. It has no consent or legal wording.

Making reminders English would also undo R0-2 criterion 28 and R1-8 criterion 9. That is a larger change than the founder asked for. The founder can still pull these messages in (question 1).

### The unlock rule (all of S1 to S4)

- **When a language turns on.** It turns on for a surface only when every review record that surface's words come from has, for that language, all of these:
  - `status` exactly `"reviewed"`;
  - a `reviewer` field naming a person;
  - a `date`;
  - a `sha256` that matches the text now in the message file.
- **The review records:**
  - S1: `src/lib/pay-page-words.review.json`, plus `src/lib/receipt-words.review.json`, because `/p/` reuses the receipt's month and subject words.
  - S2 and S3: `src/lib/receipt-words.review.json`.
  - S4: the R0-3 review record on PR #12 (`src/lib/receipt/templates.review.json`).
- **A model review never counts.** No agent writes `"reviewed"` in any record. The founder names the reviewer, and the reviewer's name goes in the record.
- **Changed text locks the language again.** If text is changed after it was signed, the hashes no longer match. That language goes back to English on that surface until it is signed again. A screen never mixes a reviewed language with English.
- **What the page language becomes:**
  - S1 and S2 use the student's `parent_language` if it is unlocked, otherwise English.
  - Where today's rule falls back to the tutor's language or the browser's first language, each step is used only if that language is unlocked, otherwise English.
- **Each surface on its own.** A language can be unlocked for `/r/` before `/p/`. A parent could then read a Hindi receipt and an English pay page. That is accepted.
- **Consent wording.** S1's consent and notice lines are English whatever is unlocked, until R1-9 question 3 is answered. If the English consent text changes, any language that was signed must be signed again (rule above).

## 4. Acceptance criteria

1. [e2e] With the review records as they are on `main` today (hi, kn, te "not reviewed"), every state of `/p/{token}` in S1 shows only English words. This holds for students whose `parent_language` is en, hi, kn or te, and with the browser's first language set to hi, kn or te. No language button is drawn.
2. [e2e] Same as 1 for every state of `/r/{token}`, cancelled included.
3. [unit] With a test review record that unlocks only Hindi for S1:
   - a Hindi student's page opens in Hindi;
   - a Kannada student's page opens in English;
   - the language button lists exactly English and हिन्दी.

   The same fixture with a blank `reviewer`, any `status` other than `"reviewed"`, or a `sha256` that does not match stays English.
4. [e2e] `<html lang>` and the page's `lang` match the language actually shown. When English is shown for a Hindi student, `lang` is `en`, so Anek and the Indic line height are not applied to English words.
5. [e2e] Names are shown as saved in any script, with `translate="no"`. Amounts and dates use 0-9 digits and their usual faces in every case.
6. [unit] The app's receipt PDF (S3) is in English whatever the student's language. A Hindi, a Kannada and a Telugu student name each come out shaped in it (joined letters, not boxes), so the Indic fonts are still embedded for names.
7. [e2e] The free tool (S4), opened at `/en/`, `/hi/`, `/kn/` and `/te/tools/fee-receipt/`:
   - the PDF is English;
   - no PDF language choice is drawn;
   - the tool page's own words are in the page's language;
   - the tool shows one tutor-facing line, "The receipt is made in English for now.", in all four message files;
   - Hindi, Kannada and Telugu names come out shaped in the PDF.
8. [unit] Unlocking needs no code: changing only a review record (S4's, in a test fixture) to a signed state brings that language back to S4's choice and PDF.
9. [unit] Every parent-surface key stays in all four message files. `pnpm i18n:check` passes, and no `TODO-translate` text is ever shown.
10. [e2e] The layout tests for S1 and S2 (360px, font at 100%, 130% and 200%) still run in hi, kn and te, with the language unlocked by a test fixture. So a sign-off never waits on a layout fix.
11. [unit] S5 and S6 are unchanged: R1-8's and R0-2's message tests stay green, and a Hindi student's reminder is still Hindi.
12. [unit] The release gate: hi, kn or te marked "not reviewed" on a surface where that language is locked no longer blocks a release. The `consentWording` "draft, not approved" record still blocks releasing to real parents (R1-9 question 3). `tech-lead` decides how `i18n:check --strict` shows this. It must never pass while a language a parent can see is unsigned.

## 5. Edge cases

- **Hindi reminder, English page:** the reminder (S5) is Hindi and the `/p/` link in it opens in English. Accepted until Hindi is signed for S1 (question 1).
- **Hindi-speaking tutor on `/hi/tools/fee-receipt/`:** the tool is in Hindi and the PDF in English, with the one line from criterion 7.
- **Old link opened after a sign-off:** pages are always fetched fresh, so the parent sees the newly unlocked language. An old PDF already sent stays in English.
- **Text changed after sign-off:** that language goes back to English on that surface. No half-translated screen.
- **Very long names, large font:** unchanged; English labels wrap like the others.
- **Browser translate:** names are `translate="no"`. A parent can use the browser's own translate on English text; nothing stops it.
- **Partial payment, duplicates, offline:** no change from R1-7, R1-9 and R1-10.

## 6. Out of scope

| Not here | Where |
| --- | --- |
| Finding, paying or naming the reviewers | The founder (question 4) |
| Writing or improving hi, kn, te text | Each slice's words, as they are now |
| Privacy and consent wording, who is controller, retention, withdrawal, full notice page | R1-9 question 3 (still open) |
| Making reminders or share messages English | Not decided (question 1) |
| A "not reviewed" label or warning anywhere | Not built (section 3) |
| Not shipping locked languages' words in the page | `tech-lead`'s call (bundle only; never visible) |

## 7. Design references

- `design/project/PayPage.dc.html` and `Consent.dc.html`: the header language button is not drawn while only English is unlocked.
- `design/project/Receipt.dc.html`: `/r/` and the PDF.
- `design/project/Tool-receipt.dc.html`: the free tool. The PDF language choice is not drawn.

## 8. Analytics

None. No events change.

## 9. Test by hand on a phone

1. On feedost.vercel.app (staging data), make a made-up student with parent language Hindi. Open their `/p/` and `/r/` links on a second phone: English everywhere, no language button, the Hindi name joined correctly.
2. Set the second phone's language to Hindi and open a broken `/p/` link: "This link doesn't work…" in English.
3. Download that student's receipt PDF: English, the name shaped, one page.
4. Open `/hi/tools/fee-receipt/`: Hindi page, no PDF language choice, the "English for now" line. Make a PDF with a Telugu name: English text, Telugu name joined. Share it to WhatsApp and look at the preview.
5. Send that student a reminder from the app: the message is still Hindi.

## 10. Open questions for the founder

1. **Reminders and receipt share messages (S5, S6).** Default: not covered, for the reasons in section 3. This means a Hindi parent gets a Hindi message whose link opens an English page. Say if you want these messages in English too until a reviewer signs them.
2. **R1-9 question 3 (privacy and consent wording) is still open.** You declined to draft it now. It stays a gate on releasing to real parents (the public launch, and also giving feedost.vercel.app to any real tutor). It does **not** block merging #25 to `main`. Today `main` deploys only to feedost.vercel.app, which runs against staging with made-up data, and no real parent can reach it (`docs/ENVIRONMENTS.md`, "Temporary: feedost.vercel.app").
3. **QR code size (R1-9 criterion 43).** #25 draws the QR code at 204px at 200% text. Criterion 43 says at least 220px square. Either make #25 meet 220px at every text size, or change the criterion (for example, 220px at normal text and at least 200px at 200%). Your call; not decided here.
4. **Who reviews each language?** No sign-off can happen until you name a reader for hi, kn and te. Nothing waits on it now.

## 11. Hand-off

To `tech-lead`:

- Plan the S1 and S2 change (`/p/` and `/r/` on `main`) as its own small PR that lands **before or inside** #25. #25 is what sends parents to `/p/`.
- Plan the S4 change on #12.
- Plan S3 inside R1-7 Part C when it is built.
- Decide the `i18n:check --strict` shape (criterion 12), and whether locked languages' words still ship in the `p` and `r` shells.
