// Spec R1-9 Part B, criteria 16 to 36 and 42: the parent's pay page at /p/{token}, with `pay-page` and `record-consent`
// answered by page.route. Nothing here talks to a real database; the real functions, the CORS list and the rewrite on
// Vercel are checked by hand (see the PR). The local server follows vercel.json, so the rewrite and headers run.
import { expect, test, type Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { box, langs, messageText as text, type Lang } from "./helpers";
import { FUNCTION_HOST, TOKEN, UPI_ID, consentOk, fee, link, notice, stubPayPage } from "./pay-page-helpers";

const word = (lang: Lang, key: string) => text(lang, `payPage.${key}`);
const PAY_LINK = `upi://pay?pa=${UPI_ID}&pn=Meena%20Iyer&am=3400.00&cu=INR&tn=Fees%20due%20Ravi`;

async function openFee(page: Page, change: Record<string, unknown> = {}) {
  const seen = await stubPayPage(page, { pay: fee(change) });
  await page.goto(link());
  await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
  return seen;
}

test.describe("the shell (criterion 16)", () => {
  test("any single-segment path under /p/ gets the shell, with no referrer and noindex, and other pages are untouched", async ({ request }) => {
    for (const path of ["/p/anything/", "/p/anything", `/p/${TOKEN}`, "/p/"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(await response.text()).toContain('data-state="loading"');
    }
    const shell = await request.get(link());
    expect(shell.headers()["referrer-policy"]).toBe("no-referrer");
    expect(shell.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect((await request.get("/p/a/b/c/")).status()).toBe(404);
    expect((await request.get("/en/")).headers()["x-robots-tag"]).toBeUndefined();
  });

  test("it says noindex and no-referrer in the page too, with no language in the address, and the title is the product name", async ({ page }) => {
    await stubPayPage(page, { pay: fee() });
    await page.goto(link());
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
    expect(new URL(page.url()).pathname).toBe(`/p/${TOKEN}/`);
    expect(await page.title()).toBe(brand.name);
  });

  test("a missing token or one of the wrong shape is 'not found' with no request at all", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: fee() });
    for (const path of ["/p/", "/p/short/", "/p/abc-def_ghi-jkl_mno-p!/", `/p/${"a".repeat(21)}/`]) {
      await page.goto(path);
      await expect(page.locator("main")).toHaveAttribute("data-state", "not_found");
    }
    expect(seen.pay).toHaveLength(0);
    expect(seen.consent).toHaveLength(0);
  });
});

test.describe("opening (criterion 17)", () => {
  test("shows words and a shape with the tutor's name as a plain block, never a bare spinner, then the page", async ({ page }) => {
    await stubPayPage(page, { pay: { ...fee(), delayMs: 1200 } });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "loading");
    await expect(main).toHaveAttribute("aria-busy", "true");
    await expect(main).toContainText("Opening your fee request…");
    await expect(main).toContainText("Fee request from");
    await expect(main).not.toContainText("Meena");
    await expect(main.locator("button, a")).toHaveCount(0);
    await expect(main).toHaveAttribute("data-state", "fee");
    await expect(main).not.toContainText("Opening your fee request…");
  });
});

