// Spec R1-3, step 1: no screen talks to a table. Every read and write goes through a data module in
// src/lib (src/CLAUDE.md: writes go through one place, so the outbox can replace it in R1-12).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("no component calls the database directly", () => {
  const files = walk(join(process.cwd(), "src", "components")).filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\./.test(path));

  it("finds the component files, so the scan means something", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((path) => [path.slice(process.cwd().length + 1), path]))("%s", (_name, path) => {
    const text = readFileSync(path, "utf8");
    expect(text).not.toMatch(/\.from\(\s*["'`]/);
    expect(text).not.toMatch(/supabase\.from\(/);
    // The one call that is not a read, ensure_my_dues, is made from src/lib/dues.ts and nowhere else.
    expect(text).not.toMatch(/\.rpc\(/);
  });
});

// Spec R1-10, criterion 27: claims are read and handled from one file, src/lib/claims.ts, as payments are from payments.ts.
describe("only src/lib/claims.ts names the claims table and its two functions", () => {
  const files = walk(join(process.cwd(), "src")).filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\./.test(path) && !/\.test-util\./.test(path));

  it.each(files.map((path) => [path.slice(process.cwd().length + 1), path]))("%s", (name, path) => {
    if (name === join("src", "lib", "claims.ts")) return;
    expect(readFileSync(path, "utf8")).not.toMatch(/payment_claims|confirm_claim|reject_claim/);
  });
});
