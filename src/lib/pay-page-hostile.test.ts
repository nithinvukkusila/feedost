// What a parent's phone can hand the pay page that the happy-path tests do not (spec R1-9 Part B, criteria 16, 24, 32,
// 37, 42): tokens of odd shape, answers with the wrong keys or types, a 429 that carries Retry-After, and a link that
// must be built only from data the validator has accepted.
import { afterEach, describe, expect, it, vi } from "vitest";
import { feeBody, noticeBody, TOKEN } from "./pay-page.test-util";
import { fetchPayPage, postConsent, readPage, tokenFromPath, type FeePage } from "./pay-page-public";
import { payArea } from "./pay-page-view";
import { PAY_PAGE_MAX_PAISE, UPI_ID } from "./upi-link";

const ok = (page: unknown) => ({ code: "ok", page });
const feePage = (change: Record<string, unknown> = {}): FeePage => {
  const page = readPage(ok({ ...feeBody, ...change }));
  if (page === null || page.consentNeeded) throw new Error("fixture");
  return page;
};
const hrefOf = (change: Record<string, unknown>) => {
  const area = payArea(feePage(change));
  if (area.kind !== "pay") throw new Error(`no pay link: ${area.kind}`);
  return area.href;
};
/** The five pairs of a upi:// link, decoded the way a UPI app reads them. */
const pairsOf = (href: string) => {
  const query = href.slice("upi://pay?".length);
  return query.split("&").map((pair) => [pair.slice(0, pair.indexOf("=")), decodeURIComponent(pair.slice(pair.indexOf("=") + 1))]);
};

describe("tokenFromPath, the shapes a phone can send", () => {
  it("takes exactly 22 and exactly 128 characters, and refuses 21 and 129", () => {
    expect(tokenFromPath(`/p/${"a".repeat(22)}`)).toBe("a".repeat(22));
    expect(tokenFromPath(`/p/${"a".repeat(128)}/`)).toBe("a".repeat(128));
    expect(tokenFromPath(`/p/${"a".repeat(21)}`)).toBeNull();
    expect(tokenFromPath(`/p/${"a".repeat(129)}`)).toBeNull();
  });

  it.each([
    ["a trailing newline", `/p/${TOKEN}\n`],
    ["a leading space", `/p/ ${TOKEN}`],
    ["a Devanagari digit", `/p/${TOKEN.slice(1)}१`],
    ["a full-width letter", `/p/${TOKEN.slice(1)}Ａ`],
    ["an encoded slash", `/p/${TOKEN.slice(3)}%2Fab`],
    ["an encoded dot", `/p/${TOKEN.slice(3)}%2eab`],
    ["a dot", `/p/${TOKEN.slice(1)}.`],
    ["a plus", `/p/${TOKEN.slice(1)}+`],
    ["two slashes", `/p//${TOKEN}`],
    ["an upper-case path", `/P/${TOKEN}`],
    ["a path with the locale in front", `/en/p/${TOKEN}`],
    ["an empty string", ""],
  ])("gives no token for %s", (_name, path) => {
    expect(tokenFromPath(path)).toBeNull();
  });
});

