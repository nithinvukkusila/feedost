// @vitest-environment node
// Spec R1-9 Part B, criterion 40 and plan B6: the pay page words have a review record, a word still marked
// TODO-translate is allowed until release (the parent sees English), and the consent wording has a draft block that
// `i18n:check --strict` fails on until the founder approves it. Nothing here is a string a parent can see.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { checkConsentWording, checkReviewRecord, consentHash } from "../../scripts/i18n-check-lib.mjs";

const made: string[] = [];
afterEach(() => {
  while (made.length) rmSync(made.pop()!, { recursive: true, force: true });
});

const KEYS = ["payPage.a", "payPage.b"];
function setup(record: unknown, hi: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "pay-review-"));
  made.push(dir);
  for (const l of ["en", "kn", "te"]) writeFileSync(join(dir, `${l}.json`), JSON.stringify({ payPage: { a: "A", b: "B" } }));
  writeFileSync(join(dir, "hi.json"), JSON.stringify({ payPage: hi }));
  const file = join(dir, "review.json");
  writeFileSync(file, JSON.stringify(record));
  return { dir, file };
}
function consentDir(agree: string) {
  const dir = mkdtempSync(join(tmpdir(), "consent-"));
  made.push(dir);
  for (const l of ["en", "hi", "kn", "te"]) writeFileSync(join(dir, `${l}.json`), JSON.stringify({ payPage: { consent: { agree } } }));
  return { dir };
}
const open = { status: "not reviewed", reviewer: "", date: "", sha256: "" };
const record = { consentWording: { status: "draft, not approved", approvedBy: "", date: "" }, hi: open, kn: open, te: open };

describe("checkReviewRecord for the pay page options", () => {
  it("refuses an unknown top-level key unless it is ignored", () => {
    const { dir, file } = setup(record, { a: "ए", b: "बी" });
    expect(checkReviewRecord(file, KEYS, { messagesDir: dir }).problems.join()).toContain("consentWording");
    expect(checkReviewRecord(file, KEYS, { messagesDir: dir, ignoreKeys: ["consentWording"] }).problems).toEqual([]);
  });

  it("lets a TODO-translate word pass until strict, then fails on it", () => {
    const { dir, file } = setup(record, { a: "TODO-translate: A", b: "बी" });
    const options = { messagesDir: dir, ignoreKeys: ["consentWording"], todoAllowed: true };
    expect(checkReviewRecord(file, KEYS, options).problems).toEqual([]);
    expect(checkReviewRecord(file, KEYS, { ...options, strict: true }).problems.join("\n")).toContain("still marked TODO-translate");
    // Without the option a marked word is a problem straight away (the receipt and waitlist rule).
    expect(checkReviewRecord(file, KEYS, { messagesDir: dir, ignoreKeys: ["consentWording"] }).problems.join()).toContain("cannot be marked");
  });
});

describe("checkConsentWording", () => {
  it("is a note on every run and a problem under strict while the wording is a draft", () => {
    const lax = checkConsentWording(record);
    expect(lax).toMatchObject({ problems: [], approved: false });
    expect(lax.notes[0]).toContain("release blocked on founder answers to R1-9 questions 3 and 5");
    const strict = checkConsentWording(record, { strict: true });
    expect(strict.problems[0]).toContain("draft");
    expect(strict.approved).toBe(false);
  });

  it("passes once approved with a name, a date and the hash of the wording that was read", () => {
    const { dir } = consentDir("Agree");
    const sha256 = consentHash(dir) ?? "";
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
    const approved = { consentWording: { status: "approved", approvedBy: "Founder", date: "2026-10-20", sha256 } };
    expect(checkConsentWording(approved, { strict: true, messagesDir: dir })).toEqual({ problems: [], notes: [], approved: true });
  });

  it("treats wording that changed after approval as not approved, and a problem under strict", () => {
    const { dir } = consentDir("Agree");
    const sha256 = consentHash(dir) ?? "";
    const approved = { consentWording: { status: "approved", approvedBy: "Founder", date: "2026-10-20", sha256 } };
    writeFileSync(join(dir, "kn.json"), JSON.stringify({ payPage: { consent: { agree: "Changed" } } }));
    const lax = checkConsentWording(approved, { messagesDir: dir });
    expect(lax).toMatchObject({ problems: [], approved: false });
    expect(lax.notes[0]).toContain("changed after approval");
    const strict = checkConsentWording(approved, { strict: true, messagesDir: dir });
    expect(strict.problems[0]).toContain("changed after approval");
    expect(strict.approved).toBe(false);
  });

  it("refuses an approval with no hash", () => {
    const { dir } = consentDir("Agree");
    const result = checkConsentWording({ consentWording: { status: "approved", approvedBy: "Founder", date: "2026-10-20" } }, { messagesDir: dir });
    expect(result.problems.join()).toContain("no sha256");
    expect(result.approved).toBe(false);
  });

  it("hashes only payPage.consent, in all four files", () => {
    const { dir } = consentDir("Agree");
    const before = consentHash(dir);
    writeFileSync(join(dir, "te.json"), JSON.stringify({ payPage: { consent: { agree: "Agree" }, other: "changed" } }));
    expect(consentHash(dir)).toBe(before);
    writeFileSync(join(dir, "te.json"), JSON.stringify({ payPage: { consent: { agree: "Other" } } }));
    expect(consentHash(dir)).not.toBe(before);
  });

  it("refuses an approval with no name or no date, and a record with no block", () => {
    expect(checkConsentWording({ consentWording: { status: "approved", approvedBy: "", date: "" } }).problems).toHaveLength(3);
    expect(checkConsentWording({}).problems[0]).toContain("no \"consentWording\" block");
  });
});

describe("the shipped record", () => {
  it("is a draft and marks hi, kn and te not reviewed", () => {
    const shipped = JSON.parse(readFileSync("src/lib/pay-page-words.review.json", "utf8"));
    expect(shipped.consentWording.status).toBe("draft, not approved");
    for (const l of ["hi", "kn", "te"]) expect(shipped[l].status).toBe("not reviewed");
  });

  it("makes i18n:check --strict fail for payPage and plain i18n:check pass", () => {
    const strict = spawnSync("node", ["scripts/i18n-check.mjs", "--strict"], { encoding: "utf8" });
    expect(strict.status).toBe(1);
    expect(strict.stderr).toContain("payPage consent wording is a draft");
    expect(strict.stderr).toContain("pay page words are not reviewed");
    const plain = spawnSync("node", ["scripts/i18n-check.mjs"], { encoding: "utf8" });
    expect(plain.status).toBe(0);
    expect(plain.stdout).toContain("consent wording a draft");
  });
});
