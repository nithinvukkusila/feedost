# R0-2 — Fee reminder generator

## Goal
A tutor opens `/en/tools/fee-reminder/` (or `/hi/`, `/kn/`, `/te/`), types a parent's name, the amount, their own UPI ID and name, picks a month, a message language and a tone, and gets a fee reminder with a UPI payment link in it. One tap opens WhatsApp with the message filled in; another copies it. No sign-in, no database, nothing sent to us.

Size: M, as in the build plan. One new page, one small pure library (message, links, validation), message keys, and three small edits to the landing. No Supabase, no PostHog, no new dependency.

## Users and moment
- **A tutor on a low-end Android, between classes.** A parent is late. The tutor has put off asking. They want words they did not have to write, and a link, in under a minute. They may read the page in English but want to send Hindi, Kannada or Telugu.
- **The parent, on WhatsApp.** They never see this page. They read the message and pay to the tutor's UPI ID. The message is the product for them, so its wording in hi, kn and te matters more than any other text in this slice.
- **The founder.** Wants the first usable tool out fast. Drafts are allowed; the unreviewed ones are named (criterion 30).

## What exists today (checked)
- `src/app/[locale]/page.tsx` is the landing. `src/components/landing/tools.tsx` draws two cards, both tagged "Coming soon", neither a link. Its comment says R0-2 turns card 2 into a link.
- `src/lib/seo.ts` has `canonicalUrl(locale)` and `alternateUrls()` for the landing only. They need a path.
- `src/lib/format.ts` has `formatRupees(paise)` (`₹1,200`). There is no month-only format (F3 left it to this slice) and no phone parsing.
- `Segmented` (two to four options, native radios, optional second line), `Field` (a wrapping one-line text control with `idle`, `correct`, `error` states and a required state word), `Button` (`send`, `record`, `outline`, `size="large"`, `disabled` with `disabledReason`, `href` form) and `Slip` exist. There is **no select component**; the canvas draws a month select.
- `ClientMessages` hands named namespaces to client components at about +12 KB. Every language route is 132.1 KB today.
- `scripts/check-locale-leak.mjs` reads only `out/{locale}/index.html`. A value that is the same in all four message files is not counted as a leak.

## What the PRD and canvas decide, and where this spec differs
The PRD row lists the inputs: tone (polite/firm), language, parent name, amount, month, UPI ID. The canvas (`Tool-reminder-m.dc.html`) draws exactly those. The coordinator's brief also named a student name and a parent phone number. **Neither is in the PRD or the canvas, so neither is built** (Open questions 3 and 4). One field is added that the PRD row does not list: the tutor's name, because the PRD's own UPI link format needs `pn` (Open question 1).

## Acceptance criteria
Each is marked **[unit]**, **[e2e]** (Playwright, 360px phone project, against `out/`) or **[manual]**.

### Route and the landing links
1. The tool is served at `/en/tools/fee-reminder/`, `/hi/tools/fee-reminder/`, `/kn/tools/fee-reminder/` and `/te/tools/fee-reminder/`, each prerendered as static HTML with the right `<html lang>`. [e2e]
2. The unprefixed PRD address `/tools/fee-reminder` is not served in this slice; it shows the existing 404 with its four language links. A static export cannot redirect on a server. (Open question 7) [e2e]
3. On the landing, tool card 2 ("Fee reminder writer") is a link to `/{locale}/tools/fee-reminder/` in each language, has no "Coming soon" tag, and its link is at least 44px high. Card 1 (receipt maker) is unchanged: tagged "Coming soon", not a link. [e2e]
4. The landing's tools heading no longer says both are coming soon. English: "Two free tools." [e2e]
5. The landing hero gains the canvas's second link, "or write a free reminder now", to the tool page, at least 44px high. No header link to the receipt maker is added anywhere. [e2e]
6. The tool page header shows the brand name (from `src/config/brand.ts`) as a link to `/{locale}/`. It has no "Receipt maker" link until R0-3. The page has one `<header>`, one `<main>`, one `<footer>`, exactly one `<h1>`. [e2e]
7. The footer shows the four language links (endonyms from `src/config/locales.ts`) pointing at the tool page in each language, the current one marked `aria-current="page"` and not a link. Following one is a plain navigation and does not save a language choice. [e2e]
8. Every link on the tool page and the landing resolves to an element on the page or a built file in `out/`. The R0-1 "every link resolves" check covers the new page. [e2e]

### Inputs
The form, in this order (canvas order, plus "Your name" last):

