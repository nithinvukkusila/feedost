// The four bottom-nav icons, redrawn from the canvas (Nav.dc.html): 24px, in the text colour.
const nav = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  className: "size-6",
  focusable: false,
} as const;

/** The account book. */
export function NavHomeIcon() {
  return (
    <svg {...nav}>
      <path d="M6 3h11a2 2 0 012 2v16H6a2 2 0 01-2-2V5a2 2 0 012-2zM8 3v18M11.5 9H16M11.5 13H16" />
    </svg>
  );
}

export function NavStudentsIcon() {
  return (
    <svg {...nav}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0113 0M16 4.800a3.500 3.500 0 010 6.400M18 14.200a6.500 6.500 0 013.500 5.800" />
    </svg>
  );
}

export function NavAttendanceIcon() {
  return (
    <svg {...nav}>
      <rect x="4" y="5" width="16" height="15" rx="1" />
      <path d="M4 10h16M8 3v4M16 3v4M9 15l2 2 4-4" />
    </svg>
  );
}

export function NavMoreIcon() {
  return (
    <svg {...nav}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

