// The pay page's words (spec R1-9 Part B, criteria 36 and 40, plan B4 and B6).
import { describe, expect, it } from "vitest";
import { locales } from "@/config/locales";
import { fill } from "./public-words";
import { monthLabel, subjectsLine } from "./receipt-words";
import { monthWordsOf, pageWords } from "./pay-page-words";
import { getAllWords } from "@/i18n/words";
import en from "../../messages/en.json";

describe("pageWords", () => {
  it("joins the pay page words with only the receipt's month and subject words, per language", async () => {
    const all = pageWords(await getAllWords("payPage"), await getAllWords("receipt"));
    expect(Object.keys(all)).toEqual([...locales]);
    for (const locale of locales) {
      expect(Object.keys(all[locale]!)).toEqual(["pay", "receipt", "consentLang"]);
      // Each language's consent lines are its own here; payPageWords sets "en" while the wording is a draft.
      expect(all[locale]!.consentLang).toBe(locale);
      expect(Object.keys(all[locale]!.receipt).sort()).toEqual(["earlier", "monthYear", "months", "subjects", "tuition"]);
    }
    expect(monthLabel(all.hi!.receipt, "2026-10-01")).toBe("अक्तूबर 2026");
    expect(monthLabel(all.en.receipt, "2026-10-01")).toBe("October 2026");
    expect(subjectsLine(all.en.receipt, ["maths", "Sanskrit"])).toBe("Maths, Sanskrit tuition");
  });

  it("monthWordsOf takes nothing else from the receipt", () => {
    expect(Object.keys(monthWordsOf(en.receipt)).sort()).toEqual(["earlier", "monthYear", "months", "subjects", "tuition"]);
  });
});

describe("the English words", () => {
  it("fill their arguments", () => {
    expect(fill(en.payPage.pay, { amount: "₹3,400" })).toBe("Pay ₹3,400 with UPI");
    expect(fill(en.payPage.line.fee, { month: "October 2026", date: "01 Oct 2026" })).toBe("October 2026 fee, due 01 Oct 2026");
    expect(fill(en.payPage.consent.intro, { tutor: "Meena Iyer" })).toBe("Meena Iyer uses this service to share fee details with you. This is what is kept:");
  });

  it("never say paid, done or success about a payment the page has not seen, outside the words that are about receipts", () => {
    const allowed = new Set(["paidAlready", "allPaid", "receipt.paid", "receipt.part", "line.alreadyPaid"]);
    const walk = (node: Record<string, unknown>, path = ""): string[] =>
      Object.entries(node).flatMap(([key, value]) =>
        typeof value === "string" ? [`${path}${key}|${value}`] : walk(value as Record<string, unknown>, `${path}${key}.`),
      );
    const offenders = walk(en.payPage)
      .filter((entry) => /\b(paid|done|success)\b/i.test(entry.split("|")[1]))
      .map((entry) => entry.split("|")[0])
      .filter((key) => !allowed.has(key));
    expect(offenders).toEqual([]);
  });

  it("keeps the spec's consent wording verbatim (it is the founder's to approve, not ours to rewrite)", () => {
    expect(en.payPage.consent).toMatchObject({
      title: "Before you see the fee, a word on privacy.",
      intro: "{tutor} uses this service to share fee details with you. This is what is kept:",
      phone: "Your phone number",
      child: "Your child's name, fee and attendance",
      never: "Never: ads, or tracking of children",
      notAgree: "Not agreeing? Just close this page. Nothing is saved.",
    });
  });
});
