# F3 — Languages

## Goal
Every page can be shown in English, Hindi, Kannada or Telugu from its own address, and amounts, dates and phone numbers are written one way, in one place. After this slice a later screen only needs `t("key")`, `formatRupees()` and `formatDate()`; it does not decide how a language, a rupee or a date works.

Size: S, as in the build plan. It is routing, message files, a stricter key check and three formatters. No new screens.

## Users and moment
- **Now:** `frontend-dev` (R0-1, R0-2, R0-3, R0-5, R1-1 all need this), `test-engineer`, and the founder, who can open the same page in four languages.
- **Later, through every screen:** a tutor on a low-end Android who reads Hindi, Kannada or Telugu, and arrives from a search result or a shared link. Nothing in F3 asks that person to choose or sign in.

## What the docs say (checked in `node_modules/next/dist/docs/`)
- `01-app/02-guides/static-exports.md`, "Unsupported Features": **Proxy, `redirects()` and `rewrites()` in `next.config` do not work with `output: 'export'`.** The usual Next.js recipe (a proxy that reads `Accept-Language` and redirects `/` to `/hi/`) therefore cannot be used. Dynamic routes need `generateStaticParams()` and no `dynamicParams`.
- `01-app/02-guides/internationalization.md`, "Static Rendering": a `[locale]` segment with `generateStaticParams()` returning the four locales prerenders one page per language, and `<html lang={locale}>` goes in the layout under that segment. Only the Server Component's output is sent, so the dictionary does not enter the client bundle unless passed down.
- `next-intl` is **not** in `package.json` and not in `node_modules`. The next-intl documentation is not in the repo, so the next-intl-specific static-rendering steps (and whether its request-locale helper works with `output: 'export'`) cannot be confirmed from here. `tech-lead` must read them after install and write down what differs (see Hand-off).
- `src/CLAUDE.md` and the build plan (decision 8) already say: a `[locale]` segment for public pages, signed-in app under `[locale]/(app)`, token routes `/p`, `/r`, `/join` outside it.

## Acceptance criteria

Each is marked **[unit]**, **[e2e]** (Playwright, 360px, against `out/`) or **[manual]**.

### URLs and the page language
1. After `pnpm build`, `out/` contains `en/index.html`, `hi/index.html`, `kn/index.html`, `te/index.html` and `index.html`. [e2e]
2. `/en/`, `/hi/`, `/kn/` and `/te/` each show the home placeholder (criterion 40) in that language. The words are already in the delivered HTML: with JavaScript turned off the page still reads in that language. [e2e, JavaScript disabled]
3. The `<html>` tag of those four pages has `lang="en"`, `"hi"`, `"kn"` and `"te"` respectively, in the HTML file as built (not set later by a script). [e2e]
4. Opening `/hi/`, `/kn/` or `/te/` makes the Anek face of that script the first font in the computed `font-family` of body text, and the F2 Indian-script rules apply (letter-spacing 0, no uppercase). `/en/` uses Bricolage Grotesque. [e2e, computed styles]
5. On `/en/` the browser downloads no Anek font file. On `/hi/` it downloads the Devanagari file only, and likewise for `/kn/` and `/te/`. [e2e, network log]
6. `/dev/components/` keeps `<html lang="en">`, and each of its four language blocks keeps its own `lang`. [e2e]
7. Any other first segment (for example `/fr/`) returns the site's 404 page, not a blank page and not English content. [e2e]
8. The build uses `output: 'export'` and nothing the docs list as unsupported: there is no `proxy` file, and `next.config.ts` has no `redirects()` or `rewrites()`. [unit, reads the files]
9. Every locale page has a `<title>` equal to the product name from `src/config/brand.ts`. Per-language titles and descriptions belong to R0-5. [e2e]

### Choosing a language on `/`
10. `/` is a static page that sends the visitor to one of the four language addresses. The order of choice is: a saved choice, then the browser's language list, then English. [e2e]
11. The browser's language list is read in order. The first entry whose main language is `en`, `hi`, `kn` or `te` wins, ignoring region and case. Unsupported entries are skipped. An empty list gives English. [unit; exact cases below]
    - `["hi-IN","en-US"]` gives `hi`
    - `["ta-IN","kn"]` gives `kn`
    - `["TE"]` gives `te`
    - `["en-GB"]` gives `en`
    - `["ta-IN","ml"]` gives `en`
    - `[]` gives `en`