test.describe("first visit: consent (criteria 18 to 20)", () => {
  for (const lang of langs) {
    test(`criterion 18 and 19 [${lang}]: the notice, the three lines with marks, and no money anywhere`, async ({ page }) => {
      const seen = await stubPayPage(page, { pay: notice({ language: lang }) });
      await page.goto(link());
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "consent");
      await expect(main).toHaveAttribute("lang", lang);
      await expect(main).toContainText("Meena Iyer");
      await expect(main).toContainText("Ravi Kumar");
      await expect(main).toContainText(`${text(lang, "receipt.subjects.maths")}, ${text(lang, "receipt.subjects.science")}`);
      // The notice wording is the founder's, unapproved, and in every language still English (shown, never a marker).
      for (const key of ["title", "phone", "child", "never", "agree", "once", "notAgree"]) await expect(main).toContainText(word(lang, `consent.${key}`));
      await expect(main.getByRole("heading", { level: 1 })).toHaveText(word(lang, "consent.title"));
      // Three lines, each with a mark (an svg) and its words, so they read in grayscale.
      const lines = main.locator("section li");
      await expect(lines).toHaveCount(3);
      for (const line of await lines.all()) await expect(line.locator("svg[aria-hidden=true]")).toHaveCount(1);
      // No fee, no amount, no UPI ID, no receipt: not in the page, not in anything the function sent.
      const html = await page.content();
      expect(html).not.toContain("₹");
      expect(html).not.toContain("okhdfc");
      expect(html).not.toMatch(/total_remaining|upi_id|open_dues|receipt_token/);
      expect(seen.pay).toHaveLength(1);
      expect(main.getByRole("link")).toHaveCount(0);
      // The agree button is at least 60px tall, and the page keeps the language button.
      expect((await box(main.getByRole("button", { name: word(lang, "consent.agree") }))).height).toBeGreaterThanOrEqual(60);
      await expect(main.getByRole("button", { name: { en: "English", hi: "हिन्दी", kn: "ಕನ್ನಡ", te: "తెలుగు" }[lang] })).toBeVisible();
    });
  }

  test("criterion 20: agreeing calls record-consent once with the token and the version it was given, then shows the fee", async ({ page }) => {
    const seen = await stubPayPage(page, {
      pay: (call) => (call === 1 ? notice() : fee()),
      consent: { ...consentOk, delayMs: 600 },
    });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "consent");
    // Two taps in the same instant: the second is ignored even before the page has drawn "Saving…".
    await page.evaluate(() => {
      const agree = [...document.querySelectorAll("main button")].find((b) => b.textContent === "I agree, show the fee") as HTMLButtonElement;
      agree.click();
      agree.click();
    });
    await expect(main.getByRole("button", { name: "Saving…" })).toBeVisible();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.consent).toHaveLength(1);
    expect(JSON.parse(seen.consent[0].postData() ?? "{}")).toEqual({ token: TOKEN, notice_version: "v1" });
    expect(seen.pay).toHaveLength(2);
    await expect(main).toContainText("₹3,400");
  });

  test("criterion 20: a failure keeps the screen and shows nothing of the fee; Try again saves", async ({ page }) => {
    const seen = await stubPayPage(page, {
      pay: (call) => (call === 1 ? notice() : fee()),
      consent: (call) => (call === 1 ? "abort" : consentOk),
    });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(main.getByText("Couldn't save. Check your connection and try again.")).toBeVisible();
    await expect(main).toHaveAttribute("data-state", "consent");
    expect(await page.content()).not.toContain("₹");
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.consent).toHaveLength(2);
  });

  test("criterion 20: a changed notice (409) reads the page again and shows the new notice, which the next agree sends", async ({ page }) => {
    const seen = await stubPayPage(page, {
      pay: (call) => (call === 1 ? notice() : call === 2 ? notice({ notice_version: "v2" }) : fee()),
      consent: (call) => (call === 1 ? { status: 409, body: { code: "stale_notice", notice_version: "v2" } } : consentOk),
    });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect.poll(() => seen.pay.length).toBe(2);
    await expect(main).toHaveAttribute("data-state", "consent");
    await expect(main.getByRole("button", { name: "I agree, show the fee" })).toBeEnabled();
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.consent.map((r) => JSON.parse(r.postData() ?? "{}").notice_version)).toEqual(["v1", "v2"]);
  });

  test("criterion 20: closing the page without agreeing leaves nothing behind (no record-consent call)", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: notice() });
    await page.goto(link());
    await expect(page.locator("main")).toHaveAttribute("data-state", "consent");
    await page.goto("about:blank");
    expect(seen.consent).toHaveLength(0);
  });

  test("criterion 21: a return visit goes straight to the fee, with no consent screen", async ({ page }) => {
    const seen = await openFee(page);
    await expect(page.locator("main")).not.toContainText("Before you see the fee");
    expect(seen.consent).toHaveLength(0);
  });
});

