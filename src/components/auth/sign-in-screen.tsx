"use client";

// The sign-in screen's one client island (spec R1-1, criteria 7 to 9 and 11 to 13): the Google button,
// its busy state and the one message the tutor may need to read. Its words arrive as props, all plain
// text, so no message parser is shipped for it.
//
// A first-time visitor is shown the button without the Supabase library being downloaded: it is
// fetched when the button is tapped, or when this phone already holds a session. A tutor who is
// already signed in never sees the button: after hydration they see the loading line and are sent on.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/locales";
import { localeHref, placePath } from "@/config/routes";
import { clearNotice, hasStoredSession, readNotice, startGoogleSignIn, subscribeNotice, useSession, type Notice } from "@/lib/auth";
import { placeAfterSignIn } from "@/lib/after-sign-in";

export type SignInWords = {
  google: string;
  busy: string;
  offline: string;
  cancelled: string;
  failed: string;
  expired: string;
  /** "Opening your book…", shown while a tutor who is already signed in is sent on. */
  opening: string;
};

const subscribeNothing = () => () => {};

/** The Google "G" on a round slip, drawn as lines so it carries no letter of its own. */
function GoogleMark() {
  return (
    <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-slip text-ink">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.3 6.7A7.5 7.5 0 1 0 19.5 12H12" />
      </svg>
    </span>
  );
}

export function SignInScreen({ locale, words }: Readonly<{ locale: Locale; words: SignInWords }>) {
  const router = useRouter();
  // False while the page is built and while it hydrates; true in the browser after. The form is not
  // drawn before then: it cannot work without JavaScript, and a signed-in tutor must not see it flash.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const { session } = useSession();
  const notice = useSyncExternalStore(subscribeNotice, readNotice, () => null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<"offline" | "failed" | null>(null);
  const starting = useRef(false);

  // Signed in: send them on (home, or the open setup step).
  const signedIn = session.status === "signed-in";
  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    void placeAfterSignIn().then((place) => {
      if (alive) router.replace(localeHref(locale, placePath[place]));
    });
    return () => {
      alive = false;
    };
  }, [signedIn, locale, router]);

  // Back from Google by the browser's Back button can restore this page as it was: busy. Tapping again must work.
  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      starting.current = false;
      setBusy(false);
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  if (!hydrated) return <div className="min-h-40" aria-hidden="true" />;

  // A stored session is being checked, or the tutor is being sent on: no form.
  if (signedIn || (session.status === "loading" && hasStoredSession())) {
    return (
      <p role="status" className="type-body py-6 font-bold text-ink-soft">
        {words.opening}
      </p>
    );
  }

  async function start() {
    if (starting.current) return;
    starting.current = true;
    setBusy(true);
    setProblem(null);
    clearNotice();
    const result = await startGoogleSignIn(locale);
    if (result.ok) return; // The browser is leaving for Google; stay busy until it does.
    starting.current = false;
    setBusy(false);
    setProblem(result.reason);
  }

  const shown: Notice | "offline" | null = problem ?? notice;
  const message = shown === null ? null : words[shown];

  return (
    <div className="flex flex-col gap-4">
      {/* The live region stays mounted; the message goes in when there is one. */}
      <div aria-live="polite" aria-atomic="true" className="empty:hidden">
        {message === null ? null : <Banner kind="error" title={message} detail={null} />}
      </div>
      <div className="pr-1.5 pb-1.5">
        <Button variant="record" size="xl" full busy={busy} busyLabel={words.busy} iconStart={<GoogleMark />} onClick={start}>
          {words.google}
        </Button>
      </div>
    </div>
  );
}
