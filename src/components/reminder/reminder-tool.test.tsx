// The fee reminder island (spec R0-2), rendered in jsdom with the real English words.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/config/locales";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";
import { ReminderTool } from "./reminder-tool";

const words = en.reminderForm;
const LINK = "upi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee";
const POLITE =
  "Hello Suresh ji, a gentle reminder that the tuition fee of ₹1,200 for October is due. You can pay by UPI with this link:\n" +
  `${LINK}\nOr pay to UPI ID: meena.tuitions@okhdfc\nThank you!`;

function setClipboard(clipboard: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
}

beforeEach(() => {
  // 10 October 2026 on the phone's clock. Only the date is faked, so typing and waiting work as usual.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 10, 12, 0));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  setClipboard(undefined);
});

const show = (pageLocale: Locale = "en", w = words) => render(<ReminderTool words={w} pageLocale={pageLocale} />);
// By test id, not by label: a field's label gains its state word ("Your UPI ID · Check this") as the tutor types.
const field = (name: string) => screen.getByTestId(`reminder-${name}`) as HTMLTextAreaElement;
const parent = () => field("parent");
const amount = () => field("amount");
const upi = () => field("upi");
const payee = () => field("payee");
const preview = () => screen.getByTestId("reminder-preview");
const send = () => screen.getByTestId("reminder-send");
const copyButton = () => screen.getByTestId("reminder-copy");
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
/** The whole field: label, line and the note beneath. */
const block = (el: HTMLElement) => el.closest("[data-state]") as HTMLElement;

function fillAll() {
  type(parent(), "Suresh");
  type(amount(), "1200");
  type(upi(), "meena.tuitions@okhdfc");
  type(payee(), "Meena Rao");
}

