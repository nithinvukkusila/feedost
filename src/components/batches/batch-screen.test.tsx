// Spec R1-3, criteria 42 to 47: one batch (rename, timings, totals, its students, add, delete), with the real
// English words, over a controlled roster.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Roster } from "@/components/app/roster";
import type { Batch } from "@/lib/batches";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), usePathname: () => "/en/batches/edit/" }));
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: { id: "u" }, setTutor: vi.fn() }) }));
const held: { roster: Roster } = { roster: undefined as unknown as Roster };
vi.mock("@/components/app/roster", () => ({ useRoster: () => held.roster }));
const updateBatch = vi.fn();
const deleteBatch = vi.fn();
vi.mock("@/lib/batches", () => ({ updateBatch: (...args: unknown[]) => updateBatch(...args), deleteBatch: (id: string) => deleteBatch(id) }));

import { BatchScreen } from "./batch-screen";

// jsdom does not open modal dialogs (see sheet.test.tsx).
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

const student = (id: string, batchId: string | null, fee: number, active = true): Student => ({
  id,
  batchId,
  name: `Student ${id}`,
  parentName: null,
  parentPhone: null,
  parentLanguage: "en",
  monthlyFee: fee,
  openingBalance: 0,
  dueDay: 5,
  active,
});
const batch = (id: string, name: string, timings: string | null = null): Batch => ({ id, name, timings });
const putBatch = vi.fn();
const removeBatch = vi.fn();

function roster(over: Partial<Roster> = {}) {
  held.roster = {
    status: "ready",
    students: [student("a", "b1", 120000), student("b", "b1", 150000), student("c", "b1", 999900, false), student("d", "b2", 100000)],
    batches: [batch("b1", "Class 10 Maths", "Mon 5 pm"), batch("b2", "Class 8 Science")],
    stale: false,
    reload: vi.fn(),
    put: vi.fn(),
    putBatch,
    removeBatch,
    ...over,
  };
}
const open = (id: string | null = "b1") => window.history.pushState({}, "", id === null ? "/en/batches/edit/" : `/en/batches/edit/?id=${id}`);

beforeEach(() => {
  push.mockReset();
  updateBatch.mockReset();
  deleteBatch.mockReset();
  putBatch.mockReset();
  removeBatch.mockReset();
  roster();
  open();
});
afterEach(cleanup);

