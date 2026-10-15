// @vitest-environment node
// R1-9 Part A criteria 3, 10, 14 and 15, added by test-engineer; extended in R1-10 Part A for submit-claim (its migration, its
// salt, its wiring) and for get_pay_page, which R1-10 replaced in a later migration (so the newest definition is the one read here). The handler tests use fake dependencies, so they cannot
// see the two things that sit between a handler and the database: the Deno wiring in each index.ts (which secret it
// reads, which database function and parameter names it calls) and the settings in config.toml. These tests read those
// files as text and check them against the migration, so a renamed parameter or a wrong salt fails here and not on staging.
// The last block runs both handlers with the DEFAULT logger (the other tests pass their own), to prove the real console
// output holds fixed words only and no answer repeats the token or the caller's address.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handle as payPage, type Deps as PayDeps } from "../pay-page/handler.ts";
import { handle as recordConsent, type Deps as ConsentDeps } from "../record-consent/handler.ts";
import { handle as submitClaim, type Deps as ClaimDeps } from "../submit-claim/handler.ts";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const migration = read("../../migrations/20261012230218_r1_pay_page.sql");
const claimsMigration = read("../../migrations/20261015170625_r1_payment_claims.sql");
const config = read("../../config.toml");
const envExample = read("../../../.env.example");
const SALTS = ["WAITLIST_HASH_SALT", "RECEIPT_HASH_SALT", "PAYPAGE_HASH_SALT", "CLAIM_HASH_SALT"];
const indexes = {
  "pay-page": { source: read("../pay-page/index.ts"), salt: "PAYPAGE_HASH_SALT" },
  "record-consent": { source: read("../record-consent/index.ts"), salt: "PAYPAGE_HASH_SALT" },
  "submit-claim": { source: read("../submit-claim/index.ts"), salt: "CLAIM_HASH_SALT" },
};

/** name -> argument names, from the function declarations in the migration. */
function signatures(sql: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of sql.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\(([^)]*)\)/g)) {
    out[m[1]] = m[2].split(",").map((a) => a.trim().split(/\s+/)[0]).filter(Boolean);
  }
  return out;
}

/** rpc name -> sorted parameter keys, from `.rpc("name", { key: ..., key: ... })` in a Deno wiring file. */
function rpcCalls(source: string): { name: string; keys: string[] }[] {
  return [...source.matchAll(/\.rpc\("(\w+)",\s*\{([^}]*)\}\)/g)].map((m) => ({
    name: m[1],
    keys: [...m[2].matchAll(/(\w+)\s*:/g)].map((k) => k[1]).sort(),
  }));
}

