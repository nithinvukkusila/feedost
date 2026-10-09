// The rules of `pnpm check:db`. Each function returns a list of problem strings; the command in
// check-db.mjs prints them and sets the exit code. Rules (F4 criteria 8, 16 and 17a):
//   1. every file in supabase/migrations/ is named <14 digits>_<snake_case>.sql, timestamps unique
//   2. against the base ref, a migration may be added but never modified, deleted or renamed
//   3. a new migration is not older than the newest one already on the base
//   4. no create/alter/drop of a table, policy, function ... outside supabase/migrations/
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";

export const MIGRATIONS = "supabase/migrations";
const NAME = /^(\d{14})_[a-z][a-z0-9_]*\.sql$/;
const DDL = /\b(create|alter|drop)\s+(?:or\s+replace\s+)?(?:unique\s+)?(?:materialized\s+)?(table|policy|function|schema|extension|trigger|index|type|view)\b/i;
const ZEROS = /^0+$/;

/** Rule 1. `dir` is the migrations folder; a missing folder is fine (no migrations yet). */
export function checkNames(root = ".") {
  const dir = join(root, MIGRATIONS);
  if (!existsSync(dir)) return [];
  const problems = [];
  const seen = new Map();
  for (const file of readdirSync(dir).sort()) {
    const match = NAME.exec(file);
    if (!match) {
      problems.push(`${MIGRATIONS}/${file}: name must be <14 digits>_<snake_case>.sql (use "pnpm exec supabase migration new <name>")`);
      continue;
    }
    if (seen.has(match[1])) problems.push(`${MIGRATIONS}/${file}: timestamp ${match[1]} is also used by ${seen.get(match[1])}`);
    else seen.set(match[1], file);
  }
  return problems;
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return { ok: result.status === 0, out: result.stdout ?? "", err: (result.stderr ?? "").trim() };
}

/** Rules 2 and 3. Fails, never passes silently, when the base cannot be resolved. */
export function checkHistory(root, base) {
  const known = git(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  if (!known.ok) {
    return [`base "${base}" cannot be resolved: fetch it first (CI uses fetch-depth: 0), or pass --base <ref>`];
  }
  const diff = git(root, ["diff", "--name-status", "-M", `${base}...HEAD`, "--", MIGRATIONS]);
  if (!diff.ok) return [`git diff against "${base}" failed: ${diff.err || "no common history"}`];

  const onBase = git(root, ["ls-tree", "-r", "--name-only", base, "--", MIGRATIONS]).out.split("\n").filter(Boolean);
  const newest = onBase.map((p) => NAME.exec(p.split("/").pop())?.[1]).filter(Boolean).sort().pop() ?? "";

  const problems = [];
  for (const line of diff.out.split("\n").filter(Boolean)) {
    const [status, ...paths] = line.split("\t");
    const kind = status[0];
    if (kind === "A") {
      const stamp = NAME.exec(paths[0].split("/").pop())?.[1];
      if (stamp && stamp < newest) {
        problems.push(`${paths[0]}: older than ${newest}, the newest migration on ${base}; rebase, then re-stamp it with "supabase migration new"`);
      }
    } else {
      const what = { M: "modified", D: "deleted", R: "renamed", C: "copied", T: "changed type" }[kind] ?? `changed (${status})`;
      problems.push(`${paths.join(" -> ")}: an existing migration was ${what}; add a new migration instead`);
    }
  }
  return problems;
}

const SCANNED_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".json"]);

function* walk(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir).sort()) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (SCANNED_EXT.has(extname(name))) yield path;
  }
}

/** Source text with block comments, full-line comments and trailing comments removed (lines kept). */
export function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .split("\n")
    .map((line) => line.replace(/^\s*(\/\/|--).*$/, "").replace(/\s(\/\/|--)\s.*$/, ""))
    .join("\n");
}

/** Rule 4. supabase/tests/ and supabase/migrations/ are the only places allowed to hold DDL. */
export function checkNoDdlOutside(root = ".") {
  const files = [...walk(join(root, "supabase", "functions")), ...walk(join(root, "src"))];
  const seed = join(root, "supabase", "seed.sql");
  if (existsSync(seed)) files.push(seed);
  const problems = [];
  for (const file of files) {
    const lines = stripComments(readFileSync(file, "utf8")).split("\n");
    lines.forEach((line, index) => {
      const hit = DDL.exec(line);
      if (hit) {
        const shown = file.slice(root === "." ? 0 : root.length + 1);
        problems.push(`${shown}:${index + 1}  "${hit[1].toLowerCase()} ${hit[2].toLowerCase()}" belongs in ${MIGRATIONS}/ only`);
      }
    });
  }
  return problems;
}

/** All rules. A base of all zeros (the first push of a branch) skips the history rules, and says so. */
export function checkAll({ root = ".", base = "origin/main" } = {}) {
  const notes = [];
  const problems = [...checkNames(root), ...checkNoDdlOutside(root)];
  if (ZEROS.test(base)) notes.push(`history rules skipped: base ${base.slice(0, 7)} is empty (first push)`);
  else problems.push(...checkHistory(root, base));
  return { problems, notes };
}
