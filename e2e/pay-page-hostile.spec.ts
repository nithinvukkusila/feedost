// Spec R1-9 Part B, criteria 16 to 36 and 42, the ways a parent's phone and the network can go wrong: slow 4G, a call
// that never answers, no network and back, a 429 that carries Retry-After, a consent that fails after the first read, an
// answer with a wrong key or type, markup in a name, a hostile UPI ID, a double tap, an amount at and past the cap, and
// the lateness of a fee around midnight in India under four device time zones. The functions are answered by page.route.
import { expect, test, type Page } from "@playwright/test";
import { box, fontsSettled, messageText as text, sidewaysScroll, textProblems } from "./helpers";
import { feeBody, UPI_ID, TOKEN, consentOk, fee, link, notice, stubPayPage, PAY_URL } from "./pay-page-helpers";

async function openFee(page: Page, change: Record<string, unknown> = {}) {
  const seen = await stubPayPage(page, { pay: fee(change) });
  await page.goto(link());
  await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
  return seen;
}
const lines = (page: Page) => page.locator("main section").first().locator("ul > li");
const month = (i: number) => `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`;
const dueLine = (i: number) => ({ kind: "monthly", month: month(i), due_date: month(i), amount: 100_000, amount_paid: 0, remaining: 100_000 });

test.describe("slow 4G and a call that does not come back", () => {
  test("on slow 4G the shell shows 'Opening your fee request…' and no tutor data until the answer, then the fee", async ({ page }) => {
    test.setTimeout(90_000);
    const cdp = await page.context().newCDPSession(page);
    // "Slow 4G" as Chrome's own preset: 1.6 Mbit/s down, 750 kbit/s up, 150 ms of latency.
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await stubPayPage(page, { pay: { ...fee(), delayMs: 3000 } });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toContainText("Opening your fee request…");
    await expect(main).not.toContainText("Meena");
    await expect(main).not.toContainText("₹");
    await expect(main).toHaveAttribute("data-state", "fee", { timeout: 60_000 });
    await expect(main).toContainText("₹3,400");
  });

  test("a call that never answers gives up after 15 seconds with Try again, and Try again opens the page", async ({ page }) => {
    await page.clock.install();
    const seen = await stubPayPage(page, { pay: (call) => (call === 1 ? "never" : fee()) });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "loading");
    await page.clock.runFor(14_000);
    await expect(main).toHaveAttribute("data-state", "loading");
    await page.clock.runFor(2_000);
    await expect(main).toHaveAttribute("data-state", "failed");
    await expect(main).not.toContainText("Meena");
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.pay).toHaveLength(2);
  });

  test("offline: the failure is shown, Try again while still offline fails again, back online it opens the page", async ({ page, context }) => {
    const seen = await stubPayPage(page, { pay: (call) => (call === 1 ? "abort" : fee()) });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "failed");
    // Really offline: no stub, so the request goes to the network and the browser refuses it.
    await page.unroute(PAY_URL);
    await context.setOffline(true);
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "failed");
    await expect(main).toContainText("Couldn't open this page.");
    expect(await page.content()).not.toContain("₹");
    await context.setOffline(false);
    const again = await stubPayPage(page, { pay: fee() });
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(again.pay).toHaveLength(1);
    expect(seen.pay).toHaveLength(1);
  });

  test("the network goes while the parent is on the consent screen: Agree says it could not save, back online it saves once more", async ({ page, context }) => {
    const seen = await stubPayPage(page, { pay: (call) => (call === 1 ? notice() : fee()) });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "consent");
    await page.unroute("**/functions/v1/record-consent");
    await context.setOffline(true);
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(main.getByText("Couldn't save. Check your connection and try again.")).toBeVisible();
    expect(await page.content()).not.toContain("₹");
    await context.setOffline(false);
    const back = await stubPayPage(page, { pay: fee(), consent: consentOk });
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(back.consent).toHaveLength(1);
    expect(seen.consent).toHaveLength(0);
  });

  test("the consent was saved but the read after it fails: Try again reads the page and does not ask for consent a second time", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: (call) => (call === 1 ? notice() : call === 2 ? "abort" : fee()) });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(main).toHaveAttribute("data-state", "failed");
    await expect(main).not.toContainText("Meena");
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.consent).toHaveLength(1);
    expect(seen.pay).toHaveLength(3);
  });
});

