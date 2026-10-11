// The fee receipt island (spec R0-3), rendered in jsdom with the real English words. The PDF maker
// and the share step are replaced: they have their own tests, and the island's job is to call them
// only on a tap, only with checked values, and to say in words what happened.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";

const makePdf = vi.fn();
const download = vi.fn();
const shareOrDownload = vi.fn();
vi.mock("@/lib/receipt/make-pdf", () => ({ makePdf }));
vi.mock("@/lib/receipt/share", () => ({ download, shareOrDownload }));

const { ReceiptTool } = await import("./receipt-tool");
const words = en.receiptForm;
const blob = new Blob(["%PDF-"], { type: "application/pdf" });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 10, 12, 0));
  makePdf.mockResolvedValue({ blob, dropped: false });
  shareOrDownload.mockResolvedValue("shared");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

const show = (pageLocale: "en" | "hi" | "kn" | "te" = "en") => render(<ReceiptTool words={words} pageLocale={pageLocale} />);
const id = (name: string) => screen.getByTestId(`receipt-${name}`);
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
function fillAll() {
  type(id("tutor"), "Meena Iyer");
  type(id("student"), "Arjun");
  type(id("amount-field"), "1200");
}

describe("the island at the start", () => {
  it("starts with empty fields, both buttons disabled and one reason said once", () => {
    show();
    expect((id("tutor") as HTMLInputElement).value).toBe("");
    expect((id("student") as HTMLInputElement).value).toBe("");
    expect((id("amount-field") as HTMLInputElement).value).toBe("");
    expect((id("download") as HTMLButtonElement).disabled).toBe(true);
    expect((id("share") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(words.fillFirst)).toHaveLength(1);
    expect(id("incomplete").textContent).toBe(words.preview.incomplete);
  });

  it("has no form element, so nothing can submit", () => {
    const { container } = show();
    expect(container.querySelectorAll("form")).toHaveLength(0);
  });

  it("offers the phone's current month first, then eleven earlier", () => {
    show();
    const options = [...(id("month") as HTMLSelectElement).options].map((o) => o.textContent);
    expect(options).toHaveLength(12);
    expect(options[0]).toContain("October");
    expect(options[0]).toContain("2026");
  });

  it("preselects the receipt language of the page and marks payment as UPI", () => {
    show("kn");
    expect((id("language-kn") as HTMLInputElement).checked).toBe(true);
    expect((id("mode-upi") as HTMLInputElement).checked).toBe(true);
  });

  it("renders on the server with the form inert and no date, so no clock is baked into the page", () => {
    const html = renderToString(<ReceiptTool words={words} pageLocale="en" />);
    expect(html).toContain("disabled");
    expect(html).not.toContain("2026");
  });
});

describe("the preview", () => {
  it("fills in as the tutor types, with the amount in Indian grouping, and says when the receipt is finished", () => {
    show();
    fillAll();
    const preview = id("preview");
    expect(preview.textContent).toContain("Meena Iyer");
    expect(preview.textContent).toContain("Arjun");
    expect(id("amount").textContent).toBe("₹1,200/-");
    expect(screen.queryByTestId("receipt-incomplete")).toBeNull();
    expect((id("download") as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByTestId("receipt-reason")).toBeNull();
  });

  it("shows a spoken blank, not a colour, for each missing value", () => {
    show();
    expect(id("preview").querySelectorAll(`[role="img"][aria-label="${words.preview.blank}"]`).length).toBeGreaterThanOrEqual(3);
  });

  it("changes language with the receipt's own words", () => {
    show();
    fillAll();
    fireEvent.click(id("language-hi"));
    expect(id("preview").getAttribute("lang")).toBe("hi");
    expect(id("preview").textContent).not.toContain("Fee receipt");
  });

  it("says in words when a character cannot be printed", () => {
    show();
    fillAll();
    type(id("student"), "Asha 😀");
    expect(id("unprintable").textContent).toBe(words.preview.unprintable);
  });

  it("a student name that is all unprintable is a problem in words with a mark, the receipt keeps its blank, and the buttons stay off", () => {
    show();
    fillAll();
    type(id("student"), "அர்ஜுன்");
    fireEvent.blur(id("student"));
    expect(screen.getByText(words.student.unprintable.fix)).toBeTruthy();
    expect(screen.getByText(words.student.unprintable.word, { exact: false })).toBeTruthy();
    expect(id("preview").querySelector('[data-blank="student"]')).not.toBeNull();
    expect((id("download") as HTMLButtonElement).disabled).toBe(true);
    expect((id("share") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(id("download"));
    expect(makePdf).not.toHaveBeenCalled();
  });

  it("the same for the tutor's name, and typing a printable letter after it clears the problem", () => {
    show();
    fillAll();
    type(id("tutor"), "😀");
    fireEvent.blur(id("tutor"));
    expect(screen.getByText(words.tutor.unprintable.fix)).toBeTruthy();
    type(id("tutor"), "😀 Meena");
    expect(screen.queryByText(words.tutor.unprintable.fix)).toBeNull();
    expect((id("download") as HTMLButtonElement).disabled).toBe(false);
  });

  it("names an invalid amount with a word and a fix, and keeps the buttons off", () => {
    show();
    fillAll();
    type(id("amount-field"), "12.5");
    fireEvent.blur(id("amount-field"));
    expect(screen.getByText(words.amount.paise.fix)).toBeTruthy();
    expect((id("download") as HTMLButtonElement).disabled).toBe(true);
    expect(makePdf).not.toHaveBeenCalled();
  });
});

describe("the two buttons", () => {
  it("make nothing until tapped: no PDF is made while typing", () => {
    show();
    fillAll();
    expect(makePdf).not.toHaveBeenCalled();
  });

  it("Download makes the PDF with the checked values and saves it under a generic file name", async () => {
    show();
    fillAll();
    fireEvent.click(id("download"));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(makePdf).toHaveBeenCalledTimes(1);
    expect(makePdf.mock.calls[0][0]).toMatchObject({ lang: "en", tutor: "Meena Iyer", student: "Arjun", paise: 120_000, mode: "upi", month: { year: 2026, month: 9 } });
    const fileName = download.mock.calls[0][1] as string;
    expect(fileName).toMatch(/\.pdf$/);
    expect(fileName).not.toMatch(/Meena|Arjun|1200/);
  });

  it("Share hands the file to the share step, and says nothing when the share sheet took it", async () => {
    show();
    fillAll();
    fireEvent.click(id("share"));
    await waitFor(() => expect(shareOrDownload).toHaveBeenCalledTimes(1));
    expect(id("status").textContent).toBe("");
  });

  it("Share that had to save the file says so, and offers WhatsApp as a link that opens safely", async () => {
    shareOrDownload.mockResolvedValue("saved");
    show();
    fillAll();
    fireEvent.click(id("share"));
    await waitFor(() => expect(id("status").getAttribute("data-result")).toBe("saved"));
    expect(id("status").textContent).toContain(words.saved);
    const link = id("open-whatsapp");
    expect(link.getAttribute("href")).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("one tap makes one file, even when the button is tapped twice in one frame", async () => {
    let finish: (value: unknown) => void = () => {};
    makePdf.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    show();
    fillAll();
    fireEvent.click(id("download"));
    fireEvent.click(id("download"));
    expect(id("status").textContent).toContain(words.working);
    await act(async () => finish({ blob, dropped: false }));
    expect(makePdf).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("a failure is said in one sentence with a mark, and the button works again", async () => {
    makePdf.mockRejectedValueOnce(new Error("font"));
    show();
    fillAll();
    fireEvent.click(id("download"));
    await waitFor(() => expect(id("status").getAttribute("data-result")).toBe("failed"));
    expect(id("status").textContent).toContain(words.failed);
    expect((id("download") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(id("download"));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(id("status").getAttribute("data-result")).toBeNull();
  });

  it("a dropped character in the PDF is reported in words", async () => {
    makePdf.mockResolvedValue({ blob, dropped: true });
    show();
    fillAll();
    fireEvent.click(id("download"));
    await waitFor(() => expect(download).toHaveBeenCalled());
    expect(id("unprintable").textContent).toBe(words.preview.unprintable);
  });
});

describe("what the island never does", () => {
  it("does not import the PDF library or its maker statically", () => {
    const source = readFileSync(join(process.cwd(), "src", "components", "receipt", "receipt-tool.tsx"), "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*make-pdf["']/);
    expect(source).not.toMatch(/@cantoo|pdf-lib|fontkit/);
    expect(source).toMatch(/await import\("@\/lib\/receipt\/make-pdf"\)/);
  });

  it("writes nothing to the phone's storage or the address", () => {
    show();
    fillAll();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(window.location.search).toBe("");
    expect(window.location.hash).toBe("");
  });

  it("reads the tutor's name remembered by the reminder writer, and never writes it back", () => {
    localStorage.setItem("feedost.reminder.payee", JSON.stringify({ name: "Meena Rao" }));
    show();
    // Whatever the key is, the field is a plain input whose value the tutor can overwrite.
    type(id("tutor"), "Someone Else");
    expect((id("tutor") as HTMLInputElement).value).toBe("Someone Else");
  });
});