test.describe("the fee page (criteria 22 to 25)", () => {
  test("criterion 22 and 23: the header, the total, one line per open fee, the marks and the words", async ({ page }) => {
    await openFee(page);
    const main = page.locator("main");
    await expect(main).toContainText("Fee request from");
    await expect(main).toContainText("Meena Iyer");
    await expect(main).toContainText("Maths, Science tuition");
    await expect(main).toContainText("for Ravi Kumar");
    await expect(main).toContainText("Total to pay");
    await expect(main.locator(".type-amount")).toHaveText("₹3,400");
    const lines = main.locator("section").first().locator("ul > li");
    await expect(lines).toHaveCount(3);
    // The earlier balance: its words, no date, and the Overdue mark (its stored date is past).
    await expect(lines.nth(0)).toContainText("Earlier balance");
    await expect(lines.nth(0)).toContainText("₹1,000");
    await expect(lines.nth(0)).toContainText("Overdue");
    // September: part paid, late.
    await expect(lines.nth(1)).toContainText("September 2026 fee, due 01 Sep 2026");
    await expect(lines.nth(1)).toContainText("₹200 already paid");
    await expect(lines.nth(1)).toContainText("₹1,000");
    await expect(lines.nth(1).locator("[data-status=overdue]")).toHaveText("Overdue");
    // October: not late yet, so its own words say when, and there is no Overdue mark.
    await expect(lines.nth(2)).toContainText("October 2026 fee, due 20 Oct 2026");
    await expect(lines.nth(2)).toContainText("₹1,400");
    await expect(lines.nth(2).locator("[data-status]")).toHaveCount(0);
    await expect(main).toContainText("Privacy notice");
    await expect(main).toContainText("Are you a tutor too?");
  });

  test("criterion 23: late is by the server's day, not the phone's clock", async ({ page }) => {
    await page.clock.install({ time: new Date("2030-01-01T10:00:00Z") });
    await openFee(page, { today: "2026-09-30" });
    const lines = page.locator("main section").first().locator("ul > li");
    await expect(lines.nth(1).locator("[data-status]")).toHaveCount(1);
  });

  test("criterion 23: a fee due today says so with the Due mark; more than 24 fees say 'and n more' and the headline counts them", async ({ page }) => {
    await openFee(page, { today: "2026-10-20", open_dues_more: 5, total_remaining: 900000 });
    const main = page.locator("main");
    await expect(main.locator("[data-status=due]")).toHaveText("Due today");
    await expect(main).toContainText("and 5 more");
    await expect(main.locator(".type-amount")).toHaveText("₹9,000");
  });

  test("criterion 24: the Pay button is a link to the UPI link, 72px high, blue, with the amount in the label", async ({ page }) => {
    await openFee(page);
    const pay = page.getByRole("link", { name: "Pay ₹3,400 with UPI" });
    await expect(pay).toHaveAttribute("href", PAY_LINK);
    expect((await box(pay)).height).toBeGreaterThanOrEqual(72);
    expect(await pay.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(27, 43, 143)");
    expect(await pay.getAttribute("target")).toBeNull();
  });

  test("criterion 24 and 28: no UPI ID, a total of zero, and a total above the ceiling", async ({ page }) => {
    await openFee(page, { upi_id: null });
    const main = page.locator("main");
    await expect(main).toContainText("Your tutor has not added a UPI ID yet. Ask them for payment details.");
    await expect(main.getByRole("link", { name: /Pay/ })).toHaveCount(0);
    await expect(main).toContainText("₹3,400");
    await expect(main.getByRole("button", { name: "Copy UPI ID" })).toHaveCount(0);

    await page.goto("/en/");
    await openFee(page, { total_remaining: 100_000_001 });
    await expect(main.getByRole("link", { name: /Pay/ })).toHaveCount(0);
    await expect(main).toContainText("Pay ₹10,00,000.01 to this UPI ID in your UPI app.");
    await expect(main).toContainText(UPI_ID);
  });

  test("criterion 28: all paid shows the stamp and the thanks, no Pay and no Copy, and keeps the receipts, the notice link and the footer", async ({ page }) => {
    await openFee(page, { total_remaining: 0, open_dues: [] });
    const main = page.locator("main");
    await expect(main.getByRole("img", { name: "ALL PAID" })).toBeVisible();
    await expect(main).toContainText("Nothing to pay right now. Thank you.");
    await expect(main.getByRole("link", { name: /Pay/ })).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Copy UPI ID" })).toHaveCount(0);
    await expect(main).toContainText("Earlier receipts");
    await expect(main).toContainText("Privacy notice");
    await expect(main).toContainText("Free for tutors. Start in 60 seconds.");
  });

  test("criterion 25 and 26: the notes under the button, and Copy writes exactly the UPI ID and says Copied", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { copied: string[] }).copied = [];
      Object.defineProperty(navigator, "clipboard", { value: { writeText: (value: string) => { (window as unknown as { copied: string[] }).copied.push(value); return Promise.resolve(); } }, configurable: true });
    });
    await openFee(page);
    const main = page.locator("main");
    await expect(main).toContainText(`Your UPI app opens with the amount filled in. It goes straight to ${UPI_ID}.`);
    await expect(main).toContainText("Paid already? Your tutor marks it paid and sends you a receipt.");
    await expect(main).toContainText("UPI app did not open? Use one of these.");
    const copy = main.getByRole("button", { name: "Copy UPI ID" });
    expect((await box(copy)).height).toBeGreaterThanOrEqual(48);
    await copy.click();
    await expect(main.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([UPI_ID]);
    await expect(main.getByRole("button", { name: "Copy UPI ID" })).toBeVisible({ timeout: 4000 });
    // No QR button before Part C.
    await expect(main.getByRole("button", { name: /QR/i })).toHaveCount(0);
  });

  test("criterion 26: with no clipboard the Copy button and the line that points to it are not drawn, and the ID is still text", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }));
    await openFee(page);
    const main = page.locator("main");
    await expect(main.getByRole("button", { name: "Copy UPI ID" })).toHaveCount(0);
    await expect(main).not.toContainText("UPI app did not open?");
    await expect(main).toContainText(UPI_ID);
    await expect(main.getByRole("link", { name: "Pay ₹3,400 with UPI" })).toBeVisible();
  });
});

