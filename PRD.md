# FeeDost — Build Spec (PRD for engineering)

Working name: **FeeDost** (placeholder; keep it in one config constant so it can be renamed).

## 1. Product in one line

A free installable web app (also shipped to Google Play as a Trusted Web Activity) that lets Indian home tutors collect monthly fees in two taps: the tutor taps **Remind** (WhatsApp opens with a pre-filled message + pay link), the parent taps **Pay** (their UPI app opens with the amount filled).

## 2. Users

| User | Who | How they use it |
| --- | --- | --- |
| Tutor (customer) | Solo/small-batch tutor, 10–60 students, Android phone | Installed PWA, signed in, daily |
| Parent (no account) | Pays the tutor monthly | Opens a public pay-page link from WhatsApp. No install, no login |
| Centre owner (later, Release 3) | 2–5 teachers, ≤300 students | Same app, multi-teacher |

Students (often minors) are **never** users. Store only: name, batch, fee, attendance.

## 3. Non-goals

Live classes, course selling, exams, staff payroll, LMS content, holding or moving money through our accounts.

## 4. Releases and features

Build strictly in this order. Each release must be shippable on its own.

### Release 0 — Free tools (no login, static pages)

| Feature | Acceptance criteria |
| --- | --- |
| Fee receipt maker `/tools/fee-receipt` | Inputs: tutor name, student name, amount, month, payment mode. Output: PDF download (generated client-side) + "Share on WhatsApp". Works in en, hi, kn, te |
| Fee reminder generator `/tools/fee-reminder` | Inputs: tone (polite/firm), language, parent name, amount, month, UPI ID. Output: message text with copy button + `https://wa.me/?text=...` button. Includes a `upi://pay` link |
| Waitlist | Form on both tools: name, phone, city, approx. number of students → saved to `waitlist` table |
| SEO | Each tool page has a unique title/description per language, server-rendered/static HTML |

> Note 2026-10-16 (founder decision): parent-facing output (the receipt maker's PDF, `/p/`, `/r/` and the app's receipt PDF) is English-only until a named human reviewer signs off each language. The tool pages themselves still work in en, hi, kn and te, and every string stays translated in all four message files (§9). Detail: `docs/specs/parent-pages-english.md`.

### Release 1 — MVP (free plan)

| Feature | Acceptance criteria |
| --- | --- |
| Language picker | First screen before sign-in; en/hi/kn/te; persisted; changeable in settings |
| Sign-in | Supabase Auth: Google OAuth + email magic link. No SMS OTP |
| Tutor profile | Name, subject(s), UPI ID (validate `^[\w.\-]{2,256}@[a-zA-Z]{2,64}$`), optional photo |
| Add students | 4 ways: one-by-one form; paste a list (parse "Name, phone, fee" lines); Contact Picker API on Android Chrome (feature-detect, hide otherwise); CSV/XLSX upload with column mapping UI. Fields: student name, parent name, parent phone (normalize to +91), parent language, batch, monthly fee, due day (1–28), opening balance |
| Batches | Create/rename/delete; timings text; move students |
| Dues generation | On the student's due day each month a `dues` row is created (scheduled job). Opening balance becomes a due on import |
| Dues board (home) | Month switcher; header "₹X pending from N students"; tabs Overdue / Due / Paid; partial status; batch filter |
| Record payment | One tap "Mark paid": amount (prefilled, partial allowed), method (UPI/cash), date; creates `payments` row + receipt |
| One-tap reminder | Builds message in the parent's language with amount, month, pay-page link; opens `https://wa.me/91XXXXXXXXXX?text=...`; logs a `reminders` row |
| Bulk remind | "Remind all overdue" walks the tutor through each parent one after another (WhatsApp opens per parent; return to app advances to next) |
| Parent pay page `/p/{pay_token}` | Public, no login. Shows tutor name/photo, student name, dues, big "Pay ₹X with UPI" button (`upi://pay?pa={upi}&pn={tutor}&am={amount}&cu=INR&tn={note}`), "I've paid" button (below), past receipts, this month's attendance count, footer "Free for tutors — start in 60 seconds" + tutor's referral link. First visit shows privacy notice + consent |
| "I've paid" (parent self-report) | Parent taps "I've paid" → enters UPI reference number (12 digits) or uploads a screenshot → creates `payment_claims` row (status pending) → tutor gets an in-app notification "Ravi's parent says ₹1,000 paid. Confirm?" → one tap Confirm creates the payment + receipt; Reject notifies nothing to parent but marks claim rejected |
| Receipts | Auto-created on payment; sequential number per tutor; public link `/r/{receipt_token}` + PDF |
| Attendance | Per batch per date: tick list; monthly count per student |
| Offline | Service worker caches the app shell; writes queue locally (IndexedDB) and sync when online; conflict = last write wins per row |
| Export | XLSX export of students, payments, attendance |
| Referral | Each tutor has `referral_code`; `/join/{code}` sets `referred_by` on sign-up |
| Analytics | PostHog events: `signed_up`, `profile_done`, `students_added` (count), `first_reminder_sent`, `reminder_sent`, `payment_marked`, `claim_submitted`, `claim_confirmed`, `paypage_viewed`, `upi_button_tapped`, `referral_signup` |
| Play Store | TWA via Bubblewrap; `assetlinks.json` served at `/.well-known/` |

