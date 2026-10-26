// Spec R1-3, criteria 4 to 12: the Students screen with the real English words, over a controlled roster.
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Roster } from "@/components/app/roster";
import type { Batch } from "@/lib/batches";
import type { Due } from "@/lib/dues";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), usePathname: () => "/en/students/" }));
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: { id: "u" }, setTutor: vi.fn() }) }));

const held: { roster: Roster } = { roster: undefined as unknown as Roster };
vi.mock("@/components/app/roster", () => ({ useRoster: () => held.roster }));
// The status chips read this month's fees through the dues board's store (UX-review-fixes-2, criterion 10.3).
const board = vi.hoisted(() => ({ value: { months: {} as Record<string, { rows: Due[]; at: number }>, unpaid: null as { rows: Due[]; at: number } | null, ensureCurrent: vi.fn() } }));
vi.mock("@/components/board/board-state", () => ({ useBoard: () => board.value }));

import { StudentListScreen } from "./student-list-screen";

let n = 0;
const student = (name: string, over: Partial<Student> = {}): Student => ({
  id: `s${++n}`,
  batchId: null,
  name,
  parentName: null,
  parentPhone: null,
  parentLanguage: "en",
  monthlyFee: 120000,
  openingBalance: 0,
  dueDay: 5,
  active: true,
  ...over,
});
const batch = (id: string, name: string): Batch => ({ id, name, timings: null });
const reload = vi.fn();

function roster(over: Partial<Roster> = {}) {
  held.roster = { status: "ready", students: [], batches: [], stale: false, reload, put: vi.fn(), putBatch: vi.fn(), removeBatch: vi.fn(), ...over };
}

beforeEach(() => {
  n = 0;
  push.mockReset();
  reload.mockReset();
  roster();
  board.value = { months: {}, unpaid: null, ensureCurrent: vi.fn() };
});
afterEach(cleanup);

describe("the header (4)", () => {
  it("counts students and batches, names the screen, and has a black Add link to the add form", () => {
    roster({ students: [student("Ravi"), student("Asha")], batches: [batch("b1", "Class 10 Maths")] });
    renderWithWords(<StudentListScreen />);
    expect(screen.getByText(/2 students/).textContent).toContain("1 batch");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Students");
    expect(screen.getByRole("link", { name: "Add" }).getAttribute("href")).toBe("/en/students/new/");
  });

  it("says 1 student and No batches in the singular and the empty case", () => {
    roster({ students: [student("Ravi")] });
    renderWithWords(<StudentListScreen />);
    expect(screen.getByText(/^1 student/).textContent).toContain("No batches");
  });

  it("does not count archived students", () => {
    roster({ students: [student("Ravi"), student("Old", { active: false })] });
    renderWithWords(<StudentListScreen />);
    expect(screen.getByText(/^1 student/)).toBeTruthy();
  });
});

describe("the rows (5, 6)", () => {
  it("show number, name, parent, fee on the day, and the batch; the row is one link to the edit screen", () => {
    roster({
      students: [student("Ravi Kumar", { parentName: "Suresh", batchId: "b1", monthlyFee: 12345600, dueDay: 2 }), student("Asha", { dueDay: 21 })],
      batches: [batch("b1", "Class 10 Maths")],
    });
    renderWithWords(<StudentListScreen />);
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/students/edit/"));
    expect(links).toHaveLength(2);
    // Sorted by name: Asha first.
    expect(links[0].textContent).toContain("Asha");
    expect(links[0].textContent).toContain("₹1,200 on the 21st");
    expect(links[0].textContent).toContain("01");
    expect(links[1].textContent).toContain("02");
    expect(links[1].textContent).toContain("Ravi Kumar");
    expect(links[1].textContent).toContain("Suresh");
    expect(links[1].textContent).toContain("₹1,23,456 on the 2nd");
    expect(links[1].textContent).toContain("Class 10 Maths");
    expect(links[1].getAttribute("href")).toMatch(/^\/en\/students\/edit\/\?id=s\d+$/);
    // Nothing nested that could be tapped.
    expect(links[1].querySelector("button, a, input")).toBeNull();
  });

  it("does not show a phone", () => {
    roster({ students: [student("Ravi", { parentPhone: "+919886044321" })] });
    renderWithWords(<StudentListScreen />);
    expect(document.body.textContent).not.toContain("98860");
  });

  it("goes through the router on a tap", () => {
    roster({ students: [student("Ravi")] });
    renderWithWords(<StudentListScreen />);
    fireEvent.click(screen.getByRole("link", { name: /Ravi/ }));
    expect(push).toHaveBeenCalledWith("/en/students/edit/?id=s1");
  });
});

