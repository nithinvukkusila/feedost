"use client";

// The callback screen (spec R1-1, criteria 10 and 11): Google has sent the tutor back with a one-time
// code in the address. This island exchanges it once, takes it out of the address bar, and moves on:
// to the app on success, to the sign-in screen with a message when it did not finish.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Locale } from "@/config/locales";
import { localeHref, placePath, signInPath } from "@/config/routes";
import { placeAfterSignIn } from "@/lib/after-sign-in";
import { finishSignIn, setNotice } from "@/lib/auth";

export function CallbackScreen({ locale, label }: Readonly<{ locale: Locale; label: string }>) {
  const router = useRouter();

  useEffect(() => {
    // Strict mode runs this twice. finishSignIn() gives both calls the one exchange; only the last run's
    // answer is acted on, so the tutor is moved once.
    let alive = true;
    void (async () => {
      const result = await finishSignIn();
      if (result === "ok") {
        const place = await placeAfterSignIn();
        if (alive) router.replace(localeHref(locale, placePath[place]));
        return;
      }
      if (!alive) return;
      setNotice(result);
      router.replace(localeHref(locale, signInPath));
    })();
    return () => {
      alive = false;
    };
  }, [locale, router]);

  return (
    <p role="status" className="type-body-lg py-6 font-bold text-ink-soft">
      {label}
    </p>
  );
}
