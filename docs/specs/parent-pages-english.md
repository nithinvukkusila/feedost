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
- **Changed text locks the language again.** If text is changed after it was signed, the hashes no longer match. That language goes back to English on that surface until it is signed again. A screen never mixes a reviewed language with English, except the consent lines (below).
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
| Making reminders or share messages English | Founder chose not to (question 1, 2026-10-16) |
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

1. **Reminders and receipt share messages (S5, S6).** Default: not covered, for the reasons in section 3. This means a Hindi parent gets a Hindi message whose link opens an English page. Say if you want these messages in English too until a reviewer signs them. **Answered 2026-10-16 (founder): keep the default.** Reminders and share messages stay in the parent's language.
2. **R1-9 question 3 (privacy and consent wording) is still open.** You declined to draft it now. It stays a gate on releasing to real parents (the public launch, and also giving feedost.vercel.app to any real tutor). It does **not** block merging #25 to `main`. Today `main` deploys only to feedost.vercel.app, which runs against staging with made-up data, and no real parent can reach it (`docs/ENVIRONMENTS.md`, "Temporary: feedost.vercel.app").
3. **QR code size (R1-9 criterion 43).** #25 draws the QR code at 204px at 200% text. Criterion 43 says at least 220px square. Either make #25 meet 220px at every text size, or change the criterion (for example, 220px at normal text and at least 200px at 200%). **Answered 2026-10-16 (founder): 220px at every text size.** Criterion 43 stands.
4. **Who reviews each language?** No sign-off can happen until you name a reader for hi, kn and te. Nothing waits on it now.

## 11. Hand-off

To `tech-lead`:

- Plan the S1 and S2 change (`/p/` and `/r/` on `main`) as its own small PR that lands **before or inside** #25. #25 is what sends parents to `/p/`.
- Plan the S4 change on #12.
- Plan S3 inside R1-7 Part C when it is built.
- Decide the `i18n:check --strict` shape (criterion 12), and whether locked languages' words still ship in the `p` and `r` shells.

---

# Technical plan (tech-lead, 2026-10-16)

## 1. Approach

The unlocked set is worked out **at build time**, in the server page of each parent surface, from the review records and the raw message files. The page then ships **only the unlocked languages' words** (English always). The client picks `language` if that language's words are present, otherwise English. It draws the language button only when more than one language is present. A locked language cannot be shown because its text is not in the shell at all. "Unlocking needs no code" means: commit a signed record and the next deploy (every push to `main` rebuilds) carries that language. No migration and no Edge Function change are needed: `get_receipt` and `get_pay_page` already return one `language` (`coalesce(parent_language, tutor.language, 'en')`), and gating that one value gives exactly the section 3 rule.

## 2. The unlock mechanism (one module)

**The rule lives in `scripts/language-unlock.mjs`.** It is plain ESM and imports only `node:crypto`, so the build, `i18n:check`, `check:leak` and vitest all run the same code. It exports:

- `copyHash(messages, keys)` and `receiptTemplateHash(entry)`. These move here from `scripts/i18n-check-lib.mjs`, which imports and re-exports them, so existing imports keep working. There is exactly one hash function per record kind.
- `isSigned(entry, currentHash)`. True only when all of these hold:
  - `entry.status === "reviewed"`;
  - `entry.reviewer` is non-blank after trimming;
  - `entry.date` matches `YYYY-MM-DD`;
  - `entry.sha256` is 64 lowercase hex characters and equals `currentHash`;
  - `currentHash` is not null. The hash is null when any hashed key is still `TODO-translate`, so a marked word can never be signed.
