// Spec R1-9 Part C, criteria 43 and 44: "Show QR code" on the parent's pay page. The encoder is a separate chunk
// fetched on the first tap; after that it works with the network off. Decoding the picture with a real UPI app is a
// manual step (plan C10). English runs on /p/ itself; hi, kn and te on /dev/unlocked/p/, where a test fixture unlocks
// them (spec parent-pages-english, criterion 10).
import { expect, test, type Page } from "@playwright/test";
import { box, fontsSettled, langs, sidewaysScroll, textProblems } from "./helpers";
import { fee, link, pageLink, stubPayPage, UPI_ID } from "./pay-page-helpers";
import { QR_MIN_PX } from "../src/components/pay-page/qr-block";
import { qrMatrix } from "../src/lib/qr";

const PAY_LINK = `upi://pay?pa=${UPI_ID}&pn=Meena%20Iyer&am=3400.00&cu=INR&tn=Fees%20due%20Ravi`;

async function openFee(page: Page, change: Record<string, unknown> = {}, address: string = link()) {
  const seen = await stubPayPage(page, { pay: fee(change) });
  await page.goto(address);
  await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
  return seen;
}

/** Script requests made from now on, so the encoder chunk shows as the one new file. */
function scriptsFromNow(page: Page) {
  const urls: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") urls.push(new URL(r.url()).pathname);
  });
  return urls;
}

test.describe("Show QR code", () => {
  test("opens a square of at least 220px of the Pay link, with the words and the UPI ID, and Close hides it", async ({ page }) => {
    await openFee(page);
    const main = page.locator("main");
    const open = main.getByRole("button", { name: "Show QR code" });
    expect((await box(open)).height).toBeGreaterThanOrEqual(48);
    await open.click();
    const svg = main.getByRole("img", { name: "Scan with a UPI app on another phone" });
    await expect(svg).toBeVisible();
    const size = await box(svg);
    expect(QR_MIN_PX).toBe(220);
    expect(size.width).toBeGreaterThanOrEqual(QR_MIN_PX);
    expect(Math.abs(size.width - size.height)).toBeLessThan(2);
    // The same string as the Pay button, drawn by the same function.
    expect(await main.locator('a[href^="upi://"]').getAttribute("href")).toBe(PAY_LINK);
    expect(await svg.locator("path").getAttribute("d")).toBe((await qrMatrix(PAY_LINK)).path);
    await expect(main.locator("[data-qr=drawn]")).toContainText("Scan with a UPI app on another phone");
    await expect(main.locator("[data-qr=drawn]")).toContainText(UPI_ID);
    const close = main.locator("[data-qr]").getByRole("button", { name: "Close" });
    expect((await box(close)).height).toBeGreaterThanOrEqual(44);
    await close.click();
    await expect(main.locator("[data-qr]")).toHaveCount(0);
    await expect(open).toBeFocused();
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("fetches the encoder on the first tap only, then works with the network off", async ({ page, context }) => {
    await openFee(page);
    const main = page.locator("main");
    const scripts = scriptsFromNow(page);
    const others: string[] = [];
    page.on("request", (r) => {
      if (r.resourceType() !== "script" && !r.url().startsWith("data:")) others.push(r.url());
    });
    await page.waitForTimeout(300);
    expect(scripts).toEqual([]);
    await main.getByRole("button", { name: "Show QR code" }).click();
    await expect(main.getByRole("img", { name: /Scan with/ })).toBeVisible();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatch(/^\/_next\/static\/chunks\/.+\.js$/);
    expect(others).toEqual([]);
    await main.locator("[data-qr]").getByRole("button", { name: "Close" }).click();
    await context.setOffline(true);
    await main.getByRole("button", { name: "Show QR code" }).click();
    await expect(main.getByRole("img", { name: /Scan with/ })).toBeVisible();
    expect(scripts).toHaveLength(1);
    expect(others).toEqual([]);
  });

  test("says it could not make the code when the encoder cannot load, and the page and Copy still work", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { copied: string[] }).copied = [];
      Object.defineProperty(navigator, "clipboard", { value: { writeText: (v: string) => { (window as unknown as { copied: string[] }).copied.push(v); return Promise.resolve(); } }, configurable: true });
    });
    await openFee(page);
    const main = page.locator("main");
    await page.route("**/_next/static/chunks/**", (route) => route.abort("failed"));
    await main.getByRole("button", { name: "Show QR code" }).click();
    await expect(main.getByText("Couldn't make the QR code. Use Copy UPI ID instead.")).toBeVisible();
    await expect(main.getByRole("img", { name: /Scan with/ })).toHaveCount(0);
    await expect(main.locator('a[href^="upi://"]')).toBeVisible();
    await main.getByRole("button", { name: "Copy UPI ID" }).click();
    expect(await page.evaluate(() => (window as unknown as { copied: string[] }).copied)).toEqual([UPI_ID]);
    await main.locator("[data-qr]").getByRole("button", { name: "Close" }).click();
    await expect(main.locator("[data-qr]")).toHaveCount(0);
  });

  test("is not offered with no UPI ID, nothing owed or a total over the ceiling", async ({ page }) => {
    for (const change of [{ upi_id: null }, { total_remaining: 0, open_dues: [] }, { total_remaining: 100_000_001 }]) {
      await openFee(page, change);
      await expect(page.locator("main").getByRole("button", { name: "Show QR code" })).toHaveCount(0);
      await page.unroute("**/functions/v1/pay-page");
    }
  });
});

const sizes = ["100%", "130%", "200%"] as const;

for (const lang of langs) {
  test(`the QR block at 360px and larger text in ${lang}`, async ({ page }) => {
    await openFee(page, { language: lang, tutor_name: "T".repeat(80), upi_id: "a".repeat(40) + "@okhdfcbank" }, pageLink(lang));
    const main = page.locator("main");
    // Laid out in {lang} itself: the fixture page must really show it (criterion 10).
    await expect(main).toHaveAttribute("lang", lang);
    await fontsSettled(page);
    await main.getByRole("button", { name: /QR|TODO/ }).first().scrollIntoViewIfNeeded();
    await main.locator("button[aria-expanded]").click();
    const svg = main.locator("[data-qr=drawn] svg");
    await expect(svg).toBeVisible();
    for (const size of sizes) {
      await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
      await fontsSettled(page);
      expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
      const b = await box(svg);
      test.info().annotations.push({ type: "qr-size", description: `${lang} ${size}: ${String(b.width)}x${String(b.height)}` });
      // At least QR_MIN_PX square at every text size (criterion 43, founder 2026-10-16), never cut by the screen edge.
      expect(b.width, `QR width at ${size}`).toBeGreaterThanOrEqual(QR_MIN_PX);
      expect(Math.abs(b.width - b.height), `QR square at ${size}`).toBeLessThan(2);
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(360 + 1);
      for (const el of await main.locator("[data-qr] button:visible").all()) expect((await box(el)).height).toBeGreaterThanOrEqual(44);
      expect(await textProblems(page, "main"), `text problems at ${size}`).toEqual([]);
    }
  });
}
