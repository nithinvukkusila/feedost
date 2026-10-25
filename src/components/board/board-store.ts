// The board's memory and its open policy, with no React in it (spec R1-6, decisions 12 and 13): what was
// read (a slice per month, the unpaid dues, the earliest month), whether the last read failed, and the
// tutor's month, tab and batch filter. It has no words. A read replaces its slice whole; a failed read
// keeps what was cached and sets `failed`; a ticket per slice keeps a slow old answer from overwriting a
// newer one. The only request that is not a read is `ensureMyDues`, made from `open` and nowhere else.
//
// The Students screen uses the same store (UX-review-fixes-2, criterion 10.3) through `ensureCurrent`, a light read
// of the current month and the unpaid fees only: no `ensureMyDues`, no reminders, no Collected. If it fails it sets
// `failed` in the shared snapshot like any other read; that is true information when Home opens next.
//
// "Collected" (criterion 3.3) is a slice per month of the payments received in it, with the student of each one's
// fee. Its read is never fatal: a failure keeps what was cached (or records that there is nothing) and never sets
// `failed`, so the board never says its fees are old because of it.
import { ensureMyDues, readDuesByIds, readEarliestMonth, readMonth, readUnpaid, type Due } from "@/lib/dues";
import { currentMonth, needsRead, type Tab } from "@/lib/dues-board";
import { readPaymentsInMonth, type Payment } from "@/lib/payments";
import { BANNER_MS, withPaid } from "@/lib/payments-view";
import { readLastReminders, type LastReminder } from "@/lib/reminders";
import type { BatchFilterValue } from "@/lib/student-list";
import { isOffline } from "@/lib/students";

export type Slice = { rows: Due[]; at: number };

/** When each fee was last reminded, by fee id (spec R1-8, criterion 29). Read with the dues; only ever what the server said. */
export type RemindersSlice = { byDue: Record<string, LastReminder>; at: number };

/** The payments received in one month (not voided) and, by fee id, the student each one paid for. */
export type CollectedSlice = { payments: Payment[]; studentOf: Record<string, string>; at: number };

/** `readDuesByIds` is asked for at most this many fees at once, so the address stays short. */
export const IDS_PER_READ = 100;

/** `month: null` is the current month, so the view moves on by itself after midnight; `tab: null` is the default tab. */
export type BoardSettings = { month: string | null; tab: Tab | null; filter: BatchFilterValue };

/** What the banner under the list says (spec R1-7, criteria 14 and 15). */
export type NoticeBody =
  // `payment` is the last one made. A Confirm of a claim that covered several fees (R1-10) also sets `payments`, all of them oldest first.
  | { kind: "paid"; payment: Payment; name: string; payments?: readonly Payment[] }
  | { kind: "undone" }
  | { kind: "undo-failed"; reason: "failed" | "offline" | "late" | "partial" };

/** A notice and the moment (milliseconds since 1970) it stops being shown. The banner takes it down then; the board keeps no timer. */
export type Notice = NoticeBody & { until: number };

const UNDONE_MS = 5_000;

export type BoardSnapshot = {
  months: Record<string, Slice>;
  unpaid: Slice | null;
  earliest: { month: string | null; at: number } | null;
  /** Null until a read of the reminders has worked. A failed read leaves it as it was and never sets `failed`: the board simply shows no marks. */
  reminders: RemindersSlice | null;
  /** By month. Missing: not read yet. Null: the read failed with nothing saved, so the figure is unknown. */
  collected: Record<string, CollectedSlice | null>;
  /** The last read failed, so what is shown is what was saved on this phone, or nothing. */
  failed: boolean;
  /** A month the tutor tried to open while offline that is not saved on this phone: the view stayed where it was. */
  blocked: string | null;
  /** How many reads have been applied. The screen asks for the roster again once per read. */
  reads: number;
  settings: BoardSettings;
  notice: Notice | null;
};

type Want = { month: boolean; unpaid: boolean; earliest: boolean; reminders: boolean; collected: boolean };

// The student of each fee the store already holds.
function knownStudents(s: BoardSnapshot): Map<string, string> {
  const known = new Map<string, string>();
  for (const slice of [...Object.values(s.months), s.unpaid]) for (const due of slice?.rows ?? []) known.set(due.id, due.studentId);
  return known;
}

