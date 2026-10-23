// "I've paid" claims, the tutor's side (spec R1-10, Part B). The only file that reads the `payment_claims`
// table or calls `confirm_claim` and `reject_claim`. A client has no write on the table: a parent's claim
// is made by the `submit-claim` function, and the tutor changes one only through the two functions, which
// record the payments in the same transaction (the contract is section 16 of docs/specs/R1-10-paid-claims-inbox.md
// and the top of supabase/migrations/20261015170625_r1_payment_claims.sql).
//
// Online only for now (R1-12 will queue them). The request id is made by the card's first Confirm tap and
// sent again on every retry, so one tap that saved but lost its answer never records twice.
//
// Named columns, never `*`; `tutor_id` and `confirm_request_id` are not read. Money is integer paise. A row
// the app does not understand fails the whole read or call: better an error than a wrong amount.
import { getClient } from "./supabase";
import { isOffline } from "./students";

export type ClaimStatus = "pending" | "confirmed" | "rejected";

/** A claim as the app holds it. `createdAt` and `handledAt` are milliseconds since 1970. */
export type Claim = {
  id: string;
  studentId: string;
  /** The oldest open fee the claim names. */
  dueId: string;
  /** Paise: what the student owed over all open fees when the parent sent it. */
  amount: number;
  /** How many open fees that amount spanned. */
  feeCount: number;
  /** 12 digits, or null when the proof is a screenshot. */
  upiRef: string | null;
  /** Null until a screenshot is sent (Part D). */
  screenshotPath: string | null;
  status: ClaimStatus;
  createdAt: number;
  handledAt: number | null;
  /** The first receipt number a Confirm used, and how many it used. Null until confirmed. */
  receiptFrom: number | null;
  receiptCount: number | null;
};

export const CLAIM_COLUMNS = "id,student_id,due_id,amount,fee_count,upi_ref,screenshot_path,status,created_at,handled_at,confirmed_receipt_from,confirmed_receipt_count";

/** The words the database answers with (see the contract), and two of our own: the phone is offline, or anything else went wrong. */
export type ClaimErrorCode =
  | "not_signed_in"
  | "invalid_argument"
  | "claim_not_found"
  | "already_handled"
  | "request_reused"
  | "student_archived"
  | "date_out_of_range"
  | "amount_over_remaining"
  | "offline"
  | "failed";

const WORDS: readonly ClaimErrorCode[] = [
  "not_signed_in",
  "invalid_argument",
  "claim_not_found",
  "already_handled",
  "request_reused",
  "student_archived",
  "date_out_of_range",
  "amount_over_remaining",
];

export class ClaimError extends Error {
  readonly code: ClaimErrorCode;
  /** For `amount_over_remaining`: the paise owed now, from the database. Otherwise null. */
  readonly remaining: number | null;
  constructor(code: ClaimErrorCode, remaining: number | null = null) {
    super(`The claim could not be handled: ${code}`);
    this.name = "ClaimError";
    this.code = code;
    this.remaining = remaining;
  }
}

type Failure = { code?: string; message?: string; details?: string | null };

/** What a failed call means. The database's message is a machine word; it is mapped, never shown. */
export function errorOf(failure: Failure): ClaimError {
  const word = WORDS.find((w) => w === failure.message);
  if (word === undefined) return new ClaimError(failure.code === "42501" ? "not_signed_in" : "failed");
  if (word === "amount_over_remaining") {
    const left = typeof failure.details === "string" && /^\d+$/.test(failure.details) ? Number(failure.details) : null;
    return new ClaimError(word, left !== null && Number.isSafeInteger(left) ? left : null);
  }
  return new ClaimError(word);
}

const isPaise = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
const REF = /^[0-9]{12}$/;

