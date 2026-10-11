// Spec R1-1, criteria 34 and 35: the More screen, with the real words of each language.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/config/locales";
import type { Tutor } from "@/lib/tutor";
import { renderWithWords } from "@/test-utils/render-with-words";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push }) }));

const held: { tutor: Tutor } = { tutor: { id: "u", email: "m@example.com", name: "Meena Iyer", language: "en", upiId: "meena.tuitions@okhdfc", subjects: ["maths", "science", "Sanskrit"] } };
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: held.tutor, setTutor: vi.fn() }) }));
const signOut = vi.fn();
vi.mock("@/lib/auth", () => ({ signOut: () => signOut() }));

import { MoreScreen } from "./more-screen";

afterEach(cleanup);
beforeEach(() => {
  replace.mockReset();
  push.mockReset();
  signOut.mockReset();
  signOut.mockResolvedValue(undefined);
});

describe("MoreScreen", () => {
  it("shows the profile: name, subjects in the page's language, the UPI ID, and an Edit link to step 1", () => {
    renderWithWords(<MoreScreen />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("More");
    const profile = screen.getByRole("region", { name: "Your profile" });
    expect(within(profile).getByText("Meena Iyer")).toBeTruthy();
    // A preset's key is shown by name; a typed subject as it was typed.
    expect(within(profile).getByText("Maths, Science, Sanskrit")).toBeTruthy();
    expect(within(profile).getByText("meena.tuitions@okhdfc")).toBeTruthy();
    expect(within(profile).getByRole("link", { name: "Edit" }).getAttribute("href")).toBe("/en/setup/profile/");
  });

  it("shows no UPI line when the tutor has none yet", () => {
    held.tutor = { ...held.tutor, upiId: null };
    renderWithWords(<MoreScreen />);
    expect(screen.queryByText(/@/)).toBeNull();
    held.tutor = { ...held.tutor, upiId: "meena.tuitions@okhdfc" };
  });

  it.each([
    ["en", "English", "/en/language/"],
    ["hi", "हिन्दी", "/hi/language/"],
    ["kn", "ಕನ್ನಡ", "/kn/language/"],
    ["te", "తెలుగు", "/te/language/"],
  ] as [Locale, string, string][])("has a Language row in %s that shows the current endonym and links to the picker", (locale, endonym, href) => {
    renderWithWords(<MoreScreen />, locale);
    const link = screen.getByRole("link", { name: new RegExp(endonym) });
    expect(link.getAttribute("href")).toBe(href);
    expect(link.querySelector(`[lang="${locale}"]`)?.textContent).toBe(endonym);
  });

  it("has a Back to home link in the page's language", () => {
    renderWithWords(<MoreScreen />, "kn");
    const back = screen.getByRole("link", { name: /Back to home/ });
    expect(back.getAttribute("href")).toBe("/kn/home/");
    fireEvent.click(back);
    expect(push).toHaveBeenCalledWith("/kn/home/");
  });

  it("signs out and goes to sign-in in the page's language", async () => {
    renderWithWords(<MoreScreen />, "hi");
    fireEvent.click(screen.getByRole("button", { name: "साइन आउट" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/hi/sign-in/"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("shows nothing else: no Pro, export, help or delete-account", () => {
    renderWithWords(<MoreScreen />);
    for (const word of [/\bpro\b/i, /export/i, /help/i, /delete/i, /batches/i, /reports/i]) expect(screen.queryByText(word)).toBeNull();
    // Edit, Language, Back to home: three links; one button.
    expect(within(screen.getByRole("main")).getAllByRole("link")).toHaveLength(3);
    expect(within(screen.getByRole("main")).getAllByRole("button")).toHaveLength(1);
  });
});

describe("MoreScreen nav (R1-3, criterion 2)", () => {
  it("has the bottom nav with More current", () => {
    renderWithWords(<MoreScreen />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getAllByRole("link")).toHaveLength(4);
    expect(nav.querySelector('[data-item="more"]')?.getAttribute("aria-current")).toBe("page");
  });
});
