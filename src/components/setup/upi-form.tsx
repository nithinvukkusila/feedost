"use client";

// Setup step 2: the UPI ID (spec R1-1, criteria 27 to 31). The ID is checked as the tutor types, once the
// field has been left a first time. Save and finish stores it and goes home. A failed save keeps what was
// typed and says so; it never moves on.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useTutor } from "@/components/app/app-gate";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { brand } from "@/config/brand";
import type { Locale } from "@/config/locales";
import { homePath, localeHref, setupProfilePath, signInPath } from "@/config/routes";
import { signOut } from "@/lib/auth";
import { saveUpi } from "@/lib/tutor";
import { checkUpi, trimUpi } from "@/lib/upi";
import { SaveNotice, type SaveProblem } from "./save-notice";
import { StepHeader } from "./step-header";

const guarded = { "data-ph-no-capture": "", "data-sentry-mask": "" } as const;

export function UpiForm() {
  const t = useTranslations("setup");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { tutor, setTutor } = useTutor();

  const [value, setValue] = useState(tutor.upiId ?? "");
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<SaveProblem>(null);
  const [offline, setOffline] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);

  const check = checkUpi(value);
  const shown =
    !touched
      ? {}
      : check === "ok"
        ? { state: "correct" as const, stateLabel: t("state.correct"), message: t("upi.ok") }
        : { state: "error" as const, stateLabel: t("state.needsFixing"), message: t(`upi.${check}`) };

  async function leave() {
    await signOut();
    router.replace(localeHref(locale, signInPath));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setTouched(true);
    if (check !== "ok") {
      field.current?.focus();
      return;
    }
    setSaving(true);
    setProblem(null);
    const result = await saveUpi(trimUpi(value));
    if (result.ok) {
      setTutor(result.tutor);
      router.replace(localeHref(locale, homePath));
      return;
    }
    setOffline(typeof navigator !== "undefined" && navigator.onLine === false);
    setProblem(result.reason);
    setSaving(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-page pt-1.5 pr-5.5 pb-5.5 pl-5">
      <StepHeader step={2} backHref={localeHref(locale, setupProfilePath)} />
      <h1 className="type-headline mt-3.5 text-5xl wrap-break-word">{t("upi.title")}</h1>
      <p className="type-body mt-2.5 text-ink-soft">{t("upi.body", { brand: brand.name })}</p>

      <form noValidate onSubmit={submit} className="mt-6 flex flex-1 flex-col gap-6">
        <Field
          ref={field}
          label={t("upi.label")}
          placeholder={t("upi.placeholder")}
          value={value}
          latinValue
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          inputMode="email"
          onChange={(event) => setValue(event.currentTarget.value)}
          onBlur={() => setTouched(true)}
          {...guarded}
          {...shown}
        />

        <div className="mt-auto flex flex-col gap-4 pt-4">
          <SaveNotice problem={problem} offline={offline} action={t("upi.save")} onSignOut={leave} />
          <div className="pr-1.5 pb-1.5">
            <Button type="submit" variant="record" size="xl" full busy={saving} busyLabel={t("upi.save")}>
              {t("upi.save")}
            </Button>
          </div>
        </div>
      </form>
    </main>
  );
}
