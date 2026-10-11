// A new random id for a row, made in the browser (spec R1-3, decision 4: one id per form fill, so a double
// tap or a retry cannot make two rows). `crypto.randomUUID` exists only on a secure page (https or
// localhost); a page opened over a plain-http address on the local network has `getRandomValues` only.

/** A random version-4 UUID. */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
