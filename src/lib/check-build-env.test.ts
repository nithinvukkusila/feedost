// @vitest-environment node
// F4 criterion 32 (unit part): the build guard can fail, and is skipped outside a Vercel build.
// Fixtures are made up at run time and keys are assembled from pieces, so no key-shaped text sits in a file.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkBuildEnv, guardApplies } from "../../scripts/check-build-env-lib.mjs";

const STAGING = "abcdefghijklmnopqrst";
const PROD = "tsrqponmlkjihgfedcba";
const envs = { local: { url: "http://127.0.0.1:54321" }, staging: { ref: STAGING }, production: { ref: PROD } };
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (payload: object) => `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;
const publishable = ["sb", "publishable", "x".repeat(24)].join("_");
const adminStyle = ["sb", "secret", "x".repeat(24)].join("_");

const good = (extra: Record<string, string> = {}) => ({
  VERCEL: "1",
  VERCEL_ENV: "preview",
  NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publishable,
  ...extra,
});
type Envs = Parameters<typeof checkBuildEnv>[1];
const problems = (env: Record<string, string | undefined>, e: Envs = envs) => {
  const r = checkBuildEnv(env, e);
  if (r.skipped) throw new Error("skipped");
  return r.problems;
};

describe("when the guard applies", () => {
  it("only on a Vercel build of preview or production", () => {
    expect(guardApplies({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(true);
    expect(guardApplies({ VERCEL: "1", VERCEL_ENV: "production" })).toBe(true);
    expect(guardApplies({ VERCEL: "1", VERCEL_ENV: "development" })).toBe(false);
    expect(guardApplies({ VERCEL: "1" })).toBe(false);
    expect(guardApplies({ VERCEL_ENV: "production" })).toBe(false);
    expect(guardApplies({})).toBe(false);
  });

  it("is skipped in CI (VERCEL_ENV without VERCEL), even with nothing set and a bad URL", () => {
    for (const env of [{ VERCEL_ENV: "production" }, { VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "http://localhost" }, {}]) {
      expect(checkBuildEnv(env, envs)).toEqual({ skipped: true, message: "build guard skipped: not a Vercel build" });
    }
  });
});

describe("a correct setup", () => {
  it("passes for preview with the staging project and a publishable key", () => {
    expect(problems(good())).toEqual([]);
  });
  it("passes for production with the production project and an anon JWT", () => {
    const env = good({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co/`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt({ role: "anon", ref: PROD }),
    });
    expect(problems(env)).toEqual([]);
  });
});

describe("the URL", () => {
  const bad = (url: string | undefined) => problems(good({ NEXT_PUBLIC_SUPABASE_URL: url as string }));
  it("must be present", () => {
    expect(bad(undefined).join()).toMatch(/NEXT_PUBLIC_SUPABASE_URL is missing/);
    expect(bad("").join()).toMatch(/missing/);
  });
  it("must be https", () => {
    expect(bad(`http://${STAGING}.supabase.co`).join()).toMatch(/https/);
  });
  it("must be on supabase.co, never localhost", () => {
    for (const url of ["https://localhost", "http://127.0.0.1:54321", `https://${STAGING}.example.com`, "https://supabase.co", "not a url"]) {
      expect(bad(url).length, url).toBeGreaterThan(0);
    }
  });
  it("must carry a 20-character ref", () => {
    expect(bad("https://short.supabase.co").join()).toMatch(/20-character/);
  });
  it("must be the project recorded for this environment, both ways round", () => {
    expect(bad(`https://${PROD}.supabase.co`).join()).toMatch(/not the staging project/);
    const prodBuild = good({ VERCEL_ENV: "production" }); // still holds the staging URL
    expect(problems(prodBuild).join()).toMatch(/not the production project/);
  });
});

describe("the key", () => {
  const bad = (key: string | undefined) => problems(good({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key as string }));
  it("must be present", () => {
    expect(bad(undefined).join()).toMatch(/ANON_KEY is missing/);
  });
  it("must not be a secret-style key", () => {
    expect(bad(adminStyle).length).toBeGreaterThan(0);
  });
  it("must not be a JWT with another role, nor something that is not a key", () => {
    expect(bad(jwt({ role: ["service", "role"].join("_") })).length).toBeGreaterThan(0);
    expect(bad("hello").length).toBeGreaterThan(0);
  });
  it("must belong to the same project as the URL when the JWT says which", () => {
    expect(bad(jwt({ role: "anon", ref: PROD })).join()).toMatch(/different project/);
    expect(bad(jwt({ role: "anon", ref: STAGING }))).toEqual([]);
  });
});

describe("the recorded refs", () => {
  it("fail the build when the ref for this environment is null", () => {
    expect(problems(good(), { ...envs, staging: { ref: null } }).join()).toMatch(/record the project ref first/);
    const prod = good({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: `https://${PROD}.supabase.co` });
    expect(problems(prod, { ...envs, production: { ref: null } }).join()).toMatch(/record the project ref first/);
  });
  it("do not fail a preview build because production is still null", () => {
    expect(problems(good(), { ...envs, production: { ref: null } })).toEqual([]);
  });
  it("fail when staging and production are the same project", () => {
    expect(problems(good(), { ...envs, production: { ref: STAGING } }).join()).toMatch(/must differ/);
  });
  it("fail when a recorded ref is malformed", () => {
    expect(problems(good(), { ...envs, staging: { ref: "nope" } }).join()).toMatch(/not a 20-character/);
  });
});

describe("variables that must not exist", () => {
  it("fails on a NEXT_PUBLIC_ name that mentions SERVICE, SECRET or PASSWORD", () => {
    for (const name of ["SERVICE", "SECRET", "PASSWORD"]) {
      expect(problems(good({ [`NEXT_PUBLIC_DB_${name}`]: "x" })).join(), name).toContain(`NEXT_PUBLIC_DB_${name} must not exist`);
    }
  });
});

describe("messages", () => {
  it("never repeat a value", () => {
    const secretish = "zzz-unique-value-zzz";
    const all = problems(
      good({
        NEXT_PUBLIC_SUPABASE_URL: `http://${secretish}.example.com`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: secretish,
        [`NEXT_PUBLIC_X_${"SEC" + "RET"}`]: secretish,
      }),
    ).join("\n");
    expect(all.length).toBeGreaterThan(0);
    expect(all).not.toContain(secretish);
  });
});

describe("the command", () => {
  const script = join(process.cwd(), "scripts", "check-build-env.mjs");
  const run = (env: Record<string, string>) =>
    spawnSync("node", [script], { encoding: "utf8", env: { PATH: process.env.PATH ?? "", NODE_ENV: "test", ...env } });

  it("skips with one line and exit 0 when run like CI", () => {
    const r = run({ VERCEL_ENV: "production" });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe("build guard skipped: not a Vercel build");
  });
  it("exits 1 on a Vercel build with nothing set, and names the variables", () => {
    const r = run({ VERCEL: "1", VERCEL_ENV: "preview" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("NEXT_PUBLIC_SUPABASE_URL is missing");
    expect(r.stderr).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
  });
  it("is not part of the build script yet", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    expect(pkg.scripts.build).toBe("next build");
    expect(pkg.scripts["check:build-env"]).toBe("node scripts/check-build-env.mjs");
  });
});
