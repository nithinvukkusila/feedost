// @vitest-environment node
// R1-9 Part A criteria 12 to 15: the pay-page handler, called directly with fake dependencies.
import { describe, expect, it } from "vitest";
import {
  DUE_KEYS, DUMMY_TOKEN, LIMIT_PER_IP_PER_HOUR, LIMIT_PER_TOKEN_PER_HOUR, LIMIT_UNKNOWN_IP_PER_HOUR, MAX_BODY_BYTES, POST_CONSENT_KEYS,
  PRE_CONSENT_KEYS, RECEIPT_KEYS, handle, ipHashMessage, tokenHashMessage, type Deps,
} from "./handler.ts";
import { ipHashMessage as consentIp, tokenHashMessage as consentToken } from "../record-consent/handler.ts";

const IP = "203.0.113.77";
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx"; // 24 characters
const OTHER = "ZyXwVuTsRqPoNmLkJiHgFeDc";

const PRE = {
  consent_needed: true, notice_version: "v1", tutor_name: "Asha Rao", tutor_subjects: ["Maths"], student_name: "Ravi", language: "hi",
};
const DUE = { kind: "monthly", month: "2026-10-01", due_date: "2026-10-05", amount: 120000, amount_paid: 50000, remaining: 70000 };
const RECEIPT = { receipt_no: 3, receipt_token: "RcptTokenAbCdEfGhIjKlMn", month: null, amount: 10000, paid_on: "2026-10-08", balance_after: 0 };
const POST = {
  ...PRE, consent_needed: false, upi_id: "asha@okbank", today: "2026-10-12", total_remaining: 70000,
  open_dues: [DUE], open_dues_more: 0, receipts: [RECEIPT], receipts_more: false,
};
// Things the database must never send; if one ever leaked in, the allow-list must still drop it.
const LEAK = { tutor_id: "t", student_id: "s", phone: "+919876543210", parent_phone: "+911234567890", email: "a@b.c", amount: 777700, pay_token: "x", id: "i" };

function fake(rows: Record<string, Record<string, unknown>> = { [TOKEN]: POST }, overrides: Partial<Deps> = {}) {
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
    async getPayPage(token) {
      calls.lookups.push(token);
      return rows[token] ?? null;
    },
    log: (w) => calls.logs.push(w),
    ...overrides,
  };
  return { deps, calls };
}

const post = (body: unknown, headers: Record<string, string> = {}, raw?: string) =>
  new Request("https://x.test/functions/v1/pay-page", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": IP, ...headers },
    body: raw ?? JSON.stringify(body),
  });

const pageOf = async (res: Response) => ((await res.json()) as { code: string; page: Record<string, unknown> }).page;
const sorted = (o: object) => Object.keys(o).sort();

describe("a good token, before consent", () => {
  it("answers 200 with exactly the six notice keys", async () => {
    const { deps } = fake({ [TOKEN]: PRE });
    const res = await handle(post({ token: TOKEN }), deps);
    expect(res.status).toBe(200);
    const page = await pageOf(res);
    expect(sorted(page)).toEqual([...PRE_CONSENT_KEYS].sort());
    expect(page).toEqual(PRE);
  });

  it("a pre-consent row polluted with every post-consent key and more still yields exactly six keys", async () => {
    const { deps } = fake({ [TOKEN]: { ...POST, ...LEAK, consent_needed: true } });
    const res = await handle(post({ token: TOKEN }), deps);
    const page = await pageOf(res);
    expect(sorted(page)).toEqual([...PRE_CONSENT_KEYS].sort());
    for (const k of POST_CONSENT_KEYS.filter((k) => !(PRE_CONSENT_KEYS as readonly string[]).includes(k))) expect(page).not.toHaveProperty(k);
    expect(JSON.stringify(page)).not.toMatch(/asha@okbank|70000|120000|777700|RcptToken|9876543210|tutor_id|pay_token/);
  });
});

