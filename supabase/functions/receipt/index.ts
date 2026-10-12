// Deno wiring only. The behaviour is in handler.ts, which Node tests with fake dependencies.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handle } from "./handler.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(message: string): Promise<string> {
  const salt = Deno.env.get("RECEIPT_HASH_SALT");
  if (!salt) throw new Error("salt missing");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

async function hit(hash: string, limit: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("receipt_hit", { p_hash: hash, p_limit: limit });
  if (error) throw new Error("hit failed");
  return data === true;
}

Deno.serve((req) =>
  handle(req, {
    env: { APP_ENV: Deno.env.get("APP_ENV"), RECEIPT_ALLOWED_HOSTS: Deno.env.get("RECEIPT_ALLOWED_HOSTS") },
    now: () => new Date(),
    hashIp: (ip, hour) => hmac(`${ip}|${hour}`),
    hashToken: (token, hour) => hmac(`token|${token}|${hour}`),
    hitIp: hit,
    hitToken: hit,
    async getReceipt(token) {
      const { data, error } = await supabase.rpc("get_receipt", { p_token: token });
      if (error) throw new Error("lookup failed");
      return data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    },
  }),
);
