// The one place the Supabase project URL and the public (anon) key are read in the browser. Each is
// written literally, so Next.js replaces it with the build's value (a lookup by variable name would
// not be replaced). Both are public values, safe in the browser; row-level security is the wall.
export const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey: string = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * The browser-storage key the Supabase library keeps its session under: `sb-<first label of the
 * project's host>-auth-token`. Knowing it lets the app ask "is anyone signed in on this phone?"
 * without downloading the library. Null when the address is not a web address.
 */
export function storedSessionKey(url: string = supabaseUrl): string | null {
  try {
    return `sb-${new URL(url).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}
