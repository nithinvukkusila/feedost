// Spec R1-9 Part C, criteria 43 and 44: the QR is the Pay button's own link, drawn on the phone, and a failure leaves the page intact.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../../messages/en.json";
import { feeBody } from "@/lib/pay-page.test-util";
import { readPage, type FeePage } from "@/lib/pay-page-public";
import { qrMatrix } from "@/lib/qr";
import { FeeScreen } from "./fee-screen";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const page = (): FeePage => readPage({ code: "ok", page: feeBody }) as FeePage;
const show = () => render(<FeeScreen words={en.payPage} monthWords={en.receipt} page={page()} onOpenNotice={() => {}} />);

describe("Show QR code", () => {
  it("draws exactly the Pay button's link, with the words and the UPI ID under it", async () => {
    show();
    const href = screen.getByRole("link", { name: /^Pay / }).getAttribute("href")!;
    expect(screen.queryByRole("img", { name: en.payPage.qrHelp })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show QR code" }));
    const svg = await screen.findByRole("img", { name: "Scan with a UPI app on another phone" });
    const expected = await qrMatrix(href);
    expect(svg.querySelector("path")?.getAttribute("d")).toBe(expected.path);
    expect(svg.getAttribute("viewBox")).toBe(`0 0 ${String(expected.size + 8)} ${String(expected.size + 8)}`);
    expect(screen.getAllByText("Scan with a UPI app on another phone").length).toBeGreaterThan(0);
    expect(screen.getAllByText("meena.tuitions@okhdfc").length).toBeGreaterThan(0);
  });

  it("hides on Close and puts the focus back on the button", async () => {
    show();
    const open = screen.getByRole("button", { name: "Show QR code" });
    await userEvent.click(open);
    await screen.findByRole("img", { name: /Scan with/ });
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("img", { name: /Scan with/ })).toBeNull();
    expect(document.activeElement).toBe(open);
  });

  it("says it could not draw when the encoder fails, and the rest of the page stays", async () => {
    vi.doMock("@/lib/qr", () => ({ qrMatrix: () => Promise.reject(new Error("no chunk")) }));
    vi.resetModules();
    const { FeeScreen: Fresh } = await import("./fee-screen");
    render(<Fresh words={en.payPage} monthWords={en.receipt} page={page()} onOpenNotice={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Show QR code" }));
    await waitFor(() => expect(screen.getByText("Couldn't make the QR code. Use Copy UPI ID instead.")).toBeTruthy());
    expect(screen.getByRole("link", { name: /^Pay / })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    vi.doUnmock("@/lib/qr");
  });

  it("is not offered when there is nothing to pay, no UPI ID or too large a total", () => {
    for (const change of [{ totalRemaining: 0, openDues: [] }, { upiId: null }, { totalRemaining: 100_000_001 }] as Partial<FeePage>[]) {
      render(<FeeScreen words={en.payPage} monthWords={en.receipt} page={{ ...page(), ...change }} onOpenNotice={() => {}} />);
      expect(screen.queryByRole("button", { name: "Show QR code" })).toBeNull();
      cleanup();
    }
  });
});
