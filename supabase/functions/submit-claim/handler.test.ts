// @vitest-environment node
// R1-10 Part A criteria 13 and 14: the submit-claim handler, called directly with fake dependencies.
import { describe, expect, it } from "vitest";
import {
  DUMMY_TOKEN, LIMIT_PER_IP_PER_HOUR, LIMIT_PER_TOKEN_PER_HOUR, LIMIT_UNKNOWN_IP_PER_HOUR, MAX_BODY_BYTES, STATUS_OF,
  handle, ipHashMessage, tokenHashMessage, type Deps, type LogWord,
} from "./handler.ts";

const IP = "203.0.113.77";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx"; // 24 characters, known
const OTHER = "ZyXwVuTsRqPoNmLkJiHgFeDc"; // not known
const REF = "6281 0473 9915";
const DIGITS = "628104739915";

/** A fake of the database: TOKEN is known and answers `answer`; anything else is not found. */
function fake(answer = "ok", overrides: Partial<Deps> = {}) {
  const calls = { hashedIp: [] as string[], hashedToken: [] as string[], ipHits: [] as string[], tokenHits: [] as string[], submits: [] as [string, string][], logs: [] as string[] };
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
    async submitClaim(token, upiRef) {
      calls.submits.push([token, upiRef]);
      return token === TOKEN ? answer : "not_found";
    },
    log: (w) => calls.logs.push(w),
    ...overrides,
  };
  return { deps, calls };
}

const post = (body: unknown, headers: Record<string, string> = {}, raw?: string) =>
  new Request("https://x.test/functions/v1/submit-claim", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": IP, ...headers },
    body: raw ?? JSON.stringify(body),
  });

describe("a good request", () => {
  it("sends the 12 digits (spaces removed) to submit_claim, answers 200 ok and logs ok", async () => {
    const { deps, calls } = fake("ok");
    const res = await handle(post({ token: TOKEN, upi_ref: REF }), deps);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"code":"ok"}');
    expect(calls.submits).toEqual([[TOKEN, DIGITS]]);
    expect(calls.logs).toEqual(["ok"]);
  });

  it("hyphens and the bare digits are the same reference", async () => {
    const { deps, calls } = fake("ok");
    await handle(post({ token: TOKEN, upi_ref: "6281-0473-9915" }), deps);
    await handle(post({ token: TOKEN, upi_ref: DIGITS }), deps);
    expect(calls.submits).toEqual([[TOKEN, DIGITS], [TOKEN, DIGITS]]);
  });
});

describe("every code has one fixed status and a code-only body", () => {
  const table: [string, number][] = [
    ["ok", 200], ["not_found", 404], ["bad_reference", 422], ["no_proof", 422],
    ["duplicate_reference", 409], ["already_pending", 409], ["nothing_owed", 409], ["consent_needed", 403],
  ];

  for (const [code, status] of table) {
    it(`${code} is ${status}`, async () => {
      const { deps, calls } = fake(code);
      const res = await handle(post({ token: TOKEN, upi_ref: REF }), deps);
      expect(res.status).toBe(status);
      expect(await res.text()).toBe(JSON.stringify({ code }));
      expect(calls.logs).toHaveLength(1);
      expect(["ok", "not_found", "refused"]).toContain(calls.logs[0]);
    });
  }

  it("the table in the handler is exactly this one", () => {
    expect(Object.entries(STATUS_OF).sort()).toEqual([...table].sort());
  });

  it("an answer the function does not know is a 500 with no detail", async () => {
    const { deps, calls } = fake("something else");
    const res = await handle(post({ token: TOKEN, upi_ref: REF }), deps);
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"code":"error"}');
    expect(calls.logs).toEqual(["error"]);
  });
});

