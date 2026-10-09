import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { STRIP_ROW_MAX, stripColumns, StudentStrip, type StripBlock } from "./student-strip";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

const legend = { paid: "14 paid", due: "4 due, hollow", overdue: "5 overdue, tall" };
const label = "23 students: 14 paid, 4 due, 5 overdue";

function make(paid: number, due: number, overdue: number): StripBlock[] {
  return [...Array<StripBlock>(paid).fill("paid"), ...Array<StripBlock>(due).fill("due"), ...Array<StripBlock>(overdue).fill("overdue")];
}

const strip = () => screen.getByRole("img");
const blocksOf = () => [...strip().children];

describe("stripColumns (criterion 79)", () => {
  it.each([
    [0, 0],
    [1, 1],
    [23, 23],
    [28, 28],
    [29, 15],
    [56, 28],
    [57, 19],
    [60, 20],
    [84, 28],
    [85, 22],
    [300, 28],
  ])("%i students go %i to a row", (count, columns) => {
    expect(stripColumns(count)).toBe(columns);
  });

  it("never puts more than 28 in a row, and never leaves a short last row when equal rows are possible", () => {
    for (let count = 1; count <= 400; count++) {
      const columns = stripColumns(count);
      expect(columns, String(count)).toBeLessThanOrEqual(STRIP_ROW_MAX);
      expect(columns, String(count)).toBeGreaterThanOrEqual(1);
      const rows = Math.ceil(count / columns);
      // The fewest rows that fit, and the last row is short by less than one row's worth of rows.
      expect(rows, String(count)).toBe(Math.ceil(count / STRIP_ROW_MAX));
      expect(rows * columns - count, String(count)).toBeLessThan(rows);
    }
  });

  it("gives nothing for nothing, and for a count that is not a count", () => {
    expect(stripColumns(-3)).toBe(0);
    expect(stripColumns(Number.NaN)).toBe(0);
    expect(stripColumns(23.9)).toBe(23);
  });
});

describe("StudentStrip blocks (criterion 75)", () => {
  it("draws one block per student, in the order given, each marked with its kind", () => {
    render(<StudentStrip blocks={make(14, 4, 5)} legend={legend} label={label} />);
    expect(blocksOf()).toHaveLength(23);
    expect(blocksOf().map((b) => b.getAttribute("data-kind"))).toEqual(make(14, 4, 5));
    for (const block of blocksOf()) expect(block.tagName).toBe("SPAN");
  });

  it("keeps the order it is given, mixed", () => {
    const mixed: StripBlock[] = ["overdue", "paid", "due", "paid"];
    render(<StudentStrip blocks={mixed} legend={legend} label={label} />);
    expect(blocksOf().map((b) => b.getAttribute("data-kind"))).toEqual(mixed);
  });

  it("makes paid short and filled green, due short and hollow, overdue tall and filled red", () => {
    render(<StudentStrip blocks={["paid", "due", "overdue"]} legend={legend} label={label} />);
    const [paid, due, overdue] = blocksOf().map(classes);
    expect(paid.sort()).toEqual(["bg-stamp", "h-3.5"]);
    expect(due.sort()).toEqual(["bg-slip", "border-2", "border-ink", "h-3.5"]);
    expect(overdue.sort()).toEqual(["bg-cloth", "h-6"]);
  });

  it("lays the blocks out on the strip grid with its column count", () => {
    render(<StudentStrip blocks={make(14, 4, 5)} legend={legend} label={label} />);
    expect(classes(strip())).toEqual(["strip-grid"]);
    expect((strip() as HTMLElement).style.getPropertyValue("--cols")).toBe("23");
    cleanup();
    render(<StudentStrip blocks={make(36, 14, 10)} legend={legend} label={label} />);
    expect((strip() as HTMLElement).style.getPropertyValue("--cols")).toBe("20");
    expect(blocksOf()).toHaveLength(60);
  });

  it("has no fourth shape, by type", () => {
    // @ts-expect-error part paid is drawn as due or overdue by its date
    render(<StudentStrip blocks={["part-paid"]} legend={legend} label={label} />);
    expect(blocksOf()[0].getAttribute("class")).toBeNull();
  });
});

