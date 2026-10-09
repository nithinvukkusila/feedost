// @vitest-environment node
// F4 criteria 8, 16 and 17a: `pnpm check:db`, run as a command in throwaway git repos.
// SQL statements are built from pieces so this file does not trip the rule it tests.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "check-db.mjs");
const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const ddl = (verb: string, what: string) => [verb, what, "x (id int);"].join(" ");
const M = "supabase/migrations";
const OLD = "20261001000000_first_thing.sql";
const NEW = "20261010000000_second_thing.sql";

function git(cwd: string, ...args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

function put(cwd: string, path: string, text: string) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), text);
}

/** A repo whose `main` holds one migration (OLD), with HEAD on a branch `work` at the same commit. */
function repo(): string {
  const cwd = mkdtempSync(join(tmpdir(), "check-db-"));
  made.push(cwd);
  git(cwd, "init", "-q", "-b", "main");
  git(cwd, "config", "user.email", "t@example.test");
  git(cwd, "config", "user.name", "t");
  put(cwd, `${M}/${OLD}`, "select 1;\n");
  put(cwd, "src/app.ts", "export const a = 1;\n");
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", "base");
  git(cwd, "checkout", "-q", "-b", "work");
  return cwd;
}

function commit(cwd: string) {
  git(cwd, "add", "-A");
  git(cwd, "commit", "-q", "-m", "change");
}

function run(cwd: string, ...args: string[]) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { status: r.status, out: r.stdout + r.stderr };
}

describe("check:db passes (criteria 8, 16)", () => {
  it("on a branch with no change", () => {
    const r = run(repo(), "--base", "main");
    expect(r.status).toBe(0);
    expect(r.out).toContain("hold against main");
  });

  it("when a new migration is added", () => {
    const cwd = repo();
    put(cwd, `${M}/${NEW}`, ddl("create", "table"));
    commit(cwd);
    expect(run(cwd, "--base", "main").status).toBe(0);
  });

  it("when there is no migrations folder at all", () => {
    const cwd = mkdtempSync(join(tmpdir(), "check-db-"));
    made.push(cwd);
    git(cwd, "init", "-q", "-b", "main");
    git(cwd, "config", "user.email", "t@example.test");
    git(cwd, "config", "user.name", "t");
    put(cwd, "README.md", "x\n");
    git(cwd, "add", "-A");
    git(cwd, "commit", "-q", "-m", "base");
    expect(run(cwd, "--base", "main").status).toBe(0);
  });
});

describe("migration names (criterion 8)", () => {
  const bad = ["0004_payments.sql", "20261010_short.sql", "20261010000000_Upper.sql", "20261010000000-dash.sql", "20261010000000_x.txt", "notes.md"];
  for (const name of bad) {
    it(`rejects ${name}`, () => {
      const cwd = repo();
      put(cwd, `${M}/${name}`, "select 1;\n");
      commit(cwd);
      const r = run(cwd, "--base", "main");
      expect(r.status).toBe(1);
      expect(r.out).toContain(name);
    });
  }

  it("rejects two migrations with the same timestamp", () => {
    const cwd = repo();
    put(cwd, `${M}/20261001000000_other_thing.sql`, "select 1;\n");
    commit(cwd);
    const r = run(cwd, "--base", "main");
    expect(r.status).toBe(1);
    expect(r.out).toContain("20261001000000");
  });
});

