// What the parent's pay page asks and what it trusts (spec R1-9 Part B; the contract is A4 in the spec). Three
// requests only: `pay-page` to read the page, `record-consent` to agree, and `submit-claim` to tell the tutor "I've
// paid" (R1-10 Part C; contract in that spec's section 16). Each is a POST with the token in the body,
// made with plain `fetch`: no Supabase library, no key, no cookie, no referrer. The token is read from the address in
// the effect that calls these, and never written anywhere else: not the title, not storage, not a log.
import { isLocale, type Locale } from "@/config/locales";
import { formatDate } from "@/lib/format";
import { supabaseUrl } from "@/lib/supabase-env";

export const TIMEOUT_MS = 15_000;

// 22 or more URL-safe characters (spec criterion 16). The top limit only keeps an absurd address from being sent.
const TOKEN = /^[A-Za-z0-9_-]{22,128}$/;

/** Whether `raw` has the shape of a pay-page token (22 to 128 URL-safe characters). */
export function isToken(raw: string | null | undefined): raw is string {
  return typeof raw === "string" && TOKEN.test(raw);
}

/** The token in `/p/{token}` or `/p/{token}/`; null when the address has none or it cannot be one (no request is made then). */
export function tokenFromPath(pathname: string): string | null {
  const match = /^\/p\/([^/]+)\/?$/.exec(pathname);
  return match && isToken(match[1]) ? match[1] : null;
}

/** Where a page reads its token: the address's path (`/p/{token}`), or `?t=` (only the /dev fixture page). */
export type TokenSource = "path" | "query";

/** The token of this address, read as `source` says; null when there is none or it cannot be one. */
export function tokenFromLocation(location: Pick<Location, "pathname" | "search">, source: TokenSource = "path"): string | null {
  if (source === "path") return tokenFromPath(location.pathname);
  const raw = new URLSearchParams(location.search).get("t");
  return isToken(raw) ? raw : null;
}

/** What is known before the parent agrees: the notice header, and nothing about money. */
export type NoticePage = {
  consentNeeded: true;
  noticeVersion: string;
  tutorName: string | null;
  tutorSubjects: string[];
  studentName: string;
  language: Locale;
};

export type OpenDue = {
  kind: "monthly" | "opening";
  /** First of the month as `YYYY-MM-DD`, or null for an earlier balance. */
  month: string | null;
  dueDate: string;
  /** Integer paise. */
  amount: number;
  amountPaid: number;
  remaining: number;
};

export type PayReceipt = {
  receiptNo: number;
  receiptToken: string;
  month: string | null;
  amount: number;
  paidOn: string;
  balanceAfter: number;
};

/** What is known after the parent has agreed. */
export type FeePage = Omit<NoticePage, "consentNeeded"> & {
  consentNeeded: false;
  upiId: string | null;
  /** The India day, `YYYY-MM-DD`, from the server. The phone's clock is never read. */
  today: string;
  /** Integer paise: every open fee, including the ones beyond the list. May be larger than 2^31. */
  totalRemaining: number;
  openDues: OpenDue[];
  openDuesMore: number;
  receipts: PayReceipt[];
  receiptsMore: boolean;
  /** A claim the parent sent that the tutor has not handled yet (R1-10 criterion 38), or null. */
  pendingClaim: PendingClaim | null;
};

/** What the page knows of a waiting claim: the amount (integer paise) and the India day it was sent. Nothing else. */
export type PendingClaim = { amount: number; submittedOn: string };

export type PayPageData = NoticePage | FeePage;

export type PageOutcome =
  | { kind: "ok"; page: PayPageData }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "failed" };

export type ConsentOutcome =
  | { kind: "ok" }
  /** 409: the notice changed under the parent; the page reads again and shows the new one. */
  | { kind: "stale"; noticeVersion: string | null }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "failed" };

/**
 * What `submit-claim` said (R1-10 Part A contract, section 16). `duplicate` is the function's `duplicate_reference`.
 * A 403 is always `consent_needed`, which means "read the page again" (section 17, point 3), whatever came before.
 */
