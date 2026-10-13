// Spec R1-3, criterion 3: Attendance is a title, one line and the navigation, and nothing else.
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithWords } from "@/test-utils/render-with-words";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { AttendancePlaceholder } from "./attendance-placeholder";

afterEach(cleanup);

describe("AttendancePlaceholder", () => {
  it("shows the title, the one line and the nav with Attendance current", () => {
    renderWithWords(<AttendancePlaceholder />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Attendance");
    expect(screen.getByText("Attendance is not ready yet. Your students and fees work without it.")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Attendance" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getAllByRole("link")).toHaveLength(5);
    const back = screen.getByRole("link", { name: "Back to Home" });
    expect(back.getAttribute("href")).toBe("/en/home/");
  });

  it.each(["hi", "kn", "te"] as const)("is written in %s too, with no marker", (locale) => {
    renderWithWords(<AttendancePlaceholder />, locale);
    expect(document.body.textContent).not.toContain("TODO-translate");
    expect(screen.getByRole("heading", { level: 1 }).textContent?.length).toBeGreaterThan(0);
  });
});
