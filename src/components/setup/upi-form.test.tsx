// Spec R1-1, criteria 27 to 31: setup step 2. Rendered with the real English words.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import type { SaveResult, Tutor } from "@/lib/tutor";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const base: Tutor = { id: "u", email: "m@example.com", name: "Meena Iyer", language: "en", upiId: null, subjects: ["maths"] };
const setTutor = vi.fn();
const held = { tutor: base };
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: held.tutor, setTutor }) }));

const saveUpi = vi.fn<(upi: string) => Promise<SaveResult>>();
vi.mock("@/lib/tutor", () => ({ saveUpi: (upi: string) => saveUpi(upi) }));
const signOut = vi.fn();
vi.mock("@/lib/auth", () => ({ signOut: () => signOut() }));

import { UpiForm } from "./upi-form";

afterEach(cleanup);
beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  setTutor.mockReset();
  saveUpi.mockReset();
  signOut.mockReset();
  held.tutor = base;
});

const show = (locale: "en" | "hi" = "en") => renderWithWords(<UpiForm />, locale);
const box = () => screen.getByRole("textbox", { name: /Your UPI ID/ }) as HTMLTextAreaElement;
const save = () => screen.getByRole("button", { name: "Save and finish" });

describe("what it shows (criterion 27)", () => {
  it("has the step, the title, the body with the product name, the field with its placeholder, and the black button", () => {
    show();
    expect(screen.getByText("Step 2 of 3")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Where should the fees land?");
    expect(screen.getByText(`Your UPI ID. Parents pay you directly. ${brand.name} never touches the money.`)).toBeTruthy();
    expect(box().value).toBe("");
    expect(box().getAttribute("placeholder")).toBe("name@bank");
    expect(save().className).toContain("bg-ink");
  });

  it("draws the value in the Latin face", () => {
    show();
    expect(box().className).toContain("type-value-latin");
  });

  it("has a Back link to step 1 in the page's language", () => {
    show("hi");
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/hi/setup/profile/");
  });
});

describe("as the tutor types (criteria 28 and 29)", () => {
  it("says nothing before the field has been left", async () => {
    show();
    const user = userEvent.setup();
    await user.type(box(), "abc");
    expect(screen.queryByText(/missing the part after @/)).toBeNull();
  });

  it("says it looks valid, with a word and a mark, once a good ID has been left", async () => {
    show();
    const user = userEvent.setup();
    await user.type(box(), "meena.tuitions@okhdfc");
    fireEvent.blur(box());
    expect(await screen.findByText("That looks like a valid UPI ID.")).toBeTruthy();
    expect(screen.getByText("Correct", { selector: ".sr-only" })).toBeTruthy();
    expect(box().closest("[data-state]")?.getAttribute("data-state")).toBe("correct");
  });

  it("says how to fix an ID with no @", async () => {
    show();
    const user = userEvent.setup();
    await user.type(box(), "abc");
    fireEvent.blur(box());
    expect(await screen.findByText("This is missing the part after @. A UPI ID looks like name@bank")).toBeTruthy();
    expect(screen.getByText("Needs fixing")).toBeTruthy();
    expect(box().getAttribute("aria-invalid")).toBe("true");
  });

  it("says how to fix anything else that is wrong, and keeps checking as the tutor types", async () => {
    show();
    const user = userEvent.setup();
    await user.type(box(), "name@");
    fireEvent.blur(box());
    expect(await screen.findByText("A UPI ID has letters, digits, dots and dashes, then @, then the bank's name. Check for spaces.")).toBeTruthy();
    await user.type(box(), "okhdfc");
    expect(await screen.findByText("That looks like a valid UPI ID.")).toBeTruthy();
  });

  it("says to type it when it is left empty", async () => {
    show();
    box().focus();
    fireEvent.blur(box());
    expect(await screen.findByText("Type your UPI ID.")).toBeTruthy();
  });

  it("calls an ID with Hindi digits wrong", async () => {
    show();
    fireEvent.change(box(), { target: { value: "९८४५०१२३४५@ybl" } });
    fireEvent.blur(box());
    expect(await screen.findByText(/A UPI ID has letters, digits/)).toBeTruthy();
  });

  it("accepts spaces around a good ID", async () => {
    show();
    fireEvent.change(box(), { target: { value: "  meena@okhdfc  " } });
    fireEvent.blur(box());
    expect(await screen.findByText("That looks like a valid UPI ID.")).toBeTruthy();
  });

  it("starts with the saved ID", () => {
    held.tutor = { ...base, upiId: "meena@okhdfc" };
    show();
    expect(box().value).toBe("meena@okhdfc");
  });
});

describe("saving (criterion 30)", () => {
  it("does not save a bad ID, and says what is wrong", async () => {
    show();
    fireEvent.change(box(), { target: { value: "abc" } });
    fireEvent.click(save());
    expect(await screen.findByText(/missing the part after @/)).toBeTruthy();
    expect(saveUpi).not.toHaveBeenCalled();
  });

  it("does not save an empty field", async () => {
    show();
    fireEvent.click(save());
    expect(await screen.findByText("Type your UPI ID.")).toBeTruthy();
    expect(saveUpi).not.toHaveBeenCalled();
  });

  it("saves the trimmed ID and goes home, in the page's language", async () => {
    show("hi");
    saveUpi.mockResolvedValue({ ok: true, tutor: { ...base, upiId: "meena@okhdfc" } });
    fireEvent.change(box(), { target: { value: "  meena@okhdfc " } });
    fireEvent.click(screen.getByRole("button", { name: "Save and finish" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/hi/home/"));
    expect(saveUpi).toHaveBeenCalledWith("meena@okhdfc");
    expect(setTutor).toHaveBeenCalledWith(expect.objectContaining({ upiId: "meena@okhdfc" }));
  });

  it("saves on Enter in the field", async () => {
    show();
    saveUpi.mockResolvedValue({ ok: true, tutor: { ...base, upiId: "meena@okhdfc" } });
    const user = userEvent.setup();
    await user.type(box(), "meena@okhdfc{Enter}");
    await waitFor(() => expect(saveUpi).toHaveBeenCalledTimes(1));
  });

  it("is busy while it saves, and a second tap does nothing", async () => {
    show();
    saveUpi.mockReturnValue(new Promise(() => {}));
    fireEvent.change(box(), { target: { value: "meena@okhdfc" } });
    fireEvent.click(save());
    await waitFor(() => expect(save().getAttribute("aria-busy")).toBe("true"));
    fireEvent.click(save());
    expect(saveUpi).toHaveBeenCalledTimes(1);
  });

  it("keeps what was typed, says it was not saved, and does not move on, when the save fails", async () => {
    show();
    saveUpi.mockResolvedValue({ ok: false, reason: "failed" });
    fireEvent.change(box(), { target: { value: "meena@okhdfc" } });
    fireEvent.click(save());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Couldn't save just now. Your changes were not saved. Check your connection and tap Save and finish again.");
    expect(box().value).toBe("meena@okhdfc");
    expect(replace).not.toHaveBeenCalled();
  });

  it("says to sign out and in again when the row is missing", async () => {
    show();
    saveUpi.mockResolvedValue({ ok: false, reason: "missing" });
    signOut.mockResolvedValue(undefined);
    fireEvent.change(box(), { target: { value: "meena@okhdfc" } });
    fireEvent.click(save());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("We could not find your profile. Sign out, then sign in again.");
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/sign-in/"));
    expect(replace).not.toHaveBeenCalledWith("/en/home/");
  });
});
