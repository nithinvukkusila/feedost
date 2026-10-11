"use client";

// Adds a batch (spec R1-3, criteria 40, 41 and 46): a name, optional timings and a black "Add batch" button,
// on the batch list. The name is checked here first, against the batches already held, and the database's
// own refusal of a repeated name is shown the same way. What was typed is never lost on a failure.
import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { useRoster } from "@/components/app/roster";
import { TextField } from "@/components/app/text-field";
import { WriteNotice, type WriteProblem } from "@/components/app/write-notice";
import { Button } from "@/components/ui/button";
import { createBatch } from "@/lib/batches";
import { checkBatch, type BatchFieldError } from "@/lib/batch-form";
import { newId } from "@/lib/uuid";

export function BatchForm() {
  const t = useTranslations("batches");
  const form = useTranslations("students.form");
  const roster = useRoster();
  const [name, setName] = useState("");
  const [timings, setTimings] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<WriteProblem>(null);
  // One id per fill: a second tap, or a retry after a lost answer, is the same batch.
  const [id, setId] = useState(newId);
  const nameField = useRef<HTMLTextAreaElement>(null);
  const timingsField = useRef<HTMLTextAreaElement>(null);

  const check = checkBatch({ name, timings }, roster.batches);
  const tidyName = name.replace(/\s+/g, " ").trim();
  // The database refused this very name (a batch made on another phone, say): say so until it is changed.
  const nameError: BatchFieldError | undefined = submitted
    ? !check.ok && check.errors.name
      ? check.errors.name
      : refused !== null && refused === tidyName
        ? { tag: "nameTaken", message: "nameTaken" }
        : undefined
    : undefined;
  const timingsError = submitted && !check.ok ? check.errors.timings : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    if (!check.ok) {
      (check.errors.name ? nameField : timingsField).current?.focus();
      return;
    }
    setSaving(true);
    setProblem(null);
    const result = await createBatch({ id, name: check.value.name, timings: check.value.timings });
    setSaving(false);
    if (result.ok) {
      roster.putBatch(result.batch);
      setName("");
      setTimings("");
      setSubmitted(false);
      setRefused(null);
      setId(newId());
      nameField.current?.focus();
      return;
    }
    if (result.reason === "name-taken") {
      setRefused(check.value.name);
      nameField.current?.focus();
      return;
    }
    setProblem(result.reason === "offline" ? "offline" : "failed");
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <TextField
        ref={nameField}
        label={t("name")}
        value={name}
        autoCapitalize="words"
        onChange={(event) => setName(event.currentTarget.value)}
        error={nameError && { tag: t(`state.${nameError.tag}`), message: t(`err.${nameError.message}`, { name: tidyName }) }}
      />
      <TextField
        ref={timingsField}
        label={t("timings")}
        value={timings}
        onChange={(event) => setTimings(event.currentTarget.value)}
        error={timingsError && { tag: t(`state.${timingsError.tag}`), message: t(`err.${timingsError.message}`) }}
      />
      <WriteNotice problem={problem} failed={t("saveFailed")} offline={form("offline")} />
      <div className="pr-1.5 pb-1.5">
        <Button type="submit" variant="record" full busy={saving} busyLabel={t("add")}>
          {t("add")}
        </Button>
      </div>
    </form>
  );
}
