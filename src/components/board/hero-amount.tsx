"use client";

// The amount block (spec R1-6, criterion 13; canvas "Home"): "Still to come in", what is still owed in the
// headline face, and how many students owe it. The "collected" line shows only when something was
// collected this month. The headline amount shrinks to fit its box and is never cut or scrolled.
import { useTranslations } from "next-intl";
import { withNode } from "@/components/app/with-node";
import type { BoardView } from "@/lib/dues-board";
import { amountFit } from "@/lib/amount-fit";
import { formatRupees } from "@/lib/format";

export function HeroAmount({ view }: Readonly<{ view: BoardView }>) {
  const t = useTranslations("board");
  const total = formatRupees(view.pending);
  return (
    <section className="px-5 pt-2.5 pr-5.5">
      <h1 className="type-body-lg font-bold text-cloth">{t("hero.label")}</h1>
      <div className="amount-box">
        <p translate="no" style={amountFit(total)} className="type-amount amount-size-7xl block text-blue">
          {total}
        </p>
      </div>
      <p className="type-body mt-0.5 text-ink-soft wrap-anywhere">{t("hero.from", { n: view.students, m: view.studentsInView })}</p>
      {view.collected > 0 ? (
        <p className="type-caption mt-1 text-ink-soft wrap-anywhere">
          {withNode(
            (amount) => t("hero.collected", { amount }),
            <span translate="no" className="type-amount-row">
              {formatRupees(view.collected)}
            </span>,
          )}
        </p>
      ) : null}
    </section>
  );
}
