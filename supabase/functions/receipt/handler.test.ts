// @vitest-environment node
// R1-7 Part B criteria 23 to 27: the receipt handler, called directly with fake dependencies.
import { describe, expect, it } from "vitest";
import { CANCELLED_KEYS, DUMMY_TOKEN, LIMIT_PER_IP_PER_HOUR, LIMIT_PER_TOKEN_PER_HOUR, LIVE_KEYS, MAX_BODY_BYTES, handle, type Deps } from "./handler.ts";

const IP = "203.0.113.77";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx"; // 24 characters
const OTHER = "ZyXwVuTsRqPoNmLkJiHgFeDc";

const LIVE = {
  receipt_no: 12, status: "part_paid", tutor_name: "Asha Rao", tutor_subjects: ["Maths"], student_name: "Ravi", parent_name: "Sunita",
  month: "2026-10-01", amount: 50000, method: "upi", paid_on: "2026-10-06", balance_after: 70000, language: "hi",
};
const CANCELLED = { receipt_no: 12, status: "cancelled", tutor_name: "Asha Rao", student_name: "Ravi", language: "hi" };
// Things the database must never send; if one ever leaked in, the allow-list must still drop it.
const LEAKY = { ...LIVE, tutor_id: "t", student_id: "s", due_id: "d", id: "p", phone: "+919876543210", email: "a@b.c", upi_id: "a@upi", parent_phone: "+911234567890", created_at: "x" };

function fake(rows: Record<string, Record<string, unknown>> = { [TOKEN]: LIVE }, overrides: Partial<Deps> = {}) {
  const calls = { hashedIp: [] as string[], hashedToken: [] as string[], ipHits: [] as string[], tokenHits: [] as string[], lookups: [] as string[], logs: [] as string[] };
  const counts = new Map<string, number>();
  const count = (key: string) => {
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    return n;
  };
  const deps: Deps = {
    env: { APP_ENV: "staging" },
    now: () => new Date("2026-10-12T09:30:00Z"),
    async hashIp(ip, hour) {
      calls.hashedIp.push(ip);
      return "ip-" + Buffer.from(ip.split("").reverse().join("") + hour).toString("hex");
    },
    async hashToken(token, hour) {
      calls.hashedToken.push(token);
      return "tk-" + Buffer.from(token.split("").reverse().join("") + hour).toString("hex");
    },
    async hitIp(hash, limit) {
      calls.ipHits.push(hash);
      return count("ip" + hash) <= limit;
    },
    async hitToken(hash, limit) {
      calls.tokenHits.push(hash);
      return count("tk" + hash) <= limit;
    },
    async getReceipt(token) {
      calls.lookups.push(token);
      return rows[token] ?? null;
    },
    log: (w) => calls.logs.push(w),
    ...overrides,
  };
  return { deps, calls };
}

const post = (body: unknown, headers: Record<string, string> = {}, raw?: string) =>
  new Request("https://x.test/functions/v1/receipt", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": IP, ...headers },
    body: raw ?? JSON.stringify(body),
  });

describe("a good token", () => {
  it("answers 200 with exactly the live key list", async () => {
    const { deps } = fake();
    const res = await handle(post({ token: TOKEN }), deps);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { code: string; receipt: Record<string, unknown> };
    expect(json.code).toBe("ok");
    expect(Object.keys(json.receipt).sort()).toEqual([...LIVE_KEYS].sort());
    expect(json.receipt).toEqual(LIVE);
  });

  it("drops any extra key the database might send", async () => {
    const { deps } = fake({ [TOKEN]: LEAKY });
    const json = (await (await handle(post({ token: TOKEN }), deps)).json()) as { receipt: Record<string, unknown> };
    expect(Object.keys(json.receipt).sort()).toEqual([...LIVE_KEYS].sort());
    expect(JSON.stringify(json)).not.toMatch(/phone|email|upi_id|tutor_id|student_id|due_id|created_at|9876543210/);
  });

  it("a cancelled receipt carries only its five keys, even if more arrive", async () => {
    const { deps } = fake({ [TOKEN]: { ...CANCELLED, amount: 50000, method: "upi", balance_after: 1, paid_on: "2026-10-06" } });
    const json = (await (await handle(post({ token: TOKEN }), deps)).json()) as { receipt: Record<string, unknown> };
    expect(Object.keys(json.receipt).sort()).toEqual([...CANCELLED_KEYS].sort());
    expect(json.receipt).toEqual(CANCELLED);
  });

  it("an unknown status from the database is an error, not a pass-through", async () => {
    const { deps } = fake({ [TOKEN]: { ...LIVE, status: "weird" } });
    const res = await handle(post({ token: TOKEN }), deps);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"code":"error"}');
  });
});

