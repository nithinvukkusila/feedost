// @vitest-environment node
// F4 criterion 43: `pnpm smoke:env`, with a fake network.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkKeyShape, resolveTarget, smoke } from "../../scripts/smoke-env-lib.mjs";

const REF = "abcdefghijklmnopqrst";
const OTHER = "tsrqponmlkjihgfedcba";
const URL_ = `https://${REF}.supabase.co`;
const envs = { local: { url: "http://127.0.0.1:54321" }, staging: { ref: REF }, production: { ref: null } };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: object) => `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;

const reply = (status: number, body: string, type = "application/json") => async () =>
  new Response(body, { status, headers: { "content-type": type } });
const run = (fetchImpl: (input: string, init: RequestInit) => Promise<Response>, extra: object = {}) =>
  smoke({ url: URL_, expect: "staging", fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 50, ...extra });

describe("smoke against a fake fetch", () => {
  it("passes on 200 with the exact shape and prints only the name", async () => {
    let seen: { url?: string; init?: RequestInit } = {};
    const r = await run(async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response('{"ok":true,"env":"staging"}', { headers: { "content-type": "application/json" } });
    });
    expect(r).toEqual({ ok: true, message: "staging" });
    expect(seen.url).toBe(`${URL_}/functions/v1/health`);
    expect(Object.keys(seen.init ?? {})).toEqual(["signal"]); // no headers, so no key is sent
  });
  it("fails on 404 and 500 and says the project may be paused", async () => {
    for (const status of [404, 500, 503]) {
      const r = await run(reply(status, '{"ok":false}'));
      expect(r.ok).toBe(false);
      expect(r.message).toContain("may be paused");
    }
  });
  it("fails on another non-200 status", async () => {
    expect((await run(reply(401, "{}"))).ok).toBe(false);
  });
  it("fails on the wrong environment", async () => {
    const r = await run(reply(200, '{"ok":true,"env":"production"}'));
    expect(r.ok).toBe(false);
    expect(r.message).toContain("expected staging");
  });
  it("fails on an extra key, a missing key, ok false, bad JSON and a wrong content type", async () => {
    for (const body of ['{"ok":true,"env":"staging","v":1}', '{"env":"staging"}', '{"ok":true}', '{"ok":false,"env":"staging"}', "nope", "[]", "null"]) {
      expect((await run(reply(200, body))).ok, body).toBe(false);
    }
    expect((await run(reply(200, '{"ok":true,"env":"staging"}', "text/html"))).ok).toBe(false);
  });
  it("fails on a network error", async () => {
    const r = await run(async () => {
      throw new TypeError("fetch failed");
    });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("may be paused");
  });
  it("fails on a timeout", async () => {
    const hang = (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))));
    expect((await run(hang)).ok).toBe(false);
  });
  it("fails on a key with the wrong ref, a secret-style key and a non-anon JWT, before any network call", async () => {
    let called = false;
    const spy = async () => {
      called = true;
      return new Response("");
    };
    const secret = ["sb", "secret"].join("_") + "_abcdefghijklmnop";
    for (const key of [jwt({ role: "anon", ref: OTHER }), secret, jwt({ role: "x" }), "garbage"]) {
      const r = await run(spy, { anonKey: key });
      expect(r.ok).toBe(false);
      expect(r.message).not.toContain(key);
    }
    expect(called).toBe(false);
  });
  it("accepts an anon JWT with the right ref and a publishable key", () => {
    expect(checkKeyShape(jwt({ role: "anon", ref: REF }), URL_)).toBeNull();
    expect(checkKeyShape("sb_publishable_abc", URL_)).toBeNull();
    expect(checkKeyShape(undefined, URL_)).toBeNull();
  });
});

describe("resolving the target", () => {
  it("takes the URL from environments.json", () => {
    expect(resolveTarget(["staging"], envs)).toEqual({ url: URL_, expect: "staging" });
    expect(resolveTarget(["local"], envs)).toEqual({ url: "http://127.0.0.1:54321", expect: "local" });
  });
  it("fails for a null ref, an unknown name, no name and a malformed ref", () => {
    expect(() => resolveTarget(["production"], envs)).toThrow(/no project recorded for production/);
    expect(() => resolveTarget(["prod"], envs)).toThrow(/unknown environment/);
    expect(() => resolveTarget([], envs)).toThrow(/unknown environment/);
    expect(() => resolveTarget(["staging"], { staging: { ref: "short" } })).toThrow(/not a 20-character/);
  });
  it("accepts --url with --expect only together", () => {
    expect(resolveTarget(["--url", "https://x.test/", "--expect", "staging"], envs)).toEqual({ url: "https://x.test", expect: "staging" });
    expect(() => resolveTarget(["--url", "https://x.test"], envs)).toThrow();
    expect(() => resolveTarget(["--expect", "staging"], envs)).toThrow();
  });
});

describe("the command", () => {
  it("fails with a clear message while no staging ref is recorded", () => {
    const r = spawnSync("node", [join(process.cwd(), "scripts", "smoke-env.mjs"), "staging"], { encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("no project recorded for staging");
  });
});

describe("gaps found by mutation (criterion 43)", () => {
  afterEach(() => vi.useRealTimers());
  const good = '{"ok":true,"env":"staging"}';

  it("a non-200 status fails even when the body is perfect, and names the status", async () => {
    for (const status of [201, 202, 301, 401, 403]) {
      const r = await run(reply(status, good));
      expect(r.ok, String(status)).toBe(false);
      expect(r.message, String(status)).toContain(String(status));
    }
  });
  it("the content type must be JSON: text/json, text/html and none fail; a charset is fine", async () => {
    for (const type of ["text/json", "text/plain", "application/x-json", ""]) {
      const r = await run(reply(200, good, type));
      expect(r.ok, type).toBe(false);
      expect(r.message).toContain("did not answer JSON");
    }
    expect((await run(reply(200, good, "application/json; charset=utf-8"))).ok).toBe(true);
  });
  it("each failure has its own message: not JSON, wrong shape, wrong environment", async () => {
    expect((await run(reply(200, "nope"))).message).toContain("not JSON");
    for (const body of ['{"ok":1,"env":"staging"}', '{"ok":"true","env":"staging"}', '{"ok":true,"env":5}', '{"ok":true,"env":null}', "[]", "null", '{"ok":true,"environment":"staging"}']) {
      const r = await run(reply(200, body));
      expect(r.ok, body).toBe(false);
      expect(r.message, body).toContain("wrong shape");
    }
    const long = await run(reply(200, `{"ok":true,"env":"${"x".repeat(300)}"}`));
    expect(long.ok).toBe(false);
    expect(long.message.length).toBeLessThan(120);
  });
  it("gives up after 8 seconds by default, not before", async () => {
    vi.useFakeTimers();
    const hang = (_u: unknown, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))));
    let settled = false;
    const pending = smoke({ url: URL_, expect: "staging", fetchImpl: hang as unknown as typeof fetch }).then((r) => {
      settled = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(7999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    const r = await pending;
    expect(r.ok).toBe(false);
    expect(r.message).toContain("cannot reach");
  });
  it("a secret-style key is named as such, a four-part token is not a JWT, and a JWT without a ref is accepted", () => {
    const secret = ["sb", "secret"].join("_") + "_abcdefghijklmnop";
    expect(checkKeyShape(secret, URL_)).toContain("secret-style key");
    expect(checkKeyShape(`${jwt({ role: "anon", ref: REF })}.extra`, URL_)).toContain("neither a JWT");
    expect(checkKeyShape("a.b", URL_)).toContain("neither a JWT");
    expect(checkKeyShape(jwt({ role: "anon" }), URL_)).toBeNull();
    expect(checkKeyShape(jwt({ role: "anon", ref: OTHER }), URL_)).toContain("different project");
  });
  it("never echoes the key in any message", async () => {
    const key = "hunter2-" + "k".repeat(20);
    const r = await run(reply(200, good), { anonKey: key });
    expect(r.ok).toBe(false);
    expect(r.message).not.toContain(key);
  });
  it("resolving: a missing, empty, absent or non-string ref is 'no project recorded' or 'not 20 characters', never a URL", () => {
    expect(() => resolveTarget(["staging"], {})).toThrow(/no project recorded for staging/);
    expect(() => resolveTarget(["staging"], { staging: {} })).toThrow(/no project recorded for staging/);
    expect(() => resolveTarget(["staging"], { staging: { ref: "" } })).toThrow(/no project recorded for staging/);
    expect(() => resolveTarget(["staging"], { staging: { ref: 12345678901234567890 } })).toThrow(/not a 20-character/);
    expect(() => resolveTarget(["staging"], { staging: { ref: REF.toUpperCase() } })).toThrow(/not a 20-character/);
    expect(() => resolveTarget(["staging"], { staging: { ref: `${REF}x` } })).toThrow(/not a 20-character/);
    expect(() => resolveTarget(["staging"], { staging: { ref: REF.slice(1) } })).toThrow(/not a 20-character/);
  });
  it("resolving: local needs a url and loses a trailing slash; --url needs its own value", () => {
    expect(() => resolveTarget(["local"], {})).toThrow(/no local url/);
    expect(() => resolveTarget(["local"], { local: {} })).toThrow(/no local url/);
    expect(resolveTarget(["local"], { local: { url: "http://127.0.0.1:54321//" } }).url).toBe("http://127.0.0.1:54321");
    expect(() => resolveTarget(["--url", "--expect", "staging"], envs)).toThrow(/--url needs a value/);
    expect(() => resolveTarget(["staging", "--expect", "staging"], envs)).toThrow(/--url needs a value/);
    expect(() => resolveTarget(["--url", "https://x.test", "--expect", "prod"], envs)).toThrow(/--expect must be one of/);
    expect(() => resolveTarget(["--url", "https://x.test", "--expect"], envs)).toThrow(/--expect must be one of/);
  });
});
