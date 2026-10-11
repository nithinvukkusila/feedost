"use client";

// The dues board's data and the tutor's view of it, shared by the book's screens (spec R1-6, decision
// 12). One provider in the book layout, so the month, tab and batch filter survive opening a student and
// coming back, and are gone when the tutor leaves the book (sign-out, More): the store lives in memory
// only, never in storage, and a module-level variable would outlive sign-out. The work is in board-store.ts.
import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useTutor } from "@/components/app/app-gate";
import type { Tab } from "@/lib/dues-board";
import type { BatchFilterValue } from "@/lib/student-list";
import { BoardStore, type BoardSnapshot } from "./board-store";

export type Board = BoardSnapshot & {
  open: (today: string) => void;
  selectMonth: (month: string, today: string) => void;
  setTab: (tab: Tab) => void;
  setFilter: (filter: BatchFilterValue) => void;
  retry: (today: string) => void;
};

const BoardContext = createContext<Board | null>(null);

/** The board's state, for a screen inside the provider. */
export function useBoard(): Board {
  const value = useContext(BoardContext);
  if (value === null) throw new Error("useBoard is only for a screen inside the board provider");
  return value;
}

function BoardState({ children }: Readonly<{ children: ReactNode }>) {
  const [store] = useState(() => new BoardStore());
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  const value = useMemo<Board>(
    () => ({ ...snapshot, open: store.open, selectMonth: store.selectMonth, setTab: store.setTab, setFilter: store.setFilter, retry: store.retry }),
    [snapshot, store],
  );
  return <BoardContext.Provider value={value}>{children}</BoardContext.Provider>;
}

/** Wraps the screens that show students. Keyed by the signed-in tutor, so another account never sees this one's board. */
export function BoardProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { tutor } = useTutor();
  return <BoardState key={tutor.id}>{children}</BoardState>;
}
