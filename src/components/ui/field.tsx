// Field (docs/DESIGN.md): a label above, the value written on a line, no box.
// States: empty, typing (focused), correct, needs fixing. Every word is passed in.
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type FieldState = "idle" | "correct" | "error";

// The words for "correct" or "needs fixing" are required whenever the field is in that state,
// so the tick or the error mark is never the only signal.
type Stated =
  | { state?: "idle"; stateLabel?: undefined }
  | { state: "correct" | "error"; stateLabel: string };

export type FieldProps = Stated & {
  label: ReactNode;
  /** Shown beneath in the correct and needs-fixing states. In needs fixing it says how to fix it. */
  message?: ReactNode;
  /** Shown beneath when there is no message. */
  helper?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "style" | "children" | "aria-invalid">;

const labelTone: Record<FieldState, string> = {
  idle: "text-ink-label",
  correct: "text-stamp",
  error: "text-cloth",
};

const line: Record<FieldState, string> = {
  idle: "field-line-2 border-ink",
  correct: "field-line-2 border-stamp",
  error: "field-line-3 border-cloth",
};

const valueTone: Record<FieldState, string> = {
  idle: "text-blue",
  correct: "text-blue",
  error: "text-ink",
};

const messageTone: Record<FieldState, string> = {
  idle: "text-ink-soft",
  correct: "font-semibold text-stamp",
  error: "font-semibold text-cloth",
};

function Tick() {
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
      className="size-6 shrink-0 text-stamp"
    >
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

function ErrorMark() {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-6 shrink-0 text-cloth"
    >
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4v.1" />
    </svg>
  );
}

export function Field(props: FieldProps) {
  const {
    label,
    state = "idle",
    stateLabel,
    message,
    helper,
    id: givenId,
    "aria-describedby": describedBy,
    ...input
  } = props;
  const autoId = useId();
  const id = givenId ?? autoId;
  const noteId = `${id}-note`;
  // One slot beneath: the message when the state has one, the helper otherwise.
  const showMessage = state !== "idle" && message != null;
  const note = showMessage ? message : helper;
  const hasNote = note != null;

  return (
    <div data-state={state} className="group/field flex flex-col">
      <label
        htmlFor={id}
        className={cx("type-label wrap-anywhere group-typing/field:text-blue", labelTone[state])}
      >
        {label}
        {state === "error" ? (
          <>
            {/* A drawn dot between the label and the state words, as on the canvas. */}
            <span aria-hidden="true" className="mx-2 inline-block size-1 rounded-full bg-current align-middle" />
            <span>{stateLabel}</span>
          </>
        ) : null}
        {state === "correct" ? <span className="sr-only"> {stateLabel}</span> : null}
      </label>
      <div
        className={cx(
          "flex min-h-control items-center gap-2 group-typing/field:field-line-4 group-typing/field:border-blue",
          line[state],
        )}
      >
        <input
          {...input}
          id={id}
          aria-invalid={state === "error" ? "true" : undefined}
          aria-describedby={cx(describedBy, hasNote && noteId) || undefined}
          // The thick blue line and blue label are the focus indicator, so the default outline is removed.
          className={cx(
            "type-value min-h-tap min-w-0 flex-1 self-stretch bg-transparent outline-none placeholder:font-normal placeholder:text-ink-label group-typing/field:text-blue",
            valueTone[state],
          )}
        />
        {state === "correct" ? <Tick /> : null}
        {state === "error" ? <ErrorMark /> : null}
      </div>
      <p
        id={hasNote ? noteId : undefined}
        className={cx("type-caption reserve-line mt-1 wrap-anywhere", showMessage ? messageTone[state] : messageTone.idle)}
      >
        {note}
      </p>
    </div>
  );
}
