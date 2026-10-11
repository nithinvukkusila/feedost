// @vitest-environment node
// The page runs the function's own rules file. This runs the shared vectors through the page's door,
// so a re-export that drifted (a copy, a wrong path) fails here.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as page from "./rules";
import * as shared from "../../../supabase/functions/_shared/waitlist-rules";

describe("the page's waitlist rules", () => {
  it("are the function's rules, not a copy", () => {
    expect(Object.keys(page).sort()).toEqual(Object.keys(shared).sort());
    for (const key of Object.keys(shared) as (keyof typeof shared)[]) expect(page[key]).toBe(shared[key]);
  });

  it("is a single re-export line of code", () => {
    const text = readFileSync(join(process.cwd(), "src/lib/waitlist/rules.ts"), "utf8");
    const code = text.split("\n").filter((line) => line.trim() !== "" && !line.trim().startsWith("//"));
    expect(code).toEqual(['export * from "../../../supabase/functions/_shared/waitlist-rules";']);
  });

  it("cleans, checks and formats as the form needs", () => {
    expect(page.checkName("  Asha   Rao ")).toEqual({ ok: true, value: "Asha Rao" });
    expect(page.checkName("<b>")).toEqual({ ok: false });
    expect(page.normalizePhone("098765 43210")).toBe("+919876543210");
    expect(page.normalizePhone("९८७६५४३२१०")).toBe("+919876543210");
    expect(page.normalizePhone("12345")).toBeNull();
    expect(page.formatPhone("+919876543210")).toBe("+91 98765 43210");
  });
});
