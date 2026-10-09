// Fails when a migration is badly named, edited, renamed, deleted or out of order, or when schema
// changes appear outside supabase/migrations/. Run from the repo root.
//   pnpm check:db [--base <ref>]     default base: origin/main
import { checkAll } from "./check-db-lib.mjs";

const flag = process.argv.indexOf("--base");
const base = flag > -1 ? process.argv[flag + 1] : "origin/main";
if (!base) {
  console.error("check:db: --base needs a git ref");
  process.exit(1);
}

const { problems, notes } = checkAll({ root: ".", base });
for (const note of notes) console.log(`check:db: ${note}`);
for (const problem of problems) console.error(problem);
if (problems.length) {
  console.error(`check:db: ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
  process.exit(1);
}
console.log(`check:db: migrations and schema rules hold against ${base}`);
