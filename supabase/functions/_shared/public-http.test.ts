// @vitest-environment node
// R1-9 Part A criteria 12 to 15: the shared plumbing of pay-page and record-consent.
import { describe, expect, it } from "vitest";
import { DEFAULT_ALLOWED_HOSTS, DUMMY_TOKEN, MAX_BODY_BYTES, TOKEN_RE, allowedOrigin, clientIp, codeOnly, hostMatches, preflight, readLimited, respond } from "./public-http.ts";

describe("hostMatches", () => {
  it("matches exactly and with a star for part of one label", () => {
    expect(hostMatches("feedost.vercel.app", "feedost.vercel.app")).toBe(true);
    expect(hostMatches("feedost.vercel.app", "evil-feedost.vercel.app")).toBe(false);
    expect(hostMatches("feedost.vercel.app", "feedostxvercelxapp")).toBe(false);
    expect(hostMatches("feedost-*-p.vercel.app", "feedost-abc123-p.vercel.app")).toBe(true);
    expect(hostMatches("feedost-*-p.vercel.app", "feedost-a.b-p.vercel.app")).toBe(false);
    expect(hostMatches("feedost-*-p.vercel.app", "feedost--p.vercel.app")).toBe(false);
  });
});

describe("allowedOrigin", () => {
  it("echoes the default hosts only, https only", () => {
    expect(allowedOrigin("https://feedost.vercel.app", "staging", undefined)).toBe("https://feedost.vercel.app");
    expect(allowedOrigin("https://feedost-git-r1-other-projects.vercel.app", "staging", undefined)).toBeNull();
    expect(allowedOrigin("https://feedost-abc123-nithinvukkusilas-projects.vercel.app", "staging", undefined)).not.toBeNull();
    expect(allowedOrigin("http://feedost.vercel.app", "staging", undefined)).toBeNull();
    expect(allowedOrigin("https://evil.example", "staging", undefined)).toBeNull();
    expect(allowedOrigin(null, "staging", undefined)).toBeNull();
    expect(DEFAULT_ALLOWED_HOSTS).toContain("feedost.vercel.app");
  });
  it("an own host list replaces the default", () => {
    expect(allowedOrigin("https://pay.example.in", "staging", "pay.example.in , other.example")).toBe("https://pay.example.in");
    expect(allowedOrigin("https://feedost.vercel.app", "staging", "pay.example.in")).toBeNull();
  });
  it("localhost only when APP_ENV is local", () => {
    expect(allowedOrigin("http://localhost:3000", "local", undefined)).toBe("http://localhost:3000");
    expect(allowedOrigin("http://localhost:3000", "staging", undefined)).toBeNull();
    expect(allowedOrigin("http://localhost:3001", "local", undefined)).toBeNull();
  });
});

describe("headers", () => {
  it("every answer carries the safe header set, whatever the status", async () => {
    const answers = [
      respond(200, { code: "ok" }, {}),
      codeOnly(404, "not_found", {}),
      codeOnly(429, "rate_limited", {}, { "Retry-After": "3600" }),
      preflight(null, {}),
      preflight("https://feedost.vercel.app", { "Access-Control-Allow-Origin": "https://feedost.vercel.app" }),
    ];
    for (const res of answers) {
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
      expect(res.headers.get("referrer-policy")).toBe("no-referrer");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    }
    expect(await answers[1].text()).toBe('{"code":"not_found"}');
    expect(answers[2].headers.get("retry-after")).toBe("3600");
  });
  it("the preflight allows POST and content-type for an allowed origin only", () => {
    const ok = preflight("https://feedost.vercel.app", { "Access-Control-Allow-Origin": "https://feedost.vercel.app" });
    expect(ok.status).toBe(204);
    expect(ok.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    const bad = preflight(null, {});
    expect(bad.status).toBe(204);
    expect(bad.headers.get("access-control-allow-origin")).toBeNull();
    expect(bad.headers.get("access-control-allow-methods")).toBeNull();
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) => new Request("https://x.test/", { headers });
  it("reads cf-connecting-ip, then x-real-ip", () => {
    expect(clientIp(req({ "cf-connecting-ip": "203.0.113.7", "x-real-ip": "198.51.100.1" }))).toBe("203.0.113.7");
    expect(clientIp(req({ "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
  });
  it("never reads x-forwarded-for, and says unknown when nothing is given", () => {
    expect(clientIp(req({ "x-forwarded-for": "1.2.3.4" }))).toBe("unknown");
    expect(clientIp(req({ "cf-connecting-ip": "  " }))).toBe("unknown");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("readLimited", () => {
  const post = (body: string, headers: Record<string, string> = {}) => new Request("https://x.test/", { method: "POST", body, headers });
  it("reads a body within the limit", async () => {
    expect(await readLimited(post('{"a":1}'))).toBe('{"a":1}');
    expect(await readLimited(new Request("https://x.test/", { method: "POST" }))).toBe("");
  });
  it("refuses a body over the limit, declared or streamed", async () => {
    expect(await readLimited(post("x".repeat(MAX_BODY_BYTES + 1)))).toBeNull();
    // The declared length lies; the stream is still counted.
    const lying = new Request("https://x.test/", { method: "POST", body: "x".repeat(MAX_BODY_BYTES + 1) });
    Object.defineProperty(lying, "headers", { value: new Headers({ "content-length": "5" }) });
    expect(await readLimited(lying)).toBeNull();
    expect(await readLimited(post("x".repeat(MAX_BODY_BYTES)))).toHaveLength(MAX_BODY_BYTES);
  });
  it("takes the limit as an argument", async () => {
    expect(await readLimited(post("abcdef"), 5)).toBeNull();
    expect(await readLimited(post("abcde"), 5)).toBe("abcde");
  });
});

describe("tokens", () => {
  it("the shape matches the database's tokens and the dummy fits it", () => {
    expect(TOKEN_RE.test("AbCdEfGhIjKlMnOpQrStUvWx")).toBe(true);
    expect(TOKEN_RE.test("A".repeat(21))).toBe(false);
    expect(TOKEN_RE.test("A".repeat(65))).toBe(false);
    expect(TOKEN_RE.test("AbCdEfGhIjKlMnOpQrStUv!!")).toBe(false);
    expect(TOKEN_RE.test(DUMMY_TOKEN)).toBe(true);
  });
});
