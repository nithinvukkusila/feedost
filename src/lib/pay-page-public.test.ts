// The parent's pay-page requests and what they trust (spec R1-9 Part B, criteria 16, 20, 33, 42).
import { afterEach, describe, expect, it, vi } from "vitest";
import { feeBody, noticeBody, TOKEN } from "./pay-page.test-util";
import { fetchPayPage, postClaim, postConsent, readPage, tokenFromPath } from "./pay-page-public";

const ok = (page: unknown) => ({ code: "ok", page });

describe("tokenFromPath", () => {
  it("reads a token of 22 or more URL-safe characters, with or without the closing slash", () => {
    expect(tokenFromPath(`/p/${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromPath(`/p/${TOKEN}/`)).toBe(TOKEN);
    expect(tokenFromPath(`/p/${"A_-9".repeat(10)}`)).toBe("A_-9".repeat(10));
  });

  it.each(["/p/", "/p", "/", `/p/${TOKEN.slice(1)}`, `/p/${TOKEN}!`, `/p/${TOKEN}/more`, `/r/${TOKEN}`, `/p/${"a".repeat(129)}`, `/p/${TOKEN}%20`])(
    "gives no token for %s, so nothing is asked",
    (path) => {
      expect(tokenFromPath(path)).toBeNull();
    },
  );
});

describe("readPage", () => {
  it("reads the notice header and nothing else before consent, dropping unknown fields", () => {
    expect(readPage(ok({ ...noticeBody, upi_id: "x@okhdfc", total_remaining: 5, extra: "id" }))).toEqual({
      consentNeeded: true,
      noticeVersion: "v1",
      tutorName: "Meena Iyer",
      tutorSubjects: ["maths", "science"],
      studentName: "Ravi Kumar",
      language: "en",
    });
  });

  it("reads the fee page after consent", () => {
    const page = readPage(ok({ ...feeBody, extra: 1 }));
    expect(page).toMatchObject({ consentNeeded: false, upiId: "meena.tuitions@okhdfc", today: "2026-10-12", totalRemaining: 340000, openDuesMore: 0, receiptsMore: false });
    if (page === null || page.consentNeeded) throw new Error("expected a fee page");
    expect(page.openDues).toHaveLength(3);
    expect(page.openDues[1]).toEqual({ kind: "monthly", month: "2026-09-01", dueDate: "2026-09-01", amount: 120000, amountPaid: 20000, remaining: 100000 });
    expect(page.receipts[1]).toEqual({ receiptNo: 171, receiptToken: "Hj5nB9cVx2MqP6wEt8RyUa", month: null, amount: 50000, paidOn: "2026-08-12", balanceAfter: 50000 });
    expect(JSON.stringify(page)).not.toContain("extra");
  });

  it("accepts a total above 2^31 (22 open fees at the cap)", () => {
    const page = readPage(ok({ ...feeBody, total_remaining: 2_200_000_000 }));
    expect(page).toMatchObject({ totalRemaining: 2_200_000_000 });
  });

  it("treats a missing tutor name as none and a blank UPI ID as none", () => {
    expect(readPage(ok({ ...feeBody, tutor_name: null, upi_id: "  " }))).toMatchObject({ tutorName: null, upiId: null });
    expect(readPage(ok({ ...feeBody, upi_id: null }))).toMatchObject({ upiId: null });
  });

  it.each([
    ["a non-boolean consent_needed", { ...noticeBody, consent_needed: "true" }],
    ["a missing consent_needed", { ...noticeBody, consent_needed: undefined }],
    ["a bad language", { ...noticeBody, language: "fr" }],
    ["a missing student", { ...noticeBody, student_name: "" }],
    ["a bad version", { ...noticeBody, notice_version: "V 1" }],
    ["subjects that are not text", { ...noticeBody, tutor_subjects: [1] }],
    ["a missing list", { ...feeBody, open_dues: undefined }],
    ["a missing receipts list", { ...feeBody, receipts: null }],
    ["a float total", { ...feeBody, total_remaining: 1200.5 }],
    ["a negative total", { ...feeBody, total_remaining: -1 }],
    ["an unsafe total", { ...feeBody, total_remaining: 2 ** 53 }],
    ["a float amount in a fee", { ...feeBody, open_dues: [{ ...feeBody.open_dues[0], remaining: 10.5 }] }],
    ["an impossible date", { ...feeBody, today: "2026-02-30" }],
    ["a date in the wrong shape", { ...feeBody, today: "12 Oct 2026" }],
    ["a due with an unknown kind", { ...feeBody, open_dues: [{ ...feeBody.open_dues[0], kind: "other" }] }],
    ["a month that is not the first", { ...feeBody, open_dues: [{ ...feeBody.open_dues[1], month: "2026-09-15" }] }],
    ["a receipt with a short token", { ...feeBody, receipts: [{ ...feeBody.receipts[0], receipt_token: "short" }] }],
    ["a missing today", { ...feeBody, today: undefined }],
    ["a non-boolean receipts_more", { ...feeBody, receipts_more: 1 }],
  ])("refuses %s, so the page says failed rather than showing half of it", (_name, page) => {
    expect(readPage(ok(page))).toBeNull();
  });

  it.each([null, "x", [], {}, { code: "error" }, { code: "ok" }, { code: "ok", page: [] }])("refuses the body %j", (body) => {
    expect(readPage(body)).toBeNull();
  });
});

type Reply = { status: number; body?: unknown; throws?: boolean; text?: string };
function stubFetch(reply: Reply) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      if (reply.throws) return Promise.reject(new TypeError("network"));
      return Promise.resolve({
        status: reply.status,
        json: () => (reply.text !== undefined ? Promise.reject(new SyntaxError(reply.text)) : Promise.resolve(reply.body)),
      });
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchPayPage", () => {
  it("sends exactly the token, with no credentials, no cache and no referrer", async () => {
    const calls = stubFetch({ status: 200, body: ok(noticeBody) });
    const outcome = await fetchPayPage(TOKEN, undefined, "https://f.test/pay-page");
    expect(outcome.kind).toBe("ok");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://f.test/pay-page");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ token: TOKEN });
    expect(calls[0].init).toMatchObject({ credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
    expect(Object.keys(calls[0].init.headers as object)).toEqual(["content-type"]);
  });

  it.each([
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "failed"],
    [400, "failed"],
    [409, "failed"],
  ])("answers %i as %s", async (status, kind) => {
    stubFetch({ status, body: { code: "x" } });
    expect((await fetchPayPage(TOKEN, undefined, "https://f.test/x")).kind).toBe(kind);
  });

  it("answers failed for a network error, a body that is not JSON and a body that is not the function's", async () => {
    stubFetch({ status: 200, throws: true });
    expect((await fetchPayPage(TOKEN, undefined, "https://f.test/x")).kind).toBe("failed");
    stubFetch({ status: 200, text: "nope" });
    expect((await fetchPayPage(TOKEN, undefined, "https://f.test/x")).kind).toBe("failed");
    stubFetch({ status: 200, body: { code: "ok", page: { consent_needed: "maybe" } } });
    expect((await fetchPayPage(TOKEN, undefined, "https://f.test/x")).kind).toBe("failed");
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))),
    );
    const pending = fetchPayPage(TOKEN, undefined, "https://f.test/x");
    await vi.advanceTimersByTimeAsync(15_001);
    expect((await pending).kind).toBe("failed");
  });

  it("stops when the page goes away", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))),
    );
    const stop = new AbortController();
    const pending = fetchPayPage(TOKEN, stop.signal, "https://f.test/x");
    stop.abort();
    expect((await pending).kind).toBe("failed");
  });
});

describe("postConsent", () => {
  it("sends exactly {token, notice_version}, and nothing else", async () => {
    const calls = stubFetch({ status: 200, body: { code: "ok" } });
    expect(await postConsent(TOKEN, "v1", undefined, "https://f.test/consent")).toEqual({ kind: "ok" });
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ token: TOKEN, notice_version: "v1" });
    expect(Object.keys(JSON.parse(calls[0].init.body as string))).toEqual(["token", "notice_version"]);
    expect(calls[0].init).toMatchObject({ credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
  });

  it("reads the current version out of a 409", async () => {
    stubFetch({ status: 409, body: { code: "stale_notice", notice_version: "v2" } });
    expect(await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).toEqual({ kind: "stale", noticeVersion: "v2" });
    stubFetch({ status: 409, body: { code: "stale_notice" } });
    expect(await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).toEqual({ kind: "stale", noticeVersion: null });
    stubFetch({ status: 409, text: "bad" });
    expect(await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).toEqual({ kind: "stale", noticeVersion: null });
  });

  it.each([
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "failed"],
    [400, "failed"],
  ])("answers %i as %s", async (status, kind) => {
    stubFetch({ status, body: {} });
    expect((await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).kind).toBe(kind);
  });

  it("answers failed for a 200 that is not ok, and for a network error", async () => {
    stubFetch({ status: 200, body: { code: "nope" } });
    expect((await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).kind).toBe("failed");
    stubFetch({ status: 200, throws: true });
    expect((await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).kind).toBe("failed");
  });
});

// Spec R1-10 Part C, criterion 38 and plan section 5: the one key the page gains after consent.
describe("readPage: pending_claim", () => {
  const fee = (pending: unknown) => readPage(ok({ ...feeBody, pending_claim: pending }));

  it("reads absent and null as no claim waiting", () => {
    expect(readPage(ok(feeBody))).toMatchObject({ pendingClaim: null });
    expect(fee(null)).toMatchObject({ pendingClaim: null });
  });

  it("reads exactly an amount in paise and the India day it was sent", () => {
    expect(fee({ amount: 340000, submitted_on: "2026-10-11" })).toMatchObject({ pendingClaim: { amount: 340000, submittedOn: "2026-10-11" } });
    expect(fee({ amount: 2_000_000_000, submitted_on: "2026-02-28" })).toMatchObject({ pendingClaim: { amount: 2_000_000_000 } });
  });

  it.each([
    ["a number", 5],
    ["a string", "pending"],
    ["a list", [340000, "2026-10-11"]],
    ["a zero amount", { amount: 0, submitted_on: "2026-10-11" }],
    ["a fraction of a paisa", { amount: 3400.5, submitted_on: "2026-10-11" }],
    ["an amount as text", { amount: "340000", submitted_on: "2026-10-11" }],
    ["a day that does not exist", { amount: 1, submitted_on: "2026-02-30" }],
    ["a time, not a day", { amount: 1, submitted_on: "2026-10-11T10:00:00Z" }],
    ["an extra key (the reference)", { amount: 1, submitted_on: "2026-10-11", upi_ref: "628104739915" }],
    ["a missing key", { amount: 1 }],
  ])("fails the whole page for %s", (_what, value) => {
    expect(fee(value)).toBeNull();
  });

  it("is never read before consent", () => {
    expect(readPage(ok({ ...noticeBody, pending_claim: { amount: 1, submitted_on: "2026-10-11" } }))).not.toHaveProperty("pendingClaim");
  });
});

describe("postClaim", () => {
  it("sends exactly {token, upi_ref}, as postConsent sends, and nothing else", async () => {
    const calls = stubFetch({ status: 200, body: { code: "ok" } });
    expect(await postClaim(TOKEN, "628104739915", undefined, "https://f.test/submit-claim")).toEqual({ kind: "ok" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://f.test/submit-claim");
    expect(calls[0].init.method).toBe("POST");
    expect(Object.keys(JSON.parse(calls[0].init.body as string))).toEqual(["token", "upi_ref"]);
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ token: TOKEN, upi_ref: "628104739915" });
    expect(calls[0].init).toMatchObject({ credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
    expect(Object.keys(calls[0].init.headers as object)).toEqual(["content-type"]);
  });

  it("names the submit-claim function on the functions host by default", async () => {
    const calls = stubFetch({ status: 200, body: { code: "ok" } });
    await postClaim(TOKEN, "628104739915");
    expect(calls[0].url.endsWith("/functions/v1/submit-claim")).toBe(true);
    expect(calls[0].url).not.toContain("?");
    expect(calls[0].url).not.toContain("628104739915");
  });

  it.each([
    [200, "ok", "ok"],
    [422, "bad_reference", "bad_reference"],
    [422, "no_proof", "no_proof"],
    [409, "duplicate_reference", "duplicate"],
    [409, "already_pending", "already_pending"],
    [409, "nothing_owed", "nothing_owed"],
    [403, "consent_needed", "consent_needed"],
    [404, "not_found", "not_found"],
    [429, "rate_limited", "rate_limited"],
    [500, "error", "failed"],
    [400, "invalid", "failed"],
    [405, "invalid", "failed"],
    [413, "invalid", "failed"],
  ])("answers %i {code: %s} as %s", async (status, code, kind) => {
    stubFetch({ status, body: { code } });
    expect((await postClaim(TOKEN, "628104739915", undefined, "https://f.test/c")).kind).toBe(kind);
  });

  it("a 403 is always 'read the page again', whatever its body says", async () => {
    stubFetch({ status: 403, text: "Forbidden" });
    expect((await postClaim(TOKEN, "628104739915", undefined, "https://f.test/c")).kind).toBe("consent_needed");
  });

  it.each([
    [200, { code: "already_pending" }],
    [200, { code: "toString" }],
    [422, { code: "ok" }],
    [409, { code: "bad_reference" }],
    [409, { code: "__proto__" }],
    [409, {}],
    [200, ["ok"]],
  ])("answers failed for %i with a code it should not carry (%j)", async (status, body) => {
    stubFetch({ status, body });
    expect((await postClaim(TOKEN, "628104739915", undefined, "https://f.test/c")).kind).toBe("failed");
  });

  it("answers failed, never throws, for a network error and a body that is not JSON", async () => {
    stubFetch({ status: 200, throws: true });
    expect((await postClaim(TOKEN, "628104739915", undefined, "https://f.test/c")).kind).toBe("failed");
    stubFetch({ status: 409, text: "nope" });
    expect((await postClaim(TOKEN, "628104739915", undefined, "https://f.test/c")).kind).toBe("failed");
  });

  it("gives up after the timeout, as the other two calls do", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))))),
    );
    const pending = postClaim(TOKEN, "628104739915", undefined, "https://f.test/c");
    await vi.advanceTimersByTimeAsync(15_001);
    expect((await pending).kind).toBe("failed");
  });
});
