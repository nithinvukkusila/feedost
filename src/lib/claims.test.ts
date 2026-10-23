// Spec R1-10, criterion 27 and the plan's unit list: the claims module against a small fake client.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeFake } from "./db-fake.test-util";

const fake = makeFake();
vi.mock("./supabase", () => ({ getClient: () => Promise.resolve(fake.client) }));

import { CLAIM_COLUMNS, ClaimError, claimFromRow, confirmClaim, countPendingClaims, errorOf, readHandledClaims, readPendingClaims, rejectClaim } from "./claims";

const row = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  student_id: "s1",
  due_id: "d1",
  amount: 120000,
  fee_count: 1,
  upi_ref: "628104739915",
  screenshot_path: null,
  status: "pending",
  created_at: "2026-10-12T05:00:00.123456+00:00",
  handled_at: null,
  confirmed_receipt_from: null,
  confirmed_receipt_count: null,
  ...over,
});
const confirmed = (over: Record<string, unknown> = {}) => row({ status: "confirmed", handled_at: "2026-10-12T06:00:00+00:00", confirmed_receipt_from: 214, confirmed_receipt_count: 2, ...over });
const ok = (data: unknown) => ({ data, error: null });
const fail = (message: string, extra: Record<string, unknown> = {}) => ({ data: null, error: { code: "P0001", message, ...extra } });

beforeEach(() => fake.reset());
afterEach(() => vi.unstubAllGlobals());

describe("reads", () => {
  it("asks for named columns only: never *, tutor_id or confirm_request_id", () => {
    expect(CLAIM_COLUMNS.split(",")).toEqual(["id", "student_id", "due_id", "amount", "fee_count", "upi_ref", "screenshot_path", "status", "created_at", "handled_at", "confirmed_receipt_from", "confirmed_receipt_count"]);
    expect(CLAIM_COLUMNS).not.toMatch(/\*|tutor_id|request_id/);
  });

  it("reads the pending claims newest first", async () => {
    fake.answer(ok([row()]));
    const claims = await readPendingClaims();
    expect(claims).toEqual([
      { id: "c1", studentId: "s1", dueId: "d1", amount: 120000, feeCount: 1, upiRef: "628104739915", screenshotPath: null, status: "pending", createdAt: Date.parse("2026-10-12T05:00:00.123Z"), handledAt: null, receiptFrom: null, receiptCount: null },
    ]);
    expect(fake.calls.map((c) => [c.op, ...c.args])).toEqual([
      ["from", "payment_claims"],
      ["select", CLAIM_COLUMNS],
      ["eq", "status", "pending"],
      ["order", "created_at", { ascending: false }],
    ]);
  });

  it("reads the last 20 handled claims, newest handled first", async () => {
    fake.answer(ok([confirmed()]));
    const [claim] = await readHandledClaims();
    expect(claim).toMatchObject({ status: "confirmed", receiptFrom: 214, receiptCount: 2 });
    expect(fake.calls.map((c) => [c.op, ...c.args])).toEqual([
      ["from", "payment_claims"],
      ["select", CLAIM_COLUMNS],
      ["in", "status", ["confirmed", "rejected"]],
      ["order", "handled_at", { ascending: false }],
      ["limit", 20],
    ]);
  });

  it("counts without downloading a row (a head request with an exact count)", async () => {
    fake.answer({ data: null, error: null, count: 3 });
    expect(await countPendingClaims()).toBe(3);
    expect(fake.calls.map((c) => [c.op, ...c.args])).toEqual([
      ["from", "payment_claims"],
      ["select", "id", { count: "exact", head: true }],
      ["eq", "status", "pending"],
    ]);
  });

  it("never invents a count: an error, a missing or an odd number is a failure", async () => {
    for (const bad of [{ data: null, error: { code: "500" }, count: 4 }, { data: null, error: null, count: null }, { data: null, error: null, count: -1 }, { data: null, error: null, count: 1.5 }]) {
      fake.reset();
      fake.answer(bad);
      await expect(countPendingClaims()).rejects.toMatchObject({ code: "failed" });
    }
    fake.reset();
    fake.state.throwOnQuery = true;
    await expect(countPendingClaims()).rejects.toMatchObject({ code: "failed" });
  });

  it("a failed read, or a row it does not understand, fails the whole read", async () => {
    fake.answer({ data: null, error: { code: "500" } });
    await expect(readPendingClaims()).rejects.toBeInstanceOf(ClaimError);
    fake.reset();
    fake.answer(ok([row(), row({ amount: 12.5 })]));
    await expect(readPendingClaims()).rejects.toMatchObject({ code: "failed" });
  });
});

