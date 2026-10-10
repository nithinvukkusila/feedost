// Sign-in, sign-out and "who is signed in", for the whole app. The Supabase library is reached only
// through getClient() (src/lib/supabase.ts), and only when something needs it: a visitor with no stored
// session never downloads it until they tap the sign-in button (spec R1-1, criterion 12).
//
// Nothing here protects data. The signed-in guard is a convenience for the person; row-level security
// in the database is the wall.
import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/config/locales";
import { callbackPath, localeHref } from "@/config/routes";
import { getClient, type Session } from "./supabase";
import { storedSessionKey } from "./supabase-env";

// ---------------------------------------------------------------------------------------------
// A stored session, without the library

function readStorage(read: (storage: Storage) => string | null): string | null {
  try {
    return read(globalThis.localStorage);
  } catch {
    return null;
  }
}

/** True when this browser holds a session from an earlier sign-in. Reads storage only: no library, no network. False when storage is blocked. */
export function hasStoredSession(): boolean {
  const key = storedSessionKey();
  if (key === null) return false;
  return readStorage((storage) => storage.getItem(key)) !== null;
}

function removeStoredSession(): void {
  const key = storedSessionKey();
  if (key === null) return;
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // Storage is blocked: nothing was kept.
  }
}

// ---------------------------------------------------------------------------------------------
// A one-time message for the sign-in screen

export type Notice = "expired" | "cancelled" | "failed";
const NOTICE_KEY = "signin-notice";
const notices: readonly string[] = ["expired", "cancelled", "failed"];

// Kept in memory as well as in sessionStorage: in private mode storage can be blocked, and the message
// must still reach the sign-in screen when the app moves there without a page load.
let noticeNow: Notice | null | undefined;

/** Leaves a message for the next time the sign-in screen opens. */
export function setNotice(notice: Notice): void {
  noticeNow = notice;
  try {
    globalThis.sessionStorage.setItem(NOTICE_KEY, notice);
  } catch {
    // The in-memory copy is enough for a move inside the app.
  }
}

/** The waiting message, if any. The same answer on every call until it is cleared; a reload shows nothing, so it is seen once. */
export function readNotice(): Notice | null {
  if (noticeNow === undefined) {
    let stored: string | null = null;
    try {
      stored = globalThis.sessionStorage.getItem(NOTICE_KEY);
      globalThis.sessionStorage.removeItem(NOTICE_KEY);
    } catch {
      // Blocked storage: nothing was left.
    }
    noticeNow = stored !== null && notices.includes(stored) ? (stored as Notice) : null;
  } else {
    try {
      globalThis.sessionStorage.removeItem(NOTICE_KEY);
    } catch {
      // Blocked storage.
    }
  }
  return noticeNow;
}

/** The tutor has moved on (tapped the button): the message has done its work. */
export function clearNotice(): void {
  noticeNow = null;
}

// ---------------------------------------------------------------------------------------------
// Starting sign-in

export type StartResult = { ok: true } | { ok: false; reason: "offline" | "failed" };

/**
 * Starts Google sign-in with PKCE. On success the browser is already leaving for Google. The way back is
 * this page's own origin plus the callback path, so the code verifier the library keeps in this origin's
 * storage is found again (spec R1-1, section 8.4).
 */
export async function startGoogleSignIn(locale: Locale): Promise<StartResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, reason: "offline" };
  try {
    const client = await getClient();
    const redirectTo = `${window.location.origin}${localeHref(locale, callbackPath)}`;
    const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    return error ? { ok: false, reason: "failed" } : { ok: true };
  } catch {
    return { ok: false, reason: typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "failed" };
  }
}

// ---------------------------------------------------------------------------------------------
// Finishing sign-in, on the callback screen

export type Callback = { code: string | null; hasError: boolean };

/** Reads `code` and `error` from the query and from the hash: Google and Supabase use either. */
export function readCallback(location: { search: string; hash: string }): Callback {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const hasError = query.has("error") || hash.has("error");
  const code = query.get("code") ?? hash.get("code");
  return { code: code === "" ? null : code, hasError };
}

