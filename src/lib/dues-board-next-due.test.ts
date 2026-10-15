// Test-engineer additions for spec UX-review-fixes, criteria U1 and U2: nextDueDate and earliestNextDue
// over every month, every due day and the year and month ends. The due day is 1 to 28 (the students table
// check), so there is no 29th, 30th or 31st to clamp; the last test pins that the helper never emits a day
// past the 28th and that the database range is the one the helper relies on.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { earliestNextDue, nextDueDate } from "./dues-board";
import { formatDate } from "./format";

const pad = (n: number) => String(n).padStart(2, "0");
const DAYS_IN = (y: number, m: number) => [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];

describe("nextDueDate, every day of 2026, 2027 and the leap year 2028", () => {
  it("is strictly after today, is never more than one month away, and is on the due day", () => {
    for (const year of [2026, 2027, 2028]) {
      for (let month = 1; month <= 12; month++) {
        for (let day = 1; day <= DAYS_IN(year, month); day++) {
          const today = `${year}-${pad(month)}-${pad(day)}`;
          for (let due = 1; due <= 28; due++) {
            const got = nextDueDate(due, today);
            expect(got > today, `${today} due ${due} -> ${got}`).toBe(true);
            expect(got.slice(8), `${today} due ${due}`).toBe(pad(due));
            const expected = due > day ? `${year}-${pad(month)}-${pad(due)}` : month === 12 ? `${year + 1}-01-${pad(due)}` : `${year}-${pad(month + 1)}-${pad(due)}`;
            expect(got, `${today} due ${due}`).toBe(expected);
          }
        }
      }
    }
  });

  it("names the cases the founder asked about", () => {
    expect(nextDueDate(28, "2026-12-28")).toBe("2027-01-28"); // today equal to the due day, in December
    expect(nextDueDate(1, "2026-12-31")).toBe("2027-01-01");
    expect(nextDueDate(28, "2026-01-31")).toBe("2026-02-28"); // a short month is never a problem at 28 or less
    expect(nextDueDate(28, "2028-02-29")).toBe("2028-03-28");
    expect(nextDueDate(14, "2026-10-14")).toBe("2026-11-14");
  });

  it("shows through formatDate as DD MMM YYYY with ASCII digits", () => {
    expect(formatDate(nextDueDate(1, "2026-10-14"))).toBe("01 Nov 2026");
    expect(formatDate(nextDueDate(28, "2026-12-30"))).toBe("28 Jan 2027");
    expect(formatDate(nextDueDate(9, "2026-12-30"))).toMatch(/^[0-9]{2} [A-Z][a-z]{2} [0-9]{4}$/);
  });
});

describe("earliestNextDue", () => {
  const s = (dueDay: number, extra: Record<string, unknown> = {}) => ({ id: String(dueDay), name: "x", dueDay, monthlyFee: 100000, active: true, ...extra }) as never;
  it("picks the soonest across the year end", () => {
    expect(earliestNextDue([s(28), s(3)], "2026-12-15")).toBe("2026-12-28");
    expect(earliestNextDue([s(3), s(10)], "2026-12-15")).toBe("2027-01-03");
  });
  it("treats a student whose due day is today as next month", () => {
    expect(earliestNextDue([s(14)], "2026-10-14")).toBe("2026-11-14");
    expect(earliestNextDue([s(14), s(20)], "2026-10-14")).toBe("2026-10-20");
  });
  it("ignores an archived student and one with a fee of 0 even when theirs is sooner", () => {
    expect(earliestNextDue([s(15, { active: false }), s(16, { monthlyFee: 0 }), s(25)], "2026-10-14")).toBe("2026-10-25");
  });
});

describe("the database range the helper relies on", () => {
  it("still limits due_day to 1 to 28 in the migrations", () => {
    const dir = join(__dirname, "..", "..", "supabase", "migrations");
    const sql = readdirSync(dir).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
    expect(sql).toMatch(/due_day between 1 and 28/);
    expect(sql).not.toMatch(/due_day between 1 and (29|30|31)/);
  });
});
