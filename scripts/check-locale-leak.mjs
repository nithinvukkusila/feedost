// Fails when a language's page carries another language's words (spec F3, criterion 29).
// Run from the repo root after `pnpm build`. Reads ./messages and ./out.
// "Another language's words" = a value that is in that language's file and in no other file's
// values. A value left as `TODO-translate: <English>` shows the English text, which equals the
// English value, so it is not unique to anyone and is not a leak.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = "out";
const locales = ["en", "hi", "kn", "te"];
const MIN_LENGTH = 6; // a very short value could match by chance inside code
const MARKER = "TODO-translate: ";

function leaves(node, out = []) {
  for (const value of Object.values(node)) {
    if (value && typeof value === "object") leaves(value, out);
    else if (typeof value === "string") out.push(value.startsWith(MARKER) ? value.slice(MARKER.length) : value);
  }
  return out;
}

const values = {};
for (const locale of locales) {
  const file = join("messages", `${locale}.json`);
  if (!existsSync(file)) {
    console.error(`${file} does not exist.`);
    process.exit(1);
  }
  values[locale] = new Set(leaves(JSON.parse(readFileSync(file, "utf8"))));
}

const unique = Object.fromEntries(
  locales.map((locale) => [
    locale,
    [...values[locale]].filter(
      (value) => value.length >= MIN_LENGTH && locales.every((other) => other === locale || !values[other].has(value)),
    ),
  ]),
);

/** The ways a value can be written inside HTML or an inline JSON payload. */
const spellings = (value) => [value, JSON.stringify(value).slice(1, -1)];

function pageFiles(locale) {
  const path = join(OUT, locale, "index.html");
  if (!existsSync(path)) return null;
  const html = readFileSync(path, "utf8");
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)].map((m) => m[1].split("?")[0]);
  const files = [{ name: path, text: html }];
  for (const src of new Set(scripts)) {
    const file = join(OUT, decodeURIComponent(src));
    if (src.startsWith("/") && existsSync(file)) files.push({ name: file, text: readFileSync(file, "utf8") });
  }
  return { files, htmlGzip: gzipSync(Buffer.from(html)).length };
}

let failed = false;
let ownFound = 0;
for (const locale of locales) {
  const page = pageFiles(locale);
  if (!page) {
    console.error(`${OUT}/${locale}/index.html is missing, so the leak check cannot run.`);
    failed = true;
    continue;
  }
  for (const other of locales.filter((l) => l !== locale)) {
    for (const value of unique[other]) {
      for (const file of page.files) {
        if (spellings(value).some((text) => file.text.includes(text))) {
          console.error(`${locale} page loads a ${other} message: "${value}" is in ${file.name}`);
          failed = true;
        }
      }
    }
  }
  ownFound += unique[locale].filter((value) => spellings(value).some((text) => page.files[0].text.includes(text))).length;
  console.log(`${locale}: ${(page.htmlGzip / 1024).toFixed(1)} KB gzipped HTML, ${page.files.length - 1} scripts`);
}
// Fail closed: if no page shows any of its own words, the search above proved nothing.
if (!failed && ownFound === 0) {
  console.error("No page shows any message of its own language, so the leak check proves nothing (stale or empty out/?).");
  failed = true;
}
if (failed) process.exit(1);
console.log(`leak check: no language page carries another language's messages (${ownFound} own values seen)`);