describe("StudentStrip legend (criterion 76)", () => {
  it("always shows the three texts it was given, in the label style", () => {
    render(<StudentStrip blocks={make(14, 4, 5)} legend={legend} label={label} />);
    const list = screen.getByRole("list");
    expect(classes(list)).toEqual(expect.arrayContaining(["type-label", "flex-wrap"]));
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["14 paid", "4 due, hollow", "5 overdue, tall"]);
  });

  it("lets a long legend wrap and never truncates it", () => {
    render(<StudentStrip blocks={make(1, 1, 1)} legend={legend} label={label} />);
    for (const item of screen.getAllByRole("listitem")) expect(classes(item)).toContain("wrap-anywhere");
    expect(screen.getByRole("list").outerHTML).not.toMatch(/truncate|nowrap|line-clamp|text-ellipsis|overflow-hidden/);
  });

  it("colours each text as its kind, on top of words that already say it", () => {
    render(<StudentStrip blocks={make(1, 1, 1)} legend={legend} label={label} />);
    const [paid, due, overdue] = screen.getAllByRole("listitem");
    expect(classes(paid)).toContain("text-stamp");
    expect(classes(due)).toContain("text-ink-soft");
    expect(classes(overdue)).toContain("text-cloth");
  });

  it("cannot be drawn without its legend or with part of it, by type", () => {
    // The type is the guard; without it there is nothing to draw the legend from, and it does not draw.
    // @ts-expect-error the legend is required
    expect(() => render(<StudentStrip blocks={["paid"]} label={label} />)).toThrow();
    cleanup();
    // @ts-expect-error all three texts are required
    render(<StudentStrip blocks={["paid"]} legend={{ paid: "1 paid", due: "0 due" }} label={label} />);
  });
});

describe("StudentStrip for screen readers (criterion 77)", () => {
  it("is one image with the passed-in text alternative", () => {
    render(<StudentStrip blocks={make(14, 4, 5)} legend={legend} label={label} />);
    expect(screen.getByRole("img", { name: label })).toBe(strip());
  });

  it("cannot be drawn without the text alternative, by type", () => {
    // @ts-expect-error the label is required
    render(<StudentStrip blocks={["paid"]} legend={legend} />);
    expect(screen.getByRole("list")).toBeTruthy();
  });

  it("hides every block from screen readers", () => {
    render(<StudentStrip blocks={make(14, 4, 5)} legend={legend} label={label} />);
    for (const block of blocksOf()) expect(block.getAttribute("aria-hidden")).toBe("true");
  });

  it("has nothing that can be tapped or focused", () => {
    const { container } = render(<StudentStrip blocks={make(14, 4, 5)} legend={legend} label={label} />);
    expect(container.querySelectorAll("a, button, input, select, textarea, [tabindex], [role=button], [role=link], [onclick]")).toHaveLength(0);
    for (const block of blocksOf()) {
      expect(block.hasAttribute("tabindex")).toBe(false);
      expect(block.getAttribute("role")).toBeNull();
      // React keeps its handlers off the element, so look at what it attached.
      const handlers = Object.entries(block).flatMap(([key, value]) =>
        key.startsWith("__reactProps") ? Object.keys(value as object).filter((name) => /^on[A-Z]/.test(name)) : [],
      );
      expect(handlers).toEqual([]);
    }
  });
});

describe("StudentStrip with no students (criterion 79)", () => {
  it("renders nothing at all, not even the legend", () => {
    const { container } = render(<StudentStrip blocks={[]} legend={legend} label={label} />);
    expect(container.innerHTML).toBe("");
  });
});
