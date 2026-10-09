// The one place the Supabase project URL is read in the browser. Written literally, so Next.js
// replaces it with the build's value (a lookup by variable name would not be replaced).
// The anon key is not read anywhere yet: the first screen that needs it adds it, together with the
// client library.
export const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
