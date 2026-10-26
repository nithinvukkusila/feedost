"use client";

// The dues board (spec R1-6; canvas "Home"): the home of a tutor with students. Top to bottom: the month
// switcher, the amount still to come in, the batch select (only with batches), the summary bar with its three
// labels (UX-review-fixes-2, item 4), the three tabs and the rows. It reads the cached roster and the board's cached dues and works out the view
// on the phone; the only thing it asks the network for is through the board store, on opening and on a day
// change. Its one write is Mark paid (R1-7): the sheet is a lazy chunk, loaded on the first tap, and what it
// records goes through src/lib/payments.ts. Remind (R1-8) only queues the fee in memory and opens the Remind screen; nothing of that screen is loaded here.
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTutor } from "@/components/app/app-gate";
import { AppScreen } from "@/components/app/app-screen";
import { useRoster } from "@/components/app/roster";
import { UndoBanner } from "@/components/pay/undo-banner";
import { ClaimsChip } from "@/components/claims/claims-chip";
import { useRemind } from "@/components/remind/remind-provider";
import { withNode } from "@/components/app/with-node";
import { BatchFilter, effectiveFilter } from "@/components/students/batch-filter";
import { Slip } from "@/components/ui/slip";
import { SummaryBar, SummaryPending } from "@/components/ui/summary-bar";
import { Tabs, tabId } from "@/components/ui/tabs";
import type { Locale } from "@/config/locales";
import { localeHref, remindPath } from "@/config/routes";
import type { Due } from "@/lib/dues";
import { collectedInMonth, currentMonth, defaultTab, earliestNextDue, indiaToday, monthMoves, shiftMonth, type Tab } from "@/lib/dues-board";
import { formatRupees } from "@/lib/format";
import { pickList, queueItem, tutorReady } from "@/lib/reminder-rules";
import { activeStudents, batchCounts, sortBatches } from "@/lib/student-list";
import { BoardList } from "./board-list";
import { useBoard } from "./board-state";
import { AllPaid, BoardError, type CollectedFigure, BoardLoading, InlineState, NothingInBatch, NothingYet } from "./board-states";
import { HeroAmount } from "./hero-amount";
import { MonthSwitcher, useMonthWords } from "./month-switcher";
import { useBoardView } from "./use-board-view";

// Not part of the first load: the sheet, its amount checks and its date choices come down on the first tap of Mark paid.
const PaySheet = dynamic(() => import("@/components/pay/pay-sheet"), { ssr: false });

// The phone's clock, read at a tap (never while drawing).
const clockNow = () => Date.now();

const NONE: readonly Due[] = [];

// An amount in a label: DM Mono, 0 to 9 digits, never translated.
const money = (paise: number) => (
  <span translate="no" className="type-amount-row">
    {formatRupees(paise)}
  </span>
);

const TABS: readonly Tab[] = ["overdue", "due", "paid"];

