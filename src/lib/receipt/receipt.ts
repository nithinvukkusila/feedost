// The fee receipt, as plain functions (spec R0-3, plan section 3): the months on offer, the issue
// date, the receipt's words, the file name, the share choice, and the rules for which script a
// piece of text is drawn in and which characters are left out. No React, no DOM, no PDF library.
// The on-page preview and the PDF both read `receiptLines`, so the words are put together once.
//
// Written for old Android WebViews and Safari: no lookbehind, no `Intl.Segmenter`, no `toWellFormed`.
// Checking a name or an amount is not here: it is `checkName` and `checkAmount` in src/lib/fields.ts.
import { brand } from "@/config/brand";
import type { Locale } from "@/config/locales";
import { whatsAppLink } from "@/lib/fields";
import { formatRupees } from "@/lib/format";
import templates from "./templates.json";

export type Mode = "upi" | "cash" | "bank";
export const MODES: readonly Mode[] = ["upi", "cash", "bank"];

/** A fee month: `month` is 0 to 11. */
export type FeeMonth = { year: number; month: number };

/** How many months the tutor can pick: the current one and the 11 before it (spec D2). */
export const MONTHS_OFFERED = 12;

/** The current month first, then the 11 before it, on the phone's clock. */
export function feeMonths(now: Date = new Date()): FeeMonth[] {
  const list: FeeMonth[] = [];
  for (let back = 0; back < MONTHS_OFFERED; back++) {
    // Counting in whole months from year 0 makes the January step back exact.
    const total = now.getFullYear() * 12 + now.getMonth() - back;
    list.push({ year: Math.floor(total / 12), month: total % 12 });
  }
  return list;
}

/** A string that identifies a fee month, for a select's value. */
export const monthKey = (m: FeeMonth): string => `${m.year}-${m.month}`;

/** The month a key stands for, or `null` when it is not one of the offered months. */
export function monthFromKey(key: string, now: Date = new Date()): FeeMonth | null {
  return feeMonths(now).find((m) => monthKey(m) === key) ?? null;
}

/** "October 2026" in a language. Digits are 0-9 in every language. */
export function feeMonthLabel(m: FeeMonth, lang: Locale): string {
  return `${templates[lang].months[m.month]} ${m.year}`;
}

/** `08 Oct 2026`, with the short month in the receipt's language and 0-9 digits. Today, on the phone's clock (spec D4). */
export function issueDate(now: Date, lang: Locale): string {
  const day = String(now.getDate()).padStart(2, "0");
  return `${day} ${templates[lang].shortMonths[now.getMonth()]} ${now.getFullYear()}`;
}

/** `fee-receipt-Oct-2026.pdf`: English short month, ASCII only, and never a name (criterion 23). */
export function fileName(m: FeeMonth): string {
  return `fee-receipt-${templates.en.shortMonths[m.month]}-${m.year}.pdf`;
}

// ---------------------------------------------------------------------------------------------
// The words of the receipt

export type Slot = "student" | "amount" | "month" | "mode";
export type Part =
  | { kind: "text"; text: string }
  | { kind: "value"; slot: Slot; text: string }
  | { kind: "blank"; slot: Slot };

export type ReceiptInput = {
  lang: Locale;
  /** `null` means missing or not valid yet. */
  tutor: string | null;
  student: string | null;
  paise: number | null;
  month: FeeMonth | null;
  mode: Mode;
  now: Date;
};

export type ReceiptLines = {
  lang: Locale;
  /** The tutor's name, the heading. */
  tutor: string | null;
  /** "Fee receipt" */
  title: string;
  /** "Date: 08 Oct 2026" */
  date: string;
  /** `₹1,200/-`, or `null` while the amount is missing. */
  amount: string | null;
  /** The sentence as pieces, so the preview can draw a blank where a value is missing. */
  sentence: Part[];
  /** "PAID" */
  stamp: string;
  /** "08 Oct 2026" */
  stampDate: string;
  /** "Made with (brand name, address), a free tool for tutors" */
  footer: string;
};

