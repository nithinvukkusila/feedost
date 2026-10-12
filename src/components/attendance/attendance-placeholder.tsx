"use client";

// The Attendance screen until R1-11 builds it (spec R1-3, criterion 3, decision 12): the title, one line,
// and the bottom navigation so the four-item bar has somewhere to go.
import { useTranslations } from "next-intl";
import { AppScreen } from "@/components/app/app-screen";

export function AttendancePlaceholder() {
  const t = useTranslations("attendance");
  return (
    <AppScreen nav="attendance">
      <div className="px-5 pt-4.5 pr-5.5">
        <h1 className="type-headline text-5xl wrap-break-word">{t("title")}</h1>
        <p className="type-body-lg mt-3 text-ink-soft">{t("soon")}</p>
      </div>
    </AppScreen>
  );
}
