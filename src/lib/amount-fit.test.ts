import { describe, expect, it } from "vitest";
import { amountEm, amountFit } from "./amount-fit";

// Widths measured in Chromium at 100px (Bricolage Grotesque 800, -0.04em), in em.
const measured: [string, number][] = [
  ["₹1,23,456", 4.163],
  ["₹78,900", 3.675],
  ["₹18,500", 3.476],
  ["₹99,99,999", 5.195],
];

describe("amountEm", () => {
  // The table ignores kerning, which only ever tightens a pair, so the estimate errs on the wide side.
  it.each(measured)("%s is never narrower than it really is, and no more than a twentieth wider", (text, real) => {
    const em = amountEm(text);
    expect(em).toBeGreaterThanOrEqual(real);
    expect(em).toBeLessThanOrEqual(real * 1.05);
  });

  it("knows a 1 is much narrower than a 0", () => {
    expect(amountEm("₹1,11,111")).toBeLessThan(amountEm("₹8,00,000") * 0.7);
  });

  it("grows with every character", () => {
    expect(amountEm("₹1,200")).toBeLessThan(amountEm("₹1,200.50"));
    expect(amountEm("₹1,200")).toBeLessThan(amountEm("₹1,200/-"));
  });

  it("treats an unknown character as the widest figure, so the amount still fits", () => {
    expect(amountEm("x")).toBe(amountEm("0"));
    expect(amountEm("१")).toBe(amountEm("0"));
  });

  it("is zero for nothing", () => {
    expect(amountEm("")).toBe(0);
  });
});

describe("amountFit", () => {
  it("gives the custom property the amount sizes read", () => {
    expect(amountFit("₹1,23,456")).toEqual({ "--amount-em": amountEm("₹1,23,456") });
  });
});