- `SURFACES`, the table of which records each surface needs:

  | Surface | Records (all must be signed for the language) | Hashed text |
  | --- | --- | --- |
  | `payPage` (S1) | `src/lib/pay-page-words.review.json` and `src/lib/receipt-words.review.json` | every `payPage.*` leaf, and every `receipt.*` leaf, read from en.json's key list |
  | `receipt` (S2, S3) | `src/lib/receipt-words.review.json` | every `receipt.*` leaf |
  | `receiptTool` (S4, added on #12) | `src/lib/receipt/templates.review.json` | `receiptTemplateHash(templates[locale])` |

- `unlockedFrom(surface, { records, messages, templates? })`. A pure function. It returns `["en", ...signed]` in `locales` order. Records are passed in, so a test or the dev route can hand it a fixture.
- `consentApproved(record, messages)`. Moved out of `checkConsentWording`, which then calls it. It uses the same `consentHash`.
- `signedFixture(surface, langs, { messages, templates?, consent? })`. It returns records that unlock `langs`, with `reviewer: "Test fixture"` and the real current hashes. It is for tests and `/dev` only. A code-rule test fails if anything under `src/app/p`, `src/app/r` or `src/app/[locale]` imports it.

**`src/lib/unlocked-languages.ts`** is the typed wrapper for server pages. It contains no rule of its own.

- It imports the three records and the **raw** `messages/*.json` statically (raw, not through `loadMessages`, because the hash is over the file as it stands, `TODO-translate` included). Static imports let the bundler track them.
- `payPageWords(options?)` returns `UnlockedWords<PageWords>`. It calls `getAllWords("payPage")` and `getAllWords("receipt")`, keeps only the unlocked languages and then applies the **consent rule**. Until `consentApproved` is true, each non-English entry's `pay.consent` subtree is replaced by English's. `pay.consent` is exactly the subtree `consentHash` covers.
- `receiptWords(options?)` returns `UnlockedWords<ReceiptWords>`.
- `options.records` (a fixture) is used only by `/dev`.
- The type is `UnlockedWords<W> = { en: W } & Partial<Record<"hi" | "kn" | "te", W>>`.

**Client side** (`src/lib/public-words.ts`, browser-safe, no crypto): `shownLanguage(words, candidate: Locale | null): Locale`. It returns `candidate` when `words[candidate]` exists, otherwise `"en"`.

- On `/p/`: `shownLanguage(words, chosen ?? page?.language ?? browserLanguage(preferred))`.
- On `/r/`: the same, without `chosen`.
- For browser fallback, the first of our languages in the browser list is taken and then gated. A locked first preference gives English and does not move on to the next preference (the spec's "each step ... otherwise English").

**Test fixture for layout (criterion 10).** Two dev-only pages:

- `src/app/dev/unlocked/p/page.dev.tsx` is `/dev/unlocked/p/?t={token}`. It renders `PublicPayPage` with `payPageWords({ records: signedFixture("payPage", ["hi","kn","te"], { consent: true }) })`.
- `src/app/dev/unlocked/r/page.dev.tsx` is `/dev/unlocked/r/?t={token}` and does the same for `receiptWords`.

Like `/dev/components`, they are `page.dev.tsx` files, so `next.config.ts` leaves them out of every Vercel production build. They are present locally, in CI and on previews (staging data only). Both components take a serialisable prop, `tokenSource?: "path" | "query"`, defaulting to `"path"`. The dev pages pass `"query"`, and the token is checked with the same `TOKEN` pattern. Consent is approved in this fixture so the Hindi, Kannada and Telugu consent text is layout-tested as well.

**`i18n:check` and `--strict` (criterion 12).** This applies to the three parent records (`receipt-words`, `pay-page-words`, and R0-3's `templates.review.json`). The verdict for each language uses `isSigned`, so the check and the pages cannot disagree.

| State of a language in a parent record | plain `i18n:check` | `--strict` |
| --- | --- | --- |
| signed, hash matches | note "hi unlocked for /p/" | pass |
| `"not reviewed"` (blank fields) | note "hi locked: parents see English" | **pass** (changed: it was a problem) |
| `"reviewed"` with a missing name, date or hash | problem | problem (unchanged) |
| `"reviewed"`, but the text changed since (stale hash) | note "hi locked again: text changed after review by X on D" | **problem**. Someone edited signed text. To ship English on purpose, set the entry back to `"not reviewed"`. |
| `TODO-translate` in `payPage.*` or `receipt.*` of a locked language | not a problem | **not a problem** under `check()`'s global strict TODO rule. `check()` gets a `skipTodo(locale, key)` option, and the script passes "the key is in a parent namespace and `locale` is locked for every surface that uses it". App namespaces keep failing strict as today. |
| `consentWording` not approved | note | **problem**, reworded: "payPage consent wording is a draft: release to real parents blocked on R1-9 question 3" (question 5 is dropped from the text) |

The summary line prints, for example: `parent pages: /p/ en | /r/ en | receipt tool en (locked: hi, kn, te)`.

`--strict` can never pass while a parent can see an unsigned language. A language is visible only if `isSigned` is true, and a stale signature fails strict. The draft consent wording still fails strict, so the release gate to real parents stays shut.

**`check:leak` (`scripts/check-locale-leak.mjs`, SHELLS block).** The test that "every language's words are on the page" becomes: every **unlocked** language's words are on the page, and **no locked language's** `payPage` or `receipt` words are. The removable set is built from unlocked languages only, so a locked word left in the shell is reported as a leak. This turns criterion 1 into a build-level proof as well as an e2e one.

## 3. PR split and order

| Order | PR | Branch | Carries |
| --- | --- | --- | --- |
| 0 | #32 (this spec) | `docs-parent-pages-english` | docs only. Merge first so code PRs cite it. |
| 1 | **new PR "A"**, small, on `main` | `parent-pages-english` from `main` after #32 | the mechanism (section 2), the S1 and S2 gating, the check and leak changes, the `/dev/unlocked` fixture pages, and the e2e moves. **No message keys change.** |
| 2 | #25 | `r1-9-part-c` | merge `main` (with A) in. Its hi, kn and te QR layout runs move to `/dev/unlocked/p/`, it gets the QR size constant (section 7), and the criterion 48 checklist says "English". |
| 2 (parallel) | #12 | `r0-3b-receipt-maker` | merge `main` (with A) in, add the `receiptTool` surface, and the S4 changes. |
| later | R1-7 Part C | not started | S3: the in-app PDF takes words from `receiptWords()` and picks with `shownLanguage`. It owes criterion 6's unit test. |
| later | R1-10 Part C | not started | The claim sheet's words are `payPage.*`, so it is covered with no extra mechanism. Its hi, kn and te layout runs go on `/dev/unlocked/p/`. |

**Why A is separate rather than folded into #25:**

- A also covers `/r/`, which #25 never touches.
- A has no dependency on `uqr` or the reminder change.
- #25 is a reviewed draft. Folding unrelated scope into it restarts that review.
- A is about 10 files of logic and tests, and `lead-reviewer` can merge it on its own.

The constraint "on main before or with #25" is enforced by order: #25 must merge `main` after A lands, and `lead-reviewer` checks that `git merge-base --is-ancestor <A's merge commit> origin/r1-9-part-c` holds before merging #25.

**#12 is 9 commits behind `main`, with 6 conflicting files.** Bring `main` in with a **merge, not a rebase**. The branch already has a merge commit (`85316f0`), it is pushed, and it has review history. Rebasing a branch that contains a merge replays 10 commits and loses that history. Do it only after A is on `main`. Resolve as follows:

- `scripts/i18n-check.mjs` (1 hunk): keep both import lists, and use `leafPaths` from the lib (main moved it there). Keep main's `PAYPAGE_REVIEW` block and #12's `RECEIPT_TOOL_*` constants. Then apply A's locked or unlocked semantics to `checkReceiptTemplates` (it is one more parent record).
- `src/lib/reminder/reminder.ts` (1 hunk): keep #12's move of the checks to `src/lib/fields.ts`. Bring main's `APP_MAX_PAISE` and `PHONE_E164` into `fields.ts` if they are not already there (they are there on #12). **`UPI_ID` must have one home:** `fields.ts` re-exports it from `src/lib/upi-link.ts` (main's) and does not define a second regex. `reminder.ts` keeps main's `buildUpiLink` import and the re-exports so every import still resolves.
- `src/lib/size-scripts.test.ts` (1 hunk): keep main's `/p/` shell `describe` and #12's `receiptPages` additions.
- `src/app/[locale]/page.test.tsx` (1 hunk): take a union. The allowed href pattern is `#waitlist`, a language's landing page, `fee-receipt`, `fee-reminder` and `sign-in`. The counts are reminder ×2, sign-in ×2 and receipt ×1. Drop main's `not receipt` assertion.
- `e2e/landing.spec.ts` (3 hunks) and `e2e/fee-reminder.spec.ts` (1 hunk): take main's sign-in link changes and #12's receipt-maker link.
- The `messages/*.json` and `scripts/i18n-check-lib.mjs` auto-merges must be re-checked. Run `pnpm i18n:check`, `pnpm test`, `pnpm build`, `pnpm check:leak`, `pnpm size` and `pnpm test:e2e`, and resolve any duplicate `leafPaths` definition left in the lib.

## 4. Files

**PR A (main):**

- `scripts/language-unlock.mjs` (new): `copyHash`, `receiptTemplateHash` (a stub until #12 lands it; or add it in #12, which is preferred), `isSigned`, `SURFACES`, `unlockedFrom`, `consentApproved`, `signedFixture`.
- `scripts/i18n-check-lib.mjs`: re-export the hashes. `checkReviewRecord` uses `isSigned` and takes a new `parent: true` option for the locked and stale semantics. `check()` gets `skipTodo`. `checkConsentWording` uses `consentApproved` and carries the new wording.
- `scripts/i18n-check.mjs`: pass `parent: true` for the receipt and pay page records, pass `skipTodo` from `unlockedFrom`, and print the summary line.
- `scripts/check-locale-leak.mjs`: SHELLS uses `unlockedFrom` (section 2).
- `src/lib/unlocked-languages.ts` (new): the typed wrapper, `payPageWords`, `receiptWords`, `UnlockedWords`.
- `src/lib/public-words.ts`: add `shownLanguage`.
- `src/lib/pay-page-words.ts`: `AllPageWords` becomes `UnlockedWords<PageWords>`, and `pageWords` takes the filtered set.
- `src/lib/receipt-words.ts`: `AllReceiptWords` becomes `UnlockedWords<ReceiptWords>`.
- `src/app/p/page.tsx` and `src/app/r/page.tsx`: call `payPageWords()` and `receiptWords()`.
- `src/components/pay-page/public-pay-page.tsx`:
  - use `shownLanguage`;
  - pass `action` only when `Object.keys(words).length > 1`;
  - `setChosen` accepts only a present language;
  - add the `tokenSource` prop.
- `src/components/pay-page/language-menu.tsx`: takes `choices: readonly Locale[]` in place of iterating `locales`.
- `src/components/receipt/public-receipt.tsx`: use `shownLanguage` and add `tokenSource`.
- `src/lib/pay-page-public.ts` and `src/lib/receipt-public.ts`: export `isToken(raw)`, which `tokenFromPath` already uses inside.
- `src/app/dev/unlocked/p/page.dev.tsx` and `src/app/dev/unlocked/r/page.dev.tsx` (new): the fixture pages.
- Tests (section 6), and existing tests whose Hindi, Kannada or Telugu assertions on `/p/` and `/r/` move to the dev pages:
  - `e2e/pay-page.spec.ts` (the `langs` loop at line 70);
  - `e2e/pay-page-layout.spec.ts`;
  - `e2e/pay-page-hostile.spec.ts` (loops at lines 551 and 578);
  - `e2e/receipt-public.spec.ts` (lines 12, 82 and 159);
  - `e2e/receipt-public-layout.spec.ts`;
  - `src/lib/pay-page-review.test.ts` (strict output strings);
  - `src/components/pay-page/public-pay-page.test.tsx`;
  - `src/components/pay-page/language-menu.test.tsx`;
  - `src/components/receipt/public-receipt.test.tsx`.
- `e2e/pay-page-helpers.ts` and `e2e/receipt-public-helpers.ts`: add `unlockedLink(token)`, which returns `/dev/unlocked/p/?t=…` (or `/r/`).
- `src/CLAUDE.md`: one line in the layout map for `src/app/dev/unlocked/`, and one rule: "A parent surface's languages come from `src/lib/unlocked-languages.ts`; never list `locales` on `/p/`, `/r/` or in a parent PDF."

**#25:**

- `src/components/pay-page/qr-block.tsx`: `export const QR_MIN_PX = 220;` plus `style={{ minWidth: QR_MIN_PX }}` on the QR box (line 54). Inline `minWidth` is not a token rule violation.
- `e2e/pay-page-qr.spec.ts`: the 200% assertion becomes `>= QR_MIN_PX` (imported). Its hi, kn and te runs use `unlockedLink`.

**#12:**

- `scripts/language-unlock.mjs`: add `receiptTemplateHash` (moved from `receiptHash` in the lib) and the `receiptTool` surface.
- `src/lib/unlocked-languages.ts`: add `receiptToolLanguages(options?)`, which returns `Locale[]`.
- `src/app/[locale]/tools/fee-receipt/page.tsx`: pass `languages={receiptToolLanguages()}` and a `forNow` word to `ReceiptTool`.
- `src/components/receipt/receipt-tool.tsx`:
  - `languages: readonly Locale[]` prop;
  - `receiptLang` starts at `languages.includes(pageLocale) ? pageLocale : "en"`;
  - draw the `Segmented` only when `languages.length > 1`, with options from `languages`;
  - otherwise draw the line `receiptForm.englishForNow` in the picker's place (`type-caption`, `wrap-anywhere`);
  - WhatsApp text language: see question T2 in section 8.
- `messages/{en,hi,kn,te}.json`: add `receiptForm.englishForNow` in all four files at once:
  - en: "The receipt is made in English for now.";
  - hi, kn, te: `TODO-translate: The receipt is made in English for now.`. This is tutor-facing interface text, which R0-3 criterion 32 allows to be marked.
- `scripts/i18n-check.mjs` and `scripts/i18n-check-lib.mjs`: `checkReceiptTemplates` gets the `parent` semantics.
- Tests (section 6). Update `e2e/fee-receipt.spec.ts` and `src/components/receipt/receipt-tool.test.tsx`, where they pick a receipt language or assert four endonyms.
- `docs/specs/R0-3-receipt-maker.md`: add pointers to this file at criteria 8, 26 and 33.

## 5. Data

None. No migration, no RLS change, no Edge Function change. `parent_language` is still stored and returned. The pages only refuse to show a locked language.

## 6. Tests required

| Criterion | Test | Where |
| --- | --- | --- |
| 1 | e2e: every state of `/p/` (opening, consent, notice, fee, all paid, not found, rate limited, failed; claim sheet when R1-10 C lands) for `language` en, hi, kn and te, and under `test.use({ locale: "hi-IN" })` etc. for the no-data states. No Devanagari, Kannada or Telugu characters in `main`'s text **except inside `[translate="no"]` name spans**. No language button. | `e2e/parent-english.spec.ts` (new) |
| 1 (build proof) | `check:leak`: no locked `payPage` or `receipt` word in `p/index.html` | `scripts/check-locale-leak.mjs` and its test in `src/lib/` |
| 2 | Same as 1 for `/r/`, paid, part paid and cancelled included | `e2e/parent-english.spec.ts` |
| 3 | Unit: `unlockedFrom` with `signedFixture("payPage", ["hi"])` gives `["en","hi"]`. The same fixture with blank `reviewer`, `status: "Reviewed"` / `"model reviewed"`, a wrong `sha256`, a valid `sha256` of other text, or a `TODO-translate` in one key gives `["en"]`. Only one of the two S1 records signed gives `["en"]`. | `src/lib/unlocked-languages.test.ts` (new) |
| 3 | Unit (render): `PublicPayPage` with words `{en, hi}`: a Hindi student shows Hindi, a Kannada student shows English, and the menu lists exactly English and हिन्दी. With `{en}` alone, no button. While consent is not approved, the consent lines are English inside a Hindi page. | `public-pay-page.test.tsx`, `language-menu.test.tsx` |
| 4 | e2e: Hindi student on `/p/` and `/r/`: `html[lang]` and `main[lang]` are `en`, and the computed `font-family` of a label is not Anek | `e2e/parent-english.spec.ts` |
| 5 | e2e: a Telugu tutor name and a Hindi student name appear as saved, inside `translate="no"`. The amount is in its face, with 0-9 digits. | `e2e/parent-english.spec.ts` |
| 6 | Unit, owed by R1-7 Part C (S3 is not built) | R1-7 Part C plan |
| 7 | e2e on #12: for each of the four tool pages, no `receipt-language-*` control, the `englishForNow` line is in the page's language, the page `h1` is in the page's language, and Download gives a PDF whose drawn words are English (check the preview's `lang="en"` and English heading; the PDF is checked through the unit test below) | `e2e/fee-receipt.spec.ts` (#12) |
| 7 | Unit on #12: `makePdf({ lang: "en", student: "क्षितिज" / "ಶ್ರೀನಿವಾಸ" / "శ్రీనివాస్" })` fetches that script's font. fontkit layout of each name in the shipped subset font has no glyph id 0 and fewer glyphs than code points (the conjunct is shaped). | `src/lib/receipt/make-pdf.test.ts` (#12) |
| 8 | Unit on #12: `unlockedFrom("receiptTool", { records: signedFixture("receiptTool", ["kn"]) })` gives `["en","kn"]`. `ReceiptTool` with `languages=["en","kn"]` on `/kn/` draws the picker with two options, preselects ಕನ್ನಡ, and the preview and `makePdf` get `lang: "kn"`. With the shipped record: `["en"]`. | `src/lib/unlocked-languages.test.ts`, `receipt-tool.test.tsx` (#12) |
| 9 | Existing `i18n:check` key-parity tests stay green. Unit: no value returned by `payPageWords()` or `receiptWords()` contains `TODO-translate`. | `src/lib/unlocked-languages.test.ts` |
| 10 | e2e: the existing 360px / 100-130-200% layout runs for hi, kn and te, pointed at `/dev/unlocked/p/` and `/dev/unlocked/r/` with the same stubs; en stays on the real route. The CI step "Production build leaves out the dev routes" (`.github/workflows/ci.yml`, fails if `out/dev` exists) already covers `/dev/unlocked/*`. PR A adds one sentinel string from the new pages to that step so a rename cannot slip through. | `pay-page-layout.spec.ts`, `receipt-public-layout.spec.ts` |
| 11 | No change to `src/lib/reminder/**` in PR A. `app-reminder.test.ts`, `templates.test.ts` and `remind-run.test.tsx` stay green unmodified, and one of them already asserts a Hindi student's message is Hindi; `code-reviewer` checks the diff touches none of them. | existing |
| 12 | Unit: the table in section 2, one case per row, on temp directories (the pattern of `pay-page-review.test.ts`). The shipped records give: plain passes; strict fails with the consent-draft line and **not** with "pay page words are not reviewed" / "receipt words are not reviewed". A test that `isSigned` and `checkReviewRecord` agree on 8 vectors. | `src/lib/pay-page-review.test.ts`, `src/lib/i18n-check.test.ts` |
| guard | Code rule: no `"use client"` file imports `@/lib/unlocked-languages` or `scripts/`. No file under `src/components/pay-page`, `src/components/receipt` or `src/app/{p,r}` imports `locales` from `@/config/locales`, except `localeNames` and the type. | `src/lib/pay-page-code-rules.test.ts` |

## 7. QR size (founder question 3), prepared as a one-line change

**Decided 2026-10-16: "220 everywhere".** #25 adds `export const QR_MIN_PX = 220` in `qr-block.tsx`, applied as `style={{ minWidth: QR_MIN_PX }}` on the QR box. `e2e/pay-page-qr.spec.ts` imports it for the 200% assertion; the 100% assertion stays at 220.

- **"Change the criterion"** (220 normal, at least 200 at 200%): not chosen.
- **"220 everywhere"** (the founder's choice): `QR_MIN_PX` is `220`. The box is a centred flex child, so it spreads 8px into each side margin at 200% (the margins are at least 32px there). The same spec's sideways-scroll check proves the page still does not scroll. Frontend-dev records the 200% result in #25.

## 8. Bundle impact

`pnpm size` counts listed scripts only.

- `/p/`: the JS change is `shownLanguage`, a conditional render and a `choices` prop, under 0.3 KB. Expected 143.1 to about 143.3 KB on A, and about 144.3 KB after #25, against the 151 KB budget.
- `/r/`: 138.5 KB, unchanged within 0.2 KB, against 145 KB.
- The shells' **HTML** shrinks, because only English words ship. Today's 5.4 KB gzipped `/p/` HTML should drop to about 2 KB. Frontend-dev records the before and after numbers from `check:leak`.
- `node:crypto` and the records never reach a browser bundle. The code rule above enforces this, and the build would fail.
- `/dev/unlocked/*` is not budgeted.
- #12's tool pages: the island still imports `Segmented` and `templates.json` (four languages, invisible), so there is no change beyond one word. `en/tools/fee-receipt` stays within 0.2 KB of its #12 number.

## 9. Work split

**PR A, branch `parent-pages-english` from `main` (after #32):**

1. `frontend-dev`: `scripts/language-unlock.mjs`, the re-exports and the `isSigned` refactor of `checkReviewRecord` and `checkConsentWording`, plus their unit tests (criteria 3 and 12 rows). `pnpm i18n:check` output must be unchanged except for the summary and the strict semantics.
2. `frontend-dev`: `src/lib/unlocked-languages.ts`, `shownLanguage`, the type changes, `p/page.tsx` and `r/page.tsx`, and the criterion 9 unit test.
3. `frontend-dev`: `PublicPayPage`, `LanguageMenu` (`choices`) and `PublicReceipt` gating, `tokenSource`, and the render tests.
4. `frontend-dev`: the `/dev/unlocked/{p,r}` pages and `unlockedLink`. Move the hi, kn and te e2e assertions there, and add `e2e/parent-english.spec.ts` (criteria 1, 2, 4 and 5).
5. `frontend-dev`: `check:leak` SHELLS change and its test, `src/CLAUDE.md` lines, and the code-rule guard. Then `pnpm lint typecheck test build check:leak size test:e2e i18n:check` and record `/p/` and `/r/` JS and HTML sizes in the PR.

**#25, branch `r1-9-part-c`:**

6. `frontend-dev`: merge `origin/main` (with A). Fix `pay-page.spec.ts` and `fee-screen.test.tsx` overlaps, add the `QR_MIN_PX` constant and the e2e import, move the QR hi, kn and te runs to `unlockedLink`, set `QR_MIN_PX = 220` and record the 200% result in the PR, and change criterion 48's checklist wording to "English". Re-measure `/p/`.

**#12, branch `r0-3b-receipt-maker` (after A; can run alongside 6):**

7. `frontend-dev`: `git merge origin/main` and resolve the 6 files as in section 3. Single `UPI_ID`. All checks green before any S4 change.
8. `frontend-dev`: `receiptTemplateHash` and the `receiptTool` surface, `receiptToolLanguages`, the `checkReceiptTemplates` parent semantics, and the unit tests for criteria 8 and 12.
9. `frontend-dev`: `ReceiptTool` `languages` prop, picker hidden, the `englishForNow` key in all four files, the page prop, the criterion 7 unit test (shaping) and e2e, and the R0-3 spec pointers. **Wait for T1 and T2 (section 11) before merging.**

## 10. Risks and traps

- **Hash drift between check and page.** If the page and `i18n:check` hashed differently, a language could be "signed" in one and not the other. Avoided: one `isSigned` and one hash function in `scripts/language-unlock.mjs`, plus the agreement test.
- **Hashing stripped text.** `loadMessages` strips `TODO-translate`, and hashing its output would let a marked word look signed. The wrapper hashes the raw imported JSON, and a test plants a marker and expects `["en"]`.
- **Server-only code in a client bundle.** `node:crypto` in an island breaks the build or, worse, ships records. Covered by the code-rule test. The wrapper is imported only by `page.tsx` files.
- **Dev fixture reaching production.** It relies on `.dev.tsx` being excluded when `VERCEL_ENV=production`. The CI step "Production build leaves out the dev routes" guards it, plus PR A's sentinel string. Even on a preview, it reads only staging data, and the path is not linked from anywhere.
- **Stale signatures silently relocking.** Covered by the strict failure. Plain `i18n:check` prints a note on every PR.
- **The menu's Close word.** `LanguageMenu` uses `pay.consent.close`. With the consent override, that word is English inside an unlocked Hindi page. This is accepted (one word, only once a language is unlocked). Moving the key is a message-file rename, not done here.
- **Consent lines in an unlocked language** are English by spec (criterion 36). This is a deliberate mix the spec allows. The render test pins it so nobody "fixes" it.
- **The R1-10 Part B work in the founder's main checkout** (`r1-10b-claims-inbox`, uncommitted) touches none of A's files and no message keys. A adds no keys, so the four message files do not conflict.
- **#25 and #12 both edit around `scripts/i18n-check*.mjs` and `size-scripts.test.ts`.** Whichever merges second merges `main` again. The conflicts are small and the same shape as in section 3.
- **e2e locale.** Criterion 1's browser-language cases need `test.use({ locale })` per describe, not `page.setExtraHTTPHeaders`. The page reads `navigator.languages`.
- **Search text on #12** still says "PDF in 4 languages" (question T1). Merging #12 without an answer would publish a false claim on four pages.

## 11. Not doing

- No runtime or remote unlock. Each unlock is a commit and a deploy.
- No "not reviewed" label (spec section 3).
- No change to reminders or share messages (S5, S6), and no change to R1-8 or R0-2 code.
- No new message keys on `/p/` or `/r/`.
- No migration or Edge Function change. No change to how `parent_language` is stored or edited.
- No lazy-loading of per-language words. It is not needed now that locked words do not ship.
- No new dependency.

## 12. Questions back to `product-manager` (for #12 only; nothing blocks PR A or #25)

- **T1.** R0-3 criterion 33 and `receiptTool.meta.title` / `description` in all four files say "PDF in 4 languages" / "in English, Hindi, Kannada or Telugu". With S4 English-only, these are untrue. What should the English title and description say? Suggested: "Free fee receipt maker for tutors: PDF in one minute" / "Make a fee receipt PDF in one minute. Free, no sign-up, made on your phone and not saved anywhere." hi, kn and te would be `TODO-translate` until reviewed. **#12 does not merge until answered.**
- **T2.** S6 says R0-3's "Share on WhatsApp" text stays "in the parent's language". The tool has no parent language: the old picker was the only signal, and it is now hidden. Which language does the share text use? Default in the plan: the page's language (what a tutor who never touched the picker got before). This is a one-line choice in `receipt-tool.tsx` (`waText(pageLocale, …)` vs `waText(receiptLang, …)`).

Founder question 3 (QR size) is answered: 220px everywhere (section 7).

## 13. Start

`frontend-dev` starts with **task 1** on a new branch `parent-pages-english` from `main`, once #32 is merged.
