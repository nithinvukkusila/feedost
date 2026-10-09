// Placeholder until the landing page (slice R0-1) replaces it.
import { useTranslations } from "next-intl";
import { brand } from "@/config/brand";

export default function LocaleHome() {
  const t = useTranslations("home");
  return (
    <main className="p-5">
      <h1 className="type-headline text-3xl">{brand.name}</h1>
      <p className="type-body mt-3">{t("placeholder")}</p>
    </main>
  );
}
