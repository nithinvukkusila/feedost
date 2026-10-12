// The dues board's arithmetic (spec R1-6, criteria 1 to 8): the India day, what state a due is in, which
// dues a month's view holds, their order and their totals. Pure: no React, no network, no `Date`, no
// `Intl`. Days are `YYYY-MM-DD` text and months are the first of the month, `YYYY-MM-01`; all day
// arithmetic is on whole numbers of days, so no phone's time zone or ICU data can change an answer.
// Money stays integer paise; every sum is an integer sum.
import type { Due } from "./dues";
import type { BatchFilterValue } from "./student-list";
import type { Student } from "./students";

export type Tab = "overdue" | "due" | "paid";
export type Mark = "overdue" | "due" | "part-paid" | "paid";
export type Block = "paid" | "due" | "overdue";

const DAY_MS = 86_400_000;
const INDIA_OFFSET_MS = 19_800_000; // UTC+5:30, no daylight saving
const pad = (n: number, width: number) => String(n).padStart(width, "0");

// Howard Hinnant's days-from-civil: whole days since 1970-01-01 for a date in the proleptic Gregorian calendar.
function dayNumber(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146_097 + doe - 719_468;
}

function civil(days: number): { year: number; month: number; day: number } {
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

function parts(day: string): { year: number; month: number; day: number } {
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)), day: Number(day.slice(8, 10)) };
}

const numberOf = (day: string) => {
  const p = parts(day);
  return dayNumber(p.year, p.month, p.day);
};