| # | Input | Control | Rule |
|---|---|---|---|
| a | Message language | `Segmented`, four options, two by two at 360px | Always one chosen |
| b | Tone | `Segmented`, two options: Polite, Firm | Always one chosen |
| c | Parent's name | `Field` | Required, 1 to 40 characters after trimming |
| d | Month | A select with the 12 months | Always one chosen |
| e | Amount in ₹ | `Field`, `inputmode="numeric"` | Required, whole rupees, 1 to 1,00,000 |
| f | Your UPI ID | `Field` | Required, PRD pattern |
| g | Your name | `Field` | Required, 1 to 40 characters after trimming |

9. **Message language.** The legend reads "Message language" (the canvas says "Language"; this avoids confusion with the page language). The four options are the endonyms from `src/config/locales.ts`, each with its own `lang`. The starting choice is the page's language. Choosing another changes only the message, never the page's words or address. [e2e]
10. **Tone.** Polite is chosen at the start. Labels only at 360px, as the phone canvas draws them. [e2e]
11. **Fields start empty.** No field is prefilled with an example. Examples appear only as placeholders in the label colour. The UPI ID placeholder is `name@bank`, never a real-looking ID, so a tutor cannot send a stranger's ID by mistake. [e2e]
12. **Parent's name.** Any script, emoji allowed. Leading and trailing spaces are removed and runs of spaces become one space before use. Errors (state word, then message):
    - empty: "Missing" / "Type the parent's name."
    - over 40 characters: "Too long" / "Use 40 characters or fewer."
    [unit]
13. **Month.** The 12 months, named in the page's language in the list. Once the page has loaded it is set to the current month on the phone's clock. The message uses the month's name in the **message** language. No year appears in the list or the message. [unit, e2e with a fixed clock]
14. **Amount.** The tutor types rupees. A leading `₹`, commas and spaces are accepted and ignored. Devanagari, Kannada and Telugu digits are read as 0-9. The value is held in code as integer paise (rupees × 100). Errors:
    - empty: "Missing" / "Type the fee in rupees."
    - a decimal point or paise: "Check this" / "Whole rupees only. Leave out the paise."
    - anything else that is not a digit: "Check this" / "Use digits only, for example 1200."
    - 0: "Too low" / "The amount must be at least ₹1."
    - over 1,00,000: "Too high" / "This tool allows up to ₹1,00,000."
    [unit]
15. When the amount field loses focus with a valid value, it shows the value with Indian grouping and 0-9 digits (`1,200`, `1,00,000`). It is not regrouped while the tutor is typing, so the caret does not jump. [e2e]
16. **Your UPI ID.** Trimmed, then tested against the PRD pattern exactly: `^[\w.\-]{2,256}@[a-zA-Z]{2,64}$`. Letter case is kept as typed. `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`. Errors:
    - empty: "Missing" / "Type your UPI ID, for example name@bank."
    - a space inside: "Check this" / "Remove the spaces."
    - no `@`: "Check this" / "A UPI ID has an @ in it, for example name@bank."
    - any other mismatch: "Check this" / "This does not look like a UPI ID. Copy it from your UPI app."
    [unit]
17. A UPI ID that matches the pattern shows the `Field` correct state with the state word "Format looks right" and the note "We cannot check this with your bank. Read it once more: the money goes to this ID." The page never says the ID is verified. Nothing is checked against a bank or any server. [e2e]
18. **Your name.** Same rule and cleaning as the parent's name. Helper line: "This goes in the payment link." Errors: "Missing" / "Type your name."; "Too long" / "Use 40 characters or fewer." [unit]
19. An error appears when a field loses focus with a value that breaks its rule, and goes as soon as the value is valid. A field that was never touched shows no error. Every error is the `Field` needs-fixing state: a state word beside the label, the error mark, and a message that says how to fix it. Never colour alone. [e2e]
20. Every input has a visible label tied to it. Parent's name, UPI ID and your name have `autocomplete="off"`. [e2e]

### The message
21. The message is built from one template per tone per message language (eight templates) with these placeholders: `{parent}`, `{amount}`, `{month}`, `{link}`, `{upiId}`. Lines are separated by a single line feed. [unit]
22. English templates, exactly:

    Polite:
    ```
    Hello {parent} ji, a gentle reminder that the tuition fee of {amount} for {month} is due. You can pay by UPI with this link:
    {link}
    Or pay to UPI ID: {upiId}
    Thank you!
    ```
    Firm:
    ```
    Hello {parent} ji, the tuition fee of {amount} for {month} is still pending. Please pay it today by UPI with this link:
    {link}
    Or pay to UPI ID: {upiId}
    Thank you.
    ```
    The canvas says "pay in one tap with this link". That promise is not made until a phone proves the link is tappable inside WhatsApp (Open question 5). The plain UPI ID line is added so the parent can always pay, even where the link does nothing. [unit]
