import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Banner } from "./banner";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const classes = (el: Element) => el.className.split(/\s+/);

const offline = { title: "You are offline", detail: "3 changes are saved on this phone. They will sync when the network is back." };
const error = { title: "Couldn't save just now", detail: "The network dropped. Nothing is lost. Your changes are kept on this phone." };

describe("Banner kinds (criterion 88)", () => {
  it("has three kinds, each with its own role", () => {
    render(<Banner kind="offline" {...offline} />);
    expect(screen.getByRole("status").getAttribute("data-kind")).toBe("offline");
    cleanup();
    render(<Banner kind="error" {...error} />);
    expect(screen.getByRole("alert").getAttribute("data-kind")).toBe("error");
    cleanup();
    render(<Banner kind="undo" message="Ravi Kumar marked paid" actions={[{ label: "Undo" }, { label: "Send receipt" }]} />);
    expect(screen.getByRole("status").getAttribute("data-kind")).toBe("undo");
  });

  it("has no fourth kind: by type, and it draws nothing if one gets past the types", () => {
    // @ts-expect-error there is no success, warning or info banner
    const { container } = render(<Banner kind="success" title="Saved" detail="All done" />);
    expect(container.innerHTML).toBe("");
  });

  it("needs the words of its kind, by type", () => {
    // @ts-expect-error an offline banner has a detail line
    render(<Banner kind="offline" title="You are offline" />);
    cleanup();
    // @ts-expect-error an undo banner has exactly two actions
    render(<Banner kind="undo" message="Marked paid" actions={[{ label: "Undo" }]} />);
    cleanup();
    // @ts-expect-error an offline banner takes no actions
    render(<Banner kind="offline" {...offline} actions={[{ label: "Retry" }]} />);
    cleanup();
    const three = [{ label: "One" }, { label: "Two" }, { label: "Three" }] as const;
    // @ts-expect-error an error banner has two actions at most
    render(<Banner kind="error" {...error} actions={three} />);
  });

  it("shows only the words it was given", () => {
    render(<Banner kind="offline" {...offline} />);
    expect(screen.getByRole("status").textContent).toBe(offline.title + offline.detail);
    cleanup();
    render(<Banner kind="error" {...error} actions={[{ label: "Try again" }, { label: "Later" }]} />);
    expect(screen.getByRole("alert").textContent).toBe(`${error.title}${error.detail}Try againLater`);
  });

  it("is recognisable by shape as well as words: strip, outlined box with a shadow, rounded block", () => {
    render(<Banner kind="offline" {...offline} />);
    const strip = classes(screen.getByRole("status"));
    expect(strip).toContain("bg-ink");
    expect(strip.some((name) => name.startsWith("rounded") || name.startsWith("border") || name.startsWith("shadow"))).toBe(false);
    cleanup();
    render(<Banner kind="error" {...error} />);
    expect(classes(screen.getByRole("alert"))).toEqual(expect.arrayContaining(["border-2", "border-cloth", "bg-slip", "shadow-banner-error"]));
    cleanup();
    render(<Banner kind="undo" message="Marked paid" actions={[{ label: "Undo" }, { label: "Send receipt" }]} />);
    expect(classes(screen.getByRole("status"))).toEqual(expect.arrayContaining(["rounded-sm", "bg-ink"]));
  });
});

describe("Banner: offline (criterion 89)", () => {
  it("is a polite status with a title in slip and a detail in on-cloth, on ink", () => {
    render(<Banner kind="offline" {...offline} />);
    const banner = screen.getByRole("status");
    expect(banner.hasAttribute("aria-live")).toBe(false); // role="status" is polite by itself
    expect(classes(banner)).toEqual(expect.arrayContaining(["bg-ink", "text-slip", "on-dark-ground"]));
    expect(classes(screen.getByText(offline.title))).toEqual(expect.arrayContaining(["type-body", "font-bold", "wrap-anywhere"]));
    expect(classes(screen.getByText(offline.detail))).toEqual(expect.arrayContaining(["type-caption", "text-on-cloth", "wrap-anywhere"]));
  });

  it("has a leading mark in highlight that is a picture, hidden from screen readers", () => {
    render(<Banner kind="offline" {...offline} />);
    const mark = screen.getByRole("status").firstElementChild!;
    expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(classes(mark)).toContain("text-highlight");
    expect(mark.querySelector("svg")).toBeTruthy();
    expect(mark.textContent).toBe("");
  });

  it("has no actions and nothing that takes focus", () => {
    render(<Banner kind="offline" {...offline} />);
    expect(screen.getByRole("status").querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0);
  });
});

