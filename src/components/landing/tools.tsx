// Section 4: the two free tools. Each card holds one link to its tool: card 1 the receipt maker
// (R0-3), card 2 the fee reminder writer (R0-2).
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Slip } from "@/components/ui/slip";
import { feeReceiptPath, feeReminderPath, localeHref } from "@/config/routes";

export function Tools() {
  const t = useTranslations("landing.tools");
  const locale = useLocale();
  return (
    <section id="tools" aria-labelledby="tools-title" className="mx-auto w-full max-w-2xl px-5 pt-16">
      <h2 id="tools-title" className="type-headline text-4xl wrap-break-word">
        {t("title")}
      </h2>
      <ul className="mt-6 flex flex-col gap-6 pr-1.5">
        <li>
          <Slip as="article" className="flex flex-col gap-2 p-4">
            <p className="type-label text-cloth">{t("t1.no")}</p>
            <h3 className="type-headline text-3xl wrap-break-word">{t("t1.title")}</h3>
            <p className="type-body text-ink-soft">{t("t1.body")}</p>
            <div className="mt-2 pr-1.5 pb-1.5">
              <Button variant="outline" full href={localeHref(locale, feeReceiptPath)}>
                {t("t1.open")}
              </Button>
            </div>
          </Slip>
        </li>
        <li>
          <Slip as="article" className="flex flex-col gap-2 p-4">
            <p className="type-label text-cloth">{t("t2.no")}</p>
            <h3 className="type-headline text-3xl wrap-break-word">{t("t2.title")}</h3>
            <p className="type-body text-ink-soft">{t("t2.body")}</p>
            {/* Outline, not blue: opening a page neither sends nor pays. Room on the right and below for its shadow. */}
            <div className="mt-2 pr-1.5 pb-1.5">
              <Button variant="outline" full href={localeHref(locale, feeReminderPath)}>
                {t("t2.open")}
              </Button>
            </div>
          </Slip>
        </li>
      </ul>
    </section>
  );
}
