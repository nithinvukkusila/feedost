// WCAG 2 contrast, and the colour pairs the design-system components put together.

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a six-digit hex colour: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => channel(parseInt(h, 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type Pair = { fg: string; bg: string; use: string };

/** Text on a ground: must reach 4.5:1. Names are colour tokens. */
export const textPairs: Pair[] = [
  { fg: "ink", bg: "page", use: "reading text on the app ground" },
  { fg: "ink", bg: "slip", use: "reading text, outline button, selected tab, switch knob word, current bottom-nav item" },
  { fg: "ink-soft", bg: "page", use: "secondary text, disabled button label" },
  { fg: "ink-soft", bg: "slip", use: "row meta (due), helper text, disabled button label, error banner detail, strip legend (due)" },
  { fg: "ink-soft", bg: "tab-idle", use: "unselected tab label and count" },
  { fg: "ink-label", bg: "page", use: "field label, placeholder" },
  { fg: "ink-label", bg: "slip", use: "field label, placeholder, idle bottom-nav label, segmented legend" },
  { fg: "blue", bg: "page", use: "amount, field value while typing" },
  { fg: "blue", bg: "slip", use: "amount, part-paid tag, sent stamp" },
  { fg: "cloth", bg: "page", use: "needs-fixing label and message" },
  { fg: "cloth", bg: "slip", use: "overdue tag, overdue row meta, error banner title, strip legend (overdue)" },
  { fg: "stamp", bg: "page", use: "correct message, paid stamp" },
  { fg: "stamp", bg: "slip", use: "paid tag, paid row meta, paid stamp" },
  { fg: "slip", bg: "blue", use: "send button, round button" },
  { fg: "slip", bg: "blue-pressed", use: "send button while pressed" },
  { fg: "slip", bg: "ink", use: "record button, selected segment, offline and undo banner text" },
  { fg: "ink", bg: "highlight", use: "due tag" },
  { fg: "on-cloth", bg: "cloth", use: "text on cloth" },
  { fg: "on-cloth-soft", bg: "cloth", use: "secondary text on cloth" },
  { fg: "on-cloth", bg: "sheet-ground", use: "sheet context header" },
  // The five F2b components.
  { fg: "on-cloth", bg: "ink", use: "offline banner detail" },
];

/** Focus rings and outlines that carry meaning: must reach 3:1. */
export const markPairs: Pair[] = [
  { fg: "blue", bg: "page", use: "focus ring on the app ground" },
  { fg: "blue", bg: "slip", use: "focus ring on a slip, inset on a segment and a bottom-nav item; part-paid dashed outline; typing line" },
  { fg: "highlight", bg: "cloth", use: "focus ring on cloth" },
  { fg: "highlight", bg: "blue", use: "focus ring on blue" },
  { fg: "highlight", bg: "ink", use: "focus ring on black: selected segment (inset), undo banner actions; offline banner mark" },
  { fg: "highlight", bg: "sheet-ground", use: "focus ring in the sheet header" },
  { fg: "ink", bg: "page", use: "2px borders, empty field line" },
  { fg: "ink", bg: "slip", use: "2px borders" },
  { fg: "ink-label", bg: "page", use: "disabled button dashed outline" },
  { fg: "ink-label", bg: "slip", use: "disabled button dashed outline" },
  { fg: "cloth", bg: "page", use: "needs-fixing line and mark" },
  { fg: "cloth", bg: "slip", use: "overdue outline; error banner border; current bottom-nav bar; overdue strip block" },
  { fg: "stamp", bg: "page", use: "correct line and tick" },
  { fg: "stamp", bg: "slip", use: "paid double outline, stamp rings, paid strip block" },
  // The five F2b components.
  { fg: "slip", bg: "ink", use: "undo banner outlined action" },
  { fg: "ink", bg: "tab-idle", use: "switch knob edge on the off track, where the knob's fill is close to the track's" },
  { fg: "slip", bg: "stamp", use: "switch knob (a slip block) against the on track" },
];

/**
 * Pairs that fall short and are reported, not fixed by changing a token (spec criterion 8).
 * The components avoid ink-label on tab-idle and blue on ink. The other two are edges that do not
 * carry the meaning alone: the due tag has its words, the switch knob has its fill, place and word.
 */
export const reportedPairs: (Pair & { min: number })[] = [
  { fg: "blue", bg: "ink", min: 3, use: "avoided: the ring on a selected segment is highlight, never blue" },
  { fg: "ink", bg: "stamp", min: 3, use: "the knob's ink edge on the switch's green track; the knob's slip fill is what shows its shape there" },
  { fg: "ink-label", bg: "tab-idle", min: 4.5, use: "avoided: unselected tabs use ink-soft instead" },
  { fg: "highlight", bg: "slip", min: 3, use: "edge of the due tag's fill; the tag's words are ink on highlight" },
];
