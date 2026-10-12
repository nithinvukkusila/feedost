// Spec R1-7, criteria 3, 6, 16, 38 and the plan's unit list: the payments module against a small fake client.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFake } from "./db-fake.test-util";

const fake = makeFake();
vi.mock("./supabase", () => ({ getClient: () => Promise.resolve(fake.client) }));

import { errorOf, PAYMENT_COLUMNS, PaymentError, paymentFromRow, readPaymentsOfDue, recordPayment, voidPayment } from "./payments";

const row = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  tutor_id: "t1",
  due_id: "d1",
  amount: 120000,
  method: "upi",
  paid_on: "2026-10-12",
  receipt_no: 7,
  receipt_token: "x".repeat(24),
  request_id: "r1",
  balance_after: 0,
  created_at: "2026-10-12T05:00:00.123456+00:00",
  voided_at: null,
  ...over,
});
const args = { dueId: "d1", amount: 120000, method: "upi" as const, paidOn: "2026-10-12", requestId: "r1" };
const ok = (data: unknown) => ({ data, error: null });
const fail = (message: string, extra: Record<string, unknown> = {}) => ({ data: null, error: { code: "P0001", message, details: null, ...extra } });

beforeEach(() => fake.reset());
afterEach(() => vi.unstubAllGlobals());

describe("recordPayment", () => {
  it("sends exactly the due, amount, method, date and request id to record_payment", async () => {
    fake.answer(ok(row()));
    const payment = await recordPayment(args);
    expect(fake.calls.filter((c) => c.op === "rpc")).toEqual([
      { op: "rpc", args: ["record_payment", { p_due: "d1", p_amount: 120000, p_method: "upi", p_paid_on: "2026-10-12", p_request_id: "r1" }] },
    ]);
    expect(payment).toEqual({ id: "p1", dueId: "d1", amount: 120000, method: "upi", paidOn: "2026-10-12", receiptNo: 7, balanceAfter: 0, createdAt: Date.parse("2026-10-12T05:00:00.123Z"), voidedAt: null });
    // Never a write to a table.
    expect(fake.calls.some((c) => c.op === "from" || c.op === "insert" || c.op === "update")).toBe(false);
  });

  it("sends the same request id again on a retry, and gets the same receipt", async () => {
    fake.answer({ data: null, error: { message: "TypeError: Failed to fetch" } }, ok(row()), ok(row()));
    await expect(recordPayment(args)).rejects.toMatchObject({ code: "failed" });
    const again = await recordPayment(args);
    expect(again.receiptNo).toBe(7);
    const sent = fake.calls.filter((c) => c.op === "rpc").map((c) => (c.args[1] as { p_request_id: string }).p_request_id);
    expect(sent).toEqual(["r1", "r1"]);
  });

  it("refuses what the database would refuse, without a request", async () => {
    for (const bad of [{ amount: 0 }, { amount: 99 }, { amount: 12.5 }, { amount: -100 }, { method: "bank" as never }, { method: "gateway" as never }]) {
      await expect(recordPayment({ ...args, ...bad })).rejects.toMatchObject({ code: "invalid_argument" });
    }
    expect(fake.calls).toEqual([]);
  });

  it("sends nothing when the phone is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await expect(recordPayment(args)).rejects.toMatchObject({ code: "offline" });
    expect(fake.calls).toEqual([]);
  });

  it("a thrown network error is `failed`", async () => {
    fake.state.throwOnQuery = true;
    await expect(recordPayment(args)).rejects.toMatchObject({ code: "failed" });
  });

  it("an answer that is not a payment is `failed`, not a wrong amount", async () => {
    for (const bad of [null, {}, row({ amount: 12.5 }), row({ amount: 0 }), row({ method: "bank" }), row({ paid_on: "12/10/2026" }), row({ receipt_no: 0 }), row({ balance_after: -1 }), row({ created_at: "nope" })]) {
      fake.answer(ok(bad));
      await expect(recordPayment(args)).rejects.toMatchObject({ code: "failed" });
    }
  });
});

