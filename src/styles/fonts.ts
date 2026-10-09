// The only place fonts are declared. next/font downloads the files at build time and serves them
// from our own origin; the browser fetches a file only when a character in its unicode-range is drawn,
// so an Indian-script file loads only when that script is on the page.
import {
  Anek_Devanagari,
  Anek_Kannada,
  Anek_Telugu,
  Bricolage_Grotesque,
  DM_Mono,
} from "next/font/google";

// Headlines, amounts and reading text. The latin-ext file holds the rupee sign, so it is preloaded too.
export const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-bricolage",
});

// Labels, dates and row amounts. DM Mono has no rupee sign: naming Bricolage as its fallback puts
// Bricolage straight after it and stops Next generating an Arial-based fallback face in between.
// Weight 500 only: no type role uses 400.
// Not preloaded. next/font preloads a font on every route under the file that declares it, and this
// one is declared for the root layout, so preloading it costs every page 8.7 KB whether or not the
// page draws mono text. The price is that labels appear in Bricolage for a moment on a first visit
// and then swap. Revisit when real screens show labels above the fold.
export const dmMono = DM_Mono({
  weight: "500",
  subsets: ["latin"],
  display: "swap",
  preload: false,
  fallback: ["Bricolage Grotesque"],
  variable: "--font-dm-mono",
});

export const anekDevanagari = Anek_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  preload: false,
  fallback: ["Bricolage Grotesque"],
  variable: "--font-anek-devanagari",
});

export const anekKannada = Anek_Kannada({
  subsets: ["kannada"],
  display: "swap",
  preload: false,
  fallback: ["Bricolage Grotesque"],
  variable: "--font-anek-kannada",
});

export const anekTelugu = Anek_Telugu({
  subsets: ["telugu"],
  display: "swap",
  preload: false,
  fallback: ["Bricolage Grotesque"],
  variable: "--font-anek-telugu",
});

/** Goes on <html>: defines the five --font-* variables that src/styles/tokens.css builds its stacks from. */
export const fontVariables = [
  bricolage.variable,
  dmMono.variable,
  anekDevanagari.variable,
  anekKannada.variable,
  anekTelugu.variable,
].join(" ");
