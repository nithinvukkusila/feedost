"use client";

// Field (docs/DESIGN.md): a label above, the value written on a line, no box.
// States: empty, typing (focused), correct, needs fixing. Every word is passed in.
//
// The control is a one-row <textarea>, not an <input>: a single-line input cuts off a value wider
// than itself, and the value here can be the UPI ID money is sent to. The textarea wraps a long
// value onto more lines and the field grows. It still behaves as a single-value text control:
// Enter submits the form and never adds a line, and pasted line breaks become spaces.
// Enter submits through the form: the submit button's own click handler does not run. A screen
// must do its saving in the form's onSubmit, not in the button's onClick.
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
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
  /** The control itself, for example to focus it. */
  ref?: Ref<HTMLTextAreaElement>;
  /**
   * For a value that is always Latin letters and digits, such as an amount or a UPI ID: the typed
   * value and the placeholder are drawn in the Latin face whatever the page language. The label,
   * the helper and the message keep the page's own face. Leave it off for names and other words.
   */
  latinValue?: boolean;
  /**
   * For a number read digit by digit, such as the UPI reference on the parent's claim sheet: the typed value and the
   * placeholder are drawn larger in the mono face (DM Mono, 0-9 digits) whatever the page language. Wins over
   * `latinValue`. The label, the helper and the message keep the page's own face.
   */
  monoValue?: boolean;
  /**
   * Set to draw a single-line <input> of this type (for example "tel") instead of the wrapping
   * textarea. Same line, label, states and tokens. A value wider than the line scrolls, so use it
   * only for short values such as a phone number. Leave it off for everything else.
   */
  type?: "tel" | "text";
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
const textBox = "col-start-1 row-start-1 min-h-tap min-w-0 py-2 whitespace-pre-wrap wrap-anywhere";

/** A field holds one line of text however it arrives: line breaks become single spaces. */
export function oneLine(text: string): string {
  return /[\r\n]/.test(text) ? text.replace(/[ \t]*[\r\n]+[ \t]*/g, " ") : text;
}

type Submitter = HTMLButtonElement | HTMLInputElement;

/**
 * What Enter does in a single-line field: it presses the form's default button, which is the first
 * submit button the form owns. `form.requestSubmit()` alone is not the same thing: it would submit
 * a form whose button is disabled.
 */