test.describe("earlier receipts (criterion 27)", () => {
  test("one row per receipt with its month, amount, status line and a View link to /r/{token}", async ({ page }) => {
    await openFee(page);
    const rows = page.locator("main section").nth(1).locator("li");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("August 2026 · ₹1,200");
    await expect(rows.nth(0)).toContainText("PAID 03 SEP 2026 · NO. 198");
    const view = rows.nth(0).getByRole("link", { name: /View/ });
    await expect(view).toHaveAttribute("href", "/r/Rq8mT2vXk4LpN7sYb3WcZd");
    await expect(view).toHaveAttribute("rel", "noopener noreferrer");
    expect(await view.getAttribute("target")).toBeNull();
    expect((await box(rows.nth(0))).height).toBeGreaterThanOrEqual(60);
    await expect(rows.nth(1)).toContainText("Earlier balance · ₹500");
    await expect(rows.nth(1)).toContainText("PART PAID 12 AUG 2026 · NO. 171");
  });

  test("more than 12 say so, and none draws no section", async ({ page }) => {
    await openFee(page, { receipts_more: true });
    await expect(page.locator("main")).toContainText("Showing the latest 12.");
    await page.goto("/en/");
    await openFee(page, { receipts: [] });
    await expect(page.locator("main")).not.toContainText("Earlier receipts");
  });

  test("View opens the receipt page in the same tab", async ({ page }) => {
    await openFee(page);
    await page.route("**/functions/v1/receipt", (route) => route.fulfill({ status: 404, contentType: "application/json", body: '{"code":"not_found"}' }));
    await page.locator("main").getByRole("link", { name: /View/ }).first().click();
    await page.waitForURL("**/r/Rq8mT2vXk4LpN7sYb3WcZd");
    await expect(page.locator("main")).toHaveAttribute("data-state", "not_found");
  });
});

