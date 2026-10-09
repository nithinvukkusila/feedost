// All text shown on /dev/supabase. Like /dev/components this is an internal tool, not a user-facing
// screen, so its words live here and not in messages/*.json. Plain English only.
export const copy = {
  title: "Supabase check",
  // The sentence the CI sentinel looks for: it is in a normal build and not in a production one.
  intro: "Which Supabase does this build talk to?",
  envLabel: "Environment",
  checking: "Checking",
  checkingDetail: "Asking the health function of this build's Supabase project.",
  notConfigured: "Not configured",
  notConfiguredDetail:
    "This build has no Supabase address. Set NEXT_PUBLIC_SUPABASE_URL and build again.",
  unreachableTitle: "Cannot reach Supabase",
  unreachableDetail:
    "No answer came back. The project may be paused, the address may be wrong, or this phone may be offline.",
  unexpectedTitle: "Unexpected answer",
  unexpectedDetail: "The health function answered, but not with what was expected.",
  unexpectedNotSet: "The project answered 500: it has no valid APP_ENV setting.",
  unexpectedMethod: "The project answered 405: the health function refused this kind of request.",
  unexpectedStatus: (status: number) => `The project answered with status ${status}.`,
  unexpectedShape: "The project answered 200, but the body was not the expected shape.",
  retry: "Check again",
} as const;