describe("search (7)", () => {
  const list = () => [student("Ravi Kumar", { parentName: "Suresh", parentPhone: "+919886044321" }), student("Asha Rao", { parentPhone: "+919845012345" })];

  it("is labelled, filters by name, parent and phone digits, and says what it found nothing for", async () => {
    roster({ students: list() });
    renderWithWords(<StudentListScreen />);
    const box = screen.getByLabelText("Search student or parent");
    const rows = () => screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/students/edit/"));

    await userEvent.type(box, "ravi");
    expect(rows()).toHaveLength(1);
    await userEvent.clear(box);
    await userEvent.type(box, "suresh");
    expect(rows()[0].textContent).toContain("Ravi Kumar");
    await userEvent.clear(box);
    await userEvent.type(box, "98450");
    expect(rows()[0].textContent).toContain("Asha Rao");
    await userEvent.clear(box);
    await userEvent.type(box, "zzz");
    expect(screen.getByText("No student matches “zzz”.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((box as HTMLInputElement).value).toBe("");
    expect(rows()).toHaveLength(2);
  });

  it("means no filter for white space only", async () => {
    roster({ students: list() });
    renderWithWords(<StudentListScreen />);
    await userEvent.type(screen.getByLabelText("Search student or parent"), "   ");
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/students/edit/"))).toHaveLength(2);
  });
});

describe("the batch filter (8, 9)", () => {
  const rows = () => screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/students/edit/"));

  it("draws tabs for up to three batches, with counts, and No batch when some have none; a tab filters without loading", async () => {
    roster({
      students: [student("A", { batchId: "b1" }), student("B", { batchId: "b1" }), student("C", { batchId: "b2" }), student("D")],
      batches: [batch("b1", "Class 10 Maths"), batch("b2", "Class 8 Science")],
    });
    renderWithWords(<StudentListScreen />);
    const tabs = screen.getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["All 4", "Class 10 Maths 2", "Class 8 Science 1", "No batch 1"]);
    await userEvent.click(screen.getByRole("tab", { name: /Class 10 Maths/ }));
    expect(rows().map((row) => row.textContent)).toEqual([expect.stringContaining("A"), expect.stringContaining("B")]);
    await userEvent.click(screen.getByRole("tab", { name: "No batch 1" }));
    expect(rows()).toHaveLength(1);
    await userEvent.click(screen.getByRole("tab", { name: "All 4" }));
    expect(rows()).toHaveLength(4);
    expect(reload).not.toHaveBeenCalled();
  });

  it("combines with the search", async () => {
    roster({ students: [student("Anil", { batchId: "b1" }), student("Asha", { batchId: "b2" })], batches: [batch("b1", "One"), batch("b2", "Two")] });
    renderWithWords(<StudentListScreen />);
    await userEvent.click(screen.getByRole("tab", { name: /One/ }));
    await userEvent.type(screen.getByLabelText("Search student or parent"), "as");
    expect(screen.getByText("No student matches “as”.")).toBeTruthy();
  });

  it("draws one select above three batches, and choosing a batch filters", async () => {
    roster({
      students: [student("A", { batchId: "b1" }), student("B", { batchId: "b4" })],
      batches: [batch("b1", "One"), batch("b2", "Two"), batch("b3", "Three"), batch("b4", "Four")],
    });
    renderWithWords(<StudentListScreen />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    const select = screen.getByLabelText("Show") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["All 2", "Four 1", "One 1", "Three 0", "Two 0"]);
    await userEvent.selectOptions(select, "b4");
    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain("B");
  });

  it("has a Batches link to the batch screen", () => {
    roster({ students: [student("A")] });
    renderWithWords(<StudentListScreen />);
    expect(screen.getByRole("link", { name: "Batches" }).getAttribute("href")).toBe("/en/batches/");
  });

  it("says so when a batch has no students", async () => {
    roster({ students: [student("A", { batchId: "b1" })], batches: [batch("b1", "One"), batch("b2", "Two")] });
    renderWithWords(<StudentListScreen />);
    await userEvent.click(screen.getByRole("tab", { name: /Two/ }));
    expect(screen.getByText("No students in this batch yet.")).toBeTruthy();
  });
});

describe("archived students (9)", () => {
  it("are not in the list; a link with the count shows and hides them, each marked Archived", async () => {
    roster({ students: [student("Ravi"), student("Old One", { active: false }), student("Old Two", { active: false })] });
    renderWithWords(<StudentListScreen />);
    const link = screen.getByRole("button", { name: "Archived students (2)" });
    expect(link.getAttribute("aria-expanded")).toBe("false");
    const list = screen.getByText("Old One").closest("ul") as HTMLElement;
    expect(list.hidden).toBe(true);
    await userEvent.click(link);
    expect(link.getAttribute("aria-expanded")).toBe("true");
    expect(list.hidden).toBe(false);
    expect(within(list).getAllByText("Archived")).toHaveLength(2);
    await userEvent.click(link);
    expect(list.hidden).toBe(true);
  });

  it("show no link when there are none", () => {
    roster({ students: [student("Ravi")] });
    renderWithWords(<StudentListScreen />);
    expect(screen.queryByText(/Archived students/)).toBeNull();
  });
});

describe("empty (10)", () => {
  it("says No students yet with a black Add a student button, and no search or filter", () => {
    renderWithWords(<StudentListScreen />);
    expect(screen.getByRole("heading", { name: "No students yet." })).toBeTruthy();
    expect(screen.getByText("Add your first student. It takes a minute.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Add a student" }).getAttribute("href")).toBe("/en/students/new/");
    expect(screen.queryByLabelText("Search student or parent")).toBeNull();
  });
});

