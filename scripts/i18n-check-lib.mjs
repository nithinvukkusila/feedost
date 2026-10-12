// The rules of `pnpm i18n:check`. English (en.json) is the source; the other files are checked
// against it. Messages are parsed with the same parser the app uses at run time.
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";

export const locales = ["en", "hi", "kn", "te"];
const TODO = "TODO-translate";
const TODO_PREFIX = `${TODO}: `;
const CAMEL = /^[a-z][a-zA-Z0-9]*$/;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const describe = (v) => (Array.isArray(v) ? "an array" : v === null ? "null" : typeof v === "object" ? "an object" : `a ${typeof v}`);

/** The names a message uses: `{name}` for arguments and `<b>` for rich-text tags. */
function signature(elements, found = new Set()) {
  for (const el of elements) {
    if (el.type === TYPE.literal || el.type === TYPE.pound) continue;
    if (el.type === TYPE.tag) {
      found.add(`<${el.value}>`);
      signature(el.children, found);
      continue;
    }
    found.add(`{${el.value}}`);
    if (el.type === TYPE.select || el.type === TYPE.plural) {
      for (const option of Object.values(el.options)) signature(option.value, found);
    }
  }
  return found;
}

/**
 * Checks messagesDir/{en,hi,kn,te}.json.
 * Returns { problems, keyCount, todoCount }; the caller decides the exit code.
 */
export function check(messagesDir, { strict = false } = {}) {
  const problems = [];
  const files = {};
  for (const locale of locales) {
    const path = join(messagesDir, `${locale}.json`);
    const label = `messages/${locale}.json`;
    if (!existsSync(path)) {
      problems.push(`${label} does not exist`);
      continue;
    }
    try {
      files[locale] = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      problems.push(`${label} is not valid JSON: ${error.message}`);
    }
  }
  if (!files.en) return { problems, keyCount: 0, todoCount: 0 };

  let todoCount = 0;
  const english = new Map(); // key -> { value, signature }

  /** Walks one file. Reports shape problems; calls onLeaf for every string value. */
  function walk(locale, node, path, onLeaf) {
    const label = `messages/${locale}.json`;
    for (const [key, value] of Object.entries(node)) {
      const full = path ? `${path}.${key}` : key;
      if (!CAMEL.test(key)) problems.push(`${label} has the key "${full}", which is not camelCase`);
      if (isObject(value)) walk(locale, value, full, onLeaf);
      else if (typeof value !== "string") problems.push(`${label} "${full}" is ${describe(value)}, not a string`);
      else if (value.trim() === "") problems.push(`${label} "${full}" is empty`);
      else onLeaf(full, value);
    }
  }

  /** The text to parse, and whether the value is a TODO marker. */
  function unmark(locale, key, value) {
    if (!value.startsWith(TODO)) return { text: value, todo: false };
    const label = `messages/${locale}.json`;
    if (locale === "en") {
      problems.push(`${label} "${key}" starts with ${TODO}; English is the source and cannot be marked`);
      return { text: value, todo: false };
    }
    if (!value.startsWith(TODO_PREFIX)) {
      problems.push(`${label} "${key}" must be written "${TODO_PREFIX}<the English text>"`);
      return { text: value, todo: false };
    }
    todoCount++;
    if (strict) problems.push(`${label} "${key}" is still marked ${TODO}`);
    return { text: value.slice(TODO_PREFIX.length), todo: true };
  }

  function analyse(locale, key, value) {
    const label = `messages/${locale}.json`;
    const { text } = unmark(locale, key, value);
    if (text.trim() === "") {
      problems.push(`${label} "${key}" is empty after ${TODO}`);
      return null;
    }
    try {
      return signature(parse(text));
    } catch (error) {
      const code = error && error.message ? error.message : String(error);
      problems.push(`${label} "${key}" is not valid message syntax: ${code}`);
      return null;
    }
  }

  walk("en", files.en, "", (key, value) => english.set(key, { sig: analyse("en", key, value) }));

  for (const locale of locales.filter((l) => l !== "en" && files[l])) {
    const label = `messages/${locale}.json`;
    const seen = new Set();
    walk(locale, files[locale], "", (key, value) => {
      seen.add(key);
      const source = english.get(key);
      const sig = analyse(locale, key, value);
      if (!source || !source.sig || !sig) return;
      const expected = [...source.sig].sort();
      const found = [...sig].sort();
      if (expected.join(" ") !== found.join(" ")) {
        problems.push(`${label} "${key}": expected ${expected.join(" ") || "no placeholders"}, found ${found.join(" ") || "none"}`);
      }
    });
    for (const key of english.keys()) {
      if (!seen.has(key)) problems.push(`${label} is missing "${key}"`);
    }
    for (const key of seen) {
      if (!english.has(key)) problems.push(`${label} has "${key}" which en.json does not`);
    }
    // A string where English has an object, or the other way round, explains the missing and extra above.
    compareShape(locale, files.en, files[locale], "");
  }

  function compareShape(locale, enNode, node, path) {
    for (const [key, enValue] of Object.entries(enNode)) {
      const value = node[key];
      const full = path ? `${path}.${key}` : key;
      if (value === undefined) continue;
      if (isObject(enValue) && !isObject(value)) problems.push(`messages/${locale}.json "${full}" is not nested like en.json (en.json has an object)`);
      else if (!isObject(enValue) && isObject(value)) problems.push(`messages/${locale}.json "${full}" is not nested like en.json (en.json has a string)`);
      else if (isObject(enValue) && isObject(value)) compareShape(locale, enValue, value, full);
    }
  }

  return { problems, keyCount: english.size, todoCount };
}

