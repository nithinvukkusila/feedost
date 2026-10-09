// Banner (docs/DESIGN.md): offline (black strip), error (red outline, says what happened and what
// is safe), undo (black block, two actions). Each kind is told apart by its words and its shape,
// not by colour. Red is only ever the error's border, title and shadow: never a button.
// The banner has no timer, does not close itself and does not position itself; the screen that
// shows it decides all three. Every word is passed in.
//
// For the screen: keep one live-region wrapper mounted at all times and put the banner inside it
// when it appears. A banner that mounts together with its own role is often not announced.
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { DataAttributes } from "@/lib/data-attributes";
import { FlatButton, type FlatLook } from "./button";

export type BannerAction = {
  label: ReactNode;
  onClick?: () => void;
  /** Makes the action a link with the same look. */
  href?: string;
  /** Decorative icon before the label. */
  icon?: ReactNode;
  /** `data-*` attributes for the action's button or link. */
  attrs?: DataAttributes;
};

export type BannerProps =
  | { kind: "offline"; title: ReactNode; detail: ReactNode }
  | {
      kind: "error";
      title: ReactNode;
      /** Says what happened and what is safe. */
      detail: ReactNode;
      /** None, one or two. The first is the main action (black); the second is outlined. */
      actions?: readonly [] | readonly [BannerAction] | readonly [BannerAction, BannerAction];
    }
  | {
      kind: "undo";
      message: ReactNode;
      /** The first is outlined ("Undo"); the second is filled and takes the spare width. */
      actions: readonly [BannerAction, BannerAction];
    };

// The wifi-with-a-stroke mark of the offline strip. A picture, not a word.
function OfflineMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      className="size-6"
      focusable={false}
    >
      <path d="M3 9a14 14 0 0118 0M6.5 12.5a9 9 0 0111 0M10 16a4 4 0 014 0M4 4l16 16" />
    </svg>
  );
}

/**
 * The row of actions. A wrapping row: side by side they stretch to one height and the main action
 * takes the spare width; when both labels are too long to share a row the second drops below and
 * fills it, instead of being squeezed or cut. The lesser action is never narrower than 96px.
 */
function Actions({ actions, looks, main }: { actions: readonly BannerAction[]; looks: readonly FlatLook[]; main: number }) {
  if (actions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-stretch gap-2.5">
      {actions.map((action, index) => (
        <div key={index} className={cx("flex max-w-full min-w-24", index === main ? "grow-9999" : "grow")}>
          {action.href !== undefined ? (
            <FlatButton {...action.attrs} look={looks[index]} full icon={action.icon} href={action.href} onClick={action.onClick}>
              {action.label}
            </FlatButton>
          ) : (
            <FlatButton {...action.attrs} look={looks[index]} full icon={action.icon} onClick={action.onClick}>
              {action.label}
            </FlatButton>
          )}
        </div>
      ))}
    </div>
  );
}

export function Banner(props: BannerProps) {
  if (props.kind === "offline") {
    return (
      // A square, full-width strip. Polite: it is read out when the screen reader is idle.
      <div role="status" data-kind="offline" className="on-dark-ground flex items-center gap-3 bg-ink px-5 py-3 text-slip">
        <span aria-hidden="true" className="inline-flex shrink-0 text-highlight">
          <OfflineMark />
        </span>
        <div className="min-w-0">
          <p className="type-body font-bold wrap-anywhere">{props.title}</p>
          <p className="type-caption text-on-cloth wrap-anywhere">{props.detail}</p>
        </div>
      </div>
    );
  }
  if (props.kind === "error") {
    return (
      // Announced at once. Paper inside, so rings are blue again whatever the screen's ground.
      <div
        role="alert"
        data-kind="error"
        className="on-paper-ground flex flex-col gap-2.5 border-2 border-cloth bg-slip px-4 py-3.5 text-ink shadow-banner-error"
      >
        <div className="min-w-0">
          <p className="type-body-lg font-extrabold text-cloth wrap-anywhere">{props.title}</p>
          <p className="type-body-sm text-ink-soft wrap-anywhere">{props.detail}</p>
        </div>
        <Actions actions={props.actions ?? []} looks={["record", "outline"]} main={0} />
      </div>
    );
  }
  if (props.kind === "undo") {
    return (
      <div role="status" data-kind="undo" className="on-dark-ground flex flex-col gap-2 rounded-sm bg-ink px-4 py-3 text-slip">
        <p className="type-body font-bold wrap-anywhere">{props.message}</p>
        <Actions actions={props.actions} looks={["outline-on-dark", "slip-on-dark"]} main={1} />
      </div>
    );
  }
  // Three kinds and no others. The types stop a fourth; this is for a caller that got past them.
  return null;
}