describe("the form at the start (criteria 9, 10, 11, 13, 20)", () => {
  it("has the seven inputs in the spec's order, then the remember switch", () => {
    show();
    const form = screen.getByTestId("reminder-form");
    const labels = [...form.querySelectorAll("legend, label[for]")].map((el) => el.textContent);
    expect(labels).toEqual([
      "Message language",
      "Tone",
      "Parent's name",
      "Month",
      "Amount in ₹",
      "Your UPI ID",
      "Your name",
      "Remember my UPI ID and name on this phone",
    ]);
  });

  it("starts every text field empty, with an example only as a placeholder", () => {
    show();
    expect([parent(), amount(), upi(), payee()].map((el) => el.value)).toEqual(["", "", "", ""]);
    expect([parent(), amount(), upi(), payee()].map((el) => el.placeholder)).toEqual(["Suresh", "1,200", "name@bank", "Meena Rao"]);
  });

  it("offers the four languages by their own names, each with its lang, and starts on the page's language", () => {
    show("kn");
    const group = screen.getByRole("group", { name: "Message language" });
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(["en", "hi", "kn", "te"]);
    expect(radios.map((r) => r.checked)).toEqual([false, false, true, false]);
    const names = [...group.querySelectorAll("span[lang]")];
    expect(names.map((el) => [el.getAttribute("lang"), el.textContent])).toEqual([
      ["en", "English"],
      ["hi", "हिन्दी"],
      ["kn", "ಕನ್ನಡ"],
      ["te", "తెలుగు"],
    ]);
    // Set in the Latin stack, so the English page asks for no Anek file.
    for (const el of names) expect(el.className).toContain("type-endonym");
    expect(preview().getAttribute("lang")).toBe("kn");
  });

  it.each(["en", "hi", "kn", "te"] as const)("on the %s page the amount and the UPI ID are typed in the Latin face; the two names follow the page's script (R0-2 fix)", (locale) => {
    show(locale);
    const roles = (el: HTMLElement) => el.className.split(/\s+/).filter((name) => name.startsWith("type-"));
    const copyOf = (el: HTMLElement) => el.parentElement!.querySelector("[data-field-mirror]") as HTMLElement;
    for (const el of [amount(), upi()]) {
      expect(roles(el)).toEqual(["type-value-latin"]);
      expect(roles(copyOf(el))).toEqual(["type-value-latin"]);
    }
    // A parent's name typed in Devanagari, Kannada or Telugu must be drawn in that script's own face.
    for (const el of [parent(), payee()]) {
      expect(roles(el)).toEqual(["type-value"]);
      expect(roles(copyOf(el))).toEqual(["type-value"]);
    }
  });

  it("starts on Polite, with labels only", () => {
    show();
    const group = screen.getByRole("group", { name: "Tone" });
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map((r) => [r.value, r.checked])).toEqual([
      ["polite", true],
      ["firm", false],
    ]);
    expect([...group.querySelectorAll("label")].map((l) => l.textContent)).toEqual(["Polite", "Firm"]);
  });

  it("sets the month to the phone's clock and lists the twelve months in the page's language, with no year", () => {
    show("hi", hi.reminderForm);
    const select = screen.getByTestId("reminder-month") as HTMLSelectElement;
    expect(select.value).toBe("9");
    expect(Array.from(select.options).map((o) => o.text)).toEqual([
      "जनवरी", "फ़रवरी", "मार्च", "अप्रैल", "मई", "जून", "जुलाई", "अगस्त", "सितंबर", "अक्टूबर", "नवंबर", "दिसंबर",
    ]);
    expect(select.textContent).not.toMatch(/20\d\d/);
  });

  it("gives every input a visible label, and turns off autocomplete and text help where the spec says", () => {
    show();
    for (const el of [parent(), amount(), upi(), payee()]) expect(el.labels?.length).toBe(1);
    expect(screen.getByLabelText("Parent's name")).toBe(parent());
    expect(screen.getByLabelText("Amount in ₹")).toBe(amount());
    expect(screen.getByLabelText("Your UPI ID")).toBe(upi());
    expect(screen.getByLabelText("Your name")).toBe(payee());
    expect((screen.getByLabelText("Month") as HTMLSelectElement).tagName).toBe("SELECT");
    for (const el of [parent(), upi(), payee()]) expect(el.getAttribute("autocomplete")).toBe("off");
    expect(amount().getAttribute("inputmode")).toBe("numeric");
    expect(upi().getAttribute("autocapitalize")).toBe("none");
    expect(upi().getAttribute("autocorrect")).toBe("off");
    expect(upi().getAttribute("spellcheck")).toBe("false");
    expect(payee().getAttribute("aria-describedby")).toBeTruthy();
    expect(block(payee()).textContent).toContain("This goes in the payment link.");
  });

  it("has no form element and no control whose name could carry typed text (criterion 48)", () => {
    const { container } = show();
    expect(container.querySelectorAll("form")).toHaveLength(0);
    expect([...container.querySelectorAll("[name]")].map((el) => el.getAttribute("name")).sort()).toEqual(
      ["message-language", "message-language", "message-language", "message-language", "tone", "tone"].sort(),
    );
  });

  it("marks typed values off limits to recorders (criterion 49)", () => {
    show();
    for (const el of [screen.getByTestId("reminder-tool"), parent(), amount(), upi(), payee(), screen.getByTestId("reminder-month"), preview()]) {
      expect(el.hasAttribute("data-ph-no-capture")).toBe(true);
      expect(el.hasAttribute("data-sentry-mask")).toBe(true);
    }
  });
});

