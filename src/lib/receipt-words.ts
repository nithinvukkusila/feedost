// The parent's receipt words (spec R1-7 Part B, criteria 28 and 31). The page ships the words of every unlocked
// language (spec parent-pages-english: English, and each language a named person has signed) and picks one at run time from the receipt's own `language`, because the address says nothing
// about it. The words hold plain text and `{name}` arguments; nothing parses them in the browser except the
// small replace below (src/i18n/words.ts `getAllWords` is the one place that hands them over).
import type en from "../../messages/en.json";
import { PRESET_SUBJECTS } from "./receipt-public";
import { fill, type UnlockedWords } from "./public-words";

// The template helpers live in public-words.ts (shared with the pay page); re-exported so imports stay.
export { browserLanguage, fill, parts, shownLanguage, wordsIn, type Part } from "./public-words";

export type ReceiptWords = (typeof en)["receipt"];
export type AllReceiptWords = UnlockedWords<ReceiptWords>;

/** The only receipt words `monthLabel` and `subjectsLine` read; the pay page (R1-9) ships just these, not the whole receipt. */
export type MonthWords = Pick<ReceiptWords, "months" | "monthYear" | "earlier" | "subjects" | "tuition">;

/** "October 2026" in the receipt's language, from `YYYY-MM-DD`; the words for "an earlier balance" when there is no month. Digits are 0 to 9. */
export function monthLabel(words: Pick<MonthWords, "months" | "monthYear" | "earlier">, month: string | null): string {
  if (month === null) return words.earlier;
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(month);
  const name = match ? (words.months as Record<string, string>)[`m${match[2]}`] : undefined;
  return match && name ? fill(words.monthYear, { month: name, year: match[1] }) : words.earlier;
}

/** "Maths, Science tuition": a preset key shows its name in the receipt's language, anything else the tutor typed shows as typed. Empty when there is none. */
export function subjectsLine(words: Pick<MonthWords, "subjects" | "tuition">, subjects: readonly string[]): string {
  const names = words.subjects as Record<string, string>;
  const shown = subjects.map((subject) => ((PRESET_SUBJECTS as readonly string[]).includes(subject) ? names[subject] : subject)).filter((s) => s.trim() !== "");
  return shown.length === 0 ? "" : fill(words.tuition, { subjects: shown.join(", ") });
}
