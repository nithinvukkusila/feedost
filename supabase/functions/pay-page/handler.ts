// R1-9 Part A criteria 12, 14, 15: the whole behaviour of the pay-page function as a pure function, so Node can test it with fakes.
// POST only; the token is in the JSON body, never the URL, so no access log holds it.
// Order: CORS preflight, method, size, JSON, per-IP limit, token shape, per-token limit, lookup, allow-listed answer.
// It never logs or stores a token, name, amount, UPI id or IP. Logs are fixed words.
import { DUMMY_TOKEN, TOKEN_RE, allowedOrigin, clientIp, codeOnly, preflight, readLimited, respond } from "../_shared/public-http.ts";

export { DUMMY_TOKEN, MAX_BODY_BYTES } from "../_shared/public-http.ts";

/** Founder-changeable: requests allowed per hashed IP per hour, and per hashed token per hour. */
export const LIMIT_PER_IP_PER_HOUR = 60;
// Callers whose IP the platform did not tell us share one bucket (H7, as in receipt): a high limit, the per-token limit is the real guard.
export const LIMIT_UNKNOWN_IP_PER_HOUR = 2000;
export const LIMIT_PER_TOKEN_PER_HOUR = 120;

/** The only keys a page carries out of this function before the parent has agreed. */
export const PRE_CONSENT_KEYS = ["consent_needed", "notice_version", "tutor_name", "tutor_subjects", "student_name", "language"] as const;
/** The only keys after consent. */
export const POST_CONSENT_KEYS = [
  ...PRE_CONSENT_KEYS, "upi_id", "today", "total_remaining", "open_dues", "open_dues_more", "receipts", "receipts_more", "pending_claim",
] as const;
export const DUE_KEYS = ["kind", "month", "due_date", "amount", "amount_paid", "remaining"] as const;
/** R1-10: a waiting claim shows only how much and on which India day, never the reference, file, id or status. */
export const PENDING_CLAIM_KEYS = ["amount", "submitted_on"] as const;
export const RECEIPT_KEYS = ["receipt_no", "receipt_token", "month", "amount", "paid_on", "balance_after"] as const;

/** The text that is hashed, with a prefix so the pay-page counters never collide with record-consent's or any other function's. */
export const ipHashMessage = (ip: string, hour: string) => `pp-ip|${ip}|${hour}`;
export const tokenHashMessage = (token: string, hour: string) => `pp-token|${token}|${hour}`;

export type Deps = {
  env: { APP_ENV?: string; /** Comma-separated hostnames; `*` stands for part of one label. Unset means the default hosts. */ PAYPAGE_ALLOWED_HOSTS?: string };
  now: () => Date;
  /** HMAC(salt, ipHashMessage(ip, hour)). The raw IP goes no further than this call. */
  hashIp: (ip: string, hour: string) => Promise<string>;
  /** HMAC(salt, tokenHashMessage(token, hour)). The raw token goes no further than this call and getPayPage. */
  hashToken: (token: string, hour: string) => Promise<string>;
  /** Counts the hashed value for the hour; true while within the limit. */
  hitIp: (hash: string, limit: number) => Promise<boolean>;
  hitToken: (hash: string, limit: number) => Promise<boolean>;
  /** public.get_pay_page(token): an object, or null when no such page. */
  getPayPage: (token: string) => Promise<Record<string, unknown> | null>;
  /** Receives a fixed word per outcome, never a value. */
  log?: (word: string) => void;
};

function copy(row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = row[k] ?? null;
  return out;
}

const list = (value: unknown, keys: readonly string[]) =>
  Array.isArray(value) ? value.map((e) => copy(e && typeof e === "object" ? (e as Record<string, unknown>) : {}, keys)) : [];
/** A missing count is 0. A present value that is not a whole finite number is NaN, which allowListed turns into a 500. */
const whole = (value: unknown) => (value === undefined || value === null ? 0 : typeof value === "number" && Number.isInteger(value) ? value : Number.NaN);

