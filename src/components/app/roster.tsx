"use client";

// The tutor's students and batches, read once per signed-in session and shared by every screen (spec
// R1-3, criteria 11, 12 and 31). Screens show the cached lists at once and the provider refreshes them
// quietly whenever the tutor moves to another screen. A write puts the row the database returned into
// the cache; nothing is shown as saved that the database did not answer for.
//
// Status: `loading` (first read, nothing cached), `ready`, `error` (the first read failed, nothing cached).
// A failed refresh leaves `ready` and the cached lists and sets `stale`, so a screen can say so quietly.
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listBatches, type Batch } from "@/lib/batches";
import { listStudents, type Student } from "@/lib/students";
import { useTutor } from "./app-gate";

export type RosterStatus = "loading" | "ready" | "error";

export type Roster = {
  status: RosterStatus;
  students: Student[];
  batches: Batch[];
  /** The last refresh failed, so what is shown is what was saved on this phone. */
  stale: boolean;
  /** Read both lists again. */
  reload: () => void;
  /** Put a student the database answered with into the cache (added, changed, archived, restored). */
  put: (student: Student) => void;
  putBatch: (batch: Batch) => void;
  /** The batch is gone: take it out, and take it off its students (the database does the same). */
  removeBatch: (id: string) => void;
};

const RosterContext = createContext<Roster | null>(null);

/** The roster, for a screen inside the provider. */
export function useRoster(): Roster {
  const value = useContext(RosterContext);
  if (value === null) throw new Error("useRoster is only for a screen inside the roster provider");
  return value;
}

type Held = { status: RosterStatus; students: Student[]; batches: Batch[]; stale: boolean };

/** What was written while a read was on its way: laid over the read's answer, which may be older than the write. */
type Written = { students: Map<string, Student>; batches: Map<string, Batch>; removed: Set<string> };
const nothingWritten = (): Written => ({ students: new Map(), batches: new Map(), removed: new Set() });

function unbatched(student: Student, id: string): Student {
  return student.batchId === id ? { ...student, batchId: null } : student;
}

function lay(list: Student[], written: Written): Student[] {
  const ids = new Set(list.map((student) => student.id));
  const merged = list.map((student) => written.students.get(student.id) ?? student);
  for (const [id, student] of written.students) if (!ids.has(id)) merged.push(student);
  return [...written.removed].reduce((all, id) => all.map((student) => unbatched(student, id)), merged);
}

function layBatches(list: Batch[], written: Written): Batch[] {
  const ids = new Set(list.map((batch) => batch.id));
  const merged = list.filter((batch) => !written.removed.has(batch.id)).map((batch) => written.batches.get(batch.id) ?? batch);
  for (const [id, batch] of written.batches) if (!ids.has(id) && !written.removed.has(id)) merged.push(batch);
  return merged;
}

function RosterState({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const [held, setHeld] = useState<Held>({ status: "loading", students: [], batches: [], stale: false });
  const reading = useRef(false);
  const written = useRef<Written>(nothingWritten());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const read = useCallback(() => {
    if (reading.current) return;
    reading.current = true;
    written.current = nothingWritten();
    Promise.all([listStudents(), listBatches()]).then(
      ([students, batches]) => {
        reading.current = false;
        if (!alive.current) return;
        const over = written.current;
        setHeld({ status: "ready", students: lay(students, over), batches: layBatches(batches, over), stale: false });
      },
      () => {
        reading.current = false;
        if (!alive.current) return;
        // Keep what is cached. With nothing cached the first read failed: that is the error state.
        setHeld((now) => (now.status === "ready" ? { ...now, stale: true } : { ...now, status: "error" }));
      },
    );
  }, []);

  // Once at the start, and quietly again each time the tutor opens another screen.
  useEffect(() => {
    read();
  }, [read, pathname]);

  const reload = useCallback(() => {
    setHeld((now) => (now.status === "error" ? { ...now, status: "loading" } : now));
    read();
  }, [read]);

  const put = useCallback((student: Student) => {
    written.current.students.set(student.id, student);
    setHeld((now) => ({
      ...now,
      students: now.students.some((item) => item.id === student.id)
        ? now.students.map((item) => (item.id === student.id ? student : item))
        : [...now.students, student],
    }));
  }, []);

  const putBatch = useCallback((batch: Batch) => {
    written.current.batches.set(batch.id, batch);
    setHeld((now) => ({
      ...now,
      batches: now.batches.some((item) => item.id === batch.id)
        ? now.batches.map((item) => (item.id === batch.id ? batch : item))
        : [...now.batches, batch],
    }));
  }, []);

  const removeBatch = useCallback((id: string) => {
    written.current.removed.add(id);
    setHeld((now) => ({
      ...now,
      batches: now.batches.filter((batch) => batch.id !== id),
      students: now.students.map((student) => unbatched(student, id)),
    }));
  }, []);

  const value = useMemo<Roster>(() => ({ ...held, reload, put, putBatch, removeBatch }), [held, reload, put, putBatch, removeBatch]);
  return <RosterContext.Provider value={value}>{children}</RosterContext.Provider>;
}

/** Wraps the screens that show students. Keyed by the signed-in tutor, so another account never sees this one's lists. */
export function RosterProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { tutor } = useTutor();
  return <RosterState key={tutor.id}>{children}</RosterState>;
}
