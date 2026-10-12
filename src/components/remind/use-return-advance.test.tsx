// Spec R1-8, criterion 18: the return signal. Hidden then visible advances once; visible alone does nothing.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReturnAdvance } from "./use-return-advance";

afterEach(() => {
  cleanup();
  setVisibility("visible");
});

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
}
function change(state: "hidden" | "visible") {
  act(() => {
    setVisibility(state);
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("useReturnAdvance", () => {
  it("advances once when the page was hidden after the tap and is visible again, however many times it becomes visible", () => {
    const advance = vi.fn();
    const { result } = renderHook(() => useReturnAdvance(0, advance));
    act(() => result.current());
    change("hidden");
    expect(advance).not.toHaveBeenCalled();
    change("visible");
    change("visible");
    change("hidden");
    change("visible");
    expect(advance).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledWith(0);
  });

  it("does nothing when the page becomes visible without having been hidden after the tap", () => {
    const advance = vi.fn();
    const { result } = renderHook(() => useReturnAdvance(0, advance));
    act(() => result.current());
    change("visible");
    change("visible");
    expect(advance).not.toHaveBeenCalled();
  });

  it("does nothing for a hide and show with no tap first", () => {
    const advance = vi.fn();
    renderHook(() => useReturnAdvance(0, advance));
    change("hidden");
    change("visible");
    expect(advance).not.toHaveBeenCalled();
  });

  it("starts afresh on the next step, and a second tap on one step does not undo what was seen", () => {
    const advance = vi.fn();
    const { result, rerender } = renderHook(({ step }) => useReturnAdvance(step, advance), { initialProps: { step: 0 } });
    act(() => result.current());
    change("hidden");
    act(() => result.current());
    change("visible");
    expect(advance).toHaveBeenCalledTimes(1);
    rerender({ step: 1 });
    // The new step has not been opened: a hide and show does not advance it.
    change("hidden");
    change("visible");
    expect(advance).toHaveBeenCalledTimes(1);
    act(() => result.current());
    change("hidden");
    change("visible");
    expect(advance).toHaveBeenCalledTimes(2);
    expect(advance).toHaveBeenLastCalledWith(1);
  });

  it("stops listening when it is unmounted", () => {
    const advance = vi.fn();
    const { result, unmount } = renderHook(() => useReturnAdvance(0, advance));
    act(() => result.current());
    change("hidden");
    unmount();
    change("visible");
    expect(advance).not.toHaveBeenCalled();
  });
});
