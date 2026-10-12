"use client";

// The dues board (spec R1-6; canvas "Home"): the home of a tutor with students. Top to bottom: the month
// switcher, the amount still to come in, the batch select (only with batches), the strip with its words,
// the three tabs and the rows. It reads the cached roster and the board's cached dues and works out the view
// on the phone; the only thing it asks the network for is through the board store, on opening and on a day
// change. It writes nothing. Until Mark paid and Remind land (R1-7, R1-8) it is read-only.
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { AppScreen } from "@/components/app/app-screen";
import { useRoster } from "@/components/app/roster";
import { BatchFilter, effectiveFilter } from "@/components/students/batch-filter";
import { Slip } from "@/components/ui/slip";
import { StudentStrip } from "@/components/ui/student-strip";
import { Tabs, tabId } from "@/components/ui/tabs";
import type { Due } from "@/lib/dues";
import { currentMonth, defaultTab, indiaToday, monthMoves, shiftMonth, type Tab } from "@/lib/dues-board";
import { activeStudents, batchCounts, sortBatches } from "@/lib/student-list";
import { BoardList } from "./board-list";
import { useBoard } from "./board-state";
import { AllPaid, BoardError, BoardLoading, InlineState, NothingInBatch, NothingYet } from "./board-states";
import { HeroAmount } from "./hero-amount";
import { MonthSwitcher, useMonthWords } from "./month-switcher";
import { useBoardView } from "./use-board-view";

const NONE: readonly Due[] = [];

const TABS: readonly Tab[] = ["overdue", "due", "paid"];

export function BoardScreen() {
  const t = useTranslations("board");
  const app = useTranslations("appState");
  const months = useMonthWords();
  const roster = useRoster();
  const board = useBoard();
  const { open, retry, selectMonth, setTab, setFilter } = board;
  const { reload } = roster;
  const panelId = useId();

  // Today in India, from the phone's clock as an instant. It changes only when the page is shown again
  // after midnight there (no timer); then the board asks for its dues again.
  const [today, setToday] = useState(() => indiaToday(Date.now()));
  const latestToday = useRef(today);
  useEffect(() => {
    open(latestToday.current);
    function onVisible() {
      if (document.visibilityState !== "visible") return;
      const now = indiaToday(Date.now());
      if (now === latestToday.current) return;
      latestToday.current = now;
      setToday(now);
      open(now);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [open]);

  const active = activeStudents(roster.students);
  const batches = sortBatches(roster.batches);
  const counts = batchCounts(active, batches);
  const filter = effectiveFilter(board.settings.filter, batches, counts);
  const month = board.settings.month ?? currentMonth(today);
  const isCurrent = month === currentMonth(today);
  // The current month is made of its own dues and every unpaid earlier one, so it waits for both reads.
  const own = board.months[month]?.rows ?? null;
  const carried = isCurrent ? (board.unpaid?.rows ?? null) : NONE;
  const ready = own !== null && carried !== null;

  const { view, filteredOut } = useBoardView(ready ? own : null, carried ?? NONE, roster.students, month, today, filter);

  // A fee for a student this phone has not seen: read the roster again, once per read of the dues.
  const reloadedAt = useRef(-1);
  const missing = view.missing.length;
  useEffect(() => {
    if (missing === 0 || reloadedAt.current === board.reads) return;
    reloadedAt.current = board.reads;
    reload();
  }, [missing, board.reads, reload]);

  const moves = monthMoves(month, board.earliest?.month ?? null, today);
  const go = (to: string) => selectMonth(to, today);

  if (!ready) {
    // Something is saved, or a past month was asked for: keep the month buttons and the navigation, so the tutor can go back.
    const inline = Object.keys(board.months).length > 0 || !isCurrent;
    if (!inline) {
      return board.failed ? (
        <BoardError month={months.label(month)} onRetry={() => retry(today)} />
      ) : (
        <BoardLoading month={months.label(month)} words={app("loading")} />
      );
    }
    return (
      <AppScreen nav="home">
        <MonthSwitcher label={months.label(month)} canPrev={moves.prev} canNext={moves.next} onPrev={() => go(shiftMonth(month, -1))} onNext={() => go(shiftMonth(month, 1))} />
        <InlineState failed={board.failed} words={app("loading")} onRetry={() => retry(today)} />
      </AppScreen>
    );
  }

  const tab = board.settings.tab ?? defaultTab(view.counts);
  const empty = view.rows.length === 0;
  const allPaid = !empty && view.counts.overdue + view.counts.due === 0;
  const stale = board.failed || roster.stale;
  const batchNames = new Map(batches.map((batch) => [batch.id, batch.name]));
  const batchName = batchNames.get(filter) ?? "";
  const tabs = TABS.map((id) => ({ id, label: t(`tab.${id}`), count: <span translate="no">{view.counts[id]}</span> }));

  return (
    <AppScreen nav="home">
      <MonthSwitcher label={months.label(month)} canPrev={moves.prev} canNext={moves.next} onPrev={() => go(shiftMonth(month, -1))} onNext={() => go(shiftMonth(month, 1))} />

      {board.blocked ? (
        <p role="status" className="type-caption px-5 pt-2 text-ink-soft wrap-anywhere">
          {t("offlineMonth", { month: months.label(board.blocked) })}
        </p>
      ) : null}

      {empty ? (
        filteredOut ? (
          <NothingInBatch batch={batchName} month={months.label(month)} onShowAll={() => setFilter("all")} />
        ) : (
          <NothingYet isCurrent={isCurrent} month={months.label(month)} />
        )
      ) : allPaid ? (
        <AllPaid month={months.label(month)} nextMonth={isCurrent ? months.name(shiftMonth(month, 1)) : null} collected={view.collected} students={view.studentsInView} />
      ) : (
        <HeroAmount view={view} />
      )}

      {stale ? (
        <div className="flex flex-wrap items-center gap-x-3 px-5 pt-3">
          <p role="status" className="type-caption text-ink-soft">
            {t("stale")}
          </p>
          <button
            type="button"
            onClick={() => {
              retry(today);
              if (roster.stale) reload();
            }}
            className="type-control-sm min-h-tap py-2 text-ink underline ring:ground-ring"
          >
            {t("loadError.retry")}
          </button>
        </div>
      ) : null}

      <div className="pt-3">
        <BatchFilter variant="select" batches={batches} counts={counts} value={board.settings.filter} onChange={setFilter} />
      </div>

      {empty ? null : (
        <>
          <div className="px-5 pt-3.5 pr-5.5">
            <StudentStrip
              blocks={view.blocks}
              legend={{ paid: t("legend.paid", { n: view.legend.paid }), due: t("legend.due", { n: view.legend.due }), overdue: t("legend.overdue", { n: view.legend.overdue }) }}
              label={t("strip.label", { total: view.blocks.length, paid: view.legend.paid, due: view.legend.due, overdue: view.legend.overdue })}
            />
          </div>

          <div className="pt-5 pr-5.5 pl-4">
            <Tabs tabs={tabs} value={tab} onChange={(id) => setTab(id as Tab)} label={t("tabsLabel")} panelId={panelId} />
            <Slip joined role="tabpanel" id={panelId} aria-labelledby={tabId(panelId, tab)} className="px-3">
              <BoardList tab={tab} rows={view.tabs[tab]} month={month} isCurrent={isCurrent} batchNames={batchNames} />
            </Slip>
          </div>
        </>
      )}
      <div className="pb-5" />
    </AppScreen>
  );
}
