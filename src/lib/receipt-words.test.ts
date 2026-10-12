// The parent's receipt words (spec R1-7 Part B, criteria 28 and 31).
import { describe, expect, it } from "vitest";
import { locales } from "@/config/locales";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import kn from "../../messages/kn.json";
import te from "../../messages/te.json";
import { browserLanguage, fill, monthLabel, parts, subjectsLine, type ReceiptWords } from "./receipt-words";

const all: Record<string, ReceiptWords> = { en: en.receipt, hi: hi.receipt, kn: kn.receipt, te: te.receipt };

describe("fill and parts", () => {
  it("replaces each {name} once and leaves the rest", () => {
    expect(fill("Date {date}", { date: "08 Oct 2026" })).toBe("Date 08 Oct 2026");
    expect(fill("{a}{b}{a}", { a: "x", b: "y" })).toBe("xyx");
  });

  it("never reads a value again: braces in a name stay as typed", () => {
    expect(fill("for {student}", { student: "{month} Rao", month: "May" })).toBe("for {month} Rao");
  });

  it("writes nothing for a name it has no value for", () => {
    expect(fill("from {parent} by {method}", { method: "UPI" })).toBe("from  by UPI");
  });

  it("cuts a template into text and slot pieces in order", () => {
    expect(parts("a {x} b {y}", { x: "1", y: "2" })).toEqual([{ text: "a " }, { text: "1", slot: "x" }, { text: " b " }, { text: "2", slot: "y" }]);
  });
});

describe("monthLabel", () => {
  it.each(locales)("names the month and writes the year in 0 to 9 digits in %s", (locale) => {
    const label = monthLabel(all[locale], "2026-10-01");
    expect(label).toContain("2026");
    expect(label).toContain(all[locale].months.m10);
    expect(label).not.toMatch(/\{|\}/);
  });

  it("says 'the earlier balance' for no month, in every language", () => {
    for (const locale of locales) expect(monthLabel(all[locale], null)).toBe(all[locale].earlier);
  });

  it("says it too when the month cannot be read, rather than writing a wrong one", () => {
    expect(monthLabel(en.receipt, "2026-13-01")).toBe("the earlier balance");
    expect(monthLabel(en.receipt, "garbage")).toBe("the earlier balance");
  });
});

describe("subjectsLine", () => {
  it("names preset subjects in the receipt's language and leaves typed ones as typed", () => {
    expect(subjectsLine(en.receipt, ["maths", "science"])).toBe("Maths, Science tuition");
    expect(subjectsLine(hi.receipt, ["maths", "Sitar"])).toBe("गणित, Sitar ट्यूशन");
  });

  it("is empty when there is none", () => {
    expect(subjectsLine(en.receipt, [])).toBe("");
    expect(subjectsLine(en.receipt, [" "])).toBe("");
  });
});

describe("browserLanguage", () => {
  it("takes the first preferred language that is one of ours", () => {
    expect(browserLanguage(["fr-FR", "kn-IN", "hi"])).toBe("kn");
    expect(browserLanguage(["TE"])).toBe("te");
  });

  it("is English when none is, or when there is no list", () => {
    expect(browserLanguage(["fr", "de"])).toBe("en");
    expect(browserLanguage([""])).toBe("en");
  });
});

describe("the receipt words in every language", () => {
  it.each(["hi", "kn", "te"] as const)("%s has real text and no TODO-translate marker for a parent", (locale) => {
    expect(JSON.stringify(all[locale])).not.toContain("TODO-translate");
  });

  it.each(["hi", "kn", "te"] as const)("%s is written in its own script, not English, for the sentences a parent reads", (locale) => {
    const script = { hi: /\p{Script=Devanagari}/u, kn: /\p{Script=Kannada}/u, te: /\p{Script=Telugu}/u }[locale];
    const w = all[locale];
    for (const text of [w.sentence, w.sentenceNoParent, w.notFound.title, w.notFound.detail, w.cancelled.title, w.failed.retry, w.footer, w.loading]) {
      expect(text).toMatch(script);
    }
  });

  it.each(locales)("%s fills the sentence with no argument left over", (locale) => {
    const w = all[locale];
    const values = { parent: "P", student: "S", month: monthLabel(w, "2026-10-01"), method: w.upi };
    for (const template of [w.sentence, w.sentenceNoParent]) expect(fill(template, values)).not.toMatch(/\{|\}/);
    expect(fill(w.sentence, values)).toContain("P");
    expect(fill(w.sentenceNoParent, values)).not.toContain("P ");
  });
});
