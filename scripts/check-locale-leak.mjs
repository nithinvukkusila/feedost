// Fails when a language's page carries another language's words (spec F3, criterion 29; spec R0-2, criterion 69).
// Run from the repo root after `pnpm build`. Reads ./messages and ./out.
// "Another language's words" = a value that is in that language's file and in no other file's
// values. A value left as `TODO-translate: <English>` shows the English text, which equals the
// English value, so it is not unique to anyone and is not a leak.
//
// Every index.html under out/{locale}/ is checked, with the scripts that page loads, so a new page
// is covered without touching this file.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = "out";
const locales = ["en", "hi", "kn", "te"];
const MIN_LENGTH = 6; // a very short value could match by chance inside code
const RECEIPT_MIN_LINE = 20; // a receipt template line must be this long to count as a sentence
const MARKER = "TODO-translate: ";

// Pages under a language that must be there, so the check cannot pass by omission. "" is the landing.
const REQUIRED_PAGES = ["", "tools/fee-reminder/", "tools/fee-receipt/"];

// The one named exception (spec R0-2, criteria 27 and 69). The fee reminder page must hold the message
// templates and month names of all four languages, because the tutor picks the message language on
// the page and nothing may be fetched for it. They live in one file, outside messages/. For a page
// under `pages`, and only in its script files, never its HTML, every line of that file is taken out
// of the text before the search for another language's interface words.
// The fee receipt page (spec R0-3) is another: the receipt is drawn in a language picked on the page,
// so it carries the receipt wording of all four (src/lib/receipt/templates.json). `minLine` is the
// shortest line that counts as a sentence of its own; short words (a month, "UPI से") are only cut out.
// R1-8 adds the Remind screen: it writes the parent's message in the parent's language, whatever the tutor's
// screen language is, so its page holds the same month templates and the app's earlier-balance templates and
// generic parent words (src/lib/reminder/templates.app.json) of all four languages. Only that page.
const EXCEPTIONS = [
  { pages: ["tools/fee-reminder/", "remind/"], file: "src/lib/reminder/templates.json", name: "fee reminder", minLine: MIN_LENGTH, lineKeys: ["polite", "firm"] },
  { pages: ["remind/"], file: "src/lib/reminder/templates.app.json", name: "remind (balance templates)", minLine: MIN_LENGTH, lineKeys: ["polite", "firm"] },
  { pages: ["tools/fee-receipt/"], file: "src/lib/receipt/templates.json", name: "fee receipt", minLine: RECEIPT_MIN_LINE, lineKeys: null },
];

/** The ways a value can be written inside HTML or an inline JSON payload. */
const spellings = (value) => [value, JSON.stringify(value).slice(1, -1)];

/** Every string in a value, however deep (lists and nested objects included). */
function strings(node, out = []) {
  if (typeof node === "string") out.push(node);
  else if (node && typeof node === "object") for (const value of Object.values(node)) strings(value, out);
  return out;
}

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

// What a language shows in English on purpose: the values still marked `TODO-translate`. One of them is not
// another language's leak, and is taken out of the text before the search, but only where it stands as a
// whole string: quoted in a script or a JSON payload ("..." or \"...\"), or alone between tags (>...<). A
// real English value that sits inside a longer sentence is still found.
const untranslated = Object.fromEntries(
  locales.map((locale) => {
    const tree = JSON.parse(readFileSync(join("messages", `${locale}.json`), "utf8"));
    const found = [];
    (function walk(node) {
      for (const value of Object.values(node)) {
        if (value && typeof value === "object") walk(value);
        else if (typeof value === "string" && value.startsWith(MARKER)) found.push(value.slice(MARKER.length));
      }
    })(tree);
    const whole = [];
    for (const value of new Set(found)) {
      for (const spelling of spellings(value)) {
        whole.push(`\\"${spelling}\\"`, `"${spelling}"`, `'${spelling}'`, `>${spelling}<`);
      }
    }
    return [locale, whole.sort((x, y) => y.length - x.length)];
  }),
);

const unique = Object.fromEntries(
  locales.map((locale) => [
    locale,
    [...values[locale]].filter(
      (value) => value.length >= MIN_LENGTH && locales.every((other) => other === locale || !values[other].has(value)),
    ),
  ]),
);

/**
 * Each exception with its file read: `lines` is every template line of a language (long enough to
 * mean something, and not a bare placeholder), `all` is every line and month name of every language.
 * An exception whose file does not exist is dropped: there is nothing to except.
 */
