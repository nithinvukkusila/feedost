import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Button, FlatButton, RoundButton, type ButtonVariant, type FlatLook } from "./button";

afterEach(cleanup);

const classes = (el: Element) => el.className.split(/\s+/);

describe("Button variants (criterion 17)", () => {
  const cases: [ButtonVariant, string[]][] = [
    ["send", ["bg-blue", "text-slip", "shadow-button", "border-ink"]],
    ["record", ["bg-ink", "text-slip", "shadow-record", "border-ink"]],
    ["outline", ["bg-slip", "text-ink", "shadow-button", "border-ink"]],
  ];

  it.each(cases)("%s has its fill, text and shadow", (variant, expected) => {
    render(<Button variant={variant}>Remind</Button>);
    const button = screen.getByRole("button", { name: "Remind" });
    for (const name of expected) expect(classes(button)).toContain(name);
    expect(classes(button)).toEqual(expect.arrayContaining(["border-2", "rounded-sm", "ground-shadow"]));
  });

  it.each(cases)("%s uses no red anywhere", (variant) => {
    render(<Button variant={variant}>Remind</Button>);
    expect(screen.getByRole("button").className).not.toMatch(/cloth/);
  });

  it("has no other variant", () => {
    // @ts-expect-error there is no red or danger variant
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole("button").className).not.toMatch(/bg-(cloth|blue|ink|slip)\b/);
  });
});