function instant(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** A claim from a database row (a read, or what a function returned). Throws ClaimError("failed") for a row that cannot be right. */
export function claimFromRow(row: unknown): Claim {
  const r = (typeof row === "object" && row !== null ? row : {}) as Record<string, unknown>;
  const { id, student_id: studentId, due_id: dueId, amount, fee_count: feeCount, upi_ref: ref, screenshot_path: shot, status } = r;
  const createdAt = instant(r.created_at);
  const handledAt = r.handled_at === null || r.handled_at === undefined ? null : instant(r.handled_at);
  const from = r.confirmed_receipt_from ?? null;
  const count = r.confirmed_receipt_count ?? null;
  const upiRef = ref === null || ref === undefined ? null : ref;
  const screenshotPath = shot === null || shot === undefined ? null : shot;
  const ok =
    typeof id === "string" &&
    typeof studentId === "string" &&
    typeof dueId === "string" &&
    isPaise(amount) &&
    amount > 0 &&
    isCount(feeCount) &&
    (upiRef === null || (typeof upiRef === "string" && REF.test(upiRef))) &&
    (screenshotPath === null || typeof screenshotPath === "string") &&
    (upiRef !== null || screenshotPath !== null) &&
    (status === "pending" || status === "confirmed" || status === "rejected") &&
    createdAt !== null &&
    (r.handled_at === null || r.handled_at === undefined || handledAt !== null) &&
    (status === "pending") === (handledAt === null) &&
    (status === "confirmed" ? isCount(from) && isCount(count) : from === null && count === null);
  if (!ok) throw new ClaimError("failed");
  return {
    id,
    studentId,
    dueId,
    amount,
    feeCount,
    upiRef: upiRef as string | null,
    screenshotPath: screenshotPath as string | null,
    status,
    createdAt,
    handledAt,
    receiptFrom: from as number | null,
    receiptCount: count as number | null,
  };
}

async function readClaims(handled: boolean): Promise<Claim[]> {
  let result;
  try {
    const client = await getClient();
    const base = client.from("payment_claims").select(CLAIM_COLUMNS);
    result = handled
      ? await base.in("status", ["confirmed", "rejected"]).order("handled_at", { ascending: false }).limit(20)
      : await base.eq("status", "pending").order("created_at", { ascending: false });
  } catch {
    throw new ClaimError("failed");
  }
  if (result.error) throw new ClaimError("failed");
  return ((result.data as unknown[] | null) ?? []).map(claimFromRow);
}

/** Every claim waiting for the tutor, newest first. */
export const readPendingClaims = (): Promise<Claim[]> => readClaims(false);

/** The last 20 claims the tutor has handled (confirmed or not received), newest handled first. */
export const readHandledClaims = (): Promise<Claim[]> => readClaims(true);

/** How many claims are waiting. A count only: no row is downloaded. Throws ClaimError("failed") when it cannot be read; never a guess. */
export async function countPendingClaims(): Promise<number> {
  let result;
  try {
    const client = await getClient();
    result = await client.from("payment_claims").select("id", { count: "exact", head: true }).eq("status", "pending");
  } catch {
    throw new ClaimError("failed");
  }
  const { count, error } = result;
  if (error || typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw new ClaimError("failed");
  return count;
}

async function call(name: "confirm_claim" | "reject_claim", args: Record<string, unknown>): Promise<Claim> {
  if (isOffline()) throw new ClaimError("offline");
  let result;
  try {
    const client = await getClient();
    result = await client.rpc(name, args);
  } catch {
    throw new ClaimError("failed");
  }
  if (result.error) throw errorOf(result.error);
  return claimFromRow(result.data);
}

export type ConfirmArgs = {
  claimId: string;
  /** Made by the card's first Confirm tap, sent again on every retry. */
  requestId: string;
};

/** Confirms a claim: the database records one payment per fee it covers, oldest first. Throws ClaimError. The same `requestId` again returns the same claim. */
export function confirmClaim({ claimId, requestId }: ConfirmArgs): Promise<Claim> {
  return call("confirm_claim", { p_claim: claimId, p_request_id: requestId });
}

/** Marks a claim "not received". Records nothing and tells no one. Throws ClaimError. */
export function rejectClaim(claimId: string): Promise<Claim> {
  return call("reject_claim", { p_claim: claimId });
}
