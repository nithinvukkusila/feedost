// Fails when a message file breaks a rule in scripts/i18n-check-lib.mjs. Run from the repo root;
// it reads ./messages. `--strict` also fails on any TODO-translate value (the Release 0 gate).
import { check, locales } from "./i18n-check-lib.mjs";

const strict = process.argv.includes("--strict");
const { problems, keyCount, todoCount } = check("messages", { strict });

for (const problem of problems) console.error(problem);
if (problems.length) {
  console.error(`i18n: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log(`i18n: ${keyCount} keys present in all ${locales.length} languages; ${todoCount} values marked TODO-translate`);