export class BoardStore {
  private snapshot: BoardSnapshot = {
    months: {},
    unpaid: null,
    earliest: null,
    reminders: null,
    collected: {},
    failed: false,
    blocked: null,
    reads: 0,
    settings: { month: null, tab: null, filter: "all" },
    notice: null,
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
    // `fatal: false` is for the earliest month: if only that read fails, the month buttons stay as they were and nothing says the fees are old.
    // `onFail`, for a read that is not fatal, records the failure in its own slice.
    const job = <T>(
      key: string,
      ask: () => Promise<T>,
      apply: (snapshot: BoardSnapshot, value: T, at: number) => BoardSnapshot,
      fatal = true,
      onFail?: (snapshot: BoardSnapshot) => BoardSnapshot,
    ): Promise<boolean | null> => {
      const ticket = (this.tickets[key] ?? 0) + 1;
      this.tickets[key] = ticket;
      const newest = () => this.alive && this.tickets[key] === ticket;
      return ask().then(
        (value) => {
          if (!newest()) return null;
          this.change((s) => apply(s, value, Date.now()));
          return true;
        },
        () => {
          if (!newest()) return null;
          if (onFail) this.change(onFail);
          return fatal ? false : null;
        },
      );
    };
    const jobs: Promise<boolean | null>[] = [];
    if (want.month) jobs.push(job(`month:${viewMonth}`, () => readMonth(viewMonth), (s, rows, at) => ({ ...s, months: { ...s.months, [viewMonth]: { rows, at } } })));
    if (want.unpaid) jobs.push(job("unpaid", readUnpaid, (s, rows, at) => ({ ...s, unpaid: { rows, at } })));
    if (want.earliest) jobs.push(job("earliest", readEarliestMonth, (s, month, at) => ({ ...s, earliest: { month, at } }), false));
    // Not fatal either: if only this read fails, the marks stay as they were and nothing else changes.
    if (want.reminders) jobs.push(job("reminders", readLastReminders, (s, byDue, at) => ({ ...s, reminders: { byDue, at } }), false));
    // Not fatal: a failure keeps the saved figure, or records that there is none (the bar then says "—"). It is not
    // counted in `reads` either: the roster is asked for again only when fees arrive, never for Collected alone.
    if (want.collected) {
      jobs.push(
        job(
          `collected:${viewMonth}`,
          () => this.readCollected(viewMonth),
          (s, value, at) => ({ ...s, collected: { ...s.collected, [viewMonth]: { ...value, at } } }),
          false,
          (s) => (s.collected[viewMonth] ? s : { ...s, collected: { ...s.collected, [viewMonth]: null } }),
        ).then(() => null),
      );
    }
    void Promise.all(jobs).then((results) => {
      const failed = results.includes(false);
      const done = results.includes(true);
      if (!this.alive || (!failed && !done)) return;
      this.change((s) => ({ ...s, failed, reads: done ? s.reads + 1 : s.reads }));
    });
  }

