// R1-10 Part A criteria 13 and 14: the whole behaviour of the submit-claim function as a pure function, so Node can test it with fakes.
// POST only; the token and the UPI reference are in the JSON body, never the URL, so no access log holds either. The body is exactly
// {token, upi_ref}: nothing else the client sends is read, so no amount, student id, tutor id or time can be supplied. The database
// function takes tutor, student, amount and time from its own rows.
// Order: CORS preflight, method, size, JSON, exact keys (no database call yet), per-IP limit, token shape, per-token limit,
// the shared reference check, submit_claim, answer. It never logs or stores a token, a reference, an amount or an IP. Logs are fixed words.
import { DUMMY_TOKEN, TOKEN_RE, allowedOrigin, clientIp, codeOnly, preflight, readLimited, respond } from "../_shared/public-http.ts";
import { REF_MAX_INPUT, normalizeRef } from "../_shared/upi-ref.ts";

export { DUMMY_TOKEN, MAX_BODY_BYTES } from "../_shared/public-http.ts";

/** Founder-changeable: requests allowed per hashed IP per hour, and per hashed token per hour. */
export const LIMIT_PER_IP_PER_HOUR = 30;
// Callers whose IP the platform did not tell us share one bucket (H7, as in receipt and pay-page): a high limit, the per-token limit is the real guard.
export const LIMIT_UNKNOWN_IP_PER_HOUR = 2000;
export const LIMIT_PER_TOKEN_PER_HOUR = 10;

/** The text that is hashed, with a prefix so these counters never collide with another function's. */
export const ipHashMessage = (ip: string, hour: string) => `cl-ip|${ip}|${hour}`;
export const tokenHashMessage = (token: string, hour: string) => `cl-token|${token}|${hour}`;

/** What submit_claim answers, and the one HTTP status each refusal gets. */
export const STATUS_OF: Readonly<Record<string, number>> = {
  ok: 200,
  not_found: 404,
  bad_reference: 422,
  no_proof: 422,
  duplicate_reference: 409,
  already_pending: 409,
  nothing_owed: 409,
  consent_needed: 403,
};

/** The fixed words this function logs. */
export type LogWord = "ok" | "not_found" | "rate_limited" | "refused" | "error";

export type Deps = {
  env: { APP_ENV?: string; /** Comma-separated hostnames; `*` stands for part of one label. Unset means the default hosts (the pay page's setting). */ PAYPAGE_ALLOWED_HOSTS?: string };
  now: () => Date;
  /** HMAC(salt, ipHashMessage(ip, hour)). The raw IP goes no further than this call. */
  hashIp: (ip: string, hour: string) => Promise<string>;
  /** HMAC(salt, tokenHashMessage(token, hour)). The raw token goes no further than this call and submitClaim. */
  hashToken: (token: string, hour: string) => Promise<string>;
  /** Counts the hashed value for the hour; true while within the limit. */
  hitIp: (hash: string, limit: number) => Promise<boolean>;
  hitToken: (hash: string, limit: number) => Promise<boolean>;
  /** public.submit_claim(token, upi_ref, null): one code word. The normalised 12 digits are passed, or "" for none. */
  submitClaim: (token: string, upiRef: string) => Promise<string>;
  /** Receives a fixed word per outcome, never a value. */
  log?: (word: LogWord) => void;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const log = deps.log ?? ((word: LogWord) => console.log(word));
  const origin = allowedOrigin(req.headers.get("origin"), deps.env.APP_ENV, deps.env.PAYPAGE_ALLOWED_HOSTS);
  const cors: Record<string, string> = origin ? { "Access-Control-Allow-Origin": origin } : {};

  if (req.method === "OPTIONS") return preflight(origin, cors);
  if (req.method !== "POST") return codeOnly(405, "invalid", cors, { Allow: "POST, OPTIONS" });

  try {
    const text = await readLimited(req);
    if (text === null) {
      log("refused");
      return codeOnly(413, "invalid", cors);
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      log("refused");
      return codeOnly(400, "invalid", cors);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      log("refused");
      return codeOnly(400, "invalid", cors);
    }

    // Exactly two keys, both strings, and a reference no longer than a person could type. Checked before any counting or database call.
    const record = body as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    if (
      keys.length !== 2 || keys[0] !== "token" || keys[1] !== "upi_ref" ||
      typeof record.token !== "string" || typeof record.upi_ref !== "string" || record.upi_ref.length > REF_MAX_INPUT
    ) {
      log("refused");
      return codeOnly(400, "invalid", cors);
    }

    const hour = deps.now().toISOString().slice(0, 13);
    const ip = clientIp(req);
    const ipLimit = ip === "unknown" ? LIMIT_UNKNOWN_IP_PER_HOUR : LIMIT_PER_IP_PER_HOUR;
    if (!(await deps.hitIp(await deps.hashIp(ip, hour), ipLimit))) {
      log("rate_limited");
      return codeOnly(429, "rate_limited", cors, { "Retry-After": "3600" });
    }

    const token = TOKEN_RE.test(record.token) ? record.token : null;

    if (token === null) {
      // Same answer and about the same work as an unknown token: one call, with a dummy.
      await deps.submitClaim(DUMMY_TOKEN, "");
      log("not_found");
      return codeOnly(404, "not_found", cors);
    }

    if (!(await deps.hitToken(await deps.hashToken(token, hour), LIMIT_PER_TOKEN_PER_HOUR))) {
      log("rate_limited");
      return codeOnly(429, "rate_limited", cors, { "Retry-After": "3600" });
    }

    // The shared check. A bad or missing reference is answered here, with no database call (the database re-checks it anyway).
    const checked = normalizeRef(record.upi_ref);
    if (!checked.ok) {
      const code = checked.reason === "empty" ? "no_proof" : "bad_reference";
      log("refused");
      return respond(422, { code }, cors);
    }

    const code = await deps.submitClaim(token, checked.ref);
    const status = STATUS_OF[code];
    if (status === undefined) {
      log("error");
      return codeOnly(500, "error", cors);
    }
    if (code === "ok") {
      log("ok");
      return codeOnly(200, "ok", cors);
    }
    if (code === "not_found") {
      log("not_found");
      return codeOnly(404, "not_found", cors);
    }
    log("refused");
    return respond(status, { code }, cors);
  } catch {
    log("error");
    return codeOnly(500, "error", cors);
  }
}
