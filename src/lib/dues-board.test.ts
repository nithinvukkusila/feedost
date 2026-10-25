// Spec R1-6, criteria 1 to 8 and 36: the board's arithmetic, against the tables in the plan.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Due } from "./dues";
import { GRACE_DAYS } from "./grace";
import type { Payment } from "./payments";
import {
  boardView,
  collectedInMonth,
  studentChips,
  currentMonth,
  daysBetween,
  defaultTab,
  dueState,
  earliestNextDue,
  indiaToday,
  monthMoves,
  monthParts,
  needsRead,
  nextDueDate,
  shiftMonth,
} from "./dues-board";
import { formatRupees } from "./format";
import type { Student } from "./students";

const TODAY = "2026-10-12";

function due(over: Partial<Due> & { id: string }): Due {
  return {
    studentId: "S1",
    kind: "monthly",
    month: "2026-10-01",
    amount: 120000,
    amountPaid: 0,
    status: "due",
    dueDate: "2026-10-05",
    ...over,
  };
}

function student(id: string, name: string, over: Partial<Student> = {}): Student {
  return {
    id,
    batchId: null,
    name,
    parentName: null,
    parentPhone: null,
    parentLanguage: "en",
    monthlyFee: 100000,
    openingBalance: 0,
    dueDay: 5,
    active: true,
    ...over,
  };
}

describe("indiaToday (1)", () => {
  const instants: [string, string][] = [
    ["1970-01-01T00:00:00Z", "1970-01-01"],
    ["1969-12-31T18:29:59Z", "1969-12-31"],
    ["1969-12-31T18:30:00Z", "1970-01-01"],
    ["2026-10-12T05:00:00Z", "2026-10-12"],
    ["2026-10-11T23:59:59Z", "2026-10-12"],
    ["2026-10-31T18:29:59Z", "2026-10-31"],
    ["2026-10-31T18:30:00Z", "2026-11-01"],
    ["2026-12-31T18:30:00Z", "2027-01-01"],
    ["2028-02-28T18:30:00Z", "2028-02-29"],
    ["2028-02-29T18:30:00Z", "2028-03-01"],
    ["2027-02-28T18:30:00Z", "2027-03-01"],
    ["2100-02-28T18:30:00Z", "2100-03-01"],
  ];
  const zones: [string, number][] = [
    ["UTC", 0],
    ["America/Los_Angeles", 480],
    ["Asia/Kolkata", -330],
    ["Pacific/Kiritimati", -840],
  ];

  describe.each(zones)("with the process time zone set to %s", (zone, january) => {
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
    it.each(instants)("%s is %s", (instant, day) => {
      expect(indiaToday(Date.parse(instant))).toBe(day);
    });
  });
});

describe("day and month arithmetic", () => {
  it("counts days across month ends and leap years", () => {
    expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
    expect(daysBetween("2026-01-01", "2027-01-01")).toBe(365);
    expect(daysBetween("2026-10-12", "2026-10-05")).toBe(-7);
  });
  it("shifts months", () => {
    expect(shiftMonth("2026-01-01", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-12-01", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-10-01", -13)).toBe("2025-09-01");
    expect(currentMonth("2026-10-31")).toBe("2026-10-01");
    expect(monthParts("2026-10-01")).toEqual({ year: 2026, month: 10 });
  });
});

