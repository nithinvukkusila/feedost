// Spec R1-3, criteria 11, 12 and 31: the roster is read once, shown at once from the cache, refreshed
// quietly on each screen, kept when a refresh fails, updated from what the database returned, and dropped
// when another tutor signs in.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Batch } from "@/lib/batches";
import type { Student } from "@/lib/students";

const state = { pathname: "/en/students/", tutorId: "tutor-a" };
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("./app-gate", () => ({ useTutor: () => ({ tutor: { id: state.tutorId }, setTutor: vi.fn() }) }));

const listStudents = vi.fn<() => Promise<Student[]>>();
const listBatches = vi.fn<() => Promise<Batch[]>>();
vi.mock("@/lib/students", () => ({ listStudents: () => listStudents() }));
vi.mock("@/lib/batches", () => ({ listBatches: () => listBatches() }));

import { RosterProvider, useRoster, type Roster } from "./roster";

const student = (id: string, over: Partial<Student> = {}): Student => ({
  id,
  batchId: null,
  name: `Student ${id}`,
  parentName: null,
  parentPhone: null,
  parentLanguage: "en",
  monthlyFee: 100000,
  openingBalance: 0,
  dueDay: 1,
  active: true,
  ...over,
});
const batch = (id: string): Batch => ({ id, name: `Batch ${id}`, timings: null });

let latest: Roster;
function Probe() {
  const roster = useRoster();
  useEffect(() => {
    latest = roster;
  });
  return (
    <p>
      {roster.status}:{roster.students.map((s) => s.id).join(",")}:{roster.batches.map((b) => b.id).join(",")}:{roster.stale ? "stale" : "fresh"}
    </p>
  );
}
const view = () => render(<RosterProvider><Probe /></RosterProvider>);
const text = () => screen.getByText(/^(loading|ready|error):/).textContent;

beforeEach(() => {
  state.pathname = "/en/students/";
  state.tutorId = "tutor-a";
  listStudents.mockReset();
  listBatches.mockReset();
  listStudents.mockResolvedValue([student("s1")]);
  listBatches.mockResolvedValue([batch("b1")]);
});
afterEach(cleanup);

describe("RosterProvider", () => {
  it("starts loading, reads both lists once, and is ready", async () => {
    view();
    expect(text()).toBe("loading:::fresh");
    await waitFor(() => expect(text()).toBe("ready:s1:b1:fresh"));
    expect(listStudents).toHaveBeenCalledTimes(1);
    expect(listBatches).toHaveBeenCalledTimes(1);
  });

  it("refreshes quietly when the tutor opens another screen, and shows the cache meanwhile", async () => {
    const { rerender } = view();
    await waitFor(() => expect(text()).toBe("ready:s1:b1:fresh"));
    let release: (list: Student[]) => void = () => {};
    listStudents.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    state.pathname = "/en/home/";
    rerender(<RosterProvider><Probe /></RosterProvider>);
    expect(text()).toBe("ready:s1:b1:fresh");
    await act(async () => release([student("s1"), student("s2")]));
    await waitFor(() => expect(text()).toBe("ready:s1,s2:b1:fresh"));
    expect(listStudents).toHaveBeenCalledTimes(2);
  });

  it("keeps the cached lists and says they are stale when a refresh fails", async () => {
    const { rerender } = view();
    await waitFor(() => expect(text()).toBe("ready:s1:b1:fresh"));
    listStudents.mockRejectedValueOnce(new Error("network"));
    state.pathname = "/en/home/";
    rerender(<RosterProvider><Probe /></RosterProvider>);
    await waitFor(() => expect(text()).toBe("ready:s1:b1:stale"));
    // The next good read clears it.
    state.pathname = "/en/students/";
    rerender(<RosterProvider><Probe /></RosterProvider>);
    await waitFor(() => expect(text()).toBe("ready:s1:b1:fresh"));
  });

  it("is an error when the first read fails and nothing is cached, and reload tries again", async () => {
    listStudents.mockRejectedValueOnce(new Error("network"));
    view();
    await waitFor(() => expect(text()).toBe("error:::fresh"));
    act(() => latest.reload());
    expect(text()).toBe("loading:::fresh");
    await waitFor(() => expect(text()).toBe("ready:s1:b1:fresh"));
  });

  it("puts a student the database returned into the cache: new at the end, known ones replaced", async () => {
    view();
    await waitFor(() => expect(text()).toBe("ready:s1:b1:fresh"));
    act(() => latest.put(student("s2")));
    expect(text()).toBe("ready:s1,s2:b1:fresh");
    act(() => latest.put(student("s1", { name: "Renamed", active: false })));
    expect(latest.students.find((s) => s.id === "s1")).toMatchObject({ name: "Renamed", active: false });
    expect(latest.students).toHaveLength(2);
  });

  it("puts a batch in the cache, and takes a deleted batch off its students", async () => {
    listStudents.mockResolvedValue([student("s1", { batchId: "b1" }), student("s2", { batchId: "b2" })]);
    listBatches.mockResolvedValue([batch("b1"), batch("b2")]);
    view();
    await waitFor(() => expect(text()).toBe("ready:s1,s2:b1,b2:fresh"));
    act(() => latest.putBatch({ id: "b3", name: "Third", timings: "Mon" }));
    act(() => latest.putBatch({ id: "b2", name: "Second, renamed", timings: null }));
    expect(latest.batches.map((b) => b.name)).toEqual(["Batch b1", "Second, renamed", "Third"]);
    act(() => latest.removeBatch("b1"));
    expect(latest.batches.map((b) => b.id)).toEqual(["b2", "b3"]);
    expect(latest.students.map((s) => s.batchId)).toEqual([null, "b2"]);
  });

  it("lays a write made while a read was on its way over that read's older answer", async () => {
    let release: (list: Student[]) => void = () => {};
    listStudents.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    view();
    act(() => latest.put(student("new")));
    await act(async () => release([student("s1")]));
    await waitFor(() => expect(text()).toBe("ready:s1,new:b1:fresh"));
  });

  it("forgets everything when another tutor signs in", async () => {
    const { rerender } = view();
    await waitFor(() => expect(text()).toBe("ready:s1:b1:fresh"));
    listStudents.mockReturnValue(new Promise(() => {}));
    state.tutorId = "tutor-b";
    rerender(<RosterProvider><Probe /></RosterProvider>);
    expect(text()).toBe("loading:::fresh");
  });

  it("is a mistake to use it outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/roster provider/);
    quiet.mockRestore();
  });
});
