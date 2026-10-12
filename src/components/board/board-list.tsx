"use client";

// The panel under the tabs (spec R1-6, criteria 15 and 20): the rows of one tab, then one closing line, or
// the tab's own "nobody" sentence when it has none. The words differ for the current month and a past one.
import { useTranslations } from "next-intl";
import type { Row, Tab } from "@/lib/dues-board";
import { DueRow } from "./due-row";

export function BoardList({
  tab,
  rows,
  month,
  isCurrent,
  batchNames,
  onMarkPaid,
}: Readonly<{ tab: Tab; rows: readonly Row[]; month: string; isCurrent: boolean; batchNames: ReadonlyMap<string, string>; onMarkPaid: (dueId: string) => void }>) {
  const t = useTranslations("board");
  if (rows.length === 0) {
    const none = tab === "overdue" ? t("empty.tab.overdue") : tab === "due" ? t(isCurrent ? "empty.tab.due" : "empty.tab.dueOld") : t(isCurrent ? "empty.tab.paid" : "empty.tab.paidOld");
    return <p className="type-body py-5 text-ink-soft wrap-anywhere">{none}</p>;
  }
  return (
    <>
      <ul>
        {rows.map((row) => (
          <DueRow key={row.due.id} row={row} month={month} batchName={row.student.batchId ? (batchNames.get(row.student.batchId) ?? null) : null} onMarkPaid={onMarkPaid} />
        ))}
      </ul>
      <p className="type-caption py-4 text-ink-soft wrap-anywhere">{t(`end.${tab}`)}</p>
    </>
  );
}
