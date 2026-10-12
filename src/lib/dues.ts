// The dues the signed-in tutor is owed: read them, and ask the database to make any that are missing.
// The one place that talks to the `dues` table, and it only reads it: a client has no write on dues, and
// the one call that is not a read is `ensure_my_dues`, which takes no argument and acts for the signed-in
// tutor only (spec R1-6, decision 13). Components never call `.from(...)` or `.rpc(...)`.
//
// Named columns, never `*`, and `tutor_id` is never asked for. Money is integer paise. A row the app does
// not understand fails the whole read: better an error than a wrong amount on a money screen.
import { getClient } from "./supabase";
import { classifyLoadFailure, type TutorLoadKind } from "./tutor";

export type DueKind = "monthly" | "opening";
export type DueStatus = "due" | "partial" | "paid";

/** A fee as the app holds it. `month` is the first of the month (`YYYY-MM-01`) and null for an opening balance. */
export type Due = {
  id: string;
  studentId: string;
  kind: DueKind;
  month: string | null;
  amount: number;
  amountPaid: number;
  status: DueStatus;
  /** A calendar day, `YYYY-MM-DD`. */
  dueDate: string;
};

export const DUE_COLUMNS = "id,student_id,kind,month,amount,amount_paid,status,due_date";

/** Why the dues could not be read. `kind` as for the roster: a refused session, or anything else. */
export class DuesLoadError extends Error {
  readonly kind: TutorLoadKind;
  constructor(kind: TutorLoadKind = "failed") {
    super("The dues could not be loaded");
    this.name = "DuesLoadError";
    this.kind = kind;
  }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_START = /^\d{4}-\d{2}-01$/;
const isPaise = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

/** A due from a database row. Throws DuesLoadError for a row that cannot be right. */
export function dueFromRow(row: unknown): Due {
  const r = (typeof row === "object" && row !== null ? row : {}) as Record<string, unknown>;
  const { id, student_id: studentId, kind, month, amount, amount_paid: amountPaid, status, due_date: dueDate } = r;
  const ok =
    typeof id === "string" &&
    typeof studentId === "string" &&
    (kind === "monthly" || kind === "opening") &&
    (kind === "opening" ? month === null : typeof month === "string" && MONTH_START.test(month)) &&
    isPaise(amount) &&
    amount > 0 &&
    isPaise(amountPaid) &&
    amountPaid <= amount &&
    (status === "due" || status === "partial" || status === "paid") &&
    typeof dueDate === "string" &&
    DAY.test(dueDate);
  if (!ok) throw new DuesLoadError();
  return { id, studentId, kind, month: month as string | null, amount, amountPaid, status, dueDate };
}

// The server's own cap on rows per answer (`max_rows` in supabase/config.toml; 1,000 on the hosted default).
// Lowering max_rows there means lowering this number.
const PAGE = 1000;

type Which = { month: string } | { unpaid: true };

// Reads every matching due, a page at a time, in a total order (`due_date, id`) so no row repeats or is
// skipped across pages. A failed page fails the whole read: nothing partial is returned.
async function readAll(which: Which): Promise<Due[]> {
  let client;
  try {
    client = await getClient();
  } catch {
    throw new DuesLoadError();
  }
  const out: Due[] = [];
  for (let from = 0; ; from += PAGE) {
    let result;
    try {
      const base = client.from("dues").select(DUE_COLUMNS);
      const filtered = "month" in which ? base.eq("month", which.month) : base.neq("status", "paid");
      result = await filtered.order("due_date").order("id").range(from, from + PAGE - 1);
    } catch {
      throw new DuesLoadError();
    }
    if (result.error) throw new DuesLoadError(classifyLoadFailure({ status: result.status, code: result.error.code }));
    const rows = (result.data as unknown[] | null) ?? [];
    for (const row of rows) out.push(dueFromRow(row));
    if (rows.length < PAGE) return out;
  }
}

/** Every due of one month (`YYYY-MM-01`). */
export const readMonth = (month: string): Promise<Due[]> => readAll({ month });

/** Every due not yet paid, of any month, opening balances included. */
export const readUnpaid = (): Promise<Due[]> => readAll({ unpaid: true });

/** The first month that has a monthly due, or null when there is none. */
export async function readEarliestMonth(): Promise<string | null> {
  let result;
  try {
    const client = await getClient();
    result = await client.from("dues").select("month").not("month", "is", null).order("month").limit(1);
  } catch {
    throw new DuesLoadError();
  }
  if (result.error) throw new DuesLoadError(classifyLoadFailure({ status: result.status, code: result.error.code }));
  const first = ((result.data as { month?: unknown }[] | null) ?? [])[0]?.month;
  if (first === undefined) return null;
  if (typeof first !== "string" || !MONTH_START.test(first)) throw new DuesLoadError();
  return first;
}

/**
 * Asks the database to create any due that is missing for the signed-in tutor, and answers how many it
 * made. Never throws: any failure, or an answer that is not a whole number, is 0. The board never waits
 * for it and shows nothing about it.
 */
export async function ensureMyDues(): Promise<number> {
  try {
    const client = await getClient();
    const { data, error } = await client.rpc("ensure_my_dues");
    if (error) return 0;
    return typeof data === "number" && Number.isSafeInteger(data) && data > 0 ? data : 0;
  } catch {
    return 0;
  }
}

/** One fee by its id, or null when there is none (or it is not this tutor's: row-level security shows nothing). */
export async function readDue(id: string): Promise<Due | null> {
  let result;
  try {
    const client = await getClient();
    result = await client.from("dues").select(DUE_COLUMNS).eq("id", id).limit(1);
  } catch {
    throw new DuesLoadError();
  }
  if (result.error) throw new DuesLoadError(classifyLoadFailure({ status: result.status, code: result.error.code }));
  const first = ((result.data as unknown[] | null) ?? [])[0];
  return first === undefined ? null : dueFromRow(first);
}

/** The id of this student's earlier-balance due, or null when there is none. Throws when it cannot be read. */
export async function readOpeningDueId(studentId: string): Promise<string | null> {
  const client = await getClient();
  const { data, error } = await client.from("dues").select("id").eq("student_id", studentId).eq("kind", "opening").limit(1);
  if (error) throw new DuesLoadError();
  const id = ((data as { id?: unknown }[] | null) ?? [])[0]?.id;
  if (id === undefined) return null;
  if (typeof id !== "string") throw new DuesLoadError();
  return id;
}
