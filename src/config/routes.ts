// Page addresses inside a language, typed once. Every address ends in "/" because the export writes folders.
import type { Locale } from "@/config/locales";

/** The fee reminder writer (slice R0-2), under `/{locale}/`. */
export const feeReminderPath = "tools/fee-reminder/";

// The signed-in app (slice R1-1), under `/{locale}/`.
export const languagePath = "language/";
export const signInPath = "sign-in/";
export const callbackPath = "auth/callback/";
export const homePath = "home/";
export const morePath = "more/";
export const studentsPath = "students/";
export const studentNewPath = "students/new/";
export const studentEditPath = "students/edit/";
export const batchesPath = "batches/";
export const batchEditPath = "batches/edit/";
export const attendancePath = "attendance/";
/** The in-app receipt (R1-7). Not a `Place`: the gate treats it as home, which is right for a signed-in tutor. */
export const receiptPath = "receipt/";
export const setupProfilePath = "setup/profile/";
export const setupUpiPath = "setup/upi/";

/** The screens the app can send a tutor to or from. The route decision in src/lib/profile.ts speaks in these names. */
export const placePath = {
  "sign-in": signInPath,
  callback: callbackPath,
  home: homePath,
  more: morePath,
  students: studentsPath,
  "student-new": studentNewPath,
  "student-edit": studentEditPath,
  batches: batchesPath,
  "batch-edit": batchEditPath,
  attendance: attendancePath,
  "setup-profile": setupProfilePath,
  "setup-upi": setupUpiPath,
} as const;
export type Place = keyof typeof placePath;

/** `/{locale}/` or `/{locale}/{path}`. `path` has no leading slash and ends in one. */
export function localeHref(locale: Locale, path = ""): string {
  return `/${locale}/${path}`;
}
