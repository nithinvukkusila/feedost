// The visitor's saved language, kept in the browser's own storage (not a cookie, not a server).
// Only a deliberate pick saves it: following a language link on "/", or the picker in R1-1.
// Merely opening a language address never calls saveLocale (spec F3, criterion 18).
import { isLocale, type Locale } from "@/config/locales";

/** The storage key. It must not contain the product name. */
export const STORAGE_KEY = "ui-language";

/** The saved language, or null when nothing valid is saved or storage is blocked. */
export function readSavedLocale(): Locale | null {
  try {
    const value = globalThis.localStorage.getItem(STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

/** Saves a deliberate pick. Returns false when storage is blocked; the caller needs no error handling. */
export function saveLocale(code: Locale): boolean {
  if (!isLocale(code)) return false;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, code);
    return true;
  } catch {
    return false;
  }
}