describe("errors (criteria 12, 14, 16, 18, 19)", () => {
  it("shows no error on a field nobody has touched", () => {
    show();
    for (const el of [parent(), amount(), upi(), payee()]) {
      expect(block(el).getAttribute("data-state")).toBe("idle");
      expect(el.hasAttribute("aria-invalid")).toBe(false);
    }
  });

  it("shows no error while typing, shows it when the field is left, and drops it as soon as the value is valid", () => {
    show();
    type(amount(), "12a");
    expect(block(amount()).getAttribute("data-state")).toBe("idle");
    fireEvent.blur(amount());
    expect(block(amount()).getAttribute("data-state")).toBe("error");
    expect(amount().getAttribute("aria-invalid")).toBe("true");
    type(amount(), "12");
    expect(block(amount()).getAttribute("data-state")).toBe("idle");
    expect(amount().hasAttribute("aria-invalid")).toBe(false);
  });

  const cases: [string, () => HTMLTextAreaElement, string, string, string][] = [
    ["parent empty", parent, "", "Missing", "Type the parent's name."],
    ["parent only spaces", parent, "   ", "Missing", "Type the parent's name."],
    ["parent over 40", parent, "a".repeat(41), "Too long", "Use 40 characters or fewer."],
    ["amount empty", amount, "", "Missing", "Type the fee in rupees."],
    ["amount with paise", amount, "1200.50", "Check this", "Whole rupees only. Leave out the paise."],
    ["amount not digits", amount, "Rs 1200", "Check this", "Use digits only, for example 1200."],
    ["amount zero", amount, "0", "Too low", "The amount must be at least ₹1."],
    ["amount too high", amount, "100001", "Too high", "This tool allows up to ₹1,00,000."],
    ["UPI empty", upi, "", "Missing", "Type your UPI ID, for example name@bank."],
    ["UPI with a space", upi, "meena tuitions@okhdfc", "Check this", "Remove the spaces."],
    ["UPI with no @", upi, "meena.tuitions", "Check this", "A UPI ID has an @ in it, for example name@bank."],
    ["UPI malformed", upi, "meena@ok1", "Check this", "This does not look like a UPI ID. Copy it from your UPI app."],
    ["your name empty", payee, "", "Missing", "Type your name."],
    ["your name over 40", payee, "క".repeat(41), "Too long", "Use 40 characters or fewer."],
  ];

  it.each(cases)("%s: the state word beside the label, the error mark, and how to fix it", (_name, get, value, word, fix) => {
    show();
    const el = get();
    if (value !== "") type(el, value);
    fireEvent.blur(el);
    const box = block(el);
    expect(box.getAttribute("data-state")).toBe("error");
    // Never colour alone: a word in the label, a drawn mark, and a sentence tied to the control.
    expect(box.querySelector("label")!.textContent).toContain(word);
    expect(box.querySelector("svg")).not.toBeNull();
    const note = document.getElementById(el.getAttribute("aria-describedby")!.split(" ").pop()!);
    expect(note?.textContent).toBe(fix);
  });
});

describe("the UPI ID (criterion 17)", () => {
  it("shows the correct state, with words that promise no more than the shape", () => {
    show();
    type(upi(), "meena.tuitions@okhdfc");
    const box = block(upi());
    expect(box.getAttribute("data-state")).toBe("correct");
    expect(box.querySelector("label")!.textContent).toContain("Format looks right");
    expect(box.querySelector("svg")).not.toBeNull();
    expect(box.textContent).toContain("Format looks right. We cannot check this with your bank. Read it once more: the money goes to this ID.");
    expect(document.body.textContent).not.toMatch(/verified/i);
  });

  it("keeps the letter case as typed, in the field and in the link", () => {
    show();
    fillAll();
    type(upi(), "Meena.Rao@OkHDFC");
    expect(upi().value).toBe("Meena.Rao@OkHDFC");
    expect(preview().textContent).toContain("upi://pay?pa=Meena.Rao@OkHDFC&pn=");
    expect(preview().textContent).toContain("Or pay to UPI ID: Meena.Rao@OkHDFC");
  });
});

describe("the amount (criteria 14, 15, 24)", () => {
  it("is not regrouped while typing, and is regrouped with 0-9 digits when the field is left", () => {
    show();
    type(amount(), "1200");
    expect(amount().value).toBe("1200");
    fireEvent.blur(amount());
    expect(amount().value).toBe("1,200");
    type(amount(), "१,००,०००");
    expect(amount().value).toBe("१,००,०००");
    fireEvent.blur(amount());
    expect(amount().value).toBe("1,00,000");
  });

  it("leaves a wrong value as typed when the field is left", () => {
    show();
    type(amount(), "1200.50");
    fireEvent.blur(amount());
    expect(amount().value).toBe("1200.50");
  });

  it("reaches the message as rupees with Indian grouping, read from any of the three scripts' digits", () => {
    show();
    fillAll();
    type(amount(), "౧౨౦౦");
    expect(preview().textContent).toContain("₹1,200");
    expect(preview().textContent).toContain("&am=1200.00&");
  });
});