test.describe("429, 404 and faults on both calls", () => {
  test("429 with Retry-After says 'Too many tries', shows no button, never retries by itself and never shows the header's number", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: { status: 429, headers: { "retry-after": "37" }, body: { code: "rate_limited" } } });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "rate_limited");
    await expect(main).toContainText("Too many tries. Please try again in a while.");
    await expect(main).not.toContainText("37");
    await expect(main.locator("button, a")).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(seen.pay).toHaveLength(1);
  });

  test("429 on record-consent ends in 'Too many tries' with nothing of the fee, and sends no second call", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: notice(), consent: { status: 429, headers: { "retry-after": "5" }, body: { code: "rate_limited" } } });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(main).toHaveAttribute("data-state", "rate_limited");
    expect(await page.content()).not.toContain("₹");
    await expect(main).not.toContainText("Ravi");
    expect(seen.consent).toHaveLength(1);
    expect(seen.pay).toHaveLength(1);
  });

  test("404 on record-consent (the link was revoked while the parent read) shows 'This link doesn't work' and none of the child's data", async ({ page }) => {
    await stubPayPage(page, { pay: notice(), consent: { status: 404, body: { code: "not_found" } } });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(main).toHaveAttribute("data-state", "not_found");
    await expect(main).not.toContainText("Ravi");
    await expect(main).not.toContainText("Meena");
  });

  test("a 500 on record-consent keeps the screen with the sentence and Try again, and a second Agree sends again", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: (call) => (call === 1 ? notice() : fee()), consent: (call) => (call === 1 ? { status: 500, body: { code: "error" } } : consentOk) });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(main.getByText("Couldn't save. Check your connection and try again.")).toBeVisible();
    await main.getByRole("button", { name: "Try again" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.consent).toHaveLength(2);
  });

  test("the read after a saved consent says 404: not found, with nothing of the tutor or the child", async ({ page }) => {
    await stubPayPage(page, { pay: (call) => (call === 1 ? notice() : { status: 404, body: { code: "not_found" } }) });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(main).toHaveAttribute("data-state", "not_found");
    await expect(main).not.toContainText("Meena");
    await expect(main).not.toContainText("Ravi");
  });

  test("the read after a saved consent still asks for consent: the screen comes back usable, and a second Agree is sent", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: (call) => (call <= 2 ? notice() : fee()) });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect.poll(() => seen.pay.length).toBe(2);
    const agree = main.getByRole("button", { name: "I agree, show the fee" });
    await expect(agree).toBeEnabled();
    await agree.click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.consent).toHaveLength(2);
  });

  test("409 whose body has no usable version still re-reads, and shows the page's own version", async ({ page }) => {
    const seen = await stubPayPage(page, {
      pay: (call) => (call === 1 ? notice() : call === 2 ? notice({ notice_version: "v3" }) : fee()),
      consent: (call) => (call === 1 ? { status: 409, body: { code: "stale_notice", notice_version: "<b>x</b>" } } : consentOk),
    });
    await page.goto(link());
    const main = page.locator("main");
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect.poll(() => seen.pay.length).toBe(2);
    await main.getByRole("button", { name: "I agree, show the fee" }).click();
    await expect(main).toHaveAttribute("data-state", "fee");
    expect(seen.consent.map((r) => JSON.parse(r.postData() ?? "{}").notice_version)).toEqual(["v1", "v3"]);
  });
});