export function BoardScreen() {
  const t = useTranslations("board");
  const app = useTranslations("appState");
  const months = useMonthWords();
  const roster = useRoster();
  const board = useBoard();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { tutor } = useTutor();
  const remind = useRemind();
  const { open, retry, selectMonth, setTab, setFilter, refresh } = board;
  const { reload } = roster;
  const panelId = useId();
  // The fee whose Mark paid sheet is open, by id; the row itself is looked up live, so the sheet follows the board.
  const [paying, setPaying] = useState<string | null>(null);

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

  // A reminder the database has just confirmed (a log that was waiting for the network, or one that was still on its way when
  // the tutor came back): read the marks again, so the row says so.
  const saved = useSyncExternalStore(remind.log.subscribe, remind.log.saved, remind.log.saved);
  const seenSaved = useRef(saved);
  useEffect(() => {
    if (saved === seenSaved.current) return;
    seenSaved.current = saved;
    refresh(latestToday.current);
  }, [saved, refresh]);
  const lastAt = useMemo(() => Object.fromEntries(Object.entries(board.reminders?.byDue ?? {}).map(([id, last]) => [id, last.lastAt])), [board.reminders]);
  const going = useRef(false);

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

  // Collected (criterion 3.3): the month's payments by paid-on date, through the filter. Pending while the first read
  // is out; null when it failed with nothing saved, or was never read and the phone is offline (the store sets it).
  const collectedSlice = board.collected[month];
  const collected: CollectedFigure =
    collectedSlice === undefined ? "pending" : collectedSlice === null ? null : collectedInMonth(collectedSlice.payments, collectedSlice.studentOf, roster.students, filter);

  // A fee for a student this phone has not seen: read the roster again, once per read of the dues.
  const reloadedAt = useRef(-1);
  const missing = view.missing.length;
  useEffect(() => {
    if (missing === 0 || reloadedAt.current === board.reads) return;
    reloadedAt.current = board.reads;
    reload();
  }, [missing, board.reads, reload]);

  const payingRow = paying === null ? undefined : view.rows.find((row) => row.due.id === paying && row.due.status !== "paid");

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
  const tutorFacts = { upiId: tutor.upiId, name: tutor.name };

  // Remind: the fee is queued in memory (the parent's name and phone as they are now) and the Remind screen opens. Once per visit.
  function goRemind(session: Parameters<typeof remind.begin>[0]) {
    if (going.current) return;
    going.current = true;
    remind.begin(session);
    router.push(localeHref(locale, remindPath));
  }
  function onRemind(dueId: string) {
    const row = view.rows.find((r) => r.due.id === dueId);
    if (!row || row.student.parentPhone === null) return;
    goRemind({ kind: "run", queue: [queueItem(row, row.student.batchId ? (batchNames.get(row.student.batchId) ?? null) : null)], last: lastAt });
  }
  // The button needs only how many parents there are; who starts ticked depends on the time, which is read at the tap.
  const overdueCount = tab === "overdue" ? pickList(view.tabs.overdue, tutorFacts, {}, 0).items.length : 0;
  function onRemindAll() {
    goRemind({ kind: "pick", pick: pickList(view.tabs.overdue, tutorFacts, board.reminders?.byDue ?? {}, clockNow()), batchNames: Object.fromEntries(batchNames), last: lastAt });
  }
  const remindAll = overdueCount > 0 ? { count: overdueCount, onClick: onRemindAll } : null;
  const tabs = TABS.map((id) => ({ id, label: t(`tab.${id}`), count: <span translate="no">{view.counts[id]}</span> }));

  return (
    <AppScreen nav="home" above={<UndoBanner today={today} />}>
      <MonthSwitcher label={months.label(month)} canPrev={moves.prev} canNext={moves.next} onPrev={() => go(shiftMonth(month, -1))} onNext={() => go(shiftMonth(month, 1))} trailing={<ClaimsChip />} />

      {board.blocked ? (
        <p role="status" className="type-caption px-5 pt-2 text-ink-soft wrap-anywhere">
          {t("offlineMonth", { month: months.label(board.blocked) })}
        </p>
      ) : null}

      {empty ? (
        filteredOut ? (
          <NothingInBatch batch={batchName} month={months.label(month)} onShowAll={() => setFilter("all")} />
        ) : (
          <NothingYet isCurrent={isCurrent} month={months.label(month)} nextDue={earliestNextDue(active, today)} />
        )
      ) : allPaid ? (
        <AllPaid month={months.label(month)} nextMonth={isCurrent ? months.name(shiftMonth(month, 1)) : null} collected={collected} students={view.studentsInView} />
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
            <SummaryBar
              collected={typeof collected === "number" ? collected : null}
              due={view.dueOwed}
              overdue={view.overdueOwed}
              labels={{
                collected: withNode(
                  (amount) => t("summary.collected", { amount }),
                  collected === "pending" ? <SummaryPending label={t("summary.pending")} /> : collected === null ? t("summary.unknown") : money(collected),
                ),
                due: withNode((amount) => t("summary.due", { amount }), money(view.dueOwed)),
                overdue: withNode((amount) => t("summary.overdue", { amount }), money(view.overdueOwed)),
              }}
            />
          </div>

          <div className="pt-5 pr-5.5 pl-4">
            <Tabs tabs={tabs} value={tab} onChange={(id) => setTab(id as Tab)} label={t("tabsLabel")} panelId={panelId} />
            <Slip joined role="tabpanel" id={panelId} aria-labelledby={tabId(panelId, tab)} className="px-3">
              <BoardList
                tab={tab}
                rows={view.tabs[tab]}
                month={month}
                isCurrent={isCurrent}
                batchNames={batchNames}
                onMarkPaid={setPaying}
                remind={{ tutor: tutorFacts, today, onRemind }}
                lastAt={lastAt}
                noUpiLine={tab !== "paid" && !tutorReady(tutorFacts)}
                remindAll={remindAll}
              />
            </Slip>
          </div>
        </>
      )}
      <div className="pb-5" />
      {payingRow ? (
        <PaySheet
          row={payingRow}
          batchName={payingRow.student.batchId ? (batchNames.get(payingRow.student.batchId) ?? null) : null}
          today={today}
          onClose={() => setPaying(null)}
          onPaid={(payment) => {
            board.applyPayment(payment);
            board.showNotice({ kind: "paid", payment, name: payingRow.student.name });
            board.refresh(today);
          }}
          onStale={() => board.refresh(today)}
        />
      ) : null}
    </AppScreen>
  );
}
