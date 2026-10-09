// Node-only: parses src/styles/tokens.css into { name: value }.
// Used by the unit tests and by the dev page at build time, so there is no second copy of the tokens.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Tokens = Record<string, string>;

export const TOKENS_PATH = join(process.cwd(), "src", "styles", "tokens.css");

export function parseTokens(css: string): Tokens {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens: Tokens = {};
  for (const block of withoutComments.matchAll(/@theme[^{]*\{([^}]*)\}/g)) {
    for (const decl of block[1].matchAll(/(--[\w*-]+)\s*:\s*([^;]+);/g)) {
      tokens[decl[1]] = decl[2].trim();
    }
  }
  return tokens;
}

export function readTokens(path: string = TOKENS_PATH): Tokens {
  return parseTokens(readFileSync(path, "utf8"));
}

/** Tokens of one group with the prefix removed, without resets (`initial`) or sub-keys (`--text-sm--line-height`). */
export function group(tokens: Tokens, prefix: string): Tokens {
  const out: Tokens = {};
  for (const [name, value] of Object.entries(tokens)) {
    if (!name.startsWith(prefix)) continue;
    const key = name.slice(prefix.length);
    if (key === "*" || key.includes("--") || value === "initial") continue;
    out[key] = value;
  }
  return out;
}

/** Follows `var(--color-x)` references so a shadow or pair can be read as plain values. */
export function resolve(tokens: Tokens, value: string): string {
  return value.replace(/var\((--[\w-]+)\)/g, (whole, name: string) =>
    name in tokens ? resolve(tokens, tokens[name]) : whole,
  );
}
