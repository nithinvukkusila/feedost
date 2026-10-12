"use client";

// The parent's receipt page (spec R1-7 Part B, criteria 28 to 31; canvas "Receipt"). A static shell: the token is
// read from the address in an effect, one POST asks the `receipt` function for that receipt, and the page shows
// what comes back. The words of all four languages arrive as a prop; the receipt's own `language` picks one.
// Before there is a receipt (opening, not found, too many tries, failed) the browser's preferred language is used.
//
// Nothing here is kept: no storage, no cookie, no analytics. The token lives only in the effect that sends it
// (and again in the retry, which reads the address afresh); it is never rendered or put in the title.
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Banner } from "@/components/ui/banner";
import { Slip } from "@/components/ui/slip";
import { Stamp } from "@/components/ui/stamp";
import { StatusTag } from "@/components/ui/status-tag";
import { brand } from "@/config/brand";
import type { Locale } from "@/config/locales";
import { amountFit } from "@/lib/amount-fit";
import { formatDate, formatRupees } from "@/lib/format";
import { fetchReceipt, tokenFromPath, type CancelledReceipt, type Outcome, type PaidReceipt } from "@/lib/receipt-public";
import { browserLanguage, fill, monthLabel, parts, subjectsLine, type AllReceiptWords, type ReceiptWords } from "@/lib/receipt-words";

type State = { kind: "loading" } | Outcome;

/** The tutor's name, the receipt number and what the tutor teaches: the head of every receipt. */
function Head({ words, tutorName, subjects, receiptNo }: Readonly<{ words: ReceiptWords; tutorName: string | null; subjects: string; receiptNo: number }>) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
      <div className="min-w-0 grow basis-32">
        {tutorName ? (
          <p translate="no" className="type-headline text-2xl wrap-anywhere">
            {tutorName}
          </p>
        ) : null}
        {subjects ? <p className="type-caption text-ink-soft wrap-anywhere">{subjects}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="type-label text-ink-label">{words.no}</p>
        <p translate="no" className="type-amount-row text-2xl text-cloth">
          {receiptNo}
        </p>
      </div>
    </div>
  );
}

function PaidSlip({ words, receipt }: Readonly<{ words: ReceiptWords; receipt: PaidReceipt }>) {
  const paidOn = formatDate(receipt.paidOn);
  const figures = `${formatRupees(receipt.amount)}/-`;
  const settled = receipt.balanceAfter === 0;
  const template = receipt.parentName ? words.sentence : words.sentenceNoParent;
  const method = receipt.method === "upi" ? words.upi : words.cash;
  const values = {
    parent: receipt.parentName ?? "",
    student: receipt.studentName,
    month: monthLabel(words, receipt.month),
    method,
  };
  // Names and the month are set apart (blue, dotted underline) as the ledger's filled-in blanks; the method is in the sentence plain.
  const blank = new Set(["parent", "student", "month"]);
  return (
    <Slip as="article" className="flex flex-col gap-3 p-4.5">
      <Head words={words} tutorName={receipt.tutorName} subjects={subjectsLine(words, receipt.tutorSubjects)} receiptNo={receipt.receiptNo} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t-2 border-b border-ink py-1.5">
        <p className="type-label">{words.feeReceipt}</p>
        <p className="type-label">
          <span translate="no">{fill(words.date, { date: paidOn })}</span>
        </p>
      </div>

      <p className="type-body-lg text-ink-soft wrap-anywhere">
        {parts(template, values).map((part, index) =>
          part.slot !== undefined && blank.has(part.slot) ? (
            <span key={index} translate="no" className="font-bold text-blue underline decoration-dotted decoration-2 underline-offset-4">
              {part.text}
            </span>
          ) : (
            <span key={index} translate={part.slot === undefined ? undefined : "no"}>
              {part.text}
            </span>
          ),
        )}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        {/* The amount shrinks to fit its box, as the headline amounts do, so a seven-figure amount is never cut at the largest text. */}
        <div className="amount-box min-w-0 grow basis-40 border-2 border-ink px-3.5 pt-1.5 pb-1">
          <p translate="no" style={amountFit(figures)} className="type-amount amount-size-6xl block text-blue">
            {figures}
          </p>
        </div>
        <div className="text-right">
          <p className="type-label text-ink-label">{words.balance}</p>
          <p className="type-body-lg font-extrabold">{settled ? words.nil : <span translate="no" className="type-amount-row text-xl">{formatRupees(receipt.balanceAfter)}</span>}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusTag status={settled ? "paid" : "part-paid"}>{settled ? words.paid : words.partPaid}</StatusTag>
        <Stamp size="md" tone={settled ? "stamp" : "blue"} label={settled ? words.stampPaid : words.stampPartPaid} secondLine={<span translate="no">{paidOn}</span>}>
          {settled ? words.stampPaid : words.stampPartPaid}
        </Stamp>
      </div>
    </Slip>
  );
}

