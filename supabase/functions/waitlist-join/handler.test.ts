// @vitest-environment node
// R0-4 criteria 6, 7, 13 to 16, 18, 23: the waitlist-join handler, called directly with fake dependencies.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { WaitlistRow } from "../_shared/waitlist-rules.ts";
import { HONEYPOT_FIELD, LIMIT_PER_HOUR, MAX_BODY_BYTES, handle, type Deps } from "./handler.ts";

const vectors = JSON.parse(readFileSync(join(__dirname, "../_shared/waitlist-vectors.json"), "utf8")) as {
  phone: { in: unknown; out: string | null }[];
  bodies: { label: string; in: unknown; out: unknown }[];
  language: { in: unknown; ok: boolean }[];
};

const GOOD = { name: "Asha Rao", phone: "098765 43210", city: "Bengaluru", students_count: 10, language: "kn" };
const IP = "203.0.113.77";

function fake(overrides: Partial<Deps> = {}) {
  const calls = { hashed: [] as [string, string][], hits: [] as string[], inserts: [] as WaitlistRow[], logs: [] as string[] };
  const counts = new Map<string, number>();
  const rows = new Map<string, WaitlistRow>();
  const deps: Deps = {
    env: { APP_ENV: "staging" },
    now: () => new Date("2026-10-11T09:30:00Z"),
    async hashIp(ip, hour) {
      calls.hashed.push([ip, hour]);
      return Buffer.from(`k:${ip.split("").reverse().join("")}|${hour}`).toString("hex"); // hex, and does not contain the IP
    },
    async hit(hash) {
      calls.hits.push(hash);
      const n = (counts.get(hash) ?? 0) + 1;
      counts.set(hash, n);
      return n <= LIMIT_PER_HOUR;
    },
    async insert(row) {
      calls.inserts.push(row);
      if (!rows.has(row.phone)) rows.set(row.phone, row); // on conflict do nothing
    },
    log: (w) => calls.logs.push(w),
    ...overrides,
  };
  return { deps, calls, rows };
}

const post = (body: unknown, headers: Record<string, string> = {}, raw?: string) =>
  new Request("https://x.test/functions/v1/waitlist-join", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": IP, ...headers },
    body: raw ?? JSON.stringify(body),
  });

const codeOf = async (res: Response) => (await res.json()) as { code: string };

describe("a good join", () => {
  it("answers 200 ok, inserts the cleaned row, and sends only the code", async () => {
    const { deps, calls } = fake();
    const res = await handle(post(GOOD), deps);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"code":"ok"}');
    expect(calls.inserts).toEqual([{ name: "Asha Rao", phone: "+919876543210", city: "Bengaluru", students_count: 10, language: "kn" }]);
  });

  it("ignores unknown fields", async () => {
    const { deps, calls } = fake();
    await handle(post({ ...GOOD, id: "x", email: "a@b.c", created_at: "then" }), deps);
    expect(Object.keys(calls.inserts[0]).sort()).toEqual(["city", "language", "name", "phone", "students_count"]);
  });
});

describe("duplicate number (criterion 13)", () => {
  it("answers the same body and status as a new number, and keeps the first row", async () => {
    const { deps, rows } = fake();
    const first = await handle(post(GOOD), deps);
    const again = await handle(post({ ...GOOD, name: "Someone Else", phone: "+91 98765 43210", city: "Pune", students_count: 60 }), deps);
    expect(again.status).toBe(first.status);
    expect(await again.text()).toBe(await first.text());
    expect(rows.size).toBe(1);
    expect(rows.get("+919876543210")!.name).toBe("Asha Rao");
  });

  it("still calls insert for a duplicate (no early return that would show who is on the list)", async () => {
    const { deps, calls } = fake();
    await handle(post(GOOD), deps);
    await handle(post(GOOD), deps);
    expect(calls.inserts).toHaveLength(2);
  });
});

