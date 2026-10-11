// Deno wiring only. The behaviour is in handler.ts, which Node tests with fake dependencies.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handle, LIMIT_PER_HOUR } from "./handler.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function hashIp(ip: string, hour: string): Promise<string> {
  const salt = Deno.env.get("WAITLIST_HASH_SALT");
  if (!salt) throw new Error("salt missing");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${ip}|${hour}`)));
}

Deno.serve((req) =>
  handle(req, {
    env: { APP_ENV: Deno.env.get("APP_ENV") },
    now: () => new Date(),
    hashIp,
    async hit(hash) {
      const { data, error } = await supabase.rpc("waitlist_hit", { p_hash: hash, p_limit: LIMIT_PER_HOUR });
      if (error) throw new Error("hit failed");
      return data === true;
    },
    async insert(row) {
      const { error } = await supabase.from("waitlist").upsert(row, { onConflict: "phone", ignoreDuplicates: true });
      if (error) throw new Error("insert failed");
    },
  }),
);
