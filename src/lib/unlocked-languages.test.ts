// Which languages a parent page carries (spec parent-pages-english, criteria 1, 2, 3 and 9; plan section 2).
import { describe, expect, it } from "vitest";
import { stripTodo } from "@/i18n/messages";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import kn from "../../messages/kn.json";
import te from "../../messages/te.json";
import { consentApproved, consentHashOf, recordHash, signedFixture, unlockedFrom } from "../../scripts/language-unlock.mjs";
import { languagesOf, shownLanguage, wordsIn } from "./public-words";
import { payPageWords, receiptWords, unlockedLanguages } from "./unlocked-languages";

type Tree = { [key: string]: string | Tree };

/** Four small message files: a pay page and a receipt namespace in each, nothing marked. */
function files(): Record<"en" | "hi" | "kn" | "te", Tree> {
  const one = (tag: string) => ({ payPage: { total: `${tag} total`, consent: { agree: `${tag} agree` } }, receipt: { footer: `${tag} footer` } });
  return { en: one("en"), hi: one("hi"), kn: one("kn"), te: one("te") };
}

const raw = { en, hi, kn, te };
const plain = { en: stripTodo(en), hi: stripTodo(hi), kn: stripTodo(kn), te: stripTodo(te) };

describe("unlockedFrom", () => {
  it("unlocks exactly the signed language, for a fixture signed for /p/", () => {
    const messages = files();
    const records = signedFixture("payPage", ["hi"], { messages });
    expect(unlockedFrom("payPage", { records, messages })).toEqual(["en", "hi"]);
    expect(unlockedFrom("receipt", { records, messages })).toEqual(["en", "hi"]);
  });

  it("keeps the usual order whatever order the fixture names them in", () => {
    const messages = files();
    expect(unlockedFrom("payPage", { records: signedFixture("payPage", ["te", "hi"], { messages }), messages })).toEqual(["en", "hi", "te"]);
  });

  it.each([
    ["a blank reviewer", { reviewer: "  " }],
    ["status Reviewed", { status: "Reviewed" }],
    ["status model reviewed", { status: "model reviewed" }],
    ["no date", { date: "" }],
    ["a wrong sha256", { sha256: "0".repeat(64) }],
  ])("stays English with %s", (_name, change) => {
    const messages = files();
    const records = signedFixture("payPage", ["hi"], { messages });
    records.payPage.hi = { ...records.payPage.hi, ...change };
    expect(unlockedFrom("payPage", { records, messages })).toEqual(["en"]);
  });

  it("stays English with a valid sha256 of other text", () => {
    const messages = files();
    const records = signedFixture("payPage", ["hi"], { messages });
    const other = files();
    (other.hi.payPage as Tree).total = "something else";
    records.payPage.hi.sha256 = recordHash("payPage", "hi", other);
    expect(records.payPage.hi.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(unlockedFrom("payPage", { records, messages })).toEqual(["en"]);
  });

  it("stays English when one key is still marked TODO-translate, even with that text's hash", () => {
    const messages = files();
    (messages.hi.payPage as Tree).total = "TODO-translate: en total";
    const records = signedFixture("payPage", ["hi"], { messages });
    expect(recordHash("payPage", "hi", messages)).toBeNull();
    expect(unlockedFrom("payPage", { records, messages })).toEqual(["en"]);
  });

  it("needs both records for /p/: the pay page record alone, or the receipt record alone, gives English", () => {
    const messages = files();
    const signed = signedFixture("payPage", ["hi"], { messages });
    const none = signedFixture("payPage", [], { messages });
    expect(unlockedFrom("payPage", { records: { payPage: signed.payPage, receipt: none.receipt }, messages })).toEqual(["en"]);
    expect(unlockedFrom("payPage", { records: { payPage: none.payPage, receipt: signed.receipt }, messages })).toEqual(["en"]);
    // /r/ needs only the receipt record, so it can unlock before /p/.
    expect(unlockedFrom("receipt", { records: { payPage: none.payPage, receipt: signed.receipt }, messages })).toEqual(["en", "hi"]);
  });

  it("changed text after signing locks the language again", () => {
    const messages = files();
    const records = signedFixture("receipt", ["kn"], { messages });
    (messages.kn.receipt as Tree).footer = "changed";
    expect(unlockedFrom("receipt", { records, messages })).toEqual(["en"]);
  });

  it("refuses a surface it does not know", () => {
    expect(() => unlockedFrom("nowhere", { records: {}, messages: files() })).toThrow(RangeError);
  });
});

describe("consentApproved", () => {
  it("is true only for the fixture that approves it, and false once the wording changes", () => {
    const messages = files();
    expect(consentApproved(signedFixture("payPage", ["hi"], { messages }).payPage, messages)).toBe(false);
    const approved = signedFixture("payPage", ["hi"], { messages, consent: true }).payPage;
    expect(approved.consentWording.sha256).toBe(consentHashOf(messages));
    expect(consentApproved(approved, messages)).toBe(true);
    ((messages.te.payPage as Tree).consent as Tree).agree = "changed";
    expect(consentApproved(approved, messages)).toBe(false);
  });
});

describe("the shipped records", () => {
  it("unlock English only on /p/ and /r/ (hi, kn and te are not reviewed)", () => {
    expect(unlockedLanguages("payPage")).toEqual(["en"]);
    expect(unlockedLanguages("receipt")).toEqual(["en"]);
  });

  it("hand /p/ and /r/ the English words only", async () => {
    const pay = await payPageWords();
    const receipt = await receiptWords();
    expect(Object.keys(pay)).toEqual(["en"]);
    expect(Object.keys(receipt)).toEqual(["en"]);
    expect(pay.en.pay.total).toBe(en.payPage.total);
    expect(receipt.en.footer).toBe(en.receipt.footer);
  });

  it("are checked against the raw files: records signed over the marker-stripped files (the /dev fixture's) unlock nothing on the real pages", async () => {
    // The /dev fixture signs hashes taken over the files with their markers taken out. The real pages pass no
    // messages, so the shipped raw files are used: a marked word keeps its hash null and the language stays locked.
    // If the production path ever hashed stripped files, these records would unlock every language that still has a
    // marked pay page word.
    const stripped = { pay: signedFixture("payPage", ["hi", "kn", "te"], { messages: plain, consent: true }), receipt: signedFixture("receipt", ["hi", "kn", "te"], { messages: plain }) };
    const marked = (["hi", "kn", "te"] as const).filter((locale) => recordHash("payPage", locale, raw) === null);
    expect(marked.length, "a language with a marked pay page word, so the test can tell raw from stripped").toBeGreaterThan(0);
    const pay = unlockedLanguages("payPage", { records: stripped.pay });
    for (const locale of marked) expect(pay).not.toContain(locale);
    expect(Object.keys(await payPageWords({ records: stripped.pay })).filter((l) => (marked as readonly string[]).includes(l))).toEqual([]);
    // The same records, checked against the stripped files, do unlock them: so it is the files, not the records, that lock.
    expect(unlockedLanguages("payPage", { records: stripped.pay, messages: plain })).toEqual(["en", "hi", "kn", "te"]);
  });

  it("hash the raw files: the same records over the files with markers taken out would differ", () => {
    // hi's pay page words still carry markers, so the raw hash is null and nothing can sign it as it stands.
    expect(recordHash("payPage", "hi", raw)).toBeNull();
    expect(recordHash("payPage", "hi", plain)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the /dev fixture's words", () => {
  const fixture = { records: signedFixture("payPage", ["hi", "kn", "te"], { messages: plain, consent: true }), messages: plain };

  it("carry all four languages, with each language's own consent lines when the consent is approved", async () => {
    const pay = await payPageWords(fixture);
    expect(Object.keys(pay)).toEqual(["en", "hi", "kn", "te"]);
    expect(pay.hi?.pay.consent.title).toBe(stripTodo(hi.payPage).consent.title);
    const receipt = await receiptWords({ records: signedFixture("receipt", ["hi", "kn", "te"], { messages: plain }), messages: plain });
    expect(Object.keys(receipt)).toEqual(["en", "hi", "kn", "te"]);
  });

  it("replace a language's consent lines with English's while the consent is a draft", async () => {
    const draft = await payPageWords({ records: signedFixture("payPage", ["hi"], { messages: plain }), messages: plain });
    expect(Object.keys(draft)).toEqual(["en", "hi"]);
    expect(draft.hi?.pay.consent).toEqual(draft.en.pay.consent);
    expect(draft.hi?.receipt.months).toEqual(hi.receipt.months);
  });

  it("never hold a TODO-translate marker (criterion 9)", async () => {
    const all = [await payPageWords(), await receiptWords(), await payPageWords(fixture), await receiptWords(fixture)];
    for (const words of all) expect(JSON.stringify(words)).not.toContain("TODO-translate");
  });
});

describe("shownLanguage", () => {
  const words = { en: "E", hi: "H" };

  it("shows a language only if its words are on the page, otherwise English", () => {
    expect(shownLanguage(words, "hi")).toBe("hi");
    expect(shownLanguage(words, "kn")).toBe("en");
    expect(shownLanguage(words, null)).toBe("en");
    expect(shownLanguage({ en: "E" }, "hi")).toBe("en");
    expect(wordsIn(words, "kn")).toBe("E");
    expect(languagesOf(words)).toEqual(["en", "hi"]);
  });
});
