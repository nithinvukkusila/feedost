"use client";

// The add and edit form for one student (spec R1-3, criteria 16 to 30 and 33 to 35). One component, two
// modes. Every field is checked together on Save and every error shown at once, the first focused. A save is
// one call; the id of a new student is made once per fill, so a second tap or a retry cannot make two rows.
// Whatever was typed is kept on every failure.
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { useRoster } from "@/components/app/roster";
import { TextField } from "@/components/app/text-field";
import { WriteNotice, type WriteProblem } from "@/components/app/write-notice";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { SelectField } from "@/components/ui/select-field";
import { localeNames, locales, type Locale } from "@/config/locales";
import { localeHref, studentsPath } from "@/config/routes";
import { normalizePhone, tidyTyped } from "@/lib/phone";
import { rupeesText, tidyRupees } from "@/lib/rupees";
import {
  changedFields,
  checkStudent,
  DUE_DAYS,
  FEE_LIMITS,
  firstError,
  OWES_LIMITS,
  samePhone,
  type FieldError,
  type FieldName,
  type StudentDraft,
} from "@/lib/student-form";
import { sortBatches } from "@/lib/student-list";
import { createStudent, updateStudent, type Student } from "@/lib/students";
import { newId } from "@/lib/uuid";

export type StudentFormProps =
  | { mode: "add"; initialBatchId?: string }
  /** `owesLocked`: a payment has been recorded against the earlier balance, so "Already owes" cannot change (R1-7, criterion 20). */
  | { mode: "edit"; student: Student; owesLocked?: boolean; owesChecking?: boolean };

const NO_BATCH = "";

function startDraft(props: StudentFormProps, locale: Locale): StudentDraft {
  if (props.mode === "edit") {
    const s = props.student;
    return {
      name: s.name,
      parentName: s.parentName ?? "",
      phone: s.parentPhone ? tidyTyped(s.parentPhone) : "",
      parentLanguage: s.parentLanguage,
      batchId: s.batchId ?? NO_BATCH,
      dueDay: s.dueDay,
      fee: rupeesText(s.monthlyFee),
      owes: rupeesText(s.openingBalance, true),
      permission: false,
    };
  }
  return { name: "", parentName: "", phone: "", parentLanguage: locale, batchId: props.initialBatchId ?? NO_BATCH, dueDay: 1, fee: "", owes: "", permission: false };
}

