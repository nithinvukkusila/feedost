// Spec R1-3, criteria 39 to 41 and 46: the Batches screen, with the real English words, over a controlled roster.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Roster } from "@/components/app/roster";
import type { Batch } from "@/lib/batches";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), usePathname: () => "/en/batches/" }));
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: { id: "u" }, setTutor: vi.fn() }) }));
const held: { roster: Roster } = { roster: undefined as unknown as Roster };
vi.mock("@/components/app/roster", () => ({ useRoster: () => held.roster }));
const createBatch = vi.fn();
vi.mock("@/lib/batches", () => ({ createBatch: (batch: unknown) => createBatch(batch) }));

import { BatchListScreen } from "./batch-list-screen";

const student = (id: string, batchId: string | null, fee: number, active = true): Student => ({
  id,
  batchId,
  name: id,
  parentName: null,
  parentPhone: null,
  parentLanguage: "en",
  monthlyFee: fee,
  openingBalance: 0,
  dueDay: 1,
  active,
});
const batch = (id: string, name: string, timings: string | null = null): Batch => ({ id, name, timings });
const putBatch = vi.fn();

function roster(over: Partial<Roster> = {}) {
  held.roster = { status: "ready", students: [], batches: [], stale: false, reload: vi.fn(), put: vi.fn(), putBatch, removeBatch: vi.fn(), ...over };
}
const onLine = (value: boolean) => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });

beforeEach(() => {
  push.mockReset();
  createBatch.mockReset();
  putBatch.mockReset();
  onLine(true);
  roster();
});
afterEach(cleanup);

describe("the list (39)", () => {
  it("says there are no batches yet, with a line about what a batch is", () => {
    renderWithWords(<BatchListScreen />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Batches");
    expect(screen.getByText("No batches yet.")).toBeTruthy();
    expect(screen.getByText("A batch is a class or group, like Class 10 Maths.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to students" }).getAttribute("href")).toBe("/en/students/");
  });

  it("shows each batch with its timings, its active students and their monthly total, as a link to its screen", () => {
    roster({
      batches: [batch("b2", "Class 8 Science"), batch("b1", "Class 10 Maths", "Mon, Wed 5 pm")],
      students: [student("a", "b1", 120000), student("b", "b1", 150000), student("c", "b1", 999900, false), student("d", "b2", 100000)],
    });
    renderWithWords(<BatchListScreen />);
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/batches/edit/"));
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toContain("Class 10 Maths");
    expect(links[0].textContent).toContain("Mon, Wed 5 pm");
    expect(links[0].textContent).toContain("2 students");
    expect(links[0].textContent).toContain("₹2,700 each month");
    expect(links[0].getAttribute("href")).toBe("/en/batches/edit/?id=b1");
    expect(links[1].textContent).toContain("1 student");
    expect(links[1].textContent).toContain("₹1,000 each month");
    expect(screen.queryByText("No batches yet.")).toBeNull();
  });
});

