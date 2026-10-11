// The waitlist block's body (spec R0-4): the form island. The section itself (`id="waitlist"`, its
// heading and paragraph) stays in src/app/[locale]/page.tsx: the header and hero buttons, and the
// yellow block on each tool page, point at #waitlist.
import { WaitlistForm, type WaitlistWords } from "./waitlist-form";
import type { Locale } from "@/config/locales";

export function WaitlistSlot({ words, locale }: Readonly<{ words: WaitlistWords; locale: Locale }>) {
  return <WaitlistForm words={words} locale={locale} />;
}
