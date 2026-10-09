"use client";
// Asks the health function which environment this build's Supabase project is, and says so in words.
// A plain `fetch` with no custom headers: a "simple" request, so the browser sends no preflight.
// (If the hosted gateway turns out to need the project key, add `headers: { apikey }` to the one
// fetch call below. Not now: that is decided in F4b.)
import { useEffect, useState } from "react";
import { Banner } from "@/components/ui/banner";
import { supabaseUrl } from "@/lib/supabase-env";
import { copy } from "./copy";

export type EnvName = "local" | "staging" | "production";
const ENV_NAMES: readonly string[] = ["local", "staging", "production"];

export type Unexpected = "not-set" | "method" | "status" | "shape";
export type Health =
  | { kind: "ok"; env: EnvName }
  | { kind: "unexpected"; reason: Unexpected; status: number };

/** Reads a health answer. Exactly status 200 and exactly {"ok":true,"env":<name>} is success. */
export function readHealth(status: number, bodyText: string): Health {
  if (status === 500) return { kind: "unexpected", reason: "not-set", status };
  if (status === 405) return { kind: "unexpected", reason: "method", status };
  if (status !== 200) return { kind: "unexpected", reason: "status", status };
  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return { kind: "unexpected", reason: "shape", status };
  }
  if (typeof body === "object" && body !== null && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    const keys = Object.keys(record).sort().join(",");
    if (keys === "env,ok" && record.ok === true && typeof record.env === "string" && ENV_NAMES.includes(record.env)) {
      return { kind: "ok", env: record.env as EnvName };
    }
  }
  return { kind: "unexpected", reason: "shape", status };
}

type State =
  | { kind: "checking" }
  | { kind: "unreachable" }
  | Health;

const TIMEOUT_MS = 5000;

const reasonText = (health: Extract<Health, { kind: "unexpected" }>): string => {
  if (health.reason === "not-set") return copy.unexpectedNotSet;
  if (health.reason === "method") return copy.unexpectedMethod;
  if (health.reason === "status") return copy.unexpectedStatus(health.status);
  return copy.unexpectedShape;
};

// A check mark, a dash, or a dotted ring: the mark that goes with the word, so status is never colour alone.
function Mark({ shape }: { shape: "check" | "dash" | "dots" }) {
  const path = shape === "check" ? "M4 12.5l5 5L20 6.5" : shape === "dash" ? "M5 12h14" : "M6 12h.01M12 12h.01M18 12h.01";
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-6 shrink-0" aria-hidden="true" focusable={false}>
      <path d={path} />
    </svg>
  );
}

function Plain({ shape, word, detail, state, env }: { shape: "check" | "dash" | "dots"; word: string; detail?: string; state: string; env?: string }) {
  return (
    <div data-state={state} data-env={env} className="on-paper-ground flex flex-col gap-1 border-2 border-ink bg-slip px-4 py-3.5 text-ink">
      <p className="type-body-lg flex items-center gap-2.5 font-extrabold">
        <Mark shape={shape} />
        <span data-testid="env-check-word" className="wrap-anywhere">{word}</span>
      </p>
      {detail ? <p className="type-body-sm text-ink-soft wrap-anywhere">{detail}</p> : null}
    </div>
  );
}

export function EnvCheck() {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (supabaseUrl === "") return;
    let cancelled = false;
    const controller = new AbortController();
    // Too slow counts as "cannot reach": a paused project can hang instead of refusing.
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    fetch(`${supabaseUrl.replace(/\/+$/, "")}/functions/v1/health`, { signal: controller.signal })
      .then(async (response) => {
        const text = await response.text();
        if (!cancelled) setState(readHealth(response.status, text));
      })
      .catch(() => {
        // A network error, a timeout or a blocked request. Not an answer.
        if (!cancelled) setState({ kind: "unreachable" });
      })
      .finally(() => clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [round]);

  const again = [
    {
      label: copy.retry,
      onClick: () => {
        // The old answer is not left on screen while the new check runs.
        setState({ kind: "checking" });
        setRound((n) => n + 1);
      },
    },
  ] as const;

  let body;
  let stateName: string;
  if (supabaseUrl === "") {
    stateName = "not-configured";
    body = <Plain shape="dash" word={copy.notConfigured} detail={copy.notConfiguredDetail} state={stateName} />;
  } else if (state.kind === "checking") {
    stateName = "checking";
    body = <Plain shape="dots" word={copy.checking} detail={copy.checkingDetail} state={stateName} />;
  } else if (state.kind === "ok") {
    stateName = "ok";
    body = (
      <Plain shape="check" word={state.env} detail={copy.envLabel} state={stateName} env={state.env} />
    );
  } else if (state.kind === "unreachable") {
    stateName = "unreachable";
    body = <Banner kind="error" title={copy.unreachableTitle} detail={copy.unreachableDetail} actions={again} />;
  } else {
    stateName = "unexpected";
    body = (
      <Banner kind="error" title={copy.unexpectedTitle} detail={`${copy.unexpectedDetail} ${reasonText(state)}`} actions={again} />
    );
  }

  return (
    <div data-testid="env-check-result" data-state={stateName} aria-live="polite">
      {body}
    </div>
  );
}