describe("bad tokens", () => {
  const bodies: [string, unknown][] = [
    ["unknown", { token: OTHER }],
    ["short", { token: "abc" }],
    ["21 characters", { token: "A".repeat(21) }],
    ["empty", { token: "" }],
    ["missing", {}],
    ["not a string", { token: 12345 }],
    ["bad characters", { token: "AbCdEfGhIjKlMnOpQrStUv!!" }],
    ["too long", { token: "A".repeat(65) }],
  ];

  it("all give the same 404 body, byte for byte", async () => {
    const seen = new Set<string>();
    for (const [, body] of bodies) {
      const { deps } = fake();
      const res = await handle(post(body), deps);
      expect(res.status).toBe(404);
      seen.add(await res.text());
    }
    expect([...seen]).toEqual(['{"code":"not_found"}']);
  });

  it("a malformed token still does one lookup, with the dummy, never the caller's value", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: "short" }), deps);
    expect(calls.lookups).toEqual([DUMMY_TOKEN]);
    expect(calls.tokenHits).toEqual([]);
  });

  it("an unknown well-formed token does one lookup and counts against its own hash", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: OTHER }), deps);
    expect(calls.lookups).toEqual([OTHER]);
    expect(calls.tokenHits).toHaveLength(1);
  });
});

describe("shape of the request", () => {
  it("GET, PUT and DELETE are 405 with Allow", async () => {
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      const { deps, calls } = fake();
      const res = await handle(new Request("https://x.test/functions/v1/receipt?token=" + TOKEN, { method }), deps);
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST, OPTIONS");
      expect(calls.lookups).toEqual([]);
    }
  });

  it("a body over the limit is 413 and nothing is looked up", async () => {
    const { deps, calls } = fake();
    const res = await handle(post(null, {}, JSON.stringify({ token: TOKEN, pad: "x".repeat(MAX_BODY_BYTES) })), deps);
    expect(res.status).toBe(413);
    expect(calls.lookups).toEqual([]);
  });

  it("not JSON, an array and null are 400", async () => {
    for (const raw of ["nope", "[]", "null", ""]) {
      const { deps } = fake();
      const res = await handle(post(null, {}, raw), deps);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('{"code":"invalid"}');
    }
  });
});

describe("rate limits", () => {
  it("the 61st request from one hashed IP is 429 and does no lookup", async () => {
    const { deps, calls } = fake();
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR; i++) {
      const tok = i % 2 ? TOKEN : OTHER; // spread over tokens so only the IP limit can trip
      expect((await handle(post({ token: tok }), deps)).status).not.toBe(429);
    }
    const before = calls.lookups.length;
    const res = await handle(post({ token: TOKEN }), deps);
    expect(res.status).toBe(429);
    expect(await res.text()).toBe('{"code":"rate_limited"}');
    expect(calls.lookups.length).toBe(before);
  });

  it("another IP is counted separately", async () => {
    const { deps } = fake();
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR + 1; i++) await handle(post({ token: OTHER }), deps);
    expect((await handle(post({ token: TOKEN }, { "cf-connecting-ip": "198.51.100.9" }), deps)).status).toBe(200);
  });

  it("the 121st request for one token is 429, from different IPs", async () => {
    const { deps, calls } = fake();
    for (let i = 0; i < LIMIT_PER_TOKEN_PER_HOUR; i++) {
      expect((await handle(post({ token: TOKEN }, { "cf-connecting-ip": `10.0.${Math.floor(i / 50)}.${i % 50}` }), deps)).status).toBe(200);
    }
    const before = calls.lookups.length;
    const res = await handle(post({ token: TOKEN }, { "cf-connecting-ip": "10.9.9.9" }), deps);
    expect(res.status).toBe(429);
    expect(calls.lookups.length).toBe(before);
  });

  it("x-forwarded-for is not used to pick a bucket", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: TOKEN }, { "cf-connecting-ip": "", "x-forwarded-for": "1.2.3.4" }), deps);
    expect(calls.hashedIp).toEqual(["unknown"]);
  });
});

