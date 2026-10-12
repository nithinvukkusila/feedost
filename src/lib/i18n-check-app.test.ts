// `checkAppTemplates` and its wiring in `pnpm i18n:check` (spec R1-8, criteria 8, 11, 32): the 8 earlier-balance
// templates and the 4 generic parent words, with their own review record.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { appTemplateHash, checkAppTemplates } from "../../scripts/i18n-check-lib.mjs";

type Entry = { polite: string[]; firm: string[]; parentWord: string };
type Tree = Record<"en" | "hi" | "kn" | "te", Entry>;
type Review = Record<string, { status: string; reviewer: string; date: string; sha256: string }>;
type Result = { problems: string[]; templateCount: number; wordCount: number; notReviewed: string[]; notes: string[] };

const real = JSON.parse(readFileSync(join(process.cwd(), "src/lib/reminder/templates.app.json"), "utf8")) as Tree;
const open = { status: "not reviewed", reviewer: "", date: "", sha256: "" };
const notReviewed: Review = { hi: { ...open }, kn: { ...open }, te: { ...open } };
const hash = (e: Entry) => createHash("sha256").update(JSON.stringify({ polite: e.polite, firm: e.firm, parentWord: e.parentWord })).digest("hex");
const signed = (e: Entry) => ({ status: "reviewed", reviewer: "A Reader", date: "2026-10-20", sha256: hash(e) });

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function run(tree: unknown, review: unknown = notReviewed, strict = false): Result {
  const dir = mkdtempSync(join(tmpdir(), "app-tpl-"));
  dirs.push(dir);
  const file = join(dir, "templates.app.json");
  const reviewFile = join(dir, "templates.app.review.json");
  writeFileSync(file, typeof tree === "string" ? tree : JSON.stringify(tree));
  if (review !== null) writeFileSync(reviewFile, typeof review === "string" ? review : JSON.stringify(review));
  return checkAppTemplates(file, reviewFile, { strict });
}
function changed(locale: keyof Tree, change: (e: Entry) => void): Tree {
  const copy = structuredClone(real);
  change(copy[locale]);
  return copy;
}
const has = (r: Result, text: string) => r.problems.some((p) => p.includes(text));

