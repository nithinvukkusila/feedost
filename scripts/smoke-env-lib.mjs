// The rules of `pnpm smoke:env` (F4 criterion 43). Pure except for the injected fetch, so tests
// can use a fake network. It never prints a key.
export const ENV_NAMES = ["local", "staging", "production"];
const REF = /^[a-z0-9]{20}$/;

/** Turns arguments and the environments file into { url, expect }. Throws a clear Error. */
export function resolveTarget(argv, environments) {
  const urlFlag = argv.indexOf("--url");
  const expectFlag = argv.indexOf("--expect");
  if (urlFlag > -1 || expectFlag > -1) {
    const url = argv[urlFlag + 1];
    const expect = argv[expectFlag + 1];
    if (urlFlag < 0 || !url || url.startsWith("--")) throw new Error("smoke:env: --url needs a value");
    if (!ENV_NAMES.includes(expect)) throw new Error(`smoke:env: --expect must be one of ${ENV_NAMES.join(", ")}`);
    return { url: url.replace(/\/+$/, ""), expect };
  }
  const name = argv.find((a) => !a.startsWith("--"));
  if (!ENV_NAMES.includes(name)) {
    throw new Error(`smoke:env: unknown environment "${name ?? ""}". Use one of ${ENV_NAMES.join(", ")}, or --url <url> --expect <env>`);
  }
  const entry = environments?.[name];
  if (name === "local") {
    if (!entry?.url) throw new Error("smoke:env: no local url in supabase/environments.json");
    return { url: entry.url.replace(/\/+$/, ""), expect: name };
  }
  if (!entry || entry.ref === null || entry.ref === undefined || entry.ref === "") {
    throw new Error(`smoke:env: no project recorded for ${name}. Fill its ref in supabase/environments.json first`);
  }
  if (typeof entry.ref !== "string" || !REF.test(entry.ref)) {
    throw new Error(`smoke:env: the ${name} ref in supabase/environments.json is not a 20-character project ref`);
  }
  return { url: `https://${entry.ref}.supabase.co`, expect: name };
}

function jwtPayload(key) {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Shape check only, no network. Returns a problem string or null. Never echoes the key. */
export function checkKeyShape(key, url) {
  if (!key) return null;
  if (key.startsWith("sb_publishable_")) return null;
  if (key.startsWith(["sb", "secret"].join("_") + "_")) return "the anon key variable holds a secret-style key";
  const payload = jwtPayload(key);
  if (!payload) return "the anon key is neither a JWT nor a publishable key";
  if (payload.role !== "anon") return "the anon key is a JWT whose role is not anon";
  if (payload.ref !== undefined) {
    const host = new URL(url).hostname;
    if (`${payload.ref}.supabase.co` !== host) return "the anon key belongs to a different project than the URL";
  }
  return null;
}

/**
/**
 * Calls health. Resolves { ok, message }; message is the environment name when ok.
 * @param {{ url: string, expect: string, anonKey?: string, fetchImpl?: typeof fetch, timeoutMs?: number }} options
 */
export async function smoke({ url, expect, anonKey, fetchImpl = fetch, timeoutMs = 8000 }) {
  const keyProblem = checkKeyShape(anonKey, url);
  if (keyProblem) return { ok: false, message: `smoke:env: ${keyProblem}` };
  const paused = "project may be paused or the function is not deployed";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  let text;
  try {
    res = await fetchImpl(`${url}/functions/v1/health`, { signal: controller.signal });
    text = await res.text();
  } catch {
    return { ok: false, message: `smoke:env: cannot reach ${expect}: ${paused}` };
  } finally {
    clearTimeout(timer);
  }
  if (res.status >= 500 || res.status === 404) {
    return { ok: false, message: `smoke:env: health answered ${res.status}: ${paused}` };
  }
  if (res.status !== 200) return { ok: false, message: `smoke:env: health answered ${res.status}, expected 200` };
  if (!/^application\/json\b/i.test(res.headers.get("content-type") ?? "")) {
    return { ok: false, message: "smoke:env: health did not answer JSON" };
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, message: "smoke:env: health answered something that is not JSON" };
  }
  const keys = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body).sort() : [];
  if (keys.length !== 2 || keys[0] !== "env" || keys[1] !== "ok" || body.ok !== true || typeof body.env !== "string") {
    return { ok: false, message: "smoke:env: health answered the wrong shape, expected only ok and env" };
  }
  if (body.env !== expect) {
    return { ok: false, message: `smoke:env: expected ${expect} but the project says ${String(body.env).slice(0, 20)}` };
  }
  return { ok: true, message: body.env };
}
