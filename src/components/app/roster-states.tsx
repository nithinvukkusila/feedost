"use client";

// What every screen that shows the roster draws until it has one: the grey blocks and "Opening your book…"
// while the first read is out, and the error banner with "Try again" when it failed and nothing is cached
// (spec R1-3, criteria 11, 12 and 15). It never signs the tutor out.
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { BookBlocks, LoadingBook } from "./loading-book";
import { useRoster } from "./roster";

export function RosterGate({ children }: Readonly<{ children: ReactNode }>) {
  const roster = useRoster();
  const app = useTranslations("appState");
  const t = useTranslations("students");
  if (roster.status === "loading") return <LoadingBook label={app("loading")} />;
  if (roster.status === "error") {
    return (
      <BookBlocks
        footer={
          <div className="mt-4 mr-4 mb-4 ml-3">
            <Banner kind="error" title={t("loadError.title")} detail={t("loadError.body")} actions={[{ label: t("loadError.retry"), onClick: roster.reload }]} />
          </div>
        }
      />
    );
  }
  return <>{children}</>;
}
