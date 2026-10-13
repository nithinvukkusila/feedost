// The `upi://pay` link builder, on its own so a page that only needs the link (the parent's pay page,
// R1-9) does not pull in the reminder templates in `reminder/reminder.ts`. The reminder, the free tool
// and the pay page all build their link here: one builder, no second copy.
//
// Integer arithmetic only: paise in, `whole.cc` out. No floats, no `Intl`.

/** The PRD pattern, exactly, with no flags. */
export const UPI_ID = /^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/;

/** The largest amount the app asks for: ₹10,00,000, in paise. */
export const PAY_PAGE_MAX_PAISE = 100_000_000;

/** Integer paise as `whole.cc`, by integer arithmetic only. */
export function rupeesText(paise: number): string {
  return `${Math.trunc(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

/**
 * The payment link: exactly `pa`, `pn`, `am`, `cu`, `tn`, in that order, and nothing else. It pays the
 * given UPI ID directly. Throws on a UPI ID that does not match the pattern, an empty payee name, or paise
 * that is not a safe integer from 1 to `maxPaise`, so a malformed link can never be built.
 * `payeeName` and `note` are encoded here; the caller passes them as plain text.
 */
export function buildUpiLink(input: { upiId: string; payeeName: string; paise: number; note: string; maxPaise: number }): string {
  const { upiId, payeeName, paise, note, maxPaise } = input;
  if (!UPI_ID.test(upiId)) throw new RangeError("upiLink needs a UPI ID that matches the pattern");
  if (payeeName === "") throw new RangeError("upiLink needs the payee's name");
  if (!Number.isSafeInteger(paise) || paise < 1 || paise > maxPaise) {
    throw new RangeError(`upiLink needs paise from 1 to ${String(maxPaise)}; got ${String(paise)}`);
  }
  // `pa` is written as it is: the pattern admits nothing that needs encoding.
  return `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${rupeesText(paise)}&cu=INR&tn=${encodeURIComponent(note)}`;
}
