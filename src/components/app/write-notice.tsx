"use client";

// What a screen says when a write did not go through (spec R1-3, criterion 29). The live region stays
// mounted and the banner goes into it, so it is read out when it appears. Offline is its own banner:
// nothing was sent. Failed says that nothing was saved and what to do. The words are passed in.
import { Banner } from "@/components/ui/banner";

export type WriteProblem = "failed" | "offline" | null;

export function WriteNotice({ problem, failed, offline }: Readonly<{ problem: WriteProblem; failed: string; offline: string }>) {
  return (
    <div aria-live="polite" aria-atomic="true" className="flex flex-col gap-3 empty:hidden">
      {problem === "offline" ? <Banner kind="offline" title={offline} detail={null} /> : null}
      {problem === "failed" ? <Banner kind="error" title={null} detail={failed} /> : null}
    </div>
  );
}
