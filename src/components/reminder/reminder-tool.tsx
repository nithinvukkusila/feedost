"use client";

// The fee reminder writer's one client island (spec R0-2, plan sections 4, 7 and 9): the form, the
// preview and the two buttons. Its words arrive as a plain object in a prop, so no message parser
// is shipped. Everything typed is turned into a message by src/lib/reminder/reminder.ts; the
// preview, Copy and Send all read the same parts.
//
// The page itself makes no network request: nothing here calls a server, loads an image or a
// script, or writes to the address bar or a cookie. There is no form element, so nothing on the
// page can submit. The only request that carries typed text is the WhatsApp link the tutor taps.
//
// Effects here only write outward (the font call, clearing a timer, the phone's storage); none sets
// state. Values that exist only in the browser (hydrated or not, the phone's month, what the phone
// remembers) come through useSyncExternalStore, so the phone's storage is never read on the server.
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { SelectField } from "@/components/ui/select-field";
import { Slip } from "@/components/ui/slip";
import { Switch } from "@/components/ui/switch";
import { localeNames, locales, type Locale } from "@/config/locales";
import { copyText } from "@/lib/reminder/copy-text";
import { forgetPayee, parsePayee, readRaw, savePayee, storageWorks } from "@/lib/reminder/remember";
import {
  amountInput,
  checkAmount,
  checkName,
  checkUpiId,
  currentMonth,
  monthName,
  reminderParts,
  reminderText,
  whatsAppLink,
  type Checked,
  type Part,
  type Tone,
} from "@/lib/reminder/reminder";
import type en from "../../../messages/en.json";

export type ReminderWords = (typeof en)["reminderForm"];

type Fix = { word: string; fix: string };
type FieldName = "parent" | "amount" | "upi" | "payee";

const subscribeToNothing = () => () => {};
const MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const COPIED_FOR_MS = 3000;

// Keeps typed text out of analytics and error-report recordings, should a later slice add either.
const guarded = { "data-ph-no-capture": "", "data-sentry-mask": "" } as const;

/** Nothing until the field has lost focus once; then the needs-fixing state while its value breaks the rule. */
function problem<E extends string>(result: Checked<unknown, E>, touched: boolean, words: Record<E, Fix>) {
  if (result.ok || !touched) return {};
  const { word, fix } = words[result.error];
  return { state: "error" as const, stateLabel: word, message: fix };
}

const icon = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  focusable: false,
  "aria-hidden": true,
} as const;

function ChatIcon() {
  return (
    <svg {...icon} strokeWidth={2.2} className="size-5.5">
      <path d="M5 5h14a1 1 0 011 1v10a1 1 0 01-1 1h-8l-5 4v-4H5a1 1 0 01-1-1V6a1 1 0 011-1z" />
    </svg>
  );
}

