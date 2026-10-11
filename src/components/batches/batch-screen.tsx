"use client";

// One batch (spec R1-3, criteria 42 to 45 and 47; canvas "Batch"): its name with Rename, its timings, how
// many students it has and what they pay each month, the students in it, a way to add one to it, and
// Delete batch. There is no Pending and no Take attendance: they arrive with the dues and attendance slices.
// A record is named by `?id=` in the address (a static export cannot prerender a path per batch).
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { AppScreen } from "@/components/app/app-screen";
import { BackLink } from "@/components/app/back-link";
import { PlusIcon } from "@/components/app/icons";
import { LoadingBook } from "@/components/app/loading-book";
import { useQueryParam } from "@/components/app/read-id";
import { useRoster } from "@/components/app/roster";
import { RosterGate } from "@/components/app/roster-states";
import { TextField } from "@/components/app/text-field";
import { useSoftLink } from "@/components/app/use-soft-link";
import { WriteNotice, type WriteProblem } from "@/components/app/write-notice";
import { withNode } from "@/components/app/with-node";
import { StudentRow } from "@/components/students/student-row";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/locales";
import { batchesPath, localeHref, studentNewPath } from "@/config/routes";
import { updateBatch, type Batch } from "@/lib/batches";
import { checkBatch } from "@/lib/batch-form";
import { formatRupees } from "@/lib/format";
import { batchSummary, sortStudents } from "@/lib/student-list";
import { DeleteSheet } from "./delete-sheet";
import { MoveSheet } from "./move-sheet";

function NotFound() {
  const t = useTranslations("batches");
  const locale = useLocale() as Locale;
  return (
    <div className="flex flex-col gap-4 px-5 pt-1.5 pr-5.5">
      <BackLink href={localeHref(locale, batchesPath)} label={t("backToList")} />
      <h1 className="type-headline text-4xl wrap-break-word">{t("notFound.title")}</h1>
      <p className="type-body-lg text-ink-soft">{t("notFound.body")}</p>
    </div>
  );
}

