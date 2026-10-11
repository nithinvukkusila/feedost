// R0-4: the one set of waitlist rules. Pure: no imports, no DOM, no Deno, so the page, the Edge Function and Node tests
// all run this same file. The cases it must pass live in waitlist-vectors.json.
// Nothing here logs or stores anything.

export const BANDS = [0, 10, 30, 60] as const;
export const LANGUAGES = ["en", "hi", "kn", "te"] as const;
export const NAME_MAX = 60;
export const CITY_MAX = 40;

export type Language = (typeof LANGUAGES)[number];

export type Checked<T> = { ok: true; value: T } | { ok: false };

export type WaitlistRow = {
  name: string;
  phone: string;
  city: string;
  students_count: (typeof BANDS)[number];
  language: Language;
};

const BAD: { ok: false } = { ok: false };

// Control characters (tab and newline too: these are single-line fields) and line or paragraph separators.
const CONTROL = /[\p{Cc}\p{Zl}\p{Zp}]/u;
// Runs of space-like characters, including the no-break space, become one plain space.
const SPACES = /\p{Zs}+/gu;

/** Trims and collapses spaces. Returns null for a non-string, a control character, or anything that looks like a tag. */
export function cleanText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (CONTROL.test(raw)) return null;
  if (raw.includes("<") || raw.includes(">")) return null;
  return raw.replace(SPACES, " ").trim();
}

function checkLength(raw: unknown, max: number): Checked<string> {
  const text = cleanText(raw);
  if (text === null) return BAD;
  const length = Array.from(text).length; // code points, as Postgres char_length counts them
  if (length < 1 || length > max) return BAD;
  return { ok: true, value: text };
}

export function checkName(raw: unknown): Checked<string> {
  return checkLength(raw, NAME_MAX);
}

export function checkCity(raw: unknown): Checked<string> {
  return checkLength(raw, CITY_MAX);
}

// Devanagari, Telugu and Kannada digits, each block starting at its zero.
const DIGIT_BLOCKS = [0x0966, 0x0c66, 0x0ce6];

function toAsciiDigits(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    const block = DIGIT_BLOCKS.find((zero) => code >= zero && code <= zero + 9);
    out += block === undefined ? ch : String(code - block);
  }
  return out;
}

/** An Indian mobile as +91XXXXXXXXXX, or null. Accepts 10 digits, 0 + 10, 91 + 10, +91 + 10, with spaces, dashes and brackets. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const stripped = toAsciiDigits(raw)
    // Format marks (the hidden left-to-right mark WhatsApp adds), every kind of space, dashes and brackets.
    .replace(/[\p{Cf}\p{Z}\p{Pd}()]/gu, "");
  const plus = stripped.startsWith("+");
  const digits = plus ? stripped.slice(1) : stripped;
  if (!/^[0-9]+$/.test(digits)) return null;

  let mobile: string;
  if (plus) {
    if (digits.length !== 12 || !digits.startsWith("91")) return null;
    mobile = digits.slice(2);
  } else if (digits.length === 10) {
    mobile = digits;
  } else if (digits.length === 11 && digits.startsWith("0")) {
    mobile = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    mobile = digits.slice(2);
  } else {
    return null;
  }
  return /^[6-9][0-9]{9}$/.test(mobile) ? `+91${mobile}` : null;
}

/** +919876543210 becomes "+91 98765 43210". Anything that is not that shape comes back unchanged. */
export function formatPhone(phone: string): string {
  const match = /^\+91([6-9][0-9]{4})([0-9]{5})$/.exec(phone);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
}

export function checkLanguage(raw: unknown): Checked<Language> {
  return typeof raw === "string" && (LANGUAGES as readonly string[]).includes(raw) ? { ok: true, value: raw as Language } : BAD;
}

export function checkStudents(raw: unknown): Checked<WaitlistRow["students_count"]> {
  return typeof raw === "number" && (BANDS as readonly number[]).includes(raw)
    ? { ok: true, value: raw as WaitlistRow["students_count"] }
    : BAD;
}

/**
 * Checks a parsed JSON body and returns only the five known fields, cleaned. Unknown fields are ignored.
 * Fields: name, phone, city, students_count (0, 10, 30 or 60), language (en, hi, kn, te).
 */
export function parseBody(input: unknown): Checked<WaitlistRow> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return BAD;
  const body = input as Record<string, unknown>;
  const name = checkName(body.name);
  const city = checkCity(body.city);
  const phone = normalizePhone(body.phone);
  const students = checkStudents(body.students_count);
  const language = checkLanguage(body.language);
  if (!name.ok || !city.ok || phone === null || !students.ok || !language.ok) return BAD;
  return {
    ok: true,
    value: { name: name.value, phone, city: city.value, students_count: students.value, language: language.value },
  };
}
