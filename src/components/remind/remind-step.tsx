"use client";

// One reminder, as the Remind screen shows it (spec R1-8, criteria 14 to 18; canvas "Remind"): who it is to,
// the fee, the amount still owed, Polite/Firm, the message as WhatsApp will show it, and the blue
// "Open WhatsApp" link. The link is a plain <a>: no preventDefault, no script-opened window, so a pop-up
// blocker cannot stop it and it never waits for the network. The message is made here, on the phone, by
// the same builder as the free tool; the parent's phone is in the link and nowhere else on the screen.
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { withNode } from "@/components/app/with-node";
import { ChatIcon, TickIcon } from "@/components/app/icons";
import { useMonthWords } from "@/components/board/month-switcher";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Slip } from "@/components/ui/slip";
import { localeNames, type Locale } from "@/config/locales";
import { localeHref, setupUpiPath } from "@/config/routes";
import { amountFit } from "@/lib/amount-fit";
import { formatRupees } from "@/lib/format";
import { buildAppMessage, type AppMessage } from "@/lib/reminder/app-message";
import type { Part } from "@/lib/reminder/reminder";
import { waLink } from "@/lib/reminder/reminder";
import type { QueueItem, Tone } from "@/lib/reminder-rules";

/** One piece of the message as drawn in the bubble. */
function Piece({ part }: Readonly<{ part: Part }>) {
  if (part.kind === "text") return part.text;
  if (part.kind === "blank") return null;
  // The payment link and the UPI ID are set in DM Mono; the link is text here, never something to tap.
  if (part.slot === "link" || part.slot === "upiId") {
    return (
      <span data-slot={part.slot} className="type-amount-row text-blue">
        {part.text}
      </span>
    );
  }
  return part.text;
}

/** The message for one queued fee (with the pay page's link, or the raw UPI link when `payLink` is null), or null when it cannot be built (the screen then says "Add your UPI ID"). */
export function useMessage(item: QueueItem, tone: Tone, tutor: { upiId: string | null; name: string | null }, payLink: string | null = null): AppMessage | null {
  const { upiId, name } = tutor;
  return useMemo(() => {
    if (upiId === null || name === null) return null;
    try {
      return buildAppMessage({
        student: { parentName: item.parentName, parentLanguage: item.parentLanguage },
        due: { kind: item.kind, month: item.month, amount: item.remaining, amountPaid: 0 },
        tutor: { upiId, name },
        tone,
        link: payLink,
      });
    } catch {
      return null;
    }
  }, [item, tone, upiId, name, payLink]);
}

export type RemindStepProps = {
  item: QueueItem;
  tone: Tone;
  onTone: (tone: Tone) => void;
  message: AppMessage | null;
  /** The tap on "Open WhatsApp": runs synchronously, before the browser follows the link. */
  onOpen: () => void;
  opened: boolean;
  logFailed: boolean;
  /** More steps after this one: shows Skip before opening. */
  canSkip: boolean;
  onSkip: () => void;
  onNext: () => void;
};

export function RemindStep({ item, tone, onTone, message, onOpen, opened, logFailed, canSkip, onSkip, onNext }: Readonly<RemindStepProps>) {
  const t = useTranslations("remindScreen");
  const board = useTranslations("remind");
  const months = useMonthWords();
  const locale = useLocale() as Locale;
  const total = formatRupees(item.remaining);

  const when =
    item.kind === "opening"
      ? t("earlier")
      : item.month === null
        ? ""
        : item.daysLate !== null && item.daysLate > 0
          ? t("late", { month: months.name(item.month), n: item.daysLate })
          : months.name(item.month);

  const to =
    item.parentName === null || item.parentName.trim() === "" ? (
      withNode(
        (marker) => t("toStudent", { student: marker }),
        <span translate="no">{item.studentName}</span>,
      )
    ) : (
      withNode(
        (marker) => t("to", { parent: marker, language: localeNames[item.parentLanguage] }),
        <span translate="no">{item.parentName}</span>,
      )
    );

  const href = message === null ? null : waLink(item.parentPhone, message.text);

  return (
    <Slip as="section" className="mx-4 mt-3 mr-5.5 flex flex-col gap-3.5 p-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="type-label text-ink-label wrap-anywhere">{to}</p>
        <p translate="no" className="type-name text-2xl wrap-anywhere">
          {item.studentName}
        </p>
        <p className="type-caption font-semibold text-cloth wrap-anywhere">
          {when === "" ? null : (
            <>
              {item.batchName ? (
                <>
                  <span translate="no">{item.batchName}</span>
                  <span aria-hidden="true"> · </span>
                </>
              ) : null}
              {when}
            </>
          )}
        </p>
        <div className="amount-box mt-1">
          <p translate="no" style={amountFit(total)} className="type-amount amount-size-4xl block text-blue">
            {total}
          </p>
        </div>
      </div>

      <Segmented
        label={t("tone.label")}
        name="remind-tone"
        value={tone}
        onChange={onTone}
        options={[
          { value: "polite", label: t("tone.polite") },
          { value: "firm", label: t("tone.firm") },
        ]}
      />

      {message === null || href === null ? (
        // The message could not be built (no UPI ID or name): never a link that cannot work.
        <div className="flex flex-col gap-3">
          <p className="type-body wrap-anywhere">{board("noUpi")}</p>
          <Button variant="outline" href={localeHref(locale, setupUpiPath)}>
            {board("addUpi")}
          </Button>
          {canSkip ? (
            <div>
              <button type="button" onClick={onSkip} className="type-control-sm min-h-tap px-1.5 underline ring:ground-ring">
                {t("skip")}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div role="group" aria-label={t("message")}>
            <p
              lang={message.locale}
              translate="no"
              className="type-message rounded-bubble rounded-tl-sm border-2 border-ink bg-bubble px-3.5 py-3 whitespace-pre-wrap wrap-anywhere select-text"
            >
              {message.parts.map((part, index) => (
                <Piece key={index} part={part} />
              ))}
            </p>
          </div>

          <div className="pr-1.5 pb-1.5">
            <Button
              variant="send"
              size="xl"
              full
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              iconStart={<ChatIcon />}
              onClick={() => onOpen()}
            >
              {t("open")}
            </Button>
          </div>

          {opened ? (
            <div className="flex flex-col gap-2">
              <p role="status" className="type-label flex items-start gap-1.5 text-stamp">
                <TickIcon />
                <span className="min-w-0 wrap-anywhere">
                  {withNode(
                    (marker) => t("opened", { student: marker }),
                    <span translate="no">{item.studentName}</span>,
                  )}
                </span>
              </p>
              <p className="type-caption text-ink-soft wrap-anywhere">{t("openedNote")}</p>
              {logFailed ? (
                <p role="status" className="type-caption text-ink wrap-anywhere">
                  {t("logFailed")}
                </p>
              ) : null}
              <div>
                <Button variant="outline" size="compact" onClick={onNext}>
                  {t("next")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-x-2">
              <p className="type-caption min-w-0 flex-1 basis-40 text-ink-soft wrap-anywhere">{t("hint")}</p>
              {canSkip ? (
                <button type="button" onClick={onSkip} className="type-control-sm min-h-tap px-1.5 underline ring:ground-ring">
                  {t("skip")}
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </Slip>
  );
}
