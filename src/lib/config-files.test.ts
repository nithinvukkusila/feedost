// Criterion 8: the build is a static export and uses nothing the Next.js docs list as unsupported
// with `output: 'export'`: no proxy or middleware file, no redirects() or rewrites() in next.config.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { walk } from "@/test-utils/find-own-words";

const root = process.cwd();
const config = readFileSync(join(root, "next.config.ts"), "utf8");
const code = config
  .split("\n")
  .filter((line) => !line.trim().startsWith("//"))
  .join("\n");

describe("a static export (criterion 8)", () => {
  it("uses output: 'export'", () => {
    expect(code).toMatch(/output:\s*["']export["']/);
  });

  it("has no proxy or middleware file", () => {
    for (const dir of ["", "src"]) {
      for (const name of ["proxy", "middleware"]) {
        for (const ext of ["ts", "js", "mjs", "tsx"]) {
          expect(existsSync(join(root, dir, `${name}.${ext}`)), `${dir}/${name}.${ext}`).toBe(false);
        }
      }
    }
  });

  it("has no src/app/layout.tsx: the three root layouts are (jump), [locale] and dev", () => {
    for (const ext of ["tsx", "ts", "jsx", "js"]) expect(existsSync(join(root, "src", "app", `layout.${ext}`))).toBe(false);
  });

  it("does not define redirects(), rewrites() or headers() in next.config.ts", () => {
    for (const name of ["redirects", "rewrites", "headers"]) expect(code, name).not.toMatch(new RegExp(`\\b${name}\\s*[(:]`));
  });

  it("imports nothing from next-intl/middleware or next-intl/routing", () => {
    const files = walk(join(root, "src")).filter((path) => /\.(tsx?|mts)$/.test(path) && !path.endsWith("config-files.test.ts"));
    const offenders = files
      .filter((path) => /next-intl\/(middleware|routing|navigation)/.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(root.length + 1));
    expect(offenders).toEqual([]);
    expect(code).not.toMatch(/next-intl\/(middleware|routing)/);
  });

  it("never calls setRequestLocale or reads the request headers", () => {
    const files = walk(join(root, "src")).filter((path) => /\.(tsx?|mts)$/.test(path) && !/config-files\.test\.ts$/.test(path));
    const offenders = files
      .filter((path) => /setRequestLocale|requestLocale|from ["']next\/headers["']/.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });
});
