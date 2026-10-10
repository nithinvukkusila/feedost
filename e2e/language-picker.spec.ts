// Spec R1-1, the language picker (criteria 1 to 5, and 46 for this page): four rows that are plain
// links, the current one marked in words, a save only on a tap. Runs against the static export in
// out/ at the phone viewport (360 wide, touch).
import { expect, test } from "@playwright/test";
import { localeNames } from "../src/config/locales";
import { box, langs, messageText, sidewaysScroll, textProblems, type Lang } from "./helpers";

const KEY = "ui-language";
const saved = (page: import("@playwright/test").Page) => page.evaluate((k) => localStorage.getItem(k), KEY);
const names: Record<Lang, string> = localeNames;

for (const lang of langs) {
  test.describe(`/${lang}/language/`, () => {
    test(`1: lists the four endonyms, each row at least 64px high with its own lang, ${lang} marked Chosen in words`, async ({ page }) => {
      await page.goto(`/${lang}/language/`);
      const rows = page.locator("main ul a");
      await expect(rows).toHaveCount(4);
      for (const code of langs) {
        const row = page.locator(`main ul a[lang="${code}"]`);
        await expect(row).toHaveCount(1);
        await expect(row).toContainText(names[code]);
        expect((await box(row)).height, `${code} row`).toBeGreaterThanOrEqual(64);
        await expect(row).toHaveAttribute("href", `/${code}/language/`);
      }
      const chosen = page.locator('main ul a[aria-current="page"]');
      await expect(chosen).toHaveCount(1);
      await expect(chosen).toHaveAttribute("lang", lang);
      await expect(chosen).toContainText(messageText(lang, "language.chosen"));
      await expect(page.getByText(messageText(lang, "language.chosen"), { exact: true })).toHaveCount(1);
    });

    test("3: Continue is a plain link to sign-in in this language, at least 48px, labelled in this language", async ({ page }) => {
      await page.goto(`/${lang}/language/`);
      const next = page.locator("main").getByRole("link", { name: messageText(lang, "language.continue") });
      await expect(next).toHaveAttribute("href", `/${lang}/sign-in/`);
      expect((await box(next)).height).toBeGreaterThanOrEqual(48);
    });

    test("4: opening the page saves nothing", async ({ page }) => {
      await page.goto(`/${lang}/language/`);
      await page.waitForTimeout(300);
      expect(await saved(page)).toBeNull();
    });

    test("5: prerendered with its own html lang, noindex and one h1", async ({ page, request }) => {
      const raw = await (await request.get(`/${lang}/language/`)).text();
      expect(raw).toMatch(new RegExp(`<html[^>]*\\blang="${lang}"`));
      expect(raw).toMatch(/<meta name="robots" content="noindex"/);
      expect(raw.match(/<h1[\s>]/g)).toHaveLength(1);
      await page.goto(`/${lang}/language/`);
      await expect(page.locator("h1")).toHaveCount(1);
    });

    test("5, 46: no sideways scroll, no clipped or cut text, every link at least 44px, at the default size and at 130%", async ({ page }) => {
      await page.goto(`/${lang}/language/`);
      await page.evaluate(() => document.fonts.ready);
      for (const size of ["100%", "130%"]) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        expect(await textProblems(page, "body"), `text problems at ${size}`).toEqual([]);
        for (const link of await page.locator("a").all()) {
          expect((await box(link)).height, `a link at ${size}`).toBeGreaterThanOrEqual(44);
        }
      }
    });
  });
}

test.describe("2: tapping a language", () => {
  test("saves it and the page reloads in that language", async ({ page }) => {
    await page.goto("/en/language/");
    expect(await saved(page)).toBeNull();
    await page.locator('main ul a[lang="hi"]').click();
    await expect(page).toHaveURL(/\/hi\/language\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "hi");
    expect(await saved(page)).toBe("hi");
    await expect(page.locator('main ul a[aria-current="page"]')).toHaveAttribute("lang", "hi");
    await expect(page.locator("h1")).toHaveText(messageText("hi", "language.title"));
  });

  test("each of the four saves its own code", async ({ page }) => {
    await page.goto("/en/language/");
    for (const code of ["kn", "te", "en", "hi"] as const) {
      await page.locator(`main ul a[lang="${code}"]`).click();
      await expect(page).toHaveURL(new RegExp(`/${code}/language/$`));
      expect(await saved(page)).toBe(code);
    }
  });

  test("still navigates with JavaScript off", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 740 } });
    const page = await context.newPage();
    await page.goto("http://localhost:4173/en/language/");
    await page.locator('main ul a[lang="te"]').click();
    await expect(page).toHaveURL(/\/te\/language\/$/);
    await context.close();
  });
});
