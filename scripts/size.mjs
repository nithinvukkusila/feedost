// Fails if the JavaScript a page loads up front exceeds the budget (PRD §9: 200 KB gzipped).
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = "out";
const LIMIT = 200 * 1024;

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
  console.log(`${over ? "OVER " : "ok   "} ${kb.padStart(7)} KB  ${page}`);
}
if (failed) {
  console.error(`Budget check failed: limit is ${LIMIT / 1024} KB of gzipped JavaScript per page, and every script must be measurable.`);
  process.exit(1);
}
