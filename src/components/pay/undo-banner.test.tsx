// Spec R1-7, criteria 14 and 15: the banner after a payment, with the board replaced by a controlled one.
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentError, type Payment } from "@/lib/payments";
import { renderWithWords } from "@/test-utils/render-with-words";
import type { Notice } from "@/components/board/board-store";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const board = vi.hoisted(() => ({ notice: null as unknown, applyVoid: vi.fn(), refresh: vi.fn(), showNotice: vi.fn(), clearNotice: vi.fn() }));
vi.mock("@/components/board/board-state", () => ({ useBoard: () => board }));
const voidPayment = vi.fn();
vi.mock("@/lib/payments", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/payments")>()), voidPayment: (...a: unknown[]) => voidPayment(...a) }));

import { UndoBanner } from "./undo-banner";

const payment: Payment = { id: "p1", dueId: "d1", amount: 120000, method: "upi", paidOn: "2026-10-12", receiptNo: 215, balanceAfter: 0, createdAt: Date.now(), voidedAt: null };
const paid = (until = Date.now() + 10_000): Notice => ({ kind: "paid", payment, name: "Ravi Kumar", until });

beforeEach(() => {
  [push, board.applyVoid, board.refresh, board.showNotice, board.clearNotice, voidPayment].forEach((m) => m.mockReset());
  board.notice = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("the banner", () => {
  it("keeps its live region with nothing in it", () => {
    renderWithWords(<UndoBanner today="2026-10-12" />);
    const region = document.querySelector("[aria-live]") as HTMLElement;
    expect(region).toBeTruthy();
    expect(region.textContent).toBe("");
  });

  it("says who was marked paid and how much, with Undo and Send receipt (a link to the receipt)", () => {
    board.notice = paid();
    renderWithWords(<UndoBanner today="2026-10-12" />);
    expect(screen.getByRole("status").textContent).toContain("Ravi Kumar marked paid, ₹1,200");
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Send receipt" }).getAttribute("href")).toBe("/en/receipt/?due=d1");
  });

  it("Undo voids the payment, patches the board, re-reads it and says it was undone", async () => {
    board.notice = paid();
    const voided = { ...payment, voidedAt: Date.now() };
    voidPayment.mockResolvedValue(voided);
    renderWithWords(<UndoBanner today="2026-10-12" />);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(board.showNotice).toHaveBeenCalledWith({ kind: "undone" }));
    expect(voidPayment).toHaveBeenCalledWith("p1");
    expect(board.applyVoid).toHaveBeenCalledWith(voided);
    expect(board.refresh).toHaveBeenCalledWith("2026-10-12");
  });

  it("a second tap while the undo is out does nothing", async () => {
    board.notice = paid();
    voidPayment.mockReturnValue(new Promise(() => {}));
    renderWithWords(<UndoBanner today="2026-10-12" />);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(voidPayment).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new PaymentError("offline"), "offline"],
    [new PaymentError("undo_window_over"), "late"],
    [new PaymentError("failed"), "failed"],
  ])("a failed undo (%s) shows a notice and changes nothing", async (error, reason) => {
    board.notice = paid();
    voidPayment.mockRejectedValue(error);
    renderWithWords(<UndoBanner today="2026-10-12" />);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(board.showNotice).toHaveBeenCalledWith({ kind: "undo-failed", reason }));
    expect(board.applyVoid).not.toHaveBeenCalled();
  });

  it("says Payment undone, and the failure words", () => {
    board.notice = { kind: "undone", until: Date.now() + 5000 };
    renderWithWords(<UndoBanner today="2026-10-12" />);
    expect(screen.getByRole("status").textContent).toBe("Payment undone");
    cleanup();
    board.notice = { kind: "undo-failed", reason: "failed", until: Date.now() + 5000 };
    renderWithWords(<UndoBanner today="2026-10-12" />);
    expect(screen.getByRole("alert").textContent).toContain("Couldn't undo. Nothing was changed. Try again.");
  });
});

describe("the ten seconds", () => {
  it("takes the notice down when its time is up, not before", async () => {
    vi.useFakeTimers();
    board.notice = paid(Date.now() + 10_000);
    renderWithWords(<UndoBanner today="2026-10-12" />);
    act(() => void vi.advanceTimersByTime(9_999));
    expect(board.clearNotice).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(board.clearNotice).toHaveBeenCalledTimes(1);
  });

  it("a notice that ended while the tutor was on another screen goes at once", () => {
    board.notice = paid(Date.now() - 1);
    renderWithWords(<UndoBanner today="2026-10-12" />);
    expect(board.clearNotice).toHaveBeenCalled();
  });
});