12. A phone whose browser language is Hindi opens `/` and lands on `/hi/`. A phone set to Tamil only lands on `/en/`. [e2e, Playwright `locale` option]
13. A saved choice wins over the browser's language: saved `kn` with a Hindi browser lands on `/kn/`. [e2e]
14. The saved choice lives in the browser's own storage on the phone, not in a cookie and not on a server. A saved value that is not one of the four codes is ignored. If storage is blocked or throws (private mode), `/` still works using the browser's language and shows no error. The storage key does not contain the product name typed out (the existing "product name only in brand.ts" test would fail). [unit]
15. The jump from `/` replaces the history entry: pressing Back from `/hi/` does not return to `/` and bounce forward again. [e2e]
16. With JavaScript off, `/` shows four plain links, each a real `<a href>`, each labelled in its own language and script: English, हिन्दी, ಕನ್ನಡ, తెలుగు. Each is at least 44px high and the list fits at 360px with no sideways scroll. These four names are the one exception to "every string translated" (a language's own name is the same in every language) and live in one config file, not in `messages/`. [e2e]
17. Following one of those four links saves that language as the choice (criterion 14). The language picker screen itself is R1-1; the shared helper that reads and saves the choice is built here and unit-tested so R1-1 can call it. [unit + e2e]
18. Merely opening a language address (for example a shared `/hi/` link) does not change the saved choice. Only a deliberate pick (criterion 17, or R1-1's picker) does. [e2e] (Open question 5)

### Message files
19. `messages/{en,hi,kn,te}.json` have the same nesting. Top-level keys are namespaces named for a screen or area (`common`, `home`; later `landing`, `receipt`, `reminder`, `auth`). Keys inside are camelCase. Every leaf value is a string. [unit, via `pnpm i18n:check`]
20. English (`en.json`) is the source. The other three are checked against it. [unit]
21. `pnpm i18n:check` exits non-zero and names the file and the key when: a key from `en.json` is missing in another file; another file has a key `en.json` does not (extra); a value is empty or only spaces; a value is not a string. [unit, with fixture message folders]
22. It exits non-zero and names the key when the placeholders in a translation differ from English. Compared: argument names (`{name}`, `{count}`), and rich-text tag names (`<b>…</b>`). Different plural wording per language is fine; every plural and select must still have an `other` branch. [unit]
23. It exits non-zero on a value that is not valid message syntax (for example an unclosed `{`). [unit]
24. A value that starts with `TODO-translate` is allowed in `hi`, `kn` and `te`, never in `en`. The form is `TODO-translate: <the English text>`, so placeholders still match and criterion 22 still applies. The run prints how many such values there are. [unit]
25. `pnpm i18n:check --strict` also fails on any `TODO-translate` value. CI keeps running the plain command. The strict form is the Release 0 gate (build plan §7 item 5, native-speaker review). F3 builds the flag; wiring it into the release step belongs to `release-manager` and R0-5. [unit]
26. A message that needs the product name takes it as a placeholder (`{brand}`) filled from `src/config/brand.ts`. No message file contains the product name typed out, because the existing test scans `messages/`. [unit, existing test stays green]
27. A production build (`VERCEL_ENV=production`) has no file under `out/` containing the text `TODO-translate`. Either every such value has been translated or the build shows the English text. A user never sees the marker. [e2e or script]
28. The key check has its own tests: one passing fixture and one failing fixture per rule in criteria 21 to 25. [unit]

### Only the active language ships
29. The HTML and JavaScript that `/hi/` loads contain none of the Kannada or Telugu messages, and the English messages only where English is the page language. The same holds for each other language. Proved by taking one value unique to each file and searching the files each page loads. [e2e or script]
30. Initial JavaScript for each of `/`, `/en/`, `/hi/`, `/kn/`, `/te/` stays under the 200 KB gzipped limit of PRD §9 (`pnpm size`). The F3 target is 150 KB or less on every route; `/` was 132.1 KB before this slice. `tech-lead` records the measured numbers in the spec. [e2e, `pnpm size`] (Open question 6)

### Formatters
They live in `src/lib/format.ts` (named in `src/CLAUDE.md`) and are the only way a screen writes money, a date or a phone number. The output is the same in all four languages: digits 0 to 9, Indian grouping, English three-letter months (decided by the founder, 2026-10-09).

31. `formatRupees(paise)` takes integer paise and returns exactly: [unit]
    - `0` gives `₹0`
    - `99` gives `₹0.99`
    - `100` gives `₹1`
    - `100000` gives `₹1,000`
    - `12345600` gives `₹1,23,456`
    - `12345650` gives `₹1,23,456.50`
    - `999999900` gives `₹99,99,999`
    - `1000000000` gives `₹1,00,00,000`
32. Whole rupees show no decimals. Any paise show two decimals. (Open question 3) [unit, covered by 31]
33. The result contains only `₹`, the digits `0-9`, `,` and `.`, in every language: no Devanagari, Kannada or Telugu digits, even when the phone's language is set to one of them. [unit + manual]
34. `formatRupees` throws on a value that is not a whole number (`1.5`, `NaN`, `Infinity`, a string) and on a negative number. The PRD has no refund, credit or negative balance, so no screen can ask for one yet; the first slice that needs it must add it with its own tests. [unit]
35. `formatDate` takes an ISO timestamp or a `YYYY-MM-DD` date and returns `DD MMM YYYY` with a two-digit day and a three-letter English month: [unit]
    - `2026-10-08` gives `08 Oct 2026`
    - `2026-01-01` gives `01 Jan 2026`
    - `2026-12-31` gives `31 Dec 2026`
36. A timestamp is shown as the calendar day in India (Asia/Kolkata, UTC+5:30), whatever time zone the phone or the test machine uses. `2026-10-08T19:00:00Z` gives `09 Oct 2026`; `2026-10-08T18:29:00Z` gives `08 Oct 2026`. A plain `YYYY-MM-DD` is never shifted. [unit, run with the process time zone set to UTC and to America/Los_Angeles]
37. `formatDate` throws on an invalid date (`2026-02-30`, empty string, `"abc"`). Leap day `2028-02-29` gives `29 Feb 2028`. [unit]
38. `formatPhone(e164)` turns `+919876543210` into `+91 98765 43210`. A value that is not a 10-digit `+91` number is returned unchanged, never altered or hidden. It does not parse or validate input; normalising a typed phone number to E.164 belongs to R1-3 and R1-4. (Open question 4) [unit]
39. The formatters give the same results with or without full ICU data (a low-end Android WebView may lack it). [unit, plus the manual check]

### `/dev/components` and the strings rule
40. `/en/`, `/hi/`, `/kn/`, `/te/` show the home placeholder: the product name as the headline (from `brand.ts`) and one translated line (`home.placeholder`), nothing else. R0-1 replaces it. It is the visible proof that routing, messages, `lang` and fonts work together. [e2e]
41. `/dev/components` stays outside the locale routes, is not in the production build (F2 criterion 65), and its sample strings stay in `src/app/dev/components/sample-data.ts`, not in `messages/*.json`. All F2 end-to-end tests pass unchanged. (F2 Open question 1; restated as Open question 7 here.) [e2e]
42. `/dev/components` gets one new section, "Formats". For each of its four language blocks (each marked with its `lang`) it shows `formatRupees` for `0`, `99`, `100000`, `12345600` and `formatDate` for `2026-10-08`, and `formatPhone` for `+919876543210`. The text is identical in all four blocks. The `figures` in `sample-data.ts` that are plain strings today (`₹1,23,456`, `08 Oct 2026`) come from the formatters, with the same rendered text, so F2's screenshots do not change. [e2e]
43. The existing "components hold no words" test keeps checking the thirteen files in `src/components/ui/` as it does now. It is extended to also scan every `.tsx` file under `src/app/` (except `src/app/dev/`) and `src/components/` outside `ui/`. A visible English word typed in JSX there fails the test. The endonyms of criterion 16 come from the config file, so they pass. [unit]
44. Switching to a locale never needs a code change in a component: a component calls `useTranslations` / `formatRupees` and nothing else about language. A grep-level check finds no `if (locale === "hi")`-style branch outside `src/lib/` and `src/config/`. [unit]

## Edge cases
- **No JavaScript, or script blocked.** `/` shows the four links (16). Every `/xx/` page is plain HTML and reads correctly (2).
- **Slow network.** A visitor on `/` sees the four links until the jump runs. The jump script must be tiny and not wait for the app bundle.
- **Hindi browser, first visit, no saved choice.** Lands on `/hi/` (12). Nothing is saved until they pick on purpose (18).
- **Browser language not supported** (Tamil, Malayalam: planned for Release 3). English, never an error (11).
- **Saved choice is garbage, or storage is blocked.** Ignored; browser language is used (14).
- **A Hindi link shared on WhatsApp opened by a Kannada tutor.** They see Hindi (the address is the language). Their saved choice is untouched (18). Pay and receipt pages for parents (`/p`, `/r`) are outside this slice; see Out of scope.
- **Trailing slash.** `trailingSlash: true` is already set, so `/hi` goes to `/hi/` on Vercel. No extra rule here.
- **Unknown or mistyped language segment.** 404 (7). The 404 page is static, so it is not translated per visitor in F3.
- **Very long names, large font size, 360px.** F3 adds no layout, but the placeholder and the `/` links must hold at 360px and at the phone's largest font size with no clipped word or sideways scroll, in all four languages.
- **A translation 40% longer than English.** The check does not limit length; layouts grow (F2 rule).
- **Partial payment and amounts at the extremes.** `formatRupees` handles paise (31), crore-sized values (`₹1,00,00,000`), and refuses fractions and negatives (34). Partial-payment states belong to R1-7.
- **Duplicates.** Two keys with the same name in one JSON file are silently merged by `JSON.parse`; the check cannot see this. Code review catches it.
- **Dates near midnight in India, or phone clock set wrong.** The date shown is the India calendar day of the stored timestamp (36); the phone's time zone does not move it.
- **Month in a sentence** ("fee for October 2026") is not `DD MMM YYYY`. The PRD gives no format for it; R0-2 and R1-6 decide (see "Missing from the PRD").
- **Parent opening an old link.** No parent links exist before R1-9. When they do, the pay and receipt shells get their language from the tutor's data, not from the address (carry forward).

## Out of scope
- **Language picker screen, saving the language to the tutor profile, parent language per student.** R1-1 (picker and profile) and R1-3 (student field). F3 builds only the read and save helper they will call.
- **Per-language titles and descriptions, `hreflang` alternates, sitemap, canonical links.** R0-5. F3 only fixes the address shape those depend on.
- **Landing page, tool pages, tool URLs.** R0-1, R0-2, R0-3.
- **Real Hindi, Kannada and Telugu copy for later screens.** Each slice adds its own keys. Native-speaker review of all message files happens before Release 0 ships (build plan §7 item 5); the strict check (25) is the gate.
- **Message text inside the `/p`, `/r`, `/join` shells and WhatsApp message templates.** R1-7, R1-8, R1-9. They sit outside the locale routes and will need the message provider to take its language from data, not the address. `tech-lead` should not close that door.
- **Month-only labels, relative dates ("2 days ago"), times of day, pluralised counts in the formatters.** Added by the slice that first needs them.
- **Tamil and Malayalam.** Release 3.
- **Translating the 404 page.** Later, with the first real public pages.
- **Right-to-left support.** None of the four languages needs it.

## Design references
No new screen. The canvas files below show the type rules and the future picker that this slice prepares for.
- `design/project/Type-indic.dc.html`: per-script type rules the `lang` attribute switches on (checked by F2 criterion 13).
- `design/project/Language.dc.html`: the language picker, built in R1-1, not here.
- `design/project/Language-6.dc.html`: the picker with Tamil and Malayalam, Release 3.
- `docs/DESIGN.md`: the Indian-script row of the type table and the rule that amounts always use 0 to 9 digits.

## Analytics
None. No event in PRD §10 belongs to this slice. Page-view events per language arrive in R0-5.

## Test by hand on a phone
The founder has said phone checks wait until the web app works end to end. Run these three then, not now.
- **H1. Hindi phone.** Set the phone's language to Hindi, open the site root. You land on a `/hi/` address, the page reads in Hindi, and the script looks right (not boxes).
- **H2. Digits.** On `/dev/components/`, open "Formats". Every amount and date uses 0 to 9 and reads `₹1,23,456`, `08 Oct 2026` in all four blocks, with the phone still set to Hindi.
- **H3. Large font.** Set the phone's font size to the largest. `/kn/` and the `/` link list: nothing is cut off, nothing runs sideways.

## Decided by the founder, 2026-10-09
- **URL shape (was question 1).** Every language has a prefix: `/en/`, `/hi/`, `/kn/`, `/te/`. `/` is a small static jump page: saved choice first, then the browser's language, then English, with four plain links that need no JavaScript. In R0-5, `x-default` points at `/en/`. Criteria 1, 10 to 18 already say this. Unprefixed tool addresses from the PRD (`/tools/fee-receipt`) are not built; with this shape they are `/hi/tools/fee-receipt/`, and any redirect from the old form is for R0-1 or R0-2 and F4.
- **Month names (was question 2).** English three-letter months in all four languages: `09 Oct 2026`. Criterion 35 stands as written. The formatter takes no language argument.

## Open questions
Questions 1 and 2 are decided above. Questions 3 to 8 have no founder answer yet: **proceeding on the recommendation** for each, so they stay visible until answered. Questions 9 and 10 were added by `tech-lead`.

3. **Paise on screen.** *Proceeding on the recommendation.* Whole rupees show no decimals, paise show two (`₹0.99`, `₹1,23,456.50`). This matters for partial payments. Confirm.
4. **Phone display.** *Proceeding on the recommendation.* `+91 98765 43210`. The PRD only says store in E.164 and normalise to +91.
5. **Does opening a language address save that language?** *Proceeding on the recommendation.* No, only a deliberate pick does (criterion 18), so a shared Hindi link does not override a Kannada tutor's choice. Confirm.
6. **Bundle target for F3.** *Proceeding on the recommendation.* The hard limit is 200 KB; aim for 150 KB or less on every route so R0-1 has room. Confirm, or give the number you want.
7. **Dev page strings.** *Proceeding on the recommendation.* `/dev/components` sample strings stay beside the page in `sample-data.ts` and out of `messages/*.json`. **This closes F2's Open question 1** the same way (F2 spec, Open questions). Confirm.
8. **The F3 placeholder line.** *Proceeding on the recommendation.* The implementer writes a plain draft of `home.placeholder` in each language, treated like F2's sample strings; the Release 0 native review covers it with every other file. Alternative: you supply the sentence now.
9. **`next-intl` and the dependency policy (added by `tech-lead`).** `next-intl` is in the CLAUDE.md stack, but it fails one test in `docs/BUILD_PLAN.md` section 2: it has one maintainer (Jan Amann: 1,259 commits, against 3 for the next contributor) and no company behind it. It passes the other tests (see the technical plan, section 3). Recommendation: approve it as in the stack, because the cost of replacing it is small (it is used in four files plus `useTranslations` imports) and the alternative is writing our own plural and rich-text handling. Founder: confirm, or ask for the hand-written alternative (about 80 lines, no plurals or rich text).
   - **Decided by the founder, 2026-10-09: approved.** `next-intl` 4.14.7, with the sub-packages pinned by `overrides`.
10. **A dev-only dependency for the key check (added by `tech-lead`).** Criteria 22 and 23 need a real message-syntax parser. `@formatjs/icu-messageformat-parser` is already installed under `next-intl` (it is what parses messages at run time), so listing it as a `devDependency` adds no bytes and checks exactly what the app parses. Three npm maintainers, MIT, no open advisory. Alternative: a hand-written scanner of about 120 lines in `scripts/`, which can disagree with the real parser. Recommendation: approve the parser. `frontend-dev` does not install it until the founder says yes.
   - **Decided by the founder, 2026-10-09: approved.** `@formatjs/icu-messageformat-parser` 3.5.20 as a devDependency.

## Missing from, or inconsistent in, PRD and build plan
- The PRD gives tool addresses without a language prefix; the build plan and `src/CLAUDE.md` say one route segment per locale. These disagree (Open question 1).
- The PRD names a language picker (R1) but says nothing about how an unsigned visitor to a free-tool page gets a language. The build plan puts routing in F3. The criteria above fill that gap (criteria 10 to 18) and ask for confirmation.
- `next-intl` is in the stack in `CLAUDE.md` but not in the build plan's dependency table, and not in `package.json`.
- No PRD format for a month alone ("October 2026" on the dues board's month switcher, reminder text). Needed by R0-2 and R1-6.
- No PRD rule for paise, negatives, or the time zone of dates.
- The build plan says each locale loads only its own script font; F2 already does this through `unicode-range`. Criterion 5 now tests it per route.

## Hand-off
Next: `tech-lead` appends the technical plan to this file. Decisions that are theirs:
1. **Dependency check for `next-intl`** under the build plan's policy (release in the last 12 months, more than one maintainer, no open high advisory), exact pinned version, wrapped behind one file in `src/lib/`. Read the next-intl docs on static export and say where they differ from the Next.js 16 notes above.
2. **Root layouts.** Today `src/app/layout.tsx` holds `<html lang="en">`. The locale pages need `lang` per route, `/` needs a shell, and `/dev/components` must stay `lang="en"`. Decide the layout tree (multiple root layouts) and where `fontVariables` goes.
3. **How `/` jumps** without a server: where the small script runs so it fires before paint, how the no-JavaScript links are built, and keeping it out of the app bundle.
4. **How the active language's messages reach a page** so only that language ships (criterion 29), including which namespaces go to Client Components.
5. **Formatter method:** `Intl` or hand-written grouping, given low-end WebViews (criteria 33 and 39), and the signature if Open question 2 turns out "translated months".
6. **`TODO-translate` at runtime:** strip the prefix or fail the build (criterion 27).
7. **How the message provider will take its language from data** for `/p`, `/r`, `/join` later, without being tied to the address.
8. **Test wiring:** fixture folders for the key check, the extended strings scan (43), the per-route size and message-leak checks (29, 30) and the two time-zone runs (36).
9. **The measured per-route sizes** against the 150 KB target, recorded here.

---

## Technical plan — F3

Written by `tech-lead` on 2026-10-09. There is no backend work: no table, migration, policy, function or Edge Function. Every task is `frontend-dev` or `test-engineer`.

Things marked **(verified)** were checked on 2026-10-09 in `node_modules/next/dist/docs/` (Next.js 16.4.0), in the published `next-intl` documentation and package, and by a throwaway build in a copy of this repo under the session scratchpad (Next 16.4.0, Turbopack, `next-intl` 4.14.7). **The working tree was not changed**: `git status` shows only this spec. `package.json`, the lockfile and `pnpm-workspace.yaml` are untouched; `frontend-dev` does the install (section 3).

### 1. Approach

Four prefixed routes come from one `src/app/[locale]/` folder whose `layout.tsx` is a root layout: it writes `<html lang>` and returns the four locales from `generateStaticParams()`. `next-intl` reads the locale from `next/root-params` (Next 16.3 and later), so there is no proxy, no `setRequestLocale` and no header read; every page is plain static HTML with the active language's words already in it. `/` is a second root layout holding four `<a href>` links and one inline script that runs while the page is parsed and calls `location.replace()`; `/dev/components` is a third root layout, unchanged in behaviour. `format.ts` is hand-written (no `Intl`) so the output cannot depend on the phone. `pnpm i18n:check` becomes a tested module that uses the same parser the app uses.

### 2. Split and size

One pull request. I read the size as S to M: the routing and the formatters are small; the key check, its tests and the extended strings scan are most of the work. If it drags, the cut is after build step 6 (routes, messages, formatters, `/dev` section all working) and before step 7 (the stricter key check, the strings scan, the leak and size scripts). Steps 7 to 9 do not change what a user sees.

`frontend-dev` owns all code and the unit tests written beside it. `test-engineer` owns `e2e/` (new files and any retargeting of old ones) and checks that every criterion in section 10 has a test that can fail. See section 10 for who writes what.

### 3. Dependencies

#### 3a. `next-intl`: the dependency-policy check (`docs/BUILD_PLAN.md` section 2)

| Test | Result |
| --- | --- |
| 1. Prefer the platform | Plurals, select and rich-text tags in four scripts are not something to hand-write. The platform has `Intl.MessageFormat` nowhere yet. Hand-written lookup is the alternative (Open question 9). |
| 2a. Release in the last 12 months | Pass. Releases about weekly; latest `4.14.9` on 2026-10-02. |
| 2b. More than one maintainer, or a company | **Fail.** One npm maintainer (`amann`); GitHub shows 1,259 commits by the author, 3 by the next contributor. No company. Funded by sponsorship. Put to the founder as Open question 9. It is in the CLAUDE.md stack and the Next.js i18n guide lists it, which is why I propose it anyway. |
| 2c. No open high-severity advisory | Pass. Three published advisories (low, medium, medium), all fixed in `4.9.2`. We pin `4.14.7`. |
| 3. Pin exact | `4.14.7`, released 2026-09-24, **15 days old** (2026-10-09). `4.14.8` is 10 days old and `4.14.9` is 7, so neither qualifies. |
| 4. Behind one file in `src/lib/` | **Not done, see section 13.** The knowledge of next-intl sits in four places: `next.config.ts`, `src/i18n/request.ts`, `src/components/i18n/client-messages.tsx` and the `useTranslations` / `getTranslations` imports. Replacing the library is a search and replace of those imports plus three files. |
| 5. Recorded here | This section. |

**Exact commands for `frontend-dev`:**

```
pnpm add --save-exact next-intl@4.14.7
```

then add to `pnpm-workspace.yaml`:

```
overrides:
  use-intl: 4.14.7
  icu-minify: 4.14.7
ignoredBuiltDependencies:   # existing list, add two lines
  - '@swc/core'
  - '@parcel/watcher'
```

Why the overrides: `next-intl@4.14.7` asks for `use-intl@^4.14.7` and `icu-minify@^4.14.7`, which pnpm resolved to `4.14.9`, a package seven days old. The override keeps all three on the same 15-day-old release. **(verified: install, build and size identical with the override.)** The two ignored build scripts belong to an SWC message-extractor we do not use; do not run `pnpm approve-builds`.

**Install size (verified, `pnpm install` before and after):** `node_modules/.pnpm` 537 MB to 551 MB, **+14 MB on disk**, almost all of it the `@swc/core` binary for the build machine. Nothing of it is shipped. `next-intl` itself is 1.3 MB unpacked; `use-intl` 1.2 MB. About twenty new packages in total, most of them SWC and file-watcher tooling that is not shipped. CI downloads the Linux SWC binary: a few seconds, not measured.

**What it adds to a route (verified, `pnpm size`, same machine, Turbopack):**

| Route | Before (F2b) | With next-intl, server-only use | With `NextIntlClientProvider` and one client component |
| --- | --- | --- | --- |
| `/` | 132.1 KB | 132.1 KB | not used on `/` |
| `/en/` `/hi/` `/kn/` `/te/` | n/a | **132.1 KB** | **144.4 KB** (+12.3 KB: the ICU message parser, `intl-messageformat`, `use-intl` core) |
| `/dev/components/` | 138.7 KB | 138.7 KB | not used |

So `useTranslations` / `getTranslations` in a Server Component costs **zero JavaScript**, because the words are in the HTML. The 12.3 KB is paid only by a route that passes messages to a Client Component, and only for that route. This is why the provider is not in the locale layout (section 5). F3's own four pages ship at 132.1 KB; the first real screen that needs a client-side translation lands at about 144 KB, 5.6 KB under the 150 KB target.

**Message-check parser (Open question 10):** `@formatjs/icu-messageformat-parser`, dev-only, pin `3.5.20` (released 2026-09-19, 20 days old; `3.5.21` is 4 days old). Two copies are in the tree today (`3.5.18` and `3.5.21`, from `intl-messageformat`). `frontend-dev` does not add it until the founder answers; step 7 is arranged so it comes last in the slice for that reason.

#### 3b. Where next-intl's static behaviour differs from what the spec assumed

The next-intl routing page does not mention `output: 'export'` anywhere, and the installed package ships no docs (it has `README.md` and types only). The points below come from the Next.js 16.4 bundled docs and from the throwaway build, not from next-intl's text. Each is **(verified)** by a build.

1. **No middleware, and none is wanted.** next-intl's setup page adds a `proxy.ts` calling `createMiddleware(routing)`. Next's static-export guide lists Proxy as unsupported. We skip it entirely. We do not import `next-intl/middleware` or `next-intl/routing`.
2. **The locale comes from `next/root-params`, not from `requestLocale`.** The first prototype used the `requestLocale` argument of `getRequestConfig`; the build logged `NEXT_STATIC_GEN_BAILOUT ... used headers()` three times (the pages were still written, but the log is the warning that the approach reads a request header). `requestLocale` reads the `x-next-intl-locale` header that the middleware would have set. Removing that argument and calling `await rootParams.locale()` made the log clean. `next/root-params` is on by default from Next 16.3 (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-root-params.md`); we are on 16.4.0.
3. **`setRequestLocale` is not needed.** next-intl calls it "a legacy API" in favour of root params. A build with the call removed gave identical output. Do not add it.
4. **`generateStaticParams` goes in the locale layout** (it is the root layout), returning the four locales. With `output: 'export'` an unlisted value such as `/fr/` is not built and gets the 404 file. In `next dev`, `/fr/` returns 404 and logs `missing param in generateStaticParams() ... required with output: export`; that log line is expected, not a bug.
5. **The root layout is under a dynamic segment**, so there is no single root layout. Next's rule: "any layout without a `layout.js` above it is a root layout". There must be **no `src/app/layout.tsx`**; the three roots are `(jump)`, `[locale]` and `dev`. Navigating between roots is a full page load, which is what we want (the jump is a full load anyway).
6. **Every page sits under a root layout with `<html>` and `<body>`.** The old `src/app/page.tsx` must move into a route group `(jump)`; the group name is not in the URL.
7. **The 404 is Next's default** (see section 4 and section 13). `experimental.globalNotFound` also works (verified) but is not used.
8. **Typed keys work.** An `AppConfig` augmentation (`declare module "next-intl"`) makes `t("nope")` a typecheck error and `locale` a four-value union. Verified with `tsc`.

### 4. Routes, layouts, `/`, `/dev`, 404

```
src/app/(jump)/layout.tsx       root layout of /   : <html lang="en"> via HtmlShell
src/app/(jump)/page.tsx         the jump page
src/app/[locale]/layout.tsx     root layout of /xx/: <html lang={locale}>, generateStaticParams
src/app/[locale]/page.tsx       home placeholder
src/app/dev/layout.dev.tsx      root layout of /dev: <html lang="en">   (dev-only extension)
src/app/dev/components/...      unchanged
```

(`src/app/layout.tsx` and `src/app/page.tsx` are deleted.)

**One shared shell.** `src/components/shell/html-shell.tsx` takes `lang` and `children` and returns `<html lang className={fontVariables}><body className="bg-page type-body text-ink">`; it imports `globals.css`. The three layouts call it; each declares its own `viewport` and `metadata` (a re-exported `viewport` is not something I verified, so three small copies). The locale layout sets `metadata = { title: brand.name }` (criterion 9). `/dev` keeps its own title from the page.

**`/dev/components` and production (verified).** `layout.dev.tsx` gets the same `pageExtensions` treatment as `page.dev.tsx`. A `VERCEL_ENV=production` build gave `out/` with `en hi kn te`, `index.html`, `404.html` and **no `dev` folder**, and the CI step that checks that keeps passing. In a normal build the dev page is `lang="en"` with its four `lang` blocks, as before.

**How `/` works without a server, and why it is safe for search.**

- It is a static page, so the server does nothing. The HTML contains `<main>` with four `<a href="/en/">`-style links built from `src/config/locales.ts` (code and endonym), each with its own `lang` and `hrefLang` so the F2 script rules and font apply. Links are real anchors and work with JavaScript off (criterion 16); the page is as tall as it needs to be and each link is at least 44px high.
- The jump is one inline `<script>` at the top of `<main>`, written with `dangerouslySetInnerHTML` from a string constant `JUMP_SCRIPT` in `src/lib/jump-script.ts`. It is parsed and run inline, not waiting for the Next bundles, which are all `async`. **(verified in Chromium: Hindi browser lands on `/hi/`; `goBack()` does not return to `/`, because `location.replace()` replaced the entry.)**
- The script is plain ES5 and does four things: read the saved value from `localStorage` inside `try/catch` and ignore anything not in the four codes; if none, take the first entry of `navigator.languages` (fall back to `[navigator.language]`) whose part before `-` lower-cased is one of the four; else `en`; then `location.replace("/" + code + "/")`. It does nothing if `location.hash === "#choose"`.
- **Single source of truth.** The locale list and the storage key are interpolated into the string from `src/config/locales.ts` and `src/lib/locale-choice.ts`. The unit test runs the string itself in a Node `vm` with a fake `navigator`, `localStorage` and `location`, so the code that is tested is the code that ships. There is no second TypeScript copy of the matching rule.
- **Saving a pick.** The script also adds one `click` listener on `document` that, for an anchor with `data-locale`, writes the code to storage in `try/catch` and lets the navigation go on. This is criterion 17. `locale-choice.ts` exports `readSavedLocale()` and `saveLocale(code)` for R1-1 to call, and `STORAGE_KEY = "ui-language"` (no product name in it). Opening `/hi/` writes nothing (criterion 18): no page other than a deliberate pick calls `saveLocale`.
- **`#choose`** keeps the page on screen with the four links, so a test can click one with JavaScript on (criterion 17 cannot be tested otherwise: a normal visit jumps at once) and R1-1 can link "change language" to `/#choose`. One condition; see section 13.
- **SEO.** `/` is not redirected with a header or a `<meta refresh>`, so a crawler sees real links to all four languages and follows them; Google follows a script `replace` as a redirect. There is no `noindex` on `/` (that would drop the site root). R0-5 adds the canonical and `x-default` pointing at `/en/`, as decided. Nothing in F3 stops R0-5.
- **Cost.** `/` is still a Next page, so it ships the same 132.1 KB runtime although the script usually leaves before it is fetched. A pure `public/index.html` would be about 2 KB but could not use `brand.ts`, the tokens or the fonts, and `pnpm size` fails closed on a page with no scripts. Not worth it.

**The 404.** Next's default `out/404.html` is used. It is English, unstyled and has no `lang` (verified). Criterion 7 asks for "the site's 404 page"; this is it until a slice translates it. `experimental.globalNotFound` would let us style it but is experimental, and the text would need keys in all four files for a page the spec says is untranslated; I leave it for R0-1.

### 5. Messages: only the active language ships

- `src/i18n/request.ts` (the file `createNextIntlPlugin()` finds by default) is five lines: read the locale with `await rootParams.locale()`, 404 if it is not one of the four, return `{ locale, messages: await loadMessages(locale) }`. **It does not use the `requestLocale` argument.**
- `src/i18n/messages.ts` exports `loadMessages(locale)`: a dynamic import of that one `messages/<locale>.json` and the **`TODO-translate` strip** (below). It takes the locale as an argument and knows nothing about routes. The server bundle holds all four files as lazy chunks; **none reaches the client** (verified: a value unique to each file appears in that language's HTML only, and in no `_next` file).
- Server Components use `useTranslations` / `getTranslations`. Their output is HTML; the route gets no extra JavaScript. This is the default for every screen.
- **Client Components.** The locale layout does **not** wrap children in `NextIntlClientProvider`: doing so costs +12.3 KB on every language route for nothing. Instead `src/components/i18n/client-messages.tsx` is a small Server Component, `<ClientMessages namespaces={["receipt"]}>`, that calls `getLocale()` and `getMessages()`, picks only the named namespaces and renders `NextIntlClientProvider` with them. A screen wraps the smallest subtree that needs it. Only those namespaces of the active language end up in that page's HTML payload. Messages stay strings; the ICU parser runs in the browser.
- **The leak guard** (`scripts/check-locale-leak.mjs`, section 9): for each language it takes values that are in that file and in no other file's values, and fails if any appears in another language's HTML or in any script that page loads. Untranslated values (stripped `TODO-translate` text) equal the English text and are excluded from "unique", which resolves a clash between criteria 27 and 29: a Hindi page showing an untranslated English line is not a leak.
- **`TODO-translate` at runtime (criterion 27).** `loadMessages` replaces a value that starts with `TODO-translate: ` by the text after the prefix, in every build, not only production: one code path, and the founder and the reviewers see readable English instead of a marker. The marker is therefore never in HTML or script output. The key check counts them, and `--strict` fails on them (section 6). CI gets one more line in its last step (the production build, which already overwrites `out/`): fail if `grep -rqF "TODO-translate" out` matches. Nothing is stripped from the source files, so the native-speaker review still finds them.
- **`/p`, `/r`, `/join` later (Hand-off 7).** The door is not closed. `loadMessages(locale)` has no link to the address. A token shell is a client page that learns the language from the Edge Function and can render `NextIntlClientProvider locale messages` itself, with the messages from `await import("../../messages/xx.json")` in a Client Component (a lazy chunk per language, about the size of its file). That slice picks the exact way. F3 only has to avoid putting `rootParams` anywhere except `request.ts`, and it does not.
- `src/i18n/types.d.ts` augments `next-intl`'s `AppConfig` with `Messages: typeof en` and `Locale` (section 3b, item 8).

### 6. The key check

`scripts/i18n-check.mjs` becomes a thin command; the rules move to `scripts/i18n-check-lib.mjs` (an exported `check(messagesDir, { strict })` that returns a list of problems). The command reads `messages/` from the current directory, as `check-tokens.mjs` reads `src/`, so a test can run it in a throwaway folder the way `check-tokens-cli.test.ts` does. No `--dir` flag.

| Rule (criterion) | Output |
| --- | --- |
| Same keys as `en.json`: missing, extra (21) | `messages/hi.json is missing "home.placeholder"` / `has "home.extra" which en.json does not` |
| Every leaf is a string, none empty or only spaces (19, 21); nesting is objects only; keys camelCase (19) | names file and key |
| Valid message syntax (23) | parse with the parser; names file, key and the parser's message |
| Same argument names and tag names as English (22) | `messages/kn.json "x.y": expected {name} <b>, found {nam}` |
| Every plural and select has an `other` branch (22) | names file and key |
| `TODO-translate: ` allowed in hi, kn, te; never in en (24). The text after it is checked as the English text, so criterion 22 still applies | prints `i18n: 3 values marked TODO-translate` |
| `--strict`: any `TODO-translate` fails (25) | names each |
| No product name in a value (26) | covered by the existing brand-name test; the check does not repeat it |

Exit code 1 on any problem; a failing run prints all problems, not only the first. `package.json` keeps `"i18n:check": "node scripts/i18n-check.mjs"`; `pnpm i18n:check --strict` passes the flag through. CI runs the plain command (unchanged). The summary line keeps its present shape and adds the TODO count.

Duplicate keys in one JSON file stay invisible to this check, as the spec says; review catches them.

### 7. The formatters: `src/lib/format.ts`

No `Intl`, no `toLocale*`, no local-time getters. That is the whole answer to criteria 33 and 39: a low-end WebView with partial ICU, or a phone set to Hindi, cannot change the output because nothing asks the platform.

```ts
formatRupees(paise: number): string   // throws RangeError on non-integer, non-finite, unsafe, negative, non-number
formatDate(value: string): string     // "YYYY-MM-DD" or an ISO timestamp WITH an offset; throws RangeError otherwise
formatPhone(value: string): string    // +91XXXXXXXXXX -> "+91 XXXXX XXXXX"; anything else returned unchanged
```

- `formatRupees`: `typeof paise === "number" && Number.isSafeInteger(paise) && paise >= 0`, else throw. Rupees = `Math.floor(p / 100)`, paise = `p % 100`. Group the digits: last three, then pairs (`/\B(?=(\d\d)+(?!\d))/g` on the part before the last three). Prefix `₹`; append `.` and two digits only when paise is not 0. Output matches `/^₹[0-9,]+(\.[0-9]{2})?$/`.
- `formatDate`: a plain date must match `^\d{4}-\d{2}-\d{2}$` and survive a round trip through `Date.UTC` (so `2026-02-30` throws; `Date.parse` alone accepts it, **verified**). A timestamp must match `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$`; a timestamp **without** an offset throws, because `Date.parse` would read it in the phone's zone (**verified**). Then add 330 minutes (India has no daylight saving) to the epoch and read `getUTC*` fields. Month names from a constant array of English three-letter names. A plain date is never shifted.
- `formatPhone`: `^\+91\d{10}$` only; the first digit is not checked (R1-3 and R1-4 validate).
- Not exported, not built: month-only, relative dates, times of day, negative amounts, any language argument.

**Unit-test table (frontend-dev writes it in `src/lib/format.test.ts`; exact strings, verified by running the algorithm in Node):**

| Call | Result |
| --- | --- |
| `formatRupees(0)` | `₹0` |
| `formatRupees(5)` | `₹0.05` |
| `formatRupees(99)` | `₹0.99` |
| `formatRupees(100)` | `₹1` |
| `formatRupees(100000)` | `₹1,000` |
| `formatRupees(100099)` | `₹1,000.99` |
| `formatRupees(12345600)` | `₹1,23,456` |
| `formatRupees(12345650)` | `₹1,23,456.50` |
| `formatRupees(999999900)` | `₹99,99,999` |
| `formatRupees(1000000000)` | `₹1,00,00,000` |
| `formatRupees(1234567890)` | `₹1,23,45,678.90` |
| throws | `1.5`, `NaN`, `Infinity`, `-1`, `-100`, `2**53`, `"100"`, `null`, `undefined` |
| `formatDate("2026-10-08")` | `08 Oct 2026` |
| `formatDate("2026-01-01")` | `01 Jan 2026` |
| `formatDate("2026-12-31")` | `31 Dec 2026` |
| `formatDate("2028-02-29")` | `29 Feb 2028` |
| `formatDate("2026-10-08T18:29:00Z")` | `08 Oct 2026` (23:59 in India) |
| `formatDate("2026-10-08T18:30:00Z")` | `09 Oct 2026` (00:00 in India: the boundary) |
| `formatDate("2026-10-08T19:00:00Z")` | `09 Oct 2026` |
| `formatDate("2026-10-08T23:30:00Z")` | `09 Oct 2026` (05:00 on 9 Oct in India) |
| `formatDate("2026-10-09T00:30:00+05:30")` | `09 Oct 2026` |
| `formatDate("2026-10-08T19:00:00.123Z")` | `09 Oct 2026` |
| `formatDate("2026-12-31T20:00:00Z")` | `01 Jan 2027` (year rolls) |
| `formatDate("2026-03-31T18:30:00Z")` | `01 Apr 2026` |
| `formatDate` throws | `""`, `"abc"`, `"2026-02-30"`, `"2027-02-29"`, `"2100-02-29"`, `"2026-13-01"`, `"2026-10-08T19:00:00"` (no offset), `"8 Oct 2026"` |
| `formatPhone("+919876543210")` | `+91 98765 43210` |
| `formatPhone` unchanged | `"+9198765"`, `"+9198765432100"`, `"919876543210"`, `"+91 98765 43210"`, `"+14155552671"`, `"98765 43210"`, `""` |

**Time-zone and ICU runs (criteria 36, 39), in the same file:**

- The date table runs under `describe.each(["UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Kiritimati"])`. A `beforeAll` sets `process.env.TZ` (Node reads it again on assignment) and asserts that `new Date(2026, 0, 1).getTimezoneOffset()` equals the expected offset for that zone, so a silent no-op would fail the test. `afterAll` restores it.
- A test calls every function with `vi.stubGlobal("Intl", undefined)` and `Date.prototype.toLocaleString` replaced by a function that throws: results unchanged. This is the stand-in for a WebView without ICU data.
- A source test reads `format.ts` and fails on `Intl`, `toLocale`, `getHours(`, `getDate(`, `getMonth(`, `getFullYear(`, `getDay(` (the local-time getters).

### 8. Files

Owner is `frontend-dev` unless the row says `test-engineer`.

**Create**

| File | What goes in it |
| --- | --- |
| `src/config/locales.ts` | `locales = ["en","hi","kn","te"] as const`, `defaultLocale = "en"`, `isLocale()`, `localeNames` (the four endonyms: English, हिन्दी, ಕನ್ನಡ, తెలుగు). The one place a language is listed; `src/config/locales.test.ts` beside it. |
| `src/lib/format.ts`, `format.test.ts` | Section 7. |
| `src/lib/locale-choice.ts`, `.test.ts` | `STORAGE_KEY`, `readSavedLocale()`, `saveLocale()`; both safe when storage is missing or throws. Tests: garbage value ignored, storage that throws, round trip. |
| `src/lib/jump-script.ts`, `.test.ts` | `JUMP_SCRIPT` string. Test runs it in `vm` against the six cases of criterion 11 plus: saved `kn` beats Hindi browser (13); garbage saved value ignored (14); storage that throws (14); `navigator.languages` empty or missing falls back to `navigator.language`; `#choose` does not navigate; click on `[data-locale]` saves. |
| `src/i18n/request.ts` | Section 5. |
| `src/i18n/messages.ts`, `.test.ts` | `loadMessages(locale)` and the `TODO-translate: ` strip; test: stripped, `en` untouched, nested keys, a value that merely contains the word mid-string is kept. |
| `src/i18n/types.d.ts` | `AppConfig` augmentation (typed keys). |
| `src/components/shell/html-shell.tsx` | The shared `<html>`/`<body>`. |
| `src/components/i18n/client-messages.tsx`, `.test.tsx` | `ClientMessages`. Test renders a Client Component that calls `useTranslations` inside the provider with a picked namespace (jsdom), and checks an un-picked namespace is absent. |
| `src/app/(jump)/layout.tsx`, `page.tsx` | Section 4. Page text comes from `localeNames`; the only English is none (no sentence; the four names are the page). |
| `src/app/[locale]/layout.tsx`, `page.tsx` | Root layout with `generateStaticParams`, `metadata.title`; page shows `brand.name` as `h1` and `t("placeholder")`. |
| `src/app/dev/layout.dev.tsx` | The dev root layout. |
| `src/app/dev/components/sections/formats.tsx` | The "Formats" section (criterion 42): per language block, `formatRupees` for 0, 99, 100000, 12345600, `formatDate("2026-10-08")`, `formatPhone("+919876543210")`. |
| `src/test-utils/find-own-words.ts`, `.test.ts` | `findOwnWords` and `walk`, **moved** out of `no-strings.test.ts` so two tests can import them (a test file should not import another test file). The existing `findOwnWords` cases move with it unchanged. |
| `src/lib/language-rules.test.ts` | Criterion 44: no `locale === "hi"`-style branch outside `src/lib/`, `src/config/`, `src/i18n/`. |
| `src/lib/config-files.test.ts` | Criterion 8: no `proxy.ts`/`middleware.ts` in `src/` or the root; `next.config.ts` has no `redirects`, `rewrites`, `headers`; nothing imports `next-intl/middleware`. |
| `scripts/i18n-check-lib.mjs` | Section 6. |
| `scripts/check-locale-leak.mjs` | Section 5, leak guard. Reads `out/`. |
| `src/lib/i18n-check.test.ts` | Runs the command in throwaway folders: one passing and one failing case per rule of criteria 21 to 25 (list in section 10). |
| `src/lib/size-scripts.test.ts` | Runs `size.mjs` and `check-locale-leak.mjs` against a fake `out/` in a temp folder. |
| `e2e/languages.spec.ts`, `e2e/jump.spec.ts` (`test-engineer`) | Section 10. |

**Change**

| File | Change |
| --- | --- |
| `package.json` | `next-intl` `4.14.7` exact. Scripts: add `"check:leak": "node scripts/check-locale-leak.mjs"`. `i18n:check` unchanged. |
| `pnpm-workspace.yaml`, `pnpm-lock.yaml` | Section 3a. |
| `next.config.ts` | Wrap the config with `createNextIntlPlugin()`. Nothing else changes (**verified** with `pageExtensions` and the Turbopack CSS rule). |
| `messages/en.json` | Add `home.placeholder`. Keep `common.loading`. |
| `messages/hi.json`, `kn.json`, `te.json` | Same key; a plain draft in each language (Open question 8). All four files change in one commit. |
| `scripts/i18n-check.mjs` | Thin command over the lib. |
| `scripts/size.mjs` | Adds: warn above 150 KB (hard fail stays 200 KB); fail if any of `out/index.html` and `out/{en,hi,kn,te}/index.html` is missing (so criterion 30 cannot pass by omission). Output format kept. |
| `src/components/ui/no-strings.test.ts` | Imports `findOwnWords`/`walk` from `test-utils`; keeps the thirteen-file `ui/` test and the brand-name test (**its folders already include `messages`, `public`, `e2e`, `scripts`**; add nothing); adds the criterion 43 scan: every `.tsx` under `src/app/` except `src/app/dev/` and test files, and under `src/components/` outside `ui/`. |
| `.github/workflows/ci.yml` | After `pnpm size`: `pnpm check:leak`. In the last (production build) step: add `TODO-translate` to the sentinel loop. `pnpm i18n:check` stays as it is. |
| `src/app/dev/components/sample-data.ts` | `figures` entries that a formatter can produce are computed by `formatRupees`/`formatDate`; `allDigits` and `rupee` stay literal. Rendered text identical (`₹1,23,456`, `₹78,900`, `₹9,87,650`, `₹99,99,999`, `₹1,200`, `₹18,500`, `08 Oct 2026`). The Oct 2026 phrases inside the translated sample sentences stay as they are (Open question 7). |
| `src/app/dev/components/page.dev.tsx` | Adds the Formats section. |
| `e2e/smoke.spec.ts`, `e2e/fonts.spec.ts`, `e2e/dev-components.spec.ts` (`test-engineer`) | Retarget "home page" tests from `/` to `/en/` through one `HOME` constant in `e2e/helpers.ts`; no assertion changes. See section 13, item 8. |
| `src/CLAUDE.md` | Layout block: add `src/i18n/`, `src/config/locales.ts`, the three root layouts, and that there is no `src/app/layout.tsx`. (`tech-lead` hands this to `frontend-dev`; it is documentation, not application code.) |
| `docs/BUILD_PLAN.md` | Add `next-intl` and the parser to the dependency table; fix F3's size. (For `product-manager` / founder; not edited here.) |

### 9. Bundle and the size proof

- `/`: 132.1 KB, unchanged. `/en/ /hi/ /kn/ /te/`: **132.1 KB each**, measured in the throwaway build with a real `[locale]` tree, `next-intl` and the jump script. With one Client Component under `ClientMessages`: **144.4 KB** each (+12.3 KB). `/dev/components/`: 138.7 KB. Hard limit 200 KB, F3 target 150 KB: all met, with 5.6 KB left under the target for the first client-translated screen. `frontend-dev` re-measures on the real code and writes the five numbers under criterion 30.
- **`pnpm size` already measures each page's own scripts** (it reads every `<script src>` in each `.html`), so it measures `/xx/` separately from `/`. F3 adds the "five routes must exist" check and the 150 KB warning (section 8).
- **Criterion 29** is proved by `scripts/check-locale-leak.mjs` (`pnpm check:leak`) and a unit test of it on a fake `out/`; messages arrive in the HTML payload and not in script chunks, so the script searches both.
- HTML size is not part of the budget but the leak script prints it for each page (information only). The Hindi home page is 2.3 KB gzipped in the throwaway build.
- Lazy loading: nothing heavy is added. The ICU parser (12.3 KB) loads only on routes that wrap a subtree in `ClientMessages`.

**Measured by `frontend-dev` on the real code (step 6, `pnpm size`, Turbopack):** `/` 132.1 KB, `/en/` 132.1 KB, `/hi/` 132.1 KB, `/kn/` 132.1 KB, `/te/` 132.1 KB, `/dev/components/` 138.7 KB. With one Client Component under `ClientMessages` on a locale page (throwaway, not committed): 144.1 KB on each of the four language routes, 5.9 KB under the 150 KB target. The plan's 144.4 KB was within 0.3 KB.

### 10. Tests required

**Who writes what.** `frontend-dev` writes the unit tests listed per file in section 8 as part of each build step (the repo rule is that a test sits next to its code, and a step is not green without it), and makes the existing e2e suite pass. `test-engineer` writes `e2e/languages.spec.ts` and `e2e/jump.spec.ts`, retargets the three old specs, reviews every unit test below for one that cannot fail, and adds missing cases. All Playwright tests run in the `phone` project against `out/`, so **`pnpm build` must run first**; so must `pnpm size` and `pnpm check:leak`. Criterion 27 and the dev-route check need a `VERCEL_ENV=production pnpm build`, which overwrites `out/`; they stay in CI's last step, after the e2e run, as today.

| Criteria | Proved by | Notes |
| --- | --- | --- |
| 1 | e2e (`languages`) | reads `out/` for the five `index.html` files |
| 2 | e2e, `javaScriptEnabled: false` | text of `home.placeholder` for each language present in the delivered HTML |
| 3 | e2e: `request.get` of each page, regex on the raw `<html lang>` | not the live DOM |
| 4, 5 | e2e: computed `font-family`, `letter-spacing`, `text-transform`; network log of font requests per route | reuse `fontFiles`, `recordRequests` from `fonts.spec.ts`; move them to `helpers.ts` |
| 6 | e2e on `/dev/components/` | existing assertions plus `html[lang=en]` |
| 7 | e2e: `/fr/` status 404 and body is not a locale page | |
| 8 | unit `config-files.test.ts` | |
| 9 | e2e: `<title>` equals `brand.name` | |
| 10, 12, 13, 15 | e2e (`jump`): `test.use({ locale })` for `hi-IN`, `ta-IN`; `addInitScript` sets storage before load; `goBack()` after the jump | |
| 11, 14, 17 (script part) | unit `jump-script.test.ts`, `locale-choice.test.ts` | the six exact cases of criterion 11 |
| 16 | e2e, JS off: four `a[href]`, labels exactly the endonyms, box height at least 44, `scrollWidth - clientWidth === 0` | |
| 17, 18 (browser part) | e2e: open `/#choose`, click Kannada, then storage holds `kn`; open `/hi/` directly, storage unchanged | |
| 19 to 26, 28 | unit `i18n-check.test.ts` | one pass and one fail per rule; rule list below |
| 27 | CI last step (grep) plus unit `messages.test.ts` | |
| 29 | `pnpm check:leak` plus its unit test | |
| 30 | `pnpm size` | |
| 31 to 34 | unit `format.test.ts` | table in section 7 |
| 35 to 37, 39 | unit `format.test.ts` | time-zone matrix, ICU stub, source scan |
| 38 | unit `format.test.ts` | |
| 40 | e2e (`languages`) | `h1` text is `brand.name`; one translated line |
| 41 | all old e2e green | after retargeting (section 13, item 8) |
| 42 | e2e on `/dev/components/`: the Formats section, four blocks each with its `lang`, identical text; the old figures render as before | |
| 43 | unit `no-strings.test.ts` | plus a failing sample: a temp `.tsx` with `<p>Hello</p>` under a fake `src/app` is flagged |
| 44 | unit `language-rules.test.ts` | |
| Not in a criterion | unit `client-messages.test.tsx`; unit `size-scripts.test.ts` | |

**`i18n-check` cases (`frontend-dev`; each a throwaway `messages/` folder, run as a command):**

1. pass: four files, same keys, one `{name}` and one `<b>` in each, plurals with `other`.
2. fail 21: key missing in `kn`; extra key in `te`; empty string; spaces only; number instead of string; array value.
3. fail 19: nested differently (`a.b` object in en, string in hi); key `Not_Camel`.
4. fail 22: `{name}` renamed; tag `<b>` dropped; plural without `other`; select without `other`.
5. fail 23: `Hello {name`; `{count, plural, one {x}`.
6. pass 24: `TODO-translate: Loading…` in `hi` (printed count 1); fail: same value in `en`; fail 22: `TODO-translate: Hi {nam}` against `{name}`.
7. 25: plain run passes with a TODO; `--strict` fails on the same folder; `--strict` passes on a folder with none.
8. exit codes and "names the file and the key" asserted on the output text.

**Hand checks.** H1 to H3 in the spec stand. One more: on a real low-end Android, open `/dev/components/` Formats with the phone set to Hindi.

### 11. Build order (each step leaves lint, typecheck, unit tests, build, size and e2e green)

1. **Install and routes.** `pnpm add --save-exact next-intl@4.14.7`; the overrides and ignored-builds lines; `next.config.ts` plugin; `locales.ts`; `html-shell.tsx`; the three layouts; `[locale]/page.tsx` with the placeholder and the four message files; move `/` to `(jump)` with the four links and **no script yet**; `i18n/request.ts`, `messages.ts` (with the strip), `types.d.ts`. `test-engineer` retargets old e2e to `/en/` in the same step. Check: `out/` has the five files, `lang` per file, dev page unchanged, production build has no `out/dev`. (Criteria 1 to 3, 7 to 9, 40, 41.)
2. **Fonts per route.** No code expected; run the font specs against `/hi/ /kn/ /te/`. If a script's file does not load on its route, fix before going on. (4, 5.)
3. **Formatters.** `format.ts` with the table, time-zone matrix, ICU stub and source scan. (31 to 39.)
4. **Dev page.** `formats.tsx`, `sample-data.ts` figures from the formatters, page section. (42.)
5. **The jump.** `locale-choice.ts`, `jump-script.ts`, the script and click listener in the page, `#choose`. (10 to 18.)
6. **`ClientMessages`** and its test; record the 144.4 KB figure from a throwaway usage (not committed) or from the test build. Record `pnpm size` for the five routes in this spec. (30, plus the door for later screens.) **Cut line.**
7. **Key check.** `i18n-check-lib.mjs`, the command, the test matrix. Needs the founder's answer to Open question 10 for the parser; if "no", a hand-written scanner replaces `parse()` in this one file and the tests stay the same. (19 to 28.)
8. **Strings scan.** Move `findOwnWords`; extend `no-strings.test.ts`; add `language-rules.test.ts` and `config-files.test.ts`. If the scan finds a word in `src/app` or `src/components`, fix the file, not the test. (8, 43, 44.)
9. **Size and leak scripts, CI lines.** `size.mjs` changes, `check-locale-leak.mjs`, `ci.yml`. (27, 29, 30.)
10. `test-engineer`: `languages.spec.ts` and `jump.spec.ts`; gap review of the unit tests. Then `code-reviewer`.

### 12. Risks and traps

1. **`headers()` creeping back in.** Using the `requestLocale` argument, `getLocale()` in a route that has no provider config, or `setRequestLocale` copied from the next-intl docs makes the build log `NEXT_STATIC_GEN_BAILOUT` or fail. The rule: the only place the locale is read is `rootParams.locale()` in `request.ts`. Step 1 ends with a clean build log (read it; it is not an exit-code failure today).
2. **A `src/app/layout.tsx` left behind** breaks the three-root tree and `lang`. Delete the old file in step 1.
3. **The `/` script must not wait for anything.** Do not move it into a Client Component or `useEffect`; that adds the 132 KB runtime to the path and shows the four links first. It is inline in the server-rendered page. The test runs the exact string.
4. **`localStorage` throws** in private modes and when blocked; both read and write are wrapped, and the jump still works.
5. **The product-name test scans `messages/`, `e2e/`, `scripts/` and `public/`.** The storage key is `ui-language`, the product name enters messages as `{brand}` only, and no new file there may contain the name.
6. **Criterion 43 versus real pages.** The new scan will flag any English typed in `src/app/`. The jump page has no sentence of its own; the locale page uses `useTranslations`. Strings that are not words (a `lang` code, a path) pass because the detector only looks at JSX text and spoken attributes.
7. **Two criteria on one fact:** an untranslated `hi` value shows English text (27) while the hi page must hold no English messages (29). Resolved in section 5: untranslated values are not "unique" to English.
8. **A stale `.next` or `out/`** gives a false pass in a leak or size check. `frontend-dev` runs `rm -rf .next out` before the final `pnpm build` of each step; CI is always clean.
9. **Dev server warning on unknown locale** (`/fr/` in `next dev` logs a missing-param error): expected; do not "fix" it by adding `dynamicParams`.
10. **Transitive version drift.** Without the `overrides`, a reinstall picks a seven-day-old `use-intl`. The lockfile is committed; review updates monthly (policy 3).
11. **`experimental` is not used**, so a Next upgrade cannot remove a flag we depend on. The only Next-version dependency is `next/root-params`, stable from 16.3; `AGENTS.md` already says to read the bundled docs on upgrade.
12. **The parser dependency may be declined** (Open question 10). Plan B is in step 7 and costs about a day.
13. **Intl-free formatting is easy to break in review** ("just use `toLocaleString('en-IN')`"). The source scan in `format.test.ts` stops it.
14. **Message keys in `sample-data`-style files.** Do not copy dev-page copy into `messages/`.

### 13. Where I differ from the spec

1. **Hand-off 1 and policy 4: next-intl is not wrapped behind one file in `src/lib/`.** `useTranslations` is called in components (criterion 44 says so itself). I list the four places that know about next-intl (section 3a, row 4) instead.
2. **Next-intl fails the "more than one maintainer" test.** The spec says only "run the check". Open question 9 is new.
3. **No `setRequestLocale`; no `requestLocale`.** The spec's wording ("the next-intl-specific static-rendering steps") assumed them. Section 3b.
4. **No `NextIntlClientProvider` in the locale layout.** Hand-off 4 asks which namespaces reach Client Components: none by default; a screen asks through `ClientMessages`. It saves 12.3 KB per route.
5. **The `#choose` hash on `/`** is added. It is not in the spec. It exists because criterion 17 cannot be tested (and R1-1 cannot link "change language") if a normal visit always jumps away.
6. **Criterion 7:** the 404 is Next's default page, which is English and has no `lang`. The spec said the site's 404 is untranslated in F3; this is the plain consequence.
7. **Criterion 44's allowed folders:** `src/lib/`, `src/config/` and also `src/i18n/`.
8. **Criterion 41, "F2 end-to-end tests pass unchanged".** Nearly: three specs open `/` meaning "the home page". With a browser language of `en-IN` the jump lands on `/en/`, so they pass today, but only by following a script redirect. `test-engineer` retargets them to `/en/` through one constant; assertions are not touched. If the founder reads "unchanged" strictly, leave them and they still pass.
9. **Criterion 27 is met by stripping the marker in every build,** not by failing a production build. Source files keep the marker so review still finds it.
10. **Criterion 29's wording** ("English messages only where English is the page language") is read as: no value that belongs only to another language's file. Untranslated values shown as English are allowed (section 5).
11. **Criterion 30:** `pnpm size` already measures each route; F3 adds the five-routes-exist check and a 150 KB warning, not a second tool.
12. **Spec text edits I made:** criterion 67 (English months decided), the decided and open-question blocks. No criterion was renumbered or removed.
13. **Two documents are not mine to edit.** Section 8 lists them: for `product-manager` and the founder, `docs/BUILD_PLAN.md` dependency table and F3's size; `src/CLAUDE.md` layout block (handed to `frontend-dev` because it is a repo guide for their own work).

### 14. Not doing

- A language picker, saving to the tutor profile, parent language (R1-1, R1-3).
- `hreflang`, canonical, sitemap, per-language titles (R0-5).
- A translated or styled 404, `experimental.globalNotFound`.
- A proxy, middleware, cookies, `redirects()`, `rewrites()`.
- `precompile` / `icu-minify` for smaller messages (its advisories are in the precompile path, and the saving is under the 5.6 KB left).
- The SWC message extractor, `next-intl`'s `Link`/`useRouter`/`getPathname` helpers and `defineRouting` (all assume middleware).
- Native digits, Hindi, Kannada or Telugu month names, a locale argument on any formatter.
- Message text for `/p`, `/r`, `/join`.
- A `lint` rule for language branches (a unit test is enough).

### 15. Start

`frontend-dev` starts with **step 1** of section 11 (install `next-intl@4.14.7` with the overrides, then routes and messages), after reading section 3b. `test-engineer` can begin `e2e/languages.spec.ts` once step 1 lands, and `e2e/jump.spec.ts` after step 5. No `backend-dev` task exists. The founder is asked for Open questions 9 and 10 before steps 1 and 7; the rest are proceeding on recommendations.
