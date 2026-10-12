// The parent's receipt words (spec R1-7 Part B, criteria 28 and 31). The page ships the words of all four
// languages and picks one at run time from the receipt's own `language`, because the address says nothing
// about it. The words hold plain text and `{name}` arguments; nothing parses them in the browser except the
// small replace below (src/i18n/words.ts `getAllWords` is the one place that hands them over).
import { defaultLocale, isLocale, type Locale } from "@/config/locales";
import type en from "../../messages/en.json";
import { PRESET_SUBJECTS } from "./receipt-public";

export type ReceiptWords = (typeof en)["receipt"];
export type AllReceiptWords = Record<Locale, ReceiptWords>;

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

/** "October 2026" in the receipt's language, from `YYYY-MM-DD`; the words for "an earlier balance" when there is no month. Digits are 0 to 9. */
export function monthLabel(words: ReceiptWords, month: string | null): string {
  if (month === null) return words.earlier;
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(month);
  const name = match ? (words.months as Record<string, string>)[`m${match[2]}`] : undefined;
  return match && name ? fill(words.monthYear, { month: name, year: match[1] }) : words.earlier;
}

/** "Maths, Science tuition": a preset key shows its name in the receipt's language, anything else the tutor typed shows as typed. Empty when there is none. */
export function subjectsLine(words: ReceiptWords, subjects: readonly string[]): string {
  const names = words.subjects as Record<string, string>;
  const shown = subjects.map((subject) => ((PRESET_SUBJECTS as readonly string[]).includes(subject) ? names[subject] : subject)).filter((s) => s.trim() !== "");
  return shown.length === 0 ? "" : fill(words.tuition, { subjects: shown.join(", ") });
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
