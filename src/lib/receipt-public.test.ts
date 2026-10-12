// The parent's receipt request and what it trusts (spec R1-7 Part B, contract and criteria 24, 27, 29).
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchReceipt, readReceipt, tokenFromPath } from "./receipt-public";

const TOKEN = "abcdefghijklmnopqrstuv";
const paid = {
  receipt_no: 215,
  status: "paid",
  tutor_name: "Meena Iyer",
  tutor_subjects: ["maths", "science"],
  student_name: "Ravi Kumar",
  parent_name: "Suresh Kumar",
  month: "2026-10-01",
  amount: 120000,
  method: "upi",
  paid_on: "2026-10-08",
  balance_after: 0,
  language: "hi",
};
const cancelled = { receipt_no: 215, status: "cancelled", tutor_name: "Meena Iyer", student_name: "Ravi Kumar", language: "te" };

describe("tokenFromPath", () => {
  it("reads a token of 22 or more URL-safe characters, with or without the closing slash", () => {
    expect(tokenFromPath(`/r/${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromPath(`/r/${TOKEN}/`)).toBe(TOKEN);
    expect(tokenFromPath(`/r/${"A_-9".repeat(10)}`)).toBe("A_-9".repeat(10));
  });

  it.each(["/r/", "/r", "/", `/r/${TOKEN.slice(1)}`, `/r/${TOKEN}!`, `/r/${TOKEN}/more`, `/p/${TOKEN}`, `/r/${"a".repeat(129)}`, `/r/${TOKEN}%20`])(
    "gives no token for %s, so nothing is asked",
    (path) => {
      expect(tokenFromPath(path)).toBeNull();
    },
  );
});

describe("readReceipt", () => {
  it("reads a paid receipt and keeps only the fields it needs", () => {
    const outcome = readReceipt({ code: "ok", receipt: { ...paid, extra: "tutor_id: 1" } });
    expect(outcome).toEqual({
      kind: "ok",
      receipt: {
        receiptNo: 215,
        status: "paid",
        tutorName: "Meena Iyer",
        tutorSubjects: ["maths", "science"],
        studentName: "Ravi Kumar",
        parentName: "Suresh Kumar",
        month: "2026-10-01",
        amount: 120000,
        method: "upi",
        paidOn: "2026-10-08",
        balanceAfter: 0,
        language: "hi",
      },
    });
  });

  it("reads a part paid receipt with no parent and no month", () => {
    const outcome = readReceipt({ code: "ok", receipt: { ...paid, status: "part_paid", parent_name: null, month: null, balance_after: 30000, tutor_name: null } });
    expect(outcome).toMatchObject({ kind: "ok", receipt: { status: "part_paid", parentName: null, month: null, balanceAfter: 30000, tutorName: null } });
  });

  it("reads a cancelled receipt and keeps no amount even if one were sent", () => {
    const outcome = readReceipt({ code: "ok", receipt: { ...cancelled, amount: 5, method: "cash" } });
    expect(outcome).toEqual({ kind: "cancelled", receipt: { receiptNo: 215, status: "cancelled", tutorName: "Meena Iyer", studentName: "Ravi Kumar", language: "te" } });
  });

  it.each<[string, Record<string, unknown>]>([
    ["a fractional amount", { amount: 12.5 }],
    ["a zero amount", { amount: 0 }],
    ["a string amount", { amount: "1200" }],
    ["a negative balance", { balance_after: -1 }],
    ["an unknown method", { method: "cheque" }],
    ["an unknown status", { status: "refunded" }],
    ["an unknown language", { language: "fr" }],
    ["a date that never was", { paid_on: "2026-02-30" }],
    ["a month 13", { month: "2026-13-01" }],
    ["no student", { student_name: " " }],
    ["a receipt number of 0", { receipt_no: 0 }],
    ["subjects that are not text", { tutor_subjects: [1] }],
  ])("refuses %s", (_name, change) => {
    expect(readReceipt({ code: "ok", receipt: { ...paid, ...change } })).toBeNull();
  });

  it.each([null, "ok", [], { code: "ok" }, { code: "not_found" }, { code: "ok", receipt: null }])("refuses a body that is not the function's: %j", (body) => {
    expect(readReceipt(body)).toBeNull();
  });
});

describe("fetchReceipt", () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("posts the token and nothing else, with no cookies, no referrer and no cache", async () => {
    const fetchMock = reply(200, { code: "ok", receipt: paid });
    vi.stubGlobal("fetch", fetchMock);
    const outcome = await fetchReceipt(TOKEN, undefined, "https://x.test/functions/v1/receipt");
    expect(outcome.kind).toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://x.test/functions/v1/receipt");
    expect(url).not.toContain(TOKEN);
    expect(init).toMatchObject({ method: "POST", credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
    expect(JSON.parse(init.body as string)).toEqual({ token: TOKEN });
    expect(Object.keys(init.headers as object)).toEqual(["content-type"]);
  });

  it.each<[number, unknown, string]>([
    [404, { code: "not_found" }, "not_found"],
    [429, { code: "rate_limited" }, "rate_limited"],
    [500, { code: "error" }, "failed"],
    [400, { code: "invalid" }, "failed"],
    [405, { code: "invalid" }, "failed"],
    [200, { code: "ok" }, "failed"],
    [200, "not json shaped", "failed"],
  ])("%i %j is %s", async (status, body, kind) => {
    vi.stubGlobal("fetch", reply(status, body));
    expect((await fetchReceipt(TOKEN)).kind).toBe(kind);
  });

  it("is failed, not an error, when the network is down or the reply is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    expect(await fetchReceipt(TOKEN)).toEqual({ kind: "failed" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
    expect(await fetchReceipt(TOKEN)).toEqual({ kind: "failed" });
  });

  it("gives up after 15 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("x", "AbortError"))))),
    );
    const pending = fetchReceipt(TOKEN);
    await vi.advanceTimersByTimeAsync(15_001);
    expect(await pending).toEqual({ kind: "failed" });
    vi.useRealTimers();
  });
});
