"use client";

// Add a student (spec R1-3, criteria 16 and 17). `?batch=<id>` (from a batch screen) starts the form in that batch
// when it is one of the tutor's.
import { useLocale, useTranslations } from "next-intl";
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
  if (batch === undefined) return <LoadingBook label={app("loading")} />;
  const initialBatchId = batch !== null && roster.batches.some((item) => item.id === batch) ? batch : undefined;
  return (
    <AppScreen>
      <div className="flex flex-col pt-1.5 pr-5.5 pb-6 pl-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3">
          <BackLink href={localeHref(locale, studentsPath)} label={t("form.back")} />
        </div>
        <h1 className="type-headline mt-1 mb-4 text-3xl wrap-break-word">{t("form.addTitle")}</h1>
        <StudentForm mode="add" initialBatchId={initialBatchId} />
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
