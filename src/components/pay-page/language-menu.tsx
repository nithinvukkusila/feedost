"use client";

// The language button of the pay page (spec R1-9 criterion 29): it shows the current language's own name and opens a
// list of the page's languages (`choices`: English and each unlocked one, spec parent-pages-english), each at least
// 44px. The page draws it only when there is more than English to choose. Choosing one changes the words of this visit only; nothing is stored and no
// request is made. The list is the existing Sheet (a native dialog), so focus, Escape and focus return are the browser's.
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { localeNames, type Locale } from "@/config/locales";
import { cx } from "@/lib/cx";

function Tick() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function LanguageMenu({
  current,
  choices,
  onChoose,
  title,
  closeLabel,
}: Readonly<{ current: Locale; choices: readonly Locale[]; onChoose: (locale: Locale) => void; title: string; closeLabel: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        lang={current}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="type-endonym inline-flex min-h-tap shrink-0 items-center rounded-sm border-2 border-on-cloth px-2.5 font-bold text-on-cloth ring:ground-ring"
      >
        {localeNames[current]}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} closeLabel={closeLabel}>
        <ul className="flex flex-col border-t-2 border-ink">
          {choices.map((code) => {
            const on = code === current;
            return (
              <li key={code} className="border-b border-rule">
                <button
                  type="button"
                  lang={code}
                  aria-current={on ? "true" : undefined}
                  onClick={() => {
                    onChoose(code);
                    setOpen(false);
                  }}
                  className={cx("type-endonym flex min-h-tap w-full items-center justify-between gap-3 py-2 text-left font-bold ring:ground-ring", on && "text-blue")}
                >
                  <span className="min-w-0 wrap-anywhere">{localeNames[code]}</span>
                  {on ? <Tick /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
