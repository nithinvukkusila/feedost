"use client";

// The fee receipt maker's one client island (spec R0-3, plan sections 3 and 7): the form, the
// preview and the two buttons. Its words arrive as a plain object in a prop, so no message parser is
// shipped. Everything typed is turned into receipt text by src/lib/receipt/receipt.ts; the preview
// and the PDF both read the same lines.
//
// The PDF library and its fonts are NOT imported here. `make-pdf.ts` is reached only by
// `await import()` inside `run`, after a tap, so the first load of the page stays small. The page
// makes no request of its own and nothing here writes to the address bar, a cookie or storage. There
// is no form element, so nothing can submit. Values that exist only in the browser (hydrated or
// not, the phone's clock, the tutor's name remembered by the reminder writer) come through
// useSyncExternalStore, so the phone's storage is never read on the server.
import { useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ReceiptPreview } from "@/components/receipt/receipt-preview";
import { ChatIcon, ErrorMark, Tick, guarded, problem } from "@/components/tools/tool-marks";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { SelectField } from "@/components/ui/select-field";
import { Slip } from "@/components/ui/slip";
import { localeNames, locales, type Locale } from "@/config/locales";
import { amountInput, checkAmount, checkName } from "@/lib/fields";
import { parsePayee, readRaw } from "@/lib/reminder/remember";
import {
  MODES,
  feeMonthLabel,
  feeMonths,
  fileName,
  hasUnprintable,
  monthKey,
  receiptLines,
  sentenceText,
  waLink,
  waText,
  type Mode,
} from "@/lib/receipt/receipt";
import { download, shareOrDownload } from "@/lib/receipt/share";
import type en from "../../../messages/en.json";

export type ReceiptWords = (typeof en)["receiptForm"];

type FieldName = "tutor" | "student" | "amount";
type Outcome = "failed" | "saved" | null;

const subscribeToNothing = () => () => {};

// The phone's clock, read once per page and then stable: a snapshot that changed on every read
// would make React render without end. The PDF reads the clock again at the tap.
let clock: Date | null = null;
const phoneNow = (): Date => (clock ??= new Date());

