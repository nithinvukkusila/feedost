// The pay page's logic (spec R1-9 Part B, criteria 23, 24, 37 to 39). The day logic runs under four time zones: the
// phone's clock is never read, so the answers must be the same.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { feeBody } from "./pay-page.test-util";
import { readPage, type FeePage, type OpenDue } from "./pay-page-public";
import { dayNumber, feeLine, lateness, payArea, payeeName, upiNote } from "./pay-page-view";
import { PAY_PAGE_MAX_PAISE } from "./upi-link";

const due = (change: Partial<OpenDue> = {}): OpenDue => ({ kind: "monthly", month: "2026-10-01", dueDate: "2026-10-01", amount: 120000, amountPaid: 0, remaining: 120000, ...change });
const fee = (change: Partial<FeePage> = {}): FeePage => {
  const page = readPage({ code: "ok", page: feeBody });
  if (page === null || page.consentNeeded) throw new Error("fixture");
  return { ...page, ...change };
};

const zones: [string, number][] = [
  ["UTC", 0],
  ["America/Los_Angeles", 480],
  ["Asia/Kolkata", -330],
  ["Pacific/Kiritimati", -840],
];

describe.each(zones)("day logic with the process time zone set to %s", (zone, january) => {
  const before = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = zone;
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(january);
  });
  afterAll(() => {
    if (before === undefined) delete process.env.TZ;
    else process.env.TZ = before;
  });

  it("calls yesterday overdue, today due today and tomorrow not late, from the server's day", () => {
    expect(lateness("2026-10-12", "2026-10-11")).toBe("overdue");
    expect(lateness("2026-10-12", "2026-10-12")).toBe("today");
    expect(lateness("2026-10-12", "2026-10-13")).toBe("later");
  });

  it("counts across month ends, year ends and leap days", () => {
    expect(lateness("2026-03-01", "2026-02-28")).toBe("overdue");
    expect(lateness("2028-03-01", "2028-02-29")).toBe("overdue");
    expect(lateness("2028-02-28", "2028-02-29")).toBe("later");
    expect(lateness("2027-01-01", "2026-12-31")).toBe("overdue");
    expect(lateness("2026-12-31", "2027-01-01")).toBe("later");
  });

  it("marks an earlier balance as an earlier balance, whatever the day", () => {
    const line = feeLine(due({ kind: "opening", month: null, dueDate: "2026-08-01" }), "2026-10-12");
    expect(line).toMatchObject({ earlier: true, month: null, late: "overdue" });
  });
});

describe("dayNumber", () => {
  it("counts days since 1970-01-01", () => {
    expect(dayNumber("1970-01-01")).toBe(0);
    expect(dayNumber("1970-01-02")).toBe(1);
    expect(dayNumber("2000-03-01")).toBe(11017);
    expect(dayNumber("2026-10-12")).toBe(20738);
  });
  it("refuses a day in the wrong shape", () => {
    expect(() => dayNumber("12 Oct 2026")).toThrow(RangeError);
  });
});

describe("feeLine", () => {
  it("carries what is still owed and what was already paid", () => {
    expect(feeLine(due({ amountPaid: 20000, remaining: 100000 }), "2026-10-12")).toEqual({
      earlier: false,
      month: "2026-10-01",
      dueDate: "2026-10-01",
      late: "overdue",
      remaining: 100000,
      alreadyPaid: 20000,
    });
  });
});

