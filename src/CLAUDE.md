# src/ — the Next.js app

Read the root `CLAUDE.md` first. These rules are specific to front-end code.

## Layout

```
src/app/[locale]/(public)/     landing, tools — prerendered per language
src/app/[locale]/(app)/        signed-in tutor app — client-rendered
src/app/p/, src/app/r/, src/app/join/   static shells for token routes
src/components/ui/             design-system components from docs/DESIGN.md
src/components/<feature>/      feature components
src/lib/                       supabase client, formatters, outbox, analytics
src/config/brand.ts            product name and domain, the only place they appear
```

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
