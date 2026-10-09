// @vitest-environment node
// F4 criteria 41 and 42: the health handler, called directly.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handle } from "./handler.ts";

const call = (method: string, env: string | undefined) =>
  handle(new Request("http://x.test/functions/v1/health", { method }), env);

describe("GET with a valid APP_ENV", () => {
  it.each(["local", "staging", "production"])("answers exactly the one-line body for %s", async (env) => {
    const res = call("GET", env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(`{"ok":true,"env":"${env}"}`);
  });

  it("sends only the headers the plan lists", () => {
    const res = call("GET", "staging");
    expect([...res.headers.keys()].sort()).toEqual(["access-control-allow-origin", "cache-control", "content-type"]);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });
});

describe("OPTIONS", () => {
  it("answers 204 with CORS headers and no body, even with APP_ENV unset", async () => {
    for (const env of ["staging", undefined]) {
      const res = call("OPTIONS", env);
      expect(res.status).toBe(204);
      expect(await res.text()).toBe("");
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      expect(res.headers.get("access-control-allow-methods")).toBe("GET, OPTIONS");
      expect(res.headers.get("access-control-allow-headers")).toBe("apikey, authorization, content-type");
    }
  });
});

describe("other methods", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s answers 405 with Allow", async (method) => {
    const res = handle(new Request("http://x.test/", { method, body: "{}" }), "staging");
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, OPTIONS");
    expect(await res.text()).toBe('{"ok":false}');
  });
});

describe("APP_ENV unset or invalid", () => {
  it.each([undefined, "", "Staging", "prod", "dev", " local", "local "])("answers 500 for %j and never says local", async (env) => {
    const res = call("GET", env);
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe('{"ok":false}');
    expect(text).not.toContain("local");
  });
});

describe("source rules (criterion 42)", () => {
  const forbidden = [["service", "role"].join("_"), "SUPABASE_", ["Deno", "env"].join(".") + ".toObject"];
  it.each(["handler.ts", "index.ts"])("%s names no admin key, no SUPABASE_ variable, no database", (file) => {
    const src = readFileSync(join(process.cwd(), "supabase/functions/health", file), "utf8");
    for (const word of forbidden) expect(src.toLowerCase()).not.toContain(word.toLowerCase());
    expect(src).not.toMatch(/createClient|supabase-js|\.rpc\(|\.from\(/);
  });
  it("index.ts reads only APP_ENV", () => {
    const src = readFileSync(join(process.cwd(), "supabase/functions/health/index.ts"), "utf8");
    expect(src.match(/Deno\.env\.get\("([^"]+)"\)/g)).toEqual(['Deno.env.get("APP_ENV")']);
  });
});
