// Spec R1-3, criteria 16 to 30 and 33 to 35: the student form with the real English words.
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Roster } from "@/components/app/roster";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push }), usePathname: () => "/en/students/new/" }));
const held: { roster: Roster } = { roster: undefined as unknown as Roster };
vi.mock("@/components/app/roster", () => ({ useRoster: () => held.roster }));
const createStudent = vi.fn();
const updateStudent = vi.fn();
vi.mock("@/lib/students", () => ({ createStudent: (...a: unknown[]) => createStudent(...a), updateStudent: (...a: unknown[]) => updateStudent(...a) }));

import { StudentForm } from "./student-form";

const put = vi.fn();
const reload = vi.fn();
const saved: Student = {
  id: "s1", batchId: null, name: "Ravi Kumar", parentName: "Suresh", parentPhone: "+919845012345",
  parentLanguage: "kn", monthlyFee: 120000, openingBalance: 0, dueDay: 5, active: true,
};
const roster = (students: Student[] = [], batches = [{ id: "b1", name: "Class 10 Maths", timings: null }]) => {
  held.roster = { status: "ready", students, batches, stale: false, reload, put, putBatch: vi.fn(), removeBatch: vi.fn() };
};
const field = (name: RegExp | string) => screen.getByLabelText(name) as HTMLTextAreaElement;
const fill = async (label: RegExp | string, text: string) => userEvent.type(field(label), text);

beforeEach(() => {
  [push, put, reload, createStudent, updateStudent].forEach((m) => m.mockReset());
  roster();
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
});
afterEach(cleanup);

describe("groups and hints (UX-review-fixes, item 5)", () => {
  it("has Who, Fee and Opening balance groups in order, each with a legend", () => {
    renderWithWords(<StudentForm mode="add" />);
    const groups = Array.from(document.querySelectorAll("form > fieldset"));
    expect(groups.map((g) => g.querySelector(":scope > legend")?.textContent)).toEqual(["Who", "Fee", "Opening balance"]);
    expect(groups[0].contains(field("Student's name"))).toBe(true);
    expect(groups[0].contains(screen.getByRole("checkbox"))).toBe(true);
    expect(groups[0].contains(screen.getByLabelText("Batch"))).toBe(true);
    expect(groups[1].contains(field("Monthly fee ₹"))).toBe(true);
    expect(groups[1].contains(screen.getByLabelText("Fee due on"))).toBe(true);
    expect(groups[2].contains(field("Already owes ₹"))).toBe(true);
  });

  it("describes Already owes and the permission tick with their hints", () => {
    renderWithWords(<StudentForm mode="add" />);
    expect(field("Already owes ₹").getAttribute("aria-describedby")).toBeTruthy();
    expect(field("Already owes ₹").getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)?.textContent).join(" ")).toContain("What they owed before you started");
    const tick = screen.getByRole("checkbox");
    expect(tick.getAttribute("aria-describedby")!.split(" ").map((id) => document.getElementById(id)?.textContent).join(" ")).toContain("Tick once you have the parent's OK");
  });
});

