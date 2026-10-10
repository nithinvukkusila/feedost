// The hero's ledger card. It is an example, not real data, and says so. It sits flat: no rotation
// (docs/DESIGN.md: rotation is for stamps only). Amounts come only from formatRupees; no month.
import { useTranslations } from "next-intl";
import { Row, Rows } from "@/components/ui/row";
import { Slip } from "@/components/ui/slip";
import { Stamp } from "@/components/ui/stamp";
import { amountFit } from "@/lib/amount-fit";
import { formatRupees } from "@/lib/format";

const TOTAL_PAISE = 1850000;
const FEE_PAISE = 120000;

export function LedgerCard() {
  const t = useTranslations("landing");
  const total = formatRupees(TOTAL_PAISE);
  const fee = formatRupees(FEE_PAISE);
  return (
    <Slip role="group" aria-label={t("example.label")} className="relative p-4 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="type-caption font-bold text-ink-soft">{t("example.heading")}</p>
        <p className="type-label border-2 border-dashed border-ink-label px-2 py-0.5 text-ink-soft">{t("example.label")}</p>
      </div>
      <div className="amount-box mt-1">
        <p translate="no" style={amountFit(total)} className="type-amount amount-size-6xl text-blue">
          {total}
        </p>
      </div>
      <Rows className="mt-3 border-t-2 border-ink">
        <Row name={t("example.student1")} meta={t("example.late")} tone="overdue" amount={fee} wrap />
        <Row
          name={t("example.student2")}
          meta={t("example.paid")}
          tone="paid"
          amount={fee}
          wrap
          trailing={
            <Stamp size="sm" tone="stamp" decorative>
              {t("steps.stamp")}
            </Stamp>
          }
          className="border-b-0"
        />
      </Rows>
    </Slip>
  );
}
