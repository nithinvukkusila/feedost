"use client";

// The view of one month, worked out once per change of its inputs and not once per row or per render
// (spec R1-6, plan risk "large lists"). `own` is the month's dues (null until read); `carried` the unpaid earlier ones (empty for a past month). `filteredOut` is true when the view is empty only because a batch is
// chosen: the same month with every batch has rows.
import { useMemo } from "react";
import type { Due } from "@/lib/dues";
import { boardView, type BoardView } from "@/lib/dues-board";
import type { BatchFilterValue } from "@/lib/student-list";
import type { Student } from "@/lib/students";

export function useBoardView(
  own: readonly Due[] | null,
  carried: readonly Due[],
  students: readonly Student[],
  month: string,
  today: string,
  filter: BatchFilterValue,
): { view: BoardView; filteredOut: boolean } {
  return useMemo(() => {
    const list = own === null ? [] : [...own, ...carried];
    const view = boardView(list, students, month, today, filter);
    const filteredOut = filter !== "all" && view.rows.length === 0 && boardView(list, students, month, today, "all").rows.length > 0;
    return { view, filteredOut };
  }, [own, carried, students, month, today, filter]);
}
