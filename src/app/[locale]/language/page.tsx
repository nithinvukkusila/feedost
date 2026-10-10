// The language picker (spec R1-1, criteria 1 to 5): the first screen of the app. A Server Component for
// everything except the four rows, which are links that also save the choice on a tap. It is
// prerendered once per language, kept out of search results, and its words cost no JavaScript.
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { LanguageList } from "@/components/language/language-list";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { isLocale, locales, type Locale } from "@/config/locales";
import { localeHref, signInPath } from "@/config/routes";

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ locale: string }> }>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "language" });
  return { title: t("title"), robots: { index: false } };
}

function Arrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

// The three lines under the title are the same in every language: each line is in its own language.
const SUBTITLE_LANGUAGES = ["hi", "kn", "te"] as const;

export default async function LanguagePage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("language")]);
  if (!isLocale(locale)) notFound();
  const lines = t("subtitle").split(" · ");
  const names = Object.fromEntries(locales.map((code) => [code, t(`name.${code}`)])) as Record<Locale, string>;
  return (
    <div className="on-cloth-ground min-h-dvh bg-cloth text-on-cloth outline-2 -outline-offset-8 outline-stitch outline-dashed">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-7 pt-10 pb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="type-headline text-3xl">{brand.name}</p>
          <p className="type-label">{t("register")}</p>
        </div>

        <main className="mt-7 flex flex-1 flex-col">
          <h1 className="type-headline text-5xl wrap-break-word">{t("title")}</h1>
          <p className="type-body-lg mt-3 font-bold text-on-cloth-soft">
            {lines.map((line, index) => (
              <span key={SUBTITLE_LANGUAGES[index]} lang={SUBTITLE_LANGUAGES[index]} className="block">
                {line}
              </span>
            ))}
          </p>

          <div className="mt-6">
            <LanguageList current={locale} words={{ chosen: t("chosen"), names }} />
          </div>

          <div className="mt-auto pt-8 pr-1.5 pb-1.5">
            <Button variant="record" size="xl" full href={localeHref(locale, signInPath)} iconEnd={<Arrow />}>
              {t("continue")}
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
