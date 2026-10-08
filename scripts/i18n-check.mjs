// Fails if any message key is missing from any language file.
import { readFileSync } from "node:fs";

const locales = ["en", "hi", "kn", "te"];

function keys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

const sets = Object.fromEntries(
  locales.map((l) => [l, new Set(keys(JSON.parse(readFileSync(`messages/${l}.json`, "utf8"))))]),
);
const all = new Set(locales.flatMap((l) => [...sets[l]]));
let missing = 0;
for (const key of [...all].sort()) {
  for (const l of locales) {
    if (!sets[l].has(key)) {
      console.error(`messages/${l}.json is missing "${key}"`);
      missing++;
    }
  }
}
if (missing) process.exit(1);
console.log(`i18n: ${all.size} keys present in all ${locales.length} languages`);
