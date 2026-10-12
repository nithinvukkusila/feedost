// Spec R1-3, criteria 40, 41 and 46: the batch data module against a small fake client.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFake } from "./db-fake.test-util";

const fake = makeFake();
vi.mock("./supabase", () => ({ getClient: () => Promise.resolve(fake.client) }));

const ID = "22222222-2222-4222-8222-222222222222";
const row = { id: ID, name: "Class 10 Maths", timings: "Mon, Wed 5 pm" };
const onLine = (value: boolean) => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
const taken = { code: "23505", message: 'duplicate key value violates unique constraint "batches_tutor_id_lower_name_key"' };

beforeEach(() => {
  fake.reset();
  onLine(true);
});

describe("listBatches", () => {
  it("reads id, name and timings", async () => {
    fake.answer({ data: [row], error: null });
    const { listBatches } = await import("./batches");
    await expect(listBatches()).resolves.toEqual([row]);
    expect(fake.calls[0]).toEqual({ op: "from", args: ["batches"] });
    expect(fake.arg("select")).toBe("id,name,timings");
  });

  it("throws RosterLoadError when it could not be read", async () => {
    fake.answer({ data: null, error: { code: "XX000" }, status: 500 });
    const { listBatches } = await import("./batches");
    await expect(listBatches()).rejects.toMatchObject({ name: "RosterLoadError", kind: "failed" });
  });
});

describe("createBatch", () => {
  it("sends id, name and timings only, never tutor_id", async () => {
    fake.answer({ data: row, error: null });
    const { createBatch } = await import("./batches");
    await expect(createBatch(row)).resolves.toEqual({ ok: true, batch: row });
    expect(fake.arg("insert")).toEqual({ id: ID, name: "Class 10 Maths", timings: "Mon, Wed 5 pm" });
    expect(fake.ops()).toEqual(["from", "insert", "select", "single"]);
  });

  it("says name-taken when another batch has the name (the unique index on the lower-case name)", async () => {
    fake.answer({ data: null, error: taken }, { data: null, error: { code: "PGRST116" } });
    const { createBatch } = await import("./batches");
    await expect(createBatch(row)).resolves.toEqual({ ok: false, reason: "name-taken" });
  });

  it("counts an id that already exists as saved, even when the name index answers first", async () => {
    fake.answer({ data: null, error: taken }, { data: row, error: null });
    const { createBatch } = await import("./batches");
    await expect(createBatch(row)).resolves.toEqual({ ok: true, batch: row });
    fake.answer({ data: null, error: { code: "23505", message: 'duplicate key value violates unique constraint "batches_pkey"' } }, { data: row, error: null });
    await expect(createBatch(row)).resolves.toEqual({ ok: true, batch: row });
  });

  it("says failed for a server error, a thrown error, and offline without a call", async () => {
    const { createBatch } = await import("./batches");
    fake.answer({ data: null, error: { code: "XX000" } });
    await expect(createBatch(row)).resolves.toEqual({ ok: false, reason: "failed" });
    fake.state.throwOnQuery = true;
    await expect(createBatch(row)).resolves.toEqual({ ok: false, reason: "failed" });
    fake.reset();
    onLine(false);
    await expect(createBatch(row)).resolves.toEqual({ ok: false, reason: "offline" });
    expect(fake.calls).toEqual([]);
  });
});

describe("updateBatch", () => {
  it("sends name and timings only and ends in select().single()", async () => {
    fake.answer({ data: { ...row, name: "Class 10 Maths A" }, error: null });
    const { updateBatch } = await import("./batches");
    const result = await updateBatch(ID, { name: "Class 10 Maths A", timings: null });
    expect(fake.arg("update")).toEqual({ name: "Class 10 Maths A", timings: null });
    expect(fake.ops()).toEqual(["from", "update", "eq", "select", "single"]);
    expect(result).toMatchObject({ ok: true, batch: { name: "Class 10 Maths A" } });
  });

  it("maps name-taken, missing and failed", async () => {
    const { updateBatch } = await import("./batches");
    fake.answer({ data: null, error: taken });
    await expect(updateBatch(ID, { name: "x", timings: null })).resolves.toEqual({ ok: false, reason: "name-taken" });
    fake.answer({ data: null, error: { code: "PGRST116" } });
    await expect(updateBatch(ID, { name: "x", timings: null })).resolves.toEqual({ ok: false, reason: "missing" });
    fake.answer({ data: null, error: { code: "XX000" } });
    await expect(updateBatch(ID, { name: "x", timings: null })).resolves.toEqual({ ok: false, reason: "failed" });
  });
});

describe("deleteBatch", () => {
  it("deletes by id and says ok", async () => {
    fake.answer({ data: [{ id: ID }], error: null });
    const { deleteBatch } = await import("./batches");
    await expect(deleteBatch(ID)).resolves.toEqual({ ok: true });
    expect(fake.ops()).toEqual(["from", "delete", "eq", "select"]);
    expect(fake.calls.find((c) => c.op === "eq")?.args).toEqual(["id", ID]);
  });

  it("counts a batch already gone elsewhere as deleted, and reports failure and offline", async () => {
    const { deleteBatch } = await import("./batches");
    fake.answer({ data: [], error: null });
    await expect(deleteBatch(ID)).resolves.toEqual({ ok: true });
    fake.answer({ data: null, error: { code: "XX000" } });
    await expect(deleteBatch(ID)).resolves.toEqual({ ok: false, reason: "failed" });
    onLine(false);
    await expect(deleteBatch(ID)).resolves.toEqual({ ok: false, reason: "offline" });
  });
});
