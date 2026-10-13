// The one place the PDF library is used (spec R0-3, plan sections 1 and 3). Nothing else may import
// `@cantoo/pdf-lib` or `@cantoo/fontkit`, and this file only reaches them through `await import()`
// inside `makePdf`, so neither the library (about 400 KB gzipped) nor a font is in any page's first
// load: they are fetched when the tutor taps Download or Share. The fonts are our own static files
// under /pdf-fonts/ (subset Noto, SIL OFL); nothing is fetched from anyone else.
//
// Each run of text is drawn with the font of its own script, so Hindi, Kannada and Telugu names are
// shaped by the library's fontkit and a Kannada name on an English receipt still draws. A character
// no font has is dropped by the rule in `dropUnprintable`, and the caller is told.
//
// The PDF carries no typed value in its metadata: the title is "Fee receipt", the author, creator and
// producer are empty. The text in it is drawn correctly but is not promised to be selectable or
// searchable in order (the spike found conjuncts extract out of order).
import type { PDFFont } from "@cantoo/pdf-lib";
import { checkName } from "@/lib/fields";
import {
  dropUnprintable,
  isAllUnprintable,
  receiptLines,
  scriptsNeeded,
  sentenceText,
  splitRuns,
  type FeeMonth,
  type FontScript,
  type Mode,
  type ReceiptInput,
} from "./receipt";
import { wrapRuns, type Piece } from "./wrap";

export type PdfErrorCode = "input" | "library" | "font";
/** The field a value belongs to, named when an `input` error is about one value. */
export type PdfField = "tutor" | "student" | "amount";

/** Why a PDF could not be made. The page shows one sentence for every code. */
export class PdfError extends Error {
  readonly code: PdfErrorCode;
  readonly field?: PdfField;
  constructor(code: PdfErrorCode, message: string, field?: PdfField) {
    super(message);
    this.name = "PdfError";
    this.code = code;
    this.field = field;
  }
}

/** The font file for each script, under /pdf-fonts/. */
export const FONT_FILES: Record<FontScript, string> = {
  latin: "/pdf-fonts/NotoSans.ttf",
  devanagari: "/pdf-fonts/NotoSansDevanagari.ttf",
  kannada: "/pdf-fonts/NotoSansKannada.ttf",
  telugu: "/pdf-fonts/NotoSansTelugu.ttf",
};

/** What a receipt needs, with every value present: no `null`. The names are checked again inside. */
export type PdfInput = Omit<ReceiptInput, "tutor" | "student" | "paise" | "month" | "mode"> & {
  tutor: string;
  student: string;
  paise: number;
  month: FeeMonth;
  mode: Mode;
};

export type PdfOptions = {
  /** Fetches a font file. Replaced in tests. */
  fetchBytes?: (url: string) => Promise<Uint8Array>;
};

async function defaultFetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// A4 in points, and the page's measures.
const PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = 48;
const TEXT_WIDTH = PAGE.width - 2 * MARGIN;
// Indian scripts stack marks above and below the line: every line gets generous room.
const LEADING = 1.75;
const INK = { r: 0.102, g: 0.078, b: 0.063 };

type Coverage = { hasGlyphForCodePoint(codePoint: number): boolean };

/**
 * Makes the receipt. Returns the PDF and whether any character had to be left out.
 * Rejects with a `PdfError`: `input` (a value is missing), `library` (the code did not load) or
 * `font` (a font file did not load).
 */
