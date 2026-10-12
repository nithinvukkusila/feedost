"use client";

// Setup step 1: name and subjects (spec R1-1, criteria 21 to 26). The name field starts empty for a new
// tutor and holds the saved name for one who comes to edit. Next saves to the tutor's own row, then goes
// to step 2. A failed save keeps everything typed and says so; it never moves on.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useTutor } from "@/components/app/app-gate";
import { ClothGround } from "@/components/app/cloth-ground";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { Locale } from "@/config/locales";
import { localeHref, setupUpiPath, signInPath } from "@/config/routes";
import { signOut } from "@/lib/auth";
import { isPresetKey, normalizeName, normalizeSubjects, presetKeys, type SubjectNames } from "@/lib/profile";
import { saveProfile } from "@/lib/tutor";
import { SaveNotice, type SaveProblem } from "./save-notice";
import { StepHeader } from "./step-header";
import { SubjectChips } from "./subject-chips";

// Keeps typed text out of analytics and error-report recordings, should a later slice add either.
const guarded = { "data-ph-no-capture": "", "data-sentry-mask": "" } as const;

function Arrow() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function ProfileForm() {
  const t = useTranslations("setup");
  const subjectWords = useTranslations("subjects");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { tutor, setTutor } = useTutor();

  const names = Object.fromEntries(presetKeys.map((key) => [key, subjectWords(key)])) as SubjectNames;

  const [name, setName] = useState(tutor.name ?? "");
  const [picked, setPicked] = useState<string[]>(tutor.subjects);
  const [extras, setExtras] = useState<string[]>(() => tutor.subjects.filter((subject) => !isPresetKey(subject)));
  const [nameTouched, setNameTouched] = useState(false);
  const [subjectsTouched, setSubjectsTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem>(null);
  const [offline, setOffline] = useState(false);
  const nameField = useRef<HTMLTextAreaElement>(null);

  const nameCheck = normalizeName(name);
  const subjectsCheck = normalizeSubjects(picked, names);

  const nameProblem =
    nameTouched && !nameCheck.ok
      ? { state: "error" as const, stateLabel: t(nameCheck.error === "missing" ? "state.missing" : "state.tooLong"), message: t(nameCheck.error === "missing" ? "name.missing" : "name.tooLong") }
      : {};
  const subjectsProblem = subjectsTouched && !subjectsCheck.ok ? t(subjectsCheck.error === "missing" ? "subjects.missing" : "subjects.limit") : null;

  function toggle(subject: string) {
    setSubjectsTouched(true);
    setPicked((now) => (now.includes(subject) ? now.filter((item) => item !== subject) : [...now, subject]));
  }

  function add(subject: string) {
    setSubjectsTouched(true);
    if (!isPresetKey(subject)) setExtras((now) => (now.some((item) => item.toLowerCase() === subject.toLowerCase()) ? now : [...now, subject]));
    setPicked((now) => (now.some((item) => item.toLowerCase() === subject.toLowerCase()) ? now : [...now, subject]));
  }

  async function leave() {
    await signOut();
    router.replace(localeHref(locale, signInPath));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setNameTouched(true);
    setSubjectsTouched(true);
    if (!nameCheck.ok) {
      nameField.current?.focus();
      return;
    }
    if (!subjectsCheck.ok) return;
    setSaving(true);
    setProblem(null);
    const result = await saveProfile({ name: nameCheck.value, subjects: subjectsCheck.value, language: locale });
    if (result.ok) {
      setTutor(result.tutor);
      router.push(localeHref(locale, setupUpiPath));
      return;
    }
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    setProblem(result.reason);
    setSaving(false);
  }

  return (
    <ClothGround width="form">
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col pt-1.5 pr-5.5 pb-5.5 pl-5 md:min-h-0 md:max-w-none md:px-8 md:pt-4">
        <StepHeader step={1} />
        <h1 className="type-headline mt-3.5 text-5xl wrap-break-word">{t("profile.title")}</h1>
        <p className="type-body mt-2.5 text-ink-soft">{t("profile.body")}</p>
  
        <form noValidate onSubmit={submit} className="mt-6 flex flex-1 flex-col gap-6">
          <Field
            ref={nameField}
            label={t("profile.name")}
            value={name}
            autoComplete="name"
            autoCapitalize="words"
            onChange={(event) => setName(event.currentTarget.value)}
            onBlur={() => setNameTouched(true)}
            {...guarded}
            {...nameProblem}
          />
          <SubjectChips names={names} picked={picked} extras={extras} onToggle={toggle} onAdd={add} error={subjectsProblem} />
  
          <div className="mt-auto flex flex-col gap-4 pt-4">
            <SaveNotice problem={problem} offline={offline} action={t("profile.nextWord")} onSignOut={leave} />
            <div className="pr-1.5 pb-1.5">
              <Button type="submit" variant="record" size="xl" full busy={saving} busyLabel={t("profile.next")} iconEnd={<Arrow />}>
                {t("profile.next")}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </ClothGround>
  );
}
