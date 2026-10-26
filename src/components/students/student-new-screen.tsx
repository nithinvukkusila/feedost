"use client";

// Add a student (spec R1-3, criteria 16 and 17). `?batch=<id>` (from a batch screen) starts the form in that batch
// when it is one of the tutor's.
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { BANNER_MS } from "@/lib/payments-view";
import { AppScreen } from "@/components/app/app-screen";
import { BackLink } from "@/components/app/back-link";
import { LoadingBook } from "@/components/app/loading-book";
import { useQueryParam } from "@/components/app/read-id";
import { useRoster } from "@/components/app/roster";
import { RosterGate } from "@/components/app/roster-states";
import type { Locale } from "@/config/locales";
import { localeHref, studentsPath } from "@/config/routes";
import { StudentForm } from "./student-form";

function Chosen() {
  const t = useTranslations("students");
  const app = useTranslations("appState");
  const locale = useLocale() as Locale;
  const batch = useQueryParam("batch");
  const roster = useRoster();
  const [saved, setSaved] = useState<string | null>(null);
  // The toast goes after the Undo banner's time; leaving the screen takes it with the screen.
  useEffect(() => {
    if (saved === null) return;
    const timer = setTimeout(() => setSaved(null), BANNER_MS);
    return () => clearTimeout(timer);
  }, [saved]);
  if (batch === undefined) return <LoadingBook label={app("loading")} />;
  const initialBatchId = batch !== null && roster.batches.some((item) => item.id === batch) ? batch : undefined;
  return (
    // "Saved {name}…" after "Save and add another" is a toast pinned at the foot, the Undo banner's place and pattern,
    // out of the form's flow: the buttons never move at any font size (UX-review-fixes-2, 6.1). The live region is
    // always there so the words are announced once when they arrive (6.2). The pinned block sits after the content in
    // the page, so while it shows the page has room for it at the foot and both buttons scroll fully above it (6.4).
    <AppScreen
      above={
        <div aria-live="polite" aria-atomic="true" data-saved-toast="" className="px-3 pb-3 empty:hidden">
          {saved === null ? null : <Banner kind="undo" message={saved} actions={[]} />}
        </div>
      }
    >
      <div className="flex flex-col pt-1.5 pr-5.5 pb-6 pl-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <BackLink href={localeHref(locale, studentsPath)} label={t("form.back")} />
        </div>
        <h1 className="type-headline mt-1 mb-4 text-3xl wrap-break-word">{t("form.addTitle")}</h1>
        <StudentForm mode="add" initialBatchId={initialBatchId} onSaved={setSaved} />
      </div>
    </AppScreen>
  );
}

export function StudentNewScreen() {
  return (
    <RosterGate>
      <Chosen />
    </RosterGate>
  );
}
