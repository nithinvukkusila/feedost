// Page addresses for search engines: the canonical link and the hreflang set.
// Built from brand.domain and the locale list, so a custom domain later is a one-line change in brand.ts.
import { brand } from "@/config/brand";
import { defaultLocale, locales, type Locale } from "@/config/locales";

// A path under a language: "" or segments that each end in "/", with no leading slash.
const PATH = /^(?:[^/]+\/)*$/;

function checkPath(path: string): void {
  if (!PATH.test(path)) {
    throw new RangeError(`a page path is "" or segments each ending in "/", with no leading slash; got ${JSON.stringify(path)}`);
  }
}

/** Absolute address of a page in a language, with the trailing slash the export writes. No path is the landing. */
export function canonicalUrl(locale: Locale, path = ""): string {
  checkPath(path);
  return `https://${brand.domain}/${locale}/${path}`;
}

/**
 * The five hreflang entries, the same on every language's copy of a page: one per language and
 * `x-default`, which points at the default language. Keys are the values of the `hreflang` attribute.
 */
export function alternateUrls(path = ""): Record<Locale | "x-default", string> {
  const entries = locales.map((locale) => [locale, canonicalUrl(locale, path)] as const);
  return { ...Object.fromEntries(entries), "x-default": canonicalUrl(defaultLocale, path) } as Record<Locale | "x-default", string>;
}

const ogLocales: Record<Locale, string> = { en: "en_IN", hi: "hi_IN", kn: "kn_IN", te: "te_IN" };

/** The value of `og:locale` for a language. */
export function ogLocale(locale: Locale): string {
  return ogLocales[locale];
}
