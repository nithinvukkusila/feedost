"use client";

// The last claims the tutor handled (spec R1-10, criterion 25; canvas "Claims"): the student's name, a line
// that says CONFIRMED with the date and the receipt number, or NOT RECEIVED with the date, and the amount.
// Status is a word and a mark (a tick, a cross), never colour alone. A confirmed claim whose payment was
// undone later still says confirmed: the claim is never reopened. Rows are 56px or more and grow.
import { useTranslations } from "next-intl";
import { receiptsOf } from "@/lib/claim-view";
import type { Claim } from "@/lib/claims";
import { indiaToday } from "@/lib/dues-board";
import { formatDate, formatRupees } from "@/lib/format";

function Mark({ confirmed }: Readonly<{ confirmed: boolean }>) {
  return (
    <svg aria-hidden="true" focusable={false} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
      {confirmed ? <path d="M4 12.5l5 5L20 6.5" /> : <path d="M6 6l12 12M18 6L6 18" />}
    </svg>
  );
}

export type EarlierItem = { claim: Claim; name: string };

export function EarlierList({ items }: Readonly<{ items: readonly EarlierItem[] }>) {
  const t = useTranslations("claims");
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="claims-earlier" className="on-paper-ground mx-4 mt-6 border-2 border-b-0 border-ink bg-slip px-3 pt-2.5 text-ink">
      <h2 id="claims-earlier" className="type-label text-ink-soft">
        {t("earlier")}
      </h2>
      <ul>
        {items.map(({ claim, name }) => {
          const receipts = receiptsOf(claim);
          const date = formatDate(indiaToday(claim.handledAt ?? claim.createdAt));
          return (
            <li key={claim.id} className="flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-rule py-2">
              <span className="min-w-0 flex-1 basis-40">
                <span translate="no" className="type-name block wrap-anywhere">
                  {name}
                </span>
                <span className={`type-label flex items-start gap-1.5 ${receipts ? "text-stamp" : "text-ink-soft"}`}>
                  <span className="mt-1">
                    <Mark confirmed={receipts !== null} />
                  </span>
                  <span className="min-w-0 wrap-anywhere">
                    {receipts
                      ? receipts.more > 0
                        ? t("confirmedMore", { date, n: String(receipts.first), k: String(receipts.more) })
                        : t("confirmedOn", { date, n: String(receipts.first) })
                      : t("notReceivedOn", { date })}
                  </span>
                </span>
              </span>
              <span translate="no" className="type-amount-row">
                {formatRupees(claim.amount)}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
