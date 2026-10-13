// Line breaking for the PDF (spec R0-3, criterion 21), with a fake measure: every character is 10 wide.
import { describe, expect, it } from "vitest";
import { splitRuns } from "./receipt";
import { wrapRuns, type Measure } from "./wrap";

const measure: Measure = (text) => Array.from(text).length * 10;
const wrap = (text: string, width: number) => wrapRuns(splitRuns(text), measure, width).map((line) => line.map((p) => p.text).join(""));

describe("wrapRuns", () => {
  it("keeps a short line whole and gives nothing for nothing", () => {
    expect(wrap("Hello Ravi", 200)).toEqual(["Hello Ravi"]);
    expect(wrap("", 200)).toEqual([]);
  });

  it("breaks at spaces and keeps each space with the word before it", () => {
    expect(wrap("aaa bbb ccc", 70)).toEqual(["aaa bbb", "ccc"]);
    expect(wrap("aaa bbb ccc", 110)).toEqual(["aaa bbb ccc"]);
  });

  it("puts a long name on a second line, nothing running past the width (criterion 21)", () => {
    const name = "Venkata Subrahmanya Sharma Narayanan Iyer";
    for (const line of wrapRuns(splitRuns(name), measure, 200)) {
      expect(line.reduce((sum, p) => sum + measure(p.text, p.script), 0)).toBeLessThanOrEqual(200);
    }
    expect(wrap(name, 200).join(" ").replace(/ +/g, " ")).toBe(name);
  });

  it("cuts a single word wider than the line, and loses no letter", () => {
    const word = "A".repeat(25);
    expect(wrap(word, 100)).toEqual(["A".repeat(10), "A".repeat(10), "A".repeat(5)]);
  });

  it("does not cut before a vowel sign or after a virama", () => {
    // क + virama + ष is one conjunct; a cut after the virama, or before the sign, would tear it.
    const word = "कक" + "क्ष".repeat(4) + "की".repeat(3);
    const lines = wrap(word, 60);
    for (const line of lines) {
      expect(line.startsWith("ष")).toBe(false);
      expect(/^[ा-ौँ-ः]/.test(line)).toBe(false);
      expect(line.endsWith("्")).toBe(false);
    }
    expect(lines.join("")).toBe(word);
  });

  it("measures each piece with its own script, and keeps a mixed word together on one line", () => {
    const lines = wrapRuns(splitRuns("Ravi (ರವಿ) Kumar"), (text, script) => text.length * (script === "kannada" ? 20 : 10), 400);
    expect(lines).toHaveLength(1);
    expect(lines[0].map((p) => p.script)).toEqual(["latin", "kannada", "latin"]);
  });
});

describe("every line fits the width, per script (criterion 21)", () => {
  // A script-aware fake measure: Indic scripts are wider per character than Latin, as in the real fonts.
  // Marks and joiners add no advance of their own, so only base letters are counted, as in a shaped line.
  const bases = (text: string) => Array.from(text).filter((c) => /[^\p{M}\u200c\u200d]/u.test(c)).length;
  const wide = (text: string, script: string) => bases(text) * (script === "latin" ? 10 : script === "devanagari" ? 14 : 18);
  const names: [string, string][] = [
    ["latin", "Venkata Subrahmanya Sharma Narayanan Iyer"],
    ["latin", "W".repeat(40)],
    ["devanagari", "क्षत्रिय श्रीनिवास द्वारका ज्ञानेश प्रिया कुमारी"],
    ["devanagari", "क्षत्रिय".repeat(5)],
    ["kannada", "ಶ್ರೀನಿವಾಸ್ ಪ್ರಜ್ವಲ್ ರಾಜೇಶ್ವರಿ ಕೃಷ್ಣ ಲಕ್ಷ್ಮಿ"],
    ["kannada", "ಲಕ್ಷ್ಮಿ".repeat(8)],
    ["telugu", "శ్రీనివాస్ ప్రజ్ఞ లక్ష్మి కృష్ణ సుబ్రహ్మణ్యం"],
    ["telugu", "సుబ్రహ్మణ్యం".repeat(4)],
  ];

  it.each(names)("%s: no line is wider than the width, and no letter is lost (%s)", (_script, name) => {
    for (const width of [120, 200, 340]) {
      const lines = wrapRuns(splitRuns(name), wide, width);
      for (const line of lines) {
        // A single unbreakable cluster may exceed a very narrow width; the widths here are wider than any cluster.
        expect(line.reduce((sum, p) => sum + wide(p.text, p.script), 0), `${name} at ${width}`).toBeLessThanOrEqual(width);
      }
      expect(lines.map((l) => l.map((p) => p.text).join("")).join("").replace(/ /g, "")).toBe(name.replace(/ /g, ""));
    }
  });
});

