// Row (docs/DESIGN.md): a ledger row. Name and a meta line on the left, an optional amount on the
// right with an optional trailing item (round action or small stamp), or a status tag in place of
// the amount. Every word is passed in.
import { isValidElement, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import { StatusTag } from "./status-tag";

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

type RowBase = {
  name: ReactNode;
  /** Says the status in words ("7 days late"). Required: tone never carries the meaning alone. */
  meta: ReactNode;
  tone: RowTone;
  /** Makes the name, meta and amount one link. */
  href?: string;
  /** Layout only. */
  className?: string;
  /** Let the amount and the trailing item wrap under the name when the row is too narrow (a small card at large text). */
  wrap?: boolean;
};

// A row has an amount (with an optional action or small stamp), or a status tag, never both:
// together they squeeze the name into a sliver at large text sizes, and no screen on the canvas
// combines them (spec F2, criterion 94). A screen that needs both says the status in the meta line.
type WithAmount = {
  /** Already formatted, for example "₹1,200". */
  amount?: string;
  /** A round action button or a small stamp. It is a separate target from the row link. */
  trailing?: ReactNode;
  tag?: undefined;
};

type WithTag = {
  /** A StatusTag. A row with a tag has no amount and no other trailing item. */
  tag: ReactNode;
  amount?: undefined;
  trailing?: undefined;
};

export type RowProps = RowBase & (WithAmount | WithTag);

export function Row({ name, meta, tone, amount, trailing, tag, href, className, wrap = false }: RowProps) {
  // The types cannot see what is inside `trailing`, so a tag passed there beside an amount is caught here.
  if (process.env.NODE_ENV !== "production" && amount != null && isValidElement(trailing) && trailing.type === StatusTag) {
    console.error("Row: a row does not carry both an amount and a status tag. Pass the tag as `tag` and leave out `amount`, or say the status in `meta`.");
  }
  const last = tag ?? trailing;
  const main = (
    <>
      <span className={cx("flex flex-1 flex-col", wrap ? "min-w-20" : "min-w-0")}>
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
  const mainClass = cx(
    "flex min-h-tap min-w-0 items-center gap-2 self-stretch py-2",
    wrap ? "flex-auto flex-wrap gap-y-1" : "flex-1",
  );
  return (
    <li className={cx("flex min-h-row items-center gap-2 border-b border-rule", wrap && "flex-wrap gap-y-0", className)}>
      {href !== undefined ? (
        <a href={href} className={cx(mainClass, "ring:ground-ring")}>
          {main}
        </a>
      ) : (
        <div className={mainClass}>{main}</div>
      )}
      {last != null ? <span className={cx("flex shrink-0 items-center", wrap && "ml-auto")}>{last}</span> : null}
    </li>
  );
}
