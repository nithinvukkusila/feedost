// The fee reminder library (spec R0-2, plan section 6). The expected strings are the plan's tables,
// typed out here; they are not this code's own output.
import { describe, expect, it } from "vitest";
import { locales, type Locale } from "@/config/locales";
import {
  amountInput,
  checkAmount,
  checkName,
  checkUpiId,
  cleanName,
  currentMonth,
  monthName,
  reminderParts,
  reminderText,
  upiLink,
  whatsAppLink,
  MAX_PAISE,
  MIN_PAISE,
  NAME_MAX,
  UPI_ID,
  type Tone,
} from "./reminder";

const fail = (error: string) => ({ ok: false, error });
const pass = <V>(value: V) => ({ ok: true, value });

describe("the limits", () => {
  it("are 40 characters, ₹1 and ₹1,00,000, and the PRD pattern with no flags", () => {
    expect(NAME_MAX).toBe(40);
    expect(MIN_PAISE).toBe(100);
    expect(MAX_PAISE).toBe(10_000_000);
    expect(UPI_ID.source).toBe("^[\\w.\\-]{2,256}@[a-zA-Z]{2,64}$");
    expect(UPI_ID.flags).toBe("");
  });
});

describe("checkName (criteria 12, 18)", () => {
  it.each(["", "   ", "\u0007"])("%j is missing", (raw) => {
    expect(checkName(raw)).toEqual(fail("missing"));
  });

  it("trims the ends", () => {
    expect(checkName("  Suresh  ")).toEqual(pass("Suresh"));
  });

  it.each(["Suresh   Kumar", "\tSuresh  Kumar\n"])("%j becomes one space between the words", (raw) => {
    expect(checkName(raw)).toEqual(pass("Suresh Kumar"));
  });

  it("allows 40 characters, also with spaces round them", () => {
    expect(checkName("a".repeat(40))).toEqual(pass("a".repeat(40)));
    expect(checkName(` ${"a".repeat(40)} `)).toEqual(pass("a".repeat(40)));
  });

  it("refuses 41", () => {
    expect(checkName("a".repeat(41))).toEqual(fail("tooLong"));
  });

  it("counts an emoji as one character", () => {
    expect("🙂".repeat(40)).toHaveLength(80);
    expect(checkName("🙂".repeat(40))).toEqual(pass("🙂".repeat(40)));
    expect(checkName("🙂".repeat(41))).toEqual(fail("tooLong"));
  });

  it("counts Telugu letters one each", () => {
    expect(checkName("క".repeat(40))).toEqual(pass("క".repeat(40)));
    expect(checkName("క".repeat(41))).toEqual(fail("tooLong"));
  });

  it.each(["వెంకట సుబ్బారావు", "Suresh 🙂", "R&D #1 100% A+B"])("%s is kept as typed", (raw) => {
    expect(checkName(raw)).toEqual(pass(raw));
  });

  it("drops a lone surrogate, which would break the link encoding", () => {
    expect(checkName("A\uD83D")).toEqual(pass("A"));
    expect(() => encodeURIComponent("A\uD83D")).toThrow(URIError);
  });

  it("drops a control character", () => {
    expect(checkName("Su\u0000resh")).toEqual(pass("Suresh"));
  });

  it("keeps the joiner Indian scripts and emoji need", () => {
    const result = checkName("a‍b");
    expect(result).toEqual(pass("a‍b"));
    expect(Array.from("a‍b")).toHaveLength(3);
  });

  it("cleanName turns a no-break space into a space and drops a C1 control", () => {
    expect(cleanName("A B\u0085C")).toBe("A BC");
  });
});

