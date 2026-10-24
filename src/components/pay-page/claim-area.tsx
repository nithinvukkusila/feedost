"use client";

// Below the Pay area (spec R1-10 Part C, criteria 30, 37 and 38): "Paid already? Tell {tutor}." and the 48px outline
// "I've paid" button; or, while a claim waits, the note saying what the parent told the tutor. Neither is drawn
// before consent or when nothing is owed (`claimButtonVisible`). The sheet itself is not here: it is loaded on tap.
import { Button } from "@/components/ui/button";
import { formatDate, formatRupees } from "@/lib/format";
import type { FeePage } from "@/lib/pay-page-public";
import { claimButtonVisible } from "@/lib/pay-page-view";
import type { PayPageWords } from "@/lib/pay-page-words";
import { Filled } from "./filled";

const MONO = "type-amount-row";

type Props = {
  words: PayPageWords;
  page: FeePage;
  onOpen: () => void;
  /** A line under the button when the sheet could not be opened (its code did not load). */
  problem?: string | null;
};

export function ClaimArea({ words, page, onOpen, problem = null }: Readonly<Props>) {
  const w = words.claim;
  const tutor = page.tutorName ?? w.yourTutor;
  const pending = page.consentNeeded ? null : page.pendingClaim;
  if (pending !== null && page.totalRemaining > 0) {
    return (
      <p data-claim="pending" className="type-body mt-4 border-t border-rule pt-3 wrap-anywhere">
        <Filled
          template={w.pending}
          values={{ tutor, date: formatDate(pending.submittedOn), amount: formatRupees(pending.amount) }}
          classes={{ date: MONO, amount: MONO }}
        />
      </p>
    );
  }
  if (!claimButtonVisible(page)) return null;
  return (
    <div data-claim="ask" className="mt-4 flex flex-col gap-2.5">
      <p className="type-body-sm text-ink-soft wrap-anywhere">
        <Filled template={words.paidAlready} values={{ tutor }} />
      </p>
      <div className="pr-1.5">
        <Button variant="outline" full onClick={onOpen}>
          {w.button}
        </Button>
      </div>
      {problem ? (
        <p role="status" className="type-caption font-semibold text-cloth wrap-anywhere">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
