"use client";

// The parent's "I've paid" sheet (spec R1-10 Part C, criteria 31 to 36; canvas "Claim-sheet"). Loaded only when the
// button is tapped (fee-screen.tsx imports it on tap), and opening it asks nothing of any server. The parent types the
// 12-digit UPI reference; the field shows it in groups of four and ignores spaces and hyphens. Send checks it with the
// shared `normalizeRef` first, then makes one `submit-claim` call. What she typed stays on every refusal. Offline,
// nothing is sent and nothing is queued. The reference lives in this component's state and in that one request body:
// never in the address, the title, the history or any storage. Until Part D there is no screenshot option.
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { normalizeRef } from "@/lib/claim/upi-ref";
import { formatRupees } from "@/lib/format";
import { caretAfter, claimFor, keptBefore, refShown } from "@/lib/pay-page-claim";
import type { ClaimOutcome, FeePage } from "@/lib/pay-page-public";
import type { PayPageWords } from "@/lib/pay-page-words";
import { monthLabel, type MonthWords } from "@/lib/receipt-words";
import { Filled } from "./filled";

export type ClaimSheetProps = {
  words: PayPageWords;
  monthWords: MonthWords;
  page: FeePage;
  /**
   * Sends the normalised reference to `submit-claim` (the page reads the token). Never throws. When the claim is taken
   * the page re-reads itself (to show the pending note) whether or not this sheet is still open; the sheet only says so.
   */
  send: (ref: string) => Promise<ClaimOutcome>;
  /** The page is out of date (nothing owed, a claim already waiting, not agreed, link gone): close and read again. */
  onStale: () => void;
  onClose: () => void;
};

type Problem = "duplicate" | "rateLimited" | "failed" | "offline";

const isOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export function ClaimSheet({ words, monthWords, page, send, onStale, onClose }: Readonly<ClaimSheetProps>) {
  const w = words.claim;
  const [typed, setTyped] = useState("");
  const [badRef, setBadRef] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  // A second tap on Send is ignored even before React has drawn "Sending…".
  const sending = useRef(false);
  const live = useRef(true);
  const field = useRef<HTMLTextAreaElement | null>(null);
  // Where the caret goes after the grouped value is drawn: after this many digits.
  const caret = useRef<number | null>(null);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = field.current;
    if (el === null || caret.current === null || document.activeElement !== el) return;
    const at = caretAfter(typed, caret.current);
    el.setSelectionRange(at, at);
    caret.current = null;
  }, [typed]);

  const tutor = page.tutorName ?? w.yourTutor;
  const amount = formatRupees(page.totalRemaining);
  const what = claimFor(page);
  let forWhat: string = w.allFees;
  if (what.kind === "month") forWhat = monthLabel(monthWords, what.month);
  else if (what.kind === "earlier") forWhat = words.line.earlier;

  function change(event: ChangeEvent<HTMLTextAreaElement>) {
    const el = event.currentTarget;
    caret.current = keptBefore(el.value, el.selectionStart ?? el.value.length);
    setTyped(refShown(el.value));
    setBadRef(false);
    setProblem(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending.current || sent) return;
    const check = normalizeRef(typed);
    if (!check.ok) {
      setProblem(null);
      setBadRef(true);
      field.current?.focus();
      return;
    }
    if (isOffline()) {
      setProblem("offline");
      return;
    }
    sending.current = true;
    setBusy(true);
    setBadRef(false);
    setProblem(null);
    const outcome = await send(check.ref);
    sending.current = false;
    if (!live.current) return;
    setBusy(false);
    switch (outcome.kind) {
      case "ok":
        setSent(true);
        return;
      case "bad_reference":
      case "no_proof":
        setBadRef(true);
        return;
      case "duplicate":
        setProblem("duplicate");
        return;
      case "rate_limited":
        setProblem("rateLimited");
        return;
      case "failed":
        setProblem("failed");
        return;
      default:
        // nothing_owed, already_pending, consent_needed, not_found: what the page shows is out of date. A 403 always
        // means "read again", even straight after a 422 (R1-10 section 17, point 3).
        onStale();
    }
  }

  const problemWords: Record<Problem, string> = { duplicate: w.duplicate, rateLimited: words.state.rateLimited, failed: w.failed, offline: w.offline };

  return (
    <Sheet
      open
      onClose={onClose}
      title={<Filled template={w.title} values={{ tutor }} />}
      closeLabel={w.close}
      // The title holds the tutor's name, of any length: pinned, it could cover Send with the keypad open (criterion 40).
      pinTitle={false}
      context={{
        label: (
          <>
            <span translate="no">{page.studentName}</span>
            <span aria-hidden="true"> · </span>
            {forWhat}
          </>
        ),
        title: <Filled template={w.heading} values={{ amount, tutor }} classes={{ amount: "type-amount" }} />,
      }}
    >
      {sent ? (
        <div data-claim="sent" className="flex flex-col gap-3">
          <p role="status" className="type-body-lg font-bold wrap-anywhere">
            <Filled template={w.sent} values={{ tutor }} />
          </p>
          <p className="type-body text-ink-soft wrap-anywhere">{w.sentLater}</p>
          <div className="pr-1.5">
            <Button variant="outline" full onClick={onClose}>
              {w.close}
            </Button>
          </div>
        </div>
      ) : (
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4.5">
          <p className="type-body text-ink-soft wrap-anywhere">
            <Filled template={w.help} values={{ tutor }} />
          </p>
          <div className="flex flex-col gap-1">
            <Field
              ref={field}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              data-autofocus=""
              monoValue
              label={w.refLabel}
              helper={w.refHint}
              value={typed}
              onChange={change}
              {...(badRef ? { state: "error" as const, stateLabel: w.checkThis, message: w.badRef } : { state: "idle" as const })}
            />
            <p className="type-caption text-ink-soft wrap-anywhere">
              <Filled template={w.private} values={{ tutor }} />
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="pt-1 pr-1.5">
              <Button type="submit" variant="send" size="sheet" full busy={busy} busyLabel={w.sending}>
                <Filled template={w.send} values={{ tutor }} />
              </Button>
            </div>
            {/* Always in the page, so a screen reader announces the words when they arrive; empty, it takes no room. */}
            <p role="status" data-claim="problem" className="type-caption font-semibold text-cloth wrap-anywhere">
              {problem === null ? null : problemWords[problem]}
            </p>
            <p className="type-caption text-ink-soft wrap-anywhere">{w.noMoney}</p>
          </div>
        </form>
      )}
    </Sheet>
  );
}
