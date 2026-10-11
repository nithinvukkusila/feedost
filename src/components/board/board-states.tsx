"use client";

// The board's states other than the list (spec R1-6, criteria 21 to 23, 25 and 26): loading, failed with
// nothing saved, nothing due yet, nothing in this batch, and everyone paid. Plain words; no sample data.
import { useLocale, useTranslations } from "next-intl";
import { BookBlocks } from "@/components/app/loading-book";
import { useSoftLink } from "@/components/app/use-soft-link";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import type { Locale } from "@/config/locales";
import { localeHref, studentsPath } from "@/config/routes";
import { formatRupees } from "@/lib/format";

/** What shows above the grey blocks while loading or failed: the month, then "Still to come in" (canvas "State-loading"). */
function BlocksHeader({ month }: Readonly<{ month: string }>) {
  const t = useTranslations("board");
  return (
    <header className="px-5 pt-4.5">
      <p className="type-label text-ink-label">{month}</p>
      <p className="type-body-lg mt-3.5 font-bold text-cloth">{t("hero.label")}</p>
    </header>
  );
}

export function BoardLoading({ month, words }: Readonly<{ month: string; words: string }>) {
  return (
    <BookBlocks
      header={<BlocksHeader month={month} />}
      footer={
        <p role="status" className="type-body flex min-h-16 items-center justify-center border-t-2 border-ink bg-slip px-4 py-2 text-center font-bold text-ink-soft">
          {words}
        </p>
      }
    />
  );
}

export function BoardError({ month, onRetry }: Readonly<{ month: string; onRetry: () => void }>) {
  const t = useTranslations("board");
  return (
    <BookBlocks
      header={<BlocksHeader month={month} />}
      footer={
        <div className="mt-4 mr-4 mb-4 ml-3">
          <Banner kind="error" title={t("loadError.title")} detail={t("loadError.body")} actions={[{ label: t("loadError.retry"), onClick: onRetry }]} />
        </div>
      }
    />
  );
}

/** Nothing at all in this month, with the batch filter on All. The current month and a past one say different things. */
export function NothingYet({ isCurrent, month }: Readonly<{ isCurrent: boolean; month: string }>) {
  const t = useTranslations("board");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const href = localeHref(locale, studentsPath);
  return (
    <section className="px-5 pt-6 pr-5.5">
      <h1 className="type-headline text-4xl wrap-break-word">{isCurrent ? t("empty.none.title") : t("empty.monthOld", { month })}</h1>
      {isCurrent ? <p className="type-body-lg mt-3 text-ink-soft">{t("empty.none.body")}</p> : null}
      {isCurrent ? (
        <div className="mt-5 pr-1.5 pb-1.5">
          <Button variant="outline" href={href} onClick={soft(href)}>
            {t("empty.none.link")}
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** Nothing here only because a batch is chosen. */
export function NothingInBatch({ batch, month, onShowAll }: Readonly<{ batch: string; month: string; onShowAll: () => void }>) {
  const t = useTranslations("board");
  return (
    <section className="px-5 pt-6 pr-5.5">
      <h1 className="type-headline text-4xl wrap-break-word">{t("empty.filter", { batch, month })}</h1>
      <div className="mt-5 pr-1.5 pb-1.5">
        <Button variant="outline" onClick={onShowAll}>
          {t("empty.showAll")}
        </Button>
      </div>
    </section>
  );
}

/** Every fee in view is paid (canvas "State-allpaid"): the stamp replaces the amount. */
export function AllPaid({
  month,
  nextMonth,
  collected,
  students,
}: Readonly<{ month: string; nextMonth: string | null; collected: number; students: number }>) {
  const t = useTranslations("board");
  return (
    <section className="px-5 pt-3 pr-5.5">
      <div className="flex justify-center py-2">
        <Stamp size="lg" tone="stamp" label={t("allPaid.stamp")} secondLine={month}>
          {t("allPaid.stamp")}
        </Stamp>
      </div>
      <h1 className="type-headline mt-3 text-4xl wrap-break-word">{t("allPaid.title")}</h1>
      {/* The amount never breaks, so the two figures wrap onto two lines rather than be squeezed. */}
      <div className="mt-3.5 flex flex-wrap gap-x-6 border-y-2 border-ink py-2.5">
        <div className="min-w-fit grow basis-32">
          <p className="type-label text-ink-label wrap-anywhere">{t("allPaid.collected")}</p>
          <p translate="no" className="type-amount text-3xl text-stamp">
            {formatRupees(collected)}
          </p>
        </div>
        <div className="min-w-0 grow basis-32">
          <p className="type-label text-ink-label wrap-anywhere">{t("allPaid.students")}</p>
          <p className="type-headline text-3xl wrap-anywhere">{t("allPaid.of", { n: students, m: students })}</p>
        </div>
      </div>
      {nextMonth ? <p className="type-body-lg mt-3.5 text-ink-soft">{t("allPaid.next", { month: nextMonth })}</p> : null}
      <p className="type-caption mt-3 text-ink-soft">{t("soon")}</p>
    </section>
  );
}
