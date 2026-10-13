// Plain-words helpers shared by the parents' public pages (/r/ receipt, /p/ pay page): the `{name}` template
// fill and the browser-language rule. Moved out of receipt-words.ts (R1-9) so neither page copies them.
// Plain text and `{name}` arguments only; nothing here parses markup.
import { defaultLocale, isLocale, type Locale } from "@/config/locales";

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
 * the first of the browser's preferred languages that is one of ours, else English. Reads nothing stored.
 */
export function browserLanguage(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