describe("the reference check answers without the database", () => {
  it("a short, long, lettered or Devanagari reference is 422 bad_reference and no database call", async () => {
    for (const upi_ref of ["62810473991", "6281047399151", "62810473991a", "६२८१०४७३९९१५"]) {
      const { deps, calls } = fake();
      const res = await handle(post({ token: TOKEN, upi_ref }), deps);
      expect(res.status, upi_ref).toBe(422);
      expect(await res.text()).toBe('{"code":"bad_reference"}');
      expect(calls.submits, upi_ref).toEqual([]);
    }
  });

  it("an empty reference is 422 no_proof and no database call", async () => {
    for (const upi_ref of ["", "   ", " - "]) {
      const { deps, calls } = fake();
      const res = await handle(post({ token: TOKEN, upi_ref }), deps);
      expect(res.status).toBe(422);
      expect(await res.text()).toBe('{"code":"no_proof"}');
      expect(calls.submits).toEqual([]);
    }
  });
});

describe("what the body may hold", () => {
  const bad: [string, unknown][] = [
    ["no reference", { token: TOKEN }],
    ["no token", { upi_ref: REF }],
    ["empty object", {}],
    ["an extra key", { token: TOKEN, upi_ref: REF, extra: 1 }],
    ["an amount", { token: TOKEN, upi_ref: REF, amount: 1 }],
    ["a student id", { token: TOKEN, upi_ref: REF, student_id: "a1000000-0000-4000-8000-000000000001" }],
    ["a tutor id", { token: TOKEN, upi_ref: REF, tutor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }],
    ["a time", { token: TOKEN, upi_ref: REF, created_at: "2026-10-12T00:00:00Z" }],
    ["a screenshot path (Part D)", { token: TOKEN, upi_ref: REF, screenshot_path: "x/y.png" }],
    ["a numeric reference", { token: TOKEN, upi_ref: 628104739915 }],
    ["a null reference", { token: TOKEN, upi_ref: null }],
    ["a numeric token", { token: 12345, upi_ref: REF }],
    ["a null token", { token: null, upi_ref: REF }],
    ["a 65 character reference", { token: TOKEN, upi_ref: "1".repeat(65) }],
  ];

  it("each is 400 invalid and costs no counter and no database call", async () => {
    for (const [name, body] of bad) {
      const { deps, calls } = fake();
      const res = await handle(post(body), deps);
      expect(res.status, name).toBe(400);
      expect(await res.text()).toBe('{"code":"invalid"}');
      expect(calls.submits, name).toEqual([]);
      expect(calls.ipHits, name).toEqual([]);
      expect(calls.logs, name).toEqual(["refused"]);
    }
  });

  it("not JSON, an array, null and an empty body are 400", async () => {
    for (const raw of ["nope", "[]", "null", "", "12"]) {
      const { deps } = fake();
      expect((await handle(post(null, {}, raw), deps)).status).toBe(400);
    }
  });

  it("the limit is 512 bytes: 512 passes the size check, 513 is 413, declared or streamed, and nothing is called", async () => {
    expect(MAX_BODY_BYTES).toBe(512);
    const { deps, calls } = fake();
    const exact = '{"token":"' + TOKEN + '","upi_ref":"' + DIGITS + '"}';
    const pad = (n: number) => exact + " ".repeat(n - exact.length);
    expect((await handle(post(null, {}, pad(512)), deps)).status).toBe(200);
    calls.submits.length = 0;
    expect((await handle(post(null, {}, pad(513)), deps)).status).toBe(413);
    const lying = post(null, {}, pad(513));
    Object.defineProperty(lying, "headers", { value: new Headers({ "content-length": "10", "cf-connecting-ip": IP }) });
    expect((await handle(lying, deps)).status).toBe(413);
    expect(calls.submits).toEqual([]);
  });

  it("GET, PUT, DELETE and PATCH are 405 with Allow, and the token in a URL is never read", async () => {
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      const { deps, calls } = fake();
      const res = await handle(new Request("https://x.test/functions/v1/submit-claim?token=" + TOKEN + "&upi_ref=" + DIGITS, { method }), deps);
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST, OPTIONS");
      expect(calls.submits).toEqual([]);
    }
  });

  it("a token or reference in the query string of a POST is ignored", async () => {
    const { deps, calls } = fake();
    const req = new Request("https://x.test/functions/v1/submit-claim?token=" + TOKEN + "&upi_ref=" + DIGITS, {
      method: "POST", headers: { "cf-connecting-ip": IP }, body: JSON.stringify({ token: OTHER, upi_ref: REF }),
    });
    await handle(req, deps);
    expect(calls.submits).toEqual([[OTHER, DIGITS]]);
  });
});

