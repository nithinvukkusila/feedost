// What the parent's receipt page asks and what it trusts (spec R1-7 Part B; the contract at the end of the spec).
// One request: a POST with the token in the body, to the `receipt` Edge Function. No Supabase library, no key, no
// cookie, no referrer. The token is read from the address once, held in the effect that calls this, and never
// written anywhere else: not the title, not storage, not a second request, not a log.
import { isLocale, type Locale } from "@/config/locales";
import { formatDate } from "@/lib/format";
import { supabaseUrl } from "@/lib/supabase-env";

/** The preset subjects the tutor's profile stores as keys (src/lib/profile.ts); the receipt names them in its own language. */
export const PRESET_SUBJECTS = ["maths", "science", "english", "hindi", "physics", "chemistry", "accounts"] as const;

export const TIMEOUT_MS = 15_000;

// 22 or more URL-safe characters (spec criterion 24). The top limit only keeps an absurd address from being sent.
const TOKEN = /^[A-Za-z0-9_-]{22,128}$/;

/** The token in `/r/{token}` or `/r/{token}/`; null when the address has none or it cannot be one (no request is made then). */
export function tokenFromPath(pathname: string): string | null {
  const match = /^\/r\/([^/]+)\/?$/.exec(pathname);
  return match && TOKEN.test(match[1]) ? match[1] : null;
}

export type PaidReceipt = {
  receiptNo: number;
  status: "paid" | "part_paid";
  tutorName: string | null;
  tutorSubjects: string[];
  studentName: string;
  parentName: string | null;
  /** First of the month as `YYYY-MM-DD`, or null for an earlier balance. */
  month: string | null;
  /** Integer paise. */
  amount: number;
  method: "upi" | "cash";
  paidOn: string;
  /** Integer paise left on that fee right after this payment. */
  balanceAfter: number;
  language: Locale;
};

export type CancelledReceipt = {
  receiptNo: number;
  status: "cancelled";
  tutorName: string | null;
  studentName: string;
  language: Locale;
};

export type Outcome =
  | { kind: "ok"; receipt: PaidReceipt }
  | { kind: "cancelled"; receipt: CancelledReceipt }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "failed" };

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const textOrNull = (value: unknown): value is string | null => value === null || typeof value === "string";
const isPaise = (value: unknown, minimum: number): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const isDay = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    formatDate(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
  } catch {
    return false;
  }
};

/** The receipt in a 200 body, only if every field it needs has the right type; otherwise null. Unknown fields are dropped, never shown. */
export function readReceipt(body: unknown): Outcome | null {
  if (!isObject(body) || body.code !== "ok" || !isObject(body.receipt)) return null;
  const r = body.receipt;
  if (!isPaise(r.receipt_no, 1) || !isText(r.student_name) || !textOrNull(r.tutor_name) || !isLocale(r.language)) return null;
  const common = { receiptNo: r.receipt_no, tutorName: r.tutor_name, studentName: r.student_name, language: r.language };
  if (r.status === "cancelled") return { kind: "cancelled", receipt: { ...common, status: "cancelled" } };
  if (r.status !== "paid" && r.status !== "part_paid") return null;
  if (!isPaise(r.amount, 1) || !isPaise(r.balance_after, 0) || !isDay(r.paid_on)) return null;
  if (r.method !== "upi" && r.method !== "cash") return null;
  if (!textOrNull(r.parent_name)) return null;
  if (r.month !== null && !(isDay(r.month) && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(r.month as string))) return null;
  if (!Array.isArray(r.tutor_subjects) || !r.tutor_subjects.every((s) => typeof s === "string")) return null;
  return {
    kind: "ok",
    receipt: {
      ...common,
      status: r.status,
      tutorSubjects: r.tutor_subjects,
      parentName: r.parent_name && r.parent_name.trim() !== "" ? r.parent_name : null,
      month: r.month as string | null,
      amount: r.amount,
      method: r.method,
      paidOn: r.paid_on,
      balanceAfter: r.balance_after,
    },
  };
}

/**
 * Asks for one receipt. Never throws: a network failure, a timeout, a reply that is not the function's and a
 * server fault all come back as "failed" (the page offers Try again). 404 is "not_found" and 429 is
 * "rate_limited"; anything else is "failed". `signal` lets the page cancel when it goes away.
 */
export async function fetchReceipt(
  token: string,
  signal?: AbortSignal,
  endpoint: string = `${supabaseUrl}/functions/v1/receipt`,
): Promise<Outcome> {
  const timer = new AbortController();
  const stop = setTimeout(() => timer.abort(), TIMEOUT_MS);
  const cancel = () => timer.abort();
  if (signal?.aborted) timer.abort();
  signal?.addEventListener("abort", cancel);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: timer.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
    if (response.status === 404) return { kind: "not_found" };
    if (response.status === 429) return { kind: "rate_limited" };
    if (response.status !== 200) return { kind: "failed" };
    return readReceipt(await response.json()) ?? { kind: "failed" };
  } catch {
    return { kind: "failed" };
  } finally {
    clearTimeout(stop);
    signal?.removeEventListener("abort", cancel);
  }
}
