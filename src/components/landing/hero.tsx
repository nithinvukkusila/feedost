// Section 1 of the landing: kicker, the page's one h1, a paragraph, the main button and the ledger card.
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
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
  return (
    <section>
      <div className="on-cloth-ground bg-cloth px-5 pt-8 pb-28 text-on-cloth outline-2 -outline-offset-8 outline-stitch outline-dashed">
        <div className="mx-auto w-full max-w-2xl">
          <p className="type-label">{t("kicker")}</p>
          <h1 className="type-headline mt-3 text-5xl wrap-break-word">{t("title")}</h1>
          <p className="type-body-lg mt-4 text-on-cloth-soft">{t("body")}</p>
          <div className="mt-6 pr-1.5">
            <Button variant="outline" size="large" full href="#waitlist" iconEnd={<Arrow />}>
              {t("join")}
            </Button>
          </div>
        </div>
      </div>
      <div className="relative mx-auto -mt-24 w-full max-w-2xl pr-7 pl-5">
        <LedgerCard />
      </div>
    </section>
  );
}
