// The fee receipt's plain functions (spec R0-3, criteria 11, 14 to 18, 20, 23, 25). A fixed clock throughout.
import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { locales } from "@/config/locales";
import {
  chooseShare,
  dropUnprintable,
  feeMonthLabel,
  feeMonths,
  fileName,
  hasUnprintable,
  isAllUnprintable,
  issueDate,
  monthFromKey,
  monthKey,
  receiptLines,
  scriptsNeeded,
  sentenceText,
  splitRuns,
  waLink,
  waText,
  type ReceiptInput,
} from "./receipt";
import templates from "./templates.json";

const NOW = new Date(2026, 9, 8, 14, 30); // 8 October 2026, local time
const october = { year: 2026, month: 9 };

const input = (over: Partial<ReceiptInput> = {}): ReceiptInput => ({
  lang: "en",
  tutor: "Meena Iyer",
  student: "Arjun",
  paise: 120_000,
  month: october,
  mode: "upi",
  now: NOW,
  ...over,
});

describe("feeMonths (criterion 11)", () => {
  it("is the current month and the 11 before, newest first", () => {
    const list = feeMonths(NOW);
    expect(list).toHaveLength(12);
    expect(list[0]).toEqual({ year: 2026, month: 9 });
    expect(list[11]).toEqual({ year: 2025, month: 10 });
  });

  it("steps back over a new year", () => {
    const list = feeMonths(new Date(2026, 0, 31));
    expect(list[0]).toEqual({ year: 2026, month: 0 });
    expect(list[1]).toEqual({ year: 2025, month: 11 });
    expect(list[11]).toEqual({ year: 2025, month: 1 });
  });

  it("labels a month with its name and year, in the language, with 0-9 digits", () => {
    expect(feeMonthLabel(october, "en")).toBe("October 2026");
    expect(feeMonthLabel(october, "hi")).toBe("अक्टूबर 2026");
    expect(feeMonthLabel(october, "kn")).toBe("ಅಕ್ಟೋಬರ್ 2026");
    expect(feeMonthLabel(october, "te")).toBe("అక్టోబర్ 2026");
  });

  it("finds a month from its key, and nothing for one that was not offered", () => {
    expect(monthFromKey(monthKey(october), NOW)).toEqual(october);
    expect(monthFromKey("2026-10", NOW)).toBeNull(); // next month
    expect(monthFromKey("2025-9", NOW)).toBeNull(); // 13 months back
    expect(monthFromKey("garbage", NOW)).toBeNull();
  });
});

describe("issueDate (criterion 15)", () => {
  it("is DD MMM YYYY with the short month of the receipt language", () => {
    expect(issueDate(NOW, "en")).toBe("08 Oct 2026");
    expect(issueDate(NOW, "hi")).toBe("08 अक्टू 2026");
    expect(issueDate(NOW, "kn")).toBe("08 ಅಕ್ಟೋ 2026");
    expect(issueDate(NOW, "te")).toBe("08 అక్టో 2026");
  });

  it("pads the day and uses the clock's own day, not tomorrow's", () => {
    expect(issueDate(new Date(2026, 0, 1, 0, 5), "en")).toBe("01 Jan 2026");
    expect(issueDate(new Date(2026, 11, 31, 23, 59), "en")).toBe("31 Dec 2026");
  });
});

describe("fileName (criterion 23)", () => {
  it("is ASCII, English short month and year, and holds no name", () => {
    expect(fileName(october)).toBe("fee-receipt-Oct-2026.pdf");
    for (let month = 0; month < 12; month++) expect(fileName({ year: 2026, month })).toMatch(/^fee-receipt-[A-Z][a-z]{2}-2026\.pdf$/);
  });
});

