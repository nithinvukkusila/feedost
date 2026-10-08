import { describe, expect, it } from "vitest";
import { cx } from "./cx";

describe("cx", () => {
  it("joins class names with a space", () => {
    expect(cx("a", "b c", "d")).toBe("a b c d");
  });

  it("skips false, null, undefined and empty strings", () => {
    const off = false as boolean;
    expect(cx("a", off && "b", null, undefined, "", "c")).toBe("a c");
  });

  it("returns an empty string when nothing is left", () => {
    expect(cx(false, null, undefined)).toBe("");
    expect(cx()).toBe("");
  });
});
