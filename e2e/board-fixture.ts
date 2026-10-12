// The tutor, students and fees the dues board specs share. Today is 12 October 2026, 10:30 in India.
// Test code only.
import type { Page } from "@playwright/test";
import { completeTutor, fakeSession, seedSession, stubSupabase, type Stub } from "./auth-helpers";
import { stubDues, type DueRow, type Dues } from "./dues-helpers";
import { stubRoster, type BatchRow, type Roster, type StudentRow } from "./roster-helpers";

/** 05:00 UTC is 10:30 on 12 Oct in India, and 22:00 on 11 Oct in Los Angeles. */
export const NOW = new Date("2026-10-12T05:00:00Z");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const MATHS = id(0xb1);
export const SCIENCE = id(0xb2);
export const S = { ravi: id(0xc1), asha: id(0xc2), meena: id(0xc3), dev: id(0xc4), imran: id(0xc5), old: id(0xc6) };

export const BATCHES: Partial<BatchRow>[] = [
  { id: MATHS, name: "Class 10 Maths" },
  { id: SCIENCE, name: "Class 8 Science" },
];

export const STUDENTS: Partial<StudentRow>[] = [
  { id: S.ravi, name: "Ravi Kumar", batch_id: MATHS, monthly_fee: 120000, due_day: 5 },
  { id: S.asha, name: "Asha Rao", batch_id: SCIENCE, monthly_fee: 150000, due_day: 12 },
  { id: S.meena, name: "Meena Shetty", monthly_fee: 100000, due_day: 20 },
  { id: S.dev, name: "Dev Patil", batch_id: MATHS, monthly_fee: 100000, due_day: 1 },
  { id: S.imran, name: "Imran Ali", monthly_fee: 100000, due_day: 7 },
  { id: S.old, name: "Old Student", monthly_fee: 90000, active: false },
];

type Due = Partial<DueRow> & { student_id: string };
const opening = (student_id: string, amount: number): Due => ({ student_id, kind: "opening", month: null, amount, due_date: "2026-09-30" });

/**
 * Overdue: Meena's earlier balance (₹2,400), Ravi's September fee (37 days), Ravi's October (7), Imran's
 * October with ₹500 paid (5). Due: Asha today, Meena on the 20th. Paid: Dev. Pending 7,800; collected 1,500.
 * Old Student is archived and has a fee that must never show.
 */
export const DUES: Due[] = [
  { student_id: S.ravi, due_date: "2026-10-05", amount: 120000 },
  { student_id: S.asha, due_date: "2026-10-12", amount: 150000 },
  { student_id: S.meena, due_date: "2026-10-20", amount: 100000 },
  { student_id: S.dev, due_date: "2026-10-01", amount: 100000, amount_paid: 100000, status: "paid" },
  { student_id: S.imran, due_date: "2026-10-07", amount: 100000, amount_paid: 50000, status: "partial" },
  { student_id: S.ravi, month: "2026-09-01", due_date: "2026-09-05", amount: 120000 },
  { student_id: S.asha, month: "2026-09-01", due_date: "2026-09-12", amount: 150000, amount_paid: 150000, status: "paid" },
  { student_id: S.old, due_date: "2026-10-05", amount: 90000 },
  opening(S.meena, 240000),
];

export type Seed = { students?: Partial<StudentRow>[]; batches?: Partial<BatchRow>[]; dues?: Due[]; lang?: string; clock?: Date | null };
export type Signed = { stub: Stub; roster: Roster; dues: Dues };

/** A signed-in tutor with a finished profile, a fixed clock and these rows in the tables. */
export async function signedIn(page: Page, seed: Seed = {}): Promise<Signed> {
  const stub = await stubSupabase(page, { tutor: completeTutor({ language: seed.lang ?? "en" }) });
  const roster = await stubRoster(page, { students: seed.students ?? STUDENTS, batches: seed.batches ?? BATCHES });
  const dues = await stubDues(page, seed.dues ?? DUES);
  // A made-up token lasts an hour from the real clock; the fixed clock must not outlive it.
  await seedSession(page, fakeSession("meena@example.com", 30 * 86400));
  if (seed.clock !== null) await page.clock.setFixedTime(seed.clock ?? NOW);
  return { stub, roster, dues };
}
