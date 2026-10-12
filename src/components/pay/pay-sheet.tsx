"use client";

// The Mark paid sheet (spec R1-7, criteria 12 to 17, 21 and 22; canvas "Pay-sheet"). Loaded on the first tap of
// Mark paid and not before (next/dynamic in the board screen). The student and month in the header, the
// amount received (what is left, to change), the chips, Paid by (UPI or Cash), Paid on (Today, Yesterday or
// a day picked), "Mark as paid" and "Cancel".
//
// The result is shown only after the database has answered: there is no optimistic "paid". One request id
// is made when the sheet opens and sent again on every retry, so a double tap or a lost answer cannot
// record twice. Offline, nothing is sent and what was typed stays. Every failure keeps the typed values.
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { TextField } from "@/components/app/text-field";
import { useMonthWords } from "@/components/board/month-switcher";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { cx } from "@/lib/cx";
import { remaining, type Row } from "@/lib/dues-board";
import { formatDate, formatRupees } from "@/lib/format";
import { PaymentError, recordPayment, type Payment, type PaymentErrorCode, type PaymentMethod } from "@/lib/payments";
import { checkDay, chipAmounts, chipOf, chosenDay, dayBounds, validateAmount, type DateChoice } from "@/lib/payments-view";
import { groupRupees, tidyRupees } from "@/lib/rupees";
import { newId } from "@/lib/uuid";

/** After this long a save that has not answered says it is still trying. */
const SLOW_MS = 20_000;

const chip =
  "inline-flex min-h-tap items-center justify-center gap-1.5 rounded-sm border-2 border-ink px-3 py-2 type-control-sm text-center wrap-anywhere ring:ground-ring";

function Tick() {
  return (
    <svg aria-hidden="true" focusable={false} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

// A chip is a toggle: pressed is a black fill plus a tick (never colour alone) and aria-pressed.
function Chip({ pressed, onClick, children }: Readonly<{ pressed: boolean; onClick: () => void; children: string }>) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={cx(chip, pressed ? "on-dark-ground bg-ink text-slip" : "bg-transparent text-ink")}>
      {pressed ? <Tick /> : null}
      <span translate="no" className="min-w-0 max-w-full">
        {children}
      </span>
    </button>
  );
}

type Problem = { code: PaymentErrorCode } | null;

export type PaySheetProps = {
  /** The fee being paid, as the board holds it now: if another phone changes it, this changes too. */
  row: Row;
  batchName: string | null;
  /** Today in India, `YYYY-MM-DD`. */
  today: string;
  onClose: () => void;
  /** The database recorded the payment. */
  onPaid: (payment: Payment) => void;
  /** What the board shows is out of date (another phone paid, or the fee changed): read it again. */
  onStale: () => void;
};

