"use client";

// The four language rows of the picker (spec R1-1, criteria 1 to 4). Each row is a plain link to the
// picker in that language, so it works with JavaScript off. The one thing this island adds is saving
// the choice on a tap: opening the page alone never saves (spec F3, criterion 18).
//
// Segmented cannot draw these: it is one bordered group of radio buttons, not stacked links with a
// stamped shadow. The chosen row is the one pressed into its shadow, filled yellow, with a tick and
// the word "Chosen": never colour alone.
import { localeNames, locales, type Locale } from "@/config/locales";
import { languagePath, localeHref } from "@/config/routes";
import { cx } from "@/lib/cx";
import { saveLocale } from "@/lib/locale-choice";

export type LanguageListWords = {
  /** The word on the chosen row. */
  chosen: string;
  /** What each language is called in the page's language: the line under its own name. */
  names: Record<Locale, string>;
};

// Whole class names, so Tailwind can see them.
const row =
  "flex min-h-row items-center justify-between gap-3 rounded-sm border-2 border-ink px-4 py-2 text-ink ring:ground-ring";
const resting = "bg-slip shadow-button ground-shadow transition-transform duration-80 ease-linear motion-reduce:transition-none pressed:press-button";
const chosenLook = "press-button bg-highlight";

function Tick() {
  return (
    <svg aria-hidden="true" focusable={false} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function LanguageList({ current, words }: Readonly<{ current: Locale; words: LanguageListWords }>) {
  return (
    // Room on the right and below for the stamped shadow, so it never causes sideways scroll.
    <ul className="flex flex-col gap-3 pr-1.5 pb-1.5">
      {locales.map((code) => {
        const on = code === current;
        return (
          <li key={code}>
            <a
              href={localeHref(code, languagePath)}
              lang={code}
              hrefLang={code}
              aria-current={on ? "page" : undefined}
              onClick={() => {
                // A deliberate pick: remember it. The link then loads the picker in that language.
                saveLocale(code);
              }}
              className={cx(row, on ? chosenLook : resting)}
            >
              {/* The language's own name in the phone's font, so no Anek file is fetched for the list. */}
              <span className="min-w-0 type-endonym-row wrap-anywhere">{localeNames[code]}</span>
              {/* This word is the page's language, not the row's. */}
              <span lang={current} className="type-label flex shrink-0 items-center gap-1.5 text-right">
                {on ? <Tick /> : null}
                {on ? words.chosen : words.names[code]}
              </span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