export async function makePdf(input: PdfInput, options: PdfOptions = {}): Promise<{ blob: Blob; dropped: boolean }> {
  const fetchBytes = options.fetchBytes ?? defaultFetchBytes;
  // The same checks the page makes: a value that did not pass them never reaches the drawing code.
  const tutor = checkName(input.tutor);
  const student = checkName(input.student);
  if (!tutor.ok || !student.ok || !Number.isInteger(input.paise) || input.paise < 100) {
    throw new PdfError("input", "the receipt needs a checked name, student name and amount", !tutor.ok ? "tutor" : !student.ok ? "student" : "amount");
  }

  // The written rule alone settles a name that is all emoji or another script, before anything is fetched.
  if (isAllUnprintable(tutor.value)) throw new PdfError("input", "no character of the tutor's name can be printed", "tutor");
  if (isAllUnprintable(student.value)) throw new PdfError("input", "no character of the student's name can be printed", "student");

  let pdfLib: typeof import("@cantoo/pdf-lib");
  let fontkit: typeof import("@cantoo/fontkit");
  try {
    [pdfLib, fontkit] = await Promise.all([import("@cantoo/pdf-lib"), import("@cantoo/fontkit")]);
  } catch (error) {
    throw new PdfError("library", `the PDF code did not load: ${String(error)}`);
  }

  // Only the fonts this receipt uses: the receipt's language plus the scripts in the two names.
  const draft = receiptLines({ ...input, tutor: tutor.value, student: student.value });
  const needed = scriptsNeeded([tutor.value, student.value, draft.title, draft.date, draft.footer, draft.stamp, sentenceText(draft.sentence) ?? ""]);
  const bytes: Partial<Record<FontScript, Uint8Array>> = {};
  try {
    await Promise.all(
      needed.map(async (script) => {
        bytes[script] = await fetchBytes(FONT_FILES[script]);
      }),
    );
  } catch (error) {
    throw new PdfError("font", `a font did not load: ${String(error)}`);
  }

  const kit = fontkit.default;
  const coverage = {} as Record<FontScript, Coverage>;
  for (const script of needed) coverage[script] = kit.create(bytes[script] as Uint8Array) as unknown as Coverage;
  // The font's own glyph table decides what can be drawn, so the rule cannot go stale.
  const canDraw = (char: string, script: FontScript) => (coverage[script] ?? coverage.latin).hasGlyphForCodePoint(char.codePointAt(0) ?? 0);
  const cleanTutor = dropUnprintable(tutor.value, canDraw);
  const cleanStudent = dropUnprintable(student.value, canDraw);
  const lines = receiptLines({ ...input, tutor: cleanTutor.text, student: cleanStudent.text });
  const dropped = cleanTutor.dropped || cleanStudent.dropped;
  // A name that drew as nothing would print "from the family of " with a blank: refuse, and say which.
  if (cleanTutor.text === "") throw new PdfError("input", "no character of the tutor's name can be printed", "tutor");
  if (cleanStudent.text === "") throw new PdfError("input", "no character of the student's name can be printed", "student");

  const doc = await pdfLib.PDFDocument.create({ updateMetadata: false });
  doc.registerFontkit(kit);
  doc.setTitle("Fee receipt");
  doc.setAuthor("");
  doc.setCreator("");
  doc.setProducer("");
  doc.setSubject("");
  doc.setKeywords([]);
  const fonts = {} as Record<FontScript, PDFFont>;
  for (const script of needed) fonts[script] = await doc.embedFont(bytes[script] as Uint8Array, { subset: true });

  const page = doc.addPage([PAGE.width, PAGE.height]);
  const ink = pdfLib.rgb(INK.r, INK.g, INK.b);
  const fontFor = (script: FontScript) => fonts[script] ?? fonts.latin;
  const widthOf = (text: string, script: FontScript, size: number) => fontFor(script).widthOfTextAtSize(text, size);
  const asFont = (script: string): FontScript => (script === "other" ? "latin" : (script as FontScript));

  /** Draws pieces left to right from `x`. `y` is the baseline, up from the foot of the page. */
  function drawPieces(pieces: readonly Piece[], x: number, y: number, size: number): void {
    let at = x;
    for (const piece of pieces) {
      page.drawText(piece.text, { x: at, y, size, font: fontFor(piece.script), color: ink });
      at += widthOf(piece.text, piece.script, size);
    }
  }

  /** Wraps and draws text. `top` is the top of the first line, down from the top of the page. Returns the top of the next free line. */
  function drawParagraph(text: string, opts: { x: number; top: number; size: number; width: number; align?: "left" | "center" }): number {
    const wrapped = wrapRuns(splitRuns(text), (piece, script) => widthOf(piece, script, opts.size), opts.width);
    let top = opts.top;
    for (const line of wrapped) {
      const lineWidth = line.reduce((sum, piece) => sum + widthOf(piece.text, piece.script, opts.size), 0);
      const x = opts.align === "center" ? opts.x + (opts.width - lineWidth) / 2 : opts.x;
      drawPieces(line, x, PAGE.height - top - opts.size * (LEADING * 0.62), opts.size);
      top += opts.size * LEADING;
    }
    return top;
  }

  // A plain frame, then the heading: the tutor's name.
  page.drawRectangle({ x: 28, y: 28, width: PAGE.width - 56, height: PAGE.height - 56, borderColor: ink, borderWidth: 2 });
  let top = 64;
  top = drawParagraph(lines.tutor ?? "", { x: MARGIN, top, size: 26, width: TEXT_WIDTH });
  top += 4;

  // "Fee receipt" on the left, the issue date on the right.
  const titleSize = 13;
  const dateRuns = splitRuns(lines.date).map((run): Piece => ({ script: asFont(run.script), text: run.text }));
  const dateWidth = dateRuns.reduce((sum, piece) => sum + widthOf(piece.text, piece.script, titleSize), 0);
  const titleBase = PAGE.height - top - titleSize * (LEADING * 0.62);
  const titleBottom = drawParagraph(lines.title, { x: MARGIN, top, size: titleSize, width: Math.max(TEXT_WIDTH - dateWidth - 16, 80) });
  drawPieces(dateRuns, PAGE.width - MARGIN - dateWidth, titleBase, titleSize);
  top = Math.max(titleBottom, top + titleSize * LEADING) + 8;
  page.drawLine({ start: { x: MARGIN, y: PAGE.height - top }, end: { x: PAGE.width - MARGIN, y: PAGE.height - top }, thickness: 1.5, color: ink });
  top += 14;

  // The sentence.
  top = drawParagraph(sentenceText(lines.sentence) ?? "", { x: MARGIN, top, size: 15, width: TEXT_WIDTH });
  top += 26;

  // The amount in a box, and the stamp beside it. The stamp is ink black: colour never carries the meaning.
  const amountText = lines.amount ?? "";
  const amountSize = 36;
  const boxPadding = 14;
  const boxHeight = amountSize * 1.3 + 2 * boxPadding;
  const radius = 62;
  const rowHeight = Math.max(boxHeight, radius * 2);
  const boxTop = top + (rowHeight - boxHeight) / 2;
  page.drawRectangle({
    x: MARGIN,
    y: PAGE.height - boxTop - boxHeight,
    width: Math.min(widthOf(amountText, "latin", amountSize) + 2 * boxPadding, TEXT_WIDTH - 2 * radius - 16),
    height: boxHeight,
    borderColor: ink,
    borderWidth: 2,
  });
  drawPieces([{ script: "latin", text: amountText }], MARGIN + boxPadding, PAGE.height - boxTop - boxPadding - amountSize * 0.95, amountSize);
  const cx = PAGE.width - MARGIN - radius;
  const cy = PAGE.height - top - rowHeight / 2;
  page.drawCircle({ x: cx, y: cy, size: radius, borderColor: ink, borderWidth: 2.5 });
  page.drawCircle({ x: cx, y: cy, size: radius - 6, borderColor: ink, borderWidth: 1 });
  const stampWidth = (radius - 10) * 2 - 8;
  const afterStamp = drawParagraph(lines.stamp, { x: cx - stampWidth / 2, top: top + rowHeight / 2 - 22, size: 14, width: stampWidth, align: "center" });
  drawParagraph(lines.stampDate, { x: cx - stampWidth / 2, top: afterStamp, size: 10, width: stampWidth, align: "center" });

  // The one footer line, small, at the foot of the page.
  drawParagraph(lines.footer, { x: MARGIN, top: PAGE.height - 92, size: 10, width: TEXT_WIDTH, align: "center" });

  const saved = await doc.save();
  // A copy backed by a plain ArrayBuffer, so the Blob type is satisfied everywhere.
  return { blob: new Blob([new Uint8Array(saved)], { type: "application/pdf" }), dropped };
}
