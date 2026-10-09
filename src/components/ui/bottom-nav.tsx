// BottomNav (docs/DESIGN.md): Home, Students, Attendance, More. The current item has a 5px red bar
// across its top; the bar is the mark, so it reads without colour. A <nav> of plain links: the
// current look comes from aria-current in CSS. It does not position itself; the screen pins it.
// Every word is passed in.
import type { ReactNode } from "react";
import type { DataAttributes } from "@/lib/data-attributes";

export type BottomNavKey = "home" | "students" | "attendance" | "more";

export type BottomNavItem = {
  href: string;
  label: ReactNode;
  /** A 24px icon. Decorative: hidden from screen readers. */
  icon: ReactNode;
  /** `data-*` attributes for this item's link. */
  attrs?: DataAttributes;
};

export type BottomNavProps = {
  /** The name of the navigation landmark, for example "Main". */
  label: string;
  /** Named keys, not a list: the order is fixed below and a screen cannot change it. */
  items: Record<BottomNavKey, BottomNavItem>;
  current: BottomNavKey;
};

// The order the design fixes.
const order: BottomNavKey[] = ["home", "students", "attendance", "more"];

// Every item carries a 5px top bar so labels line up; it is transparent unless the item is current.
// The link fills its whole column at the bar's full height. The focus ring is drawn inside the
// item: outside, it would run off the edge of the screen or onto the neighbour.
const item =
  "type-caption flex min-h-row min-w-0 flex-col items-center justify-center gap-0.5 border-t-5 border-transparent px-0.5 pt-1 pb-1.5 text-center font-bold text-ink-label aria-[current=page]:border-cloth aria-[current=page]:text-ink ring:ring-inset";

export function BottomNav({ label, items, current }: BottomNavProps) {
  return (
    // Paper again, whatever ground the screen has: the ring inside is blue.
    <nav aria-label={label} className="on-paper-ground grid grid-cols-4 items-stretch border-t-2 border-ink bg-slip pb-safe">
      {order.map((key) => {
        const entry = items[key];
        return (
          <a key={key} {...entry.attrs} href={entry.href} data-item={key} aria-current={key === current ? "page" : undefined} className={item}>
            <span aria-hidden="true" className="inline-flex shrink-0">
              {entry.icon}
            </span>
            <span className="max-w-full wrap-anywhere">{entry.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
