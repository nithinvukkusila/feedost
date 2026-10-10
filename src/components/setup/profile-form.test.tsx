// Spec R1-1, criteria 21 to 26: setup step 1. Rendered with the real English words.
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SaveResult, Tutor } from "@/lib/tutor";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

const newTutor: Tutor = { id: "u", email: "m@example.com", name: null, language: "en", upiId: null, subjects: [] };
const setTutor = vi.fn();
const held = { tutor: newTutor };
vi.mock("@/components/app/app-gate", () => ({ useTutor: () => ({ tutor: held.tutor, setTutor }) }));

const saveProfile = vi.fn<(profile: { name: string; subjects: string[]; language: string }) => Promise<SaveResult>>();
vi.mock("@/lib/tutor", () => ({ saveProfile: (profile: { name: string; subjects: string[]; language: string }) => saveProfile(profile) }));
const signOut = vi.fn();
vi.mock("@/lib/auth", () => ({ signOut: () => signOut() }));

import { ProfileForm } from "./profile-form";

const saved = (over: Partial<Tutor> = {}): SaveResult => ({ ok: true, tutor: { ...newTutor, name: "Meena Iyer", subjects: ["maths"], ...over } });

afterEach(cleanup);
beforeEach(() => {
  push.mockReset();
  replace.mockReset();
  setTutor.mockReset();
  saveProfile.mockReset();
  signOut.mockReset();
  held.tutor = newTutor;
});

const show = (locale: "en" | "hi" = "en") => renderWithWords(<ProfileForm />, locale);
const nameBox = () => screen.getByRole("textbox", { name: /Your name/ }) as HTMLTextAreaElement;
const chip = (name: string) => screen.getByRole("button", { name });
const next = () => screen.getByRole("button", { name: "Next: your UPI ID" });

