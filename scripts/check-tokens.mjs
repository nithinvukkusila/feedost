// Fails when a file under src/app/ or src/components/ steps outside the design tokens:
// a raw colour, a pixel or arbitrary font size, an arbitrary radius or shadow, a blur or a gradient.
// Runs inside `pnpm lint`. Tokens live in src/styles/, which is not scanned on purpose.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOTS = ["src/app", "src/components"];

const rules = [
  // `&#8377;` is an HTML entity, not a colour.
  { name: "raw hex colour", re: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/ },
  { name: "raw colour function", re: /\b(?:rgba?|hsla?|hwb|oklch|oklab|lch|lab)\(/ },
  { name: "arbitrary text size", re: /(?<![\w-])text-\[/ },
  { name: "pixel font size", re: /font-size\s*:\s*[\d.]+px/ },
  { name: "pixel font size", re: /fontSize\s*:\s*(?:[\d.]|["'`][\d.]+px)/ },
  { name: "arbitrary radius", re: /(?<![\w-])rounded(?:-[a-z]{1,2})?-\[/ },
  { name: "arbitrary shadow", re: /(?<![\w-])shadow-\[/ },
  { name: "arbitrary colour", re: /(?<![\w-])(?:bg|text|border|outline|fill|stroke|decoration)-\[(?:#|rgb|hsl|oklch)/ },
  { name: "blur", re: /(?<![\w.-])(?:backdrop-)?blur(?![\w])/ },
  { name: "drop shadow", re: /(?<![\w-])drop-shadow/ },
  { name: "gradient", re: /(?<![\w-])bg-(?:linear|gradient|radial|conic)\b/ },
  { name: "gradient", re: /gradient\(/ },
];

/** Returns one entry per offending line: { line, rule, text }. */
export function findViolations(source) {
  const found = [];
  source.split("\n").forEach((text, i) => {
    for (const rule of rules) {
      if (rule.re.test(text)) found.push({ line: i + 1, rule: rule.name, text: text.trim() });
    }
  });
  return found;
}

export function isScanned(file) {
  return /\.(ts|tsx|css)$/.test(file) && !/\.test\.tsx?$/.test(file);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let count = 0;
  let files = 0;
  for (const root of ROOTS) {
    let list = [];
    try {
      list = walk(root);
    } catch {
      continue; // src/components/ does not exist until the first component is added.
    }
    for (const file of list.filter(isScanned)) {
      files++;
      for (const v of findViolations(readFileSync(file, "utf8"))) {
        console.error(`${file}:${v.line}  ${v.rule}: ${v.text}`);
        count++;
      }
    }
  }
  if (count) {
    console.error(`check-tokens: ${count} problem(s). Use the tokens in src/styles/tokens.css.`);
    process.exit(1);
  }
  console.log(`check-tokens: ${files} files, no raw colours, pixel font sizes, blurs or gradients`);
}
