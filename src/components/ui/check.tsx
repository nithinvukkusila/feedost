// Check (docs/DESIGN.md "Check", added by spec R1-8): one tick box in a list, for choosing several rows.
// A real <input type="checkbox"> inside its <label>, so the browser gives Space, the group of rows and the
// spoken "checked". Selected is a word and a mark, never colour alone: the box holds a tick and the line
// beside it says the word. The whole row is the target, 44px at least, and it grows with its words.
// No state here and no client directive: the look comes from :checked. Every word is passed in.
import type { ReactNode } from "react";
import type { DataAttributes } from "@/lib/data-attributes";

export type CheckProps = DataAttributes & {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The row's own words: the name and what goes with it. They name the checkbox. */
  children: ReactNode;
  /** The word under the row's words when ticked, for example "Selected". */
  onText: ReactNode;
  /** The word when not ticked, for example "Not selected". */
  offText: ReactNode;
  id?: string;
};

const box =
  "peer relative size-7 shrink-0 cursor-pointer appearance-none rounded-sm border-2 border-ink bg-slip checked:bg-ink ring:ground-ring";

export function Check({ checked, onChange, children, onText, offText, id, ...data }: CheckProps) {
  return (
    <label className="flex min-h-tap w-full cursor-pointer items-start gap-3 py-2">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input {...data} id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.currentTarget.checked)} className={box} />
        {/* The tick sits on the box; it shows only when ticked, and it is the mark that does not rely on colour. */}
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="pointer-events-none absolute inset-0 hidden size-7 p-1 text-slip peer-checked:block" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="min-w-0">{children}</span>
        <span aria-hidden="true" className="type-caption text-ink-soft wrap-anywhere">
          {checked ? onText : offText}
        </span>
      </span>
    </label>
  );
}
