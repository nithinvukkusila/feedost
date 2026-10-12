"use client";

// One receipt on the tutor's phone (spec R1-7, criteria 18 and 19; canvas "Receipt"): the tutor, the receipt
// number, the date, who and what for, the amount as "₹1,200/-", the balance after this payment, the stamp
// (PAID, PART PAID or CANCELLED, a word and a mark) and when it was recorded, in India time. A cancelled
// receipt keeps its number, strikes the amount through and shows no balance. The amount is figures only
// (no amount in words, default 11), 0 to 9 digits whatever the language.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Slip } from "@/components/ui/slip";
import { Stamp } from "@/components/ui/stamp";
import { cx } from "@/lib/cx";
import { indiaToday } from "@/lib/dues-board";
import { formatDate, formatRupees } from "@/lib/format";
import type { Payment } from "@/lib/payments";
import { indiaClock } from "@/lib/payments-view";

export type ReceiptCardProps = {
  payment: Payment;
  tutorName: string | null;
  studentName: string;
  parentName: string | null;
  /** "October 2026", or "Earlier balance". */
  feeLabel: string;
  /** What the tutor can still do with it: the undo control, when it is allowed. */
  children?: ReactNode;
};

export function ReceiptCard({ payment, tutorName, studentName, parentName, feeLabel, children }: Readonly<ReceiptCardProps>) {
  const t = useTranslations("pay.receipt");
  const pay = useTranslations("pay");
  const cancelled = payment.voidedAt !== null;
  const word = cancelled ? t("cancelled") : payment.balanceAfter === 0 ? t("paid") : t("partPaid");
  const date = formatDate(payment.paidOn);
  const recorded = formatDate(indiaToday(payment.createdAt));
  const rows: [string, ReactNode][] = [
    [t("student"), <span key="s" translate="no">{studentName}</span>],
    ...(parentName ? ([[t("parent"), <span key="p" translate="no">{parentName}</span>]] as [string, ReactNode][]) : []),
    [t("forMonth"), feeLabel],
    [t("paidBy"), payment.method === "upi" ? <span key="m" translate="no">{pay("upi")}</span> : pay("cash")],
  ];
  return (
    <Slip as="article" className="relative flex flex-col gap-3 p-4.5">
      <div className="flex items-start justify-between gap-3">
        <p translate="no" className="type-headline min-w-0 text-2xl wrap-anywhere">
          {tutorName}
        </p>
        <div className="shrink-0 text-right">
          <p className="type-label text-ink-label">{t("no")}</p>
          <p translate="no" className="type-amount-row text-2xl text-cloth">
            {payment.receiptNo}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t-2 border-b border-ink py-1.5">
        <p className="type-label">{t("feeReceipt")}</p>
        <p className="type-label">
          <span translate="no">{t("date", { date })}</span>
        </p>
      </div>

      <dl className="flex flex-col gap-1.5">
        {rows.map(([name, value]) => (
          <div key={name} className="flex flex-wrap items-baseline gap-x-3">
            <dt className="type-label min-w-24 text-ink-label">{name}</dt>
            <dd className="type-body min-w-0 font-bold wrap-anywhere">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <p translate="no" className={cx("type-amount inline-block max-w-full border-2 border-ink px-3.5 pt-1.5 pb-1 text-4xl text-blue", cancelled && "line-through")}>
          {formatRupees(payment.amount)}
          <span className="text-2xl">/-</span>
        </p>
        {cancelled ? null : (
          <div className="text-right">
            <p className="type-label text-ink-label">{t("balance")}</p>
            <p className="type-body-lg font-extrabold">{payment.balanceAfter === 0 ? t("nil") : <span translate="no">{formatRupees(payment.balanceAfter)}</span>}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="type-caption min-w-0 text-ink-soft wrap-anywhere">
          <span translate="no">{t("recorded", { date: recorded, time: indiaClock(payment.createdAt) })}</span>
        </p>
        <Stamp size="md" tone={cancelled || payment.balanceAfter > 0 ? "blue" : "stamp"} label={word}>
          {word}
        </Stamp>
      </div>
      {children}
    </Slip>
  );
}
