"use client";

// Where the dues board's memory lives while the tutor is inside the book (spec R1-6, decision 12 and the
// plan's bundle cut line). The provider sits in the book layout, so every book route loads it, and it is
// deliberately tiny: it holds an empty box. The board's code (the reader, the arithmetic, the store) is in
// board-state.tsx, which only the home screen imports; the first time the home screen opens it puts the
// store in the box. Open a student and come back, and the same store is found: same month, tab and filter.
// Leave the book (sign-out, More) and this provider unmounts with the box, so everything resets. It lives
// in memory only: never in storage, and not in a module-level variable, which would outlive sign-out.
import { createContext, useContext, useState, type ReactNode } from "react";
import { useTutor } from "@/components/app/app-gate";

/** A box that is filled once, by whoever needs it first. */
export class Holder<T> {
  private value: T | null = null;
  ensure(make: () => T): T {
    if (this.value === null) this.value = make();
    return this.value;
  }
}

const HolderContext = createContext<Holder<unknown> | null>(null);

/** The box, for a screen inside the provider. */
export function useHolder<T>(): Holder<T> {
  const holder = useContext(HolderContext);
  if (holder === null) throw new Error("The board is only for a screen inside the board provider");
  return holder as Holder<T>;
}

function BoardBox({ children }: Readonly<{ children: ReactNode }>) {
  const [holder] = useState(() => new Holder<unknown>());
  return <HolderContext.Provider value={holder}>{children}</HolderContext.Provider>;
}

/** Wraps the screens that show students. Keyed by the signed-in tutor, so another account never sees this one's board. */
export function BoardProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { tutor } = useTutor();
  return <BoardBox key={tutor.id}>{children}</BoardBox>;
}