23. Draft templates in the other three languages (see criterion 30 for their review status):

    Hindi, polite:
    ```
    नमस्ते {parent} जी, यह याद दिलाना था कि {month} की ट्यूशन फ़ीस {amount} बाकी है। आप इस लिंक से UPI द्वारा भुगतान कर सकते हैं:
    {link}
    या इस UPI ID पर भेजें: {upiId}
    धन्यवाद!
    ```
    Hindi, firm:
    ```
    नमस्ते {parent} जी, {month} की ट्यूशन फ़ीस {amount} अभी तक बाकी है। कृपया आज ही इस लिंक से UPI द्वारा भुगतान कर दें:
    {link}
    या इस UPI ID पर भेजें: {upiId}
    धन्यवाद।
    ```
    Kannada, polite:
    ```
    ನಮಸ್ಕಾರ {parent} ಅವರೇ, {month} ತಿಂಗಳ ಟ್ಯೂಷನ್ ಶುಲ್ಕ {amount} ಬಾಕಿ ಇದೆ ಎಂದು ನೆನಪಿಸುತ್ತಿದ್ದೇನೆ. ಈ ಲಿಂಕ್ ಮೂಲಕ UPI ನಲ್ಲಿ ಪಾವತಿಸಬಹುದು:
    {link}
    ಅಥವಾ ಈ UPI ID ಗೆ ಕಳುಹಿಸಿ: {upiId}
    ಧನ್ಯವಾದಗಳು!
    ```
    Kannada, firm:
    ```
    ನಮಸ್ಕಾರ {parent} ಅವರೇ, {month} ತಿಂಗಳ ಟ್ಯೂಷನ್ ಶುಲ್ಕ {amount} ಇನ್ನೂ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಇಂದೇ ಈ ಲಿಂಕ್ ಮೂಲಕ UPI ನಲ್ಲಿ ಪಾವತಿಸಿ:
    {link}
    ಅಥವಾ ಈ UPI ID ಗೆ ಕಳುಹಿಸಿ: {upiId}
    ಧನ್ಯವಾದಗಳು.
    ```
    Telugu, polite:
    ```
    నమస్కారం {parent} గారు, {month} నెల ట్యూషన్ ఫీజు {amount} చెల్లించాల్సి ఉందని గుర్తు చేస్తున్నాను. ఈ లింక్ ద్వారా UPI లో చెల్లించవచ్చు:
    {link}
    లేదా ఈ UPI ID కి పంపండి: {upiId}
    ధన్యవాదాలు!
    ```
    Telugu, firm:
    ```
    నమస్కారం {parent} గారు, {month} నెల ట్యూషన్ ఫీజు {amount} ఇంకా బాకీ ఉంది. దయచేసి ఈ రోజే ఈ లింక్ ద్వారా UPI లో చెల్లించండి:
    {link}
    లేదా ఈ UPI ID కి పంపండి: {upiId}
    ధన్యవాదాలు.
    ```
    [unit: each template has all five placeholders exactly once]
24. `{amount}` is `formatRupees(paise)`: `₹`, 0-9 digits, Indian grouping, in every message language (`₹1,200`, `₹1,00,000`). [unit]
25. `{month}` is the month's name in the message language. Drafts: [unit]

    | | en | hi | kn | te |
    |---|---|---|---|---|
    | 1 | January | जनवरी | ಜನವರಿ | జనవరి |
    | 2 | February | फ़रवरी | ಫೆಬ್ರವರಿ | ఫిబ్రవరి |
    | 3 | March | मार्च | ಮಾರ್ಚ್ | మార్చి |
    | 4 | April | अप्रैल | ಏಪ್ರಿಲ್ | ఏప్రిల్ |
    | 5 | May | मई | ಮೇ | మే |
    | 6 | June | जून | ಜೂನ್ | జూన్ |
    | 7 | July | जुलाई | ಜುಲೈ | జూలై |
    | 8 | August | अगस्त | ಆಗಸ್ಟ್ | ఆగస్టు |
    | 9 | September | सितंबर | ಸೆಪ್ಟೆಂಬರ್ | సెప్టెంబర్ |
    | 10 | October | अक्टूबर | ಅಕ್ಟೋಬರ್ | అక్టోబర్ |
    | 11 | November | नवंबर | ನವೆಂಬರ್ | నవంబర్ |
    | 12 | December | दिसंबर | ಡಿಸೆಂಬರ್ | డిసెంబర్ |

