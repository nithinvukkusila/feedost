// Spec R1-7 Part B, criteria 28 to 31: the parent's receipt page at /r/{token}, with the `receipt` function answered by
// page.route. Nothing here talks to a real database; the real function and the real rewrite are checked by hand on a
// Vercel preview (see the PR). The local server follows vercel.json, so the rewrite and headers in that file are what run.
import { expect, test } from "@playwright/test";
import { brand } from "../src/config/brand";
import { fontsSettled, langs, messageText, type Lang } from "./helpers";
import { FUNCTION_HOST, TOKEN, cancelled, link, okBody, paid, stubReceipt } from "./receipt-public-helpers";

const word = (lang: Lang, key: string) => messageText(lang, `receipt.${key}`);

test.describe("the receipt", () => {
  for (const lang of langs) {
    test(`criterion 28 and 31 [${lang}]: the page language is the receipt's, and the receipt is as drawn`, async ({ page }) => {
      await stubReceipt(page, okBody({ language: lang }));
      // The address and the browser say English; the receipt says `lang`.
      await page.goto(link());
      await fontsSettled(page);
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "ok");
      await expect(main).toHaveAttribute("lang", lang);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(main).toContainText("Meena Iyer");
      await expect(main).toContainText("Ravi Kumar");
      await expect(main).toContainText("Suresh Kumar");
      await expect(main).toContainText("215");
      await expect(main).toContainText("08 Oct 2026");
      await expect(main).toContainText("₹1,200/-");
      await expect(main).toContainText(word(lang, "nil"));
      await expect(main).toContainText(word(lang, "footer"));
      await expect(main).toContainText(word(lang, "months.m10"));
      await expect(main).toContainText("2026");
      // The month sits in the sentence with 0-9 digits, whatever the language.
      expect(await main.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
      expect(await main.textContent()).not.toContain("TODO-translate");
      // A word and a mark for the status: the tag and the stamp both say it.
      await expect(page.locator("[data-status=paid]")).toHaveText(word(lang, "paid"));
      await expect(main.getByRole("img", { name: word(lang, "stampPaid") })).toBeVisible();
      // No login, no link out, no button until Part C adds Download PDF.
      await expect(main.locator("a, button, input")).toHaveCount(0);
    });
  }

  test("criterion 28: the same page opens without the closing slash, and the address is left as it was", async ({ page }) => {
    await stubReceipt(page, okBody());
    await page.goto(link(TOKEN, false));
    await expect(page.locator("main")).toHaveAttribute("data-state", "ok");
    expect(new URL(page.url()).pathname.startsWith(`/r/${TOKEN}`)).toBe(true);
  });

  test("criterion 28: a part payment shows Part paid with the balance left", async ({ page }) => {
    await stubReceipt(page, okBody({ status: "part_paid", amount: 70000, balance_after: 50000, month: null, parent_name: null }));
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toContainText("₹700/-");
    await expect(main).toContainText("₹500");
    await expect(main).toContainText("an earlier balance");
    await expect(page.locator("[data-status=part-paid]")).toHaveText("Part paid");
    await expect(main.getByRole("img", { name: "PART PAID" })).toBeVisible();
    await expect(main).not.toContainText("Suresh Kumar");
  });

  test("criterion 28: amounts have Indian grouping", async ({ page }) => {
    await stubReceipt(page, okBody({ amount: 123456700, balance_after: 7890000, status: "part_paid" }));
    await page.goto(link());
    await expect(page.locator("main")).toContainText("₹12,34,567/-");
    await expect(page.locator("main")).toContainText("₹78,900");
  });

  test("criterion 29: the cancelled state shows the number, the tutor and the student, and no amount", async ({ page }) => {
    await stubReceipt(page, { status: 200, body: { code: "ok", receipt: cancelled } });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "cancelled");
    await expect(main).toContainText("This receipt was cancelled by your tutor.");
    await expect(main).toContainText("215");
    await expect(main).toContainText("Meena Iyer");
    await expect(main).toContainText("Ravi Kumar");
    await expect(main).not.toContainText("₹");
    await expect(main.getByRole("img", { name: "CANCELLED" })).toBeVisible();
  });

  for (const lang of ["hi", "kn", "te"] as const) {
    test(`criterion 29 and 31 [${lang}]: a cancelled receipt reads in its own language`, async ({ page }) => {
      await stubReceipt(page, { status: 200, body: { code: "ok", receipt: { ...cancelled, language: lang } } });
      await page.goto(link());
      await expect(page.locator("main")).toContainText(word(lang, "cancelled.title"));
      await expect(page.locator("main")).toContainText(word(lang, "stampCancelled"));
    });
  }
});

