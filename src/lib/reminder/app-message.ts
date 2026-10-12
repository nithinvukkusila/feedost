// The app's reminder message (spec R1-8, criteria 5 to 9, 11, 12): the R0-2 builder fed from a fee, a
// student and the tutor. It is the only place the app's own template file is read, so the board and the
// free tool page never load it. Pure: no React, no network, no storage.
import type { Locale } from "@/config/locales";
import type { Due } from "@/lib/dues";
import { templateTag } from "@/lib/reminder-rules";
import {
  APP_MAX_PAISE,
  cleanName,
  NAME_MAX,
  reminderParts,
  reminderText,
  type Kind,
  type Part,
  type Tone,
} from "./reminder";
import app from "./templates.app.json";

export type AppMessageInput = {
  student: { parentName: string | null; parentLanguage: Locale };
  due: Pick<Due, "kind" | "month" | "amount" | "amountPaid">;
  tutor: { upiId: string; name: string };
  tone: Tone;
  /** A ready-made link (the pay page, from R1-9). Omitted: the UPI link is built. */
  link?: string | null;
};

export type AppMessage = {
  parts: Part[];
  text: string;
  link: string;
  /** The tag the log stores, like `polite:hi:month`. */
  template: string;
  kind: Kind;
  locale: Locale;
};

/** The generic word for a parent with no name saved, in the parent's language. */
export function parentWord(locale: Locale): string {
  return app[locale].parentWord;
}

/** The parent's name as it goes into the message: cleaned, cut at 40 code points; a blank one becomes the generic word. */
export function greetingName(parentName: string | null, locale: Locale): string {
  const cleaned = parentName === null ? "" : cleanName(parentName);
  if (cleaned === "") return parentWord(locale);
  return Array.from(cleaned).slice(0, NAME_MAX).join("").trim();
}

/** Zero-based month (0 to 11) of a due's `YYYY-MM-DD` month, or null when it has none. */
function monthIndex(month: string | null): number | null {
  if (month === null) return null;
  const n = Number(month.slice(5, 7));
  return Number.isInteger(n) && n >= 1 && n <= 12 ? n - 1 : null;
}

/**
 * The message for one fee. Throws when the fee cannot be reminded (no name or UPI ID, an amount
 * the link cannot carry); `canRemind` has already stopped those before the screen gets here.
 */
export function buildAppMessage(input: AppMessageInput): AppMessage {
  const { student, due, tutor, tone } = input;
  const locale = student.parentLanguage;
  const kind: Kind = due.kind === "opening" ? "balance" : "month";
  const month = kind === "month" ? monthIndex(due.month) : null;
  if (kind === "month" && month === null) throw new RangeError("buildAppMessage needs the fee's month");
  const parts = reminderParts({
    locale,
    tone,
    parent: greetingName(student.parentName, locale),
    paise: due.amount - due.amountPaid,
    month,
    upiId: tutor.upiId,
    payeeName: cleanName(tutor.name) || null,
    kind,
    lines: kind === "balance" ? app[locale][tone] : undefined,
    maxPaise: APP_MAX_PAISE,
    link: input.link,
  });
  const text = reminderText(parts);
  const link = parts.find((part) => part.kind === "value" && part.slot === "link");
  if (text === null || link === undefined || link.kind !== "value") throw new RangeError("buildAppMessage could not fill the message");
  return { parts, text, link: link.text, template: templateTag(tone, locale, kind), kind, locale };
}
