// Section 1 of the landing: kicker, the page's one h1, a paragraph, the main button, a text link to
// the free reminder writer, and the ledger card.
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { feeReminderPath, localeHref } from "@/config/routes";
import { LedgerCard } from "./ledger-card";

function Arrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function Hero() {
  const t = useTranslations("landing.hero");
  const locale = useLocale();
  return (
    // From 1024 the ledger card stands in the cloth's right half instead of under it: the section is the
    // positioning frame, the card's row is laid over the cloth and lets clicks through to the text.
    <section className="lg:relative">
      <div className="on-cloth-ground bg-cloth px-5 pt-8 pb-28 text-on-cloth outline-2 -outline-offset-8 outline-stitch outline-dashed lg:py-20">
        <div className="mx-auto w-full max-w-2xl lg:max-w-7xl lg:pr-[50%]">
          <p className="type-label">{t("kicker")}</p>
          <h1 className="type-headline mt-3 text-5xl wrap-break-word">{t("title")}</h1>
          <p className="type-body-lg mt-4 text-on-cloth-soft">{t("body")}</p>
          <div className="mt-6 pr-1.5">
            <Button variant="outline" size="large" full href="#waitlist" iconEnd={<Arrow />}>
              {t("join")}
            </Button>
          </div>
          <a
            href={localeHref(locale, feeReminderPath)}
            className="type-body mt-3 flex min-h-tap items-center justify-center text-center font-bold text-on-cloth underline ring:ground-ring"
          >
            {t("tool")}
          </a>
        </div>
      </div>
      <div className="relative mx-auto -mt-24 w-full max-w-2xl pr-7 pl-5 lg:pointer-events-none lg:absolute lg:inset-0 lg:mt-0 lg:flex lg:max-w-7xl lg:items-center lg:justify-end lg:px-5">
        <div className="lg:pointer-events-auto lg:w-1/2 lg:pl-10">
          <LedgerCard />
        </div>
      </div>
    </section>
  );
}
