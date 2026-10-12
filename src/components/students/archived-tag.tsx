import { useTranslations } from "next-intl";

/** The word "Archived" with a dashed outline: a word and a mark, never colour alone. */
export function ArchivedTag() {
  const t = useTranslations("students");
  return (
    <span className="type-label inline-block max-w-full border-2 border-dashed border-ink-label px-2 py-0.5 text-ink-soft wrap-anywhere">
      {t("archivedTag")}
    </span>
  );
}
