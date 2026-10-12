"use client";

// "Who to remind" (spec R1-8, criteria 21 to 23): every overdue fee that can be reminded, one row per student
// (the oldest overdue fee, with "+n more overdue" when there are others), each with a tick. Everyone starts
// ticked except a parent already reminded today. Students who cannot be reminded are in a closed group with
// the reason in words and a link to fix it. "Remind n parents" starts the run; with none ticked it is
// unavailable and says why. Above 20 ticked, one soft line, which blocks nothing.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppScreen } from "@/components/app/app-screen";
import { BackLink } from "@/components/app/back-link";
import { RemindedIcon } from "@/components/app/icons";
import { useSoftLink } from "@/components/app/use-soft-link";
import { useMonthWords } from "@/components/board/month-switcher";
import { editHref } from "@/components/students/student-row";
import { Button } from "@/components/ui/button";
import { Check } from "@/components/ui/check";
import type { Locale } from "@/config/locales";
import { homePath, localeHref, remindPath, setupUpiPath } from "@/config/routes";
import { remaining } from "@/lib/dues-board";
import { formatRupees } from "@/lib/format";
import { queueFromPick, showManyNote } from "@/lib/reminder-rules";
import { useRemind, type Session } from "./remind-provider";

type PickSession = Extract<Session, { kind: "pick" }>;

export function PickList({ session }: Readonly<{ session: PickSession }>) {
  const t = useTranslations("remindScreen");
  const board = useTranslations("remind");
  const months = useMonthWords();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const soft = useSoftLink();
  const { begin } = useRemind();
  const { pick, batchNames, last } = session;
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(pick.items.filter((i) => i.ticked).map((i) => i.row.student.id)));
  const count = pick.items.filter((i) => ticked.has(i.row.student.id)).length;

  function toggle(id: string, on: boolean) {
    setTicked((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function start() {
    const queue = queueFromPick(pick.items, ticked, (batchId) => (batchId === null ? null : (batchNames[batchId] ?? null)));
    if (queue.length === 0) return;
    begin({ kind: "run", queue, last });
    router.replace(localeHref(locale, remindPath));
  }

  return (
    <AppScreen>
      <div data-ph-no-capture="" data-sentry-mask="" className="flex flex-col px-5 pt-1 pb-8">
        <div>
          <BackLink href={localeHref(locale, homePath)} label={t("home")} />
        </div>
        <h1 className="type-headline mt-2 text-3xl wrap-anywhere">{t("pick.title")}</h1>

        <ul className="mt-3 border-t border-rule">
          {pick.items.map(({ row, more, remindedToday }) => {
            const { student, due, state } = row;
            const id = student.id;
            return (
              <li key={id} className="border-b border-rule">
                <Check checked={ticked.has(id)} onChange={(on) => toggle(id, on)} onText={t("pick.selected")} offText={t("pick.notSelected")}>
                  <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                    <span translate="no" className="type-name min-w-0 wrap-anywhere">
                      {student.name}
                    </span>
                    <span translate="no" className="type-amount-row">
                      {formatRupees(remaining(due))}
                    </span>
                  </span>
                  <span className="type-caption block text-ink-soft wrap-anywhere">
                    {student.parentName ? (
                      <>
                        <span translate="no">{student.parentName}</span>
                        <span aria-hidden="true"> · </span>
                      </>
                    ) : null}
                    {due.kind === "opening" ? t("earlier") : state.daysLate !== null && state.daysLate > 0 ? t("pick.late", { n: state.daysLate }) : due.month ? months.name(due.month) : null}
                    {more > 0 ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        {t("pick.more", { n: more })}
                      </>
                    ) : null}
                  </span>
                  {remindedToday ? (
                    <span className="type-caption mt-0.5 flex items-center gap-1.5 font-semibold text-ink">
                      <RemindedIcon />
                      <span className="min-w-0 wrap-anywhere">{t("pick.today")}</span>
                    </span>
                  ) : null}
                </Check>
              </li>
            );
          })}
        </ul>

        {pick.cannot.length > 0 ? (
          <details className="mt-4 border-2 border-ink bg-slip px-3">
            <summary className="type-control-sm flex min-h-tap cursor-pointer items-center py-2 ring:ground-ring">{t("pick.cannot", { n: pick.cannot.length })}</summary>
            <ul>
              {pick.cannot.map(({ student, reason }) => {
                const href = reason === "noPhone" ? editHref(locale, student.id) : localeHref(locale, setupUpiPath);
                return (
                  <li key={student.id} className="flex flex-wrap items-center justify-between gap-x-3 border-t border-rule py-1.5">
                    <span className="min-w-0 flex-1 basis-32">
                      <span translate="no" className="type-name block wrap-anywhere">
                        {student.name}
                      </span>
                      <span className="type-caption block text-ink-soft wrap-anywhere">{reason === "noPhone" ? t("pick.noPhone") : t("pick.noUpi")}</span>
                    </span>
                    <a href={href} onClick={soft(href)} className="type-control-sm inline-flex min-h-tap items-center underline ring:ground-ring">
                      {reason === "noPhone" ? board("addNumberFor", { name: student.name }) : board("addUpi")}
                    </a>
                  </li>
                );
              })}
            </ul>
          </details>
        ) : null}

        {showManyNote(count) ? (
          <p role="note" className="type-caption mt-4 border-2 border-dashed border-ink px-3 py-2 wrap-anywhere">
            {t("pick.many")}
          </p>
        ) : null}

        <div className="mt-5 pr-1.5 pb-1.5">
          <Button variant="send" size="large" full disabled={count === 0} disabledReason={t("pick.none")} onClick={start}>
            {t("pick.start", { n: count })}
          </Button>
        </div>
      </div>
    </AppScreen>
  );
}
