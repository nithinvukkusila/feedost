// Fails if the JavaScript a page loads up front exceeds the budget (PRD §9: 200 KB gzipped).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = "out";
const LIMIT = 200 * 1024;
// F3 target: aim for 150 KB or less on every route so the next slices have room. Over it only warns.
const TARGET = 150 * 1024;
// The home page, the four language pages, the four fee reminder pages, the four fee receipt pages (R0-3) and the app's pages (R1-1: the
// language picker, sign-in, its callback, home, more and the two setup steps) must all be there, so the budget cannot pass by
// omission. Each slice that adds an app route adds it here.
const LANGUAGES = ["en", "hi", "kn", "te"];
const APP_ROUTES = ["language", "sign-in", "auth/callback", "home", "more", "setup/profile", "setup/upi"];
const REQUIRED = [
  "index.html",
  ...LANGUAGES.map((locale) => `${locale}/index.html`),
  ...LANGUAGES.map((locale) => `${locale}/tools/fee-reminder/index.html`),
  ...LANGUAGES.map((locale) => `${locale}/tools/fee-receipt/index.html`),
  ...APP_ROUTES.flatMap((route) => LANGUAGES.map((locale) => `${locale}/${route}/index.html`)),
];

// The receipt maker's PDF library and fonts load only when the tutor taps "Make PDF" (spec R0-3). They are
// never part of a route's initial JavaScript, so the 200 KB budget above does not count them, but they are
// measured here: the library chunks warn above 450 KB gzipped, and the fonts are reported one by one.
// A chunk is "the library" when it holds one of these strings, which no other code in the app has.
const LIBRARY_MARKERS = ["PDFDocument", "GSUB"];
const LIBRARY_WARN = 450 * 1024;
const FONT_DIR = join(OUT, "pdf-fonts");

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
const initial = new Set(); // every script any page loads up front
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
    initial.add(file);
    const leaked = LIBRARY_MARKERS.find((marker) => readFileSync(file, "utf8").includes(marker));
    if (leaked) {
      console.error(`${page}: the PDF library is in this page's initial JavaScript ("${leaked}" is in ${file}). It must load only on tap.`);
      failed = true;
    }
  }
  const kb = (total / 1024).toFixed(1);
  const over = total > LIMIT;
  if (over) failed = true;
  const warn = !over && total > TARGET;
  console.log(`${over ? "OVER " : warn ? "WARN " : "ok   "} ${kb.padStart(7)} KB  ${page}`);
}

// On demand: the PDF library chunks (in no page's initial scripts) and the fonts.
const libraryChunks = (existsSync(join(OUT, "_next", "static")) ? walk(join(OUT, "_next", "static")) : [])
  .filter((f) => f.endsWith(".js") && !initial.has(f))
  .filter((f) => LIBRARY_MARKERS.some((marker) => readFileSync(f, "utf8").includes(marker)));
if (libraryChunks.length === 0) {
  console.error("No on-demand PDF library chunk found under out/_next/static, so its size cannot be reported (is the receipt maker built?).");
  failed = true;
} else {
  let library = 0;
  for (const file of libraryChunks) {
    library += gzipped(file);
    console.log(`demand ${(gzipped(file) / 1024).toFixed(1).padStart(7)} KB  ${file}`);
  }
  const over = library > LIBRARY_WARN;
  console.log(`${over ? "WARN " : "ok   "} ${(library / 1024).toFixed(1).padStart(7)} KB  PDF library on tap, gzipped, ${libraryChunks.length} chunks (warns above ${LIBRARY_WARN / 1024} KB; not in any page's initial JS)`);
}
const fonts = existsSync(FONT_DIR) ? readdirSync(FONT_DIR).filter((f) => f.endsWith(".ttf")).sort() : [];
if (fonts.length === 0) {
  console.error(`No fonts under ${FONT_DIR}, so the receipt maker cannot draw a PDF.`);
  failed = true;
}
for (const name of fonts) console.log(`font   ${(gzipped(join(FONT_DIR, name)) / 1024).toFixed(1).padStart(7)} KB  ${join(FONT_DIR, name)} (gzipped, fetched only when a receipt needs it)`);

if (failed) {
  console.error(`Budget check failed: limit is ${LIMIT / 1024} KB of gzipped JavaScript per page, and every script must be measurable.`);
  process.exit(1);
}
