// The loading state of every app screen (canvas "State-loading"): grey blocks where the page will be,
// and the words "Opening your book…" in a bar at the foot. Never a spinner alone. The blocks carry no
// meaning, so a screen reader hears only the words.
import type { ReactNode } from "react";

const block = "bg-tab-idle";
const rowWidths = ["w-30", "w-38", "w-25", "w-35", "w-29"];

/** The grey blocks, with `footer` (the words, or an error banner) pinned to the bottom of the screen. */
export function BookBlocks({ footer }: Readonly<{ footer: ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-page">
      <div aria-hidden="true" className="flex flex-1 flex-col">
        <section className="flex flex-col gap-2.5 px-5 pt-5">
          <div className={`${block} h-14 w-58`} />
          <div className={`${block} h-4 w-42`} />
          <div className={`${block} mt-1.5 h-6`} />
          <div className="mt-2 h-14 rounded-sm border-2 border-rule" />
        </section>
        <div className="mx-4 mt-6 flex-1 border-2 border-b-0 border-ink bg-slip px-3">
          {rowWidths.map((width) => (
            <div key={width} className="flex h-16 items-center gap-2.5 border-b border-rule">
              <div className="flex flex-1 flex-col gap-2">
                <div className={`${block} h-4 ${width}`} />
                <div className={`${block} h-3 w-22 opacity-60`} />
              </div>
              <div className={`${block} h-4 w-13`} />
              <div className="size-12 shrink-0 rounded-full border-2 border-rule" />
            </div>
          ))}
        </div>
      </div>
      {footer}
    </div>
  );
}

export function LoadingBook({ label }: Readonly<{ label: string }>) {
  return (
    <BookBlocks
      footer={
        <p role="status" className="type-body flex min-h-16 items-center justify-center border-t-2 border-ink bg-slip px-4 py-2 text-center font-bold text-ink-soft">
          {label}
        </p>
      }
    />
  );
}