describe("upiNote", () => {
  const note = (change: Partial<{ openDues: OpenDue[]; openDuesMore: number; studentName: string }> = {}) =>
    upiNote({ openDues: [due()], openDuesMore: 0, studentName: "Ravi Kumar", ...change });

  it("is the month and the first name when it is plain Latin letters", () => {
    expect(note()).toBe("Fee Oct 2026 Ravi");
  });
  it("leaves the name out when it is not plain Latin letters", () => {
    expect(note({ studentName: "रवि कुमार" })).toBe("Fee Oct 2026");
    expect(note({ studentName: "Ravi2 Kumar" })).toBe("Fee Oct 2026");
    expect(note({ studentName: "Ravi-Kumar" })).toBe("Fee Oct 2026");
    expect(note({ studentName: "  " })).toBe("Fee Oct 2026");
  });
  it("cuts a long name so the whole note is at most 40 characters", () => {
    const text = note({ studentName: "A".repeat(60) });
    expect(text).toHaveLength(40);
    expect(text.startsWith("Fee Oct 2026 AAA")).toBe(true);
  });
  it("says Fees due for several open fees, and Fee balance for an earlier balance alone", () => {
    expect(note({ openDues: [due(), due({ month: "2026-09-01" })] })).toBe("Fees due Ravi");
    expect(note({ openDues: [due()], openDuesMore: 3 })).toBe("Fees due Ravi");
    expect(note({ openDues: [due({ kind: "opening", month: null })] })).toBe("Fee balance Ravi");
  });
  it("never holds a phone number or an amount", () => {
    expect(note()).not.toMatch(/\d{6}|₹|\+91/);
  });
});

describe("payeeName", () => {
  it("is the tutor's name as saved, tidied", () => {
    expect(payeeName("  Meena   Iyer ", "m@okhdfc")).toBe("Meena Iyer");
    expect(payeeName("मीना", "m@okhdfc")).toBe("मीना");
  });
  it("falls back to the name part of the UPI ID", () => {
    expect(payeeName(null, "meena.t@okhdfc")).toBe("meena.t");
    expect(payeeName("   ", "meena.t@okhdfc")).toBe("meena.t");
  });
  it("drops a lone surrogate so the link can always be built", () => {
    expect(payeeName("Meena\ud800 Iyer", "m@okhdfc")).toBe("Meena Iyer");
  });
});

describe("payArea", () => {
  it("builds the link on the parent's phone from the UPI ID, the name, the total and the note", () => {
    const area = payArea(fee({ totalRemaining: 120000, openDues: [due()], openDuesMore: 0 }));
    expect(area).toEqual({
      kind: "pay",
      upiId: "meena.tuitions@okhdfc",
      href: "upi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Iyer&am=1200.00&cu=INR&tn=Fee%20Oct%202026%20Ravi",
    });
  });
  it("asks for the total across every open fee, never one fee", () => {
    const area = payArea(fee());
    expect(area.kind === "pay" && area.href).toContain("&am=3400.00&");
  });
  it("builds the ceiling and shows the plain UPI ID one paisa above it", () => {
    expect(payArea(fee({ totalRemaining: PAY_PAGE_MAX_PAISE })).kind).toBe("pay");
    expect(payArea(fee({ totalRemaining: PAY_PAGE_MAX_PAISE + 1 }))).toEqual({ kind: "too-big", upiId: "meena.tuitions@okhdfc" });
  });
  it("has nothing to pay at zero, and says no UPI ID when there is none or it is not one", () => {
    expect(payArea(fee({ totalRemaining: 0, openDues: [] }))).toEqual({ kind: "nothing" });
    expect(payArea(fee({ totalRemaining: 0, openDues: [], upiId: null }))).toEqual({ kind: "nothing" });
    expect(payArea(fee({ upiId: null }))).toEqual({ kind: "no-upi" });
    expect(payArea(fee({ upiId: "not a upi id" }))).toEqual({ kind: "no-upi" });
    expect(payArea(fee({ upiId: null, totalRemaining: PAY_PAGE_MAX_PAISE + 1 }))).toEqual({ kind: "no-upi" });
  });
  it("keeps a paise amount exact with no float arithmetic", () => {
    const area = payArea(fee({ totalRemaining: 123456 }));
    expect(area.kind === "pay" && area.href).toContain("&am=1234.56&");
  });
  it("encodes a tutor name with an ampersand and a Hindi name", () => {
    const amp = payArea(fee({ tutorName: "Rao & Sons" }));
    expect(amp.kind === "pay" && amp.href).toContain("&pn=Rao%20%26%20Sons&");
    const hi = payArea(fee({ tutorName: "मीना अय्यर" }));
    expect(hi.kind === "pay" && new URL(hi.href).searchParams.get("pn")).toBe("मीना अय्यर");
  });
});
