import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act, StrictMode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Field } from "./field";
import { Sheet, SheetFrame } from "./sheet";

afterEach(cleanup);

// jsdom does not open modal dialogs. These stand-ins only flip the `open` attribute and fire `close`;
// real dialog behaviour (focus, inert page, Escape) is tested in a browser by Playwright.
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

const classes = (el: Element) => el.className.split(/\s+/);

describe("Sheet content (criteria 53 and 54)", () => {
  it("renders nothing inside while closed", () => {
    render(
      <Sheet open={false} onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByText("Body")).toBeNull();
    expect(screen.queryByText("Mark paid")).toBeNull();
  });

  it("is a dialog named by its title", () => {
    render(
      <Sheet open onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = screen.getByRole("dialog", { name: "Mark paid" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog.hasAttribute("open")).toBe(true);
    const title = screen.getByRole("heading", { level: 2, name: "Mark paid" });
    expect(dialog.getAttribute("aria-labelledby")).toBe(title.id);
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("shows the close words it was given on a real button at least 44px tall", () => {
    render(
      <Sheet open onClose={() => {}} title="Export" closeLabel="Close">
        <p>Body</p>
      </Sheet>,
    );
    const close = screen.getByRole("button", { name: "Close" });
    expect(close.getAttribute("type")).toBe("button");
    expect(classes(close)).toEqual(expect.arrayContaining(["min-h-tap", "ring:ground-ring"]));
  });

  it("shows the optional context header on the dark ground, in on-cloth", () => {
    render(
      <Sheet
        open
        onClose={() => {}}
        title="Mark paid"
        closeLabel="Cancel"
        context={{ label: "Class 10 Maths · October", title: "Ravi Kumar" }}
      >
        <p>Body</p>
      </Sheet>,
    );
    const label = screen.getByText("Class 10 Maths · October");
    expect(classes(label)).toContain("type-label");
    expect(classes(label.parentElement!)).toContain("text-on-cloth");
    expect(screen.getByText("Ravi Kumar")).toBeTruthy();
    // The dialog is named by the panel title, not the context title.
    expect(screen.getByRole("dialog", { name: "Mark paid" })).toBeTruthy();
  });

  it("has no context header unless given one", () => {
    render(
      <Sheet open onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.getByRole("dialog").querySelector(".text-on-cloth")).toBeNull();
  });

  it("is a slip panel with a 2px ink top edge that scrolls inside itself, on the dark ground", () => {
    render(
      <Sheet open onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    const panel = screen.getByText("Body").parentElement!.parentElement!;
    expect(classes(panel)).toEqual(
      expect.arrayContaining(["bg-slip", "border-t-2", "border-ink", "overflow-y-auto", "overscroll-contain", "on-paper-ground"]),
    );
    expect(classes(panel.parentElement!)).toEqual(expect.arrayContaining(["bg-sheet-ground", "on-dark-ground", "justify-end"]));
    // The bar with the title and the close control stays put while the content scrolls.
    expect(classes(screen.getByRole("button", { name: "Cancel" }).parentElement!)).toContain("sticky");
  });
});

describe("Sheet opening and closing (criterion 55, the parts jsdom can show)", () => {
  it("opens and closes the native dialog with the open prop", () => {
    const { rerender } = render(
      <Sheet open={false} onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = document.querySelector("dialog")!;
    expect(dialog.hasAttribute("open")).toBe(false);
    rerender(
      <Sheet open onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("calls onClose once when the close control is used", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Sheet open onClose={onClose} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the dialog closes natively, as Escape and the back gesture do", () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    document.querySelector("dialog")!.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when the screen itself closes the sheet", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Sheet open onClose={onClose} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    rerender(
      <Sheet open={false} onClose={onClose} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    expect(document.querySelector("dialog")!.hasAttribute("open")).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByText("Body")).toBeNull();
  });
});

describe("SheetFrame", () => {
  it("draws the same panel without a dialog, for showing the look in place", () => {
    render(
      <SheetFrame title="Mark paid" titleId="t" closeLabel="Cancel">
        <p>Body</p>
      </SheetFrame>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Mark paid" }).id).toBe("t");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });
});

describe("Sheet focus (review S3)", () => {
  it("focuses the element marked data-autofocus when it opens", () => {
    const { rerender } = render(
      <Sheet open={false} onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <Field label="Amount received" data-autofocus="" />
      </Sheet>,
    );
    rerender(
      <Sheet open onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <Field label="Amount received" data-autofocus="" />
      </Sheet>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Amount received"));
  });

  it("focuses it when the sheet is open from the start", () => {
    render(
      <Sheet open onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <Field label="Amount received" data-autofocus="" />
      </Sheet>,
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Amount received"));
  });

  it("leaves focus to the browser when nothing is marked", () => {
    render(
      <Sheet open onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <Field label="Amount received" />
      </Sheet>,
    );
    // The stand-in showModal() moves no focus; a real browser focuses the close control (Playwright checks that).
    expect(document.activeElement).not.toBe(screen.getByLabelText("Amount received"));
  });

  it("closes the dialog when it is removed while open, so the browser can hand focus back", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Sheet open onClose={onClose} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = document.querySelector("dialog")!;
    const close = vi.spyOn(dialog, "close");
    expect(dialog.hasAttribute("open")).toBe(true);
    unmount();
    expect(close).toHaveBeenCalledTimes(1);
    expect(dialog.hasAttribute("open")).toBe(false);
    // The screen removed it; there is nobody to tell.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close twice when it is removed after closing", () => {
    const { rerender, unmount } = render(
      <Sheet open onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    const dialog = document.querySelector("dialog")!;
    rerender(
      <Sheet open={false} onClose={() => {}} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    const close = vi.spyOn(dialog, "close");
    unmount();
    expect(close).not.toHaveBeenCalled();
  });
});

describe("Sheet under React StrictMode, with the close event arriving later as in a browser (review N1)", () => {
  // A browser queues the `close` event; the stand-in above fires it at once, which hides this case.
  function lateClose() {
    return vi.spyOn(HTMLDialogElement.prototype, "close").mockImplementation(function close(this: HTMLDialogElement) {
      if (!this.hasAttribute("open")) return;
      this.removeAttribute("open");
      setTimeout(() => this.dispatchEvent(new Event("close")), 0);
    });
  }
  const later = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));

  afterEach(() => vi.restoreAllMocks());

  it("a sheet mounted already open stays open and does not report a close", async () => {
    lateClose();
    const onClose = vi.fn();
    render(
      <StrictMode>
        <Sheet open onClose={onClose} title="Mark paid" closeLabel="Cancel">
          <p>Body</p>
        </Sheet>
      </StrictMode>,
    );
    await later();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.querySelector("dialog")!.hasAttribute("open")).toBe(true);
    expect(screen.getByText("Body")).toBeTruthy();
  });

  it("still reports the person closing it afterwards, once", async () => {
    lateClose();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Sheet open onClose={onClose} title="Mark paid" closeLabel="Cancel">
          <p>Body</p>
        </Sheet>
      </StrictMode>,
    );
    await later();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await later();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("still reports a close outside StrictMode when the event arrives later", async () => {
    lateClose();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Sheet open onClose={onClose} title="Mark paid" closeLabel="Cancel">
        <p>Body</p>
      </Sheet>,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await later();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
