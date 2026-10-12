// The reminder rules (spec R1-8, criteria 1, 21 to 23, 25, 27). Fixed clock: 2026-10-12 05:00 UTC (10:30 India).
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Due } from "./dues";
import { boardView, dueState, type Row } from "./dues-board";
import {
  alreadyRemindedToday,
  BULK_NOTE_ABOVE,
  canRemind,
  indiaClock12,
  lastRemindedWords,
  pickList,
  PHONE_PATTERN,
  queueFromPick,
  queueItem,
  showManyNote,
  templateTag,
  TEMPLATE_TAG,
  UPI_PATTERN,
} from "./reminder-rules";
import { PHONE_E164, UPI_ID } from "./reminder/reminder";
import type { Student } from "./students";

const NOW = Date.UTC(2026, 9, 12, 5, 0, 0);
const TODAY = "2026-10-12";
const tutor = { upiId: "asha@okaxis", name: "Asha" };

const student = (over: Partial<Student> = {}): Student => ({
  id: "s1",
  batchId: null,
  name: "Ravi",
  parentName: "Sunita",
  parentPhone: "+919876543210",
  parentLanguage: "en",
  monthlyFee: 100_000,
  openingBalance: 0,
  dueDay: 1,
  active: true,
  ...over,
});
const due = (over: Partial<Due> = {}): Due => ({
  id: "d1",
  studentId: "s1",
  kind: "monthly",
  month: "2026-09-01",
  amount: 100_000,
  amountPaid: 0,
  status: "due",
  dueDate: "2026-09-05",
  ...over,
});
const row = (d: Partial<Due> = {}, s: Partial<Student> = {}): Row => {
  const dd = due(d);
  return { due: dd, student: student(s), state: dueState(dd, TODAY) };
};

describe("the copies of two patterns equal the builder's (the board cannot import the builder)", () => {
  it("UPI_ID and the phone pattern", () => {
    expect(UPI_PATTERN.source).toBe(UPI_ID.source);
    expect(UPI_PATTERN.flags).toBe(UPI_ID.flags);
    expect(PHONE_PATTERN.source).toBe(PHONE_E164.source);
    expect(PHONE_PATTERN.flags).toBe(PHONE_E164.flags);
  });
});

describe("canRemind (criterion 1)", () => {
  const ok = { ok: true };
  it("is true for an unpaid or part paid fee of an active student with a phone, when the tutor has a UPI ID", () => {
    expect(canRemind({ status: "due" }, student(), tutor)).toEqual(ok);
    expect(canRemind({ status: "partial" }, student(), tutor)).toEqual(ok);
  });

  it.each([
    ["paid", { status: "paid" as const }, student(), tutor],
    ["archived", { status: "due" as const }, student({ active: false }), tutor],
    ["noPhone", { status: "due" as const }, student({ parentPhone: null }), tutor],
    ["noPhone", { status: "due" as const }, student({ parentPhone: "9876543210" }), tutor],
    ["noPhone", { status: "due" as const }, student({ parentPhone: "+44987654321" }), tutor],
    ["noUpi", { status: "due" as const }, student(), { upiId: null, name: "Asha" }],
    ["noUpi", { status: "due" as const }, student(), { upiId: "bad", name: "Asha" }],
    ["noUpi", { status: "due" as const }, student(), { upiId: "asha@okaxis", name: null }],
    ["noUpi", { status: "due" as const }, student(), { upiId: "asha@okaxis", name: "  " }],
  ])("%s", (reason, d, s, t) => {
    expect(canRemind(d, s, t)).toEqual({ ok: false, reason });
  });

  it("returns the first reason when two hold, in the order paid, archived, noPhone, noUpi", () => {
    const none = { upiId: null, name: null };
    expect(canRemind({ status: "paid" }, student({ active: false, parentPhone: null }), none)).toEqual({ ok: false, reason: "paid" });
    expect(canRemind({ status: "due" }, student({ active: false, parentPhone: null }), none)).toEqual({ ok: false, reason: "archived" });
    expect(canRemind({ status: "due" }, student({ parentPhone: null }), none)).toEqual({ ok: false, reason: "noPhone" });
    expect(canRemind({ status: "due" }, student(), none)).toEqual({ ok: false, reason: "noUpi" });
  });
});

