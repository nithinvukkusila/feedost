import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StatusTag, type Status } from "./status-tag";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

describe("StatusTag (criteria 41 to 43)", () => {
  const cases: [Status, string, string[]][] = [
    ["overdue", "Overdue 7 days", ["border-2", "border-solid", "border-cloth", "text-cloth"]],
    ["due", "Due 12 Oct", ["bg-highlight", "text-ink"]],
    ["part-paid", "Part paid", ["border-2", "border-dashed", "border-blue", "text-blue"]],
    ["paid", "Paid", ["border-double", "border-stamp", "text-stamp"]],
  ];

  it.each(cases)("%s shows its words and its mark", (status, words, expected) => {
    render(<StatusTag status={status}>{words}</StatusTag>);
    const tag = screen.getByText(words);
    expect(tag.tagName).toBe("SPAN");
    expect(tag.hasAttribute("role")).toBe(false);
    expect(classes(tag)).toEqual(expect.arrayContaining(expected));
  });

  it("tells the four apart without colour: solid, fill, dashed, double", () => {
    const mark = (status: Status) => {
      render(<StatusTag status={status}>{status}</StatusTag>);
      const names = classes(screen.getByText(status));
      return (
        ["border-solid", "border-dashed", "border-double"].find((n) => names.includes(n)) ??
        (names.some((n) => n.startsWith("bg-")) ? "fill" : "none")
      );
    };
    const marks = (["overdue", "due", "part-paid", "paid"] as Status[]).map(mark);
    expect(marks).toEqual(["border-solid", "fill", "border-dashed", "border-double"]);
  });

  it("only the due tag is filled, and it has no outline", () => {
    render(<StatusTag status="due">Due</StatusTag>);
    expect(screen.getByText("Due").className).not.toMatch(/border/);
  });

  it("makes the double outline wide enough for two lines", () => {
    render(<StatusTag status="paid">Paid</StatusTag>);
    expect(classes(screen.getByText("Paid"))).toContain("border-6");
  });

  it("uses the label style and wraps instead of truncating", () => {
    render(<StatusTag status="overdue">Overdue 37 days, reminded twice</StatusTag>);
    const tag = screen.getByText("Overdue 37 days, reminded twice");
    expect(classes(tag)).toEqual(expect.arrayContaining(["type-label", "wrap-anywhere", "max-w-full"]));
    expect(tag.className).not.toMatch(/truncate|nowrap|overflow-hidden|uppercase|tracking/);
  });

  it("has no fifth status", () => {
    // @ts-expect-error only four statuses exist
    render(<StatusTag status="cancelled">Cancelled</StatusTag>);
    expect(screen.getByText("Cancelled").className).not.toMatch(/border-|bg-/);
  });
});
