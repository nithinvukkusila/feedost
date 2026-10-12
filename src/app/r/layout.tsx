// Root layout of "/r/{token}": the parent's receipt. A static shell with no language in the address, so the
// tag says English until the page knows the receipt's language and sets it. It has no roster, no app gate and
// no Supabase client (spec R1-7 Part B). Search engines are told to stay away and no referrer is sent, so the
// address (which holds the token) is never passed on to a page a link leads to.
import type { Metadata, Viewport } from "next";
import { HtmlShell } from "@/components/shell/html-shell";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: brand.name,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function ReceiptLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <HtmlShell lang="en">{children}</HtmlShell>;
}
