// Spec R1-3, criteria 20, 21 and 53 (phone): what a tutor may type, what is stored, and what is refused.
import { describe, expect, it } from "vitest";
import { digitsOf, formatPhoneTyping, latinDigits, nationalDigits, normalizePhone, tidyPhone, tidyTyped } from "./phone";

const value = (text: string) => {
  const check = normalizePhone(text);
  if (!check.ok) throw new Error(`refused ${JSON.stringify(text)}: ${check.error}`);
  return check.value;
};

describe("normalizePhone: what is accepted", () => {
  it.each([
    "9886044321",
    "98860 44321",
    "098860 44321",
    "+91 98860-44321",
    "+919886044321",
    "91 9886044321",
    "(98860) 44321",
    "98860.44321",
    "  98860  44321  ",
    "+91-98860-44321",
    "919886044321",
    "09886044321",
  ])("%j is +919886044321", (text) => {
    expect(value(text)).toBe("+919886044321");
  });

  it.each([
    ["Devanagari", "९८८६० ४४३२१"],
    ["Kannada", "೯೮೮೬೦ ೪೪೩೨೧"],
    ["Telugu", "౯౮౮౬౦ ౪౪౩౨౧"],
    ["mixed scripts", "९८८६०44321"],
    ["Devanagari with +91", "+९१ ९८८६०-४४३२१"],
  ])("%s digits are read as 0 to 9", (_name, text) => {
    expect(value(text)).toBe("+919886044321");
  });

  it("accepts every first digit from 6 to 9", () => {
    for (const first of ["6", "7", "8", "9"]) expect(value(`${first}123456789`)).toBe(`+91${first}123456789`);
  });

  it.each(["", "   ", "\t\n"])("empty text (%j) is fine and means no number", (text) => {
    expect(normalizePhone(text)).toEqual({ ok: true, value: null });
  });
});

describe("normalizePhone: what is refused", () => {
  const cases: [string, string, "short" | "long" | "start" | "chars", number][] = [
    ["nine digits", "988604432", "short", 9],
    ["one digit", "9", "short", 1],
    ["+91 alone", "+91", "short", 0],
    ["a plus alone", "+", "short", 0],
    ["only separators", "---", "short", 0],
    ["eleven digits not starting with 0", "19886044321", "long", 11],
    ["twelve digits not starting with 91", "129886044321", "long", 12],
    ["with +91 and eleven digits", "+91 98860443210", "long", 11],
    ["a long run", "98860443219886044321", "long", 20],
    ["starts with 0 and has ten digits", "0123456789", "start", 10],
    ["starts with 5", "5886044321", "start", 10],
    ["starts with 1", "1886044321", "start", 10],
    ["another country code", "+44 7911 123456", "start", 12],
    ["+1", "+1 2025550123", "start", 11],
    ["letters", "98860abcde", "chars", 0],
    ["letters only", "call me", "chars", 0],
    ["a plus in the middle", "98860+44321", "chars", 0],
    ["a slash", "98860/44321", "chars", 0],
  ];
  it.each(cases)("%s", (_name, text, error, count) => {
    expect(normalizePhone(text)).toEqual({ ok: false, error, count });
  });
});

describe("tidyPhone, tidyTyped, digitsOf, latinDigits, nationalDigits", () => {
  it("writes a stored number as 98860 44321", () => {
    expect(tidyPhone("+919886044321")).toBe("98860 44321");
    expect(tidyPhone("+44123")).toBe("+44123");
  });

  it("tidies a good number on blur and leaves a bad one exactly as typed", () => {
    expect(tidyTyped("+91 98860-44321")).toBe("98860 44321");
    expect(tidyTyped("९८८६०४४३२१")).toBe("98860 44321");
    expect(tidyTyped("98860")).toBe("98860");
    expect(tidyTyped("abc")).toBe("abc");
    expect(tidyTyped("")).toBe("");
  });

  it("reads digits in any of the four scripts", () => {
    expect(latinDigits("१२३ ೧೨೩ ౧౨౩ 123")).toBe("123 123 123 123");
    expect(digitsOf("+91 (98860) 44321")).toBe("919886044321");
    expect(digitsOf("no digits")).toBe("");
  });

  it("gives the ten digits of a stored number, and nothing for none", () => {
    expect(nationalDigits("+919886044321")).toBe("9886044321");
    expect(nationalDigits(null)).toBe("");
  });
});

