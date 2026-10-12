// Payments the signed-in tutor has recorded: record one, undo one, read them (spec R1-7, Part A). The only
// file that calls `record_payment` or `void_payment`, and the only one that reads the `payments` table.
// A client has no write on `payments` or on a due's `amount_paid`; the two database functions do the work
// in one transaction (supabase/migrations/20261012130000_r1_payments.sql holds their contract).
//
// Online only for now. The outbox (R1-12) will replace the two calls and reuse the request id. The request
// id is made by the screen once per open sheet and sent again on every retry, so a double tap or a lost
// answer never records twice.
//
// Named columns, never `*`; `tutor_id`, `request_id` and `receipt_token` are not read (the token is for
// the parent's link, Part B and C). Money is integer paise. A row the app does not understand fails the
// whole read or call: better an error than a wrong amount on a money screen.
import { getClient } from "./supabase";
import { readOpeningDueId } from "./dues";
import { isOffline } from "./students";

export type PaymentMethod = "upi" | "cash";

/** A payment as the app holds it. `paidOn` is `YYYY-MM-DD`; `createdAt` is milliseconds since 1970; `voidedAt` is null while the payment stands. */
export type Payment = {
  id: string;
  dueId: string;
  /** Paise received. */
  amount: number;
  method: PaymentMethod;
  paidOn: string;
  receiptNo: number;
  /** Paise left on the fee right after this payment. Fixed when it was recorded. */
  balanceAfter: number;
  createdAt: number;
  voidedAt: number | null;
};

export const PAYMENT_COLUMNS = "id,due_id,amount,method,paid_on,receipt_no,balance_after,created_at,voided_at";

/** The words the database answers with (see the contract), and two of our own: the phone is offline, or anything else went wrong. */
export type PaymentErrorCode =
  | "not_signed_in"
  | "invalid_argument"
  | "due_not_found"
  | "student_archived"
  | "already_paid"
  | "amount_over_remaining"
  | "date_out_of_range"
  | "request_reused"
  | "payment_not_found"
  | "already_voided"
  | "undo_window_over"
  | "offline"
  | "failed";

const WORDS: readonly PaymentErrorCode[] = [
  "not_signed_in",
  "invalid_argument",
  "due_not_found",
  "student_archived",
  "already_paid",
  "amount_over_remaining",
  "date_out_of_range",
  "request_reused",
  "payment_not_found",
  "already_voided",
  "undo_window_over",
];

export class PaymentError extends Error {
  readonly code: PaymentErrorCode;
  /** For `amount_over_remaining`: the paise left on the fee, from the database. Otherwise null. */
  readonly remaining: number | null;
  constructor(code: PaymentErrorCode, remaining: number | null = null) {
    super(`The payment could not be saved: ${code}`);
    this.name = "PaymentError";
    this.code = code;
    this.remaining = remaining;
  }
}

const isPaise = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function instant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** A payment from a database row (a read, or what a function returned). Throws PaymentError("failed") for a row that cannot be right. */
export function paymentFromRow(row: unknown): Payment {
  const r = (typeof row === "object" && row !== null ? row : {}) as Record<string, unknown>;
  const { id, due_id: dueId, amount, method, paid_on: paidOn, receipt_no: receiptNo, balance_after: balanceAfter } = r;
  const createdAt = instant(r.created_at);
  const voidedAt = r.voided_at === null || r.voided_at === undefined ? null : instant(r.voided_at);
  const ok =
    typeof id === "string" &&
    typeof dueId === "string" &&
    isPaise(amount) &&
    amount > 0 &&
    (method === "upi" || method === "cash") &&
    typeof paidOn === "string" &&
    DAY.test(paidOn) &&
    typeof receiptNo === "number" &&
    Number.isSafeInteger(receiptNo) &&
    receiptNo > 0 &&
    isPaise(balanceAfter) &&
    createdAt !== null &&
    (r.voided_at === null || r.voided_at === undefined || voidedAt !== null);
  if (!ok) throw new PaymentError("failed");
  return { id, dueId, amount, method, paidOn, receiptNo, balanceAfter, createdAt, voidedAt };
}

type Failure = { code?: string; message?: string; details?: string | null };

/** What a failed call means. The database's message is a machine word; it is mapped, never shown. */
export function errorOf(failure: Failure): PaymentError {
  const word = WORDS.find((w) => w === failure.message);
  if (word === undefined) return new PaymentError(failure.code === "42501" ? "not_signed_in" : "failed");
  if (word === "amount_over_remaining") {
    const left = typeof failure.details === "string" && /^\d+$/.test(failure.details) ? Number(failure.details) : null;
    return new PaymentError(word, left !== null && Number.isSafeInteger(left) ? left : null);
  }
  return new PaymentError(word);
}

export type RecordArgs = {
  dueId: string;
  /** Paise, at least 100 and at most what is left. */
  amount: number;
  method: PaymentMethod;
  /** `YYYY-MM-DD`. */
  paidOn: string;
  /** One per open sheet, sent again on every retry. */
  requestId: string;
};

async function call(name: "record_payment" | "void_payment", args: Record<string, unknown>): Promise<Payment> {
  if (isOffline()) throw new PaymentError("offline");
  let result;
  try {
    const client = await getClient();
    result = await client.rpc(name, args);
  } catch {
    throw new PaymentError("failed");
  }
  if (result.error) throw errorOf(result.error);
  return paymentFromRow(result.data);
}

/** Records one payment. Throws PaymentError. The same `requestId` again returns the same payment. */
export function recordPayment({ dueId, amount, method, paidOn, requestId }: RecordArgs): Promise<Payment> {
  if (!Number.isSafeInteger(amount) || amount < 100 || (method !== "upi" && method !== "cash")) return Promise.reject(new PaymentError("invalid_argument"));
  return call("record_payment", { p_due: dueId, p_amount: amount, p_method: method, p_paid_on: paidOn, p_request_id: requestId });
}

/** Undoes one payment (within 24 hours of recording; the number stays used). Throws PaymentError. */
export function voidPayment(paymentId: string): Promise<Payment> {
  return call("void_payment", { p_payment: paymentId });
}

/** Every payment on one fee, newest first, the undone ones included. */
export async function readPaymentsOfDue(dueId: string): Promise<Payment[]> {
  let result;
  try {
    const client = await getClient();
    result = await client.from("payments").select(PAYMENT_COLUMNS).eq("due_id", dueId).order("receipt_no", { ascending: false });
  } catch {
    throw new PaymentError("failed");
  }
  if (result.error) throw new PaymentError("failed");
  return ((result.data as unknown[] | null) ?? []).map(paymentFromRow);
}

/**
 * Whether any payment (voided or not) has been recorded against this student's earlier balance (criterion 20:
 * "Already owes" is then locked on the student's edit screen). The database does not refuse a later change: it
 * silently leaves the due as it was, so students.opening_balance would drift from the due. This lock is what
 * keeps them together. Never throws. When it cannot be read the answer is true (locked), so a failed read can
 * never let the two drift.
 */
export async function readOpeningPaid(studentId: string): Promise<boolean> {
  try {
    const id = await readOpeningDueId(studentId);
    if (id === null) return false;
    const client = await getClient();
    const { data, error } = await client.from("payments").select("id").eq("due_id", id).limit(1);
    if (error) return true;
    return ((data as unknown[] | null) ?? []).length > 0;
  } catch {
    return true;
  }
}
