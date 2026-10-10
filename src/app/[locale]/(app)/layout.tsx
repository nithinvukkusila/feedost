// The signed-in app (spec R1-1): every screen in this group sits inside the gate. The pages are
// prerendered shells; what shows is decided in the browser, once the session is known. The gate's words
// travel through ClientMessages (about +12 KB), because the setup screens use arguments in theirs.
import type { Metadata } from "next";
import { AppGate } from "@/components/app/app-gate";
import { ClientMessages } from "@/components/i18n/client-messages";

export const metadata: Metadata = { robots: { index: false } };

const namespaces = ["appState", "setup", "subjects", "home", "more"] as const;

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClientMessages namespaces={namespaces}>
      <AppGate>{children}</AppGate>
    </ClientMessages>
  );
}
