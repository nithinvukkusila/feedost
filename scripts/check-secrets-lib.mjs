// The rules of `pnpm check:secrets` (F4 criteria 30 and 31). Finds admin-key material in anything
// we ship or are about to commit. It reports path, line and rule, never the matched text.
// The patterns are built from pieces so this file does not trip its own rules.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

const ROLE = ["service", "role"];
const S1 = new RegExp(`${ROLE[0]}[_-]${ROLE[1]}`, "i");
const S2 = new RegExp(`${["sb", "secret"].join("_")}_[A-Za-z0-9_-]{16,}`);
const S3 = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const S4 = new RegExp(`NEXT_PUBLIC_[A-Z0-9_]*(?:${["SERVICE", "SECRET", "PASSWORD"].join("|")})`, "i");

const RULES = {
  S1: "the admin key's name must not appear here",
  S2: "a secret-key token (sb_secret_...) must not appear here",
  S3: "a JWT whose role is the service role must not appear here",
  S4: "a NEXT_PUBLIC_ name must not contain SERVICE, SECRET or PASSWORD",
};

// Where the word rule (S1) and S4 do not apply: prose that discusses the key by name, and the
// places a function legitimately reads it.
const PROSE = (path) => path.endsWith(".md") || /^(docs|design|\.claude)\//.test(path);
const FUNCTION_SIDE = (path) => /^supabase\/(functions|tests)\//.test(path);

const SKIP_DIRS = new Set(["node_modules", ".git", ".next"]);

function isBinary(buffer) {
  return buffer.subarray(0, 8192).includes(0);
}

function walk(root, dir, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(root, full, out);
    else out.push(relative(root, full).split("\\").join("/"));
  }
}

/** Tracked and untracked-not-ignored files, plus everything in out/. Falls back to a walk outside git. */
export function listFiles(root = ".") {
  const files = new Set();
  const git = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  if (git.status === 0) {
    for (const f of git.stdout.split("\n").filter(Boolean)) if (existsSync(join(root, f))) files.add(f);
  } else {
    const all = [];
    walk(root, root, all);
    for (const f of all) if (!f.startsWith("out/")) files.add(f);
  }
  const built = [];
  walk(root, join(root, "out"), built);
  for (const f of built) files.add(f);
  return [...files].filter((f) => !f.split("/").some((part) => SKIP_DIRS.has(part))).sort();
}

function decodesToServiceRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return payload?.role === ROLE.join("_");
  } catch {
    return false;
  }
}

/** Rules for one file's text. Returns [{ line, rule }]. */
export function scanText(path, text) {
  const hits = [];
  const wordRules = !PROSE(path) && !FUNCTION_SIDE(path);
  const nameRule = !path.endsWith(".md");
  text.split("\n").forEach((line, index) => {
    const at = (rule) => hits.push({ line: index + 1, rule });
    if (wordRules && S1.test(line)) at("S1");
    if (S2.test(line)) at("S2");
    if (line.includes("eyJ") && (line.match(S3) ?? []).some(decodesToServiceRole)) at("S3");
    if (nameRule && S4.test(line)) at("S4");
  });
  return hits;
}

/** Scans `root`. Returns { problems: ["path:line  rule  explanation"], scanned }. */
export function scanAll(root = ".") {
  const problems = [];
  const files = listFiles(root);
  let scanned = 0;
  for (const path of files) {
    let buffer;
    try {
      buffer = readFileSync(join(root, path));
    } catch {
      continue;
    }
    if (isBinary(buffer)) continue;
    scanned += 1;
    for (const { line, rule } of scanText(path, buffer.toString("utf8"))) {
      problems.push(`${path}:${line}  ${rule}  ${RULES[rule]}`);
    }
  }
  return { problems, scanned };
}
