// Root layout of /dev. Like page.dev.tsx it exists only outside a Vercel production build.
// Always English: its four language blocks carry their own `lang`.
import type { Viewport } from "next";
import { HtmlShell } from "@/components/shell/html-shell";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function DevLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <HtmlShell lang="en">{children}</HtmlShell>;
}
