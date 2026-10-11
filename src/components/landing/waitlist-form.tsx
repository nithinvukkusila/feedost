"use client";

// The waitlist form (spec R0-4): four fields, a consent line, one black button. Its words arrive as a
// plain object in a prop, so no message parser is shipped. The one request it makes is the plain
// fetch in src/lib/waitlist/join.ts, and only when the person submits.
//
// Nothing typed is kept anywhere but in this component's state: no storage, no cookie, no address
// bar. The fields carry the PostHog and Sentry mask attributes. With JavaScript off the delivered
// HTML holds only a line saying so, never inputs that cannot work.
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { Slip } from "@/components/ui/slip";
import { Stamp } from "@/components/ui/stamp";
import type { Locale } from "@/config/locales";
import { checkForm, type FormValues, type Problem } from "@/lib/waitlist/check";
import { joinWaitlist } from "@/lib/waitlist/join";
import { formatPhone, normalizePhone } from "@/lib/waitlist/rules";
import type en from "../../../messages/en.json";

export type WaitlistWords = (typeof en)["waitlistForm"];

type Status = "idle" | "sending" | "done" | "rate_limited" | "error";
type FieldName = "name" | "phone" | "city" | "students";
type Fix = { word: string; fix: string };

const ORDER: readonly FieldName[] = ["name", "phone", "city", "students"];
const subscribeToNothing = () => () => {};

// Keeps typed text out of analytics and error-report recordings.
const guarded = { "data-ph-no-capture": "", "data-sentry-mask": "" } as const;

function ErrorMark() {
  return (
    <svg
      aria-hidden="true"
      focusable={false}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5 shrink-0"
    >
      <path d="M12 3 2.5 20h19L12 3z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4v.1" />
    </svg>
  );
}

/** The needs-fixing props of a Field, once its field has been left or the form submitted. */
function shown(problem: Problem, touched: boolean, words: { missing: Fix; check: Fix }) {
  if (problem === null || !touched) return {};
  const { word, fix } = words[problem];
  return { state: "error" as const, stateLabel: word, message: fix };
}

