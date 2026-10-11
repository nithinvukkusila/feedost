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
  MAX_PAISE,
  MIN_PAISE,
  NAME_MAX,
  UPI_ID,
  amountInput,
  checkAmount,
  checkName,
  checkUpiId,
  cleanName,
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

/**
 * The payment link: exactly `pa`, `pn`, `am`, `cu`, `tn`, in that order, and nothing else. It pays
 * the given UPI ID directly. Throws on anything that has not been through the checks above, so a
 * malformed link can never be built. The note is English in every message language.
 */
export function upiLink(input: { upiId: string; payeeName: string; paise: number; month: number }): string {
  const { upiId, payeeName, paise, month } = input;
  if (!UPI_ID.test(upiId)) throw new RangeError("upiLink needs a UPI ID that matches the pattern");
  if (payeeName === "") throw new RangeError("upiLink needs the payee's name");
  if (!Number.isInteger(paise) || paise % 100 !== 0 || paise < MIN_PAISE || paise > MAX_PAISE) {
    throw new RangeError(`upiLink needs whole rupees from ₹1 to ₹1,00,000 in paise; got ${String(paise)}`);
  }
  if (!isMonth(month)) throw new RangeError(`upiLink needs a month from 0 to 11; got ${String(month)}`);
  const note = `${templates.en.months[month]} fee`;
  // `pa` is written as it is: the pattern admits nothing that needs encoding.
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${paise / 100}.00&cu=INR&tn=${encodeURIComponent(note)}`;
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
      return upiId === null || payeeName === null || paise === null || month === null
        ? null
        : upiLink({ upiId, payeeName, paise, month });
  }
}

/**
 * The message as pieces, in order. The template is split on its five placeholders first and the
 * pieces are filled afterwards, so a typed value is never searched for a placeholder: a parent
 * named `{link}` or `$&` comes out as typed.
 */
export function reminderParts(input: ReminderInput): Part[] {
  const template = templates[input.locale][input.tone].join("\n");
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
