// The last block: one sentence, the four language links and the big decorative product name.
// The language links are plain links; following one does not save the choice (spec R0-1, criterion 32).
import { useLocale, useTranslations } from "next-intl";
import { brand } from "@/config/brand";
import { localeNames, locales } from "@/config/locales";

export function LandingFooter() {
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
                  <span lang={code} aria-current="page" className="type-body flex min-h-tap min-w-tap items-center border-b-4 border-highlight font-bold">
                    {localeNames[code]}
                  </span>
                ) : (
                  <a href={`/${code}/`} lang={code} hrefLang={code} className="type-body flex min-h-tap min-w-tap items-center underline ring:ground-ring">
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