/** The calendar day in India for this instant (milliseconds since 1970), as `YYYY-MM-DD`. Floor, so instants before 1970 are right. */
export function indiaToday(nowMs: number): string {
  const { year, month, day } = civil(Math.floor((nowMs + INDIA_OFFSET_MS) / DAY_MS));
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Whole days from `a` to `b` (b minus a). */
export function daysBetween(a: string, b: string): number {
  return numberOf(b) - numberOf(a);
}

/** The first day of the month that `day` is in. */
export function currentMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function monthParts(month: string): { year: number; month: number } {
  const { year, month: m } = parts(month);
  return { year, month: m };
}

/** The first of the month `delta` months from `month`. */
export function shiftMonth(month: string, delta: number): string {
  const { year, month: m } = parts(month);
  const index = year * 12 + (m - 1) + delta;
  const y = Math.floor(index / 12);
  return `${pad(y, 4)}-${pad(index - y * 12 + 1, 2)}-01`;
}

export type DueState = { tab: Tab; tag: Mark; daysLate: number | null; isToday: boolean };

/** What the board says about a due on `today`. Overdue is never stored: it is worked out here. */
export function dueState(due: Due, today: string): DueState {
  if (due.status === "paid") return { tab: "paid", tag: "paid", daysLate: null, isToday: false };
  // An earlier balance is late from the start, and has no day count.
  if (due.kind === "opening") return { tab: "overdue", tag: "overdue", daysLate: null, isToday: false };
  const late = daysBetween(due.dueDate, today);
  if (late > 0) return { tab: "overdue", tag: "overdue", daysLate: late, isToday: false };
  return { tab: "due", tag: due.status === "partial" ? "part-paid" : "due", daysLate: 0, isToday: late === 0 };
}

/** What is still owed on a due, in paise. */
export const remaining = (due: Due): number => due.amount - due.amountPaid;

export type Row = { due: Due; student: Student; state: DueState };

export type BoardView = {
  rows: Row[];
  tabs: Record<Tab, Row[]>;
  counts: Record<Tab, number>;
  /** Paise still to come in. */
  pending: number;
  /** Paise paid on this month's own dues. */
  collected: number;
  /** Students with something unpaid. */
  students: number;
  /** Students with any row. */
  studentsInView: number;
  /** One per student in view, paid first, then due, then overdue. */
  blocks: Block[];
  legend: Record<Block, number>;
  /** Ids of students that a due names and the roster does not hold. */
  missing: string[];
};

const nameOf = (row: Row) => row.student.name.toLowerCase();

// By lower-case name as sortStudents does, then by the due's id, so the order never flickers.
function byNameThenId(a: Row, b: Row): number {
  const x = nameOf(a);
  const y = nameOf(b);
  if (x !== y) return x < y ? -1 : 1;
  return a.due.id < b.due.id ? -1 : a.due.id > b.due.id ? 1 : 0;
}

function overdueOrder(a: Row, b: Row): number {
  const x = a.state.daysLate;
  const y = b.state.daysLate;
  if (x === null && y !== null) return -1;
  if (x !== null && y === null) return 1;
  if (x !== null && y !== null && x !== y) return y - x;
  return byNameThenId(a, b);
}

function dueOrder(a: Row, b: Row): number {
  if (a.due.dueDate !== b.due.dueDate) return a.due.dueDate < b.due.dueDate ? -1 : 1;
  return byNameThenId(a, b);
}

const orders: Record<Tab, (a: Row, b: Row) => number> = { overdue: overdueOrder, due: dueOrder, paid: byNameThenId };

function inFilter(student: Student, filter: BatchFilterValue): boolean {
  if (filter === "all") return true;
  if (filter === "none") return student.batchId === null;
  return student.batchId === filter;
}

/** Whether a due belongs in the view of `month`: its own month's dues, and, in the current month, every unpaid earlier one. */
function belongs(due: Due, month: string, today: string): boolean {
  if (due.kind === "monthly" && due.month === month) return true;
  if (month !== currentMonth(today) || due.status === "paid") return false;
  return due.kind === "opening" || (due.month !== null && due.month < month);
}

/**
 * The view of one month. `dues` is what was read (this month's, plus the unpaid ones for the current
 * month); `students` is the whole roster, archived included; `filter` is the batch filter already made
 * effective. A due of an archived student is left out of everything; a due of a student the roster does
 * not hold is left out and its student's id is returned in `missing`.
 */
export function boardView(dues: readonly Due[], students: readonly Student[], month: string, today: string, filter: BatchFilterValue): BoardView {
  const byId = new Map(students.map((student) => [student.id, student]));
  const seen = new Set<string>();
  const missing = new Set<string>();
  const rows: Row[] = [];

  for (const due of dues) {
    if (seen.has(due.id) || !belongs(due, month, today)) continue;
    seen.add(due.id);
    const student = byId.get(due.studentId);
    if (student === undefined) {
      missing.add(due.studentId);
      continue;
    }
    if (!student.active || !inFilter(student, filter)) continue;
    rows.push({ due, student, state: dueState(due, today) });
  }

  const tabs: Record<Tab, Row[]> = {
    overdue: rows.filter((row) => row.state.tab === "overdue").sort(orders.overdue),
    due: rows.filter((row) => row.state.tab === "due").sort(orders.due),
    paid: rows.filter((row) => row.state.tab === "paid").sort(orders.paid),
  };
  // `rows` is the three tabs in order, so it never depends on the order the dues were read in.
  const sorted = [...tabs.overdue, ...tabs.due, ...tabs.paid];

  let pending = 0;
  let collected = 0;
  const kinds = new Map<string, Block>();
  const owing = new Set<string>();
  for (const row of rows) {
    if (row.state.tab !== "paid") {
      pending += remaining(row.due);
      owing.add(row.student.id);
    }
    if (row.due.kind === "monthly" && row.due.month === month) collected += row.due.amountPaid;
    const before = kinds.get(row.student.id);
    const here: Block = row.state.tab;
    kinds.set(row.student.id, before === "overdue" || here === "overdue" ? "overdue" : before === "due" || here === "due" ? "due" : "paid");
  }

  const legend: Record<Block, number> = { paid: 0, due: 0, overdue: 0 };
  for (const kind of kinds.values()) legend[kind] += 1;
  const blocks: Block[] = [
    ...Array<Block>(legend.paid).fill("paid"),
    ...Array<Block>(legend.due).fill("due"),
    ...Array<Block>(legend.overdue).fill("overdue"),
  ];

  return {
    rows: sorted,
    tabs,
    counts: { overdue: tabs.overdue.length, due: tabs.due.length, paid: tabs.paid.length },
    pending,
    collected,
    students: owing.size,
    studentsInView: kinds.size,
    blocks,
    legend,
    missing: [...missing],
  };
}

/** The tab to open on: Overdue if it has rows, else Due, else Paid; Overdue when there is nothing at all. */
export function defaultTab(counts: Record<Tab, number>): Tab {
  if (counts.overdue > 0) return "overdue";
  if (counts.due > 0) return "due";
  if (counts.paid > 0) return "paid";
  return "overdue";
}

/** Whether the month buttons work. `earliest` is the first month that has a monthly due, or null when there is none. */
export function monthMoves(month: string, earliest: string | null, today: string): { prev: boolean; next: boolean } {
  if (earliest === null) return { prev: false, next: false };
  return { prev: month > earliest, next: month < currentMonth(today) };
}

/** A month read is reused for this long. */
export const FRESH_MS = 60_000;

/** True when a cached read is missing or older than a minute (or from the future, which a changed clock can cause). */
export function needsRead(slice: { at: number } | null | undefined, nowMs: number): boolean {
  if (slice === null || slice === undefined) return true;
  const age = nowMs - slice.at;
  return age < 0 || age > FRESH_MS;
}