describe("receiptLines (criteria 14 to 18)", () => {
  it("says the English sentence of criterion 14, exactly", () => {
    const lines = receiptLines(input());
    expect(sentenceText(lines.sentence)).toBe("Received with thanks ₹1,200 from the family of Arjun by UPI towards the tuition fee for October 2026.");
    expect(lines.tutor).toBe("Meena Iyer");
    expect(lines.title).toBe("Fee receipt");
    expect(lines.date).toBe("Date: 08 Oct 2026");
    expect(lines.amount).toBe("₹1,200/-");
    expect(lines.stamp).toBe("PAID");
    expect(lines.stampDate).toBe("08 Oct 2026");
  });

  it("has no receipt number (D3)", () => {
    const text = JSON.stringify(receiptLines(input()));
    expect(text).not.toMatch(/No\.|№|\b001\b/);
  });

  it("draws the amount with Indian grouping and 0-9 digits in every language", () => {
    for (const lang of locales) {
      const lines = receiptLines(input({ lang, paise: 12_345_600 }));
      expect(lines.amount).toBe("₹1,23,456/-");
      expect(sentenceText(lines.sentence)).toContain("₹1,23,456");
      expect(lines.date).toMatch(/\d{2}/);
      expect(JSON.stringify(lines)).not.toMatch(/[०-९೦-೯౦-౯]/);
    }
  });

  it("uses the payment mode phrase of the receipt language", () => {
    expect(sentenceText(receiptLines(input({ mode: "cash" })).sentence)).toContain("by cash towards");
    expect(sentenceText(receiptLines(input({ lang: "hi", mode: "bank" })).sentence)).toContain("बैंक से");
  });

  it("leaves a blank, not a word, where a value is missing (criterion 22)", () => {
    const blanks = receiptLines(input({ student: null, paise: null, month: null })).sentence.filter((p) => p.kind === "blank");
    expect(blanks.map((p) => (p.kind === "blank" ? p.slot : ""))).toEqual(["amount", "student", "month"]);
    expect(sentenceText(receiptLines(input({ student: null })).sentence)).toBeNull();
    expect(receiptLines(input({ paise: null })).amount).toBeNull();
  });

  it("puts a typed value in as typed: a name that looks like a placeholder or a replacement pattern", () => {
    for (const name of ["{amount}", "$&", "{month} {mode}", "$1"]) {
      expect(sentenceText(receiptLines(input({ student: name })).sentence)).toContain(`family of ${name} by`);
    }
  });

  it("the footer uses the brand constant and domain, and links nowhere (criterion 18)", () => {
    expect(receiptLines(input()).footer).toBe(`Made with ${brand.name} (${brand.domain}), a free tool for tutors`);
    for (const lang of locales) {
      const footer = receiptLines(input({ lang })).footer;
      expect(footer).toContain(brand.name);
      expect(footer).not.toMatch(/https?:|www\.|\?|utm/i);
    }
  });

  it("never says verified, official, GST, tax invoice or tracked, and shows no UPI ID, phone or bank detail (criterion 17)", () => {
    for (const lang of locales) {
      const lines = receiptLines(input({ lang }));
      const text = [lines.title, lines.date, lines.amount, sentenceText(lines.sentence), lines.stamp, lines.footer].join("\n");
      expect(text).not.toMatch(/verified|official|\bgst\b|tax invoice|tracked/i);
      expect(text).not.toMatch(/@|\+91|\b\d{10}\b|\bifsc\b|account/i);
    }
  });
});

describe("the WhatsApp text and the share choice (criterion 25)", () => {
  it("chooses the share sheet only where files can be shared", () => {
    expect(chooseShare({ canShareFiles: true })).toBe("share-file");
    expect(chooseShare({ canShareFiles: false })).toBe("download-then-whatsapp");
  });

  it("makes a short text in the receipt language, with the month and no name", () => {
    expect(waText("en", october)).toBe("Fee receipt for October 2026. The PDF is attached.");
    expect(waText("hi", october)).toContain("अक्टूबर 2026");
  });

  it("is a wa.me link with no number and the text encoded once", () => {
    expect(waLink("en", october)).toBe(`https://wa.me/?text=${encodeURIComponent("Fee receipt for October 2026. The PDF is attached.")}`);
  });
});

const names = {
  hi: ["क्षत्रिय", "श्रीनिवास", "द्वारका", "ज्ञानेश", "प्रिया कुमारी"],
  kn: ["ಕೃಷ್ಣ", "ಶ್ರೀನಿವಾಸ್", "ಪ್ರಜ್ವಲ್", "ರಾಜೇಶ್ವರಿ", "ಲಕ್ಷ್ಮಿ"],
  te: ["శ్రీనివాస్", "కృష్ణ", "ప్రజ్ఞ", "లక్ష్మి", "సుబ్రహ్మణ్యం"],
};

describe("splitRuns (criterion 19)", () => {
  it.each([
    ["hi", "devanagari"],
    ["kn", "kannada"],
    ["te", "telugu"],
  ] as const)("keeps each %s test name whole, in one run of its own script", (lang, script) => {
    for (const name of names[lang]) expect(splitRuns(name)).toEqual([{ script, text: name }]);
  });

  it("gives a mixed line one run per script, with the space and brackets staying with a neighbour", () => {
    expect(splitRuns("Ravi Kumar (ರವಿ)")).toEqual([
      { script: "latin", text: "Ravi Kumar (" },
      { script: "kannada", text: "ರವಿ)" },
    ]);
  });

  it("keeps the joiners inside a conjunct run, and the rupee sign in Latin", () => {
    expect(splitRuns("क्‍ष")).toHaveLength(1);
    expect(splitRuns("₹1,200/-")).toEqual([{ script: "latin", text: "₹1,200/-" }]);
    expect(splitRuns("नमस्ते ₹1,200 से")).toEqual([
      { script: "devanagari", text: "नमस्ते " },
      { script: "latin", text: "₹1,200 " },
      { script: "devanagari", text: "से" },
    ]);
  });

  it("is one Latin run for digits alone, and nothing for nothing", () => {
    expect(splitRuns("2026")).toEqual([{ script: "latin", text: "2026" }]);
    expect(splitRuns("")).toEqual([]);
  });

  it("marks an emoji and a symbol as `other`", () => {
    expect(splitRuns("A😀").map((r) => r.script)).toEqual(["latin", "other"]);
    expect(splitRuns("日本")[0].script).toBe("other");
  });
});

