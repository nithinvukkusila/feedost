// getWords and the plain-text rule (spec R0-2, criterion 58; plan section 4).
import { describe, expect, it, vi } from "vitest";
import { locales } from "@/config/locales";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import kn from "../../messages/kn.json";
import te from "../../messages/te.json";
import { loadMessages } from "./messages";

vi.mock("next-intl/server", () => ({ getMessages: async () => loadMessages("hi") }));

const { getWords, notPlain, plainNamespaces } = await import("./words");

type Tree = { [key: string]: string | Tree };
const files: Record<string, Tree> = { en, hi, kn, te };

/** The keys of a tree, in order, with their nesting. */
function shape(tree: Tree): unknown {
  return Object.entries(tree).map(([key, value]) => (typeof value === "string" ? key : [key, shape(value)]));
}

describe("notPlain", () => {
  it("passes plain text at any depth", () => {
    expect(notPlain({ a: "Missing", b: { c: "Type the fee in rupees.", d: { e: "name@bank" } } })).toEqual([]);
  });

  it.each(["Hello {name}", "a } b", "read <b>this</b>", "1 > 0"])("names a value that would need parsing: %s", (value) => {
    expect(notPlain({ form: { line: value } })).toEqual([`form.line: ${value}`]);
  });
});

describe("the plain namespaces", () => {
  it("are all namespaces of en.json", () => {
    for (const name of plainNamespaces) expect(Object.keys(en)).toContain(name);
  });

  it.each(locales)("hold plain text only in %s.json, also behind a TODO-translate marker", (locale) => {
    for (const name of plainNamespaces) expect(notPlain(files[locale][name] as Tree, name)).toEqual([]);
  });

  it.each(locales)("have the same keys in the same order in %s.json as in en.json", (locale) => {
    for (const name of plainNamespaces) expect(shape(files[locale][name] as Tree)).toEqual(shape((en as Tree)[name] as Tree));
  });
});

describe("the fee reminder's words", () => {
  it("are the one plain namespace", () => {
    expect([...plainNamespaces]).toEqual(["reminderForm"]);
  });

  it.each(locales)("give every error a state word and a sentence that says how to fix it, in %s.json", (locale) => {
    const form = files[locale].reminderForm as Record<string, Record<string, unknown>>;
    const errors: [string, string[]][] = [
      ["parent", ["missing", "tooLong"]],
      ["amount", ["missing", "paise", "notDigits", "tooLow", "tooHigh"]],
      ["upi", ["missing", "space", "noAt", "format"]],
      ["payee", ["missing", "tooLong"]],
    ];
    for (const [field, codes] of errors) {
      for (const code of codes) {
        const words = form[field][code] as { word: string; fix: string };
        expect(Object.keys(words), `${field}.${code}`).toEqual(["word", "fix"]);
        expect(words.word.trim(), `${field}.${code}.word`).not.toBe("");
        expect(words.fix.trim(), `${field}.${code}.fix`).not.toBe("");
      }
    }
  });

  it("keep the UPI placeholder the same in all four files, and never a real-looking ID (criterion 11)", () => {
    for (const locale of locales) expect((files[locale].reminderForm as { upi: { placeholder: string } }).upi.placeholder).toBe("name@bank");
  });
});

describe("getWords", () => {
  it("refuses a namespace that is not listed as plain text", async () => {
    // The type refuses it too; the cast stands in for a caller that got round the type.
    const landing = "landing" as unknown as "reminderForm";
    await expect(getWords(landing)).rejects.toThrow(RangeError);
    await expect(getWords(landing)).rejects.toThrow(/plainNamespaces/);
  });

  it("returns the one namespace of the page's language, with no marker left in it", async () => {
    for (const name of plainNamespaces) {
      const words = await getWords(name);
      expect(words).toEqual((await loadMessages("hi"))[name]);
      expect(JSON.stringify(words)).not.toContain("TODO-translate");
    }
  });
});