  // The month's payments, and the student of each one's fee: first from the fees already held, then the rest by id
  // in chunks (fees since paid in full, from earlier months, or earlier balances). A fee that comes back missing is
  // simply not mapped; collectedInMonth counts it under All only. Any failure fails the whole read.
  private async readCollected(month: string): Promise<{ payments: Payment[]; studentOf: Record<string, string> }> {
    const payments = await readPaymentsInMonth(month);
    const known = knownStudents(this.snapshot);
    const studentOf: Record<string, string> = {};
    const unknown = new Set<string>();
    for (const payment of payments) {
      const id = known.get(payment.dueId);
      if (id === undefined) unknown.add(payment.dueId);
      else studentOf[payment.dueId] = id;
    }
    const ids = [...unknown];
    for (let from = 0; from < ids.length; from += IDS_PER_READ) {
      for (const due of await readDuesByIds(ids.slice(from, from + IDS_PER_READ))) studentOf[due.id] = due.studentId;
    }
    return { payments, studentOf };
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
    this.change((s) => ({ ...s, blocked: null }));
    if (isOffline()) return this.fail();
    const reread = () => {
      const month = this.viewMonth(today);
      this.read(month, { month: true, unpaid: month === currentMonth(today), earliest: true, reminders: true, collected: true });
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
    const now = Date.now();
    const held = this.snapshot;
    const want: Want = {
      month: needsRead(held.months[month], now),
      unpaid: month === current && needsRead(held.unpaid, now),
      earliest: false,
      reminders: false,
      collected: needsRead(held.collected[month], now),
    };
    const unread = held.months[month] === undefined || (month === current && held.unpaid === null);
    // Offline and nothing saved for that month: stay where we are and say so, rather than land on an error.
    if (isOffline() && unread) {
      this.change((s) => ({ ...s, blocked: month }));
      return;
    }
    const reading = want.month || want.unpaid;
    want.reminders = reading;
    this.change((s) => ({
      ...s,
      blocked: null,
      // Online, a new view starts clean (an uncached month shows loading, not an old error); offline, a stale month is saved data.
      failed: isOffline() ? s.failed || reading : false,
      settings: { ...s.settings, month: month === current ? null : month },
    }));
    if ((reading || want.collected) && !isOffline()) this.read(month, want);
  };

  /** Read again what the view shows. */
  readonly retry = (today: string): void => {
    if (isOffline()) return this.fail();
    this.change((s) => ({ ...s, failed: false }));
    const month = this.viewMonth(today);
    this.read(month, { month: true, unpaid: month === currentMonth(today), earliest: this.snapshot.earliest === null, reminders: true, collected: true });
  };

  readonly setTab = (tab: Tab): void => this.change((s) => ({ ...s, settings: { ...s.settings, tab } }));

  readonly setFilter = (filter: BatchFilterValue): void => this.change((s) => ({ ...s, settings: { ...s.settings, filter } }));

  // A fee changed by a payment the database has confirmed: patched in every slice that holds it, and those slices marked old so the next read replaces them.
  private patch(dueId: string, change: (due: Due) => Due) {
    const touch = (slice: Slice | null): Slice | null =>
      slice !== null && slice.rows.some((due) => due.id === dueId) ? { rows: slice.rows.map((due) => (due.id === dueId ? change(due) : due)), at: 0 } : slice;
    this.change((s) => ({
      ...s,
      months: Object.fromEntries(Object.entries(s.months).map(([month, slice]) => [month, touch(slice) as Slice])),
      unpaid: touch(s.unpaid),
    }));
  }

  // A change to Collected the database has confirmed. The slice is marked old so the next read replaces it, and a read
  // already on its way (asked before the change) is ignored, so it cannot put the old figure back.
  private patchCollected(month: string, change: (slice: CollectedSlice) => CollectedSlice) {
    const slice = this.snapshot.collected[month];
    if (!slice) return;
    const key = `collected:${month}`;
    this.tickets[key] = (this.tickets[key] ?? 0) + 1;
    this.change((s) => ({ ...s, collected: { ...s.collected, [month]: { ...change(slice), at: 0 } } }));
  }

  /**
   * The database recorded this payment: the fee has what is left after it, and the payment counts in the Collected of
   * the month of its paid-on date (not the month on screen). There is no earlier, optimistic state.
   */
  readonly applyPayment = (payment: Payment): void => {
    this.patch(payment.dueId, (due) => withPaid(due, due.amount - payment.balanceAfter));
    const student = knownStudents(this.snapshot).get(payment.dueId);
    this.patchCollected(currentMonth(payment.paidOn), (slice) => ({
      payments: [...slice.payments.filter((p) => p.id !== payment.id), payment],
      studentOf: student === undefined ? slice.studentOf : { ...slice.studentOf, [payment.dueId]: student },
      at: 0,
    }));
  };

  /** The database recorded these payments (a Confirm that covered several fees): each fee has what is left after its own. */
  readonly applyPayments = (payments: readonly Payment[]): void => {
    for (const payment of payments) this.applyPayment(payment);
  };

  /** The database undid this payment: the fee has its amount back, and the payment leaves Collected (criterion 3.5). */
  readonly applyVoid = (payment: Payment): void => {
    this.patch(payment.dueId, (due) => withPaid(due, due.amountPaid - payment.amount));
    for (const [month, slice] of Object.entries(this.snapshot.collected)) {
      if (slice?.payments.some((p) => p.id === payment.id)) this.patchCollected(month, (s) => ({ ...s, payments: s.payments.filter((p) => p.id !== payment.id) }));
    }
  };

  /**
   * For the Students screen (criterion 10.3): make sure the current month's fees and the unpaid ones are read, only
   * if they are missing or older than a minute. No `ensureMyDues`, no reminders, no Collected, no earliest month.
   * Offline with nothing saved, it marks the read failed; offline with something saved, it keeps that.
   */
  readonly ensureCurrent = (today: string): void => {
    const month = currentMonth(today);
    const now = Date.now();
    const want: Want = {
      month: needsRead(this.snapshot.months[month], now),
      unpaid: needsRead(this.snapshot.unpaid, now),
      earliest: false,
      reminders: false,
      collected: false,
    };
    if (!want.month && !want.unpaid) return;
    if (isOffline()) {
      if (this.snapshot.months[month] === undefined || this.snapshot.unpaid === null) this.fail();
      return;
    }
    this.read(month, want);
  };

  /** Read again what the view shows, quietly, to confirm a change. Offline, nothing is sent. */
  readonly refresh = (today: string): void => {
    if (isOffline()) return;
    const month = this.viewMonth(today);
    this.read(month, { month: true, unpaid: month === currentMonth(today), earliest: false, reminders: true, collected: true });
  };

  /** Show a notice for a while: 10 seconds, or 5 for "undone". A newer one replaces it. */
  readonly showNotice = (notice: NoticeBody): void => {
    const until = Date.now() + (notice.kind === "undone" ? UNDONE_MS : BANNER_MS);
    this.change((s) => ({ ...s, notice: { ...notice, until } as Notice }));
  };

  readonly clearNotice = (): void => this.change((s) => (s.notice === null ? s : { ...s, notice: null }));
}