describe("config.toml and .env.example", () => {
  it("both functions are public (verify_jwt = false), because parents have no login", () => {
    for (const name of ["pay-page", "record-consent", "submit-claim"]) {
      expect(config, name).toMatch(new RegExp(`\\[functions\\.${name}\\]\\s*\\n(?:#[^\\n]*\\n)*verify_jwt = false`));
    }
  });

  it("the four hash salts are four different values, and each is set for the local runtime", () => {
    const salts = [...config.matchAll(/^(\w+_HASH_SALT) = "([^"]+)"/gm)].map((m) => [m[1], m[2]]);
    const names = salts.map(([n]) => n);
    expect(names).toEqual(expect.arrayContaining(SALTS));
    expect(new Set(salts.map(([, v]) => v)).size).toBe(salts.length);
  });

  it(".env.example names PAYPAGE_HASH_SALT and CLAIM_HASH_SALT and holds no value for either", () => {
    expect(envExample).toMatch(/^#?\s*PAYPAGE_HASH_SALT=\s*$/m);
    expect(envExample).toMatch(/^#?\s*CLAIM_HASH_SALT=\s*$/m);
  });
});

describe("the Deno wiring (index.ts) against the migration", () => {
  const sigs = { ...signatures(migration), ...signatures(claimsMigration) };

  it("the pay page migration declares the four functions R1-9 needs", () => {
    expect(Object.keys(signatures(migration)).sort()).toEqual(["current_notice_version", "get_pay_page", "paypage_hit", "record_consent"]);
    expect(sigs.get_pay_page).toEqual(["p_token"]);
    expect(sigs.record_consent).toEqual(["p_token", "p_notice_version"]);
    expect(sigs.paypage_hit).toEqual(["p_hash", "p_limit"]);
  });

  it("the claims migration declares the functions R1-10 needs, and re-declares get_pay_page with the same argument", () => {
    expect(Object.keys(signatures(claimsMigration)).sort()).toEqual(
      ["claim_hit", "confirm_claim", "get_pay_page", "open_dues_oldest_first", "payment_claims_guard", "reject_claim", "submit_claim"],
    );
    expect(signatures(claimsMigration).get_pay_page).toEqual(["p_token"]);
    expect(sigs.submit_claim).toEqual(["p_token", "p_upi_ref", "p_screenshot_path"]);
    expect(sigs.claim_hit).toEqual(["p_hash", "p_limit"]);
    expect(sigs.confirm_claim).toEqual(["p_claim", "p_request_id"]);
    expect(sigs.reject_claim).toEqual(["p_claim"]);
  });

  for (const [fn, { source, salt }] of Object.entries(indexes)) {
    it(`${fn}: every rpc call names a real function and exactly its parameters`, () => {
      const calls = rpcCalls(source);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(sigs[call.name], `${call.name} exists in the migration`).toBeDefined();
        expect(call.keys, `${call.name} parameters`).toEqual([...sigs[call.name]].sort());
      }
    });

    it(`${fn}: reads ${salt} and no other salt, uses no console, and calls only functions a migration revokes from clients`, () => {
      expect(source).toContain(`Deno.env.get("${salt}")`);
      for (const other of SALTS.filter((name) => name !== salt)) expect(source).not.toContain(other);
      expect(source).not.toMatch(/console\./);
      for (const call of rpcCalls(source)) {
        expect(migration + claimsMigration, call.name).toMatch(new RegExp(`revoke all on function public\\.${call.name}\\([^)]*\\) from public, anon, authenticated;`));
      }
    });

    it(`${fn}: hashes with its own prefixes (the handler's), not a string typed in the wiring`, () => {
      expect(source).toMatch(/hashIp: \(ip, hour\) => hmac\(ipHashMessage\(ip, hour\)\)/);
      expect(source).toMatch(/hashToken: \(token, hour\) => hmac\(tokenHashMessage\(token, hour\)\)/);
    });
  }

  it("no function of the migration is granted to a client role, and none returns a whole row", () => {
    expect(migration).not.toMatch(/grant\s+execute/i);
    expect(migration).not.toMatch(/to_jsonb\(\s*(s|s0|d|p|t|x|r|c)\s*\)|row_to_json|to_json\(\s*(s|s0|d|p|t|x|r|c)\s*\)/);
    for (const name of ["current_notice_version", "get_pay_page", "paypage_hit", "record_consent"]) {
      expect(migration, name).toMatch(new RegExp(`revoke all on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`));
    }
  });
});

describe("the claims migration's privileges", () => {
  it("only confirm_claim and reject_claim are granted to a client role, and the other functions are revoked from every client", () => {
    const granted = [...claimsMigration.matchAll(/grant\s+execute\s+on\s+function\s+public\.(\w+)\([^)]*\)\s+to\s+(\w+)/gi)].map((m) => `${m[1]}:${m[2]}`).sort();
    expect(granted).toEqual(["confirm_claim:authenticated", "reject_claim:authenticated"]);
    for (const name of ["submit_claim", "claim_hit", "open_dues_oldest_first", "payment_claims_guard", "get_pay_page"]) {
      expect(claimsMigration, name).toMatch(new RegExp(`revoke (?:all|execute) on function public\\.${name}\\([^)]*\\) from public, anon, authenticated;`));
    }
    expect(claimsMigration).not.toMatch(/to_jsonb\(\s*(s|s0|d|c|x)\s*\)|row_to_json|to_json\(\s*(s|s0|d|c|x)\s*\)/);
  });

  it("get_pay_page builds pending_claim from exactly amount and submitted_on", () => {
    expect(claimsMigration).toMatch(/jsonb_build_object\('amount', c\.amount, 'submitted_on', to_char\(public\.india_day\(c\.created_at\), 'YYYY-MM-DD'\)\)/);
  });
});

