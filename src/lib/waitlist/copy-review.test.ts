// @vitest-environment node
// Spec R0-4, criterion 20: the waitlist's promise sentences need a native reader's sign-off, and
// `i18n:check --strict` fails until each of hi, kn and te has one.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkReviewRecord, copyHash } from "../../../scripts/i18n-check-lib.mjs";
import { spawnSync } from "node:child_process";

const made: string[] = [];
afterEach(() => {
  while (made.length) rmSync(made.pop()!, { recursive: true, force: true });
});

const KEYS = ["form.consent", "form.done.title"];
const tree = (consent: string) => ({ form: { consent, done: { title: "Title" } } });

function setup(record: unknown, messages: Record<string, unknown> = {}) {
  const dir = mkdtempSync(join(tmpdir(), "copy-review-"));
  made.push(dir);
  for (const l of ["en", "hi", "kn", "te"]) writeFileSync(join(dir, `${l}.json`), JSON.stringify(messages[l] ?? tree(`${l} consent`)));
  const file = join(dir, "copy.review.json");
  writeFileSync(file, typeof record === "string" ? record : JSON.stringify(record));
  return { dir, file };
}

const open = { status: "not reviewed", reviewer: "", date: "", sha256: "" };
const signed = (messages: unknown) => ({ status: "reviewed", reviewer: "A. Reader", date: "2026-10-12", sha256: copyHash(messages, KEYS) });

describe("checkReviewRecord", () => {
  it("lists every language as not reviewed, and passes unless strict", () => {
    const { dir, file } = setup({ hi: open, kn: open, te: open });
    const result = checkReviewRecord(file, KEYS, { messagesDir: dir });
    expect(result.notReviewed).toEqual(["hi", "kn", "te"]);
    expect(result.problems).toEqual([]);
    expect(result.notes).toHaveLength(3);
  });

  it("fails strict while any language is unreviewed", () => {
    const { dir, file } = setup({ hi: signed(tree("hi consent")), kn: open, te: open });
    const result = checkReviewRecord(file, KEYS, { messagesDir: dir, strict: true });
    expect(result.notReviewed).toEqual(["kn", "te"]);
    expect(result.problems).toHaveLength(2);
    expect(result.problems.join("\n")).toMatch(/kn promise sentences are not reviewed|messages\/kn\.json promise sentences are not reviewed/);
  });

  it("passes strict when all three are signed for the text as it stands", () => {
    const { dir, file } = setup({ hi: signed(tree("hi consent")), kn: signed(tree("kn consent")), te: signed(tree("te consent")) });
    const result = checkReviewRecord(file, KEYS, { messagesDir: dir, strict: true });
    expect(result).toMatchObject({ problems: [], notReviewed: [] });
  });

  it("counts a sign-off as void when the text changed after it", () => {
    const { dir, file } = setup(
      { hi: signed(tree("an older sentence")), kn: signed(tree("kn consent")), te: signed(tree("te consent")) },
    );
    const lax = checkReviewRecord(file, KEYS, { messagesDir: dir });
    expect(lax.notReviewed).toEqual(["hi"]);
    expect(lax.problems).toEqual([]);
    const strict = checkReviewRecord(file, KEYS, { messagesDir: dir, strict: true });
    expect(strict.problems.join("\n")).toMatch(/changed after the review/);
  });

  it("refuses a sign-off with no reviewer, date or hash", () => {
    const { dir, file } = setup({ hi: { status: "reviewed", reviewer: "", date: "", sha256: "" }, kn: open, te: open });
    expect(checkReviewRecord(file, KEYS, { messagesDir: dir }).problems).toHaveLength(3);
  });

  it("never allows a promise sentence to be a TODO-translate", () => {
    const { dir, file } = setup({ hi: open, kn: open, te: open }, { te: tree("TODO-translate: consent") });
    const result = checkReviewRecord(file, KEYS, { messagesDir: dir });
    expect(result.problems.join("\n")).toMatch(/messages\/te\.json "form\.consent" is a promise sentence/);
  });

  it("reports a missing or unreadable record, an unknown language and a missing entry", () => {
    const a = setup("not json");
    expect(checkReviewRecord(a.file, KEYS, { messagesDir: a.dir }).problems.join()).toMatch(/not valid JSON/);
    const b = setup({ hi: open, kn: open, te: open, fr: open });
    expect(checkReviewRecord(b.file, KEYS, { messagesDir: b.dir }).problems.join()).toMatch(/"fr"/);
    const c = setup({ hi: open });
    expect(checkReviewRecord(c.file, KEYS, { messagesDir: c.dir }).problems.join()).toMatch(/missing "kn"/);
    expect(checkReviewRecord(join(a.dir, "nope.json"), KEYS, { messagesDir: a.dir }).problems.join()).toMatch(/does not exist/);
  });
});

const KEYS_REAL = [
  "waitlistForm.consent",
  "waitlistForm.done.stamp",
  "waitlistForm.done.title",
  "waitlistForm.done.body",
  "waitlistForm.failed.title",
  "waitlistForm.failed.detail",
  "waitlistForm.rateLimited.title",
  "waitlistForm.rateLimited.detail",
];

describe("the real record", () => {
  it("is part of pnpm i18n:check, and --strict fails on it while nobody has signed", () => {
    const lax = spawnSync("node", ["scripts/i18n-check.mjs"], { cwd: process.cwd(), encoding: "utf8" });
    expect(lax.status).toBe(0);
    expect(lax.stdout).toMatch(/8 promise sentences, 3 languages not reviewed \(hi, kn, te\)/);
    const strict = spawnSync("node", ["scripts/i18n-check.mjs", "--strict"], { cwd: process.cwd(), encoding: "utf8" });
    expect(strict.status).toBe(1);
    // (The script's long stderr can be cut short by process.exit, so the wording is checked on the library above.)
    const real = checkReviewRecord("src/lib/waitlist/copy.review.json", KEYS_REAL, { strict: true });
    expect(real.problems).toHaveLength(3);
  });
});