// ---------------------------------------------------------------------------------------------
// The fee reminder's message templates (spec R0-2, criteria 21, 23, 28 and 30). They are not in
// messages/: a parent reads them, every language's page carries all of them, and a template can
// never be shown as `TODO-translate`. So they have their own rules and their own review record.

const SLOTS = ["{parent}", "{amount}", "{month}", "{link}", "{upiId}"];
const TONES = ["polite", "firm"];
const SCRIPTS = {
  hi: { name: "Devanagari", test: /[\u0900-\u097F]/ },
  kn: { name: "Kannada", test: /[\u0C80-\u0CFF]/ },
  te: { name: "Telugu", test: /[\u0C00-\u0C7F]/ },
};
const STATUSES = ["reviewed", "not reviewed"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const isText = (v) => typeof v === "string" && v.trim() !== "";
const count = (text, piece) => text.split(piece).length - 1;

/** What a reviewer signs: a language's two templates and twelve month names, as the file stands. */
export function templateHash(entry) {
  return createHash("sha256").update(JSON.stringify({ polite: entry.polite, firm: entry.firm, months: entry.months })).digest("hex");
}

/**
 * Checks the templates file and its review record.
 * Returns { problems, templateCount, notReviewed, notes }: `notReviewed` lists the languages with no
 * valid sign-off, `notes` are lines to print (the hash to copy into the record). Under `strict`
 * (the Release 0 gate) a language that is not reviewed is a problem.
 */
export function checkTemplates(file, reviewFile, { strict = false } = {}) {
  const problems = [];
  const notes = [];
  const label = "templates.json";
  const empty = { problems, templateCount: 0, notReviewed: [], notes };

  let tree;
  try {
    tree = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    problems.push(`${label} is not valid JSON: ${error.message}`);
    return empty;
  }
  if (!isObject(tree)) {
    problems.push(`${label} is ${describe(tree)}, not an object`);
    return empty;
  }

  for (const key of Object.keys(tree)) {
    if (!locales.includes(key)) problems.push(`${label} has "${key}", which is not one of ${locales.join(", ")}`);
  }

  let templateCount = 0;
  const usable = {}; // languages whose shape is right, so they can be hashed
  for (const locale of locales) {
    const entry = tree[locale];
    if (!isObject(entry)) {
      problems.push(`${label} is missing "${locale}"`);
      continue;
    }
    for (const key of Object.keys(entry)) {
      if (![...TONES, "months"].includes(key)) problems.push(`${label} "${locale}" has "${key}", which is not polite, firm or months`);
    }
    let shapeOk = true;

    for (const tone of TONES) {
      const name = `"${locale}.${tone}"`;
      const lines = entry[tone];
      if (!Array.isArray(lines) || lines.length === 0 || !lines.every(isText)) {
        problems.push(`${label} ${name} must be a list of lines, none of them empty`);
        shapeOk = false;
        continue;
      }
      templateCount += 1;
      const text = lines.join("\n");
      if (text.includes(TODO)) {
        problems.push(`${label} ${name} contains ${TODO}; a template cannot be marked, see the review record`);
      }
      for (const slot of SLOTS) {
        const times = count(text, slot);
        if (times !== 1) problems.push(`${label} ${name}: ${slot} appears ${times} times`);
      }
      let rest = text;
      for (const slot of SLOTS) rest = rest.split(slot).join("");
      if (/[{}]/.test(rest)) problems.push(`${label} ${name} has a brace that is not one of ${SLOTS.join(" ")}`);
      // The link must end at a line feed, so nothing can be glued to it.
      if (count(text, "{link}") === 1 && !lines.includes("{link}")) problems.push(`${label} ${name}: {link} must be alone on its line`);
      const script = SCRIPTS[locale];
      if (script && !script.test.test(text)) problems.push(`${label} ${name} has no ${script.name} text`);
      // English pasted in is not a translation.
      const english = tree.en?.[tone];
      if (locale !== "en" && Array.isArray(english) && english.join("\n") === text) {
        problems.push(`${label} ${name} is the same as the English template`);
      }
    }

    const months = entry.months;
    if (!Array.isArray(months) || !months.every(isText)) {
      problems.push(`${label} "${locale}.months" must be a list of 12 names, none of them empty`);
      shapeOk = false;
    } else {
      if (months.length !== 12) {
        problems.push(`${label} "${locale}.months" has ${months.length} names, expected 12`);
        shapeOk = false;
      } else if (new Set(months).size !== 12) {
        problems.push(`${label} "${locale}.months" has the same name twice`);
      }
      months.forEach((month, index) => {
        if (month.includes(TODO)) problems.push(`${label} "${locale}.months" contains ${TODO}; a month name cannot be marked, see the review record`);
        else if (/[{}]/.test(month)) problems.push(`${label} "${locale}.months" name ${index + 1} has a brace`);
        else if (SCRIPTS[locale] && !SCRIPTS[locale].test.test(month)) problems.push(`${label} "${locale}.months" name ${index + 1} has no ${SCRIPTS[locale].name} text`);
      });
    }
    if (shapeOk) usable[locale] = entry;
  }

  // The review record: one entry per language other than English, the source.
  const reviewLabel = "templates.review.json";
  const reviewed = locales.filter((l) => l !== "en");
  let record = null;
  if (!existsSync(reviewFile)) {
    problems.push(`${reviewLabel} does not exist; it records who has read the ${reviewed.join(", ")} templates`);
  } else {
    try {
      record = JSON.parse(readFileSync(reviewFile, "utf8"));
      if (!isObject(record)) {
        problems.push(`${reviewLabel} is ${describe(record)}, not an object`);
        record = null;
      }
    } catch (error) {
      problems.push(`${reviewLabel} is not valid JSON: ${error.message}`);
    }
  }

  const notReviewed = [];
  if (record) {
    for (const key of Object.keys(record)) {
      if (!reviewed.includes(key)) problems.push(`${reviewLabel} has "${key}", which is not one of ${reviewed.join(", ")}`);
    }
  }
  for (const locale of reviewed) {
    const entry = record?.[locale];
    const current = usable[locale] ? templateHash(usable[locale]) : null;
    const what = "2 templates, 12 month names";
    if (!record) {
      notReviewed.push(locale);
      continue;
    }
    if (!isObject(entry)) {
      problems.push(`${reviewLabel} is missing "${locale}"`);
      notReviewed.push(locale);
      continue;
    }
    if (!STATUSES.includes(entry.status)) {
      problems.push(`${reviewLabel} "${locale}": status must be "reviewed" or "not reviewed", found ${JSON.stringify(entry.status)}`);
      notReviewed.push(locale);
      continue;
    }
    if (entry.status === "reviewed") {
      let complete = true;
      if (!isText(entry.reviewer)) {
        problems.push(`${reviewLabel} "${locale}" is marked reviewed with no reviewer's name`);
        complete = false;
      }
      if (typeof entry.date !== "string" || !DATE.test(entry.date)) {
        problems.push(`${reviewLabel} "${locale}" is marked reviewed with no date written YYYY-MM-DD`);
        complete = false;
      }
      if (typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
        problems.push(`${reviewLabel} "${locale}" is marked reviewed with no sha256 of the text that was read`);
        complete = false;
      }
      if (complete && current !== null && entry.sha256 === current) continue; // signed off, and the text has not changed since
      notReviewed.push(locale);
      if (complete && current !== null) {
        const changed = `${label} "${locale}" changed after the review of ${entry.date} by ${entry.reviewer}`;
        if (strict) problems.push(changed);
        else notes.push(`${changed}; it counts as not reviewed. Current text ${current}`);
      }
      continue;
    }
    notReviewed.push(locale);
    if (strict) {
      problems.push(`${label} "${locale}" is not reviewed (${what}): get a native reader's sign-off and record it in ${reviewLabel}`);
    } else if (current !== null) {
      notes.push(`${locale}: not reviewed; current text ${current}`);
    }
  }

  return { problems, templateCount, notReviewed, notes };
}

// ---------------------------------------------------------------------------------------------
// The waitlist's promise sentences (spec R0-4, criterion 20). They are in messages/ like every
// other word, but they are a promise about someone's phone number, so each of hi, kn and te also
// needs a native reader's sign-off in its own review record, and may never be a TODO-translate.

/** What a reader signs: the values of the listed keys in one language's file, as the file stands. */
export function copyHash(messages, keys) {
  const read = (key) => key.split(".").reduce((node, part) => (isObject(node) ? node[part] : undefined), messages);
  return createHash("sha256").update(JSON.stringify(keys.map((key) => [key, read(key)]))).digest("hex");
}

/**
 * Checks the review record of the promise sentences: `keys` are dotted paths into the message files
 * (for example "waitlistForm.consent"). Returns { problems, notReviewed, notes }. Under `strict` a
 * language with no valid sign-off, or whose text changed after its sign-off, is a problem.
 * A promise sentence still marked TODO-translate is always a problem: it cannot be reviewed.
 */
export function checkReviewRecord(reviewFile, keys, { messagesDir = "messages", strict = false, label = "copy.review.json", noun = "promise sentence" } = {}) {
  const problems = [];
  const notes = [];
  const notReviewed = [];
  const reviewed = locales.filter((l) => l !== "en");

  let record = null;
  if (!existsSync(reviewFile)) {
    problems.push(`${label} does not exist; it records who has read the ${reviewed.join(", ")} ${noun}s`);
  } else {
    try {
      record = JSON.parse(readFileSync(reviewFile, "utf8"));
      if (!isObject(record)) {
        problems.push(`${label} is ${describe(record)}, not an object`);
        record = null;
      }
    } catch (error) {
      problems.push(`${label} is not valid JSON: ${error.message}`);
    }
  }
  if (record) {
    for (const key of Object.keys(record)) {
      if (!reviewed.includes(key)) problems.push(`${label} has "${key}", which is not one of ${reviewed.join(", ")}`);
    }
  }

  for (const locale of reviewed) {
    let messages;
    try {
      messages = JSON.parse(readFileSync(join(messagesDir, `${locale}.json`), "utf8"));
    } catch {
      messages = null; // the main check reports the missing or broken file
    }
    let current = null;
    if (messages) {
      const read = (key) => key.split(".").reduce((node, part) => (isObject(node) ? node[part] : undefined), messages);
      const marked = keys.filter((key) => typeof read(key) === "string" && read(key).startsWith(TODO));
      for (const key of marked) problems.push(`messages/${locale}.json "${key}" is a ${noun} and cannot be marked ${TODO}; write it and have it read`);
      if (marked.length === 0) current = copyHash(messages, keys);
    }

    const entry = record?.[locale];
    if (!record) {
      notReviewed.push(locale);
      continue;
    }
    if (!isObject(entry)) {
      problems.push(`${label} is missing "${locale}"`);
      notReviewed.push(locale);
      continue;
    }
    if (!STATUSES.includes(entry.status)) {
      problems.push(`${label} "${locale}": status must be "reviewed" or "not reviewed", found ${JSON.stringify(entry.status)}`);
      notReviewed.push(locale);
      continue;
    }
    if (entry.status === "reviewed") {
      let complete = true;
      if (!isText(entry.reviewer)) {
        problems.push(`${label} "${locale}" is marked reviewed with no reviewer's name`);
        complete = false;
      }
      if (typeof entry.date !== "string" || !DATE.test(entry.date)) {
        problems.push(`${label} "${locale}" is marked reviewed with no date written YYYY-MM-DD`);
        complete = false;
      }
      if (typeof entry.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(entry.sha256)) {
        problems.push(`${label} "${locale}" is marked reviewed with no sha256 of the text that was read`);
        complete = false;
      }
      if (complete && current !== null && entry.sha256 === current) continue; // signed off, and the text has not changed since
      notReviewed.push(locale);
      if (complete && current !== null) {
        const changed = `messages/${locale}.json ${noun}s changed after the review of ${entry.date} by ${entry.reviewer}`;
        if (strict) problems.push(changed);
        else notes.push(`${changed}; it counts as not reviewed. Current text ${current}`);
      }
      continue;
    }
    notReviewed.push(locale);
    if (strict) {
      problems.push(`messages/${locale}.json ${noun}s are not reviewed (${keys.length} keys): get a native reader's sign-off and record it in ${label}`);
    } else if (current !== null) {
      notes.push(`${locale}: ${noun}s not reviewed; current text ${current}`);
    }
  }
  return { problems, notReviewed, notes };
}
