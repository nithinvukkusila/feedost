// The month switcher's arrows (UX-review-fixes-2, item 5).
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithWords } from "@/test-utils/render-with-words";
import { MonthSwitcher } from "./month-switcher";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

function draw(canPrev: boolean, canNext: boolean) {
  const onPrev = vi.fn();
  const onNext = vi.fn();
  renderWithWords(<MonthSwitcher label="October 2026" canPrev={canPrev} canNext={canNext} onPrev={onPrev} onNext={onNext} />);
  return { onPrev, onNext };
}

describe("MonthSwitcher", () => {
  it("5.1: with no other month to go to, shows the month alone and no arrow buttons", () => {
    draw(false, false);
    expect(screen.getByText("October 2026")).toBeTruthy();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("5.2: a dead arrow is still drawn, disabled, dashed, not-allowed, no shadow, with its icon in rule", () => {
    draw(false, true);
    const prev = screen.getByRole("button", { name: "Previous month" });
    const next = screen.getByRole("button", { name: "Next month" });
    expect(prev.hasAttribute("disabled")).toBe(true);
    expect(next.hasAttribute("disabled")).toBe(false);
    const names = classes(prev);
    expect(names).toEqual(
      expect.arrayContaining(["size-tap", "disabled:cursor-not-allowed", "disabled:border-dashed", "disabled:border-ink-label", "disabled:text-rule"]),
    );
    expect(names.join(" ")).not.toMatch(/shadow-|disabled:text-ink-label/);
    // The live arrow is ink.
    expect(classes(next)).toContain("text-ink");
  });

  it("the live arrow moves; the dead one does nothing", () => {
    const { onPrev, onNext } = draw(true, false);
    screen.getByRole("button", { name: "Previous month" }).click();
    screen.getByRole("button", { name: "Next month" }).click();
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it("keeps the month row at least 44px high with or without arrows, so nothing jumps when one appears", () => {
    draw(false, false);
    expect(classes(screen.getByText("October 2026").parentElement!)).toContain("min-h-tap");
  });
});
