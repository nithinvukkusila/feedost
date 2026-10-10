// The last block: one sentence, the four language links and the big decorative product name.
// Each endonym keeps its `lang` (screen readers say it right) but is set in the Latin stack, so the phone's own
// font draws it and no page fetches the three Anek files just for the footer (F3 criterion 5).
// The language links are plain links; following one does not save the choice (spec R0-1, criterion 32).
// `path` is the page the links point at in each language: none for the landing, the tool's path on a tool page.
import { useLocale, useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { localeNames, locales } from "@/config/locales";
import { localeHref } from "@/config/routes";

export function LandingFooter({ path = "" }: Readonly<{ path?: string }>) {
  const t = useTranslations("landing.footer");
  const current = useLocale();
  return (
    <footer className="on-dark-ground mt-16 overflow-hidden bg-ink text-on-cloth">
      <div className="mx-auto w-full max-w-2xl px-5 pt-5">
        <p className="type-body">{t("line")}</p>
        <nav aria-label={t("languages")}>
          <ul className="flex flex-wrap gap-x-6">
            {locales.map((code) => (
              <li key={code}>
                {code === current ? (
                  <span lang={code} aria-current="page" className="flex min-h-tap min-w-tap items-center border-b-4 border-highlight type-endonym font-bold">
                    {localeNames[code]}
                  </span>
                ) : (
                  <a href={localeHref(code, path)} lang={code} hrefLang={code} className="flex min-h-tap min-w-tap items-center type-endonym underline ring:ground-ring">
                    {localeNames[code]}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <p aria-hidden="true" className="type-headline mt-6 -mb-3 overflow-hidden text-8xl whitespace-nowrap text-cloth select-none">
          {brand.name}
        </p>
      </div>
    </footer>
  );
}
