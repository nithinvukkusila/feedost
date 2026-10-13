// The consent screen (spec R1-9 Part B, criteria 18 to 20 and 30). Its props hold no money, so it cannot show any.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { ConsentScreen } from "./consent-screen";

afterEach(cleanup);
const words = en.payPage;
/** A paragraph by its whole text, whatever spans a filled-in name is wrapped in. */
const para = (text: string) => screen.getByText((_, el) => el?.tagName === "P" && el.textContent === text);

describe("ConsentScreen, ask", () => {
  it("shows the heading, the intro with the tutor's name, three lines with marks, the button and 'Asked only once'", () => {
    const { container } = render(<ConsentScreen mode="ask" words={words} tutorName="Meena Iyer" saving="idle" onAgree={() => {}} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Before you see the fee, a word on privacy.");
    expect(para("Meena Iyer uses this service to share fee details with you. This is what is kept:")).toBeTruthy();
    const lines = container.querySelectorAll("li");
    expect([...lines].map((li) => li.textContent)).toEqual(["Your phone number", "Your child's name, fee and attendance", "Never: ads, or tracking of children"]);
    for (const li of lines) expect(li.querySelectorAll("svg[aria-hidden=true]")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "I agree, show the fee" })).toBeTruthy();
    expect(screen.getByText("Asked only once")).toBeTruthy();
    expect(screen.getByText("Not agreeing? Just close this page. Nothing is saved.")).toBeTruthy();
    expect(container.textContent).not.toContain("₹");
  });

  it("says 'Your tutor' when the tutor has no name, and never invents one", () => {
    render(<ConsentScreen mode="ask" words={words} tutorName={null} saving="idle" onAgree={() => {}} />);
    expect(para("Your tutor uses this service to share fee details with you. This is what is kept:")).toBeTruthy();
  });

  it("calls agree on a tap", async () => {
    const onAgree = vi.fn();
    render(<ConsentScreen mode="ask" words={words} tutorName="M" saving="idle" onAgree={onAgree} />);
    await userEvent.click(screen.getByRole("button", { name: "I agree, show the fee" }));
    expect(onAgree).toHaveBeenCalledTimes(1);
  });

  it("shows Saving… and does nothing on a tap while saving", async () => {
    const onAgree = vi.fn();
    render(<ConsentScreen mode="ask" words={words} tutorName="M" saving="saving" onAgree={onAgree} />);
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(button);
    expect(onAgree).not.toHaveBeenCalled();
  });

  it("says it could not save and offers Try again, which agrees again", async () => {
    const onAgree = vi.fn();
    render(<ConsentScreen mode="ask" words={words} tutorName="M" saving="failed" onAgree={onAgree} />);
    expect(screen.getByRole("alert").textContent).toContain("Couldn't save. Check your connection and try again.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onAgree).toHaveBeenCalledTimes(1);
  });
});

describe("ConsentScreen, read", () => {
  it("has Close and no agree button and no 'Asked only once'", async () => {
    const onClose = vi.fn();
    render(<ConsentScreen mode="read" words={words} tutorName="Meena Iyer" onClose={onClose} />);
    expect(screen.queryByRole("button", { name: "I agree, show the fee" })).toBeNull();
    expect(screen.queryByText("Asked only once")).toBeNull();
    expect(screen.queryByText(/Not agreeing/)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
