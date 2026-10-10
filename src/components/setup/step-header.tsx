// The strip at the top of a setup step: "Step 1 of 3" on the right and, from step 2, a Back arrow on the left.
// Step 3 is the empty home's "Add students" (R1-3), so the total stays 3 (spec R1-1, decision 1).
import { useTranslations } from "next-intl";

export const SETUP_STEPS = 3;

export function StepHeader({ step, backHref }: Readonly<{ step: number; backHref?: string }>) {
  const t = useTranslations("setup");
  return (
    <div className="-ml-3 flex min-h-tap items-center justify-between gap-3">
      {backHref ? (
        <a href={backHref} aria-label={t("back")} className="flex size-tap shrink-0 items-center justify-center text-ink ring:ground-ring">
          <svg aria-hidden="true" focusable={false} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </a>
      ) : (
        <span />
      )}
      <p className="type-label pl-3 text-right font-medium">{t("stepOf", { n: step, total: SETUP_STEPS })}</p>
    </div>
  );
}
