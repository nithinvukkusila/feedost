"use client";

// The error state of every app screen (spec R1-1, criteria 20 and 26; canvas "State-error"). The same
// grey blocks as the loading state, and an error banner at the foot that says what happened and what is
// safe, with the one thing to do. A network failure offers "Try again" and, for a way out of a failure that does not end, "Sign out"; it never signs the tutor out by itself.
// A missing profile row cannot be fixed by trying again: it offers Sign out, so the tutor can start over.
import { useTranslations } from "next-intl";
import { Banner } from "@/components/ui/banner";
import { BookBlocks } from "./loading-book";

export type LoadErrorProps =
  | { kind: "network"; onRetry: () => void; onSignOut: () => void }
  | { kind: "missing"; onSignOut: () => void };

export function LoadError(props: Readonly<LoadErrorProps>) {
  const state = useTranslations("appState");
  const setup = useTranslations("setup");
  const more = useTranslations("more");
  const banner =
    props.kind === "network" ? (
      <Banner kind="error" title={state("errorTitle")} detail={state("errorBody")} actions={[
          { label: state("retry"), onClick: props.onRetry },
          { label: more("signOut"), onClick: props.onSignOut },
        ]} />
    ) : (
      <Banner kind="error" title={state("errorTitle")} detail={setup("rowMissing")} actions={[{ label: more("signOut"), onClick: props.onSignOut }]} />
    );
  return <BookBlocks footer={<div className="mt-4 mr-4 mb-4 ml-3">{banner}</div>} />;
}