function BatchBody({ batch }: Readonly<{ batch: Batch }>) {
  const t = useTranslations("batches");
  const form = useTranslations("students.form");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const soft = useSoftLink();
  const roster = useRoster();

  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(batch.name);
  const [timings, setTimings] = useState(batch.timings ?? "");
  const [submitted, setSubmitted] = useState<"rename" | "timings" | null>(null);
  const [refused, setRefused] = useState<string | null>(null);
  const [saving, setSaving] = useState<"rename" | "timings" | null>(null);
  const [problem, setProblem] = useState<WriteProblem>(null);
  const [savedTimings, setSavedTimings] = useState(false);
  const [asking, setAsking] = useState(false);
  const [moving, setMoving] = useState(false);
  const nameField = useRef<HTMLTextAreaElement>(null);
  const timingsField = useRef<HTMLTextAreaElement>(null);

  const inBatch = sortStudents(roster.students.filter((student) => student.active && student.batchId === batch.id));
  const { count, total } = batchSummary(roster.students, batch.id);
  const add = `${localeHref(locale, studentNewPath)}?batch=${encodeURIComponent(batch.id)}`;

  // Renaming checks the typed name; saving only the timings keeps the saved name.
  const check = checkBatch({ name: submitted === "timings" ? batch.name : name, timings }, roster.batches, batch.id);
  const tidyName = name.replace(/\s+/g, " ").trim();
  const nameError =
    submitted === "rename" && renaming
      ? !check.ok && check.errors.name
        ? check.errors.name
        : refused !== null && refused === tidyName
          ? ({ tag: "nameTaken", message: "nameTaken" } as const)
          : undefined
      : undefined;
  const timingsError = submitted !== null && !check.ok ? check.errors.timings : undefined;

  async function save(event: FormEvent<HTMLFormElement>, mode: "rename" | "timings") {
    event.preventDefault();
    if (saving !== null) return;
    setSubmitted(mode);
    setSavedTimings(false);
    const wanted = checkBatch({ name: mode === "timings" ? batch.name : name, timings }, roster.batches, batch.id);
    if (!wanted.ok) {
      (wanted.errors.name ? nameField : timingsField).current?.focus();
      return;
    }
    setSaving(mode);
    setProblem(null);
    const result = await updateBatch(batch.id, wanted.value);
    setSaving(null);
    if (result.ok) {
      roster.putBatch(result.batch);
      setSubmitted(null);
      setRefused(null);
      setTimings(result.batch.timings ?? "");
      if (mode === "rename") setRenaming(false);
      else setSavedTimings(true);
      return;
    }
    if (result.reason === "name-taken") {
      setRefused(wanted.value.name);
      nameField.current?.focus();
      return;
    }
    setProblem(result.reason === "offline" ? "offline" : "failed");
  }

  function startRename() {
    setName(batch.name);
    setRefused(null);
    setSubmitted(null);
    setProblem(null);
    setSavedTimings(false);
    setRenaming(true);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-col pt-1.5 pr-5.5 pl-5">
        <div className="flex items-center justify-between gap-3">
          <BackLink href={localeHref(locale, batchesPath)} label={t("backToList")} />
          {renaming ? null : (
            <button type="button" onClick={startRename} className="type-control-sm min-h-tap shrink-0 px-2 text-ink underline ring:ground-ring">
              {t("rename")}
            </button>
          )}
        </div>

        {renaming ? (
          <form noValidate onSubmit={(event) => save(event, "rename")} className="mt-2 flex flex-col gap-4">
            <TextField
              ref={nameField}
              label={t("name")}
              value={name}
              autoCapitalize="words"
              onChange={(event) => setName(event.currentTarget.value)}
              error={nameError && { tag: t(`state.${nameError.tag}`), message: t(`err.${nameError.message}`, { name: tidyName }) }}
            />
            <div className="flex flex-wrap gap-4 pr-1.5 pb-1.5">
              <Button type="submit" variant="record" busy={saving === "rename"} busyLabel={t("save")}>
                {t("save")}
              </Button>
              <Button variant="outline" onClick={() => setRenaming(false)}>
                {t("cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <h1 translate="no" className="type-headline mt-2 text-4xl wrap-anywhere">
            {batch.name}
          </h1>
        )}

        <form noValidate onSubmit={(event) => save(event, "timings")} className="mt-4 flex flex-col gap-3">
          <TextField
            ref={timingsField}
            label={t("timings")}
            value={timings}
            onChange={(event) => {
              setTimings(event.currentTarget.value);
              setSavedTimings(false);
            }}
            error={timingsError && { tag: t(`state.${timingsError.tag}`), message: t(`err.${timingsError.message}`) }}
          />
          <p role="status" className="type-caption reserve-line text-ink-soft">
            {savedTimings ? t("timingsSaved") : null}
          </p>
          <div className="pr-1.5 pb-1.5">
            <Button type="submit" variant="outline" busy={saving === "timings"} busyLabel={t("saveTimings")}>
              {t("saveTimings")}
            </Button>
          </div>
        </form>

        <WriteNotice problem={problem} failed={t("saveFailed")} offline={form("offline")} />

        <div className="mt-4 flex flex-col border-y-2 border-ink">
          <p className="type-headline border-b border-ink py-2 text-3xl wrap-break-word">{t("studentsCount", { n: count })}</p>
          <p className="py-2 type-body-lg font-bold">
            {withNode(
              (amount) => t("monthly", { amount }),
              <span translate="no" className="type-amount text-3xl text-blue">
                {formatRupees(total)}
              </span>,
            )}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col pr-5.5 pl-4">
        <div className="mb-5 pr-1.5 pb-1.5">
          <Button variant="outline" full onClick={() => setMoving(true)}>
            {t("move.link")}
          </Button>
        </div>
        {inBatch.length === 0 ? (
          <p className="type-body px-1 text-ink-soft">{t("noStudents")}</p>
        ) : (
          <ul className="border-2 border-b-0 border-ink bg-slip px-3">
            {inBatch.map((student) => (
              <StudentRow key={student.id} student={student} batchName={null} />
            ))}
          </ul>
        )}
        <div className="mt-4 pr-1.5 pb-1.5">
          <Button variant="record" full href={add} onClick={soft(add)} iconStart={<PlusIcon />}>
            {t("addStudent")}
          </Button>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 border-t-2 border-ink bg-slip px-5 py-1 pt-1">
        <p className="type-caption min-w-0 text-ink-soft">{t("delete.note")}</p>
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="type-control-sm min-h-tap shrink-0 px-1 text-cloth underline ring:ground-ring"
        >
          {t("delete.link")}
        </button>
      </div>

      <MoveSheet batch={batch} open={moving} onClose={() => setMoving(false)} />

      <DeleteSheet
        batch={batch}
        studentCount={count}
        open={asking}
        onClose={() => setAsking(false)}
        onDeleted={() => {
          roster.removeBatch(batch.id);
          router.push(localeHref(locale, batchesPath));
        }}
      />
    </div>
  );
}

function Chosen() {
  const id = useQueryParam("id");
  const roster = useRoster();
  const t = useTranslations("appState");
  if (id === undefined) return <LoadingBook label={t("loading")} />;
  const batch = id === null ? undefined : roster.batches.find((item) => item.id === id);
  return <AppScreen>{batch ? <BatchBody key={batch.id} batch={batch} /> : <NotFound />}</AppScreen>;
}

export function BatchScreen() {
  return (
    <RosterGate>
      <Chosen />
    </RosterGate>
  );
}
