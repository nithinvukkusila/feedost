// Spec R1-1, criteria 15 to 20, 26 and 36: the gate shows only "Opening your book…" until it knows, then
// the screen or a move; a network failure is an error with "Try again", never a sign-out.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionState } from "@/lib/auth";
import type { Tutor } from "@/lib/tutor";
import { renderWithWords } from "@/test-utils/render-with-words";

const replace = vi.fn();
let pathname = "/en/home/";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }), usePathname: () => pathname }));

const auth = { session: { status: "loading" } as SessionState, retry: vi.fn(), signOut: vi.fn() };
const setNotice = vi.fn();
vi.mock("@/lib/auth", () => ({
  useSession: () => ({ session: auth.session, retry: auth.retry }),
  signOut: () => auth.signOut(),
  setNotice: (...args: unknown[]) => setNotice(...args),
}));

const getTutor = vi.fn<() => Promise<Tutor | null>>();
const syncLanguage = vi.fn();
vi.mock("@/lib/tutor", () => ({ getTutor: () => getTutor(), syncLanguage: (...args: unknown[]) => syncLanguage(...args) }));

import { AppGate, placeOf } from "./app-gate";

const tutor = (over: Partial<Tutor> = {}): Tutor => ({
  id: "user-1",
  email: "meena@example.com",
  name: "Meena Iyer",
  language: "en",
  upiId: "meena@okhdfc",
  subjects: ["maths"],
  ...over,
});
const signedIn: SessionState = { status: "signed-in", userId: "user-1", email: "meena@example.com" };

const gate = (locale: "en" | "hi" = "en") =>
  renderWithWords(
    <AppGate>
      <p>SCREEN</p>
    </AppGate>,
    locale,
  );

afterEach(cleanup);
beforeEach(() => {
  replace.mockReset();
  getTutor.mockReset();
  syncLanguage.mockReset();
  auth.retry.mockReset();
  setNotice.mockReset();
  auth.signOut.mockReset();
  auth.signOut.mockResolvedValue(undefined);
  auth.session = { status: "loading" };
  pathname = "/en/home/";
});

describe("placeOf", () => {
  it.each([
    ["/en/home/", "en", "home"],
    ["/en/home", "en", "home"],
    ["/hi/more/", "hi", "more"],
    ["/kn/setup/profile/", "kn", "setup-profile"],
    ["/te/setup/upi/", "te", "setup-upi"],
    ["/en/sign-in/", "en", "sign-in"],
    ["/en/auth/callback/", "en", "callback"],
    ["/en/something-else/", "en", "home"],
  ] as const)("%s in %s is %s", (path, locale, place) => {
    expect(placeOf(path, locale)).toBe(place);
  });
});

