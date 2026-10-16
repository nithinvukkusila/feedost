# R1-8: one-tap reminder and bulk remind

Slice R1-8 (docs/BUILD_PLAN.md section 5, size M, depends on R1-6). Written 2026-10-12. Money-adjacent screen, so the full process applies, but nothing here touches money.

Tags: [unit] Vitest, [e2e] Playwright at 360px with the fake Supabase host, [db] pgTAP, [manual] by hand on a phone against staging.

## Things the founder should know first

- **WhatsApp cannot be automated from the app.** The app opens WhatsApp with the message filled in. The tutor presses send there. The app can know that it opened WhatsApp. It cannot know the message was sent. Every word on screen is honest about this ("Opened", "Press send there").
- **This slice needs a small backend part.** One table, two functions, pgTAP. Details in section 6. Split into two pull requests, A (database) then B (screens). B cannot ship alone.
- **The link in the message is the UPI link plus the plain UPI ID line, exactly as R0-2 shipped it.** The pay page (R1-9) does not exist yet. R0-2's open question 5 (is a `upi://` link tappable inside WhatsApp?) was never answered on a phone, so the plain "Or pay to UPI ID" line is the real fallback. When R1-9 lands, the link in this message changes to the https pay page. The message builder takes the link as one input, so that is a small change.
- **Tutors with no parent name saved:** the message needs a name to say "Hello ___ ji". See criterion 11 and question 3.
- **R1-7's "no button inside a row" change already allows buttons beside the row link.** This slice adds Remind to that same button group.

## 1. Goal

A tutor can tap Remind on an Overdue or Due fee, check the message, and have WhatsApp open on the parent's number with a fee reminder in the parent's language and the tutor's chosen tone. She can also walk through all her overdue parents one after another. The board shows when each parent was last reminded, so she does not nag, and does not forget. Before this slice the board only shows who owes.

## 2. Users and moment

**The tutor**, on a low-end Android, one thumb, between classes or in the evening with the board open. She has a list of late parents and dreads writing to them. She wants: tap, check, send, next. She is wary of being rude or of messaging the same parent twice.

**The parent**, on WhatsApp, reading a message from a number they know. They never see the app. The message must read as the tutor's own words, in their language, with their name, polite or firm as the tutor chose.

## 3. Defaults chosen (no founder input needed)

Each can be reversed. Nothing blocks.

1. **Remind opens a screen, not WhatsApp directly.** Tap Remind, see the message and the tone, tap "Open WhatsApp" (the blue button). Two taps, and the tutor sees what will be sent. The same screen serves bulk (canvas `Remind`), so single remind is "Reminder 1 of 1". (Question 1.)
2. **Tone is Polite or Firm, chosen on that screen. Starts Polite.** The choice is remembered while the tutor stays in the book (in memory, like R1-6's view). Not stored on the phone or the server; there is no tone column and none is added.
3. **Message language is the student's `parent_language`** (R1-3). Not changed per send. To change it the tutor edits the student. (2026-10-16: the founder's English-only rule for parent pages does not cover this message. The tutor reads the whole message and sends it herself from her own WhatsApp. See `docs/specs/parent-pages-english.md`, section 3 and question 1.)
4. **The message is the R0-2 template** for that tone and language, with its five placeholders. `{link}` is the UPI link built from the tutor's profile UPI ID and name, the remaining amount, and the fee's month. The plain UPI ID line stays.
5. **Amount is what is still owed** on that fee (the amount minus what was part paid), not the full fee.
6. **One reminder per fee per India day is the default.** A second tap the same day asks first, with a one-tap override.
7. **Logging happens when the tutor taps "Open WhatsApp".** That is the only moment the app knows. It is logged as "Opened", shown on the row as "Reminded {when}". Skipping a parent in bulk logs nothing.
8. **Bulk is for Overdue only** ("Remind all overdue"), with a pick list so she can untick. Due rows are reminded one at a time.
9. **One message per student per bulk run.** A student with two overdue fees gets one step, for the oldest fee, with a note. Other fees are reminded from their own rows. This stops one parent getting three messages in a row.
10. **Bulk advances when the tutor returns to the app** (PRD wording), and also has a "Next" button, because the return signal is not reliable on every phone.
11. **No consent column, no mute switch.** The tutor's tick "I have this parent's permission to save their number" (R1-3) is the consent for messaging a number she was given. It is not stored (R1-3 decision). Parent consent for the pay page is R1-9. Pausing one student is archive for now (question 4).
12. **No analytics event fires in this slice**, as in R1-6 and R1-7. `first_reminder_sent` and `reminder_sent` are wired in R1-14, off the same moment as the log (section 8).
13. **Needs network to save the log, not to open WhatsApp.** Offline, WhatsApp still opens. The log is retried in memory while the app stays open (criterion 28).

## 4. Acceptance criteria

PRD criteria, word for word:

- "One-tap reminder: Builds message in the parent's language with amount, month, pay-page link; opens `https://wa.me/91XXXXXXXXXX?text=...`; logs a `reminders` row"
- "Bulk remind: "Remind all overdue" walks the tutor through each parent one after another (WhatsApp opens per parent; return to app advances to next)"

