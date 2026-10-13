// R1-9 Part A criteria 13 to 15: the whole behaviour of the record-consent function as a pure function, so Node can test it with fakes.
// POST only; the token is in the JSON body. The body is exactly {token, notice_version}: nothing else the client sends is read,
// so no student id, tutor id or time can be supplied. The database function takes tutor and time from its own rows.
// Order: CORS preflight, method, size, JSON, exact keys and version shape (no database call yet), per-IP limit, token shape,
// per-token limit, record, answer. It never logs or stores a token, name or IP. Logs are fixed words.
import { DUMMY_TOKEN, TOKEN_RE, allowedOrigin, clientIp, codeOnly, preflight, readLimited, respond } from "../_shared/public-http.ts";

export { DUMMY_TOKEN, MAX_BODY_BYTES } from "../_shared/public-http.ts";

/** Founder-changeable: requests allowed per hashed IP per hour, and per hashed token per hour. */
export const LIMIT_PER_IP_PER_HOUR = 60;
export const LIMIT_UNKNOWN_IP_PER_HOUR = 2000; // H7, as in receipt and pay-page
export const LIMIT_PER_TOKEN_PER_HOUR = 20;

/** Mirror of the consents.notice_version check. */
export const VERSION_RE = /^[a-z0-9._-]{1,16}$/;

/** Prefixes differ from pay-page's, so a hash made for one counter can never be a hash for another. */
export const ipHashMessage = (ip: string, hour: string) => `pc-ip|${ip}|${hour}`;
export const tokenHashMessage = (token: string, hour: string) => `pc-token|${token}|${hour}`;

export type Deps = {
  env: { APP_ENV?: string; /** Comma-separated hostnames; `*` stands for part of one label. Unset means the default hosts. */ PAYPAGE_ALLOWED_HOSTS?: string };
  now: () => Date;
  hashIp: (ip: string, hour: string) => Promise<string>;
  hashToken: (token: string, hour: string) => Promise<string>;
  hitIp: (hash: string, limit: number) => Promise<boolean>;
  hitToken: (hash: string, limit: number) => Promise<boolean>;
  /** public.record_consent(token, version): 'ok', 'stale_notice' or 'not_found'. */
  recordConsent: (token: string, noticeVersion: string) => Promise<string>;
  /** The notice version a known token's page asks for (from get_pay_page), or null when the token is not known. */
  currentNoticeVersion: (token: string) => Promise<string | null>;
  /** Receives a fixed word per outcome, never a value. */
  log?: (word: string) => void;
};

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

    // Exactly two keys, both strings, and a version of the right shape. Checked before any counting or database call.
    const record = body as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const version = record.notice_version;
    if (keys.length !== 2 || keys[0] !== "notice_version" || keys[1] !== "token" || typeof record.token !== "string" || typeof version !== "string" || !VERSION_RE.test(version)) {
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

    const token = TOKEN_RE.test(record.token) ? record.token : null;

    if (token === null) {
      // Same answer and about the same work as an unknown token: one call, with a dummy.
      await deps.recordConsent(DUMMY_TOKEN, version);
      log("not_found");
      return codeOnly(404, "not_found", cors);
    }

    if (!(await deps.hitToken(await deps.hashToken(token, hour), LIMIT_PER_TOKEN_PER_HOUR))) {
      log("rate_limited");
      return codeOnly(429, "rate_limited", cors, { "Retry-After": "3600" });
    }

    const result = await deps.recordConsent(token, version);
    if (result === "ok") {
      log("consent_recorded");
      return respond(200, { code: "ok" }, cors);
    }
    if (result === "not_found") {
      log("not_found");
      return codeOnly(404, "not_found", cors);
    }
    if (result === "stale_notice") {
      // The token is known (not_found would have come first), so the current version is already on its page.
      const current = await deps.currentNoticeVersion(token);
      if (current === null || !VERSION_RE.test(current)) {
        log("not_found");
        return codeOnly(404, "not_found", cors);
      }
      log("stale_notice");
      return respond(409, { code: "stale_notice", notice_version: current }, cors);
    }
    log("error");
    return codeOnly(500, "error", cors);
  } catch {
    log("error");
    return codeOnly(500, "error", cors);
  }
}
