// @vitest-environment node
// R1-9 Part A criteria 13 to 15: the record-consent handler, called directly with fake dependencies.
import { describe, expect, it } from "vitest";
import { DUMMY_TOKEN, LIMIT_PER_IP_PER_HOUR, LIMIT_PER_TOKEN_PER_HOUR, LIMIT_UNKNOWN_IP_PER_HOUR, MAX_BODY_BYTES, handle, ipHashMessage, tokenHashMessage, type Deps } from "./handler.ts";

const IP = "203.0.113.77";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx"; // 24 characters
const OTHER = "ZyXwVuTsRqPoNmLkJiHgFeDc"; // not known
const ARCHIVED = "ArchivedTokenAbCdEfGhIjKl";
const CURRENT = "v2";

/** A fake of the database: TOKEN is known and wants "v2"; anything else is not found. */
function fake(overrides: Partial<Deps> = {}) {
  const calls = { hashedIp: [] as string[], hashedToken: [] as string[], ipHits: [] as string[], tokenHits: [] as string[], records: [] as [string, string][], versionLookups: [] as string[], logs: [] as string[] };
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
    async recordConsent(token, version) {
      calls.records.push([token, version]);
      if (token !== TOKEN) return "not_found";
      return version === CURRENT ? "ok" : "stale_notice";
    },
    async currentNoticeVersion(token) {
      calls.versionLookups.push(token);
      return token === TOKEN ? CURRENT : null;
    },
    log: (w) => calls.logs.push(w),
    ...overrides,
  };
  return { deps, calls };
}

const post = (body: unknown, headers: Record<string, string> = {}, raw?: string) =>
  new Request("https://x.test/functions/v1/record-consent", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": IP, ...headers },
    body: raw ?? JSON.stringify(body),
  });

describe("a good request", () => {
  it("the current version is 200 ok and logs consent_recorded", async () => {
    const { deps, calls } = fake();
    const res = await handle(post({ token: TOKEN, notice_version: CURRENT }), deps);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"code":"ok"}');
    expect(calls.records).toEqual([[TOKEN, CURRENT]]);
    expect(calls.logs).toEqual(["consent_recorded"]);
  });

  it("a stale version is 409 with the current version, and logs stale_notice", async () => {
    const { deps, calls } = fake();
    const res = await handle(post({ token: TOKEN, notice_version: "v1" }), deps);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "stale_notice", notice_version: CURRENT });
    expect(calls.versionLookups).toEqual([TOKEN]);
    expect(calls.logs).toEqual(["stale_notice"]);
  });

  it("a stale version for a token that stopped being known in between is the plain 404", async () => {
    const { deps } = fake({ currentNoticeVersion: async () => null });
    const res = await handle(post({ token: TOKEN, notice_version: "v1" }), deps);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('{"code":"not_found"}');
  });

  it("an unknown answer from the database is a 500", async () => {
    const { deps } = fake({ recordConsent: async () => "something else" });
    const res = await handle(post({ token: TOKEN, notice_version: CURRENT }), deps);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"code":"error"}');
  });
});

