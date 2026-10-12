// Checks on what a tutor types, shared by the free tools (fee reminder, fee receipt): cleaning and
// checking a name and an amount. Pure: no React, no DOM, no storage, and no message templates, so a
// page that imports this carries nothing of another tool's wording (scripts/check-locale-leak.mjs).
import { formatRupees } from "@/lib/format";

export const NAME_MAX = 40;
export const MIN_PAISE = 100; // ₹1
export const MAX_PAISE = 10_000_000; // ₹1,00,000, the free tool's ceiling
/** The largest fee the app allows (₹10,00,000). Only the app path passes it; the tools never do. */
export const APP_MAX_PAISE = 100_000_000;
/** A saved parent phone: `+91` and ten digits. Kept equal to the copy in `reminder-rules.ts` by a test. */
export const PHONE_E164 = /^\+91[0-9]{10}$/;
/** The PRD pattern, exactly, with no flags. */
export const UPI_ID = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

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
