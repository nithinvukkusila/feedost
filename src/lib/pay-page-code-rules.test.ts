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
  ...walk(join(root, "src", "lib")).filter((p) => /pay-page-[a-z-]+\.ts$/.test(p) || p.endsWith("upi-link.ts") || p.endsWith("public-words.ts") || p.includes(`${join("lib", "claim")}/`)),
  // R1-10 criterion 41: the reference check the page shares with the function.
  join(root, "supabase", "functions", "_shared", "upi-ref.ts"),
  join(root, "src", "app", "p", "page.tsx"),
  join(root, "src", "app", "p", "layout.tsx"),
].filter((path) => /\.tsx?$/.test(path) && !/\.(test|spec)\.tsx?$/.test(path) && !path.endsWith(".test-util.ts"));
const source = (path: string) => readFileSync(path, "utf8");
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("the pay page's code", () => {
  it("finds the files it is meant to check", () => {
    const names = files.map((f) => f.slice(root.length + 1));
    for (const expected of [
      "src/components/pay-page/public-pay-page.tsx",
      "src/lib/pay-page-view.ts",
      "src/lib/pay-page-public.ts",
      "src/lib/upi-link.ts",
      "src/lib/public-words.ts",
      "src/app/p/page.tsx",
      // R1-10 Part C (criterion 41): the claim code is held to the same rules.
      "src/components/pay-page/claim-sheet.tsx",
      "src/components/pay-page/claim-area.tsx",
      "src/lib/pay-page-claim.ts",
      "src/lib/claim/upi-ref.ts",
      "supabase/functions/_shared/upi-ref.ts",
    ]) {
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
    // R1-10 criterion 39: the reference (or anything else) is never written into the title or the address.
    ["the title or the address being written", /document\.title\s*=|location\.(assign|replace)\(|location\.(href|search|hash)\s*=/],
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

  // UX-review-fixes-2 plan 13.2: the pay page shares the grace constant with the board through a file with no imports,
  // so the parent's shell can never grow through it.
  it("shares GRACE_DAYS through src/lib/grace.ts, which imports nothing", () => {
    expect(source(join(root, "src", "lib", "pay-page-view.ts"))).toMatch(/import \{ GRACE_DAYS \} from "@\/lib\/grace";/);
    expect(stripComments(source(join(root, "src", "lib", "grace.ts")))).not.toMatch(/\bimport\b|\brequire\(/);
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

// Spec parent-pages-english, plan section 6 ("guard"): a parent surface's languages come only from
// src/lib/unlocked-languages.ts, the rule's server code never reaches a browser, and the test fixture never reaches a
// parent page.
describe("the parent pages' languages", () => {
  const code = walk(join(root, "src")).filter((path) => /\.tsx?$/.test(path) && !/\.(test|spec)\.tsx?$/.test(path) && !path.endsWith(".test-util.ts"));
  const importLines = (path: string) => source(path).split("\n").filter((line) => /^\s*(import|export)\b.*\bfrom\b/.test(line));
  const name = (path: string) => path.slice(root.length + 1);

  it("no client file imports the unlock rule or anything under scripts/", () => {
    const clients = code.filter((path) => /^\s*["']use client["']/.test(stripComments(source(path)).trimStart()));
    expect(clients.map(name)).toContain("src/components/pay-page/public-pay-page.tsx");
    for (const path of clients) {
      for (const line of importLines(path)) {
        expect(/@\/lib\/unlocked-languages|scripts\/|language-unlock/.test(line), `${name(path)}: ${line}`).toBe(false);
      }
    }
  });

  it("no parent page or component lists the languages itself", () => {
    const parent = code.filter((path) => /src\/(components\/(pay-page|receipt)|app\/[pr])\//.test(path));
    expect(parent.map(name)).toEqual(expect.arrayContaining(["src/components/pay-page/language-menu.tsx", "src/components/receipt/public-receipt.tsx", "src/app/r/page.tsx"]));
    for (const path of parent) {
      for (const line of importLines(path).filter((l) => l.includes("@/config/locales"))) {
        const names = /\{([^}]*)\}/.exec(line)?.[1].split(",").map((n) => n.trim().replace(/^type\s+/, "")) ?? [];
        expect(names.includes("locales"), `${name(path)}: ${line}`).toBe(false);
      }
      expect(stripComments(source(path)).includes("getAllWords"), `${name(path)} must take its words from unlocked-languages.ts`).toBe(false);
    }
  });

  it("/p/ and /r/ take their words from unlocked-languages.ts", () => {
    expect(source(join(root, "src", "app", "p", "page.tsx"))).toMatch(/import \{ payPageWords \} from "@\/lib\/unlocked-languages"/);
    expect(source(join(root, "src", "app", "r", "page.tsx"))).toMatch(/import \{ receiptWords \} from "@\/lib\/unlocked-languages"/);
  });

  it("/p/ and /r/ use the shipped records and raw message files: they pass no fixture to the unlock rule", () => {
    // payPageWords() and receiptWords() with no argument read the shipped review records and the raw message files.
    // Any argument here (a fixture, stripped messages) would let the /dev fixture's hashes decide what a parent sees.
    const p = stripComments(source(join(root, "src", "app", "p", "page.tsx")));
    const r = stripComments(source(join(root, "src", "app", "r", "page.tsx")));
    expect(p.match(/payPageWords\(([^)]*)\)/g)).toEqual(["payPageWords()"]);
    expect(r.match(/receiptWords\(([^)]*)\)/g)).toEqual(["receiptWords()"]);
    for (const text of [p, r]) expect(/stripTodo|loadMessages|messages\/[a-z]{2}\.json|review\.json/.test(text)).toBe(false);
    // The wrapper's own defaults are the raw imports: no marker is taken out before hashing.
    const wrapper = stripComments(source(join(root, "src", "lib", "unlocked-languages.ts")));
    expect(wrapper).toMatch(/const shippedMessages: Readonly<Record<Locale, unknown>> = \{ en, hi, kn, te \};/);
    expect(/stripTodo|loadMessages/.test(wrapper), "unlocked-languages.ts must hash the raw files").toBe(false);
  });

  it("only the /dev pages and tests use the signed test fixture", () => {
    for (const path of code) {
      if (name(path).startsWith("src/app/dev/")) continue;
      const text = stripComments(source(path));
      expect(/\bsignedFixture\b/.test(text), `${name(path)} uses signedFixture`).toBe(false);
      expect(/app\/dev\/unlocked|unlocked\/fixture/.test(importLines(path).join("\n")), `${name(path)} imports the /dev fixture`).toBe(false);
    }
  });
});
