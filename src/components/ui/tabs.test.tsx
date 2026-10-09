import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tabId, Tabs, type TabItem } from "./tabs";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

const tabs: TabItem[] = [
  { id: "overdue", label: "Overdue", count: 5 },
  { id: "due", label: "Due", count: 4 },
  { id: "paid", label: "Paid" },
];

function Harness({ onChange, start = "overdue" }: { onChange?: (id: string) => void; start?: string }) {
  const [value, setValue] = useState(start);
  return (
    <Tabs
      tabs={tabs}
      value={value}
      label="Fee status"
      panelId="panel"
      onChange={(id) => {
        setValue(id);
        onChange?.(id);
      }}
    />
  );
}

describe("Tabs structure (criteria 49 and 50)", () => {
  it("is a named tab list of real buttons", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Fee status" })).toBeTruthy();
    const all = screen.getAllByRole("tab");
    expect(all).toHaveLength(3);
    for (const tab of all) {
      expect(tab.tagName).toBe("BUTTON");
      expect(tab.getAttribute("type")).toBe("button");
      expect(tab.getAttribute("aria-controls")).toBe("panel");
    }
  });

  it("shows each label and its optional count", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: "Overdue 5" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Due 4" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Paid" })).toBeTruthy();
  });

  it("exposes the selected tab to screen readers", () => {
    render(<Harness start="due" />);
    expect(screen.getByRole("tab", { name: "Due 4" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Overdue 5" }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByRole("tab", { selected: true }).id).toBe(tabId("panel", "due"));
  });

  it("marks the selected tab by height and fill, not colour alone", () => {
    render(<Harness />);
    const on = classes(screen.getByRole("tab", { selected: true }));
    const off = classes(screen.getByRole("tab", { name: "Paid" }));
    expect(on).toEqual(expect.arrayContaining(["min-h-control", "bg-slip", "text-ink"]));
    expect(on).not.toContain("mt-1");
    expect(off).toEqual(expect.arrayContaining(["min-h-tap", "mt-1", "bg-tab-idle", "text-ink-soft"]));
  });

  it("has a 2px ink border on three sides and 6px top corners", () => {
    render(<Harness />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(classes(tab)).toEqual(expect.arrayContaining(["border-2", "border-b-0", "border-ink", "rounded-t-tab"]));
    }
  });

  it("never puts ink-label text on an unselected tab (it fails contrast on tab-idle)", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist").innerHTML).not.toMatch(/text-ink-label/);
  });

  it("wraps long labels in equal columns instead of truncating or scrolling", () => {
    render(<Harness />);
    expect(classes(screen.getByRole("tablist"))).toEqual(
      expect.arrayContaining(["grid", "auto-cols-fr", "grid-flow-col", "items-stretch"]),
    );
    expect(screen.getByRole("tablist").outerHTML).not.toMatch(/truncate|nowrap|overflow-x|overflow-hidden/);
    expect(classes(screen.getByText("Overdue"))).toContain("wrap-anywhere");
  });
});

describe("Tabs interaction (criterion 51)", () => {
  it("reports the chosen tab on tap", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("tab", { name: "Paid" }));
    expect(onChange).toHaveBeenCalledWith("paid");
    expect(screen.getByRole("tab", { name: "Paid" }).getAttribute("aria-selected")).toBe("true");
  });

  it("is controlled: it does not change by itself", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Tabs tabs={tabs} value="overdue" onChange={onChange} label="Fee status" panelId="panel" />);
    await user.click(screen.getByRole("tab", { name: "Paid" }));
    expect(onChange).toHaveBeenCalledWith("paid");
    expect(screen.getByRole("tab", { name: "Overdue 5" }).getAttribute("aria-selected")).toBe("true");
  });

  it("puts only the selected tab in the tab order", () => {
    render(<Harness start="due" />);
    expect(screen.getAllByRole("tab").map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
  });

  it("moves and selects with the arrow keys, wrapping at the ends", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Overdue 5" }));
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("due");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Due 4" }));
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("overdue");
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("paid");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Paid" }));
  });

  it("jumps to the first and last tab with Home and End", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} start="due" />);
    await user.tab();
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("paid");
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("overdue");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Overdue 5" }));
  });

  it("ignores other keys", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.tab();
    await user.keyboard("a{ArrowDown}");
    expect(onChange).not.toHaveBeenCalled();
  });
});
