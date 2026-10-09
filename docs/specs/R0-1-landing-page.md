# R0-1 — Landing page

## Goal
A visitor who opens `/en/`, `/hi/`, `/kn/` or `/te/` sees what the product is, how it works, what it promises, and how to get on the waitlist, in their language, without any database. Search engines get a real page per language. A wrong address shows a proper 404 with a `lang`.

Size: M, as in the build plan. It is one page of static sections, per-language page metadata and the 404. No new component in `src/components/ui/` is expected. No Supabase, no PostHog, no new dependency.

## Users and moment
- **A tutor on a low-end Android**, arriving from a Google search, a WhatsApp forward or a friend's link, often on slow 4G, often reading Hindi, Kannada or Telugu. They decide in a few seconds whether this is for them. They are not asked to sign in.
- **A parent** may land here by mistake (or by tapping the footer link on a pay page, later). The page must not confuse them: it is written to tutors.
- **The founder**, who wants the first public screen out fast. Honest drafts in hi/kn/te are allowed (criterion 7), flagged for native review before launch.

## What exists today (checked)
- `src/app/[locale]/layout.tsx` is the root layout (`<html lang>`, `generateStaticParams`, `metadata.title = brand.name`). `src/app/[locale]/page.tsx` is the F3 placeholder (`home.placeholder`). R0-1 replaces the page and deletes `home.placeholder` from all four files.
- `src/CLAUDE.md` already names `src/app/[locale]/(public)/` for the landing and tools.
- `Button` already has an honest unavailable look (dashed outline, no shadow, does not move, `disabledReason` line under it). `Slip`, `Row`, `Stamp`, `StatusTag` exist. The canvas ledger card is built from them.
- `brand.domain` is `feedost.vercel.app`; canonical and `hreflang` URLs are built from it.
- F3 measured every language route at 132.1 KB gzipped. Server Components cost no JavaScript. The page below needs no client text, so it stays at about that number (criterion 22).

## Page order (from the canvas, `Landing.dc.html` and `Landing-m.dc.html`)
1. Cloth header and hero: brand name, "Join the waitlist" button, kicker, headline, one paragraph, primary button, the ledger card.
2. Ribbon of words (Fees, फ़ीस, ಶುಲ್ಕ, ఫీజు, Remind, Pay, Paid).
3. "Asking for money is awkward. So don't ask. Tap." with three numbered steps (Remind, Pay, stamped).
4. "Two free tools" with two tool cards.
5. "Four promises, in writing." as a numbered list.
6. Cloth waitlist section "Put your name in the book." (placeholder in this slice).
7. Footer: one line, language links, big brand name.

## Acceptance criteria

Each is marked **[unit]**, **[e2e]** (Playwright, 360px phone project, against `out/`) or **[manual]**.

### Sections and content
1. `/en/`, `/hi/`, `/kn/`, `/te/` each contain, in this order, the seven blocks listed above, as real landmarks: one `<header>`, one `<main>` holding sections 3 to 6 and the hero, one `<footer>`. There is exactly one `<h1>` (the headline). Each of sections 3 to 6 has an `<h2>`. [e2e: heading order and counts on all four pages]
2. The page is delivered as static HTML. With JavaScript turned off, every section reads in the page's language and every anchor link works. [e2e, JavaScript disabled]
3. Section 3 shows three steps numbered 1, 2 and 3 (digits 0-9 in every language, headline face, never Anek). The third step uses the `Stamp` component with the translated word for paid. [e2e]
4. Section 5 shows four promises with the numbers 01 to 04 in DM Mono. The four promises are the canvas's, shortened as in the phone canvas where the long form is not needed: we never hold your money; parents install nothing; it works on a patchy network (see Open question 4); we keep only what is needed, and no ads. [e2e: four items, each with a title and a body]
5. The hero ledger card is an **example**, not real data. It carries a visible, translated "Example" label. Its amount is written by `formatRupees(1850000)` (`₹18,500`), its row amount by `formatRupees(120000)` (`₹1,200`). No amount, date or month on the page is typed as text in a message file; `October 2026` style text is not used (see Edge cases). The student names are written in the language's own script in hi/kn/te drafts. [unit for the formatter use, e2e for the label and the text `₹18,500`]
6. Every word a visitor can see or hear comes from `useTranslations`. There is no English typed in JSX under `src/app/` or `src/components/`. The existing no-strings scan (F3 criterion 43) passes without exceptions. The ribbon words, the "Example" label, the stamp word, aria-labels and the alt text of any image are messages too. [unit, existing scan]
7. `messages/{en,hi,kn,te}.json` all have every new key, under the namespaces `landing` (page text) and `notFound` (criterion 28). `pnpm i18n:check` passes. In `hi`, `kn`, `te`, any sentence the drafter is unsure of is `TODO-translate: <English>`; the build shows the English text and never the marker (F3 criterion 27 stays true). `pnpm i18n:check --strict` is expected to **fail** until native review; that is the Release 0 gate, not a defect of this slice. The count of flagged values is recorded in this spec by `frontend-dev`. [unit, CI]
8. The product name appears on the page only from `src/config/brand.ts`: the header, the hero, the footer wordmark and the sentences that need it (as `{brand}`). The existing product-name test over `src/`, `messages/`, `e2e/` stays green. [unit]
9. No image file is added. The ledger card, stamp, arrows and the ribbon are CSS and inline SVG already in the design system or drawn in the page (the arrow icon is decorative, `aria-hidden`). [unit: no new file under `public/` and no `<img>` in the page]

