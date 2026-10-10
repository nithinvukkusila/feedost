// The tutor's batches: read them, add one, rename, delete. The one place that talks to the `batches`
// table; direct and online-only like students.ts (spec R1-3, decision 4). Only `name` and `timings`
// are ever sent (and `id` on an insert); `tutor_id` comes from the database default.
import { getClient } from "./supabase";
import { classifyLoadFailure } from "./tutor";
import { isOffline, RosterLoadError } from "./students";

export type Batch = { id: string; name: string; timings: string | null };

type Row = { id: string; name: string; timings: string | null };

export const BATCH_COLUMNS = "id,name,timings";

const fromRow = (row: Row): Batch => ({ id: row.id, name: row.name, timings: row.timings });

/** Every batch of the signed-in tutor. */
export async function listBatches(): Promise<Batch[]> {
  let result;
  try {
    const client = await getClient();
    result = await client.from("batches").select(BATCH_COLUMNS);
  } catch {
    throw new RosterLoadError();
  }
  if (result.error) throw new RosterLoadError(classifyLoadFailure({ status: result.status, code: result.error.code }));
  return ((result.data as Row[] | null) ?? []).map(fromRow);
}

/** `name-taken`: another batch has this name, in any letter case (the database's unique index). */
export type BatchFailure = "failed" | "offline" | "missing" | "name-taken";
export type BatchResult = { ok: true; batch: Batch } | { ok: false; reason: BatchFailure };
export type DeleteResult = { ok: true } | { ok: false; reason: BatchFailure };

const NO_ROW = "PGRST116";
const DUPLICATE = "23505";
const NAME_INDEX = "batches_tutor_id_lower_name_key";

type Failure = { code?: string; message?: string; details?: string };

function failureOf(error: Failure): BatchFailure {
  if (error.code === NO_ROW) return "missing";
  if (error.code === DUPLICATE && `${error.message ?? ""} ${error.details ?? ""}`.includes(NAME_INDEX)) return "name-taken";
  return "failed";
}

/** Adds a batch. `id` is made by the screen once per fill; an id that already exists is read back and counts as saved. */
export async function createBatch(batch: Batch): Promise<BatchResult> {
  if (isOffline()) return { ok: false, reason: "offline" };
  try {
    const client = await getClient();
    const { data, error } = await client
      .from("batches")
      .insert({ id: batch.id, name: batch.name, timings: batch.timings })
      .select(BATCH_COLUMNS)
      .single<Row>();
    if (!error) return { ok: true, batch: fromRow(data) };
    if (error.code === DUPLICATE) {
      // Either this very id is already saved (a retry after an answer was lost), or the name belongs to another batch.
      const saved = await readOne(batch.id);
      if (saved.ok) return saved;
    }
    return { ok: false, reason: failureOf(error) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

async function readOne(id: string): Promise<BatchResult> {
  try {
    const client = await getClient();
    const { data, error } = await client.from("batches").select(BATCH_COLUMNS).eq("id", id).single<Row>();
    if (error) return { ok: false, reason: failureOf(error) };
    return { ok: true, batch: fromRow(data) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Changes the name and the timings. */
export async function updateBatch(id: string, change: { name: string; timings: string | null }): Promise<BatchResult> {
  if (isOffline()) return { ok: false, reason: "offline" };
  try {
    const client = await getClient();
    const { data, error } = await client
      .from("batches")
      .update({ name: change.name, timings: change.timings })
      .eq("id", id)
      .select(BATCH_COLUMNS)
      .single<Row>();
    if (error) return { ok: false, reason: failureOf(error) };
    return { ok: true, batch: fromRow(data) };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Deletes a batch for good. Its students stay, with no batch (the database nulls their `batch_id`). */
export async function deleteBatch(id: string): Promise<DeleteResult> {
  if (isOffline()) return { ok: false, reason: "offline" };
  try {
    const client = await getClient();
    // `.select()` so a delete that matched no row (already gone elsewhere) can be told from one that worked: both leave the batch gone.
    const { error } = await client.from("batches").delete().eq("id", id).select("id");
    if (error) return { ok: false, reason: failureOf(error) };
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