26. `{parent}` and `{upiId}` are the cleaned values, written as typed. `{link}` is the UPI link of criterion 33. [unit]
27. All eight templates and all four sets of month names are in every language's page when it loads. Changing the message language or tone makes no network request and works with the network off. [e2e]
28. A template is never shown or sent as `TODO-translate` text or silently replaced by English. If the tutor picks Hindi, the message is Hindi. So the `TODO-translate` marker must not be used for templates or month names. [unit]
29. The templates contain no product name, no "sent with" line, no link to us and no claim (no "automatic", no "receipt", no "tracked"). [unit]
30. **Review status is recorded, not hidden.** The hi, kn and te templates and month names above are drafts that no native reader has checked. The spec's build record lists each as "not reviewed" until a named reader signs it off, and `pnpm i18n:check --strict` (the Release 0 gate) fails while any is "not reviewed". These 6 templates are the first thing to send for native review: a parent reads them. [unit for the strict check]

### The UPI link
31. Money never passes through us. The link pays the typed UPI ID directly. The page adds no other payee, no gateway, no reference to us. It stores no card or bank details; the only payment detail it ever holds is the tutor's own UPI ID, in the browser. [unit: `pa` equals the typed ID; reviewer checks]
32. The link has exactly these five parameters in this order and no others (no `mc`, `tr`, `mode`, `sign`):
    `upi://pay?pa={upiId}&pn={name}&am={rupees}&cu=INR&tn={note}` [unit]
33. Encoding rules: [unit]
    - `pa`: the trimmed UPI ID as typed. The `@` stays literal. The pattern allows nothing else that needs encoding.
    - `pn`: the tutor's name through `encodeURIComponent` (a space is `%20`, never `+`; non-Latin names become UTF-8 percent bytes).
    - `am`: rupees with exactly two decimals and no grouping: `1200.00`. (The canvas shows `am=1200`; two decimals is the form every UPI app is expected to accept.)
    - `cu`: always `INR`.
    - `tn`: the English month name, a space, and `fee`, through `encodeURIComponent`: `October%20fee`. It is English in every message language, because a non-Latin note is the part most likely to be dropped or garbled by a UPI app.
    - Example: `upi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee`
34. On the page the link is shown as plain text inside the preview, in DM Mono, wrapping anywhere. It is not a tappable link there: the tutor must not pay themselves, and `upi://` does nothing on a desktop. No QR code is drawn (not in the canvas for this tool; it would need a dependency). [e2e: no `a[href^="upi:"]` on the page]

### The WhatsApp link
35. "Send on WhatsApp" is a real link to exactly `https://wa.me/?text={text}`, with no phone number, where `{text}` is the whole message through `encodeURIComponent` (line feed is `%0A`). The UPI link inside is therefore encoded a second time (`%20` becomes `%2520`), which is correct: WhatsApp decodes once. [unit]
    Example start and link part: `https://wa.me/?text=Hello%20Suresh%20ji%2C%20a%20gentle%20reminder…upi%3A%2F%2Fpay%3Fpa%3Dmeena.tuitions%40okhdfc%26pn%3DMeena%2520Rao%26am%3D1200.00%26cu%3DINR%26tn%3DOctober%2520fee…`
36. Decoding the `text` of the link gives exactly the text in the preview and exactly the text "Copy message" copies. One function builds all three. [unit]
37. The link opens in a new tab (`target="_blank"`, `rel="noopener noreferrer"`), so the typed form is still there when the tutor comes back. [e2e]
38. Length. For the canvas example the full `wa.me` address is under 2,000 characters in each of the four message languages. With every field at its longest in the longest language it is under 6,000 characters. WhatsApp publishes no limit; the long case is checked on a phone (H6). [unit]

