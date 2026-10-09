import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Segmented, type SegmentedOption } from "./segmented";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

type Tone = "polite" | "firm";
const two = [
  { value: "polite", label: "Polite" },
  { value: "firm", label: "Firm" },
] as const satisfies readonly SegmentedOption<Tone>[];

const three = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "pick", label: "Pick date" },
] as const;

const four = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "kn", label: "Kannada" },
  { value: "te", label: "Telugu" },
] as const;

function Harness({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState<(typeof four)[number]["value"]>("en");
  return (
    <Segmented
      label="Language"
      name="lang"
      options={four}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    />
  );
}

describe("Segmented structure (criteria 70 and 73)", () => {
  it("is a group named by its visible label", () => {
    render(<Segmented label="Tone" name="tone" options={two} defaultValue="polite" />);
    const group = screen.getByRole("group", { name: "Tone" });
    expect(group.tagName).toBe("FIELDSET");
    const legend = group.querySelector("legend");
    expect(legend?.textContent).toBe("Tone");
    expect(classes(legend!)).toEqual(expect.arrayContaining(["type-label", "text-ink-label", "wrap-anywhere"]));
  });

  it.each([
    ["two", two, "polite"],
    ["three", three, "today"],
    ["four", four, "en"],
  ] as const)("renders one radio per option for %s options, exactly one of them chosen", (_name, options, start) => {
    render(<Segmented label="Group" name="g" options={options} defaultValue={start} />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(options.length);
    expect(radios.filter((r) => r.checked).map((r) => r.value)).toEqual([start]);
    expect(radios.map((r) => r.value)).toEqual(options.map((o) => o.value));
  });

  it("gives every radio the same name, so only one can be chosen", () => {
    render(<Segmented label="Language" name="lang" options={four} defaultValue="en" />);
    expect(new Set(screen.getAllByRole("radio").map((r) => r.getAttribute("name")))).toEqual(new Set(["lang"]));
  });

  it("names each radio by its segment's words, and exposes the chosen one as checked", () => {
    render(<Segmented label="Tone" name="tone" options={two} defaultValue="firm" />);
    expect((screen.getByRole("radio", { name: "Firm" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole("radio", { checked: true }).getAttribute("value")).toBe("firm");
    expect((screen.getByRole("radio", { name: "Polite" }) as HTMLInputElement).checked).toBe(false);
  });

  it("allows only two to four options, by type", () => {
    // @ts-expect-error one option is not a choice
    render(<Segmented label="One" name="one" options={[two[0]]} defaultValue="polite" />);
    cleanup();
    const five = [...four, { value: "ta", label: "Tamil" }] as const;
    // @ts-expect-error five do not fit
    render(<Segmented label="Five" name="five" options={five} defaultValue="en" />);
  });

  it("cannot be drawn with nothing chosen, by type", () => {
    // @ts-expect-error either `value` with `onChange`, or `defaultValue`
    render(<Segmented label="Tone" name="tone" options={two} />);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });
});

describe("Segmented look (criteria 70, 71, 72 and 74)", () => {
  it("is one 2px ink border with 4px corners, and a 2px ink line on each segment", () => {
    render(<Segmented label="Language" name="lang" options={four} defaultValue="en" />);
    const frame = screen.getByRole("group").querySelector("legend")!.nextElementSibling!;
    expect(classes(frame)).toEqual(expect.arrayContaining(["border-2", "border-ink", "rounded-sm", "overflow-hidden"]));
    for (const radio of screen.getAllByRole("radio")) {
      expect(classes(radio.parentElement!)).toEqual(expect.arrayContaining(["border-t-2", "border-l-2", "border-ink", "min-h-control"]));
    }
    // The grid is pulled up and left by the same 2px, so the outer lines sit under the group's border.
    expect(classes(frame.firstElementChild!)).toEqual(expect.arrayContaining(["grid", "-mt-0.5", "-ml-0.5", "auto-rows-fr"]));
  });

  it("marks the chosen segment with an ink fill and slip text, from :checked and not from a prop", () => {
    render(<Segmented label="Tone" name="tone" options={two} defaultValue="polite" />);
    for (const radio of screen.getAllByRole("radio")) {
      const segment = classes(radio.parentElement!);
      expect(segment).toEqual(expect.arrayContaining(["has-[:checked]:bg-ink", "has-[:checked]:text-slip", "text-ink"]));
      // No fill of its own when it is not the chosen one.
      expect(segment.filter((name) => name.startsWith("bg-"))).toEqual([]);
    }
  });

  it("draws the focus ring inside the segment, and yellow on the chosen (black) one", () => {
    render(<Segmented label="Tone" name="tone" options={two} defaultValue="polite" />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(classes(radio)).toEqual(expect.arrayContaining(["ring:ring-inset", "absolute", "inset-0", "appearance-none"]));
      expect(classes(radio)).not.toContain("ring:ground-ring");
      expect(classes(radio.parentElement!)).toContain("has-[:checked]:on-dark-ground");
    }
  });

  it("keeps the radio in the keyboard order: it is not hidden with display none or the hidden attribute", () => {
    render(<Segmented label="Tone" name="tone" options={two} defaultValue="polite" />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.hasAttribute("hidden")).toBe(false);
      expect(radio.getAttribute("tabindex")).toBeNull();
      expect(classes(radio)).not.toContain("hidden");
      expect(classes(radio)).not.toContain("sr-only");
    }
  });

  it("lays out two and three options in one row, and four in two rows of two until the group is 28rem wide", () => {
    const grid = () => classes(screen.getByRole("group").querySelector("legend")!.nextElementSibling!.firstElementChild!);
    render(<Segmented label="Two" name="g" options={two} defaultValue="polite" />);
    expect(grid()).toContain("grid-cols-2");
    expect(grid()).not.toContain("@md:grid-cols-4");
    cleanup();
    render(<Segmented label="Three" name="g" options={three} defaultValue="today" />);
    expect(grid()).toContain("grid-cols-3");
    cleanup();
    render(<Segmented label="Four" name="g" options={four} defaultValue="en" />);
    expect(grid()).toEqual(expect.arrayContaining(["grid-cols-2", "@md:grid-cols-4"]));
    expect(classes(screen.getByRole("group").querySelector("legend")!.nextElementSibling!)).toContain("@container");
  });

  it("shows a second, smaller line when an option has one, and never truncates either line", () => {
    render(
      <Segmented
        label="Tone"
        name="tone"
        defaultValue="polite"
        options={[
          { value: "polite", label: "Polite", detail: "A gentle first nudge" },
          { value: "firm", label: "Firm", detail: "When it is well overdue" },
        ]}
      />,
    );
    const detail = screen.getByText("A gentle first nudge");
    expect(classes(detail)).toEqual(expect.arrayContaining(["type-caption", "wrap-anywhere"]));
    expect(classes(screen.getByText("Polite"))).toEqual(expect.arrayContaining(["type-control-sm", "wrap-anywhere"]));
    // The second line is part of the radio's name.
    expect(screen.getByRole("radio", { name: "Polite A gentle first nudge" })).toBeTruthy();
    expect(screen.getByRole("group").outerHTML).not.toMatch(/truncate|nowrap|line-clamp|text-ellipsis/);
  });

  it("passes data attributes to an option's radio and nothing else", () => {
    render(
      <Segmented
        label="Tone"
        name="tone"
        defaultValue="polite"
        options={[
          { value: "polite", label: "Polite", attrs: { "data-force": "focus" } },
          { value: "firm", label: "Firm" },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: "Polite" }).getAttribute("data-force")).toBe("focus");
    expect(screen.getByRole("radio", { name: "Firm" }).hasAttribute("data-force")).toBe(false);
  });
});

describe("Segmented interaction (criterion 73)", () => {
  it("reports the choice on tap", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Kannada" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("kn");
    expect((screen.getByRole("radio", { name: "Kannada" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
  });

  it("reports the choice when the segment's words are tapped, not only the radio", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.click(screen.getByText("Telugu"));
    expect(onChange).toHaveBeenCalledWith("te");
  });

  it("is one stop in the keyboard order and moves with the arrow keys, reporting each move", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onChange={onChange} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "English" }));
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("hi");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "Hindi" }));
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("kn");
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("hi");
    expect(screen.getAllByRole("radio", { checked: true })).toHaveLength(1);
    await user.tab();
    expect(document.activeElement).toBe(document.body);
  });

  it("when controlled, shows the value it is given and does not change by itself", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Segmented label="Tone" name="tone" options={two} value="polite" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Firm" }));
    expect(onChange).toHaveBeenCalledWith("firm");
    expect((screen.getByRole("radio", { name: "Polite" }) as HTMLInputElement).checked).toBe(true);
  });

  it("when uncontrolled, changes by itself and still reports if asked to", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Segmented label="Tone" name="tone" options={two} defaultValue="polite" onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "Firm" }));
    expect(onChange).toHaveBeenCalledWith("firm");
    expect((screen.getByRole("radio", { name: "Firm" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Polite" }) as HTMLInputElement).checked).toBe(false);
  });

  it("submits the chosen value with its form", () => {
    render(
      <form data-testid="form">
        <Segmented label="Tone" name="tone" options={two} defaultValue="firm" />
      </form>,
    );
    expect(new FormData(screen.getByTestId("form") as HTMLFormElement).get("tone")).toBe("firm");
  });
});
