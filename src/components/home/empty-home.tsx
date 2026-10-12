"use client";

// The home screen of a tutor with no students yet (spec R1-1, criterion 32, and R1-3, criterion 13; canvas
// "State-empty"). The dashed rows are only the shape of the list to come. The black "Add a student" button
// goes straight to the add form (R1-3, decision 11); "Try with sample data" is not here (decision 13).
// The More screen is one tap away on the bottom navigation.
import { useLocale, useTranslations } from "next-intl";
import { useTutor } from "@/components/app/app-gate";
import { AppScreen } from "@/components/app/app-screen";
import { PlusIcon } from "@/components/app/icons";
import { useSoftLink } from "@/components/app/use-soft-link";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import type { Locale } from "@/config/locales";
import { localeHref, studentNewPath } from "@/config/routes";

/** The first word of the name: "Meena" for "Meena Iyer". */
export function firstName(name: string | null): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function EmptyHome() {
  const t = useTranslations("home");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const { tutor } = useTutor();
  const add = localeHref(locale, studentNewPath);

  return (
    <AppScreen nav="home">
      <div className="flex flex-1 flex-col pt-3 pr-5.5 pb-5.5 pl-5">
        <p className="type-headline text-2xl text-cloth">{brand.name}</p>
        <p translate="no" className="type-body-lg mt-3 font-bold text-ink-label wrap-anywhere">
          {t("hello", { name: firstName(tutor.name) })}
        </p>

        <h1 className="type-headline mt-5 text-5xl wrap-break-word">{t("empty.title")}</h1>
        <p className="type-body-lg mt-3 text-ink-soft">{t("empty.body")}</p>

        <div aria-hidden="true" className="mt-6 mr-1.5 border-2 border-dashed border-ink bg-slip px-3.5 py-1">
          <div className="h-14 border-b border-dashed border-rule" />
          <div className="h-14 border-b border-dashed border-rule" />
          <div className="h-14" />
        </div>

        <div className="mt-7 pr-1.5 pb-1.5">
          <Button variant="record" size="xl" full href={add} onClick={soft(add)} iconStart={<PlusIcon />}>
            {t("addStudent")}
          </Button>
        </div>
      </div>
    </AppScreen>
  );
}
