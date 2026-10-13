// The parent's earlier receipts (spec R1-9 criterion 27): the newest payments that were not cancelled, each opening the
// receipt page `/r/{receipt token}` in the same tab. The link is built from the token the function returned for that
// receipt, never from this page's own token. Not drawn when there are none.
import { Slip } from "@/components/ui/slip";
import { formatDate, formatRupees } from "@/lib/format";
import type { PayReceipt } from "@/lib/pay-page-public";
import type { PayPageWords } from "@/lib/pay-page-words";
import { fill } from "@/lib/public-words";
import { monthLabel, type MonthWords } from "@/lib/receipt-words";
import { cx } from "@/lib/cx";
import { Filled } from "./filled";

export function EarlierReceipts({ words, monthWords, receipts, more }: Readonly<{ words: PayPageWords; monthWords: MonthWords; receipts: readonly PayReceipt[]; more: boolean }>) {
  if (receipts.length === 0) return null;
  return (
    <Slip as="section" aria-labelledby="receipts-title" className="px-3 pt-2.5">
      <h2 id="receipts-title" className="type-label text-ink-label">
        {words.receipts}
      </h2>
      <ul>
        {receipts.map((receipt) => {
          const part = receipt.balanceAfter > 0;
          const template = part ? words.receipt.part : words.receipt.paid;
          const values = { date: formatDate(receipt.paidOn).toUpperCase(), n: String(receipt.receiptNo) };
          const caption = fill(template, values);
          const month = receipt.month === null ? words.line.earlier : monthLabel(monthWords, receipt.month);
          return (
            <li key={receipt.receiptToken} className="flex min-h-15 items-center justify-between gap-3 border-t border-rule py-1.5">
              <div className="min-w-0">
                <p className="type-body-lg font-bold wrap-anywhere">
                  <span>{month}</span> · <span translate="no" className="type-amount-row">{formatRupees(receipt.amount)}</span>
                </p>
                {/* The words are the page's language; the date and number are 0-9 in the mono face, in every language. */}
                <p className={cx("type-label wrap-anywhere", part ? "text-blue" : "text-stamp")}>
                  <Filled template={template} values={values} classes={{ date: "type-amount-row", n: "type-amount-row" }} />
                </p>
              </div>
              <a
                href={`/r/${receipt.receiptToken}`}
                rel="noopener noreferrer"
                aria-label={`${words.receipt.view}: ${month}, ${caption}`}
                className="type-control-sm inline-flex min-h-tap shrink-0 items-center px-1 text-blue underline ring:ground-ring"
              >
                {words.receipt.view}
              </a>
            </li>
          );
        })}
      </ul>
      {more ? <p className="type-caption border-t border-rule py-2 text-ink-soft">{words.receipt.more}</p> : null}
    </Slip>
  );
}