describe("templateTag", () => {
  it("matches the database's pattern for every combination", () => {
    for (const tone of ["polite", "firm"] as const) for (const l of ["en", "hi", "kn", "te"] as const) for (const k of ["month", "balance"] as const) {
      expect(templateTag(tone, l, k)).toBe(`${tone}:${l}:${k}`);
      expect(templateTag(tone, l, k)).toMatch(TEMPLATE_TAG);
    }
  });
});

describe("alreadyRemindedToday (criterion 25)", () => {
  const at = (iso: string) => Date.parse(iso);
  it("the India day changes at 18:30 UTC", () => {
    // 2026-10-12 18:29:59 UTC is 23:59:59 India on the 12th; one second later is 00:00 on the 13th.
    expect(alreadyRemindedToday(at("2026-10-12T18:29:59Z"), at("2026-10-12T18:29:59Z"))).toBe(true);
    expect(alreadyRemindedToday(at("2026-10-12T18:29:59Z"), at("2026-10-12T18:30:00Z"))).toBe(false);
    expect(alreadyRemindedToday(at("2026-10-12T18:30:00Z"), at("2026-10-12T20:00:00Z"))).toBe(true);
    // Same UTC date, different India days.
    expect(alreadyRemindedToday(at("2026-10-12T18:29:59Z"), at("2026-10-12T18:30:00Z"))).toBe(false);
  });
  it("yesterday 23:59 India is not today; today 00:00 India is", () => {
    expect(alreadyRemindedToday(at("2026-10-11T18:29:00Z"), NOW)).toBe(false);
    expect(alreadyRemindedToday(at("2026-10-11T18:30:00Z"), NOW)).toBe(true);
  });
  it("a record from another month is not today", () => {
    expect(alreadyRemindedToday(at("2026-09-12T05:00:00Z"), NOW)).toBe(false);
    expect(alreadyRemindedToday(at("2025-10-12T05:00:00Z"), NOW)).toBe(false);
  });
});

describe("lastRemindedWords (criterion 27)", () => {
  const ago = (days: number, extra = 0) => NOW - days * 86_400_000 - extra;
  it("today, yesterday, n days, then over 30", () => {
    expect(lastRemindedWords(NOW, NOW)).toEqual({ key: "today", n: 0 });
    expect(lastRemindedWords(ago(1), NOW)).toEqual({ key: "yesterday", n: 1 });
    expect(lastRemindedWords(ago(2), NOW)).toEqual({ key: "days", n: 2 });
    expect(lastRemindedWords(ago(30), NOW)).toEqual({ key: "days", n: 30 });
    expect(lastRemindedWords(ago(31), NOW)).toEqual({ key: "old", n: 31 });
    expect(lastRemindedWords(ago(400), NOW)).toEqual({ key: "old", n: 400 });
  });
  it("counts India days, not 24-hour spans", () => {
    // 10:30 India now; 23:59 India the day before is "yesterday" though only 10.5 hours ago.
    expect(lastRemindedWords(Date.parse("2026-10-11T18:29:00Z"), NOW)).toEqual({ key: "yesterday", n: 1 });
  });
  it("a record a little in the future (wrong phone clock) is today", () => {
    expect(lastRemindedWords(NOW + 3_600_000, NOW)).toEqual({ key: "today", n: 0 });
  });
});

describe("indiaClock12", () => {
  it.each([
    ["2026-10-12T05:00:00Z", { hour: 10, minute: "30", pm: false }],
    ["2026-10-12T18:30:00Z", { hour: 12, minute: "00", pm: false }],
    ["2026-10-12T06:30:00Z", { hour: 12, minute: "00", pm: true }],
    ["2026-10-12T18:29:00Z", { hour: 11, minute: "59", pm: true }],
    ["2026-10-12T07:35:00Z", { hour: 1, minute: "05", pm: true }],
  ])("%s", (iso, expected) => {
    expect(indiaClock12(Date.parse(iso))).toEqual(expected);
  });
});

