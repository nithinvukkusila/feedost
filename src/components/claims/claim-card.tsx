"use client";

// One claim waiting for the tutor (spec R1-10, criteria 18 to 24; canvas "Claims"): when it was sent and which
// fee, the student's name, the amount in the headline face, the proof (the UPI reference in groups of four,
// with Copy), and two buttons: "Not received" (asks once, tells no one) and "Confirm paid" (black: it records).
//
// The database decides everything: the card leaves the list only after the database has answered (no
// optimistic result). One request id is made on the first Confirm tap and sent again on every retry, so
// a tap that saved but lost its answer never records twice. A refusal says why on the card itself.
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Slip } from "@/components/ui/slip";
import { amountFit } from "@/lib/amount-fit";
import { groupRef } from "@/lib/claim-view";
import { ClaimError, confirmClaim, rejectClaim, type Claim, type ClaimErrorCode } from "@/lib/claims";
import { formatRupees } from "@/lib/format";
import { readPaymentsByReceipt, type Payment } from "@/lib/payments";
import { newId } from "@/lib/uuid";

/** How long "Copied" stays. */
const COPIED_MS = 2_000;

type Problem = { code: ClaimErrorCode; remaining: number | null };

export type ClaimCardProps = {
  claim: Claim;
  name: string;
  /** The student is archived: Confirm is not offered (the database would refuse it). */
  archived: boolean;
  /** Sent over 90 days ago: Confirm is not offered. */
  tooOld: boolean;
  /** "Today 4:12 pm" or a date, ready to show. */
  when: string;
  /** "October", "Earlier balance", "2 fees", or null when the fee is not known. */
  fee: string | null;
  /** The database confirmed the claim. `payments` are the payments it made (empty when they could not be read just now). */
  onConfirmed: (claim: Claim, payments: Payment[]) => void;
  onRejected: (claim: Claim) => void;
  /** Another phone handled this claim first: the list should be read again. */
  onHandledElsewhere: (claim: Claim) => void;
};

