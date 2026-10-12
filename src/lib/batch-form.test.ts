// Spec R1-3, criteria 40, 41 and 47: the batch name and timings, checked before the database is asked.
import { describe, expect, it } from "vitest";
import { checkBatch, nameTaken } from "./batch-form";
import type { Batch } from "./batches";

const batches: Batch[] = [
  { id: "b1", name: "Class 10 Maths", timings: null },
  { id: "b2", name: "Class 8 Science", timings: "Mon 5 pm" },
];

describe("checkBatch", () => {
  it("cleans the name and gives null for empty timings", () => {
    expect(checkBatch({ name: "  Class   9   English ", timings: "   " }, batches)).toEqual({ ok: true, value: { name: "Class 9 English", timings: null } });
  });

  it("keeps trimmed timings", () => {
    expect(checkBatch({ name: "Evening", timings: " Mon, Wed, Fri at 5:00 pm " }, batches)).toEqual({
      ok: true,
      value: { name: "Evening", timings: "Mon, Wed, Fri at 5:00 pm" },
    });
  });

  it("needs a name", () => {
    expect(checkBatch({ name: "   ", timings: "" }, batches)).toEqual({ ok: false, errors: { name: { tag: "missing", message: "nameMissing" } } });
  });

  it("holds the name to 60 characters: 60 pass, 61 do not, counted by characters", () => {
    expect(checkBatch({ name: "a".repeat(60), timings: "" }, batches).ok).toBe(true);
    expect(checkBatch({ name: "a".repeat(61), timings: "" }, batches)).toEqual({ ok: false, errors: { name: { tag: "tooLong", message: "nameLong" } } });
    expect(checkBatch({ name: "😀".repeat(60), timings: "" }, batches).ok).toBe(true);
    expect(checkBatch({ name: "ಕ".repeat(61), timings: "" }, batches).ok).toBe(false);
  });

  it("holds the timings to 100 characters", () => {
    expect(checkBatch({ name: "x", timings: "t".repeat(100) }, batches).ok).toBe(true);
    expect(checkBatch({ name: "x", timings: "t".repeat(101) }, batches)).toEqual({ ok: false, errors: { timings: { tag: "tooLong", message: "timingsLong" } } });
  });

  it("refuses another batch's name in any letter case, and says so for the name", () => {
    for (const name of ["Class 10 Maths", "class 10 maths", "CLASS 10 MATHS", "  class   10 maths  "]) {
      expect(checkBatch({ name, timings: "" }, batches)).toEqual({ ok: false, errors: { name: { tag: "nameTaken", message: "nameTaken" } } });
    }
  });

  it("lets a batch keep its own name (a rename that only changes the case, or saves timings)", () => {
    expect(checkBatch({ name: "class 10 maths", timings: "" }, batches, "b1").ok).toBe(true);
    expect(checkBatch({ name: "Class 8 Science", timings: "" }, batches, "b1").ok).toBe(false);
  });

  it("reports both fields together", () => {
    const check = checkBatch({ name: "", timings: "t".repeat(101) }, batches);
    expect(check.ok).toBe(false);
    expect(!check.ok && Object.keys(check.errors).sort()).toEqual(["name", "timings"]);
  });
});

describe("nameTaken", () => {
  it("compares ignoring case and ignores the batch named", () => {
    expect(nameTaken(batches, "class 8 science")).toBe(true);
    expect(nameTaken(batches, "class 8 science", "b2")).toBe(false);
    expect(nameTaken(batches, "Class 7")).toBe(false);
    expect(nameTaken([], "x")).toBe(false);
  });
});
