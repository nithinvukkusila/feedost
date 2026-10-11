"use client";

// The way back at the top of a screen that has no bottom navigation: an arrow and words, at least 44px high.
import { BackIcon } from "./icons";
import { useSoftLink } from "./use-soft-link";

export function BackLink({ href, label }: Readonly<{ href: string; label: string }>) {
  const soft = useSoftLink();
  return (
    <a href={href} onClick={soft(href)} className="type-control-sm -ml-3 inline-flex min-h-tap items-center gap-1 pr-3 pl-2 text-ink ring:ground-ring">
      <BackIcon />
      <span className="min-w-0 underline wrap-anywhere">{label}</span>
    </a>
  );
}
