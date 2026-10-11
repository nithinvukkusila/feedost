// The one request the waitlist form makes: a plain fetch to the waitlist-join Edge Function. No
// Supabase library and no key: the function is public and defends itself (spec R0-4, plan section 1).
// Nothing typed is logged, stored or sent anywhere else.
import { supabaseUrl } from "@/lib/supabase-env";
import type { Language, WaitlistRow } from "./rules";

export type JoinResult = "ok" | "invalid" | "rate_limited" | "error";

export type JoinValues = Pick<WaitlistRow, "name" | "phone" | "city" | "students_count">;

export const TIMEOUT_MS = 15_000;

const CODES: readonly JoinResult[] = ["ok", "invalid", "rate_limited", "error"];

/**
 * Sends one waitlist entry. Never throws: a network failure, a timeout, a reply that is not the
 * function's, and an `error` reply all come back as "error". Only an `ok` reply is success.
 * `signal` lets the caller cancel (the page leaving); the 15 second timeout is added to it.
 */
export async function joinWaitlist(
  values: JoinValues,
  language: Language,
  signal?: AbortSignal,
  endpoint: string = `${supabaseUrl}/functions/v1/waitlist-join`,
  trap: string = "",
): Promise<JoinResult> {
  const timer = new AbortController();
  const stop = setTimeout(() => timer.abort(), TIMEOUT_MS);
  const cancel = () => timer.abort();
  if (signal?.aborted) timer.abort();
  signal?.addEventListener("abort", cancel);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `website` is the honeypot: a person never fills it, so it is empty unless a bot filled the hidden box. Its real value is sent.
      body: JSON.stringify({ ...values, language, website: trap }),
      signal: timer.signal,
      credentials: "omit",
      cache: "no-store",
    });
    if (response.status === 429) return "rate_limited";
    const body: unknown = await response.json();
    const code = typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;
    const known = CODES.find((c) => c === code);
    // A success status with any other body is not trusted.
    if (known === "ok") return response.ok ? "ok" : "error";
    return known ?? "error";
  } catch {
    return "error";
  } finally {
    clearTimeout(stop);
    signal?.removeEventListener("abort", cancel);
  }
}
