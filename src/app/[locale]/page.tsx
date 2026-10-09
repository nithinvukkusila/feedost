// The landing page (slice R0-1): seven static blocks, no database, no client code. Header and footer
// are siblings of <main>, one landmark each. The waitlist section keeps its id here; R0-4 swaps only
// src/components/landing/waitlist-slot.tsx.
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Hero } from "@/components/landing/hero";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { Promises } from "@/components/landing/promises";
import { Ribbon } from "@/components/landing/ribbon";
import { Steps } from "@/components/landing/steps";
import { Tools } from "@/components/landing/tools";
import { WaitlistSlot } from "@/components/landing/waitlist-slot";
import { brand } from "@/config/brand";
import { isLocale } from "@/config/locales";
import { alternateUrls, canonicalUrl, ogLocale } from "@/lib/seo";

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ locale: string }> }>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  const title = t("title", { brand: brand.name });
  const description = t("description");
  const url = canonicalUrl(locale);
  return {
    title,
    description,
    alternates: { canonical: url, languages: alternateUrls() },
    openGraph: { type: "website", title, description, url, locale: ogLocale(locale) },
  };
}

export default function LocaleHome() {
  const t = useTranslations("landing.waitlist");
  return (
    <div className="bg-page-ruled">
      <LandingHeader />
      <main>
        <Hero />
        <Ribbon />
        <Steps />
        <Tools />
        <Promises />
        <section
          id="waitlist"
          aria-labelledby="waitlist-title"
          className="on-cloth-ground mt-16 bg-cloth px-5 py-12 text-on-cloth outline-2 -outline-offset-8 outline-stitch outline-dashed"
        >
          <div className="mx-auto w-full max-w-2xl">
            <h2 id="waitlist-title" className="type-headline text-4xl wrap-break-word">
              {t("title")}
            </h2>
            <p className="type-body-lg mt-3 text-on-cloth-soft">{t("body")}</p>
            <WaitlistSlot />
          </div>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
