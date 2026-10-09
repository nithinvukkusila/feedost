// The strip of words under the hero. Decoration only, so it is hidden from screen readers, and it
// does not move (spec R0-1, criterion 23). It wraps instead of clipping, so a large font cannot cut a word.
import { useTranslations } from "next-intl";

const accent = "text-highlight";

export function Ribbon() {
  const t = useTranslations("landing.ribbon");
  return (
    <div aria-hidden="true" className="mt-10 overflow-hidden bg-ink px-5 py-3 text-on-cloth">
      <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-x-5 gap-y-1">
        <span lang="en" className="type-headline text-2xl">
          {t("fees")}
        </span>
        <span lang="hi" className={`type-headline text-2xl ${accent}`}>
          {t("hindi")}
        </span>
        <span lang="kn" className="type-headline text-2xl">
          {t("kannada")}
        </span>
        <span lang="te" className={`type-headline text-2xl ${accent}`}>
          {t("telugu")}
        </span>
        <span className="type-headline text-2xl">{t("remind")}</span>
        <span className={`type-headline text-2xl ${accent}`}>{t("pay")}</span>
        <span className="type-headline text-2xl">{t("paid")}</span>
      </div>
    </div>
  );
}
