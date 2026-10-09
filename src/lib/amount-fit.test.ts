import { afterEach, describe, expect, it, vi } from "vitest";
import { amountEm, amountFit } from "./amount-fit";

// Widths measured in Chromium at 100px (Bricolage Grotesque 800, -0.04em), in em.
const measured: [string, number][] = [
  ["₹1,23,456", 4.163],
  ["₹78,900", 3.675],
  ["₹18,500", 3.476],
  ["₹99,99,999", 5.195],
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

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

  it("counts a character it has no width for as a full em, so an amount with words still fits", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // Measured in Chromium in the same face: "WWWW" is 3.946em, and no letter is wider than "W".
    expect(amountEm("WWWW")).toBeGreaterThanOrEqual(3.946);
    expect(amountEm("W")).toBeCloseTo(1.03, 3);
    expect(amountEm("₹5 CR")).toBeGreaterThan(amountEm("₹5 ") + 2);
    // A digit from another script is not a figure this face draws at a known width either.
    expect(amountEm("१")).toBe(amountEm("W"));
  });

  it("says so once per character while developing, and not at all in production", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    amountEm("₹5 Q");
    amountEm("₹7 Q");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"Q"');

    vi.stubEnv("NODE_ENV", "production");
    amountEm("₹5 Z");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(amountEm("Z")).toBeCloseTo(1.03, 3);
  });

  it("is silent for every character an amount normally has", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    amountEm("₹1,23,456.78/- 90");
    expect(warn).not.toHaveBeenCalled();
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
