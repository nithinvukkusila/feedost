// The R0-2 builder as the app uses it (spec R1-8, criteria 5 to 12): earlier balance, a higher ceiling,
// a ready-made link and `waLink`. The tool's own tests are in reminder.test.ts and are not changed.
import { describe, expect, it } from "vitest";
import { locales } from "@/config/locales";
import { buildAppMessage, greetingName, parentWord } from "./app-message";
import { APP_MAX_PAISE, checkAmount, MAX_PAISE, reminderParts, reminderText, upiLink, waLink } from "./reminder";
import app from "./templates.app.json";

const tutor = { upiId: "ashab@okaxis", name: "Asha Rao" };
const student = (over: Partial<{ parentName: string | null; parentLanguage: (typeof locales)[number] }> = {}) => ({
  parentName: "Sunita",
  parentLanguage: "en" as const,
  ...over,
});
const monthly = (over = {}) => ({ kind: "monthly" as const, month: "2026-10-01", amount: 150_000, amountPaid: 50_000, ...over });
const opening = (over = {}) => ({ kind: "opening" as const, month: null, amount: 250_000, amountPaid: 0, ...over });

describe("upiLink for the app", () => {
  it("the tool path is unchanged: whole rupees to Rs 1,00,000 and a month note", () => {
    const link = upiLink({ upiId: "ab@okaxis", payeeName: "A B", paise: 100_000, month: 9 });
    expect(link).toBe("upi://pay?pa=ab@okaxis&pn=A%20B&am=1000.00&cu=INR&tn=October%20fee");
    expect(() => upiLink({ upiId: "ab@okaxis", payeeName: "A", paise: MAX_PAISE + 100, month: 9 })).toThrow(RangeError);
    expect(() => upiLink({ upiId: "ab@okaxis", payeeName: "A", paise: 150, month: 9 })).toThrow(RangeError);
    expect(() => upiLink({ upiId: "ab@okaxis", payeeName: "A", paise: 100, month: null })).toThrow(RangeError);
  });

  it("the app path takes up to Rs 10,00,000 and still refuses above it", () => {
    const link = upiLink({ upiId: "ab@okaxis", payeeName: "A", paise: APP_MAX_PAISE, month: 0, maxPaise: APP_MAX_PAISE });
    expect(link).toContain("&am=1000000.00&");
    expect(() => upiLink({ upiId: "ab@okaxis", payeeName: "A", paise: APP_MAX_PAISE + 1, month: 0, maxPaise: APP_MAX_PAISE })).toThrow(RangeError);
    expect(() => upiLink({ upiId: "ab@okaxis", payeeName: "A", paise: 0, month: 0, maxPaise: APP_MAX_PAISE })).toThrow(RangeError);
    expect(checkAmount("1000000")).toEqual({ ok: false, error: "tooHigh" }); // the tool still stops at Rs 1,00,000
  });

  it("writes paise by integer arithmetic", () => {
    const am = (paise: number) => upiLink({ upiId: "ab@okaxis", payeeName: "A", paise, month: 0, maxPaise: APP_MAX_PAISE }).match(/&am=([^&]+)&/)?.[1];
    expect(am(100_000)).toBe("1000.00");
    expect(am(100_050)).toBe("1000.50");
    expect(am(100_005)).toBe("1000.05");
    expect(am(99)).toBe("0.99");
    expect(am(1)).toBe("0.01");
  });

  it("an earlier balance has the note Fee balance and needs no month", () => {
    const link = upiLink({ upiId: "ab@okaxis", payeeName: "A", paise: 100, month: null, kind: "balance", maxPaise: APP_MAX_PAISE });
    expect(link.endsWith("&tn=Fee%20balance")).toBe(true);
  });
});

describe("reminderParts with the app's options", () => {
  const base = { locale: "en", tone: "polite", parent: "S", paise: 100_000, month: 9, upiId: "ab@okaxis", payeeName: "A" } as const;

  it("a ready-made link replaces the UPI link and nothing else changes", () => {
    const text = reminderText(reminderParts({ ...base, link: "https://pay.example/x" }));
    expect(text).toContain("\nhttps://pay.example/x\n");
    expect(text).not.toContain("upi://");
    expect(text).toContain("Or pay to UPI ID: ab@okaxis");
  });

  it("without the app's options the output is the tool's", () => {
    expect(reminderText(reminderParts(base))).toContain("upi://pay?pa=ab@okaxis&pn=A&am=1000.00&cu=INR&tn=October%20fee");
  });

  it("a balance without its lines throws instead of falling back to the month template", () => {
    expect(() => reminderParts({ ...base, kind: "balance" })).toThrow(RangeError);
  });
});

describe("waLink (criterion 10)", () => {
  it("drops the plus and keeps +91 and ten digits", () => {
    expect(waLink("+919876543210", "Hi\nthere")).toBe("https://wa.me/919876543210?text=Hi%0Athere");
  });
  it.each(["9876543210", "+91987654321", "+9198765432100", "+449876543210", "+91 9876543210", "", "+91987654321a"])("refuses %j", (phone) => {
    expect(() => waLink(phone, "x")).toThrow(RangeError);
  });
  it("decoding the text gives the preview exactly", () => {
    const message = buildAppMessage({ student: student({ parentLanguage: "hi" }), due: monthly(), tutor, tone: "firm" });
    const url = new URL(waLink("+919876543210", message.text));
    expect(url.searchParams.get("text")).toBe(message.text);
    expect([...url.searchParams.keys()]).toEqual(["text"]);
  });
});

