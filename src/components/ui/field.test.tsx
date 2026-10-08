import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { Field } from "./field";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);
const lineOf = (input: Element) => input.parentElement!;

describe("Field label and line (criteria 26 and 27)", () => {
  it("ties a visible label to the input", () => {
    render(<Field label="Your UPI ID" />);
    const input = screen.getByLabelText("Your UPI ID");
    expect(input.tagName).toBe("INPUT");
    const label = screen.getByText("Your UPI ID");
    expect(label.tagName).toBe("LABEL");
    expect(label.getAttribute("for")).toBe(input.id);
    expect(input.id).not.toBe("");
  });

  it("uses the id it was given", () => {
    render(<Field label="Your UPI ID" id="upi" />);
    expect(screen.getByLabelText("Your UPI ID").id).toBe("upi");
  });

  it("writes on a 2px ink line with no box, at least 48px tall", () => {
    render(<Field label="Your UPI ID" placeholder="name@bank" />);
    const input = screen.getByPlaceholderText("name@bank");
    expect(classes(lineOf(input))).toEqual(expect.arrayContaining(["field-line-2", "border-ink", "min-h-control"]));
    expect(lineOf(input).className).not.toMatch(/rounded|shadow|bg-slip|border-2/);
    expect(classes(input)).toEqual(expect.arrayContaining(["min-h-tap", "bg-transparent", "placeholder:text-ink-label"]));
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("passes native input attributes through", () => {
    render(<Field label="Your UPI ID" name="upi" defaultValue="meena@okhdfc" inputMode="email" autoCapitalize="none" />);
    const input = screen.getByLabelText("Your UPI ID") as HTMLInputElement;
    expect(input.name).toBe("upi");
    expect(input.value).toBe("meena@okhdfc");
    expect(input.getAttribute("inputmode")).toBe("email");
  });

  it("can be typed in", async () => {
    const user = userEvent.setup();
    render(<Field label="Your UPI ID" />);
    const input = screen.getByLabelText("Your UPI ID") as HTMLInputElement;
    await user.type(input, "meena.tui");
    expect(input.value).toBe("meena.tui");
  });
});

describe("Field typing (criterion 28)", () => {
  it("turns the line 4px blue and the label and value blue while typing", () => {
    render(<Field label="Your UPI ID" />);
    const input = screen.getByLabelText("Your UPI ID");
    expect(classes(lineOf(input))).toEqual(
      expect.arrayContaining(["group-typing/field:field-line-4", "group-typing/field:border-blue"]),
    );
    expect(classes(input)).toContain("group-typing/field:text-blue");
    expect(classes(screen.getByText("Your UPI ID"))).toContain("group-typing/field:text-blue");
    expect(classes(input.closest("[data-state]")!)).toContain("group/field");
  });
});

describe("Field correct (criterion 29)", () => {
  it("has a green line, a tick hidden from screen readers, and the state in words", () => {
    render(
      <Field label="Your UPI ID" state="correct" stateLabel="correct" message="That looks like a valid UPI ID." />,
    );
    const input = screen.getByRole("textbox");
    expect(classes(lineOf(input))).toEqual(expect.arrayContaining(["field-line-2", "border-stamp"]));
    const tick = lineOf(input).querySelector("svg")!;
    expect(tick.getAttribute("aria-hidden")).toBe("true");
    // The words are real text for a screen reader, not only a tick.
    const words = screen.getByText("correct", { exact: false, selector: "span" });
    expect(classes(words)).toContain("sr-only");
    expect(screen.getByLabelText(/Your UPI ID\s+correct/)).toBe(input);
    expect(input.hasAttribute("aria-invalid")).toBe(false);
  });

  it("ties the message to the input", () => {
    render(
      <Field label="Your UPI ID" state="correct" stateLabel="correct" message="That looks like a valid UPI ID." />,
    );
    const message = screen.getByText("That looks like a valid UPI ID.");
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(message.id);
    expect(classes(message)).toContain("text-stamp");
  });

  it("the message is optional", () => {
    render(<Field label="Your UPI ID" state="correct" stateLabel="correct" />);
    expect(screen.getByRole("textbox").hasAttribute("aria-describedby")).toBe(false);
  });
});

describe("Field needs fixing (criterion 30)", () => {
  const renderError = () =>
    render(
      <Field
        label="Your UPI ID"
        state="error"
        stateLabel="needs fixing"
        message="This is missing the part after @."
        helper="Parents pay you directly."
      />,
    );

  it("has a 3px red line and an error mark hidden from screen readers", () => {
    renderError();
    const input = screen.getByRole("textbox");
    expect(classes(lineOf(input))).toEqual(expect.arrayContaining(["field-line-3", "border-cloth"]));
    expect(lineOf(input).querySelector("svg")!.getAttribute("aria-hidden")).toBe("true");
  });

  it("shows the words for needs fixing in the red label", () => {
    renderError();
    const label = screen.getByText("Your UPI ID", { exact: false, selector: "label" });
    expect(classes(label)).toContain("text-cloth");
    const words = screen.getByText("needs fixing");
    expect(label.contains(words)).toBe(true);
    expect(classes(words)).not.toContain("sr-only");
  });

  it("marks the input invalid and ties it to the message that says how to fix it", () => {
    renderError();
    const input = screen.getByRole("textbox");
    const message = screen.getByText("This is missing the part after @.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(message.id);
    expect(classes(message)).toContain("text-cloth");
  });

  it("shows the message in place of the helper", () => {
    renderError();
    expect(screen.queryByText("Parents pay you directly.")).toBeNull();
  });

  it("requires the state words", () => {
    // @ts-expect-error a state other than idle needs stateLabel
    render(<Field label="Your UPI ID" state="error" />);
    expect(screen.getByRole("textbox").getAttribute("aria-invalid")).toBe("true");
  });
});

describe("Field height and helper (criteria 31 and 32)", () => {
  it("keeps a line for the message in every state", () => {
    const { container } = render(
      <>
        <Field label="A" />
        <Field label="B" state="correct" stateLabel="correct" />
        <Field label="C" state="error" stateLabel="needs fixing" message="Fix it like this." />
      </>,
    );
    const notes = container.querySelectorAll("p");
    expect(notes).toHaveLength(3);
    for (const note of notes) expect(classes(note)).toContain("reserve-line");
  });

  it("uses one line slot whose three line weights all add up to the same height", () => {
    // 2 + 2, 3 + 1 and 4 + 0: see field-line-* in src/styles/states.css.
    render(<Field label="A" />);
    expect(classes(lineOf(screen.getByRole("textbox")))).toContain("field-line-2");
  });

  it("shows helper text beneath and ties it to the input", () => {
    render(<Field label="Your UPI ID" helper="Parents pay you directly to this ID." />);
    const helper = screen.getByText("Parents pay you directly to this ID.");
    expect(classes(helper)).toEqual(expect.arrayContaining(["type-caption", "wrap-anywhere", "text-ink-soft"]));
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")).toBe(helper.id);
  });

  it("keeps a description the caller already gave", () => {
    render(<Field label="Your UPI ID" helper="Help" aria-describedby="other" />);
    expect(screen.getByRole("textbox").getAttribute("aria-describedby")?.split(" ")[0]).toBe("other");
  });

  it("lets a long label wrap", () => {
    render(<Field label="A very long translated label for a field" />);
    const label = screen.getByText("A very long translated label for a field");
    expect(classes(label)).toContain("wrap-anywhere");
    expect(label.className).not.toMatch(/truncate|nowrap/);
  });
});
