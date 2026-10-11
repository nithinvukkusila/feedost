// @vitest-environment node
// The PDF maker (spec R0-3, criteria 19, 20, 23, 24, 28), run with the real library and the real
// font files, in Node. Whether a script is drawn *correctly* is judged by a reader on a phone (H2);
// here: it makes a PDF, fetches only the fonts it needs, drops what no font has, and carries no typed value in its metadata.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument, PDFPage } from "@cantoo/pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FONT_FILES, PdfError, makePdf, type PdfInput } from "./make-pdf";

const root = process.cwd();
const requested: string[] = [];
const fetchBytes = async (url: string) => {
  requested.push(url);
  return new Uint8Array(readFileSync(join(root, "public", url)));
};

const NOW = new Date(2026, 9, 8, 14, 30);
const input = (over: Partial<PdfInput> = {}): PdfInput => ({
  lang: "en",
  tutor: "Meena Iyer",
  student: "Arjun",
  paise: 120_000,
  month: { year: 2026, month: 9 },
  mode: "upi",
  now: NOW,
  ...over,
});

async function make(over: Partial<PdfInput> = {}) {
  requested.length = 0;
  const result = await makePdf(input(over), { fetchBytes });
  const bytes = new Uint8Array(await result.blob.arrayBuffer());
  return { ...result, bytes, fonts: [...requested] };
}

const names = {
  hi: ["क्षत्रिय", "श्रीनिवास", "द्वारका", "ज्ञानेश", "प्रिया कुमारी"],
  kn: ["ಕೃಷ್ಣ", "ಶ್ರೀನಿವಾಸ್", "ಪ್ರಜ್ವಲ್", "ರಾಜೇಶ್ವರಿ", "ಲಕ್ಷ್ಮಿ"],
  te: ["శ్రీనివాస్", "కృష్ణ", "ప్రజ్ఞ", "లక్ష్మి", "సుబ్రహ్మణ్యం"],
};

