"use client";

// The home screen chooses by the roster (spec R1-3, criteria 13 to 15): the empty book for a tutor with no
// students, the dues board (R1-6) for one with some. Loading and error are the roster's own states.
import { useRoster } from "@/components/app/roster";
import { RosterGate } from "@/components/app/roster-states";
import { BoardScreen } from "@/components/board/board-screen";
import { activeStudents } from "@/lib/student-list";
import { EmptyHome } from "./empty-home";

function Chosen() {
  const { students } = useRoster();
  const active = activeStudents(students);
  return active.length === 0 ? <EmptyHome /> : <BoardScreen />;
}

export function HomeScreen() {
  return (
    <RosterGate>
      <Chosen />
    </RosterGate>
  );
}
