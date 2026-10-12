# R1-9: parent pay page `/p/{token}`, parent consent, UPI fallback

Slice R1-9 (docs/BUILD_PLAN.md section 5, size L, depends on R1-5). Written 2026-10-13. Money-adjacent and the first page that shows a child's fee to a parent, so the full process applies. Nothing here moves money: the parent's UPI app pays the tutor's UPI ID directly.

Tags: [unit] Vitest, [e2e] Playwright at 360px with a stubbed function host, [db] pgTAP, [fn] Edge Function test (Node with fakes, as `receipt`), [manual] by hand on a phone against staging.

## Things the founder should know first

- **Three things the PRD lists on this page cannot be built from what is on `main`.** The tutor profile has no photo column (`tutors` has no `photo_url`), there is no `attendance` table (R1-11), and there is no `referral_code` (R1-13). The page ships without the photo, the attendance line and the referral link. Each owning slice adds its line (boundary table, section 6).
- **The "I've paid" button is R1-10, not here.** The PRD lists it on this page; BUILD_PLAN gives claims to R1-10, and the repo rule is that a button that cannot work is not shown. So until R1-10, a parent who paid has no way to say so on the page (edge case "Paid, then opens the link again").
- **Parents only reach this page if the reminder message links to it.** R1-8 ships a message with the raw `upi://` link and the plain UPI ID, and says the link changes when R1-9 lands. That change is in this slice (Part C). Without it nobody ever opens the page.
- **Consent is enforced by the server, not by the page.** Before the parent agrees, the Edge Function does not send the fee, the UPI ID, the receipts or anything else. A page that merely hid them would still hand them to anyone who looked at the network.
- **The QR code needs a decision on a library** (no QR code can be drawn from what is in the repo). It is its own part so the page does not wait for it.
- **Split into three pull requests, in this order, all under this one spec:**
  - **Part A** (criteria 1 to 15): database (`consents`, `get_pay_page`, `record_consent`, rate-limit counters) and the two Edge Functions `pay-page` and `record-consent`. Shippable alone; nothing on screen changes.
  - **Part B** (criteria 16 to 42): the `/p/{token}` page, consent screen, UPI button, Copy UPI ID, earlier receipts, all states. Needs A.
  - **Part C** (criteria 43 to 48): the QR code and the reminder message switching to the pay-page link. Needs B **live on production** first (criterion 48), or every parent who taps the new link gets "not found".

## 1. Goal

A parent who taps a link in WhatsApp sees, with no account and no install, who is asking for the fee, for which child and how much, taps one big button and lands in their own UPI app with the tutor's UPI ID and the amount already filled in. If the app does not open, they can copy the UPI ID or scan a QR code. The first time, they are told in plain words what is kept about them and their child and agree before they see the fee. Before this slice a reminder carries a raw UPI link and the parent has nowhere to look at the fee, the receipts or the privacy notice.

## 2. Users and moment

**The parent**: on their own phone (often a low-end Android on slow data), just opened WhatsApp, usually at night or on the way home. Not a tech user; may read Hindi, Kannada or Telugu rather than English; may share the phone with the child; has never heard of this product and is wary of an unfamiliar link asking for money. Wants: whose request is this, how much, pay now, done. Does not want to sign in, install, or give a phone number.

**The tutor** (indirect): sends the link in her reminder. Wants the parent to trust the page because her name leads it, and wants the money in her own UPI account with no one in between.

## 3. Defaults chosen (no founder input needed)

Each can be reversed; none blocks.

1. **One page per student, keyed by the student's `pay_token`** (it exists, 24 random URL-safe characters). The page shows that student's fees only. Two siblings with one parent number have two links, two pages. Never merged.
2. **The amount on the button is the total still owed across every open fee of that student** (each unpaid or part paid fee, including an earlier balance). The page lists each fee on its own line above the button so the parent sees what the total is made of. (Question 1.)
3. **Consent is recorded per student and notice version, on the server.** Once any parent has agreed for that student, the page opens straight to the fee on every device until the notice version changes. It is not remembered on the phone (no cookie, no storage), so there is nothing to clear and nothing to leak. A second parent or a second phone is not asked again. (Question 2.)
4. **There is no "decline" button.** Not agreeing means closing the page; nothing is saved. The page says so. The parent can still pay from the plain UPI ID line that stays in the reminder message.
5. **The consent screen is shown only for the current notice version.** Changing the notice text means a new version string and every parent is asked again.
6. **The page language is the student's `parent_language`** (R1-3). The header button lets the parent switch to any of the four languages for this visit only; it is not stored. The address carries no language.
7. **Dates are `DD MMM YYYY`, digits are 0-9 and `₹` with Indian grouping in every language.** The words are in the page language.
8. **"Today" comes from the server** (India day, returned by the function), never from the parent's phone clock, so Overdue is right on a phone with a wrong date.
9. **Overdue is shown as a word and a mark,** never colour alone. On a fee that is not late yet it says "Due {date}".
10. **The UPI link is built on the parent's phone** from the UPI ID, tutor name and amount the function returns, by the same builder R0-2 and R1-8 use (one builder; no second copy). The note `tn` is English, short, and holds no phone number: "Fee {Mon YYYY}" plus the student's first name when it is plain Latin letters, cut at 40 characters. (Question 7.)
11. **The amount ceiling is the app's ₹10,00,000** (R1-8 default). Above it, or with no UPI ID saved, the Pay button is not shown (criterion 24).
12. **Nothing is recorded when the parent taps Pay.** The page cannot know whether the payment happened. Everything it says about the payment is "your tutor marks it paid and sends a receipt".
13. **Earlier receipts:** the newest 12 payments that were not cancelled, each opening `/r/{receipt_token}` (the receipt page, R1-7 Part B).
14. **A student who is archived, a tutor who deleted their account, an unknown or damaged token** all get the same "link doesn't work" page. The page never says which.
15. **No analytics, cookie, storage or third-party script loads on this page in this slice.** `paypage_viewed` and `upi_button_tapped` are R1-14; how they are counted on a parents' page is question 8.
16. **Needs network.** The page is always fetched fresh. No offline copy: the amount and the UPI ID must never be stale.