describe("checkAmount (criterion 14)", () => {
  it.each(["", "  ", "₹"])("%j is missing", (raw) => {
    expect(checkAmount(raw)).toEqual(fail("missing"));
  });

  it.each(["1200", "1,200", "₹ 1,200", "1 200", "१२००", "೧೨೦೦", "౧౨౦౦", "१,२००"])("%s is 120000 paise", (raw) => {
    expect(checkAmount(raw)).toEqual(pass(120000));
  });

  it("reads 1 as 100 paise and 0012 as 1200 paise", () => {
    expect(checkAmount("1")).toEqual(pass(100));
    expect(checkAmount("0012")).toEqual(pass(1200));
  });

  it.each(["100000", "1,00,000"])("%s is the highest amount", (raw) => {
    expect(checkAmount(raw)).toEqual(pass(10000000));
  });

  it.each(["100001", "1,00,001", "99999999999999999999"])("%s is too high", (raw) => {
    expect(checkAmount(raw)).toEqual(fail("tooHigh"));
  });

  it.each(["0", "000"])("%s is too low", (raw) => {
    expect(checkAmount(raw)).toEqual(fail("tooLow"));
  });

  it.each(["1200.50", "1200.00", "1200.", ".50", ".", "1.2.3", "१२००.५०"])("%s has paise", (raw) => {
    expect(checkAmount(raw)).toEqual(fail("paise"));
  });

  // Arabic-Indic digits are not one of our three scripts.
  it.each(["12a", "-5", "1e3", "1200/-", "Rs 1200", "١٢٠٠"])("%s is not digits", (raw) => {
    expect(checkAmount(raw)).toEqual(fail("notDigits"));
  });

  it("always gives a whole number of paise that is a whole number of rupees", () => {
    for (const raw of ["1", "7", "1200", "99,999", "1,00,000"]) {
      const result = checkAmount(raw);
      expect(result.ok && Number.isInteger(result.value) && result.value % 100 === 0).toBe(true);
    }
  });
});

describe("checkUpiId (criterion 16)", () => {
  it.each(["", "   "])("%j is missing", (raw) => {
    expect(checkUpiId(raw)).toEqual(fail("missing"));
  });

  it("trims the ends", () => {
    expect(checkUpiId("  meena.tuitions@okhdfc  ")).toEqual(pass("meena.tuitions@okhdfc"));
  });

  it.each(["meena tuitions@okhdfc", "meena.tuitions@ok hdfc"])("%s has a space inside", (raw) => {
    expect(checkUpiId(raw)).toEqual(fail("space"));
  });

  it("needs an @", () => {
    expect(checkUpiId("meena.tuitions")).toEqual(fail("noAt"));
  });

  it.each([
    "meena@",
    "@okhdfc",
    "m@okhdfc",
    "meena@o",
    "meena@ok1",
    "meena@@okhdfc",
    "मीना@okhdfc",
    "meena+fees@okhdfc",
    "meena%40x@okhdfc",
    "meena&x@okhdfc",
    "meena#1@okhdfc",
    `${"a".repeat(257)}@okhdfc`,
    `meena@${"b".repeat(65)}`,
  ])("%s does not match the pattern", (raw) => {
    expect(checkUpiId(raw)).toEqual(fail("format"));
  });

  it.each(["ravi_kumar.99-a@okaxis", "a_b_c@okaxis", "9876543210@ybl", "me@ok", "Meena.Rao@OkHDFC"])("%s passes unchanged, case kept", (raw) => {
    expect(checkUpiId(raw)).toEqual(pass(raw));
  });

  it("allows the longest ID the pattern admits, 321 characters", () => {
    const longest = `${"a".repeat(256)}@${"b".repeat(64)}`;
    expect(longest).toHaveLength(321);
    expect(checkUpiId(longest)).toEqual(pass(longest));
  });
});

describe("amountInput, monthName, currentMonth (criteria 13, 15, 25)", () => {
  it("writes the amount with Indian grouping and no rupee sign", () => {
    expect([100, 120000, 500000, 10000000].map(amountInput)).toEqual(["1", "1,200", "5,000", "1,00,000"]);
  });

  it("names October in each language", () => {
    expect(locales.map((locale) => monthName(locale, 9))).toEqual(["October", "अक्टूबर", "ಅಕ್ಟೋಬರ್", "అక్టోబర్"]);
  });

  it.each([12, -1, 1.5])("monthName refuses the month %s", (month) => {
    expect(() => monthName("en", month)).toThrow(RangeError);
  });

  it("reads the month from the clock, in local time", () => {
    expect(currentMonth(new Date(2026, 9, 10))).toBe(9);
    expect(currentMonth(new Date(2026, 0, 1))).toBe(0);
    expect(currentMonth(new Date(2026, 11, 31, 23, 59))).toBe(11);
  });

  it("uses now when given nothing", () => {
    expect(currentMonth()).toBe(new Date().getMonth());
  });
});

const B = { upiId: "meena.tuitions@okhdfc", payeeName: "Meena Rao", paise: 120000, month: 9 };
const HEAD = "upi://pay?pa=meena.tuitions@okhdfc";
const TAIL = "&am=1200.00&cu=INR&tn=October%20fee";

