"use client";

// The folded list of archived students at the foot of the list (spec R1-3, criterion 9): a link-like
// button "Archived students (2)" that shows or hides them, each marked with the word "Archived".
import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { Batch } from "@/lib/batches";
import { sortStudents } from "@/lib/student-list";
import type { Student } from "@/lib/students";
import { StudentRow } from "./student-row";

export function ArchivedList({ students, batches }: Readonly<{ students: readonly Student[]; batches: readonly Batch[] }>) {
  const t = useTranslations("students");
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (students.length === 0) return null;
  const names = new Map(batches.map((batch) => [batch.id, batch.name]));
  return (
    <section className="mt-2 px-5 pb-4">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((now) => !now)}
        className="type-control-sm flex min-h-tap items-center py-2 text-left text-ink underline ring:ground-ring"
      >
        {t("archivedLink", { n: students.length })}
      </button>
      <ul id={listId} hidden={!open} className="border-t-2 border-ink bg-slip px-3">
        {sortStudents(students).map((student, index) => (
          <StudentRow key={student.id} student={student} number={index + 1} batchName={student.batchId ? (names.get(student.batchId) ?? null) : null} />
        ))}
      </ul>
    </section>
  );
}
