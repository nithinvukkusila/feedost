// Test code for the parent's pay page (spec R1-9 Part B): the `pay-page` and `record-consent` functions answered by
// page.route, and a log of every request the page makes, so the tests can say how many went to each function and that
// the token went nowhere else.
import type { Page, Request, Route } from "@playwright/test";
import { feeBody, noticeBody } from "../src/lib/pay-page.test-util";

export { feeBody, noticeBody };
export const TOKEN = "Zx3k9Qw7LmN2pRtVb8YcAe"; // 22 URL-safe characters
// The host the CI build names (NEXT_PUBLIC_SUPABASE_URL=https://cicicicicicicicicici.supabase.co).
export const FUNCTION_HOST = "cicicicicicicicicici.supabase.co";
export const PAY_URL = `**/functions/v1/pay-page`;
export const CONSENT_URL = `**/functions/v1/record-consent`;
export const UPI_ID = "meena.tuitions@okhdfc";

export type Answer =
  | { status: number; body: unknown; delayMs?: number; headers?: Record<string, string> }
  | "abort"
  | "never"
  | ((call: number) => Exclude<Answer, (call: number) => unknown>);

/** A 200 answer with a page; `change` overrides keys of the fee page. */
export const fee = (change: Record<string, unknown> = {}) => ({ status: 200, body: { code: "ok", page: { ...feeBody, ...change } } });
export const notice = (change: Record<string, unknown> = {}) => ({ status: 200, body: { code: "ok", page: { ...noticeBody, ...change } } });
export const consentOk = { status: 200, body: { code: "ok" } };

export type Seen = {
  /** Every request the page made, in order, with the parts a leak could be in. */
  all: { method: string; url: string; headers: Record<string, string>; body: string | null; isDocument: boolean }[];
  /** The POSTs that reached `pay-page`. */
  pay: Request[];
  /** The POSTs that reached `record-consent`. */
  consent: Request[];
};

async function serve(page: Page, url: string, answer: Answer, log: Request[]) {
  let call = 0;
  await page.route(url, async (route: Route) => {
    const request = route.request();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    log.push(request);
    call += 1;
    const chosen = typeof answer === "function" ? answer(call) : answer;
    if (chosen === "abort") return route.abort("connectionfailed");
    if (chosen === "never") return;
    if (chosen.delayMs) await new Promise((r) => setTimeout(r, chosen.delayMs));
    await route.fulfill({ status: chosen.status, contentType: "application/json", headers: { ...cors, "cache-control": "no-store", ...chosen.headers }, body: JSON.stringify(chosen.body) });
  });
}

/** Answers both functions, and records every request from now on. Call before page.goto. */
export async function stubPayPage(page: Page, answers: { pay: Answer; consent?: Answer }): Promise<Seen> {
  const seen: Seen = { all: [], pay: [], consent: [] };
  page.on("request", (request) => {
    seen.all.push({ method: request.method(), url: request.url(), headers: request.headers(), body: request.postData(), isDocument: request.resourceType() === "document" });
  });
  await serve(page, PAY_URL, answers.pay, seen.pay);
  await serve(page, CONSENT_URL, answers.consent ?? consentOk, seen.consent);
  return seen;
}

/** Opens a pay link the way a parent would. */
export const link = (token: string = TOKEN, slash = true) => `/p/${token}${slash ? "/" : ""}`;

/** The page's own words, for a language, as the message files have them (TODO-translate shows as English). */
export { messageText } from "./helpers";

/**
 * The same page with hi, kn and te unlocked by a test fixture (spec parent-pages-english, criterion 10). /p/ itself
 * shows English only until a person signs a language, so the layout and language tests of hi, kn and te run here.
 */
export const unlockedLink = (token: string = TOKEN) => `/dev/unlocked/p/?t=${token}`;

/** English on the parent's own address; any other language on the fixture page. */
export const pageLink = (lang: string, token: string = TOKEN) => (lang === "en" ? link(token) : unlockedLink(token));