describe("the preview (criteria 34, 39, 40)", () => {
  it("draws a named blank for each missing value, and says what to do, until the message is whole", () => {
    show();
    const blanks = () => [...preview().querySelectorAll('[role="img"]')];
    // The month is known from the clock; the other four places are blank.
    expect(blanks().map((el) => el.getAttribute("data-blank"))).toEqual(["parent", "amount", "link", "upiId"]);
    for (const el of blanks()) {
      expect(el.getAttribute("aria-label")).toBe("blank");
      expect(el.className).toContain("border-dashed");
    }
    expect(screen.getByTestId("reminder-incomplete").textContent).toBe("Fill in the fields above to finish the message.");
    expect(preview().textContent).toContain("for October is due.");

    fillAll();
    expect(blanks()).toHaveLength(0);
    expect(screen.queryByTestId("reminder-incomplete")).toBeNull();
    expect(preview().textContent).toBe(POLITE);
  });

  it("goes back to a blank when a value stops being valid", () => {
    show();
    fillAll();
    type(upi(), "meena tuitions@okhdfc");
    expect([...preview().querySelectorAll('[role="img"]')].map((el) => el.getAttribute("data-blank"))).toEqual(["link", "upiId"]);
    expect(screen.getByTestId("reminder-incomplete")).toBeTruthy();
  });

  it("shows the link and the UPI ID as mono text, never as something to tap", () => {
    show();
    fillAll();
    expect(preview().querySelectorAll("a")).toHaveLength(0);
    expect(document.querySelectorAll('a[href^="upi:"]')).toHaveLength(0);
    const link = preview().querySelector('[data-slot="link"]')!;
    expect(link.textContent).toBe(LINK);
    expect(link.className).toContain("type-amount-row");
    expect(preview().querySelector('[data-slot="upiId"]')!.textContent).toBe("meena.tuitions@okhdfc");
  });

  it("is a bubble that keeps its line breaks, wraps anywhere, can be selected and is not machine-translated", () => {
    show();
    const classes = preview().className.split(/\s+/);
    for (const name of ["type-message", "bg-bubble", "rounded-bubble", "rounded-tl-sm", "border-2", "whitespace-pre-wrap", "wrap-anywhere", "select-text"]) {
      expect(classes, name).toContain(name);
    }
    expect(preview().getAttribute("translate")).toBe("no");
    expect(screen.getByRole("heading", { level: 2, name: "Your message" })).toBeTruthy();
  });

  it("changes with the language, the tone and the month, and carries the message language's lang", async () => {
    show();
    fillAll();
    await userEvent.click(screen.getByTestId("reminder-language-hi"));
    expect(preview().getAttribute("lang")).toBe("hi");
    expect(preview().textContent).toContain("नमस्ते Suresh जी, यह याद दिलाना था कि अक्टूबर की ट्यूशन फ़ीस ₹1,200 बाकी है।");
    // The note in the link stays English in every message language.
    expect(preview().textContent).toContain("&tn=October%20fee");

    await userEvent.click(screen.getByTestId("reminder-tone-firm"));
    expect(preview().textContent).toContain("अभी तक बाकी है। कृपया आज ही");

    await userEvent.selectOptions(screen.getByTestId("reminder-month"), "2");
    expect(preview().textContent).toContain("मार्च की ट्यूशन फ़ीस");
    expect(preview().textContent).toContain("&tn=March%20fee");
    expect(preview().textContent).not.toMatch(/20\d\d/);

    // The page's own words did not change.
    expect(screen.getByRole("group", { name: "Message language" })).toBeTruthy();
    expect(Array.from((screen.getByTestId("reminder-month") as HTMLSelectElement).options)[2].text).toBe("March");
  });

  it("uses cleaned names: outer spaces go, inner runs become one", () => {
    show();
    fillAll();
    type(parent(), "  Suresh   Kumar ");
    expect(preview().textContent).toContain("Hello Suresh Kumar ji,");
  });
});

