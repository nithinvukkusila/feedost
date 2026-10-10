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

## Decided by the founder, 2026-10-10
Answered by the founder directly in chat on 2026-10-10.

- **Open question 3, student name: no.** The message carries the parent's name only. No student-name field.
- **Open question 4, parent phone: no.** No phone field. The link is `https://wa.me/?text=…` with no number, as the PRD says for Release 0.
- **Open question 2, remember on this phone: yes.** The tutor's UPI ID and name may be kept on the phone, behind a `Switch` that starts off, with one tap to forget. Criteria 51 to 54 stay in.
- **Open question 1, a "Your name" field for `pn`:** proceeding on the recommendation (one required field, criterion 18).
- **Open question 5, whether `upi://` is tappable inside WhatsApp:** proceeding on the recommendation (ship as the PRD says, plain UPI ID line as the fallback, no "one tap" promise; H2 and H3 on a phone decide whether a later slice is needed).
- **Open question 6, amount limits:** proceeding on the recommendation (whole rupees, ₹1 to ₹1,00,000).
- **Open question 7, the unprefixed address:** proceeding on the recommendation (404 now; a jump page is R0-5's call).
- **Open question 8, English wording and "ji":** proceeding on the recommendation (as drafted in criterion 22).
- **Open question 9, reviewers:** proceeding on the recommendation (one reader per language, the six templates first). No reader is named yet; see "Needs the founder" in the plan.

## Technical plan — R0-2

Written by `tech-lead` on 2026-10-10. There is no backend work: no table, migration, policy, function or Edge Function, and no Supabase call. Every task is `frontend-dev` or `test-engineer`.

Things marked **(verified)** were checked on 2026-10-10 in `node_modules/next/dist/docs/` (Next.js 16.4.0), by throwaway builds in this checkout (a prototype page, island, library and templates file, all deleted afterwards; `git status` shows only this spec), by `pnpm size` and `pnpm check:leak` on those builds, by `pnpm exec eslint` on the prototype, and by a throwaway Playwright probe at 360px against `out/`. Nothing here was checked on a real phone; section 19 lists what only a phone can answer.

### 1. Approach

One new static route, `src/app/[locale]/tools/fee-reminder/page.tsx`, prerendered four times. The page is a Server Component (header, kicker, `h1`, the "needs JavaScript" line, the yellow block, the footer, the metadata) around **one client island**, `ReminderTool`, which holds the form, the preview and the two buttons. The island's words reach it as a plain typed object in a prop, not through `ClientMessages`, because the provider measured 152.5 KB on this route and the prop measured 140.3 KB (section 13). Everything the tutor's typing turns into (cleaned values, errors, the message, the `upi://` link, the `wa.me` link) comes from one pure module, `src/lib/reminder/reminder.ts`, that the preview, Copy and Send all read. The eight templates and 48 month names live once, in `src/lib/reminder/templates.json`, outside the four message files, the way language names live once in `src/config/locales.ts`; `check:leak` names that file as its single exception and `i18n:check` gains a review record for it.

### 2. Split and size

One pull request, size M as the spec says. `frontend-dev` owns all code and the unit tests beside it. `test-engineer` owns `e2e/` (the new `e2e/fee-reminder.spec.ts` and the changed assertions in `e2e/landing.spec.ts`) and checks that every criterion in section 14 has a test that can fail.

**Cut line: after build step 6.** At that point the tool works in four languages, the landing links to it and every check is green. Step 7 is "Remember on this phone" (criteria 51 to 54); the spec already says those four drop together with no other change. If time runs out, ship without step 7 and note it in the build record. Nothing else is safe to cut: the landing links (step 6) are how a tutor finds the tool.

### 3. Dependencies

**None added.** No runtime package, no dev package, no `pnpm-workspace.yaml` change. What the slice needs comes from the platform:

| Need | Used | Why not a library |
| --- | --- | --- |
| Month list | A native `<select>` (section 7) | A select library is a dependency and tens of KB |
| Copy | `navigator.clipboard.writeText`, then `document.execCommand("copy")` | Two calls |
| Remember | `localStorage` in `try/catch` | `idb` is for the signed-in app |
| Encoding | `encodeURIComponent` | Exactly the rule the spec states |
| Review record hash | `node:crypto` in the check script | Already in Node |
| Validation | Hand-written, four small functions | `zod` is approved in the build plan but is not installed, and four regex checks do not need it |

No QR code (criterion 34), no PostHog, no Sentry on this page (criterion 49).

### 4. Route and client boundary

```
src/app/[locale]/tools/fee-reminder/page.tsx    Server Component: metadata, shell, hands words to the island
src/components/tools/tool-header.tsx            Server: cloth bar, brand name as a link to /{locale}/
src/components/reminder/reminder-tool.tsx       "use client": the one island
src/components/landing/landing-footer.tsx       Server, reused with a new optional `path` prop
```

- **No `(public)` route group yet.** `src/CLAUDE.md` names `src/app/[locale]/(public)/` for later; the landing sits at `src/app/[locale]/page.tsx` today and several tests name that path. A group does not change an address, so it can be added when `(app)` arrives by moving files. Adding it now is churn with no gain.
- **The locale and static rendering (verified).** The page reads the language exactly as the landing does: `generateMetadata({ params })` for the head, and `getLocale()` / `getMessages()` / `getTranslations()` from `next-intl/server` in the page body. The build prerendered `/en/tools/fee-reminder`, `/hi/…`, `/kn/…`, `/te/…` as `● (SSG)` under the existing `generateStaticParams` of the locale layout, with `<html lang>` right in each file and no `NEXT_STATIC_GEN_BAILOUT` line in the log. No new `generateStaticParams`, no `rootParams` outside `src/i18n/request.ts`.
- **What is server and what is client.** Server: the header, the kicker, the `h1`, the `<noscript>` line, the yellow block with its link, the footer. Their words cost no JavaScript. Client: one component, because the form, the preview and both buttons all change with every keystroke. Splitting the island further saves nothing: `Field` is already a client component and the preview needs every field's state.
- **Words for the island: a typed object in a prop (verified).** The page calls `getWords("reminderForm")` (new, `src/i18n/words.ts`, section 12) and passes the result as `words`; it also passes `pageLocale`. The island reads `words.parent.label`, `words.amount[error].fix` and so on. The object is typed from `messages/en.json`, so a wrong key is a type error, as with `useTranslations`. `loadMessages` has already turned every `TODO-translate` value into its English text. There is no `NextIntlClientProvider` on this route, so the ICU parser (12.2 KB gzipped here) is not shipped. `ClientMessages` stays in the repo for a later screen that needs plurals or arguments in the browser.
- **The rule that makes that safe.** Nothing parses these strings in the browser, so a namespace handed over as words must hold plain text only. `src/i18n/words.ts` exports `plainNamespaces = ["reminderForm"]`, and `src/i18n/words.test.ts` fails if any value under a listed namespace, in any of the four files, contains `{`, `}`, `<` or `>`. The one sentence on this page that needs an argument (`{brand}` in the yellow block) is in the server namespace `reminder`, not in `reminderForm`.
- **Two namespaces, so the island gets only what it needs.** `reminder` (server words: `meta.title`, `meta.description`, `kicker`, `title`, `noscript`, `promo.title`, `promo.body`, `promo.join`) and `reminderForm` (the island's words, 56 keys; list in section 12). Only `reminderForm` of the page's language is in the page's payload; the build's Hindi page carried no other namespace and no other language (`check:leak` passed).
- **Before the JavaScript arrives.** The island wraps all its controls in one `<fieldset disabled={!hydrated}>`, where `hydrated` comes from `useSyncExternalStore(subscribeToNothing, () => true, () => false)`. In the delivered HTML the form is drawn but cannot be typed into; it wakes up when React has hydrated. Reason: a controlled field is set back to its state when React hydrates, so on slow 4G a tutor's first letters would vanish. (I searched the installed `react-dom-client.production.js` for the change-event replay that would prevent this, `queueChangeEvent`, and it is not there; I did not run a browser test of the loss itself.) It also makes criterion 46 honest: with JavaScript off the form is visibly there, inert, under the line that says the tool needs JavaScript. Not in the spec; see section 17.
- **No `<form>` element.** Criterion 48 says typed values never reach the address. A `<form>` with named radios can be submitted by Enter before hydration and would put `?tone=polite` in the address; with no form element nothing on the page can submit. `Field` handles Enter itself (it prevents the line break and, with no form, does nothing else). The island's root is a `div`; the two `Segmented` groups keep their own `fieldset` and `legend`.
- **Landmarks (criterion 6).** `ToolHeader` renders the one `<header>`; the page renders the one `<main>` with the one `<h1>`; `LandingFooter` renders the one `<footer>`. "Your message" and the yellow block's title are `h2`.

### 5. Templates in four languages on every language page

**Where they live.** `src/lib/reminder/templates.json`, one file, one copy:

```json
{
  "en": { "polite": ["Hello {parent} ji, a gentle reminder …", "{link}", "Or pay to UPI ID: {upiId}", "Thank you!"],
          "firm":   ["…", "{link}", "Or pay to UPI ID: {upiId}", "Thank you."],
          "months": ["January", "…", "December"] },
  "hi": { "polite": […], "firm": […], "months": […] },
  "kn": { … },
  "te": { … }
}
```

Each template is an array of lines, joined with one line feed (criterion 21). The text is the spec's, criteria 22, 23 and 25, character for character **(verified: the prototype file matched the spec's eight blocks and 48 names by an exact string comparison)**. The island imports this file, so all of it is in the tool route's own script chunk and in no other route's **(verified: 80 of 80 lines were in the one chunk only the four tool pages load; none in the HTML; the landing pages did not load that chunk)**. That is criterion 27: changing message language or tone reads memory, not the network.

**Why not in the four message files.** Hand-off 4 offered "the same template values in all four files, with a test that the four copies match". I do not take it: four copies of text a parent reads, kept equal by a test, is three chances to edit the wrong one; a translator opening `hi.json` would find Kannada and Telugu in it; and the templates would pass through the `TODO-translate` strip, which is the very thing criterion 28 forbids. The repo already has the pattern for "the same in every language, so it is not a message": the endonyms in `src/config/locales.ts`. The select's month names for the page come from this file too (`months` of the page's language), so there is one list of month names, not two.

**How `check:leak` treats them: one named exception, and wider cover.** Changes to `scripts/check-locale-leak.mjs`:

