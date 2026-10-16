// Test code for the parent's receipt page (spec R1-7 Part B): the `receipt` function answered by page.route, and a log of
// every request the page makes, so the tests can say how many went to the function and that the token went nowhere else.
import type { Page, Request, Route } from "@playwright/test";

export const TOKEN = "Zx3k9Qw7LmN2pRtVb8YcAe"; // 22 URL-safe characters
export const FUNCTION_HOST = "cicicicicicicicicici.supabase.co";
export const FUNCTION_URL = `**/functions/v1/receipt`;

export const paid = {
  receipt_no: 215,
  status: "paid",
  tutor_name: "Meena Iyer",
  tutor_subjects: ["maths", "science"],
  student_name: "Ravi Kumar",
  parent_name: "Suresh Kumar",
  month: "2026-10-01",
  amount: 120000,
  method: "upi",
  paid_on: "2026-10-08",
  balance_after: 0,
  language: "en",
};

export const cancelled = { receipt_no: 215, status: "cancelled", tutor_name: "Meena Iyer", student_name: "Ravi Kumar", language: "en" };

export type Answer =
  | { status: number; body: unknown; delayMs?: number }
  | "abort"
  | "never"
  | ((call: number) => Exclude<Answer, (call: number) => unknown>);

export const okBody = (change: Record<string, unknown> = {}) => ({ status: 200, body: { code: "ok", receipt: { ...paid, ...change } } });

export type Seen = {
  /** Every request the page made, in order, with the parts a leak could be in. */
  all: { method: string; url: string; headers: Record<string, string>; body: string | null; isDocument: boolean }[];
  /** The POSTs that reached the function. */
  posts: Request[];
};

/** Answers the function, and records every request from now on. Call before page.goto. */
export async function stubReceipt(page: Page, answer: Answer): Promise<Seen> {
  const seen: Seen = { all: [], posts: [] };
  page.on("request", (request) => {
    seen.all.push({
      method: request.method(),
      url: request.url(),
      headers: request.headers(),
      body: request.postData(),
      isDocument: request.resourceType() === "document",
    });
  });
  let call = 0;
  await page.route(FUNCTION_URL, async (route: Route) => {
    const request = route.request();
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    seen.posts.push(request);
    call += 1;
    const chosen = typeof answer === "function" ? answer(call) : answer;
    if (chosen === "abort") return route.abort("connectionfailed");
    if (chosen === "never") return;
    if (chosen.delayMs) await new Promise((r) => setTimeout(r, chosen.delayMs));
    await route.fulfill({
      status: chosen.status,
      contentType: "application/json",
      headers: { ...cors, "cache-control": "no-store" },
      body: JSON.stringify(chosen.body),
    });
  });
  return seen;
}

/** Opens a receipt link the way a parent would. */
export const link = (token: string = TOKEN, slash = true) => `/r/${token}${slash ? "/" : ""}`;

/**
 * The same page with hi, kn and te unlocked by a test fixture (spec parent-pages-english, criterion 10). /r/ itself
 * shows English only until a person signs a language, so the layout and language tests of hi, kn and te run here.
 */
export const unlockedLink = (token: string = TOKEN) => `/dev/unlocked/r/?t=${token}`;

/** English on the parent's own address; any other language on the fixture page. */
export const pageLink = (lang: string, token: string = TOKEN) => (lang === "en" ? link(token) : unlockedLink(token));