describe("makePdf", { timeout: 30_000 }, () => {
  it("makes one A4 page PDF, small, for an English receipt, and fetches only the Latin font", async () => {
    const { blob, bytes, fonts, dropped } = await make();
    expect(blob.type).toBe("application/pdf");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeLessThan(300 * 1024); // criterion target: 300 KB
    expect(fonts).toEqual([FONT_FILES.latin]);
    expect(dropped).toBe(false);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const [width, height] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()];
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });

  it.each([
    ["hi", "devanagari"],
    ["kn", "kannada"],
    ["te", "telugu"],
  ] as const)("a %s receipt with the spike's test names fetches the Latin font and the %s font, and stays under 300 KB", async (lang, script) => {
    for (const student of names[lang]) {
      const { bytes, fonts, dropped } = await make({ lang, tutor: names[lang][0], student });
      expect(fonts.sort()).toEqual([FONT_FILES.latin, FONT_FILES[script]].sort());
      expect(dropped).toBe(false);
      expect(bytes.length).toBeLessThan(300 * 1024);
    }
  });

  it("draws a Kannada name on an English receipt: its font is fetched too (criterion 19)", async () => {
    const { fonts } = await make({ student: "ಕೃಷ್ಣ" });
    expect(fonts.sort()).toEqual([FONT_FILES.kannada, FONT_FILES.latin].sort());
  });

  it("draws a line of two scripts, and a Telugu tutor with a Hindi student on a Kannada receipt", async () => {
    const mixed = await make({ tutor: "Ravi Kumar (ರವಿ)" });
    expect(mixed.fonts.sort()).toEqual([FONT_FILES.kannada, FONT_FILES.latin].sort());
    const three = await make({ lang: "kn", tutor: "శ్రీనివాస్", student: "प्रिया कुमारी" });
    expect(three.fonts).toHaveLength(4);
    expect(three.bytes.length).toBeLessThan(1024 * 1024); // the hard limit
  });

  it("drops an emoji, says so, and still makes the PDF (criterion 20)", async () => {
    const { dropped, bytes } = await make({ student: "Asha 😀 Kumar" });
    expect(dropped).toBe(true);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("wraps a 40-letter name in every script without failing (criterion 21)", async () => {
    for (const [lang, word] of [["en", "W".repeat(40)], ["hi", "क्षत्रिय ".repeat(5).trim()], ["kn", "ಲಕ್ಷ್ಮಿ".repeat(8)], ["te", "సుబ్రహ్మణ్యం".repeat(4)]] as const) {
      const name = Array.from(word).slice(0, 40).join("");
      const { bytes } = await make({ lang, tutor: name, student: name });
      expect(bytes.length).toBeGreaterThan(1000);
    }
  });

  it("carries no typed value in its metadata or its file (criterion 28, H10)", async () => {
    const { bytes } = await make({ tutor: "Zzyzx Tutor", student: "Qwxy Student" });
    // Loading would write the library's own producer line into what we read back, so it is told not to.
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    expect(doc.getTitle()).toBe("Fee receipt");
    expect(doc.getAuthor() ?? "").toBe("");
    expect(doc.getCreator() ?? "").toBe("");
    expect(doc.getProducer() ?? "").toBe("");
    expect(doc.getSubject() ?? "").toBe("");
    expect(doc.getKeywords() ?? "").toBe("");
    const raw = new TextDecoder("latin1").decode(bytes);
    // The names are drawn as glyph ids in a subset font, never as a metadata string.
    expect(raw).not.toMatch(/Zzyzx|Qwxy/);
    expect(raw).not.toMatch(/pdf-lib|feedost/i);
  });

  it("rejects with `font` when a font file does not load, and nothing is half made (criterion 24)", async () => {
    await expect(
      makePdf(input(), {
        fetchBytes: async () => {
          throw new Error("offline");
        },
      }),
    ).rejects.toMatchObject({ name: "PdfError", code: "font" });
  });

  it("rejects with `input` for a value that has not passed the checks, never drawing it", async () => {
    for (const bad of [{ tutor: "  " }, { student: "" }, { student: "x".repeat(41) }, { paise: 0 }, { paise: 1.5 }]) {
      const error = await makePdf(input(bad), { fetchBytes }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PdfError);
      expect((error as PdfError).code).toBe("input");
    }
  });
});

// The page geometry, read from what is really drawn: every drawText call with the font's own width, the
// amount box and the stamp circles. 595.28 x 841.89 pt, 48 pt margins (make-pdf.ts).
describe("the layout of what is drawn (criterion 21)", () => {
  const PAGE_WIDTH = 595.28;
  const MARGIN = 48;
  type Text = { text: string; x: number; y: number; size: number; right: number };
  type Box = { x: number; y: number; width: number; height: number };
  type Circle = { x: number; y: number; size: number };

  afterEach(() => vi.restoreAllMocks());

  async function draw(over: Partial<PdfInput>) {
    const texts: Text[] = [];
    const boxes: Box[] = [];
    const circles: Circle[] = [];
    const drawText = PDFPage.prototype.drawText;
    const drawRectangle = PDFPage.prototype.drawRectangle;
    const drawCircle = PDFPage.prototype.drawCircle;
    vi.spyOn(PDFPage.prototype, "drawText").mockImplementation(function (this: PDFPage, text, options) {
      const font = options?.font as { widthOfTextAtSize(text: string, size: number): number };
      const size = options?.size ?? 12;
      const x = options?.x ?? 0;
      texts.push({ text, x, y: options?.y ?? 0, size, right: x + font.widthOfTextAtSize(text, size) });
      return drawText.call(this, text, options);
    });
    vi.spyOn(PDFPage.prototype, "drawRectangle").mockImplementation(function (this: PDFPage, options) {
      boxes.push({ x: options?.x ?? 0, y: options?.y ?? 0, width: options?.width ?? 0, height: options?.height ?? 0 });
      return drawRectangle.call(this, options);
    });
    vi.spyOn(PDFPage.prototype, "drawCircle").mockImplementation(function (this: PDFPage, options) {
      circles.push({ x: options?.x ?? 0, y: options?.y ?? 0, size: options?.size ?? 0 });
      return drawCircle.call(this, options);
    });
    await make(over);
    vi.restoreAllMocks();
    return { texts, boxes, circles };
  }

  const forty = (word: string) => Array.from(word.repeat(40)).slice(0, 40).join("");
  const cases: [string, Partial<PdfInput>][] = [
    ["en", { lang: "en", tutor: forty("W"), student: "Venkata Subrahmanya Sharma Narayanan" }],
    ["hi", { lang: "hi", tutor: forty("क्षत्रिय "), student: "श्रीनिवास द्वारका ज्ञानेश प्रिया कुमारी" }],
    ["kn", { lang: "kn", tutor: forty("ಲಕ್ಷ್ಮಿ"), student: "ಶ್ರೀನಿವಾಸ್ ಪ್ರಜ್ವಲ್ ರಾಜೇಶ್ವರಿ ಕೃಷ್ಣ" }],
    ["te", { lang: "te", tutor: forty("సుబ్రహ్మణ్యం"), student: "శ్రీనివాస్ ప్రజ్ఞ లక్ష్మి కృష్ణ" }],
  ];

  it.each(cases)("%s: no drawn text crosses the margin, the amount box clears the stamp, the stamp text stays in its ring, nothing meets the footer", async (_lang, over) => {
    const { texts, boxes, circles } = await draw({ ...over, paise: 10_000_000 });
    expect(texts.length).toBeGreaterThan(5);
    const [, amountBox] = boxes; // the first rectangle is the page frame
    const ring = circles[0];
    const footerY = Math.min(...texts.map((t) => t.y));
    const stampTexts = texts.filter((t) => t.x > ring.x - ring.size && t.right < ring.x + ring.size && Math.abs(t.y - ring.y) < ring.size);
    for (const t of texts) {
      if (stampTexts.includes(t)) continue;
      expect(t.x, t.text).toBeGreaterThanOrEqual(MARGIN - 0.5);
      expect(t.right, t.text).toBeLessThanOrEqual(PAGE_WIDTH - MARGIN + 0.5);
    }
    // The stamp's words are inside its outer ring on both sides.
    expect(stampTexts.length).toBeGreaterThanOrEqual(2);
    for (const t of stampTexts) {
      expect(t.x, t.text).toBeGreaterThanOrEqual(ring.x - ring.size);
      expect(t.right, t.text).toBeLessThanOrEqual(ring.x + ring.size);
    }
    // The amount box: inside the margins, left of the stamp, and holds its figure.
    expect(amountBox.x).toBeGreaterThanOrEqual(MARGIN - 0.5);
    expect(amountBox.x + amountBox.width).toBeLessThan(ring.x - ring.size);
    const amount = texts.find((t) => t.size === 36)!;
    expect(amount.right).toBeLessThanOrEqual(amountBox.x + amountBox.width);
    // Vertically the box is above the footer and the page frame.
    expect(amountBox.y).toBeGreaterThan(footerY + 10);
    expect(footerY).toBeGreaterThan(40);
  });

  it("a long Latin word is wider than the text width and is cut: every piece fits (criterion 21)", async () => {
    const { texts } = await draw({ tutor: "W".repeat(40), student: "M".repeat(40) });
    expect(Math.max(...texts.map((t) => t.right - t.x))).toBeLessThanOrEqual(PAGE_WIDTH - 2 * MARGIN + 0.5);
  });
});

describe("a name no font can draw (review, criterion 20)", () => {
  it.each([
    ["a Tamil student", { student: "அர்ஜுன்" }, "student"],
    ["an emoji tutor", { tutor: "😀" }, "tutor"],
    ["a Tamil tutor with a good student", { tutor: "அர்ஜுன்", student: "Arjun" }, "tutor"],
  ] as const)("%s: rejects with `input` naming the field, and fetches nothing", async (_label, over, field) => {
    requested.length = 0;
    const error = await makePdf(input(over), { fetchBytes }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PdfError);
    expect(error).toMatchObject({ code: "input", field });
    expect(requested).toEqual([]);
  });

  it("a name with some printable letters still makes the PDF and says a character went", async () => {
    const { dropped, bytes } = await make({ student: "Arjun அ" });
    expect(dropped).toBe(true);
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("draws Latin Extended-A letters from the Latin font, dropping nothing (preview and PDF agree)", async () => {
    const { dropped, fonts } = await make({ student: "Śrīnivās Ānand", tutor: "Śrīdhar Pāṭil" });
    // Ṭ (U+1E6C) is Latin Extended Additional: outside the rule, so the rule drops it and says so.
    expect(dropped).toBe(true);
    expect(fonts).toEqual([FONT_FILES.latin]);
    const clean = await make({ student: "Śrīnivās Ānand", tutor: "Śrīdhar Pātil" });
    expect(clean.dropped).toBe(false);
  });
});

describe("the library is loaded only here (criterion 2)", () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.(ts|tsx|mjs)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });
  }

  it("no other source file mentions the PDF library or its font parser", () => {
    const offenders = sources(join(root, "src")).filter((file) => /@cantoo\/|pdf-lib|fontkit/.test(readFileSync(file, "utf8")) && !file.endsWith(join("receipt", "make-pdf.ts")));
    expect(offenders.map((file) => file.slice(root.length + 1))).toEqual([]);
  });

  it("make-pdf.ts reaches the library only through await import()", () => {
    const text = readFileSync(join(root, "src", "lib", "receipt", "make-pdf.ts"), "utf8");
    const importLines = text.split("\n").filter((line) => /^import /.test(line) && /@cantoo\//.test(line));
    // The only top-level import is a type-only one, which is erased at build.
    for (const line of importLines) expect(line).toMatch(/^import type /);
    expect(text).toMatch(/await Promise\.all\(\[import\("@cantoo\/pdf-lib"\), import\("@cantoo\/fontkit"\)\]\)/);
  });
});

