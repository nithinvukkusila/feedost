// @vitest-environment node
// Spec R1-9 Part B, criterion 40 and plan B6: the pay page words have a review record, a word still marked
// TODO-translate is allowed until release (the parent sees English), and the consent wording has a draft block that
// `i18n:check --strict` fails on until the founder approves it. Nothing here is a string a parent can see.
// Spec parent-pages-english, criterion 12 (plan section 2): the receipt and pay page records are parent records. A
// language that is not signed is locked (parents see English), which no longer fails --strict; a stale signature does.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { check, checkConsentWording, checkReviewRecord, consentHash, copyHash } from "../../scripts/i18n-check-lib.mjs";
import { isSigned, lockedEverywhere } from "../../scripts/language-unlock.mjs";

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
    expect(lax.notes[0]).toBe("payPage consent wording is a draft: release to real parents blocked on R1-9 question 3");
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

describe("checkReviewRecord for a parent record (parent: true)", () => {
  const hiText = { a: "ए", b: "बी" };
  const signedHi = () => copyHash({ payPage: hiText }, KEYS);
  const parentOptions = { ignoreKeys: ["consentWording"], todoAllowed: true, parent: true, noun: "pay page word", label: "pay-page-words.review.json" };
  const run = (entry: unknown, hi: Record<string, string>, strict: boolean) => {
    const { dir, file } = setup({ ...record, hi: entry }, hi);
    return checkReviewRecord(file, KEYS, { ...parentOptions, messagesDir: dir, strict });
  };

  it("signed with the current hash: a note that parents see it, and a pass under strict", () => {
    const entry = { status: "reviewed", reviewer: "Asha Rao", date: "2026-10-20", sha256: signedHi() };
    const lax = run(entry, hiText, false);
    expect(lax.problems).toEqual([]);
    expect(lax.notReviewed).toEqual(["kn", "te"]);
    expect(lax.notes.join("\n")).toContain("hi: pay page words signed by Asha Rao on 2026-10-20; parents see hi");
    expect(run(entry, hiText, true).problems).toEqual([]);
  });

  it("not reviewed: a note that it is locked and parents see English, and a pass under strict", () => {
    const lax = run(open, hiText, false);
    expect(lax.problems).toEqual([]);
    expect(lax.notes.join("\n")).toContain("hi: pay page words not reviewed, so locked: parents see English");
    expect(run(open, hiText, true).problems).toEqual([]);
  });

  it("reviewed with a missing name, date or hash: a problem either way", () => {
    for (const entry of [
      { status: "reviewed", reviewer: "", date: "2026-10-20", sha256: signedHi() },
      { status: "reviewed", reviewer: "Asha Rao", date: "", sha256: signedHi() },
      { status: "reviewed", reviewer: "Asha Rao", date: "2026-10-20", sha256: "" },
    ]) {
      expect(run(entry, hiText, false).problems).toHaveLength(1);
      expect(run(entry, hiText, true).problems).toHaveLength(1);
    }
  });

  it("reviewed, but the text changed since: locked again, a note, and a problem under strict", () => {
    const entry = { status: "reviewed", reviewer: "Asha Rao", date: "2026-10-20", sha256: signedHi() };
    const changed = { a: "ए", b: "बदला" };
    const lax = run(entry, changed, false);
    expect(lax.problems).toEqual([]);
    expect(lax.notReviewed).toContain("hi");
    expect(lax.notes.join("\n")).toContain("hi: pay page words locked again: text changed after review by Asha Rao on 2026-10-20");
    const strict = run(entry, changed, true);
    expect(strict.problems).toHaveLength(1);
    expect(strict.problems[0]).toContain('set "hi" back to "not reviewed"');
    // A word marked TODO-translate after the sign-off is the same: someone changed signed text.
    expect(run(entry, { a: "ए", b: "TODO-translate: B" }, true).problems.join()).toContain("changed after the review");
  });

  it("a TODO-translate word in a locked language is not a problem, even under strict", () => {
    expect(run(open, { a: "TODO-translate: A", b: "बी" }, true).problems).toEqual([]);
  });

  it("agrees with isSigned on every entry", () => {
    const hash = signedHi();
    const vectors: unknown[] = [
      { status: "reviewed", reviewer: "Asha Rao", date: "2026-10-20", sha256: hash },
      { status: "reviewed", reviewer: "   ", date: "2026-10-20", sha256: hash },
      { status: "Reviewed", reviewer: "Asha Rao", date: "2026-10-20", sha256: hash },
      { status: "model reviewed", reviewer: "Asha Rao", date: "2026-10-20", sha256: hash },
      { status: "reviewed", reviewer: "Asha Rao", date: "20-10-2026", sha256: hash },
      { status: "reviewed", reviewer: "Asha Rao", date: "2026-10-20", sha256: "0".repeat(64) },
      { status: "reviewed", reviewer: "Asha Rao", date: "2026-10-20", sha256: hash.toUpperCase() },
      open,
    ];
    for (const entry of vectors) {
      const verdict = run(entry, hiText, false);
      expect(!verdict.notReviewed.includes("hi"), JSON.stringify(entry)).toBe(isSigned(entry, hash));
    }
    expect(isSigned(vectors[0], hash)).toBe(true);
  });
});

