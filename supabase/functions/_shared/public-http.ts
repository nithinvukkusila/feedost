// R1-9 Part A: the plumbing the public pay-page and record-consent functions share (a straight lift of receipt/handler.ts,
// which keeps its own copy for now). Pure functions only, so Node tests them and no Deno API is needed here.

export const MAX_BODY_BYTES = 512;

/** Tokens are 24 URL-safe characters from the database (22 at least). The upper bound only stops absurd input. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;
/** Looked up when the caller's token is malformed, so a bad shape costs about the same work as an unknown token. */
export const DUMMY_TOKEN = "0000000000000000000000";

export const DEFAULT_ALLOWED_HOSTS = "feedost.vercel.app,feedost-*-nithinvukkusilas-projects.vercel.app";

export type Code = "ok" | "not_found" | "invalid" | "rate_limited" | "error" | "stale_notice";

export const SAFE_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
};

/** `*` in a pattern stands for part of one hostname label. */
export function hostMatches(pattern: string, host: string): boolean {
  const re = new RegExp("^" + pattern.split("*").map((part) => part.replace(/[^a-z0-9-]/g, "\\$&")).join("[a-z0-9-]+") + "$");
  return re.test(host);
}

/** Returns the origin to echo in CORS, or null. `allowedHosts` is the function's own optional setting (comma separated). */
export function allowedOrigin(origin: string | null, appEnv: string | undefined, allowedHosts: string | undefined): string | null {
  if (!origin) return null;
  if (appEnv === "local" && origin === "http://localhost:3000") return origin;
  const match = /^https:\/\/([a-z0-9.-]+)$/.exec(origin);
  if (!match) return null;
  const patterns = (allowedHosts || DEFAULT_ALLOWED_HOSTS).split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  return patterns.some((pattern) => hostMatches(pattern, match[1])) ? origin : null;
}

export function respond(status: number, body: Record<string, unknown>, cors: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...SAFE_HEADERS, ...cors, ...extra } });
}

export const codeOnly = (status: number, code: Code, cors: Record<string, string>, extra: Record<string, string> = {}) =>
  respond(status, { code }, cors, extra);

/** The answer to a CORS preflight: allowed headers only for an allowed origin. */
export function preflight(origin: string | null, cors: Record<string, string>): Response {
  return new Response(null, {
    status: 204,
    headers: origin
      ? { ...SAFE_HEADERS, ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "86400" }
      : { ...SAFE_HEADERS },
  });
}

export function clientIp(req: Request): string {
  const h = req.headers;
  // x-forwarded-for is deliberately not read (a caller can set it). Same rule and same open check (H7) as waitlist-join and
  // receipt: until confirmed on staging an unknown caller shares one "unknown" bucket, and the per-token limit is the real guard.
  const ip = h.get("cf-connecting-ip") ?? h.get("x-real-ip");
  return (ip ?? "").trim() || "unknown";
}

/** Reads the body up to `max` bytes. Returns null when it is larger (declared or streamed). */
export async function readLimited(req: Request, max: number = MAX_BODY_BYTES): Promise<string | null> {
  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
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
