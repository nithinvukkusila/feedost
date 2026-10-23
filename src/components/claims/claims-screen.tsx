"use client";

// The inbox of parents' "I've paid" claims (spec R1-10, criteria 17 to 26; canvas "Claims", PRD screen 12):
// a back arrow, "{n} parents say they've paid", "Check your UPI app, then confirm.", a card for each claim
// waiting (newest first) and, under "Earlier", the last 20 the tutor handled. Reached only from Home's chip
// and its own address. It reads when it opens and when the page is shown again; never on a timer, and no
// push. Nothing is saved without the database's answer: a Confirm or Not received moves the card down only
// after the database has said so, and a Confirm shows R1-7's Undo banner and updates the board without a reload.
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppScreen } from "@/components/app/app-screen";
import { BackIcon } from "@/components/app/icons";
import { LoadingBook } from "@/components/app/loading-book";
import { useRoster } from "@/components/app/roster";
import { RosterGate } from "@/components/app/roster-states";
import { useSoftLink } from "@/components/app/use-soft-link";
import { useBoard } from "@/components/board/board-state";
import { useMonthWords } from "@/components/board/month-switcher";
import { UndoBanner } from "@/components/pay/undo-banner";
import { Banner } from "@/components/ui/banner";
import type { Locale } from "@/config/locales";
import { homePath, localeHref } from "@/config/routes";
import { feeLabel, whenOf } from "@/lib/claim-view";
import { readHandledClaims, readPendingClaims, type Claim } from "@/lib/claims";
import { readDuesByIds, type Due } from "@/lib/dues";
import { daysBetween, indiaToday } from "@/lib/dues-board";
import { formatDate } from "@/lib/format";
import type { Payment } from "@/lib/payments";
import { BACK_DAYS } from "@/lib/payments-view";
import { ClaimCard } from "./claim-card";
import { EarlierList } from "./earlier-list";

type Data = { pending: Claim[]; handled: Claim[]; dues: Record<string, Due>; now: number };
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Data };

const EARLIER_MAX = 20;

