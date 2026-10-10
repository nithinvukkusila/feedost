// Sorting, searching, filtering and totalling the roster (spec R1-3, criteria 6 to 8, 14, 39 and 47).
// Pure: no React, no network. A tutor has tens of students, so all of it runs on the phone over the
// one list that was read. Money stays integer paise; sums are integer sums.
import type { Batch } from "./batches";
import { digitsOf, latinDigits, nationalDigits } from "./phone";
import { tidy } from "./profile";
import type { Student } from "./students";

/** The batch filter: every student, those with no batch, or one batch by id. */
export type BatchFilterValue = "all" | "none" | (string & {});

export const activeStudents = (list: readonly Student[]): Student[] => list.filter((student) => student.active);
export const archivedStudents = (list: readonly Student[]): Student[] => list.filter((student) => !student.active);

/** By name, case-insensitive, by character code (no locale rules, so every phone orders alike). Equal names keep a stable order by id. */
export function sortStudents(list: readonly Student[]): Student[] {
  return [...list].sort((a, b) => {
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** By name, as sortStudents does. */
export function sortBatches(list: readonly Batch[]): Batch[] {
  return [...list].sort((a, b) => {
    const x = a.name.toLowerCase();
    const y = b.name.toLowerCase();
    if (x !== y) return x < y ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// A search made only of digits and the marks a number is written with is a search for a phone number.
const NUMBER_SEARCH = /^[+\d\s().-]*\d[+\d\s().-]*$/;

/**
 * Students whose name or parent's name holds the text (any script, any letter case), or whose phone
 * holds the digits when the text is only digits. White space only means no filter. `+91` typed in front
 * of a number is ignored, so `+91 98860` finds `+91 98860 44321`.
 */
export function searchStudents(list: readonly Student[], text: string): Student[] {
  const needle = tidy(text).toLowerCase();
  if (needle === "") return [...list];
  const numeric = NUMBER_SEARCH.test(latinDigits(needle));
  const digits = numeric ? digitsOf(needle.startsWith("+91") ? needle.slice(3) : needle) : "";
  return list.filter(
    (student) =>
      student.name.toLowerCase().includes(needle) ||
      (student.parentName?.toLowerCase().includes(needle) ?? false) ||
      (digits !== "" && nationalDigits(student.parentPhone).includes(digits)),
  );
}

export function filterByBatch(list: readonly Student[], filter: BatchFilterValue): Student[] {
  if (filter === "all") return [...list];
  if (filter === "none") return list.filter((student) => student.batchId === null);
  return list.filter((student) => student.batchId === filter);
}

export type BatchCounts = { all: number; none: number; byBatch: Record<string, number> };

/** How many of these students are in each batch. Pass the active students. A student whose batch is not in `batches` counts as having none. */
export function batchCounts(list: readonly Student[], batches: readonly Batch[]): BatchCounts {
  const known = new Set(batches.map((batch) => batch.id));
  const byBatch: Record<string, number> = Object.fromEntries(batches.map((batch) => [batch.id, 0]));
  let none = 0;
  for (const student of list) {
    if (student.batchId !== null && known.has(student.batchId)) byBatch[student.batchId] += 1;
    else none += 1;
  }
  return { all: list.length, none, byBatch };
}

/** The sum of the monthly fees of these students, in paise. */
export function monthlyTotal(list: readonly Student[]): number {
  return list.reduce((sum, student) => sum + student.monthlyFee, 0);
}

/** A batch's number of students and monthly total. Archived students do not count; they stay in the batch. */
export function batchSummary(students: readonly Student[], batchId: string): { count: number; total: number } {
  const inBatch = students.filter((student) => student.active && student.batchId === batchId);
  return { count: inBatch.length, total: monthlyTotal(inBatch) };
}
