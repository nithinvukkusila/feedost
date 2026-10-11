// The receipt's wording and its review record (spec R0-3, criteria 16, 17, 26 and 32).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/config/locales";
import templates from "./templates.json";

const texts = ["heading", "date", "sentence", "stamp", "footer", "whatsApp"] as const;
const slots = {
  heading: [],
  date: ["{date}"],
  sentence: ["{amount}", "{student}", "{mode}", "{month}"],
  stamp: [],
  footer: ["{brand}", "{domain}"],
  whatsApp: ["{month}"],
} as const;
const scripts = { hi: /[ऀ-ॿ]/, kn: /[ಀ-೿]/, te: /[ఀ-౿]/ } as const;

describe("templates.json", () => {
  it("has exactly the four languages, each with the same keys", () => {
    expect(Object.keys(templates)).toEqual([...locales]);
    for (const locale of locales) {
      expect(Object.keys(templates[locale]).sort()).toEqual([...texts, "modes", "months", "shortMonths"].sort());
      expect(Object.keys(templates[locale].modes).sort()).toEqual(["bank", "cash", "upi"]);
    }
  });

  it.each(locales.flatMap((locale) => texts.map((key) => ({ locale, key }))))("$locale.$key holds each of its placeholders exactly once", ({ locale, key }) => {
    const text = templates[locale][key];
    for (const slot of slots[key]) expect(text.split(slot)).toHaveLength(2);
    expect(text.match(/[{}]/g) ?? []).toHaveLength(slots[key].length * 2);
    expect(text).toBe(text.trim());
  });

  it("is the English wording of criterion 14, exactly", () => {
    expect(templates.en.sentence).toBe("Received with thanks {amount} from the family of {student} by {mode} towards the tuition fee for {month}.");
    expect(templates.en.stamp).toBe("PAID");
    expect(templates.en.footer).toBe("Made with {brand} ({domain}), a free tool for tutors");
  });

  it("has 12 months and 12 short months in each language, in the language's own script", () => {
    for (const locale of locales) {
      expect(templates[locale].months).toHaveLength(12);
      expect(templates[locale].shortMonths).toHaveLength(12);
      if (locale === "en") continue;
      for (const name of [...templates[locale].months, ...templates[locale].shortMonths]) expect(name).toMatch(scripts[locale]);
    }
  });

  it("marks nothing TODO-translate and is never English in disguise (criterion 26)", () => {
    expect(JSON.stringify(templates)).not.toContain("TODO-translate");
    for (const locale of ["hi", "kn", "te"] as const) {
      expect(templates[locale].sentence).not.toBe(templates.en.sentence);
      for (const key of texts) expect(templates[locale][key]).toMatch(scripts[locale]);
    }
  });

  it("uses none of the words a receipt must not use (criterion 17)", () => {
    expect(JSON.stringify(templates)).not.toMatch(/verified|official|\bgst\b|tax invoice|tracked/i);
  });

  it("names no number, link or tracking in the footer (criterion 18)", () => {
    for (const locale of locales) expect(templates[locale].footer).not.toMatch(/http|www|utm|\?/i);
  });
});

describe("templates.review.json (criterion 26)", () => {
  const review = JSON.parse(readFileSync(join(process.cwd(), "src", "lib", "receipt", "templates.review.json"), "utf8")) as Record<
    string,
    { status: string }
  >;

  it("has an entry for hi, kn and te, none reviewed yet; English is the source and has none", () => {
    expect(Object.keys(review).sort()).toEqual(["hi", "kn", "te"]);
    for (const locale of ["hi", "kn", "te"]) expect(review[locale].status).toBe("not reviewed");
  });
});