function Inbox() {
  const t = useTranslations("claims");
  const app = useTranslations("appState");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const months = useMonthWords();
  const roster = useRoster();
  const board = useBoard();
  const [state, setState] = useState<State>({ status: "loading" });
  // Claims another phone handled while this card was open: kept on screen, with their message, until the tutor leaves.
  const [kept, setKept] = useState<Claim[]>([]);
  const reading = useRef(0);

  const load = useCallback(async (quiet: boolean) => {
    const ticket = ++reading.current;
    if (!quiet) setState({ status: "loading" });
    try {
      const [pending, handled] = await Promise.all([readPendingClaims(), readHandledClaims()]);
      // The month of each fee on a card. If this read fails the cards are still right: they just do not name the month.
      const dues = await readDuesByIds([...new Set(pending.map((claim) => claim.dueId))]).catch(() => [] as Due[]);
      if (reading.current !== ticket) return;
      setState({ status: "ready", data: { pending, handled, dues: Object.fromEntries(dues.map((due) => [due.id, due])), now: Date.now() } });
    } catch {
      // A quiet read that fails leaves what is shown; a first read that fails says so.
      if (reading.current === ticket && !quiet) setState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    // The read is the screen's whole job on opening; the result goes into state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(false);
    function onVisible() {
      if (document.visibilityState === "visible") void load(true);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const { applyPayments, showNotice, refresh } = board;
  const nameOf = (studentId: string) => roster.students.find((s) => s.id === studentId)?.name ?? "";

  // A re-read sent before the database answered a Confirm or Not received would bring the handled card back:
  // moving the ticket on drops it. The next re-read (the page shown again) reads what the database holds now.
  function dropReadsInFlight() {
    reading.current += 1;
  }

  function confirmed(claim: Claim, payments: Payment[]) {
    dropReadsInFlight();
    setState((held) =>
      held.status === "ready"
        ? { status: "ready", data: { ...held.data, pending: held.data.pending.filter((c) => c.id !== claim.id), handled: [claim, ...held.data.handled.filter((c) => c.id !== claim.id)].slice(0, EARLIER_MAX) } }
        : held,
    );
    setKept((held) => held.filter((c) => c.id !== claim.id));
    const today = indiaToday(Date.now());
    if (payments.length > 0) {
      applyPayments(payments);
      showNotice({ kind: "paid", payment: payments[payments.length - 1], payments, name: nameOf(claim.studentId) });
    }
    refresh(today);
  }

  function rejected(claim: Claim) {
    dropReadsInFlight();
    setState((held) =>
      held.status === "ready"
        ? { status: "ready", data: { ...held.data, pending: held.data.pending.filter((c) => c.id !== claim.id), handled: [claim, ...held.data.handled.filter((c) => c.id !== claim.id)].slice(0, EARLIER_MAX) } }
        : held,
    );
    setKept((held) => held.filter((c) => c.id !== claim.id));
  }

  function handledElsewhere(claim: Claim) {
    setKept((held) => (held.some((c) => c.id === claim.id) ? held : [...held, claim]));
    void load(true);
  }

  const homeHref = localeHref(locale, homePath);
  const back = (
    <header className="px-2 pt-1.5">
      <a href={homeHref} onClick={soft(homeHref)} aria-label={t("back")} className="flex size-tap items-center justify-center text-ink ring:ground-ring">
        <BackIcon />
      </a>
    </header>
  );

  if (state.status === "loading") return <LoadingBook label={app("loading")} />;
  if (state.status === "error") {
    return (
      <AppScreen>
        {back}
        <div className="px-5 pt-4 pr-5.5">
          <Banner kind="error" title={null} detail={t("loadError")} actions={[{ label: t("retry"), onClick: () => void load(false) }]} />
        </div>
      </AppScreen>
    );
  }

  const { data } = state;
  const today = indiaToday(data.now);
  const shown = [...data.pending, ...kept.filter((k) => !data.pending.some((p) => p.id === k.id))];
  const count = data.pending.length;

  function whenText(claim: Claim): string {
    const w = whenOf(claim.createdAt, data.now);
    return w.when === "today" ? t("when.today", { time: w.clock }) : w.when === "yesterday" ? t("when.yesterday", { time: w.clock }) : t("when.date", { date: formatDate(w.day) });
  }
  function feeText(claim: Claim): string | null {
    const label = feeLabel(claim, data.dues[claim.dueId]);
    if (label === null) return null;
    return label.kind === "month" ? months.name(label.month) : label.kind === "earlier" ? t("fee.earlier") : t("fee.fees", { n: String(label.n) });
  }

  return (
    <AppScreen above={<UndoBanner today={today} />}>
      {back}
      <div className="px-5 pr-5.5">
        <h1 className="type-headline text-4xl wrap-anywhere">{shown.length === 0 ? t("empty") : count === 1 ? t("headingOne") : count === 0 ? t("empty") : t("heading", { n: String(count) })}</h1>
        {shown.length > 0 ? <p className="type-body-lg mt-2 text-ink-soft wrap-anywhere">{t("sub")}</p> : null}
      </div>

      {shown.length > 0 ? (
        <ul className="flex flex-col gap-5 pt-4 pr-5.5 pl-4">
          {shown.map((claim) => {
            const student = roster.students.find((s) => s.id === claim.studentId);
            return (
              <li key={claim.id}>
                <ClaimCard
                  claim={claim}
                  name={student?.name ?? ""}
                  archived={student !== undefined && !student.active}
                  tooOld={daysBetween(indiaToday(claim.createdAt), today) > BACK_DAYS}
                  when={whenText(claim)}
                  fee={feeText(claim)}
                  onConfirmed={confirmed}
                  onRejected={rejected}
                  onHandledElsewhere={handledElsewhere}
                />
              </li>
            );
          })}
        </ul>
      ) : null}

      <EarlierList items={data.handled.map((claim) => ({ claim, name: nameOf(claim.studentId) }))} />
      <div className="pb-8" />
    </AppScreen>
  );
}

export function ClaimsScreen() {
  return (
    <RosterGate>
      <Inbox />
    </RosterGate>
  );
}
