// The earlier receipts (spec R1-9 Part B, criterion 27).
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import en from "../../../messages/en.json";
import { feeBody } from "@/lib/pay-page.test-util";
import { readPage, type FeePage, type PayReceipt } from "@/lib/pay-page-public";
import { EarlierReceipts } from "./earlier-receipts";

afterEach(cleanup);
const words = en.payPage;
const monthWords = en.receipt;
const receipts = (readPage({ code: "ok", page: feeBody }) as FeePage).receipts;

describe("EarlierReceipts", () => {
  it("draws one row per receipt, with the month, the amount, the status line and a View link to /r/{receipt token}", () => {
    render(<EarlierReceipts words={words} monthWords={monthWords} receipts={receipts} more={false} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("August 2026 · ₹1,200");
    expect(rows[0].textContent).toContain("PAID 03 SEP 2026 · NO. 198");
    const view = within(rows[0]).getByRole("link");
    expect(view.getAttribute("href")).toBe("/r/Rq8mT2vXk4LpN7sYb3WcZd");
    expect(view.getAttribute("rel")).toBe("noopener noreferrer");
    expect(view.getAttribute("target")).toBeNull();
    expect(view.textContent).toBe("View");
  });

  it("says Earlier balance for a receipt with no month, and PART PAID when a balance was left", () => {
    render(<EarlierReceipts words={words} monthWords={monthWords} receipts={receipts} more={false} />);
    const second = screen.getAllByRole("listitem")[1];
    expect(second.textContent).toContain("Earlier balance · ₹500");
    expect(second.textContent).toContain("PART PAID 12 AUG 2026 · NO. 171");
  });

  it("takes the link from the receipt's own token, never from anything else", () => {
    const one: PayReceipt = { ...receipts[0], receiptToken: "OtherToken1234567890abc" };
    render(<EarlierReceipts words={words} monthWords={monthWords} receipts={[one]} more={false} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/r/OtherToken1234567890abc");
  });

  it("says 'Showing the latest 12.' only when there are more", () => {
    const { rerender } = render(<EarlierReceipts words={words} monthWords={monthWords} receipts={receipts} more={false} />);
    expect(screen.queryByText("Showing the latest 12.")).toBeNull();
    rerender(<EarlierReceipts words={words} monthWords={monthWords} receipts={receipts} more />);
    expect(screen.getByText("Showing the latest 12.")).toBeTruthy();
  });

  it("is not drawn when there are none", () => {
    const { container } = render(<EarlierReceipts words={words} monthWords={monthWords} receipts={[]} more={false} />);
    expect(container.innerHTML).toBe("");
  });
});
