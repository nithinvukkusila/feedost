// The words of the parent pages, for the unlocked languages only (spec docs/specs/parent-pages-english.md, plan
// section 2). Server only: `page.tsx` files call it while the static export is built, so the words of a locked
// language never reach the shell. The rule itself is in scripts/language-unlock.mjs (shared with `i18n:check` and
// `check:leak`); this file only types it and hands over the words.
//
// The review records and the message files are imported as they stand, TODO-translate markers included: the hash is
// over the file as it is, so a marked word can never look signed. The words handed to the page still come from
// `getAllWords`, which shows a marked value as its English text.
import type { Locale } from "@/config/locales";
import { getAllWords } from "@/i18n/words";
import { consentApproved, unlockedFrom } from "../../scripts/language-unlock.mjs";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import kn from "../../messages/kn.json";
import te from "../../messages/te.json";
import payPageRecord from "./pay-page-words.review.json";
import receiptRecord from "./receipt-words.review.json";
import { pageWords, type AllPageWords } from "./pay-page-words";
import type { UnlockedWords } from "./public-words";
import type { AllReceiptWords } from "./receipt-words";

export type { UnlockedWords } from "./public-words";

/** A parent surface built here: `/p/` (S1) and `/r/` (S2). */
export type ParentSurface = "payPage" | "receipt";

/** Review records keyed by record name, and raw message files keyed by language. */
export type UnlockSource = { records?: { payPage?: unknown; receipt?: unknown }; messages?: Readonly<Record<Locale, unknown>> };

const shippedRecords = { payPage: payPageRecord, receipt: receiptRecord };
const shippedMessages: Readonly<Record<Locale, unknown>> = { en, hi, kn, te };

/**
 * The languages a parent may see on `surface`: English, then each signed one, in the usual order. `source` replaces
 * the shipped records or messages; only the /dev fixture pages and the tests pass it.
 */
export function unlockedLanguages(surface: ParentSurface, source: UnlockSource = {}): Locale[] {
  return unlockedFrom(surface, { records: source.records ?? shippedRecords, messages: source.messages ?? shippedMessages }) as Locale[];
}

/** Only the given languages' entries of a per-language table, in the given order. */
function only<W>(all: Readonly<Record<Locale, W>>, languages: readonly Locale[]): UnlockedWords<W> {
  return Object.fromEntries(languages.map((locale) => [locale, all[locale]])) as UnlockedWords<W>;
}

/** The receipt page's words (`/r/`): English and each language unlocked for it. */
export async function receiptWords(source: UnlockSource = {}): Promise<AllReceiptWords> {
  return only(await getAllWords("receipt"), unlockedLanguages("receipt", source));
}

/**
 * The pay page's words (`/p/`): English and each language unlocked for it. Until the founder approves the consent
 * wording (R1-9 question 3), the consent and privacy-notice lines are English in every language (spec section 3),
 * so a language's `pay.consent` is replaced by English's and its `consentLang` says "en". `pay.consent` is exactly
 * what `consentHashOf` covers.
 */
export async function payPageWords(source: UnlockSource = {}): Promise<AllPageWords> {
  const languages = unlockedLanguages("payPage", source);
  const words = pageWords(only(await getAllWords("payPage"), languages), only(await getAllWords("receipt"), languages));
  if (consentApproved(source.records?.payPage ?? shippedRecords.payPage, source.messages ?? shippedMessages)) return words;
  const english = words.en.pay.consent;
  for (const locale of languages) {
    const own = words[locale];
    if (locale !== "en" && own !== undefined) words[locale] = { ...own, pay: { ...own.pay, consent: english }, consentLang: "en" };
  }
  return words;
}
