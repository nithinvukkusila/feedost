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

/** A word cut into chunks that each fit `maxWidth`, as far as they can. */
function cutWord(word: readonly Piece[], measure: Measure, maxWidth: number): Piece[][] {
  const chunks: Piece[][] = [];
  let chunk: Piece[] = [];
  let previous = 0;
  for (const piece of word) {
    for (const char of piece.text) {
      const trial = extend(chunk, piece.script, char);
      const canBreak = chunk.length > 0 && !NO_BREAK_BEFORE.test(char) && !VIRAMAS.has(previous);
      if (canBreak && widthOf(trial, measure) > maxWidth) {
        chunks.push(chunk);
        chunk = [{ script: piece.script, text: char }];
      } else {
        chunk = trial;
      }
      previous = char.codePointAt(0) ?? 0;
    }
  }
  if (chunk.length > 0) chunks.push(chunk);
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
