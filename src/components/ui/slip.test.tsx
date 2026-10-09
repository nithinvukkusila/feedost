import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Slip } from "./slip";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

describe("Slip (criteria 33 and 34)", () => {
  it("is a slip-coloured surface with a 2px ink border, square corners and the hard shadow", () => {
    render(<Slip>Content</Slip>);
    const slip = screen.getByText("Content");
    expect(slip.tagName).toBe("DIV");
    expect(classes(slip)).toEqual(expect.arrayContaining(["bg-slip", "border-2", "border-ink", "shadow-slip"]));
    expect(slip.className).not.toMatch(/rounded/);
  });

  it("drops the shadow when joined under tabs", () => {
    render(<Slip joined>Content</Slip>);
    expect(screen.getByText("Content").className).not.toMatch(/shadow/);
  });

  it("is paper: focus rings and button shadows inside reset to the paper colours", () => {
    render(<Slip>Content</Slip>);
    expect(classes(screen.getByText("Content"))).toContain("on-paper-ground");
  });

  it("can be a section or an article", () => {
    render(
      <>
        <Slip as="section" aria-label="Fee">
          One
        </Slip>
        <Slip as="article">Two</Slip>
      </>,
    );
    expect(screen.getByText("One").tagName).toBe("SECTION");
    expect(screen.getByRole("region", { name: "Fee" })).toBeTruthy();
    expect(screen.getByText("Two").tagName).toBe("ARTICLE");
  });

  it("passes through what a tab panel needs", () => {
    render(
      <Slip joined id="panel" role="tabpanel" aria-labelledby="tab-1" tabIndex={0}>
        Rows
      </Slip>,
    );
    const panel = screen.getByRole("tabpanel");
    expect(panel.id).toBe("panel");
    expect(panel.getAttribute("aria-labelledby")).toBe("tab-1");
    expect(panel.getAttribute("tabindex")).toBe("0");
  });

  it("adds layout classes without losing its own", () => {
    render(<Slip className="p-4">Content</Slip>);
    expect(classes(screen.getByText("Content"))).toEqual(expect.arrayContaining(["p-4", "bg-slip", "shadow-slip"]));
  });
});
