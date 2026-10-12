"use client";

// The steps of one run (spec R1-8, criteria 14 to 19; canvas "Remind"): the top bar with "Reminder n of m" and
// "Stop", the progress strip, one step card, "Up next", and at the end the summary. One reminder is a run of
// one ("Reminder 1 of 1"), with no Skip and no Up next.
//
// The tutor moves on three ways, each exactly once per step: the page coming back after WhatsApp took the
// screen (use-return-advance), "Next", and "Skip" (which logs nothing). The log call is made in the tap on
// "Open WhatsApp", with the request id this step made on its first tap and keeps for its life.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { useTutor } from "@/components/app/app-gate";
import { AppScreen } from "@/components/app/app-screen";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/locales";
import { homePath, localeHref } from "@/config/routes";
import { formatRupees } from "@/lib/format";
import { alreadyRemindedToday, templateTag, type QueueItem } from "@/lib/reminder-rules";
import { newId } from "@/lib/uuid";
import { AgainSheet } from "./again-sheet";
import { RemindStep, useMessage } from "./remind-step";
import { useRemind, type LastAt } from "./remind-provider";
import { useReturnAdvance } from "./use-return-advance";

type Result = "opened" | "skipped";

const segment: Record<"opened" | "skipped" | "current" | "ahead", string> = {
  opened: "bg-stamp",
  skipped: "border-dashed bg-slip",
  current: "bg-blue",
  ahead: "bg-slip",
};

// More than this many segments would be slivers; the words say where the tutor is.
const STRIP_MAX = 20;

export function RemindRun({ queue, last }: Readonly<{ queue: readonly QueueItem[]; last: LastAt }>) {
  const t = useTranslations("remindScreen");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { tutor } = useTutor();
  const { tone, setTone, clear, log } = useRemind();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Readonly<Record<number, Result>>>({});
  const [confirmed, setConfirmed] = useState<ReadonlySet<number>>(new Set());
  // The day and time are the phone's, read once when the screen opens: the question is about "today" at that moment.
  const [now] = useState(() => Date.now());
  // One request id per step, made on its first tap and kept for its life. The ref is what the tap reads (two taps in one
  // moment must agree); the state is what the screen draws from.
  const idsInHand = useRef<Record<number, string>>({});
  const [requestIds, setRequestIds] = useState<Readonly<Record<number, string>>>({});

  const total = queue.length;
  const finished = index >= total;
  const item = finished ? undefined : queue[index];
  const message = useMessage(item ?? queue[0], tone, tutor);

  const requestId = requestIds[index];
  const pending = useSyncExternalStore(log.subscribe, log.get, log.get);
  const logFailed = pending >= 0 && requestId !== undefined && log.isPending(requestId);

  // Exactly once per step, whichever of Next and a return gets here first.
  const advance = (from: number) => {
    setIndex((i) => (i === from ? i + 1 : i));
    void log.flush();
  };
  const opened = useReturnAdvance(index, advance);

  const home = () => {
    clear();
    router.replace(localeHref(locale, homePath));
  };

  const lastAt = item ? last[item.dueId] : undefined;
  const asking = item !== undefined && lastAt !== undefined && alreadyRemindedToday(lastAt, now) && !confirmed.has(index);

  function skipThis() {
    setResults((r) => ({ ...r, [index]: "skipped" }));
    advance(index);
  }

  function onOpen() {
    if (item === undefined || message === null) return;
    // Synchronous, and never awaited: the browser follows the link in this same tap.
    opened();
    const id = (idsInHand.current[index] ??= newId());
    setRequestIds((all) => (all[index] === id ? all : { ...all, [index]: id }));
    log.log({ dueId: item.dueId, template: templateTag(tone, item.parentLanguage, item.kind === "opening" ? "balance" : "month"), requestId: id });
    setResults((r) => (r[index] === "opened" ? r : { ...r, [index]: "opened" }));
  }

  const openedCount = Object.values(results).filter((r) => r === "opened").length;
  const skippedCount = Object.values(results).filter((r) => r === "skipped").length;

  const header = (
    <>
      <header className="flex items-center justify-between pr-3 pl-5">
        <p className="type-label">{t("progress", { n: Math.min(index + 1, total), m: total })}</p>
        <button type="button" onClick={home} className="type-control-sm min-h-tap px-2 ring:ground-ring">
          {t("stop")}
        </button>
      </header>
      {total <= STRIP_MAX ? (
        <div aria-hidden="true" className="grid gap-1.5 px-5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
          {queue.map((q, i) => {
            const state = results[i] ?? (i === index && !finished ? "current" : "ahead");
            return <div key={q.dueId} data-segment={state} className={`h-2.5 border-2 border-ink ${segment[state]}`} />;
          })}
        </div>
      ) : null}
    </>
  );

  if (finished) {
    return (
      <AppScreen>
        <div data-ph-no-capture="" data-sentry-mask="" className="flex flex-col">
          {header}
          <section className="mx-4 mt-6 mr-5.5 flex flex-col gap-4">
            <h1 className="type-headline text-3xl wrap-anywhere">{t("done", { n: openedCount, k: skippedCount })}</h1>
            <div className="pr-1.5 pb-1.5">
              <Button variant="send" size="large" full onClick={home}>
                {t("home")}
              </Button>
            </div>
          </section>
        </div>
      </AppScreen>
    );
  }

  const upNext = queue.slice(index + 1);
  return (
    <AppScreen>
      <div data-ph-no-capture="" data-sentry-mask="" className="flex flex-col pb-6">
        {header}
        {asking && item ? null : (
          <RemindStep
            key={index}
            item={item!}
            tone={tone}
            onTone={setTone}
            message={message}
            onOpen={onOpen}
            opened={results[index] === "opened"}
            logFailed={logFailed}
            canSkip={total > 1}
            onSkip={skipThis}
            onNext={() => advance(index)}
          />
        )}
        {upNext.length > 0 && !asking ? (
          <section className="mx-4 mt-5 mr-5.5 border-2 border-b-0 border-ink bg-slip px-3 pt-2.5">
            <h2 className="type-label text-ink-label">{t("upNext")}</h2>
            <ul>
              {upNext.map((q) => (
                <li key={q.dueId} className="flex min-h-tap flex-wrap items-center justify-between gap-x-3 border-b border-rule py-1.5 last:border-b-0">
                  <span translate="no" className="type-name min-w-0 wrap-anywhere">
                    {q.studentName}
                  </span>
                  <span translate="no" className="type-amount-row">
                    {formatRupees(q.remaining)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {/* Inside the wrapper: the question names the parent. */}
      {item !== undefined && lastAt !== undefined ? (
        <AgainSheet
          item={item}
          lastAt={lastAt}
          open={asking}
          onYes={() => setConfirmed((c) => new Set(c).add(index))}
          onNo={() => {
            // One reminder: back where she was, nothing changed. In a run: this parent is skipped, nothing logged.
            if (total === 1) return home();
            skipThis();
          }}
        />
      ) : null}
      </div>
    </AppScreen>
  );
}
