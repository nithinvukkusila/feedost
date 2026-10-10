// The only file that imports the Supabase client library, and only with `await import()`: the library
// is a chunk of its own that a page downloads when it first needs it, never up front. Everything else
// asks src/lib/auth.ts and src/lib/tutor.ts, which call getClient().
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "./supabase-env";

export type { Session, SupabaseClient };

/**
 * The library's default sign-in flow is `implicit`; this app must use `pkce`. The page's address is
 * never read by the library (`detectSessionInUrl: false`): only the callback screen exchanges a
 * code, once. The session lives in this browser's localStorage and refreshes by itself.
 */
export const clientOptions = {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
} as const;

let pending: Promise<SupabaseClient> | null = null;

async function create(): Promise<SupabaseClient> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set when the app is built.");
  }
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(supabaseUrl, supabaseAnonKey, clientOptions);
}

/** The client, made on the first call and shared after that. A failed attempt is not remembered, so a retry can work. */
export function getClient(): Promise<SupabaseClient> {
  if (pending === null) {
    pending = create().catch((error: unknown) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}
