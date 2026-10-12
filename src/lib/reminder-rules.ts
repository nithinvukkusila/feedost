// The reminder rules the board and the Remind screen share (spec R1-8, criteria 1, 21 to 23, 25, 27).
// Pure and small: no React, no network, no `Date`, no `Intl`. The board imports this file, so it must
// never import `reminder/reminder.ts`, `reminder/app-message.ts` or a template file (they are the
// screen's; a test checks the boundary). Two patterns are therefore copies of the ones in reminder.ts,
// and a test checks they are the same.
import type { Locale } from "@/config/locales";
import { daysBetween, indiaToday, remaining, type Row } from "./dues-board";
import type { DueKind, DueStatus } from "./dues";
import { indiaClock } from "./payments-view";

/** Same as `UPI_ID` in reminder.ts. */
export const UPI_PATTERN = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;
/** Same as `PHONE_E164` in reminder.ts. */
export const PHONE_PATTERN = /^\+91[0-9]{10}$/;

export type Tone = "polite" | "firm";
export type MessageKind = "month" | "balance";
export type CannotReason = "paid" | "archived" | "noPhone" | "noUpi";
export type CanRemind = { ok: true } | { ok: false; reason: CannotReason };

/** The first reason a fee cannot be reminded, in the order paid, archived, noPhone, noUpi. */
export function canRemind(
  due: { status: DueStatus },
  student: { active: boolean; parentPhone: string | null },
  tutor: { upiId: string | null; name: string | null },
): CanRemind {
  if (due.status === "paid") return { ok: false, reason: "paid" };
  if (!student.active) return { ok: false, reason: "archived" };
  if (student.parentPhone === null || !PHONE_PATTERN.test(student.parentPhone)) return { ok: false, reason: "noPhone" };
  // The tutor's name is the payee name of the link (question 9), so a missing name counts as no UPI ID.
  if (tutor.upiId === null || !UPI_PATTERN.test(tutor.upiId) || tutor.name === null || tutor.name.trim() === "") {
    return { ok: false, reason: "noUpi" };
  }
  return { ok: true };
}

/** The log tag, like `polite:hi:month`. */
export function templateTag(tone: Tone, locale: Locale, kind: MessageKind): string {
  return `${tone}:${locale}:${kind}`;
}
/** What the database accepts as a tag. */
export const TEMPLATE_TAG = /^(polite|firm):(en|hi|kn|te):(month|balance)$/;

/** True when the last reminder and `nowMs` fall on the same India day. Both are milliseconds since 1970. */
export function alreadyRemindedToday(lastSentMs: number, nowMs: number): boolean {
  return indiaToday(lastSentMs) === indiaToday(nowMs);
}

export type LastWords = { key: "today" | "yesterday" | "days" | "old"; n: number };
export const LAST_OLD_AFTER = 30;

/** How to say when the parent was last reminded: today, yesterday, n days ago (to 30), then "over 30". */
export function lastRemindedWords(lastSentMs: number, nowMs: number): LastWords {
  const days = daysBetween(indiaToday(lastSentMs), indiaToday(nowMs));
  if (days <= 0) return { key: "today", n: 0 };
  if (days === 1) return { key: "yesterday", n: 1 };
  if (days <= LAST_OLD_AFTER) return { key: "days", n: days };
  return { key: "old", n: days };
}

/** The India time of an instant in 12-hour form, 0-9 digits: `{ hour: 1..12, minute: "05", pm }`. The words am and pm are the screen's. */
export function indiaClock12(ms: number): { hour: number; minute: string; pm: boolean } {
  const [h, m] = indiaClock(ms).split(":");
  const hour24 = Number(h);
  return { hour: hour24 % 12 === 0 ? 12 : hour24 % 12, minute: m, pm: hour24 >= 12 };
}

// ---------------------------------------------------------------------------------------------
// The queue: what the Remind screen holds in memory (spec R1-8, criterion 13 and plan section 6).

export type QueueItem = {
  dueId: string;
  studentId: string;
  studentName: string;
  parentName: string | null;
  parentPhone: string;
  parentLanguage: Locale;
  batchName: string | null;
  month: string | null;
  kind: DueKind;
  /** Null for an earlier balance. */
  daysLate: number | null;
  /** What is still owed, paise. */
  remaining: number;
  dueDate: string;
};

