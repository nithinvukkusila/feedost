// A parent's phone number as the tutor types it, and as it is stored. Pure: no React, no network.
//
// Stored form: `+91` and ten digits, or null when there is no number. The database checks only that
// shape; the first-digit rule (6 to 9) is the app's, because a landline cannot receive WhatsApp.

/** Devanagari, Kannada and Telugu digits to 0-9. Anything else is left as it is. */
const INDIC_DIGITS: Record<string, string> = {};
for (const zero of [0x0966, 0x0ce6, 0x0c66]) {
  for (let n = 0; n < 10; n++) INDIC_DIGITS[String.fromCodePoint(zero + n)] = String(n);
}

/** The same text with every Devanagari, Kannada or Telugu digit written as 0 to 9. */
export function latinDigits(text: string): string {
  return text.replace(/[०-९೦-೯౦-౯]/g, (digit) => INDIC_DIGITS[digit] ?? digit);
}

/** Only the digits of a text, as 0 to 9, whatever script they were typed in. */
export function digitsOf(text: string): string {
  return latinDigits(text).replace(/\D/g, "");
}

export type PhoneError = "short" | "long" | "start" | "chars";
export type PhoneCheck = { ok: true; value: string | null } | { ok: false; error: PhoneError; count: number };

// What may sit between the digits of a number: white space, dashes of any kind, dots and brackets.
const SEPARATORS = /[\s.()\p{Pd}]/gu;

/**
 * What the tutor typed to what is stored. Empty is fine and gives null. Takes `+91`, `91` (twelve digits)
 * and `0` (eleven digits) off the front. Refuses, with the number of digits typed for the two length
 * errors: not ten digits, a first digit of 0 to 5, a country code other than 91, anything but digits.
 */
export function normalizePhone(text: string): PhoneCheck {
  const typed = latinDigits(text).trim();
  if (typed === "") return { ok: true, value: null };
  const plus = typed.startsWith("+");
  const body = (plus ? typed.slice(1) : typed).replace(SEPARATORS, "");
  if (!/^\d*$/.test(body)) return { ok: false, error: "chars", count: 0 };

  let national = body;
  if (plus) {
    if (body === "") return { ok: false, error: "short", count: 0 };
    // Only India's country code is taken in R1.
    if (!body.startsWith("91")) return { ok: false, error: "start", count: body.length };
    national = body.slice(2);
  } else if (body.length === 12 && body.startsWith("91")) {
    national = body.slice(2);
  } else if (body.length === 11 && body.startsWith("0")) {
    national = body.slice(1);
  }

  if (national.length < 10) return { ok: false, error: "short", count: national.length };
  if (national.length > 10) return { ok: false, error: "long", count: national.length };
  if (!/^[6-9]/.test(national)) return { ok: false, error: "start", count: 10 };
  return { ok: true, value: `+91${national}` };
}

/** `+919886044321` to `98860 44321`, what the field shows after the tutor leaves it. */
export function tidyPhone(value: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(value);
  return match ? `${match[1]} ${match[2]}` : value;
}

/** What the field shows after the tutor leaves it: the tidy form when the text is a good number, else exactly what was typed. */
export function tidyTyped(text: string): string {
  const check = normalizePhone(text);
  return check.ok && check.value !== null ? tidyPhone(check.value) : text;
}

/** The ten digits of a stored number, without the country code. A stored null is the empty text. */
export function nationalDigits(value: string | null): string {
  return value === null ? "" : value.replace(/^\+91/, "");
}
