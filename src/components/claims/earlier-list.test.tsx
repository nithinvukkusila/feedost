// Spec R1-10, criterion 25: the Earlier list.
import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Claim } from "@/lib/claims";
import { renderWithWords } from "@/test-utils/render-with-words";
import { EarlierList } from "./earlier-list";

afterEach(cleanup);

const base: Claim = {
  id: "c1",
  studentId: "s1",
  dueId: "d1",
  amount: 120000,
  feeCount: 1,
  upiRef: "628104739915",
  screenshotPath: null,
  status: "confirmed",
  createdAt: Date.parse("2026-10-06T05:00:00Z"),
  handledAt: Date.parse("2026-10-06T06:00:00Z"),
  receiptFrom: 214,
  receiptCount: 1,
};

describe("the Earlier list", () => {
  it("draws nothing when there is nothing", () => {
    renderWithWords(<EarlierList items={[]} />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("says CONFIRMED with the date and the receipt number, NOT RECEIVED with the date, and the amounts", () => {
    renderWithWords(
      <EarlierList
        items={[
          { claim: base, name: "Neha Bhat" },
          { claim: { ...base, id: "c2", amount: 100000, status: "rejected", handledAt: Date.parse("2026-10-02T06:00:00Z"), receiptFrom: null, receiptCount: null }, name: "Kiran Patil" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Earlier" })).toBeTruthy();
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByText("CONFIRMED 06 Oct 2026 · NO. 214")).toBeTruthy();
    expect(within(rows[0]).getByText("₹1,200")).toBeTruthy();
    expect(within(rows[1]).getByText("NOT RECEIVED 02 Oct 2026")).toBeTruthy();
    expect(within(rows[1]).getByText("₹1,000")).toBeTruthy();
  });

  it("a claim that made several receipts says how many more", () => {
    renderWithWords(<EarlierList items={[{ claim: { ...base, receiptCount: 3 }, name: "Neha Bhat" }]} />);
    expect(screen.getByText("CONFIRMED 06 Oct 2026 · NO. 214 and 2 more")).toBeTruthy();
  });

  it("a receipt number of 1,000 or more is not grouped", () => {
    renderWithWords(<EarlierList items={[{ claim: { ...base, receiptFrom: 1234 }, name: "Neha Bhat" }]} />);
    expect(screen.getByText("CONFIRMED 06 Oct 2026 · NO. 1234")).toBeTruthy();
  });
});
