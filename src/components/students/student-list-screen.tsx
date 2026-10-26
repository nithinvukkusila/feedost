"use client";

// The Students screen (spec R1-3, criteria 4 to 12; canvas "Students"): the count, the title and Add, a
// search, the batch filter, the rows, the "Batches" link and the archived students folded at the foot.
// It reads the cached roster and filters it on the phone. Each active row has a status chip from this month's fees
// (UX-review-fixes-2, criterion 10), read through the dues board's own store and cache (`ensureCurrent`): rows show
// at once and the chips join them when the fees arrive; if the read fails the rows stay without chips.
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useState } from "react";
import { PlusIcon, SearchIcon } from "@/components/app/icons";
import { AppScreen } from "@/components/app/app-screen";
import { useRoster } from "@/components/app/roster";
import { RosterGate } from "@/components/app/roster-states";
import { useSoftLink } from "@/components/app/use-soft-link";
import { useBoard } from "@/components/board/board-state";
import { Button } from "@/components/ui/button";
import { Slip } from "@/components/ui/slip";
import type { Locale } from "@/config/locales";
import { batchesPath, localeHref, studentNewPath } from "@/config/routes";
import { currentMonth, indiaToday, nextDueDate, studentChips } from "@/lib/dues-board";
import {
  activeStudents,
  archivedStudents,
  batchCounts,
  filterByBatch,
  searchStudents,
  sortBatches,
  sortStudents,
  type BatchFilterValue,
} from "@/lib/student-list";
import { ArchivedList } from "./archived-list";
import { BatchFilter, effectiveFilter, filterPanelProps } from "./batch-filter";
import { StudentRow } from "./student-row";

function ListBody() {
  const t = useTranslations("students");
  const batchWords = useTranslations("batches");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const roster = useRoster();
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<BatchFilterValue>("all");
  const panelId = useId();
  const searchId = useId();
  const board = useBoard();
  const { ensureCurrent } = board;
  // Today in India, read once when the screen opens.
  const [today] = useState(() => indiaToday(Date.now()));
  useEffect(() => ensureCurrent(today), [ensureCurrent, today]);
  const own = board.months[currentMonth(today)]?.rows;
  const carried = board.unpaid?.rows;
  // Null until both reads are in: no chip is better than a wrong one.
  const chips = useMemo(() => (own && carried ? studentChips([...own, ...carried], roster.students, today) : null), [own, carried, roster.students, today]);

  const active = activeStudents(roster.students);
  const archived = archivedStudents(roster.students);
  const batches = sortBatches(roster.batches);
  const counts = batchCounts(active, batches);
  const current = effectiveFilter(filter, batches, counts);
  const names = new Map(batches.map((batch) => [batch.id, batch.name]));

  const shown = sortStudents(filterByBatch(searchStudents(active, text), current));
  const searching = text.trim() !== "";
  const archivedShown = searching ? searchStudents(archived, text) : archived;

  const addHref = localeHref(locale, studentNewPath);
  const batchesHref = localeHref(locale, batchesPath);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-x-3 gap-y-3 pt-4.5 pr-5.5 pl-5">
        <div className="min-w-0">
          <p className="type-label text-ink-label wrap-anywhere">
            {t("count", { n: active.length })}
            <span aria-hidden="true"> · </span>
            {t("batchCount", { n: batches.length })}
          </p>
          <h1 className="type-headline text-5xl wrap-break-word">{t("title")}</h1>
        </div>
        <div className="pr-1.5 pb-1.5">
          <Button variant="record" href={addHref} onClick={soft(addHref)} iconStart={<PlusIcon />}>
            {t("add")}
          </Button>
        </div>
      </header>

      {active.length === 0 ? (
        <section className="px-5 pt-8 pr-5.5">
          <h2 className="type-headline text-4xl wrap-break-word">{t("empty.title")}</h2>
          <p className="type-body-lg mt-3 text-ink-soft">{t("empty.body")}</p>
          <div className="mt-6 pr-1.5 pb-1.5">
            <Button variant="record" size="xl" full href={addHref} onClick={soft(addHref)} iconStart={<PlusIcon />}>
              {t("addFirst")}
            </Button>
          </div>
        </section>
      ) : (
        <>
          <div className="px-5 pt-3.5">
            <label htmlFor={searchId} className="sr-only">
              {t("searchLabel")}
            </label>
            <div className="flex min-h-control items-center gap-2 border-b-2 border-ink text-ink-soft focus-within:border-b-4 focus-within:border-blue">
              <SearchIcon />
              <input
                id={searchId}
                type="text"
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                data-ph-no-capture=""
                data-sentry-mask=""
                value={text}
                onChange={(event) => setText(event.currentTarget.value)}
                placeholder={t("searchPlaceholder")}
                className="type-body-lg min-h-tap min-w-0 flex-1 bg-transparent py-2 text-ink outline-none placeholder:text-ink-label"
              />
            </div>
          </div>

          <div className="pt-4 pr-5.5 pl-4">
            <BatchFilter batches={batches} counts={counts} value={filter} onChange={setFilter} panelId={panelId} />
            <Slip joined={batches.length > 0 && batches.length <= 3} className="px-3" {...filterPanelProps(batches, panelId, current)}>
              {shown.length === 0 ? (
                <div className="flex flex-col items-start gap-3 py-5">
                  <p className="type-body text-ink-soft wrap-anywhere">
                    {searching ? t("noMatch", { text: text.trim() }) : batchWords("noStudents")}
                  </p>
                  {searching ? (
                    <Button variant="outline" onClick={() => setText("")}>
                      {t("clearSearch")}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <ul>
                  {shown.map((student, index) => (
                    <StudentRow
                      key={student.id}
                      student={student}
                      number={index + 1}
                      batchName={student.batchId ? (names.get(student.batchId) ?? null) : null}
                      chip={chips?.get(student.id) ?? null}
                      nextFee={chips === null ? null : nextDueDate(student.dueDay, today)}
                    />
                  ))}
                </ul>
              )}
            </Slip>
          </div>
        </>
      )}

      {roster.stale ? (
        <div className="flex flex-wrap items-center gap-x-3 px-5 pt-3">
          <p role="status" className="type-caption text-ink-soft">
            {t("stale")}
          </p>
          <button type="button" onClick={roster.reload} className="type-control-sm min-h-tap py-2 text-ink underline ring:ground-ring">
            {t("loadError.retry")}
          </button>
        </div>
      ) : null}

      <div className="px-5 pt-3">
        <div className="pr-1.5 pb-1.5">
          <Button variant="outline" href={batchesHref} onClick={soft(batchesHref)}>
            {t("manageBatches")}
          </Button>
        </div>
      </div>

      <ArchivedList students={archivedShown} batches={batches} />
      <div className="pb-5" />
    </>
  );
}

export function StudentListScreen() {
  return (
    <RosterGate>
      <AppScreen nav="students">
        <ListBody />
      </AppScreen>
    </RosterGate>
  );
}