1. **Every language page is checked, not only the landing.** For each language the script walks `out/{locale}/` and checks every `index.html` it finds, with that page's own scripts. A future page is covered without touching the script. The four landing pages and the four tool pages must exist (fail closed, as today).
2. **The exception is a constant at the top of the file:** `const EXCEPTIONS = [{ pages: "tools/fee-reminder/", file: "src/lib/reminder/templates.json" }]`. For a page under that path, and **only in its script files, never its HTML**, every template line and every month name from that file is removed from the text (both spellings the script already knows: raw and JSON-escaped, longest first) before the search for another language's values. So a Hindi interface word that happens to sit inside a Hindi template does not fail the English tool page, but the same word anywhere else on that page still does.
3. **The exception is itself checked, both ways.** On each tool page at least one template line of each of the other three languages must be found in its scripts, or the script fails with "the fee reminder page does not carry the hi templates" (this is criterion 27 proved from the build, and it stops a stale exception). On every page **not** under an exception path, no template line of another language may appear in its HTML or scripts, or it fails with "the hi templates leaked onto /en/": the templates must not ride into the landing.
4. Nothing else changes: values equal in all four files are still not a leak, `TODO-translate` values still count as their English text, the "no page shows its own words" guard stays.

**How `i18n:check` treats them.** `scripts/i18n-check-lib.mjs` gains an exported `checkTemplates(file, reviewFile, { strict })`, and `scripts/i18n-check.mjs` calls it with `src/lib/reminder/templates.json` and `src/lib/reminder/templates.review.json` when the first exists (the throwaway folders of the existing tests have neither, so those tests do not change). Rules, each naming the language and the template:

| Rule (criterion) | Example output |
| --- | --- |
| Exactly the keys `en`, `hi`, `kn`, `te`; each has `polite` and `firm` (arrays of non-empty strings) and `months` (12 different non-empty strings) | `templates.json "kn.months" has 11 names, expected 12` |
| Each template holds `{parent}`, `{amount}`, `{month}`, `{link}`, `{upiId}` exactly once, and no other brace (21, 23) | `templates.json "te.firm": {link} appears 0 times` |
| `{link}` is a line by itself (the link must end at a line feed, so nothing can be glued to it) | `templates.json "hi.polite": {link} must be alone on its line` |
| No value contains `TODO-translate` (28) | `templates.json "kn.polite" contains TODO-translate; a template cannot be marked, see the review record` |
| `hi` text contains Devanagari, `kn` Kannada, `te` Telugu, and no template equals the English one (28: English pasted in is not a translation) | `templates.json "hi.firm" has no Devanagari text` |
| The review record (30), below | |

