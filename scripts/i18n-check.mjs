// Fails when a message file breaks a rule in scripts/i18n-check-lib.mjs. Run from the repo root;
// it reads ./messages and, when it exists, the fee reminder's templates file and its review record.
// `--strict` (the Release 0 gate) also fails on any TODO-translate value and on any language whose
// templates no native reader has signed off.
import { existsSync, readFileSync } from "node:fs";
import { check, checkAppTemplates, checkConsentWording, checkReviewRecord, checkTemplates, leafPaths, locales } from "./i18n-check-lib.mjs";
import { RECORDS, SURFACES, lockedEverywhere, unlockedFrom } from "./language-unlock.mjs";

const TEMPLATES = "src/lib/reminder/templates.json";
const REVIEW = "src/lib/reminder/templates.review.json";
const APP_TEMPLATES = "src/lib/reminder/templates.app.json";
const APP_REVIEW = "src/lib/reminder/templates.app.review.json";

// The waitlist's promise sentences (spec R0-4): the consent line and what the form says after it sends.
const COPY_REVIEW = "src/lib/waitlist/copy.review.json";
const COPY_KEYS = [
  "waitlistForm.consent",
  "waitlistForm.done.stamp",
  "waitlistForm.done.title",
  "waitlistForm.done.body",
  "waitlistForm.failed.title",
  "waitlistForm.failed.detail",
  "waitlistForm.rateLimited.title",
  "waitlistForm.rateLimited.detail",
];

// The parent's receipt page (spec R1-7 Part B, criterion 31): every word of the `receipt` namespace. A parent
// reads these on a page a tutor sent them. Like the pay page words (below), a word still marked TODO-translate cannot
// be signed and its language stays locked, so the parent sees English; that is allowed (spec parent-pages-english,
// plan section 2). The keys are read from en.json, so a new word is covered at once.
const RECEIPT_REVIEW = "src/lib/receipt-words.review.json";
// The parent's pay page (spec R1-9 Part B, criterion 40): every word of the `payPage` namespace, with the same rules as
// the receipt words, plus a "consentWording" block for the privacy notice that only the founder can approve (questions
// 3 and 5). A word still marked TODO-translate shows English to the parent, so it is allowed until release; `--strict`
// (the release gate) fails on it and on wording not approved.
const PAYPAGE_REVIEW = "src/lib/pay-page-words.review.json";
//
// Both are parent records (spec parent-pages-english): a language not signed in them is locked, and every parent sees
// English there. So "not reviewed" is not a release problem, and neither is a TODO-translate word of a parent page in a
// locked language. A signature whose text changed since is a problem under --strict, and so is draft consent wording.

const strict = process.argv.includes("--strict");

/** A file parsed, or null when it is missing or broken (the checks below report that). */
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
const rawMessages = Object.fromEntries(locales.map((locale) => [locale, readJson(`messages/${locale}.json`)]));
const parentRecords = Object.fromEntries(Object.entries(RECORDS).map(([name, { file }]) => [name, readJson(file)]));
const unlocked = Object.fromEntries(Object.keys(SURFACES).map((surface) => [surface, unlockedFrom(surface, { records: parentRecords, messages: rawMessages })]));

const { problems, keyCount, todoCount } = check("messages", { strict, skipTodo: lockedEverywhere(unlocked) });

let templateSummary = "";
if (existsSync(TEMPLATES)) {
  const templates = checkTemplates(TEMPLATES, REVIEW, { strict });
  problems.push(...templates.problems);
  for (const note of templates.notes) console.log(note);
  const total = locales.length - 1;
  const waiting = templates.notReviewed;
  templateSummary =
    waiting.length === 0
      ? `; ${templates.templateCount} templates, all ${total} languages reviewed`
      : `; ${templates.templateCount} templates, ${waiting.length} language${waiting.length === 1 ? "" : "s"} not reviewed (${waiting.join(", ")})`;
}