describe("queueItem", () => {
  it("snapshots the row, with the remaining amount", () => {
    const item = queueItem(row({ amountPaid: 40_000, status: "partial" }), "Batch A");
    expect(item).toEqual({
      dueId: "d1",
      studentId: "s1",
      studentName: "Ravi",
      parentName: "Sunita",
      parentPhone: "+919876543210",
      parentLanguage: "en",
      batchName: "Batch A",
      month: "2026-09-01",
      kind: "monthly",
      daysLate: 37,
      remaining: 60_000,
      dueDate: "2026-09-05",
    });
  });
  it("an earlier balance has no days late", () => {
    expect(queueItem(row({ kind: "opening", month: null }), null).daysLate).toBeNull();
  });
  it("refuses a student with no phone", () => {
    expect(() => queueItem(row({}, { parentPhone: null }), null)).toThrow(RangeError);
  });
});

describe("pickList (criteria 21, 22)", () => {
  const last = (id: string, ms: number) => ({ [id]: { lastAt: ms } });

  it("one item per student, for the oldest overdue fee, with the count of the others", () => {
    const rows = [
      row({ id: "d2", dueDate: "2026-09-20", month: "2026-09-01" }),
      row({ id: "d1", dueDate: "2026-08-05", month: "2026-08-01" }),
      row({ id: "d3", dueDate: "2026-07-05", month: "2026-07-01" }),
    ];
    const pick = pickList(rows, tutor, {}, NOW);
    expect(pick.items).toHaveLength(1);
    expect(pick.items[0].row.due.id).toBe("d3");
    expect(pick.items[0].more).toBe(2);
    expect(pick.cannot).toEqual([]);
  });

  it("starts everyone ticked except fees reminded today", () => {
    const rows = [row({ id: "d1" }, { id: "s1", name: "A" }), row({ id: "d2" }, { id: "s2", name: "B" })];
    const pick = pickList(rows, tutor, last("d2", NOW - 3_600_000), NOW);
    const by = Object.fromEntries(pick.items.map((i) => [i.row.student.id, i]));
    expect(by.s1).toMatchObject({ ticked: true, remindedToday: false });
    expect(by.s2).toMatchObject({ ticked: false, remindedToday: true });
  });

  it("a reminder from yesterday does not untick", () => {
    const pick = pickList([row()], tutor, last("d1", NOW - 86_400_000), NOW);
    expect(pick.items[0]).toMatchObject({ ticked: true, remindedToday: false });
  });

  it("leaves out Due and Paid rows; bulk is for Overdue only", () => {
    const rows = [
      row({ id: "dx", dueDate: "2026-10-20" }, { id: "s2" }),
      row({ id: "dy", status: "paid", amountPaid: 100_000 }, { id: "s3" }),
    ];
    expect(pickList(rows, tutor, {}, NOW)).toEqual({ items: [], cannot: [] });
  });

  it("students who cannot be reminded are listed once with the reason", () => {
    const rows = [
      row({ id: "d1" }, { id: "s1", name: "NoPhone", parentPhone: null }),
      row({ id: "d2", dueDate: "2026-08-01" }, { id: "s1", name: "NoPhone", parentPhone: null }),
      row({ id: "d3" }, { id: "s2", name: "Fine" }),
    ];
    const pick = pickList(rows, tutor, {}, NOW);
    expect(pick.items.map((i) => i.row.student.name)).toEqual(["Fine"]);
    expect(pick.cannot).toHaveLength(1);
    expect(pick.cannot[0]).toMatchObject({ reason: "noPhone", dueIds: ["d2", "d1"] });
    const noUpi = pickList(rows, { upiId: null, name: null }, {}, NOW);
    expect(noUpi.items).toEqual([]);
    expect(noUpi.cannot.map((c) => [c.student.name, c.reason])).toEqual([["Fine", "noUpi"], ["NoPhone", "noPhone"]]);
  });

  it("an earlier balance counts as overdue and is reminded", () => {
    const pick = pickList([row({ kind: "opening", month: null, dueDate: "2026-09-01" })], tutor, {}, NOW);
    expect(pick.items).toHaveLength(1);
    expect(pick.items[0].row.state.daysLate).toBeNull();
  });

  it("works on the rows boardView gives, so the batch filter has already narrowed them", () => {
    const rows = [row()];
    const view = boardView([rows[0].due], [rows[0].student], "2026-10-01", TODAY, "all");
    expect(pickList(view.tabs.overdue, tutor, {}, NOW).items).toHaveLength(1);
  });

  it("queueFromPick keeps the ticked students in list order", () => {
    const rows = [
      row({ id: "d1", dueDate: "2026-08-01" }, { id: "s1", name: "A", batchId: "b1" }),
      row({ id: "d2", dueDate: "2026-09-01" }, { id: "s2", name: "B" }),
    ];
    const pick = pickList(rows, tutor, {}, NOW);
    const queue = queueFromPick(pick.items, new Set(["s2", "s1"]), (id) => (id === "b1" ? "Batch" : null));
    expect(queue.map((q) => [q.studentId, q.batchName])).toEqual([["s1", "Batch"], ["s2", null]]);
    expect(queueFromPick(pick.items, new Set(), () => null)).toEqual([]);
  });
});

