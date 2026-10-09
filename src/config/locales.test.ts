import { describe, expect, it } from "vitest";
import { defaultLocale, isLocale, localeNames, locales } from "./locales";

describe("locales", () => {
  it("lists the four languages, English first", () => {
    expect([...locales]).toEqual(["en", "hi", "kn", "te"]);
    expect(defaultLocale).toBe("en");
  });

  it("names each language in its own script", () => {
    expect(localeNames).toEqual({ en: "English", hi: "हिन्दी", kn: "ಕನ್ನಡ", te: "తెలుగు" });
  });

  it("accepts only the four codes", () => {
    for (const code of locales) expect(isLocale(code)).toBe(true);
    for (const bad of ["fr", "EN", "hi-IN", "", null, undefined, 1, {}]) expect(isLocale(bad)).toBe(false);
  });
});
