// Small parts the free tools share: the marks that go with a status word, and the state of a field
// that is not yet right. A status is always a word plus a mark, never colour alone.
import type { Checked } from "@/lib/fields";

/** Keeps typed text out of analytics and error-report recordings, should a later slice add either. */
export const guarded = { "data-ph-no-capture": "", "data-sentry-mask": "" } as const;

export type Fix = { word: string; fix: string };

/** Nothing until the field has lost focus once; then the needs-fixing state while its value breaks the rule. */
export function problem<E extends string>(result: Checked<unknown, E>, touched: boolean, words: Record<E, Fix>) {
  if (result.ok || !touched) return {};
  const { word, fix } = words[result.error];
  return { state: "error" as const, stateLabel: word, message: fix };
}

const icon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  focusable: false,
  "aria-hidden": true,
} as const;

export function ChatIcon() {
  return (
    <svg {...icon} strokeWidth={2.2} className="size-5.5">
      <path d="M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1h-8l-5 4v-4H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  );
}

export function Tick() {
  return (
    <svg {...icon} strokeWidth={3} className="size-5 shrink-0">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function ErrorMark() {
  return (
    <svg {...icon} strokeWidth={2.6} className="size-5 shrink-0">
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4v.1" />
    </svg>
  );
}
