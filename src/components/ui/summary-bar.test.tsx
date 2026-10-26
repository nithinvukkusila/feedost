// UX-review-fixes-2, criteria 4.2 to 4.4: the summary bar's parts, order, zero parts, marks and text.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SummaryBar, SummaryPending } from "./summary-bar";

afterEach(cleanup);

const labels = { collected: "Collected ₹1,200", due: "Due ₹600", overdue: "Overdue ₹0" };
const parts = (root: HTMLElement) => [...root.querySelectorAll("[data-part]")] as HTMLElement[];

describe("SummaryBar", () => {
  it("draws Collected, Due and Overdue in that order, each as wide as its paise", () => {
    const { container } = render(<SummaryBar collected={120000} due={60000} overdue={30000} labels={labels} />);
    expect(parts(container).map((p) => p.dataset.part)).toEqual(["collected", "due", "overdue"]);
    expect(parts(container).map((p) => p.style.flexGrow)).toEqual(["120000", "60000", "30000"]);
    for (const p of parts(container)) expect(p.className).toMatch(/\bmin-w-1\b/);
  });

  it("differs by shape, not only colour: Collected solid, Due highlighted with an edge, Overdue tall", () => {
    const { container } = render(<SummaryBar collected={1} due={1} overdue={1} labels={labels} />);
    const [c, d, o] = parts(container);
    expect(c.className).toMatch(/\bbg-stamp\b/);
    expect(c.className).toMatch(/\bh-3\.5\b/);
    expect(d.className).toMatch(/\bbg-highlight\b/);
    expect(d.className).toMatch(/\bborder-2\b/);
    expect(o.className).toMatch(/\bbg-cloth\b/);
    expect(o.className).toMatch(/\bh-6\b/);
  });

  it("does not draw a zero part, but still shows its label", () => {
    const { container, getByText } = render(<SummaryBar collected={120000} due={60000} overdue={0} labels={labels} />);
    expect(parts(container).map((p) => p.dataset.part)).toEqual(["collected", "due"]);
    expect(getByText("Overdue ₹0")).toBeTruthy();
  });

  it("draws no Collected part while it is unknown, and no bar at all when every part is zero", () => {
    const { container, rerender } = render(<SummaryBar collected={null} due={500} overdue={0} labels={labels} />);
    expect(parts(container).map((p) => p.dataset.part)).toEqual(["due"]);
    rerender(<SummaryBar collected={0} due={0} overdue={0} labels={labels} />);
    expect(container.querySelector("[data-summary-bar]")).toBeNull();
    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("hides the bar from screen readers; the labels are a list read in order, each with its mark", () => {
    const { container, getByRole } = render(<SummaryBar collected={1} due={1} overdue={1} labels={labels} />);
    expect(container.querySelector("[data-summary-bar]")?.getAttribute("aria-hidden")).toBe("true");
    const items = [...getByRole("list").querySelectorAll("li")];
    expect(items.map((li) => li.textContent)).toEqual(["Collected ₹1,200", "Due ₹600", "Overdue ₹0"]);
    for (const li of items) expect(li.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("SummaryPending is a grey block with words for screen readers only", () => {
    const { container } = render(<SummaryPending label="Reading" />);
    expect(container.querySelector("[data-pending]")?.className).toMatch(/\bbg-tab-idle\b/);
    expect(container.querySelector(".sr-only")?.textContent).toBe("Reading");
  });
});
