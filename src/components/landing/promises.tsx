// Section 5: four promises, numbered 01 to 04 in DM Mono.
import { useTranslations } from "next-intl";

const promises = [
  { key: "p1", no: "01" },
  { key: "p2", no: "02" },
  { key: "p3", no: "03" },
  { key: "p4", no: "04" },
] as const;

export function Promises() {
  const t = useTranslations("landing.promises");
  return (
    <section aria-labelledby="promises-title" className="mx-auto w-full max-w-2xl px-5 pt-16">
      <h2 id="promises-title" className="type-headline text-4xl wrap-break-word">
        {t("title")}
      </h2>
      <ol className="mt-6 border-t-3 border-ink">
        {promises.map(({ key, no }) => (
          <li key={key} className="border-b border-ink py-4">
            <div className="flex items-baseline gap-3">
              {/* DM Mono and 0-9 digits in every language, so not the script's label font. */}
              <span aria-hidden="true" translate="no" className="type-amount-row text-cloth">
                {no}
              </span>
              <h3 className="type-headline min-w-0 text-2xl wrap-break-word">{t(`${key}.title`)}</h3>
            </div>
            <p className="type-body mt-2 text-ink-soft">{t(`${key}.body`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
