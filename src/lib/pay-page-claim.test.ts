// The claim sheet's own logic (spec R1-10 Part C, criteria 31 and 32).
import { describe, expect, it } from "vitest";
import { normalizeRef } from "./claim/upi-ref";
import { caretAfter, claimFor, keptBefore, keptOf, refShown } from "./pay-page-claim";
import { feeBody } from "./pay-page.test-util";
import { readPage, type FeePage } from "./pay-page-public";

describe("refShown", () => {
  it.each([
    ["", ""],
    ["6", "6"],
    ["6281", "6281"],
    ["62810", "6281 0"],
    ["628104739915", "6281 0473 9915"],
    ["6281 0473 9915", "6281 0473 9915"],
    ["6281-0473-9915", "6281 0473 9915"],
    ["  6281--0473 - 9915 ", "6281 0473 9915"],
    ["6281 04", "6281 04"],
    ["6281047399151", "6281 0473 9915 1"],
  ])("shows %j as %j", (typed, shown) => {
    expect(refShown(typed)).toBe(shown);
  });

  it("shows anything that is not plain digits as typed, without the separators, so Send can refuse it", () => {
    expect(refShown("6281 O473")).toBe("6281O473");
    expect(refShown("६२८१ ०४७३")).toBe("६२८१०४७३");
    expect(refShown("UTR-1234")).toBe("UTR1234");
  });

  it("is stable: showing what it shows changes nothing", () => {
    for (const typed of ["62810473", "628104739915", "62a1 33", "1-2-3-4-5"]) expect(refShown(refShown(typed))).toBe(refShown(typed));
  });

  it("never grows past what the shared check looks at", () => {
    expect(keptOf("1".repeat(200))).toHaveLength(64);
  });

  it("agrees with the shared check: what it shows for 12 digits is accepted as those 12 digits", () => {
    for (const typed of ["628104739915", "6281 0473 9915", "6281-0473-9915"]) expect(normalizeRef(refShown(typed))).toEqual({ ok: true, ref: "628104739915" });
    for (const typed of ["62810473991", "6281047399150", "6281O4739915", ""]) expect(normalizeRef(refShown(typed)).ok).toBe(false);
  });
});

describe("the caret", () => {
  it("counts the digits before the caret and puts it after the same digits once grouped", () => {
    // Typed the fifth digit at the end of "6281": the field had "62810" with the caret at 5.
    expect(keptBefore("62810", 5)).toBe(5);
    expect(caretAfter("6281 0", 5)).toBe(6);
    // A digit put in the middle of "6281 0473": "62819 0473", caret after the 9 (position 5).
    expect(keptBefore("62819 0473", 5)).toBe(5);
    expect(caretAfter("6281 9047 3", 5)).toBe(6);
    // Caret at the start, and past the end.
    expect(caretAfter("6281 0473", 0)).toBe(0);
    expect(caretAfter("6281", 9)).toBe(4);
    expect(keptBefore("6281 0473", -3)).toBe(0);
  });
});

describe("claimFor", () => {
  const page = readPage({ code: "ok", page: feeBody }) as FeePage;

  it("is 'all open fees' when there is more than one, or more beyond the list", () => {
    expect(claimFor(page)).toEqual({ kind: "all" });
    expect(claimFor({ openDues: [page.openDues[2]], openDuesMore: 3 })).toEqual({ kind: "all" });
    expect(claimFor({ openDues: [], openDuesMore: 2 })).toEqual({ kind: "all" });
  });

  it("names the month for one monthly fee and the earlier balance for one earlier balance", () => {
    expect(claimFor({ openDues: [page.openDues[2]], openDuesMore: 0 })).toEqual({ kind: "month", month: "2026-10-01" });
    expect(claimFor({ openDues: [page.openDues[0]], openDuesMore: 0 })).toEqual({ kind: "earlier" });
  });
});
