// A few inline icons for the examples. No icon library; real screens bring their own.
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
