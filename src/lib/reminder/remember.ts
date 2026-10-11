// "Remember my UPI ID and name on this phone" (spec R0-2, criteria 51 to 54; plan section 8).
// One key in the browser's own storage, holding the tutor's cleaned UPI ID and name and nothing
// else: no parent's name, amount, month, tone or language. It never leaves the phone. Every call is
// guarded, so a browser that blocks storage (private mode, an in-app browser) just has no switch.
// From fields.ts, not reminder.ts: the receipt maker reads the remembered name too, and must not pull
// the reminder's message templates into its page.
import { checkName, checkUpiId } from "@/lib/fields";

/** The storage key. It does not contain the product name. */
export const REMEMBER_KEY = "reminder-payee";
const PROBE_KEY = "reminder-probe";
const VERSION = 1;

export type Payee = { upiId: string; name: string };

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Reading the property itself can throw when storage is blocked.
    return null;
  }
}

let works: boolean | null = null;

/** Whether this browser lets the page keep a value. Probes once, then remembers the answer: it is asked on every render. */
export function storageWorks(): boolean {
  if (works !== null) return works;
  const store = storage();
  if (store === null) {
    works = false;
    return works;
  }
  try {
    store.setItem(PROBE_KEY, "1");
    store.removeItem(PROBE_KEY);
    works = true;
  } catch {
    works = false;
  }
  return works;
}

/** What is stored, as text. `null` when nothing is stored or storage is blocked. */
export function readRaw(): string | null {
  try {
    return storage()?.getItem(REMEMBER_KEY) ?? null;
  } catch {
    return null;
  }
}

/** The stored pair, or `null` when there is none or it no longer passes today's rules. Pure. */
export function parsePayee(raw: string | null): Payee | null {
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const { v, upiId, name } = value as Record<string, unknown>;
  if (v !== VERSION || typeof upiId !== "string" || typeof name !== "string") return null;
  const id = checkUpiId(upiId);
  const who = checkName(name);
  // Only the cleaned form is ever written, so anything else was not written by this page.
  if (!id.ok || id.value !== upiId || !who.ok || who.value !== name) return null;
  return { upiId, name };
}

/** Keeps the pair. Answers whether it was kept. */
export function savePayee(payee: Payee): boolean {
  try {
    const store = storage();
    if (store === null) return false;
    store.setItem(REMEMBER_KEY, JSON.stringify({ v: VERSION, upiId: payee.upiId, name: payee.name }));
    return true;
  } catch {
    return false;
  }
}

/** Forgets the pair, at once. */
export function forgetPayee(): void {
  try {
    storage()?.removeItem(REMEMBER_KEY);
  } catch {
    // Nothing was kept, or nothing can be reached: either way there is nothing left to forget.
  }
}
