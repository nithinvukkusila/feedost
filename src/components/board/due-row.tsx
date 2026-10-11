"use client";

// One fee in the list (spec R1-6, criteria 16 and 17; canvas "Home"): the status tag (a word and a mark), the
// student's name, a line with the due date, the batch and what was part paid, and on the right what is
// still owed (or the whole amount on a paid fee). The whole row is one link to the student's edit screen and
// nothing inside it is a control. It grows with long names and large text and never cuts anything.
import { useLocale, useTranslations } from "next-intl";
import { useSoftLink } from "@/components/app/use-soft-link";
import { withNode } from "@/components/app/with-node";
import { StatusTag } from "@/components/ui/status-tag";
import { editHref } from "@/components/students/student-row";
import type { Locale } from "@/config/locales";
import { remaining, type Row } from "@/lib/dues-board";
import { formatDate, formatRupees } from "@/lib/format";
import { useMonthWords } from "./month-switcher";

export function DueRow({ row, month, batchName }: Readonly<{ row: Row; month: string; batchName: string | null }>) {
  const t = useTranslations("board");
  const months = useMonthWords();
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const href = editHref(locale, row.student.id);
  const { due, state, student } = row;

  const tag =
    state.tag === "overdue"
      ? state.daysLate === null
        ? t("tag.overdueOpening")
        : t("tag.overdue", { n: state.daysLate })
      : state.tag === "due"
        ? t(state.isToday ? "tag.dueToday" : "tag.due")
        : state.tag === "part-paid"
          ? t("tag.partPaid")
          : t("tag.paid");

  // An earlier balance, or a fee from an earlier month that is still unpaid, says what it is.
  const kind = due.kind === "opening" ? t("row.earlier") : due.month !== month && due.month !== null ? t("row.monthFee", { month: months.name(due.month) }) : null;
  const owed = state.tab === "paid" ? due.amount : remaining(due);

  return (
    <li className="border-b border-rule">
      <a href={href} onClick={soft(href)} className="flex min-h-16.5 items-center gap-3 py-2 text-ink ring:ground-ring">
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <StatusTag status={state.tag}>{tag}</StatusTag>
          <span translate="no" className="type-name wrap-anywhere">
            {student.name}
          </span>
          <span className="type-caption text-ink-soft wrap-anywhere">
            {kind ? (
              <>
                {kind}
                <span aria-hidden="true"> · </span>
              </>
            ) : null}
            {t("row.dueOn", { date: formatDate(due.dueDate) })}
            {batchName ? (
              <>
                <span aria-hidden="true"> · </span>
                <span translate="no">{batchName}</span>
              </>
            ) : null}
          </span>
          {due.status === "partial" ? (
            <span className="type-caption text-blue wrap-anywhere">
              {withNode(
                (amount) => t("row.partPaid", { amount }),
                <span translate="no" className="type-amount-row">
                  {formatRupees(due.amountPaid)}
                </span>,
              )}
            </span>
          ) : null}
        </span>
        <span translate="no" className="type-amount-row shrink-0 text-ink">
          {formatRupees(owed)}
        </span>
      </a>
    </li>
  );
}
