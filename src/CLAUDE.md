# src/ — the Next.js app

Read the root `CLAUDE.md` first. These rules are specific to front-end code.

## Layout

```
src/app/(jump)/                "/": four links and the jump script (its own root layout)
src/app/[locale]/              /en/ /hi/ /kn/ /te/: the root layout, prerendered per language
src/app/[locale]/(public)/     landing, tools (later slices)
src/app/[locale]/(app)/        signed-in tutor app, client-rendered (later slices)
src/app/dev/                   /dev/components, outside production builds (its own root layout)
src/app/p/, src/app/r/, src/app/join/   static shells for token routes
src/components/ui/             design-system components from docs/DESIGN.md
src/components/shell/          the shared <html> and <body>
src/components/<feature>/      feature components
src/i18n/                      next-intl request config, message loading
src/styles/                    design tokens, fonts and type roles (the only place hex values live)
src/lib/                       supabase client, formatters, outbox, analytics
src/config/brand.ts            product name and domain, the only place they appear
src/config/locales.ts          the four languages and their own names, the only place they are listed
```

There is no `src/app/layout.tsx`: there are three root layouts, `(jump)`, `[locale]` and `dev`, each writing its own `<html lang>`. Do not add one, and do not add a `proxy.ts` (a static export cannot run it). The locale is read only through `next/root-params` in `src/i18n/request.ts`; do not call `setRequestLocale` or use the `requestLocale` argument.

## Rules

- This is a static export. No server actions, no route handlers, no `cookies()` or `headers()`, no dynamic rendering. Anything that needs a server is a Supabase Edge Function.
- Token pages (`/p`, `/r`, `/join`) are one static shell each. Read the token from `window.location`, then call the Edge Function. Do not add `generateStaticParams` for tokens.
- Every string comes from `useTranslations`. If you type English inside JSX, it is a bug.
- Money: keep paise as integers. Format only with `formatRupees()` from `src/lib/format.ts`. Dates only with `formatDate()`.
- Use components from `src/components/ui/`. If a screen needs something new, add it there with its states (rest, pressed, focus, busy, disabled) rather than styling one-off.
- Use Tailwind tokens. No hex values, no arbitrary `text-[13px]`. Nothing below `text-sm` (14px).
- Use real elements: `<button>`, `<a href>`, `<label>` with `<input>`. Icon-only buttons need an accessible name.
- Layouts must hold at 360px wide and at large system font size. Let rows grow; do not truncate translated labels.
- Heavy libraries (the PDF library, the vendored SheetJS) are imported with `await import()` inside the handler that needs them.
- Writes from the signed-in app go through `src/lib/outbox.ts` so they work offline. Do not call `supabase.from(...).insert()` directly from a component.
- Feature-detect browser APIs (Contact Picker, Web Share). Hide the option when the API is missing; never show a button that cannot work.

## Tests live next to the code

`thing.tsx` has `thing.test.tsx`. Formatters, parsers (the paste-a-list parser especially) and the outbox need unit tests. Flows are covered in `e2e/`.