describe("before it knows (criterion 15)", () => {
  it("shows nothing but the loading words while the session is checked", () => {
    gate();
    expect(screen.getByRole("status").textContent).toBe("Opening your book…");
    expect(screen.queryByText("SCREEN")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("shows nothing but the loading words while the tutor's row is read", async () => {
    auth.session = signedIn;
    getTutor.mockReturnValue(new Promise(() => {}));
    gate();
    expect(screen.getByRole("status").textContent).toBe("Opening your book…");
    expect(screen.queryByText("SCREEN")).toBeNull();
  });
});

describe("signed out (criterion 16)", () => {
  it("replaces the address with sign-in, in the page's language, and shows no screen", async () => {
    auth.session = { status: "signed-out" };
    pathname = "/hi/home/";
    gate("hi");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/hi/sign-in/"));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("SCREEN")).toBeNull();
    expect(getTutor).not.toHaveBeenCalled();
  });
});

describe("signed in (criterion 17)", () => {
  it("shows the screen for a finished profile, and keeps the saved language the page's", async () => {
    auth.session = signedIn;
    getTutor.mockResolvedValue(tutor({ language: "hi" }));
    gate();
    expect(await screen.findByText("SCREEN")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    expect(syncLanguage).toHaveBeenCalledWith(expect.objectContaining({ language: "hi" }), "en");
  });

  it("sends a tutor with no name from home to step 1", async () => {
    auth.session = signedIn;
    getTutor.mockResolvedValue(tutor({ name: null }));
    gate();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/setup/profile/"));
    expect(screen.queryByText("SCREEN")).toBeNull();
  });

  it("sends a tutor with no UPI ID from home to step 2", async () => {
    auth.session = signedIn;
    getTutor.mockResolvedValue(tutor({ upiId: null }));
    gate();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/setup/upi/"));
  });

  it("lets step 1 stay open for a tutor who is only missing the UPI ID (that is how Edit works)", async () => {
    auth.session = signedIn;
    pathname = "/en/setup/profile/";
    getTutor.mockResolvedValue(tutor({ upiId: null }));
    gate();
    expect(await screen.findByText("SCREEN")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sends step 2 back to step 1 while the name is still missing", async () => {
    auth.session = signedIn;
    pathname = "/en/setup/upi/";
    getTutor.mockResolvedValue(tutor({ name: "" }));
    gate();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/setup/profile/"));
  });

  it("lets the setup steps stay open for a finished profile", async () => {
    auth.session = signedIn;
    pathname = "/en/setup/upi/";
    getTutor.mockResolvedValue(tutor());
    gate();
    expect(await screen.findByText("SCREEN")).toBeTruthy();
  });
});

describe("when the network fails (criterion 20)", () => {
  it("says so with Try again when the tutor's row cannot be read, and does not sign out", async () => {
    auth.session = signedIn;
    getTutor.mockRejectedValue(new Error("network"));
    gate();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Couldn't load your details");
    expect(alert.textContent).toContain("The network dropped. Nothing is lost.");
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText("SCREEN")).toBeNull();
  });

  it("reads again when Try again is tapped, and shows the screen when it works", async () => {
    auth.session = signedIn;
    getTutor.mockRejectedValueOnce(new Error("network"));
    getTutor.mockResolvedValue(tutor());
    gate();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(auth.retry).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("SCREEN")).toBeTruthy();
    expect(getTutor).toHaveBeenCalledTimes(2);
  });

  it("says so when the session itself could not be checked", () => {
    auth.session = { status: "error" };
    gate();
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load your details");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("when the server refuses the session, or keeps failing (review fix)", () => {
  it("signs out, leaves the expired message and goes to sign-in when the row read is refused", async () => {
    auth.session = signedIn;
    getTutor.mockRejectedValue(Object.assign(new Error("refused"), { kind: "rejected" }));
    gate();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/sign-in/"));
    expect(setNotice).toHaveBeenCalledWith("expired");
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers Sign out next to Try again for any other failure, and Sign out works", async () => {
    auth.session = signedIn;
    getTutor.mockRejectedValue(Object.assign(new Error("503"), { kind: "failed" }));
    gate();
    await screen.findByRole("button", { name: "Try again" });
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/sign-in/"));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
    expect(setNotice).not.toHaveBeenCalled();
  });

  describe("offline", () => {
    let online: PropertyDescriptor | undefined;
    beforeEach(() => {
      online = Object.getOwnPropertyDescriptor(Navigator.prototype, "onLine");
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    });
    afterEach(() => {
      delete (navigator as unknown as { onLine?: boolean }).onLine;
      if (online) Object.defineProperty(Navigator.prototype, "onLine", online);
    });

    it("shows the banner at once without asking the server, and Try again does nothing", async () => {
      auth.session = signedIn;
      gate();
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("The network dropped. Nothing is lost.");
      expect(getTutor).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(auth.retry).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("shows the banner after a moment when the session is still being checked", async () => {
      auth.session = { status: "loading" };
      gate();
      expect(screen.getByRole("status").textContent).toBe("Opening your book…");
      expect((await screen.findByRole("alert", undefined, { timeout: 3000 })).textContent).toContain("Nothing is lost");
    });
  });
});

describe("when the row is missing (criterion 26)", () => {
  it("says to sign out and in again, and offers Sign out, not Try again", async () => {
    auth.session = signedIn;
    getTutor.mockResolvedValue(null);
    gate();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We could not find your profile. Sign out, then sign in again.");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/sign-in/"));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});

describe("a row that is not this tutor's", () => {
  it("is never shown", async () => {
    auth.session = signedIn;
    getTutor.mockResolvedValue(tutor({ id: "someone-else" }));
    gate();
    await waitFor(() => expect(getTutor).toHaveBeenCalled());
    expect(screen.queryByText("SCREEN")).toBeNull();
  });
});