describe("honeypot (criterion 14)", () => {
  it.each(["http://spam.test", "x", " "])("filled with %j: same success, no insert, no rate-limit call", async (trap) => {
    const { deps, calls } = fake();
    const res = await handle(post({ ...GOOD, [HONEYPOT_FIELD]: trap }), deps);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"code":"ok"}');
    expect(calls.inserts).toHaveLength(0);
    expect(calls.hits).toHaveLength(0);
  });

  it("an empty honeypot is a normal join", async () => {
    const { deps, calls } = fake();
    await handle(post({ ...GOOD, [HONEYPOT_FIELD]: "" }), deps);
    expect(calls.inserts).toHaveLength(1);
  });
});

describe("rate limit (criterion 15)", () => {
  it("allows five from one IP and refuses the sixth with 429 and the code only", async () => {
    const { deps, calls } = fake();
    for (let i = 0; i < LIMIT_PER_HOUR; i++) {
      const phone = `+9198765432${String(10 + i)}`;
      expect((await handle(post({ ...GOOD, phone }), deps)).status).toBe(200);
    }
    const sixth = await handle(post({ ...GOOD, phone: "+919876543299" }), deps);
    expect(sixth.status).toBe(429);
    expect(await sixth.text()).toBe('{"code":"rate_limited"}');
    expect(calls.inserts).toHaveLength(LIMIT_PER_HOUR);
  });

  it("another IP has its own count", async () => {
    const { deps } = fake();
    for (let i = 0; i < LIMIT_PER_HOUR + 1; i++) await handle(post(GOOD), deps);
    expect((await handle(post(GOOD, { "cf-connecting-ip": "198.51.100.9" }), deps)).status).toBe(200);
  });

  it("an invalid body also uses up a try", async () => {
    const { deps, calls } = fake();
    await handle(post({ ...GOOD, phone: "12345" }), deps);
    expect(calls.hits).toHaveLength(1);
  });

  it("passes a hex hash that does not contain the IP, and the hour, never the raw IP", async () => {
    const { deps, calls } = fake();
    await handle(post(GOOD), deps);
    expect(calls.hashed).toEqual([[IP, "2026-10-11T09"]]);
    expect(calls.hits).toHaveLength(1);
    expect(calls.hits[0]).toMatch(/^[0-9a-f]+$/);
    expect(calls.hits[0]).not.toContain(IP);
  });

  it("reads the IP from cf-connecting-ip, then x-real-ip, then the first x-forwarded-for entry", async () => {
    const seen: string[] = [];
    const { deps } = fake({ hashIp: async (ip) => (seen.push(ip), "ab") });
    await handle(post(GOOD, { "x-real-ip": "10.0.0.2", "x-forwarded-for": "10.0.0.3, 10.0.0.4" }), deps);
    const noCf = new Request("https://x.test/", { method: "POST", headers: { "x-real-ip": "10.0.0.2", "x-forwarded-for": "10.0.0.3, 10.0.0.4" }, body: JSON.stringify(GOOD) });
    await handle(noCf, deps);
    const xffOnly = new Request("https://x.test/", { method: "POST", headers: { "x-forwarded-for": "10.0.0.3, 10.0.0.4" }, body: JSON.stringify(GOOD) });
    await handle(xffOnly, deps);
    expect(seen).toEqual([IP, "10.0.0.2", "10.0.0.3"]);
  });

  it("fails closed with a code only when the counter is down", async () => {
    const { deps, calls } = fake({ hit: async () => { throw new Error("db password=hunter2 down"); } });
    const res = await handle(post(GOOD), deps);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"code":"error"}');
    expect(calls.inserts).toHaveLength(0);
  });
});

