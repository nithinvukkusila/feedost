// Spec R1-1, criteria 10, 11, 12, 18, 19 and 9: the sign-in code, against a small fake of the client.
// The library is never imported here: ./supabase is replaced.
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "sb-cicicicicicicicicici-auth-token";

type Listener = (event: string, session: unknown) => void;
const fake = {
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
  listeners: [] as Listener[],
};
const getClient = vi.fn();

vi.mock("./supabase", () => ({ getClient: () => getClient() }));

const session = { user: { id: "user-1", email: "meena@example.com" } };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://cicicicicicicicicici.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "ci-anon-key");
  fake.listeners = [];
  for (const fn of [fake.signInWithOAuth, fake.exchangeCodeForSession, fake.getSession, fake.signOut, fake.onAuthStateChange, fake.unsubscribe, getClient]) fn.mockReset();
  fake.signInWithOAuth.mockResolvedValue({ data: {}, error: null });
  fake.exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  fake.getSession.mockResolvedValue({ data: { session }, error: null });
  fake.signOut.mockResolvedValue({ error: null });
  fake.onAuthStateChange.mockImplementation((listener: Listener) => {
    fake.listeners.push(listener);
    return { data: { subscription: { unsubscribe: fake.unsubscribe } } };
  });
  getClient.mockResolvedValue({ auth: fake });
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

const load = () => import("./auth");

describe("hasStoredSession (criterion 12)", () => {
  it("is false with nothing stored, and loads no library", async () => {
    const { hasStoredSession } = await load();
    expect(hasStoredSession()).toBe(false);
    expect(getClient).not.toHaveBeenCalled();
  });

  it("is true when the library's key is there", async () => {
    localStorage.setItem(KEY, "{}");
    const { hasStoredSession } = await load();
    expect(hasStoredSession()).toBe(true);
  });

  it("ignores another project's key and other keys", async () => {
    localStorage.setItem("sb-someotherproject-auth-token", "{}");
    localStorage.setItem("ui-language", "hi");
    const { hasStoredSession } = await load();
    expect(hasStoredSession()).toBe(false);
  });

  it("is false when storage is blocked", async () => {
    const { hasStoredSession } = await load();
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(hasStoredSession()).toBe(false);
    spy.mockRestore();
  });

  it("is false when the build has no project address", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    const { hasStoredSession } = await load();
    expect(hasStoredSession()).toBe(false);
  });
});

