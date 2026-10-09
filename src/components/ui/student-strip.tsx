// StudentStrip (docs/DESIGN.md): one block per student. Paid is short and filled, due is short and
// hollow, overdue is tall and red. Height and fill carry the meaning, so it reads without colour,
// and it is never shown without its text legend. A picture, not a control: nothing in it can be
// tapped or focused. Every word is passed in.
import type { CSSProperties, ReactNode } from "react";
import { cx } from "@/lib/cx";

/** A part-paid student has no shape of its own: the screen passes "due" or "overdue" by its date. */
export type StripBlock = "paid" | "due" | "overdue";

export type StripLegend = {
  /** For example "14 paid". */
  paid: ReactNode;
  /** For example "4 due, hollow". */
  due: ReactNode;
  /** For example "5 overdue, tall". */
  overdue: ReactNode;
};

export type StudentStripProps = {
  /** One entry per student, in the order to draw them. */
  blocks: readonly StripBlock[];
  /** The three texts under the strip. Required: the strip is never shown without them. */
  legend: StripLegend;
  /** The text alternative, with the counts: "23 students: 14 paid, 4 due, 5 overdue". */
  label: string;
};

/** The most blocks in one row. Beyond it the strip wraps onto more rows. */
export const STRIP_ROW_MAX = 28;

/**
 * How many blocks go in each row. Up to 28: all in one row. Above that the students are split into
 * the fewest equal rows of at most 28, so 60 gives three rows of 20 and not 28, 28 and 4.
 *
 * 28 assumes the strip is at least 20rem (320px) wide, which is every phone layout we have: with
 * 3px gaps a block is then never narrower than 8px, so a hollow block keeps at least 4px of hollow
 * inside its 2px border. In a narrower container the blocks get thinner than that.
 */
export function stripColumns(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  const whole = Math.floor(count);
  if (whole <= STRIP_ROW_MAX) return whole;
  const rows = Math.ceil(whole / STRIP_ROW_MAX);
  return Math.ceil(whole / rows);
}

// Heights are rem (14px and 24px at the default text size). The hollow block's border stays 2px.
const shapes: Record<StripBlock, string> = {
  paid: "h-3.5 bg-stamp",
  due: "h-3.5 border-2 border-ink bg-slip",
  overdue: "h-6 bg-cloth",
};

// Colour only supports the legend's words; each text says its kind.
const legendTones: Record<StripBlock, string> = {
  paid: "text-stamp",
  due: "text-ink-soft",
  overdue: "text-cloth",
};

const order: StripBlock[] = ["paid", "due", "overdue"];

export function StudentStrip({ blocks, legend, label }: StudentStripProps) {
  // No students: nothing at all, not an empty strip with a legend of zeros.
  if (blocks.length === 0) return null;
  const style = { "--cols": stripColumns(blocks.length) } as CSSProperties;
  return (
    <div className="flex flex-col gap-1.5">
      <div role="img" aria-label={label} style={style} className="strip-grid">
        {blocks.map((kind, index) => (
          <span key={index} aria-hidden="true" data-kind={kind} className={shapes[kind]} />
        ))}
      </div>
      <ul className="type-label flex flex-wrap gap-x-3.5 gap-y-0.5">
        {order.map((kind) => (
          <li key={kind} data-legend={kind} className={cx("min-w-0 wrap-anywhere", legendTones[kind])}>
            {legend[kind]}
          </li>
        ))}
      </ul>
    </div>
  );
}