describe("existing migrations are immutable (criterion 16)", () => {
  it("fails when one is edited", () => {
    const cwd = repo();
    put(cwd, `${M}/${OLD}`, "select 2;\n");
    commit(cwd);
    const r = run(cwd, "--base", "main");
    expect(r.status).toBe(1);
    expect(r.out).toContain("modified");
    expect(r.out).toContain(OLD);
  });

  it("fails when one is deleted", () => {
    const cwd = repo();
    git(cwd, "rm", "-q", `${M}/${OLD}`);
    commit(cwd);
    const r = run(cwd, "--base", "main");
    expect(r.status).toBe(1);
    expect(r.out).toContain("deleted");
  });

  it("fails when one is renamed", () => {
    const cwd = repo();
    git(cwd, "mv", `${M}/${OLD}`, `${M}/20261001000000_renamed_thing.sql`);
    commit(cwd);
    const r = run(cwd, "--base", "main");
    expect(r.status).toBe(1);
    expect(r.out).toContain("renamed");
  });

  it("fails when a new migration is older than the newest on the base", () => {
    const cwd = repo();
    put(cwd, `${M}/20260901000000_too_old.sql`, "select 1;\n");
    commit(cwd);
    const r = run(cwd, "--base", "main");
    expect(r.status).toBe(1);
    expect(r.out).toContain("re-stamp");
  });

  it("fails, and does not pass silently, when the base cannot be resolved", () => {
    const r = run(repo(), "--base", "origin/nowhere");
    expect(r.status).toBe(1);
    expect(r.out).toContain("cannot be resolved");
  });

  it("skips the history rules, and says so, when the base is all zeros (first push)", () => {
    const cwd = repo();
    put(cwd, `${M}/${OLD}`, "select 2;\n");
    commit(cwd);
    const r = run(cwd, "--base", "0".repeat(40));
    expect(r.status).toBe(0);
    expect(r.out).toContain("skipped");
  });
});

describe("no schema change outside supabase/migrations (criterion 17a)", () => {
  const where: Array<[string, string]> = [
    ["src/lib/db.ts", "const q = `" + ddl("create", "table") + "`;\n"],
    ["supabase/functions/health/index.ts", "const q = '" + ddl("alter", "table") + "';\n"],
    ["supabase/seed.sql", ddl("drop", "table") + "\n"],
    ["src/lib/p.ts", "const q = 'create  POLI" + "CY p on t';\n"],
    ["supabase/functions/x/a.ts", "const q = 'create or replace " + "function f()';\n"],
  ];
  for (const [path, text] of where) {
    it(`fails for ${path}`, () => {
      const cwd = repo();
      put(cwd, path, text);
      commit(cwd);
      const r = run(cwd, "--base", "main");
      expect(r.status).toBe(1);
      expect(r.out).toContain(`${path}:1`);
    });
  }

  it("fails for each statement kind in the spec", () => {
    for (const [verb, what] of [["create", "function"], ["create", "policy"], ["drop", "index"], ["alter", "table"], ["create", "extension"]]) {
      const cwd = repo();
      put(cwd, "src/lib/q.ts", `const q = "${verb} ${what} y";\n`);
      commit(cwd);
      expect(run(cwd, "--base", "main").status, `${verb} ${what}`).toBe(1);
    }
  });

  it("allows the same statements in migrations and in supabase/tests", () => {
    const cwd = repo();
    put(cwd, `${M}/${NEW}`, ddl("create", "table") + "\n" + ddl("drop", "table") + "\n");
    put(cwd, "supabase/tests/010_probe.sql", ddl("create", "table") + "\n");
    commit(cwd);
    expect(run(cwd, "--base", "main").status).toBe(0);
  });

  it("ignores comments and ordinary words", () => {
    const cwd = repo();
    put(cwd, "src/lib/c.ts", `// ${ddl("create", "table")}\n/* ${ddl("drop", "table")} */\nconst note = "create a table of fees"; // ${ddl("alter", "table")}\n`);
    put(cwd, "supabase/seed.sql", `-- ${ddl("create", "table")}\n`);
    commit(cwd);
    expect(run(cwd, "--base", "main").status).toBe(0);
  });

  it("does not print the whole line, only the file, line number and the kind of statement", () => {
    const cwd = repo();
    put(cwd, "src/lib/leak.ts", `const secret = "hunter2"; const q = "${ddl("drop", "table")}";\n`);
    commit(cwd);
    const r = run(cwd, "--base", "main");
    expect(r.out).not.toContain("hunter2");
  });
});
