// @vitest-environment node
// Spec R1-1, criteria 28 and 29: the PRD's UPI pattern and the three ways it fails.
import { describe, expect, it } from "vitest";
import { UPI_ID } from "./reminder/reminder";
import { checkUpi, trimUpi, UPI_PATTERN } from "./upi";

describe("UPI_PATTERN", () => {
  it("is the PRD pattern, the same one the fee reminder uses", () => {
    expect(UPI_PATTERN.source).toBe(UPI_ID.source);
    expect(UPI_PATTERN.flags).toBe(UPI_ID.flags);
    expect(UPI_PATTERN.source).toBe("^[\\w.\\-]{2,256}@[a-zA-Z]{2,64}$");
  });
});

const valid = [
  "meena.tuitions@okhdfc",
  "ravi-9@ybl",
  "9845012345@paytm",
  "a_b@sbi",
  "ab@ok",
  "first.last@oksbi",
  "x.y-z_1@axl",
  "NAME@HDFC",
  "name@" + "b".repeat(64),
  "a".repeat(256) + "@bank",
  "9.8-4_5@upi",
  "  meena@okhdfc  ",
];

const invalid: [string, "missing" | "noAt" | "bad"][] = [
  ["", "missing"],
  ["   ", "missing"],
  ["meena.tuitions", "noAt"],
  ["abc", "noAt"],
  ["name@", "bad"],
  ["@bank", "bad"],
  ["a@bank", "bad"],
  ["a b@okhdfc", "bad"],
  ["name@ok bank", "bad"],
  ["name@bank1", "bad"],
  ["name@@bank", "bad"],
  ["९८४५०१२३४५@ybl", "bad"],
  ["name@" + "b".repeat(65), "bad"],
  ["a".repeat(257) + "@bank", "bad"],
  ["na/me@bank", "bad"],
];

describe("checkUpi", () => {
  it.each(valid)("accepts %j", (text) => {
    expect(checkUpi(text)).toBe("ok");
  });

  it.each(invalid)("%j is %s", (text, result) => {
    expect(checkUpi(text)).toBe(result);
  });

  it("has twelve valid and at least twelve invalid examples", () => {
    expect(valid).toHaveLength(12);
    expect(invalid.length).toBeGreaterThanOrEqual(12);
  });

  it("does not accept a trailing line break by way of the pattern's $", () => {
    expect(UPI_PATTERN.test("name@bank\n")).toBe(false);
  });
});

describe("trimUpi", () => {
  it("removes the spaces at the ends and nothing else", () => {
    expect(trimUpi("  name@bank \t")).toBe("name@bank");
    expect(trimUpi("na me@bank")).toBe("na me@bank");
  });
});
