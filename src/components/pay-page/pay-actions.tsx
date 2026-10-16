"use client";

// Under the headline: the Pay button, what it does, and the fallbacks (spec R1-9 criteria 24 to 26). The Pay button is
// a real link to `upi://pay?...` built on the parent's phone; it records nothing, because the page cannot know whether
// the payment happened. Copy UPI ID is drawn only when the browser can copy. The QR button sits with them, only where the Pay button does (Part C).
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { formatRupees } from "@/lib/format";
import type { PayArea } from "@/lib/pay-page-view";
import type { PayPageWords } from "@/lib/pay-page-words";
import { fill } from "@/lib/public-words";
import { Filled } from "./filled";
import { QrBlock } from "./qr-block";

const subscribeToNothing = () => () => {};
// Read in the browser only: the delivered HTML never has a Copy button.
const canCopy = () => typeof navigator !== "undefined" && typeof navigator.clipboard?.writeText === "function";

function Arrow() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Tick() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** Copies exactly the UPI ID. "Copied" with a tick shows for two seconds. A refused write does nothing noisy: the ID is still selectable text. */
function CopyButton({ upiId, words }: Readonly<{ upiId: string; words: PayPageWords }>) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(upiId);
    } catch {
      return;
    }
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" full iconStart={copied ? <Tick /> : undefined} onClick={() => void copy()}>
      {copied ? words.copied : words.copy}
    </Button>
  );
}

// The UPI ID in the mono face, blue, selectable, and breakable anywhere so a long one never pushes the page sideways.
const UPI_ID_CLASS = "type-amount-row break-all text-blue select-all";
// An amount is always 0-9 digits in the mono face, never Anek, even inside a button label or a sentence in hi, kn or te.
const AMOUNT_CLASS = "type-amount-row";
const UpiId = ({ value }: Readonly<{ value: string }>) => (
  <span translate="no" className={UPI_ID_CLASS}>
    {value}
  </span>
);

/** Opens the QR code of the Pay button's own link, under the buttons. Close puts the focus back on the button that opened it. */
function QrArea({ href, upiId, words }: Readonly<{ href: string; upiId: string; words: PayPageWords }>) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={opener} className="pr-1.5">
        <Button variant="outline" full aria-expanded={open} onClick={() => setOpen(true)}>
          {words.qr}
        </Button>
      </div>
      {open ? (
        <QrBlock
          text={href}
          upiId={upiId}
          words={words}
          onClose={() => {
            setOpen(false);
            opener.current?.querySelector("button")?.focus();
          }}
        />
      ) : null}
    </>
  );
}

export function PayActions({ words, area, total }: Readonly<{ words: PayPageWords; area: PayArea; total: number }>) {
  const clipboard = useSyncExternalStore(subscribeToNothing, canCopy, () => false);
  if (area.kind === "nothing") return null;
  if (area.kind === "no-upi") {
    return <p className="type-body-sm mt-4 text-ink-soft wrap-anywhere">{words.noUpi}</p>;
  }
  if (area.kind === "too-big") {
    return (
      <div className="mt-4 flex flex-col gap-2.5">
        <p className="type-body text-ink-soft wrap-anywhere">
          <Filled template={words.tooBig} values={{ amount: formatRupees(total) }} classes={{ amount: AMOUNT_CLASS }} />
        </p>
        <p>
          <UpiId value={area.upiId} />
        </p>
        {clipboard ? <CopyButton upiId={area.upiId} words={words} /> : null}
      </div>
    );
  }
  return (
    <div className="mt-4 flex flex-col">
      <div className="pr-1.5">
        {/* A real link. The UPI app, not this page, takes the payment; nothing is recorded when it is tapped. */}
        <Button variant="send" size="pay" full href={area.href} rel="noopener noreferrer" aria-label={fill(words.pay, { amount: formatRupees(total) })} iconEnd={<Arrow />}>
          <Filled template={words.pay} values={{ amount: formatRupees(total) }} classes={{ amount: AMOUNT_CLASS }} />
        </Button>
      </div>
      <p className="type-body-sm mt-3.5 text-ink-soft wrap-anywhere">
        <Filled template={words.payNote} values={{ upiId: area.upiId }} classes={{ upiId: UPI_ID_CLASS }} />
      </p>
      <div className="mt-2.5 flex flex-col gap-2.5">
        {clipboard ? (
          <div className="pr-1.5">
            <CopyButton upiId={area.upiId} words={words} />
          </div>
        ) : null}
        <QrArea href={area.href} upiId={area.upiId} words={words} />
        {clipboard ? <p className="type-caption text-ink-soft wrap-anywhere">{words.fallback}</p> : null}
      </div>
      <p className="type-body-sm mt-3 text-ink-soft wrap-anywhere">{words.paidAlready}</p>
    </div>
  );
}
