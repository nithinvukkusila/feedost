import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field, oneLine } from "./field";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);
const lineOf = (input: Element) => input.parentElement!;

describe("Field label and line (criteria 26 and 27)", () => {
  it("ties a visible label to the input", () => {
    render(<Field label="Your UPI ID" />);
    const input = screen.getByLabelText("Your UPI ID");
    // A one-row textarea, so a long value can wrap; see the "one line of text" tests below.
    expect(input.tagName).toBe("TEXTAREA");
    expect(input.getAttribute("rows")).toBe("1");
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
    const input = screen.getByLabelText("Your UPI ID") as HTMLTextAreaElement;
    expect(input.name).toBe("upi");
    expect(input.value).toBe("meena@okhdfc");
    expect(input.getAttribute("inputmode")).toBe("email");
    expect(input.getAttribute("autocapitalize")).toBe("none");
  });

  it("can be typed in", async () => {
    const user = userEvent.setup();
    render(<Field label="Your UPI ID" />);
    const input = screen.getByLabelText("Your UPI ID") as HTMLTextAreaElement;
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

describe("Field holds one line of text that wraps (criterion 63)", () => {
  const mirrorOf = (input: Element) => input.parentElement!.querySelector("[data-field-mirror]")!;

  it("wraps a long value instead of cutting it off, with no scrolling inside the control", () => {
    render(<Field label="Your UPI ID" defaultValue="meena.tuitions@okhdfc" />);
    const input = screen.getByRole("textbox");
    expect(classes(input)).toEqual(
      expect.arrayContaining(["whitespace-pre-wrap", "wrap-anywhere", "resize-none", "overflow-hidden", "w-full"]),
    );
    expect(input.className).not.toMatch(/truncate|nowrap|text-ellipsis|overflow-x/);
  });

  it("grows by layout: an invisible copy of the value shares the control's grid cell and text box", () => {
    render(<Field label="Your UPI ID" defaultValue="meena.tuitions@okhdfc" />);
    const input = screen.getByRole("textbox");
    const mirror = mirrorOf(input);
    expect(mirror.getAttribute("aria-hidden")).toBe("true");
    expect(classes(mirror)).toContain("invisible");
    expect(mirror.textContent).toBe("meena.tuitions@okhdfc\u200B");
    for (const name of ["type-value", "col-start-1", "row-start-1", "min-h-tap", "py-2", "whitespace-pre-wrap", "wrap-anywhere"]) {
      expect(classes(mirror), name).toContain(name);
      expect(classes(input), name).toContain(name);
    }
    expect(classes(input.parentElement!)).toContain("grid");
  });

  it("keeps the copy in step while typing", async () => {
    const user = userEvent.setup();
    render(<Field label="Your UPI ID" />);
    const input = screen.getByRole("textbox");
    expect(mirrorOf(input).textContent).toBe("\u200B");
    await user.type(input, "meena.tuitions@okhdfc");
    expect(mirrorOf(input).textContent).toBe("meena.tuitions@okhdfc\u200B");
  });

  it("sizes an empty field by its placeholder, so a long placeholder is not cut off either", () => {
    render(<Field label="Your UPI ID" placeholder="name@bank" />);
    expect(mirrorOf(screen.getByRole("textbox")).textContent).toBe("name@bank\u200B");
  });

  it("keeps the tick beside the value, in its own column", () => {
    render(<Field label="Your UPI ID" defaultValue="meena.tuitions@okhdfc" state="correct" stateLabel="correct" />);
    const tick = lineOf(screen.getByRole("textbox")).querySelector("svg")!;
    expect(tick.getAttribute("class")).toMatch(/col-start-2/);
    expect(tick.getAttribute("class")).toMatch(/self-center/);
    expect(tick.getAttribute("class")).toMatch(/shrink-0/);
  });

  it("tells screen readers it is a single line of text", () => {
    render(<Field label="Your UPI ID" />);
    expect(screen.getByRole("textbox").getAttribute("aria-multiline")).toBe("false");
  });

  it("Enter never adds a line; it submits the form, as in a single-line field", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Field label="Your UPI ID" name="upi" />
      </form>,
    );
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(input, "meena@okhdfc{Enter}");
    expect(input.value).toBe("meena@okhdfc");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("Enter outside a form does nothing", async () => {
    const user = userEvent.setup();
    render(<Field label="Your UPI ID" />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(input, "a{Enter}b");
    expect(input.value).toBe("ab");
  });

  it("lets the screen handle Enter itself", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Field label="Your UPI ID" onKeyDown={(event) => event.preventDefault()} />
      </form>,
    );
    await user.type(screen.getByRole("textbox"), "a{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("turns pasted line breaks into spaces", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Field label="Name" onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.click(input);
    await user.paste("Ravi\nKumar \r\n Sharma");
    expect(input.value).toBe("Ravi Kumar Sharma");
    expect(onChange.mock.lastCall![0].target.value).toBe("Ravi Kumar Sharma");
    expect(mirrorOf(input).textContent).toBe("Ravi Kumar Sharma\u200B");
  });

  it("removes line breaks from a starting value", () => {
    render(<Field label="Name" defaultValue={"Ravi\nKumar"} />);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Ravi Kumar");
  });

  it("works as a controlled field", async () => {
    function Controlled() {
      const [value, setValue] = useState("meena");
      return <Field label="Your UPI ID" value={value} onChange={(event) => setValue(event.target.value.toLowerCase())} />;
    }
    const user = userEvent.setup();
    render(<Controlled />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(input.value).toBe("meena");
    await user.type(input, "@OK");
    expect(input.value).toBe("meena@ok");
    expect(mirrorOf(input).textContent).toBe("meena@ok\u200B");
  });

  it("submits its value with the form under its name", () => {
    render(
      <form data-testid="form">
        <Field label="Your UPI ID" name="upi" defaultValue="meena@okhdfc" />
      </form>,
    );
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.get("upi")).toBe("meena@okhdfc");
  });

  it("has no input type: the keyboard is chosen with inputMode", () => {
    // @ts-expect-error a textarea has no type; use inputMode="numeric", "email" or "tel"
    render(<Field label="Amount" type="number" inputMode="numeric" />);
    expect(screen.getByRole("textbox").getAttribute("inputmode")).toBe("numeric");
  });
});

describe("oneLine", () => {
  it("leaves a single line alone", () => {
    expect(oneLine("meena.tuitions@okhdfc")).toBe("meena.tuitions@okhdfc");
    expect(oneLine("two  spaces")).toBe("two  spaces");
    expect(oneLine("")).toBe("");
  });

  it("joins lines with one space", () => {
    expect(oneLine("a\nb")).toBe("a b");
    expect(oneLine("a \r\n\r\n b")).toBe("a b");
    expect(oneLine("a\rb\nc")).toBe("a b c");
  });
});
