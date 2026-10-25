"use client";

// The dues board's data and the tutor's view of it, for the home screen (spec R1-6, decision 12) and the
// Students screen's status chips (UX-review-fixes-2, criterion 10.3, through `ensureCurrent`). The store
// itself is in board-store.ts; it is created the first time either screen asks and kept in the box that
// board-holder.tsx provides, so it survives moving between them.
import { useMemo, useSyncExternalStore } from "react";
import type { Tab } from "@/lib/dues-board";
import type { BatchFilterValue } from "@/lib/student-list";
import { useHolder } from "./board-holder";
import { BoardStore, type BoardSnapshot } from "./board-store";

export type Board = BoardSnapshot & {
  open: (today: string) => void;
  ensureCurrent: (today: string) => void;
  selectMonth: (month: string, today: string) => void;
  setTab: (tab: Tab) => void;
  setFilter: (filter: BatchFilterValue) => void;
  retry: (today: string) => void;
  applyPayment: BoardStore["applyPayment"];
  applyPayments: BoardStore["applyPayments"];
  applyVoid: BoardStore["applyVoid"];
  refresh: (today: string) => void;
  showNotice: BoardStore["showNotice"];
  clearNotice: () => void;
};

/** The board's state, for a screen inside the board provider. */
export function useBoard(): Board {
  const store = useHolder<BoardStore>().ensure(() => new BoardStore());
  const snapshot = useSyncExternalStore(store.subscribe, store.get, store.get);
  return useMemo<Board>(
    () => ({
      ...snapshot,
      open: store.open,
      ensureCurrent: store.ensureCurrent,
      selectMonth: store.selectMonth,
      setTab: store.setTab,
      setFilter: store.setFilter,
      retry: store.retry,
      applyPayment: store.applyPayment,
      applyPayments: store.applyPayments,
      applyVoid: store.applyVoid,
      refresh: store.refresh,
      showNotice: store.showNotice,
      clearNotice: store.clearNotice,
    }),
    [snapshot, store],
  );
}
