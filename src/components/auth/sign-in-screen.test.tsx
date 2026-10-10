// Spec R1-1, criteria 8, 9, 11, 12 and 13: the button's busy state and double tap, the offline and
// failure messages, the one-time notice, and the signed-in tutor who never sees the form.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Notice, SessionState } from "@/lib/auth";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

type Start = { ok: true } | { ok: false; reason: "offline" | "failed" };
const auth = {
  session: { status: "signed-out" } as SessionState,
  stored: false,
  notice: null as Notice | null,
  start: vi.fn<(locale: string) => Promise<Start>>(),
  clearNotice: vi.fn(),
};

vi.mock("@/lib/auth", () => ({
  useSession: () => ({ session: auth.session, retry: vi.fn() }),
  hasStoredSession: () => auth.stored,
  readNotice: () => auth.notice,
  subscribeNotice: () => () => {},
  startGoogleSignIn: (locale: string) => auth.start(locale),
  clearNotice: () => auth.clearNotice(),
}));
const placeAfterSignIn = vi.fn();
vi.mock("@/lib/after-sign-in", () => ({ placeAfterSignIn: () => placeAfterSignIn() }));

import { SignInScreen } from "./sign-in-screen";

const words = {
  google: "Continue with Google",
  busy: "Opening Google…",
  offline: "You are offline. Connect to the internet to sign in.",
  cancelled: "Sign-in was cancelled. Tap Continue with Google to try again.",
  failed: "Google sign-in did not finish. Nothing was saved. Try again.",
  expired: "You were signed out. Sign in again to carry on.",
  opening: "Opening your book…",
};

afterEach(cleanup);

beforeEach(() => {
  replace.mockReset();
  placeAfterSignIn.mockReset();
  placeAfterSignIn.mockResolvedValue("home");
  auth.session = { status: "signed-out" };
  auth.stored = false;
  auth.notice = null;
  auth.start.mockReset();
  auth.clearNotice.mockReset();
});

const draw = () => render(<SignInScreen locale="en" words={words} />);

describe("a first-time visitor", () => {
  it("sees the button, and no message", () => {
    draw();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("has no email field", () => {
    draw();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("tapping the button (criterion 8)", () => {
  it("asks for Google in the page's language, and is busy while it starts", async () => {
    auth.start.mockReturnValue(new Promise(() => {}));
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(auth.start).toHaveBeenCalledWith("en");
    const busy = await screen.findByRole("button", { name: "Opening Google…" });
    expect(busy.getAttribute("aria-busy")).toBe("true");
  });

  it("starts once however many times it is tapped", async () => {
    auth.start.mockReturnValue(new Promise(() => {}));
    draw();
    const button = screen.getByRole("button", { name: "Continue with Google" });
    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);
    const busy = await screen.findByRole("button", { name: "Opening Google…" });
    fireEvent.click(busy);
    fireEvent.click(busy);
    expect(auth.start).toHaveBeenCalledTimes(1);
  });

  it("clears an old message when a new try begins", () => {
    auth.start.mockReturnValue(new Promise(() => {}));
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect(auth.clearNotice).toHaveBeenCalledTimes(1);
  });

  it("stays busy after a good start: the browser is leaving for Google", async () => {
    auth.start.mockResolvedValue({ ok: true });
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await screen.findByRole("button", { name: "Opening Google…" });
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Opening Google…" })).toBeTruthy();
  });
});

describe("when it does not start (criterion 9)", () => {
  it("says the phone is offline, and the button works again", async () => {
    auth.start.mockResolvedValue({ ok: false, reason: "offline" });
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect((await screen.findByRole("alert")).textContent).toContain("You are offline. Connect to the internet to sign in.");
    const again = screen.getByRole("button", { name: "Continue with Google" });
    expect(again.hasAttribute("aria-busy")).toBe(false);
    auth.start.mockResolvedValue({ ok: true });
    fireEvent.click(again);
    await waitFor(() => expect(auth.start).toHaveBeenCalledTimes(2));
  });

  it("says Google did not finish when the library says no", async () => {
    auth.start.mockResolvedValue({ ok: false, reason: "failed" });
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Google sign-in did not finish. Nothing was saved. Try again.");
  });

  it("shows no error code", async () => {
    auth.start.mockResolvedValue({ ok: false, reason: "failed" });
    draw();
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    expect((await screen.findByRole("alert")).textContent).not.toMatch(/\d{3}|error|exception/i);
  });
});

describe("the message left by the callback or by an expired session (criteria 11 and 19)", () => {
  it.each([
    ["cancelled", words.cancelled],
    ["failed", words.failed],
    ["expired", words.expired],
  ] as const)("shows %s in words", (notice, text) => {
    auth.notice = notice;
    draw();
    expect(screen.getByRole("alert").textContent).toContain(text);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
  });
});

describe("a tutor who is already signed in (criteria 12 and 13)", () => {
  it("while the stored session is checked: the loading line, not the form", () => {
    auth.stored = true;
    auth.session = { status: "loading" };
    draw();
    expect(screen.getByRole("status").textContent).toContain("Opening your book…");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is sent on, and never sees the form", async () => {
    auth.stored = true;
    auth.session = { status: "signed-in", userId: "u", email: "meena@example.com" };
    draw();
    expect(screen.queryByRole("button")).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/home/"));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("is sent where the decision says (the open setup step, once it exists)", async () => {
    placeAfterSignIn.mockResolvedValue("setup-profile");
    auth.stored = true;
    auth.session = { status: "signed-in", userId: "u", email: null };
    render(<SignInScreen locale="hi" words={words} />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/hi/setup/profile/"));
  });

  it("sees the form again, with the message, when the stored session turns out to be dead", () => {
    auth.stored = true;
    auth.session = { status: "signed-out" };
    auth.notice = "expired";
    draw();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("You were signed out.");
  });
});
