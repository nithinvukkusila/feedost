// Spec R1-7, criteria 18 and 19: the tutor's receipt screen: what it reads, the order, the undo and its window.
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Roster } from "@/components/app/roster";
import type { Due } from "@/lib/dues";
import { PaymentError, type Payment } from "@/lib/payments";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/en/receipt/" }));
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: { id: "t", name: "Meena Iyer" }, setTutor: vi.fn() }) }));
const held: { roster: Roster } = { roster: undefined as unknown as Roster };
vi.mock("@/components/app/roster", () => ({ useRoster: () => held.roster }));
const applyVoid = vi.fn();
vi.mock("@/components/board/board-state", () => ({ useBoard: () => ({ applyVoid }) }));
const dueParam = vi.hoisted(() => ({ value: "d1" as string | null }));
vi.mock("@/components/app/read-id", () => ({ useQueryParam: () => dueParam.value }));
const readDue = vi.fn();
vi.mock("@/lib/dues", () => ({ readDue: (...a: unknown[]) => readDue(...a) }));
const readPaymentsOfDue = vi.fn();
const voidPayment = vi.fn();
vi.mock("@/lib/payments", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/payments")>()),
  readPaymentsOfDue: (...a: unknown[]) => readPaymentsOfDue(...a),
  voidPayment: (...a: unknown[]) => voidPayment(...a),
}));

import { ReceiptScreen } from "./receipt-screen";

const student: Student = {
  id: "s1", batchId: null, name: "Ravi Kumar", parentName: "Suresh Kumar", parentPhone: null, parentLanguage: "en",
  monthlyFee: 120000, openingBalance: 0, dueDay: 5, active: true,
};
const due = (over: Partial<Due> = {}): Due => ({ id: "d1", studentId: "s1", kind: "monthly", month: "2026-10-01", amount: 120000, amountPaid: 120000, status: "paid", dueDate: "2026-10-05", ...over });
const hour = 3_600_000;
const pay = (over: Partial<Payment>): Payment => ({
  id: "p", dueId: "d1", amount: 70000, method: "upi", paidOn: "2026-10-12", receiptNo: 2, balanceAfter: 0, createdAt: Date.now() - hour, voidedAt: null, ...over,
});

beforeEach(() => {
  [readDue, readPaymentsOfDue, voidPayment, applyVoid].forEach((m) => m.mockReset());
  dueParam.value = "d1";
  held.roster = { status: "ready", students: [student], batches: [], stale: false, reload: vi.fn(), put: vi.fn(), putBatch: vi.fn(), removeBatch: vi.fn() };
});
afterEach(cleanup);

describe("the screen", () => {
  it("lists every payment on the fee, newest first, with the fee's balance now", async () => {
    readDue.mockResolvedValue(due());
    readPaymentsOfDue.mockResolvedValue([pay({ id: "p2", receiptNo: 2 }), pay({ id: "p1", receiptNo: 1, amount: 50000, balanceAfter: 70000 })]);
    renderWithWords(<ReceiptScreen />);
    await screen.findByText("Receipt");
    expect(readDue).toHaveBeenCalledWith("d1");
    expect(readPaymentsOfDue).toHaveBeenCalledWith("d1");
    const numbers = screen.getAllByText(/^[12]$/).map((n) => n.textContent);
    expect(numbers).toEqual(["2", "1"]);
    expect(screen.getByText(/Balance on this fee now/).textContent).toContain("Nil");
    expect(screen.getByRole("link", { name: "Back to fees" }).getAttribute("href")).toBe("/en/home/");
  });

  it("an earlier balance is named as such", async () => {
    readDue.mockResolvedValue(due({ kind: "opening", month: null }));
    readPaymentsOfDue.mockResolvedValue([pay({})]);
    renderWithWords(<ReceiptScreen />);
    await screen.findByText("Receipt");
    expect(screen.getAllByText("Earlier balance").length).toBeGreaterThan(0);
  });

  it("a fee that is not there, or no address, says so", async () => {
    readDue.mockResolvedValue(null);
    readPaymentsOfDue.mockResolvedValue([]);
    renderWithWords(<ReceiptScreen />);
    expect(await screen.findByText("Couldn't find this fee")).toBeTruthy();
    cleanup();
    dueParam.value = null;
    renderWithWords(<ReceiptScreen />);
    expect(await screen.findByText("Couldn't find this fee")).toBeTruthy();
  });

  it("a failed read says nothing is lost and Try again reads again", async () => {
    readDue.mockRejectedValueOnce(new Error("x")).mockResolvedValue(due());
    readPaymentsOfDue.mockResolvedValue([pay({})]);
    renderWithWords(<ReceiptScreen />);
    expect(await screen.findByText("Couldn't load the receipt. Nothing is lost.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Receipt");
  });
});

describe("Undo this payment (18)", () => {
  it("is offered within 24 hours, asks once, then cancels the receipt and tells the board", async () => {
    readDue.mockResolvedValue(due({ amountPaid: 70000, status: "partial" }));
    const live = pay({ id: "p2", createdAt: Date.now() - 23 * hour });
    readPaymentsOfDue.mockResolvedValue([live]);
    voidPayment.mockResolvedValue({ ...live, voidedAt: Date.now() });
    renderWithWords(<ReceiptScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Undo this payment" }));
    expect(voidPayment).not.toHaveBeenCalled();
    expect(screen.getByText("Undo this payment? The receipt will be cancelled.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(screen.queryByText("Undo this payment? The receipt will be cancelled.")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Undo this payment" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, undo it" }));
    await waitFor(() => expect(voidPayment).toHaveBeenCalledWith("p2"));
    await screen.findByRole("img", { name: "CANCELLED" });
    expect(applyVoid).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Undo this payment" })).toBeNull();
    expect(screen.getByText(/Balance on this fee now/).textContent).toContain("₹1,200");
  });

  it("is not offered after 24 hours or on a cancelled receipt, with no explanation", async () => {
    readDue.mockResolvedValue(due());
    readPaymentsOfDue.mockResolvedValue([
      pay({ id: "p3", receiptNo: 3, createdAt: Date.now() - 25 * hour }),
      pay({ id: "p2", receiptNo: 2, voidedAt: Date.now() - hour }),
    ]);
    renderWithWords(<ReceiptScreen />);
    await screen.findByText("Receipt");
    expect(screen.queryByRole("button", { name: /Undo/ })).toBeNull();
    expect(screen.getByRole("img", { name: "CANCELLED" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "PAID" })).toBeTruthy();
  });

  it("a refused undo says nothing was changed, and offline says so", async () => {
    readDue.mockResolvedValue(due());
    readPaymentsOfDue.mockResolvedValue([pay({ id: "p2" })]);
    voidPayment.mockRejectedValueOnce(new PaymentError("failed")).mockRejectedValueOnce(new PaymentError("offline")).mockRejectedValueOnce(new PaymentError("undo_window_over"));
    renderWithWords(<ReceiptScreen />);
    const ask = async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Undo this payment" }));
      await userEvent.click(screen.getByRole("button", { name: "Yes, undo it" }));
    };
    await ask();
    expect(await screen.findByText("Couldn't undo. Nothing was changed. Try again.")).toBeTruthy();
    await ask();
    expect(await screen.findByText("You are offline. Payments need a connection for now. Nothing was saved.")).toBeTruthy();
    await ask();
    expect(await screen.findByText("This payment can no longer be undone.")).toBeTruthy();
    expect(applyVoid).not.toHaveBeenCalled();
    await act(async () => {});
  });
});
