"use client";

// The batch filter (spec R1-3, criterion 8 and decision 16): "All 23", each batch with its count, and
// "No batch 3" when some students have none. Up to three batches are folder tabs joined to the list
// below; more than three would not fit in 360px, so they are one select field. Controlled; it never
// loads anything. Written once for the dues board (R1-6) to reuse.
import { useTranslations } from "next-intl";
import { SelectField } from "@/components/ui/select-field";
import { Tabs, tabId, type TabItem } from "@/components/ui/tabs";
import type { Batch } from "@/lib/batches";
import type { BatchCounts, BatchFilterValue } from "@/lib/student-list";

/** The most batches that still draw as tabs. */
export const MAX_TAB_BATCHES = 3;

export function batchFilterUsesTabs(batches: readonly Batch[]): boolean {
  return batches.length <= MAX_TAB_BATCHES;
}

/** The filter to show: one that names a batch that is gone, or "No batch" when nobody is without one, is "All". */
export function effectiveFilter(value: BatchFilterValue, batches: readonly Batch[], counts: BatchCounts): BatchFilterValue {
  if (value === "all") return "all";
  if (value === "none") return counts.none > 0 ? "none" : "all";
  return batches.some((batch) => batch.id === value) ? value : "all";
}

export type BatchFilterProps = {
  batches: readonly Batch[];
  counts: BatchCounts;
  value: BatchFilterValue;
  onChange: (value: BatchFilterValue) => void;
  /** The id of the panel the tabs control (the screen gives its slip this id). Used when the filter is drawn as tabs. */
  panelId?: string;
  /** `auto` (the default): tabs for up to three batches, a select for more. `select`: always the select, for a screen with tabs of its own (the dues board). */
  variant?: "auto" | "select";
};

export function BatchFilter({ batches, counts, value, onChange, panelId = "batch-filter-panel", variant = "auto" }: Readonly<BatchFilterProps>) {
  const t = useTranslations("students");
  const current = effectiveFilter(value, batches, counts);

  if (batches.length === 0) return null;

  if (variant === "auto" && batchFilterUsesTabs(batches)) {
    const tabs: TabItem[] = [
      { id: "all", label: t("filterAll", { n: counts.all }) },
      ...batches.map((batch) => ({
        id: batch.id,
        label: <span translate="no">{batch.name}</span>,
        count: <span translate="no">{counts.byBatch[batch.id] ?? 0}</span>,
      })),
      ...(counts.none > 0 ? [{ id: "none", label: t("filterNone", { n: counts.none }) }] : []),
    ];
    return <Tabs tabs={tabs} value={current} onChange={onChange} label={t("filterLabel")} panelId={panelId} />;
  }

  const options = [
    { value: "all", label: t("filterAll", { n: counts.all }) },
    ...batches.map((batch) => ({ value: batch.id, label: `${batch.name} ${counts.byBatch[batch.id] ?? 0}` })),
    ...(counts.none > 0 ? [{ value: "none", label: t("filterNone", { n: counts.none }) }] : []),
  ];
  return (
    <div className="px-5">
      <SelectField label={t("filterLabel")} value={current} onChange={onChange} options={options} />
    </div>
  );
}

/** The attributes the panel under the tabs carries; none when the filter is a select. */
export function filterPanelProps(batches: readonly Batch[], panelId: string, current: BatchFilterValue) {
  if (batches.length === 0 || !batchFilterUsesTabs(batches)) return {};
  return { id: panelId, role: "tabpanel", "aria-labelledby": tabId(panelId, current) };
}
