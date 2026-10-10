// copyText (spec R0-2, criteria 43 and 44): the Clipboard API, then the old copy command, and never a throw.
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./copy-text";

type Clip = { writeText: (text: string) => Promise<void> } | undefined;

function setClipboard(clipboard: Clip) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
}

function setExec(impl: (() => boolean) | undefined) {
  Object.defineProperty(document, "execCommand", { configurable: true, writable: true, value: impl });
}

const leftovers = () => document.querySelectorAll("textarea").length;

afterEach(() => {
  setClipboard(undefined);
  setExec(undefined);
  vi.restoreAllMocks();
});

describe("copyText", () => {
  it("uses the clipboard when it works, and touches nothing else", async () => {
    const writeText = vi.fn(async () => {});
    const exec = vi.fn(() => true);
    setClipboard({ writeText });
    setExec(exec);
    expect(await copyText("Hello\nupi://pay")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("Hello\nupi://pay");
    expect(exec).not.toHaveBeenCalled();
    expect(leftovers()).toBe(0);
  });

  it("falls back to the copy command when there is no clipboard", async () => {
    let copied = "";
    const exec = vi.fn(() => {
      copied = (document.querySelector("textarea") as HTMLTextAreaElement).value;
      return true;
    });
    setClipboard(undefined);
    setExec(exec);
    expect(await copyText("line one\nline two")).toBe(true);
    expect(exec).toHaveBeenCalledWith("copy");
    expect(copied).toBe("line one\nline two");
    expect(leftovers()).toBe(0);
  });

  it("falls back when the clipboard refuses", async () => {
    setClipboard({ writeText: async () => Promise.reject(new Error("blocked")) });
    setExec(vi.fn(() => true));
    expect(await copyText("x")).toBe(true);
    expect(leftovers()).toBe(0);
  });

  it("answers false when both fail", async () => {
    setClipboard({ writeText: async () => Promise.reject(new Error("blocked")) });
    setExec(vi.fn(() => false));
    expect(await copyText("x")).toBe(false);
    expect(leftovers()).toBe(0);
  });

  it("answers false, and does not throw, when the copy command throws", async () => {
    setClipboard(undefined);
    setExec(() => {
      throw new Error("not allowed");
    });
    await expect(copyText("x")).resolves.toBe(false);
    expect(leftovers()).toBe(0);
  });

  it("answers false when there is neither a clipboard nor a copy command", async () => {
    setClipboard(undefined);
    setExec(undefined);
    await expect(copyText("x")).resolves.toBe(false);
    expect(leftovers()).toBe(0);
  });

  it("keeps the temporary textarea out of the tab order and away from screen readers", async () => {
    let seen: HTMLTextAreaElement | null = null;
    setClipboard(undefined);
    setExec(() => {
      seen = document.querySelector("textarea");
      return true;
    });
    await copyText("x");
    const area = seen as HTMLTextAreaElement | null;
    expect(area?.readOnly).toBe(true);
    expect(area?.getAttribute("aria-hidden")).toBe("true");
    expect(area?.tabIndex).toBe(-1);
  });
});
