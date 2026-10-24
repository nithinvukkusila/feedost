// Spec R1-10 Part C, criteria 30 to 39 and 42: the parent's "I've paid" button and claim sheet on /p/{token}, with
// `pay-page`, `record-consent` and `submit-claim` answered by page.route (e2e/pay-page-helpers.ts). The layout at 360px
// and large text in four languages (criterion 40) is in pay-page-layout.spec.ts; English only on /p/ itself is in
// parent-english.spec.ts.
import { expect, test, type Page } from "@playwright/test";
import { box, shadow } from "./helpers";
import { FUNCTION_HOST, TOKEN, claimAnswer, fee, link, notice, pendingClaim, stubPayPage, type Answer } from "./pay-page-helpers";

const REF = "628104739915";
const REF_LABEL = "UPI reference number · 12 digits";

async function openFee(page: Page, answers: { pay?: Answer; claim?: Answer } = {}) {
  const seen = await stubPayPage(page, { pay: answers.pay ?? fee(), claim: answers.claim });
  await page.goto(link());
  await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
  return seen;
}

async function openSheet(page: Page) {
  await page.locator("main").getByRole("button", { name: "I've paid" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  return sheet;
}

const field = (page: Page) => page.getByRole("dialog").getByLabel(REF_LABEL);
const sendButton = (page: Page) => page.getByRole("dialog").getByRole("button", { name: /^(Send to|Sending)/ });

test.describe("the button (criteria 30, 37 and 38)", () => {
  test("after consent, with something owed: 'Paid already? Tell {tutor}.' and a 48px outline button below Pay and the fallbacks", async ({ page }) => {
    await openFee(page);
    const main = page.locator("main");
    await expect(main).toContainText("Paid already? Tell Meena Iyer.");
    const button = main.getByRole("button", { name: "I've paid" });
    expect((await box(button)).height).toBeGreaterThanOrEqual(48);
    // Outline: the slip colour with the ink border, never blue (that is for paying) or black.
    expect(await button.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(253, 246, 216)");
    expect(await shadow(button)).not.toBe("none");
    // Below the Pay button and below the Copy fallback.
    const pay = await box(main.getByRole("link", { name: "Pay ₹3,400 with UPI" }));
    const copy = await box(main.getByRole("button", { name: "Copy UPI ID" }));
    const mine = await box(button);
    expect(mine.y).toBeGreaterThan(pay.y + pay.height);
    expect(mine.y).toBeGreaterThan(copy.y + copy.height);
  });

  test("'your tutor' when the tutor has no name", async ({ page }) => {
    await openFee(page, { pay: fee({ tutor_name: null }) });
    await expect(page.locator("main")).toContainText("Paid already? Tell your tutor.");
  });

  test("not drawn when all is paid, nor before consent", async ({ page }) => {
    await openFee(page, { pay: fee({ total_remaining: 0, open_dues: [] }) });
    await expect(page.locator("main").getByRole("button", { name: "I've paid" })).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("Paid already?");
    await page.unrouteAll();
    await stubPayPage(page, { pay: notice() });
    await page.goto(link());
    await expect(page.locator("main")).toHaveAttribute("data-state", "consent");
    await expect(page.locator("main").getByRole("button", { name: "I've paid" })).toHaveCount(0);
  });

  test("while a claim waits, the note replaces it and the Pay button stays (criterion 38)", async ({ page }) => {
    await openFee(page, { pay: fee({ pending_claim: { amount: 340000, submitted_on: "2026-10-11" } }) });
    const main = page.locator("main");
    await expect(main.getByRole("button", { name: "I've paid" })).toHaveCount(0);
    await expect(main).not.toContainText("Paid already?");
    const note = main.locator("[data-claim=pending]");
    await expect(note).toHaveText("You told Meena Iyer on 11 Oct 2026 that you paid ₹3,400. She will confirm it.");
    // The amount in the mono face, 0-9 digits.
    const amount = note.locator('span[translate="no"]', { hasText: "₹3,400" });
    expect(await amount.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/DM Mono|dm_mono|dmMono/i);
    await expect(main.getByRole("link", { name: "Pay ₹3,400 with UPI" })).toBeVisible();
  });

  test("when the tutor has handled it, the note is gone on the next load: confirmed shows the receipt, rejected the fee", async ({ page }) => {
    // Confirmed: no pending claim, the fee paid, a receipt listed. Rejected: no pending claim, the fee still owed.
    await openFee(page, { pay: fee({ pending_claim: null, total_remaining: 0, open_dues: [] }) });
    await expect(page.locator("main [data-claim=pending]")).toHaveCount(0);
    await expect(page.locator("main")).toContainText("Earlier receipts");
    await page.unrouteAll();
    await openFee(page, { pay: fee({ pending_claim: null }) });
    await expect(page.locator("main [data-claim=pending]")).toHaveCount(0);
    await expect(page.locator("main").getByRole("button", { name: "I've paid" })).toBeVisible();
  });
});

test.describe("the sheet (criteria 31 to 33, 42)", () => {
  test("opens with the header, the headline, the title, the help line and Close, and asks no function anything", async ({ page }) => {
    const seen = await openFee(page);
    const before = seen.all.length;
    const sheet = await openSheet(page);
    await expect(sheet).toContainText("Ravi Kumar · all open fees");
    await expect(sheet).toContainText("₹3,400 to Meena Iyer");
    await expect(sheet.getByRole("heading", { name: "Paid already? Tell Meena Iyer." })).toBeVisible();
    await expect(sheet).toContainText("Give Meena Iyer one proof so she can match it. Your receipt comes once she confirms.");
    await expect(sheet).toContainText("Only Meena Iyer can see it.");
    const close = sheet.getByRole("button", { name: "Close" });
    expect((await box(close)).height).toBeGreaterThanOrEqual(44);
    // Opening fetched only the sheet's own code from this site: no function call.
    const opened = seen.all.slice(before);
    expect(opened.filter((r) => new URL(r.url).host === FUNCTION_HOST)).toEqual([]);
    expect(seen.pay).toHaveLength(1);
    expect(seen.claim).toHaveLength(0);
    // The keypad opens on the field.
    await expect(field(page)).toBeFocused();
    await close.click();
    await expect(sheet).toBeHidden();
    await expect(page.locator("main").getByRole("button", { name: "I've paid" })).toBeFocused();
  });

  test("the sheet's code is loaded when the button is tapped, not with the page (criterion 42)", async ({ page }) => {
    const seen = await openFee(page);
    await page.waitForLoadState("networkidle");
    const scriptsBefore = seen.all.filter((r) => r.url.endsWith(".js")).map((r) => r.url);
    await openSheet(page);
    const scriptsAfter = seen.all.filter((r) => r.url.endsWith(".js")).map((r) => r.url);
    const added = scriptsAfter.filter((url) => !scriptsBefore.includes(url));
    expect(added.length, "a chunk is fetched on tap").toBeGreaterThan(0);
    for (const url of added) expect(new URL(url).host).toBe(new URL(page.url()).host);
  });

  test("names the month for one fee", async ({ page }) => {
    await openFee(page, { pay: fee({ total_remaining: 140000, open_dues: [{ kind: "monthly", month: "2026-10-01", due_date: "2026-10-20", amount: 140000, amount_paid: 0, remaining: 140000 }] }) });
    const sheet = await openSheet(page);
    await expect(sheet).toContainText("Ravi Kumar · October 2026");
    await expect(sheet).toContainText("₹1,400 to Meena Iyer");
  });

  test("the reference field: label, numeric keypad, hint, mono face, typed digits grouped in fours, spaces and hyphens ignored", async ({ page }) => {
    await openFee(page);
    await openSheet(page);
    const input = field(page);
    await expect(input).toHaveAttribute("inputmode", "numeric");
    await expect(page.getByRole("dialog")).toContainText("In your UPI app it is shown as UTR or UPI Ref No.");
    expect(await input.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/DM Mono|dm_mono|dmMono/i);
    await input.pressSequentially("6281 0473-9915");
    await expect(input).toHaveValue("6281 0473 9915");
    await input.fill("");
    // Pasted all at once (fill puts the whole value in one input event, as a paste does), with hyphens.
    await input.fill("6281-0473-9915");
    await expect(input).toHaveValue("6281 0473 9915");
  });

  test("anything that is not 12 digits shows a message beside the field and sends nothing", async ({ page }) => {
    const seen = await openFee(page);
    await openSheet(page);
    for (const typed of ["", "62810473991", "6281047399150", "6281O4739915"]) {
      await field(page).fill(typed);
      await sendButton(page).click();
      await expect(field(page)).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("dialog")).toContainText("Check the 12 digits and try again.");
    }
    expect(seen.claim).toHaveLength(0);
  });

  test("Send is blue, 62px, with the offset shadow; 'Sending…' and a second tap ignored; the no-money line; no screenshot option", async ({ page }) => {
    const seen = await openFee(page, { claim: { ...claimAnswer("ok", 200), delayMs: 800 } });
    const sheet = await openSheet(page);
    const send = sendButton(page);
    await expect(send).toHaveText("Send to Meena Iyer");
    expect((await box(send)).height).toBeGreaterThanOrEqual(62);
    expect(await send.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(27, 43, 143)");
    expect(await shadow(send)).not.toBe("none");
    await expect(sheet).toContainText("This does not move any money. It only tells the tutor.");
    await expect(sheet.getByText(/screenshot/i)).toHaveCount(0);
    await expect(sheet.locator('input[type="file"]')).toHaveCount(0);
    await field(page).fill(REF);
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("dialog button")].find((b) => b.textContent?.startsWith("Send to")) as HTMLButtonElement;
      button.click();
      button.click();
    });
    await expect(sendButton(page)).toHaveText("Sending…");
    await expect(sheet).toContainText("Sent to Meena Iyer.");
    expect(seen.claim).toHaveLength(1);
    expect(JSON.parse(seen.claim[0].postData() ?? "{}")).toEqual({ token: TOKEN, upi_ref: REF });
  });
});

