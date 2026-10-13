// Deno wiring only. The behaviour is in handler.ts, which Node tests with fake dependencies.
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { handle, ipHashMessage, tokenHashMessage } from "./handler.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(message: string): Promise<string> {
  const salt = Deno.env.get("PAYPAGE_HASH_SALT");
  if (!salt) throw new Error("salt missing");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

async function hit(hash: string, limit: number): Promise<boolean> {
  const { data, error } = await supabase.rpc("paypage_hit", { p_hash: hash, p_limit: limit });
  if (error) throw new Error("hit failed");
  return data === true;
}

Deno.serve((req) =>
  handle(req, {
    env: { APP_ENV: Deno.env.get("APP_ENV"), PAYPAGE_ALLOWED_HOSTS: Deno.env.get("PAYPAGE_ALLOWED_HOSTS") },
    now: () => new Date(),
    hashIp: (ip, hour) => hmac(ipHashMessage(ip, hour)),
    hashToken: (token, hour) => hmac(tokenHashMessage(token, hour)),
    hitIp: hit,
    hitToken: hit,
    async recordConsent(token, noticeVersion) {
      const { data, error } = await supabase.rpc("record_consent", { p_token: token, p_notice_version: noticeVersion });
      if (error || typeof data !== "string") throw new Error("record failed");
      return data;
    },
    // record_consent says only "stale_notice"; the version to reload with is the one get_pay_page gives for this (known) token.
    async currentNoticeVersion(token) {
      const { data, error } = await supabase.rpc("get_pay_page", { p_token: token });
      if (error) throw new Error("lookup failed");
      const version = data && typeof data === "object" ? (data as Record<string, unknown>).notice_version : null;
      return typeof version === "string" ? version : null;
    },
  }),
);