describe("what never leaves the function", () => {
  it("the raw IP and the raw token reach only the hashers (and the token only the lookup)", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: TOKEN }), deps);
    await handle(post({ token: "short-and-odd" }), deps);
    expect(calls.hashedIp).toEqual([IP, IP]);
    expect(calls.hashedToken).toEqual([TOKEN]);
    for (const seen of [...calls.ipHits, ...calls.tokenHits, ...calls.logs]) {
      expect(seen).not.toContain(IP);
      expect(seen).not.toContain(TOKEN);
    }
    expect(calls.lookups).toEqual([TOKEN, DUMMY_TOKEN]);
  });

  it("logs come from a fixed set of words", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: TOKEN }), deps);
    await handle(post({ token: OTHER }), deps);
    await handle(post(null, {}, "nope"), deps);
    await handle(post(null, {}, "x".repeat(MAX_BODY_BYTES + 1)), deps);
    expect(new Set(calls.logs)).toEqual(new Set(["ok", "not_found", "invalid", "too_large"]));
    expect(calls.logs.join(" ")).not.toMatch(/Asha|Ravi|50000|Sunita/);
  });

  it("a thrown dependency is a 500 with no detail", async () => {
    for (const overrides of [
      { getReceipt: async () => { throw new Error("db password hunter2 at " + TOKEN); } },
      { hitIp: async () => { throw new Error("boom " + IP); } },
      { hashIp: async () => { throw new Error("salt missing"); } },
    ] as Partial<Deps>[]) {
      const { deps, calls } = fake(undefined, overrides);
      const res = await handle(post({ token: TOKEN }), deps);
      expect(res.status).toBe(500);
      expect(await res.text()).toBe('{"code":"error"}');
      expect(calls.logs).toEqual(["error"]);
    }
  });
});

describe("headers and CORS", () => {
  it("every kind of answer is no-store, noindex, no-referrer", async () => {
    const { deps } = fake();
    const answers = [
      await handle(post({ token: TOKEN }), deps),
      await handle(post({ token: OTHER }), deps),
      await handle(post(null, {}, "nope"), deps),
      await handle(new Request("https://x.test/", { method: "GET" }), deps),
      await handle(new Request("https://x.test/", { method: "OPTIONS" }), deps),
    ];
    for (const res of answers) {
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-robots-tag")).toContain("noindex");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    }
  });

  it("echoes an allowed origin and not an unknown one", async () => {
    const { deps } = fake();
    const ok = await handle(post({ token: TOKEN }, { origin: "https://feedost.vercel.app" }), deps);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://feedost.vercel.app");
    const bad = await handle(post({ token: TOKEN }, { origin: "https://evil.example" }), deps);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    const other = await handle(post({ token: TOKEN }, { origin: "https://other.vercel.app" }), deps);
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("the preflight allows POST and content-type for an allowed origin only", async () => {
    const { deps } = fake();
    const ok = await handle(new Request("https://x.test/", { method: "OPTIONS", headers: { origin: "https://feedost.vercel.app" } }), deps);
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    const bad = await handle(new Request("https://x.test/", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), deps);
    expect(bad.status).toBe(204);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("localhost is allowed only when APP_ENV is local", async () => {
    const local = fake(undefined, { env: { APP_ENV: "local" } });
    expect((await handle(post({ token: TOKEN }, { origin: "http://localhost:3000" }), local.deps)).headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    const staging = fake();
    expect((await handle(post({ token: TOKEN }, { origin: "http://localhost:3000" }), staging.deps)).headers.get("access-control-allow-origin")).toBeNull();
  });
});
