"use client";

// One fee in the list (spec R1-6, criteria 16 and 17; canvas "Home"): the status tag (a word and a mark), and on a
// part-paid fee a second one, "Part paid ₹X" (UX-review-fixes-2, criterion 3.2), the student's name, a line with
// the due date (an earlier balance says when it was added, criterion 1.4) and the batch, and on the right what is
// still owed (or the whole amount on a paid fee). The link to the student's edit screen holds no control; the
// buttons sit beside it, not inside it (spec R1-7, criterion 12): "Mark paid" on a fee with something still
// owed, "Receipt" on a fee with something paid. Beside it when there is room, below it when the text is
// large or the name is long. It grows with long names and large text and never cuts anything.
import { useLocale, useTranslations } from "next-intl";
import { RemindedIcon } from "@/components/app/icons";
import { useSoftLink } from "@/components/app/use-soft-link";
import { withNode } from "@/components/app/with-node";
import { Button } from "@/components/ui/button";
import { StatusTag } from "@/components/ui/status-tag";
import { editHref } from "@/components/students/student-row";
import type { Locale } from "@/config/locales";
import { localeHref, receiptPath, setupUpiPath } from "@/config/routes";
import { remaining, type Row } from "@/lib/dues-board";
import { formatDate, formatRupees } from "@/lib/format";
import { canRemind, lastRemindedOn } from "@/lib/reminder-rules";
import { useMonthWords } from "./month-switcher";

/** What the row knows about reminders (R1-8): who the tutor is (for her UPI ID), when this fee was last reminded, today, and what Remind does. */
export type RemindProps = {
  tutor: { upiId: string | null; name: string | null };
  /** Milliseconds since 1970, or null when this fee was never reminded (or the read failed). */
  lastAt: number | null;
  today: string;
  onRemind: (dueId: string) => void;
};

export function DueRow({
  row,
  month,
  batchName,
  onMarkPaid,
  remind,
}: Readonly<{ row: Row; month: string; batchName: string | null; onMarkPaid: (dueId: string) => void; remind: RemindProps }>) {
  const t = useTranslations("board");
  const pay = useTranslations("pay");
  const r = useTranslations("remind");
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
        : t("tag.paid");

  // An earlier balance, or a fee from an earlier month that is still unpaid, says what it is. An earlier balance
  // is dated the day it was entered, so it says "Added", not "Due" (criterion 1.4).
  const opening = due.kind === "opening";
  const kind = opening ? t("row.earlier") : due.month !== month && due.month !== null ? t("row.monthFee", { month: months.name(due.month) }) : null;
  const when = opening ? t("row.addedOn", { date: formatDate(due.dueDate) }) : t("row.dueOn", { date: formatDate(due.dueDate) });
  const owed = state.tab === "paid" ? due.amount : remaining(due);
  const canPay = due.status !== "paid";
  const hasReceipt = due.amountPaid > 0;
  const receiptHref = `${localeHref(locale, receiptPath)}?due=${encodeURIComponent(due.id)}`;
  // Remind, or what to do first. A paid fee has none; the reason comes in the spec's order (criteria 1 to 4).
  const can = canRemind(due, student, remind.tutor);
  const reminded = canPay && remind.lastAt !== null ? lastRemindedOn(remind.lastAt, remind.today) : null;
  const upiHref = localeHref(locale, setupUpiPath);

  return (
    <li className="flex flex-wrap items-center gap-x-2 border-b border-rule">
      <a href={href} onClick={soft(href)} className="flex min-h-16.5 min-w-0 grow basis-40 items-center gap-3 py-2 text-ink ring:ground-ring">
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="flex max-w-full flex-wrap gap-2">
            <StatusTag status={state.tag}>{tag}</StatusTag>
            {state.partPaid ? (
              <StatusTag status="part-paid">
                {withNode(
                  (amount) => t("tag.partPaidAmount", { amount }),
                  <span translate="no" className="type-amount-row">
                    {formatRupees(due.amountPaid)}
                  </span>,
                )}
              </StatusTag>
            ) : null}
          </span>
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
            {when}
            {batchName ? (
              <>
                <span aria-hidden="true"> · </span>
                <span translate="no">{batchName}</span>
              </>
            ) : null}
          </span>
          {reminded ? (
            <span className="type-caption flex items-center gap-1.5 font-semibold text-ink">
              <RemindedIcon />
              <span className="min-w-0 wrap-anywhere">{reminded.key === "days" ? r("last.days", { n: reminded.n }) : r(`last.${reminded.key}`)}</span>
            </span>
          ) : null}
        </span>
        <span translate="no" className="type-amount-row shrink-0 text-ink">
          {formatRupees(owed)}
        </span>
      </a>
      {canPay || hasReceipt ? (
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2 py-2 pr-1.5 pb-3.5">
          {hasReceipt ? (
            <Button variant="outline" size="compact" href={receiptHref} onClick={soft(receiptHref)} aria-label={pay("receiptFor", { name: student.name })}>
              {pay("receiptButton")}
            </Button>
          ) : null}
          {can.ok ? (
            <Button variant="outline" size="compact" aria-label={r("buttonFor", { name: student.name })} onClick={() => remind.onRemind(due.id)}>
              {r("button")}
            </Button>
          ) : !can.ok && can.reason === "noPhone" ? (
            <Button variant="outline" size="compact" href={href} onClick={soft(href)} aria-label={r("addNumberFor", { name: student.name })}>
              {r("addNumber")}
            </Button>
          ) : !can.ok && can.reason === "noUpi" ? (
            <Button variant="outline" size="compact" href={upiHref} onClick={soft(upiHref)}>
              {r("addUpi")}
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
