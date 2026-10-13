import { describe, expect, it } from "vitest";
import { PAY_PAGE_MAX_PAISE, UPI_ID, buildUpiLink, rupeesText } from "./upi-link";

const base = { upiId: "ravi@okhdfc", payeeName: "Ravi Kumar", paise: 120_000, note: "Fee Oct 2026", maxPaise: PAY_PAGE_MAX_PAISE };

describe("rupeesText", () => {
  it.each([
    [100, "1.00"],
    [99, "0.99"],
    [120_000, "1200.00"],
    [123_456, "1234.56"],
    [100_000_000, "1000000.00"],
  ])("%i paise is %s", (paise, text) => {
    expect(rupeesText(paise)).toBe(text);
  });
});

describe("buildUpiLink", () => {
  it("writes pa, pn, am, cu, tn in that order", () => {
    expect(buildUpiLink(base)).toBe("upi://pay?pa=ravi@okhdfc&pn=Ravi%20Kumar&am=1200.00&cu=INR&tn=Fee%20Oct%202026");
  });

  it("encodes a Hindi name, an ampersand, a plus and a percent sign", () => {
    const link = buildUpiLink({ ...base, payeeName: "रवि & Co +5% x", note: "a&b=c" });
    expect(link).toContain(`&pn=${encodeURIComponent("रवि & Co +5% x")}&`);
    expect(link).toContain("&tn=a%26b%3Dc");
    expect(new URL(link).searchParams.get("pn")).toBe("रवि & Co +5% x");
  });

  it("builds the ceiling and refuses one paisa above it", () => {
    expect(buildUpiLink({ ...base, paise: PAY_PAGE_MAX_PAISE })).toContain("&am=1000000.00&");
    expect(() => buildUpiLink({ ...base, paise: PAY_PAGE_MAX_PAISE + 1 })).toThrow(RangeError);
  });

  it.each([0, -100, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])("refuses %s paise", (paise) => {
    expect(() => buildUpiLink({ ...base, paise })).toThrow(RangeError);
  });

  it("refuses a bad UPI ID and an empty name", () => {
    expect(() => buildUpiLink({ ...base, upiId: "no-at-sign" })).toThrow(RangeError);
    expect(() => buildUpiLink({ ...base, upiId: "a b@okhdfc" })).toThrow(RangeError);
    expect(() => buildUpiLink({ ...base, payeeName: "" })).toThrow(RangeError);
  });

  it("matches the PRD UPI pattern", () => {
    expect(UPI_ID.test("ravi.k-1@okhdfcbank")).toBe(true);
    expect(UPI_ID.test("ravi@ok1")).toBe(false);
  });
});