test.describe("an answer the validator must refuse, or only partly believe", () => {
  const bad: [string, Record<string, unknown>][] = [
    ["a total as text", { total_remaining: "340000" }],
    ["a total with paise as a float", { total_remaining: 3400.5 }],
    ["a negative total", { total_remaining: -100 }],
    ["a missing list of fees", { open_dues: undefined }],
    ["fees that are an object", { open_dues: { 0: feeBody.open_dues[0] } }],
    ["a fee with a float amount", { open_dues: [{ ...feeBody.open_dues[0], remaining: 100.25 }] }],
    ["a fee with an impossible date", { open_dues: [{ ...feeBody.open_dues[0], due_date: "2026-02-30" }] }],
    ["a day in the wrong shape", { today: "12/10/2026" }],
    ["a language we do not have", { language: "fr" }],
    ["a consent flag that is text", { consent_needed: "false" }],
    ["a UPI ID that is a number", { upi_id: 9876543210 }],
    ["a receipt with a link in place of a token", { receipts: [{ ...feeBody.receipts[0], receipt_token: "https://evil.example/phish/x" }] }],
    ["a version with markup", { notice_version: "<b>v1</b>" }],
  ];
  for (const [name, change] of bad) {
    test(`${name} is a failure with Try again, never half a page`, async ({ page }) => {
      await stubPayPage(page, { pay: fee(change) });
      await page.goto(link());
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "failed");
      await expect(main).toContainText("Couldn't open this page.");
      await expect(main).not.toContainText("Meena");
      await expect(main).not.toContainText("Ravi");
      await expect(main).not.toContainText("₹");
      await expect(main.getByRole("button", { name: "Try again" })).toBeVisible();
    });
  }

  test("an answer that is an array, plain text or empty is a failure", async ({ page }) => {
    for (const body of [[], "ok", null]) {
      await page.unrouteAll();
      await stubPayPage(page, { pay: { status: 200, body } });
      await page.goto(link());
      await expect(page.locator("main")).toHaveAttribute("data-state", "failed");
    }
  });

  test("unknown keys on a fee page are not shown, and a pay_token or html key never reaches the page", async ({ page }) => {
    await openFee(page, { pay_token: "SECRET-PAY-TOKEN-0123456789", html: "<b id=injected>bold</b>", open_dues: feeBody.open_dues.map((d) => ({ ...d, note: "NOTE-ONLY-IN-ANSWER" })) });
    const html = await page.content();
    expect(html).not.toContain("SECRET-PAY-TOKEN");
    expect(html).not.toContain("NOTE-ONLY-IN-ANSWER");
    await expect(page.locator("#injected")).toHaveCount(0);
  });

  test("a consent-needed answer that also carries money, a UPI ID and receipts shows none of it", async ({ page }) => {
    await stubPayPage(page, { pay: notice({ upi_id: UPI_ID, total_remaining: 777700, open_dues: feeBody.open_dues, receipts: feeBody.receipts, today: "2026-10-12" }) });
    await page.goto(link());
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "consent");
    const html = await page.content();
    for (const leak of ["₹", "okhdfc", "7,777", "7777", "Rq8mT2vXk4LpN7sYb3WcZd"]) expect(html, leak).not.toContain(leak);
    // The page's own words ship in every language, but no fee line, receipt row or amount is drawn.
    await expect(main).not.toContainText("Earlier balance");
    await expect(main).not.toContainText("Earlier receipts");
    await expect(main).not.toContainText("Total to pay");
  });

  test("markup in a tutor, student or subject name is drawn as text and runs nothing", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const tutor = `<img src=x onerror="window.__x=1">`;
    const student = `"><script>window.__y=1</script>`;
    await openFee(page, { tutor_name: tutor, student_name: student, tutor_subjects: ["<b>Maths</b>"] });
    const main = page.locator("main");
    await expect(main).toContainText(tutor);
    await expect(main).toContainText(student);
    await expect(main.locator("img[src=x], script, b")).toHaveCount(0);
    expect(await page.evaluate(() => [(window as unknown as { __x?: number }).__x, (window as unknown as { __y?: number }).__y])).toEqual([undefined, undefined]);
    expect(errors).toEqual([]);
  });
});