### Preview, actions and states
39. Below the form, under the heading "Your message", a bubble (`bubble` token) shows the message as it will be sent, and changes as the tutor types or changes language, tone or month. It carries the `lang` of the message language, `translate="no"`, and its text can be selected by hand. [e2e]
40. While a required value is missing or wrong, its place in the preview shows a drawn blank (a short ruled gap, not colour alone), and a line under the preview says "Fill in the fields above to finish the message." [e2e]
41. "Send on WhatsApp" is the `Button` `send` variant (blue), large, full width at 360px, with the chat icon. "Copy message" is the `outline` variant, full width at 360px. Nothing on the page is a red button. [e2e]
42. Until all four text fields are valid, both buttons are in the `Button` unavailable form (dashed outline, no shadow, does not move) with the reason line "Fill in the fields above first." The unavailable Send has no `href`. [e2e]
43. "Copy message" puts the message on the clipboard. On success its label becomes "Copied" with a tick for about 3 seconds, then returns, and a `role="status"` region announces "Message copied." [e2e]
44. If copying fails or the clipboard is not available, an error line with the error mark says "Could not copy. Press and hold the message to select it." and is announced. Nothing else breaks. [e2e with the clipboard blocked]
45. After Send or Copy the fields keep their values, so the tutor can change the parent's name and send the next one. The page shows no "Sent" stamp or count: it cannot know the message was sent. [e2e]
46. With JavaScript off, the page still shows its heading, form and text in the page's language, plus a translated line: "This tool needs JavaScript turned on." [e2e, JavaScript disabled]

### Privacy
47. From page load until the tutor taps "Send on WhatsApp", the page makes no network request at all while typing, choosing, previewing or copying. No request ever goes to our own origin with typed data. The only request that carries typed data is the `wa.me` link the tutor taps. [e2e: request log]
48. Typed values are never put in the page's address, history, title or any cookie. [e2e]
49. No analytics, pixel, error reporter or third-party script loads on the page. The preview and fields carry `data-ph-no-capture` and `data-sentry-mask` so R0-5 and R1-14 cannot start capturing them by accident. [e2e + reviewer]
50. A short line sits under the form, always visible, not hidden behind a link: "Nothing you type is sent to us or saved on our servers. The message goes to WhatsApp only when you tap Send." [e2e]

### Remember on this phone (Open question 2; the cut line: drop 51 to 54 together if the founder says no)
51. A `Switch` labelled "Remember my UPI ID and name on this phone" sits under "Your name". It is off at the start. [e2e]
52. While it is on, the UPI ID and the tutor's name (only when valid) are kept in the browser's storage on that phone and filled in on the next visit, in any of the four languages. The parent's name, amount, month, tone and message language are never stored. The storage key does not contain the product name. [e2e, unit]
53. Turning it off deletes both stored values at once. A line under the switch says so: "Turn this off to forget them." [e2e]
54. If the browser's storage is blocked, the switch is not shown and the tool works without it. A stored value that no longer passes its rule is ignored and removed. [unit]

### Page copy and honesty
55. Kicker: "Free tool · no sign-up". Headline: "Write the fee reminder you keep putting off." Both from the canvas. [e2e]
56. The yellow block at the foot follows the phone canvas but does not claim the app exists: "Doing this for 20 parents every month?" / "The {brand} app is coming soon. It will remember every student and remind them all in a minute." / a "Join the waitlist" button linking to `/{locale}/#waitlist`. It contains no form (R0-4). [e2e]
57. The page does not mention automatic reminders, payment tracking, receipts, a price or a Pro plan, and no `₹149` or `₹999`. [e2e]
58. Every word on the page comes from the message files; all four files have every new key; `pnpm i18n:check` passes. Interface text in hi, kn, te may be `TODO-translate: <English>` where unsure; the build shows English, never the marker. The no-strings scan and the product-name test stay green. [unit, CI]

### Layout and type
59. At 360px wide, in all four languages, there is no sideways scroll, with empty fields and with the longest allowed values (a 40-character name, a 321-character UPI ID, ₹1,00,000). The UPI ID wraps and its field grows; nothing is cut off. [e2e]
60. With root font size at 200%, no text is clipped or overlaps, no label is cut, and there is no sideways scroll. Segments, fields and buttons grow in height. [e2e, all four pages]
61. Every link, button, segment, the select and the switch is at least 44px high and 44px wide. No text is under 14px. [e2e]
62. On `/hi/`, `/kn/`, `/te/` the page text uses that script's Anek with letter-spacing 0 and no uppercase. Amounts, the UPI ID and the UPI link never use Anek: the link and UPI ID are DM Mono. Only Tailwind tokens are used (`pnpm lint` token check). Corners 4px at most on buttons; the bubble follows the canvas shape. [e2e, CI]
63. When the message language differs from the page language, the preview is drawn in the phone's own font for that script, with line-height at least 1.6. No extra font file is fetched. [e2e: request log]
64. Status is always a word plus a mark: field errors (19), the UPI format note (17), the copied confirmation (43), the copy error (44), the unavailable buttons (42). [manual + e2e on the words]

