// The pay page's own logic, as plain functions with no React and no DOM (spec R1-9 Part B, criteria 23, 24, 37 to 39):
// which fees are late, the UPI note and the link, and what the Pay area shows. Integer arithmetic only. The phone's
// clock is never read: "today" is the India day the function returned.
import { formatDate } from "@/lib/format";
import type { FeePage, OpenDue, PayPageData } from "@/lib/pay-page-public";
import { buildUpiLink, PAY_PAGE_MAX_PAISE, UPI_ID } from "@/lib/upi-link";

/** The note is written in English in every language and holds no phone number and no amount. */
export const NOTE_MAX = 40;

/** Days since 1970-01-01 for a `YYYY-MM-DD` day, by integer arithmetic (days from civil), so no `Date` and no time zone. */
export function dayNumber(day: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) throw new RangeError(`dayNumber needs YYYY-MM-DD; got ${JSON.stringify(day)}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = Number(match[3]);
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yearOfEra = y - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + date - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

export type Lateness = "overdue" | "today" | "later";

/** Before today is overdue, today is due today, after is not late yet. Both are `YYYY-MM-DD`. */
export function lateness(today: string, dueDate: string): Lateness {
  const difference = dayNumber(dueDate) - dayNumber(today);
  if (difference < 0) return "overdue";
  return difference === 0 ? "today" : "later";
}

export type FeeLine = {
  /** An earlier balance: the words say "Earlier balance" and no date. */
  earlier: boolean;
  month: string | null;
  dueDate: string;
  late: Lateness;
  /** Integer paise still owed on this fee. */
  remaining: number;
  /** Integer paise already paid on it; 0 when none. */
  alreadyPaid: number;
};

export function feeLine(due: OpenDue, today: string): FeeLine {
  return {
    earlier: due.kind === "opening" || due.month === null,
    month: due.month,
    dueDate: due.dueDate,
    late: lateness(today, due.dueDate),
    remaining: due.remaining,
    alreadyPaid: due.amountPaid,
  };
}

/**
 * The UPI note `tn` (default 10): "Fee Oct 2026 Ravi". The student's first word is added only when it is plain Latin
 * letters (a name in Devanagari, Kannada or Telugu would be a transliteration guess). Several open fees say "Fees due";
 * an earlier balance alone says "Fee balance". At most 40 characters: the name is cut, never the head.
 */
export function upiNote(input: { openDues: readonly OpenDue[]; openDuesMore: number; studentName: string }): string {
  const { openDues, openDuesMore, studentName } = input;
  let head = "Fee";
  if (openDues.length > 1 || openDuesMore > 0) head = "Fees due";
  else if (openDues.length === 1) head = openDues[0].month === null ? "Fee balance" : `Fee ${formatDate(openDues[0].month).slice(3)}`;
  const first = studentName.trim().split(/\s+/)[0] ?? "";
  if (!/^[A-Za-z]+$/.test(first)) return head;
  return `${head} ${first}`.slice(0, NOTE_MAX).trimEnd();
}

/** The name for `pn`: the tutor's name, or the part of the UPI ID before the `@` when there is none. Lone surrogates are dropped (they break URL encoding). */
export function payeeName(tutorName: string | null, upiId: string): string {
  const own = Array.from(tutorName ?? "")
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return !(code >= 0xd800 && code <= 0xdfff) && code > 0x1f && !(code >= 0x7f && code <= 0x9f);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return own !== "" ? own : upiId.split("@")[0];
}

export type PayArea =
  /** Nothing is owed: the all paid state, with no Pay, Copy or QR. */
  | { kind: "nothing" }
  /** No usable UPI ID: say so; no Pay, Copy or QR. */
  | { kind: "no-upi" }
  /** Above the app's ceiling: show the plain UPI ID to pay to; no button. */
  | { kind: "too-big"; upiId: string }
  /** The Pay button. */
  | { kind: "pay"; upiId: string; href: string };

/**
 * Whether the "I've paid" button is drawn (R1-10 criterion 30): only after consent, only when something is owed, and
 * only while no claim is waiting (criterion 38 draws the pending note in its place). The one place this rule lives.
 */
export function claimButtonVisible(page: PayPageData): boolean {
  return !page.consentNeeded && page.totalRemaining > 0 && page.pendingClaim === null;
}

/** What the Pay area of a fee page shows (criterion 24). The link is built here, on the parent's phone, by the one shared builder. */
export function payArea(page: FeePage): PayArea {
  if (page.totalRemaining === 0) return { kind: "nothing" };
  const upiId = page.upiId;
  if (upiId === null || !UPI_ID.test(upiId)) return { kind: "no-upi" };
  if (page.totalRemaining > PAY_PAGE_MAX_PAISE) return { kind: "too-big", upiId };
  try {
    const href = buildUpiLink({
      upiId,
      payeeName: payeeName(page.tutorName, upiId),
      paise: page.totalRemaining,
      note: upiNote(page),
      maxPaise: PAY_PAGE_MAX_PAISE,
    });
    return { kind: "pay", upiId, href };
  } catch {
    return { kind: "no-upi" };
  }
}
