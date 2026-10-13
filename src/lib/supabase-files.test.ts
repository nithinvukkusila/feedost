// @vitest-environment node
// F4 criteria 1, 4, 5, 26, 28, 29, 36 and 48: the Supabase project files are what the spec says.
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
    for (const file of ["index.ts", "handler.ts", "handler.test.ts"]) {
      expect(existsSync(join(root, "supabase", "functions", "health", file)), file).toBe(true);
    }
    const inFunctions = spawnSync("git", ["ls-files", "supabase/functions"], { cwd: root, encoding: "utf8" });
    expect(inFunctions.stdout.trim()).not.toBe("");
    for (const file of readdirSync(join(root, "supabase", "migrations"))) {
      expect(tracked(`supabase/migrations/${file}`), file).toBe(true);
    }
    for (const file of readdirSync(join(root, "supabase", "tests"))) {
      expect(tracked(`supabase/tests/${file}`), file).toBe(true);
    }
  });

  it("keep the baseline first, and it creates no table", () => {
    const files = readdirSync(join(root, "supabase", "migrations")).sort();
    expect(files.length).toBeGreaterThanOrEqual(1);
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
  it("routes /r/{token} and /p/{token} to their shells, with no referrer and noindex, and turns off auto-deploy for main", () => {
    expect(JSON.parse(read("vercel.json"))).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      git: { deploymentEnabled: { main: false } },
      // The only production routing the app has: the receipt (R1-7 Part B) and the pay page (R1-9 Part B). /join/* arrives with R1-13.
      rewrites: [
        { source: "/r/:token", destination: "/r/index.html" },
        { source: "/r/:token/", destination: "/r/index.html" },
        { source: "/p/:token", destination: "/p/index.html" },
        { source: "/p/:token/", destination: "/p/index.html" },
      ],
      headers: [
        {
          source: "/r/(.*)",
          headers: [
            { key: "Referrer-Policy", value: "no-referrer" },
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
          ],
        },
        {
          source: "/p/(.*)",
          headers: [
            { key: "Referrer-Policy", value: "no-referrer" },
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
          ],
        },
      ],
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

describe("the /dev/supabase sentinels in ci.yml (criteria 44 and 45)", () => {
  const ci = read(".github/workflows/ci.yml");
  const sentence = "Which Supabase does this build talk to?";

  it("looks for the page sentence and the test id in a normal build, and refuses both in a production build", () => {
    expect(ci).toContain(`grep -rqF "${sentence}" out`);
    expect(ci).toContain('grep -rqF "env-check-result" out/_next');
    const production = ci.slice(ci.indexOf("for sentinel in"));
    expect(production).toContain(`"${sentence}"`);
    expect(production).toContain('"env-check-result"');
  });

  it("gives the fake project address to the normal build only", () => {
    expect(ci.match(/NEXT_PUBLIC_SUPABASE_URL/g)).toHaveLength(1);
    expect(ci.indexOf("NEXT_PUBLIC_SUPABASE_URL")).toBeLessThan(ci.indexOf("VERCEL_ENV=production pnpm build"));
    expect(ci).toContain("https://cicicicicicicicicici.supabase.co");
  });

  it("keeps exactly two check:secrets runs", () => {
    expect(ci.match(/pnpm check:secrets/g)).toHaveLength(2);
  });
});

describe("the shape of ci.yml, gaps found by mutation (criteria 5, 14, 15, 34, 44 and 45)", () => {
  const ci = read(".github/workflows/ci.yml");
  const check = ci.slice(ci.indexOf("\n  check:"), ci.indexOf("\n  database:"));
  const database = ci.slice(ci.indexOf("\n  database:"));
  const at = (text: string, needle: string) => {
    const i = text.indexOf(needle);
    expect(i, `missing: ${needle}`).toBeGreaterThan(-1);
    return i;
  };

  it("runs on pull requests and on pushes to main only (no temporary branch trigger)", () => {
    const head = ci.slice(0, ci.indexOf("\npermissions:"));
    expect(head).toMatch(/\n {2}pull_request:\n/);
    expect(head).toMatch(/\n {2}push:\n {4}branches: \[main\]\n/);
    expect(head.match(/branches:/g)).toHaveLength(1);
    expect(ci).toMatch(/\npermissions:\n {2}contents: read\n/);
    expect(ci).toContain("cancel-in-progress: true");
  });

  // 45, not 25 or 15: the browser suite alone now takes 20 to 25 minutes (it hit the old 25-minute cap on
  // PR 15), and the production build and its checks still run after it. The database job keeps its
  // 15-minute cap (F4 criterion 15).
  it("the check job runs every gate, in order, and stops after 45 minutes", () => {
    expect(check).toMatch(/timeout-minutes: 45/);
    const steps = [
      "pnpm install --frozen-lockfile",
      "pnpm lint",
      "pnpm typecheck",
      "pnpm test\n",
      "pnpm i18n:check",
      "run: pnpm build",
      "The dev-page sentinels are in a normal build",
      "pnpm size",
      "pnpm check:leak",
      "pnpm check:secrets",
      "playwright install --with-deps chromium",
      "pnpm test:e2e",
      "Production build leaves out the dev routes",
    ];
    const positions = steps.map((s) => at(check, s));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("the normal build looks for all four sentinels", () => {
    const normal = check.slice(at(check, "The dev-page sentinels"), at(check, "pnpm size"));
    for (const s of ["Venkatasubrahmanyalakshminarasimharao", "Which Supabase does this build talk to?", "env-check-result", "banner-live-taps"]) {
      expect(normal, s).toContain(`grep -rqF "${s}"`);
    }
  });

  it("the production build step sets VERCEL_ENV, refuses out/dev and all five sentinels, then scans for secrets", () => {
    const production = check.slice(at(check, "Production build leaves out the dev routes"));
    expect(production).toContain("VERCEL_ENV=production pnpm build");
    expect(production).toContain("[ -e out/dev ]");
    const list = /for sentinel in (.*); do/.exec(production)?.[1] ?? "";
    expect(list.split('" "').map((s) => s.replace(/"/g, "")).sort()).toEqual(
      ["Venkatasubrahmanyalakshminarasimharao", "banner-live-taps", "Which Supabase does this build talk to?", "env-check-result", "TODO-translate"].sort(),
    );
    expect(production.indexOf("pnpm check:secrets")).toBeGreaterThan(production.indexOf("for sentinel in"));
    expect(production).toContain("exit 1");
  });

  it("the database job fetches full history, stops the stack even after a failure, and runs db:reset before db:test", () => {
    expect(database).toMatch(/timeout-minutes: 15/);
    expect(database).toMatch(/if: always\(\)\n\s+run: pnpm db:stop/);
    expect(at(database, "pnpm check:db")).toBeLessThan(at(database, "pnpm db:start"));
    expect(at(database, "pnpm db:start")).toBeLessThan(at(database, "pnpm db:reset"));
    expect(at(database, "pnpm db:reset")).toBeLessThan(at(database, "pnpm db:test"));
  });
});