export function submitOnEnter(form: HTMLFormElement): void {
  const controls = Array.from(form.elements);
  // A Button that is working turns itself into type="button" and sets aria-busy. Enter must not
  // submit past it, or a save could be sent twice.
  if (controls.some((el) => el instanceof HTMLButtonElement && el.getAttribute("aria-busy") === "true")) return;
  const submitter = controls.find(
    (el): el is Submitter =>
      (el instanceof HTMLButtonElement && el.type === "submit") ||
      (el instanceof HTMLInputElement && (el.type === "submit" || el.type === "image")),
  );
  if (!submitter) {
    form.requestSubmit();
    return;
  }
  // `:disabled` and not `.disabled`: a button inside `<fieldset disabled>` is disabled without the property saying so.
  if (submitter.matches(":disabled") || submitter.getAttribute("aria-disabled") === "true") return;
  form.requestSubmit(submitter);
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
    ref,
    latinValue = false,
    monoValue = false,
    type: givenType,
    id: givenId,
    "aria-describedby": describedBy,
    onChange,
    onKeyDown,
    ...control
  } = props;
  // Only the two documented types draw an <input>; anything else is ignored, as before.
  const inputType = givenType === "tel" || givenType === "text" ? givenType : undefined;
  const autoId = useId();
  const id = givenId ?? autoId;
  const noteId = `${id}-note`;
  // One slot beneath: the message when the state has one, the helper otherwise.
  const showMessage = state !== "idle" && message != null;
  const note = showMessage ? message : helper;
  const hasNote = note != null;
  // One role or the other, never both: the two differ only in the face, and the control and its copy share it.
  const valueRole = monoValue ? "type-value-mono" : latinValue ? "type-value-latin" : "type-value";

  const controlled = value !== undefined;
  const element = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  // What the control currently shows, when the screen does not hold the value itself. The invisible
  // copy below is drawn from this, so it must follow every way the control's value can change.
  const [typed, setTyped] = useState(() => oneLine(defaultValue ?? ""));
  const shown = controlled ? oneLine(value) : typed;

  /** Bring the copy back in step with what the control really holds. */
  function sync() {
    const el = element.current;
    if (el && !controlled) setTyped((before) => (before === el.value ? before : el.value));
  }

  // After every render, before the browser paints: covers a `defaultValue` that arrives late and a
  // value the browser filled or restored before this code ran.
  useLayoutEffect(sync);

  useEffect(() => {
    const el = element.current;
    if (!el) return;

    // A form reset changes the value without a change event. The reset event fires before the
    // values are put back, so read them a moment later. It is heard at the document, because the
    // form the field belongs to can change after the field is first drawn.
    let pending: ReturnType<typeof setTimeout> | undefined;
    const onReset = (event: Event) => {
      if (event.target === el.form) pending = setTimeout(sync, 0);
    };
    document.addEventListener("reset", onReset);

    // Script that assigns `el.value = ...` fires no event at all. Watch the assignment itself, by
    // wrapping the element's own `value` accessor (React's own, when it has one) and passing through.
    const inherited =
      Object.getOwnPropertyDescriptor(el, "value") ?? Object.getOwnPropertyDescriptor(inputType ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype, "value");
    const hadOwn = Object.prototype.hasOwnProperty.call(el, "value");
    if (inherited?.get && inherited.set) {
      const { get, set } = inherited;
      Object.defineProperty(el, "value", {
        configurable: true,
        enumerable: inherited.enumerable,
        get() {
          return get.call(el);
        },
        set(next: string) {
          set.call(el, next);
          sync();
        },
      });
    }

    // A last net for anything else (setRangeText, an extension): look again when focus arrives and leaves.
    el.addEventListener("focusin", sync);
    el.addEventListener("focusout", sync);

    return () => {
      if (pending !== undefined) clearTimeout(pending);
      document.removeEventListener("reset", onReset);
      el.removeEventListener("focusin", sync);
      el.removeEventListener("focusout", sync);
      if (inherited && hadOwn) Object.defineProperty(el, "value", inherited);
      else if (inherited) delete (el as { value?: string }).value;
    };
    // The listeners belong to the element, which lives as long as the field does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    const dirty = el.value;
    const clean = oneLine(dirty);
    // An <input> never holds a line break, and its caret cannot be read for a "tel" type.
    if (clean !== dirty && !inputType) {
      // Keep the caret where the person is typing: "abc|def" plus a pasted "X\nY" ends after the Y.
      const caret = oneLine(dirty.slice(0, el.selectionStart)).length;
      el.value = clean;
      el.setSelectionRange(caret, caret);
    }
    if (!controlled) setTyped(clean);
    onChange?.(event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);
    if (event.key !== "Enter" || event.defaultPrevented) return;
    // While an IME is composing, Enter belongs to the IME. Safari reports the Enter that ends a
    // composition with keyCode 229 and isComposing already false.
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    // Enter never adds a line. In a form it does what it does in a single-line field.
    event.preventDefault();
    const form = event.currentTarget.form;
    if (form) submitOnEnter(form);
  }

  // Stable for as long as the caller's ref is the same, so React does not detach and re-attach the
  // caller's ref on every render.
  const attach = useCallback(
    (el: HTMLTextAreaElement | HTMLInputElement | null) => {
      element.current = el;
      if (typeof ref === "function") return ref(el as HTMLTextAreaElement | null);
      if (ref) ref.current = el as HTMLTextAreaElement | null;
    },
    [ref],
  );

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
          height when there is nothing to copy. See sync() for how the copy follows the control.
        */}
        {inputType ? null : (
        <span
          aria-hidden="true"
          data-field-mirror=""
          // The copy holds whatever is typed, which can be a phone number or a UPI ID. Keep it out of
          // page translation, PostHog session replay and Sentry replay, as the control itself is.
          translate="no"
          data-ph-no-capture=""
          data-sentry-mask=""
          className={cx(valueRole, textBox, "invisible")}
        >
          {shown === "" ? placeholder : shown}
          {"​"}
        </span>
        )}
        {inputType ? (
          <input
            enterKeyHint="done"
            {...(control as object)}
            type={inputType}
            ref={attach}
            id={id}
            value={controlled ? shown : undefined}
            defaultValue={controlled ? undefined : oneLine(defaultValue ?? "")}
            placeholder={placeholder}
            onChange={handleChange as unknown as (event: ChangeEvent<HTMLInputElement>) => void}
            onKeyDown={handleKeyDown as unknown as (event: KeyboardEvent<HTMLInputElement>) => void}
            aria-invalid={state === "error" ? "true" : undefined}
            aria-describedby={cx(describedBy, hasNote && noteId) || undefined}
            className={cx(
              valueRole,
              textBox,
              "block w-full bg-transparent outline-none placeholder:font-normal placeholder:text-ink-label group-typing/field:text-blue",
              valueTone[state],
            )}
          />
        ) : (
        <textarea
          // The key on the phone's keyboard says "done", not "return": Enter does not add a line.
          enterKeyHint="done"
          {...control}
          ref={attach}
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
            valueRole,
            textBox,
            "block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:font-normal placeholder:text-ink-label group-typing/field:text-blue",
            valueTone[state],
          )}
        />
        )}
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
