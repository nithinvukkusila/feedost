// Spec R1-3, criteria 36 to 38: Archive and Restore on the edit screen, and what it says when they do not go through.
import { cleanup, screen } from "@testing-library/react";
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
