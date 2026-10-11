// @vitest-environment node
// The PDF maker (spec R0-3, criteria 19, 20, 23, 24, 28), run with the real library and the real
// font files, in Node. Whether a script is drawn *correctly* is judged by a reader on a phone (H2);
// here: it makes a PDF, fetches only the fonts it needs, drops what no font has, and carries no typed value in its metadata.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "@cantoo/pdf-lib";
import { describe, expect, it } from "vitest";
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