test.describe("language (criterion 29)", () => {
  test("the page opens in the student's language, the button names it, and choosing another changes every word with no new request", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: fee({ language: "hi" }) });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("lang", "hi");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    await expect(main).toContainText(word("hi", "total"));
    await expect(main).toContainText("Meena Iyer");
    const button = main.getByRole("button", { name: "हिन्दी" });
    await button.click();
    const choices = page.getByRole("dialog").getByRole("button");
    await expect(choices).toHaveCount(5); // the four languages and the Close control
    for (const el of await page.getByRole("dialog").locator("li button").all()) expect((await box(el)).height).toBeGreaterThanOrEqual(44);
    await page.getByRole("dialog").getByRole("button", { name: "ಕನ್ನಡ" }).click();
    await expect(main).toHaveAttribute("lang", "kn");
    await expect(main.getByRole("button", { name: "ಕನ್ನಡ" })).toBeVisible();
    // The amount and dates stay 0-9 and the names stay as saved.
    await expect(main).toContainText("₹3,400");
    await expect(main).toContainText("Ravi Kumar");
    expect(await main.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
    expect(seen.pay).toHaveLength(1);
    await page.reload();
    await expect(main).toHaveAttribute("lang", "hi");
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  });

  test("the consent screen keeps the language button and does not reload when it is used", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: notice() });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "English" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "తెలుగు" }).click();
    await expect(main).toHaveAttribute("lang", "te");
    await expect(main).toHaveAttribute("data-state", "consent");
    expect(seen.pay).toHaveLength(1);
  });
});

test.describe("the privacy notice link and the footer (criteria 30 and 31)", () => {
  test("the link reopens the notice with Close and no agree button, with no request, and Close returns", async ({ page }) => {
    const seen = await openFee(page);
    const main = page.locator("main");
    await main.getByRole("button", { name: "Privacy notice" }).click();
    await expect(main).toHaveAttribute("data-state", "notice");
    await expect(main).toContainText("Before you see the fee, a word on privacy.");
    await expect(main.getByRole("button", { name: "I agree, show the fee" })).toHaveCount(0);
    await expect(main).not.toContainText("Asked only once");
    await expect(main).not.toContainText("Read the full notice");
    expect((await box(main.getByRole("button", { name: "Close" }))).height).toBeGreaterThanOrEqual(44);
    await main.getByRole("button", { name: "Close" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.pay).toHaveLength(1);
    expect(seen.consent).toHaveLength(0);
  });

  test("the footer is words only: no link, no referral code", async ({ page }) => {
    await openFee(page);
    const footer = page.locator("main footer");
    await expect(footer).toContainText(brand.name);
    await expect(footer).toContainText("Are you a tutor too?");
    await expect(footer.locator("a")).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("/join/");
  });
});

test.describe("the other states (criterion 32)", () => {
  test("not found shows nothing of the tutor or the child", async ({ page }) => {
    await stubPayPage(page, { pay: { status: 404, body: { code: "not_found" } } });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "not_found");
    await expect(main).toContainText("This link doesn't work. Ask your tutor to send it again.");
    await expect(main).not.toContainText("Meena");
    await expect(main.locator("button")).toHaveCount(0);
  });

  test("too many tries has no Try again", async ({ page }) => {
    await stubPayPage(page, { pay: { status: 429, body: { code: "rate_limited" } } });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "rate_limited");
    await expect(main).toContainText("Too many tries. Please try again in a while.");
    await expect(main.locator("button")).toHaveCount(0);
  });

  test("a server fault and no network show Try again, which asks once more", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: (call) => (call === 1 ? { status: 500, body: { code: "error" } } : call === 2 ? "abort" : fee()) });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "failed");
    await expect(main).toContainText("Couldn't open this page.");
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "failed");
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.pay).toHaveLength(3);
  });

  test("a reply that is not the function's is a failure, not half a page", async ({ page }) => {
    await stubPayPage(page, { pay: fee({ total_remaining: "3400" }) });
    await page.goto(link());
    await expect(page.locator("main")).toHaveAttribute("data-state", "failed");
  });

  for (const lang of ["hi", "kn", "te"] as const) {
    test(`[${lang}] with no page to take the language from, the browser's language is used`, async ({ browser }) => {
      const context = await browser.newContext({ locale: { hi: "hi-IN", kn: "kn-IN", te: "te-IN" }[lang] });
      const page = await context.newPage();
      await stubPayPage(page, { pay: { status: 404, body: { code: "not_found" } } });
      await page.goto(link());
      await expect(page.locator("main")).toContainText(word(lang, "state.notFound"));
      await context.close();
    });
  }
});

