// The eight templates and 48 month names (spec R0-2, criteria 21, 23, 25, 28, 29, 30).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { locales } from "@/config/locales";
import templates from "./templates.json";

const tones = ["polite", "firm"] as const;
const placeholders = ["{parent}", "{amount}", "{month}", "{link}", "{upiId}"];
const all = locales.flatMap((locale) => tones.map((tone) => ({ name: `${locale}.${tone}`, locale, lines: templates[locale][tone] })));

// The spec's table (criterion 25), typed out.
const months = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  hi: ["जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर"],
  kn: ["ಜನವರಿ", "ಫೆಬ್ರವರಿ", "ಮಾರ್ಚ್", "ಏಪ್ರಿಲ್", "ಮೇ", "ಜೂನ್", "ಜುಲೈ", "ಆಗಸ್ಟ್", "ಸೆಪ್ಟೆಂಬರ್", "ಅಕ್ಟೋಬರ್", "ನವೆಂಬರ್", "ಡಿಸೆಂಬರ್"],
  te: ["జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్", "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"],
};

describe("templates.json", () => {
  it("has exactly the four languages, each with polite, firm and months", () => {
    expect(Object.keys(templates)).toEqual([...locales]);
    for (const locale of locales) expect(Object.keys(templates[locale])).toEqual(["polite", "firm", "months"]);
  });

  it.each(all)("$name holds each of the five placeholders exactly once (criteria 21, 23)", ({ lines }) => {
    const text = lines.join("\n");
    for (const placeholder of placeholders) expect(text.split(placeholder)).toHaveLength(2);
    expect(text.match(/[{}]/g)).toHaveLength(10);
  });

  it.each(all)("$name is four lines: the link alone on the second, the plain UPI ID on the third", ({ lines }) => {
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe("{link}");
    // The fallback where a UPI link is not tappable: the parent can always copy the ID.
    expect(lines[2].endsWith(": {upiId}")).toBe(true);
    for (const line of lines) expect(line).toBe(line.trim());
  });

  it("has the spec's 48 month names (criterion 25)", () => {
    for (const locale of locales) expect(templates[locale].months).toEqual(months[locale]);
  });

  it("marks nothing TODO-translate: a template is never sent as English in disguise (criterion 28)", () => {
    expect(JSON.stringify(templates)).not.toContain("TODO-translate");
    for (const locale of ["hi", "kn", "te"] as const) {
      for (const tone of tones) expect(templates[locale][tone]).not.toEqual(templates.en[tone]);
    }
  });

  it.each(all)("$name names no product, links nowhere and promises nothing (criterion 29)", ({ lines }) => {
    const text = lines.join("\n").toLowerCase();
    for (const word of ["http", "www", brand.domain, brand.name.toLowerCase(), "automatic", "receipt", "tracked", "sent with", "one tap"]) {
      expect(text).not.toContain(word);
    }
  });

  it("is the English wording of criterion 22, exactly", () => {
    expect(templates.en.polite).toEqual([
      "Hello {parent} ji, a gentle reminder that the tuition fee of {amount} for {month} is due. You can pay by UPI with this link:",
      "{link}",
      "Or pay to UPI ID: {upiId}",
      "Thank you!",
    ]);
    expect(templates.en.firm).toEqual([
      "Hello {parent} ji, the tuition fee of {amount} for {month} is still pending. Please pay it today by UPI with this link:",
      "{link}",
      "Or pay to UPI ID: {upiId}",
      "Thank you.",
    ]);
  });
});

describe("templates.review.json (criterion 30)", () => {
  const record = JSON.parse(readFileSync(join(process.cwd(), "src", "lib", "reminder", "templates.review.json"), "utf8")) as Record<
    string,
    { status: string; reviewer: string; date: string; sha256: string }
  >;

  it("has one entry for each language that is not English", () => {
    expect(Object.keys(record)).toEqual(["hi", "kn", "te"]);
  });

  it("claims a review only with a name and a date", () => {
    for (const entry of Object.values(record)) {
      expect(["reviewed", "not reviewed"]).toContain(entry.status);
      if (entry.status === "reviewed") {
        expect(entry.reviewer.trim()).not.toBe("");
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });
});
