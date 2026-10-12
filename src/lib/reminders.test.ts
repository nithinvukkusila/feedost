// Spec R1-8, criteria 24, 28 and 29 (client side): the reminders module against a small fake client.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFake } from "./db-fake.test-util";

const fake = makeFake();
vi.mock("./supabase", () => ({ getClient: () => Promise.resolve(fake.client) }));

import { errorOf, lastFromRow, ReminderError, readLastReminders, recordReminder } from "./reminders";

const args = { dueId: "d1", template: "polite:hi:month", requestId: "r1" };
const ok = (data: unknown) => ({ data, error: null });
const fail = (message: string, code = "P0001") => ({ data: null, error: { code, message } });

beforeEach(() => fake.reset());
afterEach(() => vi.unstubAllGlobals());

describe("recordReminder", () => {
  it("sends only the fee id, the template tag and the request id, and never writes to a table", async () => {
    fake.answer(ok("2026-10-12T05:00:00.123456+00:00"));
    const at = await recordReminder(args);
    expect(at).toBe(Date.parse("2026-10-12T05:00:00.123Z"));
    expect(fake.calls.filter((c) => c.op === "rpc")).toEqual([
      { op: "rpc", args: ["record_reminder", { p_due: "d1", p_template: "polite:hi:month", p_request_id: "r1" }] },
    ]);
    expect(fake.calls.some((c) => c.op === "from" || c.op === "insert" || c.op === "update")).toBe(false);
  });

  it("sends the same request id again on a retry", async () => {
    fake.answer({ data: null, error: { message: "TypeError: Failed to fetch" } }, ok("2026-10-12T05:00:00Z"));
    await expect(recordReminder(args)).rejects.toMatchObject({ code: "failed" });
    await recordReminder(args);
    const sent = fake.calls.filter((c) => c.op === "rpc").map((c) => (c.args[1] as { p_request_id: string }).p_request_id);
    expect(sent).toEqual(["r1", "r1"]);
  });

  it("refuses a tag the database would refuse, without a request", async () => {
    for (const template of ["", "polite", "rude:en:month", "polite:fr:month", "polite:en:other", "Hello Ravi's parent"]) {
      await expect(recordReminder({ ...args, template })).rejects.toMatchObject({ code: "invalid_argument" });
    }
    expect(fake.calls).toEqual([]);
  });

  it("sends nothing when the phone is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await expect(recordReminder(args)).rejects.toMatchObject({ code: "offline" });
    expect(fake.calls).toEqual([]);
  });

  it("maps a thrown network error and each of the database's words", async () => {
    fake.state.throwOnQuery = true;
    await expect(recordReminder(args)).rejects.toMatchObject({ code: "failed" });
    fake.reset();
    for (const word of ["invalid_argument", "due_not_found", "already_paid", "student_archived", "no_phone"]) {
      fake.answer(fail(word));
      await expect(recordReminder(args)).rejects.toMatchObject({ code: word });
    }
    fake.answer(fail("permission denied", "42501"));
    await expect(recordReminder(args)).rejects.toMatchObject({ code: "not_signed_in" });
    fake.answer(fail("something odd", "XX000"));
    await expect(recordReminder(args)).rejects.toMatchObject({ code: "failed" });
  });

  it("fails on an answer that is not a time", async () => {
    fake.answer(ok(null));
    await expect(recordReminder(args)).rejects.toMatchObject({ code: "failed" });
    fake.answer(ok("yesterday"));
    await expect(recordReminder(args)).rejects.toMatchObject({ code: "failed" });
  });
});

describe("readLastReminders", () => {
  it("reads the rows by fee id with one function call and no table read", async () => {
    fake.answer(
      ok([
        { due_id: "d1", last_sent_at: "2026-10-12T05:00:00+00:00", times: 2 },
        { due_id: "d2", last_sent_at: "2026-10-01T05:00:00+00:00", times: 1 },
      ]),
    );
    expect(await readLastReminders()).toEqual({
      d1: { dueId: "d1", lastAt: Date.parse("2026-10-12T05:00:00Z"), times: 2 },
      d2: { dueId: "d2", lastAt: Date.parse("2026-10-01T05:00:00Z"), times: 1 },
    });
    expect(fake.calls).toEqual([{ op: "rpc", args: ["last_reminders"] }]);
  });

  it("is empty for no rows or null", async () => {
    fake.answer(ok([]));
    expect(await readLastReminders()).toEqual({});
    fake.answer(ok(null));
    expect(await readLastReminders()).toEqual({});
  });

  it("fails whole on a row that cannot be right, offline, and on an error", async () => {
    for (const bad of [{ due_id: 7, last_sent_at: "2026-10-12T05:00:00Z", times: 1 }, { due_id: "d", last_sent_at: "no", times: 1 }, { due_id: "d", last_sent_at: "2026-10-12T05:00:00Z", times: 0 }, { due_id: "d", last_sent_at: "2026-10-12T05:00:00Z", times: 1.5 }, null]) {
      fake.answer(ok([{ due_id: "ok", last_sent_at: "2026-10-12T05:00:00Z", times: 1 }, bad]));
      await expect(readLastReminders()).rejects.toMatchObject({ code: "failed" });
    }
    fake.answer(fail("boom", "XX000"));
    await expect(readLastReminders()).rejects.toBeInstanceOf(ReminderError);
    vi.stubGlobal("navigator", { onLine: false });
    await expect(readLastReminders()).rejects.toMatchObject({ code: "offline" });
  });
});

describe("parsing", () => {
  it("lastFromRow and errorOf", () => {
    expect(lastFromRow({ due_id: "d", last_sent_at: "2026-10-12T05:00:00Z", times: 3 }).times).toBe(3);
    expect(errorOf({ message: "no_phone" }).code).toBe("no_phone");
    expect(errorOf({}).code).toBe("failed");
  });
});
