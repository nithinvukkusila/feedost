// Fails when a message file breaks a rule in scripts/i18n-check-lib.mjs. Run from the repo root;
// it reads ./messages and, when it exists, the fee reminder's templates file and its review record.
// `--strict` (the Release 0 gate) also fails on any TODO-translate value and on any language whose
// templates no native reader has signed off.
import { existsSync, readFileSync } from "node:fs";
import { check, checkAppTemplates, checkReceiptTemplates, checkReviewRecord, checkTemplates, locales } from "./i18n-check-lib.mjs";

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
function leafPaths(node, path) {
  return Object.entries(node).flatMap(([key, value]) =>
    value !== null && typeof value === "object" ? leafPaths(value, `${path}.${key}`) : [`${path}.${key}`],
  );
}

// The receipt maker's PDF wording (spec R0-3, criterion 26): its own file and its own review record.
const RECEIPT_TOOL_TEMPLATES = "src/lib/receipt/templates.json";
const RECEIPT_TOOL_REVIEW = "src/lib/receipt/templates.review.json";

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

// The fee receipt's wording has its own file and its own review record (spec R0-3, criterion 26).
if (existsSync(RECEIPT_TOOL_TEMPLATES)) {
  const receipt = checkReceiptTemplates(RECEIPT_TOOL_TEMPLATES, RECEIPT_TOOL_REVIEW, { strict });
  problems.push(...receipt.problems);
  for (const note of receipt.notes) console.log(`receipt ${note}`);
  const waiting = receipt.notReviewed;
  templateSummary +=
    waiting.length === 0
      ? `; receipt: ${receipt.templateCount} texts, all ${locales.length - 1} languages reviewed`
      : `; receipt: ${receipt.templateCount} texts, ${waiting.length} language${waiting.length === 1 ? "" : "s"} not reviewed (${waiting.join(", ")})`;
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

for (const problem of problems) console.error(problem);
if (problems.length) {
  console.error(`i18n: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  // Not process.exit(1): a long list written to a pipe would be cut off by the exit.
  process.exitCode = 1;
} else console.log(`i18n: ${keyCount} keys present in all ${locales.length} languages; ${todoCount} values marked TODO-translate${templateSummary}${appSummary}${copySummary}${receiptSummary}`);
