// Which languages a parent may see (spec docs/specs/parent-pages-english.md, plan section 2). A parent-facing surface
// shows English, plus each language that a named person has signed in every review record the surface's words come
// from, for the text as it stands now. This is the one copy of that rule: the build (src/lib/unlocked-languages.ts),
// `pnpm i18n:check`, `pnpm check:leak` and the unit tests all call it, so a page and a check can never disagree.
//
// Plain ESM with only `node:crypto`: it runs in Node scripts, in vitest and in a server page at build time. It must
// never reach a browser bundle (src/lib/pay-page-code-rules.test.ts).
import { createHash } from "node:crypto";

export const locales = ["en", "hi", "kn", "te"];
const TODO = "TODO-translate";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isText = (v) => typeof v === "string" && v.trim() !== "";
const read = (messages, key) => key.split(".").reduce((node, part) => (isObject(node) ? node[part] : undefined), messages);

/** Every dotted leaf path under `node`, each prefixed with `path`. */
export function leafPaths(node, path) {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === "object" ? leafPaths(value, `${path}.${key}`) : [`${path}.${key}`],
  );
}

/** What a reader signs: the values of the listed keys in one language's file, as the file stands. */
export function copyHash(messages, keys) {
  return createHash("sha256").update(JSON.stringify(keys.map((key) => [key, read(messages, key)]))).digest("hex");
}

/** The review records of the parent surfaces, and the message namespace each one covers (every leaf, from en.json). */
export const RECORDS = {
  payPage: { file: "src/lib/pay-page-words.review.json", namespace: "payPage" },
  receipt: { file: "src/lib/receipt-words.review.json", namespace: "receipt" },
};

/**
 * Which records each parent surface needs, all signed, for a language to show there. `/p/` reuses the receipt's month
 * and subject words, so it needs both. The receipt tool (S4) is added by R0-3 (#12).
 */
export const SURFACES = {
  payPage: { path: "/p/", records: ["payPage", "receipt"] },
  receipt: { path: "/r/", records: ["receipt"] },
};

/** The keys a record covers, read from English's file (the source), so a new word is covered at once. */
export function recordKeys(name, en) {
  const { namespace } = RECORDS[name];
  return leafPaths(isObject(en?.[namespace]) ? en[namespace] : {}, namespace);
}

/**
 * The hash a record's entry for `locale` must carry: copyHash over the record's keys in that language's raw file.
 * Null when the file is missing or any of the keys is still marked TODO-translate: a marked word can never be signed.
 */
export function recordHash(name, locale, messages) {
  const file = messages?.[locale];
  if (!isObject(file) || !isObject(messages?.en)) return null;
  const keys = recordKeys(name, messages.en);
  if (keys.some((key) => typeof read(file, key) === "string" && read(file, key).startsWith(TODO))) return null;
  return copyHash(file, keys);
}

/** True only for a signed entry: status exactly "reviewed", a named person, a date, and the hash of the text as it stands. */
export function isSigned(entry, currentHash) {
  return (
    isObject(entry) &&
    entry.status === "reviewed" &&
    isText(entry.reviewer) &&
    typeof entry.date === "string" &&
    DATE.test(entry.date) &&
    typeof entry.sha256 === "string" &&
    SHA256.test(entry.sha256) &&
    typeof currentHash === "string" &&
    entry.sha256 === currentHash
  );
}

/**
 * The languages a surface may show: English, then each language signed in every record the surface needs, in
 * `locales` order. `records` is keyed by record name (payPage, receipt); `messages` by language, raw (markers kept).
 */
export function unlockedFrom(surface, { records, messages }) {
  const found = SURFACES[surface];
  if (!found) throw new RangeError(`"${surface}" is not a parent surface`);
  return locales.filter(
    (locale) => locale === "en" || found.records.every((name) => isSigned(records?.[name]?.[locale], recordHash(name, locale, messages))),
  );
}

/**
 * The surfaces' unlocked languages and the TODO-translate rule that follows from them: a key of a parent namespace
 * whose language is locked on every surface that uses it is shown as English to every parent, so under `--strict` its
 * marker is not a problem. Any other key keeps the strict rule.
 */
export function lockedEverywhere(unlocked) {
  return (locale, key) => {
    const namespace = key.split(".")[0];
    const users = Object.entries(SURFACES).filter(([, s]) => s.records.some((name) => RECORDS[name].namespace === namespace));
    return users.length > 0 && users.every(([surface]) => !(unlocked[surface] ?? []).includes(locale));
  };
}

/** The keys of the consent and privacy-notice wording (R1-9): `payPage.consent.*`, from English's file. */
export function consentKeys(en) {
  return leafPaths(isObject(en?.payPage?.consent) ? en.payPage.consent : {}, "payPage.consent");
}

/** What the founder approves: one sha256 over the consent wording of all four languages, in order. Null if a file is missing. */
export function consentHashOf(messages) {
  if (!locales.every((locale) => isObject(messages?.[locale]))) return null;
  const keys = consentKeys(messages.en);
  const sum = createHash("sha256");
  for (const locale of locales) sum.update(`${locale}:${copyHash(messages[locale], keys)}\n`);
  return sum.digest("hex");
}

/** True only when the record's `consentWording` block is approved by a named person, dated, for the wording as it stands. */
export function consentApproved(record, messages) {
  const block = isObject(record) ? record.consentWording : undefined;
  const current = consentHashOf(messages);
  return (
    isObject(block) &&
    block.status === "approved" &&
    isText(block.approvedBy) &&
    typeof block.date === "string" &&
    DATE.test(block.date) &&
    typeof block.sha256 === "string" &&
    SHA256.test(block.sha256) &&
    current !== null &&
    block.sha256 === current
  );
}

const FIXTURE_DATE = "2026-10-16";
const unsigned = () => ({ status: "not reviewed", reviewer: "", date: "", sha256: "" });

/**
 * Test and /dev only: review records that unlock `langs` on `surface` for the given messages, signed "Test fixture"
 * with the real hashes. `consent: true` approves the consent wording as well. Never imported by a parent page
 * (src/lib/pay-page-code-rules.test.ts fails if it is).
 * @param {string} surface
 * @param {readonly string[]} langs
 * @param {{ messages: unknown, consent?: boolean }} options
 * @returns {Record<string, Record<string, any>>} records keyed by record name, then by language (and `consentWording`)
 */
export function signedFixture(surface, langs, { messages, consent = false }) {
  const found = SURFACES[surface];
  if (!found) throw new RangeError(`"${surface}" is not a parent surface`);
  /** @type {Record<string, Record<string, any>>} */
  const records = {};
  for (const name of found.records) {
    records[name] = {};
    for (const locale of locales.filter((l) => l !== "en")) {
      records[name][locale] = langs.includes(locale)
        ? { status: "reviewed", reviewer: "Test fixture", date: FIXTURE_DATE, sha256: recordHash(name, locale, messages) ?? "" }
        : unsigned();
    }
  }
  if (records.payPage) {
    records.payPage.consentWording = consent
      ? { status: "approved", approvedBy: "Test fixture", date: FIXTURE_DATE, sha256: consentHashOf(messages) ?? "" }
      : { status: "draft, not approved", approvedBy: "", date: "", sha256: "" };
  }
  return records;
}
