// Reminders the signed-in tutor has opened WhatsApp for: log one, read when each fee was last reminded
// (spec R1-8, criteria 24, 28 and 29). The only file that calls `record_reminder` or `last_reminders`
// (supabase/migrations/20261012150000_r1_reminders.sql holds their contract). A client has no write on
// the `reminders` table; the function is the only way a row is made.
//
// What is sent is a fee id, a template tag like `polite:hi:month` and a request id. Never a name, a
// phone number, the message or an amount. The request id is made once per step on the Remind screen and
// sent again on every retry, so a double tap or a lost answer never logs twice. R1-12's outbox will take
// over this call and reuse this argument shape: `{ dueId, template, requestId }`.
//
// This file is in the board's first load (the board reads the marks), so it imports nothing heavy and
// never `reminder/reminder.ts` or a template file.
import { getClient } from "./supabase";
import { isOffline } from "./students";
import { TEMPLATE_TAG } from "./reminder-rules";

/** When a fee was last reminded. `lastAt` is milliseconds since 1970; `times` is how many reminders the fee has had. */
export type LastReminder = { dueId: string; lastAt: number; times: number };

/** The words the database answers with (see the contract), and two of our own: the phone is offline, or anything else went wrong. */
export type ReminderErrorCode =
  | "not_signed_in"
  | "invalid_argument"
  | "due_not_found"
  | "already_paid"
  | "student_archived"
  | "no_phone"
  | "offline"
  | "failed";

const WORDS: readonly ReminderErrorCode[] = ["not_signed_in", "invalid_argument", "due_not_found", "already_paid", "student_archived", "no_phone"];

/** The refusals that mean the fee changed meanwhile, so trying again can never help. */
export const FINAL_REFUSALS: readonly ReminderErrorCode[] = ["invalid_argument", "due_not_found", "already_paid", "student_archived", "no_phone"];

export class ReminderError extends Error {
  readonly code: ReminderErrorCode;
  constructor(code: ReminderErrorCode) {
    super(`The reminder could not be saved: ${code}`);
    this.name = "ReminderError";
    this.code = code;
  }
}

type Failure = { code?: string; message?: string };

/** What a failed call means. The database's message is a machine word; it is mapped, never shown. */
export function errorOf(failure: Failure): ReminderError {
  const word = WORDS.find((w) => w === failure.message);
  if (word !== undefined) return new ReminderError(word);
  return new ReminderError(failure.code === "42501" ? "not_signed_in" : "failed");
}

function instant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** One row of `last_reminders()`. Throws ReminderError("failed") for a row that cannot be right. */
export function lastFromRow(row: unknown): LastReminder {
  const r = (typeof row === "object" && row !== null ? row : {}) as Record<string, unknown>;
  const lastAt = instant(r.last_sent_at);
  const { due_id: dueId, times } = r;
  if (typeof dueId !== "string" || dueId === "" || lastAt === null || typeof times !== "number" || !Number.isSafeInteger(times) || times < 1) {
    throw new ReminderError("failed");
  }
  return { dueId, lastAt, times };
}

/** When each fee was last reminded, by fee id. One small call; the board makes it with its dues. Throws ReminderError. */
export async function readLastReminders(): Promise<Record<string, LastReminder>> {
  if (isOffline()) throw new ReminderError("offline");
  let result;
  try {
    const client = await getClient();
    result = await client.rpc("last_reminders");
  } catch {
    throw new ReminderError("failed");
  }
  if (result.error) throw errorOf(result.error);
  const out: Record<string, LastReminder> = {};
  for (const row of (result.data as unknown[] | null) ?? []) {
    const last = lastFromRow(row);
    out[last.dueId] = last;
  }
  return out;
}

export type RecordArgs = {
  dueId: string;
  /** `polite:hi:month`. */
  template: string;
  /** One per step, sent again on every retry. */
  requestId: string;
};

/** Logs that WhatsApp was opened for a fee. Returns the time the database logged, in milliseconds. Throws ReminderError. The same `requestId` again answers the same time. */
export async function recordReminder({ dueId, template, requestId }: RecordArgs): Promise<number> {
  if (!TEMPLATE_TAG.test(template)) throw new ReminderError("invalid_argument");
  if (isOffline()) throw new ReminderError("offline");
  let result;
  try {
    const client = await getClient();
    result = await client.rpc("record_reminder", { p_due: dueId, p_template: template, p_request_id: requestId });
  } catch {
    throw new ReminderError("failed");
  }
  if (result.error) throw errorOf(result.error);
  const at = instant(result.data);
  if (at === null) throw new ReminderError("failed");
  return at;
}
