"use client";

// The yellow "{n} to confirm" chip on Home (spec R1-10, criterion 16; canvas "Home"): there when at least one
// parent's claim is waiting, gone when none is, and it opens the inbox. The count is read when Home opens and
// when the page is shown again (the app coming back to the foreground); never on a timer. It shows nothing
// while the count is being read, and nothing when the read fails: never a number the database has not returned.
//
// Kept small on purpose, it is in Home's first load: it imports only the count from src/lib/claims.ts and
// nothing from the inbox (claims-screen.tsx), which is a chunk of its own.
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useSoftLink } from "@/components/app/use-soft-link";
import type { Locale } from "@/config/locales";
import { claimsPath, localeHref } from "@/config/routes";
import { countPendingClaims } from "@/lib/claims";

export function ClaimsChip() {
  const t = useTranslations("claims");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const [count, setCount] = useState<number | null>(null);
  // A slow old answer must not overwrite a newer one.
  const ticket = useRef(0);

  useEffect(() => {
    let alive = true;
    function read() {
      const mine = ++ticket.current;
      countPendingClaims().then(
        (n) => {
          if (alive && ticket.current === mine) setCount(n);
        },
        () => {
          if (alive && ticket.current === mine) setCount(null);
        },
      );
    }
    function onVisible() {
      if (document.visibilityState === "visible") read();
    }
    read();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (count === null || count < 1) return null;
  const href = localeHref(locale, claimsPath);
  return (
    <a
      href={href}
      onClick={soft(href)}
      className="type-control-sm on-paper-ground mr-2 inline-flex min-h-tap items-center gap-1.5 rounded-sm border-2 border-ink bg-highlight px-3 py-2 text-ink shadow-round ground-shadow pressed:press-round ring:ground-ring"
    >
      <span className="min-w-0 wrap-anywhere">{t("chip", { n: String(count) })}</span>
    </a>
  );
}
