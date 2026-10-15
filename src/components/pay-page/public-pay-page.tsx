"use client";

// The parent's pay page (spec R1-9 Part B, criteria 16 to 36). A static shell: the token is read from the address in
// an effect, one POST asks the `pay-page` function for the page, and the page shows what comes back. Before the parent
// agrees the server sends only the notice header; "I agree" calls `record-consent` and then reads the page again.
// The words of the unlocked languages arrive as a prop (English, and each language a named person has signed: spec
// parent-pages-english); the student's own `language` picks one if it is there, otherwise English, and the language
// button changes it for this visit only. The button is drawn only when more than English is there. Before there is a
// page (opening, not found, too many tries, failed) the browser's preferred language is used, by the same gate.
//
// Nothing here is kept: no storage, no cookie, no analytics. The token lives only in the effect that sends it (and
// again in the retry and the consent call, which read the address afresh); it is never rendered or put in the title.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Banner } from "@/components/ui/banner";
import { Slip } from "@/components/ui/slip";
import type { Locale } from "@/config/locales";
import {
  fetchPayPage,
  postConsent,
  tokenFromLocation,
  type PageOutcome,
  type PayPageData,
  type TokenSource,
} from "@/lib/pay-page-public";
import type { AllPageWords, PageWords } from "@/lib/pay-page-words";
import { browserLanguage, languagesOf, shownLanguage, wordsIn } from "@/lib/public-words";
import { subjectsLine } from "@/lib/receipt-words";
import { ConsentScreen } from "./consent-screen";
import { FeeScreen } from "./fee-screen";
import { Filled } from "./filled";
import { Frame, PayHeader } from "./frame";
import { LanguageMenu } from "./language-menu";

type Saving = "idle" | "saving" | "failed";
type State =
  | { kind: "loading" }
  | { kind: "page"; page: PayPageData; saving: Saving }
  | { kind: "not_found" }
  | { kind: "rate_limited" }
  | { kind: "failed" };

const subscribeToNothing = () => () => {};

function fromOutcome(outcome: PageOutcome): State {
  return outcome.kind === "ok" ? { kind: "page", page: outcome.page, saving: "idle" } : outcome;
}

/** Three blank lines on the slip, the loading block of the book: the page shows its shape and says what it is doing. */
function Opening({ words }: Readonly<{ words: PageWords["pay"] }>) {
  return (
    <div className="-mt-12.5 mr-5.5 ml-4">
      <Slip as="div" className="flex flex-col gap-3 p-4.5">
        <p role="status" className="type-body-lg font-bold">
          {words.loading}
        </p>
        <div aria-hidden="true" className="flex flex-col gap-2">
          <div className="h-6 w-2/3 bg-tab-idle" />
          <div className="h-4 w-full bg-tab-idle" />
          <div className="h-4 w-5/6 bg-tab-idle" />
        </div>
      </Slip>
    </div>
  );
}

/**
 * `tokenSource` is where the token is read: the path (`/p/{token}`, the parent's link) or `?t=` (only the /dev fixture
 * page that carries every language for the layout tests).
 */
