// The in-memory log of "WhatsApp was opened for this fee" (spec R1-8, criteria 17, 24 and 28; plan section 6).
// The Remind screen calls `log` the moment the tutor taps "Open WhatsApp"; the link never waits for it.
// A call that fails because the phone is offline, or for any reason that may pass, is kept here and tried
// again, with the same request id, when the network comes back (the window's `online` event) and when the
// tutor moves to the next step: at most 5 attempts in all, one at a time. A refusal that means the fee
// changed meanwhile (paid, archived, no phone, gone) drops the entry silently. The list lives in memory
// only and dies with the page: it is not saved, and the screen never says otherwise. R1-12's outbox takes
// this over; `Entry` is the argument shape it will reuse.
import { isOffline } from "./students";
import { FINAL_REFUSALS, recordReminder, ReminderError, type RecordArgs } from "./reminders";

export const MAX_ATTEMPTS = 5;

export type Entry = RecordArgs & { attempts: number };

export class LogQueue {
  private pending: Entry[] = [];
  private inflight = new Set<string>();
  private done = new Set<string>();
  private listeners = new Set<() => void>();
  private flushing = false;
  private again = false;
  private version = 0;
  private successes = 0;

  /** For useSyncExternalStore: changes whenever the pending list does. */
  readonly get = (): number => this.version;

  /** How many openings the database has confirmed. The board reads its marks again when this grows. */
  readonly saved = (): number => this.successes;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private change() {
    this.version += 1;
    for (const listener of this.listeners) listener();
  }

  /** Whether this request is waiting to be tried again (the step shows "Couldn't save"). */
  readonly isPending = (requestId: string): boolean => this.pending.some((entry) => entry.requestId === requestId);

  /**
   * Logs one opening. Starts the request before it returns, so the tap handler can call it and move on.
   * The same request id twice (a double tap) sends once. Never throws; never waits for the caller.
   */
  readonly log = (args: RecordArgs): void => {
    if (this.done.has(args.requestId) || this.inflight.has(args.requestId) || this.isPending(args.requestId)) return;
    void this.attempt({ ...args, attempts: 0 });
  };

  private async attempt(entry: Entry): Promise<void> {
    this.inflight.add(entry.requestId);
    let next: Entry = entry;
    try {
      next = { ...entry, attempts: entry.attempts + 1 };
      await recordReminder(next);
      this.done.add(next.requestId);
      this.successes += 1;
      this.remove(next.requestId);
      this.change();
    } catch (error) {
      const code = error instanceof ReminderError ? error.code : "failed";
      // An attempt that never left the phone (offline) is not an attempt: only ones that reached the server count.
      if (code === "offline") next = entry;
      if (FINAL_REFUSALS.includes(code)) this.remove(next.requestId);
      else if (next.attempts >= MAX_ATTEMPTS) this.remove(next.requestId);
      else this.keep(next);
    } finally {
      this.inflight.delete(entry.requestId);
    }
  }

  private keep(entry: Entry) {
    const at = this.pending.findIndex((e) => e.requestId === entry.requestId);
    if (at === -1) this.pending = [...this.pending, entry];
    else this.pending = this.pending.map((e, i) => (i === at ? entry : e));
    this.change();
  }

  private remove(requestId: string) {
    if (!this.isPending(requestId)) return;
    this.pending = this.pending.filter((e) => e.requestId !== requestId);
    this.change();
  }

  /** Tries every waiting entry again, one at a time, in the order they were made. Safe to call often. */
  readonly flush = async (): Promise<void> => {
    // Offline there is nothing to try, and trying would only use up nothing: wait for the `online` event.
    if (isOffline()) return;
    // A call made while one is running is not lost: the running one goes round once more when it ends.
    if (this.flushing) {
      this.again = true;
      return;
    }
    this.flushing = true;
    try {
      do {
        this.again = false;
        for (const entry of [...this.pending]) {
          if (this.inflight.has(entry.requestId) || !this.isPending(entry.requestId)) continue;
          await this.attempt(entry);
        }
      } while (this.again);
    } finally {
      this.flushing = false;
    }
  };
}
