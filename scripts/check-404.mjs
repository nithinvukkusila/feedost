// Fails when out/404.html is not the page src/app/global-not-found.tsx builds.   node scripts/check-404.mjs
// Run after `pnpm build`.
import { existsSync, readFileSync } from "node:fs";
import { check404 } from "./check-404-lib.mjs";

const file = "out/404.html";
if (!existsSync(file)) {
  console.error(`check-404: ${file} does not exist. Run pnpm build first.`);
  process.exit(1);
}
const problems = check404(readFileSync(file, "utf8"));
if (problems.length > 0) {
  for (const problem of problems) console.error(`check-404: ${problem}`);
  process.exit(1);
}
console.log("check-404: out/404.html has <html lang>, four language blocks and four links");
