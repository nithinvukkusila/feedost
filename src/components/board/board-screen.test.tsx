// Spec R1-6, criteria 29, 30 and 36: the board screen's day change and its roster re-read, with the board's
// store and the roster replaced by controlled values; and the rule that no board file uses a timer.
import { act, cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Roster } from "@/components/app/roster";
import { stripTodo } from "@/i18n/messages";
import en from "../../../messages/en.json";
import type { Due } from "@/lib/dues";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";
import type { Board } from "./board-state";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/en/home/" }));
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: { id: "u", upiId: "meena@okhdfc", name: "Meena Iyer" }, setTutor: vi.fn() }) }));
vi.mock("@/components/remind/remind-provider", () => ({
  useRemind: () => ({ tone: "polite", setTone: vi.fn(), session: null, begin: vi.fn(), clear: vi.fn(), log: { subscribe: () => () => {}, saved: () => 0 } }),
}));

const held: { roster: Roster; board: Board } = { roster: undefined as unknown as Roster, board: undefined as unknown as Board };
vi.mock("@/components/app/roster", () => ({ useRoster: () => held.roster }));
// The "to confirm" chip reads a count from the database; it is tested in claims-chip.test.tsx.
vi.mock("@/lib/claims", () => ({ countPendingClaims: () => Promise.reject(new Error("not in this test")) }));
vi.mock("./board-state", () => ({ useBoard: () => held.board }));

import { BoardScreen } from "./board-screen";

const student = (id: string, name: string): Student => ({
  id,
  batchId: null,
  name,
  parentName: null,
  parentPhone: null,
  parentLanguage: "en",
  monthlyFee: 100000,
  openingBalance: 0,
  dueDay: 5,
  active: true,
});
const due = (id: string, studentId: string, dueDate: string): Due => ({ id, studentId, kind: "monthly", month: "2026-10-01", amount: 100000, amountPaid: 0, status: "due", dueDate });

const reload = vi.fn();
const open = vi.fn();