describe("a good token, after consent", () => {
  it("answers 200 with exactly the thirteen keys", async () => {
    const { deps } = fake();
    const res = await handle(post({ token: TOKEN }), deps);
    expect(res.status).toBe(200);
    const page = await pageOf(res);
    expect(sorted(page)).toEqual([...POST_CONSENT_KEYS].sort());
    expect(POST_CONSENT_KEYS).toHaveLength(13);
    expect(page).toEqual(POST);
  });

  it("a polluted row yields exactly thirteen keys, with nested objects copied to their six keys", async () => {
    const dirty = {
      ...POST, ...LEAK, consent_needed: false,
      open_dues: [{ ...DUE, id: "d", due_id: "d", tutor_id: "t", student_id: "s" }],
      receipts: [{ ...RECEIPT, id: "p", due_id: "d", tutor_id: "t", method: "upi", voided_at: null }],
    };
    const { deps } = fake({ [TOKEN]: dirty });
    const page = await pageOf(await handle(post({ token: TOKEN }), deps));
    expect(sorted(page)).toEqual([...POST_CONSENT_KEYS].sort());
    expect(sorted((page.open_dues as object[])[0])).toEqual([...DUE_KEYS].sort());
    expect(sorted((page.receipts as object[])[0])).toEqual([...RECEIPT_KEYS].sort());
    expect(page).toEqual(POST);
    expect(JSON.stringify(page)).not.toMatch(/tutor_id|student_id|due_id|pay_token|9876543210|a@b\.c|"id"|voided_at|method/);
  });

  it("a missing list becomes an empty list, a missing count 0 and a missing flag false", async () => {
    const bare = { consent_needed: false, notice_version: "v1", tutor_name: "A", student_name: "R", language: "en" };
    const { deps } = fake({ [TOKEN]: bare });
    const page = await pageOf(await handle(post({ token: TOKEN }), deps));
    expect(sorted(page)).toEqual([...POST_CONSENT_KEYS].sort());
    expect(page.open_dues).toEqual([]);
    expect(page.receipts).toEqual([]);
    expect(page.total_remaining).toBe(0);
    expect(page.open_dues_more).toBe(0);
    expect(page.receipts_more).toBe(false);
    expect(page.upi_id).toBeNull();
    expect(page.tutor_subjects).toBeNull();
  });

  it("a total or count that is not a whole finite number is a 500, never 0", async () => {
    for (const field of ["total_remaining", "open_dues_more"]) {
      for (const value of ["70000", 70000.5, Number.NaN, Number.POSITIVE_INFINITY, true, {}, []]) {
        const { deps } = fake({ [TOKEN]: { ...POST, [field]: value } });
        const res = await handle(post({ token: TOKEN }), deps);
        expect(res.status).toBe(500);
        expect(await res.text()).toBe('{"code":"error"}');
      }
    }
  });

  it("a total above the 32-bit range passes through unchanged", async () => {
    const { deps } = fake({ [TOKEN]: { ...POST, total_remaining: 2200000000 } });
    const page = await pageOf(await handle(post({ token: TOKEN }), deps));
    expect(page.total_remaining).toBe(2200000000);
  });

  it("a consent_needed that is not a boolean is a 500, never a guess", async () => {
    for (const value of ["true", "false", 1, 0, null, undefined]) {
      const { deps } = fake({ [TOKEN]: { ...POST, consent_needed: value } });
      const res = await handle(post({ token: TOKEN }), deps);
      expect(res.status).toBe(500);
      expect(await res.text()).toBe('{"code":"error"}');
    }
  });
});

