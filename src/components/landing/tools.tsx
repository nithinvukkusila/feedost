// Section 4: the two free tools. Card 2, the fee reminder writer, is live: it holds one link to the
// tool. Card 1, the receipt maker, does not exist yet, so it says "Coming soon" and is not a link;
// R0-3 turns it into a link to the receipt maker.
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Slip } from "@/components/ui/slip";
import { feeReminderPath, localeHref } from "@/config/routes";

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
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <p className="type-label text-cloth">{t("t1.no")}</p>
              {/* A word with a dashed outline: the mark is the outline, not the colour. */}
              <p className="type-label border-2 border-dashed border-ink-label px-2 py-1 text-ink-soft">{t("tag")}</p>
            </div>
            <h3 className="type-headline text-3xl wrap-break-word">{t("t1.title")}</h3>
            <p className="type-body text-ink-soft">{t("t1.body")}</p>
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