function setup(over: Partial<Board> = {}, students = [student("s1", "Ravi")]) {
  held.roster = { status: "ready", students, batches: [], stale: false, reload, put: vi.fn(), putBatch: vi.fn(), removeBatch: vi.fn() };
  held.board = {
    months: { "2026-10-01": { rows: [due("d1", "s1", "2026-10-12")], at: 1 } },
    unpaid: { rows: [], at: 1 },
    earliest: { month: "2026-10-01", at: 1 },
    reminders: null,
    collected: { "2026-10-01": { payments: [], studentOf: {}, at: 1 } },
    failed: false,
    blocked: null,
    reads: 1,
    settings: { month: null, tab: null, filter: "all" },
    notice: null,
    applyPayment: vi.fn(),
    applyPayments: vi.fn(),
    applyVoid: vi.fn(),
    refresh: vi.fn(),
    showNotice: vi.fn(),
    clearNotice: vi.fn(),
    open,
    selectMonth: vi.fn(),
    setTab: vi.fn(),
    setFilter: vi.fn(),
    retry: vi.fn(),
    ensureCurrent: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T15:00:00Z"));
  reload.mockReset();
  open.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("opening and the day change (29)", () => {
  it("opens once on mount with the India day, and again when the page is shown after midnight there, not before", () => {
    setup();
    renderWithWords(<BoardScreen />);
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenLastCalledWith("2026-10-12");
    expect(screen.getByText("Due today")).toBeTruthy();

    // The same India day: nothing.
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    vi.setSystemTime(new Date("2026-10-12T18:29:00Z"));
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(open).toHaveBeenCalledTimes(1);

    // 00:01 on the 13th in India.
    vi.setSystemTime(new Date("2026-10-12T18:31:00Z"));
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(open).toHaveBeenCalledTimes(2);
    expect(open).toHaveBeenLastCalledWith("2026-10-13");
    expect(screen.getByText("Overdue 1 day")).toBeTruthy();
  });

  it("does nothing when the page goes hidden", () => {
    setup();
    renderWithWords(<BoardScreen />);
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    vi.setSystemTime(new Date("2026-10-12T18:31:00Z"));
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe("a fee for a student the phone has not seen (30)", () => {
  it("reads the roster once per read of the dues, and leaves the fee out until it is there", () => {
    setup({ months: { "2026-10-01": { rows: [due("d1", "s1", "2026-10-12"), due("d2", "ghost", "2026-10-12")], at: 1 } } });
    const screenWithWords = () => (
      <NextIntlClientProvider locale="en" messages={stripTodo(en as Parameters<typeof stripTodo>[0])}>
        <BoardScreen />
      </NextIntlClientProvider>
    );
    const { rerender } = render(screenWithWords());
    expect(reload).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("/students/edit/") && link.textContent !== "Add number")).toHaveLength(1);
    rerender(screenWithWords());
    expect(reload).toHaveBeenCalledTimes(1);
    // A new read of the dues is allowed one more.
    setup({ reads: 2, months: { "2026-10-01": { rows: [due("d1", "s1", "2026-10-12"), due("d2", "ghost", "2026-10-12")], at: 2 } } });
    rerender(screenWithWords());
    expect(reload).toHaveBeenCalledTimes(2);
  });
});

describe("states", () => {
  it("shows the loading words while nothing is read, and the error with Try again when it failed", () => {
    setup({ months: {}, unpaid: null });
    renderWithWords(<BoardScreen />);
    expect(screen.getByRole("status").textContent).toBe("Opening your book…");
    cleanup();
    setup({ months: {}, unpaid: null, failed: true });
    renderWithWords(<BoardScreen />);
    expect(screen.getByText("Couldn't load your fees")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("waits for the unpaid dues too in the current month, so the amount never grows under the tutor", () => {
    setup({ unpaid: null });
    renderWithWords(<BoardScreen />);
    expect(screen.getByRole("status").textContent).toBe("Opening your book…");
  });

  it("keeps the saved board under the quiet line when a read failed", () => {
    setup({ failed: true });
    renderWithWords(<BoardScreen />);
    expect(screen.getByText("Showing what was saved on this phone.")).toBeTruthy();
    expect(screen.getByText("Due today")).toBeTruthy();
  });
});

describe("a month that cannot be read keeps the month buttons and the navigation", () => {
  it("shows the switcher and the nav with the error under it, and Next goes back", () => {
    const selectMonth = vi.fn();
    setup({ settings: { month: "2026-09-01", tab: null, filter: "all" }, failed: true, selectMonth });
    renderWithWords(<BoardScreen />);
    expect(screen.getByText("Couldn't load your fees")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeTruthy();
    act(() => screen.getByRole("button", { name: "Next month" }).click());
    expect(selectMonth).toHaveBeenCalledWith("2026-10-01", "2026-10-12");
  });

  it("an uncached month that is loading shows the words under the switcher, not the old error", () => {
    setup({ settings: { month: "2026-09-01", tab: null, filter: "all" }, failed: false });
    renderWithWords(<BoardScreen />);
    expect(screen.getByRole("status").textContent).toBe("Opening your book…");
    expect(screen.getByRole("button", { name: "Previous month" })).toBeTruthy();
  });

  it("says a month cannot be opened offline", () => {
    setup({ blocked: "2026-09-01" });
    renderWithWords(<BoardScreen />);
    expect(screen.getByText("Can't open September 2026 without a network.")).toBeTruthy();
  });
});

describe("no timer in the board (no polling for the day change)", () => {
  const dir = join(process.cwd(), "src", "components", "board");
  const files = readdirSync(dir).filter((name) => /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name));
  it.each(files)("%s uses no setInterval or setTimeout", (name) => {
    expect(readFileSync(join(dir, name), "utf8")).not.toMatch(/setInterval|setTimeout/);
  });
  it("and none of them does money or days with a float, rounding, local-time getters or Intl", () => {
    for (const name of files) {
      const text = readFileSync(join(dir, name), "utf8").replace(/\/\/.*$/gm, "");
      expect(text, name).not.toMatch(/parseFloat|toFixed|Math\.round|Intl\.|toLocale|new Date|getFullYear|getMonth|getDate\(|getDay|getHours/);
    }
  });
});


describe("the hero line and the summary bar (UX-review-fixes-2, 2.2, 3.3, 4.2 to 4.5)", () => {
  const pay = (id: string, dueId: string, amount: number) => ({ id, dueId, amount, method: "cash" as const, paidOn: "2026-10-12", receiptNo: 1, balanceAfter: 0, createdAt: 0, voidedAt: null });
  const labels = () => [...document.querySelectorAll("[data-label]")].map((li) => li.textContent);

  it("says how many of the students in the filter still owe, counting students with no fee this month", () => {
    setup({}, [student("s1", "Ravi"), student("s2", "Asha"), student("s3", "Kiran")]);
    renderWithWords(<BoardScreen />);
    expect(screen.getByText("1 of 3 students still owe")).toBeTruthy();
  });

  it("shows Collected from the month's payments (an earlier balance's too), and Due and Overdue from what is owed", () => {
    setup({
      months: { "2026-10-01": { rows: [due("d1", "s1", "2026-10-12"), due("d2", "s2", "2026-10-05")], at: 1 } },
      collected: { "2026-10-01": { payments: [pay("p1", "old", 25000), pay("p2", "d9", 10000)], studentOf: { old: "s1", d9: "s2" }, at: 1 } },
    }, [student("s1", "Ravi"), student("s2", "Asha")]);
    renderWithWords(<BoardScreen />);
    expect(labels()).toEqual(["Collected ₹350", "Due ₹1,000", "Overdue ₹1,000"]);
    expect(document.querySelector("[data-summary-bar]")?.getAttribute("aria-hidden")).toBe("true");
    // The strip and its legend are gone.
    expect(document.body.textContent).not.toMatch(/hollow|tall/);
  });

  it("while Collected is read the label has a grey block; if it failed with nothing saved, a dash", () => {
    setup({ collected: {} });
    const { unmount } = renderWithWords(<BoardScreen />);
    expect(document.querySelector('[data-label="collected"] [data-pending]')).not.toBeNull();
    unmount();
    setup({ collected: { "2026-10-01": null } });
    renderWithWords(<BoardScreen />);
    expect(labels()[0]).toBe("Collected —");
    expect(document.querySelector('[data-part="collected"]')).toBeNull();
  });

  it("draws nothing when the month has no rows", () => {
    setup({ months: { "2026-10-01": { rows: [], at: 1 } } });
    renderWithWords(<BoardScreen />);
    expect(document.querySelector("[data-label]")).toBeNull();
  });
});