export function ReceiptTool({ words, pageLocale }: Readonly<{ words: ReceiptWords; pageLocale: Locale }>) {
  // The server cannot know the date: the delivered HTML has no clock, and the form is inert until it does.
  const now = useSyncExternalStore<Date | null>(subscribeToNothing, phoneNow, () => null);
  const hydrated = now !== null;
  // The tutor's name, if the reminder writer's "remember" switch is on: read only, never written here (D6).
  const raw = useSyncExternalStore(subscribeToNothing, readRaw, () => null);
  const remembered = useMemo(() => parsePayee(raw)?.name ?? "", [raw]);

  const [receiptLang, setReceiptLang] = useState<Locale>(pageLocale);
  const [typedTutor, setTypedTutor] = useState<string | null>(null);
  const [student, setStudent] = useState("");
  const [amount, setAmount] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("upi");
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ tutor: false, student: false, amount: false });
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [dropped, setDropped] = useState(false);
  // Held in a ref as well as in state: two taps in one frame must still make one file.
  const working = useRef(false);
  const reasonId = useId();
  const previewTitleId = useId();

  const tutor = typedTutor ?? remembered;
  const months = useMemo(() => (now ? feeMonths(now) : []), [now]);
  const month = months.find((m) => monthKey(m) === picked) ?? months[0] ?? null;

  const tutorCheck = checkName(tutor);
  const studentCheck = checkName(student);
  const amountCheck = checkAmount(amount);
  const ready = tutorCheck.ok && studentCheck.ok && amountCheck.ok && month !== null;

  // Only checked values reach the receipt, never raw field text.
  const lines = receiptLines({
    lang: receiptLang,
    tutor: tutorCheck.ok ? tutorCheck.value : null,
    student: studentCheck.ok ? studentCheck.value : null,
    paise: amountCheck.ok ? amountCheck.value : null,
    month,
    mode,
    now: now ?? new Date(0),
  });
  const complete = sentenceText(lines.sentence) !== null;
  const unprintable = dropped || hasUnprintable(tutor) || hasUnprintable(student);

  const touch = (name: FieldName) => setTouched((before) => (before[name] ? before : { ...before, [name]: true }));

  // Any change to the receipt clears the last result: it described a different receipt.
  function change<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setOutcome(null);
      setDropped(false);
    };
  }

  async function run(kind: "download" | "share") {
    if (working.current || !ready || !tutorCheck.ok || !studentCheck.ok || !amountCheck.ok || month === null) return;
    working.current = true;
    setBusy(kind);
    setOutcome(null);
    try {
      // The library and the fonts are fetched here, on the tap, and nowhere else.
      const { makePdf } = await import("@/lib/receipt/make-pdf");
      const made = await makePdf({
        lang: receiptLang,
        tutor: tutorCheck.value,
        student: studentCheck.value,
        paise: amountCheck.value,
        month,
        mode,
        now: new Date(),
      });
      setDropped(made.dropped);
      if (kind === "download") {
        download(made.blob, fileName(month));
      } else {
        const result = await shareOrDownload(made.blob, fileName(month), waText(receiptLang, month), waLink(receiptLang, month));
        if (result === "saved") setOutcome("saved");
      }
    } catch {
      // The library or a font did not load, the phone is offline or out of memory: one sentence, and the button works again.
      setOutcome("failed");
    } finally {
      working.current = false;
      setBusy(null);
    }
  }

  const endonym = (code: Locale) => ({
    value: code,
    // The language's own name keeps its `lang` but is set in the Latin stack, as in the footer.
    label: (
      <span lang={code} className="type-endonym">
        {localeNames[code]}
      </span>
    ),
    attrs: { "data-testid": `receipt-language-${code}` },
  });

  const modeOption = (value: Mode) => ({ value, label: words.mode[value], attrs: { "data-testid": `receipt-mode-${value}` } });
  const [upi, cash, bank] = MODES;

  return (
    <div data-testid="receipt-tool" {...guarded}>
      <div className="mt-6 pr-1.5">
        <Slip className="p-4">
          {/* Inert until the page has woken up: text typed into a field before then would be lost. */}
          <fieldset disabled={!hydrated} data-testid="receipt-form" className="min-w-0">
            <div data-testid="receipt-fields" className="flex min-w-0 flex-col gap-4">
              <Segmented
                label={words.language}
                name="receipt-language"
                value={receiptLang}
                onChange={change(setReceiptLang)}
                options={[endonym(locales[0]), endonym(locales[1]), endonym(locales[2]), endonym(locales[3])]}
              />
              <Field
                label={words.tutor.label}
                placeholder={words.tutor.placeholder}
                value={tutor}
                onChange={(event) => change(setTypedTutor)(event.currentTarget.value)}
                onBlur={() => touch("tutor")}
                autoComplete="off"
                data-testid="receipt-tutor"
                {...guarded}
                {...problem(tutorCheck, touched.tutor, words.tutor)}
              />
              <Field
                label={words.student.label}
                placeholder={words.student.placeholder}
                value={student}
                onChange={(event) => change(setStudent)(event.currentTarget.value)}
                onBlur={() => touch("student")}
                autoComplete="off"
                data-testid="receipt-student"
                {...guarded}
                {...problem(studentCheck, touched.student, words.student)}
              />
              <Field
                label={words.amount.label}
                placeholder={words.amount.placeholder}
                value={amount}
                onChange={(event) => change(setAmount)(event.currentTarget.value)}
                // Regrouped only when the field is left, so the caret does not jump while typing.
                onBlur={() => {
                  touch("amount");
                  if (amountCheck.ok) setAmount(amountInput(amountCheck.value));
                }}
                inputMode="numeric"
                autoComplete="off"
                // Digits are never drawn in Anek: the typed amount keeps the Latin face on every page.
                latinValue
                data-testid="receipt-amount-field"
                {...guarded}
                {...problem(amountCheck, touched.amount, words.amount)}
              />
              <SelectField
                label={words.month.label}
                value={month === null ? "" : monthKey(month)}
                onChange={change(setPicked)}
                // The months are the phone's own: until the clock is read there is one empty line.
                options={months.length === 0 ? [{ value: "", label: "–" }] : months.map((m) => ({ value: monthKey(m), label: feeMonthLabel(m, pageLocale) }))}
                data-testid="receipt-month"
                {...guarded}
              />
              <Segmented
                label={words.mode.label}
                name="receipt-mode"
                value={mode}
                onChange={change(setMode)}
                options={[modeOption(upi), modeOption(cash), modeOption(bank)]}
              />
            </div>
          </fieldset>
        </Slip>
      </div>

      <p data-testid="receipt-privacy" className="type-body-sm mt-5 text-ink-soft">
        {words.privacy}
      </p>

      <h2 id={previewTitleId} className="type-label mt-8 mb-2 text-ink-label">
        {words.preview.title}
      </h2>
      <ReceiptPreview lines={lines} lang={receiptLang} blank={words.preview.blank} labelledBy={previewTitleId} />
      {complete ? null : (
        <p data-testid="receipt-incomplete" className="type-caption mt-2 text-ink-soft">
          {words.preview.incomplete}
        </p>
      )}
      {unprintable ? (
        <p data-testid="receipt-unprintable" className="type-caption mt-2 flex items-start gap-2 font-semibold text-ink wrap-anywhere">
          <ErrorMark />
          <span>{words.preview.unprintable}</span>
        </p>
      ) : null}

      <div className="mt-5 flex flex-col gap-4 pr-1.5">
        <Button
          variant="record"
          size="large"
          full
          disabled={!ready}
          busy={busy === "download"}
          busyLabel={words.working}
          onClick={() => void run("download")}
          aria-describedby={ready ? undefined : reasonId}
          data-testid="receipt-download"
        >
          {words.download}
        </Button>
        <Button
          variant="send"
          size="large"
          full
          disabled={!ready}
          busy={busy === "share"}
          busyLabel={words.working}
          onClick={() => void run("share")}
          aria-describedby={ready ? undefined : reasonId}
          iconStart={<ChatIcon />}
          data-testid="receipt-share"
        >
          {words.share}
        </Button>
        {/* One reason for both buttons, said once. */}
        {ready ? null : (
          <p id={reasonId} data-testid="receipt-reason" className="type-caption text-ink-soft">
            {words.fillFirst}
          </p>
        )}
        {/* In the page from the first render and empty until something happens: a region that fills is read out. */}
        <div role="status" data-testid="receipt-status" data-result={outcome ?? (busy ? "working" : undefined)} className="type-caption flex flex-col gap-2 font-semibold wrap-anywhere">
          {busy ? <p>{words.working}</p> : null}
          {outcome === "failed" ? (
            <p className="flex items-start gap-2 text-cloth">
              <ErrorMark />
              <span>{words.failed}</span>
            </p>
          ) : null}
          {outcome === "saved" && month !== null ? (
            <>
              <p className="flex items-start gap-2 text-stamp">
                <Tick />
                <span>{words.saved}</span>
              </p>
              <a
                href={waLink(receiptLang, month)}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="receipt-open-whatsapp"
                className="flex min-h-tap items-center underline ring:ground-ring"
              >
                {words.openWhatsApp}
              </a>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
