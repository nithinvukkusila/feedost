// The 404 for any address no route matches (/fr/, /en/nope/, /xyz). Next skips every layout for this
// file, so it writes its own <html lang>, imports the CSS and fonts itself, and cannot read the locale
// from the address: it shows all four languages, each block with its own `lang`, and four links.
// Next adds <meta name="robots" content="noindex"> to a 404 itself. Server HTML only; no client code. Needs `experimental.globalNotFound` in next.config.ts.
import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { defaultLocale, localeNames, locales } from "@/config/locales";
import { loadMessages } from "@/i18n/messages";
import type en from "../../messages/en.json";
import { fontVariables } from "@/styles/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: brand.name,
};

export default async function GlobalNotFound() {
  // loadMessages turns a TODO-translate value into its English text, so the marker never shows.
  const blocks = await Promise.all(locales.map(async (code) => ({ code, notFound: ((await loadMessages(code)) as unknown as typeof en).notFound })));
  return (
    <html lang={defaultLocale} className={fontVariables}>
      <body className="bg-page-ruled type-body text-ink">
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 py-10">
          <h1 className="type-headline text-3xl">{brand.name}</h1>
          {blocks.map(({ code, notFound }) => (
            <section key={code} lang={code} className="border-t-3 border-ink pt-4">
              <h2 className="type-headline text-3xl wrap-break-word">{notFound.title}</h2>
              <p className="type-body mt-2">{notFound.body}</p>
              <a href={`/${code}/`} hrefLang={code} className="type-control mt-3 flex min-h-tap w-fit items-center text-blue underline ring:ground-ring">
                {localeNames[code]}
              </a>
            </section>
          ))}
        </main>
      </body>
    </html>
  );
}
