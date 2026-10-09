// Root layout of /en/, /hi/, /kn/ and /te/. The language is the address; `lang` is written into the
// built HTML. The locale is read only through next/root-params (see src/i18n/request.ts).
import type { Metadata, Viewport } from "next";
import { locale as rootLocale } from "next/root-params";
import { notFound } from "next/navigation";
import { HtmlShell } from "@/components/shell/html-shell";
import { brand } from "@/config/brand";
import { isLocale, locales } from "@/config/locales";

export const metadata: Metadata = {
  title: brand.name,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await rootLocale();
  if (!isLocale(locale)) notFound();
  return <HtmlShell lang={locale}>{children}</HtmlShell>;
}
