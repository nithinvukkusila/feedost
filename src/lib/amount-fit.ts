// Width of a formatted amount, for the shrink-to-fit amount sizes (`amount-size-*` in
// src/styles/type.css). CSS cannot measure text, so the amount's width in em is worked out here
// from its characters and handed to CSS as a custom property. No DOM is measured: it works in
// static HTML before any script runs.
import type { CSSProperties } from "react";

// Advance of each character in the headline amount role (Bricolage Grotesque 800 at -0.04em),
// in em, measured in Chromium on 2026-10-09. Figures in this face are not all one width.
// If the face or its letter-spacing changes, measure again: e2e checks that amounts still fit.
const ADVANCE: Record<string, number> = {
  "₹": 0.535,
  "0": 0.63,
  "1": 0.32,
  "2": 0.575,
  "3": 0.585,
  "4": 0.616,
  "5": 0.575,
  "6": 0.622,
  "7": 0.504,
  "8": 0.621,
  "9": 0.623,
  ",": 0.172,
  ".": 0.218,
  "/": 0.26,
  "-": 0.319,
  " ": 0.2,
};

// Anything not in the table is taken to be as wide as the widest figure.
const WIDEST = 0.63;

// Room for kerning, rounding and the fallback face before the font arrives.
const MARGIN = 1.03;

/** The width of `text` in em when set in the headline amount role, rounded up a little. */
export function amountEm(text: string): number {
  let em = 0;
  for (const ch of text) em += ADVANCE[ch] ?? WIDEST;
  return Math.round(em * MARGIN * 1000) / 1000;
}

/** The style to put on an amount that uses an `amount-size-*` class. */
export function amountFit(text: string): CSSProperties {
  return { "--amount-em": amountEm(text) } as CSSProperties;
}
