"use client";

// One student in the list: number, name, parent's name, "₹1,200 on the 5th" and the batch (spec R1-3,
// criterion 5). The whole row is one link to the edit screen and nothing inside it is a control. It grows
// with long or translated text and never cuts a name.
import { useLocale, useTranslations } from "next-intl";
import { useSoftLink } from "@/components/app/use-soft-link";
import { withNode } from "@/components/app/with-node";
import type { Locale } from "@/config/locales";
import { localeHref, studentEditPath } from "@/config/routes";
import { formatRupees } from "@/lib/format";
import type { Student } from "@/lib/students";
import { ArchivedTag } from "./archived-tag";

export function editHref(locale: Locale, id: string): string {
  return `${localeHref(locale, studentEditPath)}?id=${encodeURIComponent(id)}`;
}

export function StudentRow({ student, number, batchName }: Readonly<{ student: Student; number?: number; batchName: string | null }>) {
  const t = useTranslations("students");
  const locale = useLocale() as Locale;
  const soft = useSoftLink();
  const href = editHref(locale, student.id);
  return (
    <li className="border-b border-rule">
      <a href={href} onClick={soft(href)} className="flex min-h-15 items-center gap-2.5 py-2 text-ink ring:ground-ring">
        {number === undefined ? null : (
          <span translate="no" className="type-amount-row min-w-6 shrink-0 text-ink-label">
            {String(number).padStart(2, "0")}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span translate="no" className="type-name wrap-anywhere">
            {student.name}
          </span>
          {student.parentName ? (
            <span translate="no" className="type-caption text-ink-soft wrap-anywhere">
              {student.parentName}
            </span>
          ) : null}
          <span className="type-caption text-ink-soft wrap-anywhere">
            {withNode(
              (amount) => t("meta", { amount, day: t("days.ordinal", { day: student.dueDay }) }),
              <span translate="no" className="type-amount-row">
                {formatRupees(student.monthlyFee)}
              </span>,
            )}
            {batchName ? (
              <>
                <span aria-hidden="true"> · </span>
                <span translate="no">{batchName}</span>
              </>
            ) : null}
          </span>
          {student.active ? null : <ArchivedTag />}
        </span>
      </a>
    </li>
  );
}
