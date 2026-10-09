// @vitest-environment node
// F4 criterion 43: `pnpm smoke:env`, with a fake network.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