describe("what the body may hold", () => {
  const bad: [string, unknown][] = [
    ["no version", { token: TOKEN }],
    ["no token", { notice_version: CURRENT }],
    ["empty object", {}],
    ["an extra key", { token: TOKEN, notice_version: CURRENT, extra: 1 }],
    ["a student id", { token: TOKEN, notice_version: CURRENT, student_id: "a1000000-0000-4000-8000-000000000001" }],
    ["a tutor id", { token: TOKEN, notice_version: CURRENT, tutor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
    ["a time", { token: TOKEN, notice_version: CURRENT, accepted_at: "2026-10-12T00:00:00Z" }],
    ["a numeric version", { token: TOKEN, notice_version: 1 }],
    ["a null version", { token: TOKEN, notice_version: null }],
    ["a numeric token", { token: 12345, notice_version: CURRENT }],
    ["a null token", { token: null, notice_version: CURRENT }],
    ["an empty version", { token: TOKEN, notice_version: "" }],
    ["an uppercase version", { token: TOKEN, notice_version: "V2" }],
    ["a 17 character version", { token: TOKEN, notice_version: "a".repeat(17) }],
    ["a version with a space", { token: TOKEN, notice_version: "v 2" }],
  ];

  it("each is 400 invalid and costs no counter and no database call", async () => {
    for (const [name, body] of bad) {
      const { deps, calls } = fake();
      const res = await handle(post(body), deps);
      expect(res.status, name).toBe(400);
      expect(await res.text()).toBe('{"code":"invalid"}');
      expect(calls.records, name).toEqual([]);
      expect(calls.ipHits, name).toEqual([]);
    }
  });

  it("not JSON, an array, null and an empty body are 400", async () => {
    for (const raw of ["nope", "[]", "null", "", "12"]) {
      const { deps } = fake();
      const res = await handle(post(null, {}, raw), deps);
      expect(res.status).toBe(400);
    }
  });

  it("a body over the limit is 413, declared or streamed, and nothing is called", async () => {
    const { deps, calls } = fake();
    expect((await handle(post(null, {}, JSON.stringify({ token: TOKEN, notice_version: CURRENT, pad: "x".repeat(MAX_BODY_BYTES) })), deps)).status).toBe(413);
    const lying = post(null, {}, JSON.stringify({ token: TOKEN, notice_version: CURRENT, pad: "x".repeat(MAX_BODY_BYTES) }));
    Object.defineProperty(lying, "headers", { value: new Headers({ "content-length": "10", "cf-connecting-ip": IP }) });
    expect((await handle(lying, deps)).status).toBe(413);
    expect(calls.records).toEqual([]);
  });

  it("GET, PUT, DELETE and PATCH are 405 with Allow", async () => {
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      const { deps, calls } = fake();
      const res = await handle(new Request("https://x.test/functions/v1/record-consent?token=" + TOKEN, { method }), deps);
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST, OPTIONS");
      expect(calls.records).toEqual([]);
    }
  });
});

describe("bad tokens", () => {
  const tokens = [OTHER, ARCHIVED, "short", "", "A".repeat(21), "A".repeat(65), "AbCdEfGhIjKlMnOpQrStUv!!"];

  it("unknown, archived and malformed tokens all give the same 404 body, byte for byte", async () => {
    const seen = new Set<string>();
    for (const token of tokens) {
      const { deps } = fake();
      const res = await handle(post({ token, notice_version: CURRENT }), deps);
      expect(res.status).toBe(404);
      seen.add(await res.text());
    }
    expect([...seen]).toEqual(['{"code":"not_found"}']);
  });

  it("a malformed token still makes one call, with the dummy, never the caller's value", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: "short", notice_version: "v1" }), deps);
    expect(calls.records).toEqual([[DUMMY_TOKEN, "v1"]]);
    expect(calls.tokenHits).toEqual([]);
  });

  it("an unknown well-formed token does one call and counts against its own hash", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: OTHER, notice_version: "v1" }), deps);
    expect(calls.records).toEqual([[OTHER, "v1"]]);
    expect(calls.tokenHits).toHaveLength(1);
    expect(calls.versionLookups).toEqual([]);
  });
});

describe("rate limits", () => {
  it("the 61st request from one hashed IP is 429 with Retry-After and records nothing", async () => {
    const { deps, calls } = fake();
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR; i++) {
      const token = `Tok${String(i).padStart(3, "0")}abcdefghijklmnopq`; // spread over tokens so only the IP limit can trip
      expect((await handle(post({ token, notice_version: CURRENT }), deps)).status).toBe(404);
    }
    const before = calls.records.length;
    const res = await handle(post({ token: TOKEN, notice_version: CURRENT }), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(await res.text()).toBe('{"code":"rate_limited"}');
    expect(calls.records.length).toBe(before);
  });

  it("the 21st request for one token is 429 with Retry-After, from different IPs", async () => {
    const { deps, calls } = fake();
    for (let i = 0; i < LIMIT_PER_TOKEN_PER_HOUR; i++) {
      expect((await handle(post({ token: TOKEN, notice_version: CURRENT }, { "cf-connecting-ip": `10.0.0.${i}` }), deps)).status).toBe(200);
    }
    const before = calls.records.length;
    const res = await handle(post({ token: TOKEN, notice_version: CURRENT }, { "cf-connecting-ip": "10.9.9.9" }), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(calls.records.length).toBe(before);
    expect(LIMIT_PER_TOKEN_PER_HOUR).toBe(20);
  });

  it("callers with no known IP share a bucket with a much higher limit (H7)", async () => {
    const { deps } = fake();
    expect(LIMIT_UNKNOWN_IP_PER_HOUR).toBeGreaterThanOrEqual(1000);
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR + 5; i++) {
      const token = `Tok${String(i).padStart(3, "0")}abcdefghijklmnopq`;
      expect((await handle(post({ token, notice_version: CURRENT }, { "cf-connecting-ip": "" }), deps)).status, `request ${i + 1}`).toBe(404);
    }
  });

  it("x-forwarded-for is not used to pick a bucket", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: TOKEN, notice_version: CURRENT }, { "cf-connecting-ip": "", "x-forwarded-for": "1.2.3.4" }), deps);
    expect(calls.hashedIp).toEqual(["unknown"]);
  });

  it("its hash messages differ from each other", () => {
    expect(ipHashMessage("x", "h")).not.toBe(tokenHashMessage("x", "h"));
    expect(ipHashMessage("x", "h")).toContain("pc-");
  });
});

