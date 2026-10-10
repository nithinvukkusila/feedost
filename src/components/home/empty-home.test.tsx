// Spec R1-1, criterion 32: the empty home, with the real English words.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import type { Tutor } from "@/lib/tutor";
import { renderWithWords } from "@/test-utils/render-with-words";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const held: { tutor: Tutor } = { tutor: { id: "u", email: "m@example.com", name: "Meena Iyer", language: "en", upiId: "m@okhdfc", subjects: ["maths"] } };
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: held.tutor, setTutor: vi.fn() }) }));
const signOut = vi.fn();
vi.mock("@/lib/auth", () => ({ signOut: () => signOut() }));

import { EmptyHome, firstName } from "./empty-home";

afterEach(cleanup);
beforeEach(() => {
  replace.mockReset();
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
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
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("has a plain Sign out button that signs out and goes to sign-in in the page's language", async () => {
    renderWithWords(<EmptyHome />, "hi");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/hi/sign-in/"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
