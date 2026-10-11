// Checks the student form (spec R1-3, criteria 18 to 24 and 33). Pure: no React, no network.
// Every error is a pair of message keys, a short tag and a sentence, so a screen shows words and
// never a code. The clean result is what students.ts sends.
import type { Locale } from "@/config/locales";
import { normalizePhone, type PhoneError } from "./phone";
import { normalizeName, tidy } from "./profile";
import { parseRupees, type RupeesError, type RupeesLimits } from "./rupees";
import type { Student, StudentFields } from "./students";

/** The most a fee or an opening balance may be: ₹10,00,000, in whole rupees. */
export const MAX_RUPEES = 1_000_000;
export const FEE_LIMITS: RupeesLimits = { min: 1, max: MAX_RUPEES };
export const OWES_LIMITS: RupeesLimits = { min: 0, max: MAX_RUPEES };
export const DUE_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

/** What the form holds while it is being filled: text as typed, plus the picks. */
export type StudentDraft = {
  name: string;
  parentName: string;
  phone: string;
  parentLanguage: Locale;
  /** A batch id, or "" for no batch. */
  batchId: string;
  dueDay: number;
  fee: string;
  owes: string;
  permission: boolean;
};

export type FieldName = "name" | "parentName" | "phone" | "fee" | "owes" | "permission";
/** The order the fields sit on the screen: the first one with an error is focused. */
export const FIELD_ORDER: readonly FieldName[] = ["name", "parentName", "phone", "fee", "owes", "permission"];

/** Keys under `students.state` (the tag beside the label) and `students.err` (the sentence beneath). */
export type StateKey = "missing" | "tooLong" | "tooShort" | "checkNumber" | "checkAmount" | "wholeRupees" | "tooBig";
export type ErrKey =
  | "nameMissing"
  | "nameLong"
  | "parentLong"
  | "phoneShort"
  | "phoneLong"
  | "phoneStart"
  | "phoneChars"
  | "feeMissing"
  | "feeZero"
  | "feeDecimal"
  | "feeBig"
  | "feeChars"
  | "owesDecimal"
  | "owesBig"
  | "owesChars"
  | "permissionNeeded";

export type FieldError = { tag: StateKey; message: ErrKey; /** For a message that says a count. */ count?: number };
export type FieldErrors = Partial<Record<FieldName, FieldError>>;

export type FormContext = {
  /** The student's phone as saved, when editing. A permission tick is asked for only when the phone is new or changed. */
  savedPhone?: string | null;
};

export type FormCheck = { ok: true; fields: StudentFields } | { ok: false; errors: FieldErrors };

const phoneErrors: Record<PhoneError, FieldError> = {
  short: { tag: "tooShort", message: "phoneShort" },
  long: { tag: "tooLong", message: "phoneLong" },
  start: { tag: "checkNumber", message: "phoneStart" },
  chars: { tag: "checkNumber", message: "phoneChars" },
};

const feeErrors: Record<RupeesError, FieldError> = {
  missing: { tag: "missing", message: "feeMissing" },
  zero: { tag: "checkAmount", message: "feeZero" },
  decimal: { tag: "wholeRupees", message: "feeDecimal" },
  big: { tag: "tooBig", message: "feeBig" },
  chars: { tag: "checkAmount", message: "feeChars" },
};

// An opening balance is optional and may be 0, so it has no missing or zero error.
const owesErrors: Record<Exclude<RupeesError, "missing" | "zero">, FieldError> = {
  decimal: { tag: "wholeRupees", message: "owesDecimal" },
  big: { tag: "tooBig", message: "owesBig" },
  chars: { tag: "checkAmount", message: "owesChars" },
};

/** Cleans and checks the whole form at once. All errors come back together. */
export function checkStudent(draft: StudentDraft, context: FormContext = {}): FormCheck {
  const errors: FieldErrors = {};

  const name = normalizeName(draft.name);
  if (!name.ok) {
    errors.name = name.error === "missing" ? { tag: "missing", message: "nameMissing" } : { tag: "tooLong", message: "nameLong" };
  }

  // The parent's name is optional: empty is saved as no name.
  const parentText = tidy(draft.parentName);
  const parent = parentText === "" ? null : normalizeName(parentText);
  if (parent && !parent.ok) errors.parentName = { tag: "tooLong", message: "parentLong" };

  const phone = normalizePhone(draft.phone);
  if (!phone.ok) errors.phone = { ...phoneErrors[phone.error], count: phone.count };

  const fee = parseRupees(draft.fee, FEE_LIMITS);
  if (!fee.ok) errors.fee = feeErrors[fee.error];

  // Blank means 0, and so does text with nothing but a rupee sign, commas or spaces in it.
  const owes = draft.owes.replace(/[₹,\s]/g, "") === "" ? ({ ok: true, paise: 0 } as const) : parseRupees(draft.owes, OWES_LIMITS);
  if (!owes.ok) errors.owes = owesErrors[owes.error === "missing" || owes.error === "zero" ? "chars" : owes.error];

  // The tick: asked for when a number is being saved that was not saved before.
  if (phone.ok && phone.value !== null && phone.value !== (context.savedPhone ?? null) && !draft.permission) {
    errors.permission = { tag: "missing", message: "permissionNeeded" };
  }

  if (Object.keys(errors).length > 0 || !name.ok || !fee.ok || !owes.ok || !phone.ok || (parent && !parent.ok)) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    fields: {
      batchId: draft.batchId === "" ? null : draft.batchId,
      name: name.value,
      parentName: parent ? parent.value : null,
      parentPhone: phone.value,
      parentLanguage: draft.parentLanguage,
      monthlyFee: fee.paise,
      openingBalance: owes.paise,
      dueDay: draft.dueDay,
    },
  };
}

/** The first field with an error, in screen order. */
export function firstError(errors: FieldErrors): FieldName | null {
  return FIELD_ORDER.find((field) => errors[field] !== undefined) ?? null;
}

/**
 * Another student (archived ones too) who already has this phone. `exceptId` leaves out the student
 * being edited, so their own number is never "already saved". The first by name when there are several.
 */
export function samePhone(students: readonly Student[], phone: string | null, exceptId?: string): Student | undefined {
  if (phone === null) return undefined;
  const hits = students.filter((student) => student.parentPhone === phone && student.id !== exceptId);
  return hits.sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0))[0];
}

/** Only the fields that differ from the saved student. Empty when nothing changed. */
export function changedFields(saved: Student, next: StudentFields): Partial<StudentFields> {
  const changed: Partial<StudentFields> = {};
  if (saved.batchId !== next.batchId) changed.batchId = next.batchId;
  if (saved.name !== next.name) changed.name = next.name;
  if (saved.parentName !== next.parentName) changed.parentName = next.parentName;
  if (saved.parentPhone !== next.parentPhone) changed.parentPhone = next.parentPhone;
  if (saved.parentLanguage !== next.parentLanguage) changed.parentLanguage = next.parentLanguage;
  if (saved.monthlyFee !== next.monthlyFee) changed.monthlyFee = next.monthlyFee;
  if (saved.openingBalance !== next.openingBalance) changed.openingBalance = next.openingBalance;
  if (saved.dueDay !== next.dueDay) changed.dueDay = next.dueDay;
  return changed;
}
