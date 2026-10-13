// Button and RoundButton (docs/DESIGN.md). Blue sends or pays, black records, outline is secondary.
// There is no red variant. Every word is passed in.
// FlatButton, at the end of the file, is the shadowless form that only Banner may use for now.
// No client directive and no handler of its own, so it renders from server and client components alike.
import { useId, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type ButtonVariant = "send" | "record" | "outline";

// Whole class names: Tailwind must be able to see them.
// What Button and FlatButton share: the box, the wrapping text, the 80ms move and the focus ring.
const shape =
  "inline-flex items-center justify-center gap-2 rounded-sm border-2 text-center whitespace-normal wrap-anywhere transition-transform duration-80 ease-linear motion-reduce:transition-none motion-reduce:duration-0 ring:ground-ring";

// Heights: 48px; 56px for the one big call to action on a page (the landing hero); 60px for the
// one primary action at the foot of a screen in the app (sign-in, language, setup), as the canvas draws it.
// 72px (`pay`) is the parent's Pay button on the pay page (R1-9), the one biggest action in the product.
// `compact` is 44px with smaller type and padding, for the button inside a list row (Mark paid, Receipt).
const sizes = { compact: "min-h-tap", default: "min-h-control", large: "min-h-14", xl: "min-h-15", pay: "min-h-18" } as const;
export type ButtonSize = keyof typeof sizes;

const base = `type-control px-5 py-2.5 ${shape}`;
const compactBase = `type-control-sm px-3 py-2 ${shape}`;

const rest: Record<ButtonVariant, string> = {
  send: "border-ink bg-blue text-slip shadow-button ground-shadow pressed:press-button pressed:bg-blue-pressed",
  record: "border-ink bg-ink text-slip shadow-record ground-shadow pressed:press-button",
  outline: "border-ink bg-slip text-ink shadow-button ground-shadow pressed:press-button",
};

// Not merely pale: dashed outline, no fill, no shadow, and it does not move.
const unavailable = "cursor-not-allowed border-dashed border-ink-label bg-transparent text-ink-soft";

type Shared = {
  variant: ButtonVariant;
  /** The label. */
  children: ReactNode;
  /** Decorative icon before the label. Hidden from screen readers. */
  iconStart?: ReactNode;
  /** Decorative icon after the label. Hidden from screen readers. */
  iconEnd?: ReactNode;
  disabled?: boolean;
  /** A line beneath a disabled button saying why. Tied to the button for screen readers. */
  disabledReason?: ReactNode;
  /** Fill the width of the container. */
  full?: boolean;
  /** `large` is 56px high instead of 48px; `xl` is 60px; `pay` is 72px (the pay page's Pay button). For the single main call to action on a page or screen. `compact` is 44px, for a button inside a list row. */
  size?: ButtonSize;
};

// `busyLabel` is required whenever `busy` can be true.
type Busy = { busy?: false; busyLabel?: ReactNode } | { busy: boolean; busyLabel: ReactNode };

type Own = keyof Shared | "busy" | "busyLabel" | "className" | "style";

type AsButton = { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, Own>;
type AsLink = { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, Own | "href">;

export type ButtonProps = Shared & Busy & (AsButton | AsLink);

export function Button(props: ButtonProps) {
  const {
    variant,
    children,
    iconStart,
    iconEnd,
    disabled = false,
    disabledReason,
    full = false,
    size = "default",
    busy = false,
    busyLabel,
    ...native
  } = props;
  const reasonId = useId();
  const showReason = disabled && disabledReason != null;
  const working = busy && !disabled;

  const className = cx(size === "compact" ? compactBase : base, sizes[size], disabled ? unavailable : rest[variant], full && "w-full");
  const describedBy = cx(native["aria-describedby"], showReason && reasonId) || undefined;
  const content = (
    <>
      {iconStart && !working ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {iconStart}
        </span>
      ) : null}
      <span className="min-w-0">{working ? busyLabel : children}</span>
      {iconEnd && !working ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {iconEnd}
        </span>
      ) : null}
    </>
  );

  let control: ReactNode;
  if (native.href !== undefined) {
    const { href, onClick, ...link } = native;
    control =
      disabled || working ? (
        // A link that cannot be followed has no href. While working it keeps its place in the tab order,
        // so focus is not lost; its click handler is dropped so it cannot fire twice.
        <a
          {...link}
          role="link"
          aria-disabled="true"
          aria-busy={working ? "true" : undefined}
          aria-describedby={describedBy}
          tabIndex={working ? 0 : undefined}
          className={className}
        >
          {content}
        </a>
      ) : (
        <a {...link} href={href} onClick={onClick} aria-describedby={describedBy} className={className}>
          {content}
        </a>
      );
  } else {
    const { type, onClick, href: _none, ...button } = native;
    void _none;
    control = (
      <button
        {...button}
        // While working the button stays focusable but does nothing: no handler, and it cannot submit a form.
        type={working ? "button" : (type ?? "button")}
        onClick={working ? undefined : onClick}
        disabled={disabled}
        aria-busy={working ? "true" : undefined}
        aria-disabled={working ? "true" : undefined}
        aria-describedby={describedBy}
        className={className}
      >
        {content}
      </button>
    );
  }

  if (!showReason) return control;
  return (
    <span className={cx("flex-col gap-2", full ? "flex w-full" : "inline-flex")}>
      {control}
      <span id={reasonId} className="type-caption min-w-0 text-ink-soft wrap-anywhere">
        {disabledReason}
      </span>
    </span>
  );
}

const round =
  "inline-flex size-control shrink-0 items-center justify-center rounded-full border-2 border-ink bg-blue text-slip shadow-round ground-shadow transition-transform duration-80 ease-linear motion-reduce:transition-none motion-reduce:duration-0 pressed:press-round pressed:bg-blue-pressed ring:ground-ring";

type RoundShared = {
  /** The accessible name. Required: the button shows only an icon. */
  label: string;
  icon: ReactNode;
};

type RoundOwn = keyof RoundShared | "children" | "className" | "style" | "aria-label";

export type RoundButtonProps = RoundShared &
  (
    | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, RoundOwn>)
    | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, RoundOwn | "href">)
  );

