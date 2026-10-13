// The fee reminder, as plain functions (spec R0-2, plan section 6): cleaning and checking what the
// tutor typed, the UPI link, the message and the WhatsApp link. No React, no DOM, no `Intl`, no
// storage. The preview, Copy and Send all read from `reminderParts`, so there is one place where a
// message is put together (criterion 36).
//
// Written for old Android WebViews and Safari: no lookbehind, no `toWellFormed`, no `Intl.Segmenter`.
import type { Locale } from "@/config/locales";
import { formatRupees } from "@/lib/format";
import { buildUpiLink, UPI_ID } from "@/lib/upi-link";
import templates from "./templates.json";

export type Tone = "polite" | "firm";
export const NAME_MAX = 40;
export const MIN_PAISE = 100; // ₹1
export const MAX_PAISE = 10_000_000; // ₹1,00,000, the free tool's ceiling
/** The largest fee the app allows (₹10,00,000). Only the app path passes it; the tool never does. */
export const APP_MAX_PAISE = 100_000_000;
/** A saved parent phone: `+91` and ten digits. Kept equal to the copy in `reminder-rules.ts` by a test. */
export const PHONE_E164 = /^\+91[0-9]{10}$/;
// The PRD pattern lives with the link builder (src/lib/upi-link.ts); re-exported so every import stays.
export { UPI_ID };

export type Checked<V, E extends string> = { ok: true; value: V } | { ok: false; error: E };
export type NameError = "missing" | "tooLong";
export type AmountError = "missing" | "paise" | "notDigits" | "tooLow" | "tooHigh";
export type UpiIdError = "missing" | "space" | "noAt" | "format";

const WHITE_SPACE = /\s/;

/**
 * A name as it is used: white space of any kind becomes one space, control characters and broken
 * half-characters (lone surrogates) are dropped, the ends are trimmed. A lone surrogate must go:
 * `encodeURIComponent` throws on one, and that would break Send.
 */
export function cleanName(raw: string): string {
  let out = "";
  // A string iterates by code point; a surrogate with no partner comes out alone.
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    if (WHITE_SPACE.test(char)) out += " ";
    else if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) continue;
    else if (code >= 0xd800 && code <= 0xdfff) continue;
    // Invisible direction marks and zero-width characters: a pasted one can turn the greeting round or
    // make an empty name look filled in. The joiners U+200C and U+200D stay; Indian scripts need them.
    else if ((code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)) continue;
    else if (code === 0x200b || code === 0x200e || code === 0x200f || code === 0xfeff) continue;
    else out += char;
  }
  out = out.replace(/ +/g, " ").trim();
  // Joiners alone draw nothing: that is not a name.
  return /[^\u200c\u200d ]/.test(out) ? out : "";
}

/** The parent's name and "Your name": 1 to 40 characters after cleaning, counted in code points. */
export function checkName(raw: string): Checked<string, NameError> {
  const value = cleanName(raw);
  if (value === "") return { ok: false, error: "missing" };
  if (Array.from(value).length > NAME_MAX) return { ok: false, error: "tooLong" };
  return { ok: true, value };
}

// The first digit of Devanagari, Kannada and Telugu; each script's ten digits are in a row.
const SCRIPT_ZEROS = [0x0966, 0x0ce6, 0x0c66];

function asciiDigits(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const zero = SCRIPT_ZEROS.find((start) => code >= start && code <= start + 9);
    out += zero === undefined ? char : String(code - zero);
  }
  return out;
}

/** Whole rupees, ₹1 to ₹1,00,000. The value is integer paise. */
export function checkAmount(raw: string): Checked<number, AmountError> {
  const text = asciiDigits(raw).replace(/[\s,₹]/g, "");
  if (text === "") return { ok: false, error: "missing" };
  if (/^[\d.]+$/.test(text) && text.includes(".")) return { ok: false, error: "paise" };
  if (!/^\d+$/.test(text)) return { ok: false, error: "notDigits" };
  const digits = text.replace(/^0+/, "");
  // Seven digits is already over the limit, and a 20-digit paste never reaches Number.
  if (digits.length > 7) return { ok: false, error: "tooHigh" };
  const paise = Number(digits === "" ? "0" : digits) * 100;
  if (paise < MIN_PAISE) return { ok: false, error: "tooLow" };
  if (paise > MAX_PAISE) return { ok: false, error: "tooHigh" };
  return { ok: true, value: paise };
}

/** Trimmed, then the PRD pattern. Letter case is kept as typed. */
export function checkUpiId(raw: string): Checked<string, UpiIdError> {
  const value = raw.trim();
  if (value === "") return { ok: false, error: "missing" };
  if (WHITE_SPACE.test(value)) return { ok: false, error: "space" };
  if (!value.includes("@")) return { ok: false, error: "noAt" };
  if (!UPI_ID.test(value)) return { ok: false, error: "format" };
  return { ok: true, value };
}

/** What the amount field shows after it loses focus: `1,200`, with 0-9 digits and Indian grouping. */
export function amountInput(paise: number): string {
  return formatRupees(paise).slice(1);
}

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
  // The tool's whole-rupee rule; the builder checks the UPI ID, the name and the range (the app's too).
  if (maxPaise === undefined && (!Number.isInteger(paise) || paise % 100 !== 0 || paise < MIN_PAISE || paise > MAX_PAISE)) {
    throw new RangeError(`upiLink needs whole rupees from ₹1 to ₹1,00,000 in paise; got ${String(paise)}`);
  }
  let note = "Fee balance";
  if (kind === "month") {
    if (month === null || !isMonth(month)) throw new RangeError(`upiLink needs a month from 0 to 11; got ${String(month)}`);
    note = `${templates.en.months[month]} fee`;
  }
  return buildUpiLink({ upiId, payeeName, paise, note, maxPaise: maxPaise ?? MAX_PAISE });
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

/** No phone number: WhatsApp asks who to send to. The link inside is encoded a second time, which is right. */
export function whatsAppLink(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * The link that opens WhatsApp on the parent's number: `https://wa.me/91XXXXXXXXXX?text=`. The stored
 * phone is `+91` and ten digits; the `+` is dropped and nothing else is added. Anything else throws.
 */
export function waLink(e164: string, text: string): string {
  if (!PHONE_E164.test(e164)) throw new RangeError("waLink needs a phone as +91 and ten digits");
  return `https://wa.me/${e164.slice(1)}?text=${encodeURIComponent(text)}`;
}
