// Spec R1-3, criteria 27, 28, 29, 34 and 53: the student data module against a small fake client.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFake } from "./db-fake.test-util";
import type { StudentFields } from "./students";

const fake = makeFake();
vi.mock("./supabase", () => ({ getClient: () => Promise.resolve(fake.client) }));

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  batch_id: null,
  name: "Ravi Kumar",
  parent_name: "Suresh Kumar",
  parent_phone: "+919845012345",
  parent_language: "kn",
  monthly_fee: 120000,
  opening_balance: 0,
  due_day: 5,
  active: true,
};

const fields: StudentFields = {
  batchId: null,
  name: "Ravi Kumar",
  parentName: null,
  parentPhone: null,
  parentLanguage: "kn",
  monthlyFee: 120000,
  openingBalance: 0,
  dueDay: 5,
};

const ID = row.id;
const onLine = (value: boolean) => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });

beforeEach(() => {
  fake.reset();
  onLine(true);
});

describe("listStudents", () => {
  it("reads named columns, never `*` and never pay_token, and turns rows into students", async () => {
    fake.answer({ data: [row, { ...row, id: "2", parent_language: "ta", batch_id: "b1", active: false }], error: null });
    const { listStudents, STUDENT_COLUMNS } = await import("./students");
    const list = await listStudents();
    expect(fake.calls[0]).toEqual({ op: "from", args: ["students"] });
    expect(fake.arg("select")).toBe(STUDENT_COLUMNS);
    expect(STUDENT_COLUMNS).not.toContain("*");
    expect(STUDENT_COLUMNS).not.toContain("pay_token");
    expect(STUDENT_COLUMNS).not.toContain("tutor_id");
    expect(list[0]).toEqual({
      id: ID,
      batchId: null,
      name: "Ravi Kumar",
      parentName: "Suresh Kumar",
      parentPhone: "+919845012345",
      parentLanguage: "kn",
      monthlyFee: 120000,
      openingBalance: 0,
      dueDay: 5,
      active: true,
    });
    // A language the app does not know is read as English; an archived student is read as archived.
    expect(list[1]).toMatchObject({ parentLanguage: "en", batchId: "b1", active: false });
  });

  it("is an empty list for no rows", async () => {
    fake.answer({ data: null, error: null });
    const { listStudents } = await import("./students");
    await expect(listStudents()).resolves.toEqual([]);
  });

  it("throws RosterLoadError, with the kind of failure, when it could not be read", async () => {
    const { listStudents, RosterLoadError } = await import("./students");
    fake.answer({ data: null, error: { code: "XX000" }, status: 503 });
    await expect(listStudents()).rejects.toMatchObject({ name: "RosterLoadError", kind: "failed" });
    fake.answer({ data: null, error: { code: "PGRST301" }, status: 401 });
    await expect(listStudents()).rejects.toMatchObject({ kind: "rejected" });
    fake.state.throwOnQuery = true;
    await expect(listStudents()).rejects.toBeInstanceOf(RosterLoadError);
  });
});