test.describe("privacy and read-only (criteria 33 and 42)", () => {
  test("only the two functions and the /r/ links are contacted; the token only in their bodies; no cookie, no storage", async ({ page, context }) => {
    const seen = await stubPayPage(page, { pay: (call) => (call === 1 ? notice() : fee()) });
    await page.goto(link());
    await page.locator("main").getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
    await page.waitForLoadState("networkidle");

    const toFunctionHost = seen.all.filter((r) => new URL(r.url).host === FUNCTION_HOST);
    const posts = toFunctionHost.filter((r) => r.method === "POST");
    expect(posts.map((r) => new URL(r.url).pathname)).toEqual(["/functions/v1/pay-page", "/functions/v1/record-consent", "/functions/v1/pay-page"]);
    expect(toFunctionHost.filter((r) => r.method !== "POST" && r.method !== "OPTIONS")).toEqual([]);
    for (const post of posts) {
      expect(new URL(post.url).search).toBe("");
      expect(post.headers["referer"]).toBeUndefined();
      expect(post.headers["cookie"]).toBeUndefined();
      expect(post.headers["authorization"]).toBeUndefined();
      expect(JSON.parse(post.body ?? "{}").token).toBe(TOKEN);
    }
    // Everything else the page asked for is this site's own files; the token is in none of them.
    const origin = new URL(page.url()).host;
    for (const r of seen.all) expect([origin, FUNCTION_HOST], r.url).toContain(new URL(r.url).host);
    for (const r of seen.all.filter((r) => !r.isDocument && !posts.includes(r))) {
      expect(r.url).not.toContain(TOKEN);
      expect(JSON.stringify(r.headers)).not.toContain(TOKEN);
      expect(r.body ?? "").not.toContain(TOKEN);
    }
    // Not in the title, and no UPI ID, amount or token in the address or history.
    expect(await page.title()).not.toContain(TOKEN);
    expect(await page.content()).not.toContain(TOKEN);
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(2);
    expect(new URL(page.url()).search).toBe("");
    expect(page.url()).not.toContain("okhdfc");
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).toBe("");
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    expect(await page.evaluate(async () => (await indexedDB.databases?.())?.length ?? 0)).toBe(0);
    expect(seen.all.some((r) => /posthog|sentry|analytics|google-analytics/i.test(r.url))).toBe(false);
  });
});

test.describe("one centred column (criterion 35)", () => {
  for (const width of [768, 1024, 1440]) {
    test(`at ${width}px wide the column is at most 28rem, centred, with no tutor navigation`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openFee(page);
      const main = page.locator("main");
      const b = await box(main);
      expect(b.width).toBeLessThanOrEqual(448 + 1);
      expect(Math.abs(b.x + b.width / 2 - width / 2)).toBeLessThanOrEqual(1);
      await expect(page.locator("nav")).toHaveCount(0);
    });
  }
});

test("criterion 36: the consent screen and the fee page show no TODO-translate marker in any language", async ({ page }) => {
  for (const lang of langs) {
    await stubPayPage(page, { pay: (call) => (call % 2 === 1 ? notice({ language: lang }) : fee({ language: lang })) });
    await page.goto(link());
    await expect(page.locator("main")).toHaveAttribute("data-state", "consent");
    expect(await page.evaluate(() => document.documentElement.outerHTML)).not.toContain("TODO-translate");
    await page.goto(link());
    await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
    expect(await page.evaluate(() => document.documentElement.outerHTML)).not.toContain("TODO-translate");
    await page.unrouteAll();
  }
});

test("the focus ring shows on Try again from the keyboard", async ({ page }) => {
  await stubPayPage(page, { pay: { status: 500, body: { code: "error" } } });
  await page.goto(link());
  await expect(page.locator("main")).toHaveAttribute("data-state", "failed");
  await page.keyboard.press("Tab");
  const retry = page.locator("main").getByRole("button");
  await expect(retry).toBeFocused();
  expect(await retry.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
});
