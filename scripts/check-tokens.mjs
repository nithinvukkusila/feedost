// Fails when a file steps outside the design tokens: a raw colour, a pixel or arbitrary font size,
// a font size under 14px, an arbitrary radius or shadow, a blur, a gradient, a truncation, or (in
// components) type settings that bypass the type roles. Runs inside `pnpm lint`.
//
// Scanned: .ts, .tsx, .js, .jsx and .css under src/app/, src/components/ and src/styles/, except
// test files and src/styles/tokens.css, which is the one file where raw values belong.
//
// It reads text, not syntax. What it cannot see: a class name or colour built from pieces at run
// time, a style object passed in a variable, and anything in a file outside those folders.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOTS = ["src/app", "src/components", "src/styles"];
const TOKEN_FILE = "src/styles/tokens.css";

// A class name starts after anything that is not part of a longer name.
const START = String.raw`(?<![\w-])`;
const END = String.raw`(?![\w-])`;

// Utilities that take a colour. `text-[` is banned outright by its own rule.
const COLOUR_UTILITY = "bg|border(?:-[trblxyse])?|outline|ring(?:-offset)?|fill|stroke|decoration|shadow|accent|caret|divide|from|via|to|placeholder";

// CSS properties that have a token, written as a Tailwind arbitrary property: `[box-shadow:...]`.
const TOKEN_PROPERTY =
  "box-shadow|text-shadow|border-radius|border(?:-[a-z]+)*-radius|color|background|background-color|background-image|border(?:-[a-z]+)*-color|outline-color|fill|stroke|font-size|font-family|letter-spacing|text-transform|filter|backdrop-filter";

// Keys of an inline style object that have a token.
const STYLE_KEY =
  "color|background|backgroundColor|backgroundImage|borderColor|outlineColor|boxShadow|textShadow|borderRadius|fontSize|fontFamily|letterSpacing|textTransform|filter|backdropFilter";