test.describe("the tokens a phone can open", () => {
  test("a query string and a fragment after the token do not stop the page, and the token is sent alone in the body", async ({ page }) => {
    const seen = await stubPayPage(page, { pay: fee() });
    await page.goto(`${link()}?utm_source=whatsapp&x=1#top`);
    await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
    expect(JSON.parse(seen.pay[0].postData() ?? "{}")).toEqual({ token: TOKEN });
    expect(new URL(seen.pay[0].url()).search).toBe("");
  });

  test("a 22-character token with _ and - and capitals is asked for as it is", async ({ page }) => {
    const token = "Ab_-Cd_-Ef_-Gh_-Ij_-Kl";
    const seen = await stubPayPage(page, { pay: fee() });
    await page.goto(`/p/${token}/`);
    await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
    expect(JSON.parse(seen.pay[0].postData() ?? "{}")).toEqual({ token });
  });

  for (const [name, path] of [
    ["a token with an encoded space on its end", `/p/${TOKEN}%20/`],
    ["a token of 129 characters", `/p/${"a".repeat(129)}/`],
    ["a token with a dot", `/p/${TOKEN.slice(1)}./`],
    ["a token made of Devanagari letters", `/p/${encodeURIComponent("अआइईउऊऋएऐओऔकखगघचछजझटठडढ")}/`],
  ] as const) {
    test(`${name} is 'not found' with no request`, async ({ page }) => {
      const seen = await stubPayPage(page, { pay: fee() });
      await page.goto(path);
      await expect(page.locator("main")).toHaveAttribute("data-state", "not_found");
      await expect(page.locator("main")).toContainText("This link doesn't work. Ask your tutor to send it again.");
      expect(seen.pay).toHaveLength(0);
    });
  }

  test("a token that belongs to another tutor, a deleted student and an expired link all get the same 404 words and no data", async ({ page }) => {
    for (const token of ["OtherTutorsTokenAbcdEf1", "DeletedStudentTokenAbcd2", "ExpiredLinkTokenAbcdefg3"]) {
      await page.unrouteAll();
      const seen = await stubPayPage(page, { pay: { status: 404, body: { code: "not_found" } } });
      await page.goto(`/p/${token}/`);
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "not_found");
      await expect(main).toContainText("This link doesn't work. Ask your tutor to send it again.");
      expect(seen.pay).toHaveLength(1);
      expect(await page.content()).not.toMatch(/Meena|Ravi|₹/);
    }
  });
});

