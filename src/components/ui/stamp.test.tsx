import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Stamp, type StampSize } from "./stamp";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

describe("Stamp (criteria 44 to 48)", () => {
  it.each<[StampSize, string]>([
    ["sm", "w-13"],
    ["md", "w-33"],
    ["lg", "w-58"],
  ])("%s is a tilted double-ring circle of its size", (size, width) => {
    render(
      <Stamp size={size} tone="stamp" label="Stamped paid">
        PAID
      </Stamp>,
    );
    const stamp = screen.getByRole("img", { name: "Stamped paid" });
    expect(stamp.getAttribute("data-size")).toBe(size);
    // The words tilt; the ring itself does not, so it never widens the page.
    expect(classes(stamp)).not.toContain("-rotate-12");
    expect(classes(stamp.firstElementChild!)).toContain("-rotate-12");
    expect(classes(stamp)).toEqual(
      expect.arrayContaining([width, "min-w-min", "aspect-square", "rounded-full", "border-double"]),
    );
  });

  it("is green for paid and blue for sent", () => {
    render(
      <>
        <Stamp size="md" tone="stamp" label="paid">
          PAID
        </Stamp>
        <Stamp size="md" tone="blue" label="sent">
          SENT
        </Stamp>
      </>,
    );
    expect(classes(screen.getByRole("img", { name: "paid" }))).toEqual(
      expect.arrayContaining(["border-stamp", "text-stamp"]),
    );
    expect(classes(screen.getByRole("img", { name: "sent" }))).toEqual(
      expect.arrayContaining(["border-blue", "text-blue"]),
    );
  });

  it("shows the word it was given, in the stamp role", () => {
    render(
      <Stamp size="lg" tone="stamp" label="Stamped all paid">
        ALL PAID
      </Stamp>,
    );
    expect(classes(screen.getByText("ALL PAID"))).toContain("type-stamp");
  });

  it("shows a second line on md and lg, in the label role", () => {
    render(
      <>
        <Stamp size="md" tone="stamp" label="one" secondLine="08 Oct 2026">
          PAID
        </Stamp>
        <Stamp size="lg" tone="blue" label="two" secondLine="1 of 5">
          SENT
        </Stamp>
      </>,
    );
    expect(classes(screen.getByText("08 Oct 2026"))).toContain("type-label");
    expect(screen.getByText("1 of 5")).toBeTruthy();
  });

  it("has no second line on sm", () => {
    render(
      // @ts-expect-error the small stamp takes no second line
      <Stamp size="sm" tone="stamp" label="paid" secondLine="08 Oct 2026">
        PAID
      </Stamp>,
    );
    expect(screen.queryByText("08 Oct 2026")).toBeNull();
  });

  it("is an image with a label that says what it means", () => {
    render(
      <Stamp size="md" tone="stamp" label="Stamped paid on 08 Oct 2026">
        PAID
      </Stamp>,
    );
    const stamp = screen.getByRole("img", { name: "Stamped paid on 08 Oct 2026" });
    expect(stamp.hasAttribute("aria-hidden")).toBe(false);
  });

  it("is hidden from screen readers when decorative", () => {
    render(
      <Stamp size="sm" tone="stamp" decorative>
        PAID
      </Stamp>,
    );
    expect(screen.queryByRole("img")).toBeNull();
    const stamp = screen.getByText("PAID").closest("[data-size]")!;
    expect(stamp.getAttribute("aria-hidden")).toBe("true");
    expect(stamp.hasAttribute("aria-label")).toBe(false);
  });

  it("must be either labelled or decorative", () => {
    render(
      // @ts-expect-error neither label nor decorative
      <Stamp size="sm" tone="stamp">
        PAID
      </Stamp>,
    );
    expect(screen.getByText("PAID")).toBeTruthy();
  });

  it("does not animate unless asked", () => {
    render(
      <>
        <Stamp size="md" tone="stamp" label="still">
          PAID
        </Stamp>
        <Stamp size="md" tone="stamp" label="lands" animate>
          PAID
        </Stamp>
      </>,
    );
    const still = screen.getByRole("img", { name: "still" });
    const lands = screen.getByRole("img", { name: "lands" });
    expect(still.outerHTML).not.toMatch(/stamp-land|stamp-settle/);
    expect(classes(lands)).toContain("stamp-land");
    expect(classes(lands.firstElementChild!)).toContain("stamp-settle");
  });

  it("sets no font family, letter-spacing or capitals itself: the type role does, per script", () => {
    render(
      <Stamp size="md" tone="stamp" label="paid" secondLine="08 Oct 2026">
        PAID
      </Stamp>,
    );
    const stamp = screen.getByRole("img");
    expect(stamp.outerHTML).not.toMatch(/uppercase|tracking-|font-(sans|mono)/);
  });
});
