"use client";

// The Attendance screen until R1-11 builds it (spec UX-review-fixes, item 4): the title, one honest
// sentence, a way back to Home, and the bottom navigation so the four-item bar has somewhere to go.
import { useLocale, useTranslations } from "next-intl";
import { AppScreen } from "@/components/app/app-screen";
import { useSoftLink } from "@/components/app/use-soft-link";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/locales";
import { homePath, localeHref } from "@/config/routes";

export function AttendancePlaceholder() {
  const t = useTranslations("attendance");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const href = localeHref(locale, homePath);
  return (
    <AppScreen nav="attendance">
      <div className="px-5 pt-4.5 pr-5.5">
        <h1 className="type-headline text-5xl wrap-break-word">{t("title")}</h1>
        <p className="type-body-lg mt-3 text-ink-soft">{t("soon")}</p>
        <div className="mt-5 pr-1.5 pb-1.5">
          <Button variant="outline" href={href} onClick={soft(href)}>
            {t("back")}
          </Button>
        </div>
      </div>
    </AppScreen>
  );
}