/** A snapshot of a row at the moment of the tap. Throws when the student has no phone; `canRemind` stops that first. */
export function queueItem(row: Row, batchName: string | null): QueueItem {
  const { due, student, state } = row;
  if (student.parentPhone === null) throw new RangeError("queueItem needs a student with a phone");
  return {
    dueId: due.id,
    studentId: student.id,
    studentName: student.name,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    parentLanguage: student.parentLanguage,
    batchName,
    month: due.month,
    kind: due.kind,
    daysLate: state.daysLate,
    remaining: remaining(due),
    dueDate: due.dueDate,
  };
}

// ---------------------------------------------------------------------------------------------
// Bulk: "Remind all overdue" (criteria 21 to 23, edge case "two overdue fees for one student").

/** Above this many ticked parents the pick list shows its soft note. It never blocks. */
export const BULK_NOTE_ABOVE = 20;

export type PickRow = {
  row: Row;
  /** Other overdue fees of the same student that can be reminded; they have their own Remind. */
  more: number;
  remindedToday: boolean;
  /** Starts ticked: everyone except rows reminded today. */
  ticked: boolean;
};
export type CannotRow = { student: Row["student"]; reason: "noPhone" | "noUpi"; dueIds: string[] };
export type Pick = { items: PickRow[]; cannot: CannotRow[] };

const oldestFirst = (a: Row, b: Row) =>
  a.due.dueDate !== b.due.dueDate ? (a.due.dueDate < b.due.dueDate ? -1 : 1) : a.due.id < b.due.id ? -1 : a.due.id > b.due.id ? 1 : 0;

/**
 * The pick list from the Overdue rows in view (the batch filter has already narrowed them). One item per
 * student, for the oldest remindable overdue fee. A student who cannot be reminded goes to `cannot`, once,
 * with the reason. Only Overdue rows count; Due rows are reminded one at a time.
 */
export function pickList(
  rows: readonly Row[],
  tutor: { upiId: string | null; name: string | null },
  lastByDue: Readonly<Record<string, { lastAt: number }>>,
  nowMs: number,
): Pick {
  const byStudent = new Map<string, Row[]>();
  for (const row of rows) {
    if (row.state.tab !== "overdue") continue;
    const list = byStudent.get(row.student.id);
    if (list) list.push(row);
    else byStudent.set(row.student.id, [row]);
  }
  const items: PickRow[] = [];
  const cannot: CannotRow[] = [];
  for (const list of byStudent.values()) {
    list.sort(oldestFirst);
    const ok: Row[] = [];
    let blocked: "noPhone" | "noUpi" | null = null;
    for (const row of list) {
      const result = canRemind(row.due, row.student, tutor);
      if (result.ok) ok.push(row);
      else if (result.reason === "noPhone" || result.reason === "noUpi") blocked = result.reason;
    }
    if (ok.length > 0) {
      const chosen = ok[0];
      const last = lastByDue[chosen.due.id];
      const remindedToday = last !== undefined && alreadyRemindedToday(last.lastAt, nowMs);
      items.push({ row: chosen, more: ok.length - 1, remindedToday, ticked: !remindedToday });
    } else if (blocked !== null) {
      cannot.push({ student: list[0].student, reason: blocked, dueIds: list.map((r) => r.due.id) });
    }
  }
  const byOldest = (a: Row, b: Row) => oldestFirst(a, b) || (a.student.name < b.student.name ? -1 : 1);
  items.sort((a, b) => byOldest(a.row, b.row));
  cannot.sort((a, b) => (a.student.name < b.student.name ? -1 : a.student.name > b.student.name ? 1 : 0));
  return { items, cannot };
}

/** Whether the soft "that is a lot at once" note shows for this many ticked parents. */
export const showManyNote = (ticked: number): boolean => ticked > BULK_NOTE_ABOVE;

/** The queue for the ticked students, in the order the list shows them. */
export function queueFromPick(items: readonly PickRow[], tickedIds: ReadonlySet<string>, batchNameOf: (batchId: string | null) => string | null): QueueItem[] {
  return items.filter((item) => tickedIds.has(item.row.student.id)).map((item) => queueItem(item.row, batchNameOf(item.row.student.batchId)));
}
