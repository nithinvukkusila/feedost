// Fails when a message file breaks a rule in scripts/i18n-check-lib.mjs. Run from the repo root;
// it reads ./messages and, when it exists, the fee reminder's templates file and its review record.
// `--strict` (the Release 0 gate) also fails on any TODO-translate value and on any language whose
// templates no native reader has signed off.
import { existsSync, readFileSync } from "node:fs";
import { check, checkAppTemplates, checkConsentWording, checkReviewRecord, checkTemplates, locales } from "./i18n-check-lib.mjs";

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
// reads these on a page a tutor sent them, so none may be a TODO-translate and each of hi, kn and te needs a
// native reader's sign-off before release. The keys are read from en.json, so a new word is covered at once.
const RECEIPT_REVIEW = "src/lib/receipt-words.review.json";
// The parent's pay page (spec R1-9 Part B, criterion 40): every word of the `payPage` namespace, with the same rules as
// the receipt words, plus a "consentWording" block for the privacy notice that only the founder can approve (questions
// 3 and 5). A word still marked TODO-translate shows English to the parent, so it is allowed until release; `--strict`
// (the release gate) fails on it, on any language not reviewed, and on wording not approved.
const PAYPAGE_REVIEW = "src/lib/pay-page-words.review.json";
function leafPaths(node, path) {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === "object" ? leafPaths(value, `${path}.${key}`) : [`${path}.${key}`],
  );
}

const strict = process.argv.includes("--strict");
const { problems, keyCount, todoCount } = check("messages", { strict });

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
  const receipt = checkReviewRecord(RECEIPT_REVIEW, keys, { strict, label: "receipt-words.review.json", noun: "parent receipt word" });
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
} else {
  problems.push("src/lib/pay-page-words.review.json does not exist; it records who has read the pay page words and whether the consent wording is approved");
}

for (const problem of problems) console.error(problem);
if (problems.length) {
  console.error(`i18n: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  // Not process.exit(1): a long list written to a pipe would be cut off by the exit.
  process.exitCode = 1;
} else console.log(`i18n: ${keyCount} keys present in all ${locales.length} languages; ${todoCount} values marked TODO-translate${templateSummary}${appSummary}${copySummary}${receiptSummary}${payPageSummary}`);