test.describe("sending (criteria 34 to 36)", () => {
  test("success: the sheet says sent and that the receipt comes later; the page behind re-reads and shows the pending note", async ({ page }) => {
    const seen = await openFee(page, { pay: (call) => (call === 1 ? fee() : fee({ pending_claim: pendingClaim })) });
    const sheet = await openSheet(page);
    await field(page).fill("6281 0473 9915");
    await sendButton(page).click();
    await expect(sheet).toContainText("Sent to Meena Iyer. She will check and confirm it.");
    await expect(sheet).toContainText("Open this link again later to see your receipt.");
    expect(await sheet.locator("[data-claim=sent]").textContent()).not.toMatch(/\b(paid|done|success)\b/i);
    await expect.poll(() => seen.pay.length).toBe(2);
    await sheet.getByRole("button", { name: "Close" }).last().click();
    await expect(sheet).toBeHidden();
    const main = page.locator("main");
    await expect(main.locator("[data-claim=pending]")).toHaveText("You told Meena Iyer on 12 Oct 2026 that you paid ₹3,400. She will confirm it.");
    await expect(main.getByRole("button", { name: "I've paid" })).toHaveCount(0);
    await expect(main.getByRole("link", { name: "Pay ₹3,400 with UPI" })).toBeVisible();
    expect(seen.claim).toHaveLength(1);
  });

  const kept: [string, Answer, string][] = [
    ["bad_reference (422)", claimAnswer("bad_reference", 422), "Check the 12 digits and try again."],
    ["duplicate_reference (409)", claimAnswer("duplicate_reference", 409), "This reference was already sent."],
    ["rate limited (429)", { status: 429, body: { code: "rate_limited" }, headers: { "retry-after": "3600" } }, "Too many tries. Please try again in a while."],
    ["a server fault (500)", claimAnswer("error", 500), "Couldn't send. Nothing was saved. Try again."],
    ["a network failure", "abort", "Couldn't send. Nothing was saved. Try again."],
  ];
  for (const [what, answer, words] of kept) {
    test(`${what}: a plain message, and what she typed stays`, async ({ page }) => {
      const seen = await openFee(page, { claim: answer });
      const sheet = await openSheet(page);
      await field(page).fill("6281 0473 9915");
      await sendButton(page).click();
      await expect(sheet).toContainText(words);
      await expect(field(page)).toHaveValue("6281 0473 9915");
      await expect(sendButton(page)).toHaveText("Send to Meena Iyer");
      expect(seen.claim).toHaveLength(1);
      expect(seen.pay).toHaveLength(1);
    });
  }

  test("nothing owed any more: the page re-reads and shows ALL PAID", async ({ page }) => {
    const seen = await openFee(page, { pay: (call) => (call === 1 ? fee() : fee({ total_remaining: 0, open_dues: [] })), claim: claimAnswer("nothing_owed", 409) });
    await openSheet(page);
    await field(page).fill(REF);
    await sendButton(page).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("main").getByRole("img", { name: "ALL PAID" })).toBeVisible();
    expect(seen.pay).toHaveLength(2);
  });

  test("a claim already waiting: the page re-reads and shows the pending note", async ({ page }) => {
    await openFee(page, { pay: (call) => (call === 1 ? fee() : fee({ pending_claim: pendingClaim })), claim: claimAnswer("already_pending", 409) });
    await openSheet(page);
    await field(page).fill(REF);
    await sendButton(page).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("main [data-claim=pending]")).toBeVisible();
  });

  test("not agreed yet (403): the page re-reads and shows the consent screen, even right after a 422", async ({ page }) => {
    await openFee(page, {
      pay: (call) => (call === 1 ? fee() : notice()),
      claim: (call) => (call === 1 ? claimAnswer("bad_reference", 422) : claimAnswer("consent_needed", 403)),
    });
    await openSheet(page);
    await field(page).fill(REF);
    await sendButton(page).click();
    await expect(page.getByRole("dialog")).toContainText("Check the 12 digits and try again.");
    await sendButton(page).click();
    await expect(page.locator("main")).toHaveAttribute("data-state", "consent");
  });

  test("a lost answer, then a second tap: lands on 'already waiting', never a second claim", async ({ page }) => {
    const seen = await openFee(page, {
      pay: (call) => (call === 1 ? fee() : fee({ pending_claim: pendingClaim })),
      // The first call saved the claim but its answer never arrived; the second finds it waiting.
      claim: (call) => (call === 1 ? "abort" : claimAnswer("already_pending", 409)),
    });
    await openSheet(page);
    await field(page).fill(REF);
    await sendButton(page).click();
    await expect(page.getByRole("dialog")).toContainText("Couldn't send. Nothing was saved. Try again.");
    await expect(field(page)).toHaveValue("6281 0473 9915");
    await sendButton(page).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("main [data-claim=pending]")).toBeVisible();
    expect(seen.claim).toHaveLength(2);
    expect(seen.claim.map((r) => JSON.parse(r.postData() ?? "{}").upi_ref)).toEqual([REF, REF]);
  });

  test("offline: refused with its own words, the reference stays, nothing is sent or queued (criterion 36)", async ({ page, context }) => {
    const seen = await openFee(page);
    await openSheet(page);
    await field(page).fill("6281 0473 9915");
    await context.setOffline(true);
    await sendButton(page).click();
    await expect(page.getByRole("dialog")).toContainText("You are offline. Nothing was sent.");
    await expect(field(page)).toHaveValue("6281 0473 9915");
    await context.setOffline(false);
    await page.waitForTimeout(500);
    expect(seen.claim).toHaveLength(0);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  });
});

