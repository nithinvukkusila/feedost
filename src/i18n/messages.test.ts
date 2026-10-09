import { describe, expect, it } from "vitest";
import { loadMessages, stripTodo } from "./messages";

describe("stripTodo", () => {
  it("replaces the marker with the English text, at any depth", () => {
    expect(stripTodo({ a: "TODO-translate: Loading…", b: { c: "TODO-translate: Hi {name}" } })).toEqual({
      a: "Loading…",
      b: { c: "Hi {name}" },
    });
  });

  it("leaves English and translated values alone", () => {
    expect(stripTodo({ a: "Loading…", b: "लोड हो रहा है…" })).toEqual({ a: "Loading…", b: "लोड हो रहा है…" });
  });

  it("keeps a value that only mentions the word, or has no space after the colon", () => {
    expect(stripTodo({ a: "Please TODO-translate: this", b: "TODO-translate:x" })).toEqual({
      a: "Please TODO-translate: this",
      b: "TODO-translate:x",
    });
  });
});

describe("loadMessages", () => {
  it("never returns the marker for any language", async () => {
    for (const locale of ["en", "hi", "kn", "te"] as const) {
      expect(JSON.stringify(await loadMessages(locale))).not.toContain("TODO-translate");
    }
  });
});
