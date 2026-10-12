// Spec R1-6, criteria 16, 17 and 35: one row of the board, with the real English and Hindi words.
import { cleanup, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Due } from "@/lib/dues";
import { dueState } from "@/lib/dues-board";
import type { Student } from "@/lib/students";
import { renderWithWords } from "@/test-utils/render-with-words";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { DueRow } from "./due-row";

afterEach(cleanup);

const student: Student = {
  id: "s1",
  batchId: "b1",
  name: "Ravi Kumar",
  parentName: null,
  parentPhone: null,
  parentLanguage: "en",
  monthlyFee: 120000,
  openingBalance: 0,
  dueDay: 5,
  active: true,
};
const base: Due = { id: "d1", studentId: "s1", kind: "monthly", month: "2026-10-01", amount: 120000, amountPaid: 0, status: "due", dueDate: "2026-10-05" };
const TODAY = "2026-10-12";

function show(due: Partial<Due>, opts: { month?: string; batch?: string | null; lang?: "en" | "hi" } = {}) {
  const d = { ...base, ...due };
  return renderWithWords(
    <ul>
      <DueRow row={{ due: d, student, state: dueState(d, TODAY) }} month={opts.month ?? "2026-10-01"} batchName={opts.batch === undefined ? "Class 10 Maths" : opts.batch} />
    </ul>,
    opts.lang ?? "en",
  );
}

describe("DueRow", () => {
  it("an overdue fee: the tag with days, the name, the due date, the batch and the amount, in one link to the edit screen", () => {
    show({});
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/en/students/edit/?id=s1");
    expect(link.textContent).toContain("Overdue 7 days");
    expect(link.textContent).toContain("Ravi Kumar");
    expect(link.textContent).toContain("Due 05 Oct 2026");
    expect(link.textContent).toContain("Class 10 Maths");
    expect(link.textContent).toContain("₹1,200");
    expect(link.querySelector("button, a, input")).toBeNull();
    expect(link.className).toContain("min-h-16.5");
  });

  it("says 1 day in the singular, Due today on the day, and Due before it", () => {
    show({ dueDate: "2026-10-11" });
    expect(screen.getByText("Overdue 1 day")).toBeTruthy();
    cleanup();
    show({ dueDate: "2026-10-12" });
    expect(screen.getByText("Due today")).toBeTruthy();
    cleanup();
    show({ dueDate: "2026-10-13" });
    expect(screen.getByText("Due")).toBeTruthy();
  });

  it("an earlier balance has no day count and says what it is", () => {
    show({ kind: "opening", month: null, amount: 240000, dueDate: "2026-09-30" });
    const link = screen.getByRole("link");
    expect(link.textContent).toContain("Overdue");
    expect(link.textContent).not.toMatch(/days?\b.*Earlier/);
    expect(link.textContent).toContain("Earlier balance");
    expect(link.textContent).toContain("₹2,400");
  });

  it("a fee from an earlier month names the month", () => {
    show({ month: "2026-09-01", dueDate: "2026-09-05" });
    expect(screen.getByRole("link").textContent).toContain("September fee");
  });

  it("a part paid fee shows what was paid and the amount still owed, and keeps Overdue when late", () => {
    show({ amountPaid: 50000, status: "partial", amount: 100000 });
    const link = screen.getByRole("link");
    expect(link.textContent).toContain("Overdue 7 days");
    expect(link.textContent).toContain("Part paid ₹500");
    expect(link.textContent?.endsWith("₹500")).toBe(true);
    cleanup();
    show({ amountPaid: 50000, status: "partial", amount: 100000, dueDate: "2026-10-20" });
    expect(document.querySelector("[data-status]")?.textContent).toBe("Part paid");
  });

  it("a paid fee shows the whole amount and the word Paid", () => {
    show({ amountPaid: 120000, status: "paid" });
    const link = screen.getByRole("link");
    expect(link.textContent).toContain("Paid");
    expect(link.textContent).toContain("₹1,200");
  });

  it("has no batch name when the student has none", () => {
    show({}, { batch: null });
    expect(screen.getByRole("link").textContent).not.toContain("Class 10");
  });

  it("the amount is in the mono face with 0 to 9 digits whatever the language", () => {
    show({ amount: 123456700 }, { lang: "hi" });
    const amount = screen.getByText("₹12,34,567");
    expect(amount.className).toContain("type-amount-row");
    expect(/[०-९౦-౯೦-೯]/.test(screen.getByRole("link").textContent ?? "")).toBe(false);
    expect(screen.getByRole("link").getAttribute("href")).toBe("/hi/students/edit/?id=s1");
  });

  it("does not cut a long name", () => {
    show({}, { batch: "B".repeat(60) });
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/truncate|ellipsis|line-clamp/);
    expect(html).toContain("wrap-anywhere");
  });
});
