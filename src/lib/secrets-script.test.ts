// @vitest-environment node
// F4 criteria 30, 31 and 34: `pnpm check:secrets`, run as a command on throwaway folders.
// Every fake secret is built at run time from pieces, so neither this file nor the repo scan trips.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "check-secrets.mjs");
const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (role: string) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase", role })}.fakesignature`;
const ROLE = ["service", "role"];
const word = ROLE.join("_");
const upperWord = word.toUpperCase();
const secretKey = `${["sb", "secret"].join("_")}_${"a1b2c3d4".repeat(3)}`;
const publicName = (tail: string) => `NEXT_PUBLIC_SUPABASE_${tail}`;

function folder(files: Record<string, string>): string {
  const cwd = mkdtempSync(join(tmpdir(), "check-secrets-"));
  made.push(cwd);
  spawnSync("git", ["init", "-q"], { cwd });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), text);
  }
  return cwd;
}

function run(cwd: string) {
  const r = spawnSync("node", [script, "--root", cwd], { encoding: "utf8" });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

describe("passes (criterion 30)", () => {
  it("allows the anon key and the publishable prefix, in src and out", () => {
    const cwd = folder({
      "src/a.ts": `const key = "${jwt("anon")}"; const p = "sb_publishable_abcdefghijklmnop1234";`,
      "out/chunk.js": `x="${jwt("anon")}"`,
    });
    const r = run(cwd);
    expect(r.out).toContain("no admin-key material");
    expect(r.code).toBe(0);
  });

  it("ignores the bare prefix in prose and a token that does not decode", () => {
    const cwd = folder({
      "src/a.ts": `// keys start with ${["sb", "secret"].join("_")}_ and are never shipped\nconst t = "eyJxxx.eyJyyy.zzz";`,
    });
    expect(run(cwd).code).toBe(0);
  });
});

describe("fails, one case per rule, and never prints the value", () => {
  const cases: [string, string, string, string][] = [
    ["S1 the word", "src/a.ts", `const k = process.env.${upperWord};`, "S1"],
    ["S1 hyphen form, any case", "out/index.html", `<p>${ROLE.join("-")}</p>`, "S1"],
    ["S2 secret key", "src/a.ts", `const k = "${secretKey}";`, "S2"],
    ["S3 admin JWT", "out/c.js", `x="${jwt(word)}"`, "S3"],
    ["S3 admin JWT in docs", "docs/notes.md", `key: ${jwt(word)}`, "S3"],
    ["S4 name", "src/env.ts", `process.env.${publicName("SERVICE_KEY")}`, "S4"],
    ["S4 secret name", ".env.example", `${publicName("SECRET")}=`, "S4"],
    ["S4 password name", "src/env.ts", `${publicName("DB_PASSWORD")}`, "S4"],
  ];
  for (const [name, path, text, rule] of cases) {
    it(name, () => {
      const r = run(folder({ [path]: `line one\n${text}\n` }));
      expect(r.code).toBe(1);
      expect(r.out).toContain(`${path}:2  ${rule}`);
      expect(r.out).not.toContain(secretKey);
      expect(r.out).not.toContain(jwt(word));
      expect(r.out).not.toContain(upperWord);
    });
  }

  it("scans untracked files, not only tracked ones", () => {
    const cwd = folder({ "src/a.ts": "export {};\n" });
    spawnSync("git", ["add", "-A"], { cwd });
    writeFileSync(join(cwd, "src", "new.ts"), `const k = "${secretKey}";`);
    expect(run(cwd).code).toBe(1);
  });
});

describe("scope", () => {
  it("lets docs, markdown, .claude, functions and pgTAP files name the key", () => {
    const text = `reads ${upperWord}\n`;
    const cwd = folder({
      "docs/a.md": text,
      "README.md": text,
      ".claude/agents/x.txt": text,
      "design/x.html": text,
      "supabase/functions/h/index.ts": text,
      "supabase/tests/a.sql": text,
    });
    expect(run(cwd).code).toBe(0);
  });

  it("still catches the word in config, workflows, messages and e2e", () => {
    for (const path of ["supabase/config.toml", ".github/workflows/x.yml", "messages/en.json", "e2e/a.spec.ts", "package.json"]) {
      expect(run(folder({ [path]: `a ${word}` })).code, path).toBe(1);
    }
  });

  it("does not scan node_modules, .git or binary files", () => {
    const cwd = folder({
      "node_modules/x/index.js": word,
      "src/img.bin": `\0${word}`,
    });
    expect(run(cwd).code).toBe(0);
  });

  it("scans out/ even when it is git-ignored", () => {
    const cwd = folder({ ".gitignore": "out/\n", "out/a.js": word });
    expect(run(cwd).code).toBe(1);
  });
});

describe("the repository itself", () => {
  it("passes on the real tree", () => {
    const r = run(process.cwd());
    expect(r.out).toContain("no admin-key material");
    expect(r.code).toBe(0);
  });

  it("src/ never contains the literal words", () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (new RegExp(word, "i").test(readFileSync(full, "utf8"))) hits.push(full);
      }
    };
    walk(join(process.cwd(), "src"));
    expect(hits).toEqual([]);
  });
});

describe("ci.yml (criteria 31 and 34)", () => {
  const ci = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
  it("uses no repository secret", () => {
    expect(ci).not.toContain("secrets.");
  });
  it("runs check:secrets after check:leak and after the production build", () => {
    const runs = [...ci.matchAll(/pnpm check:secrets/g)].length;
    expect(runs).toBe(2);
    expect(ci.indexOf("pnpm check:leak")).toBeLessThan(ci.indexOf("pnpm check:secrets"));
    expect(ci.lastIndexOf("pnpm check:secrets")).toBeGreaterThan(ci.indexOf("VERCEL_ENV=production pnpm build"));
  });
});
