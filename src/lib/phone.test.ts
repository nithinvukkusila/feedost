// Spec R1-3, criteria 20, 21 and 53 (phone): what a tutor may type, what is stored, and what is refused.
import { describe, expect, it } from "vitest";
import { digitsOf, latinDigits, nationalDigits, normalizePhone, tidyPhone, tidyTyped } from "./phone";

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
