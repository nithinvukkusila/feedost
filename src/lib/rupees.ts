// Whole rupees as the tutor types them, to integer paise. Pure, and integer math only: the digits are
// read as text, so no float ever holds an amount. Display is `formatRupees` in ./format.ts.
import { formatRupees } from "./format";
import { latinDigits } from "./phone";

export type RupeesError = "missing" | "zero" | "decimal" | "big" | "chars";
export type RupeesCheck = { ok: true; paise: number } | { ok: false; error: RupeesError };

/** `min` and `max` are whole rupees. */
export type RupeesLimits = { min: number; max: number };

/**
 * Accepts digits (any of the four scripts), commas, spaces, a leading ₹, and a trailing ".0" or ".00".
 * `1,200` and `₹ 1 200.00` are 120000 paise. `12.5` is refused as decimal, `-5` and `abc` as chars,
 * empty as missing, an amount under `min` as zero (the only low case is 0 where `min` is 1) and over `max` as big.
 */
export function parseRupees(text: string, { min, max }: RupeesLimits): RupeesCheck {
  let value = latinDigits(text).trim();
  if (value.startsWith("₹")) value = value.slice(1);
  value = value.replace(/[,\s]/g, "");
  if (value === "") return { ok: false, error: "missing" };
  value = value.replace(/\.0{1,2}$/, "");
  if (/^\d+\.\d*$/.test(value)) return { ok: false, error: "decimal" };
  if (!/^\d+$/.test(value)) return { ok: false, error: "chars" };
  const digits = value.replace(/^0+(?=\d)/, "");
  // More than a trillion is far past any limit, and keeps Number() exact.
  if (digits.length > 12) return { ok: false, error: "big" };
  const rupees = Number(digits);
  if (rupees < min) return { ok: false, error: "zero" };
  if (rupees > max) return { ok: false, error: "big" };
  return { ok: true, paise: rupees * 100 };
}

/** Paise to `1,00,000`, what an amount field shows after the tutor leaves it. The ₹ is the field's label. */
export function groupRupees(paise: number): string {
  return formatRupees(paise).replace("₹", "");
}

/** The text an amount field starts with for a stored amount: grouped, or empty for 0 when `blankZero`. */
export function rupeesText(paise: number, blankZero = false): string {
  return blankZero && paise === 0 ? "" : groupRupees(paise);
}

/** What the field shows after the tutor leaves it: grouped when the text is an amount, else exactly what was typed. */
export function tidyRupees(text: string, limits: RupeesLimits): string {
  const check = parseRupees(text, limits);
  return check.ok ? groupRupees(check.paise) : text;
}
