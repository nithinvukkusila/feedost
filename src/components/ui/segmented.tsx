// Segmented (docs/DESIGN.md): two to four choices inside one 2px bordered group; the chosen one is black.
// A native radio group: the browser gives arrow keys, one-of-many selection, "selected, 2 of 4" to
// screen readers and form submission. The chosen look comes from :checked in CSS, so there is no
// state here and no client directive. Every word is passed in.
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { DataAttributes } from "@/lib/data-attributes";

export type SegmentedOption<V extends string = string> = {
  value: V;
  label: ReactNode;
  /** A second, smaller line under the label, for example "A gentle first nudge". */
  detail?: ReactNode;
  /** `data-*` attributes for this option's radio input. */
  attrs?: DataAttributes;
};

// Two to four, by type.
type Options<V extends string> =
  | readonly [SegmentedOption<V>, SegmentedOption<V>]
  | readonly [SegmentedOption<V>, SegmentedOption<V>, SegmentedOption<V>]
  | readonly [SegmentedOption<V>, SegmentedOption<V>, SegmentedOption<V>, SegmentedOption<V>];

// Exactly one is chosen: either the screen holds the value, or it names the one to start with.
type Choice<V extends string> =
  | { value: V; onChange: (value: V) => void; defaultValue?: undefined }
  | { defaultValue: V; onChange?: (value: V) => void; value?: undefined };

export type SegmentedProps<V extends string = string> = Choice<V> & {
  /** The visible label of the group. */
  label: ReactNode;
  /** The form name the radios share. Unique among the groups in one form. */
  name: string;
  options: Options<V>;
};

// Two sit in one row. Three sit in one row while the group is at least 16rem wide, and stack when text is
// set so large that they would not fit (rem grows with the phone's text size). Four are two rows of two, and one row of four only when the group
// itself is at least 28rem wide: a fixed rule, not a measurement of the words.
const columns: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-1 @2xs:grid-cols-3",
  4: "grid-cols-2 @md:grid-cols-4",
};

// Each segment draws a 2px line on its top and left. The grid is pulled 2px up and left, so the
// group's own border hides the outer ones and only the lines between segments show, in any arrangement.
// 48px, not 44: the radio is the target and it sits inside the segment's 2px line.
const segment =
  "relative flex min-h-control min-w-0 flex-col justify-center border-t-2 border-l-2 border-ink px-2 py-2 text-ink has-[:checked]:on-dark-ground has-[:checked]:bg-ink has-[:checked]:text-slip";

// The radio fills its segment and draws nothing of its own, so the whole segment is the target and
// focusing it cannot scroll the page. The focus ring is drawn inside the segment, where the group's
// border cannot clip it: blue on an unselected segment, yellow on the selected (black) one.
const radio = "absolute inset-0 size-full cursor-pointer appearance-none rounded-none ring:ring-inset";

export function Segmented<V extends string = string>(props: SegmentedProps<V>) {
  const { label, name, options, onChange } = props;
  const twoLine = options.some((option) => option.detail != null);
  return (
    // min-w-0: a fieldset is otherwise as wide as its longest word.
    <fieldset className="min-w-0">
      <legend className="type-label mb-1.5 max-w-full text-ink-label wrap-anywhere">{label}</legend>
      <div className="@container overflow-hidden rounded-sm border-2 border-ink">
        <div className={cx("-mt-0.5 -ml-0.5 grid auto-rows-fr", columns[options.length])}>
          {options.map((option) => (
            <label
              key={option.value}
              data-segment={option.value}
              className={cx(segment, twoLine ? "items-start text-left" : "items-center text-center")}
            >
              <input
                {...option.attrs}
                type="radio"
                name={name}
                value={option.value}
                className={radio}
                {...(props.value !== undefined
                  ? { checked: props.value === option.value }
                  : { defaultChecked: props.defaultValue === option.value })}
                // No handler at all when none was given, so the group can be drawn by a server component.
                onChange={onChange ? () => onChange(option.value) : undefined}
              />
              <span className="type-control-sm max-w-full wrap-anywhere">{option.label}</span>
              {/* The space is for the accessible name ("Polite A gentle...", not "PoliteA gentle..."); it draws nothing. */}
              {option.detail != null ? " " : null}
              {option.detail != null ? <span className="type-caption max-w-full wrap-anywhere">{option.detail}</span> : null}
            </label>
          ))}
        </div>
      </div>
    </fieldset>
  );
}