describe("upiLink (criteria 31 to 33)", () => {
  const rows: [string, Partial<typeof B>, string][] = [
    ["the canvas example", {}, "upi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee"],
    [
      "a name with & # % +",
      { payeeName: "R&D Classes #1 100% A+B" },
      "upi://pay?pa=meena.tuitions@okhdfc&pn=R%26D%20Classes%20%231%20100%25%20A%2BB&am=1200.00&cu=INR&tn=October%20fee",
    ],
    ["a name with / ? =", { payeeName: "A/B? C=D" }, `${HEAD}&pn=A%2FB%3F%20C%3DD${TAIL}`],
    ["the characters the encoder leaves alone", { payeeName: "D'Souza (Maths)!*~" }, `${HEAD}&pn=D'Souza%20(Maths)!*~${TAIL}`],
    ["a Hindi name", { payeeName: "मीना राव" }, `${HEAD}&pn=%E0%A4%AE%E0%A5%80%E0%A4%A8%E0%A4%BE%20%E0%A4%B0%E0%A4%BE%E0%A4%B5${TAIL}`],
    [
      "a Kannada name",
      { payeeName: "ಮೀನಾ ರಾವ್" },
      `${HEAD}&pn=%E0%B2%AE%E0%B3%80%E0%B2%A8%E0%B2%BE%20%E0%B2%B0%E0%B2%BE%E0%B2%B5%E0%B3%8D${TAIL}`,
    ],
    [
      "a Telugu name",
      { payeeName: "మీనా రావు" },
      `${HEAD}&pn=%E0%B0%AE%E0%B1%80%E0%B0%A8%E0%B0%BE%20%E0%B0%B0%E0%B0%BE%E0%B0%B5%E0%B1%81${TAIL}`,
    ],
    ["an emoji", { payeeName: "Meena 🙂" }, `${HEAD}&pn=Meena%20%F0%9F%99%82${TAIL}`],
    ["a 40-letter name", { payeeName: "a".repeat(40) }, `${HEAD}&pn=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa${TAIL}`],
    [
      "an ID with _ . -",
      { upiId: "ravi_kumar.99-a@okaxis" },
      "upi://pay?pa=ravi_kumar.99-a@okaxis&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee",
    ],
    [
      "a phone-number ID, ₹1, January",
      { upiId: "9876543210@ybl", paise: 100, month: 0 },
      "upi://pay?pa=9876543210@ybl&pn=Meena%20Rao&am=1.00&cu=INR&tn=January%20fee",
    ],
    ["₹5,000 in May", { paise: 500000, month: 4 }, `${HEAD}&pn=Meena%20Rao&am=5000.00&cu=INR&tn=May%20fee`],
    ["₹1,00,000 in December", { paise: 10000000, month: 11 }, `${HEAD}&pn=Meena%20Rao&am=100000.00&cu=INR&tn=December%20fee`],
  ];

  it.each(rows)("%s", (_name, change, expected) => {
    const input = { ...B, ...change };
    const link = upiLink(input);
    expect(link).toBe(expected);

    // The shape every link has (criteria 31, 32).
    expect(link.startsWith("upi://pay?pa=")).toBe(true);
    const query = link.slice("upi://pay?".length).split("&");
    expect(query.map((pair) => pair.slice(0, pair.indexOf("=")))).toEqual(["pa", "pn", "am", "cu", "tn"]);
    expect(link).not.toContain("+");
    expect(link).not.toContain(" ");
    for (const extra of ["mc=", "tr=", "mode=", "sign="]) expect(link).not.toContain(extra);
    expect(query[2].slice(3)).toMatch(/^\d+\.00$/);
    expect(query[2]).not.toContain(",");
    expect(query[3]).toBe("cu=INR");
    // Money goes to the typed ID and to nobody else.
    expect(link.slice("upi://pay?pa=".length, link.indexOf("&pn="))).toBe(input.upiId);
  });

  const bad: [string, Partial<typeof B>][] = [
    ["an ID with a space", { upiId: "meena tuitions@okhdfc" }],
    ["an ID with no @", { upiId: "meena" }],
    ["no name", { payeeName: "" }],
    ["nothing to pay", { paise: 0 }],
    ["paise", { paise: 120050 }],
    ["over the limit", { paise: 10000100 }],
    ["a fraction of a paisa", { paise: 1200.5 }],
    ["month 12", { month: 12 }],
    ["month -1", { month: -1 }],
    ["month 1.5", { month: 1.5 }],
  ];

  it.each(bad)("throws RangeError for %s", (_name, change) => {
    expect(() => upiLink({ ...B, ...change })).toThrow(RangeError);
  });

  it("writes the note in English whatever the message language", () => {
    for (const locale of locales) {
      const text = reminderText(reminderParts({ locale, tone: "polite", parent: "Suresh", ...B }));
      expect(text).toContain("&tn=October%20fee\n");
    }
  });
});

