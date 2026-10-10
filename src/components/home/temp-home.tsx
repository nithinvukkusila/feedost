"use client";

// TEMPORARY (spec R1-1, step 3 of the build order): a bare home that proves sign-in works. It shows
// who is signed in and a Sign out button. Step 4 replaces it with the app gate and the empty home.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/locales";
import { localeHref, signInPath } from "@/config/routes";
import { signOut, useSession } from "@/lib/auth";

export type TempHomeWords = { loading: string; signOut: string };

export function TempHome({ locale, words }: Readonly<{ locale: Locale; words: TempHomeWords }>) {
  const router = useRouter();
  const { session } = useSession();
  const signedOut = session.status === "signed-out";

  useEffect(() => {
    if (signedOut) router.replace(localeHref(locale, signInPath));
  }, [signedOut, locale, router]);

  if (session.status !== "signed-in") {
    return (
      <p role="status" className="type-body py-6 font-bold text-ink-soft">
        {words.loading}
      </p>
    );
  }

  async function leave() {
    await signOut();
    router.replace(localeHref(locale, signInPath));
  }

  return (
    <div className="flex flex-col gap-6 py-6">
      <p data-testid="signed-in-email" translate="no" className="type-value-latin break-all">
        {session.email}
      </p>
      <div className="pr-1.5 pb-1.5">
        <Button variant="record" full onClick={leave}>
          {words.signOut}
        </Button>
      </div>
    </div>
  );
}
