// StatusTag (docs/DESIGN.md): a word plus a mark. The mark is the outline style, never colour alone.
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type Status = "overdue" | "due" | "part-paid" | "paid";

// Border plus padding adds up to the same box in all four, so a column of tags lines up.
const marks: Record<Status, string> = {
  // 2px solid outline.
  overdue: "border-2 border-solid border-cloth px-2 py-1 text-cloth",
  // No outline: a fill.
  due: "bg-highlight px-2.5 py-1.5 text-ink",
  // 2px dashed outline.
  "part-paid": "border-2 border-dashed border-blue px-2 py-1 text-blue",
  // Double outline, 6px so both lines show on a phone.
  paid: "border-6 border-double border-stamp px-1 py-0 text-stamp",
};

export type StatusTagProps = {
  status: Status;
  /** The words, for example "Overdue 7 days". Always shown. */
  children: ReactNode;
};

export function StatusTag({ status, children }: StatusTagProps) {
  return (
    <span data-status={status} className={cx("type-label inline-block max-w-full wrap-anywhere", marks[status])}>
      {children}
    </span>
  );
}