export type FinishResult = "ok" | "cancelled" | "failed";

let finishing: Promise<FinishResult> | null = null;

async function runFinish(): Promise<FinishResult> {
  const { code, hasError } = readCallback(window.location);
  // The code is single-use and must not stay in the address bar, the history or a bookmark.
  window.history.replaceState(window.history.state, "", window.location.pathname);
  if (hasError) return "cancelled";
  if (code === null) return "failed";
  try {
    const client = await getClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    return error ? "failed" : "ok";
  } catch {
    return "failed";
  }
}

/**
 * Exchanges the code in this page's address for a session, exactly once: a second call (React's strict
 * mode runs effects twice, a tap can double) gets the first call's answer. The library never reads the
 * address by itself (`detectSessionInUrl: false`), so this is the only exchange there is.
 */
export function finishSignIn(): Promise<FinishResult> {
  finishing ??= runFinish();
  return finishing;
}

// ---------------------------------------------------------------------------------------------
// Signing out

// True while the tutor's own sign-out is running, so the SIGNED_OUT it causes is not mistaken for an expiry.
let signingOut = false;

/**
 * Ends this device's session only (`scope: local`). If the call fails (offline), the stored session is
 * removed by hand and the tutor is signed out here all the same.
 */
export async function signOut(): Promise<void> {
  signingOut = true;
  try {
    const client = await getClient();
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Offline or the library would not load: the next line is the sign-out.
  } finally {
    removeStoredSession();
    signingOut = false;
  }
}

// ---------------------------------------------------------------------------------------------
// Who is signed in

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; userId: string; email: string | null }
  /** The session could not be checked because the network failed. The tutor is not signed out. */
  | { status: "error" };

function signedIn(session: Session): SessionState {
  return { status: "signed-in", userId: session.user.id, email: session.user.email ?? null };
}

/** The library marks a failure to reach the server with this error name; anything else about a session is final. */
function isNetworkError(error: { name?: string }): boolean {
  return error.name === "AuthRetryableFetchError";
}

async function readSession(): Promise<SessionState> {
  if (!hasStoredSession()) return { status: "signed-out" };
  try {
    const client = await getClient();
    // A local read; the library refreshes a token that is old.
    const { data, error } = await client.auth.getSession();
    if (data.session) return signedIn(data.session);
    if (error && isNetworkError(error)) return { status: "error" };
    // A session was stored but is no longer good (revoked, refresh refused): the tutor must hear why.
    setNotice("expired");
    return { status: "signed-out" };
  } catch {
    return { status: "error" };
  }
}

/**
 * The session, for screens that need it. `loading` until it is known. Subscribes to the library's
 * events only when someone is signed in, so a second tab's sign-out or a revoked session ends this one
 * too. A sign-out the tutor did not ask for leaves the "expired" message for the sign-in screen.
 */
export function useSession(): { session: SessionState; retry: () => void } {
  const [session, setSession] = useState<SessionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let stopped = false;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const first = await readSession();
      if (stopped) return;
      setSession(first);
      if (first.status !== "signed-in") return;
      try {
        const client = await getClient();
        if (stopped) return;
        const { data } = client.auth.onAuthStateChange((event, next) => {
          // Only set state here: the library holds a lock while this runs, and calling it back would wait on itself.
          if (event === "SIGNED_OUT") {
            if (!signingOut) setNotice("expired");
            setSession({ status: "signed-out" });
          } else if (next) {
            const now = signedIn(next);
            setSession((before) =>
              before.status === "signed-in" && now.status === "signed-in" && before.userId === now.userId && before.email === now.email ? before : now,
            );
          }
        });
        unsubscribe = () => data.subscription.unsubscribe();
      } catch {
        // The session is already known; only the live updates are missing.
      }
    })();
    return () => {
      stopped = true;
      unsubscribe?.();
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setSession({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { session, retry };
}
