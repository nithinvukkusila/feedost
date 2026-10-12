"use client";

// The Remind screen (spec R1-8, criteria 13 and 14): one route, `remind/`, for a single reminder, a run of
// them and the pick list that comes before a run. What is queued is in memory (remind-provider.tsx), never
// in the address. Opened directly with nothing queued, it goes back to Home.
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Locale } from "@/config/locales";
import { homePath, localeHref } from "@/config/routes";
import { PickList } from "./pick-list";
import { RemindRun } from "./remind-run";
import { useRemind } from "./remind-provider";

export function RemindScreen() {
  const { session } = useRemind();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const empty = session === null || (session.kind === "run" && session.queue.length === 0);

  useEffect(() => {
    if (empty) router.replace(localeHref(locale, homePath));
  }, [empty, router, locale]);

  if (session === null || empty) return null;
  return session.kind === "pick" ? <PickList session={session} /> : <RemindRun queue={session.queue} last={session.last} />;
}
