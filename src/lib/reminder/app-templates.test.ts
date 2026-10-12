// The 8 earlier-balance templates and 4 generic parent words (spec R1-8, criteria 8, 9, 11).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { locales } from "@/config/locales";
import app from "./templates.app.json";
import templates from "./templates.json";

const tones = ["polite", "firm"] as const;
const slots = ["{parent}", "{amount}", "{link}", "{upiId}"];
const all = locales.flatMap((locale) => tones.map((tone) => ({ name: `${locale}.${tone}`, locale, tone, lines: app[locale][tone] })));

describe("templates.app.json", () => {
  it("has the four languages, each with polite, firm and parentWord", () => {
    expect(Object.keys(app)).toEqual([...locales]);
    for (const locale of locales) expect(Object.keys(app[locale])).toEqual(["polite", "firm", "parentWord"]);
  });

  it.each(all)("$name holds {parent} {amount} {link} {upiId} once each and no {month}", ({ lines }) => {
    const text = lines.join("\n");
    for (const slot of slots) expect(text.split(slot)).toHaveLength(2);
    expect(text).not.toContain("{month}");
    expect(text.match(/[{}]/g)).toHaveLength(8);
  });

  it.each(all)("$name: lines 2 to 4 are exactly the month template's lines", ({ locale, tone, lines }) => {
    expect(lines).toHaveLength(4);
    expect(lines.slice(1)).toEqual(templates[locale][tone].slice(1));
  });

  it("the founder's English texts", () => {
    expect(app.en.polite[0]).toBe("Hello {parent} ji, a gentle reminder that the earlier tuition fee balance of {amount} is still due. You can pay by UPI with this link:");
    expect(app.en.firm[0]).toBe("Hello {parent} ji, the earlier tuition fee balance of {amount} is still pending. Please pay it today by UPI with this link:");
    expect(app.en.polite[3]).toBe("Thank you!");
    expect(app.en.firm[3]).toBe("Thank you.");
  });

  it("the other languages are in their own script, not English pasted in", () => {
    const script = { hi: /[ऀ-ॿ]/, kn: /[ಀ-೿]/, te: /[ఀ-౿]/ };
    for (const locale of ["hi", "kn", "te"] as const) {
      for (const tone of tones) {
        expect(app[locale][tone][0]).toMatch(script[locale]);
        expect(app[locale][tone][0]).not.toBe(app.en[tone][0]);
        expect(app[locale][tone].join("")).not.toContain("TODO-translate");
      }
      expect(app[locale].parentWord).toMatch(script[locale]);
    }
    expect(app.en.parentWord).toBe("Parent");
  });

  it("holds no product name", () => {
    expect(JSON.stringify(app).toLowerCase()).not.toContain("feedost");
  });

  it("all of hi, kn and te are recorded not reviewed (nothing here may be signed by the builder)", () => {
    const record = JSON.parse(readFileSync(join(process.cwd(), "src/lib/reminder/templates.app.review.json"), "utf8")) as Record<string, { status: string }>;
    expect(Object.keys(record)).toEqual(["hi", "kn", "te"]);
    for (const entry of Object.values(record)) expect(entry).toEqual({ status: "not reviewed", reviewer: "", date: "", sha256: "" });
  });
});