const exceptions = EXCEPTIONS.filter((exception) => existsSync(exception.file)).map((exception) => {
  const tree = JSON.parse(readFileSync(exception.file, "utf8"));
  const lines = {};
  const all = [];
  const quoted = [];
  for (const locale of locales) {
    const entry = tree[locale] ?? {};
    // With lineKeys, only those lists are sentences and the rest (month names) is cut out only; without,
    // every string of the entry is a candidate line, and the length floor keeps out the short words.
    const templateLines = exception.lineKeys ? exception.lineKeys.flatMap((key) => strings(entry[key] ?? [])) : strings(entry);
    lines[locale] = [...new Set(templateLines)].filter((line) => line.length >= exception.minLine && !/^\{\w+\}$/.test(line));
    // Cut out: whole sentences (at least minLine long) and whole month names. Short template words
    // (a heading, a stamp, a payment phrase) are NOT cut out, so an interface phrase that happens to
    // be one of them ("Fee receipt maker") is still reported when it rides in the script.
    all.push(...templateLines.filter((line) => line.length >= exception.minLine), ...strings(entry.months ?? []), ...strings(entry.shortMonths ?? []));
    // A shorter template word is cut out only as a whole quoted value ("Fee receipt"), never as a piece of a
    // longer phrase, so "Fee receipt maker" is not hidden by the heading "Fee receipt" inside it.
    quoted.push(...templateLines.filter((line) => line.length < exception.minLine && line.length >= MIN_LENGTH));
  }
  // Longest first, so a short month name is not cut out of the middle of a line that holds it.
  // Nothing shorter than MIN_LENGTH is cut out: a short month name ("May") sits inside real interface
  // sentences, and cutting it out of a script would hide those sentences from this check. A value the
  // check looks for is at least MIN_LENGTH long, so it can never sit inside a shorter month name.
  const removable = [
    ...new Set([...all.flatMap(spellings), ...quoted.flatMap((word) => spellings(word).map((spelling) => `"${spelling}"`))]),
  ]
    .filter((text) => text.length >= MIN_LENGTH)
    .sort((a, b) => b.length - a.length);
  return { ...exception, pages: [exception.pages].flat(), lines, removable };
}).map((exception, index, all) => {
  // A line two files share (the earlier-balance templates end with the R0-2 lines) is searched for under the first file only.
  const earlier = all.slice(0, index);
  const lines = Object.fromEntries(locales.map((l) => [l, exception.lines[l].filter((line) => !earlier.some((e) => e.lines[l].includes(line)))]));
  return { ...exception, lines };
});

/** Every page of a language: the folders under out/{locale}/ that hold an index.html. "" is the landing. */
function pagesOf(locale, dir = join(OUT, locale), path = "") {
  if (!existsSync(dir)) return [];
  const found = existsSync(join(dir, "index.html")) ? [path] : [];
  for (const name of readdirSync(dir).sort()) {
    const next = join(dir, name);
    if (statSync(next).isDirectory()) found.push(...pagesOf(locale, next, `${path}${name}/`));
  }
  return found;
}

function pageFiles(locale, pagePath) {
  return filesOf(join(OUT, locale, pagePath, "index.html"));
}

function filesOf(path) {
  const html = readFileSync(path, "utf8");
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)].map((m) => m[1].split("?")[0]);
  const files = [{ name: path, text: html, html: true }];
  for (const src of new Set(scripts)) {
    const file = join(OUT, decodeURIComponent(src));
    if (src.startsWith("/") && existsSync(file)) files.push({ name: file, text: readFileSync(file, "utf8"), html: false });
  }
  return { files, htmlGzip: gzipSync(Buffer.from(html)).length };
}

const WORD_CHAR = /[A-Za-z0-9_$]/;

/**
 * Whether `spelling` is in `text` as words of its own. A value that starts or ends with a Latin
 * letter or a digit is not counted where it is glued into a longer name: the English word "Missing"
 * is not on a Hindi page because the framework's code has a `MissingSlotContext`, and "Remind" is
 * not there because a component is called `ReminderTool`. The same word in quotes, between tags or
 * in a sentence still counts, and so does one that follows an escaped line break inside a string.
 */
function appears(text, spelling) {
  const startsWithWord = WORD_CHAR.test(spelling[0]);
  const endsWithWord = WORD_CHAR.test(spelling[spelling.length - 1]);
  for (let at = text.indexOf(spelling); at !== -1; at = text.indexOf(spelling, at + 1)) {
    const before = text[at - 1] ?? "";
    const after = text[at + spelling.length] ?? "";
    const escapeBefore = /[nrt]/.test(before) && text[at - 2] === "\\";
    const gluedBefore = startsWithWord && WORD_CHAR.test(before) && !escapeBefore;
    const gluedAfter = endsWithWord && WORD_CHAR.test(after);
    if (!gluedBefore && !gluedAfter) return true;
  }
  return false;
}

const has = (text, value) => spellings(value).some((spelling) => appears(text, spelling));