const PLACEHOLDERS = /(\{student\}|\{amount\}|\{month\}|\{mode\})/;

/**
 * The sentence as pieces, in order. The template is split on its four placeholders first and the
 * pieces are filled afterwards, so a typed name is never searched for a placeholder: a student
 * named `{amount}` or `$&` comes out as typed.
 */
function sentenceParts(input: ReceiptInput): Part[] {
  const entry = templates[input.lang];
  const parts: Part[] = [];
  entry.sentence.split(PLACEHOLDERS).forEach((piece, index) => {
    if (index % 2 === 0) {
      if (piece !== "") parts.push({ kind: "text", text: piece });
      return;
    }
    const slot = piece.slice(1, -1) as Slot;
    let text: string | null;
    switch (slot) {
      case "student":
        text = input.student;
        break;
      case "amount":
        text = input.paise === null ? null : formatRupees(input.paise);
        break;
      case "month":
        text = input.month === null ? null : feeMonthLabel(input.month, input.lang);
        break;
      case "mode":
        text = entry.modes[input.mode];
        break;
    }
    parts.push(text === null ? { kind: "blank", slot } : { kind: "value", slot, text });
  });
  return parts;
}

/** Every line the preview and the PDF show, in the receipt's language. */
export function receiptLines(input: ReceiptInput): ReceiptLines {
  const entry = templates[input.lang];
  const today = issueDate(input.now, input.lang);
  return {
    lang: input.lang,
    tutor: input.tutor,
    title: entry.heading,
    date: entry.date.replace("{date}", today),
    amount: input.paise === null ? null : `${formatRupees(input.paise)}/-`,
    sentence: sentenceParts(input),
    stamp: entry.stamp,
    stampDate: today,
    footer: entry.footer.replace("{brand}", brand.name).replace("{domain}", brand.domain),
  };
}

/** The whole sentence, or `null` while any part is still blank. */
export function sentenceText(parts: readonly Part[]): string | null {
  let out = "";
  for (const part of parts) {
    if (part.kind === "blank") return null;
    out += part.text;
  }
  return out;
}

/** The short message that goes with the PDF on WhatsApp, in the receipt's language. */
export function waText(lang: Locale, month: FeeMonth): string {
  return templates[lang].whatsApp.replace("{month}", feeMonthLabel(month, lang));
}

/** The "paid by" words for the page's own buttons come from the message files; this one is the receipt's phrase. */
export function modePhrase(lang: Locale, mode: Mode): string {
  return templates[lang].modes[mode];
}

// ---------------------------------------------------------------------------------------------
// Sharing

export type ShareChoice = "share-file" | "download-then-whatsapp";

/**
 * Where the phone can share a file (Web Share with files), share it. Otherwise save it and open
 * WhatsApp with a short text, and the tutor attaches the file (spec criterion 25).
 */
export function chooseShare(env: { canShareFiles: boolean }): ShareChoice {
  return env.canShareFiles ? "share-file" : "download-then-whatsapp";
}

/** `wa.me` with no number: WhatsApp asks who to send to. */
export function waLink(lang: Locale, month: FeeMonth): string {
  return whatsAppLink(waText(lang, month));
}

// ---------------------------------------------------------------------------------------------
// Scripts and the characters no font here can draw

export type Script = "latin" | "devanagari" | "kannada" | "telugu" | "other";
/** The scripts that have a font file. */
export type FontScript = Exclude<Script, "other">;
export const FONT_SCRIPTS: readonly FontScript[] = ["latin", "devanagari", "kannada", "telugu"];