### SEO
65. Each language's tool page has its own `<title>` and `<meta name="description">` from its message file, in the delivered HTML. English title, 60 characters or fewer: "Fee reminder writer for tutors: WhatsApp message + UPI link". English description, 155 or fewer: "Write a polite or firm tuition fee reminder in English, Hindi, Kannada or Telugu, with your UPI payment link. Free, no sign-up, nothing saved." [e2e: raw HTML, four different titles and descriptions]
66. Each page has `<link rel="canonical">` to `https://{brand.domain}/{locale}/tools/fee-reminder/` and the same five `hreflang` alternates on all four (`en`, `hi`, `kn`, `te`, and `x-default` pointing at `/en/tools/fee-reminder/`), absolute, with the trailing slash, built by `src/lib/seo.ts` extended to take a path. `og:title`, `og:description`, `og:url`, `og:locale` are set; no `og:image`. The landing's own tags do not change. [unit + e2e]

### Size and checks
67. Initial JavaScript for each of the four tool routes is 150 KB gzipped or less (target), 200 KB hard limit, measured by `pnpm size`, which must list the new routes. `/`, `/en/`, `/hi/`, `/kn/`, `/te/` stay within 0.5 KB of 132.1 KB. Measured numbers go in the build record. [CI]
68. No new dependency is added. [reviewer]
69. `pnpm check:leak` covers the tool pages too: a tool page carries no other language's **interface** words. The eight templates and the month names are the one named exception, because criterion 27 needs them on every page. [CI]
70. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, `pnpm size`, `pnpm i18n:check`, `pnpm check:404` pass. R0-1's e2e tests are updated only where criteria 3 to 5 change the landing. [CI]

## Edge cases
- **Very long names.** 40 characters is the limit; the field shows "Too long". The preview and the bubble wrap.
- **Emoji and non-Latin names.** Allowed in both names. In `pn` they are percent-encoded. A Telugu name in an English message is fine.
- **Name already ends in "ji".** "Suresh ji" gives "Hello Suresh ji ji". Not handled; the preview shows it and the tutor fixes it.
- **Amount 0, empty, huge, with paise, with commas, with a Hindi keyboard's digits.** Criterion 14.
- **UPI ID with odd but valid characters** (`ravi_kumar.99-a@okaxis`, a phone-number ID `9876543210@ybl`, upper case). All pass the PRD pattern and go into the link unchanged. Underscores may be read by WhatsApp as italics; checked on a phone (H5). If the ID arrives changed, the fix is to wrap it in WhatsApp's code marks, as a follow-up.
- **UPI ID that is well formed but wrong.** We cannot know. Criterion 17 says so in words. The plain ID line in the message lets the parent see who they are paying.
- **No phone number.** There is no phone field. WhatsApp opens its own contact chooser. (Open question 4 covers a number with spaces, a leading 0 or `+91`.)
- **Message length.** Criterion 38.
- **Desktop.** `wa.me` opens WhatsApp Web or the desktop app. The `upi://` link in the message is for the parent's phone; the page shows it as text only (34).
- **Offline or slow network after the page has loaded.** Typing, preview, language and tone changes and copying work. Sending needs WhatsApp. There is no offline banner and no service worker in Release 0, so the page cannot be opened fresh with no network.
- **Clipboard blocked.** Criterion 44.
- **Storage blocked or private mode.** Criterion 54.
- **Shared family phone.** Remembering is off unless the tutor turns it on, and one switch forgets (51 to 53).
- **Large font, second language.** Criteria 59 to 63.
- **Duplicates.** Tapping Send twice opens WhatsApp twice. Nothing is tracked, so nothing can warn.
- **Partial payment.** The tutor types what is still owed. The link carries that amount.
- **The parent opens an old message.** The link has no expiry and no server behind it. It still pays the UPI ID and amount written at the time, even if the tutor has since changed either. The tutor sends a new message.
- **Phone clock wrong.** The month starts on the wrong month; the tutor picks another.
- **Right-to-left.** Not needed for these four languages.

