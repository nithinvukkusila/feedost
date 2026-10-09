// The rules of `pnpm i18n:check`. English (en.json) is the source; the other files are checked
// against it. Messages are parsed with the same parser the app uses at run time.
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
