// Checks the batch form (spec R1-3, criteria 40 and 41). Pure: no React, no network.
import type { Batch } from "./batches";
import { characters, tidy } from "./profile";

export const BATCH_NAME_MAX = 60;
export const TIMINGS_MAX = 100;

export type BatchField = "name" | "timings";
/** Keys under `batches.state` (the tag beside the label) and `batches.err` (the sentence beneath). */
export type BatchStateKey = "missing" | "tooLong" | "nameTaken";
export type BatchErrKey = "nameMissing" | "nameLong" | "nameTaken" | "timingsLong";
export type BatchFieldError = { tag: BatchStateKey; message: BatchErrKey };
export type BatchErrors = Partial<Record<BatchField, BatchFieldError>>;

export type BatchCheck = { ok: true; value: { name: string; timings: string | null } } | { ok: false; errors: BatchErrors };

/** Same name in any letter case. */
export function nameTaken(batches: readonly Batch[], name: string, exceptId?: string): boolean {
  const wanted = name.toLowerCase();
  return batches.some((batch) => batch.id !== exceptId && batch.name.toLowerCase() === wanted);
}

/**
 * Name: trimmed, runs of spaces made one, 1 to 60 characters, and not another batch's name in any letter
 * case. Timings: optional, trimmed, at most 100 characters; empty is saved as no timings. `exceptId` leaves
 * out the batch being renamed.
 */
export function checkBatch(draft: { name: string; timings: string }, batches: readonly Batch[], exceptId?: string): BatchCheck {
  const errors: BatchErrors = {};
  const name = tidy(draft.name);
  if (name === "") errors.name = { tag: "missing", message: "nameMissing" };
  else if (characters(name) > BATCH_NAME_MAX) errors.name = { tag: "tooLong", message: "nameLong" };
  else if (nameTaken(batches, name, exceptId)) errors.name = { tag: "nameTaken", message: "nameTaken" };

  const timings = draft.timings.trim();
  if (characters(timings) > TIMINGS_MAX) errors.timings = { tag: "tooLong", message: "timingsLong" };

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { name, timings: timings === "" ? null : timings } };
}
