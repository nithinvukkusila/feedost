"use client";

// The Batches screen (spec R1-3, criteria 39 to 41): the way back to Students, a form to add a batch, and
// every batch as a row: name, timings, how many students and what they pay each month.
import { useLocale, useTranslations } from "next-intl";
import { AppScreen } from "@/components/app/app-screen";
import { BackLink } from "@/components/app/back-link";
import { useRoster } from "@/components/app/roster";
import { RosterGate } from "@/components/app/roster-states";
import { useSoftLink } from "@/components/app/use-soft-link";
import { withNode } from "@/components/app/with-node";
import { Slip } from "@/components/ui/slip";
import type { Locale } from "@/config/locales";
import { batchEditPath, localeHref, studentsPath } from "@/config/routes";
import type { Batch } from "@/lib/batches";
import { formatRupees } from "@/lib/format";
import { batchSummary, sortBatches } from "@/lib/student-list";
import type { Student } from "@/lib/students";
import { BatchForm } from "./batch-form";

export function batchEditHref(locale: Locale, id: string): string {
  return `${localeHref(locale, batchEditPath)}?id=${encodeURIComponent(id)}`;
}

function BatchRow({ batch, students }: Readonly<{ batch: Batch; students: readonly Student[] }>) {
  const t = useTranslations("batches");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const href = batchEditHref(locale, batch.id);
  const { count, total } = batchSummary(students, batch.id);
  return (
    <li className="border-b border-rule">
      <a href={href} onClick={soft(href)} className="flex min-h-15 flex-col justify-center py-2 text-ink ring:ground-ring">
        <span translate="no" className="type-name wrap-anywhere">
          {batch.name}
        </span>
        {batch.timings ? (
          <span translate="no" className="type-caption text-ink-soft wrap-anywhere">
            {batch.timings}
          </span>
        ) : null}
        <span className="type-caption text-ink-soft wrap-anywhere">
          {t("studentsCount", { n: count })}
          <span aria-hidden="true"> · </span>
          {withNode(
            (amount) => t("monthly", { amount }),
            <span translate="no" className="type-amount-row">
              {formatRupees(total)}
            </span>,
          )}
        </span>
      </a>
    </li>
  );
}

function ListBody() {
  const t = useTranslations("batches");
  const locale = useLocale() as Locale;
  const roster = useRoster();
  const batches = sortBatches(roster.batches);
  return (
    <div className="flex flex-col pt-1.5 pr-5.5 pb-6 pl-5">
      <BackLink href={localeHref(locale, studentsPath)} label={t("back")} />
      <h1 className="type-headline mt-2 text-5xl wrap-break-word">{t("title")}</h1>

      <div className="mt-5">
        <BatchForm />
      </div>

      {batches.length === 0 ? (
        <section className="mt-6">
          <h2 className="type-headline text-3xl wrap-break-word">{t("empty.title")}</h2>
          <p className="type-body mt-2 text-ink-soft">{t("empty.body")}</p>
        </section>
      ) : (
        <Slip className="mt-6 mr-1.5 px-3">
          <ul>
            {batches.map((batch) => (
              <BatchRow key={batch.id} batch={batch} students={roster.students} />
            ))}
          </ul>
        </Slip>
      )}
    </div>
  );
}

export function BatchListScreen() {
  return (
    <RosterGate>
      <AppScreen nav="students">
        <ListBody />
      </AppScreen>
    </RosterGate>
  );
}
