// Spec R1-6, criteria 19, 26 to 28 and the plan's ticket rule: the board provider's open policy, with the
// reader replaced by controllable promises.
import { act, cleanup, render } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Due } from "@/lib/dues";

vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: { id: "tutor-1" }, setTutor: vi.fn() }) }));

const lib = vi.hoisted(() => ({
  readMonth: vi.fn(),
  readUnpaid: vi.fn(),
  readEarliestMonth: vi.fn(),
  ensureMyDues: vi.fn(),
}));
vi.mock("@/lib/dues", () => lib);

import { BoardProvider, useBoard, type Board } from "./board-state";

const TODAY = "2026-10-12";
const due = (id: string, month = "2026-10-01"): Due => ({
  id,
  studentId: "S1",
  kind: "monthly",
  month,
  amount: 100,
  amountPaid: 0,
  status: "due",
  dueDate: "2026-10-05",
});

const held: { board: Board } = { board: undefined as unknown as Board };
function Probe() {
  const current = useBoard();
  useEffect(() => {
    held.board = current;
  });
  return null;
}
const mount = () => render(<BoardProvider><Probe /></BoardProvider>);
const onLine = (value: boolean) => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T05:00:00Z"));
  onLine(true);
  lib.readMonth.mockReset().mockResolvedValue([due("a")]);
  lib.readUnpaid.mockReset().mockResolvedValue([due("old", "2026-09-01")]);
  lib.readEarliestMonth.mockReset().mockResolvedValue("2026-09-01");
  lib.ensureMyDues.mockReset().mockResolvedValue(0);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("open", () => {
  it("asks the database for missing dues and reads the month, the unpaid dues and the earliest month, once each", async () => {
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    expect(lib.ensureMyDues).toHaveBeenCalledTimes(1);
    expect(lib.readMonth).toHaveBeenCalledTimes(1);
    expect(lib.readMonth).toHaveBeenCalledWith("2026-10-01");
    expect(lib.readUnpaid).toHaveBeenCalledTimes(1);
    expect(lib.readEarliestMonth).toHaveBeenCalledTimes(1);
    expect(held.board.months["2026-10-01"].rows.map((d) => d.id)).toEqual(["a"]);
    expect(held.board.unpaid?.rows.map((d) => d.id)).toEqual(["old"]);
    expect(held.board.earliest?.month).toBe("2026-09-01");
    expect(held.board.failed).toBe(false);
  });

  it("reads once more when ensure_my_dues made some, and never waits for it", async () => {
    const slow = deferred<number>();
    lib.ensureMyDues.mockReturnValue(slow.promise);
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    // The first read is shown while the call is still out.
    expect(held.board.months["2026-10-01"]).toBeDefined();
    expect(lib.readMonth).toHaveBeenCalledTimes(1);
    lib.readMonth.mockResolvedValue([due("a"), due("b")]);
    slow.resolve(2);
    await flush();
    expect(lib.readMonth).toHaveBeenCalledTimes(2);
    expect(held.board.months["2026-10-01"].rows).toHaveLength(2);
  });

  it("does not read again when ensure_my_dues made none or failed", async () => {
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    expect(lib.readMonth).toHaveBeenCalledTimes(1);
  });

  it("sends nothing offline: failed with nothing cached", async () => {
    onLine(false);
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    expect(lib.ensureMyDues).not.toHaveBeenCalled();
    expect(lib.readMonth).not.toHaveBeenCalled();
    expect(held.board.failed).toBe(true);
    expect(held.board.months["2026-10-01"]).toBeUndefined();
  });

  it("keeps the cache and sets failed when a later read fails, and a good read clears it", async () => {
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    lib.readMonth.mockRejectedValue(new Error("network"));
    act(() => held.board.open(TODAY));
    await flush();
    expect(held.board.failed).toBe(true);
    expect(held.board.months["2026-10-01"].rows).toHaveLength(1);
    lib.readMonth.mockResolvedValue([due("z")]);
    act(() => held.board.retry(TODAY));
    await flush();
    expect(held.board.failed).toBe(false);
    expect(held.board.months["2026-10-01"].rows[0].id).toBe("z");
  });

  it("drops a slow older answer that comes back after a newer one", async () => {
    const older = deferred<Due[]>();
    lib.readMonth.mockReturnValueOnce(older.promise).mockResolvedValue([due("newer")]);
    mount();
    act(() => held.board.open(TODAY));
    act(() => held.board.retry(TODAY));
    await flush();
    expect(held.board.months["2026-10-01"].rows[0].id).toBe("newer");
    older.resolve([due("older")]);
    await flush();
    expect(held.board.months["2026-10-01"].rows[0].id).toBe("newer");
  });
});

describe("selectMonth (28)", () => {
  async function opened() {
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    lib.readMonth.mockClear();
    lib.readUnpaid.mockClear();
  }

  it("reads only the month that is missing, and again only after a minute", async () => {
    await opened();
    act(() => held.board.selectMonth("2026-09-01", TODAY));
    await flush();
    expect(lib.readMonth).toHaveBeenCalledTimes(1);
    expect(lib.readMonth).toHaveBeenCalledWith("2026-09-01");
    expect(lib.readUnpaid).not.toHaveBeenCalled();
    // Back to the current month and to September again within a minute: no request.
    act(() => held.board.selectMonth("2026-10-01", TODAY));
    act(() => held.board.selectMonth("2026-09-01", TODAY));
    await flush();
    expect(lib.readMonth).toHaveBeenCalledTimes(1);
    // After a minute it is read once more.
    vi.setSystemTime(new Date("2026-10-12T05:01:01Z"));
    act(() => held.board.selectMonth("2026-09-01", TODAY));
    await flush();
    expect(lib.readMonth).toHaveBeenCalledTimes(2);
  });

  it("stores null for the current month, so the view follows the day", async () => {
    await opened();
    act(() => held.board.selectMonth("2026-09-01", TODAY));
    expect(held.board.settings.month).toBe("2026-09-01");
    act(() => held.board.selectMonth("2026-10-01", TODAY));
    expect(held.board.settings.month).toBeNull();
  });

  it("sends nothing offline for a month it does not hold", async () => {
    await opened();
    onLine(false);
    act(() => held.board.selectMonth("2026-08-01", TODAY));
    await flush();
    expect(lib.readMonth).not.toHaveBeenCalled();
    expect(held.board.failed).toBe(true);
  });
});

describe("the remembered view (12, 19)", () => {
  it("keeps the tab and the filter until the provider goes, and the tab stays across refreshes", async () => {
    const { unmount } = mount();
    expect(held.board.settings).toEqual({ month: null, tab: null, filter: "all" });
    act(() => held.board.setTab("paid"));
    act(() => held.board.setFilter("b1"));
    act(() => held.board.open(TODAY));
    await flush();
    expect(held.board.settings).toEqual({ month: null, tab: "paid", filter: "b1" });
    unmount();
    mount();
    expect(held.board.settings).toEqual({ month: null, tab: null, filter: "all" });
  });

  it("uses no storage", () => {
    const set = vi.spyOn(Storage.prototype, "setItem");
    mount();
    act(() => held.board.setTab("due"));
    expect(set).not.toHaveBeenCalled();
  });
});