describe("readPage, an answer with the wrong keys or types", () => {
  it.each([
    ["a null tutor_subjects", { ...noticeBody, tutor_subjects: null }],
    ["a string tutor_subjects", { ...noticeBody, tutor_subjects: "maths" }],
    ["a numeric tutor_name", { ...noticeBody, tutor_name: 7 }],
    ["a null student_name", { ...noticeBody, student_name: null }],
    ["a whitespace student_name", { ...noticeBody, student_name: "   " }],
    ["a null language", { ...noticeBody, language: null }],
    ["an upper-case language", { ...noticeBody, language: "EN" }],
    ["a null notice_version", { ...noticeBody, notice_version: null }],
    ["a 17-character notice_version", { ...noticeBody, notice_version: "a".repeat(17) }],
    ["an empty notice_version", { ...noticeBody, notice_version: "" }],
    ["a numeric notice_version", { ...noticeBody, notice_version: 1 }],
    ["a numeric upi_id", { ...feeBody, upi_id: 5 }],
    ["a missing upi_id", { ...feeBody, upi_id: undefined }],
    ["a string total_remaining", { ...feeBody, total_remaining: "340000" }],
    ["a null total_remaining", { ...feeBody, total_remaining: null }],
    ["a missing open_dues_more", { ...feeBody, open_dues_more: undefined }],
    ["a float open_dues_more", { ...feeBody, open_dues_more: 0.5 }],
    ["a negative open_dues_more", { ...feeBody, open_dues_more: -1 }],
    ["an object where open_dues is a list", { ...feeBody, open_dues: { 0: feeBody.open_dues[0] } }],
    ["a null inside open_dues", { ...feeBody, open_dues: [null] }],
    ["a list inside open_dues", { ...feeBody, open_dues: [[]] }],
    ["a due with a string amount", { ...feeBody, open_dues: [{ ...feeBody.open_dues[0], amount: "1000" }] }],
    ["a due with a negative amount_paid", { ...feeBody, open_dues: [{ ...feeBody.open_dues[0], amount_paid: -1 }] }],
    ["a due with a missing due_date", { ...feeBody, open_dues: [{ ...feeBody.open_dues[0], due_date: undefined }] }],
    ["a due with month 13", { ...feeBody, open_dues: [{ ...feeBody.open_dues[1], month: "2026-13-01" }] }],
    ["a due with a month that is a number", { ...feeBody, open_dues: [{ ...feeBody.open_dues[1], month: 202609 }] }],
    ["a good due after a bad one", { ...feeBody, open_dues: [{ ...feeBody.open_dues[0], kind: "x" }, feeBody.open_dues[1]] }],
    ["a receipt with number 0", { ...feeBody, receipts: [{ ...feeBody.receipts[0], receipt_no: 0 }] }],
    ["a receipt with a float number", { ...feeBody, receipts: [{ ...feeBody.receipts[0], receipt_no: 1.5 }] }],
    ["a receipt with amount 0", { ...feeBody, receipts: [{ ...feeBody.receipts[0], amount: 0 }] }],
    ["a receipt with a bad paid_on", { ...feeBody, receipts: [{ ...feeBody.receipts[0], paid_on: "2026-00-10" }] }],
    ["a receipt token with a slash", { ...feeBody, receipts: [{ ...feeBody.receipts[0], receipt_token: "Rq8mT2vXk4LpN7sYb3/../x" }] }],
    ["a receipt token with a javascript scheme", { ...feeBody, receipts: [{ ...feeBody.receipts[0], receipt_token: "javascript:alert(1);;;;;;" }] }],
    ["a receipt with a null balance_after", { ...feeBody, receipts: [{ ...feeBody.receipts[0], balance_after: null }] }],
    ["a receipts_more that is a string", { ...feeBody, receipts_more: "false" }],
  ])("refuses %s", (_name, page) => {
    expect(readPage(ok(page))).toBeNull();
  });

  it("refuses a body whose code is not 'ok', even with a good page inside", () => {
    expect(readPage({ code: "not_found", page: feeBody })).toBeNull();
    expect(readPage({ page: feeBody })).toBeNull();
  });

  it("drops every key it does not know, so an unexpected one is never shown", () => {
    const page = readPage(ok({ ...noticeBody, upi_id: "evil@okhdfc", total_remaining: 99, open_dues: [feeBody.open_dues[0]], receipts: feeBody.receipts, pay_token: "secret", html: "<img>" }));
    expect(page).not.toBeNull();
    expect(Object.keys(page ?? {}).sort()).toEqual(["consentNeeded", "language", "noticeVersion", "studentName", "tutorName", "tutorSubjects"]);
    const fee = readPage(ok({ ...feeBody, pay_token: "secret", html: "<img>", open_dues: [{ ...feeBody.open_dues[0], note: "x", link: "javascript:1" }] }));
    expect(JSON.stringify(fee)).not.toMatch(/secret|<img>|javascript|note/);
  });

  it("keeps a tutor name with markup as plain text (the page draws text, never HTML)", () => {
    const page = readPage(ok({ ...noticeBody, tutor_name: "<img src=x onerror=alert(1)>", student_name: "</p><script>1</script>" }));
    expect(page).toMatchObject({ tutorName: "<img src=x onerror=alert(1)>", studentName: "</p><script>1</script>" });
  });

  it("accepts a total at the safe-integer edge but not a paise count above it", () => {
    expect(readPage(ok({ ...feeBody, total_remaining: Number.MAX_SAFE_INTEGER }))).toMatchObject({ totalRemaining: Number.MAX_SAFE_INTEGER });
    expect(readPage(ok({ ...feeBody, total_remaining: Number.MAX_SAFE_INTEGER + 1 }))).toBeNull();
  });

  it("accepts an empty fee list with a zero total, and an earlier balance with no month", () => {
    expect(readPage(ok({ ...feeBody, open_dues: [], total_remaining: 0 }))).toMatchObject({ openDues: [], totalRemaining: 0 });
    expect(readPage(ok({ ...feeBody, open_dues: [feeBody.open_dues[0]], total_remaining: 100000 }))).toMatchObject({ openDues: [{ kind: "opening", month: null }] });
  });
});

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };
const answer = (reply: Reply) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ status: reply.status, headers: new Headers(reply.headers), json: () => Promise.resolve(reply.body) })),
  );
