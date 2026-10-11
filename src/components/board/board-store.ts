// The board's memory and its open policy, with no React in it (spec R1-6, decisions 12 and 13): what was
// read (a slice per month, the unpaid dues, the earliest month), whether the last read failed, and the
// tutor's month, tab and batch filter. It has no words. A read replaces its slice whole; a failed read
// keeps what was cached and sets `failed`; a ticket per slice keeps a slow old answer from overwriting a
// newer one. The only request that is not a read is `ensureMyDues`, made from `open` and nowhere else.
import { ensureMyDues, readEarliestMonth, readMonth, readUnpaid, type Due } from "@/lib/dues";
import { currentMonth, needsRead, type Tab } from "@/lib/dues-board";
import type { BatchFilterValue } from "@/lib/student-list";
import { isOffline } from "@/lib/students";

export type Slice = { rows: Due[]; at: number };

/** `month: null` is the current month, so the view moves on by itself after midnight; `tab: null` is the default tab. */
export type BoardSettings = { month: string | null; tab: Tab | null; filter: BatchFilterValue };

export type BoardSnapshot = {
  months: Record<string, Slice>;
  unpaid: Slice | null;
  earliest: { month: string | null; at: number } | null;
  /** The last read failed, so what is shown is what was saved on this phone, or nothing. */
  failed: boolean;
  /** How many reads have been applied. The screen asks for the roster again once per read. */
  reads: number;
  settings: BoardSettings;
};

type Want = { month: boolean; unpaid: boolean; earliest: boolean };

export class BoardStore {
  private snapshot: BoardSnapshot = {
    months: {},
    unpaid: null,
    earliest: null,
    failed: false,
    reads: 0,
    settings: { month: null, tab: null, filter: "all" },
  };
  private listeners = new Set<() => void>();
  private tickets: Record<string, number> = {};
  private alive = true;

  /** For useSyncExternalStore. A new object after every change. */
  readonly get = (): BoardSnapshot => this.snapshot;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.alive = true;
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.alive = false;
    };
  };

  private change(next: (snapshot: BoardSnapshot) => BoardSnapshot) {
    this.snapshot = next(this.snapshot);
    for (const listener of this.listeners) listener();
  }

  // Reads what is wanted, in parallel. Each slice keeps only the newest answer asked for.
  private read(viewMonth: string, want: Want) {
    const job = <T>(key: string, ask: () => Promise<T>, apply: (snapshot: BoardSnapshot, value: T, at: number) => BoardSnapshot): Promise<boolean | null> => {
      const ticket = (this.tickets[key] ?? 0) + 1;
      this.tickets[key] = ticket;
      const newest = () => this.alive && this.tickets[key] === ticket;
      return ask().then(
        (value) => {
          if (!newest()) return null;
          this.change((s) => apply(s, value, Date.now()));
          return true;
        },
        () => (newest() ? false : null),
      );
    };
    const jobs: Promise<boolean | null>[] = [];
    if (want.month) jobs.push(job(`month:${viewMonth}`, () => readMonth(viewMonth), (s, rows, at) => ({ ...s, months: { ...s.months, [viewMonth]: { rows, at } } })));
    if (want.unpaid) jobs.push(job("unpaid", readUnpaid, (s, rows, at) => ({ ...s, unpaid: { rows, at } })));
    if (want.earliest) jobs.push(job("earliest", readEarliestMonth, (s, month, at) => ({ ...s, earliest: { month, at } })));
    void Promise.all(jobs).then((results) => {
      const failed = results.includes(false);
      const done = results.includes(true);
      if (!this.alive || (!failed && !done)) return;
      this.change((s) => ({ ...s, failed, reads: done ? s.reads + 1 : s.reads }));
    });
  }

  private fail() {
    this.change((s) => ({ ...s, failed: true }));
  }

  private viewMonth(today: string): string {
    return this.snapshot.settings.month ?? currentMonth(today);
  }

  /**
   * The screen opened, or the India day changed. Asks the database to make any due that is missing and
   * reads, in parallel; if it made some, reads once more. Offline, nothing is sent.
   */
  readonly open = (today: string): void => {
    if (isOffline()) return this.fail();
    const reread = () => {
      const month = this.viewMonth(today);
      this.read(month, { month: true, unpaid: month === currentMonth(today), earliest: true });
    };
    reread();
    // Never waited for. A failure or a slow answer changes nothing on screen.
    void ensureMyDues().then((made) => {
      if (made > 0 && this.alive && !isOffline()) reread();
    });
  };

  /** Show another month. Reads only what is missing or older than a minute. */
  readonly selectMonth = (month: string, today: string): void => {
    const current = currentMonth(today);
    this.change((s) => ({ ...s, settings: { ...s.settings, month: month === current ? null : month } }));
    const now = Date.now();
    const want: Want = {
      month: needsRead(this.snapshot.months[month], now),
      unpaid: month === current && needsRead(this.snapshot.unpaid, now),
      earliest: false,
    };
    if (!want.month && !want.unpaid) return;
    if (isOffline()) return this.fail();
    this.read(month, want);
  };

  /** Read again what the view shows. */
  readonly retry = (today: string): void => {
    if (isOffline()) return this.fail();
    this.change((s) => ({ ...s, failed: false }));
    const month = this.viewMonth(today);
    this.read(month, { month: true, unpaid: month === currentMonth(today), earliest: this.snapshot.earliest === null });
  };

  readonly setTab = (tab: Tab): void => this.change((s) => ({ ...s, settings: { ...s.settings, tab } }));

  readonly setFilter = (filter: BatchFilterValue): void => this.change((s) => ({ ...s, settings: { ...s.settings, filter } }));
}
