// Fails when a message file breaks a rule in scripts/i18n-check-lib.mjs. Run from the repo root;
// it reads ./messages and, when it exists, the fee reminder's templates file and its review record.
// `--strict` (the Release 0 gate) also fails on any TODO-translate value and on any language whose
// templates no native reader has signed off.
import { existsSync } from "node:fs";
import { check, checkReceiptTemplates, checkTemplates, locales } from "./i18n-check-lib.mjs";

const TEMPLATES = "src/lib/reminder/templates.json";
const REVIEW = "src/lib/reminder/templates.review.json";

const RECEIPT_TEMPLATES = "src/lib/receipt/templates.json";
const RECEIPT_REVIEW = "src/lib/receipt/templates.review.json";

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
if (existsSync(RECEIPT_TEMPLATES)) {
  const receipt = checkReceiptTemplates(RECEIPT_TEMPLATES, RECEIPT_REVIEW, { strict });
  problems.push(...receipt.problems);
  for (const note of receipt.notes) console.log(`receipt ${note}`);
  const waiting = receipt.notReviewed;
  templateSummary +=
    waiting.length === 0
      ? `; receipt: ${receipt.templateCount} texts, all ${locales.length - 1} languages reviewed`
      : `; receipt: ${receipt.templateCount} texts, ${waiting.length} language${waiting.length === 1 ? "" : "s"} not reviewed (${waiting.join(", ")})`;
}

for (const problem of problems) console.error(problem);
if (problems.length) {
  console.error(`i18n: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log(`i18n: ${keyCount} keys present in all ${locales.length} languages; ${todoCount} values marked TODO-translate${templateSummary}`);