describe("checkAppTemplates", () => {
  it("passes the real file, counting 8 templates and 4 words, and prints each hash to copy", () => {
    const r = run(real);
    expect(r.problems).toEqual([]);
    expect(r.templateCount).toBe(8);
    expect(r.wordCount).toBe(4);
    expect(r.notReviewed).toEqual(["hi", "kn", "te"]);
    for (const l of ["hi", "kn", "te"] as const) expect(r.notes.join("\n")).toContain(`${l}: balance templates and parent word not reviewed; current text ${hash(real[l])}`);
    expect(appTemplateHash(real.hi)).toBe(hash(real.hi));
  });

  it("strict stays red while nothing is signed off", () => {
    const r = run(real, notReviewed, true);
    expect(r.problems).toHaveLength(3);
    expect(has(r, '"hi" is not reviewed')).toBe(true);
  });

  it("a full sign-off clears it, in strict too", () => {
    const r = run(real, { hi: signed(real.hi), kn: signed(real.kn), te: signed(real.te) }, true);
    expect(r.problems).toEqual([]);
    expect(r.notReviewed).toEqual([]);
  });

  it("an edit after sign-off voids it: a note plain, a problem strict", () => {
    const edited = changed("hi", (e) => (e.firm[0] += " "));
    const review = { hi: signed(real.hi), kn: signed(real.kn), te: signed(real.te) };
    expect(run(edited, review).notReviewed).toEqual(["hi"]);
    expect(run(edited, review).notes.join()).toContain("changed after the review");
    expect(has(run(edited, review, true), "changed after the review")).toBe(true);
    // The parent word is part of what was signed.
    const word = changed("te", (e) => (e.parentWord = "తల్లి"));
    expect(run(word, review).notReviewed).toEqual(["te"]);
  });

  it("a sign-off with no reviewer, date or hash is refused", () => {
    const r = run(real, { ...notReviewed, hi: { status: "reviewed", reviewer: "", date: "x", sha256: "y" } });
    expect(has(r, "no reviewer's name")).toBe(true);
    expect(has(r, "no date")).toBe(true);
    expect(has(r, "no sha256")).toBe(true);
  });

  it("is not valid JSON, or not an object", () => {
    expect(has(run("{"), "not valid JSON")).toBe(true);
    expect(has(run("[]"), "an array")).toBe(true);
  });

  it("a missing review file or language entry is a problem", () => {
    expect(has(run(real, null), "does not exist")).toBe(true);
    expect(has(run(real, { hi: open, kn: open }), 'missing "te"')).toBe(true);
    expect(has(run(real, { ...notReviewed, fr: open }), '"fr"')).toBe(true);
    expect(has(run(real, { ...notReviewed, hi: { ...open, status: "maybe" } }), "status must be")).toBe(true);
  });

  describe("the shape", () => {
    it("a language or a key that should not be there", () => {
      expect(has(run({ ...real, fr: real.en }), '"fr"')).toBe(true);
      const three = { en: real.en, hi: real.hi, kn: real.kn };
      expect(has(run(three), 'missing "te"')).toBe(true);
      expect(has(run(changed("en", (e) => ((e as unknown as Record<string, unknown>).months = []))), "not polite, firm or parentWord")).toBe(true);
    });
    it("an empty list or an empty line", () => {
      expect(has(run(changed("en", (e) => (e.polite = []))), "must be a list of lines")).toBe(true);
      expect(has(run(changed("en", (e) => (e.firm[2] = " "))), "must be a list of lines")).toBe(true);
    });
  });

  describe("the placeholders", () => {
    it.each(["{parent}", "{amount}", "{link}", "{upiId}"])("%s must appear exactly once", (slot) => {
      expect(has(run(changed("en", (e) => (e.polite = e.polite.map((l) => l.split(slot).join("x"))))), `${slot} appears 0 times`)).toBe(true);
      expect(has(run(changed("en", (e) => e.polite.push(`again ${slot}`))), `${slot} appears 2 times`)).toBe(true);
    });
    it("{month} is refused: an earlier balance has no month", () => {
      expect(has(run(changed("en", (e) => (e.polite[0] += " {month}"))), "no month")).toBe(true);
    });
    it("a stray brace, and a link glued to other text", () => {
      expect(has(run(changed("en", (e) => (e.polite[0] += " {oops}"))), "a brace that is not one of")).toBe(true);
      expect(has(run(changed("en", (e) => (e.polite[1] = "see {link}"))), "{link} must be alone on its line")).toBe(true);
    });
    it("TODO-translate in a template or the word", () => {
      expect(has(run(changed("hi", (e) => (e.polite[0] = "TODO-translate: " + e.polite[0]))), "TODO-translate")).toBe(true);
      expect(has(run(changed("hi", (e) => (e.parentWord = "TODO-translate: अभिभावक"))), "parentWord")).toBe(true);
    });
  });

  describe("never English in disguise", () => {
    it("a template with no native script, or English pasted in", () => {
      expect(has(run(changed("kn", (e) => (e.polite = [...real.en.polite]))), "no Kannada text")).toBe(true);
      const te = changed("hi", (e) => (e.polite = [...real.en.polite]));
      expect(has(run(te), "no Devanagari text")).toBe(true);
    });
    it("the parent word: empty, braces, wrong script, English", () => {
      expect(has(run(changed("hi", (e) => (e.parentWord = " "))), "must be a word")).toBe(true);
      expect(has(run(changed("hi", (e) => (e.parentWord = "{अभिभावक}"))), "has a brace")).toBe(true);
      expect(has(run(changed("te", (e) => (e.parentWord = "Parent"))), "no Telugu text")).toBe(true);
    });
  });
});

describe("pnpm i18n:check wiring", { timeout: 30_000 }, () => {
  const script = join(process.cwd(), "scripts", "i18n-check.mjs");
  const go = (...args: string[]) => spawnSync(process.execPath, [script, ...args], { cwd: process.cwd(), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

  it("the plain run passes and names the app templates in its summary", () => {
    const r = go();
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("8 app templates and 4 parent words, 3 languages not reviewed (hi, kn, te)");
  });

  it("strict fails on the app templates until a native reader signs", () => {
    const r = go("--strict");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('templates.app.json "hi" is not reviewed');
    expect(r.stderr).toContain('templates.app.json "te" is not reviewed');
  });

  it("a folder without the file is checked as before", () => {
    const dir = mkdtempSync(join(tmpdir(), "app-wire-"));
    dirs.push(dir);
    mkdirSync(join(dir, "messages"));
    for (const l of ["en", "hi", "kn", "te"]) writeFileSync(join(dir, "messages", `${l}.json`), JSON.stringify({ a: { b: "x" } }));
    const r = spawnSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
    expect(r.stdout).not.toContain("app templates");
  });
});
