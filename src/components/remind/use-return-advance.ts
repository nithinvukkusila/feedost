"use client";

// "The tutor came back from WhatsApp, so show the next parent" (spec R1-8, criterion 18; plan section 6).
// A step goes ready -> opened (the tap on "Open WhatsApp") -> hidden (the page was hidden: WhatsApp took the
// screen) -> advanced (the page is visible again, and `advance` is called once). A page that becomes visible
// without having been hidden after the tap does nothing, so a pop-up or a tab toggle cannot skip a parent.
// No `focus`, no `pageshow`, no timer. If a phone never reports `hidden`, the Next button is the way on.
// `advance(step)` must itself ignore a step that is no longer current: Next and a return can race.
import { useCallback, useEffect, useRef } from "react";

type Phase = "ready" | "opened" | "hidden" | "advanced";

/** Returns `opened()`, to call from the tap on "Open WhatsApp". `step` changes when the screen moves to another step, which starts it afresh. */
export function useReturnAdvance(step: number, advance: (step: number) => void): () => void {
  const phase = useRef<Phase>("ready");
  const latest = useRef(advance);
  useEffect(() => {
    latest.current = advance;
  });

  // A new step starts again from ready.
  useEffect(() => {
    phase.current = "ready";
  }, [step]);

  useEffect(() => {
    function onChange() {
      if (document.visibilityState === "hidden") {
        if (phase.current === "opened") phase.current = "hidden";
        return;
      }
      if (phase.current === "hidden") {
        phase.current = "advanced";
        latest.current(step);
      }
    }
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, [step]);

  return useCallback(() => {
    // A second tap on the same step (the link opened twice) must not undo a hidden or advanced phase.
    if (phase.current === "ready") phase.current = "opened";
  }, []);
}
