// The way back from Google (spec R1-1, criteria 10 and 11). Static: the code is read from the address
// in the browser, never on a server.
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CallbackScreen } from "@/components/auth/callback-screen";
import { brand } from "@/config/brand";
import { isLocale } from "@/config/locales";

export const metadata: Metadata = { robots: { index: false } };

export default async function CallbackPage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("signIn")]);
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-page px-5.5 pt-3.5">
      <p className="type-headline text-2xl text-cloth">{brand.name}</p>
      <CallbackScreen locale={locale} label={t("callback")} />
    </main>
  );
}
