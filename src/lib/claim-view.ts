// What the claims inbox works out for its cards (spec R1-10, criteria 18, 19 and 25): the reference in groups
// of four, when a claim was sent in India time, which fee a card is for, and the receipt numbers of a
// Confirm. Pure: no React, no network, no `Date` object, no `Intl`, no local-time getter. The words are
// the screen's; this only says which words and which numbers.
import type { Claim } from "./claims";
import type { Due } from "./dues";
import { indiaToday, shiftDay } from "./dues-board";

const DAY_MS = 86_400_000;
const INDIA_OFFSET_MS = 19_800_000;

/** `628104739915` to `6281 0473 9915`. Anything that is not 12 digits comes back unchanged. */
export function groupRef(ref: string): string {
  return /^[0-9]{12}$/.test(ref) ? `${ref.slice(0, 4)} ${ref.slice(4, 8)} ${ref.slice(8)}` : ref;
}

export type When = {
  /** Today, yesterday, or an older day (then `day` is written as a date). */
  when: "today" | "yesterday" | "date";
  /** The India day, `YYYY-MM-DD`. */
  day: string;
  /** `4:12 pm`: a 12-hour clock, no leading zero. The same in every language, like the digits of an amount. */
  clock: string;
};

/** When a claim was sent, in India, against the current instant. */
export function whenOf(createdAtMs: number, nowMs: number): When {
  const day = indiaToday(createdAtMs);
  const today = indiaToday(nowMs);
  const into = (((createdAtMs + INDIA_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  const minutes = Math.floor(into / 60_000);
  const hour = Math.floor(minutes / 60);
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return {
    when: day === today ? "today" : day === shiftDay(today, -1) ? "yesterday" : "date",
    day,
    clock: `${hour12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "pm" : "am"}`,
  };
}

export type FeeLabel = { kind: "month"; month: string } | { kind: "earlier" } | { kind: "fees"; n: number } | null;

/** Which fee a card is for: its month, "Earlier balance", or "{n} fees" when the claim spans more than one. Null when the fee is not known. */
export function feeLabel(claim: Claim, due: Due | undefined): FeeLabel {
  if (claim.feeCount > 1) return { kind: "fees", n: claim.feeCount };
  if (due === undefined) return null;
  return due.kind === "opening" || due.month === null ? { kind: "earlier" } : { kind: "month", month: due.month };
}

/** The receipt number to show for a confirmed claim, and how many more it made. Null when the claim is not confirmed. */
export function receiptsOf(claim: Claim): { first: number; more: number } | null {
  if (claim.status !== "confirmed" || claim.receiptFrom === null || claim.receiptCount === null) return null;
  return { first: claim.receiptFrom, more: claim.receiptCount - 1 };
}
