// R0-4: the real waitlist-join function on STAGING, never production (plan section 7, H1, H7).
// Skipped unless WAITLIST_STAGING_URL is set to the function's full address, for example
//   https://<staging-ref>.supabase.co/functions/v1/waitlist-join
// Optional: WAITLIST_STAGING_ORIGIN, a browser origin the function allows (a *.vercel.app address).
// Run by release-manager after deploy. Each run writes up to three junk rows into the staging table
// (unique numbers, name "E2E Staging") for the founder to delete, and uses the hour's IP quota of five,
// so wait an hour between runs.
import { expect, test } from "@playwright/test";

const URL_ = process.env.WAITLIST_STAGING_URL;
const ORIGIN = process.env.WAITLIST_STAGING_ORIGIN ?? "https://feedost-staging.vercel.app";

test.describe("waitlist-join on staging (real function, real database)", () => {
  test.skip(!URL_, "WAITLIST_STAGING_URL is not set: this check only runs against staging");
  test.describe.configure({ mode: "serial" });

  // A valid mobile number nobody owns: 6 then nine random digits.
  const number = `9${String(Date.now()).slice(-6)}${String(Math.floor(Math.random() * 900) + 100)}`;
  const body = (over: Record<string, unknown> = {}) => ({
    name: "E2E Staging",
    phone: number,
    city: "Test",
    students_count: 10,
    language: "en",
    website: "",
    ...over,
  });
  const post = (request: import("@playwright/test").APIRequestContext, data: unknown, headers: Record<string, string> = {}) =>
    request.post(URL_!, { data, headers: { origin: ORIGIN, ...headers } });

  test("a new number, the same number again, and a honeypot post all answer ok; a bad body answers invalid; GET is refused", async ({ request }) => {
    const first = await post(request, body());
    expect(first.status(), "first call (if 429, an earlier run used this hour's quota; wait an hour)").toBe(200);
    expect(await first.json()).toEqual({ code: "ok" });
    // Same number written another way (a leading 0) is the duplicate path: the same success, no hint.
    const again = await post(request, body({ name: "Someone Else", phone: `0${number.slice(0, 5)} ${number.slice(5)}` }));
    expect(again.status()).toBe(200);
    expect(await again.json()).toEqual({ code: "ok" });
    const dup = await post(request, body({ name: "Someone Else" }));
    expect(dup.status()).toBe(200);
    expect(await dup.json()).toEqual({ code: "ok" });
    const trap = await post(request, body({ phone: "9000000001", website: "http://spam.example" }));
    expect(trap.status()).toBe(200);
    expect(await trap.json()).toEqual({ code: "ok" });
    const bad = await post(request, body({ phone: "12345" }));
    expect(bad.status()).toBe(400);
    expect(await bad.json()).toEqual({ code: "invalid" });
    const get = await request.get(URL_!, { headers: { origin: ORIGIN } });
    expect(get.status()).toBe(405);
    expect(await get.json()).toEqual({ code: "invalid" });
  });

  test("a disallowed origin gets no CORS header", async ({ request }) => {
    const response = await request.post(URL_!, { data: body({ phone: "9000000002", website: "x" }), headers: { origin: "https://evil.example" } });
    expect(response.headers()["access-control-allow-origin"]).toBeUndefined();
  });

  test("one address posting more than five times in the hour is refused with 429 and the code only", async ({ request }) => {
    let limited: { status: number; text: string } | null = null;
    // Earlier calls in this run already used some of the five; keep posting (honeypot posts do not count).
    for (let i = 0; i < 8 && !limited; i++) {
      const r = await post(request, body({ phone: "98765" + String(10000 + i) }));
      if (r.status() === 429) limited = { status: 429, text: await r.text() };
    }
    expect(limited, "no 429 within eight posts: the rate limit is not working").not.toBeNull();
    expect(JSON.parse(limited!.text)).toEqual({ code: "rate_limited" });
  });
});
