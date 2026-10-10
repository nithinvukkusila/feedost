"use client";

// The home screen of a tutor with no students yet (spec R1-1, criterion 32; canvas "State-empty").
// There is no "Add students" button and no sample-data link: they cannot work yet (R1-3), and a button
// that cannot work is not shown. The dashed rows are only the shape of the list to come. The plain
// Sign out button moves to the More screen in step 5, and the More link arrives with it.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTutor } from "@/components/app/app-gate";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import type { Locale } from "@/config/locales";
import { localeHref, signInPath } from "@/config/routes";
import { signOut } from "@/lib/auth";

/** The first word of the name: "Meena" for "Meena Iyer". */
export function firstName(name: string | null): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

export function EmptyHome() {
  const t = useTranslations("home");
  const more = useTranslations("more");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { tutor } = useTutor();

  async function leave() {
    await signOut();
    router.replace(localeHref(locale, signInPath));
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-page pt-3 pr-5.5 pb-5.5 pl-5">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="type-headline text-2xl text-cloth">{brand.name}</p>
        <div className="pr-1.5 pb-1.5">
          <Button variant="outline" onClick={leave}>
            {more("signOut")}
          </Button>
        </div>
      </header>
      <p translate="no" className="type-body-lg mt-3 font-bold text-ink-label wrap-anywhere">
        {t("hello", { name: firstName(tutor.name) })}
      </p>

      <h1 className="type-headline mt-5 text-5xl wrap-break-word">{t("empty.title")}</h1>
      <p className="type-body-lg mt-3 text-ink-soft">{t("empty.body")}</p>

      <div aria-hidden="true" className="mt-6 mr-1.5 border-2 border-dashed border-ink bg-slip px-3.5 py-1">
        <div className="h-14 border-b border-dashed border-rule" />
        <div className="h-14 border-b border-dashed border-rule" />
        <div className="h-14" />
      </div>

      <p className="type-body mt-7 mr-1.5 border-2 border-dashed border-ink px-3.5 py-3 font-bold">{t("empty.soon")}</p>
    </main>
  );
}
