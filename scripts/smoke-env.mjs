// Asks an environment's health function which environment it is, and fails if that is not the one
// asked for.   pnpm smoke:env <local|staging|production>   or   --url <url> --expect <env>
import { readFileSync } from "node:fs";
import { resolveTarget, smoke } from "./smoke-env-lib.mjs";

let target;
try {
  const environments = JSON.parse(readFileSync(new URL("../supabase/environments.json", import.meta.url), "utf8"));
  target = resolveTarget(process.argv.slice(2), environments);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const result = await smoke({ ...target, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
if (!result.ok) {
  console.error(result.message);
  process.exit(1);
}
console.log(result.message);
