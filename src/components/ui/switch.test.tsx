import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

function Harness({ onChange, start = false }: { onChange?: (next: boolean) => void; start?: boolean }) {
  const [on, setOn] = useState(start);
  return (
    <Switch
      label="Automatic reminders"
      checked={on}
      onText="ON"
      offText="OFF"
      onChange={(next) => {
        setOn(next);
        onChange?.(next);
      }}
    />
  );
}

describe("Switch element and name (criterion 82)", () => {
  it("is a real button exposed as a switch with the name it was given", () => {
    render(<Harness />);
    const control = screen.getByRole("switch", { name: "Automatic reminders" });
    expect(control.tagName).toBe("BUTTON");
    expect(control.getAttribute("type")).toBe("button");
    expect(control.getAttribute("aria-label")).toBe("Automatic reminders");
  });

  it("exposes on and off through aria-checked", () => {
    render(<Harness start />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    cleanup();
    render(<Harness />);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("can be named by visible text on the screen instead", () => {
    render(
      <>
        <span id="auto-label">Automatic reminders</span>
        <Switch labelledBy="auto-label" checked onChange={() => {}} onText="ON" offText="OFF" />
      </>,
    );
    const control = screen.getByRole("switch", { name: "Automatic reminders" });
    expect(control.getAttribute("aria-labelledby")).toBe("auto-label");
    expect(control.hasAttribute("aria-label")).toBe(false);
  });

  it("cannot be drawn without a name, by type", () => {
    // @ts-expect-error either `label` or `labelledBy`
    render(<Switch checked onChange={() => {}} onText="ON" offText="OFF" />);
    expect(screen.getByRole("switch")).toBeTruthy();
  });

  it("hides the knob's word from screen readers: the state is already announced", () => {
    render(<Harness start />);
    const control = screen.getByRole("switch");
    const knob = control.firstElementChild!;
    expect(knob.getAttribute("aria-hidden")).toBe("true");
    expect(control.children).toHaveLength(1);
    // The name is the passed-in name alone, not "Automatic reminders ON".
    expect(screen.getByRole("switch", { name: "Automatic reminders" })).toBe(control);
  });

  it("passes data attributes through and nothing else", () => {
    render(<Switch label="Report" checked onChange={() => {}} onText="ON" offText="OFF" data-testid="report" data-force="focus" />);
    expect(screen.getByTestId("report").getAttribute("data-force")).toBe("focus");
    // @ts-expect-error there is no disabled state (spec open question 18)
    render(<Switch label="Report" checked onChange={() => {}} onText="ON" offText="OFF" disabled />);
  });
});

describe("Switch look (criteria 80, 81 and 83)", () => {
  it("is at least 76 by 44 in rem, with a 2px ink border and 4px corners", () => {
    render(<Harness />);
    expect(classes(screen.getByRole("switch"))).toEqual(
      expect.arrayContaining(["min-w-19", "min-h-tap", "border-2", "border-ink", "rounded-sm", "shrink-0"]),
    );
  });

  it("takes its track and the knob's side from aria-checked, not from a second prop", () => {
    render(<Harness />);
    const track = classes(screen.getByRole("switch"));
    expect(track).toEqual(expect.arrayContaining(["bg-tab-idle", "justify-start", "aria-checked:bg-stamp", "aria-checked:justify-end"]));
    // Green appears only as the on track. Nothing here is red.
    expect(screen.getByRole("switch").outerHTML).not.toMatch(/cloth/);
  });

  it("draws the knob as a slip block with a 2px ink border and a weight-800 caption word", () => {
    render(<Harness />);
    const knob = classes(screen.getByRole("switch").firstElementChild!);
    expect(knob).toEqual(expect.arrayContaining(["bg-slip", "border-2", "border-ink", "type-caption", "font-extrabold", "min-w-9"]));
  });

  it("lays out both words in the knob at once, one of them invisible, so the width never changes", () => {
    render(<Harness />);
    const [off, on] = [...screen.getByRole("switch").firstElementChild!.children];
    expect(off.textContent).toBe("OFF");
    expect(on.textContent).toBe("ON");
    for (const word of [off, on]) expect(classes(word)).toEqual(expect.arrayContaining(["col-start-1", "row-start-1"]));
    expect(classes(off)).toContain("group-aria-checked/switch:invisible");
    expect(classes(off)).not.toContain("invisible");
    expect(classes(on)).toEqual(expect.arrayContaining(["invisible", "group-aria-checked/switch:visible"]));
  });

  it("keeps a strip of track beside the knob on whichever side is empty", () => {
    render(<Harness />);
    const knob = classes(screen.getByRole("switch").firstElementChild!);
    expect(knob).toEqual(expect.arrayContaining(["mr-7.5", "group-aria-checked/switch:mr-0", "group-aria-checked/switch:ml-7.5"]));
  });

  it("never truncates or shrinks the word", () => {
    render(<Switch label="Reminders" checked={false} onChange={() => {}} onText="ಚಾಲನೆಯಲ್ಲಿದೆ" offText="ನಿಲ್ಲಿಸಿದೆ" />);
    const control = screen.getByRole("switch");
    expect(control.outerHTML).not.toMatch(/truncate|text-ellipsis|line-clamp|overflow-hidden|text-xs/);
    expect(control.textContent).toBe("ನಿಲ್ಲಿಸಿದೆಚಾಲನೆಯಲ್ಲಿದೆ");
  });

  it("has no transition and no animation: the knob jumps", () => {
    render(<Harness />);
    expect(screen.getByRole("switch").outerHTML).not.toMatch(/transition|duration-|animate|ease-/);
  });

  it("shows the focus ring of criterion 21", () => {
    render(<Harness />);
    expect(classes(screen.getByRole("switch"))).toContain("ring:ground-ring");
  });
});

describe("Switch interaction (criterion 82)", () => {
  it("reports the opposite value on tap", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("reports the opposite value on Space and on Enter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("switch"));
    await user.keyboard(" ");
    expect(onChange).toHaveBeenLastCalledWith(true);
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("is controlled: it does not change by itself", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch label="Reminders" checked={false} onChange={onChange} onText="ON" offText="OFF" />);
    await user.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("does not submit a form it sits in", async () => {
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Harness />
      </form>,
    );
    await user.click(screen.getByRole("switch"));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