describe("bad tokens", () => {
  const tokens = [OTHER, "short", "", "A".repeat(21), "A".repeat(65), "AbCdEfGhIjKlMnOpQrStUv!!"];

  it("unknown, short and malformed tokens all give the same 404 body, byte for byte", async () => {
    const seen = new Set<string>();
    for (const token of tokens) {
      const { deps } = fake();
      const res = await handle(post({ token, upi_ref: REF }), deps);
      expect(res.status).toBe(404);
      seen.add(await res.text());
    }
    expect([...seen]).toEqual(['{"code":"not_found"}']);
  });

  it("a malformed token still makes one call, with the dummy and no reference, never the caller's value", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: "short", upi_ref: REF }), deps);
    expect(calls.submits).toEqual([[DUMMY_TOKEN, ""]]);
    expect(calls.tokenHits).toEqual([]);
  });

  it("a malformed token with a bad reference is still the 404 (the token is not told apart)", async () => {
    const { deps } = fake();
    const res = await handle(post({ token: "short", upi_ref: "nope" }), deps);
    expect(res.status).toBe(404);
  });

  it("an unknown well-formed token does one call and counts against its own hash", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: OTHER, upi_ref: REF }), deps);
    expect(calls.submits).toEqual([[OTHER, DIGITS]]);
    expect(calls.tokenHits).toHaveLength(1);
  });
});

describe("rate limits", () => {
  it("the 31st request from one hashed IP is 429 with Retry-After and does nothing", async () => {
    expect(LIMIT_PER_IP_PER_HOUR).toBe(30);
    const { deps, calls } = fake();
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR; i++) {
      const token = `Tok${String(i).padStart(3, "0")}abcdefghijklmnopq`; // spread over tokens so only the IP limit can trip
      expect((await handle(post({ token, upi_ref: REF }), deps)).status).toBe(404);
    }
    const before = calls.submits.length;
    const res = await handle(post({ token: TOKEN, upi_ref: REF }), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(await res.text()).toBe('{"code":"rate_limited"}');
    expect(calls.submits.length).toBe(before);
    expect(calls.logs.at(-1)).toBe("rate_limited");
  });

  it("the 11th request for one token is 429 with Retry-After, from different IPs", async () => {
    expect(LIMIT_PER_TOKEN_PER_HOUR).toBe(10);
    const { deps, calls } = fake();
    for (let i = 0; i < LIMIT_PER_TOKEN_PER_HOUR; i++) {
      expect((await handle(post({ token: TOKEN, upi_ref: REF }, { "cf-connecting-ip": `10.0.0.${i}` }), deps)).status).toBe(200);
    }
    const before = calls.submits.length;
    const res = await handle(post({ token: TOKEN, upi_ref: REF }, { "cf-connecting-ip": "10.9.9.9" }), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(calls.submits.length).toBe(before);
  });

  it("callers with no known IP share a bucket with a much higher limit (H7)", async () => {
    const { deps } = fake();
    expect(LIMIT_UNKNOWN_IP_PER_HOUR).toBeGreaterThanOrEqual(1000);
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR + 5; i++) {
      const token = `Tok${String(i).padStart(3, "0")}abcdefghijklmnopq`;
      expect((await handle(post({ token, upi_ref: REF }, { "cf-connecting-ip": "" }), deps)).status, `request ${i + 1}`).toBe(404);
    }
  });

  it("x-forwarded-for is not used to pick a bucket", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: TOKEN, upi_ref: REF }, { "cf-connecting-ip": "", "x-forwarded-for": "1.2.3.4" }), deps);
    expect(calls.hashedIp).toEqual(["unknown"]);
  });

  it("its hash messages differ from each other and from the other functions' prefixes", () => {
    expect(ipHashMessage("x", "h")).not.toBe(tokenHashMessage("x", "h"));
    expect(ipHashMessage("x", "h")).toContain("cl-");
    expect(tokenHashMessage("x", "h")).toContain("cl-");
  });
});