The summary line becomes: `i18n: 56 keys present in all 4 languages; 45 values marked TODO-translate; 8 templates, 3 languages not reviewed (hi, kn, te)` (56 and 45 are today's numbers **(verified)**; both grow in this slice).

**The "not reviewed" record (criterion 30).** `src/lib/reminder/templates.review.json`, read only by the check and by a unit test, never imported by app code (so it is in no bundle):

```json
{
  "hi": { "status": "not reviewed", "reviewer": "", "date": "", "sha256": "" },
  "kn": { "status": "not reviewed", "reviewer": "", "date": "", "sha256": "" },
  "te": { "status": "not reviewed", "reviewer": "", "date": "", "sha256": "" }
}
```

- One entry per language. It covers that language's two templates and twelve month names together: one reader reads them in one sitting. English is the source and has no entry.
- A language counts as **reviewed** only when `status` is `"reviewed"`, `reviewer` is a name, `date` is `YYYY-MM-DD`, and `sha256` equals the SHA-256 of `JSON.stringify({ polite, firm, months })` for that language as the file stands now. **Editing a template after sign-off changes the hash and the language is "not reviewed" again by itself**; nobody has to remember to reset it.
- Plain `pnpm i18n:check` (what CI runs) prints the count and, for each language not reviewed, its current hash to copy into the record (`hi: not reviewed; current text 3fa9…`). It exits 0. CI stays green with drafts.
- `pnpm i18n:check --strict` (the Release 0 gate) adds one problem per language not reviewed, `templates.json "hi" is not reviewed (2 templates, 12 month names): get a native reader's sign-off and record it in templates.review.json`, and one for a hash that no longer matches, `templates.json "hi" changed after the review of 2026-10-20 by <name>`. It exits 1. It already exits 1 today for the 45 `TODO-translate` values **(verified)**, so this adds a second, separate reason; both must be cleared before Release 0.
- A malformed record (a missing language, a status other than the two, "reviewed" with no name) is a problem in the plain run too.
- `frontend-dev` copies the three "not reviewed" lines into the build record at the end of this spec; the JSON file is the record the gate reads.

### 6. The pure library: `src/lib/reminder/reminder.ts`

No React, no DOM, no `Intl`, no storage. It imports `formatRupees`, the `Locale` type and `templates.json`. Everything is a plain function, tested without a browser. The exact API:

```ts
export type Tone = "polite" | "firm";
export const NAME_MAX = 40;
export const MIN_PAISE = 100;          // ₹1
export const MAX_PAISE = 10_000_000;   // ₹1,00,000
export const UPI_ID = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;   // the PRD pattern, no flags

export type Checked<V, E extends string> = { ok: true; value: V } | { ok: false; error: E };
export type NameError = "missing" | "tooLong";
export type AmountError = "missing" | "paise" | "notDigits" | "tooLow" | "tooHigh";
export type UpiIdError = "missing" | "space" | "noAt" | "format";

export function cleanName(raw: string): string;
export function checkName(raw: string): Checked<string, NameError>;        // parent's name and "Your name"
export function checkAmount(raw: string): Checked<number, AmountError>;    // value is integer paise
export function checkUpiId(raw: string): Checked<string, UpiIdError>;
export function amountInput(paise: number): string;                         // "1,200": what the field shows after blur
export function monthName(locale: Locale, month: number): string;           // month is 0 to 11
export function currentMonth(now?: Date): number;                           // the phone's clock, local time

export function upiLink(input: { upiId: string; payeeName: string; paise: number; month: number }): string;

export type Slot = "parent" | "amount" | "month" | "link" | "upiId";
export type Part =
  | { kind: "text"; text: string }
  | { kind: "value"; slot: Slot; text: string }
  | { kind: "blank"; slot: Slot };
export type ReminderInput = {
  locale: Locale; tone: Tone;
  parent: string | null; paise: number | null; month: number | null;
  upiId: string | null; payeeName: string | null;       // null = missing or not valid yet
};
export function reminderParts(input: ReminderInput): Part[];
export function reminderText(parts: readonly Part[]): string | null;        // null while any part is blank
export function whatsAppLink(message: string): string;
```

**One function builds all three (criterion 36).** The island calls `reminderParts` once per render. The preview draws the parts (a `blank` part is the drawn gap of criterion 40; `link` and `upiId` values get DM Mono). `reminderText(parts)` is what Copy copies. `whatsAppLink(reminderText(parts))` is the Send link. There is no second place where a message is put together.

**Rules, in the order the code applies them.**

- `cleanName`: walk the string by code point. White space of any kind (tab, line feed, no-break space) becomes a space; control characters (U+0000 to U+001F, U+007F to U+009F) and **lone surrogates** are dropped; then runs of spaces become one and the ends are trimmed. A lone surrogate must go because `encodeURIComponent` throws `URIError` on one **(verified)**, and that would break Send. No lookbehind in any regex (older Safari cannot parse it and the whole script would fail).
- `checkName`: `cleanName`, then `missing` if empty, `tooLong` if `Array.from(value).length > 40`. Length is counted in **code points**, not UTF-16 units and not `Intl.Segmenter` clusters: an emoji counts 1, a Telugu syllable counts 2 or 3. It is the one count that is the same on every phone.
- `checkAmount`: map Devanagari (U+0966 to U+096F), Kannada (U+0CE6 to U+0CEF) and Telugu (U+0C66 to U+0C6F) digits to 0-9; remove spaces, commas and `₹`; then `missing` if nothing is left; `paise` if only digits and dots remain and there is a dot; `notDigits` if anything else is not a digit; strip leading zeros; `tooHigh` if more than 7 digits remain (so a 20-digit paste never reaches `Number`); paise = rupees × 100; `tooLow` under 100; `tooHigh` over 10,000,000.
- `checkUpiId`: trim; `missing` if empty; `space` if any white space is inside; `noAt` if there is no `@`; `format` if `UPI_ID` does not match; otherwise the value as typed, case kept.
- `upiLink`: throws `RangeError` unless `upiId` matches `UPI_ID`, `payeeName` is not empty, `paise` is a whole multiple of 100 from 100 to 10,000,000 and `month` is a whole number 0 to 11. It then returns exactly `` `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${rupees}.00&cu=INR&tn=${encodeURIComponent(englishMonth + " fee")}` ``. `pa` is written as it is: the pattern admits only letters, digits, `_`, `.`, `-` and the one `@`, none of which needs encoding, and the throw guarantees that. `tn` always uses `templates.en.months`.
- `reminderParts`: join the template's lines with `\n`, **split on the five placeholders first, then fill the pieces**. A value is never searched for placeholders, so a parent named `{link}` or `$&` comes out as typed (a chain of `String.replace` calls would get both wrong).
- `whatsAppLink`: `` `https://wa.me/?text=${encodeURIComponent(message)}` ``. The inner link's `%20` becomes `%2520` and each line feed `%0A` by that one call.

**Unit-test table for `src/lib/reminder/reminder.test.ts`.** Every expected string below was produced by running a prototype of these rules under Vitest and Node in this repo **(verified)**; the `RangeError` rows are the rule as stated above and were not run. `frontend-dev` writes the tests from the table, not from their own code's output.

| Call | Result |
| --- | --- |
| `checkName("")`, `checkName("   ")`, `checkName("\u0007")` | `{ ok: false, error: "missing" }` |
| `checkName("  Suresh  ")` | value `"Suresh"` |
| `checkName("Suresh   Kumar")`, `checkName("\tSuresh  Kumar\n")` | value `"Suresh Kumar"` |
| `checkName("a".repeat(40))`, `checkName(" " + "a".repeat(40) + " ")` | ok, 40 characters |
| `checkName("a".repeat(41))` | `tooLong` |
| `checkName("🙂".repeat(40))` (80 UTF-16 units) | ok |
| `checkName("🙂".repeat(41))` | `tooLong` |
| `checkName("క".repeat(40))` / `("క".repeat(41))` | ok / `tooLong` |
| `checkName("వెంకట సుబ్బారావు")`, `checkName("Suresh 🙂")`, `checkName("R&D #1 100% A+B")` | ok, value unchanged |
| `checkName("A\uD83D")` (lone surrogate) | value `"A"` |
| `checkName("Su\u0000resh")` | value `"Suresh"` |
| `checkName("a‍b")` (joiner kept: Indian scripts and emoji need it) | value unchanged, 3 code points |
| `checkAmount("")`, `("  ")`, `("₹")` | `missing` |
| `checkAmount("1200")`, `("1,200")`, `("₹ 1,200")`, `("1 200")` | value `120000` |
| `checkAmount("१२००")`, `("೧೨೦೦")`, `("౧౨౦౦")`, `("१,२००")` | value `120000` |
| `checkAmount("1")` | value `100` |
| `checkAmount("0012")` | value `1200` |
| `checkAmount("100000")`, `("1,00,000")` | value `10000000` |
| `checkAmount("100001")`, `("1,00,001")`, `("99999999999999999999")` | `tooHigh` |
| `checkAmount("0")`, `("000")` | `tooLow` |
| `checkAmount("1200.50")`, `("1200.00")`, `("1200.")`, `(".50")`, `(".")`, `("1.2.3")`, `("१२००.५०")` | `paise` |
| `checkAmount("12a")`, `("-5")`, `("1e3")`, `("1200/-")`, `("Rs 1200")`, `("١٢٠٠")` (Arabic-Indic digits are not one of our three scripts) | `notDigits` |
| `checkUpiId("")`, `("   ")` | `missing` |
| `checkUpiId("  meena.tuitions@okhdfc  ")` | value `"meena.tuitions@okhdfc"` |
| `checkUpiId("meena tuitions@okhdfc")`, `("meena.tuitions@ok hdfc")` | `space` |
| `checkUpiId("meena.tuitions")` | `noAt` |
| `checkUpiId("meena@")`, `("@okhdfc")`, `("m@okhdfc")`, `("meena@o")`, `("meena@ok1")`, `("meena@@okhdfc")`, `("मीना@okhdfc")`, `("meena+fees@okhdfc")`, `("meena%40x@okhdfc")`, `("meena&x@okhdfc")`, `("meena#1@okhdfc")` | `format` |
| `checkUpiId("ravi_kumar.99-a@okaxis")`, `("a_b_c@okaxis")`, `("9876543210@ybl")`, `("me@ok")` | ok, value unchanged |
| `checkUpiId("Meena.Rao@OkHDFC")` | ok, value `"Meena.Rao@OkHDFC"` (case kept) |
| `checkUpiId("a".repeat(256) + "@" + "b".repeat(64))` (321 characters) | ok |
| `checkUpiId("a".repeat(257) + "@okhdfc")`, `("meena@" + "b".repeat(65))` | `format` |
| `amountInput(100)`, `(120000)`, `(500000)`, `(10000000)` | `1`, `1,200`, `5,000`, `1,00,000` |
| `monthName("en", 9)`, `("hi", 9)`, `("kn", 9)`, `("te", 9)` | `October`, `अक्टूबर`, `ಅಕ್ಟೋಬರ್`, `అక్టోబర్` |
| `currentMonth(new Date(2026, 9, 10))`, `(new Date(2026, 0, 1))`, `(new Date(2026, 11, 31, 23, 59))` | `9`, `0`, `11` |

`upiLink`, with `B = { upiId: "meena.tuitions@okhdfc", payeeName: "Meena Rao", paise: 120000, month: 9 }`:

| Input | Exact result |
| --- | --- |
| `B` | `upi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee` |
| `payeeName: "R&D Classes #1 100% A+B"` | `upi://pay?pa=meena.tuitions@okhdfc&pn=R%26D%20Classes%20%231%20100%25%20A%2BB&am=1200.00&cu=INR&tn=October%20fee` |
| `payeeName: "A/B? C=D"` | `…&pn=A%2FB%3F%20C%3DD&am=1200.00&cu=INR&tn=October%20fee` |
| `payeeName: "D'Souza (Maths)!*~"` (the characters `encodeURIComponent` leaves alone) | `…&pn=D'Souza%20(Maths)!*~&am=1200.00&cu=INR&tn=October%20fee` |
| `payeeName: "मीना राव"` | `…&pn=%E0%A4%AE%E0%A5%80%E0%A4%A8%E0%A4%BE%20%E0%A4%B0%E0%A4%BE%E0%A4%B5&am=1200.00&cu=INR&tn=October%20fee` |
| `payeeName: "ಮೀನಾ ರಾವ್"` | `…&pn=%E0%B2%AE%E0%B3%80%E0%B2%A8%E0%B2%BE%20%E0%B2%B0%E0%B2%BE%E0%B2%B5%E0%B3%8D&am=1200.00&cu=INR&tn=October%20fee` |
| `payeeName: "మీనా రావు"` | `…&pn=%E0%B0%AE%E0%B1%80%E0%B0%A8%E0%B0%BE%20%E0%B0%B0%E0%B0%BE%E0%B0%B5%E0%B1%81&am=1200.00&cu=INR&tn=October%20fee` |
| `payeeName: "Meena 🙂"` | `…&pn=Meena%20%F0%9F%99%82&am=1200.00&cu=INR&tn=October%20fee` |
| `payeeName: "a".repeat(40)` | `…&pn=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&am=1200.00&cu=INR&tn=October%20fee` |
| `upiId: "ravi_kumar.99-a@okaxis"` | `upi://pay?pa=ravi_kumar.99-a@okaxis&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee` |
| `upiId: "9876543210@ybl", paise: 100, month: 0` | `upi://pay?pa=9876543210@ybl&pn=Meena%20Rao&am=1.00&cu=INR&tn=January%20fee` |
| `paise: 500000, month: 4` | `…&am=5000.00&cu=INR&tn=May%20fee` |
| `paise: 10000000, month: 11` | `…&am=100000.00&cu=INR&tn=December%20fee` |
| throws `RangeError` | `upiId: "meena tuitions@okhdfc"`, `upiId: "meena"`, `payeeName: ""`, `paise: 0`, `paise: 120050`, `paise: 10000100`, `paise: 1200.5`, `month: 12`, `month: -1`, `month: 1.5` |

Also asserted for every row that does not throw: the result starts `upi://pay?pa=`; its parameter names, split on `&`, are exactly `pa, pn, am, cu, tn` in that order; it contains no `+`, no space, none of `mc=`, `tr=`, `mode=`, `sign=`; `am` matches `/^\d+\.00$/` with no comma; and the text between `pa=` and `&pn=` equals the `upiId` given (criterion 31).

The message and the WhatsApp link, with `F = { parent: "Suresh", paise: 120000, month: 9, upiId: "meena.tuitions@okhdfc", payeeName: "Meena Rao" }`:

| Case | Exact result |
| --- | --- |
| `reminderText(reminderParts({ locale: "en", tone: "polite", ...F }))` | `"Hello Suresh ji, a gentle reminder that the tuition fee of ₹1,200 for October is due. You can pay by UPI with this link:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nOr pay to UPI ID: meena.tuitions@okhdfc\nThank you!"` |
| `en`, `firm` | `"Hello Suresh ji, the tuition fee of ₹1,200 for October is still pending. Please pay it today by UPI with this link:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nOr pay to UPI ID: meena.tuitions@okhdfc\nThank you."` |
| `hi`, `polite` | `"नमस्ते Suresh जी, यह याद दिलाना था कि अक्टूबर की ट्यूशन फ़ीस ₹1,200 बाकी है। आप इस लिंक से UPI द्वारा भुगतान कर सकते हैं:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nया इस UPI ID पर भेजें: meena.tuitions@okhdfc\nधन्यवाद!"` |
| `kn`, `firm` | `"ನಮಸ್ಕಾರ Suresh ಅವರೇ, ಅಕ್ಟೋಬರ್ ತಿಂಗಳ ಟ್ಯೂಷನ್ ಶುಲ್ಕ ₹1,200 ಇನ್ನೂ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಇಂದೇ ಈ ಲಿಂಕ್ ಮೂಲಕ UPI ನಲ್ಲಿ ಪಾವತಿಸಿ:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nಅಥವಾ ಈ UPI ID ಗೆ ಕಳುಹಿಸಿ: meena.tuitions@okhdfc\nಧನ್ಯವಾದಗಳು."` |
| `te`, `polite` | `"నమస్కారం Suresh గారు, అక్టోబర్ నెల ట్యూషన్ ఫీజు ₹1,200 చెల్లించాల్సి ఉందని గుర్తు చేస్తున్నాను. ఈ లింక్ ద్వారా UPI లో చెల్లించవచ్చు:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nలేదా ఈ UPI ID కి పంపండి: meena.tuitions@okhdfc\nధన్యవాదాలు!"` |
| The other three (`hi` firm, `kn` polite, `te` firm) | Built the same way; the test compares each to its template from the spec with the five values put in by hand in the test file |
| `whatsAppLink` of the `en` `polite` message (390 characters) | `https://wa.me/?text=Hello%20Suresh%20ji%2C%20a%20gentle%20reminder%20that%20the%20tuition%20fee%20of%20%E2%82%B91%2C200%20for%20October%20is%20due.%20You%20can%20pay%20by%20UPI%20with%20this%20link%3A%0Aupi%3A%2F%2Fpay%3Fpa%3Dmeena.tuitions%40okhdfc%26pn%3DMeena%2520Rao%26am%3D1200.00%26cu%3DINR%26tn%3DOctober%2520fee%0AOr%20pay%20to%20UPI%20ID%3A%20meena.tuitions%40okhdfc%0AThank%20you!` |
| `whatsAppLink` with `parent: "Asha & Ravi #2 100% A+B"`, `payeeName: "R&D Classes #1 100% A+B"` (`en`, `polite`) | `https://wa.me/?text=Hello%20Asha%20%26%20Ravi%20%232%20100%25%20A%2BB%20ji%2C%20a%20gentle%20reminder%20that%20the%20tuition%20fee%20of%20%E2%82%B91%2C200%20for%20October%20is%20due.%20You%20can%20pay%20by%20UPI%20with%20this%20link%3A%0Aupi%3A%2F%2Fpay%3Fpa%3Dmeena.tuitions%40okhdfc%26pn%3DR%2526D%2520Classes%2520%25231%2520100%2525%2520A%252BB%26am%3D1200.00%26cu%3DINR%26tn%3DOctober%2520fee%0AOr%20pay%20to%20UPI%20ID%3A%20meena.tuitions%40okhdfc%0AThank%20you!` |
| The `hi` `polite` link starts | `https://wa.me/?text=%E0%A4%A8%E0%A4%AE%E0%A4%B8%E0%A5%8D%E0%A4%A4%E0%A5%87%20Suresh%20%E0%A4%9C%E0%A5%80%2C%20` and contains `%0Aupi%3A%2F%2Fpay%3Fpa%3Dmeena.tuitions%40okhdfc%26pn%3DMeena%2520Rao%26am%3D1200.00%26cu%3DINR%26tn%3DOctober%2520fee%0A` |
| `parent: "{link} {amount} $& $1 $$"` (`en`, `polite`), first line | `Hello {link} {amount} $& $1 $$ ji, a gentle reminder that the tuition fee of ₹1,200 for October is due. You can pay by UPI with this link:` |
| `reminderParts({ locale: "en", tone: "firm", parent: null, paise: 120000, month: null, upiId: null, payeeName: "Meena Rao" })` | text `"Hello "`, blank `parent`, text `" ji, the tuition fee of "`, value `amount` `"₹1,200"`, text `" for "`, blank `month`, text `" is still pending. Please pay it today by UPI with this link:\n"`, blank `link`, text `"\nOr pay to UPI ID: "`, blank `upiId`, text `"\nThank you."` |
| `reminderText` of those parts | `null` |
| The link slot | blank unless `upiId`, `payeeName`, `paise` and `month` are all present |

And for all eight language and tone pairs, with `F`:

- `decodeURIComponent(link.slice("https://wa.me/?text=".length)) === message` (criterion 36).
- The link starts `https://wa.me/?text=`, has no character after `wa.me/` before `?` (no phone number), contains no space, no `+`, no raw line feed, and exactly three `%0A`.
- The message has exactly three `\n`, no `\r`, no two in a row, and its second line is exactly the `upiLink` result.
- Length (criterion 38), measured: the eight links for `F` are 381 to 1,358 characters (`te` polite is the longest), all under 2,000. With every field at its longest (`"క".repeat(40)` for both names, the 321-character UPI ID, ₹1,00,000, September) they are 1,933 to 2,926; with 40 emoji as both names, up to 3,141. All under 6,000. The test asserts `< 2000` and `< 6000`.

**`src/lib/reminder/templates.test.ts`** (criteria 21, 23, 25, 28, 29): each of the eight templates has the five placeholders exactly once; the spec's month table equals `months` in each language (typed out in the test, 48 names); no value contains `TODO-translate`; no template in any language contains `http`, `www`, the brand domain, or (English, case-insensitive) `automatic`, `receipt`, `tracked`, `sent with`; the product-name test already scans `src/**/*.json`, so the name cannot enter the file.

### 7. The month select: `src/components/ui/select-field.tsx`

A native `<select>`, no dependency. One finding changed its shape.

**A native select cannot wrap its own text (verified).** Styled exactly like `Field` (20px bold on a 2px line), with the root font size at 200% on a 360px screen, the select is 200px wide and "September" is 218px: Chromium drew `Septemb` and clipped the rest, and `white-space: normal` on the select changed nothing. That fails criterion 60 and the design rule that a label is never cut.

**So the select is real but its text is not what you see.** `SelectField` draws:

- a `<label>` above, in `type-label`, tied to the select with `htmlFor`;
- a wrapper on the field line (`field-line-2 border-ink`, `min-h-control`, and through the existing `typing` variant the 4px blue line and blue label while the select has focus, exactly as `Field`);
- inside it, a `<span aria-hidden="true">` showing the chosen option's label in `type-value text-blue wrap-anywhere`, and a small drawn chevron (`aria-hidden`), so it reads as a list and not a text box;
- the `<select>` itself laid over the whole wrapper (`absolute inset-0 size-full cursor-pointer appearance-none opacity-0`). It takes the tap, the keyboard and the screen reader; the phone opens its own list.

In the probe the visible name wrapped onto a second line at 200%, the wrapper grew to 138px, the select grew with it, there was no sideways scroll, and Playwright's `selectOption` still worked **(verified)**.

- **Props:** `label`, `value: string`, `onChange(value: string)`, `options: readonly { value: string; label: string }[]`, `helper?`, `id?`, `disabled?`, plus `DataAttributes` for the select. Controlled only: the visible name is found from `value`. No state and no `"use client"`, like `Segmented`.
- **States:** rest, focus (the `typing` look; also forced with `data-force="focus"` for the dev page), disabled (the island's fieldset before hydration). There is no error state: one month is always chosen.
- **Accessibility:** a real `<select>` with a real `<label>`; the visible copy and the chevron are hidden from screen readers so the name is not read twice; the target is the whole wrapper, at least 48px high and the full width (criterion 61); focus is shown by the thick blue line, as on `Field`, so the default outline is removed.
- **Indian-script type rules:** the label and the visible value use the existing roles, so on `/hi/`, `/kn/`, `/te/` they are Anek with no letter-spacing, no capitals and the taller line-height, with no per-language code. A select in the value role measured 48, 54, 53 and 50px high at 100% (en, hi, kn, te), so the taller Indian-script line fits; the wrapper has a minimum height, not a fixed one. The list the phone opens is drawn by the phone.
- **The dev page** gets a small section, `src/app/dev/components/sections/select-field.tsx` (rest, forced focus, the longest month, four language blocks), and `src/components/ui/no-strings.test.ts` lists fourteen files instead of thirteen.
- **In the island:** options are the twelve `monthName(pageLocale, i)` (the list is in the **page** language, criterion 13); values are `"0"` to `"11"`.

**The starting month without a hydration mismatch.** `const phoneMonth = useSyncExternalStore(subscribeToNothing, currentMonth, () => null)` and `const [picked, setPicked] = useState<number | null>(null)`; the month in use is `picked ?? phoneMonth`. The server render has `null` (the select shows January, the preview shows a blank for the month and the link, and the fieldset is disabled); the first client render after hydration has the phone's month. No `useEffect`, no `setState` in an effect. `pnpm lint` rejects the obvious version: I ran it on a prototype that set state from an effect and got `react-hooks/set-state-in-effect` as an **error (verified)**. The e2e test fixes the clock with `page.clock` before `goto`.

### 8. Remember on this phone: `src/lib/reminder/remember.ts` (criteria 51 to 54)

```ts
export const REMEMBER_KEY = "reminder-payee";            // no product name in it
export type Payee = { upiId: string; name: string };
export function storageWorks(): boolean;                  // write and remove a probe key once, then remember the answer
export function readRaw(): string | null;                 // getItem in try/catch; null when blocked
export function parsePayee(raw: string | null): Payee | null;   // pure: JSON.parse in try/catch, then checkUpiId and checkName
export function savePayee(payee: Payee): boolean;         // setItem in try/catch
export function forgetPayee(): void;                      // removeItem in try/catch
```

- **What exactly is stored:** one key, `reminder-payee`, in `localStorage`, holding `{"v":1,"upiId":"<cleaned UPI ID>","name":"<cleaned tutor name>"}`. Nothing else: no parent name, amount, month, tone, message language, date or count. No cookie, no `sessionStorage`, no IndexedDB. `localStorage` belongs to the origin, so all four language pages see the same value (criterion 52).
- **Only when the switch is on.** The island writes in one small effect that only writes and never sets state: when `remember` is on and both `checkUpiId` and `checkName` pass, `savePayee` the two cleaned values. When either is not valid it writes nothing (the last valid pair stays).
- **Forget is one tap and immediate.** Turning the switch off calls `forgetPayee()` in the switch's own handler, in the same tick. The values stay in the fields (the tutor may still be sending); only the stored copy goes. **Trap:** a prefilled field shows `saved`, and `saved` becomes `null` the moment the key is removed, so the handler must first copy what the two fields show into `typedUpi` and `typedName`, then forget. A render test turns the switch off on a prefilled form and checks both fields still hold their text.
- **Never read during the server render.** `const raw = useSyncExternalStore(subscribeToNothing, readRaw, () => null)` and `const saved = useMemo(() => parsePayee(raw), [raw])`. The field values are derived, not copied into state: `const [typedUpi, setTypedUpi] = useState<string | null>(null)` and the value shown is `typedUpi ?? saved?.upiId ?? ""`; the same for the name; the switch is `choice ?? (saved !== null)`. Again no `setState` in an effect.
- **A stored value that no longer passes** (`parsePayee` returns `null` for a `raw` that is not `null`): ignored, and removed by a write-only effect (criterion 54).
- **Blocked storage or private mode:** every call is in `try/catch`. `const canRemember = useSyncExternalStore(subscribeToNothing, storageWorks, () => false)`; when false the switch and its line are not rendered at all and the tool works without them (criterion 54). `storageWorks` keeps its answer in a module variable so it probes once, not on every render.
- **The switch:** the existing `Switch`, with `labelledBy` pointing at a `<label htmlFor>` holding "Remember my UPI ID and name on this phone" (tapping the words works too), `onText` and `offText` from `words.remember`. Off at the start on a phone with nothing stored.
- `remember.test.ts` covers: round trip; the key has no product name and the stored JSON has exactly `v`, `upiId`, `name`; `getItem`, `setItem`, `removeItem` each throwing; no `localStorage` at all; `parsePayee` on `null`, not JSON, an array, a missing field, a number, an invalid UPI ID, a 41-character name, a name with outer spaces (not the cleaned form, so rejected).

### 9. Copy, Send and the privacy proof

- **Copy: `src/lib/reminder/copy-text.ts`**, `export async function copyText(text: string): Promise<boolean>`. It tries `navigator.clipboard.writeText(text)` when it exists; if that is missing or rejects, it falls back to a hidden read-only `<textarea>` appended to `body`, `select()`, `document.execCommand("copy")`, then removes it. Any throw gives `false`. Never rejects.
- **Confirmation (criteria 43, 44, 64).** On `true`: the button's label becomes `words.copied` with a tick icon for 3 seconds (a `setTimeout` set in the click handler, cleared on unmount), and one `<p role="status">` under the buttons, **in the page from the first render and empty until then**, gets a tick and `words.copiedStatus`. A live region that is added at the moment of the message is often not read out; an empty one that fills is. On `false`: the same region gets the error mark and `words.copyFailed` in the needs-fixing look, and the button does not change. Word plus mark both times; `role="status"` is polite, so it does not interrupt.
- **Send (criteria 35, 37, 41, 42).** `Button variant="send" size="large" full` with `href={whatsAppLink(message)}`, `target="_blank"`, `rel="noopener noreferrer"` and the chat icon from the canvas. It is a real link: no click handler, no `window.open`, so it works with a long press and a screen reader. While the message is `null` both buttons get `disabled`; `Button` then renders the link with **no `href`**, dashed, no shadow. One shared line, `words.fillFirst`, sits under the two buttons with an id that both name in `aria-describedby` (not `disabledReason` twice, which would print the sentence twice).
- **The preview (criteria 34, 39, 40, 63).** A `<p lang={messageLocale} translate="no">` with `whitespace-pre-wrap wrap-anywhere select-text`, `bg-bubble`, a 2px ink border and the canvas corner shape (section 12, tokens). Parts are drawn in order: text as text; `link` and `upiId` values in a `<span>` with `type-amount-row text-blue` (DM Mono); a blank as an inline ruled gap (`inline-block w-12 border-b-2 border-dashed border-ink`) with `role="img"` and `aria-label={words.preview.blank}`, so a screen reader does not read "Hello  ji". No `<a>` anywhere in it, so there is no `a[href^="upi:"]`.
- **The preview's font: one rule.** The bubble always uses a new role, `type-message` (section 12): the Latin stack, 17px, line-height 1.6, no letter-spacing. Latin text is Bricolage; Devanagari, Kannada and Telugu text falls through to the phone's own font, whatever the page language. The same trick the footer's endonyms use, and the `Segmented` language labels here use `type-endonym` for the same reason. Measured: the English tool page fetched Bricolage and DM Mono only, with all four message languages shown in turn **(verified)**. See section 17, item 5.
- **DM Mono must be there before typing starts (criterion 47).** On `/hi/`, `/kn/`, `/te/` nothing is drawn in DM Mono until the link first appears in the preview, so the font file was fetched **while typing**: one request, in the probe, on each of the three pages **(verified)**. It carries no typed data, but criterion 47 says no request at all. Fix: when the island mounts it asks for the font once, `document.fonts.load("500 1rem " + getComputedStyle(document.documentElement).getPropertyValue("--font-dm-mono"))`, feature-detected, in an effect that sets no state. With that call made at load, the probe saw **zero** requests during typing, language changes and tone changes on all four pages **(verified)**.
- **No request by the page itself (criterion 47), proved by test.** The island has no `fetch`, no `XMLHttpRequest`, no `sendBeacon`, no image, no form. e2e: record every request with the existing `recordRequests`, open the page, wait for fonts to settle, note the count; then fill all four fields, change language four times, tone twice, month, turn the switch on and off, press Copy; the count has not changed. A second test does the same with `context.setOffline(true)` after load and checks the preview still changes (criterion 27). A third routes `https://wa.me/**` to a stub, taps Send, and checks that exactly one request left the page's context, to `wa.me`, in a new tab, with the form still filled behind it. A unit test reads `reminder-tool.tsx`, `reminder.ts`, `remember.ts` and `copy-text.ts` and fails on `fetch(`, `XMLHttpRequest`, `sendBeacon`, `new Image`, `import(`, `from "posthog`, `from "@sentry`, `document.cookie`, `history.`, `location.` (not on the bare word `sentry`: the `data-sentry-mask` attribute is meant to be there).
- **Never in the address, title or a cookie (criterion 48):** no `<form>` (section 4), no router call, no `document.title` write. e2e: fill everything, press Enter in each field; `location.href`, `history.length`, `document.title` and `document.cookie` are what they were.
- **Capture guards (criterion 49):** `data-ph-no-capture=""` and `data-sentry-mask=""` on the island's root, on each `Field` (they pass through to the `<textarea>`; `Field`'s mirror already has them), on the select and on the preview.

### 10. Landing edits in this slice (criteria 3, 4, 5)

| File | Change |
| --- | --- |
| `src/components/landing/tools.tsx` | Card 1 unchanged (tag, not a link). Card 2: no "Coming soon" tag; under its body a `Button variant="outline" full href={localeHref(locale, feeReminderPath)}` labelled `landing.tools.t2.open` ("Write a reminder", the canvas's words). The file comment loses "R0-2 turns card 2 into a link". |
| `src/components/landing/hero.tsx` | Under the main button, a plain text link `landing.hero.tool` ("or write a free reminder now") to the tool: `flex min-h-tap items-center justify-center type-body font-bold underline text-on-cloth ring:ground-ring`, as the canvas draws it. |
| `messages/*.json` | `landing.tools.title`: en `Two free tools.`; hi `दो मुफ़्त टूल।`; kn `ಎರಡು ಉಚಿತ ಉಪಕರಣಗಳು.`; te `రెండు ఉచిత సాధనాలు.` (each is today's value with its second sentence removed, so no new translation). New keys `landing.hero.tool` and `landing.tools.t2.open` in all four. `landing.tools.tag` stays (card 1 uses it). |

**R0-1 assertions that change** (`test-engineer` edits `e2e/landing.spec.ts`; `frontend-dev` edits `src/components/landing/landing.test.tsx`; both in build step 6 so nothing is red between commits):

| Test | Today | Becomes |
| --- | --- | --- |
| e2e "criterion 10: every a[href] is #waitlist or a language page, and resolves" | the set is `#waitlist` and three language pages; at least 5 links | the set also has `/{lang}/tools/fee-reminder/`; at least 7 links; `builtFileFor` proves the new address is a built file |
| e2e "criterion 15: two tool cards … they are not links" | both cards have the tag and no link | card 1 as before; card 2 has no tag and exactly one link, to the tool, at least 44px high |
| e2e "criterion 16: no tool links, no second hero link" | no `a[href*="tools"]` | exactly two links to the tool (hero and card 2), none whose address contains `receipt`; `a[href="#waitlist"]` is still 2; card 1's title is still not a link name |
| e2e "criterion 11" (header and hero buttons) | finds the hero button | unchanged if it finds the button by name; if it takes "the link in the hero", it must take the first |
| e2e JavaScript-off test | anchors and language links work | also follows the hero's tool link and lands on the tool page's `h1` |
| unit "hero … has no link to a tool (criterion 16)" | every hero link is `#waitlist` | the hero has two links: `#waitlist` and `/en/tools/fee-reminder/` |
| unit "tools: two cards that are not links … `Two free tools. Coming soon.`" | no `a`, tag twice, old heading | one `a` (card 2), the tag once, heading `Two free tools.` |

Not changed: criteria 1 (reads the heading from the message file), 14 (the landing still has no form or input), 17, 19 to 21 (the new links are measured by the same loops), 26, 27, 32, 33 and the 404 spec. The new hero and card words must not contain "WhatsApp" or "help" in any language, or R0-1's criterion 33 test will flag them.

### 11. SEO (criteria 65, 66)

- `src/config/routes.ts` (new): `export const feeReminderPath = "tools/fee-reminder/"` and `export function localeHref(locale: Locale, path = ""): string` returning `` `/${locale}/${path}` ``. The tool card, the hero link, the footer and the page all use it; the address is typed once.
- `src/lib/seo.ts`: `canonicalUrl(locale: Locale, path = "")` and `alternateUrls(path = "")`. `path` is `""` or segments each ending in `/` with no leading slash; anything else (`"/tools"`, `"tools/fee-reminder"`, `"a//b/"`) throws `RangeError`. With no argument both return exactly what they return today, so the landing's tags do not change and its tests do not move.
- The page's `generateMetadata` mirrors the landing's: `title` and `description` from `reminder.meta` (no `{brand}` in this title), `alternates: { canonical: canonicalUrl(locale, feeReminderPath), languages: alternateUrls(feeReminderPath) }`, `openGraph: { type: "website", title, description, url, locale: ogLocale(locale) }`. No `og:image`. **(verified in the build: the Hindi page had its own `<title>`, description, `canonical` to `https://{domain}/hi/tools/fee-reminder/`, `og:title`, `og:description`, `og:url`, `og:locale` `hi_IN`.)**
- The English title is 59 characters and the description 142 (counted). The other three languages need their own drafts within the same limits; a `TODO-translate` title would give four identical titles and fail criterion 65, so `reminder.meta.title` and `.description` must be drafted, not flagged.
- `seo.test.ts` adds: the tool path for each language; the five alternates with `x-default` on `/en/tools/fee-reminder/`; the throwing cases. `src/app/[locale]/tools/fee-reminder/metadata.test.ts` mirrors the landing's `metadata.test.ts`.

### 12. Files

Owner is `frontend-dev` unless the row says `test-engineer`.

**Create**

| File | What goes in it |
| --- | --- |
| `src/lib/reminder/templates.json` | Section 5. The eight templates as arrays of lines and the 48 month names, exactly as criteria 22, 23 and 25. |
| `src/lib/reminder/templates.review.json` | Section 5. Three entries, all "not reviewed". |
| `src/lib/reminder/reminder.ts`, `reminder.test.ts` | Section 6. |
| `src/lib/reminder/templates.test.ts` | Section 6, last paragraph. |
| `src/lib/reminder/remember.ts`, `remember.test.ts` | Section 8. Build step 7. |
| `src/lib/reminder/copy-text.ts`, `copy-text.test.ts` | Section 9. Tests: clipboard resolves; clipboard missing and `execCommand` true; clipboard rejects and `execCommand` true; both fail; `execCommand` throws; the temporary textarea is always removed. |
| `src/config/routes.ts`, `routes.test.ts` | `feeReminderPath`, `localeHref`. |
| `src/i18n/words.ts`, `words.test.ts` | `getWords(namespace)` (server only: `getMessages()` and return the one typed subtree) and `plainNamespaces`. Test: the plain-text rule of section 4 on all four files; `reminderForm` has the same shape in all four. |
| `src/components/ui/select-field.tsx`, `select-field.test.tsx` | Section 7. Tests: label tied to the select; the visible copy shows the chosen option and is `aria-hidden`; `onChange` gets the value; `data-*` reach the select; disabled; no words of its own. |
| `src/app/dev/components/sections/select-field.tsx` | The dev-page section. |
| `src/components/tools/tool-header.tsx` | The cloth bar: the brand name (from `brand.ts`) as a link to `localeHref(locale)`, at least 44px high, `ring:ground-ring`. No other link. R0-3 adds the link between the two tools here. |
| `src/components/reminder/reminder-tool.tsx`, `reminder-tool.test.tsx` | The island. Props: `words: Messages["reminderForm"]`, `pageLocale: Locale`. Order: message language, tone, parent's name, month, amount, UPI ID, your name, the remember switch (step 7), the privacy line, "Your message", the bubble, the line under it, Send, Copy, the shared reason line, the status region. Render tests in jsdom with the real `en.json` words: fields start empty with placeholders (11); no error before blur, error after blur, gone when valid (19); each error's word and sentence (12, 14, 16, 18); the UPI correct state and note (17); amount regroups on blur and not while typing (15); blanks and the line under the preview (40); both buttons unavailable with no `href`, then available (42); language and tone change the bubble and its `lang` (9, 10, 39); the source scan of section 9 (47). |
| `src/app/[locale]/tools/fee-reminder/page.tsx`, `metadata.test.ts` | Sections 4 and 11. The yellow block is a `<section>` with `bg-highlight`, a 2px ink border and `shadow-slip` (not `Slip`, whose colour is fixed), an `h2`, the `{brand}` sentence and `Button variant="record" size="large" full href={localeHref(locale) + "#waitlist"}`. The `<noscript>` line sits above the island. |
| `e2e/fee-reminder.spec.ts`, `e2e/fee-reminder-helpers.ts` (`test-engineer`) | Section 14. |

**Change**

| File | Change |
| --- | --- |
| `messages/en.json`, `hi.json`, `kn.json`, `te.json` | All four in the same commit, three times: step 4 (`reminder`), step 5 (`reminderForm`), step 6 (the landing keys of section 10). English values below. In hi, kn, te a value is a draft or `TODO-translate: <English>`, except `reminder.meta.title` and `.description`, which must be drafts (section 11). |
| `src/lib/seo.ts`, `seo.test.ts` | Section 11. |
| `src/components/landing/landing-footer.tsx` | Optional `path` prop (default `""`); each language link goes to `localeHref(code, path)`. Nothing else changes; the landing passes nothing. |
| `src/components/landing/tools.tsx`, `hero.tsx`, `landing.test.tsx` | Section 10. |
| `src/styles/type.css`, `type.test.ts` | One new role: `@utility type-message { font-family: var(--font-sans); font-size: 1.0625rem; line-height: 1.6; letter-spacing: 0em; }`. |
| `src/styles/tokens.css`, `tokens.test.ts` | One new radius, `--radius-bubble: 18px`, for the message bubble only (`rounded-bubble rounded-tl-sm`); the test's exact list of radii gains it. |
| `docs/DESIGN.md` | One line under "Shape and depth": the WhatsApp preview bubble has 18px corners, 4px at its top-left. A token rule, so the founder sees it in the pull request (section 19). |
| `scripts/check-locale-leak.mjs` | Section 5. |
| `scripts/i18n-check-lib.mjs`, `scripts/i18n-check.mjs` | Section 5. |
| `scripts/size.mjs` | `REQUIRED` gains the four `xx/tools/fee-reminder/index.html`, so the new routes cannot pass by being absent (criterion 67). |
| `src/lib/size-scripts.test.ts` | The fake `out/` gains the four tool pages. New leak cases: a tool page with all templates in its script passes; a tool page missing the `kn` templates fails; a template line in a landing page's script fails; a `hi` interface value in the tool page's script outside any template fails; the same value inside a template line passes; a template line in a tool page's **HTML** in another language fails. New size case: a missing tool page fails. |
| `src/lib/i18n-check.test.ts` | One passing and one failing folder per rule of section 5; the review record: plain run passes and prints the count and the hashes; `--strict` fails naming the language; a matching hash with a name and date passes `--strict`; a changed template after review fails `--strict` with "changed after the review"; a malformed record fails the plain run; the real files pass the plain run. |
| `src/components/ui/no-strings.test.ts` | Fourteen files, `select-field.tsx` added to the list. |
| `src/app/dev/components/page.dev.tsx` | Adds the section. |
| `src/CLAUDE.md` | Two lines: the layout block gains `src/lib/reminder/` and `src/components/tools/`; the strings rule gains "or, for a client island that needs only plain words, `getWords()` in the server page (see `src/i18n/words.ts`)". A repo guide, handed to `frontend-dev` as in F3. |
| `e2e/landing.spec.ts` (`test-engineer`) | Section 10. |

**No change:** `next.config.ts`, `package.json`, `pnpm-workspace.yaml`, the lockfile, `.github/workflows/ci.yml` (it already runs `pnpm i18n:check`, `pnpm size`, `pnpm check:leak`; the new rules ride on the same commands), `src/app/[locale]/layout.tsx`, `src/i18n/request.ts`, `Field`, `Segmented`, `Switch`, `Button`, `Slip`, `supabase/`.

**New message keys (English).** `reminder` (server):

| Key | English |
| --- | --- |
| `reminder.meta.title` | Fee reminder writer for tutors: WhatsApp message + UPI link |
| `reminder.meta.description` | Write a polite or firm tuition fee reminder in English, Hindi, Kannada or Telugu, with your UPI payment link. Free, no sign-up, nothing saved. |
| `reminder.kicker` | Free tool · no sign-up |
| `reminder.title` | Write the fee reminder you keep putting off. |
| `reminder.noscript` | This tool needs JavaScript turned on. |
| `reminder.promo.title` | Doing this for 20 parents every month? |
| `reminder.promo.body` | The {brand} app is coming soon. It will remember every student and remind them all in a minute. |
| `reminder.promo.join` | Join the waitlist |

`reminderForm` (the island; plain text only). Each error is an object `{ word, fix }` keyed by the library's error code, so `words.amount[result.error]` is typed and a new error code without words is a type error. In the table an error row gives the word, then the fix:

| Key | English |
| --- | --- |
| `language`, `tone`, `polite`, `firm` | Message language / Tone / Polite / Firm |
| `parent.label`, `parent.placeholder` | Parent's name / Suresh |
| `parent.missing`, `parent.tooLong` | Missing, Type the parent's name. / Too long, Use 40 characters or fewer. |
| `month.label` | Month |
| `amount.label`, `amount.placeholder` | Amount in ₹ / 1,200 |
| `amount.missing` | Missing, Type the fee in rupees. |
| `amount.paise` | Check this, Whole rupees only. Leave out the paise. |
| `amount.notDigits` | Check this, Use digits only, for example 1200. |
| `amount.tooLow`, `amount.tooHigh` | Too low, The amount must be at least ₹1. / Too high, This tool allows up to ₹1,00,000. |
| `upi.label`, `upi.placeholder` | Your UPI ID / name@bank |
| `upi.missing` | Missing, Type your UPI ID, for example name@bank. |
| `upi.space`, `upi.noAt` | Check this, Remove the spaces. / Check this, A UPI ID has an @ in it, for example name@bank. |
| `upi.format` | Check this, This does not look like a UPI ID. Copy it from your UPI app. |
| `upi.ok.word`, `upi.ok.note` | Format looks right / Format looks right. We cannot check this with your bank. Read it once more: the money goes to this ID. |
| `payee.label`, `payee.placeholder`, `payee.helper` | Your name / Meena Rao / This goes in the payment link. |
| `payee.missing`, `payee.tooLong` | Missing, Type your name. / Too long, Use 40 characters or fewer. |
| `remember.label`, `remember.on`, `remember.off`, `remember.note` | Remember my UPI ID and name on this phone / ON / OFF / Turn this off to forget them. |
| `privacy` | Nothing you type is sent to us or saved on our servers. The message goes to WhatsApp only when you tap Send. |
| `preview.title`, `preview.incomplete`, `preview.blank` | Your message / Fill in the fields above to finish the message. / blank |
| `send`, `copy`, `copied`, `copiedStatus` | Send on WhatsApp / Copy message / Copied / Message copied. |
| `copyFailed`, `fillFirst` | Could not copy. Press and hold the message to select it. / Fill in the fields above first. |

`name@bank` is the same in all four files. Landing keys are in section 10.

### 13. Bundle and the size proof

Measured with `pnpm size` on throwaway builds in this checkout (Next 16.4.0, Turbopack, same machine, `rm -rf .next out` before each). The prototype island had the whole form, validation, preview, Send, Copy and the remember switch, with `Field`, `Segmented`, `Switch`, `Button`, `Slip` and all of `templates.json`.

| Route | Today (before) | Island under `ClientMessages` | Island with words in a prop (**chosen**) |
| --- | --- | --- | --- |
| `/` | 132.1 KB | 132.1 KB | 132.1 KB |
| `/en/` `/hi/` `/kn/` `/te/` | 132.1 KB each | 132.1 KB each | 132.1 KB each |
| `/en/tools/fee-reminder/` and the other three | n/a | **152.5 KB** each (over the 150 KB target; `pnpm size` printed `WARN`) | **140.3 KB** each |
| `/dev/components/` | 138.8 KB | 138.9 KB | 138.9 KB |
| `/dev/supabase/` | 135.1 KB | 135.1 KB | 135.1 KB |
| `404.html` | 132.1 KB | 132.1 KB | 132.1 KB |

- **The other routes do not grow.** The four landing pages, `/` and the 404 are byte-for-byte the same 132.1 KB in all three builds: the tool's two chunks are loaded only by the four tool pages. (`/dev/components/` moved by 0.1 KB from a shared-chunk reshuffle; it will grow a little more with the new `SelectField` section and is far under the limit.)
- **Where the tool's 8.2 KB goes:** `Field` 3.6 KB (its first use outside the dev page) and one chunk of about 4.6 KB with the island, the library and the templates. Under `ClientMessages` that second chunk was 16.8 KB: the message parser is 12.2 KB of it.
- **Expectation for the real code:** 140 to 143 KB. The real island adds `SelectField`, the disabled fieldset, the blank's label and the font call; none is heavy. **If `pnpm size` shows more than 146 KB on a tool route, stop and tell `tech-lead`** before trimming anything; something unplanned has been pulled in. The hard limit stays 200 KB.
- **Nothing is lazy-loaded** and nothing needs to be: there is no heavy library on this route.
- **HTML:** the Hindi tool page was 6.6 KB gzipped (the landing is 7.2 KB). The island's words are in it twice, once as HTML and once as the prop, about 1 KB gzipped; not part of the JS budget.
- `frontend-dev` records the real numbers for the nine routes in the build record after step 5 and again after step 7.

### 14. Tests required

**Who writes what.** `frontend-dev` writes each unit test listed in section 12 in the same step as its code, and keeps the existing suites green. `test-engineer` writes `e2e/fee-reminder.spec.ts`, changes `e2e/landing.spec.ts`, and reads every unit test below for one that cannot fail (the F3 habit: break the rule, see the test go red). All Playwright tests run in the `phone` project (360px) against `out/`, so `pnpm build` runs first.

| Criteria | Proved by | Notes |
| --- | --- | --- |
| 1 | e2e | four built files; raw `<html lang>` of each |
| 2 | e2e | `/tools/fee-reminder/` answers 404 with the four language links |
| 3, 4, 5 | e2e `landing.spec.ts`, unit `landing.test.tsx` | section 10 |
| 6, 7 | e2e | one `header`, `main`, `footer`, `h1`; brand link to `/{lang}/`; footer links to the tool in each language, the current one a `span` with `aria-current`; following one leaves `localStorage` `ui-language` unset |
| 8 | e2e | every `a[href]` on the tool page resolves (reuse `builtFileFor`); the unavailable Send, which has no `href`, is skipped by `[aria-disabled]`; `https://wa.me/` is the one allowed outside address |
| 9, 10, 39 | e2e + unit `reminder-tool.test.tsx` | four endonyms each with its `lang`; start = page language; choosing another changes the bubble's text and `lang`, not the `h1` or the address |
| 11, 20 | e2e | all four fields empty; placeholders; `name@bank`; labels tied; `autocomplete="off"`; the UPI field's `autocapitalize`, `autocorrect`, `spellcheck` |
| 12, 14, 16, 18 | unit `reminder.test.ts` | section 6 table |
| 13 | unit + e2e | `page.clock` set to 15 March before `goto`: the select shows the page language's March, the message the message language's March, and no year anywhere |
| 15 | e2e + unit | type `1200`, the field still shows `1200`; blur, it shows `1,200`; `१२००` then blur shows `1,200` |
| 17, 19, 64 | e2e + unit | error only after blur; word, mark and sentence; gone when valid; the UPI note; the word "verified" is nowhere on the page |
| 21 to 26, 28, 29 | unit `templates.test.ts`, `reminder.test.ts` | |
| 27 | `pnpm check:leak` (section 5, point 3) + e2e | offline after load: language and tone still change the bubble |
| 30 | unit `i18n-check.test.ts` | section 5 |
| 31 to 33, 35, 36, 38 | unit `reminder.test.ts` | section 6 tables |
| 34 | e2e | no `a[href^="upi:"]`; the link's computed font is DM Mono; `user-select` is not `none` |
| 37, 45 | e2e | `target`, `rel`; `wa.me` routed to a stub, Send opens a new tab, the first tab still holds the four values; no "Sent" text |
| 40, 42 | e2e + unit | blanks have `role="img"` and a name; the line under the preview; both buttons dashed with no shadow; Send has no `href` |
| 41 | e2e | Send's background is the `blue` token, Copy's the `slip` token; nothing on the page has a `cloth` background except the header |
| 43 | e2e | grant `clipboard-read` and `clipboard-write`; press Copy; `navigator.clipboard.readText()` equals the bubble's text and equals the decoded `text` of the Send link; label "Copied" for about 3 seconds; `role="status"` text |
| 44 | e2e + unit `copy-text.test.ts` | `addInitScript` makes `clipboard.writeText` reject and `execCommand` return false: the error line and its mark show, the page still works |
| 46 | e2e, JavaScript off | heading, labels and the `noscript` line in the page language; every control is disabled |
| 47, 63 | e2e request log, three tests of section 9; unit source scan | on all four pages; also asserts no font file is requested after load |
| 48 | e2e | address, history length, title and cookie unchanged after filling and pressing Enter in each field; there is no `form` element |
| 49 | e2e | no script from another origin; the two `data-` attributes on each textarea, the select and the bubble |
| 50, 55, 56, 57 | e2e | texts from the message files through `shown()`; the yellow block has no input; no `₹149`, `₹999`, "Pro", "automatic", "receipt" on the page |
| 51 to 53 | e2e | switch off at start; on, fill, reload: both values back, on `/hi/` too; nothing else in `localStorage`; off: key gone at once; reload: fields empty |
| 54 | unit `remember.test.ts` + e2e | `addInitScript` makes `localStorage.setItem` throw: no switch on the page, the tool still builds a message |
| 58 | `pnpm i18n:check`, unit `words.test.ts`, `no-strings.test.ts` | |
| 59, 60, 61 | e2e, four pages | empty and with the longest values (40-character names, the 321-character UPI ID, ₹1,00,000, September); 200% root font (`largestText`); `smallTargets` extended to `select`, `[role="switch"]` and the segment labels; `smallText` |
| 62 | e2e + `pnpm lint` | Anek first on labels and headings of `/hi/`, `/kn/`, `/te/`; the bubble's link and ID in DM Mono; the typed UPI ID's drawn font is not an Anek face (the existing `fontProbe` helper) |
| 65, 66 | e2e raw HTML + unit `seo.test.ts`, `metadata.test.ts` | as R0-1's criteria 26 and 27 tests, on the tool path |
| 67 | `pnpm size` + unit `size-scripts.test.ts` | section 13 |
| 68 | reviewer | `git diff main -- package.json pnpm-lock.yaml pnpm-workspace.yaml` is empty |
| 69 | `pnpm check:leak` + unit `size-scripts.test.ts` | section 5 |
| 70 | CI | |
| Not in a criterion | e2e: on slow 4G (`slow4G` helper) the controls are disabled until hydration and typed text is kept after it; unit `select-field.test.tsx`, `words.test.ts`, `routes.test.ts` | |

**Hand checks:** H1 to H9 in the spec stand unchanged. Section 19 says which of them carry a design risk.

### 15. Build order (each step leaves lint, typecheck, unit tests, build, size and e2e green)

1. **The library and the templates** (`frontend-dev`). `templates.json`, `templates.review.json`, `reminder.ts` with the section 6 tables, `templates.test.ts`, `copy-text.ts`, `routes.ts`, the `seo.ts` path argument, their tests. No page yet, so nothing a user sees changes. (12, 14, 16, 18, 21 to 26, 28, 29, 31 to 33, 35, 36, 38, part of 66.)
2. **The checks learn the templates** (`frontend-dev`). `i18n-check-lib.mjs` template rules and the review record with `--strict`; `check-locale-leak.mjs` walks every language page and knows the exception (it stays dormant: no tool page exists yet). Their tests. (30, 69.)
3. **Design-system parts** (`frontend-dev`). `SelectField` with its test and dev-page section, `no-strings.test.ts` at fourteen, the `type-message` role, the `--radius-bubble` token, the `DESIGN.md` line. (Part of 13, 60, 61, 62.)
4. **The page without the island** (`frontend-dev`). The route, `ToolHeader`, the footer's `path`, the `reminder` keys in four files, metadata, the yellow block, the `noscript` line, `getWords` and its test; `size.mjs` and the leak script now require the four tool pages. `test-engineer` starts `e2e/fee-reminder.spec.ts` here (route, landmarks, footer, SEO, 404 at the unprefixed address). (1, 2, 6, 7, 55, 56, 65, 66.)
5. **The island** (`frontend-dev`). `reminder-tool.tsx` with the form, the errors, the preview, Send, Copy, the privacy line, the font call, the disabled-until-hydrated fieldset; the `reminderForm` keys in four files; its render tests. Run `pnpm size` and write the nine numbers in the build record. (9 to 11, 13, 15, 17, 19, 20, 27, 34, 37, 39 to 50, 57 to 64, 67.)
6. **The landing links** (`frontend-dev` and `test-engineer` in the same step). Section 10: `tools.tsx`, `hero.tsx`, the three landing keys, `landing.test.tsx`, `e2e/landing.spec.ts`. (3, 4, 5, 8.) **Cut line: the slice can ship here without step 7.**
7. **Remember on this phone** (`frontend-dev`). `remember.ts`, its test, the switch and its line in the island, the two effects of section 8. `pnpm size` again. (51 to 54.)
8. **Close** (`test-engineer`, then `frontend-dev`). `test-engineer` finishes `e2e/fee-reminder.spec.ts` (section 14) and the gap review of the unit tests. `frontend-dev` writes the build record: the sizes, the three "not reviewed" lines, the count of `TODO-translate` values, what to test by hand. Then `code-reviewer`.

`rm -rf .next out` before the final `pnpm build` of each step; a stale `out/` gives a false pass in the size and leak checks.

### 16. Risks and traps

1. **`setState` in an effect is a lint error here (verified).** Reading `localStorage` or the clock in `useEffect` and then setting state fails `pnpm lint` with `react-hooks/set-state-in-effect`. Use the `useSyncExternalStore` pattern of sections 7 and 8 and derive the shown value (`typed ?? saved ?? ""`). The only effects in the island write outward (storage, the font call, clearing a timer) and set no state.
2. **A native select clips at large font (verified).** Do not "simplify" `SelectField` back to a visible select; the e2e test at 200% with September chosen is what guards it.
3. **`Field`'s state props are a strict union.** `{ state: "error" }` needs `stateLabel`, and spreading an object whose `state` may be `undefined` does not type-check **(verified: the first prototype build failed on exactly this)**. Write one helper, `fieldState(result, touched, words)`, returning `{}` or `{ state: "error", stateLabel, message }`, and one for the UPI field that can also return the correct state.
4. **`Segmented` wants a tuple of two to four options, not an array.** Write the four language options out from `locales[0]` to `locales[3]`; a `.map()` does not type-check. Each endonym label is `<span lang={code} className="type-endonym">`; without that class the English page fetches three Anek files.
5. **The leak check matches by substring** (R0-1 found this). With 66 new keys, a `TODO-translate` English sentence in `kn.json` that contains a short English value which `kn.json` has translated elsewhere fails `check:leak`. The one built-in case: `upi.ok.note` begins with the words of `upi.ok.word`. Translate both or flag both, in each language. The same goes for "Missing", "Too long", "Check this", "Copied".
6. **`reminder.meta.title` and `.description` cannot be flagged** (section 11), and the new landing words must not say "WhatsApp" or "help" (section 10).
7. **A lone surrogate breaks `encodeURIComponent` (verified).** `cleanName` removes them; the island must pass only `checkName` values to the library, never raw field text.
8. **No lookbehind, no `String.prototype.toWellFormed`, no `Intl.Segmenter`, no `replaceAll` with a regex** in the library: older Android WebViews and Safari lack one or another, and a syntax error stops the whole page. The table in section 6 needs none of them.
9. **Placeholders in typed values.** Split the template first, then fill (section 6). A unit row guards it.
10. **Text typed before hydration is lost when React hydrates a controlled field** (section 4). The disabled fieldset prevents it. Do not remove it to "make the page feel faster".
11. **Font requests count as requests.** Without the font call the Hindi, Kannada and Telugu pages fetch DM Mono in the middle of typing **(verified)**, and the criterion 47 test fails only on those three pages, which looks like a flaky test. It is not.
12. **The bubble must not get an Anek face by accident.** It carries `lang`, and `[lang|="hi"]` sets the script font in the base layer; `type-message` is a utility and wins. If someone swaps it for `type-body`, the English page starts fetching Anek files and `/hi/` draws `₹` in Anek (the rupee sign is in the Anek files' range; digits are not).
13. **Turning the switch off must not empty the fields** (section 8: pin the shown values first). And **`storageWorks()` is called on every render** by `useSyncExternalStore`. It must cache its answer or it writes a probe key each keystroke. `readRaw()` must return the same string for the same stored value (it does: strings compare by value).
14. **Do not give any control a `name` that could carry typed text**, and do not add a `<form>`. The `Segmented` groups need `name` (radios), and their values are not typed data.
15. **`upiLink` throws by design.** The island never calls it directly; `reminderParts` calls it only when all four inputs are present and valid.
16. **Stale `out/`.** As in F3: clean before the last build of a step.
17. **WhatsApp formatting characters.** `_`, `*`, `~` and backticks in a name or UPI ID may be read by WhatsApp as italics, bold or strike. Not handled; H5 checks the underscore case, and the spec's follow-up (code marks round the ID) stays a follow-up.
18. **`execCommand("copy")` is deprecated** but is the only fallback inside older in-app browsers. It is behind the Clipboard API, in `try/catch`, and failing it leads to the criterion 44 message, not a crash.

### 17. Where I differ from the spec

1. **Hand-off 4, criterion 58: the templates and month names are not in the four message files.** They are in `src/lib/reminder/templates.json`, once (section 5). Criterion 58's "every word on the page comes from the message files" holds for interface words; the message a parent receives, and the month names in the select, come from the templates file. `i18n:check` checks both.
2. **Hand-off 5: words in a prop, not `ClientMessages`.** Measured: 140.3 KB against 152.5 KB (section 13). `src/CLAUDE.md`'s "every string comes from `useTranslations`" gains one sentence (section 12). A new small pattern, defined once in `src/i18n/words.ts`.
3. **Criterion 17, the UPI "correct" state.** `Field` shows its state word to screen readers only when correct (an F2 decision; sighted users get the tick). So the visible note itself begins "Format looks right." and the three words are also the screen-reader state word. A screen reader hears them twice. I did not change `Field`.
4. **Hand-off 3, criterion 13: the select's visible text is a copy over a real, transparent `<select>`** (section 7), because a plain styled select failed criterion 60 in the probe.
5. **Criteria 39, 62, 63: the bubble is always drawn in the phone's own font for Indian scripts**, also when the message language is the page language. The spec asks for that only when they differ. One rule is simpler, is what WhatsApp will show the parent, keeps amounts out of Anek with no special case, and cannot fetch a font. If `product-manager` wants Anek in the bubble when the two languages match, it is `type-body` in that case plus a Latin-stack span round the amount; say so before step 5.
6. **Criterion 62, "the link and UPI ID are DM Mono":** read as the preview. In the UPI **field** the typed ID is in `Field`'s value face. Latin letters and digits are outside the Anek files' ranges, so on every page they are drawn in Bricolage, never Anek (an e2e check). A mono `Field` would be a component change nobody asked for.
7. **Criterion 62, the bubble's shape:** a new radius token, 18px, with 4px at the top-left where the canvas has 2px (no 2px radius exists). `DESIGN.md` gets a line (section 19).
8. **Criterion 3, card 2:** the card holds one link, a full-width `outline` button "Write a reminder", rather than the whole card being a link. The canvas draws that bar in blue; `DESIGN.md` keeps blue for sending and paying, and opening a page is neither. One new key. If `product-manager` wants the canvas's blue, it is a one-word change.
9. **Criterion 42:** one reason line shared by both buttons through `aria-describedby`, not one under each.
10. **Criterion 40:** the drawn blank also has a spoken name. New key `reminderForm.preview.blank`, English "blank". Wording for `product-manager`.
11. **Criterion 11:** the spec fixes only the UPI placeholder. I use the canvas's examples for the others: "Suresh", "1,200", and "Meena Rao" from the spec's own link example.
12. **Not in the spec: the form is disabled until hydrated, and there is no `<form>` element** (section 4). With JavaScript off the controls are visibly there but inert (criterion 46 says "still shows its … form"; it does).
13. **Not in the spec: DM Mono is asked for at load** on every tool page (section 9), so criterion 47 can be literally true.
14. **Criterion 12, "40 characters":** counted in code points. Control characters and broken half-characters are removed.
15. **Criterion 14:** `1.2.3` and `.` get the "whole rupees" message (they hold a decimal point); `1200/-` and `Rs 1200` get "Use digits only" and are not accepted, as the spec's rule implies. Tutors do write `1200/-`; accepting it is a product choice I did not make.
16. **Criterion 30:** the record is per language (three entries, each covering two templates and twelve month names), with a hash so an edit after sign-off reopens it. The spec says "lists each"; the build record lists all six templates by name.
17. **Criterion 52:** while the switch is on and a field is not valid, the last valid pair stays stored. The spec says only that valid values are kept.
18. **Criterion 69:** the exception covers the tool route's **script files** only. A tool page's HTML is checked in full.
19. **Criterion 9:** the four language labels keep their `lang` but are drawn in the Latin stack (`type-endonym`), as the footer does, so `/en/tools/fee-reminder/` fetches no Anek file.
20. **Spec text edits I made:** the "Decided by the founder" block and this plan. No criterion was renumbered, removed or reworded. The Open questions section is left as written; the block above it is the answer.
21. **Documents handed on, not edited here:** `docs/DESIGN.md` and `src/CLAUDE.md` (section 12, to `frontend-dev`, both visible in the pull request).

Items 5, 8, 10, 11 and 15 are small product or wording calls. I proceed on the choice stated; `product-manager` can overrule any of them before step 5 (step 6 for item 8) at no cost.

### 18. Not doing

- A student name, a parent phone number, `wa.me/91…` (decided by the founder, above).
- A QR code, a pay page, a tappable `upi://` link on our page, "I've paid".
- `zod`, a select or combobox library, a clipboard library, `Intl.Segmenter`, any polyfill.
- `ClientMessages` on this route; `NextIntlClientProvider` in the locale layout.
- Moving the landing into `(public)`.
- A jump page at `/tools/fee-reminder` (R0-5 decides), sitemap, `robots.txt`, `og:image`, structured data.
- PostHog, Sentry, any event. A "sent" state or count.
- A link to the receipt maker; a nav between tools (R0-3).
- The waitlist form in the yellow block (R0-4).
- A service worker or offline page (the tool works offline only once loaded).
- A mono variant of `Field`; an error state on `SelectField`; a `SelectField` that types to search.
- Stripping zero-width or bidirectional control characters from names; escaping WhatsApp's `_`, `*`, `~`.
- Accepting `1200/-`, `Rs`, paise, a year, a due date, two months.
- Storing anything but the tutor's own UPI ID and name; a `storage` event listener to sync two tabs.
- A per-template review record, a review tool, or a command to sign off: the reviewer's name, the date and the printed hash are typed into one JSON file.
- A lint rule for the plain-words namespaces (a unit test is enough).
- A desktop two-column layout: the page keeps the landing's `max-w-2xl` column.

### 19. What could not be verified here, and what needs the founder

**Only a phone can answer these. None blocks the build; all should be run before Release 0 ships.**

| Question | Hand check | If the answer is bad |
| --- | --- | --- |
| Does WhatsApp make a `upi://` link tappable in a received message? I believe it links only `http` and `https`, so the link may arrive as plain text. | H2, Android and iPhone | **The fallback is already in every template: the line "Or pay to UPI ID: {upiId}"** (a unit test fails if any template lacks it). The parent copies the ID into their UPI app. The message promises "pay by UPI with this link", not "one tap". A tappable link would need the spec's separate slice (a static `https` pay page reading its details after `#`); that is new scope and the founder's call. |
| Do Google Pay, PhonePe and Paytm accept a payment opened from a plain link to a personal UPI ID, and up to what amount? Some apps are reported to refuse or cap these (about ₹2,000). | H3, ₹1,200 and ₹5,000 | Same fallback: the plain UPI ID line. The tool makes no promise about the link. If an app refuses the larger amount, the founder decides whether the page should say so. |
| Does `https://wa.me/?text=…` with no number open WhatsApp's contact chooser with the whole message, line breaks kept, in all four languages? | H1 | None in this slice; it is the PRD's own format. |
| Underscores in a UPI ID arriving as italics. | H5 | The spec's follow-up: code marks round the ID. |
| The longest message (about 2,900 characters of address, up to about 3,100 with emoji names). | H6 | Lower `NAME_MAX`; one constant. |
| The copy fallback inside an in-app browser; the phone's own font for Hindi, Kannada and Telugu in the bubble; the select's list at the largest phone font. | H4, H7 | Section 17, item 5 has the alternative for the bubble. |

**For the founder.**

1. **Name one reader each for Hindi, Kannada and Telugu** (Open question 9). Until each is recorded in `templates.review.json`, `pnpm i18n:check --strict`, the Release 0 gate, fails by design. The six templates are the first thing to send them: a parent reads those.
2. **H1 to H3 on real phones before Release 0.** They decide whether the tool does its job. The founder has deferred phone checks; this is the one place I would not.
3. **One new design token** (`--radius-bubble`, 18px) and one line in `docs/DESIGN.md`. It comes from the canvas, but `DESIGN.md` is yours; it will be in the pull request for you to see.
4. No new dependency, no migration, nothing to approve for production in this slice.

**For `product-manager`, not blocking:** section 17, items 5, 8, 10, 11 and 15.

### 20. Start

`frontend-dev` starts with **step 1** of section 15: `src/lib/reminder/templates.json`, `reminder.ts` and the tables of section 6, after reading sections 5, 6 and 16. `test-engineer` starts `e2e/fee-reminder.spec.ts` when step 4 lands and joins step 6 for `e2e/landing.spec.ts`. There is no `backend-dev` task. Nothing waits on the founder to begin; the reviewer names and the phone checks are needed before Release 0, not before the merge.
