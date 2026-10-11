// Spec R1-3, criteria 14 and 15: the home of a tutor with students, and the choice between the two homes.
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Roster } from "@/components/app/roster";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), usePathname: () => "/en/home/" }));
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: { id: "u", name: "Meena Iyer" }, setTutor: vi.fn() }) }));
const held: { roster: Roster } = { roster: undefined as unknown as Roster };
vi.mock("@/components/app/roster", () => ({ useRoster: () => held.roster }));

import { HomeScreen } from "./home-screen";

let n = 0;
const student = (fee: number, over: Partial<Student> = {}): Student => ({
  id: `s${++n}`,
  batchId: null,
  name: `S${n}`,
  parentName: null,
  parentPhone: null,
  parentLanguage: "en",
  monthlyFee: fee,
  openingBalance: 0,
  dueDay: 1,
  active: true,
  ...over,
});
const roster = (over: Partial<Roster> = {}) => {
  held.roster = { status: "ready", students: [], batches: [], stale: false, reload: vi.fn(), put: vi.fn(), putBatch: vi.fn(), removeBatch: vi.fn(), ...over };
};

beforeEach(() => {
  n = 0;
  push.mockReset();
  roster();
});
afterEach(cleanup);

describe("HomeScreen chooses (13, 14)", () => {
  it("shows the empty book for no students, and for students who are all archived", () => {
    roster();
    renderWithWords(<HomeScreen />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Your book is empty.");
    cleanup();
    roster({ students: [student(100000, { active: false })] });
    renderWithWords(<HomeScreen />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Your book is empty.");
  });

  it("shows the filled home for one or more students", () => {
    roster({ students: [student(100000)] });
    renderWithWords(<HomeScreen />);
    expect(screen.queryByText("Your book is empty.")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("1 student");
  });
});

describe("FilledHome (14)", () => {
  it("adds the fees of the active students as integer paise and shows them with Indian grouping", () => {
    roster({ students: [student(120000), student(150000), student(10000000), student(99999999, { active: false })] });
    renderWithWords(<HomeScreen />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("3 students");
    expect(screen.getByText("₹1,02,700")).toBeTruthy();
    expect(screen.getByText(/each month/)).toBeTruthy();
  });

  it("has a hello line, two black links, the line about later, and no placeholder rows", () => {
    roster({ students: [student(100000)] });
    renderWithWords(<HomeScreen />);
    expect(screen.getByText("Hello, Meena")).toBeTruthy();
    expect(screen.getByRole("link", { name: "See all students" }).getAttribute("href")).toBe("/en/students/");
    const add = screen.getByRole("link", { name: "Add a student" });
    expect(add.getAttribute("href")).toBe("/en/students/new/");
    fireEvent.click(add);
    expect(push).toHaveBeenCalledWith("/en/students/new/");
    expect(screen.getByText("Who owes what appears here in a later update.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("keeps the amount in the Latin digits in every language", () => {
    roster({ students: [student(123456700)] });
    for (const locale of ["hi", "kn", "te"] as const) {
      renderWithWords(<HomeScreen />, locale);
      expect(screen.getByText("₹12,34,567")).toBeTruthy();
      cleanup();
    }
  });

  it("has the bottom navigation with Home current", () => {
    roster({ students: [student(100000)] });
    renderWithWords(<HomeScreen />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
  });
});

describe("loading and error (15)", () => {
  it("shows Opening your book while the roster loads", () => {
    roster({ status: "loading" });
    renderWithWords(<HomeScreen />);
    expect(screen.getByText("Opening your book…")).toBeTruthy();
  });

  it("shows the error banner with Try again when it could not be read", () => {
    const reload = vi.fn();
    roster({ status: "error", reload });
    renderWithWords(<HomeScreen />);
    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalled();
  });
});