/** The 48px round action in a ledger row. Send colours, 3px shadow. */
export function RoundButton(props: RoundButtonProps) {
  const { label, icon, ...native } = props;
  const content = (
    <span aria-hidden="true" className="inline-flex">
      {icon}
    </span>
  );
  if (native.href !== undefined) {
    return (
      <a {...native} aria-label={label} className={round}>
        {content}
      </a>
    );
  }
  const { type, href: _none, ...button } = native;
  void _none;
  return (
    <button {...button} type={type ?? "button"} aria-label={label} className={round}>
      {content}
    </button>
  );
}

/**
 * The looks a flat button has. `record` and `outline` sit on paper (the error banner);
 * the two `-on-dark` looks sit on ink (the undo banner). None is red, blue or green.
 */
export type FlatLook = "record" | "outline" | "outline-on-dark" | "slip-on-dark";

const flatLooks: Record<FlatLook, string> = {
  record: "border-ink bg-ink text-slip",
  outline: "border-ink bg-transparent text-ink",
  "outline-on-dark": "border-slip bg-transparent text-slip",
  "slip-on-dark": "border-slip bg-slip text-ink",
};

// 16px text, as the canvas draws the buttons inside banners, and a 2px move: there is no shadow to move into.
const flatBase = `type-body min-h-control px-3 py-2 font-bold pressed:press-flat ${shape}`;

type FlatShared = {
  look: FlatLook;
  /** The label. */
  children: ReactNode;
  /** Decorative icon before the label. Hidden from screen readers. */
  icon?: ReactNode;
  /** Fill the width of the container. */
  full?: boolean;
};

type FlatOwn = keyof FlatShared | "className" | "style" | "disabled";

export type FlatButtonProps = FlatShared &
  (
    | ({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, FlatOwn>)
    | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, FlatOwn | "href">)
  );

/**
 * A button with no shadow, for inside a Banner. Pressed, it moves 2px in the same 80ms.
 * It has no busy and no disabled form.
 *
 * NOT for screens yet (spec F2, open question 6: the flat and green buttons on the canvas are
 * undecided). It is exported only because Banner lives in another file; a unit test fails if
 * anything but Banner and the dev page imports it.
 */
export function FlatButton(props: FlatButtonProps) {
  const { look, children, icon, full = false, ...native } = props;
  const className = cx(flatBase, flatLooks[look], full && "w-full");
  const content = (
    <>
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0">{children}</span>
    </>
  );
  if (native.href !== undefined) {
    return (
      <a {...native} className={className}>
        {content}
      </a>
    );
  }
  const { type, href: _none, ...button } = native;
  void _none;
  return (
    <button {...button} type={type ?? "button"} className={className}>
      {content}
    </button>
  );
}