const F = { parent: "Suresh", paise: 120000, month: 9, upiId: "meena.tuitions@okhdfc", payeeName: "Meena Rao" };
const LINK = "upi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee";
const message = (locale: Locale, tone: Tone, change: Partial<typeof F> = {}) => reminderText(reminderParts({ locale, tone, ...F, ...change }));

// Each expected message is the spec's template (criteria 22, 23) with the five values put in by hand.
const expected: Record<Locale, Record<Tone, string>> = {
  en: {
    polite:
      "Hello Suresh ji, a gentle reminder that the tuition fee of ₹1,200 for October is due. You can pay by UPI with this link:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nOr pay to UPI ID: meena.tuitions@okhdfc\nThank you!",
    firm: "Hello Suresh ji, the tuition fee of ₹1,200 for October is still pending. Please pay it today by UPI with this link:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nOr pay to UPI ID: meena.tuitions@okhdfc\nThank you.",
  },
  hi: {
    polite:
      "नमस्ते Suresh जी, यह याद दिलाना था कि अक्टूबर की ट्यूशन फ़ीस ₹1,200 बाकी है। आप इस लिंक से UPI द्वारा भुगतान कर सकते हैं:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nया इस UPI ID पर भेजें: meena.tuitions@okhdfc\nधन्यवाद!",
    firm: "नमस्ते Suresh जी, अक्टूबर की ट्यूशन फ़ीस ₹1,200 अभी तक बाकी है। कृपया आज ही इस लिंक से UPI द्वारा भुगतान कर दें:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nया इस UPI ID पर भेजें: meena.tuitions@okhdfc\nधन्यवाद।",
  },
  kn: {
    polite:
      "ನಮಸ್ಕಾರ Suresh ಅವರೇ, ಅಕ್ಟೋಬರ್ ತಿಂಗಳ ಟ್ಯೂಷನ್ ಶುಲ್ಕ ₹1,200 ಬಾಕಿ ಇದೆ ಎಂದು ನೆನಪಿಸುತ್ತಿದ್ದೇನೆ. ಈ ಲಿಂಕ್ ಮೂಲಕ UPI ನಲ್ಲಿ ಪಾವತಿಸಬಹುದು:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nಅಥವಾ ಈ UPI ID ಗೆ ಕಳುಹಿಸಿ: meena.tuitions@okhdfc\nಧನ್ಯವಾದಗಳು!",
    firm: "ನಮಸ್ಕಾರ Suresh ಅವರೇ, ಅಕ್ಟೋಬರ್ ತಿಂಗಳ ಟ್ಯೂಷನ್ ಶುಲ್ಕ ₹1,200 ಇನ್ನೂ ಬಾಕಿ ಇದೆ. ದಯವಿಟ್ಟು ಇಂದೇ ಈ ಲಿಂಕ್ ಮೂಲಕ UPI ನಲ್ಲಿ ಪಾವತಿಸಿ:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nಅಥವಾ ಈ UPI ID ಗೆ ಕಳುಹಿಸಿ: meena.tuitions@okhdfc\nಧನ್ಯವಾದಗಳು.",
  },
  te: {
    polite:
      "నమస్కారం Suresh గారు, అక్టోబర్ నెల ట్యూషన్ ఫీజు ₹1,200 చెల్లించాల్సి ఉందని గుర్తు చేస్తున్నాను. ఈ లింక్ ద్వారా UPI లో చెల్లించవచ్చు:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nలేదా ఈ UPI ID కి పంపండి: meena.tuitions@okhdfc\nధన్యవాదాలు!",
    firm: "నమస్కారం Suresh గారు, అక్టోబర్ నెల ట్యూషన్ ఫీజు ₹1,200 ఇంకా బాకీ ఉంది. దయచేసి ఈ రోజే ఈ లింక్ ద్వారా UPI లో చెల్లించండి:\nupi://pay?pa=meena.tuitions@okhdfc&pn=Meena%20Rao&am=1200.00&cu=INR&tn=October%20fee\nలేదా ఈ UPI ID కి పంపండి: meena.tuitions@okhdfc\nధన్యవాదాలు.",
  },
};

