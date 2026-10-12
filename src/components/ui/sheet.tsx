"use client";

// Sheet (docs/DESIGN.md): a bottom sheet on the dark ground. A native modal <dialog>: the browser
// moves focus in, keeps it in, makes the page behind inert, closes on Escape and returns focus.
// Every word is passed in.
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from "react";

export type SheetContext = {
  /** A small label on the dark ground, for example the batch and month. */
  label: ReactNode;
  /** A title on the dark ground, for example the student's name. */
  title: ReactNode;
};

export type SheetFrameProps = {
  title: ReactNode;
  /** The id given to the title, so the dialog can be named by it. */
  titleId: string;
  /** The words on the close control: "Cancel", "Close". */
  closeLabel: ReactNode;
  onClose?: () => void;
  context?: SheetContext;
  children: ReactNode;
};

/** What is drawn inside the sheet: the context header on the dark ground, then the slip panel. */
export function SheetFrame({ title, titleId, closeLabel, onClose, context, children }: SheetFrameProps) {
  return (
    // Rings inside the dark area are yellow; the panel below resets to paper.
    <div className="on-dark-ground flex h-full min-h-0 flex-col justify-end bg-sheet-ground">
      {context ? (
        // At most 60% of the sheet and scrolls inside itself: a very long name at the largest text would otherwise take the whole screen and leave the panel, and its buttons, no room.
        <div className="max-h-3/5 shrink-0 overflow-y-auto px-6 pt-6 pb-4 text-on-cloth">
          <p className="type-label wrap-anywhere">{context.label}</p>
          <p className="type-headline mt-1 text-3xl wrap-anywhere">{context.title}</p>
        </div>
      ) : null}
      {/* The panel scrolls inside itself when its content is taller than the screen. */}
      <div className="on-paper-ground flex min-h-0 flex-col overflow-y-auto overscroll-contain border-t-2 border-ink bg-slip text-ink">
        {/* Sticky, so the close control stays reachable while the content scrolls. */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 bg-slip px-5 pt-4 pb-2">
          <h2 id={titleId} className="type-headline min-w-0 py-1.5 text-3xl wrap-anywhere">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="type-control-sm min-h-tap shrink-0 px-1 underline ring:ground-ring"
          >
            {closeLabel}
          </button>
        </div>
        <div className="px-5 pt-2 pb-6">{children}</div>
      </div>
    </div>
  );
}

export type SheetProps = {
  /** Opening focuses the close control, or the element inside marked `data-autofocus` if there is one. */
  open: boolean;
  /**
   * Called once however the sheet closes: the close control, Escape, or the phone's back gesture.
   * The screen must then set `open` to false. A screen that ignores this and leaves `open` true ends
   * up with a closed native dialog that cannot be reopened, because `open` never changes again.
   */
  onClose: () => void;
  title: ReactNode;
  closeLabel: ReactNode;
  context?: SheetContext;
  children: ReactNode;
};

export function Sheet({ open, onClose, title, closeLabel, context, children }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // How many `close` events are on their way that this component caused itself by tidying up.
  const ownCloses = useRef(0);

  // Keep the native dialog in step with the `open` prop.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // showModal() focuses the first control, which is the close control. A screen that wants the
      // cursor somewhere else marks that element `data-autofocus`. (The `autoFocus` prop cannot do
      // this: React writes no autofocus attribute when it draws in the browser, so the dialog never sees it.)
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  // If the sheet is removed while it is open, close it first. Closing is what makes the browser
  // hand focus back to the control that opened it and let the page behind be used again.
  //
  // In development React StrictMode runs this cleanup once on a sheet that is staying: it cleans up,
  // then sets up again, and the effect above reopens the dialog. The browser sends the `close` event
  // for that first close a moment later, after the dialog is open again. That event is ours, not the
  // person's, so it is counted here and skipped when it arrives.
  useLayoutEffect(() => {
    const el = dialog.current;
    return () => {
      if (el?.open) {
        ownCloses.current += 1;
        el.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // Every way of closing ends in the native `close` event. When the screen itself set open to
      // false there is nothing to report back.
      onClose={() => {
        if (ownCloses.current > 0) {
          ownCloses.current -= 1;
          return;
        }
        if (open) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-sheet-ground p-0 backdrop:bg-sheet-ground"
    >
      {open ? (
        <SheetFrame
          title={title}
          titleId={titleId}
          closeLabel={closeLabel}
          context={context}
          onClose={() => dialog.current?.close()}
        >
          {children}
        </SheetFrame>
      ) : null}
    </dialog>
  );
}
