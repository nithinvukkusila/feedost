"use client";

// What a setup screen says when a save did not go through (spec R1-1, criteria 25, 26 and 30). The live
// region stays mounted and the banner goes into it, so it is read out when it appears.
import { useTranslations } from "next-intl";
import { Banner } from "@/components/ui/banner";

export type SaveProblem = "failed" | "missing" | null;

export function SaveNotice({
  problem,
  offline,
  action,
  onSignOut,
}: Readonly<{ problem: SaveProblem; offline: boolean; action: string; onSignOut: () => void }>) {
  const t = useTranslations("setup");
  const state = useTranslations("appState");
  const more = useTranslations("more");
  return (
    <div aria-live="polite" aria-atomic="true" className="flex flex-col gap-3 empty:hidden">
      {problem !== null && offline ? <Banner kind="offline" title={state("offlineTitle")} detail={state("offlineBody")} /> : null}
      {problem === "failed" ? <Banner kind="error" title={null} detail={t("saveFailed", { action })} /> : null}
      {problem === "missing" ? <Banner kind="error" title={null} detail={t("rowMissing")} actions={[{ label: more("signOut"), onClick: onSignOut }]} /> : null}
    </div>
  );
}
