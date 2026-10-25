// SummaryBar (docs/DESIGN.md; spec UX-review-fixes-2, item 4): one bar for a month, in three parts, Collected, Due and
// Overdue, each as wide as its share of the money, with three labels under it. Each label is a word, an amount and
// the same mark as its part. The marks differ by shape as well as colour: Collected is a short solid block, Due a
// short highlighted block with an ink edge, Overdue a tall block, so the bar reads without colour. The bar is a
// picture for sighted readers only (`aria-hidden`); the labels are its text, read in order. Nothing in it can be
// tapped or focused. Every word is passed in, already formatted.
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type SummaryPart = "collected" | "due" | "overdue";

export type SummaryBarProps = {
  /** Paise received in the month. Null while it is not known (still being read, or the read failed): no part is drawn. */
  collected: number | null;
  /** Paise still owed on fees that are not late. */
  due: number;
  /** Paise still owed on fees that are late. */
  overdue: number;
  /** The three labels, for example "Collected ₹1,200". Each is always shown, also for ₹0. */
  labels: Record<SummaryPart, ReactNode>;
};

export const SUMMARY_ORDER: readonly SummaryPart[] = ["collected", "due", "overdue"];

// Heights are rem, so the bar grows with the text. `min-w-1` keeps a small but real amount at least 4px wide.
const shapes: Record<SummaryPart, string> = {
  collected: "h-3.5 bg-stamp",
  due: "h-3.5 border-2 border-ink bg-highlight",
  overdue: "h-6 bg-cloth",
};

// The mark in front of each label: the same shape as its part, at a fixed width.
const marks: Record<SummaryPart, string> = {
  collected: "h-3.5 w-3.5 bg-stamp",
  due: "h-3.5 w-3.5 border-2 border-ink bg-highlight",
  overdue: "h-6 w-3.5 bg-cloth",
};

// Colour only supports the words; each label says its kind.
const tones: Record<SummaryPart, string> = {
  collected: "text-stamp",
  due: "text-ink-soft",
  overdue: "text-cloth",
};

/** A grey block where an amount will be, while it is read. `label` is screen-reader words beside it (not inside, so they sit on the page ground). */
export function SummaryPending({ label }: Readonly<{ label: string }>) {
  return (
    <>
      <span aria-hidden="true" data-pending="" className="inline-block h-3.5 w-12 bg-tab-idle align-middle" />
      <span className="sr-only">{label}</span>
    </>
  );
}

export function SummaryBar({ collected, due, overdue, labels }: SummaryBarProps) {
  const amounts: Record<SummaryPart, number> = { collected: collected ?? 0, due, overdue };
  const drawn = SUMMARY_ORDER.filter((part) => amounts[part] > 0);
  return (
    <div className="flex flex-col gap-2">
      {drawn.length > 0 ? (
        <div aria-hidden="true" data-summary-bar="" className="flex h-6 items-end gap-0.5">
          {drawn.map((part) => (
            <span key={part} data-part={part} style={{ flexGrow: amounts[part] }} className={cx("min-w-1 basis-0", shapes[part])} />
          ))}
        </div>
      ) : null}
      <ul className="type-label flex flex-wrap gap-x-4 gap-y-1.5">
        {SUMMARY_ORDER.map((part) => (
          <li key={part} data-label={part} className={cx("flex min-w-0 items-end gap-1.5", tones[part])}>
            <span aria-hidden="true" className={cx("shrink-0", marks[part])} />
            <span className="min-w-0 wrap-anywhere">{labels[part]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
