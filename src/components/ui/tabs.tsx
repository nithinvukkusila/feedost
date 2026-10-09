"use client";

// Tabs (called IndexTabs in docs/DESIGN.md): folder tabs joined to the slip below.
// The selected tab is taller and slip coloured. Controlled only; every word is passed in.
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "@/lib/cx";

export type TabItem = {
  id: string;
  label: ReactNode;
  /** Shown after the label, for example the number of students. */
  count?: ReactNode;
};

export type TabsProps = {
  tabs: TabItem[];
  /** The id of the selected tab. */
  value: string;
  onChange: (id: string) => void;
  /** The accessible name of the tab list. */
  label: string;
  /** The id of the panel the tabs control: the screen gives its Slip this id and role="tabpanel". */
  panelId: string;
};

/** The id of a tab's button, for the panel's aria-labelledby. */
export function tabId(panelId: string, id: string): string {
  return `${panelId}-tab-${id}`;
}

const base =
  "type-control-sm flex min-w-0 flex-wrap items-center justify-center gap-x-1.5 rounded-t-tab border-2 border-b-0 border-ink px-1 py-2 text-center ring:ground-ring";

// Selected: 48px, slip coloured, and a strip of slip colour over the slip's top border beneath it,
// which is what removes the line between the tab and the slip.
const selected =
  "relative min-h-control bg-slip text-ink after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-slip";

// Unselected: 44px. The top margin keeps it 4px shorter than the selected tab at any text size.
// Text is ink-soft: ink-label on tab-idle falls just short of AA contrast.
const idle = "mt-1 min-h-tap bg-tab-idle text-ink-soft";

export function Tabs({ tabs, value, onChange, label, panelId }: TabsProps) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  function go(index: number) {
    const next = tabs[(index + tabs.length) % tabs.length];
    onChange(next.id);
    buttons.current.get(next.id)?.focus();
  }

  // If `value` names no tab (a screen passed a stale id), the first tab stands in for the tab stop,
  // so the list can still be reached by keyboard. Nothing is shown as selected.
  const current = tabs.findIndex((t) => t.id === value);
  const stop = current === -1 ? 0 : current;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") go(current + 1);
    else if (event.key === "ArrowLeft") go(current === -1 ? tabs.length - 1 : current - 1);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(tabs.length - 1);
    else return;
    event.preventDefault();
  }

  return (
    // Equal columns, stretched: every tab shares the tallest tab's height, and long labels wrap inside.
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="grid auto-cols-fr grid-flow-col items-stretch gap-1 px-1"
    >
      {tabs.map((tab, index) => {
        const isSelected = tab.id === value;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              if (el) buttons.current.set(tab.id, el);
              else buttons.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={tabId(panelId, tab.id)}
            aria-selected={isSelected}
            aria-controls={panelId}
            tabIndex={index === stop ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cx(base, isSelected ? selected : idle)}
          >
            <span className="min-w-0 wrap-anywhere">{tab.label}</span>
            {/* The space is for the accessible name ("Overdue 5", not "Overdue5"); the gap does the spacing. */}
            {tab.count != null ? " " : null}
            {tab.count != null ? <span>{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
