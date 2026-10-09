// Stamp (docs/DESIGN.md): a double-ring circle with its words tilted about -12 degrees.
// The only rotated thing in the app.
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export type StampSize = "sm" | "md" | "lg";
export type StampTone = "stamp" | "blue";

// Sizes are rem (52, 132 and 232px at the default text size), so the ring grows with the text.
// The word wraps at spaces inside that width. A single word too long to fit makes the circle
// larger (min-width: min-content); it is never shrunk or cut.
// Padding is kept small on purpose: the room left for the word is what decides whether the ring
// holds its token size. Measured in Chromium on macOS, PAID and SENT have 15 to 24 percent to spare
// in the small ring and 11 to 21 percent in the medium one, so the ring does not change size when a
// platform sets the same word a few pixels wider.
const rings: Record<StampSize, string> = {
  sm: "w-13 min-w-min border-3",
  md: "w-33 min-w-min border-5 p-1",
  lg: "w-58 min-w-min border-8 p-3",
};

const words: Record<StampSize, string> = {
  sm: "text-sm",
  md: "text-4xl",
  lg: "text-6xl",
};

const tones: Record<StampTone, string> = {
  stamp: "border-stamp text-stamp",
  blue: "border-blue text-blue",
};

// The small stamp has no room for a second line at 14px, so the type does not allow one.
type Sized =
  | { size: "sm"; secondLine?: undefined }
  | { size: "md" | "lg"; /** A date, or "1 of 5". */ secondLine?: ReactNode };

// Either say what the stamp means, or mark it decorative when the same words are beside it.
type Named = { label: string; decorative?: false } | { decorative: true; label?: undefined };

export type StampProps = Sized &
  Named & {
    tone: StampTone;
    /** The word: PAID, SENT, ALL PAID. */
    children: ReactNode;
    /** Play the landing once (200ms). Off by default; never plays under reduced motion. */
    animate?: boolean;
  };

export function Stamp(props: StampProps) {
  const { size, tone, children, secondLine, animate = false } = props;
  const naming = props.decorative
    ? ({ "aria-hidden": "true" } as const)
    : ({ role: "img", "aria-label": props.label } as const);
  // The ring is not rotated: a circle looks the same at any angle, and a rotated box is wider than the
  // circle drawn in it, which would add sideways scroll beside a large stamp. Only the words tilt.
  return (
    <span
      {...naming}
      data-size={size}
      className={cx(
        "inline-flex aspect-square shrink-0 items-center justify-center rounded-full border-double",
        rings[size],
        tones[tone],
        animate && "stamp-land",
      )}
    >
      <span className={cx("flex -rotate-12 flex-col items-center text-center", animate && "stamp-settle")}>
        <span className={cx("type-stamp", words[size])}>{children}</span>
        {size !== "sm" && secondLine != null ? <span className="type-label mt-1">{secondLine}</span> : null}
      </span>
    </span>
  );
}
