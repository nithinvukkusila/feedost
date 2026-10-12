"use client";

// The panel under the tabs (spec R1-6, criteria 15 and 20): the rows of one tab, then one closing line, or
// the tab's own "nobody" sentence when it has none. The words differ for the current month and a past one.
import { useTranslations } from "next-intl";
import type { Row, Tab } from "@/lib/dues-board";
import { Button } from "@/components/ui/button";
import { DueRow, type RemindProps } from "./due-row";

export function BoardList({
  tab,
  rows,
  month,
  isCurrent,
  batchNames,
  onMarkPaid,
  remind,
  lastAt,
  noUpiLine,
  remindAll,
}: Readonly<{
  tab: Tab;
  rows: readonly Row[];
  month: string;
  isCurrent: boolean;
  batchNames: ReadonlyMap<string, string>;
  onMarkPaid: (dueId: string) => void;
  remind: Omit<RemindProps, "lastAt">;
  /** When each fee was last reminded (milliseconds), by fee id. */
  lastAt: Readonly<Record<string, number>>;
  /** Show the one line that says why every Remind is "Add your UPI ID". */
  noUpiLine: boolean;
  /** "Remind all overdue (n)" on the Overdue tab, or null when no overdue fee can be reminded. */
  remindAll: { count: number; onClick: () => void } | null;
}>) {
  const t = useTranslations("board");
  const r = useTranslations("remind");
  if (rows.length === 0) {
    const none = tab === "overdue" ? t("empty.tab.overdue") : tab === "due" ? t(isCurrent ? "empty.tab.due" : "empty.tab.dueOld") : t(isCurrent ? "empty.tab.paid" : "empty.tab.paidOld");
    return <p className="type-body py-5 text-ink-soft wrap-anywhere">{none}</p>;
  }
  return (
    <>
      {remindAll ? (
        <div className="pt-3 pr-1.5 pb-1.5">
          <Button variant="send" full onClick={remindAll.onClick}>
            {r("all", { n: remindAll.count })}
          </Button>
        </div>
      ) : null}
      {noUpiLine ? <p className="type-caption pt-3 text-ink-soft wrap-anywhere">{r("noUpi")}</p> : null}
      <ul>
        {rows.map((row) => (
          <DueRow key={row.due.id} row={row} month={month} batchName={row.student.batchId ? (batchNames.get(row.student.batchId) ?? null) : null} onMarkPaid={onMarkPaid} remind={{ ...remind, lastAt: lastAt[row.due.id] ?? null }} />
        ))}
      </ul>
      <p className="type-caption py-4 text-ink-soft wrap-anywhere">{t(`end.${tab}`)}</p>
    </>
  );
}
