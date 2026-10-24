"use client";

// The parent's fee page after they have agreed (spec R1-9 criteria 22 to 31; canvas "PayPage"): the slip with "for
// {student}", the total as the headline, one line per open fee, then the Pay area, earlier receipts, the privacy
// notice link. Below the Pay area: "I've paid" or the pending note (R1-10 Part C), with the claim sheet loaded on tap.
// The total is what the Pay button asks for. Overdue is a word and a mark (StatusTag), never colour alone.
import { useRef, useState, type ReactNode } from "react";
import { Slip } from "@/components/ui/slip";
import { Stamp } from "@/components/ui/stamp";
import { StatusTag } from "@/components/ui/status-tag";
import type { Locale } from "@/config/locales";
import { amountFit } from "@/lib/amount-fit";
import { formatDate, formatRupees } from "@/lib/format";
import type { ClaimOutcome, FeePage } from "@/lib/pay-page-public";
import { feeLine, payArea, type FeeLine } from "@/lib/pay-page-view";
import type { PayPageWords } from "@/lib/pay-page-words";
import { monthLabel, type MonthWords } from "@/lib/receipt-words";
import { ClaimArea } from "./claim-area";
// A type only: the sheet's code is not in this file's bundle; it is imported on tap.
import type { ClaimSheetProps } from "./claim-sheet";
import { EarlierReceipts } from "./earlier-receipts";
import { Filled } from "./filled";
import { PayActions } from "./pay-actions";

function Line({ words, monthWords, line }: Readonly<{ words: PayPageWords; monthWords: MonthWords; line: FeeLine }>) {
  const date = formatDate(line.dueDate);
  const label = line.earlier ? (
    words.line.earlier
  ) : (
    <Filled template={words.line.fee} values={{ month: monthLabel(monthWords, line.month), date }} classes={{ date: "type-amount-row" }} />
  );
  // Late: the Overdue mark. Due today: the highlighted Due mark. Not late yet: a monthly fee's own words already say "due {date}";
  // an earlier balance has no date in its words, so it gets the Due mark with the date.
  let tag: React.ReactNode = null;
  if (line.late === "overdue") tag = <StatusTag status="overdue">{words.line.overdue}</StatusTag>;
  else if (line.late === "today") tag = <StatusTag status="due">{words.line.dueToday}</StatusTag>;
  else if (line.earlier) tag = <StatusTag status="due"><Filled template={words.line.due} values={{ date }} classes={{ date: "type-amount-row" }} /></StatusTag>;
  return (
    <li className="flex min-h-tap items-center justify-between gap-3 border-b border-rule py-2">
      <div className="flex min-w-0 flex-col items-start gap-1">
        <p className="type-body wrap-anywhere">{label}</p>
        {tag}
        {line.alreadyPaid > 0 ? (
          <p className="type-caption text-ink-soft wrap-anywhere">
            <Filled template={words.line.alreadyPaid} values={{ amount: formatRupees(line.alreadyPaid) }} classes={{ amount: "type-amount-row" }} />
          </p>
        ) : null}
      </div>
      <span translate="no" className="type-amount-row shrink-0">
        {formatRupees(line.remaining)}
      </span>
    </li>
  );
}

type Props = {
  words: PayPageWords;
  /** The language of `words.consent` (see PageWords): the notice link carries it. */
  consentLang: Locale;
  monthWords: MonthWords;
  page: FeePage;
  onOpenNotice: () => void;
  /**
   * Sends a claim (R1-10 Part C): the page reads the token and calls `submit-claim`. Never throws. On "ok" the page
   * re-reads itself to show the pending note, even if the sheet was closed meanwhile.
   */
  sendClaim: (ref: string) => Promise<ClaimOutcome>;
  /** Reads the page again, quietly, when a claim was refused because the page is out of date. */
  onReread: () => void;
};

type LoadedSheet = (props: ClaimSheetProps) => ReactNode;

