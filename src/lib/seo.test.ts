import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { locales } from "@/config/locales";
import { alternateUrls, canonicalUrl, ogLocale } from "./seo";

describe("canonicalUrl", () => {
  it.each(locales)("%s is absolute, https, built from the brand domain, with a trailing slash", (locale) => {
    expect(canonicalUrl(locale)).toBe(`https://${brand.domain}/${locale}/`);
    expect(canonicalUrl(locale).endsWith("/")).toBe(true);
  });

  it("is different for every language", () => {
    expect(new Set(locales.map(canonicalUrl)).size).toBe(locales.length);
  });
});

describe("alternateUrls", () => {
  const urls = alternateUrls();

  it("has en, hi, kn, te and x-default, and nothing else", () => {
    expect(Object.keys(urls).sort()).toEqual(["en", "hi", "kn", "te", "x-default"]);
  });

  it("points each language at its own page", () => {
    for (const locale of locales) expect(urls[locale]).toBe(canonicalUrl(locale));
  });

  it("points x-default at the English page", () => {
    expect(urls["x-default"]).toBe(canonicalUrl("en"));
  });

  it("is absolute with a trailing slash throughout", () => {
    for (const url of Object.values(urls)) expect(url).toMatch(/^https:\/\/[^/]+\/[a-z]{2}\/$/);
  });
});

describe("ogLocale", () => {
  it("is a language_REGION code for each language", () => {
    expect(locales.map(ogLocale)).toEqual(["en_IN", "hi_IN", "kn_IN", "te_IN"]);
  });
});
