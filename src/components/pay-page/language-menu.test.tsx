// The language button and its list (spec R1-9 Part B, criterion 29; spec parent-pages-english, criterion 3: it lists
// only the languages it is given).
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/config/locales";
import { LanguageMenu } from "./language-menu";

afterEach(cleanup);
// jsdom does not open modal dialogs; these stand-ins flip `open` (a browser test covers the real thing).
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

describe("LanguageMenu", () => {
  it("shows the current language's own name on the button", () => {
    render(<LanguageMenu current="hi" choices={["en", "hi"]} onChoose={() => {}} title="Language" closeLabel="Close" />);
    expect(screen.getByRole("button", { name: "हिन्दी" }).getAttribute("lang")).toBe("hi");
  });

  it("lists the languages it is given by their own names, marks the current one, and chooses one", async () => {
    const onChoose = vi.fn();
    const all: Locale[] = ["en", "hi", "kn", "te"];
    render(<LanguageMenu current="en" choices={all} onChoose={onChoose} title="Language" closeLabel="Close" />);
    await userEvent.click(screen.getByRole("button", { name: "English" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    const choices = within(dialog).getAllByRole("listitem");
    expect(choices.map((li) => li.textContent)).toEqual(["English", "हिन्दी", "ಕನ್ನಡ", "తెలుగు"]);
    expect(within(choices[0]).getByRole("button", { hidden: true }).getAttribute("aria-current")).toBe("true");
    expect(within(choices[0]).getByRole("button", { hidden: true }).querySelector("svg")).not.toBeNull();
    await userEvent.click(within(choices[3]).getByRole("button", { hidden: true }));
    expect(onChoose).toHaveBeenCalledWith("te");
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("lists exactly English and हिन्दी when only Hindi is unlocked", async () => {
    render(<LanguageMenu current="hi" choices={["en", "hi"]} onChoose={() => {}} title="Language" closeLabel="Close" />);
    await userEvent.click(screen.getByRole("button", { name: "हिन्दी" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(within(dialog).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["English", "हिन्दी"]);
  });
});
