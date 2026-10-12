# R1-7: record payment, receipts, `/r/{token}`, receipt PDF

Slice R1-7 (docs/BUILD_PLAN.md section 5, size L, depends on R1-5). Money screen: full process.

Tags: [unit] Vitest, [e2e] Playwright at 360px with the fake Supabase host, [db] pgTAP, [fn] Edge Function test (Deno), [manual] by hand on a phone against staging.

Things the founder should know before reading (found while writing this):

- **`docs/specs/R0-3-receipt-maker.md` does not exist and R0-3 is not on `main`.** There is no receipt code, no `@cantoo/pdf-lib` or `@cantoo/fontkit` in the repo, and the spike rules (emoji, unprintable names, Web Share fallback) are not written down anywhere I can read. Part C below therefore depends on R0-3 landing first. I wrote Part C against the rules as you described them; if R0-3's real rules differ, R0-3 wins.
- **The PRD has "UPI / cash" only, not "bank".** Bank transfer is not added (see question 1).
- **"D3" is not defined in any doc I can read.** I read it as "the free tool prints no receipt number; the app's receipts must".
- **This slice is too big to ship alone. Split into three pull requests, in this order**, all under this one spec:
  - **Part A** (criteria 1 to 22): database, `record_payment`, `void_payment`, the Mark paid sheet, undo, the in-app receipt screen. Shippable alone; the tutor can record and see payments.
  - **Part B** (criteria 23 to 31): the `receipt` Edge Function and the public `/r/{token}` page. Needs A.
  - **Part C** (criteria 32 to 36): receipt PDF, Download, Share to WhatsApp. Needs A and R0-3's PDF module. B is not needed for PDF; B is needed for Share (the message carries the link), so C ships after B.

## 1. Goal

A tutor can mark a fee paid in full or in part, in one sheet, and get a numbered receipt she can send to the parent on WhatsApp as a link or a PDF. The parent opens the link with no account and sees a clean receipt. Before this slice the board is read-only and nothing records money.

## 2. Users and moment

Tutor: low-end Android, between classes or just after a parent hands over cash or shows a UPI screen. One thumb, slow 4G, often a bad connection. She wants: "Ravi's parent paid, mark it, send the receipt", in under 15 seconds.

Parent: opens a WhatsApp link on any phone, no app, no login, possibly a different language from the tutor's. Wants proof of payment. Sees nothing else about the tutor's business.

## 3. Defaults chosen (no founder input needed)

Each can be reversed; none blocks.

1. **Methods are UPI and Cash only**, as in the PRD and the canvas. Not bank. (Question 1.)
2. **Where Mark paid lives.** Each Overdue and Due row on the board gets a separate "Mark paid" button (44px, beside the row link, not inside it). The R1-6 rule "no button inside a row" is changed for this one button. There is no new Student detail screen; Paid and Part paid rows get a "Receipt" button instead that opens the in-app receipt screen. Remind is added to the same row by R1-8.
3. **Amount is prefilled with the remaining balance.** Chips "Full" and "Half" (half rounds down to a whole rupee; if that is 0 the chip is hidden) and "Other" as drawn.
4. **Paid on** is Today, Yesterday or a picked date. Never in the future (India day). Not more than 90 days back.
5. **Over-payment is refused.** Amount must be at least ₹1 and at most what is left on that fee. No credit, no carry to next month. A parent who pays double: the tutor records the due in full, and the extra is a later slice.
6. **Undo.** The undo banner (drawn in `State-undo`) stays 10 seconds. After that a payment can still be undone for 24 hours from the receipt screen. After 24 hours there is no undo or edit in R1-7. (Question 2.)
7. **Undo voids; nothing is deleted.** A voided payment keeps its row and its receipt number. The number is never reused, so numbers can have visible gaps (shown as "Cancelled"). The receipt link of a voided payment still opens but says it was cancelled and shows no amount.
8. **Receipt numbers** are plain integers per tutor, starting at 1, no padding, no year or prefix. Numbers are unique per tutor; the same number can exist for two tutors.
9. **Receipt links never expire.** A receipt is a record the parent may need years later. They are cancelled only by undo or by account deletion. (Question 3.)
10. **Receipt page language** is the student's parent language (`parent_language`); if empty, the tutor's language; if that is empty, English. The address carries no language.
11. **No amount in words.** The canvas shows "one thousand two hundred only"; spelling out numbers in hi, kn and te is a separate piece of work. R1-7 shows figures with "/-" only. (Question 4.)
12. **Needs network.** There is no queue before R1-12. Offline, Mark paid is refused with a clear message and nothing the tutor typed is lost.
13. **An archived student's dues cannot be marked paid** (they are not on the board anyway). Restore first.
14. **No analytics event fires** in this slice. `payment_marked` is wired in R1-14.

## 4. Acceptance criteria

PRD criteria, word for word: "One tap "Mark paid": amount (prefilled, partial allowed), method (UPI/cash), date; creates `payments` row + receipt" and "Auto-created on payment; sequential number per tutor; public link `/r/{receipt_token}` + PDF". Public pages: "never query tables directly; they call Edge Functions that look up by unguessable token (≥22 random URL-safe chars) and return only what that page needs." Everything below adds to those.

### Part A: recording, numbering, undo, in-app receipt

