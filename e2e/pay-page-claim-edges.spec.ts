// Spec R1-10 Part C, the edges of criteria 34 to 36, 39 and 40 that pay-page-claim.spec.ts and pay-page-layout.spec.ts
// do not reach: every `submit-claim` status of the Part A contract (section 16) as the page meets it, a re-read that
// fails after the claim was taken, offline before the sheet's code has loaded and back online, a second tap by touch
// and by Enter while sending, the digits kept across a run of refusals, digits that are not 0-9, and the field's
// error state at 200% with the keypad open in en, hi, kn and te.
import { expect, test, type Page } from "@playwright/test";
import { box, fontsSettled, langs, sidewaysScroll } from "./helpers";
import { claimAnswer, feeBody, fee, link, pageLink, pendingClaim, stubPayPage, type Answer } from "./pay-page-helpers";

const REF = "628104739915";
const SHOWN = "6281 0473 9915";
const REF_LABEL = "UPI reference number · 12 digits";
const FAILED = "Couldn't send. Nothing was saved. Try again.";

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

test.describe("every submit-claim answer of the contract (section 16)", () => {
  test("not_found (404): the page re-reads; a link that is gone shows the not-found words and sends nothing more", async ({ page }) => {
    const seen = await openFee(page, { pay: (call) => (call === 1 ? fee() : { status: 404, body: { code: "not_found" } }), claim: claimAnswer("not_found", 404) });
    await openSheet(page);
    await field(page).fill(REF);
    await sendButton(page).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator("main")).toHaveAttribute("data-state", "not_found");
    await expect(page.locator("main")).not.toContainText("Meena Iyer");
    expect(seen.pay).toHaveLength(2);
    expect(seen.claim).toHaveLength(1);
  });

  test("no_proof (422): the message beside the field, the digits kept, no re-read", async ({ page }) => {
    const seen = await openFee(page, { claim: claimAnswer("no_proof", 422) });
    await openSheet(page);
    await field(page).fill(SHOWN);
    await sendButton(page).click();
    await expect(field(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByRole("dialog")).toContainText("Check the 12 digits and try again.");
    await expect(field(page)).toHaveValue(SHOWN);
    expect(seen.pay).toHaveLength(1);
  });

  const failures: [string, Answer][] = [
    ["invalid (400)", claimAnswer("invalid", 400)],
    ["invalid (405)", claimAnswer("invalid", 405)],
    ["invalid (413)", claimAnswer("invalid", 413)],
    ["a 200 whose code is not ok", claimAnswer("already_pending", 200)],
    ["a 409 whose code is not one of the three", claimAnswer("ok", 409)],
    ["a proxy's HTML error page (502)", { status: 502, body: "<html>Bad gateway</html>" }],
  ];
  for (const [what, answer] of failures) {
    test(`${what}: "Couldn't send", the digits kept, the page not re-read, Send usable again`, async ({ page }) => {
      const seen = await openFee(page, { claim: answer });
      const sheet = await openSheet(page);
      await field(page).fill(SHOWN);
      await sendButton(page).click();
      await expect(sheet.locator("[data-claim=problem]")).toHaveText(FAILED);
      await expect(field(page)).toHaveValue(SHOWN);
      await expect(field(page)).not.toHaveAttribute("aria-invalid", "true");
      await expect(sendButton(page)).toHaveText("Send to Meena Iyer");
      await expect(sendButton(page)).toBeEnabled();
      expect(seen.pay).toHaveLength(1);
      expect(seen.claim).toHaveLength(1);
    });
  }

  test("a run of refusals keeps the digits each time, each message replaces the last, and editing clears it", async ({ page }) => {
    const order = [claimAnswer("error", 500), claimAnswer("duplicate_reference", 409), { status: 429, body: { code: "rate_limited" } }, "abort" as const];
    const seen = await openFee(page, { claim: (call) => order[call - 1] ?? claimAnswer("error", 500) });
    const sheet = await openSheet(page);
    const problem = sheet.locator("[data-claim=problem]");
    await field(page).fill(SHOWN);
    for (const words of [FAILED, "This reference was already sent.", "Too many tries. Please try again in a while.", FAILED]) {
      await sendButton(page).click();
      await expect(problem).toHaveText(words);
      await expect(field(page)).toHaveValue(SHOWN);
    }
    expect(seen.claim).toHaveLength(4);
    // Changing what is typed takes the old message away.
    await field(page).fill("6281 0473 991");
    await expect(problem).toBeEmpty();
    await expect(field(page)).toHaveValue("6281 0473 991");
  });
});

