import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { findOwnWords } from "@/test-utils/find-own-words";
import { SelectField } from "./select-field";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

const months = [
  { value: "0", label: "January" },
  { value: "8", label: "September" },
  { value: "9", label: "October" },
] as const;

function Harness({ onChange, start = "9", disabled = false }: { onChange?: (value: string) => void; start?: string; disabled?: boolean }) {
  const [value, setValue] = useState(start);
  return (
    <SelectField
      label="Month"
      value={value}
      options={months}
      disabled={disabled}
      data-testid="month"
      data-ph-no-capture=""
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

const shown = (container: HTMLElement) => container.querySelector("[data-select-shown]") as HTMLElement;

describe("SelectField", () => {
  it("is a real select tied to a real label, with every option", () => {
    render(<Harness />);
    const select = screen.getByLabelText("Month") as HTMLSelectElement;
    expect(select.tagName).toBe("SELECT");
    expect(screen.getByRole("combobox", { name: "Month" })).toBe(select);
    expect(Array.from(select.options).map((option) => [option.value, option.text])).toEqual(months.map((m) => [m.value, m.label]));
    expect(select.value).toBe("9");
  });

  it("shows the chosen option's name in a copy that screen readers skip, beside a hidden chevron", () => {
    const { container } = render(<Harness />);
    expect(shown(container).textContent).toBe("October");
    expect(shown(container).getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("lets the copy wrap and the line grow: no fixed height, no truncation", () => {
    const { container } = render(<Harness start="8" />);
    expect(classes(shown(container))).toContain("wrap-anywhere");
    expect(classes(shown(container))).toContain("type-value");
    const line = shown(container).parentElement as HTMLElement;
    expect(classes(line)).toContain("min-h-control");
    expect(line.className).not.toMatch(/(^|\s)h-\w|truncate|line-clamp|overflow-hidden|whitespace-nowrap/);
  });

  it("lays the select over the whole line, transparent, so it takes the tap", () => {
    render(<Harness />);
    const select = screen.getByLabelText("Month");
    for (const name of ["absolute", "inset-0", "size-full", "appearance-none", "opacity-0", "cursor-pointer"]) {
      expect(classes(select), name).toContain(name);
    }
    expect(classes(select.parentElement as HTMLElement)).toContain("relative");
  });

  it("calls onChange with the value and shows the new name", async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText("Month"), "8");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("8");
    expect(shown(container).textContent).toBe("September");
  });

  it("can be changed from the keyboard", async () => {
    const { container } = render(<Harness start="0" />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Month"));
    await userEvent.selectOptions(screen.getByLabelText("Month"), "October");
    expect(shown(container).textContent).toBe("October");
  });

  it("passes data attributes to the select and to nothing else", () => {
    const { container } = render(<Harness />);
    const select = screen.getByTestId("month");
    expect(select.tagName).toBe("SELECT");
    expect(select.hasAttribute("data-ph-no-capture")).toBe(true);
    expect(container.querySelectorAll("[data-ph-no-capture]")).toHaveLength(1);
  });

  it("shows keyboard focus through the field's typing look, also when forced for the dev page", () => {
    const { container } = render(<SelectField label="Month" value="9" options={months} onChange={() => {}} data-force="focus" />);
    expect(screen.getByLabelText("Month").getAttribute("data-force")).toBe("focus");
    const root = container.firstElementChild as HTMLElement;
    expect(classes(root)).toContain("group/field");
    expect(root.querySelector("label")!.className).toContain("group-typing/field:text-blue");
    expect((shown(container).parentElement as HTMLElement).className).toContain("group-typing/field:field-line-4");
  });

  it("when disabled, cannot be changed and says so with a dashed line, not colour alone", async () => {
    const onChange = vi.fn();
    const { container } = render(<Harness disabled onChange={onChange} />);
    const select = screen.getByLabelText("Month") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    await userEvent.selectOptions(select, "8").catch(() => {});
    expect(onChange).not.toHaveBeenCalled();
    expect(classes(shown(container).parentElement as HTMLElement)).toContain("border-dashed");
    expect(classes(select)).toContain("cursor-not-allowed");
  });

  it("ties a helper line to the select", () => {
    render(<SelectField label="Month" value="9" options={months} onChange={() => {}} helper="The month the fee is for" />);
    const select = screen.getByLabelText("Month");
    const note = document.getElementById(select.getAttribute("aria-describedby") ?? "");
    expect(note?.textContent).toBe("The month the fee is for");
  });

  it("uses the given id", () => {
    render(<SelectField id="month" label="Month" value="9" options={months} onChange={() => {}} />);
    expect(screen.getByLabelText("Month").id).toBe("month");
  });

  it("has no words of its own", () => {
    const source = readFileSync(join(process.cwd(), "src", "components", "ui", "select-field.tsx"), "utf8");
    expect(findOwnWords(source, "select-field.tsx")).toEqual([]);
  });
});

describe("SelectField focus ring (UX-review-fixes-2, 12.5)", () => {
  it("draws the 3px blue ring around its line when the select is focused by keyboard, and keeps its chevron", () => {
    render(<Harness />);
    const line = (screen.getByLabelText("Month") as HTMLElement).parentElement!;
    expect(classes(line)).toEqual(expect.arrayContaining(["ring-within:ground-ring", "group-typing/field:border-blue"]));
    expect(line.querySelector("svg")).not.toBeNull();
  });

  it("declares the ring-within variant on keyboard focus and on the forced example", () => {
    const css = readFileSync(join(process.cwd(), "src", "styles", "states.css"), "utf8");
    expect(css).toContain('@custom-variant ring-within (&:has(:focus-visible), &:has([data-force~="focus"]));');
  });
});