afterEach(() => vi.unstubAllGlobals());

describe("a 429 with Retry-After, and the other statuses a gateway can send", () => {
  it("is 'rate_limited' for pay-page and record-consent, whatever Retry-After says, and does not read the body", async () => {
    for (const header of ["30", "0", "Wed, 21 Oct 2026 07:28:00 GMT", "soon", ""]) {
      answer({ status: 429, headers: { "retry-after": header }, body: { code: "ok", page: feeBody } });
      expect((await fetchPayPage(TOKEN, undefined, "https://f.test/x")).kind, header).toBe("rate_limited");
      expect((await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).kind, header).toBe("rate_limited");
    }
  });

  it.each([401, 403, 408, 413, 500, 502, 503, 504])("is 'failed' for %i with a body that looks like a page", async (status) => {
    answer({ status, body: { code: "ok", page: feeBody } });
    expect((await fetchPayPage(TOKEN, undefined, "https://f.test/x")).kind).toBe("failed");
    expect((await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).kind).toBe("failed");
  });

  it("does not show a page a 404 body carries", async () => {
    answer({ status: 404, body: { code: "ok", page: feeBody } });
    expect(await fetchPayPage(TOKEN, undefined, "https://f.test/x")).toEqual({ kind: "not_found" });
  });

  it("ignores a 409 version that is not a version, so a hostile answer cannot choose what is sent next", async () => {
    answer({ status: 409, body: { code: "stale_notice", notice_version: "<script>" } });
    expect(await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).toEqual({ kind: "stale", noticeVersion: null });
  });

  it("treats a consent 200 with the wrong code, or no body, as failed (nothing is shown as saved)", async () => {
    for (const body of [null, "ok", [], { code: "okay" }, { status: "ok" }]) {
      answer({ status: 200, body });
      expect((await postConsent(TOKEN, "v1", undefined, "https://f.test/c")).kind).toBe("failed");
    }
  });
});

