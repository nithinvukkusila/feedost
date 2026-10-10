// @vitest-environment node
// Spec R1-1, section 8.4 and criterion 45: no file under src/ imports the Supabase library except
// src/lib/supabase.ts, which does it with `await import()` so the library is a chunk of its own.
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { walk } from "@/test-utils/find-own-words";

const root = process.cwd();
const src = join(root, "src");
const NAME = ["@supabase", "supabase-js"].join("/");
const importsIt = new RegExp(`(?:from\\s*|import\\s*\\(?\\s*|require\\s*\\(\\s*)["']${NAME}["']`);

const files = walk(src).filter((path) => /\.(ts|tsx)$/.test(path));

describe("the Supabase library has one door", () => {
  it("finds the source files, so the scan means something", () => {
    expect(files.length).toBeGreaterThan(50);
    expect(files.map((f) => relative(root, f))).toContain("src/lib/supabase.ts");
  });

  it("is imported by src/lib/supabase.ts only", () => {
    const importers = files.filter((path) => importsIt.test(readFileSync(path, "utf8"))).map((path) => relative(root, path));
    expect(importers).toEqual(["src/lib/supabase.ts"]);
  });

  it("is loaded there with await import(), never a top-level value import", () => {
    const text = readFileSync(join(src, "lib", "supabase.ts"), "utf8");
    expect(text).toMatch(new RegExp(`await import\\(\\s*"${NAME}"\\s*\\)`));
    // Type-only imports are erased by the compiler and add no code.
    const valueImports = [...text.matchAll(new RegExp(`^import\\s+(?!type\\b)[^;]*from\\s*"${NAME}"`, "gm"))];
    expect(valueImports).toEqual([]);
  });
});
