// Spec R1-7, criteria 12 to 14 and 37: the sheet's arithmetic.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Due } from "./dues";
import { BACK_DAYS, checkDay, chipAmounts, chipOf, chosenDay, dayBounds, indiaClock, statusFor, undoOpen, UNDO_WINDOW_MS, validateAmount, withPaid } from "./payments-view";

describe("validateAmount", () => {
  const left = 120000;
  it.each([
    ["1,200", { ok: true, paise: 120000 }],
    ["1200", { ok: true, paise: 120000 }],
    ["₹ 500", { ok: true, paise: 50000 }],
    ["1", { ok: true, paise: 100 }],
    ["१००", { ok: true, paise: 10000 }],
    ["500.00", { ok: true, paise: 50000 }],
    ["", { ok: false, error: "missing" }],
    ["   ", { ok: false, error: "missing" }],
    ["0", { ok: false, error: "zero" }],
    ["000", { ok: false, error: "zero" }],
    ["12.5", { ok: false, error: "decimal" }],
    ["abc", { ok: false, error: "chars" }],
    ["-5", { ok: false, error: "chars" }],
    ["1,201", { ok: false, error: "over" }],
    ["10,00,000", { ok: false, error: "over" }],
  ])("%j", (text, expected) => {
    expect(validateAmount(text, left)).toEqual(expected);
  });

  it("allows exactly what is left, in lakhs too", () => {
    expect(validateAmount("10,00,000", 100000000)).toEqual({ ok: true, paise: 100000000 });
    expect(validateAmount("10,00,001", 100000000)).toEqual({ ok: false, error: "over" });
  });
});

describe("chips", () => {
  it("full is what is left; half is rounded down to a whole rupee", () => {
    expect(chipAmounts(120000)).toEqual({ full: 120000, half: 60000 });
    expect(chipAmounts(120100)).toEqual({ full: 120100, half: 60000 });
    expect(chipAmounts(30000)).toEqual({ full: 30000, half: 15000 });
    expect(chipAmounts(30100)).toEqual({ full: 30100, half: 15000 });
  });
  it("hides half when it would be under ₹1", () => {
    expect(chipAmounts(100).half).toBeNull();
    expect(chipAmounts(199).half).toBeNull();
    expect(chipAmounts(200).half).toBe(100);
  });
  it("names the chip the text matches, and Other for the rest", () => {
    expect(chipOf("1,200", 120000)).toBe("full");
    expect(chipOf("600", 120000)).toBe("half");
    expect(chipOf("601", 120000)).toBe("other");
    expect(chipOf("", 120000)).toBe("other");
    expect(chipOf("abc", 120000)).toBe("other");
    expect(chipOf("1", 100)).toBe("full");
  });
});

describe("days", () => {
  const today = "2026-10-12";
  it("Today, Yesterday and a picked day", () => {
    expect(chosenDay("today", "", today)).toBe("2026-10-12");
    expect(chosenDay("yesterday", "", today)).toBe("2026-10-11");
    expect(chosenDay("yesterday", "", "2026-03-01")).toBe("2026-02-28");
    expect(chosenDay("pick", "2026-09-01", today)).toBe("2026-09-01");
  });
  it("the floor is 90 days back and the ceiling is today", () => {
    expect(BACK_DAYS).toBe(90);
    expect(dayBounds(today)).toEqual({ min: "2026-07-14", max: "2026-10-12" });
  });
  it("refuses tomorrow, the day before the floor, and an empty or odd text; allows both limits", () => {
    expect(checkDay("2026-10-12", today)).toEqual({ ok: true, day: "2026-10-12" });
    expect(checkDay("2026-07-14", today)).toEqual({ ok: true, day: "2026-07-14" });
    expect(checkDay("2026-10-13", today)).toEqual({ ok: false, error: "future" });
    expect(checkDay("2026-07-13", today)).toEqual({ ok: false, error: "old" });
    expect(checkDay("", today)).toEqual({ ok: false, error: "missing" });
    expect(checkDay("12/10/2026", today)).toEqual({ ok: false, error: "missing" });
  });
});

describe("undoOpen", () => {
  const made = 1_000_000_000_000;
  it("is open at exactly 24 hours and closed one second later", () => {
    expect(undoOpen(made, made)).toBe(true);
    expect(undoOpen(made, made + UNDO_WINDOW_MS)).toBe(true);
    expect(undoOpen(made, made + UNDO_WINDOW_MS + 1000)).toBe(false);
  });
});

describe("indiaClock", () => {
  it("is 24-hour India time with no local time zone in it", () => {
    expect(indiaClock(Date.UTC(2026, 9, 12, 5, 0))).toBe("10:30");
    expect(indiaClock(Date.UTC(2026, 9, 12, 18, 29))).toBe("23:59");
    expect(indiaClock(Date.UTC(2026, 9, 12, 18, 30))).toBe("00:00");
    expect(indiaClock(Date.UTC(2026, 9, 12, 0, 5))).toBe("05:35");
  });
});

describe("status", () => {
  const due: Due = { id: "d", studentId: "s", kind: "monthly", month: "2026-10-01", amount: 120000, amountPaid: 0, status: "due", dueDate: "2026-10-05" };
  it("follows the amount paid", () => {
    expect(statusFor(120000, 0)).toBe("due");
    expect(statusFor(120000, 1)).toBe("partial");
    expect(statusFor(120000, 120000)).toBe("paid");
    expect(withPaid(due, 50000)).toMatchObject({ amountPaid: 50000, status: "partial" });
    expect(withPaid(due, 120000)).toMatchObject({ amountPaid: 120000, status: "paid" });
    expect(withPaid({ ...due, amountPaid: 50000, status: "partial" }, 0)).toMatchObject({ amountPaid: 0, status: "due" });
    expect(withPaid(due, -5).amountPaid).toBe(0);
  });
});

describe("payment code does money and days only in whole numbers (37)", () => {
  const files = ["src/lib/payments.ts", "src/lib/payments-view.ts"];
  it.each(files)("%s has no float, rounding, local-time getter or Intl", (file) => {
    const text = readFileSync(join(process.cwd(), file), "utf8").replace(/\/\/.*$/gm, "");
    expect(text).not.toMatch(/parseFloat|toFixed|Math\.round|Intl\.|toLocale|new Date|getFullYear|getMonth|getDate|getDay|getHours/);
  });
});
