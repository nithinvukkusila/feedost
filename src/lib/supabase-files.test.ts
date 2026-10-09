// @vitest-environment node
// F4 criteria 1, 4, 5, 26, 28, 29, 36 and 48: the Supabase project files are what the spec says.
// functions/health is checked when step 5 lands it.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** Section-aware line reader: `{ "auth.sms": { enable_signup: "false" } }`. No TOML library. */
function readToml(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = { "": {} };
  let section = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) continue;
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header) {
      section = header[1];
      out[section] ??= {};
      continue;
    }
    const pair = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (pair) out[section][pair[1]] = pair[2].replace(/\s+#.*$/, "").trim();
  }
  return out;
}

const config = readToml(read("supabase/config.toml"));

describe("the supabase folder (criterion 1)", () => {
  it("has config.toml and seed.sql", () => {
    expect(existsSync(join(root, "supabase", "config.toml"))).toBe(true);
    expect(existsSync(join(root, "supabase", "seed.sql"))).toBe(true);
  });

  it("names the project feedost", () => {
    expect(config[""].project_id).toBe('"feedost"');
  });
});

describe("the CLI dependency (criterion 5)", () => {
  const pkg = JSON.parse(read("package.json"));

  it("is pinned exactly and is dev only", () => {
    expect(pkg.devDependencies.supabase).toBe("2.118.0");
    expect(pkg.dependencies.supabase).toBeUndefined();
  });

  it("needs no build-script approval", () => {
    expect(read("pnpm-workspace.yaml")).not.toMatch(/supabase/);
  });

  it("has the db scripts", () => {
    for (const name of ["db:start", "db:stop", "db:reset", "db:test"]) {
      expect(pkg.scripts[name], name).toMatch(/supabase/);
    }
  });
});

describe("the migrations, functions and tests folders (criteria 1, 7 and 10)", () => {
  const tracked = (path: string) =>
    spawnSync("git", ["ls-files", "--error-unmatch", path], { cwd: root }).status === 0;

  it("exist and hold tracked files", () => {
    for (const dir of ["supabase/migrations", "supabase/tests", "supabase/functions"]) {
      expect(existsSync(join(root, dir)), dir).toBe(true);
    }
    // functions/ holds only .gitkeep until step 5 adds health/ and removes it.
    const inFunctions = spawnSync("git", ["ls-files", "supabase/functions"], { cwd: root, encoding: "utf8" });
    expect(inFunctions.stdout.trim()).not.toBe("");
    for (const file of readdirSync(join(root, "supabase", "migrations"))) {
      expect(tracked(`supabase/migrations/${file}`), file).toBe(true);
    }
    for (const file of readdirSync(join(root, "supabase", "tests"))) {
      expect(tracked(`supabase/tests/${file}`), file).toBe(true);
    }
  });

  it("have exactly one migration, the baseline, and it creates no table", () => {
    const files = readdirSync(join(root, "supabase", "migrations"));
    expect(files).toHaveLength(1);
    expect(files[0]).toMatch(/^\d{14}_f4_baseline\.sql$/);
    expect(read(`supabase/migrations/${files[0]}`)).not.toMatch(/create\s+table/i);
  });

  it("have the shared helper and the three RLS and privilege tests", () => {
    const names = readdirSync(join(root, "supabase", "tests")).sort();
    expect(names).toEqual(
      expect.arrayContaining([
        "000_helpers.sql",
        "010_rls_probe.sql",
        "020_public_tables_have_rls.sql",
        "030_default_privileges.sql",
      ]),
    );
  });
});

