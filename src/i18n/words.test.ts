// getWords and the plain-text rule (spec R0-2, criterion 58; plan section 4).
import { describe, expect, it, vi } from "vitest";
import { locales } from "@/config/locales";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import kn from "../../messages/kn.json";
import te from "../../messages/te.json";
import { loadMessages } from "./messages";

vi.mock("next-intl/server", () => ({ getMessages: async () => loadMessages("hi") }));

const { argumentNamespaces, getAllWords, getWords, notPlain, plainNamespaces } = await import("./words");

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
  it("are one of the two plain namespaces, the other being the waitlist form's", () => {
    expect([...plainNamespaces]).toEqual(["reminderForm", "waitlistForm"]);
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

describe("notPlain with arguments allowed", () => {
  const allowed = { arguments: true };

  it("lets a {name} argument through, anywhere in the text", () => {
    expect(notPlain({ a: "Date {date}", b: { c: "{month} {year}", d: "से {method} में" } }, "", allowed)).toEqual([]);
  });

  it.each(["{count, plural, one {a} other {b}}", "a } b", "{ x", "read <b>this</b>", "{1}", "{na me}", "1 > 0"])(
    "still names text that would need the parser: %s",
    (value) => {
      expect(notPlain({ line: value }, "", allowed)).toEqual([`line: ${value}`]);
    },
  );

  it("is off unless asked for", () => {
    expect(notPlain({ line: "Date {date}" })).toEqual(["line: Date {date}"]);
  });
});

describe("the argument namespaces", () => {
  it("are the parent's receipt only, and a namespace of en.json", () => {
    expect([...argumentNamespaces]).toEqual(["receipt"]);
    for (const name of argumentNamespaces) expect(Object.keys(en)).toContain(name);
  });

  it.each(locales)("hold plain text and {name} arguments only in %s.json", (locale) => {
    for (const name of argumentNamespaces) expect(notPlain(files[locale][name] as Tree, name, { arguments: true })).toEqual([]);
  });

  it.each(locales)("have the same keys in the same order in %s.json as in en.json", (locale) => {
    for (const name of argumentNamespaces) expect(shape(files[locale][name] as Tree)).toEqual(shape((en as Tree)[name] as Tree));
  });

  it.each(locales)("use the same {arguments} in %s.json as en.json does, key by key", (locale) => {
    const args = (tree: Tree, path = ""): string[] =>
      Object.entries(tree).flatMap(([key, value]) =>
        typeof value === "string" ? [`${path}${key}: ${(value.match(/\{\w+\}/g) ?? []).sort().join(" ")}`] : args(value, `${path}${key}.`),
      );
    expect(args(files[locale].receipt as Tree)).toEqual(args(en.receipt as Tree));
  });
});

describe("getAllWords", () => {
  it("refuses a namespace that is not listed", async () => {
    const landing = "landing" as unknown as "receipt";
    await expect(getAllWords(landing)).rejects.toThrow(RangeError);
    await expect(getAllWords(landing)).rejects.toThrow(/argumentNamespaces/);
  });

  it("returns the namespace in all four languages, read from each file", async () => {
    const all = await getAllWords("receipt");
    expect(Object.keys(all)).toEqual([...locales]);
    for (const locale of locales) expect(all[locale]).toEqual((await loadMessages(locale)).receipt);
    expect(all.hi.footer).not.toBe(all.en.footer);
  });

  it("never lets a TODO-translate marker through: it falls back to the English text", async () => {
    vi.resetModules();
    vi.doMock("./messages", async () => {
      const real = await vi.importActual<typeof import("./messages")>("./messages");
      return {
        loadMessages: async (locale: string) =>
          real.stripTodo(locale === "kn" ? { receipt: { footer: "TODO-translate: Free for tutors" } } : { receipt: { footer: "x" } }),
      };
    });
    const again = await import("./words");
    const all = await again.getAllWords("receipt");
    expect(all.kn.footer).toBe("Free for tutors");
    expect(JSON.stringify(all)).not.toContain("TODO-translate");
    vi.doUnmock("./messages");
  });

  it("refuses a namespace with more than arguments in it, in any language", async () => {
    vi.resetModules();
    vi.doMock("./messages", async () => ({
      loadMessages: async (locale: string) => ({ receipt: { line: locale === "te" ? "{n, plural, one {a} other {b}}" : "ok" } }),
    }));
    const again = await import("./words");
    await expect(again.getAllWords("receipt")).rejects.toThrow(/te: receipt.line/);
    vi.doUnmock("./messages");
  });
});
