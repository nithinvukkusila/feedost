// Fails if the JavaScript a page loads up front exceeds the budget (PRD §9: 200 KB gzipped).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = "out";
const LIMIT = 200 * 1024;
// F3 target: aim for 150 KB or less on every route so the next slices have room. Over it only warns.
const TARGET = 150 * 1024;
// The home page, the four language pages, the four fee reminder pages and the app's pages (R1-1: the
// language picker, sign-in, its callback and home) must all be there, so the budget cannot pass by
// omission. Each slice that adds an app route adds it here.
const LANGUAGES = ["en", "hi", "kn", "te"];
const APP_ROUTES = ["language", "sign-in", "auth/callback", "home"];
const REQUIRED = [
  "index.html",
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
  const over = total > LIMIT;
  if (over) failed = true;
  const warn = !over && total > TARGET;
  console.log(`${over ? "OVER " : warn ? "WARN " : "ok   "} ${kb.padStart(7)} KB  ${page}`);
}
if (failed) {
  console.error(`Budget check failed: limit is ${LIMIT / 1024} KB of gzipped JavaScript per page, and every script must be measurable.`);
  process.exit(1);
}
