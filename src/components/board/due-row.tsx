"use client";

// One fee in the list (spec R1-6, criteria 16 and 17; canvas "Home"): the status tag (a word and a mark), the
// student's name, a line with the due date, the batch and what was part paid, and on the right what is
// still owed (or the whole amount on a paid fee). The link to the student's edit screen holds no control; the
// buttons sit beside it, not inside it (spec R1-7, criterion 12): "Mark paid" on a fee with something still
// owed, "Receipt" on a fee with something paid. Beside it when there is room, below it when the text is
// large or the name is long. It grows with long names and large text and never cuts anything.
import { useLocale, useTranslations } from "next-intl";
import { useSoftLink } from "@/components/app/use-soft-link";
import { withNode } from "@/components/app/with-node";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/ui/status-tag";
import { editHref } from "@/components/students/student-row";
import type { Locale } from "@/config/locales";
import { localeHref, receiptPath } from "@/config/routes";
import { remaining, type Row } from "@/lib/dues-board";
import { formatDate, formatRupees } from "@/lib/format";
import { useMonthWords } from "./month-switcher";

export function DueRow({
  row,
  month,
  batchName,
  onMarkPaid,
}: Readonly<{ row: Row; month: string; batchName: string | null; onMarkPaid: (dueId: string) => void }>) {
  const t = useTranslations("board");
  const pay = useTranslations("pay");
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
  const canPay = due.status !== "paid";
  const hasReceipt = due.amountPaid > 0;
  const receiptHref = `${localeHref(locale, receiptPath)}?due=${encodeURIComponent(due.id)}`;

  return (
    <li className="flex flex-wrap items-center gap-x-2 border-b border-rule">
      <a href={href} onClick={soft(href)} className="flex min-h-16.5 min-w-0 grow basis-40 items-center gap-3 py-2 text-ink ring:ground-ring">
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
      {canPay || hasReceipt ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 py-2 pr-1.5 pb-3.5">
          {hasReceipt ? (
            <Button variant="outline" size="compact" href={receiptHref} onClick={soft(receiptHref)} aria-label={pay("receiptFor", { name: student.name })}>
              {pay("receiptButton")}
            </Button>
          ) : null}
          {canPay ? (
            <Button variant="record" size="compact" aria-label={pay("markPaidFor", { name: student.name })} onClick={() => onMarkPaid(due.id)}>
              {pay("markPaid")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