describe("dueState (2)", () => {
  const monthly = (dueDate: string, amountPaid = 0): Due =>
    due({ id: "x", dueDate, amountPaid, status: amountPaid === 0 ? "due" : "partial" });
  const opening = (over: Partial<Due> = {}): Due => due({ id: "o", kind: "opening", month: null, dueDate: "2026-10-12", ...over });
  // [tab, tag, partPaid, daysLate, isToday]. UX-review-fixes-2 criterion 1.1 extends R1-6 criterion 2: yesterday,
  // today, tomorrow, 31 Oct to 1 Nov and 28 Feb to 1 Mar in a leap (2028) and a non-leap year (2026, 2027).
  const cases: [string, Due, string, [string, string, boolean, number | null, boolean]][] = [
    ["paid monthly", due({ id: "p", dueDate: "2026-09-05", status: "paid", amountPaid: 120000 }), TODAY, ["paid", "paid", false, null, false]],
    ["paid opening", opening({ status: "paid", amountPaid: 120000 }), TODAY, ["paid", "paid", false, null, false]],
    ["yesterday", monthly("2026-10-11"), TODAY, ["overdue", "overdue", false, 1, false]],
    ["today", monthly("2026-10-12"), TODAY, ["due", "due", false, 0, true]],
    ["tomorrow", monthly("2026-10-13"), TODAY, ["due", "due", false, 0, false]],
    ["a week ago", monthly("2026-10-05"), TODAY, ["overdue", "overdue", false, 7, false]],
    ["partial, a week ago", monthly("2026-10-05", 50000), TODAY, ["overdue", "overdue", true, 7, false]],
    ["partial, today", monthly("2026-10-12", 50000), TODAY, ["due", "due", true, 0, true]],
    ["partial, tomorrow", monthly("2026-10-13", 50000), TODAY, ["due", "due", true, 0, false]],
    ["opening, unpaid", opening(), TODAY, ["overdue", "overdue", false, null, false]],
    ["opening, partial, long ago", opening({ dueDate: "2020-01-01", status: "partial", amountPaid: 5 }), TODAY, ["overdue", "overdue", true, null, false]],
    ["31 Oct on 31 Oct", monthly("2026-10-31"), "2026-10-31", ["due", "due", false, 0, true]],
    ["31 Oct to 1 Nov", monthly("2026-10-31"), "2026-11-01", ["overdue", "overdue", false, 1, false]],
    ["28 Feb to 1 Mar", monthly("2026-02-28"), "2026-03-01", ["overdue", "overdue", false, 1, false]],
    ["28 Feb on 28 Feb, 2027", monthly("2027-02-28"), "2027-02-28", ["due", "due", false, 0, true]],
    ["28 Feb to 1 Mar, 2027", monthly("2027-02-28"), "2027-03-01", ["overdue", "overdue", false, 1, false]],
    ["28 Feb to 29 Feb, leap year", monthly("2028-02-28"), "2028-02-29", ["overdue", "overdue", false, 1, false]],
    ["28 Feb to 1 Mar, leap year", monthly("2028-02-28"), "2028-03-01", ["overdue", "overdue", false, 2, false]],
    ["29 Feb on 28 Feb, leap year", monthly("2028-02-29"), "2028-02-28", ["due", "due", false, 0, false]],
    ["a year", monthly("2026-01-01"), "2027-01-01", ["overdue", "overdue", false, 365, false]],
  ];
  it.each(cases)("%s", (_name, d, today, [tab, tag, partPaid, daysLate, isToday]) => {
    expect(dueState(d, today)).toEqual({ tab, tag, partPaid, daysLate, isToday });
  });

  it("the shared grace constant is 0 and lives in a file with no imports (1.2)", () => {
    expect(GRACE_DAYS).toBe(0);
    expect(readFileSync(join(process.cwd(), "src/lib/grace.ts"), "utf8")).not.toMatch(/^\s*import\b/m);
  });

  it("with grace 2, 2 days late is still Due and 3 days late is Overdue 3 days (1.2)", () => {
    expect(dueState(monthly("2026-10-10"), TODAY, 2)).toEqual({ tab: "due", tag: "due", partPaid: false, daysLate: 0, isToday: false });
    expect(dueState(monthly("2026-10-11"), TODAY, 2)).toEqual({ tab: "due", tag: "due", partPaid: false, daysLate: 0, isToday: false });
    expect(dueState(monthly("2026-10-09"), TODAY, 2)).toEqual({ tab: "overdue", tag: "overdue", partPaid: false, daysLate: 3, isToday: false });
    expect(dueState(monthly("2026-10-12"), TODAY, 2)).toMatchObject({ tab: "due", isToday: true });
    // A part-paid fee inside the grace days is Due and still part paid.
    expect(dueState(monthly("2026-10-10", 50000), TODAY, 2)).toMatchObject({ tab: "due", partPaid: true, daysLate: 0 });
  });

  it("grace never applies to an earlier balance: Overdue from the day it is entered, no day count (1.3)", () => {
    expect(dueState(opening({ dueDate: TODAY }), TODAY, 2)).toEqual({ tab: "overdue", tag: "overdue", partPaid: false, daysLate: null, isToday: false });
    expect(dueState(opening({ dueDate: TODAY }), TODAY, 30)).toMatchObject({ tab: "overdue", daysLate: null });
  });

  it("the default grace is the constant", () => {
    for (const [, d, today] of cases) expect(dueState(d, today)).toEqual(dueState(d, today, GRACE_DAYS));
  });
});

