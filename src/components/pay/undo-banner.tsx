"use client";

// The banner under the list after a payment (spec R1-7, criteria 14 and 15; canvas "State-undo"): "{name} marked
// paid, {amount}" with Undo and View receipt, for 10 seconds (the board's notice timer). Undo asks the
// database to void the payment, then the board takes the amount back and the banner says it was undone. A
// failed undo says nothing was changed. The live region stays mounted and the banner goes into it, so it
// is read out when it appears.
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, type MouseEvent } from "react";
import { useSoftLink } from "@/components/app/use-soft-link";
import { useBoard } from "@/components/board/board-state";
import { Banner } from "@/components/ui/banner";
import type { Locale } from "@/config/locales";
import { localeHref, receiptPath } from "@/config/routes";
import { formatRupees } from "@/lib/format";
import { PaymentError, voidPayment, type Payment } from "@/lib/payments";

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" aria-hidden="true" focusable={false}>
      <path d="M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1h-8l-5 4v-4H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  );
}

export function UndoBanner({ today }: Readonly<{ today: string }>) {
  const t = useTranslations("pay");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const board = useBoard();
  const { notice, applyVoid, refresh, showNotice, clearNotice } = board;
  const working = useRef(false);

  // The notice says when it ends; the banner takes it down then. (The board itself keeps no timer.) If the
  // tutor went to another screen and came back after that, it goes at once.
  useEffect(() => {
    if (notice === null) return;
    const left = notice.until - Date.now();
    if (left <= 0) {
      clearNotice();
      return;
    }
    const timer = setTimeout(clearNotice, left);
    return () => clearTimeout(timer);
  }, [notice, clearNotice]);

  // One payment, or the several a Confirm made (R1-10): voided newest first, one call each, stopping at the
  // first failure. If some were undone before it, the words say the rest are still recorded.
  async function undo(payments: readonly Payment[]) {
    if (working.current) return;
    working.current = true;
    let done = 0;
    try {
      for (const payment of [...payments].reverse()) {
        const voided = await voidPayment(payment.id);
        done += 1;
        applyVoid(voided);
      }
      refresh(today);
      showNotice({ kind: "undone" });
    } catch (error) {
      const code = error instanceof PaymentError ? error.code : "failed";
      if (done > 0) refresh(today);
      showNotice({
        kind: "undo-failed",
        reason: done > 0 ? "partial" : code === "offline" ? "offline" : code === "undo_window_over" || code === "already_voided" ? "late" : "failed",
      });
    } finally {
      working.current = false;
    }
  }

  let banner = null;
  if (notice?.kind === "paid") {
    const { payment, name } = notice;
    const made = notice.payments ?? [payment];
    const total = made.reduce((sum, p) => sum + p.amount, 0);
    const href = `${localeHref(locale, receiptPath)}?due=${encodeURIComponent(payment.dueId)}`;
    banner = (
      <Banner
        kind="undo"
        message={t("banner.paid", { name, amount: formatRupees(total) })}
        actions={[
          { label: t("banner.undo"), onClick: () => void undo(made) },
          { label: t("banner.send"), href, onClick: (event) => soft(href)(event as MouseEvent<HTMLAnchorElement>), icon: <ChatIcon /> },
        ]}
      />
    );
  } else if (notice?.kind === "undone") {
    banner = <Banner kind="undo" message={t("banner.undone")} actions={[]} />;
  } else if (notice?.kind === "undo-failed") {
    banner = <Banner kind="error" title={null} detail={t(notice.reason === "offline" ? "error.offline" : notice.reason === "late" ? "error.undoLate" : notice.reason === "partial" ? "error.undoPartial" : "error.undoFailed")} />;
  }
  return (
    <div aria-live="polite" aria-atomic="true" className="px-3 pb-3 empty:hidden">
      {banner}
    </div>
  );
}