describe("Banner: error (criterion 90)", () => {
  it("is an alert, announced at once, with a red title and a soft-ink detail on slip", () => {
    render(<Banner kind="error" {...error} />);
    const banner = screen.getByRole("alert");
    expect(classes(banner)).toEqual(expect.arrayContaining(["bg-slip", "border-2", "border-cloth", "shadow-banner-error", "on-paper-ground"]));
    expect(classes(screen.getByText(error.title))).toEqual(expect.arrayContaining(["type-body-lg", "font-extrabold", "text-cloth", "wrap-anywhere"]));
    expect(classes(screen.getByText(error.detail))).toEqual(expect.arrayContaining(["type-body-sm", "text-ink-soft", "wrap-anywhere"]));
  });

  it("takes no action, one, or two", () => {
    render(<Banner kind="error" {...error} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    cleanup();
    render(<Banner kind="error" {...error} actions={[]} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    cleanup();
    render(<Banner kind="error" {...error} actions={[{ label: "Try again" }]} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Try again"]);
    cleanup();
    render(<Banner kind="error" {...error} actions={[{ label: "Try again" }, { label: "Later" }]} />);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Try again", "Later"]);
  });

  it("makes the main action black and the other outlined, both at least 48px tall, neither with a shadow", () => {
    render(<Banner kind="error" {...error} actions={[{ label: "Try again" }, { label: "Later" }]} />);
    const [main, other] = screen.getAllByRole("button");
    expect(classes(main)).toEqual(expect.arrayContaining(["bg-ink", "text-slip", "border-ink", "min-h-control"]));
    expect(classes(other)).toEqual(expect.arrayContaining(["bg-transparent", "text-ink", "border-ink", "min-h-control"]));
    for (const button of [main, other]) expect(button.className).not.toMatch(/shadow/);
  });

  it("has no red button: red is only on the banner's border, title and shadow", () => {
    render(<Banner kind="error" {...error} actions={[{ label: "Try again" }, { label: "Later" }]} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.className).not.toMatch(/cloth/);
      expect(button.parentElement!.className).not.toMatch(/cloth/);
    }
    const red = [...screen.getByRole("alert").querySelectorAll("*"), screen.getByRole("alert")].filter((el) => /cloth/.test(el.getAttribute("class") ?? ""));
    expect(red.map((el) => el.tagName)).toEqual(["P", "DIV"]);
  });

  it("reports a tap on each action", async () => {
    const retry = vi.fn();
    const later = vi.fn();
    const user = userEvent.setup();
    render(<Banner kind="error" {...error} actions={[{ label: "Try again", onClick: retry }, { label: "Later", onClick: later }]} />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(later).toHaveBeenCalledTimes(1);
  });
});

describe("Banner: undo (criterion 91)", () => {
  const actions = [
    { label: "Undo" },
    { label: "Send receipt", href: "/receipt/215", icon: <svg data-testid="icon" /> },
  ] as const;

  it("is a polite status: an ink block with 4px corners and a slip message", () => {
    render(<Banner kind="undo" message="Ravi Kumar marked paid" actions={actions} />);
    const banner = screen.getByRole("status");
    expect(classes(banner)).toEqual(expect.arrayContaining(["bg-ink", "rounded-sm", "text-slip", "on-dark-ground"]));
    expect(classes(screen.getByText("Ravi Kumar marked paid"))).toEqual(expect.arrayContaining(["type-body", "font-bold", "wrap-anywhere"]));
  });

  it("outlines the first action in slip and fills the second with slip, both at least 48px tall", () => {
    render(<Banner kind="undo" message="Marked paid" actions={actions} />);
    const first = screen.getByRole("button", { name: "Undo" });
    const second = screen.getByRole("link", { name: "Send receipt" });
    expect(classes(first)).toEqual(expect.arrayContaining(["border-slip", "bg-transparent", "text-slip", "min-h-control"]));
    expect(classes(second)).toEqual(expect.arrayContaining(["border-slip", "bg-slip", "text-ink", "min-h-control"]));
  });

  it("can make the second action a link with an icon", () => {
    render(<Banner kind="undo" message="Marked paid" actions={actions} />);
    const link = screen.getByRole("link", { name: "Send receipt" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/receipt/215");
    const icon = within(link).getByTestId("icon");
    expect(icon.parentElement!.getAttribute("aria-hidden")).toBe("true");
  });

  it("uses no red, blue or green on either action", () => {
    render(<Banner kind="undo" message="Marked paid" actions={actions} />);
    for (const control of [screen.getByRole("button"), screen.getByRole("link")]) expect(control.className).not.toMatch(/cloth|blue|stamp/);
    expect(screen.getByRole("status").outerHTML).not.toMatch(/cloth\b(?!-)|bg-blue|bg-stamp/);
  });

  it("passes data attributes to an action and nothing else", () => {
    render(<Banner kind="undo" message="Marked paid" actions={[{ label: "Undo", attrs: { "data-force": "focus" } }, { label: "Send receipt" }]} />);
    expect(screen.getByRole("button", { name: "Undo" }).getAttribute("data-force")).toBe("focus");
    expect(screen.getByRole("button", { name: "Send receipt" }).hasAttribute("data-force")).toBe(false);
  });
});

describe("Banner layout of actions (criterion 92)", () => {
  it("puts the actions in a wrapping row, stretched to one height, the main one taking the spare width", () => {
    render(<Banner kind="error" {...error} actions={[{ label: "Try again" }, { label: "Later" }]} />);
    const [main, other] = screen.getAllByRole("button");
    const row = main.parentElement!.parentElement!;
    expect(classes(row)).toEqual(expect.arrayContaining(["flex", "flex-wrap", "items-stretch"]));
    expect(classes(main.parentElement!)).toEqual(expect.arrayContaining(["flex", "grow-9999", "min-w-24", "max-w-full"]));
    expect(classes(other.parentElement!)).toEqual(expect.arrayContaining(["flex", "grow", "min-w-24", "max-w-full"]));
    expect(classes(main)).toContain("w-full");
  });

  it("gives the spare width to the filled action in an undo banner", () => {
    render(<Banner kind="undo" message="Marked paid" actions={[{ label: "Undo" }, { label: "Send receipt" }]} />);
    expect(classes(screen.getByRole("button", { name: "Undo" }).parentElement!)).toContain("grow");
    expect(classes(screen.getByRole("button", { name: "Send receipt" }).parentElement!)).toContain("grow-9999");
  });

  it("never truncates a title, a detail or a label", () => {
    render(<Banner kind="error" {...error} actions={[{ label: "Try again" }, { label: "Later" }]} />);
    expect(screen.getByRole("alert").outerHTML).not.toMatch(/truncate|nowrap|line-clamp|text-ellipsis|overflow-hidden/);
  });
});

describe("Banner focus and time (criterion 93)", () => {
  it("reaches both undo actions by keyboard, in order", async () => {
    const user = userEvent.setup();
    render(<Banner kind="undo" message="Marked paid" actions={[{ label: "Undo" }, { label: "Send receipt", href: "/receipt" }]} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Undo" }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Send receipt" }));
  });

  it("marks the offline and undo banners as dark ground, so rings inside are yellow, and the error banner as paper", () => {
    render(<Banner kind="offline" {...offline} />);
    expect(classes(screen.getByRole("status"))).toContain("on-dark-ground");
    cleanup();
    render(<Banner kind="undo" message="Marked paid" actions={[{ label: "Undo" }, { label: "Send receipt" }]} />);
    expect(classes(screen.getByRole("status"))).toContain("on-dark-ground");
    for (const button of screen.getAllByRole("button")) expect(classes(button)).toContain("ring:ground-ring");
    cleanup();
    render(<Banner kind="error" {...error} />);
    expect(classes(screen.getByRole("alert"))).toContain("on-paper-ground");
  });

  it("has no timer: a minute later it is still there, and it never called anything by itself", () => {
    vi.useFakeTimers();
    const undo = vi.fn();
    const send = vi.fn();
    render(<Banner kind="undo" message="Marked paid" actions={[{ label: "Undo", onClick: undo }, { label: "Send receipt", onClick: send }]} />);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(screen.getByRole("status").textContent).toBe("Marked paidUndoSend receipt");
    expect(undo).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("has no close control of its own and no motion", () => {
    render(<Banner kind="error" {...error} actions={[{ label: "Try again" }]} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    const html = screen.getByRole("alert").outerHTML.replaceAll("transition-transform duration-80 ease-linear motion-reduce:transition-none motion-reduce:duration-0", "");
    // Only the action's own 80ms press is left out above; nothing else moves, and nothing is pinned.
    expect(html).not.toMatch(/transition|animate|duration-|\b(fixed|sticky|absolute)\b/);
  });
});