export function PublicPayPage({ words, tokenSource = "path" }: Readonly<{ words: AllPageWords; tokenSource?: TokenSource }>) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [chosen, setChosen] = useState<Locale | null>(null);
  const [view, setView] = useState<"fee" | "notice">("fee");
  // A second tap on "I agree" is ignored even before React has drawn the first one's "Saving…".
  const agreeing = useRef(false);
  const leaving = useRef<AbortController | null>(null);
  // The browser's preferred languages, read once the page is in the browser; English in the delivered HTML.
  const preferred = useSyncExternalStore(
    subscribeToNothing,
    () => (navigator.languages?.length ? navigator.languages : [navigator.language ?? ""]).join(","),
    () => "",
  );
  const fallback = browserLanguage(preferred.split(","));

  useEffect(() => {
    const stop = new AbortController();
    leaving.current = stop;
    // A fresh read of the address each time: nothing else holds the token. An address that cannot hold one asks nothing.
    const token = tokenFromLocation(window.location, tokenSource);
    const outcome: Promise<PageOutcome> = token === null ? Promise.resolve({ kind: "not_found" }) : fetchPayPage(token, stop.signal);
    void outcome.then((result) => {
      if (!stop.signal.aborted) setState(fromOutcome(result));
    });
    return () => stop.abort();
  }, [attempt, tokenSource]);

  const page = state.kind === "page" ? state.page : null;
  // Only a language whose words are on the page can be shown; anything else (a locked language) is English.
  const language: Locale = shownLanguage(words, chosen ?? page?.language ?? fallback);
  const w = wordsIn(words, language);
  const choices = languagesOf(words);
  const choose = useCallback((next: Locale) => setChosen(words[next] === undefined ? null : next), [words]);

  // The page's own language, for screen readers and for the script's font and line height.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const retry = useCallback(() => {
    setState({ kind: "loading" });
    setView("fee");
    setAttempt((n) => n + 1);
  }, []);

  const agree = useCallback(async () => {
    if (agreeing.current || state.kind !== "page" || !state.page.consentNeeded) return;
    agreeing.current = true;
    const current = state.page;
    setState({ kind: "page", page: current, saving: "saving" });
    const signal = leaving.current?.signal;
    const token = tokenFromLocation(window.location, tokenSource);
    if (token === null) {
      agreeing.current = false;
      setState({ kind: "not_found" });
      return;
    }
    // The version sent is the one this page was given, never a constant in the page.
    const saved = await postConsent(token, current.noticeVersion, signal);
    if (signal?.aborted) return;
    if (saved.kind === "failed") {
      agreeing.current = false;
      setState({ kind: "page", page: current, saving: "failed" });
      return;
    }
    if (saved.kind === "not_found" || saved.kind === "rate_limited") {
      agreeing.current = false;
      setState({ kind: saved.kind });
      return;
    }
    // Saved, or the notice changed under the parent (409): read the page again. A changed notice shows the new one.
    const next = await fetchPayPage(token, signal);
    if (signal?.aborted) return;
    agreeing.current = false;
    setState(fromOutcome(next));
  }, [state, tokenSource]);

  // The frame's header: the tutor, what they teach, and the language button once there is a page to be in a language.
  let header: ReactNode;
  if (state.kind === "loading") {
    header = <PayHeader overlap label={w.pay.from} name={null} nameIsSaved={false} lines={[]} />;
  } else if (page) {
    const subjects = subjectsLine(w.receipt, page.tutorSubjects);
    const asking = page.consentNeeded || view === "notice";
    header = (
      <PayHeader
        overlap={!asking}
        label={w.pay.from}
        name={page.tutorName ?? w.pay.yourTutor}
        nameIsSaved={page.tutorName !== null}
        lines={[
          ...(subjects ? [subjects] : []),
          ...(asking ? [<Filled key="for" template={w.pay.for} values={{ student: page.studentName }} />] : []),
        ]}
        action={
          choices.length > 1 ? <LanguageMenu current={language} choices={choices} onChoose={choose} title={w.pay.language} closeLabel={w.pay.consent.close} /> : undefined
        }
      />
    );
  }

  let body: ReactNode = null;
  let ground: "paper" | "cloth" = "paper";
  let name: string = state.kind;
  if (state.kind === "loading") {
    body = <Opening words={w.pay} />;
  } else if (page && page.consentNeeded) {
    ground = "cloth";
    name = "consent";
    body = <ConsentScreen mode="ask" words={w.pay} tutorName={page.tutorName} saving={state.kind === "page" ? state.saving : "idle"} onAgree={() => void agree()} />;
  } else if (page && view === "notice") {
    ground = "cloth";
    name = "notice";
    body = <ConsentScreen mode="read" words={w.pay} tutorName={page.tutorName} onClose={() => setView("fee")} />;
  } else if (page) {
    name = "fee";
    body = <FeeScreen words={w.pay} monthWords={w.receipt} page={page} onOpenNotice={() => setView("notice")} />;
  } else {
    // No page to show: only words that came with no tutor or child data.
    const states = w.pay.state;
    body = (
      <div className="mt-6 mr-6 ml-4">
        {state.kind === "not_found" ? <Banner kind="error" title={states.notFound} detail={null} /> : null}
        {state.kind === "rate_limited" ? <Banner kind="error" title={states.rateLimited} detail={null} /> : null}
        {state.kind === "failed" ? <Banner kind="error" title={states.error} detail={null} actions={[{ label: states.retry, onClick: retry }]} /> : null}
      </div>
    );
  }

  return (
    <Frame
      lang={language}
      state={name}
      busy={state.kind === "loading"}
      ground={ground}
      header={header}
      footer={ground === "paper" ? { title: w.pay.footer.title, body: w.pay.footer.body } : null}
    >
      {body}
    </Frame>
  );
}