## Out of scope
- **A parent phone number and direct chat (`wa.me/91…`).** PRD Release 1, slice R1-8. (Open question 4)
- **A student name in the message.** Not in the PRD row or canvas. (Open question 3)
- **A due date, a year, late fees, several months in one message.** Not in the PRD.
- **A pay page (`/p/{token}`), "I've paid", QR code, copy-UPI-ID fallback for the parent.** R1-9.
- **Logging reminders, "sent" state, auto-reminders.** R1-8 and Release 2.
- **The waitlist form on this page** (the desktop canvas draws it inline). R0-4. This slice links to `#waitlist` on the landing.
- **The receipt maker and any link to it.** R0-3.
- **Sitemap, `robots.txt`, `og:image`, structured data, PostHog page events, a jump page at the unprefixed address.** R0-5. R0-5 must keep criterion 49 true: no capture of typed values on this page.
- **A referral or "Free for tutors" line in the message** (PRD §5 growth loop). Referral links arrive in R1-13; the canvas message has none.
- **Native-speaker review.** Before Release 0 ships. Drafts now, tracked by criterion 30.
- **Desktop two-column layout.** The page must be right at 360px and not break wider.

## Design references
- `design/project/Tool-reminder-m.dc.html`: the phone layout. **Source of truth for layout.**
- `design/project/Tool-reminder.dc.html`: desktop, for copy (tone detail lines, month select, the `tn` parameter).
- `design/project/Landing-m.dc.html`, `Landing.dc.html`: the tool card and hero link.
- Components: `Segmented`, `Field`, `Button`, `Slip`, `Switch`. Tokens: `cloth`, `stitch`, `page-ruled`, `slip`, `bubble`, `highlight`, `blue`, `ink`.
- Deliberate differences from the canvas: fields start empty (11); "Your name" field (Open question 1); the remember switch (Open question 2); legend "Message language" with endonyms (9); message wording and the plain UPI ID line (22); `pn` added and `am` with two decimals (33); no "Receipt maker" header link (6); footer language links (7); the yellow block says "coming soon" and has no form (56); the privacy line (50).

## Analytics
None. The PRD's events belong to the signed-in app (Release 1) and PostHog is wired in R0-5. This page loads no script but its own.

## Test by hand on a phone
Only a real phone can prove the two links. The founder has deferred phone checks until the app works end to end, but H1 to H3 decide whether this tool does its job, so run them before Release 0 ships.
- **H1.** On Android, fill the form and tap "Send on WhatsApp". WhatsApp opens, asks who to send to, and the message is whole, with line breaks, in each of the four message languages.
- **H2.** Send it to a second phone. In the received message, is the `upi://` link blue and tappable? Check on Android WhatsApp and on an iPhone. Write down the answer (Open question 5).
- **H3.** Open the link on the parent phone with Google Pay, PhonePe and Paytm. Each shows the tutor's name, the amount and the note "October fee". Try ₹1,200 and ₹5,000; note any app that refuses the larger one.
- **H4.** Tap "Copy message", paste into WhatsApp and into SMS. The text is the same as the preview.
- **H5.** Use a UPI ID with two underscores (`a_b_c@okaxis`). It arrives unchanged in WhatsApp.
- **H6.** Longest case: Telugu message, 40-character Telugu names, a long UPI ID. WhatsApp still opens with the whole message.
- **H7.** Phone font at the largest, page in Kannada: nothing cut off, nothing sideways, every control easy to hit with a thumb.
- **H8.** Turn "Remember" on, close the browser, reopen: UPI ID and name are back. Turn it off, reopen: they are gone.
- **H9.** Read all six hi, kn, te templates with someone who reads each language. Polite must sound warm; firm must sound firm, not rude.

## Open questions
Each has a recommendation. The implementer proceeds on it unless told otherwise.

