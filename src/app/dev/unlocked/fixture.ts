// The test fixture behind /dev/unlocked/p and /dev/unlocked/r (spec parent-pages-english, criterion 10): review
// records signed "Test fixture" for hi, kn and te, so the layout tests can run the parent pages in every language
// before a person has signed any. Only these dev pages use it; `page.dev.tsx` keeps them out of every Vercel
// production build, and CI checks that `fixtureTitle` is not in one.
//
// The hashes are taken over the message files with their TODO-translate markers taken out: today hi, kn and te still
// have marked pay page words, which can never be signed (a marked word shows English). The pages then show the same
// words a parent would see once each language is signed.
import type { Metadata } from "next";
import { stripTodo } from "@/i18n/messages";
import type { UnlockSource } from "@/lib/unlocked-languages";
import en from "../../../../messages/en.json";
import hi from "../../../../messages/hi.json";
import kn from "../../../../messages/kn.json";
import te from "../../../../messages/te.json";
import { signedFixture } from "../../../../scripts/language-unlock.mjs";

/** Not a parent's words: the title of a page only a test opens. Also the CI sentinel for these pages. */
export const fixtureTitle = "Parent page with every language unlocked (test fixture)";

export const fixtureMetadata: Metadata = {
  title: fixtureTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const messages = { en: stripTodo(en), hi: stripTodo(hi), kn: stripTodo(kn), te: stripTodo(te) };

/** The pay page with hi, kn and te signed and the consent wording approved, so its hi, kn and te consent text is laid out too. */
export const payPageFixture: UnlockSource = { records: signedFixture("payPage", ["hi", "kn", "te"], { messages, consent: true }), messages };

/** The receipt page with hi, kn and te signed. */
export const receiptFixture: UnlockSource = { records: signedFixture("receipt", ["hi", "kn", "te"], { messages }), messages };
