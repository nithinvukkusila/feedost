// Prints one line per font file in the exported site: family, subset, weight, bytes, preloaded or not.
// Reports only; it does not fail the build (the founder has not set a font ceiling yet).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = "out";

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

// Google's subsets, recognised by a code point each one's unicode-range always lists.
function subsetOf(range) {
  const r = range.toUpperCase();
  if (/U\+900-97F/.test(r)) return "devanagari";
  if (/U\+C80-CF3/.test(r)) return "kannada";
  if (/U\+C00-C7F/.test(r)) return "telugu";
  if (/U\+1EA0-1EF9/.test(r)) return "vietnamese";
  if (/U\+100-2BA/.test(r)) return "latin-ext";
  if (/U\+\?\?|U\+0?000?-0?0FF/.test(r)) return "latin";
  return "other";
}

const files = walk(OUT);
const css = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(f, "utf8")).join("\n");
const html = files.filter((f) => f.endsWith(".html")).map((f) => readFileSync(f, "utf8")).join("\n");
const preloaded = new Set(
  [...html.matchAll(/<link[^>]+rel="preload"[^>]*>/g)]
    .filter((m) => /as="font"/.test(m[0]))
    .map((m) => /href="([^"]+)"/.exec(m[0])?.[1])
    .filter(Boolean)
    .map((href) => href.split("/").pop()),
);

const rows = new Map();
for (const face of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
  const body = face[1];
  const url = /url\(["']?([^"')]+\.woff2)["']?\)/.exec(body)?.[1];
  if (!url) continue; // a generated fallback face has no file
  const name = url.split("/").pop();
  const path = files.find((f) => f.endsWith(name));
  if (!path || rows.has(name)) continue;
  const bytes = readFileSync(path);
  rows.set(name, {
    family: /font-family:\s*["']?([^;"']+)/.exec(body)?.[1].trim() ?? "?",
    subset: subsetOf(/unicode-range:\s*([^;]+)/.exec(body)?.[1] ?? ""),
    weight: /font-weight:\s*([^;]+)/.exec(body)?.[1].trim() ?? "?",
    bytes: bytes.length,
    gzip: gzipSync(bytes).length,
    preloaded: preloaded.has(name),
    name,
  });
}

if (rows.size === 0) {
  console.error("No font files found in out/. Has the font setup changed?");
  process.exit(1);
}

const sorted = [...rows.values()].sort(
  (a, b) => a.family.localeCompare(b.family) || a.subset.localeCompare(b.subset) || a.weight.localeCompare(b.weight),
);
console.log(
  ["family".padEnd(22), "subset".padEnd(11), "weight".padEnd(8), "bytes".padStart(8), "gzipped".padStart(8), " preload", " file"].join(" "),
);
let total = 0;
for (const r of sorted) {
  total += r.bytes;
  console.log(
    [
      r.family.padEnd(22),
      r.subset.padEnd(11),
      r.weight.padEnd(8),
      String(r.bytes).padStart(8),
      String(r.gzip).padStart(8),
      (r.preloaded ? " yes" : " no").padEnd(8),
      ` ${r.name}`,
    ].join(" "),
  );
}
console.log(`${sorted.length} font files, ${total} bytes in all. A page downloads only the files whose characters it draws.`);
