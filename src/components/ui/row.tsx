// Row (docs/DESIGN.md): a ledger row. Name and a meta line on the left, an optional amount on the
// right, an optional trailing item (round action, small stamp or status tag). Every word is passed in.
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type RowTone = "overdue" | "due" | "paid";

// Colour only supports the meta text; the text itself always says the status in words.
const tones: Record<RowTone, string> = {
  overdue: "text-cloth",
  due: "text-ink-soft",
  paid: "text-stamp",
};

export type RowsProps = {
  children: ReactNode;
  /** Layout only. */
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

/** The list that holds rows. */
export function Rows({ children, className, ...rest }: RowsProps) {
  return (
    <ul {...rest} className={cx("flex flex-col", className)}>
      {children}
    </ul>
  );
}

export type RowProps = {
  name: ReactNode;
  /** Says the status in words ("7 days late"). Required: tone never carries the meaning alone. */
  meta: ReactNode;
  tone: RowTone;
  /** Already formatted, for example "₹1,200". */
  amount?: string;
  /** A round action button, a small stamp or a status tag. It is a separate target from the row link. */
  trailing?: ReactNode;
  /** Makes the name, meta and amount one link. */
  href?: string;
  /** Layout only. */
  className?: string;
};

export function Row({ name, meta, tone, amount, trailing, href, className }: RowProps) {
  const main = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-name wrap-anywhere">{name}</span>
        <span data-tone={tone} className={cx("type-caption font-semibold wrap-anywhere", tones[tone])}>
          {meta}
        </span>
      </span>
      {amount != null ? (
        // Digits 0-9 in DM Mono in every language; never translated.
        <span translate="no" className="type-amount-row shrink-0 whitespace-nowrap">
          {amount}
        </span>
      ) : null}
    </>
  );
  const mainClass = "flex min-h-tap min-w-0 flex-1 items-center gap-2 self-stretch py-2";
  return (
    <li className={cx("flex min-h-row items-center gap-2 border-b border-rule", className)}>
      {href !== undefined ? (
        <a href={href} className={cx(mainClass, "ring:ground-ring")}>
          {main}
        </a>
      ) : (
        <div className={mainClass}>{main}</div>
      )}
      {trailing != null ? <span className="flex shrink-0 items-center">{trailing}</span> : null}
    </li>
  );
}
