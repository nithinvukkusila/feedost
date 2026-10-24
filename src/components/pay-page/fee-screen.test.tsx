// The fee page after consent (spec R1-9 Part B, criteria 22 to 28), with Pay, Copy and the fallbacks.
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { feeBody } from "@/lib/pay-page.test-util";
import { readPage, type ClaimOutcome, type FeePage } from "@/lib/pay-page-public";
import { FeeScreen } from "./fee-screen";

/** A paragraph or list item by its whole text, whatever spans a filled-in name is wrapped in. */
const text = (value: string) => screen.getByText((_, el) => (el?.tagName === "P" || el?.tagName === "LI") && el.textContent === value);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom does not open modal dialogs: these stand-ins flip `open` and fire `close` (as in sheet.test.tsx).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const page = (change: Partial<FeePage> = {}): FeePage => ({ ...(readPage({ code: "ok", page: feeBody }) as FeePage), ...change });
type Claim = { sendClaim?: (ref: string) => Promise<ClaimOutcome>; onReread?: () => void };
const show = (change: Partial<FeePage> = {}, onOpenNotice = () => {}, claim: Claim = {}) =>
  render(
    <FeeScreen
      words={en.payPage}
      consentLang="en"
      monthWords={en.receipt}
      page={page(change)}
      onOpenNotice={onOpenNotice}
      sendClaim={claim.sendClaim ?? (async () => ({ kind: "failed" }))}
      onReread={claim.onReread ?? (() => {})}
    />,
  );
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
    // R1-9's sentence, changed by R1-10 criterion 37 (not deleted): it now points to the "I've paid" button.
    expect(text("Paid already? Tell Meena Iyer.")).toBeTruthy();
    expect(screen.queryByText(/Your tutor marks it paid/)).toBeNull();
  });

  it("says 'your tutor' in that sentence when the tutor has no name (criterion 37)", () => {
    show({ tutorName: null });
    expect(text("Paid already? Tell your tutor.")).toBeTruthy();
  });

  it("shows no Pay button for no UPI ID, a zero total or a total over the ceiling, and says why", () => {
    show({ upiId: null });
    expect(screen.queryByRole("link", { name: /Pay/ })).toBeNull();
    expect(screen.getByText("Your tutor has not added a UPI ID yet. Ask them for payment details.")).toBeTruthy();
    cleanup();
    show({ totalRemaining: 100_000_001 });
    expect(screen.queryByRole("link", { name: /Pay/ })).toBeNull();
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

  it("has no QR button, and the 'I've paid' button below the Pay area (R1-10 criterion 30)", () => {
    const { container } = show();
    expect(screen.queryByRole("button", { name: /QR/i })).toBeNull();
    const button = screen.getByRole("button", { name: "I've paid" });
    expect(button.className).toContain("min-h-control");
    expect(button.className).toContain("bg-slip");
    // Below the Pay link and the fallbacks, in the order of the page.
    const pay = screen.getByRole("link", { name: "Pay ₹3,400 with UPI" });
    expect(pay.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.querySelector("[data-claim=pending]")).toBeNull();
  });

  it("draws the button with no UPI ID and above the ceiling too (something is owed), and not when all is paid", () => {
    show({ upiId: null });
    expect(screen.getByRole("button", { name: "I've paid" })).toBeTruthy();
    cleanup();
    show({ totalRemaining: 100_000_001 });
    expect(screen.getByRole("button", { name: "I've paid" })).toBeTruthy();
    cleanup();
    show({ totalRemaining: 0, openDues: [] });
    expect(screen.queryByRole("button", { name: "I've paid" })).toBeNull();
    expect(screen.queryByText(/Paid already/)).toBeNull();
  });

  it("replaces the button with the pending note while a claim waits, and keeps Pay (criterion 38)", () => {
    const { container } = show({ pendingClaim: { amount: 340000, submittedOn: "2026-10-11" } });
    expect(screen.queryByRole("button", { name: "I've paid" })).toBeNull();
    expect(screen.queryByText(/Paid already/)).toBeNull();
    const note = container.querySelector("[data-claim=pending]")!;
    expect(note.textContent).toBe("You told Meena Iyer on 11 Oct 2026 that you paid ₹3,400. She will confirm it.");
    const amount = Array.from(note.querySelectorAll("span")).find((el) => el.textContent === "₹3,400")!;
    expect(amount.className).toContain("type-amount-row");
    expect(amount.getAttribute("translate")).toBe("no");
    expect(screen.getByRole("link", { name: "Pay ₹3,400 with UPI" })).toBeTruthy();
  });

  it("opens the claim sheet on tap, with no request, and sends only through sendClaim", async () => {
    const sendClaim = vi.fn(async () => ({ kind: "ok" }) as ClaimOutcome);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    show({}, () => {}, { sendClaim });
    await userEvent.click(screen.getByRole("button", { name: "I've paid" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("UPI reference number · 12 digits")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(sendClaim).not.toHaveBeenCalled();
  });

  it("opens the privacy notice from its link", async () => {
    const onOpenNotice = vi.fn();
    show({}, onOpenNotice);
    await userEvent.click(screen.getByRole("button", { name: "Privacy notice" }));
    expect(onOpenNotice).toHaveBeenCalledTimes(1);
  });
});
