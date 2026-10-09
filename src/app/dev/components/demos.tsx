"use client";

// The few examples on the dev page that need state.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Row, Rows } from "@/components/ui/row";
import { Segmented, type SegmentedProps } from "@/components/ui/segmented";
import { Sheet, type SheetContext } from "@/components/ui/sheet";
import { Slip } from "@/components/ui/slip";
import { Stamp } from "@/components/ui/stamp";
import { Switch } from "@/components/ui/switch";
import { tabId, Tabs, type TabItem } from "@/components/ui/tabs";
import { MessageIcon } from "./sample-icons";

/** A button that goes busy for a moment when tapped, to show that a second tap does nothing. */
export function BusyDemo({ label, busyLabel }: { label: string; busyLabel: string }) {
  const [busy, setBusy] = useState(false);
  const [taps, setTaps] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <Button
      variant="send"
      full
      busy={busy}
      busyLabel={busyLabel}
      data-testid="busy-demo"
      data-taps={taps}
      onClick={() => {
        setTaps((n) => n + 1);
        setBusy(true);
        timer.current = setTimeout(() => setBusy(false), 1500);
      }}
    >
      {label}
    </Button>
  );
}

/** A stamp that lands when the page loads, with a button to see it again. */
export function StampReplay({
  word,
  label,
  secondLine,
  replayLabel,
}: {
  word: string;
  label: string;
  secondLine: string;
  replayLabel: string;
}) {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-wrap items-center gap-6 py-3">
      {/* A new key remounts the stamp, which is what restarts a one-shot animation. */}
      <Stamp key={run} size="md" tone="stamp" label={label} secondLine={secondLine} animate>
        {word}
      </Stamp>
      <Button variant="outline" data-testid="stamp-replay" onClick={() => setRun((n) => n + 1)}>
        {replayLabel}
      </Button>
    </div>
  );
}

export type TabsDemoRow = { name: string; meta: string; tone: "overdue" | "due" | "paid"; amount: string };

/** Tabs joined to a slip. Each tab shows one sample row, so a change of tab is easy to see. */
export function TabsDemo({
  tabs,
  label,
  panelId,
  rows,
}: {
  tabs: TabItem[];
  label: string;
  panelId: string;
  /** One row per tab id. */
  rows: Record<string, TabsDemoRow>;
}) {
  const [value, setValue] = useState(tabs[0].id);
  const row = rows[value];
  return (
    <div data-testid={`tabs-${panelId}`}>
      <Tabs tabs={tabs} value={value} onChange={setValue} label={label} panelId={panelId} />
      <Slip joined id={panelId} role="tabpanel" aria-labelledby={tabId(panelId, value)} className="px-3">
        <Rows>
          <Row name={row.name} meta={row.meta} tone={row.tone} amount={row.amount} />
        </Rows>
      </Slip>
    </div>
  );
}

/** A button that opens a sheet. `lines` adds enough content to make the panel scroll. */
export function SheetDemo({
  id,
  openLabel,
  title,
  closeLabel,
  context,
  body,
  fieldLabel,
  fieldValue,
  actionLabel,
  lines = 0,
  line,
  focusField = false,
}: {
  id: string;
  openLabel: string;
  title: string;
  closeLabel: string;
  context?: SheetContext;
  body: string;
  fieldLabel: string;
  fieldValue: string;
  actionLabel: string;
  lines?: number;
  line?: string;
  /** Put the cursor in the field when the sheet opens, instead of on the close control. */
  focusField?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" full data-testid={`sheet-open-${id}`} onClick={() => setOpen(true)}>
        {openLabel}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} closeLabel={closeLabel} context={context}>
        <div data-testid={`sheet-body-${id}`} className="flex flex-col gap-5">
          <Field
            label={fieldLabel}
            defaultValue={fieldValue}
            inputMode="numeric"
            autoComplete="off"
            data-autofocus={focusField ? "" : undefined}
          />
          {Array.from({ length: lines }, (_, i) => (
            <p key={i} className="type-body">
              {line}
            </p>
          ))}
          <p className="type-caption text-ink-soft">{body}</p>
          {/* 5px of room on the right for the button's shadow. */}
          <div className="pr-1.5">
            <Button variant="record" full onClick={() => setOpen(false)}>
              {actionLabel}
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** A segmented group whose choice the screen holds, with the reported value shown beneath. */
export function SegmentedDemo({
  label,
  name,
  options,
  chosenLabel,
}: {
  label: string;
  name: string;
  options: SegmentedProps["options"];
  chosenLabel: string;
}) {
  const [value, setValue] = useState(options[0].value);
  return (
    <div className="flex flex-col gap-2">
      <Segmented label={label} name={name} options={options} value={value} onChange={setValue} />
      <p className="type-caption text-ink-soft">
        {chosenLabel} <span data-testid="segmented-live-value">{value}</span>
      </p>
    </div>
  );
}

/**
 * A working switch. With `visibleLabel` the words sit beside it in a `<label>` that names it and
 * passes a tap on to it; otherwise `label` is its name for screen readers. The test id is `switch-<id>`.
 */
export function SwitchDemo({
  id,
  start = false,
  onText,
  offText,
  label,
  visibleLabel,
  force,
}: {
  id: string;
  start?: boolean;
  onText: string;
  offText: string;
  label?: string;
  visibleLabel?: string;
  force?: "focus";
}) {
  const [on, setOn] = useState(start);
  const labelId = useId();
  const switchId = useId();
  const shared = { checked: on, onChange: setOn, onText, offText, "data-testid": `switch-${id}`, "data-force": force };
  if (visibleLabel !== undefined) {
    return (
      <div className="flex items-center justify-between gap-4">
        <label id={labelId} htmlFor={switchId} className="type-body min-w-0 font-bold wrap-anywhere">
          {visibleLabel}
        </label>
        <Switch {...shared} id={switchId} labelledBy={labelId} />
      </div>
    );
  }
  return <Switch {...shared} label={label ?? ""} />;
}

/** An error banner and an undo banner whose actions report back: each tap is counted beneath. */
export function BannerDemo({
  error,
  undo,
  tapsLabel,
}: {
  error: { title: string; detail: string; retry: string; later: string };
  undo: { message: ReactNode; undo: string; send: string };
  tapsLabel: string;
}) {
  const [taps, setTaps] = useState({ retry: 0, later: 0, undo: 0, send: 0 });
  const count = (name: keyof typeof taps) => () => setTaps((t) => ({ ...t, [name]: t[name] + 1 }));
  return (
    <div className="flex flex-col gap-4">
      {/* 5px of room on the right for the error banner's shadow. */}
      <div className="pr-1.5">
        <Banner
          kind="error"
          title={error.title}
          detail={error.detail}
          actions={[
            { label: error.retry, onClick: count("retry") },
            { label: error.later, onClick: count("later") },
          ]}
        />
      </div>
      <Banner
        kind="undo"
        message={undo.message}
        actions={[
          { label: undo.undo, onClick: count("undo") },
          { label: undo.send, onClick: count("send"), icon: <MessageIcon /> },
        ]}
      />
      <p className="type-caption text-ink-soft">
        {tapsLabel}{" "}
        <span data-testid="banner-live-taps">
          {taps.retry} {taps.later} {taps.undo} {taps.send}
        </span>
      </p>
    </div>
  );
}