const pairs = locales.flatMap((locale) => (["polite", "firm"] as const).map((tone) => [locale, tone] as const));
const PREFIX = "https://wa.me/?text=";

describe("the message (criteria 21 to 26)", () => {
  it.each(pairs)("%s %s is the spec's template with the values put in", (locale, tone) => {
    expect(message(locale, tone)).toBe(expected[locale][tone]);
  });

  it.each(pairs)("%s %s has four lines, the second exactly the UPI link", (locale, tone) => {
    const text = message(locale, tone)!;
    expect(text.split("\n")).toHaveLength(4);
    expect(text).not.toContain("\r");
    expect(text).not.toContain("\n\n");
    expect(text.split("\n")[1]).toBe(LINK);
    expect(text.split("\n")[1]).toBe(upiLink(B));
    // The plain UPI ID line is the fallback where the link does nothing.
    expect(text.split("\n")[2].endsWith(": meena.tuitions@okhdfc")).toBe(true);
    expect(text).toContain("₹1,200");
  });

  it("writes the amount with 0-9 digits and Indian grouping in every language (criterion 24)", () => {
    for (const locale of locales) expect(message(locale, "polite", { paise: 10000000 })).toContain("₹1,00,000");
  });

  it("never looks for a placeholder inside a typed value", () => {
    const text = message("en", "polite", { parent: "{link} {amount} $& $1 $$" })!;
    expect(text.split("\n")[0]).toBe(
      "Hello {link} {amount} $& $1 $$ ji, a gentle reminder that the tuition fee of ₹1,200 for October is due. You can pay by UPI with this link:",
    );
    expect(text.split("\n")).toHaveLength(4);
  });

  it("gives the parts in order, with a blank for each missing value", () => {
    const parts = reminderParts({ locale: "en", tone: "firm", parent: null, paise: 120000, month: null, upiId: null, payeeName: "Meena Rao" });
    expect(parts).toEqual([
      { kind: "text", text: "Hello " },
      { kind: "blank", slot: "parent" },
      { kind: "text", text: " ji, the tuition fee of " },
      { kind: "value", slot: "amount", text: "₹1,200" },
      { kind: "text", text: " for " },
      { kind: "blank", slot: "month" },
      { kind: "text", text: " is still pending. Please pay it today by UPI with this link:\n" },
      { kind: "blank", slot: "link" },
      { kind: "text", text: "\nOr pay to UPI ID: " },
      { kind: "blank", slot: "upiId" },
      { kind: "text", text: "\nThank you." },
    ]);
    expect(reminderText(parts)).toBeNull();
  });

  it.each(["upiId", "payeeName", "paise", "month"] as const)("leaves the link blank while %s is missing", (key) => {
    const parts = reminderParts({ locale: "en", tone: "polite", ...F, [key]: null });
    expect(parts.find((part) => part.kind !== "text" && part.slot === "link")).toEqual({ kind: "blank", slot: "link" });
    expect(reminderText(parts)).toBeNull();
  });

  it("fills the link when all four are there, even with no parent yet", () => {
    const parts = reminderParts({ locale: "en", tone: "polite", ...F, parent: null });
    expect(parts.find((part) => part.kind !== "text" && part.slot === "link")).toEqual({ kind: "value", slot: "link", text: LINK });
  });
});