describe("startGoogleSignIn (criteria 7, 9)", () => {
  it("asks for Google with the page's own origin and the callback path of the language", async () => {
    const { startGoogleSignIn } = await load();
    await expect(startGoogleSignIn("hi")).resolves.toEqual({ ok: true });
    expect(fake.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/hi/auth/callback/` },
    });
  });

  it("does nothing when the phone is offline, and does not even load the library", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    const { startGoogleSignIn } = await load();
    await expect(startGoogleSignIn("en")).resolves.toEqual({ ok: false, reason: "offline" });
    expect(getClient).not.toHaveBeenCalled();
    expect(fake.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("fails quietly when the library says no", async () => {
    fake.signInWithOAuth.mockResolvedValue({ data: {}, error: new Error("no") });
    const { startGoogleSignIn } = await load();
    await expect(startGoogleSignIn("en")).resolves.toEqual({ ok: false, reason: "failed" });
  });

  it("fails quietly when the library cannot be loaded", async () => {
    getClient.mockRejectedValue(new Error("chunk"));
    const { startGoogleSignIn } = await load();
    await expect(startGoogleSignIn("en")).resolves.toEqual({ ok: false, reason: "failed" });
  });
});

describe("readCallback (criterion 11)", () => {
  it("reads the code from the query", async () => {
    const { readCallback } = await load();
    expect(readCallback({ search: "?code=abc123", hash: "" })).toEqual({ code: "abc123", hasError: false });
  });

  it("reads the code from the hash", async () => {
    const { readCallback } = await load();
    expect(readCallback({ search: "", hash: "#code=abc123" })).toEqual({ code: "abc123", hasError: false });
  });

  it("sees an error in the query", async () => {
    const { readCallback } = await load();
    expect(readCallback({ search: "?error=access_denied&error_description=User+cancelled", hash: "" })).toEqual({ code: null, hasError: true });
  });

  it("sees an error in the hash", async () => {
    const { readCallback } = await load();
    expect(readCallback({ search: "", hash: "#error=access_denied" })).toEqual({ code: null, hasError: true });
  });

  it("finds nothing in a bare address", async () => {
    const { readCallback } = await load();
    expect(readCallback({ search: "", hash: "" })).toEqual({ code: null, hasError: false });
    expect(readCallback({ search: "?code=", hash: "" })).toEqual({ code: null, hasError: false });
  });
});

describe("finishSignIn (criterion 10)", () => {
  it("exchanges the code once, even when called twice at once (strict mode)", async () => {
    window.history.replaceState(null, "", "/en/auth/callback/?code=abc123");
    const { finishSignIn } = await load();
    const [a, b] = await Promise.all([finishSignIn(), finishSignIn()]);
    expect([a, b]).toEqual(["ok", "ok"]);
    expect(fake.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(fake.exchangeCodeForSession).toHaveBeenCalledWith("abc123");
    await expect(finishSignIn()).resolves.toBe("ok");
    expect(fake.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it("removes the code from the address bar, keeping the path", async () => {
    window.history.replaceState(null, "", "/en/auth/callback/?code=abc123#x=1");
    const { finishSignIn } = await load();
    await finishSignIn();
    expect(window.location.pathname).toBe("/en/auth/callback/");
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("says cancelled for an error in the address, without calling the library", async () => {
    window.history.replaceState(null, "", "/en/auth/callback/?error=access_denied");
    const { finishSignIn } = await load();
    await expect(finishSignIn()).resolves.toBe("cancelled");
    expect(fake.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("says cancelled for an error in the hash", async () => {
    window.history.replaceState(null, "", "/en/auth/callback/#error=server_error");
    const { finishSignIn } = await load();
    await expect(finishSignIn()).resolves.toBe("cancelled");
  });

  it("says failed when there is no code (a reloaded callback address)", async () => {
    window.history.replaceState(null, "", "/en/auth/callback/");
    const { finishSignIn } = await load();
    await expect(finishSignIn()).resolves.toBe("failed");
    expect(fake.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("says failed when the exchange is refused (no stored verifier, a used code)", async () => {
    window.history.replaceState(null, "", "/en/auth/callback/?code=used");
    fake.exchangeCodeForSession.mockResolvedValue({ data: {}, error: new Error("invalid grant") });
    const { finishSignIn } = await load();
    await expect(finishSignIn()).resolves.toBe("failed");
  });

  it("says failed when the library cannot be loaded or throws", async () => {
    window.history.replaceState(null, "", "/en/auth/callback/?code=abc");
    fake.exchangeCodeForSession.mockRejectedValue(new Error("boom"));
    const { finishSignIn } = await load();
    await expect(finishSignIn()).resolves.toBe("failed");
  });
});

describe("signOut (criterion 18)", () => {
  it("ends this device's session only", async () => {
    const { signOut } = await load();
    await signOut();
    expect(fake.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("clears the stored session even when the call fails", async () => {
    localStorage.setItem(KEY, "{}");
    fake.signOut.mockRejectedValue(new Error("offline"));
    const { signOut, hasStoredSession } = await load();
    await expect(signOut()).resolves.toBeUndefined();
    expect(hasStoredSession()).toBe(false);
  });

  it("clears the stored session even when the library cannot be loaded", async () => {
    localStorage.setItem(KEY, "{}");
    getClient.mockRejectedValue(new Error("chunk"));
    const { signOut, hasStoredSession } = await load();
    await signOut();
    expect(hasStoredSession()).toBe(false);
  });
});

describe("the one-time message (criterion 19)", () => {
  it("is read once after a reload: the second page load finds nothing", async () => {
    const first = await load();
    first.setNotice("expired");
    expect(first.readNotice()).toBe("expired");
    expect(first.readNotice()).toBe("expired");
    vi.resetModules();
    const reloaded = await load();
    expect(reloaded.readNotice()).toBeNull();
  });

  it("survives a move inside the app even when storage is blocked", async () => {
    const { setNotice, readNotice } = await load();
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    setNotice("failed");
    spy.mockRestore();
    expect(readNotice()).toBe("failed");
  });

  it("is read from storage on a fresh load, and only if it is one we wrote", async () => {
    sessionStorage.setItem("signin-notice", "cancelled");
    const { readNotice } = await load();
    expect(readNotice()).toBe("cancelled");
    vi.resetModules();
    sessionStorage.setItem("signin-notice", "something else");
    expect((await load()).readNotice()).toBeNull();
  });

  it("tells a listener when a message arrives or is cleared, until it stops listening", async () => {
    const { setNotice, clearNotice, subscribeNotice } = await load();
    const heard = vi.fn();
    const stop = subscribeNotice(heard);
    setNotice("expired");
    clearNotice();
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    setNotice("failed");
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("a newer message replaces an older one that was already read", async () => {
    const { setNotice, readNotice, clearNotice } = await load();
    expect(readNotice()).toBeNull();
    setNotice("cancelled");
    expect(readNotice()).toBe("cancelled");
    clearNotice();
    expect(readNotice()).toBeNull();
  });
});

describe("useSession (criteria 15, 19, 20)", () => {
  it("is signed out at once, with no library, when nothing is stored", async () => {
    const { useSession } = await load();
    const { result } = renderHook(() => useSession());
    expect(result.current.session).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current.session).toEqual({ status: "signed-out" }));
    expect(getClient).not.toHaveBeenCalled();
  });

  it("is signed in with the user's id and email, and listens for changes", async () => {
    localStorage.setItem(KEY, "{}");
    const { useSession } = await load();
    const { result, unmount } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.session).toEqual({ status: "signed-in", userId: "user-1", email: "meena@example.com" }));
    await waitFor(() => expect(fake.listeners).toHaveLength(1));
    unmount();
    expect(fake.unsubscribe).toHaveBeenCalled();
  });

  it("is signed out with the expired message when the stored session is no longer good", async () => {
    localStorage.setItem(KEY, "{}");
    fake.getSession.mockResolvedValue({ data: { session: null }, error: Object.assign(new Error("refresh refused"), { name: "AuthApiError" }) });
    const { useSession, readNotice } = await load();
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.session).toEqual({ status: "signed-out" }));
    expect(readNotice()).toBe("expired");
  });

  it("is an error, not signed out, when the network failed (criterion 20)", async () => {
    localStorage.setItem(KEY, "{}");
    fake.getSession.mockResolvedValue({ data: { session: null }, error: Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError" }) });
    const { useSession, readNotice } = await load();
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.session).toEqual({ status: "error" }));
    expect(readNotice()).toBeNull();
  });

  it("is an error when the library cannot be loaded", async () => {
    localStorage.setItem(KEY, "{}");
    getClient.mockRejectedValue(new Error("chunk"));
    const { useSession } = await load();
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.session).toEqual({ status: "error" }));
  });

  it("tries again on retry", async () => {
    localStorage.setItem(KEY, "{}");
    getClient.mockRejectedValueOnce(new Error("chunk"));
    const { useSession } = await load();
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(result.current.session).toEqual({ status: "error" }));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.session.status).toBe("signed-in"));
  });

  it("goes to signed out with the expired message when a sign-out arrives that the tutor did not ask for", async () => {
    localStorage.setItem(KEY, "{}");
    const { useSession, readNotice } = await load();
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(fake.listeners).toHaveLength(1));
    act(() => fake.listeners[0]("SIGNED_OUT", null));
    expect(result.current.session).toEqual({ status: "signed-out" });
    expect(readNotice()).toBe("expired");
  });

  it("goes to signed out without the message when the tutor signed out themselves", async () => {
    localStorage.setItem(KEY, "{}");
    const { useSession, signOut, readNotice } = await load();
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(fake.listeners).toHaveLength(1));
    // The library announces the sign-out while signOut is still running.
    fake.signOut.mockImplementation(async () => {
      fake.listeners[0]("SIGNED_OUT", null);
      return { error: null };
    });
    await act(async () => {
      await signOut();
    });
    expect(result.current.session).toEqual({ status: "signed-out" });
    expect(readNotice()).toBeNull();
  });

  it("keeps the same state object when a refresh brings the same person", async () => {
    localStorage.setItem(KEY, "{}");
    const { useSession } = await load();
    const { result } = renderHook(() => useSession());
    await waitFor(() => expect(fake.listeners).toHaveLength(1));
    const before = result.current.session;
    act(() => fake.listeners[0]("TOKEN_REFRESHED", session));
    expect(result.current.session).toBe(before);
  });
});