describe("what never leaves the function", () => {
  it("the raw IP, token and reference reach only the hashers and the database call (spy)", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: TOKEN, upi_ref: REF }), deps);
    await handle(post({ token: "short-and-odd", upi_ref: REF }), deps);
    expect(calls.hashedIp).toEqual([IP, IP]);
    expect(calls.hashedToken).toEqual([TOKEN]);
    for (const seen of [...calls.ipHits, ...calls.tokenHits, ...calls.logs]) {
      expect(seen).not.toContain(IP);
      expect(seen).not.toContain(TOKEN);
      expect(seen).not.toContain(DIGITS);
    }
    expect(calls.submits).toEqual([[TOKEN, DIGITS], [DUMMY_TOKEN, ""]]);
  });

  it("logs come from the fixed set of words, and no answer repeats the token, the reference or the address", async () => {
    const logs: LogWord[] = [];
    const bodies: string[] = [];
    for (const [answer, body] of [
      ["ok", { token: TOKEN, upi_ref: REF }],
      ["duplicate_reference", { token: TOKEN, upi_ref: REF }],
      ["ok", { token: OTHER, upi_ref: REF }],
      ["ok", { token: TOKEN, upi_ref: "nope" }],
    ] as [string, unknown][]) {
      const { deps } = fake(answer, { log: (w) => logs.push(w) });
      bodies.push(await (await handle(post(body), deps)).text());
    }
    const { deps } = fake("ok", { log: (w) => logs.push(w) });
    bodies.push(await (await handle(post(null, {}, "nope"), deps)).text());
    bodies.push(await (await handle(post(null, {}, "x".repeat(MAX_BODY_BYTES + 1)), deps)).text());
    expect(new Set(logs)).toEqual(new Set(["ok", "refused", "not_found"]));
    for (const body of bodies) {
      expect(body).not.toContain(TOKEN);
      expect(body).not.toContain(DIGITS);
      expect(body).not.toContain(IP);
      expect(body).toMatch(/^\{"code":"[a-z_]+"\}$/);
    }
  });

  it("a thrown dependency is a 500 with no detail", async () => {
    for (const overrides of [
      { submitClaim: async () => { throw new Error("db password hunter2 at " + TOKEN); } },
      { hitIp: async () => { throw new Error("boom " + IP); } },
      { hitToken: async () => { throw new Error("boom"); } },
      { hashIp: async () => { throw new Error("salt missing"); } },
    ] as Partial<Deps>[]) {
      const { deps, calls } = fake("ok", overrides);
      const res = await handle(post({ token: TOKEN, upi_ref: REF }), deps);
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
      await handle(post({ token: TOKEN, upi_ref: REF }), deps),
      await handle(post({ token: OTHER, upi_ref: REF }), deps),
      await handle(post({ token: TOKEN, upi_ref: "nope" }), deps),
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
    const ok = await handle(post({ token: TOKEN, upi_ref: REF }, { origin: "https://feedost.vercel.app" }), deps);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://feedost.vercel.app");
    const bad = await handle(post({ token: TOKEN, upi_ref: REF }, { origin: "https://evil.example" }), deps);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    const pre = await handle(new Request("https://x.test/", { method: "OPTIONS", headers: { origin: "https://feedost.vercel.app" } }), deps);
    expect(pre.status).toBe(204);
    expect(pre.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    const preBad = await handle(new Request("https://x.test/", { method: "OPTIONS", headers: { origin: "https://evil.example" } }), deps);
    expect(preBad.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("local development allows localhost only when APP_ENV is local", async () => {
    const local = fake("ok", { env: { APP_ENV: "local" } });
    const res = await handle(post({ token: TOKEN, upi_ref: REF }, { origin: "http://localhost:3000" }), local.deps);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    const staging = fake();
    const res2 = await handle(post({ token: TOKEN, upi_ref: REF }, { origin: "http://localhost:3000" }), staging.deps);
    expect(res2.headers.get("access-control-allow-origin")).toBeNull();
  });
});
