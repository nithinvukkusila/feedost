// The fee reminder, as plain functions (spec R0-2, plan section 6): cleaning and checking what the
// tutor typed, the UPI link, the message and the WhatsApp link. No React, no DOM, no `Intl`, no
// storage. The preview, Copy and Send all read from `reminderParts`, so there is one place where a
// message is put together (criterion 36).
//
// Written for old Android WebViews and Safari: no lookbehind, no `toWellFormed`, no `Intl.Segmenter`.
import type { Locale } from "@/config/locales";
import { MAX_PAISE, MIN_PAISE, UPI_ID } from "@/lib/fields";
import { formatRupees } from "@/lib/format";
import templates from "./templates.json";

export type Tone = "polite" | "firm";

// The checks live in src/lib/fields.ts so the receipt maker can use them without the reminder templates.
export {
  APP_MAX_PAISE,
  MAX_PAISE,
  MIN_PAISE,
  NAME_MAX,
  PHONE_E164,
  UPI_ID,
  amountInput,
  checkAmount,
  checkName,
  checkUpiId,
  cleanName,
  waLink,
  whatsAppLink,
  type AmountError,
  type Checked,
  type NameError,
  type UpiIdError,
} from "@/lib/fields";

const isMonth = (month: number) => Number.isInteger(month) && month >= 0 && month <= 11;

/** The month's name in a language. `month` is 0 to 11. */
export function monthName(locale: Locale, month: number): string {
  if (!isMonth(month)) throw new RangeError(`monthName needs a month from 0 to 11; got ${String(month)}`);
  return templates[locale].months[month];
}

/** The month on the phone's clock, 0 to 11, in the phone's own time zone. */
export function currentMonth(now: Date = new Date()): number {
  return now.getMonth();
}

export type Kind = "month" | "balance";

/** Integer paise as `whole.cc`, by integer arithmetic only. */
function rupeesText(paise: number): string {
  return `${Math.trunc(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

/**
 * The payment link: exactly `pa`, `pn`, `am`, `cu`, `tn`, in that order, and nothing else. It pays
 * the given UPI ID directly. Throws on anything that has not been through the checks above, so a
 * malformed link can never be built. The note is English in every message language.
 *
 * The tool passes neither `maxPaise` nor `kind`: whole rupees from ₹1 to ₹1,00,000, a month note.
 * The app passes `maxPaise: APP_MAX_PAISE` (any integer paise from 1 up to it, written by integer
 * arithmetic) and, for an earlier balance, `kind: "balance"` (no month, note `Fee balance`).
 */
export function upiLink(input: { upiId: string; payeeName: string; paise: number; month: number | null; maxPaise?: number; kind?: Kind }): string {
  const { upiId, payeeName, paise, month, maxPaise, kind = "month" } = input;
  if (!UPI_ID.test(upiId)) throw new RangeError("upiLink needs a UPI ID that matches the pattern");
  if (payeeName === "") throw new RangeError("upiLink needs the payee's name");
  if (maxPaise === undefined) {
    if (!Number.isInteger(paise) || paise % 100 !== 0 || paise < MIN_PAISE || paise > MAX_PAISE) {
      throw new RangeError(`upiLink needs whole rupees from ₹1 to ₹1,00,000 in paise; got ${String(paise)}`);
    }
  } else if (!Number.isSafeInteger(paise) || paise < 1 || paise > maxPaise) {
    throw new RangeError(`upiLink needs paise from 1 to ${String(maxPaise)}; got ${String(paise)}`);
  }
  let note = "Fee balance";
  if (kind === "month") {
    if (month === null || !isMonth(month)) throw new RangeError(`upiLink needs a month from 0 to 11; got ${String(month)}`);
    note = `${templates.en.months[month]} fee`;
  }
  // `pa` is written as it is: the pattern admits nothing that needs encoding.
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${rupeesText(paise)}&cu=INR&tn=${encodeURIComponent(note)}`;
}

export type Slot = "parent" | "amount" | "month" | "link" | "upiId";
export type Part =
  | { kind: "text"; text: string }
  | { kind: "value"; slot: Slot; text: string }
  | { kind: "blank"; slot: Slot };

export type ReminderInput = {
  locale: Locale;
  tone: Tone;
  /** `null` means missing or not valid yet. */
  parent: string | null;
  paise: number | null;
  month: number | null;
  upiId: string | null;
  payeeName: string | null;
  /** The app only. Default `"month"`. `"balance"` needs `lines`. */
  kind?: Kind;
  /** The app only: the template's lines for `kind: "balance"` (the app's own file, so the tool page never loads it). */
  lines?: readonly string[];
  /** The app only: a higher ceiling for the UPI link, in paise. */
  maxPaise?: number;
  /** The app only: a ready-made `{link}` (the pay page, from R1-9). When set, no UPI link is built. */
  link?: string | null;
};

const PLACEHOLDERS = /(\{parent\}|\{amount\}|\{month\}|\{link\}|\{upiId\})/;

function fill(slot: Slot, input: ReminderInput): string | null {
  const { parent, paise, month, upiId, payeeName } = input;
  switch (slot) {
    case "parent":
      return parent;
    case "amount":
      return paise === null ? null : formatRupees(paise);
    case "month":
      return month === null ? null : monthName(input.locale, month);
    case "upiId":
      return upiId;
    case "link":
      if (input.link !== undefined && input.link !== null) return input.link;
      if (upiId === null || payeeName === null || paise === null) return null;
      if (input.kind === "balance") return upiLink({ upiId, payeeName, paise, month: null, kind: "balance", maxPaise: input.maxPaise });
      return month === null ? null : upiLink({ upiId, payeeName, paise, month, maxPaise: input.maxPaise });
  }
}

/**
 * The message as pieces, in order. The template is split on its five placeholders first and the
 * pieces are filled afterwards, so a typed value is never searched for a placeholder: a parent
 * named `{link}` or `$&` comes out as typed.
 */
export function reminderParts(input: ReminderInput): Part[] {
  let lines: readonly string[] = templates[input.locale][input.tone];
  if (input.kind === "balance") {
    if (input.lines === undefined) throw new RangeError("reminderParts needs the template lines for an earlier balance");
    lines = input.lines;
  }
  const template = lines.join("\n");
  const parts: Part[] = [];
  // Splitting on a pattern with one group puts the text at even places and the placeholders at odd ones.
  template.split(PLACEHOLDERS).forEach((piece, index) => {
    if (index % 2 === 0) {
      if (piece !== "") parts.push({ kind: "text", text: piece });
      return;
    }
    const slot = piece.slice(1, -1) as Slot;
    const text = fill(slot, input);
    parts.push(text === null ? { kind: "blank", slot } : { kind: "value", slot, text });
  });
  return parts;
}

/** The whole message, or `null` while any part is still blank. */
export function reminderText(parts: readonly Part[]): string | null {
  let out = "";
  for (const part of parts) {
    if (part.kind === "blank") return null;
    out += part.text;
  }
  return out;
}