describe("Send and Copy (criteria 35 to 37, 41 to 45)", () => {
  it("are both unavailable, with one shared reason and no address on Send, until the four fields are valid", () => {
    show();
    expect(send().hasAttribute("href")).toBe(false);
    expect(send().getAttribute("aria-disabled")).toBe("true");
    expect((copyButton() as HTMLButtonElement).disabled).toBe(true);
    for (const el of [send(), copyButton()]) {
      expect(el.className).toContain("border-dashed");
      expect(el.className).not.toMatch(/shadow-button/);
    }
    const reasons = screen.getAllByText("Fill in the fields above first.");
    expect(reasons).toHaveLength(1);
    expect(send().getAttribute("aria-describedby")).toBe(reasons[0].id);
    expect(copyButton().getAttribute("aria-describedby")).toBe(reasons[0].id);

    type(parent(), "Suresh");
    type(amount(), "1200");
    type(upi(), "meena.tuitions@okhdfc");
    expect(send().hasAttribute("href")).toBe(false);
    type(payee(), "Meena Rao");
    expect(send().hasAttribute("href")).toBe(true);
    expect((copyButton() as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText("Fill in the fields above first.")).toBeNull();
  });

  it("Send is a blue link to wa.me with no number, in a new tab, whose text is exactly the preview", () => {
    show();
    fillAll();
    const href = send().getAttribute("href")!;
    expect(send().tagName).toBe("A");
    expect(href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(href.slice("https://wa.me/?text=".length))).toBe(preview().textContent);
    expect(href).toContain("pn%3DMeena%2520Rao");
    expect(send().getAttribute("target")).toBe("_blank");
    expect(send().getAttribute("rel")).toBe("noopener noreferrer");
    expect(send().className).toContain("bg-blue");
    expect(send().className).toContain("min-h-14");
    expect(send().className).toContain("w-full");
    expect(send().textContent).toBe("Send on WhatsApp");
    expect(send().querySelector("svg")).not.toBeNull();
  });

  it("Copy is the outline button, and nothing that can be pressed is red", () => {
    const { container } = show();
    fillAll();
    expect(copyButton().className).toContain("bg-slip");
    expect(copyButton().className).toContain("w-full");
    for (const el of container.querySelectorAll("a, button")) expect(el.className).not.toMatch(/bg-cloth/);
  });

  it("has an empty status region from the first render", () => {
    show();
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");
  });

  it("Copy puts exactly the preview on the clipboard, says Copied with a tick for about 3 seconds, and announces it", async () => {
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0));
    const writeText = vi.fn(async (text: string) => void text);
    setClipboard({ writeText });
    show();
    fillAll();
    await act(async () => {
      fireEvent.click(copyButton());
    });
    expect(writeText).toHaveBeenCalledWith(POLITE);
    expect(writeText.mock.calls[0][0]).toBe(preview().textContent);
    expect(copyButton().textContent).toBe("Copied");
    expect(copyButton().querySelector("svg")).not.toBeNull();
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Message copied.");
    expect(status.querySelector("svg")).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(2900);
    });
    expect(copyButton().textContent).toBe("Copied");
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(copyButton().textContent).toBe("Copy message");
    expect(status.textContent).toBe("");
    // The fields keep their values for the next parent, and nothing claims the message was sent.
    expect([parent().value, amount().value, upi().value, payee().value]).toEqual(["Suresh", "1200", "meena.tuitions@okhdfc", "Meena Rao"]);
    expect(document.body.textContent).not.toMatch(/\bSent\b/);
  });

  it("stops saying Copied when the message changes", async () => {
    setClipboard({ writeText: async () => {} });
    show();
    fillAll();
    await act(async () => {
      fireEvent.click(copyButton());
    });
    expect(copyButton().textContent).toBe("Copied");
    type(parent(), "Asha");
    expect(copyButton().textContent).toBe("Copy message");
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("when copying fails, says so with the error mark, tells the tutor what to do, and breaks nothing", async () => {
    setClipboard({ writeText: async () => Promise.reject(new Error("blocked")) });
    Object.defineProperty(document, "execCommand", { configurable: true, writable: true, value: () => false });
    show();
    fillAll();
    await act(async () => {
      fireEvent.click(copyButton());
    });
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("Could not copy. Press and hold the message to select it.");
    expect(status.querySelector("svg")).not.toBeNull();
    expect(status.className).toContain("text-cloth");
    expect(copyButton().textContent).toBe("Copy message");
    expect(send().hasAttribute("href")).toBe(true);
    expect(preview().textContent).toBe(POLITE);
    Object.defineProperty(document, "execCommand", { configurable: true, writable: true, value: undefined });
  });
});

