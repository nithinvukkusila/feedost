// Spec R1-10, criteria 17, 20, 21, 24 and 26: the inbox screen with the database reads, the board and the
// card replaced. The card's own states are tested in claim-card.test.tsx; here, what the screen does with
// its answers: the heading's count, Earlier, the empty and error states, the re-read when shown again, and
// the board and Undo banner after a Confirm.
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Roster } from "@/components/app/roster";
import type { Claim } from "@/lib/claims";
import type { Payment } from "@/lib/payments";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

const readPendingClaims = vi.fn();
const readHandledClaims = vi.fn();
const readDuesByIds = vi.fn();
vi.mock("@/lib/claims", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/claims")>()),
  readPendingClaims: () => readPendingClaims(),
  readHandledClaims: () => readHandledClaims(),
}));
vi.mock("@/lib/dues", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/dues")>()), readDuesByIds: (ids: string[]) => readDuesByIds(ids) }));

const board = { applyPayments: vi.fn(), showNotice: vi.fn(), refresh: vi.fn() };
const held: { roster: Roster } = { roster: undefined as unknown as Roster };
vi.mock("@/components/app/roster", () => ({ useRoster: () => held.roster }));
vi.mock("@/components/app/roster-states", () => ({ RosterGate: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/app/use-soft-link", () => ({ useSoftLink: () => () => undefined }));
vi.mock("@/components/app/app-screen", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/app/app-screen")>()),
  AppScreen: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/board/board-state", () => ({ useBoard: () => board }));
vi.mock("@/components/pay/undo-banner", () => ({ UndoBanner: () => null }));

// A stand-in card: its name, and three buttons that answer as the real card does once the database has spoken.
const handled = { payments: [] as Payment[] };
vi.mock("./claim-card", () => ({
  ClaimCard: (p: { claim: Claim; name: string; onConfirmed: (c: Claim, ps: Payment[]) => void; onRejected: (c: Claim) => void; onHandledElsewhere: (c: Claim) => void }) => (
    <article aria-label={`card ${p.name}`}>
      <button type="button" onClick={() => p.onConfirmed({ ...p.claim, status: "confirmed", handledAt: Date.now(), receiptFrom: 214, receiptCount: 1 }, handled.payments)}>
        confirm {p.name}
      </button>
      <button type="button" onClick={() => p.onRejected({ ...p.claim, status: "rejected", handledAt: Date.now() })}>
        reject {p.name}
      </button>
      <button type="button" onClick={() => p.onHandledElsewhere(p.claim)}>
        elsewhere {p.name}
      </button>
    </article>
  ),
}));

import { ClaimsScreen } from "./claims-screen";

const student = (id: string, name: string): Student => ({
  id,
  batchId: null,
  name,
  parentName: null,
  parentPhone: null,
  parentLanguage: "en",
  monthlyFee: 120000,
  openingBalance: 0,
  dueDay: 5,
  active: true,
});
const claim = (id: string, studentId: string): Claim => ({
  id,
  studentId,
  dueId: `d-${id}`,
  amount: 120000,
  feeCount: 1,
  upiRef: "628104739915",
  screenshotPath: null,
  status: "pending",
  createdAt: Date.parse("2026-10-12T05:00:00Z"),
  handledAt: null,
  receiptFrom: null,
  receiptCount: null,
});
const payment: Payment = { id: "p1", dueId: "d-c1", amount: 120000, method: "upi", paidOn: "2026-10-12", receiptNo: 214, balanceAfter: 0, createdAt: 1, voidedAt: null };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T09:00:00Z"));
  held.roster = { status: "ready", students: [student("s1", "Ravi Kumar"), student("s2", "Asha Rao")], batches: [], stale: false, reload: vi.fn(), put: vi.fn(), putBatch: vi.fn(), removeBatch: vi.fn() };
  [readPendingClaims, readHandledClaims, readDuesByIds, ...Object.values(board)].forEach((m) => m.mockReset());
  readDuesByIds.mockResolvedValue([]);
  readHandledClaims.mockResolvedValue([]);
  handled.payments = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("the heading and the cards (17, 26)", () => {
  it("counts the claims waiting, one card each", async () => {
    readPendingClaims.mockResolvedValue([claim("c1", "s1"), claim("c2", "s2")]);
    renderWithWords(<ClaimsScreen />);
    expect(await screen.findByRole("heading", { name: "2 parents say they've paid" })).toBeTruthy();
    expect(screen.getByText("Check your UPI app, then confirm.")).toBeTruthy();
    expect(screen.getByRole("article", { name: "card Ravi Kumar" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "card Asha Rao" })).toBeTruthy();
  });

  it("says one parent in the singular", async () => {
    readPendingClaims.mockResolvedValue([claim("c1", "s1")]);
    renderWithWords(<ClaimsScreen />);
    expect(await screen.findByRole("heading", { name: "1 parent says they've paid" })).toBeTruthy();
  });

  it("with nothing waiting says so, has no sub-line, and still lists Earlier", async () => {
    readPendingClaims.mockResolvedValue([]);
    readHandledClaims.mockResolvedValue([{ ...claim("c9", "s1"), status: "rejected", handledAt: Date.parse("2026-10-10T05:00:00Z") }]);
    renderWithWords(<ClaimsScreen />);
    expect(await screen.findByRole("heading", { name: "Nothing to confirm right now." })).toBeTruthy();
    expect(screen.queryByText("Check your UPI app, then confirm.")).toBeNull();
    expect(screen.getByText("Ravi Kumar")).toBeTruthy();
  });

  it("a first read that fails says so and Try again reads again", async () => {
    readPendingClaims.mockRejectedValueOnce(new Error("down")).mockResolvedValue([claim("c1", "s1")]);
    renderWithWords(<ClaimsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "1 parent says they've paid" })).toBeTruthy();
  });
});

describe("reading again (17)", () => {
  it("reads again when the page is shown again, and not on a timer", async () => {
    readPendingClaims.mockResolvedValueOnce([claim("c1", "s1")]).mockResolvedValue([claim("c1", "s1"), claim("c2", "s2")]);
    renderWithWords(<ClaimsScreen />);
    await screen.findByRole("heading", { name: "1 parent says they've paid" });
    expect(readPendingClaims).toHaveBeenCalledTimes(1);
    act(() => setVisibility("hidden"));
    expect(readPendingClaims).toHaveBeenCalledTimes(1);
    act(() => setVisibility("visible"));
    expect(await screen.findByRole("heading", { name: "2 parents say they've paid" })).toBeTruthy();
  });

  it("a quiet read that fails leaves the cards shown", async () => {
    readPendingClaims.mockResolvedValueOnce([claim("c1", "s1")]).mockRejectedValue(new Error("down"));
    renderWithWords(<ClaimsScreen />);
    await screen.findByRole("heading", { name: "1 parent says they've paid" });
    act(() => setVisibility("visible"));
    await waitFor(() => expect(readPendingClaims).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("article", { name: "card Ravi Kumar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });
});

describe("after the database has answered (20, 21, 24)", () => {
  it("Confirm takes the card out, lowers the count, patches the board and shows the Undo banner's notice", async () => {
    handled.payments = [payment];
    readPendingClaims.mockResolvedValue([claim("c1", "s1"), claim("c2", "s2")]);
    renderWithWords(<ClaimsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "confirm Ravi Kumar" }));
    expect(screen.getByRole("heading", { name: "1 parent says they've paid" })).toBeTruthy();
    expect(screen.queryByRole("article", { name: "card Ravi Kumar" })).toBeNull();
    expect(board.applyPayments).toHaveBeenCalledWith([payment]);
    expect(board.showNotice).toHaveBeenCalledWith({ kind: "paid", payment, payments: [payment], name: "Ravi Kumar" });
    expect(board.refresh).toHaveBeenCalledTimes(1);
  });

  it("a Confirm whose payments could not be read shows no banner but still moves the card", async () => {
    readPendingClaims.mockResolvedValue([claim("c1", "s1")]);
    renderWithWords(<ClaimsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "confirm Ravi Kumar" }));
    expect(screen.getByRole("heading", { name: "Nothing to confirm right now." })).toBeTruthy();
    expect(board.showNotice).not.toHaveBeenCalled();
    expect(board.applyPayments).not.toHaveBeenCalled();
  });

  it("Not received takes the card out and touches nothing on the board", async () => {
    readPendingClaims.mockResolvedValue([claim("c1", "s1")]);
    renderWithWords(<ClaimsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "reject Ravi Kumar" }));
    expect(screen.queryByRole("article", { name: "card Ravi Kumar" })).toBeNull();
    expect(board.applyPayments).not.toHaveBeenCalled();
    expect(board.showNotice).not.toHaveBeenCalled();
  });

  it("a claim another phone handled stays on screen with its message while the list is read again", async () => {
    readPendingClaims.mockResolvedValueOnce([claim("c1", "s1")]).mockResolvedValue([]);
    renderWithWords(<ClaimsScreen />);
    await userEvent.click(await screen.findByRole("button", { name: "elsewhere Ravi Kumar" }));
    await waitFor(() => expect(readPendingClaims).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("article", { name: "card Ravi Kumar" })).toBeTruthy();
  });
});
