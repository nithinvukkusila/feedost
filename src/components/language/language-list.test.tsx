// Spec R1-1, criteria 1 to 4: four rows that are plain links, the current one marked in words, a save only on a tap.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localeNames, locales } from "@/config/locales";
import { STORAGE_KEY } from "@/lib/locale-choice";
import { LanguageList } from "./language-list";

const words = { chosen: "Chosen", names: { en: "English", hi: "Hindi", kn: "Kannada", te: "Telugu" } };

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("LanguageList", () => {
  it("lists the four endonyms as links, each to the picker in that language, each with its own lang", () => {
    render(<LanguageList current="en" words={words} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    locales.forEach((code, index) => {
      expect(links[index].getAttribute("href")).toBe(`/${code}/language/`);
      expect(links[index].getAttribute("lang")).toBe(code);
      expect(links[index].textContent).toContain(localeNames[code]);
    });
  });

  it("marks the current row in words and as the current page, and no other", () => {
    render(<LanguageList current="kn" words={words} />);
    const current = screen.getByRole("link", { current: "page" });
    expect(current.getAttribute("href")).toBe("/kn/language/");
    expect(current.textContent).toContain("Chosen");
    expect(screen.getAllByText("Chosen")).toHaveLength(1);
    // The others say what they are called, in the page's language.
    expect(screen.getByRole("link", { name: /Hindi/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Telugu/ })).toBeTruthy();
  });

  it("gives the word beside each row the page's language, not the row's", () => {
    render(<LanguageList current="hi" words={words} />);
    expect(screen.getByText("Chosen").getAttribute("lang")).toBe("hi");
    expect(screen.getByText("Kannada").getAttribute("lang")).toBe("hi");
  });

  it("saves nothing when it is drawn", () => {
    render(<LanguageList current="hi" words={words} />);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("saves the language of the row that is tapped, and nothing else", () => {
    render(<LanguageList current="en" words={words} />);
    const link = screen.getByRole("link", { name: /Telugu/ });
    // jsdom does not navigate; the click handler is what we are after.
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(localStorage.getItem(STORAGE_KEY)).toBe("te");
  });

  it("keeps each row at least 64px high by its class (the row token)", () => {
    render(<LanguageList current="en" words={words} />);
    for (const link of screen.getAllByRole("link")) expect(link.className).toContain("min-h-row");
  });
});