describe("seed.sql (criteria 4 and 26)", () => {
  const code = read("supabase/seed.sql")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  it("is comments only: no insert, copy, or statement at all", () => {
    expect(code.trim()).toBe("");
  });

  it("holds no phone number or email address, even in comments", () => {
    const all = read("supabase/seed.sql");
    expect(all).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
    expect(all).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  it("is seeded only locally: config.toml has no remote seed, and no script uses --include-seed", () => {
    expect(config["db.seed"].sql_paths).toBe('["./seed.sql"]');
    for (const file of ["package.json", ".github/workflows/ci.yml"]) {
      expect(read(file), file).not.toContain("--include-seed");
    }
  });
});

describe("auth settings in config.toml (criteria 48 and 49)", () => {
  it("allows email sign-in and nothing else", () => {
    expect(config["auth.email"].enable_signup).toBe("true");
    expect(config.auth.enable_anonymous_sign_ins).toBe("false");
    expect(config["auth.sms"].enable_signup).toBe("false");
    expect(config["auth.external.google"].enabled).toBe("false");
  });

  it("enables no SMS provider", () => {
    for (const [name, body] of Object.entries(config)) {
      if (name.startsWith("auth.sms.")) expect(body.enabled, name).not.toBe("true");
    }
  });

  it("holds no Google client id or secret and leaves the site URL alone", () => {
    expect(config["auth.external.google"].client_id).toBeUndefined();
    expect(config["auth.external.google"].secret).toBeUndefined();
    expect(config.auth.site_url).toBe('"http://127.0.0.1:3000"');
  });

  it("gives the health function no JWT check and the local APP_ENV", () => {
    expect(config["functions.health"].verify_jwt).toBe("false");
    expect(config["edge_runtime.secrets"].APP_ENV).toBe('"local"');
  });
});

describe(".env.example and .gitignore (criteria 28 and 29)", () => {
  const lines = read(".env.example")
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.trim().startsWith("#"));

  it("has placeholders only: every variable is empty", () => {
    for (const line of lines) expect(line, line).toMatch(/^[A-Z][A-Z0-9_]*=$/);
  });

  it("names the public pair and the command-line-only variables", () => {
    const names = lines.map((line) => line.replace(/=$/, ""));
    expect(names).toEqual(
      expect.arrayContaining([
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_ACCESS_TOKEN",
        "SUPABASE_DB_PASSWORD",
        "VERCEL_AUTOMATION_BYPASS_SECRET",
      ]),
    );
  });

  it("has no NEXT_PUBLIC_ name that mentions SERVICE, SECRET or PASSWORD", () => {
    for (const line of lines) expect(line).not.toMatch(/^NEXT_PUBLIC_\w*(SERVICE|SECRET|PASSWORD)/);
  });

  const ignored = (path: string) =>
    spawnSync("git", ["check-ignore", "-q", path], { cwd: root }).status === 0;

  it("ignores every env file except .env.example", () => {
    for (const path of [".env", ".env.local", ".env.production", "supabase/.env", "supabase/.env.local", "supabase/functions/.env"]) {
      expect(ignored(path), path).toBe(true);
    }
    expect(ignored(".env.example")).toBe(false);
  });
});

describe("vercel.json (criterion 36)", () => {
  it("only turns off auto-deploy for main", () => {
    expect(JSON.parse(read("vercel.json"))).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      git: { deploymentEnabled: { main: false } },
    });
  });
});

describe("the database job in ci.yml (criteria 14, 15 and 34)", () => {
  const ci = read(".github/workflows/ci.yml");
  const job = ci.slice(ci.indexOf("\n  database:"));

  it("exists beside the check job with no needs between them", () => {
    expect(ci).toMatch(/\n {2}check:/);
    expect(ci).toMatch(/\n {2}database:/);
    expect(ci).not.toMatch(/\bneeds:/);
  });

  it("stops after 15 minutes and runs check:db, reset, and the tests twice", () => {
    expect(job).toMatch(/timeout-minutes: 15/);
    expect(job).toContain("fetch-depth: 0");
    expect(job).toMatch(/pnpm check:db --base/);
    expect(job).toContain("pnpm db:reset");
    expect(job.match(/pnpm db:test/g)).toHaveLength(2);
  });

  it("picks the base by event: the pull request target, or the push's previous commit", () => {
    expect(job).toContain("origin/$BASE_REF");
    expect(job).toContain("github.event.before");
  });
});
