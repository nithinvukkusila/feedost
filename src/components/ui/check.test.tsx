import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Check } from "./check";

afterEach(cleanup);

function Harness({ onChange, start = false }: { onChange?: (next: boolean) => void; start?: boolean }) {
  const [on, setOn] = useState(start);
  return (
    <Check
      checked={on}
      onText="Selected"
      offText="Not selected"
      onChange={(next) => {
        setOn(next);
        onChange?.(next);
      }}
    >
      Ravi Kumar
    </Check>
  );
}

describe("Check", () => {
  it("is a real checkbox named by the row's words, inside its label", () => {
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: /Ravi Kumar/ });
    expect(box.tagName).toBe("INPUT");
    expect(box.getAttribute("type")).toBe("checkbox");
    expect(box.closest("label")).not.toBeNull();
  });

  it("toggles on a click on the words and reports the new value", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.click(screen.getByText("Ravi Kumar"));
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByText("Ravi Kumar"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("toggles with Space from the keyboard", async () => {
    render(<Harness />);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("checkbox"));
    await userEvent.keyboard(" ");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  });

  it("says the state in a word as well as a mark", () => {
    const { container } = render(<Harness />);
    expect(container.textContent).toContain("Not selected");
    cleanup();
    const ticked = render(<Harness start />);
    expect(ticked.container.textContent).toContain("Selected");
    expect(ticked.container.textContent).not.toContain("Not selected");
    expect(ticked.container.querySelector("svg")).not.toBeNull();
  });

  it("is 44px at least and grows, with no fixed height and no truncation", () => {
    const { container } = render(<Harness />);
    const label = container.querySelector("label") as HTMLElement;
    expect(label.className).toContain("min-h-tap");
    expect(label.className).not.toMatch(/\bh-\d/);
    expect(container.innerHTML).not.toMatch(/truncate|line-clamp|text-ellipsis/);
  });
});