function CancelledSlip({ words, receipt }: Readonly<{ words: ReceiptWords; receipt: CancelledReceipt }>) {
  return (
    <Slip as="article" className="flex flex-col gap-3 p-4.5">
      <Head words={words} tutorName={receipt.tutorName} subjects="" receiptNo={receipt.receiptNo} />
      <div className="flex flex-wrap items-baseline gap-x-3 border-t-2 border-b border-ink py-1.5">
        <p className="type-label text-ink-label">{words.student}</p>
        <p translate="no" className="type-body min-w-0 font-bold wrap-anywhere">
          {receipt.studentName}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="type-body-lg min-w-0 grow basis-40 font-bold wrap-anywhere">
          {words.cancelled.title}
        </p>
        <Stamp size="md" tone="blue" label={words.stampCancelled}>
          {words.stampCancelled}
        </Stamp>
      </div>
    </Slip>
  );
}

/** Three blank lines on the slip, the loading block of the book: the page shows its shape and says what it is doing. */
function Opening({ words }: Readonly<{ words: ReceiptWords }>) {
  return (
    <Slip as="div" className="flex flex-col gap-3 p-4.5">
      <p role="status" className="type-body-lg font-bold">
        {words.loading}
      </p>
      <div aria-hidden="true" className="flex flex-col gap-2">
        <div className="h-6 w-2/3 bg-tab-idle" />
        <div className="h-4 w-full bg-tab-idle" />
        <div className="h-4 w-5/6 bg-tab-idle" />
      </div>
    </Slip>
  );
}

const subscribeToNothing = () => () => {};

export function PublicReceipt({ words }: Readonly<{ words: AllReceiptWords }>) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The browser's preferred languages, read once the page is in the browser; English in the delivered HTML.
  const preferred = useSyncExternalStore(
    subscribeToNothing,
    () => (navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]).join(","),
    () => "",
  );
  const fallback = browserLanguage(preferred.split(","));

  useEffect(() => {
    const stop = new AbortController();
    // A fresh read of the address each time: nothing else holds the token. An address that cannot hold one asks nothing.
    const token = tokenFromPath(window.location.pathname);
    const outcome: Promise<Outcome> = token === null ? Promise.resolve({ kind: "not_found" }) : fetchReceipt(token, stop.signal);
    void outcome.then((result) => {
      if (!stop.signal.aborted) setState(result);
    });
    return () => stop.abort();
  }, [attempt]);

  const language: Locale = state.kind === "ok" || state.kind === "cancelled" ? state.receipt.language : fallback;
  const w = words[language];

  // The page's own language, for screen readers and for the script's font and line height.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return (
    <main lang={language} data-state={state.kind} aria-busy={state.kind === "loading"} className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 pt-6">
      <div className="flex flex-col gap-4 pr-6 pl-4">
        {state.kind === "loading" ? <Opening words={w} /> : null}
        {state.kind === "ok" ? <PaidSlip words={w} receipt={state.receipt} /> : null}
        {state.kind === "cancelled" ? <CancelledSlip words={w} receipt={state.receipt} /> : null}
        {state.kind === "not_found" ? <Banner kind="error" title={w.notFound.title} detail={w.notFound.detail} /> : null}
        {state.kind === "rate_limited" ? <Banner kind="error" title={w.rateLimited.title} detail={w.rateLimited.detail} /> : null}
        {state.kind === "failed" ? (
          <Banner kind="error" title={w.failed.title} detail={w.failed.detail} actions={[{ label: w.failed.retry, onClick: retry }]} />
        ) : null}
      </div>
      <div className="grow" />
      <footer className="on-cloth-ground bg-cloth px-5 pt-4 pb-5 text-on-cloth outline-2 -outline-offset-8 outline-stitch outline-dashed">
        <p className="type-headline text-2xl">{brand.name}</p>
        <p className="type-body text-on-cloth-soft">{w.footer}</p>
      </footer>
    </main>
  );
}