describe("the test fixture's name (signedFixture) is never a sign-off in a real record", () => {
  it("refuses a language signed by Test fixture, even with the right hash, and keeps it locked", () => {
    const hash = copyHash({ payPage: { a: "ए", b: "बी" } }, KEYS);
    for (const reviewer of ["Test fixture", " test FIXTURE "]) {
      const { dir, file } = setup({ ...record, hi: { status: "reviewed", reviewer, date: "2026-10-16", sha256: hash } }, { a: "ए", b: "बी" });
      const result = checkReviewRecord(file, KEYS, { messagesDir: dir, ignoreKeys: ["consentWording"], todoAllowed: true, parent: true, label: "pay-page-words.review.json" });
      expect(result.problems).toEqual(['pay-page-words.review.json "hi" is signed by "Test fixture", the test fixture: only a named person can sign a language']);
      expect(result.notReviewed).toContain("hi");
    }
  });

  it("refuses consent wording approved by Test fixture", () => {
    const { dir } = consentDir("Agree");
    const sha256 = consentHash(dir) ?? "";
    const result = checkConsentWording({ consentWording: { status: "approved", approvedBy: "Test fixture", date: "2026-10-16", sha256 } }, { messagesDir: dir });
    expect(result.problems.join()).toContain("the test fixture: only the founder can approve it");
    expect(result.approved).toBe(false);
  });
});

describe("i18n-check.mjs treats both parent records alike", () => {
  it("passes todoAllowed and parent for the receipt record and the pay page record", () => {
    const script = readFileSync("scripts/i18n-check.mjs", "utf8");
    const calls = [...script.matchAll(/checkReviewRecord\((RECEIPT_REVIEW|PAYPAGE_REVIEW), keys, \{([^}]*)\}/g)];
    expect(calls.map((c) => c[1]).sort()).toEqual(["PAYPAGE_REVIEW", "RECEIPT_REVIEW"]);
    for (const call of calls) {
      expect(call[2], call[1]).toMatch(/todoAllowed: true/);
      expect(call[2], call[1]).toMatch(/parent: true/);
    }
  });

  it("lets a TODO-translate receipt word in a locked language pass plain and strict alike", () => {
    const run = (strict: boolean) => {
      const { dir, file } = setup(record, { a: "TODO-translate: A", b: "बी" });
      return checkReviewRecord(file, KEYS, { messagesDir: dir, strict, ignoreKeys: ["consentWording"], noun: "parent receipt word", todoAllowed: true, parent: true }).problems;
    };
    expect(run(false)).toEqual([]);
    expect(run(true)).toEqual([]);
  });
});

describe("check() with skipTodo", () => {
  it("skips the strict marker problem only where it is told to", () => {
    const dir = mkdtempSync(join(tmpdir(), "skip-todo-"));
    made.push(dir);
    const en = { payPage: { a: "A" }, app: { b: "B" } };
    writeFileSync(join(dir, "en.json"), JSON.stringify(en));
    for (const l of ["hi", "kn", "te"]) writeFileSync(join(dir, `${l}.json`), JSON.stringify({ payPage: { a: "TODO-translate: A" }, app: { b: "TODO-translate: B" } }));
    const skip = lockedEverywhere({ payPage: ["en"], receipt: ["en"] });
    const problems = check(dir, { strict: true, skipTodo: skip }).problems;
    expect(problems.some((p: string) => p.includes('"payPage.a"'))).toBe(false);
    expect(problems.filter((p: string) => p.includes('"app.b"'))).toHaveLength(3);
    // Unlocked for /p/: Hindi's marker is a problem again.
    const hiOpen = check(dir, { strict: true, skipTodo: lockedEverywhere({ payPage: ["en", "hi"], receipt: ["en", "hi"] }) }).problems;
    expect(hiOpen).toContain('messages/hi.json "payPage.a" is still marked TODO-translate');
  });

  it("treats a receipt key as locked only when no surface that uses it is unlocked", () => {
    const skip = lockedEverywhere({ payPage: ["en"], receipt: ["en", "kn"] });
    expect(skip("hi", "receipt.months.m01")).toBe(true);
    expect(skip("kn", "receipt.months.m01")).toBe(false);
    expect(skip("kn", "payPage.total")).toBe(true);
    expect(skip("hi", "remindScreen.title")).toBe(false);
  });
});

describe("the shipped record", () => {
  it("is a draft and marks hi, kn and te not reviewed", () => {
    const shipped = JSON.parse(readFileSync("src/lib/pay-page-words.review.json", "utf8"));
    expect(shipped.consentWording.status).toBe("draft, not approved");
    for (const l of ["hi", "kn", "te"]) expect(shipped[l].status).toBe("not reviewed");
  });

  it("makes i18n:check --strict fail on the consent draft but not on locked parent languages, and plain i18n:check pass", () => {
    const strict = spawnSync("node", ["scripts/i18n-check.mjs", "--strict"], { encoding: "utf8" });
    expect(strict.status).toBe(1);
    expect(strict.stderr).toContain("payPage consent wording is a draft: release to real parents blocked on R1-9 question 3");
    expect(strict.stderr).not.toContain("pay page words are not reviewed");
    expect(strict.stderr).not.toContain("receipt words are not reviewed");
    expect(strict.stderr).not.toMatch(/"(payPage|receipt)\.[^"]+" is still marked TODO-translate/);
    expect(strict.stderr).not.toContain("pay page words still marked");
    expect(strict.stdout).toContain("parent pages: /p/ en | /r/ en (locked: hi, kn, te)");
    const plain = spawnSync("node", ["scripts/i18n-check.mjs"], { encoding: "utf8" });
    expect(plain.status).toBe(0);
    expect(plain.stdout).toContain("consent wording a draft");
    expect(plain.stdout).toContain("hi: pay page words not reviewed, so locked: parents see English");
    expect(plain.stdout).toContain("parent pages: /p/ en | /r/ en (locked: hi, kn, te)");
  });
});
