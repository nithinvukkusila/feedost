// The <html> and <body> every root layout writes. Each root layout (/, /xx/, /dev) calls this with
// its own language, so the tag is right in the built HTML file.
import { fontVariables } from "@/styles/fonts";
import "@/app/globals.css";

export function HtmlShell({ lang, children }: Readonly<{ lang: string; children: React.ReactNode }>) {
  return (
    <html lang={lang} className={fontVariables}>
      <body className="bg-page type-body text-ink">{children}</body>
    </html>
  );
}