/** `null` for a character that takes the script of its neighbours: space, digit, punctuation, joiner, combining mark. */
function strongScript(cp: number): Script | null {
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a)) return "latin";
  if (cp >= 0xc0 && cp <= 0x24f && cp !== 0xd7 && cp !== 0xf7) return "latin";
  if (cp === 0x20b9) return "latin"; // ₹: only the Latin font has it
  if ((cp >= 0x900 && cp <= 0x97f) || (cp >= 0xa8e0 && cp <= 0xa8ff)) return "devanagari";
  if (cp >= 0xc80 && cp <= 0xcff) return "kannada";
  if (cp >= 0xc00 && cp <= 0xc7f) return "telugu";
  // Neutral: controls and Basic Latin punctuation and digits, Latin-1 punctuation, combining marks,
  // the joiners, and general punctuation (dashes, quotes). Digits are 0-9 in every font here.
  if (cp <= 0xbf) return null;
  if (cp >= 0x300 && cp <= 0x36f) return null;
  if (cp === 0x200c || cp === 0x200d) return null;
  if (cp >= 0x2010 && cp <= 0x2027) return null;
  if (cp >= 0x2030 && cp <= 0x205e) return null;
  return "other";
}

export type Run = { script: Script; text: string };

const isJoiner = (cp: number) => cp === 0x200c || cp === 0x200d;

/**
 * Cuts text into runs of one script each, so each run can be drawn with its own font. A neutral
 * character (space, digit, punctuation) stays with the run before it; at the start it joins the
 * first run, and text with no letters at all is one Latin run. Anything no font is meant to draw
 * (an emoji, a symbol, another script) is a run of `other`.
 */
export function splitRuns(text: string): Run[] {
  const runs: Run[] = [];
  let pending = ""; // neutral characters before the first letter
  for (const char of text) {
    const cp = char.codePointAt(0) ?? 0;
    const script = strongScript(cp);
    const last = runs[runs.length - 1];
    if (script === null) {
      if (last) last.text += char;
      else pending += char;
    } else if (last && last.script === script) {
      last.text += char;
    } else {
      runs.push({ script, text: (last ? "" : pending) + char });
      pending = "";
    }
  }
  if (runs.length === 0 && pending !== "") runs.push({ script: "latin", text: pending });
  return runs;
}

/** Whether any character in the text is one no font here is meant to draw. Used by the preview, which has no fonts. */
export function hasUnprintable(text: string): boolean {
  for (const char of text) if (strongScript(char.codePointAt(0) ?? 0) === "other") return true;
  return false;
}

/**
 * The scripts whose font files a receipt needs: Latin always (the amount, the date and the digits),
 * and each other script that any of the texts uses. Fetch only these.
 */
export function scriptsNeeded(texts: readonly string[]): FontScript[] {
  const found = new Set<Script>(["latin"]);
  for (const text of texts) for (const run of splitRuns(text)) found.add(run.script);
  return FONT_SCRIPTS.filter((script) => found.has(script));
}

/**
 * The written rule for a character no font can draw (criterion 20): it is dropped, never replaced,
 * and the download goes on. A character goes when it is of `other` script (an emoji, a symbol), or
 * when the font for its run has no glyph for it (`canDraw`, which asks the font itself, so the rule
 * does not go stale). A joiner stays inside an Indian script and goes anywhere else. Spaces left
 * double by a drop are made one. `dropped` is true when something other than a space or joiner went,
 * so the page can say so in words.
 */
export function dropUnprintable(
  text: string,
  canDraw: (char: string, script: FontScript) => boolean,
): { text: string; dropped: boolean } {
  let out = "";
  let dropped = false;
  for (const run of splitRuns(text)) {
    // Neutral characters inside an `other` run are drawn in Latin if the font has them.
    const font: FontScript = run.script === "other" ? "latin" : run.script;
    for (const char of run.text) {
      const cp = char.codePointAt(0) ?? 0;
      if (isJoiner(cp)) {
        if (font !== "latin") out += char;
        continue;
      }
      const strong = strongScript(cp);
      if (strong === "other" || (cp !== 0x20 && !canDraw(char, font))) {
        if (!/\s/.test(char)) dropped = true;
        continue;
      }
      out += char;
    }
  }
  return { text: out.replace(/ {2,}/g, " ").trim(), dropped };
}