function Tick() {
  return (
    <svg {...icon} strokeWidth={3} className="size-5 shrink-0">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

function ErrorMark() {
  return (
    <svg {...icon} strokeWidth={2.6} className="size-5 shrink-0">
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4v.1" />
    </svg>
  );
}

/** One piece of the message as drawn in the bubble. */
function Piece({ part, blank }: { part: Part; blank: string }) {
  if (part.kind === "text") return part.text;
  if (part.kind === "blank") {
    // A ruled gap, with a spoken name so a screen reader does not read "Hello  ji".
    return (
      <span role="img" aria-label={blank} data-blank={part.slot} className="inline-block w-12 border-b-2 border-dashed border-ink align-baseline" />
    );
  }
  // The payment link and the UPI ID are set in DM Mono; the link is text, never something to tap here.
  if (part.slot === "link" || part.slot === "upiId") {
    return (
      <span data-slot={part.slot} className="type-amount-row text-blue">
        {part.text}
      </span>
    );
  }
  return part.text;
}

export function ReminderTool({ words, pageLocale }: Readonly<{ words: ReminderWords; pageLocale: Locale }>) {
  // False in the delivered HTML and during hydration, true from the first render after it.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  // The month on the phone's clock. The server cannot know it, so the delivered HTML has none.
  const phoneMonth = useSyncExternalStore<number | null>(subscribeToNothing, currentMonth, () => null);

  const [messageLocale, setMessageLocale] = useState<Locale>(pageLocale);
  const [tone, setTone] = useState<Tone>("polite");
  const [picked, setPicked] = useState<number | null>(null);
  const [parent, setParent] = useState("");
  const [amount, setAmount] = useState("");
  // The tutor's own UPI ID and name are derived, not copied into state: what was typed in this
  // visit if anything was, otherwise what the phone remembers, otherwise nothing.
  const [typedUpi, setTypedUpi] = useState<string | null>(null);
  const [typedPayee, setTypedPayee] = useState<string | null>(null);
  // The switch as tapped in this visit; until it is tapped, on exactly when something is remembered.
  const [choice, setChoice] = useState<boolean | null>(null);
  const canRemember = useSyncExternalStore(subscribeToNothing, storageWorks, () => false);
  const raw = useSyncExternalStore(subscribeToNothing, readRaw, () => null);
  const saved = useMemo(() => parsePayee(raw), [raw]);
  const upi = typedUpi ?? saved?.upiId ?? "";
  const payee = typedPayee ?? saved?.name ?? "";
  const remember = canRemember && (choice ?? saved !== null);
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ parent: false, amount: false, upi: false, payee: false });
  // What Copy last did, and the text it did it to: the confirmation stands only while the message is unchanged.
  const [copy, setCopy] = useState<{ result: "copied" | "failed"; text: string } | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reasonId = useId();
  const previewTitleId = useId();
  const rememberId = useId();
  const rememberLabelId = useId();

  // The link in the preview is the first thing on the page drawn in DM Mono. Ask for the font once
  // now, so it is not requested in the middle of typing.
  useEffect(() => {
    try {
      const family = getComputedStyle(document.documentElement).getPropertyValue("--font-dm-mono").trim();
      if (family !== "" && document.fonts && typeof document.fonts.load === "function") {
        document.fonts.load(`500 1rem ${family}`).catch(() => {});
      }
    } catch {
      // An old browser with no font loading: the font arrives when the link is first drawn.
    }
  }, []);

  useEffect(
    () => () => {
      if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    },
    [],
  );

  const month = picked ?? phoneMonth;
  const parentCheck = checkName(parent);
  const amountCheck = checkAmount(amount);
  const upiCheck = checkUpiId(upi);
  const payeeCheck = checkName(payee);

  // Only checked values reach the library, never raw field text.
  const parts = reminderParts({
    locale: messageLocale,
    tone,
    month,
    parent: parentCheck.ok ? parentCheck.value : null,
    paise: amountCheck.ok ? amountCheck.value : null,
    upiId: upiCheck.ok ? upiCheck.value : null,
    payeeName: payeeCheck.ok ? payeeCheck.value : null,
  });
  const message = reminderText(parts);
  const ready = message !== null;
  const copied = copy !== null && copy.result === "copied" && copy.text === message;
  const copyFailed = copy !== null && copy.result === "failed" && copy.text === message;

  // While the switch is on, keep the pair whenever both are valid. When one is not, write nothing:
  // the last valid pair stays.
  const upiToKeep = remember && upiCheck.ok ? upiCheck.value : null;
  const nameToKeep = remember && payeeCheck.ok ? payeeCheck.value : null;
  useEffect(() => {
    if (upiToKeep !== null && nameToKeep !== null) savePayee({ upiId: upiToKeep, name: nameToKeep });
  }, [upiToKeep, nameToKeep]);

  // Something is stored that no longer passes the rules: it was ignored above; remove it.
  const stale = raw !== null && saved === null;
  useEffect(() => {
    if (stale) forgetPayee();
  }, [stale]);

  function onRemember(next: boolean) {
    if (!next) {
      // A field filled from the phone shows the stored value, which is about to go. Pin what the
      // two fields show first, so turning the switch off does not empty them.
      setTypedUpi(upi);
      setTypedPayee(payee);
      forgetPayee();
    }
    setChoice(next);
  }

  const touch = (name: FieldName) => setTouched((before) => (before[name] ? before : { ...before, [name]: true }));

  async function onCopy() {
    if (message === null) return;
    const ok = await copyText(message);
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    setCopy({ result: ok ? "copied" : "failed", text: message });
    // The label goes back by itself; a failure stays until the next try or the next change.
    copyTimer.current = ok ? setTimeout(() => setCopy(null), COPIED_FOR_MS) : null;
  }

  const endonym = (code: Locale) => ({
    value: code,
    // The language's own name keeps its `lang` but is set in the Latin stack, as in the footer.
    label: (
      <span lang={code} className="type-endonym">
        {localeNames[code]}
      </span>
    ),
    attrs: { "data-testid": `reminder-language-${code}` },
  });

  return (
    <div data-testid="reminder-tool" {...guarded}>
      <div className="mt-6 pr-1.5">
        <Slip className="p-4">
          {/* Inert until the page has woken up: text typed into a field before then would be lost. */}
          <fieldset disabled={!hydrated} data-testid="reminder-form" className="min-w-0">
            {/*
              The column is a div inside the fieldset, not the fieldset itself. With the fieldset as the
              flex column, Chromium kept its old height when the remember row arrived after the page
              woke up, and took the missing room out of the language choices, which shrank to nothing.
            */}
            <div data-testid="reminder-fields" className="flex min-w-0 flex-col gap-4">
            <Segmented
              label={words.language}
              name="message-language"
              value={messageLocale}
              onChange={setMessageLocale}
              options={[endonym(locales[0]), endonym(locales[1]), endonym(locales[2]), endonym(locales[3])]}
            />
            <Segmented
              label={words.tone}
              name="tone"
              value={tone}
              onChange={setTone}
              options={[
                { value: "polite", label: words.polite, attrs: { "data-testid": "reminder-tone-polite" } },
                { value: "firm", label: words.firm, attrs: { "data-testid": "reminder-tone-firm" } },
              ]}
            />
            <Field
              label={words.parent.label}
              placeholder={words.parent.placeholder}
              value={parent}
              onChange={(event) => setParent(event.currentTarget.value)}
              onBlur={() => touch("parent")}
              autoComplete="off"
              data-testid="reminder-parent"
              {...guarded}
              {...problem(parentCheck, touched.parent, words.parent)}
            />
            <SelectField
              label={words.month.label}
              value={String(month ?? 0)}
              onChange={(value) => setPicked(Number(value))}
              options={MONTHS.map((index) => ({ value: String(index), label: monthName(pageLocale, index) }))}
              data-testid="reminder-month"
              {...guarded}
            />
            <Field
              label={words.amount.label}
              placeholder={words.amount.placeholder}
              value={amount}
              onChange={(event) => setAmount(event.currentTarget.value)}
              // Regrouped only when the field is left, so the caret does not jump while typing.
              onBlur={() => {
                touch("amount");
                if (amountCheck.ok) setAmount(amountInput(amountCheck.value));
              }}
              inputMode="numeric"
              autoComplete="off"
              // Digits are never drawn in Anek: the typed amount keeps the Latin face on every page.
              latinValue
              data-testid="reminder-amount"
              {...guarded}
              {...problem(amountCheck, touched.amount, words.amount)}
            />
            <Field
              label={words.upi.label}
              placeholder={words.upi.placeholder}
              value={upi}
              onChange={(event) => setTypedUpi(event.currentTarget.value)}
              onBlur={() => touch("upi")}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              // A UPI ID is Latin letters and digits: the same face on every page, as with the amount.
              latinValue
              data-testid="reminder-upi"
              {...guarded}
              {...(upiCheck.ok
                ? // The shape is right; that is all this page can know. The note says so.
                  { state: "correct" as const, stateLabel: words.upi.ok.word, message: words.upi.ok.note }
                : problem(upiCheck, touched.upi, words.upi))}
            />
            <Field
              label={words.payee.label}
              placeholder={words.payee.placeholder}
              helper={words.payee.helper}
              value={payee}
              onChange={(event) => setTypedPayee(event.currentTarget.value)}
              onBlur={() => touch("payee")}
              autoComplete="off"
              data-testid="reminder-payee"
              {...guarded}
              {...problem(payeeCheck, touched.payee, words.payee)}
            />
            {/* Not drawn at all where the browser blocks storage: never a switch that cannot work. */}
            {canRemember ? (
              <div data-testid="reminder-remember-row">
                {/* The words ask for 10rem. Where that does not fit beside the switch (a large font), the switch moves under them. */}
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <label id={rememberLabelId} htmlFor={rememberId} className="type-body min-w-0 shrink grow basis-40 font-bold wrap-anywhere">
                    {words.remember.label}
                  </label>
                  <Switch
                    id={rememberId}
                    labelledBy={rememberLabelId}
                    checked={remember}
                    onChange={onRemember}
                    onText={words.remember.on}
                    offText={words.remember.off}
                    data-testid="reminder-remember"
                  />
                </div>
                <p className="type-caption mt-1 text-ink-soft">{words.remember.note}</p>
              </div>
            ) : null}
            </div>
          </fieldset>
        </Slip>
      </div>

      <p data-testid="reminder-privacy" className="type-body-sm mt-5 text-ink-soft">
        {words.privacy}
      </p>

      <h2 id={previewTitleId} className="type-label mt-8 mb-2 text-ink-label">
        {words.preview.title}
      </h2>
      {/*
        The message as WhatsApp will show it. `type-message` is the Latin stack whatever the page
        language, so an Indian script is drawn in the phone's own font and no font file is asked for.
      */}
      <p
        lang={messageLocale}
        translate="no"
        aria-labelledby={previewTitleId}
        data-testid="reminder-preview"
        {...guarded}
        className="type-message rounded-bubble rounded-tl-sm border-2 border-ink bg-bubble px-4 py-3 whitespace-pre-wrap wrap-anywhere select-text"
      >
        {parts.map((part, index) => (
          <Piece key={index} part={part} blank={words.preview.blank} />
        ))}
      </p>
      {ready ? null : (
        <p data-testid="reminder-incomplete" className="type-caption mt-2 text-ink-soft">
          {words.preview.incomplete}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-4 pr-1.5">
        <Button
          variant="send"
          size="large"
          full
          href={message === null ? "" : whatsAppLink(message)}
          target="_blank"
          rel="noopener noreferrer"
          disabled={!ready}
          aria-describedby={ready ? undefined : reasonId}
          iconStart={<ChatIcon />}
          data-testid="reminder-send"
        >
          {words.send}
        </Button>
        <Button
          variant="outline"
          full
          disabled={!ready}
          onClick={onCopy}
          aria-describedby={ready ? undefined : reasonId}
          iconStart={copied ? <Tick /> : undefined}
          data-testid="reminder-copy"
          data-copied={copied ? "true" : undefined}
        >
          {copied ? words.copied : words.copy}
        </Button>
        {/* One reason for both buttons, said once. */}
        {ready ? null : (
          <p id={reasonId} data-testid="reminder-reason" className="type-caption text-ink-soft">
            {words.fillFirst}
          </p>
        )}
        {/* In the page from the first render and empty until Copy is pressed: a region that fills is read out, one that appears often is not. */}
        <p
          role="status"
          data-testid="reminder-status"
          data-result={copied ? "copied" : copyFailed ? "failed" : undefined}
          className={`type-caption flex items-start gap-2 font-semibold wrap-anywhere ${copyFailed ? "text-cloth" : "text-stamp"}`}
        >
          {copied ? (
            <>
              <Tick />
              <span>{words.copiedStatus}</span>
            </>
          ) : null}
          {copyFailed ? (
            <>
              <ErrorMark />
              <span>{words.copyFailed}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}