describe("remember on this phone (criteria 51 to 54)", () => {
  const KEY = "reminder-payee";
  const stored = () => localStorage.getItem(KEY);
  const toggle = () => screen.getByTestId("reminder-remember");
  const keep = (value: unknown) => localStorage.setItem(KEY, JSON.stringify(value));

  it("is a switch under Your name, named by its visible words, off at the start, with the line that says how to forget", () => {
    show();
    const control = screen.getByRole("switch", { name: "Remember my UPI ID and name on this phone" });
    expect(control).toBe(toggle());
    expect(control.getAttribute("aria-checked")).toBe("false");
    expect(control.textContent).toContain("OFF");
    const row = screen.getByTestId("reminder-remember-row");
    expect(row.textContent).toContain("Turn this off to forget them.");
    // Tapping the words works too: they are a label for the switch.
    expect(row.querySelector("label")!.getAttribute("for")).toBe(control.id);
    const order = [...screen.getByTestId("reminder-form").querySelectorAll("textarea, [role=switch]")].map((el) => el.getAttribute("data-testid"));
    expect(order.slice(-2)).toEqual(["reminder-payee", "reminder-remember"]);
    expect(localStorage.length).toBe(0);
  });

  it("stores nothing while the switch is off", () => {
    show();
    fillAll();
    expect(localStorage.length).toBe(0);
  });

  it("once on, keeps only the cleaned UPI ID and name, under one key", async () => {
    show();
    fillAll();
    type(payee(), "  Meena   Rao ");
    await userEvent.click(toggle());
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect(JSON.parse(stored()!)).toEqual({ v: 1, upiId: "meena.tuitions@okhdfc", name: "Meena Rao" });
    expect(localStorage.length).toBe(1);
    // Nothing about the parent, the amount, the month, the tone or the language.
    expect(stored()).not.toMatch(/Suresh|1200|1,200|October|polite|"en"/);
  });

  it("follows later edits while on, and keeps the last valid pair while a field is wrong", async () => {
    show();
    fillAll();
    await userEvent.click(toggle());
    type(upi(), "meena@okaxis");
    expect(JSON.parse(stored()!).upiId).toBe("meena@okaxis");
    type(upi(), "meena okaxis");
    expect(JSON.parse(stored()!)).toEqual({ v: 1, upiId: "meena@okaxis", name: "Meena Rao" });
  });

  it("turned on with a field still wrong, stores nothing until both are valid", async () => {
    show();
    type(upi(), "meena.tuitions@okhdfc");
    await userEvent.click(toggle());
    expect(stored()).toBeNull();
    type(payee(), "Meena Rao");
    expect(JSON.parse(stored()!)).toEqual({ v: 1, upiId: "meena.tuitions@okhdfc", name: "Meena Rao" });
  });

  it("on the next visit, in any language, fills both fields and shows the switch on; nothing else is filled", () => {
    keep({ v: 1, upiId: "meena.tuitions@okhdfc", name: "Meena Rao" });
    show("hi", hi.reminderForm);
    expect(upi().value).toBe("meena.tuitions@okhdfc");
    expect(payee().value).toBe("Meena Rao");
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect([parent().value, amount().value]).toEqual(["", ""]);
    // Filled from the phone, not touched: the name shows no error, the ID shows its format note.
    expect(block(payee()).getAttribute("data-state")).toBe("idle");
    expect(block(upi()).getAttribute("data-state")).toBe("correct");
  });

  it("turning it off deletes the stored values at once and leaves the two fields as they are", async () => {
    keep({ v: 1, upiId: "meena.tuitions@okhdfc", name: "Meena Rao" });
    show();
    type(parent(), "Suresh");
    type(amount(), "1200");
    await userEvent.click(toggle());
    expect(stored()).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(upi().value).toBe("meena.tuitions@okhdfc");
    expect(payee().value).toBe("Meena Rao");
    expect(preview().textContent).toBe(POLITE);
    // And it stays forgotten while the tutor goes on typing.
    type(payee(), "Meena R");
    expect(stored()).toBeNull();
  });

  it("can be turned on again after being turned off", async () => {
    show();
    fillAll();
    await userEvent.click(toggle());
    await userEvent.click(toggle());
    expect(stored()).toBeNull();
    await userEvent.click(toggle());
    expect(JSON.parse(stored()!)).toEqual({ v: 1, upiId: "meena.tuitions@okhdfc", name: "Meena Rao" });
  });

  it.each([
    ["not JSON", "{ nope"],
    ["an ID that no longer passes", JSON.stringify({ v: 1, upiId: "meena tuitions", name: "Meena Rao" })],
    ["a name that is too long", JSON.stringify({ v: 1, upiId: "meena.tuitions@okhdfc", name: "a".repeat(41) })],
  ])("ignores and removes a stored value that is %s", (_name, value) => {
    localStorage.setItem(KEY, value);
    show();
    expect(upi().value).toBe("");
    expect(payee().value).toBe("");
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    expect(stored()).toBeNull();
  });

  it("is never read while the page is rendered on the server", () => {
    keep({ v: 1, upiId: "meena.tuitions@okhdfc", name: "Meena Rao" });
    const html = renderToString(<ReminderTool words={words} pageLocale="en" />);
    expect(html).not.toContain("meena.tuitions@okhdfc");
    expect(html).not.toContain("Meena Rao</");
    expect(html).not.toContain('role="switch"');
  });

  it("where storage is blocked, shows no switch and the tool still builds a message", async () => {
    const real = Object.getOwnPropertyDescriptor(window, "localStorage")!;
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("blocked", "SecurityError");
        },
        removeItem: () => {},
        clear: () => {},
        length: 0,
      },
    });
    try {
      // A fresh copy of the modules, so the one-time storage probe runs against the blocked store.
      vi.resetModules();
      const fresh = await import("./reminder-tool");
      render(<fresh.ReminderTool words={words} pageLocale="en" />);
      expect(screen.queryByRole("switch")).toBeNull();
      expect(screen.queryByTestId("reminder-remember-row")).toBeNull();
      expect(document.body.textContent).not.toContain("Remember my UPI ID");
      fillAll();
      expect(preview().textContent).toBe(POLITE);
      expect(send().hasAttribute("href")).toBe(true);
    } finally {
      Object.defineProperty(window, "localStorage", real);
      vi.resetModules();
    }
  });
});