test.describe("what a double tap does", () => {
  test("two quick taps on Pay both go to exactly the same UPI link, and the page asks for nothing more", async ({ page }) => {
    const seen = await openFee(page);
    // Stop the browser leaving for the UPI app, and record what it was told to open.
    await page.evaluate(() => {
      const opened: string[] = [];
      (window as unknown as { opened: string[] }).opened = opened;
      document.addEventListener("click", (event) => {
        const anchor = (event.target as Element).closest("a");
        if (anchor?.href.startsWith("upi://")) {
          opened.push(anchor.getAttribute("href") ?? "");
          event.preventDefault();
        }
      });
    });
    const pay = page.getByRole("link", { name: "Pay ₹3,400 with UPI" });
    await pay.dblclick();
    await expect(pay).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual([
      `upi://pay?pa=${UPI_ID}&pn=Meena%20Iyer&am=3400.00&cu=INR&tn=Fees%20due%20Ravi`,
      `upi://pay?pa=${UPI_ID}&pn=Meena%20Iyer&am=3400.00&cu=INR&tn=Fees%20due%20Ravi`,
    ]);
    await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
    expect(seen.pay).toHaveLength(1);
    expect(seen.consent).toHaveLength(0);
  });

  test("a real tap on Pay changes nothing on the page: it cannot say 'paid', 'done' or 'success' about a payment it has not seen", async ({ page }) => {
    await openFee(page);
    await page.evaluate(() => document.addEventListener("click", (e) => (e.target as Element).closest("a")?.href.startsWith("upi://") && e.preventDefault()));
    const main = page.locator("main");
    const before = await main.innerText();
    await page.getByRole("link", { name: "Pay ₹3,400 with UPI" }).click();
    await page.waitForTimeout(300);
    expect(await main.innerText()).toBe(before);
    expect(before).not.toMatch(/success|\bdone\b|payment (received|complete)|you have paid/i);
  });

  test("two quick taps on Copy write the UPI ID each time, and the page shows Copied", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { copied: string[] }).copied = [];
      Object.defineProperty(navigator, "clipboard", { value: { writeText: (v: string) => ((window as unknown as { copied: string[] }).copied.push(v), Promise.resolve()) }, configurable: true });
    });
    await openFee(page);
    await page.getByRole("button", { name: "Copy UPI ID" }).dblclick();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { copied: string[] }).copied);
    expect(copied.length).toBeGreaterThan(0);
    expect(new Set(copied)).toEqual(new Set([UPI_ID]));
  });

  test("a clipboard that refuses the write leaves 'Copy UPI ID' as it was, with no error on the page", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new DOMException("denied", "NotAllowedError")) }, configurable: true }));
    await openFee(page);
    await page.getByRole("button", { name: "Copy UPI ID" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole("button", { name: "Copied" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy UPI ID" })).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("what is owed: an earlier balance, many fees, the cap", () => {
  test("an earlier balance alone: one line with no date, the note says 'Fee balance', and Pay asks for that balance", async ({ page }) => {
    await openFee(page, { open_dues: [feeBody.open_dues[0]], total_remaining: 100_000, receipts: [] });
    const main = page.locator("main");
    await expect(lines(page)).toHaveCount(1);
    await expect(lines(page).first()).toContainText("Earlier balance");
    await expect(lines(page).first()).not.toContainText(/due \d/);
    await expect(lines(page).first()).not.toContainText("2026");
    await expect(main.locator(".type-amount")).toHaveText("₹1,000");
    await expect(main.getByRole("link", { name: "Pay ₹1,000 with UPI" })).toHaveAttribute("href", `upi://pay?pa=${UPI_ID}&pn=Meena%20Iyer&am=1000.00&cu=INR&tn=Fee%20balance%20Ravi`);
  });

  test("an earlier balance that is not late yet shows its Due mark, with the date and without the word 'Earlier balance' lost", async ({ page }) => {
    await openFee(page, { today: "2026-07-01", open_dues: [feeBody.open_dues[0]], total_remaining: 100_000 });
    await expect(lines(page).first()).toContainText("Earlier balance");
    await expect(lines(page).first().locator("[data-status=overdue]")).toHaveCount(0);
  });

  test("exactly 24 open fees show 24 lines and no 'more' line; 24 and one more says 'and 1 more' and asks for the whole total", async ({ page }) => {
    const dues = Array.from({ length: 24 }, (_, i) => dueLine(i));
    await openFee(page, { open_dues: dues, open_dues_more: 0, total_remaining: 2_400_000 });
    await expect(lines(page)).toHaveCount(24);
    await expect(page.locator("main")).not.toContainText(/and \d+ more/);
    await expect(page.getByRole("link", { name: "Pay ₹24,000 with UPI" })).toHaveAttribute("href", `upi://pay?pa=${UPI_ID}&pn=Meena%20Iyer&am=24000.00&cu=INR&tn=Fees%20due%20Ravi`);
    await page.goto("/en/");
    await openFee(page, { open_dues: dues, open_dues_more: 1, total_remaining: 2_500_000 });
    // 24 fee lines, then the "and 1 more" line (the last line of the same list).
    await expect(lines(page)).toHaveCount(25);
    await expect(lines(page).last()).toHaveText("and 1 more");
    await expect(lines(page).nth(23)).not.toContainText("more");
    await expect(page.locator("main .type-amount")).toHaveText("₹25,000");
    await expect(page.getByRole("link", { name: "Pay ₹25,000 with UPI" })).toHaveAttribute("href", /am=25000\.00&/);
  });

  test("exactly ₹10,00,000 still has the Pay button; one paisa more has the plain UPI ID and Copy but no Pay link", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { copied: string[] }).copied = [];
      Object.defineProperty(navigator, "clipboard", { value: { writeText: (v: string) => ((window as unknown as { copied: string[] }).copied.push(v), Promise.resolve()) }, configurable: true });
    });
    await openFee(page, { total_remaining: 100_000_000 });
    await expect(page.locator("main .type-amount")).toHaveText("₹10,00,000");
    await expect(page.getByRole("link", { name: "Pay ₹10,00,000 with UPI" })).toHaveAttribute("href", /&am=1000000\.00&cu=INR&/);
    await page.goto("/en/");
    await openFee(page, { total_remaining: 100_000_001 });
    const main = page.locator("main");
    await expect(main.locator('a[href^="upi://"]')).toHaveCount(0);
    await expect(main).toContainText(`Pay ₹10,00,000.01 to this UPI ID in your UPI app.`);
    await main.getByRole("button", { name: "Copy UPI ID" }).click();
    await expect(main.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([UPI_ID]);
  });

  test("a total of ₹2,20,00,000 (22 fees at the cap) is the headline in full, with no Pay link and no sideways scroll", async ({ page }) => {
    await openFee(page, { total_remaining: 2_200_000_000, open_dues_more: 5 });
    const main = page.locator("main");
    await expect(main.locator(".type-amount")).toHaveText("₹2,20,00,000");
    expect(await main.locator(".type-amount").evaluate((el) => el.scrollWidth <= el.parentElement!.clientWidth + 1)).toBe(true);
    await expect(main.locator('a[href^="upi://"]')).toHaveCount(0);
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("a hostile UPI ID gets no Pay link and no Copy button, and is not written into any link", async ({ page }) => {
    await openFee(page, { upi_id: "evil@okhdfc&am=1&pa=thief@ok" });
    const main = page.locator("main");
    await expect(main.locator('a[href^="upi://"]')).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Copy UPI ID" })).toHaveCount(0);
    await expect(main).toContainText("Your tutor has not added a UPI ID yet.");
    expect(await page.content()).not.toContain("thief@ok");
  });

  test("the Pay link is exactly the encoding of a hard tutor name and the page's own UPI ID", async ({ page }) => {
    for (const name of ["Meena & Sons #1 ?x=1 100%", "मीना अय्यर ट्यूशन", "మీనా అయ్యర్", "😀 Tutor + Co"]) {
      await page.unrouteAll();
      await openFee(page, { tutor_name: name });
      const expected = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(name)}&am=3400.00&cu=INR&tn=Fees%20due%20Ravi`;
      await expect(page.locator('main a[href^="upi://"]')).toHaveAttribute("href", expected);
    }
  });

  test("the language button changes the words of the Pay button and nothing in its link", async ({ page }) => {
    await openFee(page);
    const pay = page.locator('main a[href^="upi://"]');
    const href = await pay.getAttribute("href");
    for (const [lang, own] of [["hi", "हिन्दी"], ["kn", "ಕನ್ನಡ"], ["te", "తెలుగు"], ["en", "English"]] as const) {
      await page.locator("main header button, main button").filter({ hasText: /English|हिन्दी|ಕನ್ನಡ|తెలుగు/ }).first().click();
      await page.getByRole("dialog").getByRole("button", { name: own }).click();
      await expect(page.locator("main")).toHaveAttribute("lang", lang);
      await expect(pay).toHaveText(text(lang, "payPage.pay").replace("{amount}", "₹3,400"));
      await expect(pay).toHaveAttribute("href", href!);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
    }
  });
});

// The server's day decides what is late. The phone's zone and clock must not matter, even across midnight in India.
for (const timezoneId of ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Kiritimati"]) {
  test.describe(`lateness with the phone in ${timezoneId}`, () => {
    test.use({ timezoneId });
    const dues = [
      { kind: "monthly", month: "2026-08-01", due_date: "2026-10-11", amount: 100_000, amount_paid: 0, remaining: 100_000 },
      { kind: "monthly", month: "2026-09-01", due_date: "2026-10-12", amount: 100_000, amount_paid: 0, remaining: 100_000 },
      { kind: "monthly", month: "2026-10-01", due_date: "2026-10-13", amount: 100_000, amount_paid: 0, remaining: 100_000 },
    ];
    const receipts = [{ receipt_no: 7, receipt_token: "Rq8mT2vXk4LpN7sYb3WcZd", month: "2026-09-01", amount: 100_000, paid_on: "2026-10-01", balance_after: 0 }];

    for (const [label, instant] of [
      ["one second before midnight in India", "2026-10-12T18:29:59Z"],
      ["one second after midnight in India", "2026-10-12T18:30:01Z"],
    ] as const) {
      test(`${label}: yesterday is Overdue, the server's today is Due today, tomorrow has no mark, and dates are not shifted`, async ({ page }) => {
        await page.clock.install({ time: new Date(instant) });
        await openFee(page, { today: "2026-10-12", open_dues: dues, total_remaining: 300_000, receipts });
        await expect(lines(page)).toHaveCount(3);
        await expect(lines(page).nth(0)).toContainText("August 2026 fee, due 11 Oct 2026");
        await expect(lines(page).nth(0).locator("[data-status=overdue]")).toHaveText("Overdue");
        await expect(lines(page).nth(1)).toContainText("September 2026 fee, due 12 Oct 2026");
        await expect(lines(page).nth(1).locator("[data-status=due]")).toHaveText("Due today");
        await expect(lines(page).nth(2)).toContainText("October 2026 fee, due 13 Oct 2026");
        await expect(lines(page).nth(2).locator("[data-status]")).toHaveCount(0);
        await expect(page.locator("main")).toContainText("PAID 01 OCT 2026 · NO. 7");
        // Minutes pass on the phone across India's midnight: nothing on the page moves without a new answer from the server.
        await page.clock.runFor(120_000);
        await expect(lines(page).nth(1).locator("[data-status=due]")).toHaveText("Due today");
        await expect(lines(page).nth(2).locator("[data-status]")).toHaveCount(0);
      });
    }

    test("when the server's day moves on, the next read moves the marks and nothing else decides", async ({ page }) => {
      await page.clock.install({ time: new Date("2026-10-12T10:00:00Z") });
      const seen = await stubPayPage(page, { pay: (call) => fee({ today: call === 1 ? "2026-10-12" : "2026-10-13", open_dues: dues, total_remaining: 300_000, receipts }) });
      await page.goto(link());
      await expect(lines(page).nth(1).locator("[data-status=due]")).toHaveText("Due today");
      await page.reload();
      await expect(lines(page).nth(1).locator("[data-status=overdue]")).toHaveText("Overdue");
      await expect(lines(page).nth(2).locator("[data-status=due]")).toHaveText("Due today");
      expect(seen.pay).toHaveLength(2);
    });

    test("a phone clock in 2030, or in 2001, makes no fee late or early on its own", async ({ page }) => {
      for (const when of ["2030-01-01T10:00:00Z", "2001-01-01T10:00:00Z"]) {
        await page.unrouteAll();
        await page.clock.install({ time: new Date(when) });
        await openFee(page, { today: "2026-07-01", open_dues: dues, total_remaining: 300_000, receipts: [] });
        await expect(page.locator("main [data-status]")).toHaveCount(0);
        await page.goto("/en/");
      }
    });
  });
}