export type ClaimOutcome =
  | { kind: "ok" }
  | { kind: "bad_reference" }
  | { kind: "no_proof" }
  | { kind: "duplicate" }
  | { kind: "already_pending" }
  | { kind: "nothing_owed" }
  | { kind: "consent_needed" }
  | { kind: "rate_limited" }
  | { kind: "not_found" }
  | { kind: "failed" };

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";
const textOrNull = (value: unknown): value is string | null => value === null || typeof value === "string";
const isPaise = (value: unknown, minimum: number): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= minimum;
const isDay = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    formatDate(value);
    return true;
  } catch {
    return false;
  }
};
const isMonthStart = (value: unknown): value is string => isDay(value) && value.endsWith("-01");
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((s) => typeof s === "string");
// A notice version as the database holds it (`^[a-z0-9._-]{1,16}$`).
const isVersion = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9._-]{1,16}$/.test(value);

function readDue(value: unknown): OpenDue | null {
  if (!isObject(value)) return null;
  if (value.kind !== "monthly" && value.kind !== "opening") return null;
  if (value.month !== null && !isMonthStart(value.month)) return null;
  if (!isDay(value.due_date) || !isPaise(value.amount, 0) || !isPaise(value.amount_paid, 0) || !isPaise(value.remaining, 0)) return null;
  return { kind: value.kind, month: value.month, dueDate: value.due_date, amount: value.amount, amountPaid: value.amount_paid, remaining: value.remaining };
}

function readReceipt(value: unknown): PayReceipt | null {
  if (!isObject(value)) return null;
  if (!isPaise(value.receipt_no, 1) || !isText(value.receipt_token) || !TOKEN.test(value.receipt_token)) return null;
  if (value.month !== null && !isMonthStart(value.month)) return null;
  if (!isPaise(value.amount, 1) || !isDay(value.paid_on) || !isPaise(value.balance_after, 0)) return null;
  return { receiptNo: value.receipt_no, receiptToken: value.receipt_token, month: value.month, amount: value.amount, paidOn: value.paid_on, balanceAfter: value.balance_after };
}

/**
 * `pending_claim`: absent or null is "none"; otherwise an object with exactly `amount` (paise above 0) and
 * `submitted_on` (a day). `undefined` means "not the function's answer", and the whole page fails.
 */
function readPendingClaim(value: unknown): PendingClaim | null | undefined {
  if (value === undefined || value === null) return null;
  if (!isObject(value)) return undefined;
  const keys = Object.keys(value).sort();
  if (keys.length !== 2 || keys[0] !== "amount" || keys[1] !== "submitted_on") return undefined;
  if (!isPaise(value.amount, 1) || !isDay(value.submitted_on)) return undefined;
  return { amount: value.amount, submittedOn: value.submitted_on };
}

/** Every element of a list through `read`; null if the list is not a list or any element fails. */
function readList<T>(value: unknown, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const out: T[] = [];
  for (const item of value) {
    const one = read(item);
    if (one === null) return null;
    out.push(one);
  }
  return out;
}

/**
 * The page in a 200 body, only if every field it needs has the right type; otherwise null (the page says "failed",
 * never half a page). Unknown fields are dropped, never shown. A page that still needs consent carries no money at all.
 */
export function readPage(body: unknown): PayPageData | null {
  if (!isObject(body) || body.code !== "ok" || !isObject(body.page)) return null;
  const p = body.page;
  if (typeof p.consent_needed !== "boolean") return null;
  if (!isVersion(p.notice_version) || !textOrNull(p.tutor_name) || !isStrings(p.tutor_subjects) || !isText(p.student_name) || !isLocale(p.language)) return null;
  const head = {
    noticeVersion: p.notice_version,
    tutorName: p.tutor_name !== null && p.tutor_name.trim() !== "" ? p.tutor_name : null,
    tutorSubjects: p.tutor_subjects,
    studentName: p.student_name,
    language: p.language,
  };
  if (p.consent_needed) return { consentNeeded: true, ...head };

  if (!textOrNull(p.upi_id) || !isDay(p.today) || !isPaise(p.total_remaining, 0) || !isPaise(p.open_dues_more, 0)) return null;
  if (typeof p.receipts_more !== "boolean") return null;
  const openDues = readList(p.open_dues, readDue);
  const receipts = readList(p.receipts, readReceipt);
  const pendingClaim = readPendingClaim(p.pending_claim);
  if (openDues === null || receipts === null || pendingClaim === undefined) return null;
  return {
    consentNeeded: false,
    ...head,
    upiId: p.upi_id !== null && p.upi_id.trim() !== "" ? p.upi_id : null,
    today: p.today,
    totalRemaining: p.total_remaining,
    openDues,
    openDuesMore: p.open_dues_more,
    receipts,
    receiptsMore: p.receipts_more,
    pendingClaim,
  };
}