describe("with the default logger and across every status", () => {
  const IP = "203.0.113.99";
  const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWx";
  const WORDS = new Set(["ok", "not_found", "rate_limited", "error", "too_large", "invalid", "consent_recorded", "stale_notice"]);
  const PAGE = { consent_needed: true, notice_version: "v1", tutor_name: "Asha", tutor_subjects: [], student_name: "Ravi", language: "en" };

  const common = {
    env: { APP_ENV: "staging" },
    now: () => new Date("2026-10-12T09:30:00Z"),
    hashIp: async (ip: string) => "h-" + ip.length,
    hashToken: async (t: string) => "h-" + t.length,
  };
  const request = (url: string, body: unknown, ip = IP) =>
    new Request(url, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify(body) });

  afterEach(() => vi.restoreAllMocks());

  it("pay-page: console.log gets fixed words only, and no body repeats the token or the address", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const base: PayDeps = { ...common, hitIp: async () => true, hitToken: async () => true, getPayPage: async (t) => (t === TOKEN ? PAGE : null) };
    const cases: [string, PayDeps, unknown][] = [
      ["200", base, { token: TOKEN }],
      ["404", base, { token: "ZyXwVuTsRqPoNmLkJiHgFeDc" }],
      ["404 malformed", base, { token: "bad" }],
      ["429 ip", { ...base, hitIp: async () => false }, { token: TOKEN }],
      ["429 token", { ...base, hitToken: async () => false }, { token: TOKEN }],
      ["500", { ...base, getPayPage: async () => { throw new Error("secret " + TOKEN + IP); } }, { token: TOKEN }],
    ];
    for (const [name, deps, body] of cases) {
      const res = await payPage(request("https://x.test/pay-page", body), deps);
      const text = await res.text();
      expect(text, name).not.toContain(TOKEN);
      expect(text, name).not.toContain(IP);
      for (const [key, value] of res.headers) {
        expect(value, `${name} header ${key}`).not.toContain(TOKEN);
        expect(value, `${name} header ${key}`).not.toContain(IP);
      }
    }
    const printed = log.mock.calls.flat();
    expect(printed.length).toBe(cases.length);
    for (const word of printed) expect(WORDS.has(word as string), String(word)).toBe(true);
    expect(err).not.toHaveBeenCalled();
  });

  it("record-consent: console.log gets fixed words only, and no body repeats the token or the address", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const base: ConsentDeps = {
      ...common, hitIp: async () => true, hitToken: async () => true,
      recordConsent: async (t, v) => (t !== TOKEN ? "not_found" : v === "v1" ? "ok" : "stale_notice"),
      currentNoticeVersion: async (t) => (t === TOKEN ? "v1" : null),
    };
    const good = { token: TOKEN, notice_version: "v1" };
    const cases: [string, ConsentDeps, unknown][] = [
      ["200", base, good],
      ["409", base, { token: TOKEN, notice_version: "v2" }],
      ["404", base, { token: "ZyXwVuTsRqPoNmLkJiHgFeDc", notice_version: "v1" }],
      ["400", base, { token: TOKEN }],
      ["429 ip", { ...base, hitIp: async () => false }, good],
      ["429 token", { ...base, hitToken: async () => false }, good],
      ["500", { ...base, recordConsent: async () => { throw new Error("secret " + TOKEN + IP); } }, good],
    ];
    for (const [name, deps, body] of cases) {
      const res = await recordConsent(request("https://x.test/record-consent", body), deps);
      const text = await res.text();
      expect(text, name).not.toContain(TOKEN);
      expect(text, name).not.toContain(IP);
      for (const [key, value] of res.headers) {
        expect(value, `${name} header ${key}`).not.toContain(TOKEN);
        expect(value, `${name} header ${key}`).not.toContain(IP);
      }
    }
    const printed = log.mock.calls.flat();
    expect(printed.length).toBe(cases.length);
    for (const word of printed) expect(WORDS.has(word as string), String(word)).toBe(true);
    expect(err).not.toHaveBeenCalled();
  });

  it("submit-claim: console.log gets fixed words only, and no body repeats the token, the reference or the address", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const REF = "6281 0473 9915";
    const words = new Set(["ok", "not_found", "rate_limited", "refused", "error"]);
    const base: ClaimDeps = { ...common, hitIp: async () => true, hitToken: async () => true, submitClaim: async (t) => (t === TOKEN ? "ok" : "not_found") };
    const cases: [string, ClaimDeps, unknown][] = [
      ["200", base, { token: TOKEN, upi_ref: REF }],
      ["409", { ...base, submitClaim: async () => "duplicate_reference" }, { token: TOKEN, upi_ref: REF }],
      ["404", base, { token: "ZyXwVuTsRqPoNmLkJiHgFeDc", upi_ref: REF }],
      ["404 malformed", base, { token: "bad", upi_ref: REF }],
      ["422", base, { token: TOKEN, upi_ref: "123" }],
      ["400", base, { token: TOKEN }],
      ["429 ip", { ...base, hitIp: async () => false }, { token: TOKEN, upi_ref: REF }],
      ["429 token", { ...base, hitToken: async () => false }, { token: TOKEN, upi_ref: REF }],
      ["500", { ...base, submitClaim: async () => { throw new Error("secret " + TOKEN + IP + REF); } }, { token: TOKEN, upi_ref: REF }],
    ];
    for (const [name, deps, body] of cases) {
      const res = await submitClaim(request("https://x.test/submit-claim", body), deps);
      const text = await res.text();
      for (const secret of [TOKEN, IP, "628104739915", REF]) {
        expect(text, name).not.toContain(secret);
        for (const [key, value] of res.headers) expect(value, `${name} header ${key}`).not.toContain(secret);
      }
    }
    const printed = log.mock.calls.flat();
    expect(printed.length).toBe(cases.length);
    for (const word of printed) expect(words.has(word as string), String(word)).toBe(true);
    expect(err).not.toHaveBeenCalled();
  });

  it("record-consent asks for the current version only after a stale answer, once, for the caller's token", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const lookups: string[] = [];
    const deps: ConsentDeps = {
      ...common, hitIp: async () => true, hitToken: async () => true,
      recordConsent: async (_t, v) => (v === "v1" ? "ok" : "stale_notice"),
      currentNoticeVersion: async (t) => { lookups.push(t); return "v1"; },
    };
    await recordConsent(request("https://x.test/rc", { token: TOKEN, notice_version: "v1" }), deps);
    expect(lookups).toEqual([]);
    const res = await recordConsent(request("https://x.test/rc", { token: TOKEN, notice_version: "v3" }), deps);
    expect(res.status).toBe(409);
    expect(lookups).toEqual([TOKEN]);
  });
});