describe("whatsAppLink (criteria 35, 36, 38)", () => {
  it("is the plan's exact address for the English polite message", () => {
    expect(whatsAppLink(message("en", "polite")!)).toBe(
      "https://wa.me/?text=Hello%20Suresh%20ji%2C%20a%20gentle%20reminder%20that%20the%20tuition%20fee%20of%20%E2%82%B91%2C200%20for%20October%20is%20due.%20You%20can%20pay%20by%20UPI%20with%20this%20link%3A%0Aupi%3A%2F%2Fpay%3Fpa%3Dmeena.tuitions%40okhdfc%26pn%3DMeena%2520Rao%26am%3D1200.00%26cu%3DINR%26tn%3DOctober%2520fee%0AOr%20pay%20to%20UPI%20ID%3A%20meena.tuitions%40okhdfc%0AThank%20you!",
    );
    expect(whatsAppLink(message("en", "polite")!)).toHaveLength(390);
  });

  it("encodes names with & # % + once in the message and twice inside the link", () => {
    expect(whatsAppLink(message("en", "polite", { parent: "Asha & Ravi #2 100% A+B", payeeName: "R&D Classes #1 100% A+B" })!)).toBe(
      "https://wa.me/?text=Hello%20Asha%20%26%20Ravi%20%232%20100%25%20A%2BB%20ji%2C%20a%20gentle%20reminder%20that%20the%20tuition%20fee%20of%20%E2%82%B91%2C200%20for%20October%20is%20due.%20You%20can%20pay%20by%20UPI%20with%20this%20link%3A%0Aupi%3A%2F%2Fpay%3Fpa%3Dmeena.tuitions%40okhdfc%26pn%3DR%2526D%2520Classes%2520%25231%2520100%2525%2520A%252BB%26am%3D1200.00%26cu%3DINR%26tn%3DOctober%2520fee%0AOr%20pay%20to%20UPI%20ID%3A%20meena.tuitions%40okhdfc%0AThank%20you!",
    );
  });

  it("starts the Hindi polite link with the encoded greeting and carries the link between two line feeds", () => {
    const link = whatsAppLink(message("hi", "polite")!);
    expect(link.startsWith("https://wa.me/?text=%E0%A4%A8%E0%A4%AE%E0%A4%B8%E0%A5%8D%E0%A4%A4%E0%A5%87%20Suresh%20%E0%A4%9C%E0%A5%80%2C%20")).toBe(true);
    expect(link).toContain("%0Aupi%3A%2F%2Fpay%3Fpa%3Dmeena.tuitions%40okhdfc%26pn%3DMeena%2520Rao%26am%3D1200.00%26cu%3DINR%26tn%3DOctober%2520fee%0A");
  });

  it.each(pairs)("%s %s: decoding the link gives the message back, and the link carries no phone number", (locale, tone) => {
    const text = message(locale, tone)!;
    const link = whatsAppLink(text);
    expect(link.startsWith(PREFIX)).toBe(true);
    expect(decodeURIComponent(link.slice(PREFIX.length))).toBe(text);
    expect(link.slice("https://wa.me/".length, link.indexOf("?"))).toBe("");
    expect(link).not.toContain(" ");
    expect(link).not.toContain("+");
    expect(link).not.toContain("\n");
    expect(link.match(/%0A/g)).toHaveLength(3);
    // Under 2,000 characters for the canvas example (criterion 38).
    expect(link.length).toBeLessThan(2000);
  });

  it.each(pairs)("%s %s stays under 6,000 characters with every field at its longest", (locale, tone) => {
    const longestId = `${"a".repeat(256)}@${"b".repeat(64)}`;
    for (const name of ["క".repeat(40), "🙂".repeat(40)]) {
      const text = message(locale, tone, { parent: name, payeeName: name, upiId: longestId, paise: MAX_PAISE, month: 8 })!;
      const link = whatsAppLink(text);
      expect(link.length).toBeLessThan(6000);
      expect(decodeURIComponent(link.slice(PREFIX.length))).toBe(text);
    }
  });
});

describe("names with invisible characters", () => {
  const ch = (...codes: number[]) => String.fromCodePoint(...codes);

  it("cleanName drops direction marks and zero-width characters", () => {
    expect(cleanName(`Su${ch(0x202e)}resh`)).toBe("Suresh");
    expect(cleanName(`${ch(0x2066)}Meena${ch(0x2069)} ${ch(0x200e)}Rao${ch(0x200f)}`)).toBe("Meena Rao");
    expect(cleanName(`Me${ch(0x200b)}ena${ch(0xfeff)}`)).toBe("Meena");
  });

  it("cleanName keeps the joiners that Indian scripts need", () => {
    const conjunct = ch(0x0915, 0x094d, 0x200d, 0x0937);
    expect(cleanName(conjunct)).toBe(conjunct);
  });

  it("a name with nothing visible is missing, not filled in", () => {
    expect(cleanName(ch(0x200b))).toBe("");
    expect(cleanName(ch(0x200d, 0x200c))).toBe("");
    expect(checkName(ch(0x200b, 0x202e)).ok).toBe(false);
  });
});
