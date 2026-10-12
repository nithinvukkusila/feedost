// The waitlist rules, shared with the Edge Function. One file serves both sides: it lives in
// supabase/functions/_shared/ (pure, no imports) and the page re-exports it here, so the page and
// the function cannot disagree about what a name, a city or a number is.
export * from "../../../supabase/functions/_shared/waitlist-rules";
