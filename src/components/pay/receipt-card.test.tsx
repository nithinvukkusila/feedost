// Spec R1-7, criteria 18 and 19: one receipt on the tutor's phone, with the real English words.
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Payment } from "@/lib/payments";
import { renderWithWords } from "@/test-utils/render-with-words";
import { ReceiptCard } from "./receipt-card";

afterEach(cleanup);

// 12 Oct 2026, 10:30 in India.
const MADE = Date.UTC(2026, 9, 12, 5, 0);
const payment = (over: Partial<Payment> = {}): Payment => ({
  id: "p1", dueId: "d1", amount: 120000, method: "upi", paidOn: "2026-10-08", receiptNo: 215, balanceAfter: 0, createdAt: MADE, voidedAt: null, ...over,
});
const show = (p: Payment, lang: "en" | "hi" = "en", parent: string | null = "Suresh Kumar") =>
  renderWithWords(<ReceiptCard payment={p} tutorName="Meena Iyer" studentName="Ravi Kumar" parentName={parent} feeLabel="October 2026" />, lang);
const text = () => document.body.textContent ?? "";

describe("a paid receipt", () => {
  it("shows the number, month, amount as ₹1,200/-, method, date, Nil balance, names, the PAID stamp and the India time", () => {
    show(payment());
    expect(text()).toContain("Meena Iyer");
    expect(screen.getByText("Receipt no.")).toBeTruthy();
    expect(screen.getByText("215")).toBeTruthy();
    expect(text()).toContain("Date 08 Oct 2026");
    expect(text()).toContain("Ravi Kumar");
    expect(text()).toContain("Suresh Kumar");
    expect(text()).toContain("October 2026");
    expect(text()).toContain("UPI");
    expect(text()).toContain("₹1,200/-");
    expect(screen.getByText("Nil")).toBeTruthy();
    expect(screen.getByRole("img", { name: "PAID" }).textContent).toBe("PAID");
    expect(text()).toContain("Recorded 12 Oct 2026 10:30");
  });

  it("a part payment says PART PAID and what is left after it", () => {
    show(payment({ amount: 50000, balanceAfter: 70000, method: "cash" }));
    expect(screen.getByRole("img", { name: "PART PAID" })).toBeTruthy();
    expect(text()).toContain("₹700");
    expect(text()).toContain("Cash");
    expect(text()).toContain("₹500/-");
    expect(screen.queryByText("Nil")).toBeNull();
  });

  it("leaves out the parent when there is none", () => {
    show(payment(), "en", null);
    expect(screen.queryByText("Parent")).toBeNull();
  });
});

describe("a cancelled receipt (19)", () => {
  it("keeps its number, says CANCELLED, strikes the amount through and shows no balance", () => {
    show(payment({ voidedAt: MADE + 1000 }));
    expect(screen.getByRole("img", { name: "CANCELLED" })).toBeTruthy();
    expect(screen.getByText("215")).toBeTruthy();
    const amount = screen.getByText(/₹1,200/);
    expect(amount.className).toContain("line-through");
    expect(screen.queryByText("Balance")).toBeNull();
    expect(screen.queryByText("Nil")).toBeNull();
  });
});

describe("digits and wrapping", () => {
  it("amounts and the number are 0 to 9 in Hindi too, and nothing is cut", () => {
    show(payment({ amount: 123456700 }), "hi");
    expect(text()).toContain("₹12,34,567/-");
    expect(/[०-९]/.test(text())).toBe(false);
    expect(document.body.innerHTML).not.toMatch(/truncate|ellipsis|line-clamp/);
  });
});
