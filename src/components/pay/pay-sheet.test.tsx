// Spec R1-7, criteria 12 to 17, 21 and 22: the Mark paid sheet with the real English words and the payments
// module replaced by controllable answers.
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Due } from "@/lib/dues";
import { dueState } from "@/lib/dues-board";
import type { Payment } from "@/lib/payments";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

const recordPayment = vi.fn();
vi.mock("@/lib/payments", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/payments")>()), recordPayment: (...a: unknown[]) => recordPayment(...a) }));

import { PaymentError } from "@/lib/payments";
import PaySheet from "./pay-sheet";

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

const student: Student = {
  id: "s1", batchId: "b1", name: "Ravi Kumar", parentName: "Suresh", parentPhone: null, parentLanguage: "en",
  monthlyFee: 120000, openingBalance: 0, dueDay: 5, active: true,
};
const TODAY = "2026-10-12";
const baseDue: Due = { id: "d1", studentId: "s1", kind: "monthly", month: "2026-10-01", amount: 120000, amountPaid: 0, status: "due", dueDate: "2026-10-05" };
const row = (over: Partial<Due> = {}) => {
  const due = { ...baseDue, ...over };
  return { due, student, state: dueState(due, TODAY) };
};
const payment: Payment = { id: "p1", dueId: "d1", amount: 120000, method: "upi", paidOn: TODAY, receiptNo: 4, balanceAfter: 0, createdAt: Date.now(), voidedAt: null };

const onClose = vi.fn();
const onPaid = vi.fn();
const onStale = vi.fn();
const show = (over: Partial<Due> = {}, lang: "en" | "hi" = "en") =>
  renderWithWords(<PaySheet row={row(over)} batchName="Class 10 Maths" today={TODAY} onClose={onClose} onPaid={onPaid} onStale={onStale} />, lang);
const amount = () => screen.getByLabelText(/Amount received/) as HTMLTextAreaElement;
const submit = () => userEvent.click(screen.getByRole("button", { name: "Mark as paid" }));
const onLine = (value: boolean) => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });

beforeEach(() => {
  [recordPayment, onClose, onPaid, onStale].forEach((m) => m.mockReset());
  onLine(true);
});
afterEach(cleanup);

