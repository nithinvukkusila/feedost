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

export function SearchIcon() {
  return (
    <svg {...base} strokeWidth={2.2} className="size-5 shrink-0">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </svg>
  );
}
