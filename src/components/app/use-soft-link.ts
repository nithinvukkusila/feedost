"use client";

// Moves inside the signed-in app without a page load. The app's links are plain `<a href>`, so they work
// with no script, and a new tab, a copy of the address and a modified click all behave as a link should.
// An ordinary tap is taken over here and goes through the router, so the gate stays mounted and the
// screen opens at once instead of reading the session and the tutor's row again on a slow phone.
// A link to another language, or to a screen outside the app group, is not one of these: it loads a page.
import { useRouter } from "next/navigation";
import { useCallback, type MouseEvent } from "react";

/** The click handler for a link to `href` inside the app. */
export function useSoftLink(): (href: string) => (event: MouseEvent<HTMLAnchorElement>) => void {
  const router = useRouter();
  return useCallback(
    (href) => (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      router.push(href);
    },
    [router],
  );
}
