// The build guard's rules (F4 criterion 32). A pure function of an environment object, so tests can
// feed it any Vercel setup. It never puts a value in a message: only the variable's name and the rule.
// Not wired into `pnpm build` until F4b, after the Vercel variables exist and the refs are recorded.
import { checkKeyShape } from "./smoke-env-lib.mjs";

const REF = /^[a-z0-9]{20}$/;
const URL_NAME = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_NAME = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
/** Vercel's environment name -> the entry in supabase/environments.json that it must talk to. */
const TARGETS = { preview: "staging", production: "production" };
/**
 * Temporary exception (2026-10-14, founder-approved). While no production project exists, a Production-scope
 * build may point at the STAGING project, but only if this variable is exactly "1". It stops applying by itself
 * the moment a production ref is recorded. Remove it at real launch (docs/ENVIRONMENTS.md).
 */
export const STAGING_AS_PRODUCTION = "FEEDOST_STAGING_AS_PRODUCTION";

/** True only on a Vercel preview or production build. CI sets VERCEL_ENV but not VERCEL, so it is skipped. */
export function guardApplies(env) {
  return env.VERCEL === "1" && Object.hasOwn(TARGETS, env.VERCEL_ENV ?? "");
}

/** The ref in https://<ref>.supabase.co, or a problem. */
function refOfUrl(raw) {
  if (!raw) return { problem: `${URL_NAME} is missing` };
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { problem: `${URL_NAME} is not a web address` };
  }
  if (url.protocol !== "https:") return { problem: `${URL_NAME} must start with https://` };
  const match = /^([^.]+)\.supabase\.co$/.exec(url.hostname);
  if (!match) return { problem: `${URL_NAME} must be https://<project-ref>.supabase.co (localhost and other hosts are not allowed)` };
  if (!REF.test(match[1])) return { problem: `${URL_NAME} does not hold a 20-character project ref` };
  return { ref: match[1] };
}

/**
 * @param {Record<string, string | undefined>} env the build's environment
 * @param {{ staging?: { ref?: string | null }, production?: { ref?: string | null } }} environments supabase/environments.json
 * @returns {{ skipped: true, message: string } | { skipped: false, problems: string[], warnings: string[] }}
 */
export function checkBuildEnv(env, environments) {
  if (!guardApplies(env)) return { skipped: true, message: "build guard skipped: not a Vercel build" };
  const problems = [];
  const warnings = [];
  let target = TARGETS[env.VERCEL_ENV];
  // The exception: production build, no production ref recorded, variable is exactly "1".
  const prodRef = environments?.production?.ref;
  const stagingAsProduction =
    target === "production" && env[STAGING_AS_PRODUCTION] === "1" && (prodRef === null || prodRef === undefined || prodRef === "");
  if (stagingAsProduction) target = "staging";

  const { ref, problem } = refOfUrl(env[URL_NAME]);
  if (problem) problems.push(problem);

  const key = env[KEY_NAME];
  if (!key) {
    problems.push(`${KEY_NAME} is missing`);
  } else {
    // The key is checked against the URL's ref only when the URL itself is usable.
    const keyProblem = checkKeyShape(key, ref ? `https://${ref}.supabase.co` : "https://x.supabase.co");
    if (keyProblem) problems.push(`${KEY_NAME}: ${keyProblem.replace(/^the anon key /, "")}`);
  }

  const recorded = environments?.[target]?.ref;
  const other = environments?.[target === "staging" ? "production" : "staging"]?.ref;
  if (recorded === null || recorded === undefined || recorded === "") {
    problems.push(`no project ref is recorded for ${target} in supabase/environments.json: record the project ref first`);
  } else if (!REF.test(recorded)) {
    problems.push(`the ${target} ref in supabase/environments.json is not a 20-character project ref`);
  } else if (ref && ref !== recorded) {
    problems.push(`${URL_NAME} is not the ${target} project recorded in supabase/environments.json (a ${env.VERCEL_ENV} build must use ${stagingAsProduction ? "staging, as the exception allows" : target})`);
  }
  if (recorded && other && recorded === other) {
    problems.push("staging and production have the same ref in supabase/environments.json: they must differ");
  }

  for (const name of Object.keys(env)) {
    if (/^NEXT_PUBLIC_.*(SERVICE|SECRET|PASSWORD)/i.test(name)) {
      problems.push(`${name} must not exist: a NEXT_PUBLIC_ variable is shipped to every browser`);
    }
  }
  if (stagingAsProduction && problems.length === 0) {
    warnings.push(
      `WARNING: ${STAGING_AS_PRODUCTION}=1: this PRODUCTION build uses the STAGING Supabase project. ` +
        "It is for made-up data only and must not be given to real tutors. Remove the variable when the production project exists.",
    );
  }
  return { skipped: false, problems, warnings };
}
