// Page addresses inside a language, typed once. Every address ends in "/" because the export writes folders.
import type { Locale } from "@/config/locales";

/** The fee reminder writer (slice R0-2), under `/{locale}/`. */
export const feeReminderPath = "tools/fee-reminder/";

/** `/{locale}/` or `/{locale}/{path}`. `path` has no leading slash and ends in one. */
export function localeHref(locale: Locale, path = ""): string {
  return `/${locale}/${path}`;
}
