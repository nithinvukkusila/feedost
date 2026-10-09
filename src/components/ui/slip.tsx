// Slip (docs/DESIGN.md): the card. Slip colour, 2px ink border, square corners, hard shadow.
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type SlipProps = {
  children: ReactNode;
  /** Sits under index tabs: no shadow, and the selected tab covers its top border. */
  joined?: boolean;
  as?: "div" | "section" | "article";
  /** Layout only (padding, margin, flex). Colours, border and shadow are fixed. */
  className?: string;
  id?: string;
  /** For example "tabpanel" when the slip is the panel under Tabs. */
  role?: string;
  tabIndex?: number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

export function Slip({ children, joined = false, as: Tag = "div", className, ...rest }: SlipProps) {
  return (
    <Tag
      {...rest}
      // A slip is paper even when it sits on cloth or the dark ground, so rings and shadows inside reset.
      className={cx("on-paper-ground border-2 border-ink bg-slip text-ink", !joined && "shadow-slip", className)}
    >
      {children}
    </Tag>
  );
}