describe("boardView (3 to 6)", () => {
  const roster: Student[] = [
    student("S1", "asha", { batchId: "B1" }),
    student("S2", "Bina"),
    student("S3", "Chitra", { active: false }),
    student("S5", "dev"),
  ];
  const dues: Due[] = [
    due({ id: "d1", studentId: "S1", dueDate: "2026-10-05" }),
    due({ id: "d2", studentId: "S2", dueDate: "2026-10-12", amount: 100000, amountPaid: 40000, status: "partial" }),
    due({ id: "d3", studentId: "S1", month: "2026-09-01", dueDate: "2026-09-05" }),
    due({ id: "d4", studentId: "S2", kind: "opening", month: null, dueDate: "2026-09-30", amount: 240000 }),
    due({ id: "d5", studentId: "S2", month: "2026-09-01", dueDate: "2026-09-05", amount: 100000, amountPaid: 100000, status: "paid" }),
    due({ id: "d6", studentId: "S3", dueDate: "2026-10-05", amount: 90000 }),
    due({ id: "d7", studentId: "S4", dueDate: "2026-10-05", amount: 80000 }),
    due({ id: "d8", studentId: "S5", dueDate: "2026-10-12", amount: 50000, amountPaid: 50000, status: "paid" }),
  ];
  const ids = (rows: { due: Due }[]) => rows.map((r) => r.due.id);

  it("the current month holds its own dues and the unpaid earlier ones", () => {
    const v = boardView(dues, roster, "2026-10-01", TODAY, "all");
    expect(ids(v.rows).sort()).toEqual(["d1", "d2", "d3", "d4", "d8"]);
    expect(ids(v.tabs.overdue)).toEqual(["d4", "d3", "d1"]);
    expect(ids(v.tabs.due)).toEqual(["d2"]);
    expect(v.tabs.due[0].state).toMatchObject({ tag: "due", partPaid: true });
    expect(ids(v.tabs.paid)).toEqual(["d8"]);
    expect(v.counts).toEqual({ overdue: 3, due: 1, paid: 1 });
    expect(v.pending).toBe(540000);
    expect(v.dueOwed).toBe(60000);
    expect(v.overdueOwed).toBe(480000);
    expect(v.dueOwed + v.overdueOwed).toBe(v.pending);
    expect(v.students).toBe(2);
    expect(v.studentsInView).toBe(3);
    // S1, S2 and S5 are active; S3 is archived.
    expect(v.studentsInFilter).toBe(3);
    expect(v.missing).toEqual(["S4"]);
    expect(v).not.toHaveProperty("collected");
    expect(v).not.toHaveProperty("blocks");
  });

  it("a past month holds only its own dues", () => {
    const v = boardView(dues, roster, "2026-09-01", TODAY, "all");
    expect(ids(v.rows).sort()).toEqual(["d3", "d5"]);
    expect(v.pending).toBe(120000);
  });

  it("the batch filter goes through the student's current batch", () => {
    const none = boardView(dues, roster, "2026-10-01", TODAY, "none");
    expect(ids(none.rows).sort()).toEqual(["d2", "d4", "d8"]);
    expect(none.pending).toBe(300000);
    expect(none.studentsInFilter).toBe(2);
    const b1 = boardView(dues, roster, "2026-10-01", TODAY, "B1");
    expect(ids(b1.rows)).toEqual(["d3", "d1"]);
    expect(b1.pending).toBe(240000);
    expect(b1.students).toBe(1);
    expect(b1.studentsInView).toBe(1);
    expect(b1.studentsInFilter).toBe(1);
  });

  it("studentsInFilter counts active students in the filter with or without a fee (2.1)", () => {
    const people = [
      ...Array.from({ length: 19 }, (_, i) => student(`n${i}`, `n${i}`)),
      ...Array.from({ length: 6 }, (_, i) => student(`b${i}`, `b${i}`, { batchId: "B6" })),
      student("gone", "gone", { active: false }),
      student("gone6", "gone6", { active: false, batchId: "B6" }),
    ];
    const owing = [due({ id: "o1", studentId: "n0", dueDate: "2026-10-05" }), due({ id: "o2", studentId: "b0", dueDate: "2026-10-05" })];
    const all = boardView(owing, people, "2026-10-01", TODAY, "all");
    expect([all.students, all.studentsInFilter]).toEqual([2, 25]);
    const b6 = boardView(owing, people, "2026-10-01", TODAY, "B6");
    expect([b6.students, b6.studentsInFilter]).toEqual([1, 6]);
    const none = boardView(owing, people, "2026-10-01", TODAY, "none");
    expect([none.students, none.studentsInFilter]).toEqual([1, 19]);
    // With no fee at all the count is still the roster's.
    expect(boardView([], people, "2026-10-01", TODAY, "B6").studentsInFilter).toBe(6);
  });

  it("a part-paid fee stays in Due or Overdue; the Paid tab holds only fully paid fees (3.1)", () => {
    const people = [student("A", "a"), student("B", "b"), student("C", "c")];
    const v = boardView(
      [
        due({ id: "late", studentId: "A", dueDate: "2026-10-05", amount: 50000, amountPaid: 25000, status: "partial" }),
        due({ id: "soon", studentId: "B", dueDate: "2026-10-20", amount: 50000, amountPaid: 10000, status: "partial" }),
        due({ id: "full", studentId: "C", dueDate: "2026-10-05", amount: 50000, amountPaid: 50000, status: "paid" }),
        due({ id: "open", studentId: "C", kind: "opening", month: null, dueDate: TODAY, amount: 50000, amountPaid: 25000, status: "partial" }),
      ],
      people,
      "2026-10-01",
      TODAY,
      "all",
    );
    expect(ids(v.tabs.overdue).sort()).toEqual(["late", "open"]);
    expect(ids(v.tabs.due)).toEqual(["soon"]);
    expect(ids(v.tabs.paid)).toEqual(["full"]);
    expect(v.tabs.paid.every((row) => row.due.status === "paid")).toBe(true);
    expect([v.overdueOwed, v.dueOwed]).toEqual([50000, 40000]);
  });

  it("a due that is listed twice counts once", () => {
    const v = boardView([...dues, dues[0]], roster, "2026-10-01", TODAY, "all");
    expect(v.counts.overdue).toBe(3);
  });

  it("an empty read is an empty view", () => {
    const v = boardView([], roster, "2026-10-01", TODAY, "all");
    expect(v).toMatchObject({ pending: 0, dueOwed: 0, overdueOwed: 0, students: 0, studentsInView: 0, studentsInFilter: 3, missing: [] });
  });

  it("orders ties by name then id (4)", () => {
    const people = [student("A", "Zed"), student("B", "amy"), student("C", "Amy")];
    const same = [
      due({ id: "x3", studentId: "A", dueDate: "2026-10-05" }),
      due({ id: "x2", studentId: "C", dueDate: "2026-10-05" }),
      due({ id: "x1", studentId: "B", dueDate: "2026-10-05" }),
    ];
    // "amy" and "Amy" are the same name once lower-cased: the due id decides.
    expect(ids(boardView(same, people, "2026-10-01", TODAY, "all").tabs.overdue)).toEqual(["x1", "x2", "x3"]);
    const later = [
      due({ id: "y1", studentId: "A", dueDate: "2026-10-20" }),
      due({ id: "y2", studentId: "B", dueDate: "2026-10-20" }),
      due({ id: "y3", studentId: "C", dueDate: "2026-10-13" }),
    ];
    expect(ids(boardView(later, people, "2026-10-01", TODAY, "all").tabs.due)).toEqual(["y3", "y2", "y1"]);
    const paid = [
      due({ id: "z1", studentId: "A", status: "paid", amountPaid: 120000 }),
      due({ id: "z2", studentId: "B", status: "paid", amountPaid: 120000 }),
    ];
    expect(ids(boardView(paid, people, "2026-10-01", TODAY, "all").tabs.paid)).toEqual(["z2", "z1"]);
    // Opening balances come first, then the most days late.
    const mixed = [
      due({ id: "m1", studentId: "A", dueDate: "2026-10-11" }),
      due({ id: "m2", studentId: "B", dueDate: "2026-10-01" }),
      due({ id: "m3", studentId: "C", kind: "opening", month: null, dueDate: "2026-10-12" }),
    ];
    expect(ids(boardView(mixed, people, "2026-10-01", TODAY, "all").tabs.overdue)).toEqual(["m3", "m2", "m1"]);
  });

  it("what is owed on a fee that is not late counts as Due (6)", () => {
    const v = boardView([due({ id: "a", studentId: "S2", dueDate: "2026-10-20" })], roster, "2026-10-01", TODAY, "all");
    expect([v.dueOwed, v.overdueOwed]).toEqual([120000, 0]);
  });

  it("sums 300 dues of 10,00,000 rupees exactly (5)", () => {
    const people = Array.from({ length: 300 }, (_, i) => student(`s${i}`, `n${i}`));
    const many = people.map((p, i) => due({ id: `m${i}`, studentId: p.id, amount: 100_000_000 }));
    const v = boardView(many, people, "2026-10-01", TODAY, "all");
    expect(v.pending).toBe(30_000_000_000);
    expect(formatRupees(v.pending)).toBe("₹30,00,00,000");
  });

  it("handles 3,000 rows in one pass (a sanity bound, not a benchmark)", () => {
    const people = Array.from({ length: 1000 }, (_, i) => student(`s${i}`, `n${i}`));
    const many = Array.from({ length: 3000 }, (_, i) =>
      due({ id: `m${i}`, studentId: `s${i % 1000}`, month: i < 1000 ? "2026-10-01" : "2026-09-01", dueDate: "2026-09-05" }),
    );
    const started = Date.now();
    const v = boardView(many, people, "2026-10-01", TODAY, "all");
    expect(v.rows).toHaveLength(3000);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe("defaultTab (7)", () => {
  it.each([
    [{ overdue: 3, due: 1, paid: 1 }, "overdue"],
    [{ overdue: 0, due: 2, paid: 1 }, "due"],
    [{ overdue: 0, due: 0, paid: 4 }, "paid"],
    [{ overdue: 0, due: 0, paid: 0 }, "overdue"],
  ] as const)("%j opens on %s", (counts, tab) => {
    expect(defaultTab(counts)).toBe(tab);
  });
});

describe("monthMoves (8)", () => {
  it("allows previous after the earliest month and next before the current one", () => {
    expect(monthMoves("2026-10-01", "2026-08-01", TODAY)).toEqual({ prev: true, next: false });
    expect(monthMoves("2026-09-01", "2026-08-01", TODAY)).toEqual({ prev: true, next: true });
    expect(monthMoves("2026-08-01", "2026-08-01", TODAY)).toEqual({ prev: false, next: true });
  });
  it("is off both ways with no dues", () => {
    expect(monthMoves("2026-10-01", null, TODAY)).toEqual({ prev: false, next: false });
  });
});

describe("needsRead", () => {
  it("is true for a missing or older-than-a-minute read, false for a fresh one", () => {
    expect(needsRead(null, 1000)).toBe(true);
    expect(needsRead(undefined, 1000)).toBe(true);
    expect(needsRead({ at: 1000 }, 61_000)).toBe(false);
    expect(needsRead({ at: 1000 }, 61_001)).toBe(true);
    expect(needsRead({ at: 5000 }, 1000)).toBe(true);
  });
});

describe("the board code does money and days only in whole numbers (36)", () => {
  const files = ["src/lib/dues.ts", "src/lib/dues-board.ts"];
  it.each(files)("%s has no float, rounding, local-time getter or Intl", (file) => {
    const text = readFileSync(join(process.cwd(), file), "utf8").replace(/\/\/.*$/gm, "");
    expect(text).not.toMatch(/parseFloat|toFixed|Math\.round|Intl\.|toLocale|new Date|getFullYear|getMonth|getDate|getDay|getHours/);
  });
});

describe("nextDueDate and earliestNextDue (UX-review-fixes, U1 and U2)", () => {
  it("is this month when the due day is still ahead", () => {
    expect(nextDueDate(20, "2026-10-14")).toBe("2026-10-20");
  });
  it("is next month when the due day is today, because today's due is already made", () => {
    expect(nextDueDate(14, "2026-10-14")).toBe("2026-11-14");
  });
  it("is next month when the due day has passed", () => {
    expect(nextDueDate(1, "2026-10-14")).toBe("2026-11-01");
    expect(nextDueDate(4, "2026-10-14")).toBe("2026-11-04");
  });
  it("rolls the year from December", () => {
    expect(nextDueDate(28, "2026-12-30")).toBe("2027-01-28");
  });
  it("handles due day 1 on the last day of a month", () => {
    expect(nextDueDate(1, "2026-02-28")).toBe("2026-03-01");
    expect(nextDueDate(1, "2026-12-31")).toBe("2027-01-01");
  });
  it("takes the soonest over active students with a fee, ignoring archived and fee 0", () => {
    const list = [
      student("a", "A", { dueDay: 4 }),
      student("b", "B", { dueDay: 1 }),
      student("c", "C", { dueDay: 20, active: false }),
      student("d", "D", { dueDay: 15, monthlyFee: 0 }),
    ];
    expect(earliestNextDue(list, "2026-10-14")).toBe("2026-11-01");
    expect(earliestNextDue([list[2], list[3]], "2026-10-14")).toBeNull();
    expect(earliestNextDue([], "2026-10-14")).toBeNull();
  });
});

function payment(over: Partial<Payment> & { id: string; dueId: string }): Payment {
  return { amount: 25000, method: "cash", paidOn: "2026-10-12", receiptNo: 1, balanceAfter: 0, createdAt: 0, voidedAt: null, ...over };
}

describe("collectedInMonth (UX-review-fixes-2, 3.3 and 3.6)", () => {
  const people = [student("A", "a", { batchId: "B1" }), student("B", "b"), student("Z", "z", { batchId: "B1", active: false })];
  const studentOf = { dA: "A", dAopen: "A", dAsep: "A", dB: "B", dZ: "Z", dGone: "nobody" };
  const october: Payment[] = [
    // A part payment on this month's fee.
    payment({ id: "p1", dueId: "dA", amount: 25000 }),
    // A payment on an earlier balance, and one on an earlier month's fee, both received in October.
    payment({ id: "p2", dueId: "dAopen", amount: 50000 }),
    payment({ id: "p3", dueId: "dAsep", amount: 120000, paidOn: "2026-10-01" }),
    // An archived student in B1.
    payment({ id: "p4", dueId: "dZ", amount: 7000 }),
    payment({ id: "p5", dueId: "dB", amount: 100000, paidOn: "2026-10-31" }),
    // Voided: never counted.
    payment({ id: "p6", dueId: "dB", amount: 99900, voidedAt: 1 }),
    // A fee this phone does not know, and a fee whose student is not in the roster.
    payment({ id: "p7", dueId: "dUnknown", amount: 300 }),
    payment({ id: "p8", dueId: "dGone", amount: 200 }),
  ];

  it("adds up every payment received in the month, part payments and old fees included, in integer paise", () => {
    expect(collectedInMonth(october, studentOf, people, "all")).toBe(25000 + 50000 + 120000 + 7000 + 100000 + 300 + 200);
  });

  it("never counts a voided payment", () => {
    expect(collectedInMonth([payment({ id: "v", dueId: "dA", voidedAt: 5 })], studentOf, people, "all")).toBe(0);
  });

  it("goes through the student's current batch, archived students included; unknown fees count under All only", () => {
    expect(collectedInMonth(october, studentOf, people, "B1")).toBe(25000 + 50000 + 120000 + 7000);
    expect(collectedInMonth(october, studentOf, people, "none")).toBe(100000);
    expect(collectedInMonth(october, studentOf, people, "B9")).toBe(0);
  });

  it("is 0 with no payments", () => {
    expect(collectedInMonth([], studentOf, people, "all")).toBe(0);
  });

  it("is the same figure whether or not every fee is paid (3.6): it reads payments, not the fees", () => {
    const fees = [due({ id: "dA", studentId: "A", amount: 25000, amountPaid: 25000, status: "paid" })];
    const view = boardView(fees, people, "2026-10-01", TODAY, "all");
    expect(view.counts.overdue + view.counts.due).toBe(0);
    expect(collectedInMonth([october[0]], studentOf, people, "all")).toBe(25000);
  });
});

describe("studentChips (UX-review-fixes-2, 10.1)", () => {
  const today = "2026-10-25";
  const chipOf = (dues: Due[], people: Student[], id: string) => studentChips(dues, people, today).get(id);
  const s = (id: string, over: Partial<Student> = {}) => student(id, id, over);

  it("is Overdue with the sum still owed on overdue fees, part-paid ones included", () => {
    const dues = [
      due({ id: "a1", studentId: "A", dueDate: "2026-10-05", amount: 50000, amountPaid: 20000, status: "partial" }),
      due({ id: "a2", studentId: "A", kind: "opening", month: null, dueDate: "2026-10-25", amount: 50000 }),
      due({ id: "a3", studentId: "A", dueDate: "2026-10-25", month: "2026-09-01", amount: 1000 }),
    ];
    // a3 is an earlier month's fee due today: Due today, but Overdue wins.
    expect(chipOf(dues, [s("A")], "A")).toEqual({ kind: "overdue", amount: 80000 });
  });

  it("is Due today before Part paid", () => {
    const dues = [
      due({ id: "b1", studentId: "B", dueDate: "2026-10-25" }),
      due({ id: "b2", studentId: "B", kind: "opening", month: null, dueDate: "2026-10-25", amount: 50000, amountPaid: 50000, status: "paid" }),
      due({ id: "b3", studentId: "B", month: "2026-09-01", dueDate: "2026-10-28", amount: 50000, amountPaid: 10000, status: "partial" }),
    ];
    expect(chipOf(dues, [s("B")], "B")).toEqual({ kind: "dueToday" });
  });

  it("is Part paid with what is paid so far on a part-paid fee that is not late", () => {
    const dues = [due({ id: "c1", studentId: "C", dueDate: "2026-10-28", amount: 50000, amountPaid: 25000, status: "partial" })];
    expect(chipOf(dues, [s("C")], "C")).toEqual({ kind: "partPaid", amount: 25000 });
  });

  it("is Due with the soonest open fee's date", () => {
    const dues = [due({ id: "d1", studentId: "D", dueDate: "2026-10-30" }), due({ id: "d2", studentId: "D", month: "2026-09-01", dueDate: "2026-10-28" })];
    expect(chipOf(dues, [s("D")], "D")).toEqual({ kind: "due", date: "2026-10-28" });
  });

  it("is Paid when this month's fee is fully paid and nothing is open", () => {
    const dues = [due({ id: "e1", studentId: "E", dueDate: "2026-10-05", amountPaid: 120000, status: "paid" })];
    expect(chipOf(dues, [s("E")], "E")).toEqual({ kind: "paid" });
    // A paid fee from an earlier month is not in this month's view: no chip.
    const old = [due({ id: "e2", studentId: "E", month: "2026-09-01", dueDate: "2026-09-05", amountPaid: 120000, status: "paid" })];
    expect(chipOf(old, [s("E")], "E")).toBeUndefined();
  });

  it("gives no chip to a student with no fee yet, or to an archived one (10.2)", () => {
    const people = [s("F"), s("G", { active: false })];
    const dues = [due({ id: "f1", studentId: "G", dueDate: "2026-10-05" })];
    expect(chipOf(dues, people, "F")).toBeUndefined();
    expect(chipOf(dues, people, "G")).toBeUndefined();
  });

  it("follows the board's day rule: the day after the due date is Overdue", () => {
    const dues = [due({ id: "h1", studentId: "H", dueDate: "2026-10-24", amount: 70000 })];
    expect(chipOf(dues, [s("H")], "H")).toEqual({ kind: "overdue", amount: 70000 });
  });
});
