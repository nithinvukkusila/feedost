// The only tutor-side reader of `students.pay_token` (spec R1-9 Part C, plan C3). The Remind screen asks for it once,
// keeps it in its own state, and puts it only into the pay-page link of the message the tutor chooses to send. It never
// goes into the roster, the outbox, the reminder log, storage, the address or a console line. Any failure, an offline
// phone or a slow network gives an empty map: the reminder then carries the raw UPI link.
import { getClient } from "./supabase";

/** Longest the Remind screen waits for the tokens before it falls back to the raw link. */
export const PAY_TOKENS_WAIT_MS = 5000;

async function read(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (typeof navigator !== "undefined" && navigator.onLine === false) return map;
  const client = await getClient();
  const { data, error } = await client.from("students").select("id,pay_token");
  if (error || !Array.isArray(data)) return map;
  for (const row of data as unknown[]) {
    if (typeof row !== "object" || row === null) continue;
    const { id, pay_token: token } = row as { id?: unknown; pay_token?: unknown };
    if (typeof id === "string" && typeof token === "string" && token !== "") map.set(id, token);
  }
  return map;
}

/** student id to pay token, for this tutor's students. Never throws. */
export async function readPayTokens(): Promise<ReadonlyMap<string, string>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slow = new Promise<Map<string, string>>((resolve) => {
    timer = setTimeout(() => resolve(new Map()), PAY_TOKENS_WAIT_MS);
  });
  try {
    return await Promise.race([read(), slow]);
  } catch {
    return new Map();
  } finally {
    clearTimeout(timer);
  }
}