Differences from the PRD wording, on purpose: the link in the message is the UPI link and UPI ID until R1-9 exists (the PRD's "pay-page link" cannot exist yet); "opens WhatsApp" is not the same as "sent" and the screens say so.

Tests use the fake Supabase host and a fixed clock of 2026-10-12 05:00 UTC (10:30 India) unless stated.

### Who can be reminded

1. [unit] `canRemind(due, student, tutor)` is true only when all hold: the fee is unpaid or part paid (not `paid`); the student is active; the student has a parent phone in E.164 (`+91` and ten digits); the tutor has a UPI ID saved. It returns the first reason it is false, in this order: `paid`, `archived`, `noPhone`, `noUpi`. Table test with each case and with two reasons at once.
2. [e2e] On Overdue and Due rows, a "Remind" button (44px, outline, beside Mark paid, its own target outside the row link, accessible name "Remind {student name}") shows when the fee is unpaid or part paid, the student has a phone, and the tutor has a UPI ID. Paid rows have no Remind. Archived students are not on the board at all.
3. [e2e] A row whose student has no phone shows, instead of Remind, a "Add number" link (44px) to that student's edit screen. It never opens WhatsApp. It is not shown on Paid rows.
4. [e2e] If the tutor has no UPI ID saved, every Remind button is replaced by "Add your UPI ID", a link to the setup UPI screen, and one line says why: "Reminders carry your UPI ID so parents can pay. Add it first." Nothing opens WhatsApp.

### The message

5. [unit] The message is built by the R0-2 builder, the one function that produces the preview text, the `wa.me` text and the copy text. It is given: the student's `parent_language`, the tone, the parent's name, the remaining paise, the fee's month, the tutor's UPI ID and name. No second template file, no second builder. The tool page `/tools/fee-reminder/` behaves exactly as before (its 70 criteria stay green).
6. [unit] `{amount}` is the remaining amount. A fee of ₹1,500 with ₹500 part paid says `₹1,000` in the message and `am=1000.00` in the link. The month is the fee's own month in the message language (an unpaid October fee reminded in November still says October). The UPI note `tn` is English, as in R0-2.
7. [unit] The tool page's amount ceiling (₹1,00,000) belongs to the tool. A fee the app allows (up to ₹10,00,000) must produce a link and a message, not throw. The app path accepts any whole-rupee fee up to ₹10,00,000; the tool path is unchanged. (`tech-lead` decides how.)
8. [unit] Earlier balance fees (opening balance, no month) use a second pair of templates, polite and firm, in all four languages, with the same placeholders except `{month}`; their text is in section 9. The UPI note `tn` for them is `Fee balance`. All 8 new templates are recorded "not reviewed" in the review record, as the R0-2 drafts are, and `i18n:check --strict` stays red for them until a native reader signs off.
9. [unit] A template is never replaced by English or shown as `TODO-translate` text. If the student's language is Hindi, the message is Hindi.
10. [unit] `waLink(e164, text)` is `https://wa.me/91XXXXXXXXXX?text=` plus the encoded message: the `+` of the stored phone is dropped, the ten digits follow `91`, nothing else (no spaces, no `+`). A phone not matching `+91` and ten digits is refused (throws), and criterion 1 stops it before it gets there. Decoding `text` gives exactly the message in the preview.
11. [unit] With no parent name saved, the name in the greeting is a generic word for the parent's language ("Parent", "अभिभावक", "ಪೋಷಕರು", "తల్లిదండ్రులు"), never the student's name and never a blank. These four words are also recorded "not reviewed". The message never contains the student's name (R0-2 founder decision, unchanged).
12. [unit] The message contains no product name, no "sent with" line, no link to us and no claim of automation or tracking (R0-2 criterion 29, still true). It contains no phone number.

### The Remind screen (single and bulk)

13. [e2e] Tapping Remind opens the screen `remind/` in the signed-in book. The address contains no name, phone, amount, student id or due id. Which fees are queued is held in memory. Opening `remind/` directly with nothing queued goes back to Home.
14. [e2e] The screen follows the `Remind` canvas: top bar with "Reminder {n} of {m}" and "Stop"; a progress strip with one segment per step; the card with "To {parent name} · {language name}", the student's name, "{Month} · {n} days late" (or "Earlier balance"), the remaining amount in the headline face; Polite/Firm segmented control; the message in a bubble with `lang` set to the message language and `translate="no"`; the blue "Open WhatsApp" button (a real `<a>` with the `wa.me` address, `target="_blank"`, `rel="noopener noreferrer"`); the line "Press send there, then come back." and "Skip"; and an "Up next" list. With one item the "Up next" list and "Skip" are not shown.
15. [e2e] Changing Polite/Firm changes the preview and the link at once, makes no network request, and is remembered for the next step and the next screen opened in the same book session. Never saved to the server or the phone.
16. [e2e] The parent's phone is shown in no place on the screen except as part of the link. The card says "To {parent name}". With no parent name it says "To the parent of {student name}".
17. [e2e] Tapping "Open WhatsApp" opens WhatsApp (a new tab or the app), and the Remind screen stays as it was. It must be a plain link tap, never a script-opened window, so a pop-up blocker cannot stop it. The log call (criterion 24) is sent at the same moment and never delays the link.
18. [e2e] After the tap the step shows "Opened for {student name}'s parent" (not "Sent") and the line "WhatsApp only opens the message. You press send there." When the tutor comes back to the app (page becomes visible again), the screen advances to the next step. A "Next" button does the same without waiting. Both advance exactly once per step, however many times the page becomes visible.
19. [e2e] "Skip" moves to the next step and logs nothing. "Stop" returns to Home. After the last step the screen says "{n} parents opened, {k} skipped." and a "Back to home" button. It never says "sent".
20. [e2e] The screen stays within 360px, with the largest font and in en, hi, kn and te, with an 80-character name, a 60-character batch, ₹10,00,000, and a Telugu message: no sideways scroll, every control 44px or more, no text under 14px, nothing cut with an ellipsis, "Open WhatsApp" is reachable without hiding behind the keyboard or the nav. Status is a word plus a mark in grayscale ("Opened" has a tick).

### Bulk: choosing who

21. [e2e] The Overdue tab shows "Remind all overdue ({n})" (blue, 44px or more) when at least one overdue fee can be reminded (criterion 1). It opens a pick list (same route family, in memory) of every overdue fee that can be reminded, one row per student (oldest overdue fee, with "+{n} more overdue" when there are others), each with a tick, student name, parent name, "{n} days late" and the remaining amount. Tick state is word-plus-mark, not colour. The batch filter in use on the board narrows the list; "Remind all" never reaches outside the filter.
22. [e2e] The list starts with everyone ticked except rows reminded today (criterion 25), which start unticked with "Reminded today". Students who cannot be reminded appear in a closed group "Cannot remind ({n})" with the reason in words ("No phone number", "Add your UPI ID first") and a link to fix it. A "Remind {k} parents" button starts the run; with none ticked it is unavailable (dashed, with its reason), as the design system draws a disabled button.
23. [e2e] With more than 20 ticked, one line shows above the button: "That is a lot at once. WhatsApp can limit numbers that message many people. Do 20 now and the rest later if you like." It does not block. Tapping "Remind {k} parents" still works. (Question 5.)

### The reminder record

24. [e2e] On "Open WhatsApp" the app makes one `record_reminder` call with only: the fee id, a template tag (tone and language and kind, for example `polite:hi:month`) and a request id. It carries no name, no phone, no message text, no amount. Only the page's own host and the Supabase host are contacted. No cookie. No analytics event.
25. [unit] `alreadyRemindedToday(lastSentAt, today)` compares the India day of the last record with today's India day (integer arithmetic, no `Date` local getters, no `Intl`). Table: 18:29:59 UTC and 18:30:00 UTC on the same date (the India day changes between them), yesterday 23:59 India, today 00:00 India, and a last record from another month.
26. [e2e] Tapping Remind on a fee already reminded today shows, before the Remind screen, one question: "You reminded {parent name} today at {time}. Remind again?" with "Remind again" and "Not now". Time is India time, DD MMM not shown, 12-hour form in 0-9 digits. "Not now" changes nothing. The same question is asked once for each already-reminded step if the tutor ticks such a row in bulk.
27. [e2e] The row shows when the parent was last reminded: a mark (a speech bubble with a tick) and the words "Reminded today", "Reminded yesterday" or "Reminded {n} days ago" (up to 30, then "Reminded over 30 days ago"). The words are always shown; the mark alone never carries it. Fees never reminded show nothing. Shown on Overdue and Due rows; Paid rows show nothing. It grows the row, never truncates.
28. [e2e] Offline or a failed log: WhatsApp still opens. The step shows "Couldn't save that you reminded them. We'll try again." and the call is retried (same request id) when the network returns, while the app stays open. It is lost if the app is closed first, and the screen does not pretend otherwise. A retry never creates two records. After a lost response the row shows one mark, not two. (The proper outbox is R1-12.)
29. [e2e] The row mark and the "reminded today" check survive opening a student and coming back, and a reload while online (they are read from the server with the dues, in the same parallel read; a failed read of reminders leaves the board and shows no marks, never an error banner on its own).

### Data and privacy

30. [db] `reminders` rows: `tutor_id`, `due_id`, `channel` (`click_to_chat` only until Release 2), `template`, `request_id`, `sent_at`. Tutor B reads none of tutor A's rows and writes none. No client insert, update or delete grant. No phone, name, message text or amount is stored. The same request id twice makes one row. A paid fee, an archived student's fee, a student with no phone, another tutor's fee, and an unknown id are each refused with no row written (the last two with the same answer). Deleting the tutor deletes the rows. `last_reminders()` returns, for the caller's unpaid fees of active students only, the fee id, the latest `sent_at` and the count, and nothing for another tutor.
31. [e2e] Nothing in the address, the page title, history, local storage, a cookie, or any request to our hosts contains a parent's name or phone or the message. The only place the phone and message text appear is the `wa.me` link in the page, which goes straight from the tutor's phone to WhatsApp. The link has `rel="noopener noreferrer"`. Nothing goes through our servers. (R1-14 must keep this true: the error reporter and PostHog must not capture link hrefs or this screen's text. The screen carries `data-ph-no-capture` and `data-sentry-mask`.)
32. [unit] Every new string is in `messages/{en,hi,kn,te}.json` (namespace `remind`; section 9) and `pnpm i18n:check` passes. No English in components, no brand name outside `brand.ts`. Amounts and counts use 0-9 digits. No `parseFloat`, `toFixed`, `Math.round`, `Intl.` or local `Date` getters in the new code (the existing grep test is extended).
33. [e2e] `pnpm size`: initial JS for `home` stays at or below 185 KB gzipped (R1-7's ceiling), and the new `remind` route at 200 KB or less. The Remind screen, its messages and the template data are not in the first load of `home` beyond the Remind button itself.

## 5. Edge cases

- **Empty:** no overdue fees can be reminded: the "Remind all overdue" button is not shown. A tutor with no fees sees nothing new.
- **Student has no phone:** "Add number" (criterion 3). In bulk, listed under "Cannot remind" with the reason.
- **Parent name empty:** generic greeting word (criterion 11).
- **Parent name very long (up to R1-3's limit) or Hindi, Kannada, Telugu names:** the bubble wraps. Names go into the message as typed.
- **Part paid:** the message names what is still owed (criterion 6). The wording "the tuition fee of ₹1,000" is slightly loose for a part payment; accepted for now.
- **Fee from an earlier month:** the message names that month.
- **Earlier balance:** its own templates (criterion 8). "{n} days late" is not shown for it.
- **Two overdue fees for one student:** one bulk step, the oldest fee, with the note; the other fee has its own Remind (criterion 21).
- **Two students, same parent number (siblings):** two separate steps and two WhatsApp messages. R1-3 already tells the tutor about the shared number. Accepted; question 6.
- **Duplicates:** double tap on "Open WhatsApp" opens it twice and sends one log (same request id). A tap on Remind twice quickly opens one screen.
- **Offline or slow network:** WhatsApp opens; the log is retried (criterion 28). Marks come from the cached board (R1-6). Never signs the tutor out.
- **WhatsApp not installed:** `wa.me` opens its web page in the browser ("Continue to chat"). The app still advances on return. The screen's help line is unchanged. Manual step 9.
- **Phone clock wrong:** "today" for the once-a-day check uses the phone's India day; a wrong clock can allow or block a repeat. Accepted; the server `sent_at` is the truth for display.
- **Late at night:** no block. (A quiet-hours note is not built; question 7.)
- **Tutor changes a student's language after a reminder:** the next message uses the new language. The old record keeps its tag.
- **A payment is recorded while the Remind screen is open (second phone):** the log call is refused for a paid fee; the step shows nothing alarming and advances. The board shows Paid on the next read.
- **Parent opening an old link:** not applicable to this slice. An old reminder's UPI link keeps paying the UPI ID and amount written at the time, as in R0-2. The tutor sends a new reminder after changing either.
- **Student archived or restored:** archived students leave the pick list at once; their records stay and come back with them.
- **Many overdue fees (hundreds):** the pick list is one row per student, not virtualised; the run is as long as she ticks. Cap and warning at 20 (criterion 23).
- **Second language:** tutor's screens in her language, message in the parent's. Digits and `₹` are 0-9 in both.
- **Large font:** criterion 20.

## 6. Backend part (a slice of its own: R1-8 Part A, then Part B)

Yes, a migration is needed. The PRD already lists `reminders(id, tutor_id, due_id, channel, template, sent_at)`, so a small table is in scope. Smallest version:

- **Table `reminders`**: as in criterion 30, plus `request_id uuid` with `unique (tutor_id, request_id)` and a composite foreign key to `dues (tutor_id, id)` (the R1-7 pattern). One policy, select own rows. No client write grant. Same shape as `payments`. `template` is a short tag checked against a pattern, never free text.
- **`record_reminder(p_due uuid, p_template text, p_request_id uuid) returns timestamptz`**: the only way a row is created. Checks the caller owns the fee, the fee is not paid, the student is active and has a phone. Idempotent on `p_request_id`. Does not refuse a second reminder on the same day: the once-a-day rule is a courtesy on the tutor's own phone, not a security rule, and a server refusal would fight the override. Signed-in callers only, not `anon`.
- **`last_reminders()`**: returns `(due_id, last_sent_at, times)` for the caller's unpaid fees of active students. This is what the board reads, in parallel with dues.
- **pgTAP:** RLS with two tutors and an anonymous session; refusals write nothing; idempotency; paid, archived and no-phone refusals; `last_reminders` shows only the caller's unpaid, active fees; grants (`anon` cannot execute either function). The existing grants tests still pass.
- **No Edge Function.** The wa.me link is built on the phone and nothing is sent through our servers.

Part B (front end) depends on A. `tech-lead` decides the exact names and migration stamp.

## 7. Out of scope

| Not here | Where |
| --- | --- |
| Automatic reminders on due day, +3 and +7 days, WhatsApp Cloud API, opt-out line, pause per student | Release 2 (Pro) |
| The parent pay page `/p/{token}`, the https pay link in the message | R1-9 (the message builder takes the link as one input) |
| "I've paid" claims, "to confirm" | R1-10 |
| Consent shown to the parent, `consents` table | R1-9 |
| A proper offline queue for the log | R1-12 |
| `first_reminder_sent` and `reminder_sent` events | R1-14 |
| Editing the message text, saving custom templates, a per-send language switch | not in the PRD |
| Reminder history screen, a reminder count on the student, "Reminded" filter | not in the PRD |
| Mute or "do not remind" switch per student | question 4 |
| Quiet-hours blocking | question 7 |
| The onboarding "First reminder sent" screen (`Sent.dc.html`) | question 8 |
| Reminders from a Student detail screen | no such screen yet; the row is the entry |
| Receipts sent with Share | R1-7 Part C |
| Referral line "Free for tutors" in the message | R1-13 (R0-2 left it out) |

## 8. Analytics

None fire in this slice. In R1-14, `reminder_sent` fires when the tutor taps "Open WhatsApp" and the log call is made, and `first_reminder_sent` fires the first time a tutor ever has a `reminders` row. Properties allowed: counts, tone, language code, channel, whether it was bulk. Never a name, phone, amount, token or message. No analytics script loads on `remind/`.

## 9. Copy

Namespace `remind`, added to all four message files together. English is final here. Hindi is a draft for the interface strings. Kannada and Telugu interface strings are `TODO-translate: <English>` (shows English until reviewed). The message templates are different: they are complete drafts in all four languages, because a parent reads them (R0-2 criterion 28), and are recorded "not reviewed".

| Key | English | Hindi (draft) |
| --- | --- | --- |
| remind.button | Remind | याद दिलाएँ |
| remind.buttonFor | Remind {name} | {name} को याद दिलाएँ |
| remind.addNumber | Add number | नंबर जोड़ें |
| remind.addUpi | Add your UPI ID | अपनी UPI ID जोड़ें |
| remind.noUpi | Reminders carry your UPI ID so parents can pay. Add it first. | रिमाइंडर में आपकी UPI ID जाती है ताकि अभिभावक भुगतान कर सकें। पहले इसे जोड़ें। |
| remind.progress | Reminder {n} of {m} | रिमाइंडर {n} / {m} |
| remind.stop | Stop | रुकें |
| remind.to | To {parent} · {language} | {parent} को · {language} |
| remind.toStudent | To the parent of {student} | {student} के अभिभावक को |
| remind.late | {month} · {n, plural, one {# day} other {# days}} late | {month} · {n} दिन देर |
| remind.earlier | Earlier balance | पिछला बकाया |
| remind.tone.polite / firm | Polite / Firm | विनम्र / सख़्त |
| remind.open | Open WhatsApp | WhatsApp खोलें |
| remind.hint | Press send there, then come back. | वहाँ भेजें दबाएँ, फिर वापस आएँ। |
| remind.opened | Opened for {student}'s parent | {student} के अभिभावक के लिए खुला |
| remind.openedNote | WhatsApp only opens the message. You press send there. | WhatsApp सिर्फ़ संदेश खोलता है। भेजना आपको वहीं दबाना है। |
| remind.next / skip | Next / Skip | आगे / छोड़ें |
| remind.upNext | Up next | आगे |
| remind.done | {n, plural, one {# parent opened} other {# parents opened}}, {k} skipped. | {n} अभिभावक खोले, {k} छोड़े। |
| remind.home | Back to home | होम पर वापस |
| remind.all | Remind all overdue ({n}) | सभी देर वालों को याद दिलाएँ ({n}) |
| remind.pick.title | Who to remind | किसे याद दिलाना है |
| remind.pick.more | +{n} more overdue | +{n} और देर से |
| remind.pick.today | Reminded today | आज याद दिलाया |
| remind.pick.cannot | Cannot remind ({n}) | याद नहीं दिला सकते ({n}) |
| remind.pick.noPhone | No phone number | फ़ोन नंबर नहीं है |
| remind.pick.start | Remind {n, plural, one {# parent} other {# parents}} | {n} अभिभावकों को याद दिलाएँ |
| remind.pick.many | That is a lot at once. WhatsApp can limit numbers that message many people. Do 20 now and the rest later if you like. | |
| remind.again.title | You reminded {parent} today at {time}. Remind again? | आपने {parent} को आज {time} बजे याद दिलाया था। फिर से? |
| remind.again.yes / no | Remind again / Not now | फिर से याद दिलाएँ / अभी नहीं |
| remind.last.today / yesterday | Reminded today / Reminded yesterday | आज याद दिलाया / कल याद दिलाया |
| remind.last.days | Reminded {n} days ago | {n} दिन पहले याद दिलाया |
| remind.last.old | Reminded over 30 days ago | 30 दिन से पहले याद दिलाया |
| remind.logFailed | Couldn't save that you reminded them. We'll try again. | |
| remind.parentWord | Parent / अभिभावक / ಪೋಷಕರು / తల్లిదండ్రులు (one value per language file, used when no parent name is saved) | |

**New message templates (earlier balance), drafts, "not reviewed".** Lines separated by a line feed. `{link}`, `{upiId}`, `{parent}`, `{amount}` as in R0-2. Lines 2 to 4 are exactly the R0-2 lines for that language and tone.

English polite: `Hello {parent} ji, a gentle reminder that the earlier tuition fee balance of {amount} is still due. You can pay by UPI with this link:` then `{link}`, `Or pay to UPI ID: {upiId}`, `Thank you!`
English firm: `Hello {parent} ji, the earlier tuition fee balance of {amount} is still pending. Please pay it today by UPI with this link:` then the same three lines, ending `Thank you.`

Hindi polite: `नमस्ते {parent} जी, यह याद दिलाना था कि पिछली ट्यूशन फ़ीस का {amount} बाकी है। आप इस लिंक से UPI द्वारा भुगतान कर सकते हैं:`
Hindi firm: `नमस्ते {parent} जी, पिछली ट्यूशन फ़ीस का {amount} अभी तक बाकी है। कृपया आज ही इस लिंक से UPI द्वारा भुगतान कर दें:`
Kannada polite: `ನಮಸ್ಕಾರ {parent} ಅವರೇ, ಹಿಂದಿನ ಟ್ಯೂಷನ್ ಶುಲ್ಕ {amount} ಬಾಕಿ ಇದೆ ಎಂದು ನೆನಪಿಸುತ್ತಿದ್ದೇನೆ. ಈ ಲಿಂಕ್ ಮೂಲಕ UPI ನಲ್ಲಿ ಪಾವತಿಸಬಹುದು:`
Kannada firm: `ನಮಸ್ಕಾರ {parent} ಅವರೇ, ಹಿಂದಿನ ಟ್ಯೂಷನ್ ಶುಲ್ಕ {amount} ಇನ್ನೂ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಇಂದೇ ಈ ಲಿಂಕ್ ಮೂಲಕ UPI ನಲ್ಲಿ ಪಾವತಿಸಿ:`
Telugu polite: `నమస్కారం {parent} గారు, గత ట్యూషన్ ఫీజు {amount} చెల్లించాల్సి ఉందని గుర్తు చేస్తున్నాను. ఈ లింక్ ద్వారా UPI లో చెల్లించవచ్చు:`
Telugu firm: `నమస్కారం {parent} గారు, గత ట్యూషన్ ఫీజు {amount} ఇంకా బాకీ ఉంది. దయచేసి ఈ రోజే ఈ లింక్ ద్వారా UPI లో చెల్లించండి:`

The month-fee templates are the R0-2 ones, unchanged. Hand-test step 12 has a native reader check all of these.

## 10. Privacy

The parent's phone and name are used on the tutor's own phone to build a link to WhatsApp, and go nowhere else. The server learns only that fee X was opened for reminder at time T with tone and language tag Y, which is the PRD's `reminders` row without a message. No phone, name, message text or amount is stored in the log. The address, history and storage hold none of it. Nothing is sent through our servers (PRD section 9: free plan uses click-to-chat links sent from the tutor's own phone). The tutor's permission tick for a number (R1-3) is the consent for messaging it; the parent's own consent is R1-9. No cookies, no analytics, no new third party. A child's name is not in the message.

## 11. Design references

From `design/project/` (see `canvas.json`):

- `Remind.dc.html` ("Bulk remind"): criteria 14 to 19 and 20. Not built from it: "Sent to Ravi Kumar's parent" (we say "Opened for ... parent": we cannot know it was sent); the pay-page link in the bubble (the UPI link and UPI ID until R1-9); "Press send there, then come back. The next parent will be ready." (kept, shortened to the hint plus the "WhatsApp only opens" line); the green progress segment for done (done is drawn with a tick and the word, not colour alone); "Reminder 2 of 5" is kept.
- `Home.dc.html`, `Home-hi.dc.html`: the round Remind buttons and the blue "Remind all" are replaced by an outline 44px "Remind" button (blue is for sending, and the first tap only opens a screen) and a blue "Remind all overdue ({n})" on the Overdue tab. The canvas's "reminded 2 days ago" line is criterion 27, with a mark.
- `Student.dc.html`: not built (no Student detail yet).
- `Sent.dc.html` ("First reminder sent"): not built (question 8).
- `Auto-reminders.dc.html`: Release 2, not built.
- `Pay-sheet.dc.html`: only for the button group beside the row.
- `Nav.dc.html`, `Main.dc.html`, `Interaction.dc.html`, `Type-indic.dc.html`: nav, tags, press and focus, Indic type, disabled button form.

## 12. Test by hand on a phone

Staging build, signed in with Google, 360px wide, then the largest system font. At least four students: one with a phone and a Hindi parent, one with a phone in English, one with no phone, one with "Already owes". Your UPI ID saved. WhatsApp installed, plus a second phone to receive.

1. Home: an Overdue row shows "Remind" next to "Mark paid". The student with no phone shows "Add number" instead and it opens that student's edit screen. A Paid row has neither.
2. Remove your UPI ID (or use a test account without one): every Remind turns into "Add your UPI ID". Add it back.
3. Tap Remind on the Hindi parent. You see the message in Hindi, with the amount still owed and the fee's month, and Polite chosen. Tap Firm: the message changes. Tap Open WhatsApp: WhatsApp opens on that parent's number with the whole message, line breaks included.
4. Go back to the app without pressing send. The row says "Reminded today" with its mark. (This is what the app knows: that you opened WhatsApp. It cannot see if you pressed send. The screen says so.)
5. Tap Remind on the same row again: you are asked "You reminded ... today at ... Remind again?". Tap Not now: nothing happens. Tap again, then "Remind again": the screen opens.
6. Overdue tab: "Remind all overdue (n)". Open it. Already-reminded rows are unticked, the no-phone student is under "Cannot remind". Tick two and start. WhatsApp opens for the first parent. Press send there, come back: the next parent is ready without tapping. Try "Skip" and "Next". At the end: "2 parents opened, 0 skipped."
7. Send yourself one message from step 3 and read it on the second phone: name, amount, month, the UPI link and the plain "Or pay to UPI ID" line. Is the `upi://` link tappable there? Write the answer down: it settles R0-2's open question 5, and decides how urgent R1-9 is.
8. Airplane mode, tap Remind, Open WhatsApp: WhatsApp (or its web page) still opens; the app says it couldn't save and will try again. Turn the network on: the mark appears.
9. Uninstall or disable WhatsApp, or open the link on a laptop browser: you get the `wa.me` web page. The app still moves on when you return.
10. Student with "Already owes": the message says "earlier tuition fee balance" in the parent's language.
11. Archive a student with an overdue fee: gone from Remind all and from the board. Restore: back, with its "Reminded" mark.
12. A person who reads Hindi, Kannada and Telugu reads all 8 new templates and the generic parent words. Polite warm, firm firm but not rude.
13. Largest font, then Hindi, Kannada and Telugu app languages: nothing cut, nothing sideways, buttons thumb-sized, "Open WhatsApp" reachable.
14. Staging table editor, `reminders`: rows hold due id, a template tag like `polite:hi:month`, a request id and a time. No phone, no name, no message. Only your own tutor id.
15. Switch the phone to London time: "Reminded today" and "yesterday" do not change.

## 13. Open questions (each has a default; nothing blocks)

1. **One tap or two?** Default: two (Remind, then Open WhatsApp on a screen that shows the message and tone). If you want literally one tap, the default tone is used and WhatsApp opens at once; the tutor edits tone in WhatsApp. That is a small change but she loses the preview.
2. **Remember Polite/Firm across sessions?** Default: only while she stays in the book. Remembering longer needs a column on the tutor profile (a second migration) or phone storage.
3. **No parent name saved.** Default: a generic word ("Parent", "अभिभावक" and so on). Alternative: make Remind need a parent name and send her to the edit screen. Is the generic word acceptable to parents?
4. **A "do not remind this parent" switch.** Default: no; archive the student. The PRD has opt-out only for Release 2's automatic messages. Say if a manual-reminder mute is needed before 5 tutors try it.
5. **The 20-at-a-time note.** Default: a soft note, no block. I believe WhatsApp can restrict a personal number that messages many people it does not know. I have not verified the limit, so the note does not name a number of messages. Cut it or make it a hard cap if you prefer.
6. **Two students, one parent number.** Default: two messages. Alternative: one combined message. Combined needs new templates with two amounts.
7. **Quiet hours** (no reminder opened between 9 pm and 8 am without asking). Default: not built.
8. **Onboarding "First reminder sent" screen** (`Sent.dc.html`, PRD onboarding step). Default: not built here; the founder's checkpoint test with tutors will show whether it is needed. Which slice owns it if yes?
9. **Where is the tutor's name for the UPI link `pn`?** The profile has `name` (R1-1); the default is to use it as is. If a tutor has not set one, Remind behaves as "Add your UPI ID": it sends her to setup. Confirm that is acceptable.
10. **Amount cap for the app's link.** The free tool stops at ₹1,00,000; the default for the app is the same as the largest fee the app allows (₹10,00,000). Some UPI apps may refuse large amounts from a link to a personal ID (R0-2 H3). Do you want a lower cap, with the plain UPI ID line as the only way to pay above it?
11. **R0-2's phone checks H2 and H3 are still open.** If `upi://` is not tappable in WhatsApp, this slice still works as written (the plain ID line is the fallback), but tutors will see parents paying by hand-typing the ID until R1-9. Please run step 7.

## 14. Hand-off

`tech-lead`: append the technical plan to this file. Decisions that are yours:

1. The two-part split (A: migration, `record_reminder`, `last_reminders`, pgTAP; B: screens) and the migration stamp (after R1-7's, which may not have merged).
2. How the R0-2 builder serves the app (criteria 5 to 8): the earlier-balance templates, the generic parent word, the higher amount ceiling, `tn` for earlier balance, taking `{link}` as an input so R1-9 swaps it. The tool page must not change.
3. Where the reminder data is read (criterion 29): the same parallel read as dues, and how the cache and offline work; size impact on `home` and the book layout (criterion 33).
4. The `remind/` route and the in-memory queue (criterion 13). The pick list and the step screen share state, not the address.
5. The "returns to the app" signal (criterion 18) and the exactly-once advance.
6. The log call timing (criterion 17: the link tap must never wait on the network), the in-memory retry (28) and the request id, shared with what R1-12 will reuse.
7. A checkbox control for the pick list: check what R1-3 already uses (it noted `Switch` or a new `Check`).
8. Which existing e2e text changes: any "Reminders ... arrive in a later update" line on the board.

---

# Technical plan, R1-8

Written 2026-10-12 by `tech-lead`. Base: main at b61f6fd (R1-7 Part A merged, front end included; home is 168.6 KB gzipped against the 200 KB limit, stop line 185 KB). R1-7 Part B (public receipt function) is on `r1-7b-receipt-public` with stamp 20261012140000.

## Assumed defaults

Section 3's 11 defaults (the numbered list 1 to 11, and 12 and 13 which follow it) stand as written unless the founder says otherwise. In one line each: (1) Remind opens a screen, two taps; (2) Polite/Firm, starts Polite, kept in memory only; (3) message language is `parent_language`; (4) the R0-2 template with UPI link and UPI ID line; (5) amount is what is still owed; (6) one reminder per fee per India day, second tap asks; (7) log on tap of "Open WhatsApp", shown as "Opened"; (8) bulk is Overdue only with a pick list; (9) one message per student per bulk run, oldest fee; (10) advance on return to the app plus a Next button; (11) no consent column, no mute; (12) no analytics event; (13) log needs network, WhatsApp does not. Open questions 1 to 11 keep their defaults. Question 10 (amount cap) is settled in the plan as the app's own limit of ₹10,00,000.

## 1. Approach

Two pull requests. A is the database only: `reminders`, `record_reminder`, `last_reminders`, pgTAP, with no Edge Function (the link is built on the phone). B is the front end: the board gets a Remind button, a last-reminded mark and "Remind all overdue"; a new `remind/` route in the book group shows the message, tone and "Open WhatsApp". The R0-2 builder is extended in place (not forked) with a message kind (month or balance), an optional higher amount ceiling and an optional ready-made link; the 8 new templates and 4 generic parent words live in one new data file, kept out of the board's first load. Everything the Remind screen needs is held in memory in a small provider in the book layout, never in the address.

## 2. Files

### Part A (backend-dev)

- `supabase/migrations/20261012150000_r1_reminders.sql`: table, policy, grants, `record_reminder`, `last_reminders`. Stamp is after 20261012140000 (R1-7b). Before writing it, run `git fetch` and `ls supabase/migrations` on `origin/main`; if anything newer than 20261012140000 has merged, take a stamp after it. Rename if two branches collide, never edit an applied migration.
- `supabase/tests/210_reminders.sql`: pgTAP (name chosen above the highest number on main, 190; if R1-7b has taken 200 that is fine, 210 is free; check on rebase).
- `supabase/tests/080_grants_after_migration.sql`: add `reminders` and the two functions to the expected grants list if that file enumerates them (check; do not weaken it).
- `supabase/CLAUDE.md` or the migration header: no change unless the repo lists tables there.

### Part B (frontend-dev)

- `src/lib/reminders.ts` (new): the only file that calls `record_reminder` and `last_reminders`. Types `LastReminder = {dueId, lastAt (ms), times}`, `readLastReminders()`, `recordReminder({dueId, template, requestId})`, `ReminderError` codes (`offline`, `failed`, and the database's words). Same pattern and header style as `src/lib/payments.ts` (named columns, whole-read-fails-on-bad-row). Small; this one is imported by the board, so it is in home's first load.
- `src/lib/reminder-rules.ts` (new, pure, tiny, imported by home): `canRemind(due, student, tutor)` with the reason order `paid, archived, noPhone, noUpi` (criterion 1; the tutor also needs a non-empty `name`, question 9, reported as `noUpi`); `alreadyRemindedToday(lastAt, now)` and `lastRemindedWords(lastAt, now)` (today, yesterday, n days, over 30) using the India-day helpers already in `src/lib/payments-view.ts` / `dues-board.ts` (reuse; if the existing helper is not exported, export it, do not write a second); `templateTag(tone, locale, kind)` and its pattern; `waLink(e164, text)` goes here too (it is 5 lines and needed by the screen only, so it may sit in `reminder.ts` instead; either is fine as long as home does not import `reminder.ts`).
- `src/lib/reminder/reminder.ts` (change): see section 3 below. The tool page must be byte-for-byte unchanged in behaviour.
- `src/lib/reminder/templates.app.json` (new): `{ en|hi|kn|te: { polite: string[], firm: string[], parentWord: string } }`, the 8 earlier-balance templates from section 9 and the 4 generic words. Month templates stay in `templates.json`.
- `src/lib/reminder/templates.app.review.json` (new): per non-English language `{status:"not reviewed", reviewer:"", date:"", sha256:""}`, covering the 6 non-English balance templates and 3 non-English parent words.
- `scripts/i18n-check-lib.mjs` and `scripts/i18n-check.mjs` (change): new function `checkAppTemplates(file, reviewFile, {strict})`, reusing the helpers `checkTemplates` uses (slot count, `{link}` alone on its line, script test, not-English-pasted, hash, review states, strict fails when not reviewed). Differences: slots are `{parent} {amount} {link} {upiId}` (no `{month}`), no months list, plus `parentWord` must be non-empty, contain the language's script, and not contain braces. Summary line reports it next to the R0-2 one. `scripts/i18n-check-lib` tests (find the existing test file under `src/lib/i18n-check.test.ts`) get matching cases.
- `src/lib/reminder/templates.test.ts` (change) and a new `src/lib/reminder/app-templates.test.ts`.
- `src/components/remind/remind-provider.tsx` (new, tiny, in the book layout's first load; target under 1 KB gzipped): the in-memory session, section 6.
- `src/components/remind/remind-screen.tsx` (new), `remind-step.tsx` (the card, tone control, bubble, button), `pick-list.tsx` (bulk choice), `again-sheet.tsx` (the "Remind again?" question; reuse `ui/sheet.tsx`), `use-return-advance.ts` (the visibility rule), `use-log-retry.ts` (the retry). All loaded by the `remind/` route only.
- `src/components/ui/check.tsx` (new, tiny): a real `<input type="checkbox">` row with word plus mark, 44px. `ui/switch.tsx` is a switch (on/off setting), not a tick; do not bend it. R1-3 used Switch for "permission" only because there was no Check; do not change that.
- `src/app/[locale]/(app)/(book)/remind/page.tsx` (new): static shell, `ClientMessages namespaces={["appState","students","board","remindScreen"]}`. `src/config/routes.ts`: `remindPath = "remind/"` next to `receiptPath`. The Vercel rewrite and the gate: follow what `receipt/` did (not a `Place`; the gate treats it as home).
- `src/app/[locale]/(app)/(book)/layout.tsx` (change): wrap in `RemindProvider`; add `remind` (row strings only) to `namespaces`.
- `src/components/board/due-row.tsx` (change): Remind or "Add number" or "Add your UPI ID" beside Mark paid, plus the last-reminded line. Remind handler is passed in as `onRemind(dueId)` like `onMarkPaid`.
- `src/components/board/board-store.ts`, `board-state.tsx`, `board-screen.tsx` (change): a reminders slice read in parallel with dues (section 4); "Remind all overdue ({n})" on the Overdue tab; the "Reminders arrive in a later update" line (en.json `board` namespace, key `soon`, line 561 on main) is removed together with its test text (criterion 8 of hand-off). Check `e2e/` and board unit tests for that sentence and update.
- `messages/{en,hi,kn,te}.json`: two namespaces, see section 7.
- `e2e/remind.spec.ts` (new), extend `e2e/home*.spec.ts` for the button group; unit tests beside each new file.
- `scripts/size` and its test: no change to the limit. Confirm `pnpm size` reports `remind` as its own route.

## 3. Reuse of the R0-2 builder (criteria 5 to 8, 11)

Decision: extend `reminder.ts`, add no second builder and no second template loader path for the tool.

- `ReminderInput` gets three optional fields, all defaulting so the tool compiles and behaves unchanged: `kind?: "month" | "balance"` (default `"month"`), `maxPaise?: number` (default `MAX_PAISE`, ₹1,00,000), `link?: string | null` (when set, `{link}` fills with it instead of the built UPI link; this is the single point R1-9 changes).
- New `export const APP_MAX_PAISE = 100_000_000` (₹10,00,000, the largest fee the app allows). `upiLink` takes an optional second argument `{ maxPaise }`; it still throws above whatever limit it is given, so a malformed link can never be built. The tool never passes it. The app passes `APP_MAX_PAISE`. The tool's `checkAmount` is untouched, so the tool's 70 criteria do not move.
- Balance kind: `reminderParts` picks `templates.app.json[locale][tone]` instead of `templates.json[locale][tone]`; `fill("month")` is never reached for it. The link's note is `Fee balance` (English, fixed). Month kind: unchanged, `tn` is `{English month} fee`.
- Whole rupees: the app's remaining amount may in principle carry paise. The app path of `upiLink` therefore prints `am` from integer paise (`whole.cc`, using `Math.trunc` and `% 100`, padded; no `toFixed`, no `parseFloat`, no `Math.round`), keeping `am=1000.00` for round amounts. The tool's whole-rupee rule stays for the tool path (`maxPaise` absent means the old rule). Test both.
- Parent word: `parentWord(locale)` reads `templates.app.json`, because the message language is the parent's, not the tutor's screen language, so this word cannot come from the UI message files. This changes spec section 9: the key `remind.parentWord` is dropped from the four message files and recorded in `templates.app.json` and its review record instead (criterion 32 still holds; `i18n:check` covers it through `checkAppTemplates`). A blank or whitespace-only `parent_name` counts as missing; the name goes through `cleanName` (the same as the tool) and is cut by code point at `NAME_MAX` (40) if the stored name is longer, never throws.
- Code split: `reminder.ts` imports `templates.json`; `templates.app.json` is imported only inside `reminder.ts`'s app functions via a second small module `src/lib/reminder/app-message.ts` (`buildAppMessage({student, due, tutor, tone, locale, now})` returns `{parts, text, link, template}` for the screen). Home must never import `reminder.ts` or `app-message.ts`. Enforce with a unit test that greps `src/components/board/**` and `src/lib/reminders.ts`, `reminder-rules.ts` for those imports.

## 4. Data

### Part A migration, intent

- Table `public.reminders`: `id uuid pk default gen_random_uuid()`, `tutor_id uuid not null references tutors(id) on delete cascade`, `due_id uuid not null`, `channel text not null default 'click_to_chat' check (channel = 'click_to_chat')`, `template text not null check (template ~ '^(polite|firm):(en|hi|kn|te):(month|balance)$')`, `request_id uuid not null`, `sent_at timestamptz not null default now()`. Composite foreign key `(tutor_id, due_id)` to `dues (tutor_id, id)` (the payments pattern; `dues` must already have the unique on `(tutor_id, id)` from R1-7, confirm, add only if missing). `unique (tutor_id, request_id)`. Index on `(tutor_id, due_id, sent_at desc)` for `last_reminders`. No phone, name, text or amount column. The `channel` check is relaxed in Release 2 by its own migration.
- RLS on, one policy: select where `tutor_id = auth.uid()`. `revoke all` from `anon`, `authenticated`; `grant select` to `authenticated` only. No insert, update, delete grant. Re-read supabase/CLAUDE.md for the default-privileges rule and follow `20261012130000_r1_payments.sql` for the exact statements.
- `record_reminder(p_due uuid, p_template text, p_request_id uuid) returns timestamptz`, `security definer`, `set search_path = ''`, same header and error-word style as `record_payment`. Order: no `auth.uid()` raises `not_signed_in`; null or malformed arguments `invalid_argument`; look up the request id for this tutor first and return its `sent_at` (idempotent, before any other check, so a retry after the fee was paid still answers the same); read the due without a row lock (no money moves), joining `dues` and `students` by `tutor_id = auth.uid()` and raise `due_not_found` for a missing or another tutor's fee (same word, same answer); `already_paid` when status is paid; `student_archived`; `no_phone` when the student's phone is null or not matching `^\+91[0-9]{10}$`; insert; return `sent_at`. A second reminder the same day is allowed. Handle the unique-violation race on `(tutor_id, request_id)` by selecting the existing row. `revoke execute ... from public, anon`; `grant execute ... to authenticated`.
- `last_reminders() returns table (due_id uuid, last_sent_at timestamptz, times integer)`, `security invoker`, `stable`, `set search_path = ''`. Group by `due_id` over `reminders` joined to `dues` and `students` where `dues.status <> 'paid'` and the student is not archived. RLS already limits the rows to the caller; the function also filters `r.tutor_id = auth.uid()` as a second belt. Same grants as above.
- No Edge Function. No cron. No change to `dues`, `students` or `payments`.
- Stored-data check: confirm the `students` column names (phone, archived flag) and `dues.status` from the existing migrations before writing; do not guess.

### Where the front end gets the tutor's UPI ID and name

From `useTutor()` (`src/components/app/app-gate.tsx`, backed by `src/lib/tutor.ts`, columns `name`, `upi_id`), already loaded by the gate for every signed-in screen. No new read. `canRemind` receives `{ upiId, name }` and treats a missing or blank value as `noUpi`. The remind route needs the same tutor, which the gate gives it. Invalid stored UPI IDs (not matching `UPI_ID`) also count as `noUpi`, so `upiLink` can never throw on a stored value.

### Board read of reminders (criterion 29, hand-off item 3)

The board store gets a `reminders: { byDue: Record<string, LastReminder>; at: number } | null` slice. Every board read (`readMonth`, `readUnpaid` and the first read) is followed in the same `Promise.all` by `readLastReminders()`; it is one small rpc. A failure of the reminders read does not set the board's `failed` flag: it keeps the previous slice (or none) and shows no marks. The snapshot is saved with the board's other cache the same way (check how `board-store.ts` persists to the phone, if it does; if the dues cache is saved to phone storage, the reminders slice is not saved, because it is not worth the privacy surface: offline the marks simply do not show). The `home` route re-reads on mount, so coming back from `remind/` shows the new mark; the frontend must write an e2e for this, not assume it. Marks come only from the server, with no optimistic mark (the tutor sees the real state; if the log was never saved there is honestly no mark).

## 5. Bundle plan (criterion 33)

Budget: home may grow by about 3 KB gzipped at most (168.6 to under 172), hard stop 185 KB. What home gains: `reminders.ts`, `reminder-rules.ts`, the Remind button and last-line in `due-row.tsx`, the "Remind all" button, a few strings (`remind` namespace, 14 keys), `RemindProvider` (in the layout, so every book route). What stays out of home: `reminder.ts`, both template files (about 10 KB raw, about 4 KB gzipped, 6 KB with Indic scripts), the screen, the pick list, `Sheet` if it is not already in home (it is: the pay sheet), `Check`, and the `remindScreen` strings. The pick list and the "Remind again?" question are inside the `remind/` route, so the again-question for a single remind is shown there as the first thing on `remind/` (before the message) rather than on the board; this keeps `again-sheet` out of home and still satisfies criterion 26 (the question appears before the message screen content, and "Not now" returns to Home). If frontend-dev prefers it on the board, it must be a `dynamic(..., {ssr:false})` chunk like `PaySheet`.
Measure with `pnpm build && pnpm size` before and after the board change. If home grows by more than 3 KB, stop and cut the strings into the lazy namespace before going on. The `remind` route target is under 200 KB and should be about home plus 10 KB. `Intl`, `Date` local getters, `toFixed`, `Math.round`, `parseFloat` stay banned in new code; extend the existing grep test to `src/lib/reminders.ts`, `reminder-rules.ts`, `src/components/remind/**`.

## 6. The remind session, the return signal, the log and the retry

- **Provider.** `RemindProvider` holds, in React state (not module scope, not storage): `tone` (starts `polite`), `queue` (an array of snapshots `{ dueId, studentId, studentName, parentName | null, parentPhone, parentLanguage, batchName, month, kind, daysLate, remaining, dueDate }`), a `mode` (`single | bulk | pick`), `opened`/`skipped` counts, and the pending-log list. Keyed by the signed-in tutor like `BoardProvider`, so sign-out clears it. The queue holds snapshots taken when the tutor taps, so `remind/` needs no board read and no extra request. Phone and parent name are therefore in the page's memory, nowhere else, as criterion 31 requires.
- **Direct open.** `remind/` with an empty queue and not in pick mode: `router.replace` to home (criterion 13).
- **Pick list.** Bulk first goes to `remind/` in `pick` mode (same route, state not address) from "Remind all overdue". "Remind {k} parents" builds the queue and switches the same screen to `bulk`. Rows ticked that were reminded today get the again-question at their step, once each, with "Not now" meaning skip that step with no log and no count change except `skipped + 1`.
- **Return signal.** `use-return-advance.ts`: a ref `phase` per step: `ready -> opened -> hidden -> advanced`. On the "Open WhatsApp" click set `opened`. A `visibilitychange` listener moves `opened -> hidden` when `document.visibilityState === 'hidden'`, and `hidden -> advanced` (calling `advance()` once) when it becomes `visible`. A visible event without a prior hidden one does nothing (so a pop-up or a same-page toggle cannot skip a parent). `pageshow` is not used; neither are `focus` or timers. "Next" calls the same `advance()`, which is guarded by the step index so any combination of Next and returns advances exactly once per step. Remove the listener on unmount. If the browser never reports `hidden` (some in-app WebViews), the Next button is the answer; the hand-test step 6 checks this on the founder's phone.
- **Link.** `<a href={waLink(phone, text)} target="_blank" rel="noopener noreferrer" onClick={onOpen}>`. No `preventDefault`, no `window.open`. `onOpen` runs synchronously: marks the step opened, makes the request id (use the same helper `pay-sheet.tsx` uses, `newId`, line 90; if it is local to that file, move it to `src/lib/ids.ts` and import it from both, with its test), then `void log()` and returns. Double tap: the same step keeps the same request id for its life, so two taps give one row.
- **Log and retry.** `use-log-retry.ts` calls `recordReminder`. On `offline`/`failed` it keeps `{dueId, template, requestId}` in the provider's pending list and shows `logFailed` on that step. It retries on the window `online` event and when the tutor moves to the next step, with the same request id, at most 5 attempts per entry, one at a time. On `already_paid`, `student_archived`, `no_phone`, `due_not_found` it drops the entry silently (the fee changed meanwhile; nothing alarming, criterion in edge cases). The pending list dies with the page. R1-12's outbox will take this over: `recordReminder`'s argument shape (`dueId, template, requestId`) is the contract it will reuse, noted in the file header.
- **Tone.** `tone` lives in the provider; changing it is a state change only (no request, criterion 15). It resets on sign-out or leaving the book (More), which is the "while the tutor stays in the book" rule.
- **Privacy attributes.** The screen root has `data-ph-no-capture` and `data-sentry-mask` (the constants are in `src/lib/data-attributes.ts`; use them, do not retype). No analytics code is imported on this route. Page title is the static route title.

## 7. Messages and the review record

- Two namespaces in all four files together: `remind` (strings the board needs: `button`, `buttonFor`, `addNumber`, `addUpi`, `noUpi`, `all`, `last.today`, `last.yesterday`, `last.days`, `last.old`) and `remindScreen` (everything else in section 9, with `remind.pick.*` and `remind.again.*` becoming `remindScreen.pick.*` and `remindScreen.again.*`). The split is so the board's first load carries only its ten strings (the spec's table put all of it under `remind`; rename in the table when implementing, keep the English as is). `remind.parentWord` is dropped (see section 3).
- Hindi per the spec's draft column; Kannada and Telugu interface strings `TODO-translate: <English>`; keys with a blank draft (`pick.many`, `logFailed`) get a Hindi draft from `frontend-dev` marked `TODO-translate` if unsure. Note the existing plural forms in the table need ICU `plural` in all four files.
- `pnpm i18n:check` (non-strict) passes at merge. `pnpm i18n:check --strict` is red until a native reader signs off; it is red today for the R0-2 templates, so the gate is unchanged in kind. Strict now also fails on `templates.app.review.json`. This is the same arrangement as R0-2 and R0-3 and is listed as a known red item for `release-manager`; no change to the pipeline.
- The review record is recorded as "not reviewed" for hi, kn, te; when a reader signs, the entry gets `reviewer`, `date`, `sha256` (the script prints the current hash in non-strict mode). Any later edit of those templates voids the sign-off (the hash changes). Message text must not be touched after sign-off without a new sign-off. The 4 parent words and the 8 templates are read in one sitting (hand-test step 12); the founder arranges the reader. `frontend-dev` and `backend-dev` never mark "reviewed".
- Lint to keep: the existing `no-strings` test for components; `src/components/remind/**` must be covered by it.

## 8. Work split

PR A:

1. `backend-dev`: confirm names from existing migrations (`dues` unique on `(tutor_id, id)`, `students` phone and archived columns, `dues.status`). Write `20261012150000_r1_reminders.sql` (stamp checked against `origin/main` and `r1-7b-receipt-public`). Run `supabase db reset`.
2. `backend-dev`: write `210_reminders.sql` pgTAP: RLS with two tutors and an anonymous session (select none, insert/update/delete denied); cross-tutor `record_reminder` same answer as unknown id; refusals write nothing (paid, archived, no phone, bad template tag, null args); idempotent request id (also after the fee has been paid); a second reminder the same day writes a second row; `channel` check; template pattern check; no `phone`/`name`/`text`/`amount` column exists (catalog test); `last_reminders` returns only the caller's unpaid, active-student fees with the latest `sent_at` and the count; tutor delete cascades; `anon` cannot execute either function and the table grants are select-only for `authenticated`. Update the grants test if it enumerates objects.
3. `backend-dev`: `pnpm test` and the repo's db test command pass; open PR A. `lead-reviewer` merges; the human approves running the migration on staging and later production (below).

PR B (starts only after A is merged and the migration is on staging):

4. `frontend-dev`: pure parts with unit tests first: `reminder-rules.ts`, `reminders.ts` against the fake host (`src/lib/db-fake.test-util.ts`), `reminder.ts` extension, `templates.app.json`, `app-message.ts`, `i18n-check` extension and its tests. The tool page tests must stay green unchanged.
5. `frontend-dev`: messages in all four files (two namespaces), review record file; `pnpm i18n:check` passes.
6. `frontend-dev`: `RemindProvider`, route constant, `remind/page.tsx`, `RemindScreen` (single flow first), step card, tone control, link, return-advance, log and retry. `Check`, pick list, bulk, again-question.
7. `frontend-dev`: the board: reminders slice and parallel read, `due-row.tsx` buttons and last-line, "Remind all overdue". Remove the "arrive in a later update" line and fix its tests. Then `pnpm build && pnpm size` and compare with 168.6 KB; stop and cut if over 3 KB growth.
8. `frontend-dev`: run the lint, type-check, unit and e2e at 360px, large font, four languages (the e2e does the language matrix for the screen only, not every flow).
9. `test-engineer` (after 8): fill gaps against the criteria table below, the clock tests, the e2e for return-advance, the offline retry and the privacy test; then `code-reviewer`, `lead-reviewer`, `preprod-qa`.

## 9. Tests required

Mapped to acceptance criteria (spec section 4). Unit unless stated.

- 1: `reminder-rules.test.ts` table of `canRemind` (each reason, two at once, order). 25: `alreadyRemindedToday` clock table, plus `lastRemindedWords`. 
- 5, 6, 7, 8, 9, 11, 12: `reminder.test.ts` and `app-message.test.ts`: part-paid amount in text and `am=1000.00`; the fee's own month; `tn` English and `Fee balance`; ₹10,00,000 produces a link while the tool's `checkAmount` still rejects it; balance templates in four languages; never English fallback; generic parent word; no student name, product name or phone in any message (property loop over students, tones, languages, kinds).
- 10: `waLink` table including refused phones; decoding `text` equals the preview text.
- 24, 30 (client side): `reminders.test.ts` shows the call sends only `p_due`, `p_template`, `p_request_id`; row parsing is strict.
- 30: pgTAP `210_reminders.sql` as in task 2; grants test.
- 32: i18n check test cases, `no-strings`, the extended banned-API grep test.
- 2, 3, 4: e2e board with seeded fake data (button group, "Add number", "Add your UPI ID" with the one line).
- 13 to 19: e2e remind flow: address has no data; direct open goes home; progress and layout; tone change makes no request and is kept to the next step and next open; link attributes; click opens a new page and the log call is sent at the same time and never delays the link; advance on `visibilitychange` hidden then visible, exactly once, also with repeated events; Next; Skip logs nothing; Stop; end summary never says "sent".
- 20: e2e 360px, largest font, en/hi/kn/te, 80-character name, 60-character batch, ₹10,00,000, Telugu message.
- 21, 22, 23: e2e pick list: filter narrows, defaults, "Cannot remind" group with reasons and links, disabled start button, the 21+ note and that it does not block.
- 26, 27, 29: e2e again-question (time in India 12-hour with 0-9 digits, "Not now"), row mark words, mark survives opening a student and a reload; a failing reminders read shows no marks and no banner.
- 28: e2e offline: WhatsApp link still opens, the failed line shows, the retry on `online` uses the same request id, a lost response gives one mark.
- 31: e2e privacy: collect every request, the address, the title, storage and cookies; assert none contains the parent name, phone or message; only the page host and the Supabase host are contacted; `rel` on the link.
- 33: `pnpm size` run in the build gate: home at most 185 KB (aim for about 172), `remind` at most 200 KB; also the import-boundary test in section 3.
- Fixed clock 2026-10-12 05:00 UTC throughout (the spec's rule).

## 10. Risks and traps

1. **Template and builder drift.** Two sources of text could diverge. Mitigation: one builder, one tag function; the new templates sit beside the old in the same checker, and the tool page's tests stay untouched and must stay green.
2. **Home bundle.** The easy mistake is importing `reminder.ts` (and 10 KB of templates) into `due-row.tsx` for a "preview". The board holds only booleans and strings; the boundary test fails the build if that import appears. Measure at step 7, not at the end.
3. **`upiLink` throws.** A stored UPI ID that is invalid, a fee above the ceiling, or a paise remainder would break the screen. Mitigation: `canRemind` rejects an invalid stored ID; the app ceiling is passed explicitly; paise printed by integer arithmetic; the screen wraps the build in a guard that falls back to "Add your UPI ID" rather than a crash.
4. **Pop-up blockers and a slow log.** Any `window.open` or `await` before the link opens will be blocked or delayed. The link is a real anchor and the handler returns synchronously. A test asserts the anchor is not `preventDefault`ed.
5. **Return signal unreliable.** Hence Next always visible and the hidden-then-visible rule. If hand-testing shows a phone never reports hidden, the product still works; only the auto-advance is lost. Record the result for the founder.
6. **Phone clock and time zone.** The once-a-day check uses India-day integer arithmetic on `Date.now()` only, never local getters; hand step 15 checks London time. The server `sent_at` is the truth for the displayed time.
7. **Privacy leakage.** Queue snapshots hold phone and name in memory; they must not reach the URL, history state (`router.push` with state), storage, or the error reporter. R1-14 must exclude the screen. The `data-*` attributes are set now so R1-14 only has to honour them.
8. **Double records.** Request id is minted once per step on the first tap and reused for retries; unique `(tutor_id, request_id)` plus the function's early lookup make a retry harmless even after the fee is paid.
9. **Migration ordering.** R1-7b's stamp is 140000; mine is 150000. If another migration lands on main first the stamp may need to move; check on rebase and never edit an applied migration. pgTAP file numbers can also collide; renumber.
10. **Strict i18n.** Adding 8 templates and 4 words that are "not reviewed" is expected and does not fail non-strict. A frontend-dev must not write `reviewed`.
11. **Stale dues after return.** The remind route does not touch the board store; home must re-read on mount. A dedicated e2e covers it.
12. **`security definer` search path and grants.** Copy `record_payment`'s hardening exactly, and keep the generic grants test green.
13. **Archived or no-phone students in the queue** can arise between tap and send; the function refuses and the screen carries on without alarm.

## 11. Not doing

A "Reminded" filter, a reminder count on the student, history screen; per-student mute; saving tone on the server or phone; automatic reminders; the https pay link and `/p/{token}` (R1-9; the builder's `link` input is the seam); analytics events (R1-14); an offline outbox (R1-12); quiet-hours blocking; combined messages for siblings; custom or editable templates; the onboarding "First reminder sent" screen; a hard cap at 20; any server-side message building or any Edge Function; any new dependency.

## 12. Dependency policy check

No new dependency. Everything uses what is installed: `next-intl`, Supabase client, React, existing `ui` components. `Check` is a native checkbox. Recorded per BUILD_PLAN section 2, rule 5: nothing to approve.

## 13. What the human approves

Per CLAUDE.md the human approves only two things:

1. **Running the migration `20261012150000_r1_reminders.sql`.** First on staging (after PR A merges, so PR B can be tested against it and `preprod-qa` can check the real tables), then on production before the front end that calls it is released. Part B must not be released to production before this migration is there, or the board's reminders read and the log fail (the board must still work with a failed reminders read, criterion 29, but Remind logging would not).
2. **Releasing to production**, once PR B is merged and `preprod-qa` says go. Not blocking release but to be told in the go/no-go report: `i18n:check --strict` stays red for the 8 templates and 4 words until a native reader signs off; whether `upi://` is tappable in WhatsApp (hand step 7); the founder's phone result for the return signal.

Open questions 1 to 11 keep their defaults and none blocks. The spec's table drops the `remind.parentWord` message key in favour of the template file (section 3); this is a technical change that needs no product decision.

## 14. Who starts

`backend-dev` starts PR A with task 1 (confirm the existing column names, then write migration `20261012150000_r1_reminders.sql`), then task 2 (pgTAP `210_reminders.sql`). `frontend-dev` may start task 4 (the pure builder, rules and checker work, which needs no database) in parallel on its own branch, but must not wire the board or the screen to the rpc until PR A is merged.

## Part A contract as built (backend-dev, 2026-10-12)

Migration `supabase/migrations/20261012150000_r1_reminders.sql` (the same block is its header). Called with `client.rpc(...)` by a signed-in user.

- `record_reminder(p_due uuid, p_template text, p_request_id uuid)` returns a single `timestamptz` (ISO string over PostgREST): the time logged. `p_template` is `<polite|firm>:<en|hi|kn|te>:<month|balance>`. Same request id again returns the same time and writes nothing, even after the fee is paid. A second reminder for the same fee on the same day (new request id) is allowed.
- `last_reminders()` returns rows `{ due_id: uuid, last_sent_at: timestamptz, times: integer }`, one per unpaid fee of an active student with at least one reminder. Empty array when none.
- Errors arrive as `{ code: 'P0001', message: '<word>' }` (HTTP 400), except `not_signed_in` which is code `42501`. Words: `not_signed_in`, `invalid_argument` (null argument or bad template), `due_not_found` (unknown or another tutor's fee, same word), `already_paid`, `student_archived`, `no_phone`. Check order: not_signed_in, invalid_argument, replay by request id, due_not_found, already_paid, student_archived, no_phone.
- Table `public.reminders` is select-only for `authenticated` (one policy, `reminders_select`); anon has nothing. It stores ids, template tag, channel and times only.
