// SelectField: one choice from a list, written on a line like a Field. Every word is passed in.
//
// A native <select> cannot wrap its own text: at a large system font on a 360px screen it cut
// "September" to "Septemb". So the select is real but its text is not what you see. The chosen
// option's label is drawn in a span that wraps, with a small chevron beside it, and the <select>
// itself lies over the whole line, fully transparent. It takes the tap, the keyboard and the screen
// reader, and the phone opens its own list. Do not "simplify" this back to a visible select.
//
// Controlled only: the visible name is found from `value`. No state and no client directive.
import { useId, type ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { DataAttributes } from "@/lib/data-attributes";

export type SelectOption = { value: string; label: string };

export type SelectFieldProps = DataAttributes & {
  label: ReactNode;
  /** The chosen option's value. One is always chosen. */
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Shown beneath. */
  helper?: ReactNode;
  id?: string;
  disabled?: boolean;
};

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="ml-2 size-6 shrink-0 text-ink"
    >
      <path d="M5 9l7 7 7-7" />
    </svg>
  );
}

export function SelectField(props: SelectFieldProps) {
  const { label, value, onChange, options, helper, id: givenId, disabled = false, ...data } = props;
  const autoId = useId();
  const id = givenId ?? autoId;
  const noteId = `${id}-note`;
  const chosen = options.find((option) => option.value === value);
  return (
    <div className="group/field flex flex-col">
      <label htmlFor={id} className="type-label text-ink-label wrap-anywhere group-typing/field:text-blue">
        {label}
      </label>
      {/* The line. It has a minimum height, not a fixed one: a long name at a large font takes a second line. */}
      <div
        className={cx(
          "relative grid min-h-control grid-cols-[minmax(0,1fr)_auto] items-center field-line-2 group-typing/field:field-line-4 group-typing/field:border-blue",
          // Unavailable is a dashed line as well as a paler value, never the colour alone.
          disabled ? "border-dashed border-ink-label" : "border-ink",
        )}
      >
        {/* Hidden from screen readers, with the chevron: the select below already says the chosen name. */}
        <span aria-hidden="true" data-select-shown="" className={cx("type-value min-w-0 py-2 wrap-anywhere", disabled ? "text-ink-soft" : "text-blue")}>
          {chosen?.label}
        </span>
        <Chevron />
        <select
          {...data}
          id={id}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.value)}
          aria-describedby={helper != null ? noteId : undefined}
          // The thick blue line and blue label are the focus indicator, as on Field, so the default
          // outline is not needed: at opacity 0 it draws nothing anyway. The type role keeps the
          // control's own text at 20px, which stops iOS zooming the page when the list opens.
          className={cx("type-value absolute inset-0 size-full appearance-none opacity-0", disabled ? "cursor-not-allowed" : "cursor-pointer")}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {helper != null ? (
        <p id={noteId} className="type-caption mt-1 text-ink-soft wrap-anywhere">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
