// The parent's pay page words (spec R1-9 Part B, plan B6). Like the receipt, the page ships the words of all four
// languages and picks one at run time: the student's own `language`, or the parent's choice from the language
// button. The page also needs month and subject names; they are the receipt's (written once, never typed twice), so
// only those keys of the `receipt` namespace travel with it.
import { locales, type Locale } from "@/config/locales";
import type en from "../../messages/en.json";
import type { MonthWords, ReceiptWords } from "./receipt-words";

export type PayPageWords = (typeof en)["payPage"];

/** One language's words for the page: its own, and the month and subject names it borrows from the receipt. */
export type PageWords = { pay: PayPageWords; receipt: MonthWords };
export type AllPageWords = Record<Locale, PageWords>;

/** The month and subject words of a receipt namespace, and nothing else. */
export function monthWordsOf(receipt: ReceiptWords): MonthWords {
  return { months: receipt.months, monthYear: receipt.monthYear, earlier: receipt.earlier, subjects: receipt.subjects, tuition: receipt.tuition };
}

/** Joins the two namespaces per language. Server only (the page's `page.tsx` calls it with `getAllWords`). */
export function pageWords(pay: Record<Locale, PayPageWords>, receipt: Record<Locale, ReceiptWords>): AllPageWords {
  return Object.fromEntries(locales.map((locale) => [locale, { pay: pay[locale], receipt: monthWordsOf(receipt[locale]) }])) as AllPageWords;
}
