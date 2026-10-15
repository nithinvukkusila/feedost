// @vitest-environment node
// The page runs the function's own reference check. This runs the shared vectors through the page's door,
// so a re-export that drifted (a copy, a wrong path) fails here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as page from "./upi-ref";
import * as shared from "../../../supabase/functions/_shared/upi-ref";

type Case = { in: unknown; ok: boolean; ref?: string; reason?: "empty" | "bad" };
const vectors = JSON.parse(readFileSync(join(process.cwd(), "supabase/functions/_shared/upi-ref-vectors.json"), "utf8")) as { cases: Case[] };

describe("the page's UPI reference check", () => {
  it("is the function's check, not a copy", () => {
    expect(Object.keys(page).sort()).toEqual(Object.keys(shared).sort());
    for (const key of Object.keys(shared) as (keyof typeof shared)[]) expect(page[key]).toBe(shared[key]);
  });

  it("is a single re-export line of code", () => {
    const text = readFileSync(join(process.cwd(), "src/lib/claim/upi-ref.ts"), "utf8");
    const code = text.split("\n").filter((line) => line.trim() !== "" && !line.trim().startsWith("//"));
    expect(code).toEqual(['export * from "../../../supabase/functions/_shared/upi-ref";']);
  });

  it("gives the vectors' answers through the page's door", () => {
    for (const c of vectors.cases) {
      expect(page.normalizeRef(c.in), JSON.stringify(c.in)).toEqual(c.ok ? { ok: true, ref: c.ref } : { ok: false, reason: c.reason });
    }
  });
});