test.describe("after the claim is taken", () => {
  // Criterion 34: the sheet shows the sent words, and the page behind it re-reads. If that re-read does not come back,
  // the claim is still saved; the parent must still be told so, not shown a page that says loading it failed.
  for (const [what, reread] of [
    ["the re-read fails (no connection)", "abort"],
    ["the re-read is a server fault", { status: 500, body: { code: "error" } }],
  ] as [string, Answer][]) {
    test(`${what}: the sheet still says "Sent to {tutor}"`, async ({ page }) => {
      const seen = await openFee(page, { pay: (call) => (call === 1 ? fee() : typeof reread === "function" ? reread(call) : reread) });
      const sheet = await openSheet(page);
      await field(page).fill(REF);
      await sendButton(page).click();
      await expect.poll(() => seen.pay.length).toBe(2);
      await page.waitForTimeout(300);
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText("Sent to Meena Iyer. She will check and confirm it.");
      expect(seen.claim).toHaveLength(1);
    });
  }

  test("the sheet closed while sending: when the answer comes the page still re-reads and shows the pending note", async ({ page }) => {
    const seen = await openFee(page, { pay: (call) => (call === 1 ? fee() : fee({ pending_claim: pendingClaim })), claim: { ...claimAnswer("ok", 200), delayMs: 1500 } });
    const sheet = await openSheet(page);
    await field(page).fill(REF);
    await sendButton(page).click();
    await expect(sendButton(page)).toHaveText("Sending…");
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect.poll(() => seen.claim.length).toBe(1);
    // The claim was saved: the page must not go on offering "I've paid" as if nothing was sent.
    await expect(page.locator("main [data-claim=pending]")).toBeVisible({ timeout: 8000 });
    await expect(page.locator("main").getByRole("button", { name: "I've paid" })).toHaveCount(0);
  });

  test("the re-read finds all paid (the tutor confirmed at once): the sheet still says sent, the page shows ALL PAID behind it", async ({ page }) => {
    await openFee(page, { pay: (call) => (call === 1 ? fee() : fee({ total_remaining: 0, open_dues: [] })) });
    const sheet = await openSheet(page);
    await field(page).fill(REF);
    await sendButton(page).click();
    await expect(sheet).toContainText("Sent to Meena Iyer.");
    await sheet.getByRole("button", { name: "Close" }).last().click();
    await expect(page.locator("main").getByRole("img", { name: "ALL PAID" })).toBeVisible();
    await expect(page.locator("main [data-claim]")).toHaveCount(0);
  });
});

test.describe("offline (criterion 36)", () => {
  test("offline, then back online: the same digits send once, and nothing went while offline", async ({ page, context }) => {
    const seen = await openFee(page, { pay: (call) => (call === 1 ? fee() : fee({ pending_claim: pendingClaim })) });
    const sheet = await openSheet(page);
    await field(page).fill(SHOWN);
    await context.setOffline(true);
    await sendButton(page).click();
    await expect(sheet.locator("[data-claim=problem]")).toHaveText("You are offline. Nothing was sent.");
    await sendButton(page).click();
    await expect(sheet.locator("[data-claim=problem]")).toHaveText("You are offline. Nothing was sent.");
    expect(seen.claim).toHaveLength(0);
    await context.setOffline(false);
    // Nothing queued: coming back online sends nothing by itself.
    await page.waitForTimeout(500);
    expect(seen.claim).toHaveLength(0);
    await expect(field(page)).toHaveValue(SHOWN);
    await sendButton(page).click();
    await expect(sheet).toContainText("Sent to Meena Iyer.");
    expect(seen.claim).toHaveLength(1);
    expect(JSON.parse(seen.claim[0].postData() ?? "{}")).toEqual({ token: expect.any(String), upi_ref: REF });
  });

  test("offline before the sheet's code has loaded: the button says so and asks nothing; back online, it opens", async ({ page, context }) => {
    const seen = await openFee(page);
    await page.waitForLoadState("networkidle");
    await context.setOffline(true);
    const main = page.locator("main");
    await main.getByRole("button", { name: "I've paid" }).click();
    await expect(main.locator("[data-claim=ask]")).toContainText("You are offline. Nothing was sent.");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(seen.claim).toHaveLength(0);
    await context.setOffline(false);
    await main.getByRole("button", { name: "I've paid" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(main.locator("[data-claim=ask]")).not.toContainText("You are offline.");
    expect(seen.claim).toHaveLength(0);
  });
});

test.describe("the second tap (criterion 33)", () => {
  test("two touch taps and an Enter while sending make one claim", async ({ page }) => {
    const seen = await openFee(page, { claim: { ...claimAnswer("ok", 200), delayMs: 1200 } });
    const sheet = await openSheet(page);
    await field(page).fill(REF);
    await sendButton(page).tap();
    await expect(sendButton(page)).toHaveText("Sending…");
    await sendButton(page).tap({ force: true });
    await field(page).press("Enter");
    await expect(sheet).toContainText("Sent to Meena Iyer.");
    await page.waitForTimeout(300);
    expect(seen.claim).toHaveLength(1);
  });

  test("after the claim is sent, Enter in nothing and a reopened sheet do not send it again", async ({ page }) => {
    const seen = await openFee(page, { pay: (call) => (call === 1 ? fee() : fee({ pending_claim: pendingClaim })) });
    const sheet = await openSheet(page);
    await field(page).fill(REF);
    await field(page).press("Enter");
    await expect(sheet).toContainText("Sent to Meena Iyer.");
    await page.keyboard.press("Enter");
    await sheet.getByRole("button", { name: "Close" }).last().click();
    await expect(page.locator("main [data-claim=pending]")).toBeVisible();
    await expect(page.locator("main").getByRole("button", { name: "I've paid" })).toHaveCount(0);
    expect(seen.claim).toHaveLength(1);
  });
});

test.describe("what she types (criterion 32)", () => {
  for (const [what, typed] of [
    ["Devanagari digits", "६२८१०४७३९९१५"],
    ["Telugu digits", "౬౨౮౧౦౪౭౩౯౯౧౫"],
    ["full-width digits", "６２８１０４７３９９１５"],
    ["dots between groups", "6281.0473.9915"],
  ] as const) {
    test(`${what}: a message beside the field, nothing sent, what she typed left for her to fix`, async ({ page }) => {
      const seen = await openFee(page);
      await openSheet(page);
      await field(page).fill(typed);
      await sendButton(page).click();
      await expect(field(page)).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByRole("dialog")).toContainText("Check the 12 digits and try again.");
      await expect(field(page)).toHaveValue(typed);
      expect(seen.claim).toHaveLength(0);
    });
  }

  test("a long paste is cut to what the check reads and sends nothing", async ({ page }) => {
    const seen = await openFee(page);
    await openSheet(page);
    await field(page).fill("1".repeat(200));
    const value = await field(page).inputValue();
    expect(value.replace(/ /g, "")).toBe("1".repeat(64));
    await sendButton(page).click();
    await expect(page.getByRole("dialog")).toContainText("Check the 12 digits and try again.");
    expect(seen.claim).toHaveLength(0);
  });

  test("a digit typed in the middle keeps the caret after it and the groups of four", async ({ page }) => {
    await openFee(page);
    await openSheet(page);
    const input = field(page);
    await input.pressSequentially("62810473991");
    // Caret after "6281 0" (6 characters shown), then type the missing digit.
    await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(6, 6));
    await input.press("5");
    await expect(input).toHaveValue("6281 0547 3991");
    expect(await input.evaluate((el: HTMLInputElement) => el.selectionStart)).toBe(7);
  });
});

