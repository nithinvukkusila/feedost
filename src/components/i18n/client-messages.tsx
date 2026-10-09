// Hands the named message namespaces of the page's language to the Client Components below it.
// A Server Component's words are already in the HTML and cost no JavaScript; only a subtree that
// translates in the browser needs this, and only it pays for the message parser (about 12 KB).
// Wrap the smallest subtree that needs it, not the layout.
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

type Tree = { [key: string]: string | Tree };

/** Only the named namespaces, so no other word of the language is sent to the browser. */
export function pickNamespaces(messages: Tree, namespaces: readonly string[]): Tree {
  const picked: Tree = {};
  for (const name of namespaces) {
    if (name in messages) picked[name] = messages[name];
  }
  return picked;
}

export async function ClientMessages({
  namespaces,
  children,
}: Readonly<{ namespaces: readonly string[]; children: React.ReactNode }>) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return (
    <NextIntlClientProvider locale={locale} messages={pickNamespaces(messages as Tree, namespaces)}>
      {children}
    </NextIntlClientProvider>
  );
}
