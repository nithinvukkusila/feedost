"use client";

// Edit one student (spec R1-3, criteria 32 and 33 to 38): the add form with the saved values, titled with the
// name, and Archive below it (Restore for an archived student). A record is named by `?id=` in the address.
// There is no way to delete a student here.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppScreen } from "@/components/app/app-screen";
import { BackLink } from "@/components/app/back-link";
import { LoadingBook } from "@/components/app/loading-book";
import { useQueryParam } from "@/components/app/read-id";
import { useRoster } from "@/components/app/roster";
import { RosterGate } from "@/components/app/roster-states";
import { WriteNotice, type WriteProblem } from "@/components/app/write-notice";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/locales";
import { localeHref, studentsPath } from "@/config/routes";
import { setActive, type Student } from "@/lib/students";
import { ArchivedTag } from "./archived-tag";
import { StudentForm } from "./student-form";

function NotFound() {
  const t = useTranslations("students");
  const locale = useLocale() as Locale;
  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5 pr-5.5">
      <BackLink href={localeHref(locale, studentsPath)} label={t("edit.backLink")} />
      <h1 className="type-headline text-4xl wrap-break-word">{t("edit.notFound")}</h1>
      <p className="type-body-lg text-ink-soft">{t("edit.notFoundBody")}</p>
    </div>
  );
}

function EditBody({ student }: Readonly<{ student: Student }>) {
  const t = useTranslations("students");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const roster = useRoster();
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<WriteProblem | "missing">(null);

  async function toggle() {
    if (working) return;
    setWorking(true);
    setProblem(null);
    const result = await setActive(student.id, !student.active);
    setWorking(false);
    if (!result.ok) {
      setProblem(result.reason === "missing" ? "missing" : result.reason === "offline" ? "offline" : "failed");
      return;
    }
    roster.put(result.student);
    router.push(localeHref(locale, studentsPath));
  }

  return (
    <div className="flex flex-col pt-1.5 pr-5.5 pb-6 pl-5">
      <BackLink href={localeHref(locale, studentsPath)} label={t("form.back")} />
      <h1 translate="no" className="type-headline mt-2 mb-1 text-3xl wrap-anywhere">
        {student.name}
      </h1>
      {student.active ? null : (
        <div className="mb-3">
          <ArchivedTag />
        </div>
      )}
      <div className="mt-3">
        <StudentForm key={student.id} mode="edit" student={student} />
      </div>

      <section className="mt-6 border-t-2 border-ink pt-4">
        <p className="type-body-sm text-ink-soft">{t("edit.archiveNote")}</p>
        <div className="mt-3">
          <WriteNotice problem={problem === "missing" ? null : problem} failed={t("form.saveFailed")} offline={t("form.offline")} />
        </div>
        {problem === "missing" ? (
          <p role="alert" className="mb-3 type-body-sm font-semibold text-cloth wrap-anywhere">
            {t("edit.notFound")}
          </p>
        ) : null}
        <div className="mt-3 pr-1.5 pb-1.5">
          {student.active ? (
            <Button variant="outline" full busy={working} busyLabel={t("edit.archive")} onClick={toggle}>
              {t("edit.archive")}
            </Button>
          ) : (
            <Button variant="record" full busy={working} busyLabel={t("edit.restore")} onClick={toggle}>
              {t("edit.restore")}
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function Chosen() {
  const id = useQueryParam("id");
  const roster = useRoster();
  const app = useTranslations("appState");
  if (id === undefined) return <LoadingBook label={app("loading")} />;
  const student = id === null ? undefined : roster.students.find((item) => item.id === id);
  return <AppScreen>{student ? <EditBody key={student.id} student={student} /> : <NotFound />}</AppScreen>;
}

export function StudentEditScreen() {
  return (
    <RosterGate>
      <Chosen />
    </RosterGate>
  );
}