test.describe("privacy (criterion 39)", () => {
  test("only submit-claim and the pay-page re-read are added; the reference is in that one body and nowhere else; nothing stored", async ({ page, context }) => {
    const seen = await openFee(page, { pay: (call) => (call === 1 ? fee() : fee({ pending_claim: pendingClaim })) });
    await openSheet(page);
    await field(page).fill("6281 0473 9915");
    await sendButton(page).click();
    await expect(page.getByRole("dialog")).toContainText("Sent to Meena Iyer.");
    await expect.poll(() => seen.pay.length).toBe(2);
    await page.waitForLoadState("networkidle");

    const toFunctionHost = seen.all.filter((r) => new URL(r.url).host === FUNCTION_HOST);
    const posts = toFunctionHost.filter((r) => r.method === "POST");
    expect(posts.map((r) => new URL(r.url).pathname)).toEqual(["/functions/v1/pay-page", "/functions/v1/submit-claim", "/functions/v1/pay-page"]);
    expect(toFunctionHost.filter((r) => r.method !== "POST" && r.method !== "OPTIONS")).toEqual([]);
    const claim = posts[1];
    expect(Object.keys(JSON.parse(claim.body ?? "{}"))).toEqual(["token", "upi_ref"]);
    expect(new URL(claim.url).search).toBe("");
    expect(claim.headers["referer"]).toBeUndefined();
    expect(claim.headers["cookie"]).toBeUndefined();
    expect(claim.headers["authorization"]).toBeUndefined();
    // The reference: in the submit-claim body, and in no other request's address, headers or body.
    for (const r of seen.all.filter((r) => r !== claim)) {
      expect(r.url, r.url).not.toContain(REF);
      expect(r.url).not.toContain("6281");
      expect(JSON.stringify(r.headers)).not.toContain(REF);
      expect(r.body ?? "").not.toContain(REF);
    }
    const origin = new URL(page.url()).host;
    for (const r of seen.all) expect([origin, FUNCTION_HOST], r.url).toContain(new URL(r.url).host);
    // Not in the address, the title or the history.
    expect(page.url()).not.toContain("6281");
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe("");
    expect(await page.title()).not.toContain("6281");
    expect(await page.evaluate(() => history.length)).toBeLessThanOrEqual(2);
    expect(await page.evaluate(() => JSON.stringify(history.state ?? null))).not.toContain("6281");
    expect(await context.cookies()).toEqual([]);
    expect(await page.evaluate(() => document.cookie)).toBe("");
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    expect(await page.evaluate(async () => (await indexedDB.databases?.())?.length ?? 0)).toBe(0);
    expect(seen.all.some((r) => /posthog|sentry|analytics|google-analytics/i.test(r.url))).toBe(false);
  });

  test("Enter in the field sends through the same path and never puts the reference in the address", async ({ page }) => {
    const seen = await openFee(page);
    await openSheet(page);
    await field(page).fill(REF);
    await field(page).press("Enter");
    await expect(page.getByRole("dialog")).toContainText("Sent to Meena Iyer.");
    expect(page.url()).not.toContain("6281");
    expect(seen.claim).toHaveLength(1);
  });
});

test("the focus ring shows on the I've paid button and on Send from the keyboard", async ({ page }) => {
  await openFee(page);
  const button = page.locator("main").getByRole("button", { name: "I've paid" });
  await button.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(button).toBeFocused();
  expect(await button.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(field(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sendButton(page)).toBeFocused();
  expect(await sendButton(page).evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
});
