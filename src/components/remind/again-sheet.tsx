"use client";

// "You reminded {parent} today at {time}. Remind again?" (spec R1-8, criterion 26): asked before the message
// is shown for a fee that was already reminded today. "Not now" changes nothing. It sits on the Remind
// screen, not on the board, so the board does not carry it.
import { useTranslations } from "next-intl";
import { withNode } from "@/components/app/with-node";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { indiaClock12, type QueueItem } from "@/lib/reminder-rules";

export function AgainSheet({ item, lastAt, open, onYes, onNo }: Readonly<{ item: QueueItem; lastAt: number; open: boolean; onYes: () => void; onNo: () => void }>) {
  const t = useTranslations("remindScreen");
  const clock = indiaClock12(lastAt);
  const time = t(clock.pm ? "again.time.pm" : "again.time.am", { hour: String(clock.hour), minute: clock.minute });
  const named = item.parentName !== null && item.parentName.trim() !== "";
  const title = named
    ? withNode(
        (marker) => t("again.title", { parent: marker, time }),
        <span translate="no">{item.parentName}</span>,
      )
    : withNode(
        (marker) => t("again.titleStudent", { student: marker, time }),
        <span translate="no">{item.studentName}</span>,
      );
  return (
    <Sheet open={open} onClose={onNo} title={title} closeLabel={t("again.no")}>
      <div className="flex flex-wrap gap-3 pr-1.5 pb-1.5">
        <Button variant="record" onClick={onYes}>
          {t("again.yes")}
        </Button>
        <Button variant="outline" onClick={onNo}>
          {t("again.no")}
        </Button>
      </div>
    </Sheet>
  );
}
