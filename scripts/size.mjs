// Fails if the JavaScript a page loads up front exceeds the budget (PRD §9: 200 KB gzipped).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = "out";
const LIMIT = 200 * 1024;
// F3 target: aim for 150 KB or less on every route so the next slices have room. Over it only warns.
const TARGET = 150 * 1024;
// The home page, the four language pages, the four fee reminder pages and the app's pages (R1-1: the
// language picker, sign-in, its callback, home, more and the two setup steps; R1-3: the student screens) must all be there, so the budget cannot pass by
// omission. Each slice that adds an app route adds it here.
const LANGUAGES = ["en", "hi", "kn", "te"];
const APP_ROUTES = ["language", "sign-in", "auth/callback", "home", "more", "students", "students/new", "students/edit", "receipt", "claims", "remind", "batches", "batches/edit", "attendance", "setup/profile", "setup/upi"];
// Pages outside a language folder. The parent's receipt (R1-7 Part B) is one static shell with no roster, no app
// gate and no Supabase library, so it gets its own, smaller budget: a parent on a slow phone opens it from a link.
// Measured 2026-10-12: Next's own runtime alone makes the plain "/" jump page 132.5 KB, and the receipt is 138.4 KB.
// 145 KB leaves room for Part C's buttons (the PDF library is loaded on tap and is never in this number) and
// fails on anything that brings the roster or the Supabase library in.
// The parent's pay page (R1-9 Part B) is the same kind of shell: plain fetch, no roster, no Supabase library, no
// reminder templates. Measured 2026-10-13: 143.0 KB (the Next runtime alone is about 132 KB, and the page adds the
// Button, Sheet, Banner and its own screens), so 151 KB leaves room for Part C's QR button (the encoder is loaded on tap and
// is never in this number). The spec's 100 KB target (criterion 41) cannot be reached with the Next 16 runtime; the 200 KB limit holds.
// R1-10 Part C (2026-10-25) added the "I've paid" button and pending note to the first load: 143.5 KB on main before,
// 144.7 KB after (+1.2 KB). The claim sheet itself is a chunk fetched on tap. Still inside 151 KB, so it is not raised.
const SHELL_BUDGETS = { "r/index.html": 145 * 1024, "p/index.html": 151 * 1024 };
const REQUIRED = [
  "index.html",
  ...Object.keys(SHELL_BUDGETS),
  ...LANGUAGES.map((locale) => `${locale}/index.html`),
  ...LANGUAGES.map((locale) => `${locale}/tools/fee-reminder/index.html`),
  ...APP_ROUTES.flatMap((route) => LANGUAGES.map((locale) => `${locale}/${route}/index.html`)),
];

if (!existsSync(OUT)) {
  console.error("No out/ folder. Run `pnpm build` first.");
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const cache = new Map();
function gzipped(file) {
  if (!cache.has(file)) cache.set(file, gzipSync(readFileSync(file)).length);
  return cache.get(file);
}

let failed = false;
for (const name of REQUIRED) {
  if (!existsSync(join(OUT, name))) {
    console.error(`${OUT}/${name} is missing, so its budget cannot be checked.`);
    failed = true;
  }
}
for (const page of walk(OUT).filter((f) => f.endsWith(".html")).sort()) {
  const html = readFileSync(page, "utf8");
  // Skip `nomodule` scripts: they are polyfills that only very old browsers download.
  const scripts = new Set(
    [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)]
      .filter((m) => !/nomodule/i.test(m[0]))
      .map((m) => m[1].split("?")[0]),
  );
  // Fail closed: a script we cannot find and measure must not count as zero.
  if (scripts.size === 0) {
    console.error(`${page}: no scripts found, so the budget cannot be checked.`);
    failed = true;
    continue;
  }
  let total = 0;
  for (const src of scripts) {
    const file = join(OUT, decodeURIComponent(src));
    if (!src.startsWith("/") || !existsSync(file)) {
      console.error(`${page}: cannot measure script "${src}" (not a file under ${OUT}/).`);
      failed = true;
      continue;
    }
    total += gzipped(file);
  }
  const kb = (total / 1024).toFixed(1);
  const limit = SHELL_BUDGETS[relative(OUT, page).split(sep).join("/")] ?? LIMIT;
  const over = total > limit;
  if (over) failed = true;
  const warn = !over && total > TARGET;
  console.log(`${over ? "OVER " : warn ? "WARN " : "ok   "} ${kb.padStart(7)} KB  ${page}`);
}
if (failed) {
  console.error(`Budget check failed: limit is ${LIMIT / 1024} KB (${SHELL_BUDGETS["r/index.html"] / 1024} KB for r/index.html, ${SHELL_BUDGETS["p/index.html"] / 1024} KB for p/index.html) of gzipped JavaScript per page, and every script must be measurable.`);
  process.exit(1);
}
