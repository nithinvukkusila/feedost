// The fee page after consent (spec R1-9 Part B, criteria 22 to 28), with Pay, Copy and the fallbacks.
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { feeBody } from "@/lib/pay-page.test-util";
import { readPage, type FeePage } from "@/lib/pay-page-public";
import { FeeScreen } from "./fee-screen";

/** A paragraph or list item by its whole text, whatever spans a filled-in name is wrapped in. */
const text = (value: string) => screen.getByText((_, el) => (el?.tagName === "P" || el?.tagName === "LI") && el.textContent === value);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const page = (change: Partial<FeePage> = {}): FeePage => ({ ...(readPage({ code: "ok", page: feeBody }) as FeePage), ...change });
const show = (change: Partial<FeePage> = {}, onOpenNotice = () => {}) =>
  render(<FeeScreen words={en.payPage} consentLang="en" monthWords={en.receipt} page={page(change)} onOpenNotice={onOpenNotice} />);
const clipboard = (writeText: (text: string) => Promise<void>) => vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });

describe("FeeScreen", () => {
  it("shows 'for {student}', the total as the headline and one line per open fee", () => {
    const { container } = show();
    expect(text("for Ravi Kumar")).toBeTruthy();
    expect(container.querySelector(".type-amount")?.textContent).toBe("₹3,400");
    const lines = within(container.querySelector("ul")!).getAllByRole("listitem");
    expect(lines).toHaveLength(3);
    expect(lines[0].textContent).toContain("Earlier balance");
    expect(lines[1].textContent).toContain("September 2026 fee, due 01 Sep 2026");
    expect(lines[1].textContent).toContain("₹200 already paid");
    expect(lines[2].textContent).toContain("October 2026 fee, due 20 Oct 2026");
  });

  it("marks late fees Overdue with the word and the mark, and a fee due today as Due today", () => {
    const { container } = show();
    expect([...container.querySelectorAll("[data-status=overdue]")].map((t) => t.textContent)).toEqual(["Overdue", "Overdue"]);
    cleanup();
    const today = show({ today: "2026-10-20" });
    expect(today.container.querySelector("[data-status=due]")?.textContent).toBe("Due today");
  });

  it("says 'and n more' when fees are beyond the list", () => {
    show({ openDuesMore: 7 });
    expect(text("and 7 more")).toBeTruthy();
  });

  it("has a Pay link to the UPI link with the total, and the notes under it", () => {
    show();
    const pay = screen.getByRole("link", { name: "Pay ₹3,400 with UPI" });
    expect(pay.getAttribute("href")).toBe("upi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Iyer&am=3400.00&cu=INR&tn=Fees%20due%20Ravi");
    expect(pay.getAttribute("target")).toBeNull();
    expect(pay.className).toContain("min-h-18");
    expect(pay.getAttribute("rel")).toBe("noopener noreferrer");
    // The amount in the label is its own span: mono face, never translated, never in the script face.
    const amount = Array.from(pay.querySelectorAll("span")).find((el) => el.textContent === "₹3,400")!;
    expect(amount.getAttribute("translate")).toBe("no");
    expect(amount.className).toContain("type-amount-row");
    expect(text("Your UPI app opens with the amount filled in. It goes straight to meena.tuitions@okhdfc.")).toBeTruthy();
    expect(screen.getByText("Paid already? Your tutor marks it paid and sends you a receipt.")).toBeTruthy();
  });

  it("shows no Pay button for no UPI ID, a zero total or a total over the ceiling, and says why", () => {
    show({ upiId: null });
    expect(screen.queryByRole("link", { name: /Pay/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /QR/ })).toBeNull();
    expect(screen.getByText("Your tutor has not added a UPI ID yet. Ask them for payment details.")).toBeTruthy();
    cleanup();
    show({ totalRemaining: 100_000_001 });
    expect(screen.queryByRole("link", { name: /Pay/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /QR/ })).toBeNull();
    expect(text("Pay ₹10,00,000.01 to this UPI ID in your UPI app.")).toBeTruthy();
    expect(screen.getByText("meena.tuitions@okhdfc")).toBeTruthy();
    cleanup();
    show({ totalRemaining: 0, openDues: [] });
    expect(screen.queryByRole("link", { name: /Pay/ })).toBeNull();
  });

  it("shows ALL PAID for nothing owed, with no Pay, Copy or QR, and keeps the receipts and the notice link", () => {
    show({ totalRemaining: 0, openDues: [] });
    expect(screen.getByRole("img", { name: "ALL PAID" })).toBeTruthy();
    expect(screen.getByText("Nothing to pay right now. Thank you.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Copy|QR/ })).toBeNull();
    expect(screen.getByText("Earlier receipts")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Privacy notice" })).toBeTruthy();
  });

  it("draws Copy UPI ID only when the browser can copy, and copies exactly the UPI ID", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    show();
    expect(screen.queryByRole("button", { name: "Copy UPI ID" })).toBeNull();
    expect(screen.queryByText(/UPI app did not open/)).toBeNull();
    cleanup();
    const writeText = vi.fn(async () => {});
    clipboard(writeText);
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Copy UPI ID" }));
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("meena.tuitions@okhdfc");
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    expect(screen.getByText("UPI app did not open? Use one of these.")).toBeTruthy();
  });

  it("does nothing noisy when the browser refuses to copy", async () => {
    clipboard(async () => {
      throw new Error("denied");
    });
    show();
    await userEvent.click(await screen.findByRole("button", { name: "Copy UPI ID" }));
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
    expect(screen.getByRole("button", { name: "Copy UPI ID" })).toBeTruthy();
  });

  it("has no 'I've paid' button", () => {
    show();
    expect(screen.queryByText(/I've paid|I've already paid/i)).toBeNull();
  });

  it("opens the privacy notice from its link", async () => {
    const onOpenNotice = vi.fn();
    show({}, onOpenNotice);
    await userEvent.click(screen.getByRole("button", { name: "Privacy notice" }));
    expect(onOpenNotice).toHaveBeenCalledTimes(1);
  });
});
