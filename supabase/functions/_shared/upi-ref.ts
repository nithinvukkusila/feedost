// R1-10 Part A criterion 13 and 41: the one UPI reference check. Pure: no imports, no DOM, no Deno. The submit-claim Edge Function
// and the parent's page (src/lib/claim/upi-ref.ts re-exports this file) run this same code, and the database repeats the check in
// submit_claim and in the table's check constraint, so the three cannot disagree. The cases it must pass live in upi-ref-vectors.json.
// Nothing here logs or stores anything.

/** What the person may type: more than this is refused before any work. */
export const REF_MAX_INPUT = 64;
/** The reference is exactly this many ASCII digits once spaces and hyphens are removed. */
export const REF_DIGITS = 12;

export type RefCheck = { ok: true; ref: string } | { ok: false; reason: "empty" | "bad" };

// [0-9], never \d or \p{Nd}: Devanagari, Kannada, Telugu and full-width digits are refused, as in the database.
const REF = /^[0-9]{12}$/;

/**
 * Removes spaces and hyphens (those two characters only), then accepts exactly 12 ASCII digits.
 * "empty" means nothing was typed (a screenshot may still be the proof); "bad" is anything else that is not a reference.
 */
export function normalizeRef(input: unknown): RefCheck {
  if (typeof input !== "string") return { ok: false, reason: "bad" };
  if (input.length > REF_MAX_INPUT) return { ok: false, reason: "bad" };
  const ref = input.replace(/[ -]/g, "");
  if (ref === "") return { ok: false, reason: "empty" };
  return REF.test(ref) ? { ok: true, ref } : { ok: false, reason: "bad" };
}