describe("buildAppMessage", () => {
  it("says what is still owed and the fee's own month (criterion 6)", () => {
    const m = buildAppMessage({ student: student(), due: monthly(), tutor, tone: "polite" });
    expect(m.text).toContain("₹1,000");
    expect(m.text).toContain("October");
    expect(m.text).toContain("am=1000.00");
    expect(m.link).toContain("tn=October%20fee");
    expect(m.template).toBe("polite:en:month");
  });

  it("the month is in the message language, the note stays English", () => {
    const m = buildAppMessage({ student: student({ parentLanguage: "hi" }), due: monthly(), tutor, tone: "polite" });
    expect(m.text).toContain("अक्टूबर");
    expect(m.link).toContain("tn=October%20fee");
    expect(m.template).toBe("polite:hi:month");
  });

  it("an earlier balance uses its own templates and the note Fee balance (criterion 8)", () => {
    for (const locale of locales) {
      for (const tone of ["polite", "firm"] as const) {
        const m = buildAppMessage({ student: student({ parentLanguage: locale }), due: opening(), tutor, tone });
        expect(m.text.split("\n")[0]).toBe(
          app[locale][tone][0].replace("{parent}", "Sunita").replace("{amount}", "₹2,500"),
        );
        expect(m.link).toContain("tn=Fee%20balance");
        expect(m.template).toBe(`${tone}:${locale}:balance`);
      }
    }
  });

  it("a fee of Rs 10,00,000 makes a link and a message and does not throw (criterion 7)", () => {
    const m = buildAppMessage({ student: student(), due: monthly({ amount: APP_MAX_PAISE, amountPaid: 0 }), tutor, tone: "polite" });
    expect(m.text).toContain("₹10,00,000");
    expect(m.link).toContain("am=1000000.00");
  });

  it("a part payment with paise writes them in the link", () => {
    const m = buildAppMessage({ student: student(), due: monthly({ amount: 150_050, amountPaid: 50_000 }), tutor, tone: "polite" });
    expect(m.link).toContain("am=1000.50");
    expect(m.text).toContain("₹1,000.50");
  });

  it("uses a ready-made link when given one", () => {
    const m = buildAppMessage({ student: student(), due: monthly(), tutor, tone: "polite", link: "https://pay.example/t" });
    expect(m.link).toBe("https://pay.example/t");
    expect(m.text).not.toContain("upi://");
  });

  it("is never English for a Hindi, Kannada or Telugu parent (criterion 9)", () => {
    const english = buildAppMessage({ student: student(), due: opening(), tutor, tone: "polite" }).text.split("\n")[0];
    for (const locale of ["hi", "kn", "te"] as const) {
      const m = buildAppMessage({ student: student({ parentLanguage: locale }), due: opening(), tutor, tone: "polite" });
      expect(m.text).not.toContain("TODO-translate");
      expect(m.text.split("\n")[0]).not.toBe(english);
      expect(m.text).not.toMatch(/Hello|Thank you/);
    }
  });

  it("no parent name: the generic word of the parent's language, never blank (criterion 11)", () => {
    const words = { en: "Parent", hi: "अभिभावक", kn: "ಪೋಷಕರು", te: "తల్లిదండ్రులు" };
    for (const locale of locales) {
      expect(parentWord(locale)).toBe(words[locale]);
      for (const name of [null, "", "   ", "​", "\u0007"]) {
        const m = buildAppMessage({ student: student({ parentName: name, parentLanguage: locale }), due: monthly(), tutor, tone: "polite" });
        expect(m.text).toContain(words[locale]);
      }
    }
  });

  it("a long or odd parent name is cleaned, cut at 40 code points and put in as typed", () => {
    expect(greetingName("A".repeat(80), "en")).toBe("A".repeat(40));
    expect(greetingName("  Sunita \n Devi ", "en")).toBe("Sunita Devi");
    expect(greetingName("{link} $&", "en")).toBe("{link} $&");
    const m = buildAppMessage({ student: student({ parentName: "{link}" }), due: monthly(), tutor, tone: "polite" });
    expect(m.text).toContain("Hello {link} ji");
  });

  it("holds no student name, product name, phone or tracking claim, for every tone, language and kind (criterion 12)", () => {
    const studentName = "Zorbaxian Kid";
    for (const locale of locales) {
      for (const tone of ["polite", "firm"] as const) {
        for (const due of [monthly(), opening()]) {
          const m = buildAppMessage({ student: { ...student({ parentLanguage: locale }), name: studentName } as never, due, tutor, tone });
          expect(m.text).not.toContain(studentName);
          expect(m.text.toLowerCase()).not.toContain("feedost");
          expect(m.text).not.toMatch(/\+?91\d{10}/);
          expect(m.text.toLowerCase()).not.toMatch(/sent with|tracked|automatic/);
        }
      }
    }
  });

  it("throws, never half-builds, for a fee it cannot carry", () => {
    expect(() => buildAppMessage({ student: student(), due: monthly({ month: null }), tutor, tone: "polite" })).toThrow(RangeError);
    expect(() => buildAppMessage({ student: student(), due: monthly({ amount: APP_MAX_PAISE + 100, amountPaid: 0 }), tutor, tone: "polite" })).toThrow(RangeError);
    expect(() => buildAppMessage({ student: student(), due: monthly(), tutor: { upiId: "nope", name: "A" }, tone: "polite" })).toThrow(RangeError);
    expect(() => buildAppMessage({ student: student(), due: monthly(), tutor: { upiId: "ab@okaxis", name: " " }, tone: "polite" })).toThrow(RangeError);
  });
});