test.describe("privacy after closing (criterion 39)", () => {
  test("opening and closing the sheet adds no history entry, and the reference is in no resource address", async ({ page }) => {
    await openFee(page);
    const before = await page.evaluate(() => history.length);
    const sheet = await openSheet(page);
    await field(page).fill(REF);
    await sendButton(page).click();
    await expect(sheet).toContainText("Sent to Meena Iyer.");
    await sheet.getByRole("button", { name: "Close" }).last().click();
    expect(await page.evaluate(() => history.length)).toBe(before);
    const names = await page.evaluate(() => performance.getEntries().map((entry) => entry.name));
    for (const name of names) expect(name).not.toContain("6281");
    expect(await page.title()).not.toContain("6281");
    expect(page.url()).not.toContain("6281");
  });
});

// Criterion 40, the one state the layout spec does not lay out: the field showing its error (the mark, "Check this"
// and the message make it the tallest) at 200% with an 80-character tutor name and the keypad taking half the screen.
for (const lang of langs) {
  test(`${lang}: the field's error at 200% with the keypad open: no sideways scroll, Send reachable and not covered`, async ({ page }) => {
    test.setTimeout(90_000);
    const seen = await stubPayPage(page, { pay: { status: 200, body: { code: "ok", page: { ...feeBody, language: lang, tutor_name: "T".repeat(80), student_name: "S".repeat(80) } } } });
    await page.goto(pageLink(lang));
    const main = page.locator("main");
    await expect(main).toHaveAttribute("data-state", "fee");
    await expect(main).toHaveAttribute("lang", lang);
    await main.locator("[data-claim=ask] button").click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const input = sheet.locator("input");
    await input.fill("6281 0473 991");
    const send = sheet.locator('button[type="submit"]');
    await send.click();
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
    await page.setViewportSize({ width: 360, height: 400 });
    await fontsSettled(page);
    await input.focus();
    expect(await sidewaysScroll(page)).toBe(0);
    await expect(input).toHaveValue("6281 0473 991");
    await send.scrollIntoViewIfNeeded();
    await expect(send).toBeInViewport();
    expect((await box(send)).height).toBeGreaterThanOrEqual(62);
    const tappable = await send.evaluate((el) => {
      let panel: Element | null = el.parentElement;
      while (panel && getComputedStyle(panel).overflowY !== "auto") panel = panel.parentElement;
      const r = el.getBoundingClientRect();
      const clip = panel?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight };
      const top = Math.max(r.top, clip.top, 0);
      const bottom = Math.min(r.bottom, clip.bottom, innerHeight);
      if (bottom - top < 44) return false;
      return document.elementFromPoint(r.x + r.width / 2, (top + bottom) / 2)?.closest("button") === el;
    });
    expect(tappable, "Send has at least 44px on screen and nothing covers it").toBe(true);
    // The digits and ₹ stay 0-9 in this language too.
    expect(await sheet.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
    expect(seen.claim).toHaveLength(0);
  });
}
