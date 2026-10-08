"use client";

// The few examples on the dev page that need state.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

/** A button that goes busy for a moment when tapped, to show that a second tap does nothing. */
export function BusyDemo({ label, busyLabel }: { label: string; busyLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [taps, setTaps] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Button
      variant="send"
      full
      busy={busy}
      busyLabel={busyLabel}
      data-testid="busy-demo"
      data-taps={taps}
      onClick={() => {
        setTaps((n) => n + 1);
        setBusy(true);
        timer.current = setTimeout(() => setBusy(false), 1500);
      }}
    >
      {label}
    </Button>
  );
}
