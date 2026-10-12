"use client";

// The tutor's receipt screen (spec R1-7, criteria 18 and 19; canvas "Receipt"): every payment on one fee, newest
// first, as a receipt each, with "Undo this payment" on the ones that can still be undone (24 hours; one
// confirm). Named by `?due=` in the address: a static shell, because a static export cannot prerender a
// path per fee. Reached from the banner's Send receipt and from the Receipt button on a row. Download and
// Share come in a later part; the parent's link page is Part B.
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useTutor } from "@/components/app/app-gate";
import { AppScreen } from "@/components/app/app-screen";
import { BackLink } from "@/components/app/back-link";
import { LoadingBook } from "@/components/app/loading-book";
import { useQueryParam } from "@/components/app/read-id";
import { useRoster } from "@/components/app/roster";
import { RosterGate } from "@/components/app/roster-states";
import { useBoard } from "@/components/board/board-state";
import { useMonthWords } from "@/components/board/month-switcher";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/locales";
import { homePath, localeHref } from "@/config/routes";
import { readDue, type Due } from "@/lib/dues";
import { remaining } from "@/lib/dues-board";
import { formatRupees } from "@/lib/format";
import { PaymentError, readPaymentsOfDue, voidPayment, type Payment, type PaymentErrorCode } from "@/lib/payments";
import { undoOpen, withPaid } from "@/lib/payments-view";
import { ReceiptCard } from "./receipt-card";

type Loaded = { status: "loading" } | { status: "error" } | { status: "missing" } | { status: "ready"; due: Due; payments: Payment[] };

function UndoControl({ payment, onDone }: Readonly<{ payment: Payment; onDone: (voided: Payment) => void }>) {
  const t = useTranslations("pay");
  const [asking, setAsking] = useState(false);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<PaymentErrorCode | null>(null);

  async function undo() {
    if (working) return;
    setWorking(true);
    setProblem(null);
    try {
      onDone(await voidPayment(payment.id));
    } catch (error) {
      setProblem(error instanceof PaymentError ? error.code : "failed");
      setAsking(false);
    } finally {
      setWorking(false);
    }
  }

  const message =
    problem === null
      ? null
      : problem === "offline"
        ? t("error.offline")
        : problem === "undo_window_over" || problem === "already_voided"
          ? t("error.undoLate")
          : t("error.undoFailed");

  return (
    <div className="mt-1 flex flex-col gap-3 border-t border-dashed border-ink pt-3">
      <div aria-live="polite" aria-atomic="true" className="empty:hidden">
        {message ? <Banner kind={problem === "offline" ? "offline" : "error"} title={problem === "offline" ? message : null} detail={problem === "offline" ? null : message} /> : null}
      </div>
      {asking ? (
        <>
          <p role="alert" className="type-body font-bold wrap-anywhere">
            {t("receipt.undoAsk")}
          </p>
          <div className="flex flex-wrap gap-3 pr-1.5 pb-1.5">
            <Button variant="record" busy={working} busyLabel={t("receipt.undoing")} onClick={undo}>
              {t("receipt.undoYes")}
            </Button>
            <Button variant="outline" onClick={() => setAsking(false)} disabled={working}>
              {t("receipt.undoKeep")}
            </Button>
          </div>
        </>
      ) : (
        <div className="pr-1.5 pb-1.5">
          <Button variant="outline" onClick={() => setAsking(true)}>
            {t("receipt.undo")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Receipts({ dueId }: Readonly<{ dueId: string }>) {
  const t = useTranslations("pay");
  const app = useTranslations("appState");
  const board = useBoard();
  const months = useMonthWords();
  const roster = useRoster();
  const { tutor } = useTutor();
  const [state, setState] = useState<Loaded>({ status: "loading" });
  // The clock is read when the screen opens and when a payment is undone, not while it is drawn.
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const [due, payments] = await Promise.all([readDue(dueId), readPaymentsOfDue(dueId)]);
      setNow(Date.now());
      setState(due === null ? { status: "missing" } : { status: "ready", due, payments });
    } catch {
      setState({ status: "error" });
    }
  }, [dueId]);

  useEffect(() => {
    // Reading the fee and its payments is the screen's whole job on opening; the result goes into state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const { applyVoid } = board;
  const voided = useCallback(
    (payment: Payment) => {
      applyVoid(payment);
      setNow(Date.now());
      setState((held) =>
        held.status === "ready"
          ? { ...held, due: withPaid(held.due, held.due.amountPaid - payment.amount), payments: held.payments.map((p) => (p.id === payment.id ? payment : p)) }
          : held,
      );
    },
    [applyVoid],
  );

  if (state.status === "loading") return <LoadingBook label={app("loading")} />;
  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-4 px-5 pt-4 pr-5.5">
        <Banner kind="error" title={null} detail={t("receipt.loadError")} actions={[{ label: t("receipt.retry"), onClick: () => void load() }]} />
      </div>
    );
  }
  if (state.status === "missing") return <NotFound />;

  const { due, payments } = state;
  const student = roster.students.find((s) => s.id === due.studentId);
  const feeLabel = due.kind === "opening" ? t("receipt.earlier") : months.label(due.month ?? "");
  const left = remaining(due);

  return (
    <div className="flex flex-col gap-5 pt-1.5 pr-5.5 pb-8 pl-5">
      <BackLinkHome />
      <h1 className="type-headline text-3xl wrap-anywhere">{t("receipt.title")}</h1>
      <p className="type-body text-ink-soft wrap-anywhere">
        <span translate="no" className="font-bold text-ink">
          {student?.name}
        </span>
        <span aria-hidden="true"> · </span>
        {feeLabel}
        <span aria-hidden="true"> · </span>
        {t("receipt.balanceNow")}{" "}
        <span className="font-bold text-ink">{left === 0 ? t("receipt.nil") : <span translate="no">{formatRupees(left)}</span>}</span>
      </p>
      {payments.length === 0 ? <p className="type-body-lg text-ink-soft">{t("receipt.none")}</p> : null}
      {payments.map((payment) => (
        <ReceiptCard key={payment.id} payment={payment} tutorName={tutor.name} studentName={student?.name ?? ""} parentName={student?.parentName ?? null} feeLabel={feeLabel}>
          {payment.voidedAt === null && undoOpen(payment.createdAt, now) ? <UndoControl payment={payment} onDone={voided} /> : null}
        </ReceiptCard>
      ))}
    </div>
  );
}

function BackLinkHome() {
  const t = useTranslations("pay");
  const locale = useLocale() as Locale;
  return <BackLink href={localeHref(locale, homePath)} label={t("receipt.back")} />;
}

function NotFound() {
  const t = useTranslations("pay");
  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5 pr-5.5">
      <BackLinkHome />
      <h1 className="type-headline text-4xl wrap-break-word">{t("receipt.notFound")}</h1>
      <p className="type-body-lg text-ink-soft">{t("receipt.notFoundBody")}</p>
    </div>
  );
}

function Chosen() {
  const id = useQueryParam("due");
  const app = useTranslations("appState");
  if (id === undefined) return <LoadingBook label={app("loading")} />;
  return <AppScreen>{id === null ? <NotFound /> : <Receipts key={id} dueId={id} />}</AppScreen>;
}

export function ReceiptScreen() {
  return (
    <RosterGate>
      <Chosen />
    </RosterGate>
  );
}