describe("what it shows (42, 43, 47)", () => {
  it("shows the name as the title, the timings, the count and total of active students only, and the students", async () => {
    renderWithWords(<BatchScreen />);
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe("Class 10 Maths");
    expect((screen.getByLabelText("Timings (optional)") as HTMLTextAreaElement).value).toBe("Mon 5 pm");
    expect(screen.getByText("2 students")).toBeTruthy();
    expect(screen.getByText("₹2,700")).toBeTruthy();
    expect(screen.getByText(/each month/)).toBeTruthy();
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/students/edit/"));
    expect(links.map((link) => link.textContent)).toEqual([expect.stringContaining("Student a"), expect.stringContaining("Student b")]);
    expect(links[0].textContent).toContain("₹1,200 on the 5th");
    expect(screen.queryByText(/Pending/i)).toBeNull();
    expect(screen.queryByText(/attendance/i)).toBeNull();
  });

  it("says no students yet and has a black Add a student link that carries the batch", async () => {
    roster({ students: [] });
    renderWithWords(<BatchScreen />);
    expect(await screen.findByText("No students in this batch yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add a student" }).getAttribute("href")).toBe("/en/students/new/?batch=b1");
  });

  it("has a way back to the batches", async () => {
    renderWithWords(<BatchScreen />);
    expect((await screen.findByRole("link", { name: "Back to batches" })).getAttribute("href")).toBe("/en/batches/");
  });

  it.each([[null], ["nope"]])("says it could not find the batch for an address with id %j, with a link back, and does not loop", async (id) => {
    open(id);
    renderWithWords(<BatchScreen />);
    expect(await screen.findByText("Couldn't find this batch")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to batches" })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});

describe("rename and timings (42, 46)", () => {
  it("turns the name into a field with Save and Cancel, and Cancel puts the title back unchanged", async () => {
    renderWithWords(<BatchScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Rename" }));
    const field = screen.getByLabelText("Batch name") as HTMLTextAreaElement;
    expect(field.value).toBe("Class 10 Maths");
    await userEvent.clear(field);
    await userEvent.type(field, "Changed");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Class 10 Maths");
    expect(updateBatch).not.toHaveBeenCalled();
  });

  it("saves the new name with the timings, sending name and timings only", async () => {
    updateBatch.mockResolvedValue({ ok: true, batch: batch("b1", "Class 10 Maths A", "Mon 5 pm") });
    renderWithWords(<BatchScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Rename" }));
    const field = screen.getByLabelText("Batch name");
    await userEvent.clear(field);
    await userEvent.type(field, "  Class 10 Maths A ");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateBatch).toHaveBeenCalledWith("b1", { name: "Class 10 Maths A", timings: "Mon 5 pm" }));
    expect(putBatch).toHaveBeenCalledWith({ id: "b1", name: "Class 10 Maths A", timings: "Mon 5 pm" });
    await waitFor(() => expect(screen.queryByLabelText("Batch name")).toBeNull());
  });

  it("refuses another batch's name, and an empty one, before asking the database", async () => {
    renderWithWords(<BatchScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Rename" }));
    const field = screen.getByLabelText("Batch name");
    await userEvent.clear(field);
    await userEvent.type(field, "CLASS 8 SCIENCE");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("You already have a batch called CLASS 8 SCIENCE. Pick another name.")).toBeTruthy();
    await userEvent.clear(field);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Type the batch name.")).toBeTruthy();
    expect(updateBatch).not.toHaveBeenCalled();
  });

  it("lets a rename change only the letter case of its own name", async () => {
    updateBatch.mockResolvedValue({ ok: true, batch: batch("b1", "class 10 maths", "Mon 5 pm") });
    renderWithWords(<BatchScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Rename" }));
    const field = screen.getByLabelText("Batch name");
    await userEvent.clear(field);
    await userEvent.type(field, "class 10 maths");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(updateBatch).toHaveBeenCalled());
  });

  it("saves only the timings with Save timings, keeping the saved name, and says so", async () => {
    updateBatch.mockResolvedValue({ ok: true, batch: batch("b1", "Class 10 Maths", "Tue 6 pm") });
    renderWithWords(<BatchScreen />);
    const timings = await screen.findByLabelText("Timings (optional)");
    await userEvent.clear(timings);
    await userEvent.type(timings, "Tue 6 pm");
    await userEvent.click(screen.getByRole("button", { name: "Save timings" }));
    await waitFor(() => expect(updateBatch).toHaveBeenCalledWith("b1", { name: "Class 10 Maths", timings: "Tue 6 pm" }));
    expect(await screen.findByText("Timings saved.")).toBeTruthy();
  });

  it("clears the timings by saving them empty, as null", async () => {
    updateBatch.mockResolvedValue({ ok: true, batch: batch("b1", "Class 10 Maths", null) });
    renderWithWords(<BatchScreen />);
    await userEvent.clear(await screen.findByLabelText("Timings (optional)"));
    await userEvent.click(screen.getByRole("button", { name: "Save timings" }));
    await waitFor(() => expect(updateBatch).toHaveBeenCalledWith("b1", { name: "Class 10 Maths", timings: null }));
  });

  it("keeps what was typed and says nothing was saved when the save fails; offline has its own words", async () => {
    updateBatch.mockResolvedValueOnce({ ok: false, reason: "failed" }).mockResolvedValueOnce({ ok: false, reason: "offline" });
    renderWithWords(<BatchScreen />);
    const timings = await screen.findByLabelText("Timings (optional)");
    await userEvent.type(timings, "!");
    await userEvent.click(screen.getByRole("button", { name: "Save timings" }));
    expect(await screen.findByText("Couldn't save just now. Nothing was saved. Check your connection and tap Save again.")).toBeTruthy();
    expect((timings as HTMLTextAreaElement).value).toBe("Mon 5 pm!");
    await userEvent.click(screen.getByRole("button", { name: "Save timings" }));
    expect(await screen.findByText("You are offline. Connect to the internet to save.")).toBeTruthy();
  });

  it("refuses timings over 100 characters", async () => {
    renderWithWords(<BatchScreen />);
    const timings = await screen.findByLabelText("Timings (optional)");
    await userEvent.clear(timings);
    await userEvent.type(timings, "t".repeat(101));
    await userEvent.click(screen.getByRole("button", { name: "Save timings" }));
    expect(screen.getByText("Use 100 characters or fewer.")).toBeTruthy();
    expect(updateBatch).not.toHaveBeenCalled();
  });
});

describe("delete (45)", () => {
  it("has a red text link and the line that the students stay; it is not a Delete button until the sheet opens", async () => {
    renderWithWords(<BatchScreen />);
    const link = await screen.findByRole("button", { name: "Delete batch" });
    expect(link.className).toContain("text-cloth");
    expect(link.className).toContain("underline");
    expect(link.className).not.toMatch(/bg-(cloth|ink|blue)/);
    expect(screen.getByText("Deleting keeps the students.")).toBeTruthy();
  });

  it("asks first, says how many students stay, and Cancel changes nothing", async () => {
    renderWithWords(<BatchScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete batch" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Delete Class 10 Maths?")).toBeTruthy();
    expect(within(dialog).getByText("2 students stay in your book with no batch.")).toBeTruthy();
    const cancels = within(dialog).getAllByRole("button", { name: "Cancel" });
    await userEvent.click(cancels[cancels.length - 1]);
    expect(deleteBatch).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("deletes, drops the batch from the roster and goes to the batch list", async () => {
    deleteBatch.mockResolvedValue({ ok: true });
    renderWithWords(<BatchScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete batch" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete batch" }));
    await waitFor(() => expect(deleteBatch).toHaveBeenCalledWith("b1"));
    expect(removeBatch).toHaveBeenCalledWith("b1");
    expect(push).toHaveBeenCalledWith("/en/batches/");
  });

  it("stays on the sheet and says nothing was deleted when it fails", async () => {
    deleteBatch.mockResolvedValue({ ok: false, reason: "failed" });
    renderWithWords(<BatchScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete batch" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete batch" }));
    expect(await within(screen.getByRole("dialog")).findByText(/Nothing was saved/)).toBeTruthy();
    expect(removeBatch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
