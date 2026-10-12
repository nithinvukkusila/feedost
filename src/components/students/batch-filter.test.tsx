// The batch filter's two forms (spec R1-3, decision 16, and R1-6, "forced select").
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Batch } from "@/lib/batches";
import { batchCounts } from "@/lib/student-list";
import { renderWithWords } from "@/test-utils/render-with-words";
import { BatchFilter } from "./batch-filter";

afterEach(cleanup);

const batches: Batch[] = [
  { id: "b1", name: "Class 10", timings: null },
  { id: "b2", name: "Class 8", timings: null },
];
const students = [
  { id: "s1", batchId: "b1" },
  { id: "s2", batchId: null },
] as never[];
const counts = batchCounts(students, batches);

describe("BatchFilter variants", () => {
  it("draws tabs for up to three batches by default, and the Students screen is unchanged", () => {
    renderWithWords(<BatchFilter batches={batches} counts={counts} value="all" onChange={vi.fn()} panelId="p" />);
    expect(screen.getAllByRole("tab").length).toBe(4);
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("draws the select whatever the number of batches when asked, with no panel id, and reports a choice", async () => {
    const onChange = vi.fn();
    renderWithWords(<BatchFilter variant="select" batches={batches} counts={counts} value="all" onChange={onChange} />);
    expect(screen.queryAllByRole("tab")).toHaveLength(0);
    const select = screen.getByRole("combobox", { name: "Show" });
    expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual(["All 2", "Class 10 1", "Class 8 0", "No batch 1"]);
    await userEvent.selectOptions(select, "b1");
    expect(onChange).toHaveBeenCalledWith("b1");
  });

  it("draws nothing with no batches, in either form", () => {
    const { container } = renderWithWords(<BatchFilter variant="select" batches={[]} counts={batchCounts([], [])} value="all" onChange={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});