export default function PaySheet({ row, batchName, today, onClose, onPaid, onStale }: Readonly<PaySheetProps>) {
  const t = useTranslations("pay");
  const board = useTranslations("board");
  const months = useMonthWords();
  const { due, student } = row;
  const left = remaining(due);
  const { full, half } = chipAmounts(left);

  const [text, setText] = useState(() => groupRupees(left));
  const [touched, setTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [choice, setChoice] = useState<DateChoice>("today");
  const [picked, setPicked] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slow, setSlow] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  // What the database said was left, when this phone's number was out of date. Cleared when the amount changes.
  const [serverLeft, setServerLeft] = useState<number | null>(null);
  // Sent again on a retry (criterion 16). A retry of an attempt that may have reached the database keeps it, so a
  // changed amount, method or day then gets the "request_reused" words. When the database refused the attempt
  // outright, nothing was recorded, so the next attempt gets a new one and the changed details just go through.
  const requestId = useRef(newId());
  const sending = useRef(false);
  const amountRef = useRef<HTMLTextAreaElement>(null);
  const pickId = useId();

  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      clearTimeout(timer);
      setSlow(false);
    };
  }, [saving]);

  const amount = validateAmount(text, left);
  const day = checkDay(chosenDay(choice, picked, today), today);
  const showAmount = touched || submitted || serverLeft !== null;
  const shown = chipOf(text, left);

  let amountError: { tag: string; message: string } | undefined;
  if (serverLeft !== null) amountError = { tag: t("fix"), message: t("error.over", { amount: formatRupees(serverLeft) }) };
  else if (showAmount && !amount.ok) {
    const message =
      amount.error === "over"
        ? t("error.over", { amount: formatRupees(left) })
        : amount.error === "decimal" || amount.error === "chars"
          ? t("error.amountWhole")
          : t("error.amountMissing");
    amountError = { tag: t("fix"), message };
  }
  const dayError = submitted && !day.ok ? (day.error === "future" ? t("error.dateFuture") : day.error === "old" ? t("error.dateOld") : t("error.dateMissing")) : null;

  function setAmount(next: string) {
    setText(next);
    setServerLeft(null);
    setProblem(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current) return;
    setSubmitted(true);
    if (!amount.ok) {
      amountRef.current?.focus();
      return;
    }
    if (!day.ok) return;
    setProblem(null);
    setServerLeft(null);
    sending.current = true;
    setSaving(true);
    try {
      const payment = await recordPayment({ dueId: due.id, amount: amount.paise, method, paidOn: day.day, requestId: requestId.current });
      onPaid(payment);
      onClose();
    } catch (error) {
      const code = error instanceof PaymentError ? error.code : "failed";
      if (code !== "offline" && code !== "failed" && code !== "request_reused") requestId.current = newId();
      if (code === "amount_over_remaining" && error instanceof PaymentError && error.remaining !== null) {
        setServerLeft(error.remaining);
        onStale();
      } else {
        if (code === "already_paid" || code === "student_archived" || code === "due_not_found" || code === "request_reused" || code === "amount_over_remaining") onStale();
        setProblem({ code });
      }
    } finally {
      sending.current = false;
      setSaving(false);
    }
  }

  const words: Partial<Record<PaymentErrorCode, string>> = {
    offline: t("error.offline"),
    date_out_of_range: t("error.dateRefused"),
    already_paid: t("error.alreadyPaid"),
    student_archived: t("error.archived"),
    request_reused: t("error.reused"),
    not_signed_in: t("error.signedOut"),
  };

  const kind = due.kind === "opening" ? board("row.earlier") : months.name(due.month ?? "");
  const bounds = dayBounds(today);

  return (
    <Sheet
      open
      onClose={onClose}
      title={t("markPaid")}
      closeLabel={t("cancel")}
      context={{
        label: (
          <>
            {kind}
            {batchName ? (
              <>
                <span aria-hidden="true"> · </span>
                <span translate="no">{batchName}</span>
              </>
            ) : null}
          </>
        ),
        title: <span translate="no">{student.name}</span>,
      }}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <TextField
            ref={amountRef}
            label={t("amount")}
            value={text}
            inputMode="numeric"
            autoComplete="off"
            latinValue
            onChange={(e) => setAmount(e.currentTarget.value)}
            onBlur={() => {
              setTouched(true);
              setText((now) => tidyRupees(now, { min: 1, max: Math.floor(left / 100) }));
            }}
            error={amountError}
          />
          <div role="group" aria-label={t("chipsLabel")} className="flex flex-wrap gap-2">
            <Chip pressed={shown === "full"} onClick={() => setAmount(groupRupees(full))}>
              {t("full", { amount: formatRupees(full) })}
            </Chip>
            {half !== null ? (
              <Chip pressed={shown === "half"} onClick={() => setAmount(groupRupees(half))}>
                {t("half", { amount: formatRupees(half) })}
              </Chip>
            ) : null}
            <Chip
              pressed={shown === "other"}
              onClick={() => {
                setAmount("");
                amountRef.current?.focus();
              }}
            >
              {t("other")}
            </Chip>
          </div>
        </div>

        <Segmented
          label={t("method")}
          name="pay-method"
          value={method}
          onChange={setMethod}
          options={[
            { value: "upi", label: <span translate="no">{t("upi")}</span> },
            { value: "cash", label: t("cash") },
          ]}
        />

        <div className="flex flex-col gap-2">
          <Segmented
            label={t("paidOn")}
            name="pay-date"
            value={choice}
            onChange={(next) => {
              setChoice(next);
              if (next === "pick" && picked === "") setPicked(today);
            }}
            options={[
              { value: "today", label: t("today") },
              { value: "yesterday", label: t("yesterday") },
              { value: "pick", label: t("pick") },
            ]}
          />
          {choice === "pick" ? (
            <div className="flex flex-col">
              <label htmlFor={pickId} className="type-label text-ink-label wrap-anywhere">
                {t("pickLabel")}
              </label>
              <input
                id={pickId}
                type="date"
                min={bounds.min}
                max={bounds.max}
                value={picked}
                onChange={(e) => setPicked(e.currentTarget.value)}
                aria-invalid={dayError ? "true" : undefined}
                className="type-value-latin min-h-control border-b-2 border-ink bg-transparent text-blue ring:ground-ring"
              />
              {day.ok ? (
                <p translate="no" className="type-caption mt-1 text-ink-soft">
                  {formatDate(day.day)}
                </p>
              ) : null}
            </div>
          ) : null}
          {dayError ? (
            <p role="alert" className="type-caption font-semibold text-cloth wrap-anywhere">
              {dayError}
            </p>
          ) : null}
        </div>

        <div aria-live="polite" aria-atomic="true" className="flex flex-col gap-3 empty:hidden">
          {problem?.code === "offline" ? <Banner kind="offline" title={words.offline} detail={null} /> : null}
          {problem !== null && problem.code !== "offline" ? <Banner kind="error" title={null} detail={words[problem.code] ?? t("error.failed")} /> : null}
          {slow ? (
            <p role="status" className="type-caption text-ink-soft wrap-anywhere">
              {t("slow")}
            </p>
          ) : null}
        </div>

        <div className="pr-1.5 pb-1.5">
          <Button type="submit" variant="record" size="large" full busy={saving} busyLabel={t("saving")}>
            {t("submit")}
          </Button>
        </div>
        <p className="type-body-sm text-ink-soft wrap-anywhere">{t("note")}</p>
      </form>
    </Sheet>
  );
}