describe("add (16, 17, 24 to 28)", () => {
  it("has the fields in order with the defaults", () => {
    renderWithWords(<StudentForm mode="add" />, "hi");
    const labels = Array.from(document.querySelectorAll("label, legend")).map((l) => l.textContent?.trim()).filter((l) => l !== "Who");
    expect(labels.slice(0, 4)).toEqual(["Student's name", "Parent's name", "Parent's WhatsApp number", "Send messages in"]);
    expect((screen.getByLabelText("Batch") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Fee due on") as HTMLSelectElement).value).toBe("1");
    expect((screen.getAllByRole("radio").find((r) => (r as HTMLInputElement).checked) as HTMLInputElement).value).toBe("hi");
    expect(screen.getByRole("button", { name: "Save student" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save and add another" })).toBeTruthy();
  });

  it("starts in the batch named by the address", () => {
    renderWithWords(<StudentForm mode="add" initialBatchId="b1" />);
    expect((screen.getByLabelText("Batch") as HTMLSelectElement).value).toBe("b1");
  });

  it("shows every error at once and sends nothing", async () => {
    renderWithWords(<StudentForm mode="add" />);
    await fill(/Parent's WhatsApp/, "98860");
    await userEvent.click(screen.getByRole("button", { name: "Save student" }));
    expect(screen.getByText("Type the student's name.")).toBeTruthy();
    expect(screen.getByText("An Indian mobile number has 10 digits. You typed 5.")).toBeTruthy();
    expect(screen.getByText("Type the monthly fee in rupees.")).toBeTruthy();
    expect(createStudent).not.toHaveBeenCalled();
  });

  it("asks for the tick when a phone is typed, and sends the clean row with paise", async () => {
    createStudent.mockResolvedValue({ ok: true, student: saved });
    renderWithWords(<StudentForm mode="add" />);
    await fill("Student's name", "  Ravi   Kumar ");
    await fill(/Parent's WhatsApp/, "098450 12345");
    await fill(/Monthly fee/, "1,200");
    await userEvent.click(screen.getByRole("button", { name: "Save student" }));
    expect(screen.getByText("Tick this to save the number.")).toBeTruthy();
    expect(createStudent).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Save student" }));
    await waitFor(() => expect(createStudent).toHaveBeenCalled());
    const [id, fields] = createStudent.mock.calls[0];
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fields).toMatchObject({ name: "Ravi Kumar", parentName: null, parentPhone: "+919845012345", monthlyFee: 120000, openingBalance: 0, dueDay: 1, batchId: null });
    expect(put).toHaveBeenCalledWith(saved);
    expect(push).toHaveBeenCalledWith("/en/students/");
  });

  it("tidies the phone and the fee when the field is left", async () => {
    renderWithWords(<StudentForm mode="add" />);
    await fill(/Parent's WhatsApp/, "+91 98860-44321");
    await fill(/Monthly fee/, "100000");
    await userEvent.tab();
    await userEvent.click(screen.getByLabelText("Already owes ₹"));
    expect(field(/Parent's WhatsApp/).value).toBe("98860 44321");
    expect(field(/Monthly fee/).value).toBe("1,00,000");
  });

  it("notes a number another student already has, without blocking", async () => {
    roster([saved]);
    renderWithWords(<StudentForm mode="add" />);
    await fill(/Parent's WhatsApp/, "98450 12345");
    expect(screen.getByText("This number is already saved for Ravi Kumar. Siblings can share a number.")).toBeTruthy();
  });

  it("save and add another keeps batch, day, language and fee, clears the rest and says what it saved", async () => {
    createStudent.mockResolvedValue({ ok: true, student: saved });
    const onSaved = vi.fn();
    renderWithWords(<StudentForm mode="add" initialBatchId="b1" onSaved={onSaved} />);
    await fill("Student's name", "Ravi");
    await fill(/Monthly fee/, "1200");
    await userEvent.click(screen.getByRole("button", { name: "Save and add another" }));
    // UX-review-fixes-2, 6.1, 6.2 and 12.3: the words go up to the screen's foot toast, cleared when a save starts,
    // and say what was kept. Nothing is drawn in the form's flow.
    await waitFor(() => expect(onSaved).toHaveBeenLastCalledWith("Saved Ravi Kumar. Batch, fee, due day and language kept for the next one."));
    expect(onSaved.mock.calls[0]).toEqual([null]);
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.activeElement).toBe(field("Student's name"));
    expect(field("Student's name").value).toBe("");
    expect(field(/Monthly fee/).value).toBe("1,200");
    expect((screen.getByLabelText("Batch") as HTMLSelectElement).value).toBe("b1");
    expect(push).not.toHaveBeenCalled();
    await fill("Student's name", "Asha");
    await userEvent.click(screen.getByRole("button", { name: "Save and add another" }));
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(2));
    expect(createStudent.mock.calls[0][0]).not.toBe(createStudent.mock.calls[1][0]);
  });

  it("sends one request for two taps, and the same id for a retry", async () => {
    let finish: (v: unknown) => void = () => {};
    createStudent.mockReturnValueOnce(new Promise((r) => (finish = r))).mockResolvedValueOnce({ ok: true, student: saved });
    renderWithWords(<StudentForm mode="add" />);
    await fill("Student's name", "Ravi");
    await fill(/Monthly fee/, "1200");
    const save = screen.getByRole("button", { name: "Save student" });
    await userEvent.click(save);
    await userEvent.click(save);
    expect(createStudent).toHaveBeenCalledTimes(1);
    finish({ ok: false, reason: "failed" });
    expect(await screen.findByText(/Nothing was saved/)).toBeTruthy();
    expect(field("Student's name").value).toBe("Ravi");
    await userEvent.click(screen.getByRole("button", { name: "Save student" }));
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(2));
    expect(createStudent.mock.calls[0][0]).toBe(createStudent.mock.calls[1][0]);
  });

  it("says offline and batch gone in their own words", async () => {
    createStudent.mockResolvedValueOnce({ ok: false, reason: "offline" }).mockResolvedValueOnce({ ok: false, reason: "batch-gone" });
    renderWithWords(<StudentForm mode="add" />);
    await fill("Student's name", "Ravi");
    await fill(/Monthly fee/, "1200");
    await userEvent.click(screen.getByRole("button", { name: "Save student" }));
    expect(await screen.findByText("You are offline. Connect to the internet to save.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Save student" }));
    expect(await screen.findByText("That batch no longer exists. Pick another batch or No batch.")).toBeTruthy();
    expect(reload).toHaveBeenCalled();
  });
});

describe("edit (33 to 35)", () => {
  it("shows the saved values, the next-month line, and no add-another button", () => {
    renderWithWords(<StudentForm mode="edit" student={saved} />);
    expect(field("Student's name").value).toBe("Ravi Kumar");
    expect(field(/Parent's WhatsApp/).value).toBe("98450 12345");
    expect(field(/Monthly fee/).value).toBe("1,200");
    expect(field("Already owes ₹").value).toBe("");
    expect(screen.getByText("A new fee applies from the next month.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Save and add another" })).toBeNull();
  });

  it("sends nothing when nothing changed, and only the changed fields otherwise, without asking for the tick again", async () => {
    updateStudent.mockResolvedValue({ ok: true, student: { ...saved, monthlyFee: 150000 } });
    renderWithWords(<StudentForm mode="edit" student={saved} />);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(updateStudent).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/en/students/");
    push.mockReset();
    await userEvent.clear(field(/Monthly fee/));
    await userEvent.type(field(/Monthly fee/), "1500");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateStudent).toHaveBeenCalledWith("s1", { monthlyFee: 150000 }));
    expect(push).toHaveBeenCalledWith("/en/students/");
  });

  it("does not call the student's own number a duplicate, and says missing for an update that found no row", async () => {
    updateStudent.mockResolvedValue({ ok: false, reason: "missing" });
    roster([saved]);
    renderWithWords(<StudentForm mode="edit" student={saved} />);
    expect(screen.queryByText(/already saved/)).toBeNull();
    await userEvent.type(field("Student's name"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Couldn't find this student")).toBeTruthy();
  });
});

describe("Already owes once a payment has been recorded (R1-7, criterion 20)", () => {
  it("is read-only with the line, and Save sends nothing for it", async () => {
    updateStudent.mockResolvedValue({ ok: true, student: saved });
    renderWithWords(<StudentForm mode="edit" student={{ ...saved, openingBalance: 100000 }} owesLocked />);
    const owes = screen.getByLabelText("Already owes ₹") as HTMLTextAreaElement;
    expect(owes.readOnly).toBe(true);
    expect(owes.value).toBe("1,000");
    expect(screen.getByText("A payment has been recorded against this, so it can't be changed")).toBeTruthy();
    await userEvent.type(owes, "55");
    expect(owes.value).toBe("1,000");
  });

  it("is editable, with no line, when nothing has been paid against it", () => {
    renderWithWords(<StudentForm mode="edit" student={{ ...saved, openingBalance: 100000 }} />);
    expect((screen.getByLabelText("Already owes ₹") as HTMLTextAreaElement).readOnly).toBe(false);
    expect(screen.queryByText(/A payment has been recorded/)).toBeNull();
  });
});

describe("UX-review-fixes-2, item 7: the permission tick on edit", () => {
  const tick = () => screen.getByRole("checkbox", { name: /permission/ }) as HTMLInputElement;
  const warning = /Saving will remove it/;

  it("7.1: starts ticked for a saved number, unticked for none", () => {
    renderWithWords(<StudentForm mode="edit" student={saved} />);
    expect(tick().checked).toBe(true);
    cleanup();
    renderWithWords(<StudentForm mode="edit" student={{ ...saved, parentPhone: null }} />);
    expect(tick().checked).toBe(false);
  });

  it("7.1: with no saved number the tick is not required unless a number is typed", async () => {
    updateStudent.mockResolvedValue({ ok: true, student: saved });
    renderWithWords(<StudentForm mode="edit" student={{ ...saved, parentPhone: null }} />);
    await userEvent.type(field("Student's name"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateStudent).toHaveBeenCalledTimes(1));
  });

  it("7.2: changing the number unticks it and asks for the tick again before Save", async () => {
    renderWithWords(<StudentForm mode="edit" student={saved} />);
    const phone = field("Parent's WhatsApp number");
    await userEvent.clear(phone);
    await userEvent.type(phone, "9886044321");
    expect(tick().checked).toBe(false);
    expect(screen.queryByText(warning)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(updateStudent).not.toHaveBeenCalled();
    expect(tick().getAttribute("aria-invalid")).toBe("true");
  });

  it("7.3: unticking the saved number warns under the tick, and Save sends the number as empty", async () => {
    updateStudent.mockResolvedValue({ ok: true, student: { ...saved, parentPhone: null } });
    renderWithWords(<StudentForm mode="edit" student={saved} />);
    await userEvent.click(tick());
    const note = screen.getByText(warning);
    expect(tick().getAttribute("aria-describedby")).toContain(note.id);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateStudent).toHaveBeenCalledWith("s1", { parentPhone: null }));
  });

  it("7.3: ticking again before Save removes the warning and keeps the number", async () => {
    renderWithWords(<StudentForm mode="edit" student={saved} />);
    await userEvent.click(tick());
    await userEvent.click(tick());
    expect(screen.queryByText(warning)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    // Nothing changed: no update at all.
    expect(updateStudent).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalled();
  });
});

describe("UX-review-fixes-2, item 12 and A.2: the add form", () => {
  it("12.1 and 12.2: +91 is a fixed prefix read with the field; digits group as they are typed; saved as E.164", async () => {
    createStudent.mockResolvedValue({ ok: true, student: saved });
    renderWithWords(<StudentForm mode="add" />);
    const phone = field("Parent's WhatsApp number");
    const prefix = screen.getByText("+91");
    expect(phone.getAttribute("aria-describedby")?.split(" ")[0]).toBe(prefix.id);
    await userEvent.type(phone, "9876543210");
    expect(phone.value).toBe("98765 43210");
    expect(phone.selectionStart).toBe(11);
    await fill("Student's name", "Ravi");
    await fill(/Monthly fee/, "1200");
    await userEvent.click(screen.getByRole("checkbox", { name: /permission/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save student" }));
    await waitFor(() => expect(createStudent).toHaveBeenCalledTimes(1));
    expect(createStudent.mock.calls[0][1].parentPhone).toBe("+919876543210");
  });

  it("12.2: a pasted number with +91 and a dash ends grouped", async () => {
    renderWithWords(<StudentForm mode="add" />);
    const phone = field("Parent's WhatsApp number");
    await userEvent.click(phone);
    await userEvent.paste("+91 98765-43210");
    expect(phone.value).toBe("98765 43210");
  });

  it("12.4: the three section headings are headline words in ink, stronger than the labels, 32px apart", () => {
    const { container } = renderWithWords(<StudentForm mode="add" />);
    const legends = Array.from(container.querySelectorAll("form > fieldset > legend"));
    expect(legends.map((l) => l.textContent)).toEqual(["Who", "Fee", "Opening balance"]);
    for (const l of legends) expect(l.className.split(" ")).toEqual(expect.arrayContaining(["type-headline", "text-2xl", "text-ink"]));
    expect(container.querySelector("form")!.className.split(" ")).toContain("gap-8");
  });

  it("A.2: each message language is read with its own name and its name in the page's language", () => {
    renderWithWords(<StudentForm mode="add" />);
    expect(screen.getByRole("radio", { name: "ಕನ್ನಡ, Kannada" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "हिन्दी, Hindi" })).toBeTruthy();
    // The page's own language is not said twice.
    expect(screen.getByRole("radio", { name: "English" })).toBeTruthy();
    // The extra name is screen-reader text only; the drawn name is not read twice.
    const extra = screen.getByText((_, el) => el?.className === "sr-only" && el.textContent === "ಕನ್ನಡ, Kannada");
    expect(extra).toBeTruthy();
    expect(screen.getAllByText("ಕನ್ನಡ").some((el) => el.getAttribute("aria-hidden") === "true")).toBe(true);
  });
});
