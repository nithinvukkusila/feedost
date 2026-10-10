// TEMPORARY home (step 3): replaced in step 4 by the app gate and the empty home.
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { TempHome } from "@/components/home/temp-home";
import { brand } from "@/config/brand";
import { isLocale } from "@/config/locales";

export const metadata: Metadata = { robots: { index: false } };

export default async function HomePage() {
  const [locale, state, more] = await Promise.all([getLocale(), getTranslations("appState"), getTranslations("more")]);
  if (!isLocale(locale)) notFound();
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-page px-5 pt-3.5">
      <p className="type-headline text-2xl text-cloth">{brand.name}</p>
      <TempHome locale={locale} words={{ loading: state("loading"), signOut: more("signOut") }} />
    </main>
  );
}
