import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BottomNav, type BottomNavItem, type BottomNavKey } from "./bottom-nav";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

const icon = (name: string) => <svg data-testid={`icon-${name}`} />;

const items: Record<BottomNavKey, BottomNavItem> = {
  home: { href: "/app", label: "Home", icon: icon("home") },
  students: { href: "/app/students", label: "Students", icon: icon("students") },
  attendance: { href: "/app/attendance", label: "Attendance", icon: icon("attendance") },
  more: { href: "/app/more", label: "More", icon: icon("more") },
};

describe("BottomNav structure (criteria 84 and 86)", () => {
  it("is a navigation landmark with the name it was given", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.tagName).toBe("NAV");
  });

  it("has four links in the fixed order, each with its own target", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["Home", "Students", "Attendance", "More"]);
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/app", "/app/students", "/app/attendance", "/app/more"]);
    for (const link of links) expect(link.tagName).toBe("A");
  });

  it("keeps that order whatever order the screen writes the items in", () => {
    const shuffled = { more: items.more, attendance: items.attendance, home: items.home, students: items.students };
    render(<BottomNav label="Main" items={shuffled} current="home" />);
    expect(screen.getAllByRole("link").map((a) => a.textContent)).toEqual(["Home", "Students", "Attendance", "More"]);
  });

  it("needs all four items and one of the four as current, by type", () => {
    const { more: _more, ...three } = items;
    void _more;
    // @ts-expect-error all four are required
    expect(() => render(<BottomNav label="Main" items={three} current="home" />)).toThrow();
    cleanup();
    // @ts-expect-error there is no fifth destination
    render(<BottomNav label="Main" items={items} current="reports" />);
    expect(screen.getAllByRole("link").filter((a) => a.hasAttribute("aria-current"))).toHaveLength(0);
  });

  it("puts the icon above the label and hides it from screen readers", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    for (const [key, link] of (["home", "students", "attendance", "more"] as const).map((k, i) => [k, screen.getAllByRole("link")[i]] as const)) {
      const [iconWrap, labelWrap] = [...link.children];
      expect(link.children).toHaveLength(2);
      expect(iconWrap.getAttribute("aria-hidden")).toBe("true");
      expect(iconWrap.contains(within(link).getByTestId(`icon-${key}`))).toBe(true);
      expect(labelWrap.hasAttribute("aria-hidden")).toBe(false);
      expect(classes(link)).toContain("flex-col");
    }
    // The name of a link is its label alone.
    expect(screen.getByRole("link", { name: "Attendance" })).toBeTruthy();
  });

  it("passes data attributes to an item's link and nothing else", () => {
    const forced = { ...items, students: { ...items.students, attrs: { "data-force": "focus" } } };
    render(<BottomNav label="Main" items={forced} current="home" />);
    expect(screen.getByRole("link", { name: "Students" }).getAttribute("data-force")).toBe("focus");
    expect(screen.getByRole("link", { name: "Home" }).hasAttribute("data-force")).toBe(false);
  });
});

describe("BottomNav current item (criterion 85)", () => {
  it.each(["home", "students", "attendance", "more"] as const)("marks only %s as the current page", (current) => {
    render(<BottomNav label="Main" items={items} current={current} />);
    const marked = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute("data-item")).toBe(current);
    expect(screen.getAllByRole("link").filter((a) => a.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("takes the red bar and ink text from aria-current, and gives every item the same 5px bar slot", () => {
    render(<BottomNav label="Main" items={items} current="students" />);
    for (const link of screen.getAllByRole("link")) {
      expect(classes(link)).toEqual(
        expect.arrayContaining(["border-t-5", "border-transparent", "text-ink-label", "aria-[current=page]:border-cloth", "aria-[current=page]:text-ink"]),
      );
    }
  });

  it("uses red only for the bar: no red fill and no red text", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    const html = screen.getByRole("navigation").outerHTML;
    expect(html).not.toMatch(/bg-cloth|text-cloth/);
  });
});

describe("BottomNav look (criteria 84, 86 and 87)", () => {
  it("is a slip bar with a 2px ink top border in four equal columns, at least 64px tall", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    expect(classes(screen.getByRole("navigation"))).toEqual(
      expect.arrayContaining(["bg-slip", "border-t-2", "border-ink", "grid", "grid-cols-4", "items-stretch", "pb-safe"]),
    );
    for (const link of screen.getAllByRole("link")) expect(classes(link)).toEqual(expect.arrayContaining(["min-h-row", "min-w-0"]));
  });

  it("sets the label in the caption role at weight 700 and lets it wrap", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    const link = screen.getByRole("link", { name: "Attendance" });
    expect(classes(link)).toEqual(expect.arrayContaining(["type-caption", "font-bold"]));
    expect(classes(link.children[1])).toContain("wrap-anywhere");
    expect(screen.getByRole("navigation").outerHTML).not.toMatch(/truncate|nowrap|line-clamp|text-ellipsis|overflow-hidden/);
  });

  it("draws the focus ring inside the item, on paper", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    for (const link of screen.getAllByRole("link")) {
      expect(classes(link)).toContain("ring:ring-inset");
      expect(classes(link)).not.toContain("ring:ground-ring");
    }
    expect(classes(screen.getByRole("navigation"))).toContain("on-paper-ground");
  });

  it("does not position itself and does not move", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    expect(screen.getByRole("navigation").outerHTML).not.toMatch(/\b(fixed|sticky|absolute)\b|transition|animate|duration-/);
  });
});

describe("BottomNav from 1024 (spec D1, criterion 7)", () => {
  it("is still one nav with four links; the side-by-side look is classes only", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });

  it("stands in one column at lg, with the bar on the left edge, and keeps the phone classes", () => {
    render(<BottomNav label="Main" items={items} current="home" />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(classes(nav)).toEqual(expect.arrayContaining(["grid-cols-4", "lg:grid-cols-1", "lg:border-t-0"]));
    for (const link of screen.getAllByRole("link")) {
      expect(classes(link)).toEqual(expect.arrayContaining(["flex-col", "border-t-5", "lg:flex-row", "lg:border-l-5", "lg:justify-start"]));
    }
  });
});

