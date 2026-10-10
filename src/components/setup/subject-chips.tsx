"use client";

// "What do you teach?": seven subject chips, any typed ones, and "+ Other" (spec R1-1, criteria 23 and 24).
// A chip is a toggle: pressed is a black fill plus a tick (never colour alone) and aria-pressed. The
// chips grow in height and wrap; no translated name is cut. The parent holds what is picked and what
// was typed; this draws it.
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cx } from "@/lib/cx";
import { presetKeys, SUBJECT_MAX, storedSubject, subjectLabel, type SubjectNames } from "@/lib/profile";

const chip =
  "inline-flex min-h-control items-center justify-center gap-1.5 rounded-sm border-2 border-ink px-3.5 py-2 type-control-sm text-center wrap-anywhere ring:ground-ring";
const idle = "bg-transparent text-ink";
const pressed = "on-dark-ground bg-ink text-slip";

function Tick() {
  return (
    <svg aria-hidden="true" focusable={false} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

function ErrorMark() {
  return (
    <svg aria-hidden="true" focusable={false} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 size-5 shrink-0">
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4v.1" />
    </svg>
  );
}

export type SubjectChipsProps = {
  names: SubjectNames;
  /** What is picked, as stored: preset keys and typed text. */
  picked: readonly string[];
  /** Subjects typed before, in the order they were typed. They stay as chips even when switched off. */
  extras: readonly string[];
  onToggle: (stored: string) => void;
  /** A typed subject, already turned into what is stored. */
  onAdd: (stored: string) => void;
  /** What is wrong with the choice, in words, or null. */
  error: string | null;
};

export function SubjectChips({ names, picked, extras, onToggle, onAdd, error }: Readonly<SubjectChipsProps>) {
  const t = useTranslations("setup.profile");
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const errorId = useId();

  // Opening "+ Other" puts the cursor in its field.
  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  function add() {
    const stored = storedSubject(text, names);
    if (stored === "") return;
    onAdd(stored);
    setText("");
    setOpen(false);
  }

  const all = [...presetKeys, ...extras.filter((subject) => !(presetKeys as readonly string[]).includes(subject))];

  return (
    <fieldset aria-describedby={error ? errorId : undefined} className="min-w-0 border-0 p-0">
      <legend className="type-label mb-2.5 max-w-full p-0 text-ink-label wrap-anywhere">{t("subjects")}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((subject) => {
          const on = picked.includes(subject);
          return (
            <button key={subject} type="button" aria-pressed={on} onClick={() => onToggle(subject)} className={cx(chip, on ? pressed : idle)}>
              {on ? <Tick /> : null}
              <span className="min-w-0">{subjectLabel(subject, names)}</span>
            </button>
          );
        })}
        <button type="button" aria-expanded={open} onClick={() => setOpen((was) => !was)} className={cx(chip, idle, "border-dashed")}>
          {t("other")}
        </button>
      </div>

      {open ? (
        <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
          <div className="min-w-48 flex-1">
            <Field
              ref={field}
              label={t("otherLabel")}
              value={text}
              maxLength={SUBJECT_MAX}
              autoComplete="off"
              onChange={(event) => setText(event.currentTarget.value)}
              // Enter adds the subject. Without this it would send the whole form.
              onKeyDown={(event) => {
                if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
                event.preventDefault();
                add();
              }}
            />
          </div>
          <div className="pr-1.5 pb-7.5">
            <Button variant="record" onClick={add} disabled={text.trim() === ""}>
              {t("add")}
            </Button>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="empty:hidden">
        {error ? (
          <p id={errorId} className="type-caption mt-3 flex items-start gap-2 font-semibold text-cloth">
            <ErrorMark />
            <span className="min-w-0 wrap-anywhere">{error}</span>
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}
