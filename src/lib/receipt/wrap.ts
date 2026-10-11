// Line breaking for the PDF (spec R0-3, criterion 21). Pure: it is given a way to measure a piece
// of text and returns lines, each a list of pieces that are drawn one after another, every piece
// with its own font. A line breaks at a space. A single word wider than the line (a 40-letter name
// with no space) is cut between letters, never before a combining mark or a joiner and never
// straight after a virama, so a conjunct is not torn apart.
import type { FontScript, Run } from "./receipt";

export type Measure = (text: string, script: FontScript) => number;

const VIRAMAS = new Set([0x94d, 0xc4d, 0xccd]);
const NO_BREAK_BEFORE = /[\p{M}‌‍]/u;

/** A piece of a word: text in one script (`other` has been dropped before this is called). */
export type Piece = { script: FontScript; text: string };

function toWords(runs: readonly Run[]): Piece[][] {
  const words: Piece[][] = [[]];
  for (const run of runs) {
    const script = run.script === "other" ? "latin" : run.script;
    let current = "";
    const flush = () => {
      if (current !== "") words[words.length - 1].push({ script, text: current });
      current = "";
    };
    for (const char of run.text) {
      if (char === " ") {
        flush();
        words.push([]);
      } else current += char;
    }
    flush();
  }
  return words.filter((word) => word.length > 0);
}

const widthOf = (pieces: readonly Piece[], measure: Measure) => pieces.reduce((sum, piece) => sum + measure(piece.text, piece.script), 0);

/** `chunk` with one more character, merged into the last piece when the script is the same. */
function extend(chunk: readonly Piece[], script: FontScript, char: string): Piece[] {
  const last = chunk[chunk.length - 1];
  if (last && last.script === script) return [...chunk.slice(0, -1), { script, text: last.text + char }];
  return [...chunk, { script, text: char }];
}

/** A flat range of a word's characters as pieces, merged where the script is the same. */
function piecesOf(chars: readonly { script: FontScript; char: string }[], from: number, to: number): Piece[] {
  let out: Piece[] = [];
  for (let i = from; i < to; i++) out = extend(out, chars[i].script, chars[i].char);
  return out;
}

/**
 * A word cut into chunks that each fit `maxWidth`. When the next letter would not fit, the cut goes
 * at the last place a cut is allowed (before a whole conjunct, not inside it), so a line never runs
 * past the width by the length of a cluster. A single cluster wider than the line is the only thing
 * that can still overshoot.
 */
function cutWord(word: readonly Piece[], measure: Measure, maxWidth: number): Piece[][] {
  const chars = word.flatMap((piece) => Array.from(piece.text).map((char) => ({ script: piece.script, char })));
  const canBreakAt = (i: number) => i > 0 && !NO_BREAK_BEFORE.test(chars[i].char) && !VIRAMAS.has(chars[i - 1].char.codePointAt(0) ?? 0);
  const chunks: Piece[][] = [];
  let start = 0;
  let i = 0;
  while (i < chars.length) {
    i += 1;
    if (i >= chars.length || widthOf(piecesOf(chars, start, i + 1), measure) <= maxWidth) continue;
    // Character i does not fit: cut at the last allowed place in (start, i].
    let at = i;
    while (at > start && !canBreakAt(at)) at -= 1;
    if (at > start) {
      chunks.push(piecesOf(chars, start, at));
      start = at;
      i = at;
    }
  }
  if (start < chars.length) chunks.push(piecesOf(chars, start, chars.length));
  return chunks;
}

/** Joins a piece onto a line, merging with the last piece when the script is the same. */
function append(line: Piece[], piece: Piece) {
  const last = line[line.length - 1];
  if (last && last.script === piece.script) last.text += piece.text;
  else line.push({ ...piece });
}

/**
 * Breaks runs into lines no wider than `maxWidth`. Spaces between words are kept inside the piece
 * that precedes them. An empty text gives no lines.
 */
export function wrapRuns(runs: readonly Run[], measure: Measure, maxWidth: number): Piece[][] {
  const lines: Piece[][] = [];
  let line: Piece[] = [];
  const space = (script: FontScript) => measure(" ", script);

  for (const word of toWords(runs)) {
    // A word wider than a whole line is cut first; each chunk then behaves like a word.
    const parts = widthOf(word, measure) > maxWidth ? cutWord(word, measure, maxWidth) : [word];
    parts.forEach((part, index) => {
      const fits = line.length === 0 || widthOf(line, measure) + space(line[line.length - 1].script) + widthOf(part, measure) <= maxWidth;
      // The chunks of one cut word each start a new line.
      if (line.length > 0 && (!fits || index > 0)) {
        lines.push(line);
        line = [];
      }
      if (line.length > 0) append(line, { script: line[line.length - 1].script, text: " " });
      for (const piece of part) append(line, piece);
    });
  }
  if (line.length > 0) lines.push(line);
  return lines;
}
