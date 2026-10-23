// Spec R1-10, criteria 18, 19, 25: the inbox's pure helpers.
import { describe, expect, it } from "vitest";
import { feeLabel, groupRef, receiptsOf, whenOf } from "./claim-view";
import type { Claim } from "./claims";
import type { Due } from "./dues";

const claim = (over: Partial<Claim> = {}): Claim => ({
  id: "c1",
  studentId: "s1",
  dueId: "d1",
  amount: 120000,
  feeCount: 1,
  upiRef: "628104739915",
  screenshotPath: null,
  status: "pending",
  createdAt: Date.parse("2026-10-12T05:00:00Z"),
  handledAt: null,
  receiptFrom: null,
  receiptCount: null,
  ...over,
});
const due = (over: Partial<Due> = {}): Due => ({ id: "d1", studentId: "s1", kind: "monthly", month: "2026-10-01", amount: 120000, amountPaid: 0, status: "due", dueDate: "2026-10-05", ...over });

describe("groupRef", () => {
  it("groups 12 digits in fours", () => expect(groupRef("628104739915")).toBe("6281 0473 9915"));
  it("leaves anything else as it is", () => {
    expect(groupRef("12345")).toBe("12345");
    expect(groupRef("6281 0473 9915")).toBe("6281 0473 9915");
  });
});

describe("whenOf", () => {
  const now = Date.parse("2026-10-12T05:00:00Z"); // 10:30 on 12 Oct in India
  it("says today, with the India clock on 12 hours", () => {
    // 10:42 UTC is 16:12 in India.
    expect(whenOf(Date.parse("2026-10-12T10:42:00Z"), now)).toEqual({ when: "today", day: "2026-10-12", clock: "4:12 pm" });
  });
  it("says yesterday", () => {
    // 16:10 UTC on the 11th is 21:40 in India.
    expect(whenOf(Date.parse("2026-10-11T16:10:00Z"), now)).toEqual({ when: "yesterday", day: "2026-10-11", clock: "9:40 pm" });
  });
  it("older is a date", () => expect(whenOf(Date.parse("2026-10-06T05:00:00Z"), now).when).toBe("date"));
  it("changes day at India midnight, not UTC midnight", () => {
    // 18:29 UTC on the 11th is 23:59 on the 11th in India: yesterday. 18:30 UTC is 00:00 on the 12th: today.
    expect(whenOf(Date.parse("2026-10-11T18:29:00Z"), now)).toMatchObject({ when: "yesterday", clock: "11:59 pm" });
    expect(whenOf(Date.parse("2026-10-11T18:30:00Z"), now)).toMatchObject({ when: "today", clock: "12:00 am" });
  });
  it("noon is 12 pm", () => expect(whenOf(Date.parse("2026-10-12T06:30:00Z"), now)).toMatchObject({ clock: "12:00 pm" }));
});

describe("feeLabel", () => {
  it("is the month of a single monthly fee", () => expect(feeLabel(claim(), due())).toEqual({ kind: "month", month: "2026-10-01" }));
  it("is Earlier balance for an opening due", () => expect(feeLabel(claim(), due({ kind: "opening", month: null }))).toEqual({ kind: "earlier" }));
  it("is the number of fees when the claim spans more than one, even with no fee read", () => expect(feeLabel(claim({ feeCount: 3 }), undefined)).toEqual({ kind: "fees", n: 3 }));
  it("is null when the fee is not known", () => expect(feeLabel(claim(), undefined)).toBeNull());
});

describe("receiptsOf", () => {
  it("is the first number and how many more", () => expect(receiptsOf(claim({ status: "confirmed", handledAt: 1, receiptFrom: 214, receiptCount: 3 }))).toEqual({ first: 214, more: 2 }));
  it("is null unless confirmed", () => expect(receiptsOf(claim())).toBeNull());
});
