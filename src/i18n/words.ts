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
import { getMessages } from "next-intl/server";
import type en from "../../messages/en.json";

type Messages = typeof en;

/** The namespaces that may be handed to an island as words. Each holds plain text only. */
export const plainNamespaces = ["reminderForm", "waitlistForm"] as const satisfies readonly (keyof Messages)[];
export type PlainNamespace = (typeof plainNamespaces)[number];

type Tree = { [key: string]: string | Tree };

/** Every value under `tree` that would need parsing, as `path: value`. Empty when the tree is plain text. */
export function notPlain(tree: Tree, path = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const full = path ? `${path}.${key}` : key;
    if (typeof value !== "string") return notPlain(value, full);
    return /[{}<>]/.test(value) ? [`${full}: ${value}`] : [];
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
