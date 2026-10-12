// Spec R1-6, criterion 9: the dues reader against a small fake client.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeFake } from "./db-fake.test-util";

const fake = makeFake();
vi.mock("./supabase", () => ({ getClient: () => Promise.resolve(fake.client) }));

const raw = (n: number) => ({
  id: `id-${String(n).padStart(5, "0")}`,
  student_id: "S1",
  kind: "monthly",
  month: "2026-10-01",
  amount: 120000,
  amount_paid: 0,
  status: "due",
  due_date: "2026-10-05",
});
const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => raw(from + i));
const page = (data: unknown) => ({ data, error: null });

beforeEach(() => fake.reset());

describe("readMonth", () => {
  it("names its columns, never `*`, never tutor_id, and reads one month in a total order", async () => {
    fake.answer(page([raw(1)]));
    const { readMonth, DUE_COLUMNS } = await import("./dues");
    const list = await readMonth("2026-10-01");
    expect(list).toEqual([
      { id: "id-00001", studentId: "S1", kind: "monthly", month: "2026-10-01", amount: 120000, amountPaid: 0, status: "due", dueDate: "2026-10-05" },
    ]);
    expect(DUE_COLUMNS).toBe("id,student_id,kind,month,amount,amount_paid,status,due_date");
    expect(fake.arg("select")).toBe(DUE_COLUMNS);
    expect(JSON.stringify(fake.calls)).not.toMatch(/tutor_id|\*/);
    expect(fake.calls.filter((c) => c.op === "eq")[0].args).toEqual(["month", "2026-10-01"]);
    expect(fake.calls.filter((c) => c.op === "order").map((c) => c.args[0])).toEqual(["due_date", "id"]);
  });

  it("reads 2,350 rows in 3 requests, in order", async () => {
    fake.answer(page(rows(0, 1000)), page(rows(1000, 1000)), page(rows(2000, 350)));
    const { readMonth } = await import("./dues");
    const list = await readMonth("2026-10-01");
    expect(list).toHaveLength(2350);
    expect(list.map((d) => d.id)).toEqual(rows(0, 2350).map((d) => d.id));
    expect(fake.calls.filter((c) => c.op === "range").map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("costs one more request when a page holds exactly 1,000", async () => {
    fake.answer(page(rows(0, 1000)), page([]));
    const { readMonth } = await import("./dues");
    expect(await readMonth("2026-10-01")).toHaveLength(1000);
    expect(fake.calls.filter((c) => c.op === "range")).toHaveLength(2);
  });

  it("fails whole when any page fails, with the kind of failure", async () => {
    const { readMonth, DuesLoadError } = await import("./dues");
    fake.answer(page(rows(0, 1000)), { data: null, error: { code: "XX000" }, status: 500 });
    await expect(readMonth("2026-10-01")).rejects.toMatchObject({ name: "DuesLoadError", kind: "failed" });
    fake.answer({ data: null, error: { code: "PGRST301" }, status: 401 });
    await expect(readMonth("2026-10-01")).rejects.toMatchObject({ kind: "rejected" });
    fake.state.throwOnQuery = true;
    await expect(readMonth("2026-10-01")).rejects.toBeInstanceOf(DuesLoadError);
  });

  it.each([
    ["an unknown status", { status: "overdue" }],
    ["an unknown kind", { kind: "late-fee" }],
    ["a decimal amount", { amount: 1200.5 }],
    ["a negative amount", { amount: -5 }],
    ["more paid than owed", { amount_paid: 120001, status: "paid" }],
    ["a monthly due with no month", { month: null }],
    ["an opening due with a month", { kind: "opening" }],
    ["a bad date", { due_date: "05/10/2026" }],
  ])("refuses a row with %s rather than draw a wrong amount", async (_name, over) => {
    fake.answer(page([{ ...raw(1), ...over }]));
    const { readMonth } = await import("./dues");
    await expect(readMonth("2026-10-01")).rejects.toMatchObject({ name: "DuesLoadError" });
  });
});

describe("readUnpaid", () => {
  it("asks for everything not paid, and accepts an opening balance", async () => {
    fake.answer(page([{ ...raw(1), kind: "opening", month: null }]));
    const { readUnpaid } = await import("./dues");
    const list = await readUnpaid();
    expect(list[0]).toMatchObject({ kind: "opening", month: null });
    expect(fake.calls.find((c) => c.op === "neq")?.args).toEqual(["status", "paid"]);
  });
});

describe("readEarliestMonth", () => {
  it("is the first month with a monthly due, or null", async () => {
    const { readEarliestMonth } = await import("./dues");
    fake.answer(page([{ month: "2026-08-01" }]));
    expect(await readEarliestMonth()).toBe("2026-08-01");
    expect(fake.arg("select")).toBe("month");
    expect(fake.calls.find((c) => c.op === "not")?.args).toEqual(["month", "is", null]);
    expect(fake.calls.find((c) => c.op === "limit")?.args).toEqual([1]);
    fake.reset();
    fake.answer(page([]));
    expect(await readEarliestMonth()).toBeNull();
    fake.answer(page([{ month: "soon" }]));
    await expect(readEarliestMonth()).rejects.toMatchObject({ name: "DuesLoadError" });
  });
});

describe("ensureMyDues", () => {
  it("answers how many it made, with no argument", async () => {
    const { ensureMyDues } = await import("./dues");
    fake.answer(page(3));
    expect(await ensureMyDues()).toBe(3);
    expect(fake.calls[0]).toEqual({ op: "rpc", args: ["ensure_my_dues"] });
  });

  it("is 0 for an error, a word, zero or a throw, and never throws", async () => {
    const { ensureMyDues } = await import("./dues");
    fake.answer({ data: null, error: { code: "42501" } });
    expect(await ensureMyDues()).toBe(0);
    fake.answer(page("x"));
    expect(await ensureMyDues()).toBe(0);
    fake.answer(page(0));
    expect(await ensureMyDues()).toBe(0);
    fake.state.throwOnQuery = true;
    expect(await ensureMyDues()).toBe(0);
  });
});

describe("readDue", () => {
  it("reads one fee by id with the named columns, and null when there is none", async () => {
    fake.answer(page([raw(1)]));
    const { readDue, DUE_COLUMNS } = await import("./dues");
    expect((await readDue("id-00001"))?.id).toBe("id-00001");
    expect(fake.arg("select")).toBe(DUE_COLUMNS);
    expect(fake.calls.find((c) => c.op === "eq")?.args).toEqual(["id", "id-00001"]);
    fake.answer(page([]));
    expect(await readDue("nope")).toBeNull();
  });

  it("a failed read throws, and a row it cannot read throws", async () => {
    const { readDue } = await import("./dues");
    fake.answer({ data: null, error: { code: "500" } });
    await expect(readDue("x")).rejects.toMatchObject({ name: "DuesLoadError" });
    fake.answer(page([{ ...raw(1), amount: 12.5 }]));
    await expect(readDue("x")).rejects.toMatchObject({ name: "DuesLoadError" });
  });
});