// UX-review-fixes-2, 12.2: the phone field groups digits as they are typed and keeps the caret.
describe("formatPhoneTyping", () => {
  /** Types `digits` one at a time at the end, as the field does: each change is formatted before the next key. */
  const typeAll = (digits: string) => {
    let state = { text: "", caret: 0 };
    for (const key of digits) {
      const next = state.text.slice(0, state.caret) + key + state.text.slice(state.caret);
      state = formatPhoneTyping(next, state.caret + key.length);
    }
    return state;
  };

  it("groups ten typed digits as 98765 43210, the caret after the last digit every time", () => {
    expect(typeAll("98765")).toEqual({ text: "98765", caret: 5 });
    expect(typeAll("987654")).toEqual({ text: "98765 4", caret: 7 });
    expect(typeAll("9876543210")).toEqual({ text: "98765 43210", caret: 11 });
  });

  it("puts no space at the end after five digits", () => {
    expect(formatPhoneTyping("98765", 5)).toEqual({ text: "98765", caret: 5 });
  });

  it.each([
    ["+91 98765-43210"],
    ["098765 43210"],
    ["+919876543210"],
    ["919876543210"],
    ["(98765) 43210"],
    ["९८७६५ ४३२१०"],
    ["೯೮೭೬೫ ೪೩೨೧೦"],
    ["౯౮౭౬౫ ౪౩౨౧౦"],
  ])("a paste of %s ends as 98765 43210 with the caret at the end", (pasted) => {
    expect(formatPhoneTyping(pasted, pasted.length)).toEqual({ text: "98765 43210", caret: 11 });
  });

  it("keeps the saved value E.164", () => {
    const { text } = formatPhoneTyping("+91 98765-43210", 15);
    expect(normalizePhone(text)).toEqual({ ok: true, value: "+919876543210" });
  });

  it("keeps the caret after the digit typed in the middle", () => {
    // "98765 432" with the caret after "987": type 0.
    expect(formatPhoneTyping("987065 432", 4)).toEqual({ text: "98706 5432", caret: 4 });
    // "98765 4321" with the caret after the fifth digit (before the space): type 1. The caret crosses the space.
    expect(formatPhoneTyping("987651 4321", 6)).toEqual({ text: "98765 14321", caret: 7 });
  });

  it("deleting a digit before the space pulls the rest back and keeps the caret after the digit before it", () => {
    // "98765 43210", Backspace after "987" removes 7.
    expect(formatPhoneTyping("9865 43210", 2)).toEqual({ text: "98654 3210", caret: 2 });
  });

  it("an eleven-digit number starting 0 is typed through: the 0 goes when the eleventh digit arrives", () => {
    expect(typeAll("09876543210")).toEqual({ text: "98765 43210", caret: 11 });
  });

  it("leaves more than ten digits exactly as typed, so the field's own error shows", () => {
    expect(formatPhoneTyping("98765 432109", 12)).toEqual({ text: "98765 432109", caret: 12 });
    expect(normalizePhone("98765 432109")).toMatchObject({ ok: false, error: "long" });
  });

  it("leaves letters, a + in the middle and another country code exactly as typed", () => {
    expect(formatPhoneTyping("98765abc", 8)).toEqual({ text: "98765abc", caret: 8 });
    expect(formatPhoneTyping("98+765", 3)).toEqual({ text: "98+765", caret: 3 });
    expect(formatPhoneTyping("+44 7700 900123", 15)).toEqual({ text: "+44 7700 900123", caret: 15 });
    expect(formatPhoneTyping("+9", 2)).toEqual({ text: "+9", caret: 2 });
  });

  it("takes a typed +91 off, since the field already shows it", () => {
    expect(formatPhoneTyping("+91", 3)).toEqual({ text: "", caret: 0 });
    expect(formatPhoneTyping("+91 98", 6)).toEqual({ text: "98", caret: 2 });
  });

  it("empty stays empty", () => {
    expect(formatPhoneTyping("", 0)).toEqual({ text: "", caret: 0 });
  });
});
