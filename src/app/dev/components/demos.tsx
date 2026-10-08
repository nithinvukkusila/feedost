"use client";

// The few examples on the dev page that need state.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";

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

/** A stamp that lands when the page loads, with a button to see it again. */
export function StampReplay({
  word,
  label,
  secondLine,
  replayLabel,
}: {
  word: string;
  label: string;
  secondLine: string;
  replayLabel: string;
}) {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-6 py-3">
      {/* A new key remounts the stamp, which is what restarts a one-shot animation. */}
      <Stamp key={run} size="md" tone="stamp" label={label} secondLine={secondLine} animate>
        {word}
      </Stamp>
      <Button variant="outline" data-testid="stamp-replay" onClick={() => setRun((n) => n + 1)}>
        {replayLabel}
      </Button>
    </div>
  );
}
