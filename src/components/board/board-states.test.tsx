// Spec UX-review-fixes, criteria U1 to U4: what Home says when students exist and nothing is due yet.
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithWords } from "@/test-utils/render-with-words";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { NothingYet } from "./board-states";

afterEach(cleanup);

describe("NothingYet", () => {
  it("names the next fee date, the Already owes advice and the link, in the current month", () => {
    renderWithWords(<NothingYet isCurrent month="October 2026" nextDue="2026-11-01" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Nothing is due yet.");
    expect(screen.getByText("Your next fee comes in on 01 Nov 2026.")).toBeTruthy();
    expect(screen.getByText(/add it under Already owes/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "See your students" }).getAttribute("href")).toBe("/en/students/");
  });

  it("keeps digits 0 to 9 in the date in Hindi", () => {
    renderWithWords(<NothingYet isCurrent month="October 2026" nextDue="2026-11-01" />, "hi");
    expect(document.body.textContent).toContain("01 Nov 2026");
  });

  it("has no date line when there is no date, and says only what it said before", () => {
    renderWithWords(<NothingYet isCurrent month="October 2026" />);
    expect(screen.queryByText(/Your next fee comes in/)).toBeNull();
    expect(screen.getByText(/add it under Already owes/)).toBeTruthy();
  });

  it("is unchanged for a past month", () => {
    renderWithWords(<NothingYet isCurrent={false} month="August 2026" nextDue="2026-11-01" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("No fees were due in August 2026.");
    expect(screen.queryByText(/Your next fee comes in/)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