describe("the privacy line (criterion 50)", () => {
  it("is always on the page, in full, and not behind a link", () => {
    show();
    const line = screen.getByTestId("reminder-privacy");
    expect(line.textContent).toBe("Nothing you type is sent to us or saved on our servers. The message goes to WhatsApp only when you tap Send.");
    expect(line.querySelector("a")).toBeNull();
    expect(line.closest("details")).toBeNull();
  });
});

describe("before the page wakes up (plan section 4, criteria 13 and 46)", () => {
  it("is delivered with every control disabled, no month chosen from a clock, and no address on Send", () => {
    const html = renderToString(<ReminderTool words={words} pageLocale="en" />);
    const holder = document.createElement("div");
    holder.innerHTML = html;
    const form = holder.querySelector('[data-testid="reminder-form"]') as HTMLFieldSetElement;
    expect(form.tagName).toBe("FIELDSET");
    expect(form.disabled).toBe(true);
    const month = holder.querySelector('[data-testid="reminder-month"]') as HTMLSelectElement;
    expect(month.value).toBe("0");
    const bubble = holder.querySelector('[data-testid="reminder-preview"]')!;
    expect([...bubble.querySelectorAll('[role="img"]')].map((el) => el.getAttribute("data-blank"))).toEqual(["parent", "amount", "month", "link", "upiId"]);
    expect(holder.querySelector('[data-testid="reminder-send"]')!.hasAttribute("href")).toBe(false);
    expect(holder.textContent).toContain("Message language");
    expect(holder.querySelector("form")).toBeNull();
  });

  it("keeps the flex column in a div inside the fieldset, not on the fieldset itself", () => {
    // Found in the build: with the fieldset as the flex column, Chromium kept the form's old height
    // when the remember row arrived after hydration, and the language choices shrank to nothing on
    // the Hindi, Kannada and Telugu pages. The e2e suite measures the group's height on a real page.
    show();
    const form = screen.getByTestId("reminder-form");
    expect(form.className.split(/\s+/)).not.toContain("flex");
    expect(form.children).toHaveLength(1);
    expect(form.firstElementChild).toBe(screen.getByTestId("reminder-fields"));
    expect(screen.getByTestId("reminder-fields").className.split(/\s+/)).toEqual(expect.arrayContaining(["flex", "flex-col", "min-w-0"]));
  });

  it("is awake once rendered in the browser", () => {
    show();
    expect((screen.getByTestId("reminder-form") as HTMLFieldSetElement).disabled).toBe(false);
  });
});

