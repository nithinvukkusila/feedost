// Spec R1-3, criteria 36 to 38: Archive and Restore on the edit screen, and what it says when they do not go through.
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Roster } from "@/components/app/roster";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), usePathname: () => "/en/students/edit/" }));
const held: { roster: Roster } = { roster: undefined as unknown as Roster };
vi.mock("@/components/app/roster", () => ({ useRoster: () => held.roster }));
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: { id: "u" }, setTutor: vi.fn() }) }));
const setActive = vi.fn();
vi.mock("@/lib/students", () => ({ setActive: (...a: unknown[]) => setActive(...a), createStudent: vi.fn(), updateStudent: vi.fn() }));

const readOpeningPaid = vi.fn();
vi.mock("@/lib/payments", () => ({ readOpeningPaid: (...a: unknown[]) => readOpeningPaid(...a) }));
const readOpeningClaimPending = vi.fn();
vi.mock("@/lib/claims", () => ({ readOpeningClaimPending: (...a: unknown[]) => readOpeningClaimPending(...a) }));

import { StudentEditScreen } from "./student-edit-screen";

const student = (active: boolean): Student => ({
  id: "s1", batchId: null, name: "Ravi Kumar", parentName: null, parentPhone: null,
  parentLanguage: "en", monthlyFee: 120000, openingBalance: 0, dueDay: 5, active,
});
const put = vi.fn();
const show = (active: boolean) => {
  held.roster = { status: "ready", students: [student(active)], batches: [], stale: false, reload: vi.fn(), put, putBatch: vi.fn(), removeBatch: vi.fn() };
  window.history.pushState({}, "", "/en/students/edit/?id=s1");
};

beforeEach(() => {
  push.mockReset();
  put.mockReset();
  setActive.mockReset();
  readOpeningPaid.mockReset().mockResolvedValue(false);
  readOpeningClaimPending.mockReset().mockResolvedValue(false);
});
afterEach(cleanup);

describe("archive and restore", () => {
  it("archives, puts the answered row in the roster and goes to the list", async () => {
    show(true);
    setActive.mockResolvedValue({ ok: true, student: { ...student(false) } });
    renderWithWords(<StudentEditScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Archive student" }));
    expect(setActive).toHaveBeenCalledWith("s1", false);
    expect(push).toHaveBeenCalledWith("/en/students/");
  });

  it("says nothing was saved when archiving fails, and stays", async () => {
    show(true);
    setActive.mockResolvedValue({ ok: false, reason: "failed" });
    renderWithWords(<StudentEditScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Archive student" }));
    expect(await screen.findByText(/Nothing was saved/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it("says nothing was saved when restoring fails, and stays", async () => {
    show(false);
    setActive.mockResolvedValue({ ok: false, reason: "failed" });
    renderWithWords(<StudentEditScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Restore student" }));
    expect(setActive).toHaveBeenCalledWith("s1", true);
    expect(await screen.findByText(/Nothing was saved/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("says the phone is offline", async () => {
    show(true);
    setActive.mockResolvedValue({ ok: false, reason: "offline" });
    renderWithWords(<StudentEditScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Archive student" }));
    expect(await screen.findByText("You are offline. Connect to the internet to save.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("says the student cannot be found when no row changed", async () => {
    show(true);
    setActive.mockResolvedValue({ ok: false, reason: "missing" });
    renderWithWords(<StudentEditScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Archive student" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't find this student");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("Already owes (R1-7, criterion 20)", () => {
  it("asks about this student's earlier balance and locks the field once something was paid against it", async () => {
    show(true);
    readOpeningPaid.mockResolvedValue(true);
    renderWithWords(<StudentEditScreen />);
    expect(await screen.findByText("A payment has been recorded against this, so it can't be changed")).toBeTruthy();
    expect(readOpeningPaid).toHaveBeenCalledWith("s1");
    expect((screen.getByLabelText("Already owes ₹") as HTMLTextAreaElement).readOnly).toBe(true);
  });

  it("holds the field until the read has answered", async () => {
    show(true);
    let answer: (paid: boolean) => void = () => {};
    readOpeningPaid.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
    renderWithWords(<StudentEditScreen />);
    const field = await screen.findByLabelText("Already owes ₹");
    expect((field as HTMLTextAreaElement).readOnly).toBe(true);
    answer(false);
    await waitFor(() => expect((screen.getByLabelText("Already owes ₹") as HTMLTextAreaElement).readOnly).toBe(false));
  });

  it("leaves it editable when nothing was paid", async () => {
    show(true);
    renderWithWords(<StudentEditScreen />);
    await screen.findByRole("button", { name: "Archive student" });
    expect(readOpeningPaid).toHaveBeenCalled();
    await waitFor(() => expect((screen.getByLabelText("Already owes ₹") as HTMLTextAreaElement).readOnly).toBe(false));
  });
});

describe("Already owes while a parent's claim waits (R1-10, section 17)", () => {
  const CLAIM_LINE = "A parent says this is paid, so it can't be changed. Open “to confirm” on Home, then tap Confirm paid or Not received.";
  const PAID_LINE = "A payment has been recorded against this, so it can't be changed";

  it("locks the field and says a claim is the reason", async () => {
    show(true);
    readOpeningClaimPending.mockResolvedValue(true);
    renderWithWords(<StudentEditScreen />);
    expect(await screen.findByText(CLAIM_LINE)).toBeTruthy();
    expect(readOpeningClaimPending).toHaveBeenCalledWith("s1");
    expect((screen.getByLabelText("Already owes ₹") as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.queryByText(PAID_LINE)).toBeNull();
  });

  it("shows the payment line, not the claim's, when both are true", async () => {
    show(true);
    readOpeningPaid.mockResolvedValue(true);
    readOpeningClaimPending.mockResolvedValue(true);
    renderWithWords(<StudentEditScreen />);
    expect(await screen.findByText(PAID_LINE)).toBeTruthy();
    expect(screen.queryByText(CLAIM_LINE)).toBeNull();
    expect((screen.getByLabelText("Already owes ₹") as HTMLTextAreaElement).readOnly).toBe(true);
  });

  it("holds the field until the claim read has answered too", async () => {
    show(true);
    let answer: (pending: boolean) => void = () => {};
    readOpeningClaimPending.mockReturnValue(new Promise<boolean>((resolve) => (answer = resolve)));
    renderWithWords(<StudentEditScreen />);
    const field = await screen.findByLabelText("Already owes ₹");
    await Promise.resolve();
    expect((field as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.queryByText(CLAIM_LINE)).toBeNull();
    answer(false);
    await waitFor(() => expect((screen.getByLabelText("Already owes ₹") as HTMLTextAreaElement).readOnly).toBe(false));
  });
});