1. [db] `payments` exists with `tutor_id`, `due_id`, `amount` (integer paise, above 0), `method` in (`upi`, `cash`; the PRD's `gateway` is not allowed until R2), `paid_on` (date), `receipt_no` (integer), `receipt_token`, `created_at`, a void marker with its time, and the balance left on that fee after this payment. `unique(tutor_id, receipt_no)`.
2. [db] RLS: tutor B reads zero of tutor A's payments and cannot write any. Clients have select only; there is no insert, update or delete grant on `payments` and none to `anon`. A pgTAP file proves this with two tutors and an anonymous session.
3. [db] `record_payment(due, amount, method, paid_on, request id)` is the only way a payment is created. In one transaction it checks the due belongs to the caller, locks the tutor's counter, takes the next `receipt_no`, inserts the payment, and sets the due's `amount_paid` and `status` (`partial` or `paid`). Anonymous callers and signed-in callers naming another tutor's due get an error and change nothing.
4. [db] Refused with no change: amount 0, negative, above what is left, not an integer; method other than `upi` or `cash`; `paid_on` in the future (India day) or more than 90 days back; due of an archived student; due already paid.
5. [db] Numbering: 50 payments recorded for one tutor are numbered 1 to 50 with no gap and no repeat, including two calls running at the same moment. A refused call does not use up a number. Two tutors both get a number 1.
6. [db] Retry safety: calling `record_payment` twice with the same request id creates one payment and returns the same receipt both times. A double tap, a lost response and a retry never double-charge a due.
7. [db] Paise are exact: a fee of ₹10,00,000 paid in three parts of 3,33,333 / 3,33,333 / 3,33,334 rupees ends `paid` with `amount_paid` equal to `amount`, never a float. The existing `dues` checks (status agrees with amount paid) still hold.
8. [db] `void_payment(payment)` works only for the owner, only within 24 hours of creation, only once. It marks the payment voided with the time, lowers the due's `amount_paid` and sets `status` back to `due` or `partial`, in one transaction. The receipt number stays used. After 24 hours, on another tutor's payment, or on an already voided one: error, no change.
9. [db] Audit: nothing the client can call deletes a payment. Each record and each void leaves a timestamp on the row. Deleting a tutor's account removes their payments with it (the only delete).
10. [db] `record_payment` and `void_payment` are executable by signed-in users only (not `anon`); the helper functions stay unexposed. `supabase/tests/030_default_privileges.sql` still passes.
11. [db] After a payment on an opening-balance due, changing the student's "Already owes" does not change that due (the R1-5 trigger already freezes it). A later change to `monthly_fee` does not change an existing due.
12. [e2e] "Mark paid" appears on Overdue and Due rows only, as its own 44px target next to the row link, not inside it. Paid rows have none. Tapping it opens the sheet drawn in `Pay-sheet`: student and month in the header, "Amount received" prefilled with the remaining amount, chips, "Paid by" UPI or Cash, "Paid on", "Mark as paid", "Cancel".
13. [e2e] Amount field: numeric keypad, accepts digits and Indian commas, shows `₹` and 0-9 digits whatever the language. Letters, a decimal point, `0`, empty and an amount above the remaining are refused with a message beside the field (never a toast alone) and the button does nothing. "Full" sets the remaining; "Half" sets half; typing changes the chip to "Other". A part payment keeps the fee on the board as "Part paid" with the new remaining amount.
14. [e2e] Recording: the button shows "Saving…" and ignores a second tap. On success the sheet closes, the board row moves tab (Part paid stays in Due or Overdue; fully paid moves to Paid), the totals change, and the undo banner appears with "Undo" and "Send receipt", for 10 seconds. The mark paid result is shown only after the database has confirmed it; there is no optimistic "paid".
15. [e2e] Undo from the banner restores the row, the totals and the tab, with no page reload, and the banner says it was undone. Undo on a payment more than 24 hours old is not offered (criterion 18).
16. [e2e] Failure: if the request fails, the sheet stays open with the typed values and "Couldn't save. Nothing was recorded. Try again." If the response is lost after the database saved, "Try again" reuses the same request id and the board shows one payment, not two (criterion 6).
17. [e2e] Offline: with the network down the button is still tappable, and tapping it shows "You are offline. Payments need a connection for now. Nothing was saved." Values stay. No request is sent. Back online, "Try again" works. (The outbox is R1-12.)
18. [e2e] In-app receipt screen (`Receipt` canvas): receipt number, fee month, amount `₹1,200/-`, method, date, "Balance" (Nil or the remaining amount), tutor name, student name, parent name when present, PAID or PART PAID stamp, "Recorded {date} {time}" (India time). Reached from the banner "Send receipt" and from the "Receipt" button on Paid and Part paid rows. A fee with two payments lists both, newest first. "Undo this payment" appears within 24 hours and asks once to confirm; it is hidden after, with no explanation clutter.
19. [e2e] A voided payment's screen shows the stamp CANCELLED and the number; amount is struck through; it is not counted in totals.
20. [e2e] The "Already owes" field on the student edit screen is read-only with the line "A payment has been recorded against this, so it can't be changed" once the opening due has any payment (this is what R1-6 deferred to this slice).
21. [e2e] Two phones: phone 2 records a payment; phone 1, with a stale board, tries to record more than is now left. Phone 1 sees "Only {amount} is left on this fee" and the board refreshes; nothing is recorded.
22. [e2e] Layout at 360px and the largest system font, in en, hi, kn and te, with an 80-character student name and a 60-character batch name: no sideways scroll, every control at least 44px, no text under 14px, nothing cut with an ellipsis, the sheet is scrollable with the "Mark as paid" button reachable, the keypad does not hide the button. Status is word plus mark in grayscale (the stamp says the word).

### Part B: the public receipt page

23. [fn] Edge Function `receipt` takes a token, looks it up with the service role, and returns only: receipt number, tutor display name and subjects, student name, parent name (if any), fee month label data (month, or "earlier balance"), amount, method, paid-on date, balance after this payment, status (paid, part paid, cancelled), page language, and the tutor's referral code. It returns no phone number, email, UPI id, `tutor_id`, student id, due id, payment id, other receipts, other students, or dues. A test compares the response keys to this list exactly.
24. [fn] Token handling: lookup is by exact token only. A token that is malformed, too short, unknown or empty gets the same 404 body and similar timing, never a hint that it was "almost right". Tokens are 22 or more URL-safe random characters from the database. Method other than GET/POST, or a huge URL, is rejected.
25. [fn] Rate limit: a caller (hashed IP, as the waitlist function does) over 60 requests in an hour gets 429 and a "Try again later" body; a single token over 120 requests in an hour does too. The IP is never stored in plain form.
26. [fn] A cancelled receipt returns the number, tutor name, student name and status `cancelled`, and no amount, method or balance.
27. [fn] Responses carry `Cache-Control: no-store`, are not indexable, and the page sends no referrer (so the token does not leak in a link out). The function logs no token, name or amount.
28. [e2e] `/r/{token}` renders from the static shell (a Vercel rewrite sends `/r/*` to it) with the receipt as drawn: tutor name, receipt number, date, "Received with thanks from {parent} … towards the tuition fee of {student} for {month}", amount, Balance, stamp, a "Download PDF" button (hidden until Part C), and the footer "Free for tutors" with the tutor's join link. No login, no cookie, no tracking, no analytics. The page sets `noindex`.
29. [e2e] Page states: loading ("Opening your receipt…", never a bare spinner), not found ("This receipt link doesn't work. Ask your tutor to send it again."), rate-limited, network failure with "Try again", and cancelled ("This receipt was cancelled by your tutor."). None shows tutor data it was not given.
30. [e2e] The parent opening an old link after the tutor has since added more payments or archived the student sees the same receipt as the day it was made (amounts and balance are fixed at record time). After account deletion: the not-found state.
31. [e2e] Page at 360px and largest font in en, hi, kn and te: no sideways scroll, amount never cut, footer link 44px, nothing under 14px. The language is the student's parent language, not the address. No `TODO-translate` text is ever shown to a parent: an untranslated key falls back to English (and the founder reviews hi, kn, te before release; question 5).

### Part C: PDF and sharing

32. [unit] The receipt PDF is built by the same module R0-3 ships (`@cantoo/pdf-lib`, `@cantoo/fontkit`, subset Noto fonts), not a copy. It is loaded only when the tutor or parent taps Download or Share, and never in the first JS of any route (`pnpm size`: every route at most 200 KB gzipped; the PDF chunk is separate).
33. [unit] PDF content equals the screen: number, amount, method, date, month, balance, tutor, student, parent, status, footer. Amount is integer paise formatted with Indian grouping and 0-9 digits in every language. A fixture set runs through it: Latin, Hindi, Kannada, Telugu names; a 120-character name (wraps, never runs off the page); a name containing an emoji or a character the font cannot draw (follows R0-3's spike rule: the receipt is still made, nothing crashes, nothing prints as a blank box). A cancelled receipt makes no PDF.
34. [e2e] "Download PDF" on the in-app receipt and on `/r/{token}` saves `receipt-{number}.pdf`. It works offline once the page is open (the PDF is built on the phone from data already on screen). A generation failure shows "Couldn't make the PDF. Try again." and leaves the page intact.
35. [e2e] "Share" tries, in order: the phone's share sheet with the PDF file (when the browser can share files); otherwise the WhatsApp click-to-chat link to the parent's number with a short message and the `/r/` link; otherwise (no parent number) it copies the link and says so. The message is in the parent's language, carries the amount and receipt number, and contains no other personal data. If the share sheet is dismissed nothing is recorded as sent. A parent phone number is never shown on the receipt page.
36. [manual] The PDF opens in a normal viewer on a low-end Android and on a laptop, Hindi, Kannada and Telugu text is shaped correctly (joined letters, not boxes), and it prints on one A4 or A5 page.

### Across all parts

37. [unit] Every new string is in `messages/{en,hi,kn,te}.json` (namespaces `pay` and `receipt`; the receipt keys are also used by the Edge Function's page), `pnpm i18n:check` passes, no English in components, the product name only from `brand.ts`. A grep test finds no `parseFloat`, `toFixed`, `Math.round`, `Intl.` or local-time `Date` getters in payment code. Money is only integer paise until `formatRupees`.
38. [e2e] Privacy on the tutor side: the recording requests carry only the due id, amount, method, date and request id. No client write goes to `payments` or `dues` (only the two function calls). Only the page's own host and the Supabase host are contacted. No cookie, no analytics event.

## 5. Edge cases

- **Empty:** a fee with no payments has no Receipt button. A tutor with no payments sees nothing new except Mark paid on rows.
- **Offline or slow network:** criteria 16 and 17. Slow: "Saving…" stays; a second tap is ignored; after 20 seconds the sheet says it is still trying and keeps the request id.
- **Very long names:** wrap on the sheet, the receipt screen, the public page and the PDF (criteria 22, 31, 33).
- **Large font:** criteria 22 and 31.
- **Second language:** tutor in Telugu, parent in Hindi: the tutor's screens are Telugu, the receipt page and PDF and WhatsApp message are Hindi. Digits and `₹` are always 0-9.
- **Partial payment:** three parts to one fee give three receipts (numbers 12, 13, 14), each with its own balance after; the fee is `paid` after the third. Undoing the second reopens the fee to `partial`; the balance printed on receipt 13 does not change (it was true when made), and receipt 13 shows cancelled.
- **Over-payment:** refused (default 5). The parent paid ₹1,500 on a ₹1,200 fee: tutor records ₹1,200; the extra ₹300 is not tracked.
- **Duplicates:** same amount twice in a row on purpose is allowed (two parts); the request id, not the amount, decides what is a duplicate.
- **Backdated payment:** receipt number follows the order of recording, not the paid date, so a receipt dated 3 Oct can carry a higher number than one dated 8 Oct. Accepted.
- **Parent opening an old link:** criteria 29, 30.
- **Link forwarded to someone else:** anyone with the link sees that one receipt (name, amount). Accepted; the link is unguessable and shows no phone number.
- **Guessing tokens:** criteria 24, 25.
- **Clock wrong on the phone:** paid-on "Today" is the India day from the phone clock, but the database checks the date is not after the India day on the server; a wrong phone clock gives a clear error, not a bad record.
- **Undo after the student was archived:** allowed; the fee returns to the books.
- **Tutor's name changed after a receipt:** the public page and a later PDF show the tutor's current name (name is not frozen). Accepted. (Question 6.)
- **Tutor with no UPI id or no subjects:** receipt omits the subjects line; nothing else changes.

## 6. Out of scope

| Not here | Where |
| --- | --- |
| One-tap reminder, Remind all, Remind button on rows | R1-8 |
| Parent pay page `/p/{token}`, parent consent, UPI deep link, past receipts list for the parent | R1-9 |
| "I've paid" claims, Confirm creating a payment, notifications | R1-10 |
| Queueing a payment offline, sync states, idempotent replay from an outbox | R1-12 (the request id here is what it will reuse) |
| Export of payments, delete account details | R1-13 |
| Analytics `payment_marked` | R1-14 |
| Bank transfer method, cheque | not in the PRD (question 1) |
| Credit or carry-forward for over-payment, refunds, editing an old payment, waiving a due | later slice |
| Receipt in amount-in-words, tutor logo on the receipt | not now (Pro: logo, PRD R2) |
| Gateway payments (`method = gateway`) | R2 |
| A real Student detail screen with payment history | unowned |
| Revoking a receipt link without undoing the payment | question 3 |
| Sending a receipt automatically | R2 (WhatsApp API) |

## 7. Design references

From `design/project/` (see `canvas.json`):

- `Pay-sheet.dc.html` ("Record payment"): criteria 12 to 14, 22. Not built from it: the green "Mark as paid" fill (DESIGN.md: black is for recording; green is not a button colour, so the button is black with the offset shadow; flag for design if the founder prefers green), "Paid by" has only UPI and Cash.
- `State-undo.dc.html`: criteria 14, 15 (banner with Undo and Send receipt, green "PAID TODAY · UPI · NO. 215" row).
- `Receipt.dc.html`: criteria 18, 28, 33 (receipt card, stamp, Download PDF, Share, footer). Not built from it: amount in words (default 11), the "Share" label stays.
- `Student.dc.html`: only for the "Mark paid" button's look; the screen itself is not built.
- `Home.dc.html`, `State-allpaid.dc.html`: where the board changes.
- `Nav.dc.html`, `Main.dc.html`, `Interaction.dc.html`, `Type-indic.dc.html`: nav, tags, press and focus, Indic type.
- `Tool-receipt.dc.html`: the free tool's layout, for the shared PDF module.

## 8. Analytics

None fire in this slice. `payment_marked` (PRD section 4) is wired in R1-14 and will fire when `record_payment` succeeds. No event may carry a name, phone, amount or token. No analytics script loads on `/r/{token}`.

## 9. Copy (four languages)

Namespaces `pay` (tutor screens) and `receipt` (public page, PDF, WhatsApp message). Add every key to all four files together. English below; Hindi, Kannada and Telugu are `TODO-translate: <English>` until reviewed, except that the `receipt` namespace must be reviewed before release (question 5). Keys the sheet needs: title "Mark paid", "Amount received", "Full {amount}", "Half {amount}", "Other", "Paid by", "UPI", "Cash", "Paid on", "Today", "Yesterday", "Pick date", "Mark as paid", "Cancel", "Saving…", "Receipt no. {n} is made for you. Send it on WhatsApp next.", "{name} marked paid, {amount}", "Undo", "Send receipt", "Payment undone", "Undo this payment", "Undo this payment? The receipt will be cancelled.", errors ("Enter an amount of ₹1 or more", "Only {amount} is left on this fee", "Pick a date that is not in the future", "Couldn't save. Nothing was recorded. Try again.", "You are offline. Payments need a connection for now. Nothing was saved."), "Receipt", "Mark paid" row button, "Part paid", "Balance", "Nil", "PAID", "PART PAID", "CANCELLED", "Recorded {date} {time}", "A payment has been recorded against this, so it can't be changed". Public page: "Fee receipt", "Receipt no.", "Date", the "Received with thanks from … towards the tuition fee of … for …" sentence as one message with named parts, "Download PDF", "Share", the footer line, the four states in criterion 29, "This receipt was cancelled by your tutor.", "Couldn't make the PDF. Try again.", and the WhatsApp message.

## 10. Privacy

The parent sees one receipt: tutor name, student name, parent name, amount, date, balance. Never a phone number, email, UPI id, other students or other receipts. The tutor's data is read only through the `receipt` function by token; tables are never exposed to anonymous callers. No cookies, no analytics, no third-party scripts on the receipt page. The parent's phone number is used only on the tutor's own phone to open WhatsApp and is never sent to the receipt function. Tokens are random and not derived from ids, are not logged, and the page sends no referrer. Data is deleted with the account. A child's name appears on the receipt because the parent needs it; nothing else about the child (no attendance, no other fee) does.

## 11. Test by hand on a phone

Staging-backed build, signed in with Google, 360px, then the largest system font. Needs two students with a phone number, one with "Already owes", and a second phone or browser for the parent link. The parent-side steps need Part B; PDF steps need Part C.

1. Board: an Overdue row shows "Mark paid" as its own button; tapping the name still opens the student. Paid rows have no Mark paid.
2. Tap Mark paid. Amount shows the full balance. Tap Half; amount halves. Tap "Full".
3. Choose Cash, Today, "Mark as paid". The sheet closes, the row moves to Paid, the total drops, the banner shows Undo and Send receipt. Wait 10 seconds: banner gone.
4. Open the Paid row's Receipt: number is 1 (or next), amount, method, date, PAID stamp.
5. Mark another fee part paid (₹500 of ₹1,200, UPI, Yesterday): row stays, says Part paid, remaining ₹700. Its receipt says PART PAID, Balance ₹700, number 2.
6. Try ₹0, an amount above the balance, a future date: each refused with a message.
7. Mark the rest paid: receipt number 3, Balance Nil. The fee is now Paid.
8. Undo receipt 3 from its receipt screen: the fee goes back to Part paid; receipt 3 says CANCELLED. Record again: the new receipt is number 4, not 3.
9. Airplane mode, try Mark paid: "You are offline…" and nothing saved; values still there. Turn the network back on, Try again.
10. Double tap Mark as paid quickly: one payment only.
11. Edit the student whose opening balance was paid: "Already owes" is locked with the line.
12. Tap Send receipt on a student with a parent number: the phone's share sheet or WhatsApp opens with the receipt (Part C; before it, the link in the message).
13. On the second phone, open the `/r/` link with no sign-in: the receipt reads correctly, no phone number anywhere, no login prompt. Open a link with one character changed: "This receipt link doesn't work." Open the cancelled receipt's link: cancelled message, no amount.
14. Set the student's parent language to Hindi: the receipt page is Hindi, digits and `₹` stay 0-9. Switch the tutor app to Kannada and Telugu: nothing cut, targets thumb-sized.
15. Download PDF on the phone: opens, Hindi/Kannada/Telugu text joined correctly, one page. Try a student named with an emoji.
16. Staging table editor: `payments.amount` is in paise; `receipt_token` is 22 or more characters; `dues.amount_paid` matches the sum of non-voided payments; no row for another tutor visible from the app.

## 12. Open questions (with defaults; nothing blocks)

1. **Bank transfer as a method?** You mentioned it; the PRD says UPI/cash only and the canvas matches. Default: UPI and Cash only. Adding bank is a one-line change to the allowed list in the database and one segmented button, plus a four-language word, if you want it.
2. **Undo window.** Default: 10-second banner plus 24 hours from the receipt screen, then locked. Wrong amount after 24 hours: undo is not possible; a "correct a payment" action would be a later slice. Is 24 hours right, or should it be 7 days?
3. **Can the tutor kill a receipt link without undoing the payment?** Default: no. Links never expire. A tutor who sent a link to the wrong person must undo and re-record. Say if you want "Stop sharing this receipt" and an expiry (for example 1 year).
4. **Amount in words.** Default: not shown (figures only). The canvas has English words. Add in English only, or all four languages (needs a reviewer for hi, kn, te)?
5. **Who reviews the Hindi, Kannada and Telugu text for the parent receipt?** Parents see this page, so `TODO-translate` cannot ship in the `receipt` namespace. Default: English fallback on the parent page until a reviewer fills them; release gate for Part B is Hindi at least.
6. **Tutor name on old receipts.** Default: current name. Freeze the name at the time of the payment instead?
7. **Mark paid button colour.** The canvas has green; DESIGN.md says black is for recording and green is not a button. Default: black. Designer to confirm.
8. **Referral link on the receipt footer.** The canvas shows `feedost.in/join/MEENA24`. Default: show the tutor's `/join/{code}` on the current `*.vercel.app` host (no `feedost.in` yet). If `tutors.referral_code` is not in the database yet (R1-13 owns the join page), the footer shows the plain "Free for tutors" line with no link.
9. **Part ordering.** Default: ship A, then B, then C after R0-3. If R0-3 is delayed, C slips; A and B do not wait.

## 13. Hand-off

To `tech-lead`: append the technical plan to this file, planning Parts A, B and C as three pull requests. It needs a migration (`payments`, per-tutor counter, `record_payment`, `void_payment`, tests), the `receipt` Edge Function with its rate-limit table, the Vercel `/r/*` rewrite, and the board row change. Confirm with the lead that R0-3 lands before Part C; its module and spike rules are not in the repo yet. Flag any new dependency before adding it.

---

## Technical plan, R1-7

Written by `tech-lead` on 2026-10-12, for three pull requests (A, B, C) off `main` at `cde3045`. Nothing here changes product scope. Checked against: `docs/specs/R1-5-dues.md`, `R1-6-dues-board.md`, `supabase/migrations/20261012100000_r1_dues.sql` and `20261012110000_r0_waitlist.sql`, `supabase/functions/waitlist-join/`, and (via `git show origin/r0-3b-receipt-maker:...`) `docs/specs/R0-3-receipt-maker.md` and `src/lib/receipt/`.

### 0. Assumed unless the founder says otherwise

The 14 defaults in section 3 of this spec, plus these, which this plan adds:

1. **The spec's header note about R0-3 is out of date.** `docs/specs/R0-3-receipt-maker.md` exists on branch `r0-3b-receipt-maker` (PR #12, draft). Its spike result and the PDF code exist there: `src/lib/receipt/make-pdf.ts` (the only importer of `@cantoo/pdf-lib` 2.11.1 and `@cantoo/fontkit` 2.0.12, both loaded with `await import()`, fonts under `/pdf-fonts/`), `share.ts` (share sheet, then download plus `wa.me`), `receipt.ts` (`dropUnprintable`, `scriptsNeeded`, `isAllUnprintable`). Part C reuses these and must not copy them. Both packages are already approved by the founder (BUILD_PLAN, 2026-10-11) but are provisional until R0-3's native-reader check passes.
2. **The free tool offers UPI, Cash and Bank. The app offers UPI and Cash only** (default 1). The shared PDF module's `Mode` type includes `bank`; the app never passes it. Do not widen the database check to match it.
3. **The receipt Edge Function returns no `referral_code`.** `tutors` has no such column (checked), and R1-13 owns it. This changes criterion 23's list: the footer is the plain "Free for tutors" line with no link (default 8). Add the field to the function when the column exists.
4. **The `receipt` function accepts POST only** (plus OPTIONS for CORS), not GET. The token travels in the JSON body, never the URL, so it is not in any access log. Criterion 24's "GET/POST" becomes POST.
5. **No outbox exists** (`src/lib/outbox.ts` is not in the repo; R1-12 builds it). The `src/CLAUDE.md` rule "writes go through the outbox" cannot be met yet. Part A adds one small file, `src/lib/payments.ts`, which is the only place that calls `record_payment` and `void_payment` (`client.rpc`, never `.from("payments")`). The request id it generates is what R1-12 will reuse.
6. **The receipt page's words are plain text in the `receipt` message namespace**, filled with a small replace function, not through the next-intl message parser (the language is only known at run time, after the function answers; see 3.4).
7. **The in-app receipt screen is a new route `receipt/` in the `(book)` group**, addressed as `/{locale}/receipt/?p={payment id}` (a static export cannot have a dynamic path; the id is the tutor's own and is read through RLS, so it is not a secret).
8. **No new dependency.** The public page uses plain `fetch` to the function, not `@supabase/supabase-js` (saves its chunk on a page a parent opens on slow data).

### 1. Approach

All money logic lives in two database functions, `record_payment` and `void_payment`, written once in a migration and tested in pgTAP; the client calls them through one thin file and never writes `payments` or `dues`. Numbering is gap-free because the function takes a row lock on a per-tutor counter row first, does every check under that lock, and increments the counter in the same transaction as the insert, so a refused call or a rolled-back call leaves no hole; the client-supplied `request_id` makes a retry return the same receipt. The parent page is one static shell behind a Vercel rewrite that calls a `receipt` Edge Function, which calls one service-role-only SQL function that builds exactly the allowed fields; the PDF in Part C is the R0-3 module loaded on tap.

### 2. Data

**Migration A: `supabase/migrations/20261012130000_r1_payments.sql`** (stamp must be later than the newest on `main`, which is `20261012110000_r0_waitlist.sql`; `pnpm check:db --base origin/main` fails otherwise. If another migration lands first, re-stamp with `pnpm exec supabase migration new`, do not edit by hand).

- `dues`: add `unique (tutor_id, id)` (additive, so `payments` can have a composite foreign key that forces the due to belong to the same tutor, the same pattern as `dues_student_fkey`). No other change to `dues`; its checks already keep `status` and `amount_paid` in agreement.
- `receipt_counters`: `tutor_id uuid primary key references tutors(id) on delete cascade`, `last_no integer not null default 0 check (last_no >= 0)`. RLS on; **no policy and no grant** to `anon` or `authenticated` (like `waitlist`); only the definer functions touch it. Spec criterion for "every table has `tutor_id` and RLS" is met by the key being `tutor_id`.
- `payments`:
  - `id uuid pk default gen_random_uuid()`, `tutor_id uuid not null references tutors(id) on delete cascade` (no default: no client inserts), `due_id uuid not null`.
  - `amount integer not null check (amount > 0 and amount <= 100000000)` (paise), `method text not null check (method in ('upi','cash'))`, `paid_on date not null`.
  - `receipt_no integer not null check (receipt_no > 0)`, `unique (tutor_id, receipt_no)`.
  - `receipt_token text not null unique` with the exact default used for `students.pay_token` (`translate(encode(extensions.gen_random_bytes(18),'base64'),'+/','-_')`, 24 chars) plus `check (receipt_token ~ '^[A-Za-z0-9_-]{22,}$')`.
  - `request_id uuid not null`, `unique (tutor_id, request_id)` (idempotency).
  - `balance_after integer not null check (balance_after >= 0)` (what was left on that fee right after this payment; fixed forever, criterion 30).
  - `created_at timestamptz not null default now()`, `voided_at timestamptz` (null = live).
  - `constraint payments_due_fkey foreign key (tutor_id, due_id) references dues (tutor_id, id) on delete no action deferrable initially deferred` (same reasoning as `dues_student_fkey`: account deletion cascades through both tables).
  - Indexes: `(tutor_id, due_id)`; the unique keys cover the rest.
  - A `before update` trigger `payments_immutable`: only `voided_at` may change, and only from null to non-null; anything else raises. A bug in a future function cannot rewrite money history. A `before delete` is not needed: no client grant, and the tutor-delete cascade is the only delete.
- RLS: one policy `payments_select ... for select to authenticated using (tutor_id = (select auth.uid()))`. `revoke all on public.payments from anon, authenticated; grant select on public.payments to authenticated;`. This is the same departure from "four policies" that `dues` and `tutors` already document: say so in the migration header.
- `record_payment(p_due uuid, p_amount integer, p_method text, p_paid_on date, p_request_id uuid) returns public.payments`, `security definer`, `set search_path = ''`. Order, all in one transaction:
  1. `auth.uid()` null: raise `42501`.
  2. Cheap argument checks first (amount > 0, integer by type, method in list, request id not null): raise `invalid_argument`.
  3. `insert into receipt_counters (tutor_id) values (uid) on conflict do nothing; select last_no ... for update` (the per-tutor lock; every later step is serialised per tutor, so two same-moment calls queue and cannot both take a number, and two calls with the same request id cannot both insert).
  4. Look up `(tutor_id = uid, request_id)`; if found, return it unchanged (a retry after the fee became paid still returns the receipt). If found but for a different due or amount, raise `request_reused`.
  5. Lock the due `for update` where `id = p_due and tutor_id = uid` joined to its student; not found (or another tutor's): raise `due_not_found` (same answer for both, so ids cannot be probed). Student not active: `student_archived`. Status paid: `already_paid`. Amount above `amount - amount_paid`: `amount_over_remaining` with the remaining paise in the exception `detail` (the client shows "Only {amount} is left"). `paid_on` after `india_day(now())` or before `india_day(now()) - 90`: `date_out_of_range`.
  6. Insert the payment with `receipt_no = last_no + 1` and `balance_after = amount - amount_paid - p_amount`; update the due (`amount_paid`, `status`); update the counter. Return the payment row.
  - Error shape: `raise exception '<code>' using errcode = 'P0001'` with the machine word as the message and `detail` only for `amount_over_remaining`. The client maps words to copy; it never shows the database message.
- `void_payment(p_payment uuid) returns public.payments`, `security definer`: `auth.uid()` required; find the payment (not found or not the caller's: `payment_not_found`); lock its due `for update`, then re-read the payment `for update`; `already_voided`; `now() - created_at > interval '24 hours'`: `undo_window_over`; set `voided_at = now()`; due `amount_paid = amount_paid - amount`, `status` recomputed (`due` if 0 else `partial`). The counter is untouched, so the number stays used. Lock order is counter then due (record) and due then payment (void), so they cannot deadlock.
- Privileges, in the same migration: `revoke execute ... from public, anon, authenticated` on both functions, then `grant execute ... to authenticated`. Update `supabase/tests/080_grants_after_migration.sql` if it enumerates functions (check it).
- Nothing in `students` changes. The R1-5 trigger already freezes an opening due once `amount_paid > 0`; the "Already owes" lock (criterion 20) is screen-only and reads the due.

**Migration B: `supabase/migrations/20261012160000_r1_receipt_public.sql`** (re-stamp to be later than A and than `main` at the time).

- `receipt_hits (key_hash text, hour_bucket timestamptz, n integer check (n >= 0), primary key (key_hash, hour_bucket))`, RLS on, `revoke all` from `public, anon, authenticated`. One row per hashed IP or hashed token per hour. A table of its own (not `waitlist_hits`), so one feature's limit cannot be read off the other's rows. No `tutor_id`: the rows belong to no tutor; say so in the header like `waitlist_hits`.
- `receipt_hit(p_hash text, p_limit integer) returns boolean`: the same body as `waitlist_hit` (purge older than 24 h, atomic upsert-increment, `n <= limit`), `security invoker`, `revoke all ... from public, anon, authenticated` (only the service role, which the Edge Function uses, can call it).
- `get_receipt(p_token text) returns jsonb`, `security definer`, `set search_path = ''`, `revoke all` from `public, anon, authenticated` and **granted to `service_role` only**. It selects by `receipt_token = p_token` exactly and builds the object itself, with these keys and no others: `receipt_no`, `status` (`paid` when `balance_after = 0`, else `part_paid`, or `cancelled`), `tutor_name`, `tutor_subjects`, `student_name`, `parent_name`, `month` (first of month or null for "earlier balance"), `amount`, `method`, `paid_on`, `balance_after`, `language` (student's `parent_language`, else tutor's `language`, else `en`). When voided it returns only `receipt_no`, `status`, `tutor_name`, `student_name`, `language` (criterion 26). Not selected anywhere: phones, email, UPI id, any id, `tutor_id`, other payments, `created_at`. Building the object in SQL puts the exposure rule in one place a pgTAP test can check by key list; the Edge Function additionally copies through an allow-list of the same keys.
- `config.toml`: add `[functions.receipt] verify_jwt = false`.

### 3. Files

#### 3.1 Part A (database, sheet, undo, in-app receipt)

Backend (`backend-dev`):
- `supabase/migrations/20261012130000_r1_payments.sql`: as above.
- `supabase/tests/150_payments_rls.sql`: tutor A and B, and an anonymous session (see section 6).
- `supabase/tests/160_record_payment.sql`, `170_void_payment.sql`, `180_receipt_numbering.sql`: see section 6.
- `supabase/tests/080_grants_after_migration.sql`: add the two functions and the counter table if the file lists them.
- `supabase/tests/concurrency/` (or the cheapest equivalent CI can run): see risk 2.

Frontend (`frontend-dev`):
- `src/lib/payments.ts` and `payments.test.ts`: `recordPayment({dueId, amount, method, paidOn, requestId})`, `voidPayment(id)`, `readPayments(dueIds)` and `readPayment(id)` (select named columns, never `*`, never `tutor_id`), `PaymentError` with a `code` from the word list above and `remaining` for `amount_over_remaining`; a row with an unknown method or a non-integer amount throws. The only file that calls `.rpc("record_payment")`, `.rpc("void_payment")` or reads `payments`. Reuse the client from `src/lib/supabase.ts` (dynamic import, as `dues.ts` does).
- `src/lib/payments-view.ts` and test: pure. `todayIndia` already exists in `dues-board.ts` (reuse, do not add a second clock), the date choices (Today, Yesterday, picked; 90-day floor), the chip amounts (`full`, `half` rounded down to whole rupees, hidden if 0), `validateAmount(text, remaining)` built on `parseRupees` from `src/lib/rupees.ts` (min 100, max remaining), and `undoOpen(createdAt, now)` (24 hours). No `Date` local getters, no `Intl`, no `parseFloat`/`toFixed`/`Math.round` (criterion 37 grep test: extend the existing one in `dues-board.test.ts` to cover these files).
- `src/components/pay/pay-sheet.tsx` and test: the Mark paid sheet on `ui/Sheet`, `Field` for the amount, `Segmented` for UPI/Cash and for the date. Holds one `requestId` per open sheet and reuses it on "Try again" (criterion 16). **Loaded with `next/dynamic` only when Mark paid is tapped** (risk 1). "Saving…" busy state, second tap ignored, the 20-second "still trying" line, the offline check (`navigator.onLine` false: refuse with the offline message, send nothing), the stale-balance message (`amount_over_remaining`) which also asks the board to refresh.
- `src/components/pay/undo-banner.tsx`: the 10-second banner on `ui/Banner`, with Undo and Send receipt. Lives in the `BoardProvider` area so it survives a tab change (a one-slot state: the last payment and a timer).
- `src/components/pay/receipt-screen.tsx`, `receipt-card.tsx` and tests: the in-app screen: card with `ui/Stamp` (PAID, PART PAID, CANCELLED), the list of a fee's payments newest first, "Undo this payment" with one confirm, hidden after 24 hours. The card is reused by the parent page in Part B only if it stays pure and small; otherwise the parent page has its own markup (decide in task 13, do not force it).
- `src/app/[locale]/(app)/(book)/receipt/page.tsx`: the route, with `ClientMessages` listing `pay`, `receipt` and what `StatusTag`/`Stamp` need.
- `src/components/board/due-row.tsx`: the row stays one `<li>`; the existing link stays; add a sibling 44px button (Mark paid on Overdue and Due and part paid, "Receipt" on Paid and part paid). The `<a>` must not contain the button. Update the file's header comment (it says nothing inside is a control).
- `src/components/board/board-state.tsx` and `board-store.ts`: add `applyPayment(row)` and `applyVoid(row)`, which patch the cached due from the returned payment (`amount_paid = amount - balance_after`, status from that) and then mark the month slice stale so the next read confirms it. No optimistic state before the database answers.
- `src/lib/dues.ts`: add `readOpeningPaid(studentId)` or reuse the cached board slice; the student edit screen (`src/components/students/student-form.tsx` and its `students/edit` page) makes "Already owes" read-only with the new line when the student's opening due has `amount_paid > 0`. `students/edit` is already at 161 KB: this must add almost nothing (a boolean prop and one message).
- `scripts/size.mjs`: add `receipt` to `APP_ROUTES`.
- `e2e/pay-helpers.ts` (`stubPayments`: `record_payment` and `void_payment` answers, delay, fail, lost response, `onLine` toggle, request log), `e2e/pay.spec.ts`, `e2e/pay-layout.spec.ts`; extend `e2e/auth-helpers.ts` `stubSupabase` to answer `GET /rest/v1/payments` with `[]` and the two RPCs, so existing specs pass.
- `src/components/students/student-list-screen.test.tsx`: the existing "no component calls `.from(`/`.rpc(`" test must still pass; `payments.ts` is the only allowed caller.
- `messages/{en,hi,kn,te}.json`: namespace `pay` (all tutor words in section 9) and the in-app receipt words under `receipt`. Change all four together; `pnpm i18n:check` is the gate.
- `docs/BUILD_PLAN.md`: tick nothing; no dependency change.

#### 3.2 Part B (function, rewrite, public page)

Backend (`backend-dev`):
- `supabase/migrations/20261012160000_r1_receipt_public.sql`.
- `supabase/functions/receipt/handler.ts`, `index.ts`, `handler.test.ts`: same split as `waitlist-join` (`handle(req, deps)` pure and tested in Node with fakes, `index.ts` is Deno wiring). Deps: `hashIp`, `hashToken`, `hitIp`, `hitToken`, `getReceipt`, `now`, `log`.
- `supabase/config.toml`: `[functions.receipt] verify_jwt = false`.
- `supabase/tests/190_receipt_public.sql`: pgTAP for `get_receipt` and `receipt_hit`.
- Function secret `RECEIPT_HASH_SALT` (HMAC key; a different secret from `WAITLIST_HASH_SALT` so one leak does not cover both), and a local dummy in `config.toml`'s `[edge_runtime.secrets]` like the waitlist one. Allowed origins reuse the waitlist's host list approach (`RECEIPT_ALLOWED_HOSTS`, default the same pattern); add the same unit tests.
- Update `supabase/CLAUDE.md`'s secrets sentence to name `RECEIPT_HASH_SALT` (documentation only).

Frontend (`frontend-dev`):
- `src/app/r/layout.tsx` (its own root layout like `(jump)`: `<html lang="en">`, the shared `HtmlShell`; metadata `robots: noindex`, `referrer: no-referrer`) and `src/app/r/page.tsx`: the one static shell (exports `out/r/index.html`). No `generateStaticParams`. Update `src/CLAUDE.md`'s layout list only if the "three root layouts" sentence needs it (it says there are three; it becomes four; fix the sentence).
- `src/components/receipt/public-receipt.tsx` and test: reads the token from `window.location.pathname` (`/r/{token}`), validates its shape locally (22 or more URL-safe characters; otherwise go straight to "not found" with no request), `fetch`es `${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/receipt` with POST, `cache: "no-store"`, `referrerPolicy: "no-referrer"`, `credentials: "omit"`. States: loading, ok, cancelled, not found, rate limited, network failure. Picks `words[language]` from the response. No analytics, no cookie, no storage.
- `src/lib/receipt-words.ts` (`fill(template, values)` replace function and the typed words per language). The `receipt` namespace for all four languages is passed to the island as a prop from the server page, using the `getWords` pattern in `src/i18n/words.ts` extended for "all four languages at once" (the current helper reads only the page's language; add a sibling `getAllWords("receipt")` that reads each message file, applies the same `TODO-translate` to English fallback, and must pass the same `notPlain` test except for `{name}` style arguments, which the `fill` function owns: the plain-text test needs a documented exception for the `receipt` namespace). This is the one new pattern in the slice; define it in `src/i18n/words.ts` and test it in `words.test.ts`.
- `scripts/serve-out.mjs`: serve `out/r/index.html` for any `/r/<anything>` path, so e2e matches production.
- `vercel.json`: `"rewrites": [{ "source": "/r/:token", "destination": "/r/" }]` (confirm against `trailingSlash: true` in `next.config` by serving a build, because the exported file is `out/r/index.html`), and a `headers` entry for `/r/(.*)`: `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`. This is the only production-routing change in the slice. Do not add `/p/*` or `/join/*` rules here (R1-9 and R1-13).
- `scripts/check-404*.mjs` and `check-locale-leak.mjs`: teach them that `/r/` is a shell with no locale (read each to see; add the route to the lists they hold, do not loosen a rule).
- `scripts/size.mjs`: require `r/index.html` (it is outside `LANGUAGES`; add a second list).
- `e2e/receipt-public.spec.ts`, `e2e/receipt-public-layout.spec.ts`, using a stubbed function host (same technique as the waitlist e2e).
- `messages/{en,hi,kn,te}.json`: the parent words in `receipt` (criteria 28 to 31). **Hindi (at least) must be reviewed before release** (open question 1 below).

#### 3.3 Part C (PDF, download, share)

`frontend-dev` only, after B has merged **and** R0-3b has merged. Branch from `main` after both.
- `src/components/receipt/receipt-actions.tsx` and test: Download PDF and Share buttons, used on the in-app receipt and on `/r/{token}`. Calls `await import("@/lib/receipt/make-pdf")` inside the click handler only. Reuses `saveBlob` and `chooseShare` from `src/lib/receipt/share.ts` and `receipt.ts`. Do not edit those files unless a test in R0-3 would still pass; if a change is needed, do it as its own commit and re-run R0-3's tests.
- `src/lib/receipt/make-pdf.ts` takes `ReceiptInput` shaped for the free tool (a sentence "from the family of {student}"). The app receipt has a receipt number, a parent name, a balance and a different sentence. Add a **second, separate entry point** in the same module family (for example `src/lib/receipt/make-app-pdf.ts`) that shares `splitRuns`, `dropUnprintable`, `wrapRuns` and the font loader rather than adding options to `makePdf`; if that needs the shared parts exported, export them, do not duplicate them. This is the largest uncertainty in C; the first task of C is a 30-minute read of `make-pdf.ts` to confirm, and if it is not clean the work is sent back here.
- `src/lib/receipt/share-app.ts`: message text and the choice order from criterion 35 (share sheet with file, then `wa.me/91…` to the parent's number with the `/r/` link, then copy link). The parent's phone is read from the roster on the tutor's phone only; it is never in a function call.
- `e2e/receipt-pdf.spec.ts`: download event, offline download, failure with the chunk blocked.
- `pnpm size`: the PDF library and fonts must stay out of every route's first load (the existing `pnpm size` already reads first-load scripts).

### 4. Work split, in order

Part A (backend first):
1. `backend-dev`: migration A, with the header comments the repo's migrations carry (purpose, who writes, why one policy). Run `pnpm db:reset` or rely on CI (Docker does not work on the founder's machine).
2. `backend-dev`: pgTAP files 150, 160, 170, 180 and the 080 update; the concurrency check (risk 2). Run `pnpm db:test` twice. `pnpm check:db --base origin/main`.
3. `backend-dev`: hand off with the exact error words, the return shape and the `detail` convention written at the top of the migration (the front end reads them there). Do not merge A without step 6 done; they ship as one PR.
4. `frontend-dev`: `src/lib/payments.ts`, `payments-view.ts` and tests; the `pay` messages in all four files.
5. `frontend-dev`: `PaySheet` (lazy), the `DueRow` change, `applyPayment`/`applyVoid`, the banner. Measure `pnpm size` for `home` right after this step and write the number in the commit message.
6. `frontend-dev`: the receipt route and card, the "Already owes" lock on `students/edit` (measure that route too), `size.mjs`, e2e helpers and specs (criteria 12 to 22, 38).
7. `test-engineer`, then `code-reviewer`, `lead-reviewer`, `release-manager` (staging), `preprod-qa` for A. A is a complete, shippable PR.

Part B (starts after A is on `main`; backend first):
8. `backend-dev`: migration B, `get_receipt`, `receipt_hit`, pgTAP 190.
9. `backend-dev`: the `receipt` function (`handler.ts`, `index.ts`, tests), `config.toml`, local secrets, `supabase/CLAUDE.md` sentence.
10. `frontend-dev`: `getAllWords` and `receipt-words.ts`, the `/r` shell, `public-receipt.tsx`, `serve-out.mjs`, `vercel.json`, the check scripts, `size.mjs`, e2e (criteria 28 to 31).
11. Review chain as above. **Before this PR is released to production, the Hindi text is reviewed** (question 1). Staging can carry English fallback.

Part C (after B and after R0-3b is on `main`):
12. `frontend-dev`: read `make-pdf.ts`; build the app-receipt PDF entry point and tests (criterion 33 fixtures: Latin, Hindi, Kannada, Telugu, a 120-character name, an emoji name, a cancelled receipt makes none).
13. `frontend-dev`: `receipt-actions.tsx` on both screens; share order; e2e (criteria 34, 35); `pnpm size`.
14. Review chain as above. Criterion 36 is a manual phone step on staging.

### 5. Bundle and size

- **`home` is 163.8 KB gzipped against the 200 KB limit (36 KB of room; this slice's own ceiling is 185 KB).** What lands on it: one button in `DueRow`, `applyPayment`/`applyVoid`, the banner, `payments.ts`'s `PaymentError` and RPC wrapper (small; the Supabase client is already a dynamic chunk), the `pay` messages (only the short row/banner words should be in the first load). The sheet, amount parsing UI and date choices go in a lazy chunk loaded on the first Mark paid tap. `ClientMessages` for `home` must list only the keys the row and banner need; put the sheet's messages on the sheet's own chunk or on `receipt`'s route, not on `home`. If `home` passes 185 KB after step 5, stop and report; do not push on.
- **Book routes are about 161 KB** (above the 150 KB warning target, below the limit). `students/edit` gets one boolean and one message. `BoardProvider` sits in the `(book)` layout, so anything added to it lands on every book route: `applyPayment` and `applyVoid` are a few hundred bytes; the banner is rendered only by the board screen, not by the layout. Measure `students`, `students/edit`, `attendance` and `batches` at step 5.
- **New routes** `receipt` (in-app) and `r` (public). `receipt` shares the book layout's code, so it starts near 161 KB: the page itself must be small and the PDF code is Part C only. `r` has no `(book)` layout, no roster, no board and no Supabase client: it should be well under 100 KB.
- **The PDF** (about 400 KB gzipped plus fonts, from R0-3) never enters a first load. C's `size` check proves this.

### 6. Tests required, mapped

**pgTAP (backend-dev), all start with `select tests.assert_ready();` and roll back**

| File | Proves | Criteria |
| --- | --- | --- |
| `150_payments_rls.sql` | A reads own payments; **B reads zero of A's, via select, via `where due_id = ...`, and through a join**; B's insert, update and delete each fail or change zero rows; **an anonymous session cannot select (permission denied)**; `anon` and `authenticated` have no insert/update/delete privilege on `payments`; neither role has any privilege on `receipt_counters`; `payments.tutor_id` has no default; `receipt_token` is at least 22 URL-safe characters and unique; `method = 'gateway'` and `'bank'` are refused (as the table owner); deleting a tutor removes their payments and counter | 1, 2, 9 |
| `160_record_payment.sql` | Success path writes payment, `receipt_no`, `balance_after`, due `amount_paid` and `status` (partial then paid). Refused with **nothing changed and the counter unmoved**: not signed in; anon; another tutor's due (same error as an unknown id); amount 0, negative, above remaining; method `bank`; `paid_on` tomorrow and 91 days back; archived student; paid due; **same request id twice returns the same row and one payment**; same request id with a different amount raises `request_reused`; ₹10,00,000 in 3,33,333 / 3,33,333 / 3,33,334 rupees (in paise) ends `paid`; a later `monthly_fee` change and an "Already owes" change leave the due as it was; the dues status/amount checks still hold | 3, 4, 6, 7, 11 |
| `170_void_payment.sql` | Owner voids within 24 hours: payment `voided_at` set, due back to `due` or `partial`, counter unchanged; second void, other tutor's payment, anon, a payment created 25 hours ago (set `created_at` back as the table owner), each raise and change nothing; a void leaves the number used; the immutability trigger refuses changing `amount` or `receipt_no` or un-voiding | 8, 9 |
| `180_receipt_numbering.sql` | 50 calls for tutor A give 1..50 with no gap or repeat; a refused call between two good ones does not use a number; tutor B's first receipt is also 1; after a void the next number is not reused | 5 |
| function privileges (in 150 or 160) | `has_function_privilege('anon', 'public.record_payment(...)', 'execute')` is false; `authenticated` true; same for `void_payment`; `anon` and `authenticated` cannot execute any helper; `030_default_privileges.sql` and `080_grants_after_migration.sql` still pass | 10 |
| `190_receipt_public.sql` (B) | `get_receipt` is executable by `service_role` only (not `anon`, not `authenticated`); returns **exactly** the key list in section 2 (compare `jsonb_object_keys` sorted to a literal list, for paid, part paid and cancelled); a cancelled receipt has no amount, method, balance; unknown and malformed token return null; the object has no phone, email, UPI, id; the language fallback (parent, tutor, en); `receipt_hit` increments atomically, returns false after the limit, purges old hours, is not callable by `anon`/`authenticated`; `receipt_hits` has RLS on and no grant | 23, 24, 25, 26, 30 |

**Concurrency** (criterion 5, "two calls at the same moment"): one pgTAP transaction cannot do this. `backend-dev` adds a short script that runs two `psql` sessions at once against the local database (session 1 calls `record_payment` and `pg_sleep`s before commit; session 2 calls it meanwhile) and asserts the numbers are 1 and 2 and that two calls with one request id make one row. Run it in the CI `database` job. If CI cannot run `psql`, the fallback is a manual staging step and a note in the PR; do not drop the check silently.

**Edge Function** (backend-dev, `handler.test.ts` in Node with fakes, like `waitlist-join`): response keys equal the list exactly (an extra key fails); malformed, short, empty and unknown tokens return the same 404 body (compare bytes), and a malformed token still performs one lookup with a dummy token (similar work); method other than POST/OPTIONS gives 405; a body over a small limit gives 413; 61st request from one hashed IP in an hour gives 429, 121st for one hashed token gives 429; **the raw IP and the raw token never reach `hitIp`, `hitToken`, `log` or any storage call** (spy); `cache-control: no-store` and `x-robots-tag: noindex` on every response; log words are a fixed set; a thrown dependency gives 500 with no detail; CORS: allowed origin echoed, unknown origin not. Criteria 23 to 27.

**Unit (Vitest)**: `payments.test.ts` (rpc arguments are exactly due, amount, method, date and request id; error words map; unknown method refused; no `.from("payments")` insert anywhere; same request id reused on retry), `payments-view.test.ts` (chips, half rounding, hidden half at ₹1, 90-day floor, amount validation table incl. Indian commas, `0`, decimal, letters, over remaining, 10,00,000 limit, 24-hour edge at exactly 24h and 24h+1s), board-store `applyPayment`/`applyVoid`, `words.test.ts` for `getAllWords`, `receipt-words.test.ts`, the grep test (criterion 37), `no-strings` stays green.

**Playwright (360px, fake Supabase host)**: criteria 12 to 22 and 38 in `pay.spec.ts` and `pay-layout.spec.ts` (four languages, 80-character student, 60-character batch, largest font, grayscale); 28 to 31 in `receipt-public.spec.ts` (stubbed function host, the four states, language from response, `noindex`, no cookie, only own host and the function host contacted); 34 and 35 in `receipt-pdf.spec.ts`. Two-phone case (21): two browser contexts against one stub.

**Manual (phone, staging)**: section 11 of this spec, unchanged.

### 7. Risks and traps

1. **Bundle on `home` and the book routes.** Plan: lazy sheet, tiny row and banner, measure at step 5 and 6 and quote numbers. Stop line 185 KB on `home`. The `ClientMessages` list is the usual leak: keep the sheet's words off `home`.
2. **Numbering gaps and duplicates.** Gaps come from taking a number and then failing; the plan takes the lock first, checks everything, and writes the counter last in the same transaction, so a failure rolls the number back. Do not use a Postgres `sequence` (sequences are not rolled back and would leave gaps). Do not compute `max(receipt_no) + 1` (races). The concurrency script is the proof; without it the claim is unproven.
3. **Replay beating the checks.** The request-id lookup is inside the lock and before the due checks, so a retry after the fee became paid returns the receipt instead of `already_paid`. A different amount on the same id raises, so a request id cannot silently mean two things.
4. **Information leak through errors.** Another tutor's due and an unknown due give the same `due_not_found`; the Edge Function gives one 404 body for every bad token; neither says "almost".
5. **Definer functions and `search_path`.** Every function sets `search_path = ''` and uses schema-qualified names (the repo pattern). New public functions are executable by `anon` by default (Supabase grants directly): the migration must `revoke ... from public, anon, authenticated` explicitly and then grant, and the test checks `has_function_privilege`.
6. **Rate-limit bypass and header trust.** `waitlist-join` documents (H7) that which header carries the real client IP on Supabase is unconfirmed and that `x-forwarded-for` is not read because a caller can set it. `receipt` copies that rule; until H7 is confirmed on staging all callers may share one `unknown` bucket, so the per-IP limit of 60 an hour would throttle every parent at once. `preprod-qa` must confirm the header on staging before B goes to production, and the per-token limit (120) is the real guard until then. Do not read `x-forwarded-for` to fix it.
7. **Hashing.** IP hash is `HMAC(RECEIPT_HASH_SALT, ip|hour)` like the waitlist; the token hash is `HMAC(RECEIPT_HASH_SALT, "token|" + token + "|" + hour)`. Neither raw value is stored or logged. The hour in the hash is part of the existing pattern; keep it.
8. **The static shell and the rewrite.** `trailingSlash: true` and the exported `out/r/index.html` mean the rewrite destination must match what Vercel serves (`/r/` or `/r/index.html`); a wrong destination gives a 404 only on production. Verify on a Vercel **preview** deployment with a real token before asking for production approval. Playwright's server (`serve-out.mjs`) must mimic it or e2e proves nothing.
9. **`window.location` and Next's router.** The shell reads the path once on the client; it must not use `useParams` or `usePathname` for the token (static export gives it nothing).
10. **Parent page with an unknown language at build time.** All four languages' words ship in the shell (a few KB). The `fill` function must reject nothing and escape nothing (the words are our own, the values are rendered as React text, never as HTML).
11. **Stale board on a second phone.** `amount_over_remaining` carries the remaining amount; the sheet shows it and the board re-reads that month (criterion 21).
12. **Voiding a middle payment.** Receipt 13's balance stays as printed (history); the due's `amount_paid` drops. The tutor's receipt screen for the fee shows the true current balance separately from each receipt's own "balance after". Do not "fix" `balance_after` on later rows.
13. **The shared PDF module is built for a different receipt.** Part C may need a second entry point (see 3.3). If it is not clean, C waits and A and B are unaffected.
14. **Translation of the parent page.** `TODO-translate` text must never reach a parent: `loadMessages` already turns it into English, and `getAllWords` must do the same (test it). Release gate for B is the founder's question 1.
15. **Dates.** All "today" and "90 days" checks use `india_day(now())` in the database and `todayIndia` on the phone; a wrong phone clock gets `date_out_of_range` and a message, not a bad record.
16. **Migration drift.** Two other branches (`r1-5-dues-db`, `r1-6-dues-board`) carry older migration sets. If any migration merges before A, re-stamp A (`check:db` rule 3). R1-5 part B's schedule migration (`20261012100100`, not on `main`) would be older than the newest on `main`; if it is still pending it must be re-stamped by its owner, not by this slice.
17. **Payment ids in the URL.** `?p={uuid}` on the in-app receipt is not a secret and has no token power (RLS reads it). Do not put the `receipt_token` in an in-app URL, history or analytics; only in the Send receipt message and the on-screen link.

### 8. Not doing

- No `bank` method, no gateway method, no refunds, no edit of an old payment, no over-payment credit (defaults 1, 5).
- No expiry or "stop sharing" for a receipt link (question 3 of the spec).
- No amount in words (default 11), no tutor logo, no referral link (no column yet).
- No outbox or offline queue (R1-12), no analytics event (R1-14), no reminder or Remind button (R1-8), no `/p/*` or `/join/*` rewrite (R1-9, R1-13), no payments list screen or student detail screen.
- No pg_cron job, no Storage bucket, no `payments` Realtime subscription.
- No change to `students`, `dues` generation or the nightly job beyond the one added `unique (tutor_id, id)`.
- No new dependency. No analytics or error-reporting script on `/r/`.
- No change to R0-3's receipt code except exports needed by Part C, and only after R0-3b merges.
- No receipt wording unified between the free tool and the app (question 2 below).

### 9. What the human must approve

Agents do the staging steps through `release-manager`; the founder alone approves and runs the production steps, in their own terminal, after a database dump saved outside the repo.

**Staging (release-manager, no human approval needed under the delegation, but listed so nothing is missed):** apply migration A after A's PR merges, then migration B after B's PR merges, with `supabase db push` to the staging project only; set `RECEIPT_HASH_SALT` on staging with `supabase secrets set` (value never printed or committed); deploy the `receipt` function to staging; deploy the Vercel preview that has the rewrite; run the manual steps in section 11.

**Production, each a separate human approval:**
1. Migration A (`20261012130000_r1_payments.sql`): adds a table, a counter table, two money functions, one additive unique constraint on `dues`. A forward-fix only; there is no down migration.
2. The release of Part A's front end (the Mark paid button appears for every tutor).
3. Migration B (`20261012160000_r1_receipt_public.sql`).
4. Setting the production secret `RECEIPT_HASH_SALT` and `RECEIPT_ALLOWED_HOSTS` (if used), and deploying the `receipt` function.
5. The release of Part B, which includes the `vercel.json` rewrite and headers (changes routing for `/r/*` on the production domain).
6. The release of Part C (the PDF code reaches production; depends on R0-3's native-reader sign-off if R0-3 is still provisional).
7. Before 4: confirmation, on staging, of which request header carries the real client IP (the unresolved H7 from the waitlist), because it decides whether the per-IP limit works.

### 10. Open questions (founder, before the PR named)

**Before PR B (parent-facing translations)**
1. **Who reviews the Hindi, Kannada and Telugu words that a parent sees (the `receipt` namespace and the WhatsApp message)?** Default: English fallback until reviewed; production release of B needs Hindi at least. R0-3 already uses a review file (`src/lib/receipt/templates.review.json`, status "not reviewed" for hi, kn, te) with a named reader per language. Can the same reader and the same file cover this page, so there is one review and one gate?
2. **One wording or two?** The free tool says "Received with thanks {amount} from the family of {student} by {mode} towards the tuition fee for {month}." The spec's page says "Received with thanks from {parent} … towards the tuition fee of {student} for {month}." The month names and mode words already exist in R0-3's templates. Default: reuse R0-3's month names, short months and mode words (one review), and keep the app's own sentence, which has a parent name and a receipt number. Say if the two receipts should read identically instead.
3. **If R0-3 has not merged by the time B starts**, B writes its own month names in `receipt`. Default: B does not wait; Part C reconciles the two. Say if B should wait.

**Before PR A**
4. Spec questions 1 (bank), 2 (undo window), 3 (kill a link), 6 (tutor name on old receipts), 7 (button colour) keep their defaults and do not block A. Question 6 matters for B: default is the current name.

**Before PR C**
5. **If R0-3's native-reader check fails or is slow**, C waits and A and B ship without PDF. Confirm.

### 11. Hand-off

`backend-dev` starts, with task 1: migration A (`payments`, `receipt_counters`, `record_payment`, `void_payment`, the added unique key on `dues`), then tasks 2 and 3. `frontend-dev` starts at task 4 once the error words and return shape are written at the top of the migration, and can begin `payments-view.ts` and the `pay` messages in parallel with task 2 because they do not depend on the database.

---

## Part A database contract (written by `backend-dev`, 2026-10-12; the same block heads `supabase/migrations/20261012130000_r1_payments.sql`)

Called with `client.rpc(...)` by a signed-in user. Nothing else writes `payments`, `dues.amount_paid` or `dues.status`.

```
record_payment(p_due uuid, p_amount integer, p_method text, p_paid_on date, p_request_id uuid) returns payments row
void_payment(p_payment uuid)                                                                     returns payments row
```

- `p_amount` is paise, 1 up to what is left. `p_method` is `'upi'` or `'cash'`, exactly. `p_paid_on` is not after today in India and not more than 90 days before it. `p_request_id` is made once per open sheet and reused on every retry.
- **Return shape** (one JSON object, exactly these keys): `id, tutor_id, due_id, amount, method, paid_on, receipt_no, receipt_token, request_id, balance_after, created_at, voided_at`. `amount` and `balance_after` are integer paise, `paid_on` is `YYYY-MM-DD`, `voided_at` is null while live.
- After a record: the due's `amount_paid = due.amount - balance_after`, status `paid` when `balance_after = 0`, else `partial`. After a void: the payment has `voided_at`; the due's `amount_paid` drops by `payment.amount`, status `due` when that leaves 0, else `partial`. `balance_after` on a payment never changes.
- A retry with the same request id returns the same row (same `receipt_no`, same `receipt_token`), even if the fee has since been paid or the payment voided.
- **Errors**: database message is a machine word, never shown. Over PostgREST: `{ code: 'P0001', message: '<word>', details: '<detail or null>' }`, HTTP 400. The one exception is `not_signed_in`, code `42501`.

| word | when | details |
| --- | --- | --- |
| `not_signed_in` | no session, or a token with no user (code 42501) | null |
| `invalid_argument` | an argument is null, amount below 1, or method not `upi`/`cash` | null |
| `due_not_found` | the due does not exist, or is another tutor's (same word) | null |
| `student_archived` | the due's student is archived | null |
| `already_paid` | the due is already paid in full | null |
| `amount_over_remaining` | amount is more than is left | the paise left, as text (for "Only {amount} is left") |
| `date_out_of_range` | `paid_on` after today (India) or more than 90 days back | null |
| `request_reused` | this request id was used before for a different due or amount | null |
| `payment_not_found` | (void) unknown, or another tutor's (same word) | null |
| `already_voided` | (void) undone before | null |
| `undo_window_over` | (void) more than 24 hours since it was recorded | null |

Notes: an anonymous caller gets `42501` (permission denied) from the function privilege itself. `payments` and `receipt_counters` are not readable through `anon`. The client reads `payments` with select only (named columns, never `*`). `india_day()` is not executable by clients; compute "today" on the phone with `todayIndia`.

## Part B public contract (written by `backend-dev`, 2026-10-12; for the `/r/{token}` page)

**Request.** `POST {SUPABASE_URL}/functions/v1/receipt`, header `Content-Type: application/json`, body `{"token": "<the token from the path>"}`. No auth header needed (`verify_jwt` is off), but the platform's `apikey` header may be sent as for the waitlist form. POST only; GET and others give 405. Body is at most 512 bytes. Send no cookies (`credentials: "omit"`) and `referrerPolicy: "no-referrer"`. Allowed browser origins: `feedost.vercel.app` and this project's preview pattern (override `RECEIPT_ALLOWED_HOSTS`); on a local run `http://localhost:3000`.

**Every response** is JSON with `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`.

| HTTP | body | meaning | page state |
| --- | --- | --- | --- |
| 200 | `{"code":"ok","receipt":{...}}` | found | show the receipt (or cancelled, by `receipt.status`) |
| 404 | `{"code":"not_found"}` | unknown, malformed, short, empty or missing token, or the tutor's account was deleted. One identical body for all | not found |
| 429 | `{"code":"rate_limited"}` plus `Retry-After: 3600` | over 60 requests an hour from this caller, or 120 an hour for this token | rate-limited, "try again later" |
| 400 | `{"code":"invalid"}` | body not a JSON object | treat as a failure with Try again |
| 405 / 413 | `{"code":"invalid"}` | wrong method / body too large | failure |
| 500 | `{"code":"error"}` | server fault | failure with Try again |

A network error (no response) is the page's "network failure with Try again" state.

**`receipt` when `status` is `paid` or `part_paid`**: exactly these 12 keys, always present (null where noted):

| key | type | notes |
| --- | --- | --- |
| `receipt_no` | integer | the tutor's own running number |
| `status` | `"paid"` or `"part_paid"` | `paid` when `balance_after` is 0 |
| `tutor_name` | string or null | |
| `tutor_subjects` | string[] | may be empty |
| `student_name` | string | |
| `parent_name` | string or null | null: write the line without "from {parent}" |
| `month` | `"YYYY-MM-DD"` (first of the month) or null | null means "earlier balance" |
| `amount` | integer paise | what this payment was |
| `method` | `"upi"` or `"cash"` | |
| `paid_on` | `"YYYY-MM-DD"` | |
| `balance_after` | integer paise | left on that fee right after this payment; fixed forever |
| `language` | `"en"`, `"hi"`, `"kn"` or `"te"` | the student's parent language; use it for the page, not the address |

**`receipt` when `status` is `cancelled`**: exactly 5 keys, `receipt_no`, `status` (`"cancelled"`), `tutor_name`, `student_name`, `language`. No amount, method, date or balance.

Not returned: referral code (no column yet, R1-13), phone, email, UPI id, any id, other receipts. Secret to set before deploy (release-manager): `RECEIPT_HASH_SALT`. Nothing is deployed or set by this change.
