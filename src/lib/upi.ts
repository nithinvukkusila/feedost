// The UPI ID rule, in one place for the setup screen. No React. The same pattern is the PRD's, and the
// database enforces it too (with `\w` written out), so a value that passes here is accepted there.
/** `^[\w.\-]{2,256}@[a-zA-Z]{2,64}$` (PRD section 5). `\w` is Latin letters, digits and underscore only. */
// Written out here and not imported from the fee reminder, which would pull its message templates into
// the setup screens' JavaScript. upi.test.ts fails if the two ever differ.
export const UPI_PATTERN: RegExp = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

/** What is saved: the typed text without the spaces at its ends. */
export function trimUpi(text: string): string {
  return text.trim();
}

export type UpiCheck = "ok" | "missing" | "noAt" | "bad";

/** `missing`: nothing typed. `noAt`: no @ at all. `bad`: anything else wrong (a space, a Hindi digit, a missing bank name). */
export function checkUpi(text: string): UpiCheck {
  const value = trimUpi(text);
  if (value === "") return "missing";
  if (!value.includes("@")) return "noAt";
  return UPI_PATTERN.test(value) ? "ok" : "bad";
}
