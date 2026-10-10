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

describe("getWords", () => {
  it("refuses a namespace that is not listed as plain text", async () => {
    await expect(getWords("landing")).rejects.toThrow(RangeError);
    await expect(getWords("landing")).rejects.toThrow(/plainNamespaces/);
  });

  it("returns the one namespace of the page's language, with no marker left in it", async () => {
    for (const name of plainNamespaces) {
      const words = await getWords(name);
      expect(words).toEqual((await loadMessages("hi"))[name]);
      expect(JSON.stringify(words)).not.toContain("TODO-translate");
    }
  });
});