// A way to look at the real output: PDF_DUMP=/some/folder pnpm vitest run src/lib/receipt/make-pdf.test.ts
describe.runIf(process.env.PDF_DUMP)("dump the PDFs for a reader", () => {
  it("writes one receipt per language", async () => {
    const dir = process.env.PDF_DUMP as string;
    for (const lang of ["en", "hi", "kn", "te"] as const) {
      const list = lang === "en" ? ["Meena Iyer", "Arjun Kumar"] : [names[lang][0], names[lang][1]];
      const { bytes } = await make({ lang, tutor: list[0], student: list[1] });
      writeFileSync(join(dir, `${lang}.pdf`), bytes);
    }
    const { bytes } = await make({ lang: "en", tutor: "Ravi Kumar (ರವಿ)", student: "Asha 😀 " + "ಲಕ್ಷ್ಮಿ".repeat(4) });
    writeFileSync(join(dir, "mixed.pdf"), bytes);
    const long = await make({ lang: "te", tutor: "సుబ్రహ్మణ్యం".repeat(3), student: Array.from("క్షత్రియ శ్రీనివాస్ ప్రజ్ఞ లక్ష్మి సుబ్రహ్మణ్య").slice(0, 40).join("") });
    writeFileSync(join(dir, "long-te.pdf"), long.bytes);
  });
});
