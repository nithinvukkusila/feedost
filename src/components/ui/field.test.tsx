import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act, createRef, useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Field, oneLine, submitOnEnter } from "./field";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);
const lineOf = (input: Element) => input.parentElement!;

describe("Field single-line variant", () => {
  it("draws a real input of the given type with the same line and label", () => {
    render(<Field label="Phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765" />);
    const input = screen.getByLabelText("Phone");
    expect(input.tagName).toBe("INPUT");
    expect(input.getAttribute("type")).toBe("tel");
    expect(input.getAttribute("inputmode")).toBe("tel");
    expect(input.getAttribute("autocomplete")).toBe("tel");
    expect(classes(lineOf(input))).toEqual(expect.arrayContaining(["field-line-2", "border-ink", "min-h-control"]));
  });

  it("is controlled and reports changes", async () => {
    const seen: string[] = [];
    function Host() {
      const [v, setV] = useState("");
      return <Field label="Phone" type="tel" value={v} onChange={(e) => { seen.push(e.currentTarget.value); setV(e.currentTarget.value); }} />;
    }
    render(<Host />);
    await userEvent.type(screen.getByLabelText("Phone"), "98");
    expect(seen).toEqual(["9", "98"]);
    expect((screen.getByLabelText("Phone") as HTMLInputElement).value).toBe("98");
  });

  it("shows the error words and mark", () => {
    render(<Field label="Phone" type="tel" state="error" stateLabel="Fix this" message="Ten digits" />);
    expect(screen.getByLabelText(/Phone/).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Ten digits")).toBeTruthy();
  });
});

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

describe("Field monoValue: a number read digit by digit (R1-10, the UPI reference)", () => {
  it("draws the control and its copy in the mono value role only, and wins over latinValue", () => {
    render(<Field label="Reference" defaultValue="6281 0473 9915" monoValue latinValue />);
    const input = screen.getByRole("textbox");
    for (const el of [input, input.parentElement!.querySelector("[data-field-mirror]")!]) {
      expect(classes(el)).toContain("type-value-mono");
      expect(classes(el)).not.toContain("type-value");
      expect(classes(el)).not.toContain("type-value-latin");
    }
    expect(input.hasAttribute("monoValue")).toBe(false);
  });

  it("keeps its states on a single-line input: needs fixing shows the words and the mark", () => {
    render(<Field label="Reference" type="text" inputMode="numeric" monoValue state="error" stateLabel="Check this" message="Check the 12 digits and try again." />);
    const input = screen.getByRole("textbox");
    expect(input.tagName).toBe("INPUT");
    expect(classes(input)).toContain("type-value-mono");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Check the 12 digits and try again.")).toBeTruthy();
    expect(screen.getByText("Check this")).toBeTruthy();
  });
});

describe("Field latinValue: a value that is always Latin letters and digits (R0-2 fix)", () => {
  const mirrorOf = (input: Element) => input.parentElement!.querySelector("[data-field-mirror]")!;

  it("is off unless asked for: the value follows the page's script, so a name in Devanagari is drawn in Anek", () => {
    render(<Field label="Parent's name" defaultValue="सुरेश" />);
    const input = screen.getByRole("textbox");
    for (const el of [input, mirrorOf(input)]) {
      expect(classes(el)).toContain("type-value");
      expect(classes(el)).not.toContain("type-value-latin");
    }
  });

  it("when on, the control and its copy use the Latin value role in place of the script one", () => {
    render(<Field label="Amount" placeholder="1,200" defaultValue="1200" latinValue />);
    const input = screen.getByRole("textbox");
    for (const el of [input, mirrorOf(input)]) {
      expect(classes(el)).toContain("type-value-latin");
      // Never both: two roles on one element would leave the face to the order of the stylesheet.
      expect(classes(el)).not.toContain("type-value");
    }
    // The placeholder is drawn by the control, so it takes the same face; it only loses its weight.
    expect(classes(input)).toContain("placeholder:font-normal");
    expect(input.className).not.toMatch(/placeholder:type-|font-sans|font-mono|tracking-/);
  });

  it("changes nothing else: the same text box, so the field grows and wraps as before", () => {
    const { container } = render(
      <>
        <Field label="A" defaultValue="meena.tuitions@okhdfc" />
        <Field label="B" defaultValue="meena.tuitions@okhdfc" latinValue />
      </>,
    );
    const [plain, latin] = [...container.querySelectorAll("textarea")];
    const without = (el: Element) => classes(el).filter((name) => name !== "type-value" && name !== "type-value-latin");
    expect(without(latin)).toEqual(without(plain));
    expect(without(mirrorOf(latin))).toEqual(without(mirrorOf(plain)));
    expect(latin.hasAttribute("latinvalue")).toBe(false);
    expect(latin.hasAttribute("latinValue")).toBe(false);
  });

  it("leaves the label, the helper and the message in the page's own face", () => {
    render(
      <>
        <Field label="Amount" helper="Whole rupees." latinValue />
        <Field label="UPI ID" state="error" stateLabel="needs fixing" message="Add the part after @." latinValue />
      </>,
    );
    expect(classes(screen.getByText("Amount"))).toContain("type-label");
    expect(classes(screen.getByText("Whole rupees."))).toContain("type-caption");
    expect(classes(screen.getByText("Add the part after @."))).toContain("type-caption");
    for (const el of [screen.getByText("Amount"), screen.getByText("Whole rupees."), screen.getByText("Add the part after @."), screen.getByText("needs fixing")]) {
      expect(el.className).not.toContain("type-value-latin");
    }
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

describe("Field keeps its copy in step with the control (review M2)", () => {
  const mirrorOf = (input: Element) => input.parentElement!.querySelector("[data-field-mirror]")!;
  const tick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 5)));

  it("follows a defaultValue that arrives after the first render", () => {
    const { rerender } = render(<Field label="Your UPI ID" />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(mirrorOf(input).textContent).toBe("\u200B");
    rerender(<Field label="Your UPI ID" defaultValue="a.very.long.upi.id.that.arrived.late@okhdfcbank" />);
    expect(input.value).toBe("a.very.long.upi.id.that.arrived.late@okhdfcbank");
    expect(mirrorOf(input).textContent).toBe("a.very.long.upi.id.that.arrived.late@okhdfcbank\u200B");
  });

  it("follows a form reset, back to the starting value", async () => {
    const user = userEvent.setup();
    render(
      <form data-testid="form">
        <Field label="Your UPI ID" defaultValue="meena@okhdfc" />
        <button type="reset">Reset</button>
      </form>,
    );
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(input, ".and.a.great.deal.more.typed.after.it");
    expect(mirrorOf(input).textContent).toContain("great.deal");
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await tick();
    expect(input.value).toBe("meena@okhdfc");
    expect(mirrorOf(input).textContent).toBe("meena@okhdfc\u200B");
  });

  it("follows form.reset() called from script", async () => {
    render(
      <form data-testid="form">
        <Field label="Your UPI ID" />
      </form>,
    );
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    await userEvent.setup().type(input, "a.long.value.typed.in");
    (screen.getByTestId("form") as HTMLFormElement).reset();
    await tick();
    expect(input.value).toBe("");
    expect(mirrorOf(input).textContent).toBe("\u200B");
  });

  it("follows a value assigned by script, which fires no event", () => {
    render(<Field label="Your UPI ID" />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    act(() => {
      input.value = "set.by.script.and.much.longer.than.one.line@okhdfcbank";
    });
    expect(input.value).toBe("set.by.script.and.much.longer.than.one.line@okhdfcbank");
    expect(mirrorOf(input).textContent).toBe("set.by.script.and.much.longer.than.one.line@okhdfcbank\u200B");
  });

  it("still reports typing after a value was assigned by script", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Field label="Your UPI ID" onChange={onChange} />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    act(() => {
      input.value = "abc";
    });
    await user.type(input, "d");
    expect(input.value).toBe("abcd");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(mirrorOf(input).textContent).toBe("abcd\u200B");
  });

  it("looks again when focus arrives, for changes nothing announced", async () => {
    const user = userEvent.setup();
    render(<Field label="Your UPI ID" defaultValue="abcdef" />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    // setRangeText changes the value with no event and without going through the value setter.
    act(() => input.setRangeText("XYZ", 0, 3));
    await user.click(input);
    expect(mirrorOf(input).textContent).toBe(`${input.value}\u200B`);
  });

  it("puts the element back as it found it when the field goes away", () => {
    const { unmount } = render(<Field label="Your UPI ID" />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    unmount();
    expect(() => {
      input.value = "after";
    }).not.toThrow();
    expect(input.value).toBe("after");
  });
});

describe("Field mirror is kept out of translation and recording tools (review S4)", () => {
  it("marks the copy of the value as not to be translated, captured or shown in a replay", () => {
    render(<Field label="Parent's phone" defaultValue="+91 98450 12345" />);
    const mirror = screen.getByRole("textbox").parentElement!.querySelector("[data-field-mirror]")!;
    expect(mirror.textContent).toContain("98450");
    expect(mirror.getAttribute("translate")).toBe("no");
    expect(mirror.hasAttribute("data-ph-no-capture")).toBe(true);
    expect(mirror.hasAttribute("data-sentry-mask")).toBe(true);
    expect(mirror.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Field: Enter presses the form's default button (review S1)", () => {
  const setup = (buttons: React.ReactNode, onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())) => {
    render(
      <form onSubmit={onSubmit}>
        <Field label="Your UPI ID" name="upi" />
        {buttons}
      </form>,
    );
    return onSubmit;
  };
  const pressEnter = async () => {
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox"), "meena@okhdfc{Enter}");
  };

  it("submits through the submit button, so the form knows which button it was", async () => {
    const onSubmit = setup(
      <>
        <button type="button">Other</button>
        <button type="submit" name="action" value="save">
          Save
        </button>
      </>,
    );
    await pressEnter();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitter = (onSubmit.mock.calls[0][0].nativeEvent as SubmitEvent).submitter;
    expect(submitter?.textContent).toBe("Save");
  });

  it("does nothing when the submit button is disabled", async () => {
    const onSubmit = setup(
      <button type="submit" disabled>
        Save
      </button>,
    );
    await pressEnter();
    expect(onSubmit).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("meena@okhdfc");
  });

  it("does nothing when the submit button is aria-disabled", async () => {
    const onSubmit = setup(
      <button type="submit" aria-disabled="true">
        Save
      </button>,
    );
    await pressEnter();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does nothing when our own disabled Button is the submit button", async () => {
    const onSubmit = setup(
      <Button variant="record" type="submit" disabled>
        Save
      </Button>,
    );
    await pressEnter();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cannot submit past a busy Button, which is no longer a submit button while it works", async () => {
    const onSubmit = setup(
      <Button variant="record" type="submit" busy busyLabel="Saving…">
        Save
      </Button>,
    );
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
    await pressEnter();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("uses the first submit button when there are several", async () => {
    const onSubmit = setup(
      <>
        <button type="submit" disabled>
          First
        </button>
        <button type="submit">Second</button>
      </>,
    );
    await pressEnter();
    // The default button is the first one; it is disabled, so Enter does nothing, as in a native field.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("ignores reset buttons and submits a form that has no submit button at all", async () => {
    const onSubmit = setup(<button type="reset">Clear</button>);
    await pressEnter();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("accepts an input of type submit as the default button", () => {
    const form = document.createElement("form");
    form.innerHTML = '<input type="submit" disabled value="Save">';
    document.body.append(form);
    const requestSubmit = vi.spyOn(form, "requestSubmit").mockImplementation(() => {});
    submitOnEnter(form);
    expect(requestSubmit).not.toHaveBeenCalled();
    form.remove();
  });

  it("leaves Enter to an IME that is composing, including Safari's keyCode 229", () => {
    const onSubmit = setup(<button type="submit">Save</button>);
    const input = screen.getByRole("textbox");
    const composing = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true });
    input.dispatchEvent(composing);
    expect(composing.defaultPrevented).toBe(false);
    const safari = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, keyCode: 229 });
    input.dispatchEvent(safari);
    expect(safari.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Field small things", () => {
  it("keeps the caret after pasted text when line breaks are removed from the middle of a value", async () => {
    const user = userEvent.setup();
    render(<Field label="Name" defaultValue="abcdef" />);
    const input = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.click(input);
    input.setSelectionRange(3, 3);
    await user.paste("X\nY");
    expect(input.value).toBe("abcX Ydef");
    expect([input.selectionStart, input.selectionEnd]).toEqual([6, 6]);
    await user.keyboard("!");
    expect(input.value).toBe("abcX Y!def");
  });

  it("tells the phone keyboard that Enter finishes, and lets a screen say otherwise", () => {
    render(
      <>
        <Field label="A" />
        <Field label="B" enterKeyHint="next" />
      </>,
    );
    expect(screen.getByLabelText("A").getAttribute("enterkeyhint")).toBe("done");
    expect(screen.getByLabelText("B").getAttribute("enterkeyhint")).toBe("next");
  });

  it("hands the control to a ref, as an object or a function", () => {
    const object = createRef<HTMLTextAreaElement>();
    const fn = vi.fn();
    render(
      <>
        <Field label="A" ref={object} />
        <Field label="B" ref={fn} />
      </>,
    );
    expect(object.current).toBe(screen.getByLabelText("A"));
    expect(fn).toHaveBeenCalledWith(screen.getByLabelText("B"));
  });

  it("passes data attributes to the control", () => {
    render(<Field label="A" data-autofocus="" />);
    expect(screen.getByLabelText("A").hasAttribute("data-autofocus")).toBe(true);
  });
});

describe("Field review notes N3 and N4", () => {
  it("calls a stable ref once, not again on every render", async () => {
    const calls: (HTMLTextAreaElement | null)[] = [];
    function Screen() {
      const [count, setCount] = useState(0);
      const ref = useCallback((el: HTMLTextAreaElement | null) => {
        calls.push(el);
      }, []);
      return (
        <>
          <Field label="A" ref={ref} helper={String(count)} />
          <button type="button" onClick={() => setCount((n) => n + 1)}>
            Again
          </button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Screen />);
    await user.click(screen.getByRole("button", { name: "Again" }));
    await user.click(screen.getByRole("button", { name: "Again" }));
    expect(screen.getByText("2")).toBeTruthy();
    expect(calls).toEqual([screen.getByLabelText("A")]);
  });

  it("follows the ref when the screen passes a different one", () => {
    const first = createRef<HTMLTextAreaElement>();
    const second = createRef<HTMLTextAreaElement>();
    const { rerender } = render(<Field label="A" ref={first} />);
    expect(first.current).toBe(screen.getByLabelText("A"));
    rerender(<Field label="A" ref={second} />);
    expect(second.current).toBe(screen.getByLabelText("A"));
    expect(first.current).toBeNull();
  });

  it("Enter does nothing when the submit button is disabled by its fieldset", async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <Field label="Your UPI ID" />
        <fieldset disabled>
          <button type="submit">Save</button>
        </fieldset>
      </form>,
    );
    const button = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    // The property says false; only the selector knows.
    expect(button.disabled).toBe(false);
    expect(button.matches(":disabled")).toBe(true);
    await user.type(screen.getByRole("textbox"), "meena@okhdfc{Enter}");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("Field default render is pinned (UX-review-fixes-2, 13.10: eleven call sites, the claim sheet among them)", () => {
  // Recorded before `prefix` and the error-over-focus change, against the old Field. Without `prefix`, the idle and
  // correct fields must render byte for byte as before. Only the error state may change (criterion 24.1).
  it("renders the idle, helper, correct, tel and mono fields exactly as before", () => {
    const { container } = render(
      <div>
        <Field id="a" label="Your UPI ID" placeholder="name@bank" />
        <Field id="b" label="Your UPI ID" defaultValue="asha@okaxis" helper="Parents pay you directly." latinValue />
        <Field id="c" label="Your UPI ID" defaultValue="asha@okaxis" state="correct" stateLabel="looks right" message="Saved." />
        <Field id="d" label="Phone" type="tel" defaultValue="98765" />
        <Field id="e" label="Reference" defaultValue="123456789012" monoValue aria-describedby="x" />
      </div>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});

describe("Field needs fixing wins over focus (UX-review-fixes-2, 24.1 and 24.2)", () => {
  const renderError = () =>
    render(<Field label="Your UPI ID" state="error" stateLabel="needs fixing" message="Add the part after @." />);

  it("draws no blue line, blue label or blue value in needs fixing, focused or not", () => {
    renderError();
    const input = screen.getByRole("textbox");
    const label = screen.getByText("Your UPI ID", { exact: false, selector: "label" });
    for (const el of [lineOf(input), input, label]) {
      expect(el.className).not.toMatch(/border-blue|text-blue/);
    }
  });

  it("keeps the red line and grows it to 4px while focused", () => {
    renderError();
    const line = classes(lineOf(screen.getByRole("textbox")));
    expect(line).toEqual(expect.arrayContaining(["field-line-3", "border-cloth", "group-typing/field:field-line-4"]));
  });

  it("keeps the red label and its state words", () => {
    renderError();
    const label = screen.getByText("Your UPI ID", { exact: false, selector: "label" });
    expect(classes(label)).toContain("text-cloth");
    expect(label.textContent).toContain("needs fixing");
  });

  it("still turns blue while typing when the field is not in needs fixing", () => {
    render(<Field label="Your UPI ID" />);
    expect(classes(lineOf(screen.getByRole("textbox")))).toContain("group-typing/field:border-blue");
  });
});

describe("Field prefix (UX-review-fixes-2, 12.1)", () => {
  it("draws the prefix before the value, outside the control, in the mono face, kept from translation", () => {
    render(<Field label="Phone" prefix="+91" defaultValue="98765 43210" />);
    const input = screen.getByLabelText("Phone") as HTMLTextAreaElement;
    expect(input.value).toBe("98765 43210");
    const prefix = screen.getByText("+91");
    expect(input.contains(prefix)).toBe(false);
    expect(prefix.parentElement).toBe(lineOf(input));
    expect(classes(prefix)).toEqual(expect.arrayContaining(["type-value-prefix", "col-start-1"]));
    expect(prefix.getAttribute("translate")).toBe("no");
    expect(classes(lineOf(input))).toContain("grid-cols-[auto_minmax(0,1fr)_auto]");
    expect(classes(input)).toContain("col-start-2");
    expect(classes(input.parentElement!.querySelector("[data-field-mirror]")!)).toContain("col-start-2");
  });

  it("is read with the field: its id leads the description, before the caller's and the note", () => {
    render(<Field id="p" label="Phone" prefix="+91" helper="Ten digits" aria-describedby="extra" />);
    expect(screen.getByLabelText("Phone").getAttribute("aria-describedby")).toBe("p-prefix extra p-note");
  });

  it("moves the tick and the error mark to the third column", () => {
    render(<Field label="Phone" prefix="+91" state="error" stateLabel="check" message="Ten digits" />);
    const mark = lineOf(screen.getByRole("textbox")).querySelector("svg")!;
    expect(mark.getAttribute("class")).toContain("col-start-3");
  });

  it("is not part of the value when typing", async () => {
    render(<Field label="Phone" prefix="+91" />);
    const input = screen.getByLabelText("Phone") as HTMLTextAreaElement;
    await userEvent.type(input, "98");
    await userEvent.type(input, "{Backspace}{Backspace}{Backspace}");
    expect(input.value).toBe("");
    expect(screen.getByText("+91")).toBeTruthy();
  });
});
