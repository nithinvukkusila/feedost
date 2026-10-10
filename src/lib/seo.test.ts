import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { locales } from "@/config/locales";
import { feeReminderPath } from "@/config/routes";
import { alternateUrls, canonicalUrl, ogLocale } from "./seo";

describe("canonicalUrl", () => {
  it.each(locales)("%s is absolute, https, built from the brand domain, with a trailing slash", (locale) => {
    expect(canonicalUrl(locale)).toBe(`https://${brand.domain}/${locale}/`);
    expect(canonicalUrl(locale).endsWith("/")).toBe(true);
  });

  it("is different for every language", () => {
    expect(new Set(locales.map((locale) => canonicalUrl(locale))).size).toBe(locales.length);
  });

  it.each(locales)("%s with the tool path is that language's tool page (R0-2, criterion 66)", (locale) => {
    expect(canonicalUrl(locale, feeReminderPath)).toBe(`https://${brand.domain}/${locale}/tools/fee-reminder/`);
  });

  it("with an empty path is the landing, as with no path", () => {
    expect(canonicalUrl("hi", "")).toBe(canonicalUrl("hi"));
  });

  it.each(["/tools/", "tools/fee-reminder", "a//b/", "/", "tools", "//"])("throws RangeError for the path %j", (path) => {
    expect(() => canonicalUrl("en", path)).toThrow(RangeError);
    expect(() => alternateUrls(path)).toThrow(RangeError);
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

describe("alternateUrls with a path (R0-2, criterion 66)", () => {
  const urls = alternateUrls(feeReminderPath);

  it("has the same five keys, in the same order", () => {
    expect(Object.keys(urls)).toEqual(["en", "hi", "kn", "te", "x-default"]);
  });

  it("points each language at its own tool page and x-default at the English one", () => {
    for (const locale of locales) expect(urls[locale]).toBe(`https://${brand.domain}/${locale}/tools/fee-reminder/`);
    expect(urls["x-default"]).toBe(`https://${brand.domain}/en/tools/fee-reminder/`);
  });

  it("leaves the landing's own five addresses as they were", () => {
    expect(alternateUrls()).toEqual(alternateUrls(""));
    expect(alternateUrls().en).toBe(`https://${brand.domain}/en/`);
  });
});

describe("ogLocale", () => {
  it("is a language_REGION code for each language", () => {
    expect(locales.map(ogLocale)).toEqual(["en_IN", "hi_IN", "kn_IN", "te_IN"]);
  });
});