1. **A "Your name" field.** The PRD row and canvas have no tutor name, but the PRD's UPI link format is `pa, pn, am, cu, tn` and `pn` is the payee's name. *Recommendation: add one required field, "Your name" (criterion 18).* Leaving `pn` out risks a UPI app refusing the link. Alternative: no field, no `pn`, as the canvas draws.
2. **Remember the tutor's UPI ID and name on the phone?** The PRD is silent. *Recommendation: yes, behind a switch that is off at the start, with one tap to forget (51 to 54).* A retyped UPI ID is where a typo sends money to a stranger; many tutors share a family phone, so not by default. Say no and criteria 51 to 54 drop with no other change.
3. **Student name in the message.** The brief asked for it; the PRD and canvas use the parent's name only. *Recommendation: leave it out.* Fewer fields, and we handle no child's name on a public page. Add it only if tutors with two children in one family ask.
4. **Parent's phone number for a direct chat.** The brief asked for it; the PRD gives this tool `https://wa.me/?text=` only and keeps `wa.me/91XXXXXXXXXX` for Release 1. *Recommendation: leave it out.* If you want it: optional field; strip spaces, dashes, a leading `+91`, `91` or `0`; accept 10 digits starting 6 to 9; use as `https://wa.me/91XXXXXXXXXX?text=…`; error "Type a 10-digit mobile number." It would also mean parents' numbers are typed into a public page, never sent to us.
5. **Is a `upi://` link tappable inside WhatsApp?** I believe WhatsApp only makes `http` and `https` links tappable, which would make the link in the message plain text. This is not verified here; H2 answers it. I also recall some UPI apps capping or refusing payments from plain links to personal UPI IDs above about ₹2,000; H3 checks that. *Recommendation: ship as the PRD says, with the plain UPI ID line as the fallback and no "one tap" promise. If H2 fails, add a small static pay page on our domain that the message links to with `https`, reading the details from the part of the address after `#` so they never reach a server. That is new scope: a separate slice, your decision.*
6. **Amount limits.** *Recommendation: whole rupees, ₹1 to ₹1,00,000.* Monthly tuition fits; paise would only cause typos.
7. **The unprefixed address `/tools/fee-reminder`** named in the PRD. *Recommendation: leave it as a 404 now; add a jump page (like `/`) in R0-5 if you plan to share the short address.*
8. **English wording of the two messages** (criterion 22), and "ji" after the name in English. *Recommendation: as drafted; "ji" is from the canvas.*
9. **Who reviews Hindi, Kannada and Telugu?** *Recommendation: name one reader per language now and send them the six templates first (criterion 30).*

## Conflicts and gaps in the PRD and canvas
- **PRD address is unprefixed; F3 chose prefixed languages.** Resolved: prefixed, question 7.
- **PRD inputs have no tutor name; the PRD's link format needs `pn`.** The canvas link has no `pn`. Question 1.
- **Canvas link is `am=1200`, and the phone canvas drops `tn`.** Spec uses `am=1200.00` and always sends `tn`.
- **Canvas fields are prefilled with a real-looking UPI ID.** Spec starts empty (11).
- **Canvas says "pay in one tap".** Unproven inside WhatsApp. Question 5.
- **Canvas language names are English exonyms.** Spec uses endonyms, as F3 decided for language names.
- **Canvas header links to a receipt maker and the desktop canvas embeds the waitlist form.** Neither exists yet.
- **Canvas says "The app remembers every student".** Reworded to "coming soon" (56).
- **The canvas has no error, empty, copied, or unavailable states, no privacy line, no footer, no firm-tone text.** Written here.
- **PRD §5 says every reminder shows "Free for tutors" and a referral link.** Not possible before referrals exist; left out.
- **No select component exists.** The month needs one; see hand-off 3.
- **`TODO-translate` cannot be used for templates** (it would send English when Hindi was chosen), so the strict check needs a second rule (30).
- **No PRD format for a month alone.** Decided here for this tool: the full month name, no year. R1-6 decides its own.

## Hand-off
Next: `tech-lead` appends the technical plan to this file, `docs/specs/R0-2-reminder-generator.md`. Decisions that are theirs:
1. Route files under `src/app/[locale]/` (whether to introduce `(public)` now), and how `src/lib/seo.ts` takes a path (66).
2. One pure module for cleaning, validation, the message, the UPI link and the `wa.me` link, with unit tests; the preview, Copy and Send all read from it (36).
3. The month control: a native `<select>` styled as a `Field`, added to `src/components/ui/` with its states, or another approach. No dependency.
4. Where the eight templates and 48 month names live so that every page has all of them (27), they still go through the message files, `check:leak` stays strict for interface words (69), and the "not reviewed" record drives `--strict` (30). One option: the same template values in all four files, with a test that the four copies match.
5. Client text: `ClientMessages` (about +12 KB, 144 KB) or server-rendered labels passed as props. Measure and record (67). Extend `pnpm size` and `check:leak` to the tool routes.
6. The month's starting value without a hydration mismatch (13), and the clipboard fallback (44).
7. The footer and header: reuse the landing components with a path, or small new ones (6, 7).
8. Which R0-1 tests change (3 to 5) and the new `e2e/fee-reminder.spec.ts`, including the request-log checks (47, 63).
