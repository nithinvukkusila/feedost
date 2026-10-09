// Fails when admin-key material is found in src/, out/, config or any tracked or new file.
// Run from the repo root (after `pnpm build` so out/ is scanned too). Prints path:line and rule only.
//   pnpm check:secrets [--root <dir>]
import { scanAll } from "./check-secrets-lib.mjs";

const flag = process.argv.indexOf("--root");
const root = flag > -1 ? process.argv[flag + 1] : ".";
if (!root) {
  console.error("check:secrets: --root needs a folder");
  process.exit(1);
}

const { problems, scanned } = scanAll(root);
for (const problem of problems) console.error(problem);
if (problems.length) {
  console.error(`check:secrets: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log(`check:secrets: ${scanned} files scanned, no admin-key material`);
