// Spec R1-1, criterion 32: the empty home, with the real English words.
import { cleanup, fireEvent, screen } from "@testing-library/react";
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
  it("shows the brand, the tutor's first name, the heading, the body and the line about the next update", () => {
    renderWithWords(<EmptyHome />);
    expect(screen.getByText(brand.name)).toBeTruthy();
    expect(screen.getByText("Hello, Meena")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Your book is empty.");
    expect(screen.getByText("Add your students and you will see who owes what, with one tap to remind each parent.")).toBeTruthy();
    expect(screen.getByText("Adding students arrives in the next update.")).toBeTruthy();
  });

  it("has no Add students button and no sample-data link: they cannot work yet", () => {
    renderWithWords(<EmptyHome />);
    expect(screen.queryByText(/add students/i)).toBeNull();
    expect(screen.queryByText(/sample data/i)).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it.each([
    ["en", "More", "/en/more/"],
    ["hi", "और", "/hi/more/"],
  ] as const)("has a More link in %s that goes to the More screen in the page's language", (locale, word, href) => {
    renderWithWords(<EmptyHome />, locale);
    const link = screen.getByRole("link", { name: word });
    expect(link.getAttribute("href")).toBe(href);
    fireEvent.click(link);
    expect(push).toHaveBeenCalledWith(href);
  });

  it("no longer carries a Sign out button: that is on the More screen", () => {
    renderWithWords(<EmptyHome />);
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
  });
});
