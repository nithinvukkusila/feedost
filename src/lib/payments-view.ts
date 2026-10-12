// What the Mark paid sheet and the receipt screen work out (spec R1-7, criteria 12 to 14, 18, 22): the
// chip amounts, the amount check, the paid-on date choices and their limits, the 24-hour undo window and
// the India clock time. Pure: no React, no network, no `Date` object, no `Intl`. Days are `YYYY-MM-DD`
// text, as in dues-board.ts, and money stays integer paise until `formatRupees`.
import type { Due, DueStatus } from "./dues";
import { shiftDay } from "./dues-board";
import { parseRupees } from "./rupees";

/** The farthest back a payment may be dated, in days (the database refuses more). */
export const BACK_DAYS = 90;

/** How long a payment can be undone, in milliseconds (the database refuses after this). */
export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

/** How long the banner after a payment stays. */
export const BANNER_MS = 10_000;

const DAY_MS = 86_400_000;
const INDIA_OFFSET_MS = 19_800_000;
const pad = (n: number) => String(n).padStart(2, "0");

export type AmountError = "missing" | "zero" | "decimal" | "chars" | "over";
export type AmountCheck = { ok: true; paise: number } | { ok: false; error: AmountError };

/**
 * The amount the tutor typed against what is left on the fee. At least ₹1 and at most `remaining`
 * (both whole rupees; money stays integer paise). Indian commas and the digits of any of the four scripts are accepted.
 */
export function validateAmount(text: string, remaining: number): AmountCheck {
  const check = parseRupees(text, { min: 1, max: Math.floor(remaining / 100) });
  if (check.ok) return check;
  return { ok: false, error: check.error === "big" ? "over" : check.error };
}

/** The two amounts the chips set: all that is left, and half of it rounded down to a whole rupee. `half` is null when it would be under ₹1. */
export function chipAmounts(remaining: number): { full: number; half: number | null } {
  const half = Math.floor(remaining / 200) * 100;
  return { full: remaining, half: half >= 100 ? half : null };
}

export type Chip = "full" | "half" | "other";

/** Which chip the typed text matches: the full amount, half, or anything else. */
export function chipOf(text: string, remaining: number): Chip {
  const check = validateAmount(text, remaining);
  if (!check.ok) return "other";
  const { full, half } = chipAmounts(remaining);
  return check.paise === full ? "full" : check.paise === half ? "half" : "other";
}

export type DateChoice = "today" | "yesterday" | "pick";
export type DayError = "missing" | "future" | "old";
export type DayCheck = { ok: true; day: string } | { ok: false; error: DayError };

/** The earliest and latest day a payment may be dated, given today in India. */
export function dayBounds(today: string): { min: string; max: string } {
  return { min: shiftDay(today, -BACK_DAYS), max: today };
}

/** The day a choice means. `picked` is the text of the date input (`YYYY-MM-DD`, or empty). */
export function chosenDay(choice: DateChoice, picked: string, today: string): string {
  if (choice === "today") return today;
  if (choice === "yesterday") return shiftDay(today, -1);
  return picked;
}

/** Whether the day is a real day, not after today and not more than 90 days back. */
export function checkDay(day: string, today: string): DayCheck {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "missing" };
  const { min, max } = dayBounds(today);
  if (day > max) return { ok: false, error: "future" };
  if (day < min) return { ok: false, error: "old" };
  return { ok: true, day };
}

/** True while a payment recorded at `createdAtMs` can still be undone: up to and including 24 hours. */
export function undoOpen(createdAtMs: number, nowMs: number): boolean {
  return nowMs - createdAtMs <= UNDO_WINDOW_MS;
}

/** `HH:MM` in India (24-hour) for an instant in milliseconds since 1970. */
export function indiaClock(ms: number): string {
  const into = (((ms + INDIA_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS;
  const minutes = Math.floor(into / 60_000);
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** The status a fee has when `amountPaid` of it is paid. */
export function statusFor(amount: number, amountPaid: number): DueStatus {
  return amountPaid <= 0 ? "due" : amountPaid >= amount ? "paid" : "partial";
}

/** A due with `amountPaid` paid, its status following. */
export function withPaid(due: Due, amountPaid: number): Due {
  const paid = Math.min(Math.max(amountPaid, 0), due.amount);
  return { ...due, amountPaid: paid, status: statusFor(due.amount, paid) };
}
