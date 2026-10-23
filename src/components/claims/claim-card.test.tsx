// Spec R1-10, criteria 18 to 23: one claim card with the two database functions replaced.
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimError, type Claim } from "@/lib/claims";
import type { Payment } from "@/lib/payments";
import { renderWithWords } from "@/test-utils/render-with-words";

const confirmClaim = vi.fn();
const rejectClaim = vi.fn();
const readPaymentsByReceipt = vi.fn();
vi.mock("@/lib/claims", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/claims")>()),
  confirmClaim: (...a: unknown[]) => confirmClaim(...a),
  rejectClaim: (...a: unknown[]) => rejectClaim(...a),
}));
vi.mock("@/lib/payments", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/payments")>()), readPaymentsByReceipt: (...a: unknown[]) => readPaymentsByReceipt(...a) }));

import { ClaimCard, type ClaimCardProps } from "./claim-card";

const claim: Claim = {
  id: "c1",
  studentId: "s1",
  dueId: "d1",
  amount: 120000,
  feeCount: 1,
  upiRef: "628104739915",
  screenshotPath: null,
  status: "pending",
  createdAt: Date.parse("2026-10-12T05:00:00Z"),
  handledAt: null,
  receiptFrom: null,
  receiptCount: null,
};
const done: Claim = { ...claim, status: "confirmed", handledAt: Date.parse("2026-10-12T05:05:00Z"), receiptFrom: 214, receiptCount: 1 };
const payment: Payment = { id: "p1", dueId: "d1", amount: 120000, method: "upi", paidOn: "2026-10-12", receiptNo: 214, balanceAfter: 0, createdAt: 1, voidedAt: null };

const handlers = { onConfirmed: vi.fn(), onRejected: vi.fn(), onHandledElsewhere: vi.fn() };
function draw(over: Partial<ClaimCardProps> = {}) {
  return renderWithWords(<ClaimCard claim={claim} name="Ravi Kumar" archived={false} tooOld={false} when="Today 4:12 pm" fee="October" {...handlers} {...over} />);
}
const confirmButton = () => screen.getByRole("button", { name: /^(Confirm paid|Saving…)$/ });

beforeEach(() => {
  [confirmClaim, rejectClaim, readPaymentsByReceipt, ...Object.values(handlers)].forEach((m) => m.mockReset());
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("what the card shows", () => {
  it("is named as the PRD's notification, and shows the time, fee, name, amount and the reference in groups of four", () => {
    draw();
    expect(screen.getByRole("article", { name: "Ravi Kumar's parent says ₹1,200 paid. Confirm?" })).toBeTruthy();
    expect(screen.getByText("Today 4:12 pm")).toBeTruthy();
    expect(screen.getByText("October")).toBeTruthy();
    expect(screen.getByText("₹1,200")).toBeTruthy();
    expect(screen.getByText("6281 0473 9915")).toBeTruthy();
    expect(screen.getByText("UPI reference")).toBeTruthy();
  });

  it("a screenshot-only claim says Screenshot and has no Copy", () => {
    draw({ claim: { ...claim, upiRef: null, screenshotPath: "t/f.jpg" } });
    expect(screen.getByText("Screenshot")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Copy/ })).toBeNull();
  });

  it("Copy puts the 12 digits on the clipboard, says Copied, and goes back after two seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    // userEvent puts its own clipboard in place; what was written is read back from it.
    draw();
    await user.click(await screen.findByRole("button", { name: /Copy/ }));
    expect(await navigator.clipboard.readText()).toBe("628104739915");
    expect(screen.getByText("Copied")).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2100);
    });
    expect(screen.getByText("Copy")).toBeTruthy();
  });

  it("has no Copy button when the browser has no clipboard", () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    draw();
    expect(screen.queryByRole("button", { name: /Copy/ })).toBeNull();
  });
});

