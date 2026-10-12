// Spec R1-3, criteria 23 and 53: whole rupees typed by hand to integer paise, with no float on the way.
import { describe, expect, it } from "vitest";
import { groupRupees, parseRupees, rupeesText, tidyRupees } from "./rupees";

const fee = { min: 1, max: 1_000_000 };
const owes = { min: 0, max: 1_000_000 };

describe("parseRupees: what is accepted", () => {
  it.each([
    ["1200", 120000],
    ["1,200", 120000],
    ["₹1,200", 120000],
    ["₹ 1 200", 120000],
    ["1,00,000", 10000000],
    ["1200.00", 120000],
    ["1200.0", 120000],
    ["  1200  ", 120000],
    ["000150", 15000],
    ["1", 100],
    ["१२००", 120000],
    ["೧,೨೦೦", 120000],
    ["౧౨౦౦", 120000],
    ["10,00,000", 100000000],
    ["₹1,200.00", 120000],
  ])("%j is %i paise", (text, paise) => {
    expect(parseRupees(text, fee)).toEqual({ ok: true, paise });
  });

  it("stores whole numbers of paise, never a float", () => {
    for (const text of ["1", "7", "1199", "999999", "1000000"]) {
      const check = parseRupees(text, fee);
      expect(check.ok && Number.isSafeInteger(check.paise) && check.paise % 100 === 0).toBe(true);
    }
  });

  it("accepts 0 where the minimum is 0", () => {
    expect(parseRupees("0", owes)).toEqual({ ok: true, paise: 0 });
    expect(parseRupees("0.00", owes)).toEqual({ ok: true, paise: 0 });
  });
});

describe("parseRupees: what is refused", () => {
  it.each([
    ["", "missing"],
    ["   ", "missing"],
    ["₹", "missing"],
    ["0", "zero"],
    ["₹0", "zero"],
    ["0.00", "zero"],
    ["12.50", "decimal"],
    ["1200.5", "decimal"],
    ["12.", "decimal"],
    ["1,000,001", "big"],
    ["10,00,001", "big"],
    ["99999999999999999999", "big"],
    ["abc", "chars"],
    ["-5", "chars"],
    ["12abc", "chars"],
    ["1e5", "chars"],
    [".5", "chars"],
    ["12₹", "chars"],
    ["1.2.3", "chars"],
  ])("%j is %s", (text, error) => {
    expect(parseRupees(text, fee)).toEqual({ ok: false, error });
  });

  it("one rupee over the limit is too big, and the limit itself is not", () => {
    expect(parseRupees("1000000", fee)).toEqual({ ok: true, paise: 100000000 });
    expect(parseRupees("1000001", fee)).toEqual({ ok: false, error: "big" });
  });
});

describe("groupRupees, rupeesText, tidyRupees", () => {
  it("groups the Indian way, without the ₹ sign", () => {
    expect(groupRupees(10000000)).toBe("1,00,000");
    expect(groupRupees(120000)).toBe("1,200");
    expect(groupRupees(100)).toBe("1");
    expect(groupRupees(0)).toBe("0");
  });

  it("starts an amount field with the saved amount, or empty for 0 where 0 means nothing", () => {
    expect(rupeesText(120000)).toBe("1,200");
    expect(rupeesText(0, true)).toBe("");
    expect(rupeesText(0)).toBe("0");
  });

  it("groups a good amount on blur and leaves a bad one as typed", () => {
    expect(tidyRupees("100000", fee)).toBe("1,00,000");
    expect(tidyRupees("₹1200.00", fee)).toBe("1,200");
    expect(tidyRupees("12.5", fee)).toBe("12.5");
    expect(tidyRupees("", fee)).toBe("");
  });
});
