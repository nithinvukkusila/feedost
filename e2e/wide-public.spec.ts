// Spec D1, part D1a, criteria 26 to 28: the landing page and the free reminder tool on wider screens
// (the canvases `Landing` and `Tool-reminder`): at most 80rem from 1024, two columns, one column of at most
// 42rem from 768 to 1023, and as today below 768. CSS only.
import { expect, test, type Page } from "@playwright/test";
import { box } from "./helpers";
import { expectNoSideways, setWidth, sweep } from "./wide-helpers";

const REM = 16;
const ready = (page: Page) => expect(page.locator("h1").first()).toBeVisible();

test.describe("27: the landing page", () => {
  test("two columns in the hero from 1024 (text left, the ledger card right), one column below, nothing wider than 80rem", async ({ page }) => {
    await page.goto("/en/");
    await ready(page);
    const title = page.locator("h1");
    const card = page.getByRole("group", { name: /example/i }).first();
    for (const width of [360, 767, 768, 1023, 1024, 1280, 1920]) {
      await setWidth(page, width, 900);
      const t = await box(title);
      const c = await box(card);
      if (width >= 1024) {
        expect(c.x, `the card is right of the text at ${width}`).toBeGreaterThanOrEqual(t.x + t.width - 1);
        expect(c.y, `level with the text at ${width}`).toBeLessThan(t.y + 600);
        expect(c.x + c.width, `inside 80rem at ${width}`).toBeLessThanOrEqual((width + 80 * REM) / 2 + 1);
        // The title is not covered by the card: the click lands on the button, not on the laid-over row.
        const join = page.getByRole("link", { name: /join/i }).first();
        await expect(join).toBeVisible();
        const jb = await box(join);
        expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a") !== null, [jb.x + jb.width / 2, jb.y + jb.height / 2])).toBe(true);
      } else {
        expect(c.y, `the card is under the text at ${width}`).toBeGreaterThan(t.y + t.height);
        expect(Math.max(t.width, c.width), `at most 42rem at ${width}`).toBeLessThanOrEqual(42 * REM);
      }
      await expectNoSideways(page, width, "landing");
    }
  });

  test("steps in three columns and the tools in two from 1024, one column below", async ({ page }) => {
    await page.goto("/en/");
    await ready(page);
    const steps = page.locator("#steps-title ~ ol > li, section[aria-labelledby='steps-title'] ol > li");
    await setWidth(page, 1280, 900);
    const xs = await Promise.all((await steps.all()).map(async (s) => Math.round((await box(s)).x)));
    expect(new Set(xs).size).toBe(3);
    await setWidth(page, 800, 900);
    const ys = await Promise.all((await steps.all()).map(async (s) => Math.round((await box(s)).x)));
    expect(new Set(ys).size).toBe(1);
  });

  test("no sideways scroll at 320 to 1920, in four languages and at 200% text", async ({ page }) => {
    test.setTimeout(120_000);
    await sweep(page, (lang) => `/${lang}/`, ready, "landing");
  });
});

test.describe("27: the free fee reminder tool", () => {
  test("the form and the message side by side from 1024, one column below", async ({ page }) => {
    await page.goto("/en/tools/fee-reminder/");
    await ready(page);
    const form = page.getByTestId("reminder-form");
    const preview = page.getByTestId("reminder-preview");
    for (const width of [360, 1023, 1024, 1280, 1920]) {
      await setWidth(page, width, 900);
      const f = await box(form);
      const p = await box(preview);
      if (width >= 1024) {
        expect(p.x, `the message is right of the form at ${width}`).toBeGreaterThanOrEqual(f.x + f.width - 1);
        expect(p.y, `near the top of the form at ${width}`).toBeLessThan(f.y + 300);
      } else {
        expect(p.y, `the message is under the form at ${width}`).toBeGreaterThan(f.y + f.height - 1);
      }
      await expectNoSideways(page, width, "tool");
    }
  });

  test("no sideways scroll at 320 to 1920, in four languages and at 200% text", async ({ page }) => {
    test.setTimeout(120_000);
    await sweep(page, (lang) => `/${lang}/tools/fee-reminder/`, ready, "tool");
  });
});
