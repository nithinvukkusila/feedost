"use client";

// The home screen chooses by the roster (spec R1-3, criteria 13 to 15): the empty book for a tutor with no
// students, the filled home for one with some. Loading and error are the roster's own states.
import { useRoster } from "@/components/app/roster";
import { RosterGate } from "@/components/app/roster-states";
import { activeStudents } from "@/lib/student-list";
import { EmptyHome } from "./empty-home";
import { FilledHome } from "./filled-home";

function Chosen() {
  const { students } = useRoster();
  const active = activeStudents(students);
  return active.length === 0 ? <EmptyHome /> : <FilledHome students={active} />;
}

export function HomeScreen() {
  return (
    <RosterGate>
      <Chosen />
    </RosterGate>
  );
}
