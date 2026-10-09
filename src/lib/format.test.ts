import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatDate, formatPhone, formatRupees } from "./format";

describe("formatRupees", () => {
  const cases: [number, string][] = [
    [0, "₹0"],
    [5, "₹0.05"],
    [99, "₹0.99"],
    [100, "₹1"],
    [100000, "₹1,000"],
    [100099, "₹1,000.99"],
    [12345600, "₹1,23,456"],
    [12345650, "₹1,23,456.50"],
    [999999900, "₹99,99,999"],
    [1000000000, "₹1,00,00,000"],
    [1234567890, "₹1,23,45,678.90"],
  ];
  it.each(cases)("%i paise is %s", (paise, expected) => {
    expect(formatRupees(paise)).toBe(expected);
  });

  it("uses only the rupee sign, digits 0-9, commas and one point", () => {
    for (const [paise] of cases) expect(formatRupees(paise)).toMatch(/^₹[0-9,]+(\.[0-9]{2})?$/);
  });

  it.each([1.5, NaN, Infinity, -Infinity, -1, -100, 2 ** 53, "100", null, undefined, {}])("throws on %s", (bad) => {
    expect(() => formatRupees(bad as number)).toThrow(RangeError);
  });
});

const zones: [string, number][] = [
  ["UTC", 0],
  ["America/Los_Angeles", 480], // January: UTC-8
  ["Asia/Kolkata", -330],
  ["Pacific/Kiritimati", -840],
];

describe.each(zones)("formatDate with the process time zone set to %s", (zone, january) => {
  const before = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
    // A silent no-op would make this whole block prove nothing.
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(january);
  });
  afterAll(() => {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  });

  const ok: [string, string][] = [
    ["2026-10-08", "08 Oct 2026"],
    ["2026-01-01", "01 Jan 2026"],
    ["2026-12-31", "31 Dec 2026"],
    ["2028-02-29", "29 Feb 2028"],
    ["2026-10-08T18:29:00Z", "08 Oct 2026"],
    ["2026-10-08T18:30:00Z", "09 Oct 2026"],
    ["2026-10-08T19:00:00Z", "09 Oct 2026"],
    ["2026-10-08T23:30:00Z", "09 Oct 2026"],
    ["2026-10-09T00:30:00+05:30", "09 Oct 2026"],
    ["2026-10-09T00:30:00+0530", "09 Oct 2026"],
    ["2026-10-08T19:00:00.123Z", "09 Oct 2026"],
    ["2026-12-31T20:00:00Z", "01 Jan 2027"],
    ["2026-03-31T18:30:00Z", "01 Apr 2026"],
    ["2026-10-08T23:59:00-07:00", "09 Oct 2026"],
  ];
  it.each(ok)("%s is %s", (input, expected) => {
    expect(formatDate(input)).toBe(expected);
  });

  it.each(["", "abc", "2026-02-30", "2027-02-29", "2100-02-29", "2026-13-01", "2026-10-08T19:00:00", "8 Oct 2026", "2026-10-08 19:00:00Z"])(
    "throws on %j",
    (bad) => {
      expect(() => formatDate(bad)).toThrow(RangeError);
    },
  );

  it("throws on a value that is not a string", () => {
    expect(() => formatDate(undefined as unknown as string)).toThrow(RangeError);
    expect(() => formatDate(20261008 as unknown as string)).toThrow(RangeError);
  });
});

describe("formatPhone", () => {
  it("groups a 10-digit +91 number", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });
  it.each(["+9198765", "+9198765432100", "919876543210", "+91 98765 43210", "+14155552671", "98765 43210", ""])(
    "returns %j unchanged",
    (value) => {
      expect(formatPhone(value)).toBe(value);
    },
  );
});

describe("no help from the platform (criteria 33 and 39)", () => {
  it("gives the same results with Intl gone and toLocaleString throwing", () => {
    const toLocale = vi.spyOn(Date.prototype, "toLocaleString").mockImplementation(() => {
      throw new Error("toLocaleString must not be used");
    });
    vi.stubGlobal("Intl", undefined);
    try {
      expect(formatRupees(12345650)).toBe("₹1,23,456.50");
      expect(formatDate("2026-10-08T19:00:00Z")).toBe("09 Oct 2026");
      expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
    } finally {
      vi.unstubAllGlobals();
      toLocale.mockRestore();
    }
  });

  it("the source has no Intl, no toLocale and no local-time getter", () => {
    const source = readFileSync(join(process.cwd(), "src", "lib", "format.ts"), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    for (const banned of ["Intl", "toLocale", "getHours(", "getDate(", "getMonth(", "getFullYear(", "getDay("]) {
      expect(source, banned).not.toContain(banned);
    }
  });
});
