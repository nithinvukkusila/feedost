// Words for a client island that needs only plain text (spec R0-2, plan section 4).
//
// A Server Component's words are already in the HTML and cost no JavaScript. An island that
// translates in the browser through `ClientMessages` pays about 12 KB for the message parser. An
// island whose words need no arguments and no plurals can skip that: the server page calls
// `getWords("namespace")` and passes the result as a prop. The object is typed from en.json, so a
// wrong key is still a type error, and `loadMessages` has already turned every `TODO-translate`
// value into its English text.
//
// Nothing parses these strings in the browser. So a namespace handed over this way must hold plain
// text only: no `{argument}`, no `<tag>`. `words.test.ts` fails if one does, in any language.
//
// One exception, for a page whose language is not known until it has run (the parent's receipt, `/r/{token}`):
// `getAllWords()` hands over one namespace in all four languages at once, and the page chooses at run time. Those
// words may hold `{name}` arguments, which `fill()` in src/lib/receipt-words.ts replaces by hand. Still no
// plural, no `select`, no `<tag>`: `notPlain(tree, "", { arguments: true })` is the test for it.
import { getMessages } from "next-intl/server";
import { locales, type Locale } from "@/config/locales";
import type en from "../../messages/en.json";
import { loadMessages } from "./messages";

type Messages = typeof en;

/** The namespaces that may be handed to an island as words. Each holds plain text only. */
export const plainNamespaces = ["reminderForm", "receiptForm", "waitlistForm"] as const satisfies readonly (keyof Messages)[];
export type PlainNamespace = (typeof plainNamespaces)[number];

/** The namespaces handed over in all four languages at once. Plain text plus `{name}` arguments only. */
export const argumentNamespaces = ["receipt"] as const satisfies readonly (keyof Messages)[];
export type ArgumentNamespace = (typeof argumentNamespaces)[number];

type Tree = { [key: string]: string | Tree };

/** A `{name}` argument: a word in braces, nothing else. */
const ARGUMENT = /\{[A-Za-z][A-Za-z0-9]*\}/g;

/**
 * Every value under `tree` that would need parsing, as `path: value`. Empty when the tree is plain text.
 * With `arguments: true` a `{name}` argument is allowed (the caller fills it in by hand); a bare brace, a
 * plural, a `select` and a tag still are not.
 */
export function notPlain(tree: Tree, path = "", options: { arguments?: boolean } = {}): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const full = path ? `${path}.${key}` : key;
    if (typeof value !== "string") return notPlain(value, full, options);
    const text = options.arguments ? value.replace(ARGUMENT, "") : value;
    return /[{}<>]/.test(text) ? [`${full}: ${value}`] : [];
  });
}

/** One plain-text namespace of the page's language, to pass to a client island as a prop. Server only. */
export async function getWords<N extends PlainNamespace>(namespace: N): Promise<Messages[N]> {
  // The type already says so; this is for a caller that got round it.
  if (!(plainNamespaces as readonly string[]).includes(namespace)) {
    throw new RangeError(`"${String(namespace)}" is not listed in plainNamespaces, so it cannot be handed to an island as words`);
  }
  const messages = (await getMessages()) as unknown as Messages;
  return messages[namespace];
}

/**
 * One namespace in every language, for a page that picks its language at run time. Server only. Each file is
 * read through `loadMessages`, so a value still marked `TODO-translate` is already its English text. The
 * namespace is checked for text a browser could not fill by hand, so a plural cannot slip into it unnoticed.
 */
export async function getAllWords<N extends ArgumentNamespace>(namespace: N): Promise<Record<Locale, Messages[N]>> {
  if (!(argumentNamespaces as readonly string[]).includes(namespace)) {
    throw new RangeError(`"${String(namespace)}" is not listed in argumentNamespaces, so it cannot be handed to a page in every language`);
  }
  const entries = await Promise.all(
    locales.map(async (locale) => {
      const words = (await loadMessages(locale))[namespace] as Tree;
      const bad = notPlain(words, namespace, { arguments: true });
      if (bad.length > 0) throw new RangeError(`${locale}: ${bad.join("; ")} needs more than {name} arguments`);
      return [locale, words] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<Locale, Messages[N]>;
}