describe("the upi:// link is built only from data the validator accepted", () => {
  it.each([
    ["an '&' that would add a parameter", "evil@okhdfc&am=1"],
    ["a '?' ", "evil@okhdfc?x=1"],
    ["a '#'", "evil@okhdfc#x"],
    ["a space", "evil @okhdfc"],
    ["a trailing newline", "evil@okhdfc\n"],
    ["a second '@'", "a@b@okhdfc"],
    ["digits after the '@'", "evil@okhdfc1"],
    ["a one-letter handle part", "evil@o"],
    ["a one-character name part", "e@okhdfc"],
    ["a unicode name", "मीना@okhdfc"],
    ["a scheme", "upi://pay?pa=evil@okhdfc"],
  ])("builds no link, and no Copy target, for a UPI ID with %s", (_name, upiId) => {
    expect(UPI_ID.test(upiId)).toBe(false);
    expect(payArea(feePage({ upi_id: upiId }))).toEqual({ kind: "no-upi" });
  });

  it("has exactly five pairs in order, whatever the tutor's name holds", () => {
    for (const name of ["Meena & Sons", "a=b&am=1&pa=x@y", "100% #1 ?q", "plus+sign", "मीना अय्यर ट्यूशन", "మీనా అయ్యర్", "😀 Tutor", "quote\"'<>", "tab\there", "line\nbreak"]) {
      const pairs = pairsOf(hrefOf({ tutor_name: name }));
      expect(pairs.map(([key]) => key), name).toEqual(["pa", "pn", "am", "cu", "tn"]);
      expect(pairs[0][1]).toBe(feeBody.upi_id);
      expect(pairs[2][1]).toBe("3400.00");
      expect(pairs[3][1]).toBe("INR");
    }
  });

  it("encodes the tutor's name so a UPI app reads it back as saved (control characters are never sent)", () => {
    expect(pairsOf(hrefOf({ tutor_name: "Meena & Sons #1 ?x=1" }))[1][1]).toBe("Meena & Sons #1 ?x=1");
    expect(hrefOf({ tutor_name: "Meena & Sons" })).toContain("pn=Meena%20%26%20Sons&");
    expect(pairsOf(hrefOf({ tutor_name: "😀 Tutor" }))[1][1]).toBe("😀 Tutor");
    // A line break inside a saved name is dropped, never sent: no control character reaches the UPI app.
    expect(hrefOf({ tutor_name: "line\nbreak\ttab" })).not.toMatch(/%0[0-9A-F]|%1[0-9A-F]|%7F/i);
    expect(hrefOf({ tutor_name: "मीना" })).toContain("pn=%E0%A4%AE%E0%A5%80%E0%A4%A8%E0%A4%BE&");
  });

  it("uses the UPI ID's own name part when the tutor's name is only control characters", () => {
    expect(pairsOf(hrefOf({ tutor_name: "\u0007\u0008", upi_id: "ravi.k@okhdfc" }))[1][1]).toBe("ravi.k");
  });

  it("never lets the student's name into pn, pa or am, and only into tn when plain Latin", () => {
    const pairs = pairsOf(hrefOf({ student_name: "Ravi&am=1", open_dues: [feeBody.open_dues[2]], total_remaining: 140000 }));
    expect(pairs.map(([key]) => key)).toEqual(["pa", "pn", "am", "cu", "tn"]);
    expect(pairs[2][1]).toBe("1400.00");
    expect(pairs[4][1]).toBe("Fee Oct 2026");
  });

  it("asks for the total the server sent, even when the fee lines on the page add up to something else", () => {
    expect(pairsOf(hrefOf({ total_remaining: 123456 }))[2][1]).toBe("1234.56");
    expect(pairsOf(hrefOf({ total_remaining: 1 }))[2][1]).toBe("0.01");
    expect(pairsOf(hrefOf({ total_remaining: 99 }))[2][1]).toBe("0.99");
    expect(pairsOf(hrefOf({ total_remaining: PAY_PAGE_MAX_PAISE }))[2][1]).toBe("1000000.00");
  });

  it("never builds a link above the ceiling or at zero, and the too-big case keeps the plain ID", () => {
    expect(payArea(feePage({ total_remaining: PAY_PAGE_MAX_PAISE + 1 }))).toEqual({ kind: "too-big", upiId: feeBody.upi_id });
    expect(payArea(feePage({ total_remaining: 2_200_000_000 }))).toEqual({ kind: "too-big", upiId: feeBody.upi_id });
    expect(payArea(feePage({ total_remaining: 0 }))).toEqual({ kind: "nothing" });
  });

  it("says no UPI ID before it says too big, so a bad ID is never offered for copying", () => {
    expect(payArea(feePage({ total_remaining: 2_200_000_000, upi_id: "bad id" }))).toEqual({ kind: "no-upi" });
    expect(payArea(feePage({ total_remaining: 0, upi_id: null }))).toEqual({ kind: "nothing" });
  });
});
