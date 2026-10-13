// @vitest-environment node
// R1-9 Part A criteria 3, 10, 14 and 15, added by test-engineer. The handler tests use fake dependencies, so they cannot
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

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const migration = read("../../migrations/20261012230218_r1_pay_page.sql");
const config = read("../../config.toml");
const envExample = read("../../../.env.example");
const indexes = { "pay-page": read("../pay-page/index.ts"), "record-consent": read("../record-consent/index.ts") };

/** name -> argument names, from the function declarations in the migration. */
function signatures(sql: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const m of sql.matchAll(/create\s+function\s+public\.(\w+)\(([^)]*)\)/g)) {
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
    for (const name of ["pay-page", "record-consent"]) {
      expect(config, name).toMatch(new RegExp(`\\[functions\\.${name}\\]\\s*\\n(?:#[^\\n]*\\n)*verify_jwt = false`));
    }
  });

  it("the three hash salts are three different values, and the new one is set for the local runtime", () => {
    const salts = [...config.matchAll(/^(\w+_HASH_SALT) = "([^"]+)"/gm)].map((m) => [m[1], m[2]]);
    const names = salts.map(([n]) => n);
    expect(names).toEqual(expect.arrayContaining(["WAITLIST_HASH_SALT", "RECEIPT_HASH_SALT", "PAYPAGE_HASH_SALT"]));
    expect(new Set(salts.map(([, v]) => v)).size).toBe(salts.length);
  });

  it(".env.example names PAYPAGE_HASH_SALT and holds no value for it", () => {
    expect(envExample).toMatch(/^#?\s*PAYPAGE_HASH_SALT=\s*$/m);
  });
});

describe("the Deno wiring (index.ts) against the migration", () => {
  const sigs = signatures(migration);

  it("the migration declares the four functions this part needs", () => {
    expect(Object.keys(sigs).sort()).toEqual(["current_notice_version", "get_pay_page", "paypage_hit", "record_consent"]);
    expect(sigs.get_pay_page).toEqual(["p_token"]);
    expect(sigs.record_consent).toEqual(["p_token", "p_notice_version"]);
    expect(sigs.paypage_hit).toEqual(["p_hash", "p_limit"]);
  });

  for (const [fn, source] of Object.entries(indexes)) {
    it(`${fn}: every rpc call names a real function and exactly its parameters`, () => {
      const calls = rpcCalls(source);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(sigs[call.name], `${call.name} exists in the migration`).toBeDefined();
        expect(call.keys, `${call.name} parameters`).toEqual([...sigs[call.name]].sort());
      }
    });

    it(`${fn}: reads PAYPAGE_HASH_SALT and no other salt, uses no console, and calls only functions the migration revokes from clients`, () => {
      expect(source).toContain('Deno.env.get("PAYPAGE_HASH_SALT")');
      expect(source).not.toMatch(/WAITLIST_HASH_SALT|RECEIPT_HASH_SALT/);
      expect(source).not.toMatch(/console\./);
      for (const call of rpcCalls(source)) {
        expect(migration, call.name).toMatch(new RegExp(`revoke all on function public\\.${call.name}\\([^)]*\\) from public, anon, authenticated;`));
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