describe("bad tokens", () => {
  const bodies: [string, unknown][] = [
    ["unknown", { token: OTHER }],
    ["short", { token: "abc" }],
    ["21 characters", { token: "A".repeat(21) }],
    ["empty", { token: "" }],
    ["null", { token: null }],
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
  it("GET, PUT, DELETE and PATCH are 405 with Allow, and the token is never read from the address", async () => {
    for (const method of ["GET", "PUT", "DELETE", "PATCH"]) {
      const { deps, calls } = fake();
      const res = await handle(new Request("https://x.test/functions/v1/pay-page?token=" + TOKEN, { method }), deps);
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST, OPTIONS");
      expect(calls.lookups).toEqual([]);
    }
  });

  it("a POST with the token only in the address is a 404, not a lookup of that token", async () => {
    const { deps, calls } = fake();
    const res = await handle(new Request("https://x.test/functions/v1/pay-page?token=" + TOKEN, { method: "POST", body: "{}", headers: { "cf-connecting-ip": IP } }), deps);
    expect(res.status).toBe(404);
    expect(calls.lookups).toEqual([DUMMY_TOKEN]);
  });

  it("a body over the limit is 413 and nothing is looked up, declared or streamed", async () => {
    const { deps, calls } = fake();
    const res = await handle(post(null, {}, JSON.stringify({ token: TOKEN, pad: "x".repeat(MAX_BODY_BYTES) })), deps);
    expect(res.status).toBe(413);
    const lying = post(null, {}, JSON.stringify({ token: TOKEN, pad: "x".repeat(MAX_BODY_BYTES) }));
    Object.defineProperty(lying, "headers", { value: new Headers({ "content-length": "10", "cf-connecting-ip": IP }) });
    expect((await handle(lying, deps)).status).toBe(413);
    expect(calls.lookups).toEqual([]);
    expect(calls.ipHits).toEqual([]);
  });

  it("not JSON, an array, null and an empty body are 400", async () => {
    for (const raw of ["nope", "[]", "null", "", "12", '"text"']) {
      const { deps } = fake();
      const res = await handle(post(null, {}, raw), deps);
      expect(res.status).toBe(400);
      expect(await res.text()).toBe('{"code":"invalid"}');
    }
  });
});

describe("rate limits", () => {
  it("the 61st request from one hashed IP is 429 with Retry-After and does no lookup", async () => {
    const { deps, calls } = fake();
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR; i++) {
      const tok = i % 2 ? TOKEN : OTHER; // spread over tokens so only the IP limit can trip
      expect((await handle(post({ token: tok }), deps)).status).not.toBe(429);
    }
    const before = calls.lookups.length;
    const res = await handle(post({ token: TOKEN }), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(await res.text()).toBe('{"code":"rate_limited"}');
    expect(calls.lookups.length).toBe(before);
  });

  it("another IP is counted separately", async () => {
    const { deps } = fake();
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR + 1; i++) await handle(post({ token: OTHER }), deps);
    expect((await handle(post({ token: TOKEN }, { "cf-connecting-ip": "198.51.100.9" }), deps)).status).toBe(200);
  });

  it("the 121st request for one token is 429 with Retry-After, from different IPs", async () => {
    const { deps, calls } = fake();
    for (let i = 0; i < LIMIT_PER_TOKEN_PER_HOUR; i++) {
      expect((await handle(post({ token: TOKEN }, { "cf-connecting-ip": `10.0.${Math.floor(i / 50)}.${i % 50}` }), deps)).status).toBe(200);
    }
    const before = calls.lookups.length;
    const res = await handle(post({ token: TOKEN }, { "cf-connecting-ip": "10.9.9.9" }), deps);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(calls.lookups.length).toBe(before);
  });

  it("callers with no known IP share a bucket with a much higher limit (H7)", async () => {
    const { deps } = fake();
    expect(LIMIT_UNKNOWN_IP_PER_HOUR).toBeGreaterThanOrEqual(1000);
    const none = { "cf-connecting-ip": "" };
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR + 5; i++) {
      const token = `Tok${String(i).padStart(3, "0")}abcdefghijklmnopq`;
      expect((await handle(post({ token }, none), deps)).status, `request ${i + 1}`).toBe(404);
    }
    const { deps: real } = fake();
    for (let i = 0; i < LIMIT_PER_IP_PER_HOUR; i++) await handle(post({ token: OTHER }, { "cf-connecting-ip": "198.51.100.1" }), real);
    expect((await handle(post({ token: OTHER }, { "cf-connecting-ip": "198.51.100.1" }), real)).status).toBe(429);
  });

  it("x-forwarded-for is not used to pick a bucket", async () => {
    const { deps, calls } = fake();
    await handle(post({ token: TOKEN }, { "cf-connecting-ip": "", "x-forwarded-for": "1.2.3.4" }), deps);
    expect(calls.hashedIp).toEqual(["unknown"]);
  });

  it("the four counters never share a hash message for the same input", () => {
    const messages = [ipHashMessage("x", "h"), tokenHashMessage("x", "h"), consentIp("x", "h"), consentToken("x", "h")];
    expect(new Set(messages).size).toBe(4);
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
    expect(calls.logs.join(" ")).not.toMatch(/Asha|Ravi|70000|asha@okbank/);
  });

  it("a thrown dependency is a 500 with no detail", async () => {
    for (const overrides of [
      { getPayPage: async () => { throw new Error("db password hunter2 at " + TOKEN); } },
      { hitIp: async () => { throw new Error("boom " + IP); } },
      { hitToken: async () => { throw new Error("boom"); } },
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
  it("every kind of answer is no-store, noindex, no-referrer, nosniff", async () => {
    const { deps } = fake();
    const { deps: broken } = fake(undefined, { getPayPage: async () => { throw new Error("x"); } });
    const answers = [
      await handle(post({ token: TOKEN }), deps),
      await handle(post({ token: OTHER }), deps),
      await handle(post(null, {}, "nope"), deps),
      await handle(post(null, {}, "x".repeat(MAX_BODY_BYTES + 1)), deps),
      await handle(post({ token: TOKEN }), broken),
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

  it("echoes an allowed origin and not an unknown one", async () => {
    const { deps } = fake();
    const ok = await handle(post({ token: TOKEN }, { origin: "https://feedost.vercel.app" }), deps);
    expect(ok.headers.get("access-control-allow-origin")).toBe("https://feedost.vercel.app");
    const bad = await handle(post({ token: TOKEN }, { origin: "https://evil.example" }), deps);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
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

  it("PAYPAGE_ALLOWED_HOSTS replaces the default hosts, and localhost only when APP_ENV is local", async () => {
    const own = fake(undefined, { env: { APP_ENV: "staging", PAYPAGE_ALLOWED_HOSTS: "pay.example.in" } });
    expect((await handle(post({ token: TOKEN }, { origin: "https://pay.example.in" }), own.deps)).headers.get("access-control-allow-origin")).toBe("https://pay.example.in");
    expect((await handle(post({ token: TOKEN }, { origin: "https://feedost.vercel.app" }), own.deps)).headers.get("access-control-allow-origin")).toBeNull();
    const local = fake(undefined, { env: { APP_ENV: "local" } });
    expect((await handle(post({ token: TOKEN }, { origin: "http://localhost:3000" }), local.deps)).headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    const staging = fake();
    expect((await handle(post({ token: TOKEN }, { origin: "http://localhost:3000" }), staging.deps)).headers.get("access-control-allow-origin")).toBeNull();
  });
});