## 4. Acceptance criteria

PRD criteria, word for word:

- "Parent pay page `/p/{pay_token}`: Public, no login. Shows tutor name/photo, student name, dues, big "Pay ₹X with UPI" button (`upi://pay?pa={upi}&pn={tutor}&am={amount}&cu=INR&tn={note}`), "I've paid" button (below), past receipts, this month's attendance count, footer "Free for tutors — start in 60 seconds" + tutor's referral link. First visit shows privacy notice + consent"
- "Public pages (`/p/`, `/r/`) never query tables directly; they call Edge Functions that look up by unguessable token (≥22 random URL-safe chars) and return only what that page needs."
- "Privacy ... parent consent on first pay-page visit"
- BUILD_PLAN risk: "`upi://` links do not open on some devices: Copy-UPI-ID and QR fallback on the pay page"

Differences from the PRD wording, on purpose and listed in section 6: no photo, no attendance count, no referral link, no "I've paid" button (each is owned by a later slice or blocked by missing data), and the consent record carries no copy of the parent's phone number (question 4).

Tests use fake Supabase and function hosts and a fixed clock of 2026-10-12 05:00 UTC (10:30 India) unless stated.

### Part A: database and functions

1. [db] `consents` exists: `id` uuid pk, `tutor_id`, `student_id`, `notice_version` text (short, checked pattern), `accepted_at` timestamptz default now. `unique (student_id, notice_version)`. Composite foreign key `(tutor_id, student_id)` to `students (tutor_id, id)`, so a consent always names a student of the same tutor. No phone number, name or other personal column. (The PRD's `parent_phone` is not stored: question 4.)
2. [db] RLS on, one select policy `tutor_id = auth.uid()` (the tutor can read her own students' consent). No insert, update or delete grant to any client role; `anon` has no privilege at all. Tutor B reads zero of tutor A's rows by any filter. Deleting a student or the tutor removes their consent rows. A pgTAP file proves this with two tutors and an anonymous session, as `payments` does.
3. [db] `get_pay_page(p_token text) returns jsonb` is executable by `service_role` only (not `anon`, not `authenticated`, not public). It looks up `students.pay_token = p_token` exactly. Unknown, empty or malformed tokens, an archived student and a tutor-less row all return null (same answer).
4. [db] Before consent (no `consents` row for this student and the current notice version) it returns exactly these keys and nothing else: `consent_needed` (true), `notice_version`, `tutor_name`, `tutor_subjects`, `student_name`, `language`. No amount, no UPI ID, no due, no receipt.
5. [db] After consent it returns exactly these keys: `consent_needed` (false), `notice_version`, `tutor_name`, `tutor_subjects`, `student_name`, `language`, `upi_id`, `today` (India day, `YYYY-MM-DD`), `total_remaining` (integer paise), `open_dues`, `open_dues_more` (integer), `receipts`, `receipts_more` (boolean). A pgTAP test compares `jsonb_object_keys` to this literal list for each state; an extra key fails.
6. [db] `open_dues`: every due of this student with status `due` or `partial`, oldest first (earlier balance first of all), at most 24, each with exactly `kind`, `month` (first of month or null), `due_date`, `amount`, `amount_paid`, `remaining`. `total_remaining` is the sum over all open dues, including those beyond the 24 (`open_dues_more` counts them). A fully paid student gets an empty list and `total_remaining` 0. Amounts are integer paise.
7. [db] `receipts`: payments of this student's dues that are not cancelled (`voided_at is null`), newest first, at most 12, each with exactly `receipt_no`, `receipt_token`, `month`, `amount`, `paid_on`, `balance_after`. Never another student's payment, even with the same parent phone. Cancelled payments are never listed.
8. [db] The response never contains: a parent phone, parent name, email, `pay_token`, any row id (`tutor_id`, student, due or payment id), the tutor's own phone or email, other students, claims, reminders or tutor plan. Tested by key list and by searching the serialised response for the seeded phone and email strings.
9. [db] `record_consent(p_token text, p_notice_version text) returns text`, executable by `service_role` only. Known token and the current version: inserts one row and returns `ok`. Called again, or twice at once: still one row, `ok` both times. Another version string: returns `stale_notice` and writes nothing. Unknown or archived: returns `not_found` and writes nothing. The current version is held in one place in the database, not typed in two.
10. [db] Rate-limit counters for these two functions live in a table of their own (hashed key and hour only, no `tutor_id`, RLS on, no client grant), with a `security invoker` increment function executable by `service_role` only, as `receipt_hits` and `receipt_hit` are. Old hours are purged.
11. [db] `030_default_privileges.sql`, `080_grants_after_migration.sql` and `020_public_tables_have_rls.sql` still pass; the new table and functions are added to the lists they hold without weakening them. `pnpm check:db --base origin/main` passes. The migration stamp is later than every migration on `main` when it is written.
12. [fn] Edge Function `pay-page`: POST only (the token travels in the JSON body, never the URL); 405 otherwise; OPTIONS for CORS from the allowed hosts only; body over 512 bytes gives 413; bad JSON gives 400. Malformed, short, empty and unknown tokens give the same 404 body (compared byte for byte) and a malformed one still performs one lookup with a dummy token. Same order of checks as `receipt`. Allow-listing in the function copies only the keys of criterion 4 or 5, chosen by the `consent_needed` flag, so a column added to the SQL later cannot leak through.
13. [fn] Edge Function `record-consent`: POST only; body exactly `{token, notice_version}`; `stale_notice` becomes 409 with the current version so the page can reload; `not_found` and malformed tokens give the same 404; success gives 200 `{code: "ok"}`. The function never trusts a client-supplied time or student id.
14. [fn] Both functions: limit 60 requests per hashed IP per hour (a larger shared bucket for callers whose IP the platform does not give, as in `receipt`), 120 per hashed token per hour for `pay-page` and 20 per hashed token per hour for `record-consent`; the 61st and 121st get 429 with `Retry-After`. The raw IP and raw token never reach the counters, logs or any storage (spy test). Hash salt is a new secret `PAYPAGE_HASH_SALT`, different from the waitlist and receipt salts.
15. [fn] Both functions: `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`, `verify_jwt = false` in `config.toml`. Logs are fixed words (`ok`, `not_found`, `rate_limited`, `error`, `consent_recorded`, `stale_notice`), never a token, name, amount or UPI ID. A thrown dependency gives 500 with no detail.

### Part B: the page

16. [e2e] `/p/{token}` is served by one static shell (a Vercel rewrite for `/p/:token` and `/p/:token/`, like `/r/`; `scripts/serve-out.mjs` matches). The page sets `noindex`, sends no referrer, and the shell carries no locale in the address. `/p/` with no token, or a token of the wrong shape, goes straight to the "link doesn't work" state without any request.
17. [e2e] While the function answers, the page shows "Opening your fee request…" with the tutor's absent name replaced by a plain placeholder block (never a bare spinner, never the tutor's data before it arrives).
18. [e2e] **First visit (consent needed).** The page shows the consent screen drawn in `Consent`: cloth ground, "Fee request from {tutor name}", subjects and "for {student name}", the language button, the heading, one sentence saying the tutor uses the product to share fee details, the three lines (your phone number; your child's name, fee and attendance; never ads or tracking of children), "I agree, show the fee" (black, 62px), and "Asked only once". No fee, no amount, no receipts, no UPI ID is in the page or in the response at this point (criterion 4).
19. [e2e] The three lines each carry a mark and the words ("kept" tick, "never" cross), so they read in grayscale. The two kept lines state what is held; they must stay true: the notice text is the founder's to approve (question 3).
20. [e2e] Tapping "I agree, show the fee" calls `record-consent` once with the token and the version the page was given, shows "Saving…", ignores a second tap, then reads the page again and shows the fee. On a network failure the screen stays with "Couldn't save. Check your connection and try again." and a Try again button; nothing is shown. On `stale_notice` (409) the page reads again and shows the new notice. A parent who closes the page without agreeing leaves nothing behind.
21. [e2e] **Return visit.** With consent already recorded for this student and version, the page opens straight to the fee with no consent screen, on a different phone too (default 3).
22. [e2e] **The fee page** follows `PayPage`, with the changes in section 11: cloth header "Fee request from {tutor name}", subjects line, language button; the slip with "for {student name}", the headline amount (the total owed, fitted to its box, never cut), the list of fees under it; then the Pay button and the fallbacks; then earlier receipts; then the privacy notice link; then the footer.
23. [e2e] The fee list has one line per open fee: "{Month} fee, due {DD MMM YYYY}" with the remaining amount in the mono face; an earlier balance says "Earlier balance" and no due date; a part paid fee says "{amount} already paid" beside it; a late fee carries the word "Overdue" and a mark (the `StatusTag` forms); a fee not late yet says "Due {date}". "Late" uses the `today` the function returned. More than 24 open fees: the last line says "and {n} more" and the headline still counts them.
24. [e2e] **Pay button.** A real `<a>` with `href` equal to `upi://pay?pa={upi id}&pn={tutor name, URL-encoded}&am={total, rupees with .00}&cu=INR&tn={note, URL-encoded}`, 72px high, blue, label "Pay {amount} with UPI" (amount as `₹1,200`, 0-9 digits). It is not shown when: no UPI ID is saved, the total is 0, or the total is above ₹10,00,000. In the first case the page says "Your tutor has not added a UPI ID yet. Ask them for payment details." and nothing else changes; in the third the plain UPI ID is shown with "Pay ₹{amount} to this UPI ID in your UPI app".
25. [e2e] Under the button, in plain words: "Your UPI app opens with the amount filled in. It goes straight to {UPI ID}." (the ID in the mono face, selectable), and "Paid already? Your tutor marks it paid and sends you a receipt." The page never says "paid", "done" or "success" about a payment it has not seen.
26. [e2e] **Fallbacks, always visible under the button** (not hidden behind a failure, because a page cannot tell whether a UPI app opened): "Copy UPI ID" (48px, outline) and "Show QR code" (48px, outline), with "UPI app did not open? Use one of these." Copy puts exactly the UPI ID on the clipboard and the button says "Copied" with a tick for two seconds. If the browser has no clipboard, the Copy button is not drawn (the ID is still shown as selectable text). "Show QR code" is drawn only once Part C is in; before that it is not on the page.
27. [e2e] **Earlier receipts.** One row per receipt, 60px or more: "{Month} · {amount}" and the mono line "PAID {DD MMM YYYY} · NO. {n}" (or "PART PAID" when a balance was left), and "View" opening `/r/{receipt token}` in the same tab with `rel="noopener noreferrer"`. An earlier-balance receipt says "Earlier balance". More than 12 exist: one line says "Showing the latest 12." No receipts yet: the section is not drawn.
28. [e2e] **All paid.** Nothing open: the headline is replaced by the ALL PAID stamp and "Nothing to pay right now. Thank you.", no Pay button, no Copy, no QR; earlier receipts, the notice link and the footer stay.
29. [e2e] **Language.** The page opens in the student's `parent_language`. The header button shows the current language's own name; it opens a list of the four (each 44px), and choosing one changes every word at once with no new request and no consent screen reload. Not stored anywhere. Hindi, Kannada and Telugu use their own faces and rules; the amount, dates and counts stay 0-9 and Latin faces. The tutor's name and the student's name are shown as saved, whatever the language.
30. [e2e] **Privacy notice link** on the fee page re-opens the same notice screen read-only with a Close button and no agree button. A "Read the full notice" link is drawn only once the founder has supplied that text and its address (question 3); until then it is not on the page.
31. [e2e] **Footer.** "Are you a tutor too? Free for tutors. Start in 60 seconds." with no link and no tutor referral code (R1-13 adds the link; default as `/r/`). The tutor's photo is not shown (no column).
32. [e2e] **States.** Not found ("This link doesn't work. Ask your tutor to send it again."), rate limited ("Too many tries. Please try again in a while."), network failure with "Try again", server error with "Try again". None shows any tutor or child data it was not given. Each has the language of the browser's first preference when the student's language is not yet known (the same rule as `/r/`).
33. [e2e] The page never fetches, writes or stores anything except: one `pay-page` call per load, one `record-consent` call per agree, and the `/r/` links the parent taps. Only the page's own host and the functions host are contacted. No cookie, no local or session storage, no IndexedDB, no analytics.
34. [e2e] Layout at 360px and the largest system font, in en, hi, kn and te, with an 80-character student name with no spaces, an 80-character tutor name, 8 subjects, a total of `₹10,00,000`, a 24-line fee list, a Telugu tutor name and a student name in Hindi: no sideways scroll, every control at least 44px (the Pay button 72px), no text under 14px, nothing cut with an ellipsis, the Pay button is reachable without hiding behind anything. Status is word plus mark in grayscale.
35. [e2e] Single centred column at most 28rem on every window width (DESIGN.md "Public pages"); it never uses `AppScreen` or the tutor navigation.
36. [e2e] No `TODO-translate` text is ever shown: an untranslated key falls back to English. The consent screen in a language whose notice text has not been reviewed shows English for the notice lines and the page keeps the language button (question 5).
37. [unit] The link builder: `upi://pay` link is built by the one shared builder (the file R0-2 ships and R1-8 reuses; if importing it pulls the message templates into this page, tech-lead splits the link builder into its own small module). Table test: amount in rupees with `.00` from integer paise, name and note URL-encoded, a Hindi tutor name encoded, an `&` or space in the name safe, ₹10,00,000 builds, ₹10,00,001 is refused (page shows no button). No float arithmetic.
38. [unit] The `tn` rule (default 10): "Fee Oct 2026 Ravi"; a student name in Devanagari gives "Fee Oct 2026"; a 60-character Latin name is cut so the whole note is at most 40 characters; several open fees give "Fees due" plus the first name; never a phone, never an amount.
39. [unit] Day and late logic from `today` and `due_date` as strings with integer arithmetic only: yesterday is "Overdue", today is "Due today", tomorrow is "Due {date}", an earlier balance is always "Earlier balance". Run under `TZ` UTC, America/Los_Angeles, Asia/Kolkata and Pacific/Kiritimati: same answers (the phone's clock is not read).
40. [unit] Every new string is in `messages/{en,hi,kn,te}.json` (namespace `payPage`, shipped to the page in all four languages at once through `getAllWords`, as `receipt` is), `pnpm i18n:check` passes, no English in components, the product name only from `brand.ts` (the consent screen and footer use the constant). A grep test finds no `parseFloat`, `toFixed`, `Math.round`, `Intl.`, local-time `Date` getters or `new Date(` with no argument in pay-page code. Money is integer paise until `formatRupees`.
41. [e2e] `pnpm size`: initial JS for the `p` route at most 200 KB gzipped, target 100 KB or less. The page uses plain `fetch` (no Supabase client), and the QR code and any large words are loaded on demand.
42. [e2e] Read-only: the page sends no request that changes data except `record-consent`. No `pay_token`, UPI ID or amount appears in the page address, `document.title`, history or any request to our hosts other than the token in the body of the two calls.

### Part C: QR code and the reminder link

43. [unit] "Show QR code" draws a QR code of exactly the same `upi://pay` string as the Pay button's `href` (same amount, same note). It is drawn on the parent's phone: no request is made, no online QR service is ever used (the tutor's UPI ID and the amount must not go to a third party). Black on white with a quiet border, at least 220px square, with the words "Scan with a UPI app on another phone" and the UPI ID under it as text.
44. [e2e] Tapping "Show QR code" opens it on the page (a sheet or a block that pushes the page down, 44px "Close" button); it works with the network off once the page is open. If drawing fails the page says "Couldn't make the QR code. Use Copy UPI ID instead." and the page stays intact.
45. [unit] The R1-8 builder takes the pay-page link as its `{link}` (the input R1-8 reserved): `https://{host}/p/{pay_token}` from one site-address setting, in the tutor app only. The message still carries the "Or pay to UPI ID: {id}" line (R0-2/R1-8 wording, unchanged). The free tool `/tools/fee-reminder/` is unchanged and still makes its `upi://` link. The message has no student name, no product name and no phone (R1-8 criteria 11 and 12 hold).
46. [e2e] The Remind screen shows the message with the pay-page link, the "Open WhatsApp" link's decoded text equals the preview, the log call (`record_reminder`) is unchanged and carries no token, and the `pay_token` is read only on the tutor's own phone from her own roster, never sent to our servers except as part of what she chose to send to WhatsApp.
47. [unit] A student whose `pay_token` is missing from the roster read (should not happen) falls back to the R1-8 message with the raw UPI link; nothing throws. R1-8's existing tests for the raw-link message are updated, not deleted.
48. [manual] Release order: Part C is merged only after Part B is on production and the founder has opened a real `/p/{token}` on a phone against production. If the host is not the one in the message (a domain change), see question 6.

## 5. Edge cases

- **Empty (no open fees):** ALL PAID state (criterion 28). A student who was never charged (no dues yet) sees the same state with the words "Nothing to pay right now."; receipts are absent.
- **No UPI ID saved:** no Pay button, no Copy, no QR; the page says so and still shows the fees (criterion 24).
- **Offline or slow network:** nothing is cached. Loading shows words; failure shows Try again. A parent who opens the link in a basement and gets a failure is never shown an old amount.
- **Very long names (80-character tutor and student, Indic names):** wrap, never cut. `translate="no"` on names so a browser's translate does not rewrite them.
- **Large font:** criterion 34.
- **Second language:** tutor Telugu, parent Hindi: page in Hindi, header button shows "हिन्दी"; the tutor's name stays as typed. Digits and `₹` are 0-9 always. A parent can switch to English or any of the four.
- **Partial payment:** the fee shows its remaining amount and "{amount} already paid"; the Pay button asks for the remaining total, never the original fee.
- **Overpayment risk:** the parent pays, the tutor has not yet marked it, the parent reopens the link and pays again. The page says "Paid already? Your tutor marks it paid..." and nothing more until R1-10; accepted. Founder note: this is the main reason to ship R1-10 soon after.
- **Paid, then opens the link again:** shows the same fee until the tutor records the payment; then the receipt appears under "Earlier receipts" and the fee disappears. A reopened page is always read fresh.
- **Fee appears early or late:** if the founder moves fees to the 1st (R1-5 question 1), a fee can have a due date in the future; the page shows "Due {date}" with no Overdue mark and the Pay button still works. No rule here depends on which answer he gives.
- **Total above ₹10,00,000** (many dues): no Pay button; the plain UPI ID is shown (criterion 24). A UPI app may refuse a large amount from a link anyway (R1-8 question 10; the phone checks there are still open).
- **Duplicates:** two taps on "I agree" make one consent row. Opening the link on two phones at once is fine.
- **Parent opening an old link:** the link never expires while the student is active. An old reminder's pay link always shows what is owed now, not what was owed when it was sent. After the student is archived: "This link doesn't work." After the tutor's account is deleted: the same. After the notice version changes: the consent screen again, once.
- **Link forwarded to someone else:** anyone with the link sees this child's fees and receipts after agreeing. Accepted; the link is unguessable and carries no phone number. The tutor cannot rotate it yet (question 12).
- **Guessing tokens:** criteria 12 and 14.
- **The parent has not agreed and the tutor's reminder says "pay to UPI ID":** they can still pay from the message; the page is optional for paying.
- **Phone clock wrong:** no effect (server day).
- **Browser translate, dark mode, "request desktop site":** names are `translate="no"`; the page ignores dark mode (the paper look is fixed, as `/r/`); desktop mode just gets the same single column.
- **App service worker (R1-12):** it must never cache `/p/` responses or the functions' answers. Noted for R1-12.
- **In-app browsers (WhatsApp, Instagram):** `upi://` may be blocked inside some in-app browsers; Copy UPI ID and QR are why they are always visible. Manual step 10.
- **UPI app not installed (laptop, iPad):** the Pay button does nothing visible; the fallbacks are on screen. Manual step 11.
- **Tutor changes UPI ID or name after sending the link:** the page shows the current ones; an old reminder's raw link (pre-R1-9 messages) keeps the old ID. Accepted.
- **Tutor with no name:** the page says "Your tutor" in place of the name; the UPI `pn` falls back to the UPI ID's name part.
- **Siblings, one number, two links:** two pages, two consents, two totals. Never combined.

## 6. Out of scope

| Not here | Where it goes |
| --- | --- |
| "I've paid" button, UPI reference entry, screenshot upload, `payment_claims`, tutor notification and Confirm | R1-10 (`submit-claim` function and the private screenshot bucket come with it) |
| Attendance line ("Ravi came to 3 of 4 classes") | R1-11 adds the table; it must also extend `get_pay_page` with one count and the page with one line. R1-11's spec must list this |
| Tutor photo | Not owned by any slice: `tutors` has no `photo_url` and no upload exists (question 9) |
| Referral link in the footer, `/join/{code}`, `referral_code` | R1-13 (the footer gets the link then) |
| "Share pay link" and "Copy pay link" on a Student detail screen | No such screen yet (R1-3 gap); question 12 covers whether the row needs a copy-link button sooner |
| Revoking or regenerating a pay link | Not in the PRD (question 12) |
| Tutor-side "parent agreed" mark, consent list, export of consents | R1-13 (export and delete account) |
| Parent withdrawing consent from the page | Question 3 (a founder and legal decision; default is the tutor deletes or archives the student) |
| Pay online (gateway), "Pay online" button, tutor logo | Release 2 (`PayPage-pro`) |
| Automatic sending of the link | Release 2 |
| `paypage_viewed`, `upi_button_tapped` events | R1-14 (question 8) |
| Offline copy of the page, service worker rules | R1-12 |
| Monthly parent report, UPI AutoPay | Release 2, Release 3 |
| Parent accounts, sign-in, SMS or OTP | Never in Release 1 (CLAUDE.md) |
| Amount in words, other currencies | Not in the PRD |
| A full privacy-notice page | Question 3 |
| Any change to `payments`, `record_payment`, `dues` | None needed |

## 7. Design references

From `design/project/` (see `canvas.json`):

- `PayPage.dc.html` ("P Pay page"): criteria 22 to 31. Not built from it, and why: the photo, the attendance row, the "I've already paid" link and the referral address are out of scope (section 6); the "Earlier months: All paid" line is replaced by one line per open fee (default 2); the Pay button reads "Pay {amount} with UPI" (the PRD wording) and the headline is the total; the 104px headline becomes the fitted `amount-box` size (DESIGN.md: 72px and 60px steps, never under 14px); the footer address is not shown; "Show QR code" appears with Part C.
- `Consent.dc.html` ("P First visit: consent"): criteria 18 to 20, 30. The wording of the three lines is the founder's to confirm (question 3).
- `Claim-sheet.dc.html`: R1-10, not built.
- `Receipt.dc.html`: the target of each "View" (R1-7 Part B already built).
- `PayPage-pro.dc.html`: Release 2, not built.
- `Main.dc.html`, `Interaction.dc.html`, `Type-indic.dc.html`, `State-error.dc.html`, `State-loading.dc.html`: tokens, press and focus, Indic type, the error and loading patterns.

## 8. Analytics

None fire in this slice, and no analytics script loads on `/p/{token}` (criterion 33). PRD section 4 names `paypage_viewed` and `upi_button_tapped`; they are wired in R1-14, and how is question 8. The repo rule stands for whichever way is chosen: no name, phone, UPI ID, amount, token or student detail in any event, and nothing aimed at children. `claim_submitted` and `claim_confirmed` belong to R1-10.

## 9. Copy

Namespace `payPage`, added to all four message files together and shipped to the page in all four languages (the language comes from the data and the parent's choice, not the address). English is final here; Hindi, Kannada and Telugu are `TODO-translate: <English>` until a native reader reviews them, and the parent never sees `TODO-translate` (criterion 36). Keys needed:

| Key | English |
| --- | --- |
| payPage.from | Fee request from |
| payPage.yourTutor | Your tutor |
| payPage.for | for {student} |
| payPage.loading | Opening your fee request… |
| payPage.consent.title | Before you see the fee, a word on privacy. |
| payPage.consent.intro | {tutor} uses this service to share fee details with you. This is what is kept: |
| payPage.consent.phone / child | Your phone number / Your child's name, fee and attendance |
| payPage.consent.never | Never: ads, or tracking of children |
| payPage.consent.agree | I agree, show the fee |
| payPage.consent.once | Asked only once |
| payPage.consent.notAgree | Not agreeing? Just close this page. Nothing is saved. |
| payPage.consent.saving / failed | Saving… / Couldn't save. Check your connection and try again. |
| payPage.consent.notice / close | Privacy notice / Close |
| payPage.total | Total to pay |
| payPage.line.fee | {month} fee, due {date} |
| payPage.line.earlier | Earlier balance |
| payPage.line.alreadyPaid | {amount} already paid |
| payPage.line.overdue / due | Overdue / Due {date} |
| payPage.line.more | and {n} more |
| payPage.pay | Pay {amount} with UPI |
| payPage.payNote | Your UPI app opens with the amount filled in. It goes straight to {upiId}. |
| payPage.paidAlready | Paid already? Your tutor marks it paid and sends you a receipt. |
| payPage.noUpi | Your tutor has not added a UPI ID yet. Ask them for payment details. |
| payPage.tooBig | Pay {amount} to this UPI ID in your UPI app. |
| payPage.fallback | UPI app did not open? Use one of these. |
| payPage.copy / copied | Copy UPI ID / Copied |
| payPage.qr / qrHelp / qrFailed | Show QR code / Scan with a UPI app on another phone / Couldn't make the QR code. Use Copy UPI ID instead. |
| payPage.allPaid / allPaidNote | ALL PAID / Nothing to pay right now. Thank you. |
| payPage.receipts | Earlier receipts |
| payPage.receipt.paid / part | PAID {date} · NO. {n} / PART PAID {date} · NO. {n} |
| payPage.receipt.view / more | View / Showing the latest 12. |
| payPage.language | Language |
| payPage.footer.title / body | Are you a tutor too? / Free for tutors. Start in 60 seconds. |
| payPage.state.notFound | This link doesn't work. Ask your tutor to send it again. |
| payPage.state.rateLimited | Too many tries. Please try again in a while. |
| payPage.state.error / retry | Couldn't open this page. / Try again |
| Reminder message | no new key: the message templates are R0-2 and R1-8's; only the `{link}` value changes |

The consent lines are the founder's wording to approve (question 3); tech-lead must not paraphrase them.

## 10. Privacy

The parent sees one child's fee, receipts and tutor details, only after agreeing. The server gives nothing beyond the notice header until a consent row exists. The parent's phone number is never sent to, shown by or stored with this page (the tutor has it already; the consent row does not copy it). The tutor's UPI ID is shown because the parent has to pay it; no other contact detail is. No cookies, storage, analytics or third-party script. No ads or tracking of children. Tokens are random, not derived from ids, not in logs, and the page sends no referrer. The UPI app and the bank, not FeeDost, handle the payment; no card, bank or screenshot data passes through this page. Data is deleted with the account (consents with it). DPDP notice, controller wording and withdrawal are the founder's decisions (question 3).

## 11. Test by hand on a phone

Staging-backed build, 360px, then the largest system font. Needs: one student with a Hindi parent language and a UPI ID saved, one with English, one with a very long name, one with "Already owes", one fee part paid and one paid with a receipt (Mark paid from R1-7), a second phone with no sign-in, and a UPI app. The Part C steps need Part C.

1. Open `/p/{token}` of the Hindi student in a private tab on the second phone. You see the consent screen in Hindi (or English where not reviewed), the tutor's name leading, no amount anywhere. Open the browser's network view if you can: no amount, no UPI ID in the response.
2. Tap "I agree, show the fee". The fee page appears. Close and reopen the same link: no consent screen. Open it on a third phone or browser: no consent screen either (default 3).
3. Read the page: tutor name, subjects, "for {student}", the total, one line per open fee, the part paid fee shows "already paid", an overdue fee says Overdue with its mark, the earlier balance says "Earlier balance".
4. Tap "Pay ₹X with UPI". Your UPI app opens with the tutor's UPI ID, the name, the amount and the note filled in. Do not pay; go back. (Pay a rupee test only on a staging tutor you own.)
5. Tap Copy UPI ID and paste it somewhere: exactly the ID. Select the ID text under the button: it selects.
6. Tap the language button: pick each of the four languages; every word changes, digits stay 0-9, nothing is cut. Reload: the page returns to the student's language.
7. Earlier receipts: the paid fee's receipt is listed with number and date; tap View: the receipt page opens, no phone number anywhere; Back returns to the pay page.
8. Tap "Privacy notice": the notice opens with Close only.
9. Mark the open fees paid in the tutor app, reload the pay page: ALL PAID, no Pay button, the new receipts are listed.
10. Open the link inside WhatsApp's own browser and inside Instagram (send yourself the link): does Pay open the UPI app? Write down which apps blocked it; the fallbacks should be usable either way.
11. Open the link on a laptop: the Pay button does nothing useful; Copy UPI ID works; after Part C, "Show QR code" shows a code a phone can scan to open its UPI app with the amount.
12. Change one character of the token: "This link doesn't work." Archive the student: the same message. Restore: it works again.
13. Remove the tutor's UPI ID in the profile, reload: "Your tutor has not added a UPI ID yet." and no Pay button.
14. Largest system font, then Hindi, Kannada and Telugu: the long-named student's page has no sideways scroll, every button thumb-sized, the amount never cut.
15. Airplane mode, open the link: a "Try again" state, no old amount.
16. Part C: the Remind screen's message now carries the `/p/` link, plus the "Or pay to UPI ID" line. Send it to the second phone through WhatsApp and tap the link there. A person who reads Hindi, Kannada and Telugu reads the consent screen and page words.
17. Staging table editor, `consents`: one row per student and version, no phone, no name; only your own tutor id; removing the student removes the row.

## 12. Open questions for the founder

Each has a default; nothing blocks Part A. Questions 3 and 5 block releasing Part B to production.

1. **What amount does the Pay button ask for when more than one fee is open?** Default: the total of everything open, with a line per fee above it. The risk is a mismatch with the reminder, which names one fee ("₹1,000 for October") while the page shows ₹3,400. The alternative is to ask only for the oldest fee, or let the parent pick, which is more work and more taps. Say which.
2. **Is consent once per child, or once per phone?** Default: once per child's link, recorded on the server, so a second parent or phone is not asked again and nothing is stored on the phone. The alternative (ask on every new phone) needs a stored flag on the phone and is weaker as a record. Does your reading of the DPDP Rules need each parent to agree separately?
3. **The privacy notice and consent wording.** The canvas has three lines. Someone (you, or a lawyer) must confirm they are true and enough: who is named as responsible (the tutor, FeeDost, or both), what "your child's name, fee and attendance" covers until attendance exists, how long data is kept, how a parent withdraws or asks for deletion (default: asks the tutor, who archives or deletes the student; the page says nothing about it), and whether a longer "full notice" page is needed. Default until you answer: the page ships the three lines as drawn and does not draw "Read the full notice". Release gate for Part B.
4. **Consent record contents.** The PRD's `consents` has `parent_phone`. Default: leave it out, because the page never learns the parent's phone and the link, not a phone number, identifies the child; copying the number again adds personal data and proves nothing. Alternatives: add the notice language the parent saw (useful as evidence), or copy the phone from the roster at agreement time. Say if you want either.
5. **Who reviews the Hindi, Kannada and Telugu text, and may the consent screen show English to a parent whose language is not reviewed?** Parents see this page, so `TODO-translate` cannot ship. Default: English fallback with the language button, and a release gate of Hindi reviewed (same as R1-7's receipt question 5). A consent notice in a language the parent cannot read is weak consent, so for Kannada and Telugu I would rather hold back the consent screen's language until a reader signs it. Your call.
6. **The address in the links.** Pay-page links live for years in WhatsApp chats. Default: the current `*.vercel.app` host, one site-address setting. When you buy the domain, the old host must keep serving `/p/` and `/r/` (a redirect to the new host is enough), or old reminders break. Confirm you accept this, or hold Part C until the domain is chosen.
7. **The UPI note** (`tn`) shows on the tutor's and the parent's bank statements. Default: "Fee Oct 2026 Ravi" (month and the student's first name when it is plain letters), no phone or amount. It helps the tutor match the payment. Do you want the student's name in a note at all? It is a child's name on a bank statement.
8. **How to count `paypage_viewed` and `upi_button_tapped` without putting an analytics script on a parent's page.** Default: no script; R1-14 counts them in the Edge Function (a view is a `pay-page` call after consent; a tap is a tiny `POST` with the token's hash only). The PRD names PostHog for all events. Is a server-side count enough, or do you want PostHog on the page (it needs consent wording and a cookie decision)?
9. **Tutor photo.** The PRD lists it on this page; `tutors` has no photo column and no slice builds the upload. Default: no photo; the tutor's name leads the page. Which slice should own the column and upload, and is the pay page worth waiting for?
10. **"I've paid" and the double-payment gap.** The PRD puts the button on this page and R1-10 builds it. Default: R1-9 ships without it. Until R1-10, a parent who has paid but whose payment is not yet marked sees the same amount and could pay twice. Do you want R1-9 and R1-10 released together, or the pay page held back for real tutors until claims exist?
11. **QR code library.** A QR code needs an encoder, and none is in the dependency table. Options for `tech-lead`: a small maintained library (checked against the dependency policy), or a small encoder we write and test ourselves (a few hundred lines, lower risk than a dependency that might go stale), or drop the QR and rely on Copy UPI ID. Default: Part C proposes the smallest of these and you approve it. Never an online QR service.
12. **A way to stop or replace a pay link, and a way to copy it.** Default: neither. A link sent to the wrong person stays valid while the student is active; the tutor can archive the student to stop it. A "Copy pay link" and a "New link" button on a Student detail screen are a later slice. If a parent forwards the link, the recipient sees the fee and receipts after agreeing. Is that acceptable for the first 5 tutors?
13. **Amount cap and UPI app limits.** Default: the same ₹10,00,000 as the app, and the open phone checks of R0-2 (H2, H3) and R1-8 (question 10) decide whether a lower cap is needed. Will you run those phone checks before release? They also settle whether UPI apps accept amounts from a link to a personal UPI ID.

## 13. Hand-off

To `tech-lead`: append the technical plan to this file, planning Parts A, B and C as three pull requests. Decisions that are yours:

1. The migration (`consents`, `get_pay_page`, `record_consent`, a rate-limit table and increment function, the single place the notice version lives), its stamp after the newest on `main` (the receipt public migration is `20261012160000`), and the pgTAP files and grants-list updates (`020`, `030`, `080`).
2. The two Edge Functions, written in the `receipt` pattern (pure `handle(req, deps)` plus Deno wiring, allow-list of keys by state, same-bytes 404, hashed counters). `PAYPAGE_HASH_SALT`, `verify_jwt = false`, allowed hosts, local dummy secret, and the `supabase/CLAUDE.md` secrets sentence.
3. The route: `src/app/p/` with its own root layout like `r`, the `vercel.json` rewrite and headers for `/p/:token`, `scripts/serve-out.mjs`, `check-404*`, `check-locale-leak` and `size.mjs`, and the `src/CLAUDE.md` layout sentence (five root layouts). Plain `fetch`, no Supabase client.
4. Words: `payPage` through `getAllWords`, and whether the `receipt-words.ts` helpers (`fill`, `parts`) are reused or moved to a shared file. Do not copy them.
5. The link builder: whether the shared `upiLink` can be imported without pulling the message templates into `p`'s first load; if not, split it into its own module and keep R0-2's and R1-8's tests green.
6. The QR code: the encoder or library choice, checked against the dependency policy in BUILD_PLAN; record the check in this file; flag it to the lead before adding anything.
7. Part C's change to R1-8: where the site address setting lives, how `pay_token` reaches the Remind screen (roster read or a column added to it; it is the tutor's own data), which R1-8 tests and e2e text change, and the home bundle (`home` must not grow beyond R1-8's ceiling).
8. Release order for Part C (criterion 48) and the smoke test that opens a real `/p/` link after release.
9. The `consent_needed` gate in `pay-page`: how the function proves, in a test, that a pre-consent response has none of the post-consent keys.
10. Confirm nothing in R1-7's `receipt` function, `get_receipt` or `/r/` page needs to change (the pay page only links to `/r/{receipt_token}`).

Flag any new dependency before adding it.