describe("createStudent (27, 28, 29)", () => {
  it("sends only the ten granted columns, with null for no parent name and no phone, and paise as integers", async () => {
    fake.answer({ data: row, error: null });
    const { createStudent } = await import("./students");
    const result = await createStudent(ID, fields);
    expect(result).toMatchObject({ ok: true, student: { id: ID, name: "Ravi Kumar" } });
    expect(fake.arg("insert")).toEqual({
      id: ID,
      batch_id: null,
      name: "Ravi Kumar",
      parent_name: null,
      parent_phone: null,
      parent_language: "kn",
      monthly_fee: 120000,
      opening_balance: 0,
      due_day: 5,
      active: true,
    });
    const body = fake.arg("insert") as Record<string, unknown>;
    for (const never of ["tutor_id", "pay_token", "created_at", "updated_at"]) expect(body).not.toHaveProperty(never);
    expect(Object.keys(body)).toHaveLength(10);
    expect(fake.ops()).toEqual(["from", "insert", "select", "single"]);
  });

  it("is not tried when the phone is offline", async () => {
    onLine(false);
    const { createStudent } = await import("./students");
    await expect(createStudent(ID, fields)).resolves.toEqual({ ok: false, reason: "offline" });
    expect(fake.calls).toEqual([]);
  });

  it("says failed for a server error and for a thrown network error", async () => {
    const { createStudent } = await import("./students");
    fake.answer({ data: null, error: { code: "XX000" } });
    await expect(createStudent(ID, fields)).resolves.toEqual({ ok: false, reason: "failed" });
    fake.state.throwOnQuery = true;
    await expect(createStudent(ID, fields)).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("says batch-gone when the batch's key fails (30)", async () => {
    fake.answer({ data: null, error: { code: "23503" } });
    const { createStudent } = await import("./students");
    await expect(createStudent(ID, { ...fields, batchId: "gone" })).resolves.toEqual({ ok: false, reason: "batch-gone" });
  });

  it("counts an id that already exists as saved: it reads the row back", async () => {
    fake.answer({ data: null, error: { code: "23505" } }, { data: row, error: null });
    const { createStudent } = await import("./students");
    const result = await createStudent(ID, fields);
    expect(result).toMatchObject({ ok: true, student: { id: ID } });
    expect(fake.ops()).toEqual(["from", "insert", "select", "single", "from", "select", "eq", "single"]);
    expect(fake.calls.find((c) => c.op === "eq")?.args).toEqual(["id", ID]);
  });

  it("says failed when the id exists but the row cannot be read back", async () => {
    fake.answer({ data: null, error: { code: "23505" } }, { data: null, error: { code: "XX000" } });
    const { createStudent } = await import("./students");
    await expect(createStudent(ID, fields)).resolves.toEqual({ ok: false, reason: "failed" });
  });
});

describe("updateStudent and setActive (34)", () => {
  it("sends only the columns named, ends in select().single(), and returns the row the database gave", async () => {
    fake.answer({ data: { ...row, monthly_fee: 150000, due_day: 10 }, error: null });
    const { updateStudent } = await import("./students");
    const result = await updateStudent(ID, { monthlyFee: 150000, dueDay: 10 });
    expect(fake.arg("update")).toEqual({ monthly_fee: 150000, due_day: 10 });
    expect(fake.calls.find((c) => c.op === "eq")?.args).toEqual(["id", ID]);
    expect(fake.ops()).toEqual(["from", "update", "eq", "select", "single"]);
    expect(result).toMatchObject({ ok: true, student: { monthlyFee: 150000, dueDay: 10 } });
  });

  it("can send null to clear a batch, a parent's name or a phone", async () => {
    fake.answer({ data: row, error: null });
    const { updateStudent } = await import("./students");
    await updateStudent(ID, { batchId: null, parentName: null, parentPhone: null });
    expect(fake.arg("update")).toEqual({ batch_id: null, parent_name: null, parent_phone: null });
  });

  it("drops anything that is not a granted column, even if it is smuggled in", async () => {
    fake.answer({ data: row, error: null });
    const { updateStudent } = await import("./students");
    await updateStudent(ID, { dueDay: 3, tutor_id: "someone", pay_token: "x", id: "other" } as never);
    expect(fake.arg("update")).toEqual({ due_day: 3 });
  });

  it("says missing when the update changed no row (PGRST116)", async () => {
    fake.answer({ data: null, error: { code: "PGRST116" } });
    const { updateStudent } = await import("./students");
    await expect(updateStudent(ID, { dueDay: 3 })).resolves.toEqual({ ok: false, reason: "missing" });
  });

  it("says batch-gone, failed and offline for those cases", async () => {
    const { updateStudent } = await import("./students");
    fake.answer({ data: null, error: { code: "23503" } });
    await expect(updateStudent(ID, { batchId: "gone" })).resolves.toEqual({ ok: false, reason: "batch-gone" });
    fake.answer({ data: null, error: { code: "42501" } });
    await expect(updateStudent(ID, { dueDay: 3 })).resolves.toEqual({ ok: false, reason: "failed" });
    onLine(false);
    fake.calls.length = 0;
    await expect(updateStudent(ID, { dueDay: 3 })).resolves.toEqual({ ok: false, reason: "offline" });
    expect(fake.calls).toEqual([]);
  });

  it("archives and restores by setting `active` and nothing else", async () => {
    fake.answer({ data: { ...row, active: false }, error: null });
    const { setActive } = await import("./students");
    await expect(setActive(ID, false)).resolves.toMatchObject({ ok: true, student: { active: false } });
    expect(fake.arg("update")).toEqual({ active: false });
    fake.calls.length = 0;
    fake.answer({ data: row, error: null });
    await setActive(ID, true);
    expect(fake.arg("update")).toEqual({ active: true });
  });
});

describe("moveStudents (44)", () => {
  it("updates only batch_id for the ids, in one call, and returns the rows", async () => {
    fake.answer({ data: [{ ...row, batch_id: "b1" }, { ...row, id: "2", batch_id: "b1" }], error: null });
    const { moveStudents } = await import("./students");
    const result = await moveStudents([ID, "2"], "b1");
    expect(fake.arg("update")).toEqual({ batch_id: "b1" });
    expect(fake.calls.find((c) => c.op === "in")?.args).toEqual(["id", [ID, "2"]]);
    expect(result.ok && result.students.map((s) => s.batchId)).toEqual(["b1", "b1"]);
  });

  it("sends nothing when no one is ticked, and says offline without a call", async () => {
    const { moveStudents } = await import("./students");
    await expect(moveStudents([], "b1")).resolves.toEqual({ ok: true, students: [] });
    expect(fake.calls).toEqual([]);
    onLine(false);
    await expect(moveStudents([ID], "b1")).resolves.toEqual({ ok: false, reason: "offline" });
    expect(fake.calls).toEqual([]);
  });

  it("says batch-gone when the batch was deleted", async () => {
    fake.answer({ data: null, error: { code: "23503" } });
    const { moveStudents } = await import("./students");
    await expect(moveStudents([ID], "gone")).resolves.toEqual({ ok: false, reason: "batch-gone" });
  });
});

describe("moveStudents in chunks (review)", () => {
  it("sends at most 100 ids per request", async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id${i}`);
    fake.answer(
      { data: ids.slice(0, 100).map((id) => ({ ...row, id })), error: null },
      { data: ids.slice(100, 200).map((id) => ({ ...row, id })), error: null },
      { data: ids.slice(200).map((id) => ({ ...row, id })), error: null },
    );
    const { moveStudents } = await import("./students");
    const result = await moveStudents(ids, "b1");
    const sent = fake.calls.filter((c) => c.op === "in").map((c) => (c.args[1] as string[]).length);
    expect(sent).toEqual([100, 100, 50]);
    expect(result.ok && result.students).toHaveLength(250);
  });

  it("is a failure when fewer rows come back than were asked for", async () => {
    fake.answer({ data: [{ ...row, id: "1" }], error: null });
    const { moveStudents } = await import("./students");
    await expect(moveStudents(["1", "2"], "b1")).resolves.toEqual({ ok: false, reason: "failed" });
  });
});
