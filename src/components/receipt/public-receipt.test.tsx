// The parent's receipt page (spec R1-7 Part B, criteria 28 to 31) with the function's reply stubbed.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";
import kn from "../../../messages/kn.json";
import te from "../../../messages/te.json";
import { PublicReceipt } from "./public-receipt";

const words = { en: en.receipt, hi: hi.receipt, kn: kn.receipt, te: te.receipt };
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
  language: "en",
};
let fetchMock: ReturnType<typeof vi.fn>;

function answer(status: number, body: unknown) {
  fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
}
const ok = (change: Record<string, unknown> = {}) => answer(200, { code: "ok", receipt: { ...paid, ...change } });

beforeEach(() => {
  window.history.pushState({}, "", `/r/${TOKEN}/`);
  answer(404, { code: "not_found" });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.lang = "en";
});

describe("the parent's receipt page", () => {
  it("says it is opening the receipt, never a bare spinner, until the answer comes", () => {
    fetchMock = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicReceipt words={words} />);
    expect(screen.getByText(en.receipt.loading)).toBeTruthy();
    expect(document.querySelector("main")?.getAttribute("data-state")).toBe("loading");
  });

  it("shows the receipt as drawn: tutor, number, date, sentence, amount, balance, status and stamp", async () => {
    ok();
    const { container } = render(<PublicReceipt words={words} />);
    await screen.findByText("Meena Iyer");
    const text = container.textContent ?? "";
    expect(text).toContain("Maths, Science tuition");
    expect(text).toContain("215");
    expect(text).toContain("Date 08 Oct 2026");
    expect(text).toContain("Received with thanks from Suresh Kumar by UPI towards the tuition fee of Ravi Kumar for October 2026.");
    expect(text).toContain("₹1,200/-");
    expect(screen.getByText(en.receipt.nil)).toBeTruthy();
    expect(container.querySelector("[data-status=paid]")?.textContent).toBe("Paid");
    expect(screen.getByRole("img", { name: "PAID" })).toBeTruthy();
    expect(text).toContain("Free for tutors");
    // No Download PDF yet (Part C), no link out, no phone.
    expect(container.querySelectorAll("a, button")).toHaveLength(0);
  });

  it("shows part paid with the balance left and a dashed-outline tag", async () => {
    ok({ status: "part_paid", amount: 70000, balance_after: 50000, parent_name: null, month: null });
    const { container } = render(<PublicReceipt words={words} />);
    await screen.findByText("Meena Iyer");
    const text = container.textContent ?? "";
    expect(text).toContain("₹700/-");
    expect(text).toContain("₹500");
    expect(text).toContain("Received with thanks by UPI towards the tuition fee of Ravi Kumar for an earlier balance.");
    expect(container.querySelector("[data-status=part-paid]")?.textContent).toBe("Part paid");
    expect(screen.getByRole("img", { name: "PART PAID" })).toBeTruthy();
  });

  it("writes Indian grouping and 0 to 9 digits in every language", async () => {
    ok({ amount: 123456700, language: "te" });
    const { container } = render(<PublicReceipt words={words} />);
    await screen.findByText("Meena Iyer");
    expect(container.textContent).toContain("₹12,34,567/-");
  });

  it.each(["hi", "kn", "te"] as const)("takes the page language from the receipt, not the address: %s", async (language) => {
    ok({ language });
    const { container } = render(<PublicReceipt words={words} />);
    await screen.findByText("Meena Iyer");
    expect(document.querySelector("main")?.getAttribute("lang")).toBe(language);
    expect(document.documentElement.lang).toBe(language);
    expect(container.textContent).toContain(words[language].footer);
    expect(container.textContent).not.toContain("Free for tutors");
    expect(container.textContent).not.toContain("TODO-translate");
  });

  it("shows a cancelled receipt with the number, tutor and student, and no amount", async () => {
    answer(200, { code: "ok", receipt: { receipt_no: 215, status: "cancelled", tutor_name: "Meena Iyer", student_name: "Ravi Kumar", language: "en" } });
    const { container } = render(<PublicReceipt words={words} />);
    await screen.findByText(en.receipt.cancelled.title);
    const text = container.textContent ?? "";
    expect(text).toContain("215");
    expect(text).toContain("Ravi Kumar");
    expect(text).not.toContain("₹");
    expect(screen.getByRole("img", { name: "CANCELLED" })).toBeTruthy();
  });

  it("shows not found for an unknown receipt, and shows no tutor data", async () => {
    render(<PublicReceipt words={words} />);
    await screen.findByText(en.receipt.notFound.title);
    expect(screen.getByText(en.receipt.notFound.detail)).toBeTruthy();
    expect(screen.queryByText("Meena Iyer")).toBeNull();
  });

  it("asks nothing when the address holds no token", async () => {
    window.history.pushState({}, "", "/r/short/");
    render(<PublicReceipt words={words} />);
    await screen.findByText(en.receipt.notFound.title);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the rate limit with no button", async () => {
    answer(429, { code: "rate_limited" });
    render(<PublicReceipt words={words} />);
    await screen.findByText(en.receipt.rateLimited.title);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows a failure with Try again, and Try again asks again from the address", async () => {
    answer(500, { code: "error" });
    render(<PublicReceipt words={words} />);
    await screen.findByText(en.receipt.failed.title);
    ok();
    await userEvent.setup().click(screen.getByRole("button", { name: en.receipt.failed.retry }));
    await screen.findByText("Meena Iyer");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ token: TOKEN });
  });

  it("shows a network failure as the same failure state", async () => {
    fetchMock = vi.fn(async () => Promise.reject(new TypeError("Failed to fetch")));
    vi.stubGlobal("fetch", fetchMock);
    render(<PublicReceipt words={words} />);
    await screen.findByText(en.receipt.failed.title);
  });

  it("uses the browser's language for the states that have no receipt", async () => {
    vi.spyOn(window.navigator, "languages", "get").mockReturnValue(["kn-IN"]);
    render(<PublicReceipt words={words} />);
    await waitFor(() => expect(screen.getByText(kn.receipt.notFound.title)).toBeTruthy());
    vi.restoreAllMocks();
  });

  it("never puts the token on the page, in the title, in storage or in a cookie", async () => {
    ok();
    const { container } = render(<PublicReceipt words={words} />);
    await screen.findByText("Meena Iyer");
    expect(document.documentElement.outerHTML).not.toContain(TOKEN);
    expect(container.innerHTML).not.toContain(TOKEN);
    expect(document.title).not.toContain(TOKEN);
    expect(document.cookie).toBe("");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