describe("what the sheet shows (12)", () => {
  it("names the student and the month, and starts with what is left, Full chosen, UPI and Today", () => {
    show();
    expect(screen.getByRole("dialog", { name: "Mark paid" })).toBeTruthy();
    expect(screen.getByText("Ravi Kumar")).toBeTruthy();
    expect(screen.getByText("October")).toBeTruthy();
    expect(screen.getByText("Class 10 Maths")).toBeTruthy();
    expect(amount().value).toBe("1,200");
    expect(screen.getByRole("button", { name: "Full ₹1,200" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Half ₹600" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Other" }).getAttribute("aria-pressed")).toBe("false");
    expect((screen.getByRole("radio", { name: "UPI" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual(["upi", "cash", "today", "yesterday", "pick"]);
    expect((screen.getByRole("radio", { name: "Today" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("button", { name: "Mark as paid" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("an earlier balance says so; a part paid fee starts at what is left", () => {
    show({ kind: "opening", month: null, amount: 240000, amountPaid: 100000, status: "partial" });
    expect(screen.getByText("Earlier balance")).toBeTruthy();
    expect(amount().value).toBe("1,400");
  });

  it("hides Half when it would be under ₹1", () => {
    show({ amount: 100, amountPaid: 0 });
    expect(screen.queryByRole("button", { name: /Half/ })).toBeNull();
  });

  it("is in Hindi with the real words and the digits stay 0 to 9", () => {
    show({}, "hi");
    expect(amount().value).toBe("1,200");
    expect(/[०-९]/.test(document.body.textContent ?? "")).toBe(false);
  });
});

describe("the amount (13)", () => {
  it("Half sets half, Full sets what is left, typing moves the chip to Other, Other clears", async () => {
    show();
    await userEvent.click(screen.getByRole("button", { name: "Half ₹600" }));
    expect(amount().value).toBe("600");
    expect(screen.getByRole("button", { name: "Half ₹600" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Full ₹1,200" }));
    expect(amount().value).toBe("1,200");
    await userEvent.clear(amount());
    await userEvent.type(amount(), "500");
    expect(screen.getByRole("button", { name: "Other" }).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Full ₹1,200" }));
    await userEvent.click(screen.getByRole("button", { name: "Other" }));
    expect(amount().value).toBe("");
  });

  it("has a numeric keypad and the rupee sign in its label", () => {
    show();
    expect(amount().getAttribute("inputmode")).toBe("numeric");
    expect(screen.getByText("Amount received ₹")).toBeTruthy();
  });

  it.each([
    ["", "Enter an amount of ₹1 or more"],
    ["0", "Enter an amount of ₹1 or more"],
    ["abc", "Use digits only, in whole rupees"],
    ["12.5", "Use digits only, in whole rupees"],
    ["1,201", "Only ₹1,200 is left on this fee"],
    ["99,999", "Only ₹1,200 is left on this fee"],
  ])("refuses %j with a message beside the field and sends nothing", async (text, message) => {
    show();
    await userEvent.clear(amount());
    if (text) await userEvent.type(amount(), text);
    await submit();
    expect(screen.getByText(message)).toBeTruthy();
    expect(amount().getAttribute("aria-invalid")).toBe("true");
    expect(recordPayment).not.toHaveBeenCalled();
  });
});

describe("the date (4)", () => {
  it("Yesterday is the day before India's today; Pick date shows a date field limited to the last 90 days", async () => {
    recordPayment.mockResolvedValue(payment);
    show();
    await userEvent.click(screen.getByRole("radio", { name: "Yesterday" }));
    await submit();
    await waitFor(() => expect(recordPayment).toHaveBeenCalled());
    expect(recordPayment.mock.calls[0][0]).toMatchObject({ paidOn: "2026-10-11" });
    cleanup();
    show();
    await userEvent.click(screen.getByRole("radio", { name: "Pick date" }));
    const picker = screen.getByLabelText("Date paid") as HTMLInputElement;
    expect(picker.type).toBe("date");
    expect(picker.min).toBe("2026-07-14");
    expect(picker.max).toBe("2026-10-12");
    expect(picker.value).toBe("2026-10-12");
    expect(screen.getByText("12 Oct 2026")).toBeTruthy();
  });

  it("refuses a day in the future or more than 90 days back, and an empty day", async () => {
    show();
    await userEvent.click(screen.getByRole("radio", { name: "Pick date" }));
    const picker = screen.getByLabelText("Date paid") as HTMLInputElement;
    for (const [value, message] of [
      ["2026-10-13", "Pick a date that is not in the future"],
      ["2026-07-13", "Pick a date within the last 90 days"],
      ["", "Pick the date it was paid"],
    ] as const) {
      await userEvent.clear(picker);
      if (value) await userEvent.type(picker, value);
      await submit();
      expect(screen.getByText(message)).toBeTruthy();
    }
    expect(recordPayment).not.toHaveBeenCalled();
  });
});

describe("recording (14, 16, 17)", () => {
  it("sends the due, amount in paise, method, day and one request id, then reports the payment and closes", async () => {
    recordPayment.mockResolvedValue(payment);
    show();
    await userEvent.click(screen.getByRole("radio", { name: "Cash" }));
    await userEvent.click(screen.getByRole("button", { name: "Half ₹600" }));
    await submit();
    await waitFor(() => expect(onPaid).toHaveBeenCalledWith(payment));
    expect(recordPayment).toHaveBeenCalledTimes(1);
    expect(recordPayment.mock.calls[0][0]).toEqual({ dueId: "d1", amount: 60000, method: "cash", paidOn: TODAY, requestId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    expect(onClose).toHaveBeenCalled();
  });

  it("shows Saving…, ignores a second tap, and shows nothing as paid before the answer", async () => {
    let finish: (value: unknown) => void = () => {};
    recordPayment.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    show();
    await submit();
    const busy = screen.getByRole("button", { name: "Saving…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(busy);
    await userEvent.click(busy);
    expect(recordPayment).toHaveBeenCalledTimes(1);
    expect(onPaid).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => finish(payment));
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it("a failure keeps the sheet open with the typed values, says nothing was recorded, and Try again reuses the request id", async () => {
    recordPayment.mockRejectedValueOnce(new PaymentError("failed")).mockResolvedValueOnce(payment);
    show();
    await userEvent.click(screen.getByRole("radio", { name: "Cash" }));
    await userEvent.clear(amount());
    await userEvent.type(amount(), "700");
    await submit();
    expect(await screen.findByText("Couldn't save. Nothing was recorded. Try again.")).toBeTruthy();
    expect(amount().value).toBe("700");
    expect((screen.getByRole("radio", { name: "Cash" }) as HTMLInputElement).checked).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await submit();
    await waitFor(() => expect(onPaid).toHaveBeenCalled());
    expect(recordPayment.mock.calls[1][0].requestId).toBe(recordPayment.mock.calls[0][0].requestId);
  });

  it("offline: the button works, says so, keeps the values; back online Try again sends", async () => {
    recordPayment.mockRejectedValueOnce(new PaymentError("offline")).mockResolvedValueOnce(payment);
    onLine(false);
    show();
    await userEvent.clear(amount());
    await userEvent.type(amount(), "300");
    await submit();
    expect(await screen.findByText("You are offline. Payments need a connection for now. Nothing was saved.")).toBeTruthy();
    expect(amount().value).toBe("300");
    onLine(true);
    await submit();
    await waitFor(() => expect(onPaid).toHaveBeenCalled());
  });

  it("another phone paid some: says how much is left, asks the board to read again, keeps what was typed", async () => {
    recordPayment.mockRejectedValue(new PaymentError("amount_over_remaining", 70000));
    show();
    await submit();
    expect(await screen.findByText("Only ₹700 is left on this fee")).toBeTruthy();
    expect(onStale).toHaveBeenCalledTimes(1);
    expect(amount().value).toBe("1,200");
    expect(onPaid).not.toHaveBeenCalled();
    // Typing again clears the old message.
    await userEvent.clear(amount());
    await userEvent.type(amount(), "700");
    expect(screen.queryByText("Only ₹700 is left on this fee")).toBeNull();
  });

  it.each([
    ["date_out_of_range", "That date was refused. Check the date on your phone, or pick another date."],
    ["already_paid", "This fee is already paid in full. Nothing was recorded."],
    ["student_archived", "This student is archived. Restore the student to record a payment."],
    ["request_reused", "This may already be saved. Close this and check the fee on the board before trying again."],
    ["not_signed_in", "You were signed out. Sign in again. Nothing was recorded."],
    ["due_not_found", "Couldn't save. Nothing was recorded. Try again."],
  ] as const)("%s has its own words", async (code, words) => {
    recordPayment.mockRejectedValue(new PaymentError(code));
    show();
    await submit();
    expect(await screen.findByText(words)).toBeTruthy();
    expect(onPaid).not.toHaveBeenCalled();
  });

  it("says it is still trying after 20 seconds, and keeps waiting", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      recordPayment.mockReturnValue(new Promise(() => {}));
      show();
      await submit();
      expect(screen.queryByText(/Still trying/)).toBeNull();
      await act(async () => void vi.advanceTimersByTime(20_000));
      expect(screen.getByText("Still trying. Please wait. It will not be saved twice.")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
