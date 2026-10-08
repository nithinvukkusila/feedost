import type { Metadata, Viewport } from "next";
import { brand } from "@/config/brand";
import { fontVariables } from "@/styles/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: brand.name,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-page type-body text-ink">{children}</body>
    </html>
  );
}