export function ClaimCard({ claim, name, archived, tooOld, when, fee, onConfirmed, onRejected, onHandledElsewhere }: Readonly<ClaimCardProps>) {
  const t = useTranslations("claims");
  const pay = useTranslations("pay");
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);
  const [asking, setAsking] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  // Found out from the database: the student was archived, or the claim is too old, since this phone last looked.
  const [blocked, setBlocked] = useState<"archived" | "old" | "gone" | null>(null);
  const [canCopy, setCanCopy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Made by the first Confirm tap and sent again on every retry. A refusal that saved nothing for certain makes a new one.
  const requestId = useRef<string | null>(null);
  const working = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // The browser's clipboard exists only on a secure page and in some browsers: the button is drawn only when it can work. Known only in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanCopy(typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function");
    return () => {
      if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    };
  }, []);

  const total = formatRupees(claim.amount);
  const noConfirm = archived || tooOld || blocked !== null;

  async function copy() {
    if (claim.upiRef === null) return;
    try {
      await navigator.clipboard.writeText(claim.upiRef);
    } catch {
      return;
    }
    setCopied(true);
    if (copiedTimer.current !== null) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), COPIED_MS);
  }

  function fail(error: unknown) {
    const code = error instanceof ClaimError ? error.code : "failed";
    const remaining = error instanceof ClaimError ? error.remaining : null;
    // Only what may have reached the database keeps its request id; a clean refusal saved nothing.
    if (code !== "offline" && code !== "failed" && code !== "request_reused") requestId.current = null;
    if (code === "student_archived") setBlocked("archived");
    if (code === "date_out_of_range") setBlocked("old");
    if (code === "already_handled" || code === "claim_not_found") {
      setBlocked("gone");
      onHandledElsewhere(claim);
    }
    setProblem({ code, remaining });
    setAsking(false);
  }

  async function confirm() {
    if (working.current) return;
    working.current = true;
    setBusy("confirm");
    setProblem(null);
    requestId.current ??= newId();
    try {
      const done = await confirmClaim({ claimId: claim.id, requestId: requestId.current });
      let payments: Payment[] = [];
      if (done.receiptFrom !== null && done.receiptCount !== null) {
        try {
          payments = await readPaymentsByReceipt(done.receiptFrom, done.receiptCount);
        } catch {
          // The claim is confirmed whatever happens here; without the payments the banner is simply not shown.
        }
      }
      onConfirmed(done, payments);
    } catch (error) {
      fail(error);
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  async function reject() {
    if (working.current) return;
    working.current = true;
    setBusy("reject");
    setProblem(null);
    try {
      onRejected(await rejectClaim(claim.id));
    } catch (error) {
      fail(error);
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  // "quiet": the sentence is already on screen as Confirm's disabled reason (archived, too old), so it is only announced.
  let message: { kind: "error" | "offline" | "quiet"; text: string } | null = null;
  if (problem !== null) {
    const { code, remaining } = problem;
    const text =
      code === "offline"
        ? pay("error.offline")
        : code === "amount_over_remaining" && remaining !== null
          ? t("overRemaining", { amount: formatRupees(remaining) })
          : code === "already_handled" || code === "claim_not_found"
            ? t("handled")
            : code === "student_archived"
              ? t("archived", { name })
              : code === "date_out_of_range"
                ? t("tooOld")
                : code === "not_signed_in"
                  ? pay("error.signedOut")
                  : code === "request_reused"
                    ? pay("error.reused")
                    : t("failed");
    message = { kind: code === "offline" ? "offline" : code === "student_archived" || code === "date_out_of_range" ? "quiet" : "error", text };
  }
  const reason = blocked === "gone" ? null : archived || blocked === "archived" ? t("archived", { name }) : tooOld || blocked === "old" ? t("tooOld") : null;
  const done = blocked === "gone";

  return (
    <Slip as="article" aria-label={t("card", { name, amount: total })} className="flex flex-col gap-3 py-3.5 pr-4 pl-4">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <div className="min-w-0 grow-9999 basis-32">
          <p className="type-label text-ink-soft wrap-anywhere">
            <span translate="no">{when}</span>
            {fee ? (
              <>
                <span aria-hidden="true"> · </span>
                {fee}
              </>
            ) : null}
          </p>
          <p translate="no" className="type-headline text-2xl wrap-anywhere">
            {name}
          </p>
        </div>
        <div className="amount-box grow basis-28 text-right">
          <p translate="no" style={amountFit(total)} className="type-amount amount-size-4xl block text-blue">
            {total}
          </p>
        </div>
      </div>

      <div className="flex min-h-13 flex-wrap items-center justify-between gap-x-2 border-y border-dashed border-ink py-1">
        <div className="min-w-0">
          <p className="type-label text-ink-soft">{claim.upiRef !== null ? t("ref") : t("screenshot")}</p>
          {claim.upiRef !== null ? (
            <p translate="no" className="type-amount-row text-lg">
              {groupRef(claim.upiRef)}
            </p>
          ) : null}
        </div>
        {claim.upiRef !== null && canCopy ? (
          <button
            type="button"
            onClick={() => void copy()}
            aria-label={copied ? undefined : t("copyFor", { name })}
            className="type-control-sm min-h-tap px-1 text-blue underline ring:ground-ring"
          >
            <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
          </button>
        ) : null}
      </div>

      <div aria-live="polite" aria-atomic="true" className="empty:hidden">
        {message ? (
          message.kind === "quiet" ? (
            <p className="sr-only">{message.text}</p>
          ) : message.kind === "offline" ? (
            <Banner kind="offline" title={message.text} detail={null} />
          ) : (
            <Banner kind="error" title={null} detail={message.text} />
          )
        ) : null}
      </div>

      {done ? null : asking ? (
        <div className="flex flex-col gap-3">
          <p role="alert" className="type-body font-bold wrap-anywhere">
            {t("notReceivedAsk", { name })}
          </p>
          <div className="flex flex-wrap gap-3 pr-1.5 pb-1.5">
            <Button variant="record" size="card" busy={busy === "reject"} busyLabel={t("confirming")} onClick={() => void reject()}>
              {t("notReceivedYes")}
            </Button>
            <Button variant="outline" size="card" onClick={() => setAsking(false)} disabled={busy !== null}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-stretch gap-3 pr-1.5 pb-1.5">
          {/* No min-w-0 on these two: each is at least as wide as its button's longest word (criterion 21). When
              both do not fit on one line, Confirm moves under Not received. */}
          <div className="flex grow basis-26">
            <Button variant="outline" size="card" full onClick={() => setAsking(true)} disabled={busy !== null}>
              {t("notReceived")}
            </Button>
          </div>
          <div className="flex grow-9999 basis-40">
            <Button
              variant="record"
              size="card"
              full
              busy={busy === "confirm"}
              busyLabel={t("confirming")}
              disabled={noConfirm || busy === "reject"}
              disabledReason={reason}
              onClick={() => void confirm()}
            >
              {t("confirm")}
            </Button>
          </div>
        </div>
      )}
    </Slip>
  );
}
