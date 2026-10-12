// R1-7 Part B criteria 23 to 27: the whole behaviour of the receipt function as a pure function, so Node can test it with fakes.
// POST only; the token is in the JSON body, never the URL, so no access log holds it.
// Order: CORS preflight, method, size, JSON, per-IP limit, token shape, per-token limit, lookup, allow-listed answer.
// It never logs or stores a token, name, amount or IP. Logs are fixed words.

/** Founder-changeable: requests allowed per hashed IP per hour, and per hashed token per hour. */
export const LIMIT_PER_IP_PER_HOUR = 60;
// Callers whose IP the platform did not tell us share one bucket, so 60 would lock out every parent after 60 opens in an
// hour. That bucket gets a high limit instead (privacy is unchanged: nothing about the caller is stored); the per-token
// limit stays the real guard. preprod-qa must confirm on staging which header the platform sets (H7); once it is known
// this bucket should never be used.
export const LIMIT_UNKNOWN_IP_PER_HOUR = 2000;
export const LIMIT_PER_TOKEN_PER_HOUR = 120;
export const MAX_BODY_BYTES = 512;

/** Tokens are 24 URL-safe characters from the database (22 at least). The upper bound only stops absurd input. */
const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;
/** Looked up when the caller's token is malformed, so a bad shape costs about the same work as an unknown token. */
export const DUMMY_TOKEN = "0000000000000000000000";

/** The only keys a live receipt carries out of this function. */
export const LIVE_KEYS = [
  "receipt_no", "status", "tutor_name", "tutor_subjects", "student_name", "parent_name",
  "month", "amount", "method", "paid_on", "balance_after", "language",
] as const;
/** The only keys a cancelled receipt carries: no amount, method, date or balance. */
export const CANCELLED_KEYS = ["receipt_no", "status", "tutor_name", "student_name", "language"] as const;

export type Code = "ok" | "not_found" | "invalid" | "rate_limited" | "error";

export type Deps = {
  env: { APP_ENV?: string; /** Comma-separated hostnames; `*` stands for part of one label. Unset means DEFAULT_ALLOWED_HOSTS. */ RECEIPT_ALLOWED_HOSTS?: string };
  now: () => Date;
  /** HMAC(salt, ip|hour). The raw IP goes no further than this call. */
  hashIp: (ip: string, hour: string) => Promise<string>;
  /** HMAC(salt, "token|" + token + "|" + hour). The raw token goes no further than this call and getReceipt. */
  hashToken: (token: string, hour: string) => Promise<string>;
  /** Counts the hashed IP for the hour; true while within the limit. */
  hitIp: (hash: string, limit: number) => Promise<boolean>;
  hitToken: (hash: string, limit: number) => Promise<boolean>;
  /** public.get_receipt(token): an object, or null when no such receipt. */
  getReceipt: (token: string) => Promise<Record<string, unknown> | null>;
  /** Receives a fixed word per outcome, never a value. */
  log?: (word: string) => void;
};

export const DEFAULT_ALLOWED_HOSTS = "feedost.vercel.app,feedost-*-nithinvukkusilas-projects.vercel.app";

function hostMatches(pattern: string, host: string): boolean {
  const re = new RegExp("^" + pattern.split("*").map((part) => part.replace(/[^a-z0-9-]/g, "\\$&")).join("[a-z0-9-]+") + "$");
  return re.test(host);
}

function allowedOrigin(origin: string | null, env: Deps["env"]): string | null {
  if (!origin) return null;
  if (env.APP_ENV === "local" && origin === "http://localhost:3000") return origin;
  const match = /^https:\/\/([a-z0-9.-]+)$/.exec(origin);
  if (!match) return null;
  const patterns = (env.RECEIPT_ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS).split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return patterns.some((pattern) => hostMatches(pattern, match[1])) ? origin : null;
}

const SAFE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
};

function respond(status: number, body: Record<string, unknown>, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...SAFE_HEADERS, ...cors, ...extra } });
}
const codeOnly = (status: number, code: Code, cors: Record<string, string>, extra: Record<string, string> = {}) => respond(status, { code }, cors, extra);

function clientIp(req: Request): string {
  const h = req.headers;
  // x-forwarded-for is deliberately not read (a caller can set it). Same rule and same open check (H7) as waitlist-join:
  // until confirmed on staging an unknown caller shares one "unknown" bucket, and the per-token limit is the real guard.
  const ip = h.get("cf-connecting-ip") ?? h.get("x-real-ip");
  return (ip ?? "").trim() || "unknown";
}

async function readLimited(req: Request): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** Copies only the allowed keys, chosen by the receipt's status. Returns null if the status is not one we know. */
export function allowListed(row: Record<string, unknown>): Record<string, unknown> | null {
  const keys: readonly string[] | null =
    row.status === "cancelled" ? CANCELLED_KEYS : row.status === "paid" || row.status === "part_paid" ? LIVE_KEYS : null;
  if (!keys) return null;
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = row[k] ?? null;
  return out;
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const log = deps.log ?? ((word: string) => console.log(word));
  const origin = allowedOrigin(req.headers.get("origin"), deps.env);
  const cors: Record<string, string> = origin ? { "Access-Control-Allow-Origin": origin } : {};

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: origin
        ? { ...SAFE_HEADERS, ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "86400" }
        : { ...SAFE_HEADERS },
    });
  }
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
      await deps.getReceipt(DUMMY_TOKEN);
      log("not_found");
      return codeOnly(404, "not_found", cors);
    }

    if (!(await deps.hitToken(await deps.hashToken(token, hour), LIMIT_PER_TOKEN_PER_HOUR))) {
      log("rate_limited");
      return codeOnly(429, "rate_limited", cors, { "Retry-After": "3600" });
    }

    const row = await deps.getReceipt(token);
    if (!row) {
      log("not_found");
      return codeOnly(404, "not_found", cors);
    }
    const receipt = allowListed(row);
    if (!receipt) {
      log("error");
      return codeOnly(500, "error", cors);
    }
    log("ok");
    return respond(200, { code: "ok", receipt }, cors);
  } catch {
    log("error");
    return codeOnly(500, "error", cors);
  }
}
