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

const baseStudent: Student = {
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

const onMarkPaid = vi.fn();
// The link to the student: the row's first link (a Receipt link, when there is one, comes after it).
const rowLink = () => document.querySelector("li > a") as HTMLElement;

const onRemind = vi.fn();
const READY = { upiId: "meena@okhdfc", name: "Meena Iyer" };
const PHONE = "+919876543210";

function show(
  due: Partial<Due>,
  opts: { month?: string; batch?: string | null; lang?: "en" | "hi"; phone?: string | null; tutor?: { upiId: string | null; name: string | null }; lastAt?: number | null } = {},
) {
  const d = { ...base, ...due };
  const student = { ...baseStudent, parentPhone: opts.phone === undefined ? null : opts.phone };
  return renderWithWords(
    <ul>
      <DueRow row={{ due: d, student, state: dueState(d, TODAY) }} month={opts.month ?? "2026-10-01"} batchName={opts.batch === undefined ? "Class 10 Maths" : opts.batch} onMarkPaid={onMarkPaid} remind={{ tutor: opts.tutor ?? READY, lastAt: opts.lastAt ?? null, today: TODAY, onRemind }} />
    </ul>,
    opts.lang ?? "en",
  );
}

describe("DueRow", () => {
  it("an overdue fee: the tag with days, the name, the due date, the batch and the amount, in one link to the edit screen", () => {
    show({});
    const link = rowLink();
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
    const link = rowLink();
    expect(link.textContent).toContain("Overdue");
    expect(link.textContent).not.toMatch(/days?\b.*Earlier/);
    expect(link.textContent).toContain("Earlier balance");
    expect(link.textContent).toContain("₹2,400");
  });

  it("a fee from an earlier month names the month", () => {
    show({ month: "2026-09-01", dueDate: "2026-09-05" });
    expect(rowLink().textContent).toContain("September fee");
  });

  it("a part paid fee shows two tags, lateness and Part paid with the amount in mono, and what is still owed (UX-review-fixes-2, 3.2)", () => {
    show({ amountPaid: 50000, status: "partial", amount: 100000 });
    const tags = [...document.querySelectorAll("[data-status]")];
    expect(tags.map((tag) => [tag.getAttribute("data-status"), tag.textContent])).toEqual([
      ["overdue", "Overdue 7 days"],
      ["part-paid", "Part paid ₹500"],
    ]);
    expect(tags[1].querySelector(".type-amount-row")?.textContent).toBe("₹500");
    // Side by side in one wrapping line.
    expect(tags[0].parentElement).toBe(tags[1].parentElement);
    expect(tags[0].parentElement?.className).toMatch(/\bflex-wrap\b/);
    // The old blue caption line is gone: "Part paid" appears once.
    expect(rowLink().textContent?.match(/Part paid/g)).toHaveLength(1);
    expect(document.querySelector(".text-blue.type-caption")).toBeNull();
    expect(rowLink().textContent?.endsWith("₹500")).toBe(true);
    cleanup();
    show({ amountPaid: 50000, status: "partial", amount: 100000, dueDate: "2026-10-20" });
    expect([...document.querySelectorAll("[data-status]")].map((tag) => tag.textContent)).toEqual(["Due", "Part paid ₹500"]);
  });

  it("a fee with nothing paid has one tag", () => {
    show({});
    expect(document.querySelectorAll("[data-status]")).toHaveLength(1);
  });

  it("an earlier balance says when it was added, not Due; a monthly fee keeps Due (1.4)", () => {
    show({ kind: "opening", month: null, amount: 50000, dueDate: "2026-10-12" });
    expect(rowLink().textContent).toContain("Earlier balance · Added 12 Oct 2026");
    expect(rowLink().textContent).not.toContain("Due 12 Oct 2026");
    expect(document.querySelector("[data-status]")?.textContent).toBe("Overdue");
    cleanup();
    show({ dueDate: "2026-10-12" });
    expect(rowLink().textContent).toContain("Due 12 Oct 2026");
    expect(rowLink().textContent).not.toContain("Added");
  });

  it("a paid fee shows the whole amount and the word Paid", () => {
    show({ amountPaid: 120000, status: "paid" });
    const link = rowLink();
    expect(link.textContent).toContain("Paid");
    expect(link.textContent).toContain("₹1,200");
  });

  it("has no batch name when the student has none", () => {
    show({}, { batch: null });
    expect(rowLink().textContent).not.toContain("Class 10");
  });

  it("the amount is in the mono face with 0 to 9 digits whatever the language", () => {
    show({ amount: 123456700 }, { lang: "hi" });
    const amount = screen.getByText("₹12,34,567");
    expect(amount.className).toContain("type-amount-row");
    expect(/[०-९౦-౯೦-೯]/.test(rowLink().textContent ?? "")).toBe(false);
    expect(rowLink().getAttribute("href")).toBe("/hi/students/edit/?id=s1");
  });

  it("does not cut a long name", () => {
    show({}, { batch: "B".repeat(60) });
    const html = document.body.innerHTML;
    expect(html).not.toMatch(/truncate|ellipsis|line-clamp/);
    expect(html).toContain("wrap-anywhere");
  });
});

describe("the buttons beside the row (R1-7, criterion 12)", () => {
  it("an overdue or due fee has Mark paid, beside the link and not inside it, 44px or more, named for the student", () => {
    show({});
    const button = screen.getByRole("button", { name: "Mark paid, Ravi Kumar" });
    expect(button.textContent).toBe("Mark paid");
    expect(rowLink().contains(button)).toBe(false);
    expect(button.className).toContain("min-h-tap");
    expect(screen.queryByRole("link", { name: /Receipt/ })).toBeNull();
    button.click();
    expect(onMarkPaid).toHaveBeenCalledWith("d1");
    cleanup();
    show({ dueDate: "2026-10-20" });
    expect(screen.getByRole("button", { name: /Mark paid/ })).toBeTruthy();
  });

  it("an earlier balance can be marked paid too", () => {
    show({ kind: "opening", month: null, dueDate: "2026-09-30" });
    expect(screen.getByRole("button", { name: /Mark paid/ })).toBeTruthy();
  });

  it("a part paid fee has both: Receipt, a link to its receipts, and Mark paid", () => {
    show({ amountPaid: 50000, status: "partial" });
    expect(screen.getByRole("button", { name: /Mark paid/ })).toBeTruthy();
    const receipt = screen.getByRole("link", { name: "Receipt, Ravi Kumar" });
    expect(receipt.getAttribute("href")).toBe("/en/receipt/?due=d1");
  });

  it("a paid fee has Receipt and no Mark paid; a fee with nothing paid has no Receipt", () => {
    show({ amountPaid: 120000, status: "paid" });
    expect(screen.queryByRole("button", { name: /Mark paid/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Receipt/ }).getAttribute("href")).toBe("/en/receipt/?due=d1");
    cleanup();
    show({});
    expect(screen.queryByRole("link", { name: /Receipt/ })).toBeNull();
  });

  it("the buttons say their words in Hindi (TODO-translate shows English until reviewed)", () => {
    show({}, { lang: "hi" });
    expect(screen.getByRole("button", { name: /Mark paid/ })).toBeTruthy();
  });
});

// 05:00 UTC on 12 Oct 2026 is 10:30 that day in India.
const NOW = Date.parse("2026-10-12T05:00:00Z");
const DAY = 86_400_000;

describe("Remind beside the row (R1-8, criteria 2 to 4 and 27)", () => {
  it("an overdue or due fee with a phone and a UPI ID has Remind, beside the link, 44px, named for the student", () => {
    show({}, { phone: PHONE });
    const button = screen.getByRole("button", { name: "Remind Ravi Kumar" });
    expect(button.textContent).toBe("Remind");
    expect(rowLink().contains(button)).toBe(false);
    expect(button.className).toContain("min-h-tap");
    button.click();
    expect(onRemind).toHaveBeenCalledWith("d1");
    cleanup();
    show({ dueDate: "2026-10-20" }, { phone: PHONE });
    expect(screen.getByRole("button", { name: /Remind/ })).toBeTruthy();
  });

  it("a part paid fee and an earlier balance have Remind too", () => {
    show({ amountPaid: 50000, status: "partial" }, { phone: PHONE });
    expect(screen.getByRole("button", { name: /Remind/ })).toBeTruthy();
    cleanup();
    show({ kind: "opening", month: null, dueDate: "2026-09-30" }, { phone: PHONE });
    expect(screen.getByRole("button", { name: /Remind/ })).toBeTruthy();
  });

  it("a paid fee has no Remind, no Add number and no Add your UPI ID", () => {
    show({ amountPaid: 120000, status: "paid" }, { phone: null });
    expect(screen.queryByRole("button", { name: /Remind/ })).toBeNull();
    expect(screen.queryByText("Add number")).toBeNull();
    expect(screen.queryByText("Add your UPI ID")).toBeNull();
  });

  it("a student with no phone has an Add number link to the edit screen, and no Remind", () => {
    show({}, { phone: null });
    const link = screen.getByRole("link", { name: "Add number for Ravi Kumar" });
    expect(link.textContent).toBe("Add number");
    expect(link.getAttribute("href")).toBe("/en/students/edit/?id=s1");
    expect(link.className).toContain("min-h-tap");
    expect(screen.queryByRole("button", { name: /Remind/ })).toBeNull();
  });

  it("with no UPI ID, or no name, Remind is Add your UPI ID, a link to the UPI screen", () => {
    for (const tutor of [{ upiId: null, name: "Meena" }, { upiId: "meena@okhdfc", name: null }, { upiId: "not an id", name: "Meena" }]) {
      show({}, { phone: PHONE, tutor });
      const link = screen.getByRole("link", { name: "Add your UPI ID" });
      expect(link.getAttribute("href")).toBe("/en/setup/upi/");
      expect(screen.queryByRole("button", { name: /Remind/ })).toBeNull();
      cleanup();
    }
  });

  it("no phone wins over no UPI ID (the reasons come in order)", () => {
    show({}, { phone: null, tutor: { upiId: null, name: null } });
    expect(screen.getByRole("link", { name: /Add number/ })).toBeTruthy();
    expect(screen.queryByText("Add your UPI ID")).toBeNull();
  });

  it("says when the parent was last reminded in words, with a mark that is hidden from screen readers", () => {
    const cases: [number, string][] = [
      [NOW - 3_600_000, "Reminded today"],
      [NOW - DAY, "Reminded yesterday"],
      [NOW - 3 * DAY, "Reminded 3 days ago"],
      [NOW - 30 * DAY, "Reminded 30 days ago"],
      [NOW - 31 * DAY, "Reminded over 30 days ago"],
    ];
    for (const [lastAt, words] of cases) {
      show({}, { phone: PHONE, lastAt });
      const line = screen.getByText(words);
      expect(rowLink().contains(line)).toBe(true);
      expect(line.parentElement?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      cleanup();
    }
  });

  it("shows nothing for a fee never reminded, and nothing on a paid fee", () => {
    show({}, { phone: PHONE });
    expect(document.body.textContent).not.toContain("Reminded");
    cleanup();
    show({ amountPaid: 120000, status: "paid" }, { phone: PHONE, lastAt: NOW });
    expect(document.body.textContent).not.toContain("Reminded");
  });
});