describe("what it shows (criterion 21)", () => {
  it("has the step, the title, the body, an empty name field, seven chips, + Other and the black Next button", () => {
    show();
    expect(screen.getByText("Step 1 of 3")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("What should parents call you?");
    expect(screen.getByText("This name goes on every reminder, pay page and receipt.")).toBeTruthy();
    expect(nameBox().value).toBe("");
    for (const subject of ["Maths", "Science", "English", "Hindi", "Physics", "Chemistry", "Accounts"]) expect(chip(subject).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "+ Other" })).toBeTruthy();
    expect(next().className).toContain("bg-ink");
  });

  it("has no photo row", () => {
    show();
    expect(screen.queryByText(/photo/i)).toBeNull();
  });

  it("has no back link on step 1", () => {
    show();
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("the name (criterion 22)", () => {
  it("says Missing and what to type when Next is tapped with nothing", async () => {
    show();
    fireEvent.click(next());
    expect(await screen.findByText("Type your name.")).toBeTruthy();
    expect(screen.getByText("Missing")).toBeTruthy();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("says Too long and how many characters to use for 81", async () => {
    show();
    const user = userEvent.setup();
    await user.click(chip("Maths"));
    fireEvent.change(nameBox(), { target: { value: "a".repeat(81) } });
    fireEvent.click(next());
    expect(await screen.findByText("Use 80 characters or fewer.")).toBeTruthy();
    expect(screen.getByText("Too long")).toBeTruthy();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("says Missing after the field is left empty, before any Next", async () => {
    show();
    nameBox().focus();
    fireEvent.blur(nameBox());
    expect(await screen.findByText("Type your name.")).toBeTruthy();
  });
});

describe("the subjects (criteria 23 and 24)", () => {
  it("toggles a chip, with aria-pressed and a tick", async () => {
    show();
    const user = userEvent.setup();
    await user.click(chip("Maths"));
    expect(chip("Maths").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Maths").querySelector("svg")).not.toBeNull();
    expect(chip("Science").querySelector("svg")).toBeNull();
    await user.click(chip("Maths"));
    expect(chip("Maths").getAttribute("aria-pressed")).toBe("false");
  });

  it("says to pick one when none is picked", async () => {
    show();
    fireEvent.change(nameBox(), { target: { value: "Meena" } });
    fireEvent.click(next());
    expect(await screen.findByText("Pick at least one subject.")).toBeTruthy();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("clears that message when one is picked", async () => {
    show();
    const user = userEvent.setup();
    fireEvent.click(next());
    expect(await screen.findByText("Pick at least one subject.")).toBeTruthy();
    await user.click(chip("Science"));
    expect(screen.queryByText("Pick at least one subject.")).toBeNull();
  });

  it("every chip is at least 44px by its class (the control token is 48px)", () => {
    show();
    for (const button of screen.getAllByRole("button", { pressed: false })) expect(button.className).toContain("min-h-control");
  });

  it("opens + Other, adds a typed subject as a new pressed chip and closes the field", async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ Other" }));
    const other = screen.getByRole("textbox", { name: /Another subject/ });
    expect(document.activeElement).toBe(other);
    await user.type(other, "Sanskrit");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(chip("Sanskrit").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("textbox", { name: /Another subject/ })).toBeNull();
  });

  it("adds on Enter in that field, and does not send the form", async () => {
    show();
    const user = userEvent.setup();
    fireEvent.change(nameBox(), { target: { value: "Meena" } });
    await user.click(screen.getByRole("button", { name: "+ Other" }));
    await user.type(screen.getByRole("textbox", { name: /Another subject/ }), "Sanskrit{Enter}");
    expect(chip("Sanskrit").getAttribute("aria-pressed")).toBe("true");
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("keeps Add unavailable while the field is blank", async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ Other" }));
    expect((screen.getByRole("button", { name: "Add" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("limits a typed subject to 30 characters", async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ Other" }));
    expect(screen.getByRole("textbox", { name: /Another subject/ }).getAttribute("maxlength")).toBe("30");
  });

  it("turns a typed preset name into the preset's chip, not a second one", async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "+ Other" }));
    await user.type(screen.getByRole("textbox", { name: /Another subject/ }), "maths");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(chip("Maths").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("button", { name: /maths/i })).toHaveLength(1);
  });

  it("says what is wrong when more than eight are picked", async () => {
    show();
    const user = userEvent.setup();
    fireEvent.change(nameBox(), { target: { value: "Meena" } });
    for (const subject of ["Maths", "Science", "English", "Hindi", "Physics", "Chemistry", "Accounts"]) await user.click(chip(subject));
    for (const extra of ["Sanskrit", "Drawing"]) {
      await user.click(screen.getByRole("button", { name: "+ Other" }));
      await user.type(screen.getByRole("textbox", { name: /Another subject/ }), `${extra}{Enter}`);
    }
    expect(await screen.findByText("Use up to 8 subjects, each short. Remove one or shorten a name.")).toBeTruthy();
    fireEvent.click(next());
    expect(saveProfile).not.toHaveBeenCalled();
  });
});

describe("saving (criterion 25)", () => {
  it("sends the tidied name, the stored subjects and the page's language, then goes to step 2", async () => {
    show();
    const user = userEvent.setup();
    saveProfile.mockResolvedValue(saved());
    fireEvent.change(nameBox(), { target: { value: "  Meena    Iyer " } });
    await user.click(chip("Maths"));
    await user.click(chip("Science"));
    await user.click(screen.getByRole("button", { name: "+ Other" }));
    await user.type(screen.getByRole("textbox", { name: /Another subject/ }), "Sanskrit{Enter}");
    fireEvent.click(next());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/setup/upi/"));
    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(saveProfile).toHaveBeenCalledWith({ name: "Meena Iyer", subjects: ["maths", "science", "Sanskrit"], language: "en" });
    expect(setTutor).toHaveBeenCalledWith(expect.objectContaining({ name: "Meena Iyer" }));
  });

  it("sends the page's language on a Hindi page, and goes on in Hindi", async () => {
    show("hi");
    saveProfile.mockResolvedValue(saved());
    fireEvent.change(screen.getByRole("textbox", { name: /Your name/ }), { target: { value: "Meena" } });
    fireEvent.click(screen.getAllByRole("button", { pressed: false })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Next: your UPI ID/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/hi/setup/upi/"));
    expect(saveProfile.mock.calls[0][0].language).toBe("hi");
  });

  it("is busy while it saves, and a second tap does nothing", async () => {
    show();
    saveProfile.mockReturnValue(new Promise(() => {}));
    fireEvent.change(nameBox(), { target: { value: "Meena" } });
    fireEvent.click(chip("Maths"));
    fireEvent.click(next());
    await waitFor(() => expect(next().getAttribute("aria-busy")).toBe("true"));
    fireEvent.click(next());
    fireEvent.submit(next().closest("form") as HTMLFormElement);
    expect(saveProfile).toHaveBeenCalledTimes(1);
  });

  it("keeps what was typed, says it was not saved, and does not move on, when the save fails", async () => {
    show();
    saveProfile.mockResolvedValue({ ok: false, reason: "failed" });
    fireEvent.change(nameBox(), { target: { value: "Meena Iyer" } });
    fireEvent.click(chip("Maths"));
    fireEvent.click(next());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Couldn't save just now. Your changes were not saved. Check your connection and tap Next again.");
    expect(nameBox().value).toBe("Meena Iyer");
    expect(chip("Maths").getAttribute("aria-pressed")).toBe("true");
    expect(push).not.toHaveBeenCalled();
    expect(setTutor).not.toHaveBeenCalled();
    // The button is ready for another try.
    expect(next().getAttribute("aria-busy")).toBeNull();
  });

  it("also says so when the phone is offline", async () => {
    show();
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    saveProfile.mockResolvedValue({ ok: false, reason: "failed" });
    fireEvent.change(nameBox(), { target: { value: "Meena" } });
    fireEvent.click(chip("Maths"));
    fireEvent.click(next());
    expect(await screen.findByText("Connect to the internet to save your details.")).toBeTruthy();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
  });

  it("sends a second try through when the first failed", async () => {
    show();
    saveProfile.mockResolvedValueOnce({ ok: false, reason: "failed" });
    saveProfile.mockResolvedValue(saved());
    fireEvent.change(nameBox(), { target: { value: "Meena" } });
    fireEvent.click(chip("Maths"));
    fireEvent.click(next());
    await screen.findByRole("alert");
    fireEvent.click(next());
    await waitFor(() => expect(push).toHaveBeenCalledWith("/en/setup/upi/"));
  });
});

describe("a missing row (criterion 26)", () => {
  it("says to sign out and in again, offers Sign out, does not loop, and does not move on", async () => {
    show();
    saveProfile.mockResolvedValue({ ok: false, reason: "missing" });
    signOut.mockResolvedValue(undefined);
    fireEvent.change(nameBox(), { target: { value: "Meena" } });
    fireEvent.click(chip("Maths"));
    fireEvent.click(next());
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("We could not find your profile. Sign out, then sign in again.Sign out");
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/en/sign-in/"));
    expect(saveProfile).toHaveBeenCalledTimes(1);
  });
});

describe("a tutor who comes back to edit (criterion 31)", () => {
  it("sees the saved name and subjects, typed ones included", () => {
    held.tutor = { ...newTutor, name: "Meena Iyer", subjects: ["maths", "Sanskrit"] };
    show();
    expect(nameBox().value).toBe("Meena Iyer");
    expect(chip("Maths").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Science").getAttribute("aria-pressed")).toBe("false");
    expect(chip("Sanskrit").getAttribute("aria-pressed")).toBe("true");
  });
});
