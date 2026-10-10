// Section 3: "Asking for money is awkward. So don't ask. Tap." and three numbered steps.
// The digits are the headline face with 0-9 digits in every language; the third step is a stamp.
import { useTranslations } from "next-intl";
import { Stamp } from "@/components/ui/stamp";

const stepClass = "flex flex-wrap items-start gap-x-4 gap-y-2 border-t-3 border-ink pt-3";
const numberClass = "type-amount w-20 shrink-0 text-8xl";
const textClass = "min-w-0 flex-1 basis-48";

export function Steps() {
  const t = useTranslations("landing.steps");
  return (
    <section aria-labelledby="steps-title" className="mx-auto w-full max-w-2xl px-5 pt-14">
      <h2 id="steps-title" className="type-headline text-4xl wrap-break-word">
        {t("title")} <span className="text-cloth">{t("accent")}</span>
      </h2>
      <ol className="mt-8 flex flex-col gap-7">
        <li className={stepClass}>
          <span aria-hidden="true" translate="no" className={`${numberClass} text-blue`}>
            1
          </span>
          <div className={textClass}>
            <h3 className="type-headline text-2xl wrap-break-word">{t("s1.title")}</h3>
            <p className="type-body mt-2 text-ink-soft">{t("s1.body")}</p>
          </div>
        </li>
        <li className={stepClass}>
          <span aria-hidden="true" translate="no" className={`${numberClass} text-cloth`}>
            2
          </span>
          <div className={textClass}>
            <h3 className="type-headline text-2xl wrap-break-word">{t("s2.title")}</h3>
            <p className="type-body mt-2 text-ink-soft">{t("s2.body")}</p>
          </div>
        </li>
        <li className={stepClass}>
          <span className="flex w-20 shrink-0 justify-center pt-1">
            <Stamp size="sm" tone="stamp" label={t("stamp")}>
              {t("stamp")}
            </Stamp>
          </span>
          <div className={textClass}>
            <h3 className="type-headline text-2xl wrap-break-word">{t("s3.title")}</h3>
            <p className="type-body mt-2 text-ink-soft">{t("s3.body")}</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
