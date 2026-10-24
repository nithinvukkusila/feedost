// The parent's claim sheet (spec R1-10 Part C, criteria 31 to 36).
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { feeBody } from "@/lib/pay-page.test-util";
import { readPage, type ClaimOutcome, type FeePage } from "@/lib/pay-page-public";
import { ClaimSheet } from "./claim-sheet";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

const base = readPage({ code: "ok", page: feeBody }) as FeePage;
const REF_LABEL = "UPI reference number · 12 digits";

function show(
  options: { page?: Partial<FeePage>; send?: (ref: string) => Promise<ClaimOutcome> } = {},
) {
  const send = vi.fn(options.send ?? (async () => ({ kind: "ok" }) as ClaimOutcome));
  const onStale = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <ClaimSheet words={en.payPage} monthWords={en.receipt} page={{ ...base, ...options.page }} send={send} onStale={onStale} onClose={onClose} />,
  );
  const field = screen.getByLabelText(REF_LABEL) as HTMLInputElement;
  const sendButton = () => screen.getByRole("button", { name: /Send to|Sending/ });
  return { ...view, send, onStale, onClose, field, sendButton };
}

const dialogText = () => screen.getByRole("dialog").textContent ?? "";

describe("ClaimSheet: what it says (criterion 31)", () => {
  it("names the student and 'all open fees', the total to the tutor, the title, the help line and Close", () => {
    show();
    const text = dialogText();
    expect(text).toContain("Ravi Kumar · all open fees");
    expect(text).toContain("₹3,400 to Meena Iyer");
    expect(screen.getByRole("heading").textContent).toBe("Paid already? Tell Meena Iyer.");
    expect(text).toContain("Give Meena Iyer one proof so she can match it. Your receipt comes once she confirms.");
    expect(text).toContain("Only Meena Iyer can see it.");
    expect(text).toContain("This does not move any money. It only tells the tutor.");
    expect(screen.getByRole("button", { name: "Close" }).className).toContain("min-h-tap");
  });

  it("names the month for one monthly fee and 'Earlier balance' for an earlier balance alone", () => {
    show({ page: { openDues: [base.openDues[2]], totalRemaining: 140000 } });
    expect(dialogText()).toContain("Ravi Kumar · October 2026");
    expect(dialogText()).toContain("₹1,400 to Meena Iyer");
    cleanup();
    show({ page: { openDues: [base.openDues[0]], totalRemaining: 100000 } });
    expect(dialogText()).toContain("Ravi Kumar · Earlier balance");
  });

  it("says 'your tutor' when the tutor has no name, and keeps names out of translation", () => {
    show({ page: { tutorName: null } });
    expect(screen.getByRole("heading").textContent).toBe("Paid already? Tell your tutor.");
    expect(screen.getByRole("button", { name: /Send to/ }).textContent).toBe("Send to your tutor");
    cleanup();
    const { container } = show();
    const names = [...container.ownerDocument.querySelectorAll('[translate="no"]')].map((el) => el.textContent);
    expect(names).toEqual(expect.arrayContaining(["Ravi Kumar", "Meena Iyer", "₹3,400"]));
  });

  it("draws no screenshot option before Part D (criterion 33)", () => {
    show();
    expect(screen.queryByText(/screenshot/i)).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});

describe("ClaimSheet: the reference field (criterion 32)", () => {
  it("is a numeric, mono field with the hint, focused when the sheet opens", () => {
    const { field } = show();
    expect(field.tagName).toBe("INPUT");
    expect(field.getAttribute("inputmode")).toBe("numeric");
    expect(field.getAttribute("autocomplete")).toBe("off");
    expect(field.hasAttribute("data-autofocus")).toBe(true);
    expect(field.className).toContain("type-value-mono");
    expect(field.getAttribute("name")).toBeNull();
    expect(dialogText()).toContain("In your UPI app it is shown as UTR or UPI Ref No.");
  });

  it("shows what is typed in groups of four and ignores spaces and hyphens, typed or pasted", async () => {
    const { field } = show();
    await userEvent.type(field, "62810");
    expect(field.value).toBe("6281 0");
    await userEvent.type(field, "4739915");
    expect(field.value).toBe("6281 0473 9915");
    await userEvent.clear(field);
    await userEvent.click(field);
    await userEvent.paste("6281-0473-9915");
    expect(field.value).toBe("6281 0473 9915");
  });

  it("refuses anything that is not 12 digits beside the field and sends nothing", async () => {
    const { field, send, sendButton } = show();
    for (const typed of ["", "62810473991", "6281047399150", "6281O4739915", "६२८१०४७३९९१५"]) {
      await userEvent.clear(field);
      if (typed) await userEvent.type(field, typed);
      await userEvent.click(sendButton());
      expect(field.getAttribute("aria-invalid"), typed).toBe("true");
      expect(dialogText()).toContain("Check the 12 digits and try again.");
    }
    expect(send).not.toHaveBeenCalled();
  });
});

describe("ClaimSheet: sending (criteria 33 to 36)", () => {
  it("sends the 12 digits once, says Sending… and ignores a second tap", async () => {
    let finish: (value: ClaimOutcome) => void = () => {};
    const { field, send, sendButton } = show({ send: () => new Promise<ClaimOutcome>((resolve) => (finish = resolve)) });
    await userEvent.type(field, "6281 0473 9915");
    const button = sendButton();
    expect(button.className).toContain("min-h-15.5");
    expect(button.className).toContain("bg-blue");
    await userEvent.click(button);
    expect(sendButton().textContent).toBe("Sending…");
    await userEvent.click(sendButton());
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("628104739915");
    await act(async () => finish({ kind: "failed" }));
  });

  it("on success says it was sent and that the receipt comes later, with Close, and never says 'paid' (criterion 34)", async () => {
    const { field, send, sendButton, onClose } = show();
    await userEvent.type(field, "628104739915");
    await userEvent.click(sendButton());
    expect(send).toHaveBeenCalledTimes(1);
    const text = dialogText();
    expect(text).toContain("Sent to Meena Iyer. She will check and confirm it.");
    expect(text).toContain("Open this link again later to see your receipt.");
    const status = screen.getByRole("status");
    expect(status.textContent).not.toMatch(/\b(paid|done|success)\b/i);
    expect(screen.queryByLabelText(REF_LABEL)).toBeNull();
    const closes = screen.getAllByRole("button", { name: "Close" });
    await userEvent.click(closes[closes.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });

  const kept: [ClaimOutcome["kind"], string][] = [
    ["bad_reference", "Check the 12 digits and try again."],
    ["no_proof", "Check the 12 digits and try again."],
    ["duplicate", "This reference was already sent."],
    ["rate_limited", "Too many tries. Please try again in a while."],
    ["failed", "Couldn't send. Nothing was saved. Try again."],
  ];
  it.each(kept)("on %s keeps what she typed and says so beside the button or field (criterion 35)", async (kind, words) => {
    const { field, sendButton, onStale } = show({ send: async () => ({ kind }) as ClaimOutcome });
    await userEvent.type(field, "6281 0473 9915");
    await userEvent.click(sendButton());
    expect(dialogText()).toContain(words);
    expect(field.value).toBe("6281 0473 9915");
    expect(sendButton().textContent).toBe("Send to Meena Iyer");
    expect(onStale).not.toHaveBeenCalled();
  });

  it.each(["nothing_owed", "already_pending", "consent_needed", "not_found"] as const)("on %s asks the page to read itself again", async (kind) => {
    const { field, sendButton, onStale } = show({ send: async () => ({ kind }) });
    await userEvent.type(field, "628104739915");
    await userEvent.click(sendButton());
    expect(onStale).toHaveBeenCalledTimes(1);
  });

  it("a 403 after a 422 still asks the page to read again (it never assumes consent)", async () => {
    const answers: ClaimOutcome[] = [{ kind: "bad_reference" }, { kind: "consent_needed" }];
    const { field, sendButton, onStale } = show({ send: async () => answers.shift()! });
    await userEvent.type(field, "628104739915");
    await userEvent.click(sendButton());
    expect(onStale).not.toHaveBeenCalled();
    await userEvent.click(sendButton());
    expect(onStale).toHaveBeenCalledTimes(1);
  });

  it("offline, refuses with its own words, keeps the digits and sends nothing (criterion 36)", async () => {
    vi.stubGlobal("navigator", { ...navigator, onLine: false });
    const { field, send, sendButton } = show();
    await userEvent.type(field, "628104739915");
    await userEvent.click(sendButton());
    expect(dialogText()).toContain("You are offline. Nothing was sent.");
    expect(field.value).toBe("6281 0473 9915");
    expect(send).not.toHaveBeenCalled();
  });

  it("typing again clears the message", async () => {
    const { field, sendButton } = show({ send: async () => ({ kind: "duplicate" }) });
    await userEvent.type(field, "628104739915");
    await userEvent.click(sendButton());
    expect(dialogText()).toContain("This reference was already sent.");
    await userEvent.type(field, "{Backspace}6");
    expect(dialogText()).not.toContain("This reference was already sent.");
  });
});
