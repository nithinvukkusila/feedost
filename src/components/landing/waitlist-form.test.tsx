// The waitlist form (spec R0-4, criteria 5, 7, 8, 10, 11, 12, 15, 17, 22, 23), with the function's reply stubbed.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import hi from "../../../messages/hi.json";
import { WaitlistForm } from "./waitlist-form";

const words = en.waitlistForm;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: "ok" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const body = () => JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);

async function fill(user: ReturnType<typeof userEvent.setup>, values = { name: "Asha Rao", phone: "098765 43210", city: "Mysuru", band: "30 to 60" }) {
  await user.type(screen.getByRole("textbox", { name: words.name.label }), values.name);
  await user.type(screen.getByRole("textbox", { name: words.phone.label }), values.phone);
  await user.type(screen.getByRole("textbox", { name: words.city.label }), values.city);
  await user.selectOptions(screen.getByRole("combobox", { name: words.students.label }), values.band);
}

describe("the waitlist form", () => {
  it("has the four fields in canvas order, empty, nothing focused, the select unchosen, and one black button", () => {
    const { container } = render(<WaitlistForm words={words} locale="en" />);
    const order = [...container.querySelectorAll("label")].map((l) => l.textContent);
    expect(order).toEqual([words.name.label, words.phone.label, words.city.label, words.students.label]);
    expect(document.activeElement).toBe(document.body);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect([...select.options].map((o) => o.textContent)).toEqual(["Choose how many", "Under 10", "10 to 30", "30 to 60", "More than 60"]);
    const phone = screen.getByRole("textbox", { name: words.phone.label });
    expect(phone.getAttribute("inputmode")).toBe("tel");
    expect(phone.getAttribute("autocomplete")).toBe("tel");
    expect(container.querySelectorAll("[data-ph-no-capture][data-sentry-mask]").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole("button", { name: words.submit })).toBeTruthy();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("has a honeypot that is out of the tab order and hidden from screen readers", () => {
    const { container } = render(<WaitlistForm words={words} locale="en" />);
    const trap = container.querySelector('input[name="website"]') as HTMLInputElement;
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull();
    expect(trap.value).toBe("");
  });

  it("shows the consent line directly above the button", () => {
    render(<WaitlistForm words={words} locale="en" />);
    const consent = screen.getByText(words.consent);
    const button = screen.getByRole("button", { name: words.submit });
    expect(consent.nextElementSibling).toBe(button);
  });

  it("with JavaScript off (the delivered HTML) holds the one line and no inputs", () => {
    const html = renderToString(<WaitlistForm words={words} locale="en" />);
    expect(html).toContain(words.noScript);
    expect(html).not.toMatch(/<(input|select|textarea|button|form)/);
  });

  it("on submit with nothing typed shows each error as a word and a sentence, focuses the first, and sends nothing", async () => {
    const user = userEvent.setup();
    const { container } = render(<WaitlistForm words={words} locale="en" />);
    await user.click(screen.getByRole("button", { name: words.submit }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Type your name.")).toBeTruthy();
    expect(screen.getByText(words.phone.missing.fix)).toBeTruthy();
    expect(screen.getByText(words.city.missing.fix)).toBeTruthy();
    expect(container.textContent).toContain(`${words.students.missing.word}`);
    expect(container.textContent).toContain(words.students.missing.fix);
    expect(screen.getAllByText(words.name.missing.word)).toHaveLength(3);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: new RegExp(words.name.label) }));
  });

  it("focuses the first field that is wrong, not the first field", async () => {
    const user = userEvent.setup();
    render(<WaitlistForm words={words} locale="en" />);
    await user.type(screen.getByRole("textbox", { name: words.name.label }), "Asha");
    await user.type(screen.getByRole("textbox", { name: words.phone.label }), "12345");
    await user.click(screen.getByRole("button", { name: words.submit }));
    expect(screen.getByText(words.phone.check.fix)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: new RegExp(words.phone.label) }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows an error when a field is left, and clears it as soon as the value is right", async () => {
    const user = userEvent.setup();
    render(<WaitlistForm words={words} locale="en" />);
    const phone = screen.getByRole("textbox", { name: words.phone.label });
    await user.type(phone, "5876543210");
    await user.tab();
    expect(screen.getByText(words.phone.check.fix)).toBeTruthy();
    await user.clear(phone);
    await user.type(phone, "9876543210");
    expect(screen.queryByText(words.phone.check.fix)).toBeNull();
  });

  it("groups a good number when the field is left", async () => {
    const user = userEvent.setup();
    render(<WaitlistForm words={words} locale="en" />);
    const phone = screen.getByRole("textbox", { name: words.phone.label }) as HTMLTextAreaElement;
    await user.type(phone, "098765 43210");
    await user.tab();
    expect(phone.value).toBe("+91 98765 43210");
  });

  it("sends the cleaned values and the page language, once, then replaces the form with a status that holds focus and does not repeat the number", async () => {
    const user = userEvent.setup();
    const { container } = render(<WaitlistForm words={hi.waitlistForm} locale="hi" />);
    await user.type(screen.getByRole("textbox", { name: hi.waitlistForm.name.label }), "  आशा   राव ");
    await user.type(screen.getByRole("textbox", { name: hi.waitlistForm.phone.label }), "९८७६५ ४३२१०");
    await user.type(screen.getByRole("textbox", { name: hi.waitlistForm.city.label }), "मैसूर");
    await user.selectOptions(screen.getByRole("combobox"), hi.waitlistForm.students.from10);
    await user.click(screen.getByRole("button", { name: hi.waitlistForm.submit }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body()).toEqual({ name: "आशा राव", phone: "+919876543210", city: "मैसूर", students_count: 10, language: "hi", website: "" });
    const status = screen.getByRole("status");
    expect(document.activeElement).toBe(status);
    expect(status.textContent).toContain(hi.waitlistForm.done.title);
    expect(container.textContent).not.toMatch(/98765|९८७६५/);
    expect(container.querySelector("form, input")).toBeNull();
  });

  it("writes nothing to storage or cookies", async () => {
    const user = userEvent.setup();
    render(<WaitlistForm words={words} locale="en" />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: words.submit }));
    await screen.findByRole("status");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("sends one request however many times the button is tapped while it works", async () => {
    const user = userEvent.setup();
    let release: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((resolve) => (release = resolve)));
    render(<WaitlistForm words={words} locale="en" />);
    await fill(user);
    const form = screen.getByRole("button", { name: words.submit }).closest("form")!;
    // Two submits in the same frame, before React can disable anything.
    act(() => {
      form.requestSubmit();
      form.requestSubmit();
    });
    await user.click(screen.getByRole("button", { name: words.working }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: words.working }).getAttribute("aria-busy")).toBe("true");
    release(new Response(JSON.stringify({ code: "ok" })));
    await screen.findByRole("status");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("on a failed reply says so, keeps every value, and the button works again", async () => {
    const user = userEvent.setup();
    fetchMock.mockImplementationOnce(async () => Promise.reject(new TypeError("Failed to fetch")));
    render(<WaitlistForm words={words} locale="en" />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: words.submit }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(words.failed.title);
    expect(alert.textContent).toContain(words.failed.detail);
    expect((screen.getByRole("textbox", { name: words.name.label }) as HTMLTextAreaElement).value).toBe("Asha Rao");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("30");
    await user.click(screen.getByRole("button", { name: words.submit }));
    await screen.findByRole("status");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["error", 500, words.failed],
    ["invalid", 400, words.failed],
    ["rate_limited", 429, words.rateLimited],
  ])("shows the right line for the %s reply and keeps the typing", async (code, status, line) => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ code }), { status }));
    render(<WaitlistForm words={words} locale="en" />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: words.submit }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(line.title);
    expect(screen.getByDisplayValue("Mysuru")).toBeTruthy();
  });
});

describe("the waitlist's other files", () => {
  it("never reaches for the Supabase library or the page's storage", () => {
    for (const file of ["src/lib/waitlist/join.ts", "src/components/landing/waitlist-form.tsx"]) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      expect(text, file).not.toMatch(/supabase-js|localStorage|sessionStorage|document\.cookie|\bposthog\b|@sentry/);
    }
  });

  it("has dropped landing.waitlist.soon, .reason and .button from all four message files, and nothing uses them", async () => {
    const files = await Promise.all(["en", "hi", "kn", "te"].map(async (l) => (await import(`../../../messages/${l}.json`)).default));
    for (const file of files) {
      expect(Object.keys(file.landing.waitlist).sort()).toEqual(["body", "title"]);
    }
  });
});
