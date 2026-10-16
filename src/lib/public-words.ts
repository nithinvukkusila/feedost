// Plain-words helpers shared by the parents' public pages (/r/ receipt, /p/ pay page): the `{name}` template
// fill and the browser-language rule. Moved out of receipt-words.ts (R1-9) so neither page copies them.
// Plain text and `{name}` arguments only; nothing here parses markup.
// Browser-safe: the rule of which languages a parent may see runs at build time (src/lib/unlocked-languages.ts); a
// page only gets the words of those languages, and `shownLanguage` picks among what it got.
import { defaultLocale, isLocale, type Locale } from "@/config/locales";

/**
 * A parent page's words: English always, and each other language only if a named person signed it for that page
 * (spec parent-pages-english). A locked language is absent, so it cannot be shown.
 */
export type UnlockedWords<W> = { en: W } & Partial<Record<Exclude<Locale, "en">, W>>;

/** The language a parent page shows: `candidate` when its words are on the page, otherwise English. */
export function shownLanguage(words: UnlockedWords<unknown>, candidate: Locale | null | undefined): Locale {
  return candidate && words[candidate] !== undefined ? candidate : defaultLocale;
}

/** The words of `language` (one `shownLanguage` returned), or English's if they are not on the page. */
export function wordsIn<W>(words: UnlockedWords<W>, language: Locale): W {
  return words[language] ?? words.en;
}

/** The languages a parent page carries, in the order they were handed over (English first). */
export function languagesOf(words: UnlockedWords<unknown>): Locale[] {
  return Object.keys(words).filter(isLocale);
}

/** A piece of a filled template: plain text, or the value of an argument (so the page can set it apart). */
export type Part = { text: string; slot?: undefined } | { text: string; slot: string };

const ARGUMENT = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** The template cut into pieces; every `{name}` becomes a piece of its own with the value written for it. A name with no value is empty. */
export function parts(template: string, values: Readonly<Record<string, string>>): Part[] {
  const found: Part[] = [];
  let last = 0;
  for (const match of template.matchAll(ARGUMENT)) {
    if (match.index > last) found.push({ text: template.slice(last, match.index) });
    found.push({ text: values[match[1]] ?? "", slot: match[1] });
    last = match.index + match[0].length;
  }
  if (last < template.length) found.push({ text: template.slice(last) });
  return found;
}

/** The template with each `{name}` replaced by its value. Replaced once, never re-read: a value that holds braces stays as typed. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return parts(template, values)
    .map((part) => part.text)
    .join("");
}

/**
 * The language for the states that have no receipt to take it from (opening, not found, too many tries, failed):
 * the first of the browser's preferred languages that is one of ours, else English. Reads nothing stored. A parent
 * page then gates it with `shownLanguage`, so a locked first preference gives English (it does not move on).
 */
export function browserLanguage(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
