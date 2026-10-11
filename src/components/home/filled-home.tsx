"use client";

// The home of a tutor with students (spec R1-3, criterion 14): one slip with the number of students and
// what they pay each month, a way to the whole list and a way to add another. Who owes what arrives with
// the dues slices, so there are no placeholder rows.
import { useLocale, useTranslations } from "next-intl";
import { AppScreen } from "@/components/app/app-screen";
import { PlusIcon } from "@/components/app/icons";
import { useTutor } from "@/components/app/app-gate";
import { useSoftLink } from "@/components/app/use-soft-link";
import { withNode } from "@/components/app/with-node";
import { Button } from "@/components/ui/button";
import { Slip } from "@/components/ui/slip";
import { brand } from "@/config/brand";
import type { Locale } from "@/config/locales";
import { localeHref, studentNewPath, studentsPath } from "@/config/routes";
import { amountFit } from "@/lib/amount-fit";
import { formatRupees } from "@/lib/format";
import { monthlyTotal } from "@/lib/student-list";
import type { Student } from "@/lib/students";
import { firstName } from "./empty-home";

/** `students` are the active ones. */
export function FilledHome({ students }: Readonly<{ students: readonly Student[] }>) {
  const t = useTranslations("home");
  const words = useTranslations("students");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const { tutor } = useTutor();
  const all = localeHref(locale, studentsPath);
  const add = localeHref(locale, studentNewPath);
  const total = formatRupees(monthlyTotal(students));

  return (
    <AppScreen nav="home">
      <div className="px-5 pt-3 pr-5.5">
        <p className="type-headline text-2xl text-cloth">{brand.name}</p>
        <p translate="no" className="type-body-lg mt-3 font-bold text-ink-label wrap-anywhere">
          {t("hello", { name: firstName(tutor.name) })}
        </p>

        <Slip as="section" className="mt-5 mr-1.5 px-3.5 py-4">
          <h1 className="type-label text-ink-label wrap-anywhere">{words("count", { n: students.length })}</h1>
          <p className="amount-box type-body-lg mt-1 font-bold">
            {withNode(
              (amount) => t("filled.total", { amount }),
              <span translate="no" style={amountFit(total)} className="type-amount amount-size-6xl block text-blue">
                {total}
              </span>,
            )}
          </p>
          <div className="mt-5 flex flex-col gap-4">
            <div className="pr-1.5 pb-1.5">
              <Button variant="record" full href={all} onClick={soft(all)}>
                {t("seeAll")}
              </Button>
            </div>
            <div className="pr-1.5 pb-1.5">
              <Button variant="record" full href={add} onClick={soft(add)} iconStart={<PlusIcon />}>
                {t("addStudent")}
              </Button>
            </div>
          </div>
        </Slip>

        <p className="type-body mt-6 text-ink-soft">{t("filled.soon")}</p>
      </div>
    </AppScreen>
  );
}