describe("scriptsNeeded (the fonts fetched on tap)", () => {
  it("is Latin only for an English receipt with English names", () => {
    expect(scriptsNeeded(["Meena Iyer", "Arjun", "Fee receipt", "₹1,200/-"])).toEqual(["latin"]);
  });

  it("adds the script of the receipt language and of each name", () => {
    expect(scriptsNeeded(["प्रिया", "Arjun"])).toEqual(["latin", "devanagari"]);
    expect(scriptsNeeded(["ಕೃಷ್ಣ", "శ్రీనివాస్", "x"])).toEqual(["latin", "kannada", "telugu"]);
  });

  it("does not ask for a font for an emoji", () => {
    expect(scriptsNeeded(["Asha 😀"])).toEqual(["latin"]);
  });
});

describe("dropUnprintable (criterion 20)", () => {
  const all = () => true;

  it("drops an emoji and says so, leaving one space", () => {
    expect(dropUnprintable("Asha 😀 Kumar", all)).toEqual({ text: "Asha Kumar", dropped: true });
  });

  it("drops the whole of a joined emoji family, and a variation selector", () => {
    expect(dropUnprintable("A👨‍👩‍👧B", all).text).toBe("AB");
    expect(dropUnprintable("Hi ☺️", all)).toEqual({ text: "Hi", dropped: true });
  });

  it("keeps everything when every character can be drawn", () => {
    for (const lang of ["hi", "kn", "te"] as const) {
      for (const name of names[lang]) expect(dropUnprintable(name, all)).toEqual({ text: name, dropped: false });
    }
    expect(dropUnprintable("Ravi Kumar (ರವಿ)", all)).toEqual({ text: "Ravi Kumar (ರವಿ)", dropped: false });
  });

  it("asks the font, in the font of the run: a letter its font lacks is dropped", () => {
    const seen: string[] = [];
    const result = dropUnprintable("Aé", (char, script) => {
      seen.push(`${char}:${script}`);
      return char !== "é";
    });
    expect(result).toEqual({ text: "A", dropped: true });
    expect(seen).toEqual(["A:latin", "é:latin"]);
  });

  it("keeps a joiner inside an Indian script and drops one in Latin text, without saying so", () => {
    expect(dropUnprintable("क्‍ष", all)).toEqual({ text: "क्‍ष", dropped: false });
    expect(dropUnprintable("A‍B", all)).toEqual({ text: "AB", dropped: false });
  });

  it("never throws on a lone surrogate or a control character, and a name of only an emoji becomes empty", () => {
    expect(() => dropUnprintable("\ud83d", all)).not.toThrow();
    expect(dropUnprintable("😀", all)).toEqual({ text: "", dropped: true });
  });

  it("hasUnprintable agrees for the preview, which has no fonts", () => {
    expect(hasUnprintable("Asha 😀")).toBe(true);
    expect(hasUnprintable("ಕೃಷ್ಣ Ravi (1)")).toBe(false);
  });
});

describe("the receipt wording", () => {
  it("has the four languages and 12 short months each, distinct", () => {
    for (const lang of locales) {
      expect(new Set(templates[lang].shortMonths).size).toBe(12);
      expect(new Set(templates[lang].months).size).toBe(12);
    }
  });
});

describe("which Latin letters survive (preview and PDF agree)", () => {
  it("keeps Latin-1 and Latin Extended-A letters as Latin, so the preview does not warn about Śrīnivās", () => {
    expect(splitRuns("Śrīnivās")).toEqual([{ script: "latin", text: "Śrīnivās" }]);
    expect(hasUnprintable("Śrīnivās Ānand Zoë")).toBe(false);
  });

  it("calls Latin Extended-B and Additional letters unprintable, as the Latin font file does not hold them", () => {
    expect(hasUnprintable("Ơ")).toBe(true); // U+01A0
    expect(hasUnprintable("Ṭ")).toBe(true); // U+1E6C
    expect(dropUnprintable("Pāṭil", () => true)).toEqual({ text: "Pāil", dropped: true });
  });

  it("is all unprintable only when nothing is left", () => {
    expect(isAllUnprintable("அர்ஜுன்")).toBe(true);
    expect(isAllUnprintable("😀")).toBe(true);
    expect(isAllUnprintable("😀 A")).toBe(false);
    expect(isAllUnprintable("123")).toBe(false);
    expect(isAllUnprintable("")).toBe(false);
  });
});