describe("what never leaves the function", () => {
  it("the raw IP and the raw token reach only the hashers and the database calls", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: TOKEN, notice_version: CURRENT }), deps);
    await handle(post({ token: "short-and-odd", notice_version: CURRENT }), deps);
    expect(calls.hashedIp).toEqual([IP, IP]);
    expect(calls.hashedToken).toEqual([TOKEN]);
    for (const seen of [...calls.ipHits, ...calls.tokenHits, ...calls.logs]) {
      expect(seen).not.toContain(IP);
      expect(seen).not.toContain(TOKEN);
    }
    expect(calls.records).toEqual([[TOKEN, CURRENT], [DUMMY_TOKEN, CURRENT]]);
  });

  it("logs come from a fixed set of words", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: TOKEN, notice_version: CURRENT }), deps);
    await handle(post({ token: TOKEN, notice_version: "v1" }), deps);
    await handle(post({ token: OTHER, notice_version: CURRENT }), deps);
    await handle(post(null, {}, "nope"), deps);
    await handle(post(null, {}, "x".repeat(MAX_BODY_BYTES + 1)), deps);
    expect(new Set(calls.logs)).toEqual(new Set(["consent_recorded", "stale_notice", "not_found", "invalid", "too_large"]));
    for (const word of calls.logs) expect(word).toMatch(/^[a-z_]+$/);
  });

  it("a thrown dependency is a 500 with no detail", async () => {
    for (const overrides of [
      { recordConsent: async () => { throw new Error("db password hunter2 at " + TOKEN); } },
      { currentNoticeVersion: async () => { throw new Error("boom"); } },
      { hitIp: async () => { throw new Error("boom " + IP); } },
      { hitToken: async () => { throw new Error("boom"); } },
      { hashIp: async () => { throw new Error("salt missing"); } },
    ] as Partial<Deps>[]) {
      const { deps, calls } = fake(overrides);
      // A stale version also exercises the version lookup.
      const res = await handle(post({ token: TOKEN, notice_version: "v1" }), deps);
      expect(res.status).toBe(500);
      expect(await res.text()).toBe('{"code":"error"}');
      expect(calls.logs).toEqual(["error"]);
    }
  });
});

describe("headers and CORS", () => {
  it("every kind of answer is no-store, noindex, no-referrer, nosniff", async () => {
    const { deps } = fake();
    const answers = [
      await handle(post({ token: TOKEN, notice_version: CURRENT }), deps),
      await handle(post({ token: TOKEN, notice_version: "v1" }), deps),
      await handle(post({ token: OTHER, notice_version: CURRENT }), deps),
      await handle(post(null, {}, "nope"), deps),
      await handle(post(null, {}, "x".repeat(MAX_BODY_BYTES + 1)), deps),
      await handle(new Request("https://x.test/", { method: "GET" }), deps),
      await handle(new Request("https://x.test/", { method: "OPTIONS" }), deps),
    ];
    for (const res of answers) {
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-robots-tag")).toContain("noindex");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  it("echoes an allowed origin and not an unknown one, and answers the preflight", async () => {
    const { deps } = fake();
    const ok = await handle(post({ token: TOKEN, notice_version: CURRENT }, { origin: "https://feedost.vercel.app" }), deps);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://feedost.vercel.app");
    const bad = await handle(post({ token: TOKEN, notice_version: CURRENT }, { origin: "https://evil.example" }), deps);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    const pre = await handle(new Request("https://x.test/", { method: "OPTIONS", headers: { origin: "https://feedost.vercel.app" } }), deps);
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    const preBad = await handle(new Request("https://x.test/", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), deps);
    expect(preBad.headers.get("access-control-allow-origin")).toBeNull();
  });
});
