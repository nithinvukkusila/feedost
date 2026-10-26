"use client";

// "Move students" (spec R1-3, criterion 44): a sheet listing the active students who are not in this batch,
// each with a tick and the name of their present batch. A black "Move {n} here" puts the ticked ones in this
// batch in one update. Nothing is sent while none is ticked. The rows the database answered with go into the
// roster; a failure keeps the sheet and the ticks and says nothing was moved.
// UX-review-fixes-2, item 17: one Cancel (the sheet's own close), a search by name, and "Select all shown".
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRoster } from "@/components/app/roster";
import { WriteNotice, type WriteProblem } from "@/components/app/write-notice";
import { Button } from "@/components/ui/button";
import { Check } from "@/components/ui/check";
import { Field } from "@/components/ui/field";
import type { Locale } from "@/config/locales";
import { batchesPath, localeHref } from "@/config/routes";
import { Sheet } from "@/components/ui/sheet";
import type { Batch } from "@/lib/batches";
import { activeStudents, searchStudents, sortStudents } from "@/lib/student-list";
import { moveStudents } from "@/lib/students";

export function MoveSheet({ batch, open, onClose }: Readonly<{ batch: Batch; open: boolean; onClose: () => void }>) {
  const t = useTranslations("batches");
  const form = useTranslations("students.form");
  const roster = useRoster();
  const router = useRouter();
  const locale = useLocale() as Locale;
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const [moving, setMoving] = useState(false);
  const [problem, setProblem] = useState<WriteProblem>(null);
  const [gone, setGone] = useState(false);

  const [text, setText] = useState("");

  const others = sortStudents(activeStudents(roster.students).filter((student) => student.batchId !== batch.id));
  const batchName = (id: string | null) => roster.batches.find((item) => item.id === id)?.name ?? null;
  // The same matching as the Students search (17.2). Searching never clears a tick: a ticked student hidden by the
  // search still counts on the button (17.4).
  const shown = searchStudents(others, text);
  // Ticks for students who have since moved or been archived do not count.
  const chosen = others.filter((student) => ticked.has(student.id));
  const allShownTicked = shown.length > 0 && shown.every((student) => ticked.has(student.id));

  function tickShown(on: boolean) {
    setTicked((now) => {
      const next = new Set(now);
      for (const student of shown) {
        if (on) next.add(student.id);
        else next.delete(student.id);
      }
      return next;
    });
  }

  function toggle(id: string, on: boolean) {
    setTicked((now) => {
      const next = new Set(now);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function close() {
    setProblem(null);
    setGone(false);
    setTicked(new Set());
    setText("");
    onClose();
  }

  async function move() {
    if (moving || chosen.length === 0) return;
    setMoving(true);
    setProblem(null);
    setGone(false);
    const result = await moveStudents(
      chosen.map((student) => student.id),
      batch.id,
    );
    setMoving(false);
    if (result.ok) {
      for (const student of result.students) roster.put(student);
      close();
      return;
    }
    if (result.reason === "batch-gone") setGone(true);
    else setProblem(result.reason === "offline" ? "offline" : "failed");
    // Some students may have moved before a later request failed, and the batch may be gone: read again.
    if (result.reason !== "offline") roster.reload();
  }

  function backToBatches() {
    close();
    router.push(localeHref(locale, batchesPath));
  }

  if (gone) {
    return (
      <Sheet open={open} onClose={backToBatches} title={<span translate="no">{t("move.title", { name: batch.name })}</span>} closeLabel={t("move.cancel")}>
        <p role="alert" className="type-body font-semibold text-cloth wrap-anywhere">
          {t("move.gone")}
        </p>
        <div className="mt-5 pr-1.5 pb-1.5">
          <Button variant="record" full onClick={backToBatches}>
            {t("move.goneBack")}
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={<span translate="no">{t("move.title", { name: batch.name })}</span>} closeLabel={t("move.cancel")}>
      {others.length === 0 ? (
        <p className="type-body text-ink-soft">{t("move.none")}</p>
      ) : (
        <>
          <p className="type-body-sm text-ink-soft">{t("move.hint")}</p>
          <div className="mt-3">
            <Field
              label={t("move.searchLabel")}
              placeholder={t("move.searchPlaceholder")}
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              data-ph-no-capture=""
              data-sentry-mask=""
            />
          </div>
          {shown.length === 0 ? (
            <div className="mt-1 flex flex-col items-start gap-3">
              <p className="type-body text-ink-soft wrap-anywhere">{t("move.noMatch", { text: text.trim() })}</p>
              <Button variant="outline" onClick={() => setText("")}>
                {t("move.clearSearch")}
              </Button>
            </div>
          ) : (
            <>
              {/* Ticks or clears every student the search shows; its state is a word and the tick, as Check (17.3). */}
              <div className="mt-1 border-2 border-b-0 border-ink bg-slip px-3">
                <Check checked={allShownTicked} onChange={tickShown} onText={t("move.selected")} offText={t("move.notSelected")}>
                  <span className="type-body font-semibold wrap-anywhere">{t("move.selectAll", { n: shown.length })}</span>
                </Check>
              </div>
              <ul className="border-2 border-ink bg-slip px-3">
                {shown.map((student) => {
                  const from = batchName(student.batchId);
                  return (
                    <li key={student.id} className="border-b border-rule last:border-b-0">
                      <label className="flex min-h-15 items-center gap-3 py-2">
                        <input
                          type="checkbox"
                          checked={ticked.has(student.id)}
                          onChange={(event) => toggle(student.id, event.currentTarget.checked)}
                          className="size-6 shrink-0 accent-blue ring:ground-ring"
                        />
                        <span className="flex min-w-0 flex-1 flex-col items-start">
                          <span translate="no" className="type-name wrap-anywhere">
                            {student.name}
                          </span>
                          <span className="type-caption text-ink-soft wrap-anywhere">
                            {from === null ? t("move.noBatch") : <span translate="no">{t("move.inBatch", { name: from })}</span>}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
      <div className="mt-4">
        <WriteNotice problem={problem} failed={t("move.failed")} offline={form("offline")} />
      </div>
      {/* One Cancel only: the sheet's own close at the top (17.1). */}
      {others.length === 0 ? null : (
        <div className="mt-5 pr-1.5 pb-1.5">
          <Button variant="record" full busy={moving} busyLabel={t("move.confirm", { n: chosen.length })} disabled={chosen.length === 0} onClick={move}>
            {chosen.length === 0 ? t("move.confirmNone") : t("move.confirm", { n: chosen.length })}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