describe("validation (criteria 6, 7, 16, 23)", () => {
  it.each(vectors.bodies.filter((v) => typeof v.in === "object" && v.in !== null && !Array.isArray(v.in)).map((v) => [v.label, v] as const))(
    "shared body vector: %s",
    async (_label, v) => {
      const { deps, calls } = fake();
      const res = await handle(post(v.in), deps);
      if (v.out === null) {
        expect(res.status).toBe(400);
        expect(await res.text()).toBe('{"code":"invalid"}');
        expect(calls.inserts).toHaveLength(0);
      } else {
        expect(res.status).toBe(200);
        expect(calls.inserts).toEqual([v.out]);
      }
    },
  );

  it.each(vectors.phone.map((v) => [JSON.stringify(v.in), v] as const))("shared phone vector %s", async (_label, v) => {
    const { deps, calls } = fake();
    const res = await handle(post({ ...GOOD, phone: v.in }), deps);
    if (v.out === null) {
      expect(res.status).toBe(400);
      expect(calls.inserts).toHaveLength(0);
    } else {
      expect(res.status).toBe(200);
      expect(calls.inserts[0].phone).toBe(v.out);
    }
  });

  it.each(vectors.language.map((v) => [JSON.stringify(v.in), v] as const))("shared language vector %s", async (_label, v) => {
    const { deps } = fake();
    expect((await handle(post({ ...GOOD, language: v.in }), deps)).status).toBe(v.ok ? 200 : 400);
  });

  it.each([
    ["not JSON", "not json{"],
    ["an empty body", ""],
    ["a JSON array", "[]"],
    ["a JSON string", '"hello"'],
    ["JSON null", "null"],
  ])("%s answers 400 invalid", async (_label, raw) => {
    const { deps, calls } = fake();
    const res = await handle(post(null, {}, raw), deps);
    expect(res.status).toBe(400);
    expect(await res.text()).toBe('{"code":"invalid"}');
    expect(calls.inserts).toHaveLength(0);
  });
});

describe("method and size (criterion 16)", () => {
  it.each(["GET", "PUT", "PATCH", "DELETE"])("%s answers 405 with Allow", async (method) => {
    const { deps } = fake();
    const res = await handle(new Request("https://x.test/", { method }), deps);
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST, OPTIONS");
    expect(await res.text()).toBe('{"code":"invalid"}');
  });

  it("a body over 2 KB answers 413 and touches nothing", async () => {
    const { deps, calls } = fake();
    const res = await handle(post({ ...GOOD, name: "x".repeat(MAX_BODY_BYTES) }), deps);
    expect(res.status).toBe(413);
    expect(await res.text()).toBe('{"code":"invalid"}');
    expect(calls.hits).toHaveLength(0);
    expect(calls.inserts).toHaveLength(0);
  });

  it("a body over 2 KB with a lying content-length is still refused", async () => {
    const { deps } = fake();
    const res = await handle(post(null, { "content-length": "10" }, "x".repeat(MAX_BODY_BYTES + 1)), deps);
    expect(res.status).toBe(413);
  });

  it("a body of exactly 2 KB is read", async () => {
    const { deps } = fake();
    const pad = JSON.stringify({ ...GOOD, pad: "" });
    const raw = JSON.stringify({ ...GOOD, pad: "x".repeat(MAX_BODY_BYTES - new TextEncoder().encode(pad).length) });
    expect(new TextEncoder().encode(raw).length).toBe(MAX_BODY_BYTES);
    expect((await handle(post(null, {}, raw), deps)).status).toBe(200);
  });
});

