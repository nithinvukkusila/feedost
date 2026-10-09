// Switch (docs/DESIGN.md): square, 76 by 44, ON in green. A real button with role="switch".
// On and off are told apart by where the knob sits and the word on it, never by the green alone.
// The look comes from aria-checked in CSS. The knob does not animate. Every word is passed in.
import type { ReactNode } from "react";
import type { DataAttributes } from "@/lib/data-attributes";

// Either a name of its own, or the id of visible text on the screen that names it.
type Named = { label: string; labelledBy?: undefined } | { labelledBy: string; label?: undefined };

export type SwitchProps = Named &
  DataAttributes & {
    checked: boolean;
    /** Called with the opposite of `checked` on tap, Space or Enter. */
    onChange: (next: boolean) => void;
    /** The word on the knob when on, for example "ON". */
    onText: ReactNode;
    /** The word on the knob when off, for example "OFF". */
    offText: ReactNode;
    id?: string;
  };

// Sizes are minimums in rem (76 by 44px at the default text size), so the switch grows with the text.
// Off: the knob is at the left on a tab-idle track. On: at the right on a stamp-green track.
const track =
  "group/switch inline-flex min-h-tap min-w-19 shrink-0 items-stretch justify-start rounded-sm border-2 border-ink bg-tab-idle p-0.75 text-ink aria-checked:justify-end aria-checked:bg-stamp ring:ground-ring";

// The knob holds both words in one grid cell, the inactive one invisible. So it is as wide as the
// longer word, the switch grows for a long word instead of cutting or shrinking it, and its width
// does not change when it is switched. The margin on the empty side keeps 30px of track showing
// however wide the knob is: without it a long word would fill the switch and hide which side it is on.
const knob =
  "type-caption mr-7.5 grid min-w-9 items-center justify-items-center border-2 border-ink bg-slip px-0.5 font-extrabold whitespace-nowrap group-aria-checked/switch:mr-0 group-aria-checked/switch:ml-7.5";

export function Switch(props: SwitchProps) {
  const { checked, onChange, onText, offText, label, labelledBy, id, ...data } = props;
  return (
    <button
      {...data}
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={track}
    >
      {/* Hidden from screen readers: "on" is already announced from aria-checked, and "switch, on, ON" says it twice. */}
      <span aria-hidden="true" className={knob}>
        <span className="col-start-1 row-start-1 group-aria-checked/switch:invisible">{offText}</span>
        <span className="invisible col-start-1 row-start-1 group-aria-checked/switch:visible">{onText}</span>
      </span>
    </button>
  );
}
