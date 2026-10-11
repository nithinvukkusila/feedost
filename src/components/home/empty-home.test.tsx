// Spec R1-1, criterion 32, and R1-3, criterion 13: the empty home, with the real English words.
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import type { Tutor } from "@/lib/tutor";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }) }));

const held: { tutor: Tutor } = { tutor: { id: "u", email: "m@example.com", name: "Meena Iyer", language: "en", upiId: "m@okhdfc", subjects: ["maths"] } };
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: held.tutor, setTutor: vi.fn() }) }));

import { EmptyHome, firstName } from "./empty-home";

afterEach(cleanup);
beforeEach(() => {
  push.mockReset();
});

describe("firstName", () => {
  it.each([
    ["Meena Iyer", "Meena"],
    ["  Meena   Iyer ", "Meena"],
    ["Meena", "Meena"],
    ["मीना अय्यर", "मीना"],
    ["", ""],
    [null, ""],
  ])("%j is %j", (name, first) => {
    expect(firstName(name)).toBe(first);
  });
});

describe("EmptyHome", () => {
  it("shows the brand, the tutor's first name, the heading and the body, and no line about the next update", () => {
    renderWithWords(<EmptyHome />);
    expect(screen.getByText(brand.name)).toBeTruthy();
    expect(screen.getByText("Hello, Meena")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Your book is empty.");
    expect(screen.getByText("Add your students and you will see who owes what, with one tap to remind each parent.")).toBeTruthy();
    expect(screen.queryByText("Adding students arrives in the next update.")).toBeNull();
  });

  it("has a black Add a student button to the add form, and no sample-data link", () => {
    renderWithWords(<EmptyHome />);
    const add = screen.getByRole("link", { name: "Add a student" });
    expect(add.getAttribute("href")).toBe("/en/students/new/");
    fireEvent.click(add);
    expect(push).toHaveBeenCalledWith("/en/students/new/");
    expect(screen.queryByText(/sample data/i)).toBeNull();
  });

  it.each([
    ["en", "/en/students/new/"],
    ["hi", "/hi/students/new/"],
    ["kn", "/kn/students/new/"],
    ["te", "/te/students/new/"],
  ] as const)("points the button at the add form in the page's language (%s)", (locale, href) => {
    renderWithWords(<EmptyHome />, locale);
    expect(screen.getAllByRole("link").some((link) => link.getAttribute("href") === href)).toBe(true);
  });

  it("has the bottom navigation with Home current, and the More link is in it", () => {
    renderWithWords(<EmptyHome />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBe("page");
    expect(within(nav).getByRole("link", { name: "More" }).getAttribute("href")).toBe("/en/more/");
  });

  it("no longer carries a Sign out button: that is on the More screen", () => {
    renderWithWords(<EmptyHome />);
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
});
