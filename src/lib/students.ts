// The tutor's students: read them, add one, change one, archive, move. The one place that talks to the
// `students` table. Direct, online-only calls, a recorded exception to "writes go through the outbox"
// (spec R1-3, decision 4): the outbox arrives in R1-12 and swaps the write functions here. Components
// never call `.from(...)`.
//
// Only the columns the database grants are ever sent, `tutor_id` never (the database fills it from the
// session), and `pay_token` is never read here (the Remind screen reads it with `pay-tokens.ts`; the roster does not). Every single-row write ends in `.select().single()`, so an
// update that changed no row is an error, not silence.
import { isLocale, type Locale } from "@/config/locales";
import { getClient } from "./supabase";
import { classifyLoadFailure, type TutorLoadKind } from "./tutor";

/** A student as the app holds them. Money is integer paise. */
export type Student = {
  id: string;
  batchId: string | null;
  name: string;
  parentName: string | null;
  parentPhone: string | null;
  parentLanguage: Locale;
  monthlyFee: number;
  openingBalance: number;
  dueDay: number;
  active: boolean;
};

/** What the form gives: everything of a student that the tutor types or picks, cleaned. */
export type StudentFields = Omit<Student, "id" | "active">;

type Row = {
  id: string;
  batch_id: string | null;
  name: string;
  parent_name: string | null;
  parent_phone: string | null;
  parent_language: string;
  monthly_fee: number;
  opening_balance: number;
  due_day: number;
  active: boolean;
};

/** Named, never `*`: `pay_token` must not reach this app's memory. */
export const STUDENT_COLUMNS = "id,batch_id,name,parent_name,parent_phone,parent_language,monthly_fee,opening_balance,due_day,active";

export function studentFromRow(row: Row): Student {
  return {
    id: row.id,
    batchId: row.batch_id,
    name: row.name,
    parentName: row.parent_name,
    parentPhone: row.parent_phone,
    parentLanguage: isLocale(row.parent_language) ? row.parent_language : "en",
    monthlyFee: row.monthly_fee,
    openingBalance: row.opening_balance,
    dueDay: row.due_day,
    active: row.active,
  };
}

/** Why the roster could not be read. `kind` as for the tutor's row: a refused session, or anything else. */
export class RosterLoadError extends Error {
  readonly kind: TutorLoadKind;
  constructor(kind: TutorLoadKind = "failed") {
    super("The roster could not be loaded");
    this.name = "RosterLoadError";
    this.kind = kind;
  }
}

/** Every student of the signed-in tutor, archived ones too. Row-level security keeps every other tutor's out. */
export async function listStudents(): Promise<Student[]> {
  let result;
  try {
    const client = await getClient();
    result = await client.from("students").select(STUDENT_COLUMNS);
  } catch {
    throw new RosterLoadError();
  }
  if (result.error) throw new RosterLoadError(classifyLoadFailure({ status: result.status, code: result.error.code }));
  return ((result.data as Row[] | null) ?? []).map(studentFromRow);
}

/**
 * `failed`: nothing was saved (network, server, no session). `offline`: the phone says it has no
 * network, so nothing was sent. `missing`: the call worked but there is no such row. `batch-gone`: the
 * batch named was deleted (a foreign-key failure).
 */
export type WriteFailure = "failed" | "offline" | "missing" | "batch-gone";
export type StudentResult = { ok: true; student: Student } | { ok: false; reason: WriteFailure };
export type StudentsResult = { ok: true; students: Student[] } | { ok: false; reason: WriteFailure };

// PostgREST says this when `.single()` finds no row, which is what an update that changed nothing looks like.
const NO_ROW = "PGRST116";
const FOREIGN_KEY = "23503";
const DUPLICATE = "23505";

/** True when the phone itself says it has no network. A write is not even tried then. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function failureOf(error: { code?: string }): WriteFailure {
  if (error.code === NO_ROW) return "missing";
  if (error.code === FOREIGN_KEY) return "batch-gone";
  return "failed";
}

/** The ten columns an insert may carry. `tutor_id`, `pay_token`, `created_at` and `updated_at` are not among them. */
export function insertBody(id: string, fields: StudentFields): Record<string, unknown> {
  return {
    id,
    batch_id: fields.batchId,
    name: fields.name,
    parent_name: fields.parentName,
    parent_phone: fields.parentPhone,
    parent_language: fields.parentLanguage,
    monthly_fee: fields.monthlyFee,
    opening_balance: fields.openingBalance,
    due_day: fields.dueDay,
    active: true,
  };
}

