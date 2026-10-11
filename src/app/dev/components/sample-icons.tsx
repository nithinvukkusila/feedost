// A few inline icons for the examples. No icon library; real screens bring their own.
// The four bottom-nav icons live in src/components/app/nav-icons.tsx.
const common = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "size-5",
  focusable: false,
} as const;

/** A message on its way: used on "send" buttons. */
export function SendIcon() {
  return (
    <svg {...common}>
      <path d="M21 3 10 14" />
      <path d="M21 3l-7 18-4-7-7-4 18-7z" />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg {...common}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg {...common}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

/** A message: on "Send receipt" in the undo banner, as on the canvas. */
export function MessageIcon() {
  return (
    <svg {...common} strokeWidth={2.2}>
      <path d="M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1h-8l-5 4v-4H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  );
}
