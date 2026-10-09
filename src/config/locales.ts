// The one place a language is listed. A language's own name is the same in every language, so the
// endonyms live here and not in messages/ (spec F3, criterion 16).

export const locales = ["en", "hi", "kn", "te"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
  te: "తెలుగు",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}
