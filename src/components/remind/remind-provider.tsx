"use client";

// What the Remind screen needs to remember while the tutor stays in the book (spec R1-8, plan section 6):
// the tone she chose (Polite until she changes it), the reminders queued by the tap on Remind or on
// "Remind all overdue", and the log that has not been saved yet. All in memory: never in the address,
// the history, storage or a module-level variable, which would outlive sign-out. The queue holds the
// parent's name and phone as they were when the tutor tapped, so the screen needs no read of its own;
// they leave this page's memory only inside the wa.me link. Keyed by the signed-in tutor, so another
// account never sees this one's. Tiny on purpose: it is in the first load of every screen in the book.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTutor } from "@/components/app/app-gate";
import { LogQueue } from "@/lib/reminder-log";
import type { Pick, QueueItem, Tone } from "@/lib/reminder-rules";

/** Fees reminded before today's tap: the fee id and when (milliseconds). Read from the board when the tutor tapped. */
export type LastAt = Readonly<Record<string, number>>;

export type Session =
  | { kind: "pick"; pick: Pick; batchNames: Readonly<Record<string, string>>; last: LastAt }
  | { kind: "run"; queue: readonly QueueItem[]; last: LastAt };

type Remind = {
  tone: Tone;
  setTone: (tone: Tone) => void;
  session: Session | null;
  /** Queue a reminder, a run or the pick list. The caller then goes to the Remind screen. */
  begin: (session: Session) => void;
  clear: () => void;
  log: LogQueue;
};

const RemindContext = createContext<Remind | null>(null);

/** The Remind session, for a screen inside the book. */
export function useRemind(): Remind {
  const value = useContext(RemindContext);
  if (value === null) throw new Error("useRemind is only for a screen inside the book");
  return value;
}

function RemindBox({ children }: Readonly<{ children: ReactNode }>) {
  const [tone, setTone] = useState<Tone>("polite");
  const [session, setSession] = useState<Session | null>(null);
  const [log] = useState(() => new LogQueue());
  const clear = useCallback(() => setSession(null), []);

  // The network came back: try again what could not be saved. Kept for as long as the tutor is in the book.
  useEffect(() => {
    const again = () => void log.flush();
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, [log]);

  const value = useMemo<Remind>(() => ({ tone, setTone, session, begin: setSession, clear, log }), [tone, session, clear, log]);
  return <RemindContext.Provider value={value}>{children}</RemindContext.Provider>;
}

export function RemindProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { tutor } = useTutor();
  return <RemindBox key={tutor.id}>{children}</RemindBox>;
}
