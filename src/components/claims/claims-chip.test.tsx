// Spec R1-10, criterion 16: the "to confirm" chip on Home. It shows what the database counted, only then,
// reads again when the page comes back, and never on a timer.
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClaimError } from "@/lib/claims";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const count = vi.fn();
vi.mock("@/lib/claims", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/claims")>()), countPendingClaims: () => count() }));

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ClaimsChip } from "./claims-chip";

beforeEach(() => {
  count.mockReset();
  push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const show = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("the chip", () => {
  it("draws nothing while the count is being read", () => {
    count.mockReturnValue(new Promise(() => {}));
    renderWithWords(<ClaimsChip />);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says how many are waiting and links to the inbox", async () => {
    count.mockResolvedValue(2);
    renderWithWords(<ClaimsChip />);
    const link = await screen.findByRole("link", { name: "2 to confirm" });
    expect(link.getAttribute("href")).toBe("/en/claims/");
  });

  it("is gone when none is waiting, and when the read fails", async () => {
    count.mockResolvedValue(0);
    renderWithWords(<ClaimsChip />);
    await waitFor(() => expect(count).toHaveBeenCalled());
    expect(screen.queryByRole("link")).toBeNull();
    cleanup();
    count.mockReset();
    count.mockRejectedValue(new ClaimError("failed"));
    renderWithWords(<ClaimsChip />);
    await waitFor(() => expect(count).toHaveBeenCalled());
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("reads again when the page is shown again, and takes the chip down if the count dropped", async () => {
    count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    renderWithWords(<ClaimsChip />);
    await screen.findByRole("link", { name: "2 to confirm" });
    await act(async () => show("hidden"));
    expect(count).toHaveBeenCalledTimes(1);
    await act(async () => show("visible"));
    await waitFor(() => expect(screen.queryByRole("link")).toBeNull());
    expect(count).toHaveBeenCalledTimes(2);
  });

  it("after a failed read on coming back, shows no number at all", async () => {
    count.mockResolvedValueOnce(3).mockRejectedValueOnce(new ClaimError("failed"));
    renderWithWords(<ClaimsChip />);
    await screen.findByRole("link", { name: "3 to confirm" });
    await act(async () => show("visible"));
    await waitFor(() => expect(screen.queryByRole("link")).toBeNull());
  });

  it("never polls: no timer is set up", () => {
    const text = readFileSync(join(process.cwd(), "src", "components", "claims", "claims-chip.tsx"), "utf8");
    expect(text).not.toMatch(/setInterval|setTimeout|requestAnimationFrame/);
  });

  it("imports nothing from the inbox, so its code is not in Home's first load", () => {
    const text = readFileSync(join(process.cwd(), "src", "components", "claims", "claims-chip.tsx"), "utf8");
    const imports = [...text.matchAll(/^import .* from "([^"]+)";/gm)].map((m) => m[1]);
    expect(imports.filter((i) => /claims-screen|claim-card|earlier-list|claim-view|payments|dues/.test(i))).toEqual([]);
    expect(imports).toContain("@/lib/claims");
  });
});
