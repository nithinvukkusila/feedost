import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Row, Rows, type RowTone } from "./row";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

describe("Row structure (criterion 36)", () => {
  it("is a list item at least 64px tall with a 1px rule below", () => {
    render(
      <Rows aria-label="Overdue">
        <Row name="Ravi Kumar" meta="7 days late" tone="overdue" />
      </Rows>,
    );
    const list = screen.getByRole("list", { name: "Overdue" });
    expect(list.tagName).toBe("UL");
    const item = within(list).getByRole("listitem");
    expect(classes(item)).toEqual(expect.arrayContaining(["min-h-row", "border-b", "border-rule"]));
  });

  it("shows name and meta, then the amount, then the trailing item", () => {
    render(
      <Rows>
        <Row
          name="Ravi Kumar"
          meta="7 days late"
          tone="overdue"
          amount="₹1,200"
          trailing={<button type="button">Remind</button>}
        />
      </Rows>,
    );
    const item = screen.getByRole("listitem");
    const order = ["Ravi Kumar", "7 days late", "₹1,200", "Remind"].map((t) => item.textContent!.indexOf(t));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
  });

  it("leaves out the amount and the trailing item when not given", () => {
    render(
      <Rows>
        <Row name="Ravi Kumar" meta="7 days late" tone="overdue" />
      </Rows>,
    );
    const item = screen.getByRole("listitem");
    expect(item.querySelector("[translate]")).toBeNull();
    expect(item.children).toHaveLength(1);
  });
});

describe("Row meta tone (criterion 37)", () => {
  it.each<[RowTone, string]>([
    ["overdue", "text-cloth"],
    ["due", "text-ink-soft"],
    ["paid", "text-stamp"],
  ])("%s colours the meta line and still says it in words", (tone, colour) => {
    render(
      <Rows>
        <Row name="Ravi Kumar" meta={`status in words: ${tone}`} tone={tone} />
      </Rows>,
    );
    const meta = screen.getByText(`status in words: ${tone}`);
    expect(classes(meta)).toContain(colour);
    expect(classes(meta)).toContain("type-caption");
    expect(meta.getAttribute("data-tone")).toBe(tone);
  });

  it("cannot be written without meta text", () => {
    render(
      <Rows>
        {/* @ts-expect-error meta is required: tone never carries the meaning alone */}
        <Row name="Ravi Kumar" tone="overdue" />
      </Rows>,
    );
    expect(screen.getByText("Ravi Kumar")).toBeTruthy();
  });
});

describe("Row wrapping (criterion 38)", () => {
  it("lets name and meta wrap; the amount and the trailing item never shrink or wrap", () => {
    render(
      <Rows>
        <Row name="A very long name" meta="A very long meta line" tone="due" amount="₹1,23,456" trailing={<span>tag</span>} />
      </Rows>,
    );
    for (const text of ["A very long name", "A very long meta line"]) {
      const el = screen.getByText(text);
      expect(classes(el)).toContain("wrap-anywhere");
      expect(el.className).not.toMatch(/truncate|nowrap|overflow-hidden|line-clamp/);
    }
    expect(classes(screen.getByText("₹1,23,456"))).toEqual(expect.arrayContaining(["shrink-0", "whitespace-nowrap"]));
    expect(classes(screen.getByText("tag").parentElement!)).toContain("shrink-0");
  });
});

describe("Row as a link with an action (criterion 39)", () => {
  it("keeps the link and the action as two separate targets", () => {
    render(
      <Rows>
        <Row
          name="Ravi Kumar"
          meta="7 days late"
          tone="overdue"
          amount="₹1,200"
          href="/students/ravi"
          trailing={<button type="button">Remind</button>}
        />
      </Rows>,
    );
    const link = screen.getByRole("link");
    const action = screen.getByRole("button", { name: "Remind" });
    expect(link.getAttribute("href")).toBe("/students/ravi");
    expect(link.contains(action)).toBe(false);
    expect(link.textContent).toContain("Ravi Kumar");
    expect(link.textContent).toContain("₹1,200");
    expect(classes(link)).toEqual(expect.arrayContaining(["min-h-tap", "flex-1", "min-w-0", "ring:ground-ring"]));
  });

  it("has no link when there is no href", () => {
    render(
      <Rows>
        <Row name="Ravi Kumar" meta="7 days late" tone="overdue" />
      </Rows>,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("Row amount (criterion 40)", () => {
  it("is set in the row-amount role and is never translated", () => {
    render(
      <Rows>
        <Row name="रवि कुमार" meta="7 दिन देर" tone="overdue" amount="₹1,200" />
      </Rows>,
    );
    const amount = screen.getByText("₹1,200");
    expect(classes(amount)).toContain("type-amount-row");
    expect(amount.getAttribute("translate")).toBe("no");
  });
});
