"use client";

// Field (docs/DESIGN.md): a label above, the value written on a line, no box.
// States: empty, typing (focused), correct, needs fixing. Every word is passed in.
//
// The control is a one-row <textarea>, not an <input>: a single-line input cuts off a value wider
// than itself, and the value here can be the UPI ID money is sent to. The textarea wraps a long
// value onto more lines and the field grows. It still behaves as a single-value text control:
// Enter submits the form and never adds a line, and pasted line breaks become spaces.
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "@/lib/cx";

export type FieldState = "idle" | "correct" | "error";

// The words for "correct" or "needs fixing" are required whenever the field is in that state,
// so the tick or the error mark is never the only signal.
type Stated =
  | { state?: "idle"; stateLabel?: undefined }
  | { state: "correct" | "error"; stateLabel: string };

type Native = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "className" | "style" | "children" | "aria-invalid" | "aria-multiline" | "rows" | "cols" | "wrap" | "value" | "defaultValue"
>;

export type FieldProps = Stated & {
  label: ReactNode;
  /** Shown beneath in the correct and needs-fixing states. In needs fixing it says how to fix it. */
  message?: ReactNode;
  /** Shown beneath when there is no message. */
  helper?: ReactNode;
  /** Controlled value. One line of text: line breaks are never kept. */
  value?: string;
  /** Starting value when the field is not controlled. */
  defaultValue?: string;
} & Native;

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

// The text box shared by the control and its mirror: they must wrap at exactly the same places.
const textBox =
  "type-value col-start-1 row-start-1 min-h-tap min-w-0 py-2 whitespace-pre-wrap wrap-anywhere";

/** A field holds one line of text however it arrives: line breaks become single spaces. */
export function oneLine(text: string): string {
  return /[\r\n]/.test(text) ? text.replace(/[ \t]*[\r\n]+[ \t]*/g, " ") : text;
}

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
      className="col-start-2 row-start-1 ml-2 size-6 shrink-0 self-center text-stamp"
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
      className="col-start-2 row-start-1 ml-2 size-6 shrink-0 self-center text-cloth"
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
    value,
    defaultValue,
    placeholder,
    id: givenId,
    "aria-describedby": describedBy,
    onChange,
    onKeyDown,
    ...control
  } = props;
  const autoId = useId();
  const id = givenId ?? autoId;
  const noteId = `${id}-note`;
  // One slot beneath: the message when the state has one, the helper otherwise.
  const showMessage = state !== "idle" && message != null;
  const note = showMessage ? message : helper;
  const hasNote = note != null;

  const controlled = value !== undefined;
  const element = useRef<HTMLTextAreaElement>(null);
  // What the control currently shows, when the screen does not hold the value itself.
  const [typed, setTyped] = useState(() => oneLine(defaultValue ?? ""));
  const shown = controlled ? oneLine(value) : typed;

  // The browser may have filled or restored the value before this code ran.
  useEffect(() => {
    const el = element.current;
    if (!controlled && el && el.value !== typed) setTyped(oneLine(el.value));
    // Runs once, on arrival in the browser.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    const clean = oneLine(el.value);
    if (clean !== el.value) el.value = clean;
    if (!controlled) setTyped(clean);
    onChange?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);
    // Enter does what it does in a single-line field: it submits the form. It never adds a line.
    // (While an IME is composing, Enter belongs to the IME.)
    if (event.key !== "Enter" || event.defaultPrevented || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

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
      {/* The line. Column one holds the value, column two the tick or error mark beside it. */}
      <div
        className={cx(
          "grid min-h-control grid-cols-[minmax(0,1fr)_auto] group-typing/field:field-line-4 group-typing/field:border-blue",
          line[state],
        )}
      >
        {/*
          An invisible copy of the value in the same grid cell as the control. It wraps as the control
          does and sets the cell's height, so the control grows with its value by layout alone and
          stays right when the width or the font changes. The zero-width space keeps one line of
          height when there is nothing to copy.
        */}
        <span aria-hidden="true" data-field-mirror="" className={cx(textBox, "invisible")}>
          {shown === "" ? placeholder : shown}
          {"​"}
        </span>
        <textarea
          {...control}
          ref={element}
          id={id}
          rows={1}
          value={controlled ? shown : undefined}
          defaultValue={controlled ? undefined : oneLine(defaultValue ?? "")}
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          // One line of text that happens to wrap: tell screen readers it is not a multi-line box.
          aria-multiline="false"
          aria-invalid={state === "error" ? "true" : undefined}
          aria-describedby={cx(describedBy, hasNote && noteId) || undefined}
          // The thick blue line and blue label are the focus indicator, so the default outline is removed.
          className={cx(
            textBox,
            "block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:font-normal placeholder:text-ink-label group-typing/field:text-blue",
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