describe("adding a batch (40, 41, 46)", () => {
  it("shows Missing and the sentence for an empty name, and sends nothing", async () => {
    renderWithWords(<BatchListScreen />);
    await userEvent.click(screen.getByRole("button", { name: "Add batch" }));
    expect(screen.getByText("Type the batch name.")).toBeTruthy();
    expect(screen.getByText("Missing")).toBeTruthy();
    expect(createBatch).not.toHaveBeenCalled();
  });

  it("shows Too long for 61 characters", async () => {
    renderWithWords(<BatchListScreen />);
    await userEvent.type(screen.getByLabelText("Batch name"), "a".repeat(61));
    await userEvent.click(screen.getByRole("button", { name: "Add batch" }));
    expect(screen.getByText("Use 60 characters or fewer.")).toBeTruthy();
    expect(screen.getByText("Too long")).toBeTruthy();
  });

  it("refuses a name another batch has, in any letter case, before asking the database, and keeps what was typed", async () => {
    roster({ batches: [batch("b1", "Class 10 Maths")] });
    renderWithWords(<BatchListScreen />);
    await userEvent.type(screen.getByLabelText(/^Batch name/), "class 10 maths");
    await userEvent.type(screen.getByLabelText("Timings (optional)"), "Mon");
    await userEvent.click(screen.getByRole("button", { name: "Add batch" }));
    expect(screen.getByText("You already have a batch called class 10 maths. Pick another name.")).toBeTruthy();
    expect(screen.getByText("Name taken")).toBeTruthy();
    expect((screen.getByLabelText(/^Batch name/) as HTMLTextAreaElement).value).toBe("class 10 maths");
    expect((screen.getByLabelText("Timings (optional)") as HTMLTextAreaElement).value).toBe("Mon");
    expect(createBatch).not.toHaveBeenCalled();
  });

  it("sends the id, the cleaned name and the timings, puts the answer in the roster and clears the form", async () => {
    createBatch.mockResolvedValue({ ok: true, batch: batch("new", "Class 9 English", "Tue 4 pm") });
    renderWithWords(<BatchListScreen />);
    await userEvent.type(screen.getByLabelText("Batch name"), "  Class  9   English ");
    await userEvent.type(screen.getByLabelText("Timings (optional)"), "Tue 4 pm");
    await userEvent.click(screen.getByRole("button", { name: "Add batch" }));
    await waitFor(() => expect(putBatch).toHaveBeenCalledWith({ id: "new", name: "Class 9 English", timings: "Tue 4 pm" }));
    const sent = createBatch.mock.calls[0][0] as { id: string; name: string; timings: string | null };
    expect(Object.keys(sent).sort()).toEqual(["id", "name", "timings"]);
    expect(sent.name).toBe("Class 9 English");
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(() => expect((screen.getByLabelText("Batch name") as HTMLTextAreaElement).value).toBe(""));
  });

  it("sends null for empty timings", async () => {
    createBatch.mockResolvedValue({ ok: true, batch: batch("new", "X") });
    renderWithWords(<BatchListScreen />);
    await userEvent.type(screen.getByLabelText("Batch name"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Add batch" }));
    await waitFor(() => expect(createBatch).toHaveBeenCalled());
    expect(createBatch.mock.calls[0][0]).toMatchObject({ name: "X", timings: null });
  });

  it("sends one id for a retry after a failure, and a new one after a success", async () => {
    createBatch.mockResolvedValueOnce({ ok: false, reason: "failed" }).mockResolvedValueOnce({ ok: true, batch: batch("n", "X") });
    renderWithWords(<BatchListScreen />);
    await userEvent.type(screen.getByLabelText("Batch name"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Add batch" }));
    expect(await screen.findByText("Couldn't save just now. Nothing was saved. Check your connection and tap Save again.")).toBeTruthy();
    expect((screen.getByLabelText("Batch name") as HTMLTextAreaElement).value).toBe("X");
    await userEvent.click(screen.getByRole("button", { name: "Add batch" }));
    await waitFor(() => expect(createBatch).toHaveBeenCalledTimes(2));
    expect(createBatch.mock.calls[0][0].id).toBe(createBatch.mock.calls[1][0].id);
  });

  it("says the database's refusal of a name the same way, and keeps what was typed", async () => {
    createBatch.mockResolvedValue({ ok: false, reason: "name-taken" });
    renderWithWords(<BatchListScreen />);
    await userEvent.type(screen.getByLabelText(/^Batch name/), "Evening");
    await userEvent.click(screen.getByRole("button", { name: "Add batch" }));
    expect(await screen.findByText("You already have a batch called Evening. Pick another name.")).toBeTruthy();
    expect((screen.getByLabelText(/^Batch name/) as HTMLTextAreaElement).value).toBe("Evening");
    // Changing the name clears it.
    await userEvent.type(screen.getByLabelText(/^Batch name/), "s");
    expect(screen.queryByText(/You already have a batch/)).toBeNull();
  });

  it("says offline in its own words and the tutor is not moved", async () => {
    createBatch.mockResolvedValue({ ok: false, reason: "offline" });
    renderWithWords(<BatchListScreen />);
    await userEvent.type(screen.getByLabelText("Batch name"), "X");
    await userEvent.click(screen.getByRole("button", { name: "Add batch" }));
    expect(await screen.findByText("You are offline. Connect to the internet to save.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("makes a second tap while saving do nothing", async () => {
    let finish: (value: unknown) => void = () => {};
    createBatch.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderWithWords(<BatchListScreen />);
    await userEvent.type(screen.getByLabelText("Batch name"), "X");
    const button = screen.getByRole("button", { name: "Add batch" });
    await userEvent.click(button);
    await userEvent.click(button);
    expect(createBatch).toHaveBeenCalledTimes(1);
    expect(button.getAttribute("aria-busy")).toBe("true");
    finish({ ok: true, batch: batch("n", "X") });
    await waitFor(() => expect(putBatch).toHaveBeenCalled());
  });
});

describe("the bottom navigation (2)", () => {
  it("shows with Students current", () => {
    renderWithWords(<BatchListScreen />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Students" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("the other languages", () => {
  it.each(["hi", "kn", "te"] as const)("draws in %s with no marker", (locale) => {
    roster({ batches: [batch("b1", "One")], students: [student("a", "b1", 100000)] });
    renderWithWords(<BatchListScreen />, locale);
    expect(document.body.textContent).not.toContain("TODO-translate");
    expect(document.body.textContent).toContain("₹1,000");
  });
});
