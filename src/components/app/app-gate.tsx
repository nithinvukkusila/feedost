"use client";

// The signed-in guard for every app screen (spec R1-1, criteria 15 to 20, 26 and 36). It shows nothing
// but "Opening your book…" until it knows who is signed in and has read their row, then either the
// screen or a move to where the tutor belongs (sign-in, or the open setup step). A network failure shows
// the error banner with "Try again"; it never signs the tutor out.
//
// This is a convenience for the person, not security. The database's row-level security is the wall:
// a signed-out visitor gets zero rows whatever this page draws.
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@/config/locales";
import { localeHref, placePath, signInPath, type Place } from "@/config/routes";
import { signOut, useSession } from "@/lib/auth";
import { nextRoute } from "@/lib/profile";
import { getTutor, syncLanguage, type Tutor } from "@/lib/tutor";
import { LoadError } from "./load-error";
import { LoadingBook } from "./loading-book";

type TutorState =
  | { status: "idle" }
  | { status: "ready"; tutor: Tutor }
  | { status: "missing" }
  | { status: "error" };

type TutorContextValue = { tutor: Tutor; setTutor: (tutor: Tutor) => void };
const TutorContext = createContext<TutorContextValue | null>(null);

/** The signed-in tutor's row, for a screen inside the gate. `setTutor` keeps it fresh after a save. */
export function useTutor(): TutorContextValue {
  const value = useContext(TutorContext);
  if (value === null) throw new Error("useTutor is only for a screen inside the app gate");
  return value;
}

const places = Object.keys(placePath) as Place[];

/** Which screen an address is: `/hi/home/` is home. Anything unknown counts as home. */
export function placeOf(pathname: string, locale: Locale): Place {
  const wanted = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return places.find((place) => localeHref(locale, placePath[place]) === wanted) ?? "home";
}

export function AppGate({ children }: Readonly<{ children: ReactNode }>) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("appState");
  const { session, retry: retrySession } = useSession();
  const [state, setState] = useState<TutorState>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);

  const userId = session.status === "signed-in" ? session.userId : null;

  // Read the tutor's row once someone is signed in (and again on "Try again").
  useEffect(() => {
    if (userId === null) return;
    let alive = true;
    getTutor().then(
      (tutor) => alive && setState(tutor ? { status: "ready", tutor } : { status: "missing" }),
      () => alive && setState({ status: "error" }),
    );
    return () => {
      alive = false;
    };
  }, [userId, attempt]);

  // A row that belongs to someone else (another account signed in on this tab) is not this tutor's.
  const tutor = state.status === "ready" && state.tutor.id === userId ? state.tutor : undefined;

  const place = placeOf(pathname, locale);
  const decision = nextRoute({ session: session.status, profile: tutor, place });
  const target = decision.action === "go" ? placePath[decision.to] : null;
  useEffect(() => {
    if (target !== null) router.replace(localeHref(locale, target));
  }, [target, locale, router]);

  // Keep the tutor's saved language the page's language. Quietly: nothing is sent when they already match,
  // and a failure is ignored.
  useEffect(() => {
    if (tutor) void syncLanguage(tutor, locale);
  }, [tutor, locale]);

  const setTutor = useCallback((next: Tutor) => setState({ status: "ready", tutor: next }), []);
  const value = useMemo(() => (tutor ? { tutor, setTutor } : null), [tutor, setTutor]);

  const tryAgain = useCallback(() => {
    setState({ status: "idle" });
    setAttempt((n) => n + 1);
    retrySession();
  }, [retrySession]);

  const leave = useCallback(async () => {
    await signOut();
    router.replace(localeHref(locale, signInPath));
  }, [locale, router]);

  if (session.status === "error" || state.status === "error") return <LoadError kind="network" onRetry={tryAgain} />;
  if (state.status === "missing" && userId !== null) return <LoadError kind="missing" onSignOut={leave} />;
  if (value !== null && decision.action === "stay") return <TutorContext.Provider value={value}>{children}</TutorContext.Provider>;
  return <LoadingBook label={t("loading")} />;
}
