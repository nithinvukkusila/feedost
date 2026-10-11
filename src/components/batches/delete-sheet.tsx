"use client";

// The confirm sheet for deleting a batch (spec R1-3, criterion 45): says that the students stay, then a
// black "Delete batch" and an outline "Cancel". A failure keeps the sheet open and says nothing was deleted.
import { useTranslations } from "next-intl";
import { useState } from "react";
import { WriteNotice, type WriteProblem } from "@/components/app/write-notice";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { deleteBatch, type Batch } from "@/lib/batches";

export function DeleteSheet({
  batch,
  studentCount,
  open,
  onClose,
  onDeleted,
}: Readonly<{ batch: Batch; studentCount: number; open: boolean; onClose: () => void; onDeleted: () => void }>) {
  const t = useTranslations("batches");
  const form = useTranslations("students.form");
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<WriteProblem>(null);

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setProblem(null);
    const result = await deleteBatch(batch.id);
    if (result.ok) {
      onDeleted();
      return;
    }
    setDeleting(false);
    setProblem(result.reason === "offline" ? "offline" : "failed");
  }

  function close() {
    setProblem(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={close} title={<span translate="no">{t("delete.title", { name: batch.name })}</span>} closeLabel={t("delete.cancel")}>
      <p className="type-body text-ink-soft">{t("delete.body", { n: studentCount })}</p>
      <div className="mt-4">
        <WriteNotice problem={problem} failed={t("saveFailed")} offline={form("offline")} />
      </div>
      <div className="mt-5 flex flex-col gap-4 pr-1.5 pb-1.5">
        <Button variant="record" full busy={deleting} busyLabel={t("delete.confirm")} onClick={confirm}>
          {t("delete.confirm")}
        </Button>
        <Button variant="outline" full onClick={close}>
          {t("delete.cancel")}
        </Button>
      </div>
    </Sheet>
  );
}