describe("claimFromRow", () => {
  it("accepts a screenshot-only claim", () => {
    expect(claimFromRow(row({ upi_ref: null, screenshot_path: "t/f.jpg" }))).toMatchObject({ upiRef: null, screenshotPath: "t/f.jpg" });
  });

  it.each([
    ["no proof", { upi_ref: null }],
    ["a reference that is not 12 digits", { upi_ref: "1234" }],
    ["a reference with Devanagari digits", { upi_ref: "६२८१०४७३९९१५" }],
    ["a zero amount", { amount: 0 }],
    ["a negative amount", { amount: -5 }],
    ["no fee count", { fee_count: 0 }],
    ["an unknown status", { status: "paid" }],
    ["pending with a handled time", { handled_at: "2026-10-12T06:00:00Z" }],
    ["confirmed with no handled time", { status: "confirmed", confirmed_receipt_from: 1, confirmed_receipt_count: 1 }],
    ["confirmed with no receipt numbers", { status: "confirmed", handled_at: "2026-10-12T06:00:00Z" }],
    ["rejected with receipt numbers", { status: "rejected", handled_at: "2026-10-12T06:00:00Z", confirmed_receipt_from: 1, confirmed_receipt_count: 1 }],
    ["a bad time", { created_at: "garbage" }],
  ])("refuses %s", (_name, over) => {
    expect(() => claimFromRow(row(over))).toThrow(ClaimError);
  });
});

describe("confirmClaim", () => {
  it("sends exactly the claim id and the request id to confirm_claim, and never writes a table", async () => {
    fake.answer(ok(confirmed()));
    const claim = await confirmClaim({ claimId: "c1", requestId: "r1" });
    expect(claim.status).toBe("confirmed");
    expect(fake.calls).toEqual([{ op: "rpc", args: ["confirm_claim", { p_claim: "c1", p_request_id: "r1" }] }]);
  });

  it("sends the same request id again on a retry and gets the same claim", async () => {
    fake.answer({ data: null, error: { message: "TypeError: Failed to fetch" } }, ok(confirmed()));
    await expect(confirmClaim({ claimId: "c1", requestId: "r1" })).rejects.toMatchObject({ code: "failed" });
    const again = await confirmClaim({ claimId: "c1", requestId: "r1" });
    expect(again.receiptFrom).toBe(214);
    expect(fake.calls.filter((c) => c.op === "rpc").map((c) => (c.args[1] as { p_request_id: string }).p_request_id)).toEqual(["r1", "r1"]);
  });

  it("sends nothing when the phone is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await expect(confirmClaim({ claimId: "c1", requestId: "r1" })).rejects.toMatchObject({ code: "offline" });
    await expect(rejectClaim("c1")).rejects.toMatchObject({ code: "offline" });
    expect(fake.calls).toEqual([]);
  });

  it("a thrown network error is `failed`", async () => {
    fake.state.throwOnQuery = true;
    await expect(confirmClaim({ claimId: "c1", requestId: "r1" })).rejects.toMatchObject({ code: "failed" });
  });

  it("a row that cannot be right is `failed`, not a wrong claim", async () => {
    fake.answer(ok({ id: "c1" }));
    await expect(confirmClaim({ claimId: "c1", requestId: "r1" })).rejects.toMatchObject({ code: "failed" });
  });
});

describe("rejectClaim", () => {
  it("sends only the claim id to reject_claim", async () => {
    fake.answer(ok(row({ status: "rejected", handled_at: "2026-10-12T06:00:00Z" })));
    const claim = await rejectClaim("c1");
    expect(claim.status).toBe("rejected");
    expect(fake.calls).toEqual([{ op: "rpc", args: ["reject_claim", { p_claim: "c1" }] }]);
  });
});

describe("errorOf", () => {
  it.each(["invalid_argument", "claim_not_found", "already_handled", "request_reused", "student_archived", "date_out_of_range"])("maps the database word %s to itself", (word) => {
    expect(errorOf({ code: "P0001", message: word })).toMatchObject({ code: word, remaining: null });
  });

  it("carries the paise owed for amount_over_remaining", () => {
    expect(errorOf({ code: "P0001", message: "amount_over_remaining", details: "50000" })).toMatchObject({ code: "amount_over_remaining", remaining: 50000 });
    expect(errorOf({ code: "P0001", message: "amount_over_remaining", details: "lots" })).toMatchObject({ code: "amount_over_remaining", remaining: null });
  });

  it("not signed in is 42501, and an unknown word or a platform error is `failed`", () => {
    expect(errorOf({ code: "42501", message: "permission denied" }).code).toBe("not_signed_in");
    expect(errorOf({ code: "P0001", message: "not_signed_in" }).code).toBe("not_signed_in");
    expect(errorOf({ code: "XX000", message: "boom" }).code).toBe("failed");
    expect(errorOf({}).code).toBe("failed");
  });

  it("the call path maps a refused answer", async () => {
    fake.answer(fail("amount_over_remaining", { details: "30000" }));
    await expect(confirmClaim({ claimId: "c1", requestId: "r1" })).rejects.toMatchObject({ code: "amount_over_remaining", remaining: 30000 });
  });
});

describe("only this file touches claims", () => {
  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  }
  const files = walk(join(process.cwd(), "src")).filter((p) => /\.(ts|tsx)$/.test(p) && !/\.(test|spec)\./.test(p) && !p.endsWith("/lib/claims.ts"));
  it("no other source file names the table or the two functions", () => {
    expect(files.length).toBeGreaterThan(100);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/payment_claims|confirm_claim|reject_claim|submit_claim/);
    }
  });

  it("this file writes no table: no insert, update, delete or upsert", () => {
    const text = readFileSync(join(process.cwd(), "src", "lib", "claims.ts"), "utf8");
    expect(text).not.toMatch(/\.(insert|update|delete|upsert)\(/);
    expect(text).not.toMatch(/select\(\s*["'`]\*["'`]/);
  });
});