describe("CORS (criterion 16)", () => {
  it("OPTIONS from an allowed origin answers 204 with the headers and no body", async () => {
    const { deps, calls } = fake();
    const res = await handle(new Request("https://x.test/", { method: "OPTIONS", headers: { origin: "https://feedost.vercel.app" } }), deps);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(res.headers.get("access-control-allow-origin")).toBe("https://feedost.vercel.app");
    expect(res.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe("content-type");
    expect(calls.hits).toHaveLength(0);
  });

  it("a preview origin is allowed on a POST and echoed exactly", async () => {
    const { deps } = fake();
    const res = await handle(post(GOOD, { origin: "https://feedost-git-r0-4-waitlist-me.vercel.app" }), deps);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://feedost-git-r0-4-waitlist-me.vercel.app");
  });

  it.each(["https://evil.test", "https://vercel.app.evil.test", "https://evilvercel.app", "http://feedost.vercel.app", "http://localhost:3000", "null"])(
    "origin %s gets no CORS header on OPTIONS or POST",
    async (origin) => {
      const { deps } = fake();
      const pre = await handle(new Request("https://x.test/", { method: "OPTIONS", headers: { origin } }), deps);
      expect(pre.headers.get("access-control-allow-origin")).toBeNull();
      expect(pre.headers.get("access-control-allow-methods")).toBeNull();
      const res = await handle(post(GOOD, { origin }), deps);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    },
  );

  it("localhost:3000 is allowed only when APP_ENV is local", async () => {
    const local = fake({ env: { APP_ENV: "local" } });
    const res = await handle(post(GOOD, { origin: "http://localhost:3000" }), local.deps);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
  });

  it("no Origin header (curl) gets no CORS header and still works", async () => {
    const { deps } = fake();
    const res = await handle(post(GOOD), deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("an error response is still CORS-readable by an allowed origin", async () => {
    const { deps } = fake({ insert: async () => { throw new Error("boom"); } });
    const res = await handle(post(GOOD, { origin: "https://feedost.vercel.app" }), deps);
    expect(res.status).toBe(500);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://feedost.vercel.app");
  });
});

describe("errors say nothing (criterion 16)", () => {
  it("a database error becomes {code:error}, with no message, stack or secret in the body", async () => {
    const { deps } = fake({ insert: async () => { throw new Error('duplicate key value violates unique constraint "waitlist_phone_key" password=hunter2'); } });
    const res = await handle(post(GOOD), deps);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe('{"code":"error"}');
    expect(text).not.toMatch(/hunter2|constraint|waitlist|stack|at /);
  });

  it("every response body is exactly one of the four codes", async () => {
    const { deps } = fake();
    const seen = new Set<string>();
    for (const req of [post(GOOD), post(null, {}, "nope"), new Request("https://x.test/", { method: "GET" }), post({ ...GOOD, [HONEYPOT_FIELD]: "z" })]) {
      seen.add((await codeOf(await handle(req, deps))).code);
    }
    for (const code of seen) expect(["ok", "invalid", "rate_limited", "error"]).toContain(code);
  });
});

describe("logging (criterion 18)", () => {
  it("logs only fixed words: no phone, name, city or IP, for every outcome", async () => {
    const run = fake({ insert: async (row) => { if (row.city === "Boom") throw new Error("x"); } });
    const bodies = [
      { ...GOOD, name: "Secret Name", city: "Secret City" },
      { ...GOOD, name: "Secret Name", city: "Boom" },
      { ...GOOD, name: "Secret Name", phone: "12345" },
      { ...GOOD, [HONEYPOT_FIELD]: "bot" },
    ];
    for (const b of bodies) await handle(post(b), run.deps);
    await handle(post(null, {}, "{broken"), run.deps);
    await handle(post(null, {}, "x".repeat(MAX_BODY_BYTES + 1)), run.deps);
    for (let i = 0; i < LIMIT_PER_HOUR; i++) await handle(post(GOOD), run.deps);
    expect(new Set(run.calls.logs)).toEqual(new Set(["ok", "error", "invalid", "honeypot", "too_large", "rate_limited"]));
    const all = run.calls.logs.join("\n");
    for (const secret of ["Secret", "9876543210", "98765", "Bengaluru", "Boom", IP, "kn"]) expect(all).not.toContain(secret);
  });

  it("the default logger writes only fixed words to the console", async () => {
    const lines: unknown[][] = [];
    const original = console.log;
    console.log = (...a: unknown[]) => void lines.push(a);
    try {
      const { deps } = fake();
      delete deps.log;
      await handle(post(GOOD), deps);
    } finally {
      console.log = original;
    }
    expect(lines).toEqual([["ok"]]);
  });
});

describe("source rules", () => {
  const src = (file: string) => readFileSync(join(__dirname, file), "utf8");
  it("handler.ts has no console call but the default logger, no IP, no env access, no database", () => {
    const text = src("handler.ts");
    expect(text.match(/console\./g)).toHaveLength(1);
    expect(text).not.toMatch(/Deno\.|supabase-js|createClient|\.rpc\(|\.from\(/);
  });
  it("index.ts reads only its own named variables and never logs", () => {
    const text = src("index.ts");
    expect(text.match(/Deno\.env\.get\("([^"]+)"\)/g)?.sort()).toEqual(
      ['Deno.env.get("APP_ENV")', 'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")', 'Deno.env.get("SUPABASE_URL")', 'Deno.env.get("WAITLIST_HASH_SALT")'].sort(),
    );
    expect(text).not.toMatch(/console\./);
  });
});
