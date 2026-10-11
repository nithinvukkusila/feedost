// The fee receipt maker (slice R0-3): a public page with no sign-in and no database. Everything
// here is a Server Component whose words cost no JavaScript: the header, the kicker, the one h1,
// the line for a browser with JavaScript off, the yellow block and the footer. Around one client
// island, ReceiptTool, whose plain words are handed to it as a prop (see src/i18n/words.ts).
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { LandingFooter } from "@/components/landing/landing-footer";
import { ReceiptTool } from "@/components/receipt/receipt-tool";
import { ToolHeader } from "@/components/tools/tool-header";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { isLocale } from "@/config/locales";
import { feeReceiptPath, localeHref } from "@/config/routes";
import { getWords } from "@/i18n/words";
import { alternateUrls, canonicalUrl, ogLocale } from "@/lib/seo";

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ locale: string }> }>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "receipt.meta" });
  const title = t("title");
  const description = t("description");
  const url = canonicalUrl(locale, feeReceiptPath);
  return {
    title,
    description,
    alternates: { canonical: url, languages: alternateUrls(feeReceiptPath) },
    openGraph: { type: "website", title, description, url, locale: ogLocale(locale) },
  };
}

export default async function FeeReceiptPage() {
  const [locale, t, words] = await Promise.all([getLocale(), getTranslations("receipt"), getWords("receiptForm")]);
  return (
    <div className="bg-page-ruled">
      <ToolHeader current="receipt" />
      <main className="mx-auto w-full max-w-2xl px-5 pt-6">
        <p className="type-label text-cloth">{t("kicker")}</p>
        <h1 className="type-headline mt-2 text-5xl wrap-break-word">{t("title")}</h1>

        {/* With JavaScript off the tool cannot build a message. Say so, with a mark as well as the words. */}
        <noscript>
          <p data-testid="receipt-noscript" className="type-body mt-5 border-2 border-dashed border-ink px-3 py-2 font-bold">
            {t("noscript")}
          </p>
        </noscript>

        <ReceiptTool words={words} pageLocale={locale} />

        {/* The yellow block from the canvas. It does not claim the app exists, and holds no form (R0-4). */}
        <section
          aria-labelledby="receipt-promo-title"
          data-testid="receipt-promo"
          className="mt-9 mr-1.5 flex flex-col gap-3 border-2 border-ink bg-highlight p-4 shadow-slip"
        >
          <h2 id="receipt-promo-title" className="type-headline text-2xl wrap-break-word">
            {t("promo.title")}
          </h2>
          <p className="type-body">{t("promo.body", { brand: brand.name })}</p>
          <div className="pr-1.5 pb-1.5">
            <Button variant="record" size="large" full href={`${localeHref(locale)}#waitlist`}>
              {t("promo.join")}
            </Button>
          </div>
        </section>
      </main>
      <LandingFooter path={feeReceiptPath} />
    </div>
  );
}
