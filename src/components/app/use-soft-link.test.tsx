// The soft link keeps the link a link: only an ordinary tap goes through the router.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { useSoftLink } from "./use-soft-link";

function Probe() {
  const soft = useSoftLink();
  return (
    // A plain anchor is the point of this test: the hook's handler rides on one.
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/en/more/" onClick={soft("/en/more/")}>
      go
    </a>
  );
}

afterEach(cleanup);
beforeEach(() => push.mockReset());

describe("useSoftLink", () => {
  it("takes an ordinary tap through the router", () => {
    render(<Probe />);
    const notPrevented = fireEvent.click(screen.getByRole("link"));
    expect(push).toHaveBeenCalledWith("/en/more/");
    expect(notPrevented).toBe(false);
  });

  it.each([["metaKey"], ["ctrlKey"], ["shiftKey"], ["altKey"]])("leaves a %s click to the browser (a new tab)", (key) => {
    render(<Probe />);
    const notPrevented = fireEvent.click(screen.getByRole("link"), { [key]: true });
    expect(push).not.toHaveBeenCalled();
    expect(notPrevented).toBe(true);
  });

  it("leaves a middle click to the browser", () => {
    render(<Probe />);
    fireEvent.click(screen.getByRole("link"), { button: 1 });
    expect(push).not.toHaveBeenCalled();
  });
});
