// Spec parent-pages-english, section 3 ("Consent wording") and plan section 10: while the consent wording is a draft,
// the consent and privacy-notice lines are English inside an unlocked language, and only an approval for the wording
// as it stands lets that language's own consent lines through.
//
// Today every hi, kn and te consent value is still marked TODO-translate, so it already shows as English and a test on
// the real words could not tell the override from no override. Here the words are the real ones with Hindi's consent
// lines replaced by text that is plainly Hindi, so the override is what makes them English.
import { describe, expect, it, vi } from "vitest";
import { stripTodo } from "@/i18n/messages";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";
import kn from "../../messages/kn.json";
import te from "../../messages/te.json";
import { signedFixture } from "../../scripts/language-unlock.mjs";

type Tree = { [key: string]: string | Tree };

/** Every consent leaf of English, written as plainly Hindi text, so a leak of either way is visible. */
const hindiConsent = (node: Tree, path = ""): Tree =>
  Object.fromEntries(Object.entries(node).map(([key, value]) => [key, typeof value === "string" ? `हिन्दी सहमति ${path}${key}` : hindiConsent(value, `${path}${key}.`)]));

const messages: Record<"en" | "hi" | "kn" | "te", Tree> = {
  en: stripTodo(en),
  hi: { ...stripTodo(hi), payPage: { ...stripTodo(hi).payPage, consent: hindiConsent(en.payPage.consent) } },
  kn: stripTodo(kn),
  te: stripTodo(te),
};

vi.mock("@/i18n/words", async (actual) => {
  const real = await actual<typeof import("@/i18n/words")>();
  return {
    ...real,
    getAllWords: async (namespace: "payPage" | "receipt") =>
      Object.fromEntries((["en", "hi", "kn", "te"] as const).map((locale) => [locale, messages[locale][namespace]])),
  };
});

const { payPageWords } = await import("./unlocked-languages");

describe("the consent lines of an unlocked language", () => {
  it("are English's while the consent wording is a draft, and the rest of the page stays Hindi", async () => {
    const words = await payPageWords({ records: signedFixture("payPage", ["hi"], { messages }), messages });
    expect(Object.keys(words)).toEqual(["en", "hi"]);
    expect(words.hi?.pay.consent).toEqual(words.en.pay.consent);
    expect(words.hi?.pay.consent.title).toBe(en.payPage.consent.title);
    expect(JSON.stringify(words.hi?.pay.consent)).not.toContain("हिन्दी सहमति");
    // Only the consent subtree is swapped: Hindi's other pay page words and its month names are still its own.
    expect(words.hi?.pay.total).toBe(hi.payPage.total);
    expect(words.hi?.pay.total).not.toBe(en.payPage.total);
    expect(words.hi?.receipt.months).toEqual(hi.receipt.months);
    // And the page knows the consent lines are English, so they carry lang="en" (criterion 4).
    expect(words.hi?.consentLang).toBe("en");
    expect(words.en.consentLang).toBe("en");
  });

  it("are the language's own once the founder approves the wording as it stands", async () => {
    const words = await payPageWords({ records: signedFixture("payPage", ["hi"], { messages, consent: true }), messages });
    expect(words.hi?.pay.consent.title).toBe("हिन्दी सहमति title");
    expect(words.hi?.consentLang).toBe("hi");
    expect(words.en.pay.consent.title).toBe(en.payPage.consent.title);
  });

  it("go back to English when the wording changes after it was approved", async () => {
    const records = signedFixture("payPage", ["hi"], { messages, consent: true });
    const changed = { ...messages, en: { ...messages.en, payPage: { ...(messages.en.payPage as Tree), consent: { ...((messages.en.payPage as Tree).consent as Tree), title: "Changed" } } } };
    // English's pay page text changed, so Hindi's signature (over Hindi's text) still holds but the consent approval does not.
    const words = await payPageWords({ records, messages: changed });
    expect(Object.keys(words)).toEqual(["en", "hi"]);
    expect(words.hi?.pay.consent).toEqual(words.en.pay.consent);
  });

  it("are English's with the shipped records whatever the words say (the shipped consent wording is a draft)", async () => {
    // The shipped records sign nothing, so Hindi is not even on the page; with Hindi signed over these messages but
    // the shipped consent block, the wording is still a draft.
    const signed = signedFixture("payPage", ["hi"], { messages });
    const words = await payPageWords({ records: { payPage: { ...signed.payPage, consentWording: (await import("./pay-page-words.review.json")).default.consentWording }, receipt: signed.receipt }, messages });
    expect(Object.keys(words)).toEqual(["en", "hi"]);
    expect(words.hi?.pay.consent).toEqual(words.en.pay.consent);
  });
});
