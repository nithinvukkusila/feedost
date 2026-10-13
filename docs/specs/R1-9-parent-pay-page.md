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

---

# Technical plan, R1-9 Part A (database and Edge Functions only)

Written 2026-10-13 by tech-lead on branch `r1-9a-pay-page-db`. Covers criteria 1 to 15 only. Parts B and C get their own plan sections when they start. Nothing on screen changes in Part A. Modelled on the merged `receipt` slice (PR #18): `20261012160000_r1_receipt_public.sql`, `supabase/tests/200_receipt_public.sql`, `supabase/functions/receipt/{handler.ts,index.ts,handler.test.ts}`.

## A1. Approach

One new migration adds `consents` (select-only for the tutor, written only by a function), `get_pay_page(token)` and `record_consent(token, version)` (both `service_role` only, with fixed key lists), and a separate counter table `paypage_hits` with `paypage_hit()`, copied from `receipt_hits`. Two Edge Functions, `pay-page` and `record-consent`, follow the `receipt` pattern exactly: a pure `handle(req, deps)` that Node tests with fakes, plus a thin Deno `index.ts`. The functions' shared plumbing (CORS, safe headers, size-limited body read, IP read, host matching) moves into one new shared file rather than being copied a third and fourth time. `receipt` is not touched.

## A2. Files

New:

- `supabase/migrations/<stamp>_r1_pay_page.sql`. Create it with `pnpm exec supabase migration new r1_pay_page` today (2026-10-13) so the stamp is later than `20261012160000`; confirm with `pnpm check:db --base origin/main`. Contents in A3.
- `supabase/tests/220_consents_rls.sql`. Isolation test for the new table (A5).
- `supabase/tests/230_pay_page.sql`. `get_pay_page`, `record_consent`, `paypage_hit` (A5). Next free numbers after `210_reminders.sql`; if another branch has taken them by merge time, renumber, do not edit others.
- `supabase/functions/_shared/public-http.ts`. Pure helpers used by both new handlers: `SAFE_HEADERS`, `respond`, `codeOnly`, `allowedOrigin(origin, env, allowedHostsValue)`, `hostMatches`, `clientIp`, `readLimited(req, max)`, `DEFAULT_ALLOWED_HOSTS` (same value as receipt's), and the `TOKEN_RE` and `DUMMY_TOKEN` constants. Behaviour is a straight lift of `receipt/handler.ts`. Plus `public-http.test.ts` (host matching, header set, size limit, IP header rule: `x-forwarded-for` is never read).
- `supabase/functions/pay-page/handler.ts`, `index.ts`, `handler.test.ts`.
- `supabase/functions/record-consent/handler.ts`, `index.ts`, `handler.test.ts`.

Changed:

- `supabase/config.toml`: add `PAYPAGE_HASH_SALT = "local-dummy-paypage-salt-not-a-secret"` under `[edge_runtime.secrets]`, with the same comment style as the receipt line (dummy locally, real value per environment, different from the waitlist and receipt salts). Add `[functions.pay-page]` and `[functions.record-consent]`, each `verify_jwt = false`, with a one-line comment like `receipt`'s.
- `.env.example`: after the `RECEIPT_HASH_SALT` lines add a comment and `# PAYPAGE_HASH_SALT=` (name only, no value).
- `docs/ENVIRONMENTS.md`: one bullet after the R1-7 one (R1-9 Part A adds `PAYPAGE_HASH_SALT` for `pay-page` and `record-consent`; not set or deployed yet; optional `PAYPAGE_ALLOWED_HOSTS`, same format as `RECEIPT_ALLOWED_HOSTS`).
- `supabase/CLAUDE.md`: extend the secrets sentence with `PAYPAGE_HASH_SALT` (HMAC key for the IP and token hashes of `pay-page` and `record-consent`; a different value from the other two; both functions are `verify_jwt` off and read and write only through `get_pay_page` and `record_consent`, which only `service_role` can execute). Also drop the stale words "`consents` ... written only by Edge Functions": it is written by a database function that only an Edge Function can call; keep the sentence true.
- `docs/specs/R1-9-parent-pay-page.md`: the contract block (A4) is already below; backend-dev fills the "Part A built" notes at the end, and does not edit criteria.
- `docs/BUILD_PLAN.md` / `supabase/tests/020`, `030`, `080`: inspect only. `020` is generic (every public table has RLS), `030` and `080` pin privileges on `tutors`, `batches`, `students` and do not name `receipt_hits` or `payments`. Criterion 11's "added to the lists they hold" therefore likely means nothing to add; backend-dev confirms by running them, and adds a line only if a list exists. Never loosen one.
- Not changed: `receipt` function, `get_receipt`, `payments`, `dues`, `record_payment`, any app code, `vercel.json`.

## A3. Data (migration intent, not SQL)

**Notice version, one place.** A tiny function `public.current_notice_version() returns text`, `language sql`, `immutable`, `set search_path = ''`, returning the literal `'v1'`. Both `get_pay_page` and `record_consent` call it. Changing the notice is a new migration that replaces the function body (`create or replace`); nothing else holds the string. Revoked from `public`, `anon`, `authenticated`; executable by `service_role`. (Chosen over a settings table: no table, no RLS, no write path, one line to change, and a migration is the review trail the founder wants for a legal text change.)

**`public.consents`.**
- `id uuid pk default gen_random_uuid()`; `tutor_id uuid not null references tutors(id) on delete cascade` (no default: no client inserts); `student_id uuid not null`; `notice_version text not null check (notice_version ~ '^[a-z0-9._-]{1,16}$')`; `accepted_at timestamptz not null default now()`.
- `unique (student_id, notice_version)` (criterion 1). Composite `foreign key (tutor_id, student_id) references students (tutor_id, id) on delete cascade` (students already has `students_tutor_id_id_key`). Cascade, not the deferred "no action" the dues and payments use: nothing references `consents`, so a student delete or a tutor delete cascades cleanly in either order. A pgTAP test proves both.
- Index on `(tutor_id, student_id)` for the tutor's own read and the cascade.
- No parent phone, name or any other personal column.
- RLS on; one policy `consents_select` for `authenticated` using `tutor_id = (select auth.uid())` (the same documented departure from the four-policy rule as `payments`, `dues` and `reminders`; say so in the migration comment). `revoke all ... from anon, authenticated; grant select ... to authenticated`. Nothing for `anon`.

**`public.paypage_hits` and `public.paypage_hit(p_hash text, p_limit integer) returns boolean`.** A copy of `receipt_hits` and `receipt_hit`: `key_hash`, `hour_bucket`, `n`, primary key `(key_hash, hour_bucket)`, the extra `hour_bucket` index for the purge (R1-7's review found it was needed; include it from the start), RLS on, no policy, `revoke all` from `public, anon, authenticated`; the function is `security invoker`, `set search_path = ''`, purges hours older than 24, atomic upsert-increment, returns `n <= p_limit`; execute revoked from `public, anon, authenticated` and explicitly granted to `service_role`. One table serves both functions: the HMAC messages differ by prefix (A6), so the hashes never collide. No `tutor_id` on purpose (its rows belong to no tutor); the comment says so.

**`public.get_pay_page(p_token text) returns jsonb`**: `security definer`, `stable`, `set search_path = ''`, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role`.
1. Token shape guard first: null or not `^[A-Za-z0-9_-]{22,}$` returns null.
2. One select joining `students s` and `tutors t` (inner join, so a tutor-less row gives null) where `s.pay_token = p_token and s.active`. Not found returns null (unknown, archived, bad: one answer).
3. `language` = `coalesce(s.parent_language, t.language, 'en')`. `consent_needed` = `not exists (select 1 from consents where student_id = s.id and tutor_id = s.tutor_id and notice_version = current_notice_version())`.
4. If `consent_needed`: return exactly `consent_needed` (true), `notice_version`, `tutor_name`, `tutor_subjects` (`to_jsonb`), `student_name`, `language`. The function returns before running any query for dues, payments or UPI, so there is nothing for a bug to leak.
5. Else return exactly the 13 keys of criterion 5. `upi_id` is `t.upi_id` (key present, null when unset). `today` is `public.india_day(now())` as `YYYY-MM-DD` (reuse the existing function). `open_dues`: dues of this student with `status in ('due','partial')`, ordered `(kind <> 'opening'), due_date, month`, limited to 24, each built with exactly `kind, month, due_date, amount, amount_paid, remaining` (`remaining = amount - amount_paid`). `total_remaining` = `coalesce(sum(amount - amount_paid), 0)` over all open dues (integer; cast the sum back to integer, because `sum(integer)` is `bigint`). `open_dues_more` = `greatest(count - 24, 0)`. `receipts`: payments joined to this student's dues (`p.tutor_id = d.tutor_id and p.id`... via `due_id`), `voided_at is null`, ordered `created_at desc, receipt_no desc`, limit 12, each exactly `receipt_no, receipt_token, month` (the due's month, null for an earlier balance), `amount, paid_on, balance_after`; `receipts_more` = `count(*) > 12`. Empty lists are `'[]'::jsonb`, never null.
6. No row id, `tutor_id`, phone, email, parent name, `pay_token` or other student's data is selected into a variable at all (the select list names only the columns used). Every list is built with `jsonb_build_object` and a fixed key list.

**`public.record_consent(p_token text, p_notice_version text) returns text`**: `security definer`, `set search_path = ''`, same grants (service_role only).
1. Bad token shape, unknown token, archived student, tutor-less: `not_found` (checked before the version, so an unknown token cannot learn the current version).
2. `p_notice_version` null or not equal to `current_notice_version()`: `stale_notice`, nothing written.
3. Else `insert ... on conflict (student_id, notice_version) do nothing`, with `tutor_id` read from the student row (never an argument), `accepted_at` the database default. Returns `ok` whether it inserted or the row already existed. The unique constraint, not a prior select, makes two simultaneous calls safe.

No other function, view or trigger. No change to `students`.

## A4. The contract the Edge Functions and Part B read

`pay-page`: `POST` `{ "token": "<24 chars>" }`.
- 200 `{ "code": "ok", "page": { ...allow-listed keys } }`. Pre-consent keys: `consent_needed, notice_version, tutor_name, tutor_subjects, student_name, language`. Post-consent keys: those plus `upi_id, today, total_remaining, open_dues, open_dues_more, receipts, receipts_more`. Nested objects are re-allow-listed by the handler too (see A6).
- 404 `{code:"not_found"}`; 400/405/413 `{code:"invalid"}`; 429 `{code:"rate_limited"}` with `Retry-After: 3600`; 500 `{code:"error"}`.

`record-consent`: `POST` `{ "token": "<24 chars>", "notice_version": "v1" }`, exactly those two keys.
- 200 `{code:"ok"}`; 409 `{code:"stale_notice", notice_version:"<current>"}`; 404, 400/405/413, 429, 500 as above.

## A5. Tests required

pgTAP `220_consents_rls.sql` (criteria 1, 2, 11; two tutors plus anon, as `150_payments_rls.sql`):
- Tutor A reads its own consent rows; tutor B reads zero by any filter (by student id, by version, by `tutor_id = A`); `anon` is refused with `42501` on select, insert, update and delete.
- `authenticated` has `select` only: insert, update, delete and truncate are each refused (`42501`), and `has_table_privilege` pins that.
- RLS on, exactly one policy (`consents_select`), the policy's name and command pinned.
- A consent naming tutor A with tutor B's student violates the composite foreign key (run as the owner role). `unique (student_id, notice_version)` rejects a duplicate. The `notice_version` check rejects `''`, 17 characters and uppercase.
- Column list is exactly `id, tutor_id, student_id, notice_version, accepted_at` (no phone, name or personal column).
- Deleting the student removes its consents; deleting the tutor (`auth.users` delete) removes all of them.

pgTAP `230_pay_page.sql` (criteria 3 to 10, 11):
- Privileges: `service_role` can execute `get_pay_page`, `record_consent`, `paypage_hit`, `current_notice_version`; `anon` and `authenticated` cannot, and a call as anon, as tutor A and as tutor B each fails `42501` (criterion 3). `paypage_hits` has RLS on, no policy, no privilege for `anon` or `authenticated`. `has_index` for `paypage_hits_hour_bucket_idx`. `get_pay_page` and `record_consent` are `security definer`; `paypage_hit` is not.
- Unknown, empty, null, short, wrong-case, trailing-space, wildcard, injection-string tokens: `get_pay_page` null and `record_consent` `not_found`, nothing written. Archived student (`active = false`): null and `not_found`. Tutor deleted: null.
- Pre-consent keys equal the literal 6-key list by `jsonb_object_keys`; `consent_needed` true; values for tutor name, subjects, student name, language. No amount or UPI ID appears in the serialised answer (search for the seeded UPI ID and amounts).
- Post-consent keys equal the literal 13-key list; each `open_dues` element has exactly 6 keys, each `receipts` element exactly 6 keys. Values: `today` for a fixed `now()` (use the transaction-local clock trick the earlier pgTAP files use, or compare with `public.india_day(now())::text`); `total_remaining` is the sum of remaining over partial and unpaid fees; a part paid fee shows `remaining` = amount minus paid; an earlier balance sorts first; a fully paid fee is absent; a student with no dues and a fully paid student both give `[]` and 0.
- More than 24 open dues: list length 24, `open_dues_more` correct, `total_remaining` counts all (seed 26 monthly dues with distinct months, or 25 plus an opening one).
- Receipts: newest first; a voided payment is absent; a payment of a sibling with the same parent phone is absent; another tutor's payment is absent; more than 12: 12 listed and `receipts_more` true; exactly 12: false; the earlier-balance receipt has month null.
- Privacy: serialised pre- and post-consent answers contain none of the seeded parent phone, parent name, parent email-like strings, tutor email, `pay_token`, any seeded row id, nor the words `tutor_id`, `student_id`, `due_id`, `claim`, `reminder`, `plan`; the other student's name never appears; no UUID-shaped string appears at all (regex), which catches an id of any kind.
- `record_consent`: current version gives `ok` and one row; again gives `ok` and still one row; with `stale` and `''` and null version gives `stale_notice` and no row; version check happens after the token check (unknown token with a stale version returns `not_found`); the row's `tutor_id` is the student's tutor; after `ok`, `get_pay_page` flips to the 13-key answer; a consent for an old version (insert one as owner with `v0`) does not count (page still asks).
- Two sessions at once is not provable in one transaction; the plan relies on `on conflict`. Optional, low priority: a shell test like `supabase/tests/concurrency/record_payment_concurrent.sh` running two `record_consent` calls in parallel. Only add it if the CI `database` job pattern makes it cheap; do not block the PR on it.
- `paypage_hit`: five within limit then false; separate hashes count apart; a row more than 24 hours old is purged by the next call; counts are separate from `receipt_hits` and `waitlist_hits`.
- `current_notice_version()` returns a string that satisfies the `consents` check (so the two cannot drift).

Edge Function tests (Vitest, Node, fakes), `handler.test.ts` in each function, mirroring `receipt/handler.test.ts` case by case (criteria 12 to 15):
- Both: 405 with `Allow`; OPTIONS allowed and denied hosts; 413 over 512 bytes (declared and streamed); 400 bad JSON, non-object and array; malformed, short, empty, null and non-string tokens give the byte-identical 404 body as an unknown token, and a malformed token still calls the lookup exactly once with `DUMMY_TOKEN`; 61st request per hashed IP gives 429 with `Retry-After`; the unknown-IP bucket uses the higher limit; per-token limits (121st for `pay-page`, 21st for `record-consent`); counters and logs are spied: the raw IP and raw token never reach `hashed*` outputs, hit keys, logs or the lookup of any other dependency; logs only the fixed words; thrown dependency gives 500 `{code:"error"}` with no detail; headers `Cache-Control: no-store`, `X-Robots-Tag`, `Referrer-Policy`, `X-Content-Type-Options` on every status.
- `pay-page` only: the allow-list is chosen by `consent_needed`. A fake returning a pre-consent row polluted with every post-consent key plus `tutor_id`, `phone`, `upi_id`, `amount` must yield exactly the 6 keys. A post-consent polluted row yields exactly the 13 keys, with nested `open_dues` and `receipts` elements re-copied to their 6 keys each (so an added SQL column in a nested object cannot leak). If `consent_needed` is not a boolean, the answer is 500 (never guess the stricter or looser state). A missing list becomes `[]`, a missing count 0. This is how we answer hand-off 9: a handler test proves a pre-consent response has none of the post-consent keys.
- `record-consent` only: body with a missing, extra or non-string key gives 400; a `notice_version` that fails the pattern gives 400 (before any counting beyond the IP limit, see A6); `ok` gives 200 `{code:"ok"}` and logs `consent_recorded`; `stale_notice` gives 409 with the current version and logs `stale_notice`; `not_found` gives 404 byte-identical to the malformed-token 404; a body containing `student_id`, `tutor_id` or a time is rejected by the exact-keys rule (400), so nothing client supplied is trusted.

The Playwright criterion list for Part A is empty (nothing on screen). Manual: none on a phone; backend-dev's staging smoke is a `curl` POST against the deployed functions by release-manager after the human sets the secret (A7).

## A6. Handler behaviour and decisions

- Order of checks, `pay-page`, same as `receipt`: CORS preflight, method, size, JSON and object shape, IP limit, token shape (bad shape: one lookup with `DUMMY_TOKEN`, same 404), token limit, lookup, allow-list, answer.
- `record-consent`: same, with the exact-key and `notice_version` pattern check (`^[a-z0-9._-]{1,16}$`, mirror of the table check) placed with the JSON checks, before the IP limit, so a malformed body costs no database call. The token-shape 404 path still makes one `record_consent(DUMMY_TOKEN, <the given version>)` call so the work is similar.
- Hash messages (HMAC-SHA256 with `PAYPAGE_HASH_SALT`, same shape as `receipt`): `pay-page` IP `pp-ip|<ip>|<hour>`, token `pp-token|<token>|<hour>`; `record-consent` IP `pc-ip|<ip>|<hour>`, token `pc-token|<token>|<hour>`. The prefixes keep the four counters apart in the one table, so reading the page never uses up a parent's consent allowance and a different function cannot reuse a hash.
- Limits as constants at the top of each handler: 60 per IP, 2000 for the unknown-IP bucket (same H7 open check as `receipt`; preprod-qa confirms the header on staging), 120 per token for `pay-page`, 20 per token for `record-consent`. Allowed browser hosts: `PAYPAGE_ALLOWED_HOSTS` (optional), default the same as `receipt`'s; `APP_ENV=local` also allows `http://localhost:3000`.
- Logs: `ok`, `not_found`, `rate_limited`, `error`, `too_large`, `invalid` for both; `consent_recorded` and `stale_notice` for `record-consent`. No value is ever logged.
- `record-consent` 409 needs the current version: `record_consent` returns only `stale_notice`, so on that word the Deno wiring calls `get_pay_page(token)` once and takes `notice_version` from it (that key is in the pre-consent answer, so nothing extra is exposed), exposed to the handler as `deps.currentNoticeVersion(token)`. If that returns null the handler answers the same 404. No second place holds the version.
- Supabase client: `npm:@supabase/supabase-js@2.117.3`, the version `receipt` already imports and the service role key from the platform. No new dependency.

Decisions beyond the spec's defaults (flag for the founder; none blocks):
1. The notice version lives in a SQL function `current_notice_version()` (value `v1`), not a table.
2. One shared `paypage_hits` table for both functions, kept apart by HMAC prefixes, with separate IP buckets per function (so 60 page reads and 60 consent saves per IP per hour, not 60 together).
3. Consent and rate-limit shared plumbing moves to `_shared/public-http.ts` for the two new functions; `receipt` keeps its own copy for now (a later cleanup slice may move it; not here, to keep this PR from touching a merged, working function).
4. `record-consent` rejects any extra key with 400, and a bad `notice_version` shape with 400 (not 404).
5. `open_dues` ordering: earlier balance first, then `due_date`, then `month`; receipts: `created_at desc, receipt_no desc` (a back-dated payment still counts as newest by when it was recorded).
6. `tutor_subjects` and `upi_id` keys are always present (null when unset) so the page never has to guess missing from absent.
7. The 409 current version comes from one extra `get_pay_page` call in the wiring (above).

## A7. Secrets and environments (who does what)

- Placeholder name only in `.env.example` (`PAYPAGE_HASH_SALT`, no value) and a dummy value in `supabase/config.toml` for the local runtime (a dummy is already the pattern for the other two and is not a secret).
- **The human must set the real `PAYPAGE_HASH_SALT` on staging and on production** (and optionally `PAYPAGE_ALLOWED_HOSTS`): a long random value, different from `WAITLIST_HASH_SALT` and `RECEIPT_HASH_SALT`, set with `supabase secrets set` in the human's own terminal, never pasted in a chat, commit, log or test. Until it is set, the functions return 500 on every call (the wiring throws "salt missing", as `receipt` does) and nothing leaks.
- **backend-dev will not** generate, set, print or read a real value, run `supabase secrets set`, `db push` or `functions deploy`, or touch production in any way. `release-manager` deploys the migration and the two functions to staging only after the human has set the staging secret; production migration and function deploy are the human's, after a database dump, each approved separately.
- The migration is safe to apply before Part B exists: it only adds objects; nothing existing calls them. Rollback is a forward fix.

## A8. Risks and traps

- **Consent gate leak.** The pre-consent branch must return before querying dues, payments or the UPI ID. Enforced three ways: the SQL returns early, the pgTAP key-list test, and the handler allow-list chosen by `consent_needed` (with a polluted-row test). A non-boolean `consent_needed` is a 500, not a guess.
- **Id leakage in nested lists.** Easy to build `to_jsonb(row)` by habit. Forbidden: every object uses `jsonb_build_object` with named keys. The UUID-regex pgTAP test catches any id.
- **`sum()` returns bigint.** Cast to integer, and keep money integer paise end to end. No `numeric` or float in the answer.
- **Unknown versus archived versus bad token must be indistinguishable**, in SQL (null / `not_found`) and in the handler (byte-identical 404 with a dummy lookup). Do not add a distinct message or status for archived.
- **Version check order in `record_consent`.** Token first, so an unknown token cannot be used to read the current version. The version is only revealed on a known token, and it is already in the pre-consent page.
- **Same-hash collisions between the four counters** (two functions times IP and token): the HMAC prefixes are the guard; a unit test asserts the four messages differ for the same input.
- **Unknown-IP bucket** (H7 still open): the bucket with a 2000 limit may let one noisy caller fill the page-wide allowance; the per-token limits are the real guard. Same accepted risk as `receipt`; preprod-qa confirms the header.
- **Rate-limit table purge cost**: the `hour_bucket` index is in the first migration so the lesson from R1-7's review is not repeated.
- **Definer function search path.** `set search_path = ''` and every object schema-qualified (`public.`), as the existing functions do; `extensions.` is not needed.
- **Grants after migration.** New functions are executable by `anon`/`authenticated` by default on Supabase; the migration must `revoke` explicitly and the pgTAP file pins it. Never `grant ... to anon`.
- **Stamp ordering.** The new migration must sort after every migration on `main` when written; `pnpm check:db --base origin/main` verifies. If another PR merges first with a later stamp, re-stamp the new file (it is unapplied, so this is allowed), never an applied one.
- **Docker is not available on the founder's machine**: `pnpm db:reset` / `pnpm db:test` run in CI's `database` job. Push the branch and read that job's result; do not claim the pgTAP files pass unless CI ran them. Run `pnpm test` (Vitest, includes the handlers) and `pnpm typecheck` locally; check that the Vitest config picks up `supabase/functions/**/*.test.ts` (it does for `receipt`) and that Deno-only imports stay in `index.ts`.
- **CORS from the page's host**: the pay page will POST from the Vercel host; defaults match `receipt`'s, and the preview pattern is carried over. Part B's e2e uses a stubbed host, so a wrong host list would only show on staging: preprod-qa must call both functions from a real browser origin.

## A9. Not doing in Part A

- Any screen, route, `vercel.json` rewrite, message key, or change to `src/`, `messages/`, `e2e/`, `scripts/`.
- `parent_phone` or any other column on `consents`; a consent language column; a way for a parent to withdraw consent; a tutor-side consent view (RLS lets her read it; no screen).
- `payment_claims`, `submit-claim`, the screenshots bucket (R1-10); attendance count (R1-11); referral code (R1-13); tutor photo.
- Page analytics events (`paypage_viewed`, `upi_button_tapped`; R1-14).
- Rotating or revoking a `pay_token`.
- Moving `receipt` onto the new shared file; changing `get_receipt`, `receipt_hits` or any R1-7 object.
- A zod or any validation library; any new dependency. A settings table for the notice version. A generic "public function" framework beyond `_shared/public-http.ts`.
- Running anything against production, setting any secret, or editing an applied migration.

## A10. Work split

1. `backend-dev`: create the migration with `pnpm exec supabase migration new r1_pay_page`, write A3 (notice-version function, `consents` with RLS and grants, `paypage_hits` and `paypage_hit`, `get_pay_page`, `record_consent`, explicit revokes and the service_role grants), with a header comment holding the contract of A4. Write `220_consents_rls.sql` and `230_pay_page.sql` (A5). Confirm `020`, `030`, `080` still pass (CI `database` job) and `pnpm check:db --base origin/main` passes.
2. `backend-dev`: write `_shared/public-http.ts` and its test (lift from `receipt/handler.ts`; do not edit `receipt`).
3. `backend-dev`: write `pay-page/handler.ts`, `index.ts`, `handler.test.ts` (A5, A6).
4. `backend-dev`: write `record-consent/handler.ts`, `index.ts`, `handler.test.ts`.
5. `backend-dev`: `config.toml` (secret dummy and two `verify_jwt = false` entries), `.env.example` (name only), `docs/ENVIRONMENTS.md` and `supabase/CLAUDE.md` text (A2, A7). Append "Part A built" notes under this plan: migration file name, any deviation, the final handler constants.
6. `test-engineer` after 1 to 5: review the pgTAP and handler tests for gaps against criteria 1 to 15 (nothing in Playwright for Part A), including the spy tests on raw IP and token.

`frontend-dev` has no task in Part A. Part B starts only after Part A merges (it needs the contract in A4 to stub the function host), and gets its own technical plan.

**Starts first: `backend-dev`, task 1 (the migration and its two pgTAP files).**

---

## Part A built (backend-dev, 2026-10-13)

- Migration: `supabase/migrations/20261012230218_r1_pay_page.sql` (`current_notice_version()` returning `v1`, `consents`, `paypage_hits`, `paypage_hit`, `get_pay_page`, `record_consent`). pgTAP: `supabase/tests/220_consents_rls.sql` (40 tests) and `230_pay_page.sql` (108 tests). `020`, `030` and `080` are generic and name none of the new objects, so no list needed a line.
- Functions: `supabase/functions/_shared/public-http.ts` (+ test), `pay-page/{handler,index,handler.test}.ts`, `record-consent/{handler,index,handler.test}.ts`. `receipt` untouched.
- Handler constants: 60 per hashed IP per hour, 2000 for the unknown-IP bucket, 120 per hashed token per hour for `pay-page`, 20 for `record-consent`, body limit 512 bytes, `Retry-After: 3600`. Hash messages `pp-ip|`, `pp-token|`, `pc-ip|`, `pc-token|` (exported from each handler, and a test asserts the four differ).
- Config: `PAYPAGE_HASH_SALT` dummy in `config.toml`, `verify_jwt = false` for both functions, name only in `.env.example`.
- Deviations: (1) `allowedOrigin` in the shared file takes `(origin, appEnv, allowedHosts)` instead of the whole `env` object, so each function keeps its own optional host variable name. (2) `record-consent` answers 400 (not 404) for a non-string `token`, because the exact-keys rule says a non-string key is 400; a string token of the wrong shape is the 404. (3) `get_pay_page` returns `upi_id`, `today` and the lists only after consent, as planned; the handler turns a missing `total_remaining`, `open_dues_more` into 0 and a missing list into `[]`. (4) The pgTAP tests read answers as the test runner (owner of the security definer functions) and use `service_role`, `anon` and the tutors only for the privilege checks. The optional concurrent shell test was not added.
- Not verified locally (Docker does not work here): the migration and both pgTAP files have not been run. CI's `database` job is the first real run.

---

# Technical plan, R1-9 Part B (the `/p/{token}` page)

Written 2026-10-13 by tech-lead on branch `r1-9b-pay-page-ui`, cut from `main` at 7c5ea86. Covers criteria 16 to 42 only. Part A is merged: the contract in A4 and the "Part A built" note are what this page calls. Modelled on the merged `/r/` page (`src/app/r/{layout,page}.tsx`, `src/components/receipt/public-receipt.tsx`, `src/lib/receipt-public.ts`, `src/lib/receipt-words.ts`, `e2e/receipt-public*.ts`). No new dependency.

## B1. Approach

One static shell at `src/app/p/` with its own root layout (a copy of `r`'s: `noindex`, `referrer: no-referrer`, `<html lang="en">` that the page corrects once the language is known). A Vercel rewrite serves it for `/p/:token` and `/p/:token/`; the client component reads the token from `window.location.pathname` in an effect, calls `pay-page` with plain `fetch`, and renders one of nine states (opening, consent, fee, all paid, notice, not found, rate limited, failed, and the consent-save sub-states). Agreeing calls `record-consent` and then reads `pay-page` again; nothing is stored on the phone. The words of all four languages ship in the page (as `/r/` does) and the page picks one from the student's `language` and the parent's choice. Three small things are split out so `/p/` does not pull in the app or the reminder templates: the `upi://` link builder (own module), the template helpers `fill`/`parts`/`browserLanguage` (own module), and the money and day logic of the page (own pure file).

## B2. Files

Create:

- `src/app/p/layout.tsx`: copy of `src/app/r/layout.tsx` (title is `brand.name`, `robots` no index no follow, `referrer: no-referrer`, `HtmlShell lang="en"`). Comment says what it is.
- `src/app/p/page.tsx`: server component; `<PublicPayPage words={...} />` with `getAllWords("payPage")` and the receipt sub-tree below (B6). No `generateStaticParams`.
- `src/components/pay-page/public-pay-page.tsx` (client): the state machine, the effect that reads the address and calls `pay-page`, the language choice, the consent call, retry. Sets `document.documentElement.lang`. Renders the frame and one screen.
- `src/components/pay-page/frame.tsx`: the cloth header ("Fee request from {tutor}", subjects line, language button), the `<main>` (single column, `max-w-md`, `mx-auto`, same classes as `/r/`), the cloth footer. Never `AppScreen`.
- `src/components/pay-page/language-menu.tsx`: the button showing the current language's own name and the list of four (44px each). Uses the existing `Sheet` (it imports nothing from the roster or the app; checked) so the wide-shell dialog behaviour is free. If frontend-dev finds it drags the roster in, use an inline list under the button instead; do not write a new modal.
- `src/components/pay-page/consent-screen.tsx`: the `Consent` canvas screen; props say `mode: "ask" | "read"` (read has Close and no agree button, B5).
- `src/components/pay-page/fee-screen.tsx`: slip with "for {student}", fitted headline amount (`amountFit`, `amount-box`, as `/r/`), the fee list (`StatusTag` for Overdue, plain "Due {date}"), then `pay-actions`, `earlier-receipts`, the notice link, the footer text.
- `src/components/pay-page/pay-actions.tsx`: the Pay `<a>`, the two notes, the fallbacks, Copy UPI ID, the no-UPI, too-big and all-paid variants.
- `src/components/pay-page/earlier-receipts.tsx`: the rows and "View" links.
- `src/lib/upi-link.ts`: the link builder split out of `reminder.ts` (B4).
- `src/lib/public-words.ts`: `parts`, `fill`, `Part`, `browserLanguage` moved out of `receipt-words.ts` (B6).
- `src/lib/pay-page-public.ts`: `tokenFromPath` (`/p/`), `fetchPayPage`, `postConsent`, the `readPage` validator and its types. Plain `fetch`, `credentials: "omit"`, `cache: "no-store"`, `referrerPolicy: "no-referrer"`, 15 s timeout, the same shape as `fetchReceipt`. Endpoints `${supabaseUrl}/functions/v1/pay-page` and `/record-consent`. Never throws: returns an outcome (`ok` with the page, `not_found`, `rate_limited`, `stale` for 409 with the version, `failed`).
- `src/lib/pay-page-view.ts`: pure logic, no React: `lateness(today, dueDate, kind)` (integer arithmetic on the `YYYY-MM-DD` strings, never the phone clock), `feeLine(...)`, `upiNote(...)` (the `tn` rule), `payLink(page)` (null when no UPI ID, total 0 or above the ceiling), `splitReceiptsKind` helpers, `monthYearLabel`.
- `src/lib/pay-page-words.ts`: `PayPageWords`, `AllPayPageWords`, the receipt sub-tree type, and a `wordsFor(language)` helper. Reuses `fill`/`parts`.
- `src/lib/pay-page-words.review.json`: same shape as `receipt-words.review.json` (hi, kn, te "not reviewed").
- Tests: `src/lib/upi-link.test.ts`, `src/lib/pay-page-public.test.ts`, `src/lib/pay-page-view.test.ts`, `src/lib/pay-page-words.test.ts`, `src/lib/pay-page-code-rules.test.ts` (the grep test, criterion 40), `src/components/pay-page/*.test.tsx` (one per component), `e2e/pay-page-helpers.ts` (copy the shape of `receipt-public-helpers.ts`: `TOKEN`, `FUNCTION_URL` for both functions, `stubPayPage`, the request log), `e2e/pay-page.spec.ts`, `e2e/pay-page-layout.spec.ts`, and a `/p/` case in `e2e/wide-public.spec.ts` (B9).

Change:

- `vercel.json`: add rewrites `/p/:token` and `/p/:token/` to `/p/index.html` (next to `/r/`), and a headers rule for `/p/(.*)` with `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`. Also add `Cache-Control: no-store` for `/p/(.*)`? No: the shell is a static file with no secret in it and `/_next/static` assets must stay cached; the data call is `no-store`. Not adding it.
- `src/lib/supabase-files.test.ts` (criterion 36 block, line ~190): that test pins `vercel.json` byte for byte; extend its expected object with the `/p/` rewrites and header rule. This test failing is the first sign if the file and the test disagree.
- `scripts/serve-out.mjs`: no code change needed (it reads `vercel.json` and understands `:name` and `(.*)`); frontend-dev confirms by e2e and does not copy the rules into it. A `/p/` request with a file named by an extra segment (`/p/abc/def`) falls to `404.html`; kept.
- `scripts/size.mjs`: add `"p/index.html"` to `SHELL_BUDGETS` (so `REQUIRED` includes it); value set after measuring (B7). Update the error message that names only `r/index.html`. `src/lib/size-scripts.test.ts` (`shellPage` fixtures) gets a `p/index.html` case: missing file fails, over budget fails.
- `scripts/check-locale-leak.mjs`: `SHELLS` gets `{ path: "p/index.html", name: "parent pay page", ... }` and an optional list of sub-trees, so the receipt words the page reuses are allowed as exactly those keys and no others (B6). The "all four languages' words are on the page" loop covers each listed tree. A TODO-translate marker on the page still fails.
- `scripts/i18n-check.mjs`: a `PAYPAGE_REVIEW` record checked with `checkReviewRecord` over every `payPage.*` key read from `en.json`, as `RECEIPT_REVIEW` is (strict mode fails on not-reviewed; non-strict prints the note).
- `src/i18n/words.ts`: add `"payPage"` to `argumentNamespaces` (arguments only; the check `notPlain` already runs). Update its header comment (it names the receipt as the only user). `src/i18n/words.test.ts` gets the payPage case.
- `src/lib/reminder/reminder.ts`: `upiLink` and `UPI_ID` delegate to `upi-link.ts` (B4). Behaviour, exports and the R0-2 and R1-8 tests are unchanged.
- `src/lib/receipt-words.ts`: import `parts`, `fill`, `Part`, `browserLanguage` from `public-words.ts` and re-export them, so `public-receipt.tsx` and `receipt-words.test.ts` change by at most an import path.
- `messages/{en,hi,kn,te}.json`: the `payPage` namespace, all four together (B6).
- `src/CLAUDE.md`: add the line `src/app/p/  /p/{token}: the parent's pay page, one static shell (its own root layout)` and change "four root layouts, (jump), [locale], dev and r" to five, adding `p`.
- `src/config/routes.ts` / `routes.test.ts`: inspect only. If `/r/` is named there as a public path, add `/p/` the same way; if not, nothing.
- `e2e/no-marker.spec.ts`: add the `/p/{token}` page in each state it can reach (consent, fee) to the "no TODO-translate on screen" sweep.
- `supabase/tests/240_pay_page_total_range.sql` (the nit): the bug is fixed (`total_remaining` is `bigint`; the test now passes). Reword the header comment so it no longer says "EXPECTED TO FAIL" and no longer describes the bug in the present tense: say it is the regression test for the range of `total_remaining` (22 open fees at the cap, 2,200,000,000 paise, must read and sum without "integer out of range"). Comment only, no SQL change. This is the one non-page file in the PR; mention it in the PR body.

Not changed: `src/app/r/*`, `receipt-public.ts`, the `receipt` function, any Edge Function, any migration, `supabase/CLAUDE.md`, the tutor app (Remind, board), `check-404-lib.mjs` (it inspects only `out/404.html`; nothing in it names `/r/`, so a `/p/` shell needs no line there. `check:404` still has to pass, and `e2e/not-found.spec.ts` gets two cases: `/p/a/b` and `/p/token/extra` are 404 pages, while `/p/` and `/p/{any}` are the shell).

## B3. The shell, the address and the states

- **Serving.** `out/p/index.html` comes from `src/app/p/page.tsx`. Vercel and `serve-out.mjs` rewrite `/p/<anything one segment>` and the same with a trailing slash to it. `/p/` itself resolves to the same file (a directory with an `index.html`), so "no token" needs no special rule.
- **Token.** `tokenFromPath(pathname)`: `^/p/([^/]+)/?$` and `^[A-Za-z0-9_-]{22,128}$`; otherwise null and the state is `not_found` with no request (criterion 16). Read afresh in each effect run and in each retry. The token is never rendered, never put in the title, history or any state that is shown; the effect closure and the request body are its only homes (criterion 42). `history.replaceState` is NOT used (nothing to hide from the address bar: it is already the address, and rewriting it would break "reload").
- **State type** (in the component): `loading | consent | fee | notice | not_found | rate_limited | failed`; `consent` carries `{page, saving: "idle" | "saving" | "failed"}`; `fee` carries the post-consent page; all-paid is a render case of `fee` (`openDues.length === 0`), not a state. `data-state` on `<main>` is set for e2e, as `/r/`.
- **Reading.** One `pay-page` POST per load and per retry. `readPage(body)` validates the 200 body: `code === "ok"`, `page.consent_needed` is a boolean (else treat as failed), then the pre-consent keys, and when `false` the post-consent keys with types (`total_remaining` any safe integer >= 0: it is a bigint in SQL and may exceed 2^31, see risks; `open_dues` elements with the six keys and integer paise; `today` and dates as `YYYY-MM-DD` that `formatDate` accepts; `receipts` with the six keys; `upi_id` string or null; `language` through `isLocale`). Unknown keys are dropped, never shown. A page that fails validation is `failed`, not a half page.
- **Opening state** (criterion 17): "Opening your fee request…" in a `Slip` with three blank bars, no tutor data (nothing exists yet), `role="status"`; `aria-busy` on `<main>`. Language is the browser's first preference (`browserLanguage`, the `/r/` rule).
- **Consent save** (criterion 20): tapping agree sets `saving`, a button `disabled` while saving plus a `useRef` guard so a double tap cannot send two (the second tap is ignored even before React re-renders). Success (200) or 409 `stale_notice` both re-read `pay-page` (409: the re-read returns the new `notice_version`, so the screen shows the new notice; if the re-read still says `consent_needed` the consent screen simply stays with a fresh version). Network failure or 5xx: `saving: "failed"` with "Couldn't save. Check your connection and try again." and "Try again" (calls the same handler). 404 on `record-consent` goes to `not_found`; 429 to `rate_limited`. The consent call sends exactly `{token, notice_version}` where the version is the one the page was given, never a constant in the page.
- **Return visit** (criterion 21): nothing to do on the page; the server answers the post-consent shape when a consent row exists.
- **Notice view** (criterion 30): a `view` boolean (`"fee" | "notice"`) kept beside the state. The Privacy notice link sets it; the same `ConsentScreen` renders with `mode="read"` (no agree, no "asked once", a Close button, 44px at least). No request.
- **Language** (criterion 29): `chosen: Locale | null` state, starts null; `language = chosen ?? page.language ?? browserLanguage`. The menu sets `chosen`; nothing is stored; a retry or reload returns to the student's language. Changing it re-renders only; no request, and the consent screen is not reloaded.
- **Document language.** An effect sets `document.documentElement.lang` to the language (the script's face and line height depend on it; `/r/` does the same) and `<main lang>`.
- **Names** (tutor, student, UPI ID, fee month text) get `translate="no"` and `wrap-anywhere`. The tutor's missing name shows `payPage.yourTutor`.
- **Today and lateness.** `lateness(today, dueDate)`: both parsed to integer day numbers (days from civil, integer arithmetic, no `Date` with the phone clock; if `Date.UTC` is used it takes the parsed parts, never `new Date()` with no argument) and compared: due before today is `overdue`, equal is "Due today" (a short key `payPage.line.dueToday`, see B6), after is "Due {date}". Kind `opening` is always "Earlier balance", with no due date, and never carries an Overdue mark unless its `due_date` is before today, which for an earlier balance it always is: the spec says an earlier balance says "Earlier balance" with the overdue mark when late (criterion 23, `StatusTag` forms). Decision: an earlier balance carries the Overdue mark too (it is owed and its stored date is past); the line text stays "Earlier balance". Flagged in B10.

## B4. The UPI link, the note, Copy

- **Split `upiLink`.** `reminder.ts` imports `templates.json` (all four languages' message templates), which `check:leak` allows only on named pages and which would weigh down `/p/`. New `src/lib/upi-link.ts` (pure, no imports from `reminder.ts`) exports: `UPI_ID` (the PRD pattern, moved), `rupeesText(paise)` (integer arithmetic, moved), `buildUpiLink({ upiId, payeeName, paise, note, maxPaise })` (all the checks of today's `upiLink` except the note composition: UPI ID pattern, non-empty payee, safe integer paise `1..maxPaise`, then `upi://pay?pa=&pn=&am=&cu=INR&tn=` with `encodeURIComponent` on `pn` and `tn`), and `PAY_PAGE_MAX_PAISE = 100_000_000`. `reminder.ts` keeps its `upiLink` signature, builds its month or balance note and its tool-only whole-rupee rule (`maxPaise === undefined`) and calls `buildUpiLink` for the final string; it re-exports `UPI_ID` so every existing import and the R0-2 and R1-8 tests stay green. If the whole-rupee rule cannot cleanly sit on top, `upiLink` keeps that check and passes `maxPaise: MAX_PAISE`. Success test for this split: `pnpm test` (reminder, app-reminder, tool, remind) unchanged and passing, and `pnpm size` shows `en/tools/fee-reminder` and `home` no larger than before.
- **Tutor name for `pn`.** `payeeName = tutor_name` trimmed; when empty, the part of the UPI ID before `@` (spec edge case). A UPI ID that fails `UPI_ID` shows the no-UPI state's sibling: treat as "no usable UPI ID" and show no button (the function holds whatever the tutor saved; R1-2 validates, but the page never trusts it).
- **Note `tn`** (`upiNote` in `pay-page-view.ts`, criterion 38): one open fee with a month: `Fee {Mon YYYY}` (from `formatDate(month).slice(3)`, which is already English short month and year, no new month table); earlier balance only: `Fee balance`; more than one open fee: `Fees due`; then ` {first name}` only if the student's first word matches `^[A-Za-z]+$` (plain Latin letters), the whole note cut at 40 characters on a character boundary (the name is cut, the head is not). Never a phone, never an amount. Default 10 of the spec.
- **Button.** `<a href={link}>`, `rel="noopener"`, no `target`. 72px (`h-18`, or the token the other 72px buttons use; frontend-dev takes the existing Button anchor variant with the blue look from `ui/button.tsx` and does not write new button CSS). Label `payPage.pay` with `formatRupees(total)`. Shown only when `payLink(page)` is non-null: UPI ID present and valid, `0 < total <= PAY_PAGE_MAX_PAISE`. Three variants of the block under the headline: normal; `total > max` with the plain UPI ID line ("Pay {amount} to this UPI ID in your UPI app", the amount through `formatRupees`, never cut); no UPI ID, with "Your tutor has not added a UPI ID yet..." and no Copy or QR. All paid: none of these.
- **Copy UPI ID.** Drawn only when `navigator.clipboard?.writeText` exists at the time of render (read in an effect through `useSyncExternalStore`, as `/r/` reads languages, so server HTML has no Copy button). On tap: `await navigator.clipboard.writeText(upiId)` inside try; on success show "Copied" with a tick for 2 s (a timer cleared on unmount), on rejection do nothing visible except keep the ID selectable. 48px, outline look from `ui/button.tsx`. Writes exactly the UPI ID.
- **Show QR code.** Not drawn in Part B (criterion 26). `pay-actions` has no placeholder, no disabled button.
- **Notes under the button.** "Your UPI app opens with the amount filled in. It goes straight to {upiId}." (the ID as a mono, `select-all`-friendly span with `translate="no"`) and "Paid already? Your tutor marks it paid and sends you a receipt." Neither says paid, done or success about a payment the page has not seen (a unit test greps the English words of the namespace for those three words outside `paidAlready`, `allPaid`, `receipt.paid`).

## B5. Earlier receipts, all paid, footer, notice

- **Receipts** (criterion 27): a list, each row a block of at least 60px: line one `{Month} · {amount}` (month through the same month label as the fee list; amount through `formatRupees`, mono face `type-amount-row`), line two the mono caption `receipt.paid` or `receipt.part` filled with `formatDate(paid_on)` and the receipt number (`PART PAID` when `balance_after > 0`), and "View" as an `<a href="/r/{receipt_token}" rel="noopener noreferrer">` in the same tab, 44px. The href is built from the token returned by the function, never from the page's own token. An earlier-balance receipt (month null) says "Earlier balance". `receipts_more` adds "Showing the latest 12." No receipts: the section is not drawn.
- **All paid** (criterion 28): the headline block is replaced by the `Stamp` with `payPage.allPaid` and the line `payPage.allPaidNote`; this also covers a student never charged. Receipts, notice link and footer still show.
- **Footer** (criterion 31): the cloth footer of `/r/` with the product name from `brand.name`, `payPage.footer.title` and `payPage.footer.body`. No link, no code.
- **Photo, attendance, referral, "I've paid"**: none, as the spec says.

## B6. Words

- **Namespace `payPage`** in all four message files, keys exactly as spec section 9, plus these the plan found missing: `payPage.line.dueToday` ("Due today"), `payPage.consent.close` is already `consent.notice / close` in the spec, and the failed-save Try again reuses `payPage.state.retry` (one key). Frontend-dev adds only keys a component actually reads; `i18n:check` fails on a missing one and the `no-strings` tests on a hard-coded one.
- **English is final for every key except the consent and notice wording.** Hindi, Kannada and Telugu are `TODO-translate: <English>` (a translator-ready value) except where frontend-dev can write a plain, confident Hindi, which still needs the review record. Nothing in hi, kn or te is reviewed, so `pay-page-words.review.json` says "not reviewed" for all three; `pnpm i18n:check --strict` therefore fails for the pay page words, as it already does for the receipt words, and is the release gate.
- **Consent and notice wording is NOT approved (spec questions 3 and 5).** These keys are the founder's text and must be treated as placeholders: `payPage.consent.intro`, `payPage.consent.phone`, `payPage.consent.child`, `payPage.consent.never`, `payPage.consent.title`, `payPage.consent.notAgree` (and the notice read view uses the same keys). They keep the spec's English text verbatim (tech-lead does not paraphrase it). No visible or shipped marker is added to them (a `_status` key would ship in the page and `getAllWords` does not skip it). The block lives in the review record instead: `src/lib/pay-page-words.review.json` gets a top-level `"consentWording": { "status": "draft, not approved", "approvedBy": "", "date": "" }` that `i18n-check` reads, prints as a NOTE on every run ("payPage consent wording is a draft: release blocked on founder answers to R1-9 questions 3 and 5"), and fails on under `--strict`. That puts the block in the same place as the receipt translation block, with no text a parent could see.
- **Release block, stated plainly: Part B may merge to `main` with the draft wording (nothing links to the page until Part C, and Part C is released only after it is live), but it must not be released to production until the founder has answered questions 3 and 5 and the consent keys, the review record and (if he wants it) the "Read the full notice" link are updated.** `release-manager` checks `pnpm i18n:check --strict` (it must be green for `payPage`) before the production release; `preprod-qa` records it in the go or no-go report. The PR body repeats this.
- **Shipping all four languages.** `argumentNamespaces` gets `payPage`. `page.tsx` also passes the sub-tree of the existing `receipt` namespace the page needs: `months`, `monthYear`, `earlier`, `subjects`, `tuition` (written once, already reviewed or not as `/r/`'s are), picked from `getAllWords("receipt")`, so month names and subject names are not typed a second time. `src/lib/pay-page-words.ts` builds the typed `{pay, receipt}` pair per language and uses `receipt-words.ts`'s `monthLabel` and `subjectsLine` (they only read the `months`, `monthYear`, `earlier`, `subjects`, `tuition` keys of their words argument, so their parameter type is narrowed to that `Pick` in this PR; `public-receipt.tsx` keeps passing the whole thing). `check:leak` allows exactly these sub-trees.
- **Helpers moved, not copied.** `fill`, `parts`, `Part` and `browserLanguage` move to `src/lib/public-words.ts`; `receipt-words.ts` imports and re-exports them.
- **Untranslated never shown** (criterion 36): `loadMessages` already turns a `TODO-translate` value into English. `check:leak` fails on the marker on `/p/`. A grep e2e (`no-marker.spec.ts`) covers the rendered page.
- **Amounts and dates** are only ever `formatRupees` and `formatDate` output wrapped in `translate="no"` spans with the mono or headline face; never inside a Hindi, Kannada or Telugu text node that uses Anek. Count words like "and {n} more": the number is filled by `fill` as 0-9 digits.

## B7. Bundle

- `/p/` must not import: the Supabase client, `supabase-browser` or any roster code, `reminder.ts`, `templates*.json`, `next-intl` client messages (`ClientMessages`), `dues.ts` or the app's board code. A unit test (`pay-page-code-rules.test.ts`) reads the import lines of every file under `src/components/pay-page/` and the new `src/lib/pay-page-*.ts` and fails on any of those.
- Measured on `/r/` today: 138.4 KB (Next runtime alone about 132.5 KB), budget 145. The spec's "target 100 KB or less" (criterion 41) is not reachable with the Next 16 runtime; the 200 KB limit is the rule. Plan: build, measure, then set `"p/index.html"` in `SHELL_BUDGETS` to the measured size plus about 8 KB, and never above 160 KB; record the number in the PR. The words are in the HTML/RSC payload and are not counted by `pnpm size`, but frontend-dev records the gzipped HTML too (`check:leak` prints it) because a parent on slow data pays for it: all four languages' payPage words are about 4 times the English text, a few KB gzipped. If the HTML passes 60 KB gzipped, tell tech-lead (lazy words per language would be a Part C-sized redesign; not now).
- Part C's QR code is loaded on tap (dynamic import) and never counts here; Part B leaves no placeholder for it.

## B8. Data

No database, migration or function change. The page calls the two Part A functions with the contract of A4 and nothing else. The Part B tests stub the function host (`**/functions/v1/pay-page`, `**/functions/v1/record-consent`) with `page.route`.

## B9. Work split

1. `frontend-dev`: split `upi-link.ts` out of `reminder.ts` and `public-words.ts` out of `receipt-words.ts`; run `pnpm test` and `pnpm size` to prove R0-2, R1-8 and `/r/` are unchanged. (Smallest change first; everything else imports these.) Write `src/lib/upi-link.test.ts`.
2. `frontend-dev`: `pay-page-view.ts` (lateness, note, link, labels) with its table tests under the four `TZ` values (criteria 37 to 39), and `pay-page-public.ts` (token, fetch, validator) with its tests (stubbed `fetch`: 200 both shapes, 404, 409, 429, 500, timeout, malformed body, non-boolean `consent_needed`, extra keys dropped, 3 billion paise accepted).
3. `frontend-dev`: messages: the `payPage` namespace in all four files, `argumentNamespaces`, `pay-page-words.ts`, the review record (with `consentWording` draft), `i18n-check.mjs`, `check-locale-leak.mjs` (SHELLS with sub-trees). Run `pnpm i18n:check` and, after step 5, `pnpm check:leak`.
4. `frontend-dev`: the route and the frame: `src/app/p/{layout,page}.tsx`, `vercel.json`, the `supabase-files.test.ts` pin, `size.mjs`, `src/CLAUDE.md`; `frame.tsx`, `language-menu.tsx`, the opening, not found, rate limited and failed states in `public-pay-page.tsx`.
5. `frontend-dev`: consent screen (ask and read modes) and the consent call; then the fee screen, pay actions, Copy, receipts, all paid, notice link. Component tests as each lands.
6. `frontend-dev`: e2e: helpers and the specs (B11), the `/p/` cases in `wide-public.spec.ts`, `not-found.spec.ts`, `no-marker.spec.ts`; the `240_pay_page_total_range.sql` header; run `pnpm lint`, `typecheck`, `test`, `i18n:check`, `build`, `check:leak`, `check:404`, `size`, `test:e2e`; write the "Part B built" note.
7. `test-engineer` after 6: gaps against criteria 16 to 42, the spy tests (no storage, no analytics, token only in the two bodies), the layout sweep.
8. `code-reviewer`, then `lead-reviewer`, as the pipeline says.

No `backend-dev` task in Part B (nothing in the database or functions changes). If the e2e work shows a Part A function behaves differently from A4 (for example the CORS host list), `backend-dev` fixes it in a separate commit and says so.

## B10. Decisions beyond the spec's defaults (none blocks)

1. **The link builder is split into `src/lib/upi-link.ts`** and `reminder.ts` delegates (criterion 37 allowed it; the split is needed because `reminder.ts` imports the four-language template file).
2. **The earlier balance carries the Overdue mark** (a `StatusTag` in the fee list) as well as the words "Earlier balance", since it is owed and past due; the spec says "Earlier balance and no due date" and "a late fee carries Overdue"; this reconciles them. Founder can say otherwise.
3. **"Due today"** is its own short line (criterion 39 asks for it); one added key.
4. **The consent wording stays the spec's English, and the "draft" block lives in the review record**, not in a visible string (B6).
5. **`SHELL_BUDGETS` value for `/p/`** is set after measuring; the 100 KB target is not reachable and the plan says so.
6. **The language menu uses the existing `Sheet`**, with an inline list as the fallback only if `Sheet` pulls in app code.
7. **Month and subject words reused from `receipt`** (a typed sub-tree), so no second copy to translate or review.
8. **`rel="noopener"` Pay link with no `target`**; View links to `/r/` in the same tab (spec).
9. **`/p/` with no token** is the shell and shows "link doesn't work" with no request (the directory index), not a 404 page.
10. **A reload or a language choice never re-asks the consent**; only the server's `consent_needed` does.

## B11. Tests required (mapped to criteria)

Unit (Vitest):
- `upi-link.test.ts` (37): table of paise to `am` (`100`, `120000`, `99`, `100_000_000`), name and note encoding (Hindi, `&`, space, `+`, `%`), `100_000_001` and `0` and a float refused, bad UPI ID refused, no `Math.round`/`toFixed` (also in 40's grep). The old `reminder.test.ts`, `app-reminder.test.ts`, `copy-text.test.ts` and the tool tests pass unchanged.
- `pay-page-view.test.ts` (38, 39): `upiNote` cases of 38 (Latin name, Devanagari name, 60-char name cut to a 40-char note, several fees give "Fees due", balance only gives "Fee balance"); `lateness` yesterday/today/tomorrow/earlier balance, under `TZ` UTC, `America/Los_Angeles`, `Asia/Kolkata` and `Pacific/Kiritimati` (the repo already runs timezone-matrix tests: copy that pattern); `payLink` null for no UPI ID, bad UPI ID, 0, over the ceiling, and equal to the ceiling builds.
- `pay-page-public.test.ts` (16, 20, 33, 42): token shapes; body of each request is exactly `{token}` or `{token, notice_version}`; `credentials: "omit"`, `no-store`, `no-referrer`; outcomes by status; validator rejects a non-boolean `consent_needed`, a missing list, a float amount, an out-of-range date; accepts a total of 2,200,000,000.
- `pay-page-words.test.ts` and `words.test.ts` (40): every `payPage` key in all four files, only `{name}` arguments, `TODO-translate` turned into English by `loadMessages`; no English literal in the components (the repo's `no-strings` pattern); the three sensitive words check of B4; `brand.name` is the only product name in the page.
- `pay-page-code-rules.test.ts` (40, 41): no `parseFloat`, `toFixed`, `Math.round`, `Intl.`, `toLocale`, `getHours`/`getDate`/`getMonth`/`getFullYear` or `new Date()` with no argument under `src/components/pay-page/`, `src/lib/pay-page-*.ts`, `src/lib/upi-link.ts`; no forbidden imports (B7); no `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `posthog`, `sentry` in those files.
- Component tests: consent screen (agree called once on two taps, saving, failed with Try again, read mode has no agree), fee screen (one line per open fee, part paid, overdue mark, "and n more", headline total, no Pay button for no UPI/zero/over ceiling, Copy hidden without clipboard, Copy writes the exact ID and shows Copied), receipts (rows, `rel`, Showing the latest 12, absent when empty), language menu.

E2E (Playwright, phone viewport 360, function host stubbed, fixed `today` from the stub; each names its criteria):
- `pay-page.spec.ts`: the shell and headers (`noindex` meta and header, `no-referrer`, no locale in the address, `/p/`, `/p/x`, `/p/{22 chars}/` with and without trailing slash) (16); opening state before the stub answers (17); consent screen has no amount or UPI ID in the DOM, in the response stub's log or in the title (18, 19, 42); agree sends one call with the token and version, shows Saving, ignores a second tap, then the fee (20); failure keeps the screen and Try again works; 409 re-reads and shows the new version; return visit goes straight to the fee (21); the fee page composition, the lines, the Overdue mark and word, "Due {date}" (22, 23); Pay `href` equal to the expected string for a stubbed page and 72px (24); the three variants (no UPI, zero, too big) (24, 28); the two notes (25); fallbacks, Copy with a stubbed clipboard and with none (26, no QR button); receipts list, View href and `rel`, 12 limit line, absent when none (27); all paid (28); language open, switch with no new request, reload returns to the student's language, header button shows the language's own name (29); notice link opens read-only and Close returns (30); footer has no link (31); not found, rate limited, failed with Try again, and the browser-language rule via `locale: "hi"` context (32); only the two functions and `/r/` are contacted, no cookie, no storage, no IndexedDB (a recorder of every request and `page.evaluate` on storage), no `pay_token`/UPI ID/amount in `location`, `document.title` or `history` (33, 35, 42); the single column at most 28rem and no tutor navigation (35); `TODO-translate` never on screen in any language (36).
- `pay-page-layout.spec.ts` (34): `en`, `hi`, `kn`, `te`, at 360px and font sizes 100%, 130% and 200% (as `receipt-public-layout.spec.ts`), with the 80-character student and tutor names, 8 subjects, a total of `₹10,00,000`, 24 fee lines, a Telugu tutor name and a Hindi student name: no sideways scroll, controls at least 44 (the Pay button 72), `textProblems` empty, the amount fits its box, status is a word plus a mark under `grayscale(1)`, digits stay 0-9.
- Wide widths (35): add the `/p/` shell (fee state) to `wide-public.spec.ts`'s sweep at 768, 1024, 1280 and 1440 with `expectNoSideways`, and assert the column stays at most 28rem and centred; same for the consent screen at 1024.
- `not-found.spec.ts`: `/p/a/b` is a 404 page; `no-marker.spec.ts`: the two `/p/` screens.
- Build gates, not specs: `pnpm size` (41), `pnpm check:leak`, `pnpm check:404`, `pnpm i18n:check` (40), `pnpm lint` (which also runs `check-tokens.mjs`, so a raw hex or a forbidden class fails).

Manual (the spec's section 11 steps 1 to 15 and 17; 16 needs Part C). Staging functions and `PAYPAGE_HASH_SALT` must be set by the human first (A7); until then the real page shows the failed state and the e2e (which stubs) is the only proof. preprod-qa must call both functions from the real Vercel origin (CORS, A8).

## B12. Risks and traps

- **`reminder.ts` drags the four-language templates into `/p/`.** Fixed by the split (B4); the code-rules test and `check:leak` would both fail if it came back.
- **`total_remaining` above 2^31.** The SQL is bigint and Part A's `240` test proves 2,200,000,000; the validator must accept any safe integer and the headline must fit (the `amountFit` box). Do not use `| 0` or bitwise operators anywhere on amounts (add to the grep test).
- **The page and the consent gate.** The page never asks for anything before consent but the one `pay-page` call; the consent screen component receives only the six pre-consent keys (its props type has no money fields), so it cannot render an amount even by mistake.
- **A double tap on "I agree".** A ref guard and `disabled`, tested by a component test and an e2e that counts the stubbed calls. The server is idempotent anyway.
- **Token in the wrong place.** Only the effect and the two bodies hold it. No `console.log` of any request (lint), no `window.history` use, no title. `tokenFromPath` is read again for each retry, not kept in state.
- **Clock.** Lateness uses `today` from the server. The grep test forbids `new Date()` and local getters in the page code, and the four-timezone table test proves it.
- **Language flash.** The delivered HTML says English with no tutor data; the first paint after fetch is already the student's language because it arrives with the data, and before it the browser's first preference is used, as `/r/`. A language list with 44px rows at 200% font must wrap; covered by the layout spec.
- **Copy and clipboard on an insecure or in-app browser.** Hidden if absent; a rejected write does nothing noisy. The ID stays selectable.
- **In-app browsers (WhatsApp) blocking `upi://`.** Not testable here (manual step 10). The fallbacks are always on screen, so the page degrades.
- **`rel` and the Pay link.** `upi://` is not a web URL, so `noopener noreferrer` is moot; `rel="noopener"` is harmless. No `target="_blank"` (an in-app browser may swallow a new tab).
- **`check:leak` on a page that shows all four languages.** The existing SHELLS logic cuts the namespace's values then searches for any other language's unique values; adding the receipt sub-tree must be exact, or a Hindi receipt word that the page does not carry would fail "does not carry the words". Frontend-dev lists the sub-keys by name and tests the script with a fixture (`check-locale-leak` has a test pattern in `src/lib`; follow it).
- **`serve-out.mjs` order.** A file on disk wins over a rewrite, as on Vercel. A token that equals an existing path under `out/p/` (there is only `index.html`) cannot clash. Do not add any other file under `src/app/p/`.
- **Headers on the shell.** `Referrer-Policy: no-referrer` comes from `vercel.json`, so it holds on Vercel, in the local server and in the `<meta>` from `metadata.referrer`; an e2e checks the header the local server sends (as `receipt-public.spec.ts` line ~220).
- **Release gating.** Merging Part B is safe (no link points to it). Releasing it to production needs the answers to questions 3 and 5 and a green `i18n:check --strict` for `payPage`; otherwise a parent sees unapproved privacy wording or English instead of their language on the consent screen. The `consentWording` draft record makes `--strict` fail until the founder signs it.
- **Docker and the database.** Part B changes no SQL; the `240` file edit is a comment, and CI's `database` job runs it.

## B13. Not doing in Part B

- QR code, "Show QR code", the encoder question (Part C; question 11 stays open), the reminder message's new link and anything in the tutor app (Part C).
- "I've paid", UPI reference, screenshot (R1-10); attendance line (R1-11); referral link (R1-13); tutor photo.
- Remembering consent, language or anything else on the phone; any cookie, storage, analytics script or PostHog; `paypage_viewed` and `upi_button_tapped` (R1-14).
- A service worker or any offline copy (R1-12); caching the function answers.
- "Read the full notice" link and a withdraw control (until the founder answers question 3); a decline button.
- A new modal, new button style, new font, new colour or new token; a QR, markdown, date or state library; the Supabase client in the page.
- Moving `receipt` or `/r/` onto the shared helpers beyond the import move in B2; touching the `receipt` function.
- Changing the migration, either function, or the `get_pay_page` contract.

## B14. Open questions

No new founder question. The two existing blockers stay: questions 3 and 5 block the production release of Part B (B6). Question 11 (the QR dependency) stays open for Part C. No new dependency is proposed.

**Starts first: `frontend-dev`, task 1 (split `src/lib/upi-link.ts` out of `reminder.ts` and `src/lib/public-words.ts` out of `receipt-words.ts`, proving R0-2, R1-8 and `/r/` unchanged), then tasks 2 to 6 in order.**

---

## Part B built (frontend-dev, 2026-10-13)

- **Route and page:** `src/app/p/{layout,page}.tsx` (a copy of `/r/`'s shell), `src/components/pay-page/{public-pay-page,frame,consent-screen,fee-screen,pay-actions,earlier-receipts,language-menu,filled}.tsx`, `vercel.json` (rewrites and the `/p/(.*)` header rule, pinned in `supabase-files.test.ts`), `src/CLAUDE.md` (five root layouts). Logic: `src/lib/{upi-link,public-words,pay-page-public,pay-page-view,pay-page-words}.ts`. Words: `payPage` in all four message files, `argumentNamespaces`, `pay-page-words.review.json` (`consentWording` draft block), `i18n-check` (`checkConsentWording`, and `checkReviewRecord` gained `ignoreKeys` and `todoAllowed`), `check-locale-leak.mjs` (a `/p/` shell that may also carry exactly the receipt's `months`, `monthYear`, `earlier`, `subjects`, `tuition`), `size.mjs`.
- **Task 1 proof:** `pnpm test` unchanged and green; `pnpm size` before and after: `home` 172.2 KB and `remind` 169.1 KB identical, `/r/` 138.4 to 138.5 KB, free tool 142.6 to 142.7 KB (the extra module boundary; no template moved).
- **Bundle:** `/p/` is 143.0 KB gzipped JS (budget set to 151 KB in `SHELL_BUDGETS`); gzipped HTML 5.4 KB with all four languages' words. The 100 KB target of criterion 41 is not reachable: the Next runtime alone is about 132 KB and `/r/` is 138 KB. The 200 KB limit holds.
- **Deviations from the plan:**
  1. `Button` gained a `pay` size (72px, `min-h-18`) with a test; the consent agree button is `xl` (60px), the nearest token to the canvas's 62px.
  2. `payPage.consent.never` stays one string as the spec has it, so "Never:" is not bold as on the canvas.
  3. In `hi`, the non-consent words are written (unreviewed); `kn` and `te` are `TODO-translate`. All `consent.*` keys are `TODO-translate` in `hi`, `kn` and `te`, so the whole consent screen reads English (one language on one screen) until the founder answers questions 3 and 5. `checkReviewRecord` treated a marked word as an always-on problem, so `todoAllowed` makes it a problem only under `--strict`.
  4. The Pay area: a fee that is not late yet shows no tag (its own words already say "due {date}"); an earlier balance that is not late shows the Due tag with the date. The fallback line "UPI app did not open? Use one of these." is hidden when there is no Copy button (it would point at nothing). The too-big variant also gets Copy.
  5. Dates and counts inside body text use the mono role `type-amount-row` (the only role with a Latin face that is not forced uppercase); the receipt caption's date is upper-cased in code because capitals are allowed only inside type roles.
  6. Error states draw no cloth header (no tutor data exists); loading draws the header with a plain block in place of the name.
  7. `src/lib/pay-page.test-util.ts` holds the shared fixtures for unit and e2e tests.
- **Not verified here:** a real phone, a real UPI app, the real functions and CORS on Vercel, and any native-language review (hi, kn and te are not reviewed; the consent wording is a draft).
