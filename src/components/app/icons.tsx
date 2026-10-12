// The small marks the signed-in screens share. Decorative: each is hidden from screen readers and sits
// beside words, or inside a control that has its own accessible name.
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export function PlusIcon() {
  return (
    <svg {...base} strokeWidth={2.6} className="size-5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg {...base} strokeWidth={2.4} className="size-6">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function NextIcon() {
  return (
    <svg {...base} strokeWidth={2.4} className="size-6">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg {...base} strokeWidth={2.2} className="size-5 shrink-0">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}

/** A speech bubble: the mark on the button that opens WhatsApp. */
export function ChatIcon() {
  return (
    <svg {...base} strokeWidth={2.2} className="size-5.5">
      <path d="M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1h-8l-5 4v-4H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  );
}

/** A speech bubble with a tick: the mark beside "Reminded today". Always beside its words. */
export function RemindedIcon() {
  return (
    <svg {...base} strokeWidth={2.4} className="size-4.5 shrink-0">
      <path d="M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1h-8l-5 4v-4H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
      <path d="M8.5 11l2.5 2.5 4.5-5" />
    </svg>
  );
}

/** A tick: the mark beside "Opened". Always beside its words. */
export function TickIcon() {
  return (
    <svg {...base} strokeWidth={3} className="size-5 shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}