/** null for no claim; the two allowed keys for a well formed one; undefined for anything odd (the caller refuses the whole page). */
function pendingClaim(value: unknown): Record<string, unknown> | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) return undefined;
  const claim = copy(value as Record<string, unknown>, PENDING_CLAIM_KEYS);
  const day = claim.submitted_on;
  if (typeof claim.amount !== "number" || !Number.isInteger(claim.amount) || claim.amount < 1) return undefined;
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  return claim;
}

/**
 * Copies only the allowed keys, chosen by consent_needed. Returns null when consent_needed is not a boolean:
 * never guess the stricter or the looser state.
 */
export function allowListed(row: Record<string, unknown>): Record<string, unknown> | null {
  if (row.consent_needed === true) {
    return { ...copy(row, PRE_CONSENT_KEYS), consent_needed: true };
  }
  if (row.consent_needed !== false) return null;
  const page = copy(row, POST_CONSENT_KEYS);
  page.consent_needed = false;
  page.total_remaining = whole(row.total_remaining);
  page.open_dues = list(row.open_dues, DUE_KEYS);
  page.open_dues_more = whole(row.open_dues_more);
  // Never show "nothing owed" because the database sent something odd: refuse the page instead.
  if (!Number.isInteger(page.total_remaining) || !Number.isInteger(page.open_dues_more)) return null;
  page.receipts = list(row.receipts, RECEIPT_KEYS);
  page.receipts_more = row.receipts_more === true;
  const claim = pendingClaim(row.pending_claim);
  // Never show a claim the database did not send in a shape we know: refuse the page instead.
  if (claim === undefined) return null;
  page.pending_claim = claim;
  return page;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const log = deps.log ?? ((word: string) => console.log(word));
  const origin = allowedOrigin(req.headers.get("origin"), deps.env.APP_ENV, deps.env.PAYPAGE_ALLOWED_HOSTS);
  const cors: Record<string, string> = origin ? { "Access-Control-Allow-Origin": origin } : {};

  if (req.method === "OPTIONS") return preflight(origin, cors);
  if (req.method !== "POST") return codeOnly(405, "invalid", cors, { Allow: "POST, OPTIONS" });

  try {
    const text = await readLimited(req);
    if (text === null) {
      log("too_large");
      return codeOnly(413, "invalid", cors);
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      log("invalid");
      return codeOnly(400, "invalid", cors);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      log("invalid");
      return codeOnly(400, "invalid", cors);
    }

    const hour = deps.now().toISOString().slice(0, 13);
    const ip = clientIp(req);
    const ipLimit = ip === "unknown" ? LIMIT_UNKNOWN_IP_PER_HOUR : LIMIT_PER_IP_PER_HOUR;
    if (!(await deps.hitIp(await deps.hashIp(ip, hour), ipLimit))) {
      log("rate_limited");
      return codeOnly(429, "rate_limited", cors, { "Retry-After": "3600" });
    }

    const raw = (body as Record<string, unknown>).token;
    const token = typeof raw === "string" && TOKEN_RE.test(raw) ? raw : null;

    if (token === null) {
      // Same answer and about the same work as an unknown token: one lookup, with a dummy.
      await deps.getPayPage(DUMMY_TOKEN);
      log("not_found");
      return codeOnly(404, "not_found", cors);
    }

    if (!(await deps.hitToken(await deps.hashToken(token, hour), LIMIT_PER_TOKEN_PER_HOUR))) {
      log("rate_limited");
      return codeOnly(429, "rate_limited", cors, { "Retry-After": "3600" });
    }

    const row = await deps.getPayPage(token);
    if (!row) {
      log("not_found");
      return codeOnly(404, "not_found", cors);
    }
    const page = allowListed(row);
    if (!page) {
      log("error");
      return codeOnly(500, "error", cors);
    }
    log("ok");
    return respond(200, { code: "ok", page }, cors);
  } catch {
    log("error");
    return codeOnly(500, "error", cors);
  }
}