export function WaitlistForm({ words, locale }: Readonly<{ words: WaitlistWords; locale: Locale }>) {
  // False in the delivered HTML and during hydration, true from the first render after it.
  const hydrated = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
  const [values, setValues] = useState<FormValues>({ name: "", phone: "", city: "", students: "" });
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({ name: false, phone: false, city: false, students: false });
  const [status, setStatus] = useState<Status>("idle");
  // A ref, not state: two taps in one frame both see the old state, and must still send one request.
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const done = useRef<HTMLDivElement | null>(null);
  const nameId = useId();
  const phoneId = useId();
  const cityId = useId();
  const studentsId = useId();
  const ids: Record<FieldName, string> = { name: nameId, phone: phoneId, city: cityId, students: studentsId };

  // The person leaving the page cancels a request still on its way.
  useEffect(() => () => request.current?.abort(), []);

  // Success replaces the form: move focus to the confirmation so it is read out and the keyboard is not lost.
  useEffect(() => {
    if (status === "done") done.current?.focus();
  }, [status]);

  const result = checkForm(values);
  const problems: Record<FieldName, Problem> = { name: result.name, phone: result.phone, city: result.city, students: result.students };
  const touch = (name: FieldName) => setTouched((before) => (before[name] ? before : { ...before, [name]: true }));
  const set = (name: FieldName, value: string) => setValues((before) => ({ ...before, [name]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setTouched({ name: true, phone: true, city: true, students: true });
    if (result.row === null) {
      const first = ORDER.find((name) => problems[name] !== null);
      if (first) document.getElementById(ids[first])?.focus();
      return;
    }
    inFlight.current = true;
    setStatus("sending");
    const controller = new AbortController();
    request.current = controller;
    const answer = await joinWaitlist(result.row, locale, controller.signal);
    inFlight.current = false;
    // The invalid answer means the page and the function disagree; to the person it is the same failure line.
    setStatus(answer === "ok" ? "done" : answer === "rate_limited" ? "rate_limited" : "error");
  }

  if (!hydrated) {
    return (
      <Slip className="mt-6 mr-1.5 p-4">
        <noscript>
          <p className="type-body">{words.noScript}</p>
        </noscript>
      </Slip>
    );
  }

  if (status === "done") {
    return (
      <Slip className="mt-6 mr-1.5 p-4">
        <div ref={done} role="status" tabIndex={-1} className="flex flex-col items-start gap-4 outline-none">
          <Stamp size="md" tone="stamp" decorative animate>
            {words.done.stamp}
          </Stamp>
          <div>
            <p className="type-body-lg font-extrabold wrap-anywhere">{words.done.title}</p>
            <p className="type-body mt-1 wrap-anywhere">{words.done.body}</p>
          </div>
        </div>
      </Slip>
    );
  }

  const sending = status === "sending";
  const studentsProblem = problems.students !== null && touched.students;
  return (
    <Slip className="mt-6 mr-1.5 p-4">
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field
          id={nameId}
          label={words.name.label}
          value={values.name}
          onChange={(event) => set("name", event.currentTarget.value)}
          onBlur={() => touch("name")}
          autoComplete="name"
          {...guarded}
          {...shown(problems.name, touched.name, words.name)}
        />
        <Field
          id={phoneId}
          label={words.phone.label}
          placeholder={words.phone.placeholder}
          value={values.phone}
          onChange={(event) => set("phone", event.currentTarget.value)}
          // Grouped when the field is left, so the caret does not jump while typing.
          onBlur={() => {
            const phone = normalizePhone(values.phone);
            if (phone !== null) set("phone", formatPhone(phone));
            touch("phone");
          }}
          inputMode="tel"
          autoComplete="tel"
          latinValue
          {...guarded}
          {...shown(problems.phone, touched.phone, words.phone)}
        />
        <Field
          id={cityId}
          label={words.city.label}
          value={values.city}
          onChange={(event) => set("city", event.currentTarget.value)}
          onBlur={() => touch("city")}
          autoComplete="address-level2"
          {...guarded}
          {...shown(problems.city, touched.city, words.city)}
        />
        <SelectField
          id={studentsId}
          label={words.students.label}
          value={values.students}
          onChange={(value) => {
            set("students", value);
            touch("students");
          }}
          options={[
            { value: "", label: words.students.choose },
            { value: "0", label: words.students.under10 },
            { value: "10", label: words.students.from10 },
            { value: "30", label: words.students.from30 },
            { value: "60", label: words.students.over60 },
          ]}
          helper={
            studentsProblem ? (
              <span className="inline-flex items-start gap-2 font-semibold text-cloth">
                <ErrorMark />
                <span>
                  {words.students.missing.word}
                  <span aria-hidden="true" className="mx-2 inline-block size-1 rounded-full bg-current align-middle" />
                  {words.students.missing.fix}
                </span>
              </span>
            ) : undefined
          }
          {...guarded}
        />
        {/* The honeypot: a person never sees or reaches it, a bot that fills every box does. It is in no tab order and no screen reader reads it. */}
        <div aria-hidden="true" className="sr-only">
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </div>
        <p className="type-body-sm text-ink-soft wrap-anywhere">{words.consent}</p>
        <Button type="submit" variant="record" size="large" full busy={sending} busyLabel={words.working}>
          {words.submit}
        </Button>
        {/* One live region, always mounted, so the banner that appears in it is announced. */}
        <div aria-live="polite">
          {status === "error" ? <Banner kind="error" title={words.failed.title} detail={words.failed.detail} /> : null}
          {status === "rate_limited" ? <Banner kind="error" title={words.rateLimited.title} detail={words.rateLimited.detail} /> : null}
        </div>
      </form>
    </Slip>
  );
}