describe("the database's words", () => {
  it.each(["due_not_found", "student_archived", "already_paid", "date_out_of_range", "request_reused", "invalid_argument"])("%s", async (word) => {
    fake.answer(fail(word));
    await expect(recordPayment(args)).rejects.toMatchObject({ code: word, remaining: null });
  });

  it("amount_over_remaining carries the paise left", async () => {
    fake.answer(fail("amount_over_remaining", { details: "70000" }));
    const error = await recordPayment(args).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PaymentError);
    expect(error).toMatchObject({ code: "amount_over_remaining", remaining: 70000 });
  });

  it("a missing or odd detail gives no amount", () => {
    expect(errorOf({ message: "amount_over_remaining", details: null }).remaining).toBeNull();
    expect(errorOf({ message: "amount_over_remaining", details: "7e4" }).remaining).toBeNull();
  });

  it("no session is not_signed_in; an unknown word is failed, never shown", () => {
    expect(errorOf({ code: "42501", message: "permission denied for function record_payment" }).code).toBe("not_signed_in");
    expect(errorOf({ message: "not_signed_in", code: "42501" }).code).toBe("not_signed_in");
    expect(errorOf({ code: "XX000", message: "something internal" }).code).toBe("failed");
    expect(errorOf({}).code).toBe("failed");
  });
});

describe("voidPayment", () => {
  it("sends only the payment id and returns the voided payment", async () => {
    fake.answer(ok(row({ voided_at: "2026-10-12T05:00:30+00:00" })));
    const payment = await voidPayment("p1");
    expect(fake.calls.filter((c) => c.op === "rpc")).toEqual([{ op: "rpc", args: ["void_payment", { p_payment: "p1" }] }]);
    expect(payment.voidedAt).toBe(Date.parse("2026-10-12T05:00:30Z"));
  });

  it("maps its words", async () => {
    for (const word of ["undo_window_over", "already_voided", "payment_not_found"]) {
      fake.answer(fail(word));
      await expect(voidPayment("p1")).rejects.toMatchObject({ code: word });
    }
  });
});

describe("readPaymentsOfDue", () => {
  it("names its columns, never `*`, never tutor_id, request_id or the token; newest first", async () => {
    fake.answer(ok([row({ id: "p2", receipt_no: 8 }), row()]));
    const list = await readPaymentsOfDue("d1");
    expect(list.map((p) => p.receiptNo)).toEqual([8, 7]);
    expect(fake.arg("from")).toBe("payments");
    expect(fake.arg("select")).toBe(PAYMENT_COLUMNS);
    expect(PAYMENT_COLUMNS).not.toMatch(/\*|tutor_id|request_id|receipt_token/);
    expect(fake.calls.find((c) => c.op === "eq")?.args).toEqual(["due_id", "d1"]);
    expect(fake.calls.find((c) => c.op === "order")?.args).toEqual(["receipt_no", { ascending: false }]);
  });

  it("a read error or a row it cannot understand fails the whole read", async () => {
    fake.answer({ data: null, error: { code: "500" } });
    await expect(readPaymentsOfDue("d1")).rejects.toMatchObject({ code: "failed" });
    fake.answer(ok([row({ method: "bank" })]));
    await expect(readPaymentsOfDue("d1")).rejects.toMatchObject({ code: "failed" });
  });
});

describe("paymentFromRow", () => {
  it("reads a voided payment's time", () => {
    expect(paymentFromRow(row({ voided_at: "2026-10-12T06:00:00Z" })).voidedAt).toBe(Date.parse("2026-10-12T06:00:00Z"));
    expect(() => paymentFromRow(row({ voided_at: "garbage" }))).toThrow(PaymentError);
  });
});

describe("only this file touches payments", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  }
  const files = walk(join(process.cwd(), "src")).filter((p) => /\.(ts|tsx)$/.test(p) && !/\.(test|spec)\./.test(p) && !p.endsWith("payments.ts"));
  it("no other source file calls the two functions or reads the table", () => {
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/record_payment|void_payment|from\(\s*["'`]payments["'`]/);
    }
  });
});
