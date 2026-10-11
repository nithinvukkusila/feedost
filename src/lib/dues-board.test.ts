// Spec R1-6, criteria 1 to 8 and 36: the board's arithmetic, against the tables in the plan.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Due } from "./dues";
import {
  boardView,
  currentMonth,
  daysBetween,
  defaultTab,
  dueState,
  indiaToday,
  monthMoves,
  monthParts,
  needsRead,
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
  const cases: [string, Due, string, [string, string, number | null, boolean]][] = [
    ["paid monthly", due({ id: "p", dueDate: "2026-09-05", status: "paid", amountPaid: 120000 }), TODAY, ["paid", "paid", null, false]],
    ["paid opening", opening({ status: "paid", amountPaid: 120000 }), TODAY, ["paid", "paid", null, false]],
    ["yesterday", monthly("2026-10-11"), TODAY, ["overdue", "overdue", 1, false]],
    ["today", monthly("2026-10-12"), TODAY, ["due", "due", 0, true]],
    ["tomorrow", monthly("2026-10-13"), TODAY, ["due", "due", 0, false]],
    ["a week ago", monthly("2026-10-05"), TODAY, ["overdue", "overdue", 7, false]],
    ["partial, a week ago", monthly("2026-10-05", 50000), TODAY, ["overdue", "overdue", 7, false]],
    ["partial, today", monthly("2026-10-12", 50000), TODAY, ["due", "part-paid", 0, true]],
    ["partial, tomorrow", monthly("2026-10-13", 50000), TODAY, ["due", "part-paid", 0, false]],
    ["opening, unpaid", opening(), TODAY, ["overdue", "overdue", null, false]],
    ["opening, partial, long ago", opening({ dueDate: "2020-01-01", status: "partial", amountPaid: 5 }), TODAY, ["overdue", "overdue", null, false]],
    ["31 Oct to 1 Nov", monthly("2026-10-31"), "2026-11-01", ["overdue", "overdue", 1, false]],
    ["31 Oct on 31 Oct", monthly("2026-10-31"), "2026-10-31", ["due", "due", 0, true]],
    ["28 Feb to 1 Mar", monthly("2026-02-28"), "2026-03-01", ["overdue", "overdue", 1, false]],
    ["28 Feb to 1 Mar, leap year", monthly("2028-02-28"), "2028-03-01", ["overdue", "overdue", 2, false]],
    ["a year", monthly("2026-01-01"), "2027-01-01", ["overdue", "overdue", 365, false]],
  ];
  it.each(cases)("%s", (_name, d, today, [tab, tag, daysLate, isToday]) => {
    expect(dueState(d, today)).toEqual({ tab, tag, daysLate, isToday });
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
    expect(v.tabs.due[0].state.tag).toBe("part-paid");
    expect(ids(v.tabs.paid)).toEqual(["d8"]);
    expect(v.counts).toEqual({ overdue: 3, due: 1, paid: 1 });
    expect(v.pending).toBe(540000);
    expect(v.collected).toBe(90000);
    expect(v.students).toBe(2);
    expect(v.studentsInView).toBe(3);
    expect(v.blocks).toEqual(["paid", "overdue", "overdue"]);
    expect(v.legend).toEqual({ paid: 1, due: 0, overdue: 2 });
    expect(v.legend.paid + v.legend.due + v.legend.overdue).toBe(v.blocks.length);
    expect(v.missing).toEqual(["S4"]);
  });

  it("a past month holds only its own dues", () => {
    const v = boardView(dues, roster, "2026-09-01", TODAY, "all");
    expect(ids(v.rows).sort()).toEqual(["d3", "d5"]);
    expect(v.pending).toBe(120000);
    expect(v.collected).toBe(100000);
  });

  it("the batch filter goes through the student's current batch", () => {
    const none = boardView(dues, roster, "2026-10-01", TODAY, "none");
    expect(ids(none.rows).sort()).toEqual(["d2", "d4", "d8"]);
    expect(none.pending).toBe(300000);
    expect(none.collected).toBe(90000);
    const b1 = boardView(dues, roster, "2026-10-01", TODAY, "B1");
    expect(ids(b1.rows)).toEqual(["d3", "d1"]);
    expect(b1.pending).toBe(240000);
    expect(b1.collected).toBe(0);
    expect(b1.students).toBe(1);
    expect(b1.studentsInView).toBe(1);
    expect(b1.blocks).toEqual(["overdue"]);
  });

  it("a due that is listed twice counts once", () => {
    const v = boardView([...dues, dues[0]], roster, "2026-10-01", TODAY, "all");
    expect(v.counts.overdue).toBe(3);
  });

  it("an empty read is an empty view", () => {
    const v = boardView([], roster, "2026-10-01", TODAY, "all");
    expect(v).toMatchObject({ pending: 0, collected: 0, students: 0, studentsInView: 0, blocks: [], missing: [] });
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

  it("a block is Due when something is unpaid but nothing is late (6)", () => {
    const v = boardView([due({ id: "a", studentId: "S2", dueDate: "2026-10-20" })], roster, "2026-10-01", TODAY, "all");
    expect(v.blocks).toEqual(["due"]);
    expect(v.legend).toEqual({ paid: 0, due: 1, overdue: 0 });
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
