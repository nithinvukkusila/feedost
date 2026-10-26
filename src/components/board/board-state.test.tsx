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
  readDuesByIds: vi.fn(),
}));
vi.mock("@/lib/dues", () => lib);
const pay = vi.hoisted(() => ({ readPaymentsInMonth: vi.fn() }));
vi.mock("@/lib/payments", () => pay);
const rem = vi.hoisted(() => ({ readLastReminders: vi.fn() }));
vi.mock("@/lib/reminders", () => rem);

import { BoardProvider } from "./board-holder";
import { useBoard, type Board } from "./board-state";

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
  rem.readLastReminders.mockReset().mockResolvedValue({ a: { dueId: "a", lastAt: 5, times: 1 } });
  lib.readDuesByIds.mockReset().mockResolvedValue([]);
  pay.readPaymentsInMonth.mockReset().mockResolvedValue([]);
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

  it("offline, a month it does not hold is not opened: the view stays and says so; the current month still works", async () => {
    await opened();
    onLine(false);
    act(() => held.board.selectMonth("2026-09-01", TODAY));
    await flush();
    expect(lib.readMonth).not.toHaveBeenCalled();
    expect(held.board.blocked).toBe("2026-09-01");
    expect(held.board.settings.month).toBeNull();
    expect(held.board.failed).toBe(false);
    act(() => held.board.selectMonth("2026-10-01", TODAY));
    expect(held.board.blocked).toBeNull();
    expect(held.board.settings.month).toBeNull();
  });

  it("a failed month read, then Next to the saved current month, works and starts the next read clean", async () => {
    await opened();
    lib.readMonth.mockRejectedValueOnce(new Error("network"));
    act(() => held.board.selectMonth("2026-09-01", TODAY));
    await flush();
    expect(held.board.failed).toBe(true);
    expect(held.board.months["2026-09-01"]).toBeUndefined();
    act(() => held.board.selectMonth("2026-10-01", TODAY));
    expect(held.board.settings.month).toBeNull();
    expect(held.board.months["2026-10-01"]).toBeDefined();
    // Asking for an unread month clears the old failure while it reads.
    lib.readMonth.mockReturnValueOnce(new Promise(() => undefined));
    act(() => held.board.selectMonth("2026-08-01", TODAY));
    expect(held.board.failed).toBe(false);
  });

  it("a failing earliest-month read alone is not a failure", async () => {
    lib.readEarliestMonth.mockRejectedValue(new Error("network"));
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    expect(held.board.failed).toBe(false);
    expect(held.board.months["2026-10-01"]).toBeDefined();
    expect(held.board.earliest).toBeNull();
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

describe("a payment the database confirmed (R1-7, criteria 14 and 15)", () => {
  const payment = (over: Partial<import("@/lib/payments").Payment> = {}): import("@/lib/payments").Payment => ({
    id: "p1",
    dueId: "a",
    amount: 40,
    method: "upi",
    paidOn: TODAY,
    receiptNo: 3,
    balanceAfter: 60,
    createdAt: Date.now(),
    voidedAt: null,
    ...over,
  });
  const openBoard = async () => {
    lib.readUnpaid.mockResolvedValue([due("a"), due("old", "2026-09-01")]);
    mount();
    act(() => held.board.open(TODAY));
    await flush();
  };

  it("applyPayment sets what is paid from what is left, in every slice that holds the fee, and marks them old", async () => {
    await openBoard();
    act(() => held.board.applyPayment(payment()));
    expect(held.board.months["2026-10-01"].rows[0]).toMatchObject({ amountPaid: 40, status: "partial" });
    expect(held.board.unpaid?.rows[0]).toMatchObject({ amountPaid: 40, status: "partial" });
    expect(held.board.months["2026-10-01"].at).toBe(0);
    // Another fee is untouched.
    expect(held.board.unpaid?.rows[1]).toMatchObject({ id: "old", amountPaid: 0, status: "due" });
    act(() => held.board.applyPayment(payment({ amount: 60, balanceAfter: 0 })));
    expect(held.board.months["2026-10-01"].rows[0]).toMatchObject({ amountPaid: 100, status: "paid" });
  });

  it("applyPayments (a Confirm that covered several fees, R1-10) patches each fee from its own payment", async () => {
    lib.readUnpaid.mockResolvedValue([due("a"), due("old", "2026-09-01")]);
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    act(() => held.board.applyPayments([payment({ id: "p0", dueId: "old", amount: 100, balanceAfter: 0 }), payment()]));
    expect(held.board.unpaid?.rows[1]).toMatchObject({ id: "old", amountPaid: 100, status: "paid" });
    expect(held.board.unpaid?.rows[0]).toMatchObject({ id: "a", amountPaid: 40, status: "partial" });
  });

  it("applying the same payment twice changes nothing more", async () => {
    await openBoard();
    act(() => held.board.applyPayment(payment()));
    act(() => held.board.applyPayment(payment()));
    expect(held.board.months["2026-10-01"].rows[0].amountPaid).toBe(40);
  });

  it("applyVoid takes the payment's amount back and returns the fee to due or part paid", async () => {
    await openBoard();
    act(() => held.board.applyPayment(payment({ amount: 100, balanceAfter: 0 })));
    expect(held.board.months["2026-10-01"].rows[0].status).toBe("paid");
    act(() => held.board.applyVoid(payment({ amount: 30, balanceAfter: 0, voidedAt: Date.now() })));
    expect(held.board.months["2026-10-01"].rows[0]).toMatchObject({ amountPaid: 70, status: "partial" });
    act(() => held.board.applyVoid(payment({ amount: 70, balanceAfter: 0, voidedAt: Date.now() })));
    expect(held.board.months["2026-10-01"].rows[0]).toMatchObject({ amountPaid: 0, status: "due" });
  });

  it("refresh reads the view again, and sends nothing offline", async () => {
    await openBoard();
    lib.readMonth.mockClear();
    act(() => held.board.refresh(TODAY));
    await flush();
    expect(lib.readMonth).toHaveBeenCalledTimes(1);
    onLine(false);
    act(() => held.board.refresh(TODAY));
    await flush();
    expect(lib.readMonth).toHaveBeenCalledTimes(1);
  });

  it("a notice says until when it is shown (10 seconds, 5 for undone), a newer one replaces it, and clearing takes it down", async () => {
    await openBoard();
    const now = Date.now();
    act(() => held.board.showNotice({ kind: "paid", payment: payment(), name: "Ravi" }));
    expect(held.board.notice).toMatchObject({ kind: "paid", until: now + 10_000 });
    act(() => held.board.showNotice({ kind: "undone" }));
    expect(held.board.notice).toMatchObject({ kind: "undone", until: now + 5_000 });
    act(() => held.board.clearNotice());
    expect(held.board.notice).toBeNull();
  });
});

describe("the reminders read (R1-8, criterion 29)", () => {
  it("is made with the dues on open, and gives the marks by fee", async () => {
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    expect(rem.readLastReminders).toHaveBeenCalledTimes(1);
    expect(held.board.reminders?.byDue.a.lastAt).toBe(5);
  });

  it("a failed read leaves the board working, with no marks and no failure", async () => {
    rem.readLastReminders.mockReset().mockRejectedValue(new Error("down"));
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    expect(held.board.failed).toBe(false);
    expect(held.board.reminders).toBeNull();
    expect(held.board.months["2026-10-01"].rows.map((d) => d.id)).toEqual(["a"]);
  });

  it("a later failed read keeps the marks it had", async () => {
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    rem.readLastReminders.mockReset().mockRejectedValue(new Error("down"));
    act(() => held.board.refresh(TODAY));
    await flush();
    expect(held.board.reminders?.byDue.a.times).toBe(1);
    expect(held.board.failed).toBe(false);
  });
});

describe("Collected and ensureCurrent (UX-review-fixes-2, 3.3 to 3.5 and 10.3)", () => {
  const payment = (over: Partial<import("@/lib/payments").Payment> = {}): import("@/lib/payments").Payment => ({
    id: "p1",
    dueId: "a",
    amount: 40,
    method: "upi",
    paidOn: TODAY,
    receiptNo: 3,
    balanceAfter: 60,
    createdAt: Date.now(),
    voidedAt: null,
    ...over,
  });
  const ids = (month = "2026-10-01") => held.board.collected[month]?.payments.map((p) => p.id);

  it("reads the month's payments on open and maps each to its student, held fees first, the rest by id in chunks of 100", async () => {
    const many = Array.from({ length: 150 }, (_, i) => payment({ id: `q${i}`, dueId: `gone${i}`, amount: 1 }));
    pay.readPaymentsInMonth.mockResolvedValue([payment(), ...many]);
    lib.readDuesByIds.mockImplementation(async (list: string[]) => list.map((id) => ({ ...due(id), studentId: "S9" })));
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    await flush();
    expect(pay.readPaymentsInMonth).toHaveBeenCalledWith("2026-10-01");
    expect(lib.readDuesByIds).toHaveBeenCalledTimes(2);
    expect(lib.readDuesByIds.mock.calls.map(([list]) => (list as string[]).length)).toEqual([100, 50]);
    const slice = held.board.collected["2026-10-01"];
    expect(slice?.payments).toHaveLength(151);
    expect(slice?.studentOf.a).toBe("S1");
    expect(slice?.studentOf.gone149).toBe("S9");
  });

  it("a failed read is not a failure of the board: nothing saved gives null, something saved is kept", async () => {
    pay.readPaymentsInMonth.mockRejectedValue(new Error("down"));
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    expect(held.board.failed).toBe(false);
    expect(held.board.collected["2026-10-01"]).toBeNull();
    pay.readPaymentsInMonth.mockResolvedValue([payment()]);
    act(() => held.board.refresh(TODAY));
    await flush();
    await flush();
    expect(ids()).toEqual(["p1"]);
    pay.readPaymentsInMonth.mockRejectedValue(new Error("down"));
    act(() => held.board.refresh(TODAY));
    await flush();
    expect(ids()).toEqual(["p1"]);
    expect(held.board.failed).toBe(false);
  });

  it("does not count as a read for the roster: a month switch that only reads Collected leaves `reads` alone", async () => {
    // The first Collected read fails, so the month's fees are fresh and Collected is not.
    pay.readPaymentsInMonth.mockRejectedValueOnce(new Error("down"));
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    await flush();
    const before = held.board.reads;
    lib.readMonth.mockClear();
    pay.readPaymentsInMonth.mockClear();
    act(() => held.board.selectMonth("2026-10-01", TODAY));
    await flush();
    await flush();
    expect(lib.readMonth).not.toHaveBeenCalled();
    expect(pay.readPaymentsInMonth).toHaveBeenCalledTimes(1);
    expect(held.board.collected["2026-10-01"]?.payments).toEqual([]);
    expect(held.board.reads).toBe(before);
  });

  it("applyPayment adds the payment to the month of its paid-on date, not the month on screen, and marks it old", async () => {
    pay.readPaymentsInMonth.mockImplementation(async (month: string) => (month === "2026-09-01" ? [payment({ id: "s1", paidOn: "2026-09-20" })] : []));
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    await flush();
    act(() => held.board.selectMonth("2026-09-01", TODAY));
    await flush();
    await flush();
    expect(ids("2026-09-01")).toEqual(["s1"]);
    act(() => held.board.applyPayment(payment({ id: "p2", paidOn: "2026-09-30" })));
    expect(ids("2026-09-01")).toEqual(["s1", "p2"]);
    expect(ids()).toEqual([]);
    expect(held.board.collected["2026-09-01"]?.at).toBe(0);
    expect(held.board.collected["2026-09-01"]?.studentOf.a).toBe("S1");
    act(() => held.board.applyPayment(payment({ id: "p3" })));
    expect(ids()).toEqual(["p3"]);
    // The same payment twice is counted once.
    act(() => held.board.applyPayment(payment({ id: "p3" })));
    expect(ids()).toEqual(["p3"]);
  });

  it("applyVoid takes the payment out of Collected and marks it old, and a read already on its way cannot put it back", async () => {
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    await flush();
    act(() => held.board.applyPayment(payment()));
    const slow = deferred<import("@/lib/payments").Payment[]>();
    pay.readPaymentsInMonth.mockReturnValue(slow.promise);
    act(() => held.board.refresh(TODAY));
    act(() => held.board.applyVoid(payment({ voidedAt: Date.now() })));
    expect(ids()).toEqual([]);
    expect(held.board.collected["2026-10-01"]?.at).toBe(0);
    slow.resolve([payment()]);
    await flush();
    await flush();
    expect(ids()).toEqual([]);
  });

  it("ensureCurrent reads the current month and the unpaid fees only when they are missing or old, with no ensure_my_dues, reminders or Collected", async () => {
    mount();
    act(() => held.board.ensureCurrent(TODAY));
    await flush();
    expect(lib.readMonth).toHaveBeenCalledWith("2026-10-01");
    expect(lib.readUnpaid).toHaveBeenCalledTimes(1);
    expect(lib.ensureMyDues).not.toHaveBeenCalled();
    expect(rem.readLastReminders).not.toHaveBeenCalled();
    expect(lib.readEarliestMonth).not.toHaveBeenCalled();
    expect(pay.readPaymentsInMonth).not.toHaveBeenCalled();
    expect(held.board.months["2026-10-01"].rows.map((d) => d.id)).toEqual(["a"]);
    act(() => held.board.ensureCurrent(TODAY));
    await flush();
    expect(lib.readMonth).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-12T05:02:00Z"));
    act(() => held.board.ensureCurrent(TODAY));
    await flush();
    expect(lib.readMonth).toHaveBeenCalledTimes(2);
  });

  it("ensureCurrent offline: nothing sent; failed only when nothing is saved", async () => {
    onLine(false);
    mount();
    act(() => held.board.ensureCurrent(TODAY));
    await flush();
    expect(lib.readMonth).not.toHaveBeenCalled();
    expect(held.board.failed).toBe(true);
  });

  it("ensureCurrent's failed read sets failed in the shared snapshot (true when Home opens next)", async () => {
    lib.readMonth.mockRejectedValue(new Error("down"));
    mount();
    act(() => held.board.ensureCurrent(TODAY));
    await flush();
    expect(held.board.failed).toBe(true);
  });

  it("Students first, then Home offline: the month's fees are saved but Collected was never read, so it is missing, not reading", async () => {
    mount();
    act(() => held.board.ensureCurrent(TODAY));
    await flush();
    expect(held.board.months["2026-10-01"]).toBeDefined();
    expect(held.board.collected["2026-10-01"]).toBeUndefined();
    onLine(false);
    act(() => held.board.open(TODAY));
    await flush();
    expect(pay.readPaymentsInMonth).not.toHaveBeenCalled();
    expect(held.board.failed).toBe(true);
    expect(held.board.months["2026-10-01"].rows.map((d) => d.id)).toEqual(["a"]);
    expect(held.board.collected["2026-10-01"]).toBeNull();
  });

  it("offline open keeps a Collected figure already saved", async () => {
    pay.readPaymentsInMonth.mockResolvedValue([]);
    mount();
    act(() => held.board.open(TODAY));
    await flush();
    await flush();
    const saved = held.board.collected["2026-10-01"];
    expect(saved).toBeTruthy();
    onLine(false);
    act(() => held.board.open(TODAY));
    await flush();
    expect(held.board.collected["2026-10-01"]).toBe(saved);
  });

  it("selectMonth offline onto a month whose fees came from ensureCurrent: Collected is missing, not reading", async () => {
    mount();
    act(() => held.board.ensureCurrent(TODAY));
    await flush();
    onLine(false);
    act(() => held.board.selectMonth("2026-10-01", TODAY));
    await flush();
    expect(pay.readPaymentsInMonth).not.toHaveBeenCalled();
    expect(held.board.blocked).toBeNull();
    expect(held.board.settings.month).toBeNull();
    expect(held.board.collected["2026-10-01"]).toBeNull();
  });
});
