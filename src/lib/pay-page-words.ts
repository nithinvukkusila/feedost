// The parent's pay page words (spec R1-9 Part B, plan B6). Like the receipt, the page ships the words of every
// unlocked language (spec parent-pages-english: English, and each language a named person has signed) and picks one
// at run time: the student's own `language`, or the parent's choice from the language button. The page also needs month and subject names; they are the receipt's (written once, never typed twice), so
// only those keys of the `receipt` namespace travel with it.
import type en from "../../messages/en.json";
import { languagesOf, type UnlockedWords } from "./public-words";
import type { MonthWords, ReceiptWords } from "./receipt-words";

export type PayPageWords = (typeof en)["payPage"];

/** One language's words for the page: its own, and the month and subject names it borrows from the receipt. */
export type PageWords = { pay: PayPageWords; receipt: MonthWords };
export type AllPageWords = UnlockedWords<PageWords>;

/** The month and subject words of a receipt namespace, and nothing else. */
export function monthWordsOf(receipt: ReceiptWords): MonthWords {
  return { months: receipt.months, monthYear: receipt.monthYear, earlier: receipt.earlier, subjects: receipt.subjects, tuition: receipt.tuition };
}

/**
 * Joins the two namespaces per language, for the languages `pay` carries (each must be in `receipt` too). Server only
 * (src/lib/unlocked-languages.ts calls it with the unlocked words).
 */
export function pageWords(pay: UnlockedWords<PayPageWords>, receipt: UnlockedWords<ReceiptWords>): AllPageWords {
  return Object.fromEntries(
    languagesOf(pay).map((locale) => {
      const own = receipt[locale];
      if (own === undefined) throw new RangeError(`${locale}: the pay page words are there but the receipt's are not`);
      return [locale, { pay: pay[locale], receipt: monthWordsOf(own) }];
    }),
  ) as AllPageWords;
}
