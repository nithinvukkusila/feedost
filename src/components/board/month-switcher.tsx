"use client";

// The month switcher (spec R1-6, criterion 12; canvas "Home"): a Previous and a Next button, each 44px
// square, around the month and year. A button that cannot move is still drawn at 44px, with a dashed
// outline, and is announced as disabled. The month word comes from the page's language; the year is passed
// as text, so no language groups or re-draws its digits.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { BackIcon, NextIcon } from "@/components/app/icons";
import { monthParts } from "@/lib/dues-board";

const MONTH_KEYS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"] as const;

/** The month's name and "October 2026", in the page's language. `month` is `YYYY-MM-01`. */
export function useMonthWords() {
  const t = useTranslations("board");
  const name = (month: string) => t(`months.${MONTH_KEYS[monthParts(month).month - 1]}`);
  const label = (month: string) => t("monthYear", { month: name(month), year: String(monthParts(month).year) });
  return { name, label };
}

// A dead arrow (UX-review-fixes-2, 5.2): still 44px and announced as disabled, no shadow, the dashed outline that is
// the disabled mark, and its icon in the faint `rule` so it is plainly not the live `ink` one. The dash, not the
// colour, carries the state. When neither way can move the arrows are not drawn at all (5.1).
const arrow =
  "flex size-tap shrink-0 items-center justify-center border-2 border-transparent text-ink ring:ground-ring disabled:cursor-not-allowed disabled:border-dashed disabled:border-ink-label disabled:text-rule";

export type MonthSwitcherProps = {
  label: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Something at the far end of the row (Home's "to confirm" chip). The row wraps when there is no room. */
  trailing?: ReactNode;
};

export function MonthSwitcher({ label, canPrev, canNext, onPrev, onNext, trailing }: Readonly<MonthSwitcherProps>) {
  const t = useTranslations("board");
  // No other month to go to: the month alone, at the arrows' height so the row does not change when one appears.
  const moves = canPrev || canNext;
  return (
    <div className="flex flex-wrap items-center justify-between gap-y-1 px-2 pt-1.5">
      <div className="flex min-h-tap min-w-0 max-w-full items-center">
        {moves ? (
          <button type="button" aria-label={t("prev")} disabled={!canPrev} onClick={onPrev} className={arrow}>
            <BackIcon />
          </button>
        ) : null}
        <p aria-live="polite" aria-atomic="true" className="type-label min-w-0 px-1 text-center text-ink">
          {label}
        </p>
        {moves ? (
          <button type="button" aria-label={t("next")} disabled={!canNext} onClick={onNext} className={arrow}>
            <NextIcon />
          </button>
        ) : null}
      </div>
      {trailing}
    </div>
  );
}