test.describe("the other states", () => {
  test("criterion 29: opening shows words and a shape, never a bare spinner, then the receipt", async ({ page }) => {
    await stubReceipt(page, { ...okBody(), delayMs: 1200 });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "loading");
    await expect(main).toContainText("Opening your receipt…");
    await expect(main).toHaveAttribute("data-state", "ok");
    await expect(main).not.toContainText("Opening your receipt…");
  });

  test("criterion 29 and 24: an unknown token is 'not found' and shows nothing of the tutor", async ({ page }) => {
    await stubReceipt(page, { status: 404, body: { code: "not_found" } });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "not_found");
    await expect(main).toContainText("This receipt link doesn't work.");
    await expect(main).toContainText("Ask your tutor to send it again.");
    await expect(main).not.toContainText("Meena");
    await expect(main.locator("button")).toHaveCount(0);
  });

  test("criterion 24: a token that cannot be one is 'not found' with no request at all", async ({ page }) => {
    const seen = await stubReceipt(page, okBody());
    for (const path of ["/r/short/", "/r/", "/r/abc-def_ghi-jkl_mno-p!/", `/r/${"a".repeat(21)}/`]) {
      await page.goto(path);
      await expect(page.locator("main")).toHaveAttribute("data-state", "not_found");
    }
    expect(seen.posts).toHaveLength(0);
  });

  test("criterion 25 and 29: too many tries shows the rate limit, with no Try again button", async ({ page }) => {
    await stubReceipt(page, { status: 429, body: { code: "rate_limited" } });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "rate_limited");
    await expect(main).toContainText("Too many tries.");
    await expect(main).toContainText("Please try again later.");
    await expect(main.locator("button")).toHaveCount(0);
  });

  test("criterion 29: a server fault shows Try again, and Try again asks once more and shows the receipt", async ({ page }) => {
    const seen = await stubReceipt(page, (call) => (call === 1 ? { status: 500, body: { code: "error" } } : okBody()));
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "failed");
    await expect(main).toContainText("Couldn't open the receipt.");
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "ok");
    expect(seen.posts).toHaveLength(2);
  });

  test("criterion 29: no network is the same failure with Try again", async ({ page }) => {
    await stubReceipt(page, (call) => (call === 1 ? "abort" : okBody()));
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "failed");
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "ok");
  });

  test("criterion 29: a reply that is not the function's is a failure, not a half page", async ({ page }) => {
    await stubReceipt(page, { status: 200, body: { code: "ok", receipt: { ...paid, amount: "1200" } } });
    await page.goto(link());
    await expect(page.locator("main")).toHaveAttribute("data-state", "failed");
  });

  for (const lang of ["hi", "kn", "te"] as const) {
    test(`criterion 31 [${lang}]: with nothing to take the language from, the browser's language is used`, async ({ browser }) => {
      const context = await browser.newContext({ locale: { hi: "hi-IN", kn: "kn-IN", te: "te-IN" }[lang] });
      const page = await context.newPage();
      await stubReceipt(page, { status: 404, body: { code: "not_found" } });
      await page.goto(link());
      await expect(page.locator("main")).toContainText(word(lang, "notFound.title"));
      await context.close();
    });
  }
});

test.describe("privacy (criteria 27 and 28)", () => {
  test("one request to the function, the token only in its body, and nowhere else", async ({ page }) => {
    const seen = await stubReceipt(page, okBody());
    await page.goto(link());
    await expect(page.locator("main")).toHaveAttribute("data-state", "ok");
    await page.waitForLoadState("networkidle");

    // Exactly one POST to the function; a browser's preflight is the only other thing the function host may see.
    expect(seen.posts).toHaveLength(1);
    const toFunctionHost = seen.all.filter((r) => new URL(r.url).host === FUNCTION_HOST);
    expect(toFunctionHost.filter((r) => r.method !== "OPTIONS")).toHaveLength(1);
    const post = toFunctionHost.find((r) => r.method === "POST")!;
    expect(new URL(post.url).pathname).toBe("/functions/v1/receipt");
    expect(new URL(post.url).search).toBe("");
    expect(JSON.parse(post.body ?? "{}")).toEqual({ token: TOKEN });
    expect(post.headers["referer"]).toBeUndefined();
    expect(post.headers["cookie"]).toBeUndefined();
    expect(post.headers["authorization"]).toBeUndefined();

    // The token is in the first request (the address the parent opened) and in the function's body, and in nothing else.
    for (const r of seen.all.filter((r) => !r.isDocument && r !== post)) {
      expect(r.url, "a request's address").not.toContain(TOKEN);
      expect(JSON.stringify(r.headers), `a request's headers ${r.url}`).not.toContain(TOKEN);
      expect(r.body ?? "", `a request's body ${r.url}`).not.toContain(TOKEN);
    }
    // Only this site and the function host are contacted (fonts and scripts are served from this site).
    const origin = new URL(page.url()).host;
    for (const r of seen.all) expect([origin, FUNCTION_HOST], r.url).toContain(new URL(r.url).host);

    // Not on the page, not in the title.
    expect(await page.title()).not.toContain(TOKEN);
    expect(await page.title()).toBe(brand.name);
    expect(await page.content()).not.toContain(TOKEN);
  });

  test("no cookie, no storage, no analytics", async ({ page, context }) => {
    const seen = await stubReceipt(page, okBody());
    await page.goto(link());
    await expect(page.locator("main")).toHaveAttribute("data-state", "ok");
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).toBe("");
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    expect(await page.evaluate(async () => (await indexedDB.databases?.())?.length ?? 0)).toBe(0);
    expect(seen.all.some((r) => /posthog|sentry|analytics|google-analytics/i.test(r.url))).toBe(false);
  });

  test("the shell is told to stay out of search and send no referrer (header and meta)", async ({ page, request }) => {
    await stubReceipt(page, okBody());
    // The real header comes from vercel.json; the local server applies the same file.
    const response = await request.get(link());
    expect(response.status()).toBe(200);
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    await page.goto(link());
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
  });

  test("any single-segment path under /r/ gets the shell, and other pages are untouched", async ({ request }) => {
    for (const path of ["/r/anything/", "/r/anything", `/r/${TOKEN}`]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(await response.text()).toContain('data-state="loading"');
    }
    expect((await request.get("/r/a/b/c/")).status()).toBe(404);
    expect((await request.get("/en/")).headers()["x-robots-tag"]).toBeUndefined();
  });
});