### Release 2 — Pro (₹149/month or ₹999/year)

| Feature | Acceptance criteria |
| --- | --- |
| Plans & billing | Razorpay (or Cashfree) subscriptions; 14-day free Pro trial on sign-up; `subscriptions` table; webhook updates plan; graceful downgrade to Free |
| Automatic reminders | Sent server-side via WhatsApp Cloud API with approved utility templates on due day, +3, +7 days; stop when paid; every message has an opt-out line; tutor can pause per student |
| Auto-confirmed payments | Tutor onboards as a sub-merchant (Razorpay Route / partner model). Pay page shows "Pay online" → gateway checkout; webhook marks due paid + sends receipt. Show gateway fee (~2%) to tutor before enabling |
| Monthly parent report | On the 1st: attendance + bill in one WhatsApp template message |
| Reports | Monthly/yearly income totals, by batch; yearly statement PDF; full-history export |
| Branding | Tutor logo on receipts and pay page (our small footer stays) |

### Release 3 — Scale

UPI AutoPay mandates; Centre plan (≤5 teacher logins, ≤300 students, per-teacher reports); notebook-photo import (AI extracts rows for review); public tutor profile page; Tamil + Malayalam.

## 5. Core flows

**Onboarding (target: first reminder within 5 minutes)**
language → Google sign-in → name/subject/UPI (one screen) → add students (4 options, or "try with sample data") → home shows pending total → big "Send reminders now" → WhatsApp opens for the first parent → success message.

**Monthly cycle**
due created → tutor taps Remind (Pro: automatic) → parent opens pay page → pays by UPI → parent taps "I've paid" or tutor taps "Mark paid" (Pro gateway: automatic) → receipt sent → next month.

**Growth loop**
every pay page, reminder and receipt shows "Free for tutors" + referral link → new tutor signs up via `/join/{code}`.

## 6. Screens

1. Language picker
2. Sign in
3. Setup (3 steps: name+subject → UPI ID → add students)
4. Home — dues board
5. Student detail (fee, due day, history, attendance, Remind, Mark paid, Share pay link)
6. Record payment (sheet)
7. Students list (search, batch filter, add, import)
8. Batch detail
9. Attendance
10. Reports (Pro)
11. More (profile, language, referral, upgrade, export, delete account, help → WhatsApp support link)
12. Notifications (payment claims to confirm)
P. Parent pay page (public)
R. Receipt page (public)

Bottom nav: Home, Students, Attendance, More. Mobile-first, works at 360px width, large tap targets (≥44px).

