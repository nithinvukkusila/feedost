// The sign-in screen (spec R1-1, criteria 6 and 7). A Server Component draws everything that is plain
// words: the brand, the language link, the headline and the three taps. One client island, the Google
// button, sits at the foot. There is no email field: the magic link waits for a domain of our own.
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { SignInScreen } from "@/components/auth/sign-in-screen";
import { Stamp } from "@/components/ui/stamp";
import { brand } from "@/config/brand";
import { isLocale, localeNames } from "@/config/locales";
import { languagePath, localeHref } from "@/config/routes";

export const metadata: Metadata = { robots: { index: false } };

const bold = (chunks: ReactNode) => <strong>{chunks}</strong>;
const accent = (chunks: ReactNode) => <span className="text-cloth">{chunks}</span>;

const rowClass = "flex min-h-row items-center gap-3 border-b border-rule py-2";

export default async function SignInPage() {
  const [locale, t, state] = await Promise.all([getLocale(), getTranslations("signIn"), getTranslations("appState")]);
  if (!isLocale(locale)) notFound();
  return (
    <div className="relative min-h-dvh bg-page">
      {/* The ledger's margin: two red lines down the left edge. */}
      <span aria-hidden="true" className="absolute inset-y-0 left-5.5 w-2 border-x-2 border-cloth" />
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col pt-3.5 pr-5.5 pb-5.5 pl-10">
        <header className="flex items-center justify-between gap-3">
          <p className="type-headline text-2xl text-cloth">{brand.name}</p>
          <a
            href={localeHref(locale, languagePath)}
            lang={locale}
            hrefLang={locale}
            className="flex min-h-tap items-center px-1 font-sans text-base font-bold ring:ground-ring"
          >
            {localeNames[locale]}
          </a>
        </header>

        <main className="flex flex-1 flex-col">
          <h1 className="type-headline mt-5 text-6xl wrap-break-word">{t.rich("headline", { accent })}</h1>

          <ol className="mt-6 border-t-2 border-ink">
            <li className={rowClass}>
              <span className="type-label shrink-0 text-ink-label">{t("tapLabel", { n: 1 })}</span>
              <span className="type-body min-w-0">{t.rich("tap1", { b: bold })}</span>
            </li>
            <li className={rowClass}>
              <span className="type-label shrink-0 text-ink-label">{t("tapLabel", { n: 2 })}</span>
              <span className="type-body min-w-0">{t.rich("tap2", { b: bold })}</span>
            </li>
            <li className="flex min-h-row items-center gap-3 border-b-2 border-ink py-2">
              <Stamp size="sm" tone="stamp" label={t("stamp")}>
                {t("stamp")}
              </Stamp>
              <span className="type-body min-w-0">{t.rich("paid", { b: bold })}</span>
            </li>
          </ol>

          <div className="mt-auto flex flex-col gap-4 pt-8">
            <SignInScreen
              locale={locale}
              words={{
                google: t("google"),
                busy: t("busy"),
                offline: t("offline"),
                cancelled: t("cancelled"),
                failed: t("failed"),
                expired: t("expired"),
                opening: state("loading"),
              }}
            />
            <p className="type-caption text-ink-soft">{t("note")}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