describe("the page makes no request of its own (criteria 47 to 49)", () => {
  const root = process.cwd();
  const files = ["src/components/reminder/reminder-tool.tsx", "src/lib/reminder/reminder.ts", "src/lib/reminder/remember.ts", "src/lib/reminder/copy-text.ts"].filter(
    (path) => existsSync(join(root, path)),
  );
  // Built from pieces so this test file does not hold the very text it forbids.
  const forbidden = [
    "fetch" + "(",
    "XMLHttp" + "Request",
    "send" + "Beacon",
    "new " + "Image",
    "import" + "(",
    'from "post' + "hog",
    'from "@sen' + "try",
    "document." + "cookie",
    "history" + ".",
    "location" + ".",
    "window.open",
    "<form",
    "<img",
    "<iframe",
  ];

  it("scans the island, the library and the copy helper", () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
    expect(files).toContain("src/components/reminder/reminder-tool.tsx");
  });

  it.each(files)("%s has no way to call out, and touches neither the address nor a cookie", (path) => {
    const source = readFileSync(join(root, path), "utf8");
    for (const text of forbidden) expect(source.includes(text), `${path} contains ${text}`).toBe(false);
  });

  it("makes no request while a whole message is typed, changed and copied", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const beacon = vi.fn();
    Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: beacon });
    setClipboard({ writeText: async () => {} });
    const before = [window.location.href, window.history.length, document.title, document.cookie];
    show();
    fillAll();
    await userEvent.click(screen.getByTestId("reminder-language-te"));
    await userEvent.click(screen.getByTestId("reminder-tone-firm"));
    fireEvent.keyDown(parent(), { key: "Enter" });
    await act(async () => {
      fireEvent.click(copyButton());
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect([window.location.href, window.history.length, document.title, document.cookie]).toEqual(before);
    vi.unstubAllGlobals();
  });
});
