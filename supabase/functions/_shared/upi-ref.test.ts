// @vitest-environment node
// R1-10 Part A criteria 7, 13 and 41: the shared UPI reference check, run over the shared vectors.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REF_DIGITS, REF_MAX_INPUT, normalizeRef } from "./upi-ref.ts";

type Case = { in: unknown; ok: boolean; ref?: string; reason?: "empty" | "bad" };
type Long = { repeat: string; times: number; suffix: string; ok: boolean; ref?: string; reason?: "empty" | "bad" };
const vectors = JSON.parse(readFileSync(join(process.cwd(), "supabase/functions/_shared/upi-ref-vectors.json"), "utf8")) as { cases: Case[]; long: Long[] };

const expected = (c: Case | Long) => (c.ok ? { ok: true, ref: c.ref } : { ok: false, reason: c.reason });

describe("normalizeRef over the shared vectors", () => {
  it("has the vectors this test expects", () => {
    expect(vectors.cases.length).toBeGreaterThan(30);
    expect(vectors.long.length).toBeGreaterThan(3);
  });

  for (const c of vectors.cases) {
    it(`${JSON.stringify(c.in)} -> ${c.ok ? c.ref : c.reason}`, () => {
      expect(normalizeRef(c.in)).toEqual(expected(c));
    });
  }

  for (const c of vectors.long) {
    it(`${c.times} x ${JSON.stringify(c.repeat)} + ${JSON.stringify(c.suffix)} -> ${c.ok ? c.ref : c.reason}`, () => {
      expect(normalizeRef(c.repeat.repeat(c.times) + c.suffix)).toEqual(expected(c));
    });
  }
});

describe("the constants", () => {
  it("are 12 digits and 64 characters of input", () => {
    expect(REF_DIGITS).toBe(12);
    expect(REF_MAX_INPUT).toBe(64);
  });

  it("the three written forms of criterion 7 are one reference", () => {
    const forms = ["6281 0473 9915", "6281-0473-9915", "628104739915"].map(normalizeRef);
    expect(new Set(forms.map((f) => JSON.stringify(f))).size).toBe(1);
  });

  it("holds no import, no Deno and no DOM, so Node, Deno and the browser can all run it", () => {
    const source = readFileSync(join(process.cwd(), "supabase/functions/_shared/upi-ref.ts"), "utf8");
    const code = source.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n");
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/Deno\.|document\.|window\.|console\./);
    expect(code).not.toMatch(/\\d|\\p\{/);
  });
});
