"use client";

// The More screen (spec R1-1, criteria 34 and 35; canvas "More"). The tutor's profile on a slip on the
// cloth cover, an Edit link into the setup steps, the language row, Sign out and a way back home. Nothing
// else: Pro, export, help and delete account arrive with their own slices, and a row that cannot work
// is not shown. The language row is a plain link to the picker; the picker's Continue then goes to
// sign-in, which sends a signed-in tutor straight home in the new language, and the gate keeps the
// tutor's saved language in step (criteria 35 and 36).
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTutor } from "@/components/app/app-gate";
import { AppScreen } from "@/components/app/app-screen";
import { useSoftLink } from "@/components/app/use-soft-link";
import { Button } from "@/components/ui/button";
import { Slip } from "@/components/ui/slip";
import { localeNames, type Locale } from "@/config/locales";
import { homePath, languagePath, localeHref, setupProfilePath, signInPath } from "@/config/routes";
import { signOut } from "@/lib/auth";
import { presetKeys, subjectLabel, type SubjectNames } from "@/lib/profile";

function BackArrow() {
  return (
    <svg aria-hidden="true" focusable={false} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function MoreScreen() {
  const t = useTranslations("more");
  const subjectWords = useTranslations("subjects");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const soft = useSoftLink();
  const { tutor } = useTutor();

  const names = Object.fromEntries(presetKeys.map((key) => [key, subjectWords(key)])) as SubjectNames;
  const subjects = tutor.subjects.map((subject) => subjectLabel(subject, names)).join(", ");
  const home = localeHref(locale, homePath);
  const edit = localeHref(locale, setupProfilePath);

  async function leave() {
    await signOut();
    router.replace(localeHref(locale, signInPath));
  }

  return (
    <AppScreen nav="more">
      <header className="on-cloth-ground border-b-2 border-ink bg-cloth px-5 pt-3 pb-6 text-on-cloth outline-2 -outline-offset-8 outline-stitch outline-dashed">
        <a href={home} onClick={soft(home)} className="type-control-sm -ml-3 inline-flex min-h-tap items-center gap-1 pr-3 pl-2 text-on-cloth ring:ground-ring">
          <BackArrow />
          <span className="min-w-0 underline wrap-anywhere">{t("back")}</span>
        </a>
        <h1 className="type-headline mt-3 text-4xl text-on-cloth wrap-break-word">{t("title")}</h1>
        <Slip as="section" aria-labelledby="more-profile" className="mt-4 flex items-end justify-between gap-2 px-3.5 py-3">
          <div className="min-w-0">
            <h2 id="more-profile" className="type-label font-medium text-ink-label">
              {t("profile")}
            </h2>
            <p translate="no" className="type-headline text-3xl wrap-anywhere">
              {tutor.name}
            </p>
            <p translate="no" className="type-body-sm mt-0.5 text-ink-soft wrap-anywhere">
              {subjects}
            </p>
            {tutor.upiId ? (
              <p translate="no" className="type-amount-row text-blue wrap-anywhere">
                {tutor.upiId}
              </p>
            ) : null}
          </div>
          <a href={edit} onClick={soft(edit)} className="type-control-sm flex min-h-tap min-w-tap shrink-0 items-center justify-center px-1 text-ink underline ring:ground-ring">
            {t("edit")}
          </a>
        </Slip>
      </header>

      <div className="flex flex-1 flex-col gap-6 pt-5 pr-5.5 pb-6 pl-4">
        <ul className="border-2 border-ink bg-slip px-3">
          <li>
            <a href={localeHref(locale, languagePath)} className="flex min-h-14 items-center justify-between gap-3 py-2 text-ink ring:ground-ring">
              <span className="type-name min-w-0 wrap-anywhere">{t("language")}</span>
              <span lang={locale} className="type-endonym shrink-0 font-semibold text-ink-label">
                {localeNames[locale]}
              </span>
            </a>
          </li>
        </ul>

        <div className="pr-1.5 pb-1.5">
          <Button variant="outline" full onClick={leave}>
            {t("signOut")}
          </Button>
        </div>
      </div>
    </AppScreen>
  );
}
