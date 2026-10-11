// R0-4: the whole behaviour of waitlist-join as a pure function, so Node can test it with fake dependencies.
// Order: CORS preflight, method, size, JSON, honeypot, rate limit, validation, insert.
// It answers with a code only: ok, invalid, rate_limited, error. It never returns or logs a name, phone, city or IP.
import { parseBody } from "../_shared/waitlist-rules.ts";
import type { WaitlistRow } from "../_shared/waitlist-rules.ts";

/** Founder-changeable: requests allowed per IP per hour. */
export const LIMIT_PER_HOUR = 5;
export const MAX_BODY_BYTES = 2048;
/** The hidden field a person never fills. A bot that fills every input fills this one. */
export const HONEYPOT_FIELD = "website";

export type Code = "ok" | "invalid" | "rate_limited" | "error";

export type Deps = {
  env: { APP_ENV?: string; /** Comma-separated hostnames; `*` stands for part of one label (the preview pattern). Unset means DEFAULT_ALLOWED_HOSTS. */ WAITLIST_ALLOWED_HOSTS?: string };
  now: () => Date;
  /** HMAC of the IP and the hour, with a secret the function holds. The raw IP goes no further than this call. */
  hashIp: (ip: string, hour: string) => Promise<string>;
  /** Counts this hash for the hour; true while still within LIMIT_PER_HOUR. */
  hit: (hash: string) => Promise<boolean>;
  /** Insert that does nothing on a duplicate phone (the first row is kept). */
  insert: (row: WaitlistRow) => Promise<void>;
  /** Receives a fixed word per outcome, never a value. */
  log?: (word: string) => void;
};

// Only this project's hostnames: the production domain (src/config/brand.ts: feedost.vercel.app) and this project's
// preview pattern. Not every *.vercel.app site. Override with the WAITLIST_ALLOWED_HOSTS env value.
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
  const patterns = (env.WAITLIST_ALLOWED_HOSTS || DEFAULT_ALLOWED_HOSTS).split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return patterns.some((pattern) => hostMatches(pattern, match[1])) ? origin : null;
}

function respond(status: number, code: Code, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ code }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin", ...cors, ...extra },
  });
}

function clientIp(req: Request): string {
  const h = req.headers;
  // x-forwarded-for is deliberately not read: a client can set it, which would let one caller pick a fresh
  // rate-limit bucket per request. Staging step H7 must confirm which of these two headers the platform really sets;
  // until then an unknown caller shares one "unknown" bucket.
  const ip = h.get("cf-connecting-ip") ?? h.get("x-real-ip");
  return (ip ?? "").trim() || "unknown";
}

/** Reads at most MAX_BODY_BYTES; returns null if the body is larger. */
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

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const log = deps.log ?? ((word: string) => console.log(word));
  const origin = allowedOrigin(req.headers.get("origin"), deps.env);
  const cors: Record<string, string> = origin ? { "Access-Control-Allow-Origin": origin } : {};

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: origin
        ? { ...cors, Vary: "Origin", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "86400" }
        : { Vary: "Origin" },
    });
  }
  if (req.method !== "POST") return respond(405, "invalid", cors, { Allow: "POST, OPTIONS" });

  try {
    const text = await readLimited(req);
    if (text === null) {
      log("too_large");
      return respond(413, "invalid", cors);
    }

    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      log("invalid");
      return respond(400, "invalid", cors);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      log("invalid");
      return respond(400, "invalid", cors);
    }

    // A filled honeypot gets the same answer as a real join and touches nothing.
    const trap = (body as Record<string, unknown>)[HONEYPOT_FIELD];
    if (trap !== undefined && trap !== null && trap !== "") {
      log("honeypot");
      return respond(200, "ok", cors);
    }

    const hour = deps.now().toISOString().slice(0, 13); // 2026-10-11T09
    const hash = await deps.hashIp(clientIp(req), hour);
    if (!(await deps.hit(hash))) {
      log("rate_limited");
      return respond(429, "rate_limited", cors);
    }

    const parsed = parseBody(body);
    if (!parsed.ok) {
      log("invalid");
      return respond(400, "invalid", cors);
    }

    // A duplicate number does nothing and answers the same as a new one.
    await deps.insert(parsed.value);
    log("ok");
    return respond(200, "ok", cors);
  } catch {
    log("error");
    return respond(500, "error", cors);
  }
}