### Calls to action and the waitlist placeholder (Open questions 1 and 2)
10. Nothing on the page links to a tool address or a form that does not exist. Every link on the page goes to a real destination: an anchor on the same page (`#waitlist`, `#tools`), another language's landing page, or a page that exists. [e2e: every `a[href]` on all four pages resolves to an element in the page or to a built file in `out/`]
11. The primary button in the hero ("Join the waitlist") and the small one in the header both link to `#waitlist`. Both are the `Button` component. The header button is at least 44px high; the hero button is at least 56px high and full width at 360px. [e2e]
12. Section 6 (`id="waitlist"`) shows the canvas heading and paragraph. In place of the form it shows one clearly marked block: a translated line saying the waitlist opens soon, and the `Button` in its **unavailable** form (dashed outline, "Join the waitlist" label, `disabledReason` "Opens soon" in the language). It must not look like a broken form: no empty inputs, no greyed-out boxes, no lorem text. It is in the tab order only as far as the component allows. [e2e + [manual]]
13. The placeholder lives in one file, `src/components/landing/waitlist-slot.tsx`, with the section `id="waitlist"` kept in the page. **R0-4 replaces the body of that one file** with the real form and removes the key `landing.waitlist.soon` (and its siblings) from all four message files. The header and hero buttons already point at `#waitlist`, so R0-4 does not touch them. A comment at the top of the file says this. [unit: file exists and exports the slot; reviewer checks the comment]
14. The page contains no `<form>`, no `<input>`, no `<select>`, no request to any other origin, and collects nothing. [e2e: no form elements; no network request except the site's own files and fonts]
15. The two tool cards in section 4 are marked with a translated "Coming soon" tag (`StatusTag` is for dues; use a plain labelled mark in the same style, not colour alone) and are **not** links. Each card keeps its number ("Tool no. 01", "Tool no. 02"), title and one-line description. R0-2 turns card 2 into a link to `/xx/tools/fee-reminder/`; R0-3 turns card 1 into a link to `/xx/tools/fee-receipt/`. The section heading is "Two free tools. Coming soon." (not the canvas's "Use them today", which would be false; Open question 1). [e2e]
16. The hero's second link ("or write a free reminder now") and the header's "Receipt maker" and "Reminder writer" links from the desktop canvas are **not** on the page until their tools exist. R0-2 and R0-3 add them. [e2e: absent]
17. The kicker ("The fee register for home tutors · Free") says free once. The page states no price and mentions no Pro plan. PRD Release 2 prices (₹149/₹999) are not shown. [e2e: no `₹149`, no `₹999`, no word "Pro" in English text]

### Language, scripts, layout
18. On each page the `h1` and body text use the font rules F2 and F3 set: `/hi/`, `/kn/`, `/te/` first font is that script's Anek, letter-spacing 0, no uppercase on Indian-script text, line-height at least 1.25 on headlines and 1.5 on reading text. Digits, `₹` amounts and the numbered steps still use 0-9 and the Latin headline or DM Mono face. [e2e, computed styles]
19. At 360px wide, on all four pages, there is no sideways scroll (`scrollWidth - clientWidth` is 0 on `<html>`), including the ribbon, the ledger card, the footer wordmark and the stamp. [e2e]
20. With the phone's text size at the largest (emulate by setting root font-size to 200%), no text is clipped or overlaps, no button label is cut, and there is still no sideways scroll. The headline wraps by word. A long Hindi, Kannada or Telugu headline is allowed to drop one size step on Indian scripts (the type table in `docs/DESIGN.md`), but never below 14px for any text. [e2e, root font-size 200%, all four pages]
21. Every link and button is at least 44px high and 44px wide, including the footer links. No text is smaller than 14px (computed). [e2e: query all `a`, `button`; check `getBoundingClientRect` and computed font-size]

### Size and speed
22. Initial JavaScript for each of `/en/`, `/hi/`, `/kn/`, `/te/` stays at **150 KB gzipped or less** (F3 target; hard limit 200 KB), measured by `pnpm size`. The expected number is 132.1 KB because the page is all Server Components. If any component needs `ClientMessages`, the cost is about +12 KB (144 KB) and the implementer must say why in the pull request. [e2e/CI, `pnpm size`]
23. The ribbon is **static**: no animation, no script. It does not move at all, so reduced-motion needs no special case. The phone canvas draws it static; the desktop canvas animates it. (Open question 6 asks the founder to confirm; static is also what `docs/DESIGN.md` allows under reduced motion and costs nothing.) [e2e: no `animation` on it; computed style `animation-name: none`]
24. The page needs no web font beyond those F3 already loads per route (criterion 5 of F3). No new font file is requested. [e2e, network log]
25. The ledger card is not rotated. `docs/DESIGN.md` says rotation is for stamps only; the desktop canvas tilts the card 3 degrees, the phone canvas does not. Only the stamp words tilt, as the F2 `Stamp` already does. [unit/e2e: no `rotate` on the card]

### Page metadata (the part of SEO that R0-1 needs)
26. Each language page has its own `<title>` and `<meta name="description">`, from `landing.meta.title` and `landing.meta.description` in that language's file. Title is no longer than 60 characters in English and says what the product is, not only the name. Description is no longer than 155 characters in English. They are in the delivered HTML. The F3 title (`brand.name` only) is replaced for the landing. [e2e: raw HTML of each page, four different titles, four different descriptions]
27. Each page has `<link rel="canonical">` pointing at its own address (`https://{brand.domain}/{locale}/`), and the same five `<link rel="alternate" hreflang>` entries in all four pages: `en`, `hi`, `kn`, `te` and `x-default` (pointing at `/en/`). URLs are absolute and have the trailing slash. The domain comes from `brand.domain`, so a custom domain later is a one-line change. Open Graph `og:title`, `og:description` and `og:locale` are set from the same messages; no `og:image` (no image exists; Open question 8). [e2e: raw HTML; unit: a helper builds the URLs]
28. **The 404.** A request for any unknown address (`/fr/`, `/en/nope/`, `/xyz`) returns the built `404.html`, which has `<html lang>`, the app's fonts and colours, a heading and one sentence in **all four languages** (each block with its own `lang`), and four links, one to each language's landing page, labelled with the endonyms from `src/config/locales.ts`. No JavaScript is needed. It is built with `experimental.globalNotFound` (see "The 404 approach" below). It has `<meta name="robots" content="noindex">` and a title from `brand.name`. [e2e: raw `out/404.html` has `lang`, four `lang` blocks, four links; request `/fr/` shows it]
29. A build test asserts `out/404.html` contains `<html lang=` so a Next upgrade that changes the experimental behaviour fails loudly rather than shipping a bare 404. [unit or CI script]
30. `/dev/components` and `/dev/supabase` are unchanged and still absent from a production build. `/` (the jump page) is unchanged. [e2e, existing tests]
31. Only the active language's messages ship (F3 criterion 29): `pnpm check:leak` passes with the new landing keys, and the 404's all-language HTML does not break the guard (the guard checks `/xx/` pages, not `404.html`). [CI]

## The 404 approach (Next.js 16.4, checked in `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md`)
- The docs name our exact case as the reason `global-not-found.js` exists: several root layouts, and a root layout under a top-level dynamic segment (`app/[locale]/layout.tsx`). A plain `not-found.js` cannot compose a global 404 from layouts here, which is why `out/404.html` has no `lang` today.
- `global-not-found.js` is marked **experimental** and needs `experimental: { globalNotFound: true }` in `next.config.ts`. It bypasses all layouts, so it must write its own `<html lang>` and `<body>` and import `globals.css` and the font variables itself.
- **Recommendation: use it.** Reasons: it is the documented fix for this tree; the alternative (leaving the bare 404) fails the F3 follow-up; the risk is bounded, because if a Next upgrade removes the flag the worst case is the old bare 404, and criterion 29 catches that in CI. This is the one place in the app that uses an experimental flag; the F3 note "no `experimental`" stays true for everything else.
- Messages: it cannot read the locale from `next/root-params`. It calls `loadMessages(locale)` from `src/i18n/messages.ts` once per language (that function takes the locale as an argument and does not need the address) and renders a small block per language. All of it is server HTML, no client JavaScript.
- This is `tech-lead`'s to confirm in a build before the design is fixed. If the flag does not work with `output: 'export'` and `[locale]` (the F3 throwaway build said it did), the fallback is: leave the bare 404, say so, and keep criteria 28 and 29 open for a later slice. Do not add a hand-written HTML file in `public/`; that would bypass next-intl and the token rules.

## Edge cases
- **Slow network / JavaScript blocked.** Whole page is static HTML and the anchors work (2).
- **Hindi/Kannada/Telugu headline longer than English.** Wraps by word; the type step may drop one size; nothing clipped (20).
- **Very long translated button label.** `Button` wraps and grows; the hero button may be two lines tall.
- **Large font size.** Cloth header, ledger card and footer grow in height; the footer wordmark is decorative (`aria-hidden`) and sits inside `overflow: hidden`, so it can never cause sideways scroll (19, 20).
- **Ledger card amounts.** Always `formatRupees`, always 0-9 digits, in all four languages. The card shows an amount and a row amount only; no month name, because month-only formatting is undecided (F3 "Missing from the PRD"). The canvas's "October 2026", "23 students" and "06 OCT" are therefore **not** copied. A translated "Example" label replaces them. If the founder wants a month, it comes with a decision on month format (Open question 7).
- **Search-engine view.** The page is indexable. `/` stays without a canonical (R0-5 adds `x-default` there; F3 left it so). Crawlers see four links on `/` and four `hreflang` alternates on each page.
- **Crawler opens `/hi/` vs a tutor on a Kannada phone opens a shared `/hi/`.** They see Hindi; their saved choice is not changed (F3 criterion 18). The footer language links (criterion 32) are the way out, and they are plain links.
- **Parent opening an old link.** Not applicable; no tokens in this slice. A parent who lands on the page sees a tutor-facing page; the first promise (parents install nothing) is written to reassure them too.
- **Duplicate waitlist signups, partial payments, phone formats.** Not applicable until R0-4 (no form here).
- **Reduced motion.** Nothing animates (23).
- **No analytics consent.** No analytics runs at all (R0-5).

### Footer and language links
32. The footer has: one sentence ("Free fee collection for home tutors in India."), the four language links (endonyms from `src/config/locales.ts`, real anchors to `/en/`, `/hi/`, `/kn/`, `/te/`, the current one marked `aria-current="page"` and not a link target to itself), and the large decorative brand name. These language links are **not** in the canvas; they are added because a visitor who arrives from a shared link has no other way to change language before R1-1 (Open question 3). Following one is a plain link: it does not save the choice. [e2e]
33. The footer has **no** "Privacy" and **no** "Help on WhatsApp" link in this slice. The canvas has both; the privacy page and the support number do not exist (Open questions 4 and 5). A footer link that goes nowhere is not allowed (10). [e2e: absent]

## Out of scope
- **A working waitlist form and the `waitlist` table.** R0-4. This slice leaves a marked placeholder and a one-file swap (13).
- **The fee reminder generator and the fee receipt maker**, their addresses and links from the landing. R0-2 and R0-3.
- **Sitemap, `robots.txt`, canonical and `x-default` on `/`, `og:image`, structured data, PostHog page events.** R0-5. R0-1 does only the per-page title, description, canonical and `hreflang` of the landing (26, 27) because they cannot be added later without rewriting the head. R0-5 adds what is left and checks every public page has them. The PRD does not ask for structured data (JSON-LD); none is added.
- **A privacy notice page and DPDP consent.** The landing collects nothing, so no notice is due yet. R0-4 collects name, phone, city and number of students and **must ship a privacy notice and consent line with the form** (PRD §9, DPDP Rules 2025). The Privacy link returns then.
- **Language picker UI, saving the language.** R1-1.
- **Pricing, Pro plan, Play Store badge, testimonials, social proof, a demo video.** None are in the PRD for Release 0.
- **Custom domain, `www`, redirects.** A static export on `*.vercel.app` has none; F4.
- **Native-speaker translation.** Before launch (build plan section 7, item 5). Drafts are allowed now.
- **Desktop layout polish beyond 360px.** The page must be correct at 360px and not break at wider widths (the shared shell is single-column and centred up to a readable width); the full 1440px canvas composition (two-column hero, 3-up steps) is nice to have, not a criterion. The tutor's phone is the target.

## Design references
- `design/project/Landing-m.dc.html`: the phone layout (360px). **The source of truth for layout.**
- `design/project/Landing.dc.html`: the desktop layout, for copy and wider behaviour.
- `design/project/Branding.dc.html`: wordmark and brand name use.
- Components: `Button` (send, record, unavailable form), `Slip` and `Row` (ledger card), `Stamp`. Tokens from `docs/DESIGN.md`: `cloth`, `cloth-deep`, `stitch` (dashed inset outline), `on-cloth`, `page-ruled` (faint rules).
- Differences from the canvas, all deliberate: no card rotation (25); ribbon static (23); "Example" label and no month (5); tools "Coming soon" and no tool links (15, 16); no form (12); no Privacy / WhatsApp footer links (33); added language links (32); the third promise and the tools heading reworded (Open questions 1 and 4).

## Analytics
None. No PostHog event in PRD §10 belongs to this slice, and the stack's PostHog is R0-5. Do not add a script, a pixel or a cookie. The page makes no third-party request.

## Test by hand on a phone
The founder has deferred phone checks until the web app works end to end. Run these then.
- **H1.** Open `/hi/` on a real low-end Android. The page reads in Hindi, no boxes where script should be, the "Join the waitlist" button is easy to hit with a thumb, and scrolling is smooth.
- **H2.** Set the phone's font to the largest. Scroll `/kn/` top to bottom: nothing cut off, nothing sideways.
- **H3.** Tap "Join the waitlist" in the header and in the hero: both scroll to the waitlist section, which says plainly it opens soon and does not look broken.
- **H4.** Open `/te/nope/`: the 404 shows four languages and four links that work.
- **H5.** Read the Hindi, Kannada and Telugu text with someone who reads them. List every line still marked `TODO-translate`.
- **H6.** Share `/en/` into WhatsApp: check the preview title and description are the new ones (there is no image yet).

## Open questions
Each has a recommendation; the implementer proceeds on it unless told otherwise.

1. **What does the call to action do today, and what about the tool cards?** Neither the waitlist nor the tools exist. *Recommendation: the header and hero buttons scroll to `#waitlist`, which shows an honest "opens soon" block with the unavailable `Button` and a reason line; the two tool cards stay but are marked "Coming soon" and are not links; the heading becomes "Two free tools. Coming soon." Alternative: hide the tools section until R0-2/R0-3 land (less to explain, one less claim).* Founder: confirm, or ask to hide the section.
2. **Should the unavailable waitlist block say a date?** *Recommendation: no date; "Opens soon" only.* A date we miss reads as broken.
3. **Language links in the footer** (not in the canvas). *Recommendation: add the four endonym links as plain links (criterion 32).* Without them a visitor on a shared link in the wrong language has no way out.
4. **Claims the app cannot back yet.** The canvas copy says "WhatsApp opens with a polite message...", "gets paid by UPI", "Mark attendance and payments offline", "a numbered receipt goes to the parent". These are Release 1 features and the offline one is still unbuilt. The page is for the waitlist, so these describe the product that is coming. *Recommendation: keep the first, second and fourth promises and the three steps, but reword the kicker so it does not say the app exists today (for example, "The fee register for home tutors. Free." plus the waitlist context), and for the third promise keep "It works on a patchy network" only if the founder commits to offline in R1; otherwise swap it for "Built for a cheap phone and a slow network" (which R0 can honestly keep).* Founder: confirm or choose the swap.
5. **The "Help on WhatsApp" number.** The canvas footer has the link; the PRD's More screen has a "help → WhatsApp support link" but no number. *Recommendation: leave it out of the landing until the founder gives a number; then add it from one config file (not `brand.ts`).*
6. **The ribbon animation.** *Recommendation: static (criterion 23).* The desktop canvas scrolls it; on a low-end phone and with reduced motion that is cost and risk for little. Founder: confirm, or ask for a CSS-only animation with a `prefers-reduced-motion` off switch.
7. **A month on the ledger card.** The canvas says "October 2026". The month-only format has no decision (F3). *Recommendation: no month on the card.* Founder: say if a month is wanted; if so, decide the format with R0-2.
8. **Share preview image (`og:image`).** *Recommendation: none in R0-1; add one in R0-5 as a small, optimised PNG with alt text from messages.* A WhatsApp share will show title and description only.
9. **Experimental `globalNotFound` for the 404.** *Recommendation: use it, with a CI check (criteria 28, 29).* It is the one experimental flag in the app. Founder: approve or choose "leave the bare 404".
10. **Who writes the Hindi, Kannada and Telugu draft?** *Recommendation: the implementer drafts, flags every sentence they are unsure of with `TODO-translate`, and a native reader reviews before Release 0 ships. The strict check is the gate.*

## Conflicts and gaps in the PRD and canvas
- **PRD says "SEO: each tool page has a unique title/description per language."** It does not mention a landing page at all; the landing is scoped by the build plan row R0-1 and the canvas. Its SEO needs (26, 27) are drawn from the same rule.
- **The PRD has no privacy page** for Release 0, but the canvas footer links to one, and the waitlist (R0-4) collects personal data. See Out of scope.
- **The canvas and PRD disagree on what is live.** The canvas says "Two free tools. Use them today." and links to a tool; the tools are R0-2 and R0-3.
- **The canvas rotates the card; the design rules say rotation is for stamps only** (`docs/DESIGN.md` Motion/Shape). Followed the rules.
- **The canvas has no language switcher and no 404 design.** Both added minimally above.
- **The canvas animates the ribbon; DESIGN says no marquee under reduced motion.** Resolved by making it static.
- **Canvas amounts and dates are literal text** ("₹18,500", "06 OCT"); the code must use the formatters and the DD MMM YYYY rule. "06 OCT" is dropped.
- **The PRD has no waitlist copy, no price on the landing, and no support contact.**

## Hand-off
Next: `tech-lead` appends the technical plan to this file. Decisions that are theirs:
1. Confirm in a build that `experimental.globalNotFound` works with `output: 'export'`, the `[locale]` root layout and the `dev` pageExtensions, and write down the exact file (`src/app/global-not-found.tsx`) and how it imports `globals.css` and the fonts.
2. File layout under `src/app/[locale]/(public)/`: one `page.tsx` with `generateMetadata` (per-language title, description, canonical, alternates, Open Graph) and small Server Components under `src/components/landing/`. Say whether `(public)` is used, given the F3 `(jump)`, `[locale]` and `dev` roots.
3. A small helper that builds the canonical and `hreflang` set from `brand.domain` and `locales`, with a unit test (27).
4. The ledger card from `Slip`, `Row`, `Stamp`: which F2 props are used and whether the sample row needs a new `Row` state (it should not).
5. Message namespaces and key names for `landing` and `notFound`; the `TODO-translate` count; how `TODO-translate` interacts with the 404's four-language render (criterion 27 of F3 still holds).
6. Bundle: measure the five routes after the build and record them here.
7. Tests: which of the above are unit and which e2e; `test-engineer` writes `e2e/landing.spec.ts` and the 404 spec; the "every link resolves" check (10).


## Decided, 2026-10-10
The coordinator confirmed the recommendations on Open questions 1 to 10 are the working decisions, so the implementer proceeds on them without waiting:
1. Header and hero buttons go to `#waitlist`; the waitlist block is the unavailable `Button` with "Opens soon"; tool cards stay, marked "Coming soon", not links; heading "Two free tools. Coming soon."
2. No date on the waitlist block.
3. Footer carries the four endonym language links.
4. Kicker reworded so it does not claim the app exists; third promise is "Built for a cheap phone and a slow network" unless the founder commits to offline in Release 1.
5. No WhatsApp help link; no Privacy link.
6. Ribbon is static.
7. No month on the ledger card.
8. No `og:image`.
9. Use `experimental.globalNotFound` for the 404, guarded by criterion 29. This is the only experimental flag in the app.
10. The implementer drafts hi/kn/te and flags doubts with `TODO-translate`; native review is the Release 0 gate.

No new dependency is needed, so there is no dependency question for the founder.

## Technical plan — R0-1

### Approach
The landing is one Server Component page at `src/app/[locale]/page.tsx` (no `(public)` group, see below) built from small Server Components in `src/components/landing/`. It uses `getTranslations` and the F2 components, so it ships no client text and no extra JavaScript. `generateMetadata` gives each language its title, description, canonical, `hreflang` and Open Graph from a small helper. The 404 is a `src/app/global-not-found.tsx` that writes its own `<html lang>` and renders all four languages from `loadMessages(locale)`.

### Files
Create:
- `src/lib/seo.ts` (+ `seo.test.ts`): `canonicalUrl(locale)`, `alternateUrls()` returning the five `hreflang` entries (`en`, `hi`, `kn`, `te`, `x-default` = `/en/`), all absolute with trailing slash, built from `brand.domain` and `locales`.
- `src/components/landing/` (each a Server Component, each with a small render test):
  - `landing-header.tsx`: cloth header, brand name, small `Button` (as link) to `#waitlist`.
  - `hero.tsx`: kicker, the single `h1`, paragraph, full-width `Button` to `#waitlist`, `ledger-card.tsx`.
  - `ledger-card.tsx`: `Slip` + `Rows`/`Row` + `Stamp`; "Example" label; amounts only via `formatRupees(1850000)` and `formatRupees(120000)`; no rotation, no month.
  - `ribbon.tsx`: static words, `aria-hidden` (the words are decoration); no animation.
  - `steps.tsx`: `h2` and three numbered steps (digits 1, 2, 3 in the headline face); third uses `Stamp`.
  - `tools.tsx`: `id="tools"`, `h2`, two cards with a plain labelled "Coming soon" mark, not links.
  - `promises.tsx`: `h2`, four items numbered 01 to 04 in DM Mono (these use the F2 `data-amount`/mono rule that keeps Latin digits).
  - `waitlist-slot.tsx`: the only file R0-4 replaces. Top comment says so. Renders the "opens soon" line and the unavailable `Button` with `disabledReason`.
  - `landing-footer.tsx`: sentence, four language links (current one `aria-current="page"`, rendered as text not a link), decorative `aria-hidden` wordmark inside `overflow-hidden`.
- `src/app/global-not-found.tsx`: own `<html lang>`, `<body>`, imports `./globals.css` and the font variables the same way `HtmlShell` does; `<meta name="robots" content="noindex">`; title from `brand.name`; one block per locale with its own `lang`, heading, sentence, and a link to `/{locale}/` labelled with the endonym from `src/config/locales.ts`.
- `e2e/landing.spec.ts`, `e2e/not-found.spec.ts` (written by `test-engineer`).
- `scripts/check-404.mjs` (or a vitest that reads `out/404.html`) for criterion 29, wired into CI after `pnpm build`.

Change:
- `src/app/[locale]/page.tsx`: replace the placeholder; compose the sections inside `<main>` (header and footer are siblings of `<main>`, one landmark each); export `generateMetadata`.
- `next.config.ts`: add `experimental: { globalNotFound: true }` with a comment that this is the only experimental flag and why.
- `messages/{en,hi,kn,te}.json`: add `landing.*` and `notFound.*`; delete `home.placeholder` from all four.
- `docs/specs/R0-1-landing-page.md`: frontend-dev records the `TODO-translate` count and the measured bundle sizes.

Group decision: no `(public)` route group. The page already sits at `[locale]/page.tsx`, which is the root layout's own page. A group would only move a file and add a path. `src/CLAUDE.md` names `(public)` for later tool pages; R0-2 may introduce it when there are several public routes to group.

### Data
None. No migration, table, RLS, Edge Function, PostHog event or network request.

Message keys (all four files, same shape):
- `landing.meta.{title,description}`, `landing.header.join`, `landing.hero.{kicker,title,body,join}`
- `landing.example.{label,student1,student2,month?}` (no month key; `landing.example.label` only), `landing.ribbon.{fees,hindi,kannada,telugu,remind,pay,paid}` (the Indian-script ribbon words are values in every file, not typed in JSX)
- `landing.steps.{title,s1.title,s1.body,s2.title,s2.body,s3.title,s3.body,stamp}`
- `landing.tools.{title,tag,t1.no,t1.title,t1.body,t2.no,t2.title,t2.body,soon}`
- `landing.promises.{title,p1.title,p1.body, ... p4.title,p4.body}`
- `landing.waitlist.{title,body,soon,button,reason}`
- `landing.footer.{line,languages}`; `notFound.{title,body}`; sentences needing the name use `{brand}`.

`TODO-translate`: `loadMessages` (F3) already returns the English text for a flagged value. The 404 calls `loadMessages` for each language, so a flagged `notFound` line shows English in that block, never the marker. `pnpm i18n:check` (non-strict) stays green in CI; only `--strict` fails, as criterion 7 expects. The CI must not run `--strict` for this slice.

The 404 approach, verified against the Next 16.4 docs: `global-not-found.js` bypasses all layouts, so it must supply `<html>`, `<body>`, CSS and fonts itself, and it cannot use `next/root-params`. It needs no locale from the address. If the build does not write `out/404.html` with `lang`, fall back as the spec says: keep the bare 404 and leave criteria 28 and 29 open. Do not add a file to `public/`.

### Work split
Backend is not involved; the slice has no server or database work.
1. `frontend-dev`: `src/lib/seo.ts` and its unit test (criterion 27). Smallest, no dependencies.
2. `frontend-dev`: message keys in all four files with English first, then hi/kn/te drafts with `TODO-translate` where unsure; delete `home.placeholder`; run `pnpm i18n:check` and the no-strings scan.
3. `frontend-dev`: the landing components and the page, in page order (header, hero + ledger card, ribbon, steps, tools, promises, waitlist slot, footer). Add `generateMetadata`. Render tests per component.
4. `frontend-dev`: `global-not-found.tsx` and the `next.config.ts` flag; run `pnpm build` and open `out/404.html` to confirm `<html lang=`, four blocks and four links. If this fails, stop and report; do not hand-write HTML.
5. `frontend-dev`: build check script for `out/404.html` (criterion 29), wire into CI.
6. `frontend-dev`: run lint, typecheck, test, `pnpm build`, `pnpm size`, `pnpm check:leak`, `pnpm i18n:check`; record the five route sizes and the `TODO-translate` count in this spec.
7. `test-engineer`: `e2e/landing.spec.ts` and the 404 spec, including JavaScript-off, every-link-resolves, 200% root font-size, 44px targets and 14px floor, no-network-except-own check.

### Tests required
Unit (vitest):
- `seo.test.ts`: canonical and five alternates for each locale, absolute, trailing slash (27).
- Component render tests: `ledger-card` uses `formatRupees` output `₹18,500` and `₹1,200` and has the Example label, no `rotate` (5, 25); `steps` has digits 1 to 3 and a `Stamp` (3); `promises` has four items numbered 01 to 04 (4); `tools` cards are not links and carry the Coming soon mark (15); `waitlist-slot` exports the slot and the unavailable button with reason (12, 13); `landing-footer` marks the current locale `aria-current="page"` and has no Privacy or WhatsApp link (32, 33).
- Existing no-strings scan, product-name test, i18n key-parity test pass unchanged (6, 7, 8); a test that no `<img>` is used and nothing is added to `public/` (9).
- `out/404.html` contains `<html lang=` (29).

E2E (Playwright, phone project, against `out/`):
- Landmarks and heading order on four pages (1); JS disabled and anchors work (2); label and `₹18,500` (5); every `a[href]` resolves (10); button heights and widths (11); waitlist block (12); no form elements and no off-origin request (14); tools not links, absent reminder/receipt links (15, 16); no `₹149`, `₹999`, "Pro" (17); computed fonts for hi/kn/te (18); no sideways scroll at 360px and at 200% font (19, 20); 44px and 14px floors (21); ribbon `animation-name: none` (23); no new font request (24); raw-HTML title, description, canonical, `hreflang` and OG differ per page (26, 27); 404 for `/fr/`, `/en/nope/`, `/xyz` (28); `/dev/*` and `/` unchanged (30).
CI: `pnpm size` at 150 KB or less per route (22); `pnpm check:leak` (31).

### Risks and traps
- **Experimental `globalNotFound`.** It may not work with `output: 'export'` plus a top-level `[locale]` root layout. Mitigation: step 4 proves it before anything depends on it; criterion 29 fails CI if a Next upgrade drops it; fallback is the documented bare 404.
- **No layouts in the 404.** Fonts and CSS do not come from `HtmlShell`. Import them directly; check the four scripts render (no boxes) and that the page does not load all four message files into client JavaScript (it is server HTML only).
- **`TODO-translate` leaking.** Always read text through `getTranslations`/`loadMessages`, never raw JSON, so the marker falls back to English.
- **Sideways scroll.** Ribbon, footer wordmark and stamp are the usual culprits. Put the ribbon and wordmark in `overflow-hidden` wrappers; test at 360px and 200% font.
- **Accidental client code.** Any `"use client"` in the landing adds about 12 KB through `ClientMessages`. None is expected; the PR must say why if one appears.
- **Dead links.** Only `#waitlist`, `#tools` and `/xx/` are used. No `href="#"`.
- **Money and dates as text.** Amounts only via `formatRupees`; no month name in any message file.
- **Canonical host.** Always from `brand.domain`; never typed.
- **Tailwind tokens.** No raw hex; `pnpm lint` runs the token check.
- **`h1` and landmarks.** `<header>` and `<footer>` must not sit inside `<main>`; the layout's `HtmlShell` must not add a second `<main>` (check it before composing).

### Not doing
- The waitlist form, table, privacy notice, consent line (R0-4).
- Tool links, the reminder and receipt generators (R0-2, R0-3).
- Sitemap, `robots.txt`, `og:image`, JSON-LD, canonical on `/` (R0-5).
- A language picker or saved language (R1-1).
- A ribbon animation, card rotation, month on the card, price or Pro text.
- A `(public)` route group, a new dependency, any file under `public/`.
- Desktop two-column composition beyond "does not break".

### Hand-off
`frontend-dev` starts with task 1 (`src/lib/seo.ts` and its test), then tasks 2 to 6 in order; `test-engineer` takes task 7 after the build is green.

## Build record — frontend-dev (tasks 1 to 6)
- `TODO-translate` values: 46 (hi 2, kn 22, te 22; en 0). 56 keys in each file. Flagged values show their English text in the page and in the 404, never the marker.
- Initial JS, gzipped (`pnpm size`): `/en/` 132.1 KB, `/hi/` 132.1 KB, `/kn/` 132.1 KB, `/te/` 132.1 KB, `/` 132.1 KB. No Client Component was added. `out/404.html` also 132.1 KB.
- `experimental.globalNotFound` was proven in a build: `out/404.html` has `<html lang="en">`, the five font variables, four `<section lang>` blocks, four links and `noindex`. `pnpm check:404` guards it in CI.
- Rule found while drafting: `check:leak` matches by substring, so a flagged (English) sentence in hi/kn/te must not contain a short English value that another key has translated (for example "Remind" or "Coming soon"). Such sentences were reworded or drafted.
- `Button` gained `size="large"` (56px) for criterion 11.
- Fonts: the ribbon's Hindi, Kannada and Telugu words and the footer endonyms are drawn without the Anek faces (the ribbon words have no `lang`; the footer links keep `lang` but use the new `type-endonym` role in the Latin stack), so `/en/` fetches no Anek file. DM Mono is now fetched (not preloaded) on the landing because mono labels are drawn.
- E2E specs changed only where the old placeholder page forced it: `smoke`, `jump`, `fonts`, `languages` and the new `messageText` helper.