/** One POST with a timeout and `signal`. Resolves to the response, or null on any network failure. Never throws. */
async function post(endpoint: string, payload: Record<string, string>, signal?: AbortSignal): Promise<Response | null> {
  const timer = new AbortController();
  const stop = setTimeout(() => timer.abort(), TIMEOUT_MS);
  const cancel = () => timer.abort();
  if (signal?.aborted) timer.abort();
  signal?.addEventListener("abort", cancel);
  try {
    return await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: timer.signal,
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    });
  } catch {
    return null;
  } finally {
    clearTimeout(stop);
    signal?.removeEventListener("abort", cancel);
  }
}

/**
 * Reads the page. Never throws: a network failure, a timeout, a reply that is not the function's and a server fault all
 * come back as "failed" (the page offers Try again). 404 is "not_found" and 429 is "rate_limited".
 */
export async function fetchPayPage(token: string, signal?: AbortSignal, endpoint: string = `${supabaseUrl}/functions/v1/pay-page`): Promise<PageOutcome> {
  const response = await post(endpoint, { token }, signal);
  if (response === null) return { kind: "failed" };
  if (response.status === 404) return { kind: "not_found" };
  if (response.status === 429) return { kind: "rate_limited" };
  if (response.status !== 200) return { kind: "failed" };
  try {
    const page = readPage(await response.json());
    return page === null ? { kind: "failed" } : { kind: "ok", page };
  } catch {
    return { kind: "failed" };
  }
}

/** Records the parent's agreement. The body is exactly `{token, notice_version}`: the version the page was given. */
export async function postConsent(
  token: string,
  noticeVersion: string,
  signal?: AbortSignal,
  endpoint: string = `${supabaseUrl}/functions/v1/record-consent`,
): Promise<ConsentOutcome> {
  const response = await post(endpoint, { token, notice_version: noticeVersion }, signal);
  if (response === null) return { kind: "failed" };
  if (response.status === 404) return { kind: "not_found" };
  if (response.status === 429) return { kind: "rate_limited" };
  if (response.status === 409) {
    try {
      const body: unknown = await response.json();
      return { kind: "stale", noticeVersion: isObject(body) && isVersion(body.notice_version) ? body.notice_version : null };
    } catch {
      return { kind: "stale", noticeVersion: null };
    }
  }
  if (response.status !== 200) return { kind: "failed" };
  try {
    const body: unknown = await response.json();
    return isObject(body) && body.code === "ok" ? { kind: "ok" } : { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}

// The status and code `submit-claim` answers with, and what each means here. A status with a code it should not carry
// is not the function's answer, so it is "failed".
const CLAIM_CODES: Readonly<Record<number, Readonly<Record<string, ClaimOutcome["kind"]>>>> = {
  200: { ok: "ok" },
  422: { bad_reference: "bad_reference", no_proof: "no_proof" },
  409: { duplicate_reference: "duplicate", already_pending: "already_pending", nothing_owed: "nothing_owed" },
};

/**
 * Tells the tutor the parent has paid. The body is exactly `{token, upi_ref}`: the reference as the page normalised it;
 * never an amount, a student or a time. Never throws: a network failure, a timeout and any reply that is not the
 * function's are "failed", and nothing is retried or queued. The reference travels in this body and nowhere else.
 */
export async function postClaim(
  token: string,
  upiRef: string,
  signal?: AbortSignal,
  endpoint: string = `${supabaseUrl}/functions/v1/submit-claim`,
): Promise<ClaimOutcome> {
  const response = await post(endpoint, { token, upi_ref: upiRef }, signal);
  if (response === null) return { kind: "failed" };
  if (response.status === 403) return { kind: "consent_needed" };
  if (response.status === 404) return { kind: "not_found" };
  if (response.status === 429) return { kind: "rate_limited" };
  const codes = CLAIM_CODES[response.status];
  if (codes === undefined) return { kind: "failed" };
  try {
    const body: unknown = await response.json();
    const kind = isObject(body) && typeof body.code === "string" && Object.hasOwn(codes, body.code) ? codes[body.code] : undefined;
    return kind === undefined ? { kind: "failed" } : { kind };
  } catch {
    return { kind: "failed" };
  }
}
