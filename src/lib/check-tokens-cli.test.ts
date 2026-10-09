// Criterion 2, the part the detector's own test does not reach: the scanner really stops `pnpm lint`.
// It is run as a command in a throwaway folder, so nothing in this repo is touched.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const script = join(process.cwd(), "scripts", "check-tokens.mjs");
const made: string[] = [];

function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "check-tokens-"));
  made.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

function run(cwd: string) {
  const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
  return { status: result.status, out: result.stdout + result.stderr };
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("check-tokens as a command (criterion 2)", () => {
  it("passes when components and pages use tokens only", () => {
    const cwd = project({
      "src/components/ui/thing.tsx": 'export const Thing = () => <p className="bg-blue text-slip text-lg rounded-sm" />;\n',
      "src/app/page.tsx": 'export default function Page() { return <main className="p-5" />; }\n',
    });
    const result = run(cwd);
    expect(result.status).toBe(0);
    expect(result.out).toContain("2 files");
  });

  it.each([
    ["a raw hex colour in a component", "src/components/ui/thing.tsx", 'export const Thing = () => <p className="bg-[#A81C22]" />;\n', "raw hex colour"],
    ["an arbitrary pixel font size in a component", "src/components/ui/thing.tsx", 'export const Thing = () => <p className="text-[13px]" />;\n', "arbitrary text size"],
    ["a raw hex colour in a page", "src/app/page.tsx", "export const c = '#1A1410';\n", "raw hex colour"],
    ["a pixel font size in a stylesheet under src/app", "src/app/extra.css", ".x { font-size: 12px; }\n", "pixel font size"],
    ["a raw hex colour in a dev page file", "src/app/dev/components/page.dev.tsx", "export const c = '#fff';\n", "raw hex colour"],
    // Added in review (S5).
    ["a raw hex colour in a plain .js file", "src/components/ui/legacy.js", "export const c = '#A81C22';\n", "raw hex colour"],
    ["a truncation in a .jsx file", "src/components/ui/legacy.jsx", 'export const Thing = () => <p className="truncate" />;\n', "truncation"],
    ["a raw hex colour in a stylesheet beside the token file", "src/styles/type.css", ".x { color: #A81C22; }\n", "raw hex colour"],
    ["a font size under 14px in src/styles", "src/styles/type.css", "@utility type-tiny { font-size: 0.75rem; }\n", "font size under 14px"],
    ["capitals set in a component, past the type roles", "src/components/ui/thing.tsx", 'export const Thing = () => <p className="uppercase" />;\n', "capitals outside the type roles"],
    ["an inline style colour in a component", "src/components/ui/thing.tsx", 'export const Thing = () => <p style={{ color: "red" }} />;\n', "inline style with a token"],
  ])("fails with exit code 1 on %s, and names the file and the rule", (_name, path, content, rule) => {
    const result = run(project({ [path]: content }));
    expect(result.status).toBe(1);
    expect(result.out).toContain(path);
    expect(result.out).toContain(rule);
  });

  it("does not scan test files or the token file itself", () => {
    const cwd = project({
      "src/components/ui/thing.test.tsx": "export const c = '#A81C22';\n",
      "src/styles/tokens.css": "@theme { --color-cloth: #A81C22; }\n",
      "src/styles/tokens.test.ts": "export const c = '#A81C22';\n",
      "src/components/ui/thing.tsx": "export const Thing = () => null;\n",
    });
    const result = run(cwd);
    expect(result.status).toBe(0);
    // Only thing.tsx is read: the token file and both test files are left out.
    expect(result.out).toContain("1 files");
  });

  it("is part of `pnpm lint`, which CI runs first", () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(pkg.scripts.lint).toMatch(/&&\s*node scripts\/check-tokens\.mjs\s*$/);
    const ci = readFileSync(join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");
    expect(ci).toMatch(/run: pnpm lint/);
  });

  it("finds nothing to report in this repo", () => {
    const result = run(process.cwd());
    expect(result.out).not.toMatch(/problem\(s\)/);
    expect(result.status).toBe(0);
  });
});