describe("loading and failing (11, 12)", () => {
  it("shows the grey blocks and Opening your book while the first read is out", () => {
    roster({ status: "loading" });
    renderWithWords(<StudentListScreen />);
    expect(screen.getByText("Opening your book…")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("shows the error banner with Try again when the first read failed, and Try again reads again", async () => {
    roster({ status: "error" });
    renderWithWords(<StudentListScreen />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Couldn't load your students");
    expect(alert.textContent).toContain("The network dropped. Nothing is lost.");
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("keeps the cached list under a quiet note when a refresh failed", async () => {
    roster({ students: [student("Ravi")], stale: true });
    renderWithWords(<StudentListScreen />);
    expect(screen.getByText("Ravi")).toBeTruthy();
    expect(screen.getByText("Showing what was saved on this phone.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalled();
  });
});

describe("the bottom navigation (2)", () => {
  it("has Students current", () => {
    renderWithWords(<StudentListScreen />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Students" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
  });
});

describe("the other languages", () => {
  it.each(["hi", "kn", "te"] as const)("draws in %s with no marker and no raw key", (locale) => {
    roster({ students: [student("Ravi", { parentName: "Suresh", dueDay: 3 })], batches: [batch("b1", "One")] });
    renderWithWords(<StudentListScreen />, locale);
    expect(document.body.textContent).not.toContain("TODO-translate");
    expect(document.body.textContent).not.toMatch(/students\.\w+/);
    expect(document.body.textContent).toContain("₹1,200");
  });
});

describe("status chips (UX-review-fixes-2, 10.1 to 10.3)", () => {
  const fee = (id: string, studentId: string, over: Partial<Due> = {}): Due => ({ id, studentId, kind: "monthly", month: "2026-10-01", amount: 120000, amountPaid: 0, status: "due", dueDate: "2026-10-05", ...over });
  const rowOf = (name: string) => screen.getByText(name).closest("li") as HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T05:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("asks the board for the current month's fees once, with the India day", () => {
    roster({ students: [student("Ravi")] });
    renderWithWords(<StudentListScreen />);
    expect(board.value.ensureCurrent).toHaveBeenCalledTimes(1);
    expect(board.value.ensureCurrent).toHaveBeenCalledWith("2026-10-12");
  });

  it("until the fees are read, rows show with no chip and no next-fee line", () => {
    roster({ students: [student("Ravi")] });
    renderWithWords(<StudentListScreen />);
    expect(rowOf("Ravi").querySelector("[data-status]")).toBeNull();
    expect(rowOf("Ravi").textContent).not.toContain("Next fee");
  });

  it("gives each active student one chip, a word plus a mark; no chip and a next-fee line when there is no fee yet; none when archived", () => {
    const ravi = student("Ravi");
    const asha = student("Asha", { dueDay: 12 });
    const dev = student("Dev");
    const imran = student("Imran", { dueDay: 20 });
    const kiran = student("Kiran", { dueDay: 25 });
    const old = student("Old", { active: false });
    roster({ students: [ravi, asha, dev, imran, kiran, old] });
    board.value = {
      months: {
        "2026-10-01": {
          rows: [
            fee("d1", ravi.id, { amountPaid: 20000, status: "partial" }),
            fee("d2", asha.id, { dueDate: "2026-10-12" }),
            fee("d3", dev.id, { amountPaid: 120000, status: "paid" }),
            fee("d4", imran.id, { dueDate: "2026-10-20", amountPaid: 50000, status: "partial" }),
            fee("d5", old.id),
          ],
          at: 1,
        },
      },
      unpaid: { rows: [], at: 1 },
      ensureCurrent: vi.fn(),
    };
    renderWithWords(<StudentListScreen />);
    const chip = (name: string) => rowOf(name).querySelector("[data-status]");
    expect([chip("Ravi")?.getAttribute("data-status"), chip("Ravi")?.textContent]).toEqual(["overdue", "Overdue ₹1,000"]);
    expect([chip("Asha")?.getAttribute("data-status"), chip("Asha")?.textContent]).toEqual(["due", "Due today"]);
    expect([chip("Dev")?.getAttribute("data-status"), chip("Dev")?.textContent]).toEqual(["paid", "Paid"]);
    expect([chip("Imran")?.getAttribute("data-status"), chip("Imran")?.textContent]).toEqual(["part-paid", "Part paid ₹500"]);
    expect(chip("Kiran")).toBeNull();
    expect(rowOf("Kiran").textContent).toContain("Next fee 25 Oct 2026");
    expect(rowOf("Ravi").textContent).not.toContain("Next fee");
    // The amount in a chip is in the mono face.
    expect(chip("Ravi")?.querySelector(".type-amount-row")?.textContent).toBe("₹1,000");
  });
});
