// Loads one language's messages. Knows nothing about routes: later token pages can call it too.
import type { Locale } from "@/config/locales";

const MARKER = "TODO-translate: ";

type Tree = { [key: string]: string | Tree };

/** A value still marked `TODO-translate: <English>` shows the English text; the marker never reaches a user. */
export function stripTodo<T extends Tree>(tree: T): T {
  const out: Tree = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value === "string") out[key] = value.startsWith(MARKER) ? value.slice(MARKER.length) : value;
    else out[key] = stripTodo(value);
  }
  return out as T;
}

export async function loadMessages(locale: Locale) {
  const loaded = (await import(`../../messages/${locale}.json`)).default as Tree;
  return stripTodo(loaded);
}
