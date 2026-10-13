// @vitest-environment node
// Spec R1-9 Part B, criteria 40 and 41, plan B7 and B12: what the pay page's code may not do. Money is integer paise
// until formatRupees, the clock is the server's, nothing is stored or counted on the parent's phone, and the page does
// not pull in the app, the roster, the Supabase client or the reminder templates.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { walk } from "@/test-utils/find-own-words";

const root = process.cwd();
const files = [
  ...walk(join(root, "src", "components", "pay-page")),
  ...walk(join(root, "src", "lib")).filter((p) => /pay-page-[a-z-]+\.ts$/.test(p) || p.endsWith("upi-link.ts") || p.endsWith("public-words.ts")),
  join(root, "src", "app", "p", "page.tsx"),
  join(root, "src", "app", "p", "layout.tsx"),
].filter((path) => /\.tsx?$/.test(path) && !/\.(test|spec)\.tsx?$/.test(path) && !path.endsWith(".test-util.ts"));
const source = (path: string) => readFileSync(path, "utf8");
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the pay page's code", () => {
  it("finds the files it is meant to check", () => {
    const names = files.map((f) => f.slice(root.length + 1));
    for (const expected of ["src/components/pay-page/public-pay-page.tsx", "src/lib/pay-page-view.ts", "src/lib/pay-page-public.ts", "src/lib/upi-link.ts", "src/lib/public-words.ts", "src/app/p/page.tsx"]) {
      expect(names).toContain(expected);
    }
  });

  const forbidden: [string, RegExp][] = [
    ["parseFloat", /\bparseFloat\b/],
    ["toFixed", /\.toFixed\(/],
    ["Math.round", /\bMath\.round\b/],
    ["Intl", /\bIntl\./],
    ["toLocale", /\.toLocale\w*\(/],
    ["a local-time getter", /\.get(Hours|Date|Day|Month|FullYear|Minutes|TimezoneOffset)\(/],
    ["new Date() with no argument", /new Date\(\s*\)/],
    ["Date.now", /\bDate\.now\b/],
    ["a bitwise truncation on an amount", /\|\s*0\b|>>>?\s*0\b/],
    ["local or session storage, IndexedDB or a cookie", /\b(localStorage|sessionStorage|indexedDB)\b|document\.cookie/],
    ["analytics or error reporting", /\b(posthog|sentry)\b/i],
    ["a console call", /\bconsole\./],
    ["history rewriting", /\b(history\.(replaceState|pushState)|window\.history)\b/],
  ];

  it.each(files.map((f) => [f.slice(root.length + 1), f] as const))("%s has none of the forbidden calls", (_name, path) => {
    const text = stripComments(source(path));
    for (const [what, pattern] of forbidden) expect(pattern.test(text), `${what} in ${_name}`).toBe(false);
  });

  const forbiddenImports = [
    "@/lib/supabase-browser",
    "@supabase/supabase-js",
    "@/lib/reminder",
    "templates",
    "@/lib/dues",
    "@/components/app",
    "@/components/board",
    "@/components/students",
    "@/components/remind",
    "@/components/reminder",
    "@/components/pay/",
    "ClientMessages",
    "next-intl",
    "@/lib/outbox",
  ];

  it.each(files.map((f) => [f.slice(root.length + 1), f] as const))("%s imports nothing from the app, the roster or the reminder", (_name, path) => {
    const imports = source(path).split("\n").filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line));
    for (const line of imports) for (const bad of forbiddenImports) expect(line.includes(bad), `${bad} in ${_name}: ${line}`).toBe(false);
  });

  it("builds the UPI link in one place: only upi-link.ts writes `upi://`", () => {
    for (const path of files) {
      if (path.endsWith("upi-link.ts")) continue;
      expect(stripComments(source(path)).includes("upi://"), path).toBe(false);
    }
  });

  it("holds the product name only through brand.ts", () => {
    for (const path of files) expect(stripComments(source(path)).includes(brand.name), path).toBe(false);
  });
});
