"use client";

// The first-visit privacy notice and consent (spec R1-9 criteria 18 to 20 and 30; canvas "Consent"). It gets only what
// the server gives before the parent agrees: the notice words and the agree handler. Its props have no money at all, so
// it cannot show an amount even by mistake. The wording is the founder's to approve (questions 3 and 5): the words come
// from messages/ untouched and are never rewritten here.
//
// `ask` has the agree button and "Asked only once". `read` is the same notice reopened from the fee page: a Close
// button and nothing to agree to.
//
// `consentLang` is the language of `words.consent` (English while the founder has not approved the wording, spec
// parent-pages-english); the section carries it. `lang` is the page's, for the two words here that are not consent
// words: "your tutor" when there is no name, and Try again.
import { Button } from "@/components/ui/button";
import type { Locale } from "@/config/locales";
import type { PayPageWords } from "@/lib/pay-page-words";
import { Filled } from "./filled";

function Mark({ kind }: Readonly<{ kind: "kept" | "never" }>) {
  return kind === "kept" ? (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-stamp">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="shrink-0 text-cloth">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

type Props = {
  words: PayPageWords;
  tutorName: string | null;
  lang: Locale;
  consentLang: Locale;
} & (
  | { mode: "ask"; saving: "idle" | "saving" | "failed"; onAgree: () => void }
  | { mode: "read"; onClose: () => void }
);

export function ConsentScreen(props: Readonly<Props>) {
  const { words, tutorName, lang, consentLang } = props;
  const c = words.consent;
  // Only set where it differs from what is around it, so the markup is unchanged while both are the same.
  const own = lang === consentLang ? undefined : lang;
  return (
    <section aria-labelledby="consent-title" lang={consentLang} className="on-paper-ground flex flex-col gap-4 border-t-2 border-ink bg-slip px-5 py-5.5 text-ink">
      <h1 id="consent-title" className="type-headline text-3xl wrap-anywhere">
        {c.title}
      </h1>
      <p className="type-body text-ink-soft wrap-anywhere">
        <Filled template={c.intro} values={{ tutor: tutorName ?? words.yourTutor }} langs={tutorName === null && own ? { tutor: own } : {}} />
      </p>

      <ul className="border-t-2 border-ink">
        {/* Each line carries its mark and its words, so it reads in grayscale: a tick for what is kept, a cross for what never happens. */}
        <li className="type-body-lg flex min-h-12 items-center gap-3 border-b border-rule py-2">
          <Mark kind="kept" />
          <span className="min-w-0 wrap-anywhere">{c.phone}</span>
        </li>
        <li className="type-body-lg flex min-h-12 items-center gap-3 border-b border-rule py-2">
          <Mark kind="kept" />
          <span className="min-w-0 wrap-anywhere">{c.child}</span>
        </li>
        <li className="type-body-lg flex min-h-12 items-center gap-3 border-b-2 border-ink py-2">
          <Mark kind="never" />
          <span className="min-w-0 wrap-anywhere">{c.never}</span>
        </li>
      </ul>

      {props.mode === "ask" ? (
        <>
          <div className="pt-1 pr-1.5">
            <Button
              variant="record"
              size="xl"
              full
              busy={props.saving === "saving"}
              busyLabel={c.saving}
              onClick={props.onAgree}
            >
              {c.agree}
            </Button>
          </div>
          {props.saving === "failed" ? (
            <div role="alert" className="flex flex-col gap-2">
              <p className="type-body-sm font-bold text-ink wrap-anywhere">{c.failed}</p>
              <Button variant="outline" full lang={own} onClick={props.onAgree}>
                {words.state.retry}
              </Button>
            </div>
          ) : null}
          <p className="type-body-sm text-ink-soft wrap-anywhere">{c.notAgree}</p>
          <p className="type-caption text-ink-soft">{c.once}</p>
        </>
      ) : (
        <div className="pt-1 pr-1.5">
          <Button variant="outline" full onClick={props.onClose}>
            {c.close}
          </Button>
        </div>
      )}
    </section>
  );
}