/** A change to a student: any of the form's fields, and `active`. */
export type StudentPatch = Partial<StudentFields & { active: boolean }>;

/** The columns an update may carry, and only those present in the patch. Anything else in the object is dropped. */
export function updateBody(patch: StudentPatch): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (patch.batchId !== undefined) body.batch_id = patch.batchId;
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.parentName !== undefined) body.parent_name = patch.parentName;
  if (patch.parentPhone !== undefined) body.parent_phone = patch.parentPhone;
  if (patch.parentLanguage !== undefined) body.parent_language = patch.parentLanguage;
  if (patch.monthlyFee !== undefined) body.monthly_fee = patch.monthlyFee;
  if (patch.openingBalance !== undefined) body.opening_balance = patch.openingBalance;
  if (patch.dueDay !== undefined) body.due_day = patch.dueDay;
  if (patch.active !== undefined) body.active = patch.active;
  return body;
}

/**
 * Adds a student. `id` is made by the screen once per form fill, so a double tap or a retry cannot make
 * two rows: when the database says the id exists, the row is read back and counted as saved.
 */
export async function createStudent(id: string, fields: StudentFields): Promise<StudentResult> {
  if (isOffline()) return { ok: false, reason: "offline" };
  try {
    const client = await getClient();
    const { data, error } = await client.from("students").insert(insertBody(id, fields)).select(STUDENT_COLUMNS).single<Row>();
    if (!error) return { ok: true, student: studentFromRow(data) };
    if (error.code === DUPLICATE) return readOne(id);
    return { ok: false, reason: failureOf(error) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** The row for `id`, for "already saved: read it back". */
async function readOne(id: string): Promise<StudentResult> {
  try {
    const client = await getClient();
    const { data, error } = await client.from("students").select(STUDENT_COLUMNS).eq("id", id).single<Row>();
    if (error) return { ok: false, reason: failureOf(error) };
    return { ok: true, student: studentFromRow(data) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Changes the named columns of one student. An empty patch sends nothing and is not this function's to be asked. */
export async function updateStudent(id: string, patch: StudentPatch): Promise<StudentResult> {
  if (isOffline()) return { ok: false, reason: "offline" };
  try {
    const client = await getClient();
    const { data, error } = await client.from("students").update(updateBody(patch)).eq("id", id).select(STUDENT_COLUMNS).single<Row>();
    if (error) return { ok: false, reason: failureOf(error) };
    return { ok: true, student: studentFromRow(data) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Archive (`false`) or restore (`true`). The row, its token and its history stay. */
export function setActive(id: string, active: boolean): Promise<StudentResult> {
  return updateStudent(id, { active });
}

/** How many ids go in one request: the ids sit in the address, which has a length limit. */
export const MOVE_CHUNK = 100;

/**
 * Puts these students in a batch, or in none (`null`). At most MOVE_CHUNK ids per request. When a request
 * fails, or answers with fewer rows than it was asked to change (a student archived-and-removed elsewhere, or
 * not the tutor's), the move is reported as failed: some earlier students may already have moved, so the
 * caller re-reads the roster.
 */
export async function moveStudents(ids: readonly string[], batchId: string | null): Promise<StudentsResult> {
  if (isOffline()) return { ok: false, reason: "offline" };
  if (ids.length === 0) return { ok: true, students: [] };
  const moved: Student[] = [];
  try {
    const client = await getClient();
    for (let at = 0; at < ids.length; at += MOVE_CHUNK) {
      const chunk = ids.slice(at, at + MOVE_CHUNK);
      const { data, error } = await client.from("students").update({ batch_id: batchId }).in("id", chunk).select(STUDENT_COLUMNS);
      if (error) return { ok: false, reason: failureOf(error) };
      const rows = ((data as Row[] | null) ?? []).map(studentFromRow);
      if (rows.length < chunk.length) return { ok: false, reason: "failed" };
      moved.push(...rows);
    }
    return { ok: true, students: moved };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