/** Text that sits on top of a control it is not part of: what a parent would call "the name runs under the button". */
const textOverControls = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    const controls = [...document.querySelectorAll("main a, main button")].filter((el) => (el as HTMLElement).offsetParent !== null);
    const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!(node.textContent ?? "").trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const control of controls) {
        if (control.contains(node)) continue;
        const c = control.getBoundingClientRect();
        for (const r of range.getClientRects()) {
          const w = Math.min(r.right, c.right) - Math.max(r.left, c.left);
          const h = Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top);
          if (w > 1 && h > 1) out.push(`${(node.textContent ?? "").trim().slice(0, 30)} over ${(control.textContent ?? "").trim().slice(0, 20)}`);
        }
      }
    }
    return out;
  });

// Long names with spaces in the scripts, large text, 360px: the places a translated page grows.
const long = {
  hi: { tutor: "श्रीमती मीनाक्षी सुंदरराजन अय्यंगार गणित एवं विज्ञान शिक्षण केंद्र", student: "अभिषेकनन्दन वेंकटरमणन सुब्रमण्यम शर्मा", subjects: ["संस्कृत और वैदिक मंत्रोच्चारण", "maths"] },
  kn: { tutor: "ಶ್ರೀಮತಿ ಮೀನಾಕ್ಷಿ ಸುಂದರರಾಜನ್ ಅಯ್ಯಂಗಾರ್ ಗಣಿತ ಮತ್ತು ವಿಜ್ಞಾನ ಬೋಧನಾ ಕೇಂದ್ರ", student: "ಲಕ್ಷ್ಮೀನರಸಿಂಹಮೂರ್ತಿ ವೆಂಕಟರಾಮಯ್ಯ ಸುಬ್ರಹ್ಮಣ್ಯ", subjects: ["ಸಂಸ್ಕೃತ ಮತ್ತು ವೈದಿಕ ಮಂತ್ರೋಚ್ಚಾರಣೆ", "maths"] },
  te: { tutor: "శ్రీమతి మీనాక్షి సుందరరాజన్ అయ్యంగార్ గణితం మరియు విజ్ఞాన బోధనా కేంద్రం", student: "లక్ష్మీనరసింహమూర్తి వెంకటరామయ్య సుబ్రహ్మణ్యం", subjects: ["సంస్కృతం మరియు వైదిక మంత్రోచ్చారణ", "maths"] },
} as const;
for (const lang of ["hi", "kn", "te"] as const) {
  test(`[${lang}] long names with spaces and a long subject at 360px: the fee page and the consent screen at 100%, 130% and 200% text`, async ({ page }) => {
    test.setTimeout(120_000);
    const names = { tutor_name: long[lang].tutor, student_name: long[lang].student, tutor_subjects: long[lang].subjects, language: lang };
    for (const [kind, answer] of [["fee", fee(names)], ["consent", notice(names)]] as const) {
      await page.unrouteAll();
      await stubPayPage(page, { pay: answer });
      await page.goto(link());
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", kind);
      await fontsSettled(page);
      for (const size of ["100%", "130%", "200%"]) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        await fontsSettled(page);
        expect(await sidewaysScroll(page), `${kind} sideways scroll at ${size}`).toBe(0);
        for (const el of await main.locator("a:visible, button:visible").all()) expect((await box(el)).height, `${kind} control at ${size}`).toBeGreaterThanOrEqual(44);
        if (size !== "200%") expect(await textProblems(page, "main"), `${kind} text problems at ${size}`).toEqual([]);
        else expect(await textOverControls(page), `${kind} text over a control at ${size}`).toEqual([]);
      }
      await expect(main).toContainText(long[lang].tutor);
      await expect(main).toContainText(long[lang].student);
    }
  });
}

// R1-9B-1: at the largest text, a long tutor name in Kannada or Telugu is wider than its column (the language button takes
// the rest of the row), so criterion 34's "no text problems" fails at 200% for it. Hindi passes. See the report.
for (const lang of ["hi", "kn", "te"] as const) {
  test(`[${lang}] a long tutor name leaves no text problem at 200% text (criterion 34)`, async ({ page }) => {
    await stubPayPage(page, { pay: fee({ tutor_name: long[lang].tutor, student_name: long[lang].student, tutor_subjects: long[lang].subjects, language: lang }) });
    await page.goto(link());
    await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
    await fontsSettled(page);
    await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
    await fontsSettled(page);
    expect(await textProblems(page, "main")).toEqual([]);
  });
}
