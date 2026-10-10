// Spec R1-1, criteria 10 and 11: the callback exchanges once, even under React's strict mode, then moves on.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FinishResult } from "@/lib/auth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const finishSignIn = vi.fn<() => Promise<FinishResult>>();
const setNotice = vi.fn();
vi.mock("@/lib/auth", () => ({ finishSignIn: () => finishSignIn(), setNotice: (n: string) => setNotice(n) }));
const placeAfterSignIn = vi.fn();
vi.mock("@/lib/after-sign-in", () => ({ placeAfterSignIn: () => placeAfterSignIn() }));

import { CallbackScreen } from "./callback-screen";

afterEach(cleanup);

beforeEach(() => {
  replace.mockReset();
  setNotice.mockReset();
  finishSignIn.mockReset();
  placeAfterSignIn.mockReset();
  placeAfterSignIn.mockResolvedValue("home");
});

describe("CallbackScreen", () => {
  it("says it is signing the tutor in while it works", () => {
    finishSignIn.mockReturnValue(new Promise(() => {}));
    render(<CallbackScreen locale="en" label="Signing you in…" />);
    expect(screen.getByRole("status").textContent).toContain("Signing you in…");
    expect(replace).not.toHaveBeenCalled();
  });

  it("goes on to the app once the code is exchanged", async () => {
    finishSignIn.mockResolvedValue("ok");
    render(<CallbackScreen locale="te" label="x" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/te/home/"));
    expect(setNotice).not.toHaveBeenCalled();
  });

  it("moves once under strict mode, which runs the effect twice", async () => {
    finishSignIn.mockResolvedValue("ok");
    render(
      <StrictMode>
        <CallbackScreen locale="en" label="x" />
      </StrictMode>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it.each(["cancelled", "failed"] as const)("returns to sign-in with the %s message", async (result) => {
    finishSignIn.mockResolvedValue(result);
    render(<CallbackScreen locale="kn" label="x" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/kn/sign-in/"));
    expect(setNotice).toHaveBeenCalledWith(result);
  });
});