describe("Confirm paid", () => {
  it("says Saving…, ignores a second tap, and hands the claim and its payments up only after the database answered", async () => {
    let finish: (c: Claim) => void = () => {};
    confirmClaim.mockReturnValue(new Promise<Claim>((resolve) => (finish = resolve)));
    readPaymentsByReceipt.mockResolvedValue([payment]);
    draw();
    await userEvent.click(confirmButton());
    await userEvent.click(confirmButton());
    expect(confirmClaim).toHaveBeenCalledTimes(1);
    expect(confirmButton().textContent).toBe("Saving…");
    expect(handlers.onConfirmed).not.toHaveBeenCalled();
    finish(done);
    await waitFor(() => expect(handlers.onConfirmed).toHaveBeenCalledWith(done, [payment]));
    expect(readPaymentsByReceipt).toHaveBeenCalledWith(214, 1);
  });

  it("still confirms when the payments cannot be read just then", async () => {
    confirmClaim.mockResolvedValue(done);
    readPaymentsByReceipt.mockRejectedValue(new Error("x"));
    draw();
    await userEvent.click(confirmButton());
    await waitFor(() => expect(handlers.onConfirmed).toHaveBeenCalledWith(done, []));
  });

  it("a failure keeps the card, says nothing was recorded, and Try again sends the same request id", async () => {
    confirmClaim.mockRejectedValueOnce(new ClaimError("failed")).mockResolvedValueOnce(done);
    readPaymentsByReceipt.mockResolvedValue([payment]);
    draw();
    await userEvent.click(confirmButton());
    expect((await screen.findByRole("alert")).textContent).toContain("Couldn't save. Nothing was recorded. Try again.");
    await userEvent.click(confirmButton());
    await waitFor(() => expect(handlers.onConfirmed).toHaveBeenCalled());
    const ids = confirmClaim.mock.calls.map((c) => (c[0] as { requestId: string }).requestId);
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBe(ids[0]);
  });

  it("offline: says so in R1-7's words and the card stays", async () => {
    confirmClaim.mockRejectedValue(new ClaimError("offline"));
    draw();
    await userEvent.click(confirmButton());
    expect((await screen.findByRole("status")).textContent).toContain("You are offline. Payments need a connection for now. Nothing was saved.");
    expect(handlers.onConfirmed).not.toHaveBeenCalled();
  });

  it("only part is open now: says how much, in rupees from the database", async () => {
    confirmClaim.mockRejectedValue(new ClaimError("amount_over_remaining", 50000));
    draw();
    await userEvent.click(confirmButton());
    expect((await screen.findByRole("alert")).textContent).toContain("Only ₹500 is open now. Mark it paid yourself or tap Not received.");
    // A clean refusal saved nothing, so the next try gets a new request id.
    confirmClaim.mockRejectedValue(new ClaimError("amount_over_remaining", 50000));
    await userEvent.click(confirmButton());
    await waitFor(() => expect(confirmClaim).toHaveBeenCalledTimes(2));
    const ids = confirmClaim.mock.calls.map((c) => (c[0] as { requestId: string }).requestId);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("already handled elsewhere: says so, offers no more buttons, and tells the list to read again", async () => {
    confirmClaim.mockRejectedValue(new ClaimError("already_handled"));
    draw();
    await userEvent.click(confirmButton());
    expect((await screen.findByRole("alert")).textContent).toContain("Already handled.");
    expect(handlers.onHandledElsewhere).toHaveBeenCalledWith(claim);
    expect(screen.queryByRole("button", { name: "Confirm paid" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Not received" })).toBeNull();
  });

  it("an archived student: Confirm is disabled with the reason; Not received still works", async () => {
    rejectClaim.mockResolvedValue({ ...claim, status: "rejected", handledAt: 1 });
    draw({ archived: true });
    const confirm = screen.getByRole("button", { name: "Confirm paid" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect(screen.getByText("Ravi Kumar is archived. Restore the student to confirm.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Not received" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, not received" }));
    await waitFor(() => expect(handlers.onRejected).toHaveBeenCalled());
  });

  it("sent over 90 days ago: Confirm is disabled with the reason", () => {
    draw({ tooOld: true });
    expect((screen.getByRole("button", { name: "Confirm paid" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("This was sent over 90 days ago. Use Mark paid on the fee.")).toBeTruthy();
  });

  it("the database finding it out: archived or too old turns Confirm off and keeps the message", async () => {
    confirmClaim.mockRejectedValue(new ClaimError("date_out_of_range"));
    draw();
    await userEvent.click(confirmButton());
    await waitFor(() => expect((screen.getByRole("button", { name: "Confirm paid" }) as HTMLButtonElement).disabled).toBe(true));
    // Shown once, as Confirm's reason; the live region only announces it (no second banner).
    const lines = screen.getAllByText("This was sent over 90 days ago. Use Mark paid on the fee.");
    expect(lines.filter((el) => !el.classList.contains("sr-only"))).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("an archived refusal from the database shows its sentence once, too", async () => {
    confirmClaim.mockRejectedValue(new ClaimError("student_archived"));
    draw();
    await userEvent.click(confirmButton());
    await waitFor(() => expect((screen.getByRole("button", { name: "Confirm paid" }) as HTMLButtonElement).disabled).toBe(true));
    const lines = screen.getAllByText("Ravi Kumar is archived. Restore the student to confirm.");
    expect(lines.filter((el) => !el.classList.contains("sr-only"))).toHaveLength(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Not received", () => {
  it("asks once, and Cancel changes nothing", async () => {
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Not received" }));
    expect(screen.getByRole("alert").textContent).toBe("Not received? Ravi Kumar's parent will not be told.");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(rejectClaim).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Confirm paid" })).toBeTruthy();
  });

  it("on yes, rejects the claim and hands the answer up; no payment is read or made", async () => {
    const rejected = { ...claim, status: "rejected" as const, handledAt: 1 };
    rejectClaim.mockResolvedValue(rejected);
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Not received" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, not received" }));
    await waitFor(() => expect(handlers.onRejected).toHaveBeenCalledWith(rejected));
    expect(rejectClaim).toHaveBeenCalledWith("c1");
    expect(confirmClaim).not.toHaveBeenCalled();
    expect(readPaymentsByReceipt).not.toHaveBeenCalled();
  });

  it("offline: says so and sends nothing more", async () => {
    rejectClaim.mockRejectedValue(new ClaimError("offline"));
    draw();
    await userEvent.click(screen.getByRole("button", { name: "Not received" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, not received" }));
    expect((await screen.findByRole("status")).textContent).toContain("You are offline");
    expect(handlers.onRejected).not.toHaveBeenCalled();
  });
});
