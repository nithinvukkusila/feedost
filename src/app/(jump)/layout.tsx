// Root layout of "/", the jump page. No language is known here yet, so the tag says English.
import type { Metadata, Viewport } from "next";
import { HtmlShell } from "@/components/shell/html-shell";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: brand.name,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function JumpLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <HtmlShell lang="en">{children}</HtmlShell>;
}