describe("Button element and content (criteria 18 and 19)", () => {
  it("is a real button that does not submit a form unless asked", () => {
    render(<Button variant="record">Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("can be a submit button", () => {
    render(
      <Button variant="record" type="submit">
        Save
      </Button>,
    );
    expect(screen.getByRole("button").getAttribute("type")).toBe("submit");
  });

  it("renders as a link with the same look when given an href", () => {
    render(
      <Button variant="send" href="/remind">
        Remind
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Remind" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/remind");
    expect(classes(link)).toEqual(expect.arrayContaining(["bg-blue", "shadow-button", "min-h-control"]));
  });

  it("puts one icon before the label and one after, both hidden from screen readers", () => {
    render(
      <Button variant="send" iconStart={<svg data-testid="start" />} iconEnd={<svg data-testid="end" />}>
        Remind
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Remind" });
    const parts = [...button.children];
    expect(parts).toHaveLength(3);
    expect(parts[0].contains(screen.getByTestId("start"))).toBe(true);
    expect(parts[0].getAttribute("aria-hidden")).toBe("true");
    expect(parts[1].textContent).toBe("Remind");
    expect(parts[2].contains(screen.getByTestId("end"))).toBe(true);
    expect(parts[2].getAttribute("aria-hidden")).toBe("true");
  });

  it("wraps a long label and grows instead of truncating", () => {
    render(<Button variant="send">A very long translated label</Button>);
    const names = classes(screen.getByRole("button"));
    expect(names).toEqual(expect.arrayContaining(["min-h-control", "whitespace-normal", "wrap-anywhere"]));
    expect(names.filter((n) => /^(truncate|text-ellipsis|overflow-hidden|line-clamp|h-|max-h-)/.test(n))).toEqual([]);
  });

  it("a card button breaks its label only between words and grows in height", () => {
    render(
      <Button variant="outline" size="card">
        Not received
      </Button>,
    );
    const button = screen.getByRole("button");
    const names = classes(button);
    expect(names).toEqual(expect.arrayContaining(["min-h-13", "whitespace-normal", "wrap-break-word"]));
    expect(names).not.toContain("wrap-anywhere");
    // The label may not shrink below its longest word.
    expect(classes(button.querySelector("span")!)).not.toContain("min-w-0");
    expect(names.filter((n) => /^(truncate|text-ellipsis|overflow-hidden|line-clamp|h-|max-h-)/.test(n))).toEqual([]);
  });

  it("passes native attributes through", () => {
    render(
      <Button variant="outline" data-force="pressed" name="share">
        Share
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button.getAttribute("data-force")).toBe("pressed");
    expect(button.getAttribute("name")).toBe("share");
  });

  it("can fill its container", () => {
    render(
      <Button variant="send" full>
        Remind
      </Button>,
    );
    expect(classes(screen.getByRole("button"))).toContain("w-full");
  });

  it("is 48px high, or 56px when large (one height class, never both)", () => {
    render(
      <>
        <Button variant="send">Normal</Button>
        <Button variant="send" size="large">
          Large
        </Button>
      </>,
    );
    expect(classes(screen.getByRole("button", { name: "Normal" }))).toContain("min-h-control");
    const large = classes(screen.getByRole("button", { name: "Large" }));
    expect(large).toContain("min-h-14");
    expect(large).not.toContain("min-h-control");
  });

  it("is 44px high with smaller type when compact, for a button inside a list row", () => {
    render(
      <Button variant="record" size="compact">
        Mark paid
      </Button>,
    );
    const compact = classes(screen.getByRole("button", { name: "Mark paid" }));
    expect(compact).toContain("min-h-tap");
    expect(compact).toContain("type-control-sm");
    expect(compact).not.toContain("min-h-control");
    expect(compact).not.toContain("type-control");
    expect(compact).toContain("shadow-record");
  });

  it("is 60px high when xl, for the one primary action at the foot of an app screen", () => {
    render(
      <Button variant="record" size="xl">
        Continue
      </Button>,
    );
    const xl = classes(screen.getByRole("button", { name: "Continue" }));
    expect(xl).toContain("min-h-15");
    expect(xl).not.toContain("min-h-control");
    expect(xl).not.toContain("min-h-14");
  });

  it("is 62px high when sheet, for Send on the parent's claim sheet (R1-10), and keeps its busy form", () => {
    const { rerender } = render(
      <Button variant="send" size="sheet" full busyLabel="Sending…">
        Send to Meena
      </Button>,
    );
    const sheet = classes(screen.getByRole("button", { name: "Send to Meena" }));
    expect(sheet).toContain("min-h-15.5");
    expect(sheet).toContain("bg-blue");
    expect(sheet).not.toContain("min-h-15");
    rerender(
      <Button variant="send" size="sheet" full busy busyLabel="Sending…">
        Send to Meena
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Sending…" }).getAttribute("aria-busy")).toBe("true");
  });

  it("is 72px high when pay, as a link, for the parent's Pay button (R1-9)", () => {
    render(
      <Button variant="send" size="pay" href="upi://pay?pa=a@b" full>
        Pay
      </Button>,
    );
    const pay = classes(screen.getByRole("link", { name: "Pay" }));
    expect(pay).toContain("min-h-18");
    expect(pay).toContain("bg-blue");
    expect(pay).not.toContain("min-h-control");
  });
});

describe("Button busy (criterion 22)", () => {
  it("shows the busy label, sets aria-busy and stays in the pressed look", () => {
    render(
      <Button variant="send" busy busyLabel="Opening WhatsApp…" iconStart={<svg data-testid="icon" />}>
        Remind
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Opening WhatsApp…" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByText("Remind")).toBeNull();
    // Pressed styling is driven by aria-busy (the `pressed` variant in states.css).
    expect(classes(button)).toContain("pressed:press-button");
    // No spinner, and no icon while working.
    expect(screen.queryByTestId("icon")).toBeNull();
    expect(button.querySelector("svg")).toBeNull();
  });

  it("ignores taps while busy but keeps focus", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button variant="send" busy busyLabel="Saving…" onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);
    await user.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("fires once per tap when not busy", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button variant="send" busy={false} busyLabel="Saving…" onClick={onClick}>
        Save
      </Button>,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("cannot submit a form while busy", () => {
    render(
      <Button variant="record" type="submit" busy busyLabel="Saving…">
        Save
      </Button>,
    );
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });

  it("a busy link cannot be followed or fired, and stays focusable", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button variant="send" href="/remind" busy busyLabel="Opening WhatsApp…" onClick={onClick}>
        Remind
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Opening WhatsApp…" });
    expect(link.hasAttribute("href")).toBe(false);
    expect(link.getAttribute("aria-busy")).toBe("true");
    expect(link.getAttribute("tabindex")).toBe("0");
    await user.click(link);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("requires a busy label whenever busy can be true", () => {
    // @ts-expect-error busy without busyLabel
    render(<Button variant="send" busy>Remind</Button>);
    expect(screen.getByRole("button")).toBeTruthy();
  });
});

describe("Button disabled (criterion 23)", () => {
  it("is dashed, has no fill or shadow, and does not respond", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button variant="send" disabled onClick={onClick}>
        Remind
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Remind" });
    expect(button.hasAttribute("disabled")).toBe(true);
    const names = classes(button);
    expect(names).toEqual(
      expect.arrayContaining(["border-dashed", "border-ink-label", "bg-transparent", "text-ink-label"]),
    );
    expect(names.join(" ")).not.toMatch(/shadow-|bg-blue|press-/);
    await user.click(button);
    await user.tab();
    expect(document.activeElement).not.toBe(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  // UX-review-fixes-2, 5.3: every variant, every size, and the text in the existing muted token (no new token).
  it.each(["send", "record", "outline"] as const)("%s: dashed, no fill, no shadow, no press, not-allowed cursor, ink-label text", (variant) => {
    for (const size of ["compact", "default", "large", "xl", "sheet", "pay", "card"] as const) {
      cleanup();
      render(
        <Button variant={variant} size={size} disabled>
          Go
        </Button>,
      );
      const names = classes(screen.getByRole("button", { name: "Go" }));
      expect(names).toEqual(expect.arrayContaining(["cursor-not-allowed", "border-dashed", "border-ink-label", "bg-transparent", "text-ink-label"]));
      expect(names.join(" ")).not.toMatch(/shadow-|bg-blue|bg-ink\b|bg-slip|pressed:|text-slip|text-ink-soft/);
    }
  });

  it("ties the reason to the button for screen readers", () => {
    render(
      <Button variant="send" disabled disabledReason="Add a parent's phone number first.">
        Remind
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Remind" });
    const reason = screen.getByText("Add a parent's phone number first.");
    expect(reason.id).not.toBe("");
    expect(button.getAttribute("aria-describedby")).toBe(reason.id);
  });

  it("keeps a description the caller already gave", () => {
    render(
      <Button variant="send" disabled disabledReason="Why" aria-describedby="other">
        Remind
      </Button>,
    );
    const ids = screen.getByRole("button").getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe("other");
  });

  it("shows no reason when the button is available", () => {
    render(
      <Button variant="send" disabledReason="Why">
        Remind
      </Button>,
    );
    expect(screen.queryByText("Why")).toBeNull();
    expect(screen.getByRole("button").hasAttribute("aria-describedby")).toBe(false);
  });

  it("a disabled link has no href and is announced as unavailable", () => {
    render(
      <Button variant="send" href="/remind" disabled>
        Remind
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Remind" });
    expect(link.hasAttribute("href")).toBe(false);
    expect(link.getAttribute("aria-disabled")).toBe("true");
    expect(link.hasAttribute("tabindex")).toBe(false);
  });

  it("disabled wins over busy", () => {
    render(
      <Button variant="send" disabled busy busyLabel="Saving…">
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button.hasAttribute("aria-busy")).toBe(false);
  });
});

describe("Button motion and focus (criteria 20 and 21)", () => {
  it("moves on transform only, in 80ms, and instantly under reduced motion", () => {
    render(<Button variant="send">Remind</Button>);
    expect(classes(screen.getByRole("button"))).toEqual(
      expect.arrayContaining([
        "transition-transform",
        "duration-80",
        "ease-linear",
        "motion-reduce:transition-none",
        "motion-reduce:duration-0",
      ]),
    );
  });

  it("uses the ground's focus ring", () => {
    render(<Button variant="send">Remind</Button>);
    expect(classes(screen.getByRole("button"))).toContain("ring:ground-ring");
  });
});

describe("RoundButton (criterion 24)", () => {
  it("is a 48px circle in send colours with the 3px shadow and an accessible name", () => {
    render(<RoundButton label="Remind Ravi's parent on WhatsApp" icon={<svg data-testid="icon" />} />);
    const button = screen.getByRole("button", { name: "Remind Ravi's parent on WhatsApp" });
    expect(classes(button)).toEqual(
      expect.arrayContaining(["size-control", "rounded-full", "bg-blue", "text-slip", "shadow-round", "shrink-0"]),
    );
    expect(screen.getByTestId("icon").parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  it("cannot be written without a label", () => {
    // @ts-expect-error label is required
    render(<RoundButton icon={<svg />} />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("can be a link", () => {
    render(<RoundButton label="Remind" icon={<svg />} href="/remind" />);
    const link = screen.getByRole("link", { name: "Remind" });
    expect(link.getAttribute("href")).toBe("/remind");
  });

  it("fires its handler", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<RoundButton label="Remind" icon={<svg />} onClick={onClick} />);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("FlatButton (spec open question 6: the shadowless form, for Banner only)", () => {
  const looks: [FlatLook, string[]][] = [
    ["record", ["border-ink", "bg-ink", "text-slip"]],
    ["outline", ["border-ink", "bg-transparent", "text-ink"]],
    ["outline-on-dark", ["border-slip", "bg-transparent", "text-slip"]],
    ["slip-on-dark", ["border-slip", "bg-slip", "text-ink"]],
  ];

  it.each(looks)("%s has its border, fill and text", (look, expected) => {
    render(<FlatButton look={look}>Later</FlatButton>);
    const button = screen.getByRole("button", { name: "Later" });
    expect(classes(button)).toEqual(expect.arrayContaining(expected));
  });

  it.each(looks)("%s has no shadow, and no red, blue or green", (look) => {
    render(<FlatButton look={look}>Later</FlatButton>);
    const name = screen.getByRole("button").className;
    expect(name).not.toMatch(/shadow/);
    expect(name).not.toMatch(/cloth|blue|stamp/);
  });

  it("has four looks and no others", () => {
    // @ts-expect-error there is no send, green or red flat button
    render(<FlatButton look="send">Send</FlatButton>);
    expect(screen.getByRole("button").className).not.toMatch(/\bbg-/);
  });

  it("shares the button's box, wrapping text, 80ms move and focus ring", () => {
    render(<FlatButton look="record">Try again</FlatButton>);
    const flat = classes(screen.getByRole("button", { name: "Try again" }));
    cleanup();
    render(<Button variant="record">Save</Button>);
    const button = classes(screen.getByRole("button", { name: "Save" }));
    const shared = ["inline-flex", "min-h-control", "rounded-sm", "border-2", "whitespace-normal", "wrap-anywhere", "transition-transform", "duration-80", "ease-linear", "motion-reduce:transition-none", "motion-reduce:duration-0", "ring:ground-ring"];
    expect(flat).toEqual(expect.arrayContaining(shared));
    expect(button).toEqual(expect.arrayContaining(shared));
  });

  it("moves 2px when pressed instead of 5px into a shadow", () => {
    render(<FlatButton look="outline">Later</FlatButton>);
    const flat = classes(screen.getByRole("button"));
    expect(flat).toContain("pressed:press-flat");
    expect(flat).not.toContain("pressed:press-button");
  });

  it("is a real button that does not submit a form unless asked, and reports a tap", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <FlatButton look="record" onClick={onClick}>
        Try again
      </FlatButton>,
    );
    const button = screen.getByRole("button", { name: "Try again" });
    expect(button.tagName).toBe("BUTTON");
    expect(button.getAttribute("type")).toBe("button");
    await user.click(button);
    await user.tab();
    await user.tab({ shift: true });
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("renders as a link with the same look when given an href", () => {
    render(
      <FlatButton look="slip-on-dark" href="/receipt">
        Send receipt
      </FlatButton>,
    );
    const link = screen.getByRole("link", { name: "Send receipt" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/receipt");
    expect(classes(link)).toEqual(expect.arrayContaining(["bg-slip", "text-ink", "min-h-control"]));
  });

  it("puts its icon before the label, hidden from screen readers", () => {
    render(
      <FlatButton look="slip-on-dark" icon={<svg data-testid="icon" />}>
        Send receipt
      </FlatButton>,
    );
    const button = screen.getByRole("button", { name: "Send receipt" });
    const [iconWrap, label] = [...button.children];
    expect(iconWrap.getAttribute("aria-hidden")).toBe("true");
    expect(iconWrap.contains(screen.getByTestId("icon"))).toBe(true);
    expect(label.textContent).toBe("Send receipt");
  });

  it("has no disabled and no busy form", () => {
    // @ts-expect-error no disabled state was drawn (spec open question 18)
    render(<FlatButton look="record" disabled>Try again</FlatButton>);
    cleanup();
    // @ts-expect-error busy belongs to Button
    render(<FlatButton look="record" busy busyLabel="Saving">Try again</FlatButton>);
  });

  it("is not offered to screens: only Banner, the tests and the dev page mention it", () => {
    const root = process.cwd();
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
      });
    const allowed = (path: string) =>
      ["src/components/ui/button.tsx", "src/components/ui/button.test.tsx", "src/components/ui/banner.tsx", "src/components/ui/banner.test.tsx"].includes(path) ||
      path.startsWith("src/app/dev/");
    const mentions = walk(join(root, "src"))
      .filter((path) => /\.(tsx?|mts|mjs|jsx?)$/.test(path))
      .filter((path) => readFileSync(path, "utf8").includes("FlatButton"))
      .map((path) => path.slice(root.length + 1).replaceAll("\\", "/"));
    expect(mentions.filter((path) => !allowed(path))).toEqual([]);
    // The check can see it at all: Banner does use it.
    expect(mentions).toContain("src/components/ui/banner.tsx");
  });
});