let failed = false;
let ownFound = 0;
let pageCount = 0;
for (const locale of locales) {
  const pages = pagesOf(locale);
  for (const required of REQUIRED_PAGES) {
    if (!pages.includes(required)) {
      console.error(`${OUT}/${locale}/${required}index.html is missing, so the leak check cannot run.`);
      failed = true;
    }
  }
  const others = locales.filter((l) => l !== locale);
  for (const pagePath of pages) {
    pageCount += 1;
    const page = pageFiles(locale, pagePath);
    const address = `/${locale}/${pagePath}`;
    const excepted = exceptions.filter((exception) => exception.pages.some((prefix) => pagePath.startsWith(prefix)));

    for (const file of page.files) {
      // The text searched for interface words: a script of an excepted page, with the templates taken out.
      let searched = file.text;
      for (const text of untranslated[locale]) searched = searched.split(text).join("\n");
      if (!file.html) {
        for (const exception of excepted) {
          for (const text of exception.removable) searched = searched.split(text).join("\n");
        }
      }
      for (const other of others) {
        for (const value of unique[other]) {
          if (has(searched, value)) {
            console.error(`${locale} page loads a ${other} message: "${value}" is in ${file.name}`);
            failed = true;
          }
        }
      }
      // The templates themselves: allowed in the scripts of their own page and nowhere else.
      for (const exception of exceptions) {
        if (!file.html && excepted.includes(exception)) continue;
        for (const other of others) {
          const line = exception.lines[other].find((text) => has(file.text, text));
          if (line !== undefined) {
            console.error(`the ${other} templates leaked onto ${address}: "${line}" is in ${file.name}`);
            failed = true;
          }
        }
      }
    }

    // The exception must be real: the page has to carry every other language's templates in its scripts.
    for (const exception of excepted) {
      const scriptText = page.files.filter((file) => !file.html).map((file) => file.text);
      for (const other of others) {
        if (!exception.lines[other].some((line) => scriptText.some((text) => has(text, line)))) {
          console.error(`the ${exception.name} page does not carry the ${other} templates: none of them is in a script ${address} loads`);
          failed = true;
        }
      }
    }

    ownFound += unique[locale].filter((value) => has(page.files[0].text, value)).length;
    console.log(`${address}: ${(page.htmlGzip / 1024).toFixed(1)} KB gzipped HTML, ${page.files.length - 1} scripts`);
  }
}
// Pages outside every language folder that carry the words of all four languages on purpose, because the
// language is chosen at run time (the parent's receipt, spec R1-7 Part B, criterion 31). The exception is
// narrow: only the values of the named namespace, taken out of the page's HTML and scripts before the search.
// Everything else a language owns must still be absent, no language may be missing from the page, and no
// TODO-translate marker may be on it (a parent never sees one).
const SHELLS = [{ path: "r/index.html", name: "parent receipt", namespace: "receipt" }];
for (const shell of SHELLS) {
  const file = join(OUT, shell.path);
  if (!existsSync(file)) {
    console.error(`${file} is missing, so the leak check cannot run on the ${shell.name} page.`);
    failed = true;
    continue;
  }
  pageCount += 1;
  const { files, htmlGzip } = filesOf(file);
  const own = {};
  const removable = new Set();
  for (const locale of locales) {
    const tree = JSON.parse(readFileSync(join("messages", `${locale}.json`), "utf8"))[shell.namespace] ?? {};
    own[locale] = leaves(tree).filter((value) => value.length >= MIN_LENGTH);
    for (const value of own[locale]) for (const spelling of spellings(value)) removable.add(spelling);
  }
  const cut = [...removable].sort((a, b) => b.length - a.length);
  for (const f of files) {
    if (f.text.includes(MARKER)) {
      console.error(`the ${shell.name} page carries a ${MARKER.trim()} marker: it is in ${f.name}`);
      failed = true;
    }
    let searched = f.text;
    for (const text of cut) searched = searched.split(text).join("\n");
    for (const locale of locales) {
      for (const value of unique[locale]) {
        if (has(searched, value)) {
          console.error(`the ${shell.name} page loads a ${locale} message outside "${shell.namespace}": "${value}" is in ${f.name}`);
          failed = true;
        }
      }
    }
  }
  // The exception must be real: every language's own receipt words are on the page (not just English).
  for (const locale of locales) {
    const missing = own[locale].filter((value) => unique[locale].includes(value) || locale === "en").find((value) => !files.some((f) => has(f.text, value)));
    if (missing !== undefined) {
      console.error(`the ${shell.name} page does not carry the ${locale} words: "${missing}" is not in its HTML or scripts`);
      failed = true;
    }
  }
  console.log(`/${shell.path}: ${(htmlGzip / 1024).toFixed(1)} KB gzipped HTML, ${files.length - 1} scripts, all four languages' ${shell.namespace} words`);
}

// Fail closed: if no page shows any of its own words, the search above proved nothing.
if (!failed && ownFound === 0) {
  console.error("No page shows any message of its own language, so the leak check proves nothing (stale or empty out/?).");
  failed = true;
}
if (failed) process.exit(1);
console.log(`leak check: no language page carries another language's messages (${pageCount} pages, ${ownFound} own values seen)`);