let appSummary = "";
if (existsSync(APP_TEMPLATES)) {
  const app = checkAppTemplates(APP_TEMPLATES, APP_REVIEW, { strict });
  problems.push(...app.problems);
  for (const note of app.notes) console.log(note);
  const waiting = app.notReviewed;
  appSummary =
    waiting.length === 0
      ? `; ${app.templateCount} app templates and ${app.wordCount} parent words, all ${locales.length - 1} languages reviewed`
      : `; ${app.templateCount} app templates and ${app.wordCount} parent words, ${waiting.length} language${waiting.length === 1 ? "" : "s"} not reviewed (${waiting.join(", ")})`;
}

let copySummary = "";
if (existsSync(COPY_REVIEW)) {
  const copy = checkReviewRecord(COPY_REVIEW, COPY_KEYS, { strict });
  problems.push(...copy.problems);
  for (const note of copy.notes) console.log(note);
  const waiting = copy.notReviewed;
  copySummary =
    waiting.length === 0
      ? `; ${COPY_KEYS.length} promise sentences, all ${locales.length - 1} languages reviewed`
      : `; ${COPY_KEYS.length} promise sentences, ${waiting.length} language${waiting.length === 1 ? "" : "s"} not reviewed (${waiting.join(", ")})`;
}

let receiptSummary = "";
if (existsSync(RECEIPT_REVIEW)) {
  const keys = leafPaths(JSON.parse(readFileSync("messages/en.json", "utf8")).receipt ?? {}, "receipt");
  const receipt = checkReviewRecord(RECEIPT_REVIEW, keys, { strict, label: "receipt-words.review.json", noun: "parent receipt word", todoAllowed: true, parent: true });
  problems.push(...receipt.problems);
  for (const note of receipt.notes) console.log(note);
  const waiting = receipt.notReviewed;
  receiptSummary =
    waiting.length === 0
      ? `; ${keys.length} parent receipt words, all ${locales.length - 1} languages reviewed`
      : `; ${keys.length} parent receipt words, ${waiting.length} language${waiting.length === 1 ? "" : "s"} not reviewed (${waiting.join(", ")})`;
}

let payPageSummary = "";
if (existsSync(PAYPAGE_REVIEW)) {
  const keys = leafPaths(JSON.parse(readFileSync("messages/en.json", "utf8")).payPage ?? {}, "payPage");
  const payPage = checkReviewRecord(PAYPAGE_REVIEW, keys, {
    strict,
    label: "pay-page-words.review.json",
    noun: "pay page word",
    ignoreKeys: ["consentWording"],
    todoAllowed: true,
    parent: true,
  });
  const wording = checkConsentWording(JSON.parse(readFileSync(PAYPAGE_REVIEW, "utf8")), { strict, label: "pay-page-words.review.json" });
  problems.push(...payPage.problems, ...wording.problems);
  for (const note of [...payPage.notes, ...wording.notes]) console.log(note);
  const waiting = payPage.notReviewed;
  payPageSummary =
    (waiting.length === 0
      ? `; ${keys.length} pay page words, all ${locales.length - 1} languages reviewed`
      : `; ${keys.length} pay page words, ${waiting.length} language${waiting.length === 1 ? "" : "s"} not reviewed (${waiting.join(", ")})`) +
    (wording.approved ? ", consent wording approved" : ", consent wording a draft");
}

// Which languages a parent can see on each parent page, from the same rule the pages are built with.
const shown = Object.entries(SURFACES).map(([surface, { path }]) => `${path} ${unlocked[surface].join(", ")}`);
const lockedAll = locales.filter((locale) => Object.keys(SURFACES).some((surface) => !unlocked[surface].includes(locale)));
console.log(`parent pages: ${shown.join(" | ")}${lockedAll.length ? ` (locked: ${lockedAll.join(", ")})` : ""}`);

for (const problem of problems) console.error(problem);
if (problems.length) {
  console.error(`i18n: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  // Not process.exit(1): a long list written to a pipe would be cut off by the exit.
  process.exitCode = 1;
} else console.log(`i18n: ${keyCount} keys present in all ${locales.length} languages; ${todoCount} values marked TODO-translate${templateSummary}${appSummary}${copySummary}${receiptSummary}${payPageSummary}`);