describe("showManyNote (criterion 23)", () => {
  it("shows above 20 and never at 20", () => {
    expect(BULK_NOTE_ABOVE).toBe(20);
    expect(showManyNote(20)).toBe(false);
    expect(showManyNote(21)).toBe(true);
    expect(showManyNote(0)).toBe(false);
  });
});

describe("the board never loads the builder or the templates (plan section 3, risk 2)", () => {
  const FORBIDDEN = /from\s+["'][^"']*(reminder\/reminder|reminder\/app-message|templates(\.app)?(\.json)?|\/reminder)["']/;
  const root = process.cwd();
  function files(dir: string): string[] {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return files(path);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  }
  const guarded = [
    ...files(join(root, "src/components/board")),
    ...files(join(root, "src/components/pay")),
    join(root, "src/lib/dues-board.ts"),
    join(root, "src/lib/reminders.ts"),
    join(root, "src/lib/reminder-rules.ts"),
  ].filter((f) => existsSync(f));

  it("covers real files", () => {
    expect(guarded.length).toBeGreaterThan(5);
    expect(guarded.some((f) => f.endsWith("reminder-rules.ts"))).toBe(true);
  });

  it.each(guarded.map((f) => [f.slice(root.length + 1), f]))("%s", (_name, file) => {
    const source = readFileSync(file, "utf8");
    for (const line of source.split("\n")) {
      if (/^\s*(import|export)\b/.test(line) || /^\s*}\s*from\b/.test(line)) expect(line).not.toMatch(FORBIDDEN);
    }
    expect(source).not.toMatch(/import\(\s*["'][^"']*(reminder\/reminder|app-message|templates)/);
  });

  it("the detector itself catches a bad import", () => {
    expect('import { x } from "@/lib/reminder/reminder";').toMatch(FORBIDDEN);
    expect('import app from "@/lib/reminder/templates.app.json";').toMatch(FORBIDDEN);
    expect('import { x } from "@/lib/reminder-rules";').not.toMatch(FORBIDDEN);
  });

  it("reminder-rules and the board hold none of the banned number and date helpers", () => {
    const source = readFileSync(join(root, "src/lib/reminder-rules.ts"), "utf8");
    expect(source).not.toMatch(/parseFloat|toFixed|Math\.round|Intl\.|getHours|getDate|getMonth|toLocale/);
  });
});
