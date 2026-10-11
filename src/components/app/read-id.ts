"use client";

// Reads one value from the page's address, in an effect. The edit screens are static shells: a record is
// named by `?id=...`, not by a path a static export cannot prerender (spec R1-3, decision 2). Not
// `useSearchParams`: it would make the build bail out of static rendering for the whole page.
//
// An effect, not `useSyncExternalStore`: on a tap inside the app the new screen renders before the router
// has moved the address, and only an effect is certain to run after it has. Until then the value is
// `undefined`, so a screen can wait instead of flashing "not found".
import { useEffect, useState } from "react";

/** `undefined` until the address has been read (the first paint), then the value, or `null` when the address has none. */
export function useQueryParam(name: string): string | null | undefined {
  const [value, setValue] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    // The address is outside React; reading it once after the screen is in place is what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(new URLSearchParams(window.location.search).get(name));
  }, [name]);
  return value;
}