export function StudentForm(props: Readonly<StudentFormProps>) {
  const t = useTranslations("students");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const roster = useRoster();
  const editing = props.mode === "edit";
  const owesLocked = props.mode === "edit" && props.owesLocked === true;
  // Held read-only (without the "payment recorded" words) until the edit screen has read whether a payment exists.
  const owesChecking = props.mode === "edit" && props.owesChecking === true;
  const saved = props.mode === "edit" ? props.student : null;

  const [draft, setDraft] = useState<StudentDraft>(() => startDraft(props, locale));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState<"save" | "another" | null>(null);
  const [problem, setProblem] = useState<WriteProblem | "gone" | "missing">(null);
  const [status, setStatus] = useState<string | null>(null);
  const [id, setId] = useState(newId);
  const formId = useId();
  const nameRef = useRef<HTMLTextAreaElement>(null);
  const parentNameRef = useRef<HTMLTextAreaElement>(null);
  const phoneRef = useRef<HTMLTextAreaElement>(null);
  const feeRef = useRef<HTMLTextAreaElement>(null);
  const owesRef = useRef<HTMLTextAreaElement>(null);
  const permissionRef = useRef<HTMLInputElement>(null);
  const focusField = (field: FieldName) => {
    const target = { name: nameRef, parentName: parentNameRef, phone: phoneRef, fee: feeRef, owes: owesRef, permission: permissionRef }[field];
    target.current?.focus();
  };

  const set = <K extends keyof StudentDraft>(key: K, value: StudentDraft[K]) => setDraft((now) => ({ ...now, [key]: value }));
  const batches = sortBatches(roster.batches);
  // A batch that is no longer there is "No batch" on the screen; saving sends what is shown.
  const batchValue = batches.some((batch) => batch.id === draft.batchId) ? draft.batchId : NO_BATCH;
  const check = checkStudent({ ...draft, batchId: batchValue }, { savedPhone: saved?.parentPhone ?? null });
  const errors = submitted && !check.ok ? check.errors : {};

  const typedPhone = normalizePhone(draft.phone);
  const sibling = typedPhone.ok ? samePhone(roster.students, typedPhone.value, saved?.id) : undefined;

  const problemOf = (field: FieldName, name: string): { tag: string; message: string } | undefined => {
    const error: FieldError | undefined = errors[field];
    return error ? { tag: t(`state.${error.tag}`), message: t(`err.${error.message}`, { n: error.count ?? 0, name }) } : undefined;
  };

  async function submit(event: FormEvent<HTMLFormElement> | null, mode: "save" | "another") {
    event?.preventDefault();
    if (saving !== null) return;
    setSubmitted(true);
    setStatus(null);
    const wanted = checkStudent({ ...draft, batchId: batchValue }, { savedPhone: saved?.parentPhone ?? null });
    if (!wanted.ok) {
      const first = firstError(wanted.errors);
      if (first) focusField(first);
      return;
    }
    const back = localeHref(locale, studentsPath);
    setProblem(null);
    if (saved) {
      const patch = changedFields(saved, wanted.fields);
      if (Object.keys(patch).length === 0) {
        router.push(back);
        return;
      }
    }
    setSaving(mode);
    const result = saved ? await updateStudent(saved.id, changedFields(saved, wanted.fields)) : await createStudent(id, wanted.fields);
    setSaving(null);
    if (!result.ok) {
      if (result.reason === "batch-gone") {
        setProblem("gone");
        roster.reload();
      } else setProblem(result.reason === "missing" ? "missing" : result.reason === "offline" ? "offline" : "failed");
      return;
    }
    roster.put(result.student);
    if (mode === "another" && !saved) {
      setDraft((now) => ({ ...now, name: "", parentName: "", phone: "", owes: "", permission: false }));
      setSubmitted(false);
      setId(newId());
      setStatus(t("form.saved", { name: result.student.name }));
      focusField("name");
      return;
    }
    router.push(back);
  }

  const dayOptions = DUE_DAYS.map((day) => ({ value: String(day), label: t("days.ordinal", { day }) }));
  const batchOptions = [{ value: NO_BATCH, label: t("form.noBatch") }, ...batches.map((batch) => ({ value: batch.id, label: batch.name }))];
  const permissionError = errors.permission;
  const permissionHintId = `${formId}-permission-hint`;
  const permissionErrorId = `${formId}-permission-error`;

  return (
    <form noValidate onSubmit={(event) => submit(event, "save")} className="flex flex-col gap-6">
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="type-label mb-3 text-ink-label">{t("form.groupWho")}</legend>
      <TextField ref={nameRef} label={t("form.name")} value={draft.name} autoCapitalize="words" autoComplete="off" onChange={(e) => set("name", e.currentTarget.value)} error={problemOf("name", "")} />
      <TextField ref={parentNameRef} label={t("form.parentName")} value={draft.parentName} autoCapitalize="words" autoComplete="off" onChange={(e) => set("parentName", e.currentTarget.value)} error={problemOf("parentName", "")} />
      <TextField
        ref={phoneRef}
        label={t("form.phone")}
        value={draft.phone}
        inputMode="tel"
        autoComplete="off"
        latinValue
        placeholder="98860 44321"
        onChange={(e) => set("phone", e.currentTarget.value)}
        onBlur={() => set("phone", tidyTyped(draft.phone))}
        error={problemOf("phone", "")}
        helper={
          sibling ? (
            <span>
              {t("form.sameNumber", { name: sibling.name })}
            </span>
          ) : (
            <span translate="no">+91</span>
          )
        }
      />
      <Segmented
        label={t("form.language")}
        name="parent-language"
        value={draft.parentLanguage}
        onChange={(value) => set("parentLanguage", value)}
        options={[
          { value: locales[0], label: <span lang={locales[0]}>{localeNames[locales[0]]}</span> },
          { value: locales[1], label: <span lang={locales[1]}>{localeNames[locales[1]]}</span> },
          { value: locales[2], label: <span lang={locales[2]}>{localeNames[locales[2]]}</span> },
          { value: locales[3], label: <span lang={locales[3]}>{localeNames[locales[3]]}</span> },
        ]}
      />
      <div className="flex flex-col gap-1">
        <label className="flex min-h-tap items-start gap-3 py-1">
          <input
            ref={permissionRef}
            type="checkbox"
            checked={draft.permission}
            onChange={(e) => set("permission", e.currentTarget.checked)}
            aria-invalid={permissionError ? "true" : undefined}
            aria-describedby={permissionError ? `${permissionHintId} ${permissionErrorId}` : permissionHintId}
            className="mt-0.5 size-6 shrink-0 accent-blue"
          />
          <span className="type-body-sm wrap-anywhere">{t("form.permission")}</span>
        </label>
        <p id={permissionHintId} className="type-caption pl-9 text-ink-soft wrap-anywhere">
          {t("form.permissionHint")}
        </p>
        {permissionError ? (
          <p id={permissionErrorId} className="type-caption font-semibold text-cloth wrap-anywhere">
            {t("err.permissionNeeded")}
          </p>
        ) : null}
      </div>

      <SelectField label={t("form.batch")} value={batchValue} onChange={(value) => set("batchId", value)} options={batchOptions} />
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="type-label mb-3 text-ink-label">{t("form.groupFee")}</legend>
      <SelectField label={t("form.dueDay")} value={String(draft.dueDay)} onChange={(value) => set("dueDay", Number(value))} options={dayOptions} />
      <TextField
        ref={feeRef}
        label={t("form.fee")}
        value={draft.fee}
        inputMode="numeric"
        autoComplete="off"
        latinValue
        onChange={(e) => set("fee", e.currentTarget.value)}
        onBlur={() => set("fee", tidyRupees(draft.fee, FEE_LIMITS))}
        error={problemOf("fee", "")}
        helper={editing ? t("form.feeFromNextMonth") : undefined}
      />
      </fieldset>

      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="type-label mb-3 text-ink-label">{t("form.groupOwes")}</legend>
      <TextField
        ref={owesRef}
        label={t("form.owes")}
        value={draft.owes}
        inputMode="numeric"
        autoComplete="off"
        latinValue
        placeholder="0"
        readOnly={owesLocked || owesChecking}
        onChange={(e) => set("owes", e.currentTarget.value)}
        onBlur={() => set("owes", tidyRupees(draft.owes, OWES_LIMITS))}
        error={problemOf("owes", "")}
        helper={owesLocked ? t("form.owesLocked") : t("form.owesHint")}
      />
      </fieldset>

      <p role="status" className="type-body-sm font-bold text-stamp empty:hidden">
        {status}
      </p>
      <WriteNotice
        problem={problem === "gone" || problem === "missing" ? null : problem}
        failed={t("form.saveFailed")}
        offline={t("form.offline")}
      />
      {problem === "gone" ? <p role="alert" className="type-body-sm font-semibold text-cloth wrap-anywhere">{t("form.batchGone")}</p> : null}
      {problem === "missing" ? <p role="alert" className="type-body-sm font-semibold text-cloth wrap-anywhere">{t("edit.notFound")}</p> : null}

      <div className="flex flex-col gap-4 pr-1.5 pb-1.5">
        <Button type="submit" variant="record" size="xl" full busy={saving === "save"} busyLabel={editing ? t("form.saveChanges") : t("form.save")}>
          {editing ? t("form.saveChanges") : t("form.save")}
        </Button>
        {editing ? null : (
          <Button
            variant="outline"
            full
            busy={saving === "another"}
            busyLabel={t("form.saveAnother")}
            onClick={() => submit(null, "another")}
          >
            {t("form.saveAnother")}
          </Button>
        )}
      </div>
    </form>
  );
}
