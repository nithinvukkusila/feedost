// The claim sheet's own logic (spec R1-10 Part C, criteria 31 and 32), as plain functions with no React and no DOM:
// how the typed reference is shown (grouped in fours, spaces and hyphens ignored), where the caret goes after the
// field is redrawn, and what the sheet's header names. Whether a reference is acceptable is not decided here: that is
// `normalizeRef` in src/lib/claim/upi-ref.ts, the one check the page and the function share.
import type { FeePage } from "@/lib/pay-page-public";
import { REF_MAX_INPUT } from "@/lib/claim/upi-ref";

// The two characters a parent may type or paste between the digits; the shared check removes exactly these.
const SEPARATORS = /[ -]/g;
const ALL_DIGITS = /^[0-9]+$/;

/** What is typed, without spaces and hyphens, and never longer than the shared check would look at. */
export function keptOf(typed: string): string {
  return typed.replace(SEPARATORS, "").slice(0, REF_MAX_INPUT);
}

/**
 * What the field shows for what was typed: ASCII digits grouped in fours (`6281 0473 9915`, and `6281 04` while
 * typing); anything else (a letter, a Devanagari digit) as typed without the separators, so Send can say what is wrong.
 */
export function refShown(typed: string): string {
  const kept = keptOf(typed);
  if (!ALL_DIGITS.test(kept)) return kept;
  return (kept.match(/.{1,4}/g) ?? []).join(" ");
}

/** How many characters that are not separators come before `caret` in `typed`. */
export function keptBefore(typed: string, caret: number): number {
  return keptOf(typed.slice(0, Math.max(0, caret))).length;
}

/** The caret position in `shown` just after its first `count` characters that are not separators. */
export function caretAfter(shown: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < shown.length; index += 1) {
    if (shown[index] !== " " && shown[index] !== "-") seen += 1;
    if (seen === count) return index + 1;
  }
  return shown.length;
}

/** What the claim is for, as the sheet's header names it: one month, an earlier balance, or all open fees. */
export type ClaimFor = { kind: "month"; month: string } | { kind: "earlier" } | { kind: "all" };

/** The claim is for the total the page shows (R1-10 default 2), so more than one open fee is "all open fees". */
export function claimFor(page: Pick<FeePage, "openDues" | "openDuesMore">): ClaimFor {
  if (page.openDues.length !== 1 || page.openDuesMore > 0) return { kind: "all" };
  const only = page.openDues[0];
  return only.kind === "opening" || only.month === null ? { kind: "earlier" } : { kind: "month", month: only.month };
}
