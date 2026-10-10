// Page addresses for search engines: the canonical link and the hreflang set.
// Built from brand.domain and the locale list, so a custom domain later is a one-line change in brand.ts.
import { brand } from "@/config/brand";
import { defaultLocale, locales, type Locale } from "@/config/locales";

/** Absolute address of a language's landing page, with the trailing slash the export writes. */
export function canonicalUrl(locale: Locale): string {
  return `https://${brand.domain}/${locale}/`;
}

/**
 * The five hreflang entries, the same on every language page: one per language and `x-default`,
 * which points at the default language. Keys are the values of the `hreflang` attribute.
 */
export function alternateUrls(): Record<Locale | "x-default", string> {
  const entries = locales.map((locale) => [locale, canonicalUrl(locale)] as const);
  return { ...Object.fromEntries(entries), "x-default": canonicalUrl(defaultLocale) } as Record<Locale | "x-default", string>;
}

const ogLocales: Record<Locale, string> = { en: "en_IN", hi: "hi_IN", kn: "kn_IN", te: "te_IN" };

/** The value of `og:locale` for a language. */
export function ogLocale(locale: Locale): string {
  return ogLocales[locale];
}