export function FeeScreen({ words, consentLang, monthWords, page, onOpenNotice, sendClaim, onReread }: Readonly<Props>) {
  // The claim sheet's code is fetched only when "I've paid" is tapped (R1-10 criterion 42). It stays mounted here, not
  // under the button, so it can still say "Sent" after the page re-reads and the button gives way to the pending note.
  const [ClaimSheetView, setClaimSheetView] = useState<LoadedSheet | null>(null);
  const [claimOpen, setClaimOpen] = useState(false);
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [claimPage, setClaimPage] = useState<FeePage | null>(null);
  const loading = useRef(false);

  async function openClaim() {
    if (loading.current) return;
    setLoadProblem(null);
    if (ClaimSheetView !== null) {
      setClaimPage(page);
      setClaimOpen(true);
      return;
    }
    loading.current = true;
    try {
      const loaded = await import("./claim-sheet");
      setClaimSheetView(() => loaded.ClaimSheet);
      setClaimPage(page);
      setClaimOpen(true);
    } catch {
      // The code could not be fetched (most often no connection). Nothing was sent.
      setLoadProblem(typeof navigator !== "undefined" && navigator.onLine === false ? words.claim.offline : words.claim.failed);
    } finally {
      loading.current = false;
    }
  }

  const area = payArea(page);
  const paidUp = page.totalRemaining === 0;
  const figures = formatRupees(page.totalRemaining);
  return (
    <div className="-mt-12.5 mr-5.5 ml-4 flex flex-col gap-5.5">
      <Slip as="section" className="flex flex-col p-4.5">
        <p className="type-name wrap-anywhere">
          <Filled template={words.for} values={{ student: page.studentName }} />
        </p>
        {paidUp ? (
          <div className="mt-3 flex flex-col items-center gap-3 text-center">
            <Stamp size="lg" tone="stamp" label={words.allPaid}>
              {words.allPaid}
            </Stamp>
            <p role="status" className="type-body-lg font-bold wrap-anywhere">
              {words.allPaidNote}
            </p>
          </div>
        ) : (
          <>
            <p className="type-label mt-1 text-ink-label">{words.total}</p>
            {/* The headline shrinks to fit its box (never under 14px), so ₹10,00,000 is never cut. */}
            <div className="amount-box min-w-0">
              <p translate="no" style={amountFit(figures)} className="type-amount amount-size-7xl block text-blue">
                {figures}
              </p>
            </div>
            <ul className="mt-3 border-t-2 border-ink">
              {page.openDues.map((due, index) => (
                <Line key={index} words={words} monthWords={monthWords} line={feeLine(due, page.today)} />
              ))}
              {page.openDuesMore > 0 ? (
                <li className="type-body-sm flex min-h-tap items-center border-b border-rule py-2 text-ink-soft">
                  <Filled template={words.line.more} values={{ n: String(page.openDuesMore) }} classes={{ n: "type-amount-row" }} />
                </li>
              ) : null}
            </ul>
            <PayActions words={words} area={area} total={page.totalRemaining} />
            <ClaimArea words={words} page={page} onOpen={() => void openClaim()} problem={loadProblem} />
          </>
        )}
      </Slip>

      {claimOpen && ClaimSheetView !== null ? (
        <ClaimSheetView
          words={words}
          monthWords={monthWords}
          // The page as it was when the sheet opened: its header keeps the amount she claimed after the page re-reads.
          page={claimPage ?? page}
          send={sendClaim}
          onStale={() => {
            setClaimOpen(false);
            onReread();
          }}
          onClose={() => setClaimOpen(false)}
        />
      ) : null}

      <EarlierReceipts words={words} monthWords={monthWords} receipts={page.receipts} more={page.receiptsMore} />

      <button type="button" lang={consentLang} onClick={onOpenNotice} className="type-control-sm flex min-h-tap items-center self-start underline ring:ground-ring">
        {words.consent.notice}
      </button>
    </div>
  );
}