const rules = [
  // Colour. `&#8377;` is an HTML entity, not a colour.
  { name: "raw hex colour", re: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/ },
  { name: "raw colour function", re: /\b(?:rgba?|hsla?|hwb|oklch|oklab|lch|lab|color-mix)\(/ },
  { name: "arbitrary colour", re: new RegExp(String.raw`${START}(?:${COLOUR_UTILITY}|text)-\[(?:#|rgb|hsl|hwb|oklch|oklab|lch|lab|color)`) },
  // A bare word in brackets is a named colour (`bg-[red]`) or a keyword that has a token.
  { name: "named colour in an arbitrary value", re: new RegExp(String.raw`${START}(?:${COLOUR_UTILITY})-\[[a-zA-Z]+\]`) },

  // Type size.
  { name: "arbitrary text size", re: new RegExp(String.raw`${START}text-\[`) },
  { name: "pixel font size", re: /font-size\s*:\s*[\d.]+px/ },
  { name: "pixel font size", re: /fontSize\s*:\s*(?:[\d.]|["'`][\d.]+px)/ },
  { name: "font size under 14px", test: (line) => smallSizes(line).length > 0 },

  // Shape and depth.
  { name: "arbitrary radius", re: new RegExp(String.raw`${START}rounded(?:-[a-z]{1,2})?-\[`) },
  { name: "arbitrary shadow", re: new RegExp(String.raw`${START}(?:shadow|inset-shadow|text-shadow)-\[`) },
  { name: "arbitrary property with a token", re: new RegExp(String.raw`\[(?:${TOKEN_PROPERTY}):`) },
  { name: "blur", re: new RegExp(String.raw`${START}(?:backdrop-)?blur-(?:none|xs|sm|md|lg|xl|2xl|3xl|\[|\()`) },
  // The CSS function, not `element.blur()`.
  { name: "blur", re: /(?<![\w.])blur\(/ },
  // The bare class `blur`, where classes are written. Elsewhere "blur" is also the name of an event.
  { name: "blur", test: (line) => /className|class=|@apply/.test(line) && new RegExp(String.raw`${START}(?:backdrop-)?blur${END}`).test(line) },
  { name: "drop shadow", re: new RegExp(String.raw`${START}drop-shadow`) },
  { name: "gradient", re: new RegExp(String.raw`${START}bg-(?:linear|gradient|radial|conic)\b`) },
  { name: "gradient", re: /gradient\(/ },

  // Nothing truncates: labels wrap and the row or button grows.
  { name: "truncation", re: new RegExp(String.raw`${START}(?:truncate|text-ellipsis|line-clamp(?:-[\w[\]]+)?)${END}`) },
  { name: "truncation", re: /text-overflow\s*:\s*ellipsis|-webkit-line-clamp|\bline-clamp\s*:|textOverflow\s*:|WebkitLineClamp|lineClamp\s*:/ },
];

// Under src/components/ the type roles decide the face, the letter-spacing and the capitals.
const componentRules = [
  { name: "capitals outside the type roles", re: new RegExp(String.raw`${START}uppercase${END}`) },
  { name: "letter-spacing outside the type roles", re: new RegExp(String.raw`${START}-?tracking-`) },
  { name: "font family outside the type roles", re: new RegExp(String.raw`${START}font-(?:sans|serif|mono)${END}`) },
];

/** Font sizes in rem or em below 0.875 (14px), as a CSS declaration, a size variable or a style key. */
function smallSizes(line) {
  const found = [];
  const patterns = [
    /(?:font-size|[\w-]*-size)\s*:\s*(\d*\.?\d+)(rem|em)\b/g,
    /fontSize\s*:\s*["'`](\d*\.?\d+)(rem|em)["'`]/g,
  ];
  for (const re of patterns) {
    for (const m of line.matchAll(re)) {
      // `background-size`, `box-size` and the like are not text.
      if (/(?:background|mask|border-image|grid|column|tab|field)-size\s*:/.test(m[0])) continue;
      if (Number(m[1]) < 0.875) found.push(m[0]);
    }
  }
  return found;
}

/** Blanks out comments, keeping every line break, so words in prose are not read as code. */
export function withoutComments(source) {
  const blank = (text) => text.replace(/[^\n]/g, " ");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    // `//` after a colon or a quote is a URL or part of a string, not a comment.
    .replace(/(?<![:"'`\\\w])\/\/.*$/gm, blank);
}

/** Inline style objects written in place, `style={{ ... }}`, with the line each begins on. */
function styleObjects(source) {
  const out = [];
  for (const m of source.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
    out.push({ body: m[1], line: source.slice(0, m.index).split("\n").length });
  }
  return out;
}

/**
 * Returns one entry per problem: { line, rule, text }.
 * `file` decides which rules apply: the type-role rules are for src/components/ only.
 */
export function findViolations(source, file = "") {
  const found = [];
  const code = withoutComments(source);
  const inComponents = file.replaceAll("\\", "/").includes("src/components/");
  const active = inComponents ? [...rules, ...componentRules] : rules;
  code.split("\n").forEach((text, i) => {
    for (const rule of active) {
      if (rule.re ? rule.re.test(text) : rule.test(text)) found.push({ line: i + 1, rule: rule.name, text: text.trim() });
    }
  });
  // An inline style may span lines, so it is read as a block. Custom properties (`"--x": 1`) are fine.
  const key = new RegExp(String.raw`(?<![\w"'-])["']?(${STYLE_KEY})["']?\s*:`);
  for (const style of styleObjects(code)) {
    const m = key.exec(style.body);
    if (m) found.push({ line: style.line, rule: "inline style with a token", text: `style={{ ${m[1]}: ... }}` });
  }
  return found;
}

export function isScanned(file) {
  const path = file.replaceAll("\\", "/");
  if (path.endsWith(TOKEN_FILE)) return false;
  return /\.(ts|tsx|js|jsx|css)$/.test(path) && !/\.test\.[jt]sx?$/.test(path);
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
      continue; // A folder that does not exist yet has nothing to check.
    }
    for (const file of list.filter(isScanned)) {
      files++;
      for (const v of findViolations(readFileSync(file, "utf8"), file)) {
        console.error(`${file}:${v.line}  ${v.rule}: ${v.text}`);
        count++;
      }
    }
  }
  if (count) {
    console.error(`check-tokens: ${count} problem(s). Use the tokens in src/styles/tokens.css and the type roles in src/styles/type.css.`);
    process.exit(1);
  }
  console.log(`check-tokens: ${files} files, no raw colours, pixel font sizes, blurs or gradients`);
}
