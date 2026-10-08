import { group, readTokens } from "@/styles/read-tokens";
import { copy } from "../sample-data";
import { Section } from "./parts";

// Whole class names, so Tailwind generates them. A colour token with no entry here shows without a swatch,
// which is the cue to add it.
const fill: Record<string, string> = {
  cloth: "bg-cloth",
  "cloth-deep": "bg-cloth-deep",
  stitch: "bg-stitch",
  "on-cloth": "bg-on-cloth",
  "on-cloth-soft": "bg-on-cloth-soft",
  page: "bg-page",
  "page-ruled": "bg-page-ruled",
  slip: "bg-slip",
  rule: "bg-rule",
  "tab-idle": "bg-tab-idle",
  ink: "bg-ink",
  "ink-soft": "bg-ink-soft",
  "ink-label": "bg-ink-label",
  blue: "bg-blue",
  stamp: "bg-stamp",
  highlight: "bg-highlight",
  bubble: "bg-bubble",
  "blue-pressed": "bg-blue-pressed",
  "sheet-ground": "bg-sheet-ground",
};

export function TokensSection() {
  // Read at build time: the page is a server component in a static export.
  const colours = group(readTokens(), "--color-");
  return (
    <Section id="tokens" title={copy.tokens.title} note={copy.tokens.note}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-5">
        {Object.entries(colours).map(([name, value]) => (
          <li key={name} data-testid={`swatch-${name}`} className="flex flex-col gap-1">
            <div aria-hidden="true" className={`h-14 border-2 border-ink ${fill[name] ?? ""}`} />
            <span className="type-body-sm font-bold wrap-anywhere">{name}</span>
            <span className="type-label text-ink-soft">{value}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
