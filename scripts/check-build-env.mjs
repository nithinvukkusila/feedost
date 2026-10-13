// Stops a Vercel preview or production build that points at the wrong Supabase project, or holds
// the wrong kind of key.   node scripts/check-build-env.mjs
// Wired into `build` in F4b. Anywhere else (CI, a laptop) it prints one line and exits 0.
import { readFileSync } from "node:fs";
import { checkBuildEnv } from "./check-build-env-lib.mjs";

const environments = JSON.parse(readFileSync(new URL("../supabase/environments.json", import.meta.url), "utf8"));
const result = checkBuildEnv(process.env, environments);
if (result.skipped) {
  console.log(result.message);
} else if (result.problems.length > 0) {
  for (const problem of result.problems) console.error(`check-build-env: ${problem}`);
  console.error("check-build-env: the build was stopped before it could ship the wrong Supabase settings.");
  process.exit(1);
} else {
  for (const warning of result.warnings) console.warn(`check-build-env: !!! ${warning} !!!`);
  console.log("check-build-env: the Supabase settings match this environment");
}