## 7. Data model (Supabase Postgres)

```
tutors(id uuid pk = auth.uid, name, email, phone, language, upi_id, subjects text[], photo_url,
       plan text default 'free', trial_ends_at, referral_code unique, referred_by, created_at)
batches(id, tutor_id fk, name, timings, created_at)
students(id, tutor_id fk, batch_id fk null, name, parent_name, parent_phone, parent_language,
         monthly_fee int (paise), due_day smallint, opening_balance int, pay_token unique, active bool, created_at)
dues(id, tutor_id, student_id fk, month date (first of month), amount int, status ('due'|'partial'|'paid'),
     due_date, created_at)   unique(student_id, month)
payments(id, tutor_id, due_id fk, amount int, method ('upi'|'cash'|'gateway'), paid_on, receipt_no int,
         receipt_token unique, gateway_ref, created_at)   unique(tutor_id, receipt_no)
payment_claims(id, tutor_id, due_id, amount, upi_ref, screenshot_path, status ('pending'|'confirmed'|'rejected'), created_at)
reminders(id, tutor_id, due_id, channel ('click_to_chat'|'api'), template, sent_at)
attendance(id, tutor_id, student_id, date, present bool)   unique(student_id, date)
subscriptions(id, tutor_id, plan, status, renews_on, gateway_ref, created_at)
waitlist(id, name, phone, city, students_count, language, created_at)
consents(id, student_id, parent_phone, accepted_at, notice_version)
```

Money is stored as integer paise. All tutor-owned tables carry `tutor_id`.

**Security:** row-level security on every table — `tutor_id = auth.uid()`. Public pages (`/p/`, `/r/`) never query tables directly; they call Edge Functions that look up by unguessable token (≥22 random URL-safe chars) and return only what that page needs. Screenshot uploads go to a private storage bucket; only the owning tutor can read them.

## 8. Tech stack

| Layer | Choice |
| --- | --- |
| Front end | Next.js (static export) + TypeScript + Tailwind; next-intl for en/hi/kn/te |
| PWA | Service worker (offline shell + queued writes), web manifest, installable |
| Hosting | Vercel (static export; `*.vercel.app` domain for now) |
| Backend | Supabase: Postgres, Auth (Google + magic link), Storage, Edge Functions, pg_cron |
| PDF | Client-side (e.g. pdf-lib or jsPDF) with embedded Noto Sans fonts for Devanagari, Kannada, Telugu |
| Analytics / errors / email | PostHog, Sentry, Resend (free tiers) |
| Payments (R2) | Razorpay or Cashfree (subscriptions + sub-merchant collections) |
| WhatsApp (R2) | Meta WhatsApp Cloud API, utility templates |
| Android | Bubblewrap TWA |

## 9. Non-functional requirements

- Never hold money. UPI goes straight to the tutor's UPI ID; gateway payments settle to the tutor's sub-merchant account.
- Mobile-first; initial JS per route ≤200 KB gzipped; usable on slow 4G and low-end Android.
- Every user-facing string translated (no hard-coded English in components).
- Indian number formatting (₹1,23,456) and dates (DD MMM YYYY).
- Accessibility: labels on inputs, contrast AA, works with large system font size.
- Privacy (DPDP Rules 2025, fully applicable from 13 May 2027): minimal student data; parent consent on first pay-page visit; tutor confirms they have parents' permission when adding numbers; delete-account and export buttons; no tracking or ads aimed at students; no SMS/call-log permissions in the Android wrapper.
- WhatsApp: free plan only uses click-to-chat links sent from the tutor's own phone; automated sending (Pro) only via the official API with approved templates and an opt-out.

## 10. Success metrics to instrument

Activation = first reminder sent within 7 days of sign-up. North star = reminders sent per active tutor per month. Also track: pay-page views → UPI taps → claims → confirmations; signup source (organic, Play, referral, pay page).
