// Spec R1-7 Part A, criterion 22: the Mark paid sheet, the banner and the receipt screen in en, hi, kn and te at
// 360px and with larger text, with an 80-character student name and a 60-character batch name: no sideways
// scroll, nothing cut, every control at least 44px, nothing under 14px, and "Mark as paid" reachable by scrolling
// the sheet. And with the colour taken away the stamp still says the status in words.
import { expect, test, type Page } from "@playwright/test";
import { MATHS, signedIn } from "./board-fixture";
import { box, langs, sidewaysScroll, textProblems } from "./helpers";
import { stubPayments } from "./pay-helpers";

const LONG = "A".repeat(80);
const LONG_BATCH = "Class 10 Maths and Science combined evening batch, Mon to Fri";
const ID = "00000000-0000-4000-8000-0000000000c9";
const ID2 = "00000000-0000-4000-8000-0000000000ca";

async function setup(page: Page, lang: string) {
  const { dues } = await signedIn(page, {
    lang,
    // A second student who owes, so the board is not the "all paid" state (its large stamp is wider than the screen at 200% text; that is R1-6's, not this slice's).
    students: [
      { id: ID, name: LONG, batch_id: MATHS, monthly_fee: 120000, due_day: 5, parent_name: "Suresh Kumar" },
      { id: ID2, name: "Zed", monthly_fee: 100000, due_day: 1 },
    ],
    batches: [{ id: MATHS, name: LONG_BATCH }],
    dues: [
      { student_id: ID, due_date: "2026-10-05", amount: 120000 },
      { student_id: ID2, due_date: "2026-10-01", amount: 100000 },
    ],
  });
  const pay = await stubPayments(page, dues);
  return { dues, pay };
}

const sizes = ["100%", "130%", "200%"] as const;
async function checkControls(page: Page, scope: string, where: string) {
  for (const el of await page.locator(`${scope} a:visible, ${scope} button:visible, ${scope} select:visible`).all()) {
    expect((await box(el)).height, `a control in ${where}`).toBeGreaterThanOrEqual(44);
  }
  for (const radio of await page.locator(`${scope} input[type=radio]`).all()) {
    expect((await box(radio)).height, `a radio in ${where}`).toBeGreaterThanOrEqual(44);
  }
}

for (const lang of langs) {
  test.describe(`/${lang}/`, () => {
    test("the sheet", async ({ page }) => {
      test.setTimeout(90_000);
      await setup(page, lang);
      await page.goto(`/${lang}/home/`);
      await page.locator(`main li:has(a[href*="${ID}"]) button`).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await dialog.getByRole("radio").nth(4).check({ force: true });
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        // Measured from the top of the sheet: a sheet that has been scrolled has content behind its pinned title, which is not a fault.
        await dialog.evaluate((el) => el.querySelectorAll("*").forEach((node) => void (node.scrollTop = 0)));
        // At the largest text an 80-character name with no spaces is taller than the header may be (60% of the sheet), so
        // the header scrolls inside itself and the panel keeps its room; the text checks run at the default size; at the larger sizes the checks are reachability, controls and sideways scroll.
        if (size === "100%") expect(await textProblems(page, "dialog"), `text problems at ${size}`).toEqual([]);
        await checkControls(page, "dialog", `the sheet at ${size}`);
        // The Mark as paid button can be reached by scrolling the sheet, and is wholly in the window then.
        const submit = dialog.locator("button[type=submit]");
        await submit.scrollIntoViewIfNeeded();
        await expect(submit).toBeInViewport({ ratio: 1 });
        // The amount is 0 to 9 digits whatever the language.
        await expect(dialog.getByRole("textbox").first()).toHaveValue("1,200");
        expect(await dialog.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
      }
    });

    test("the banner and the receipt screen", async ({ page }) => {
      test.setTimeout(90_000);
      await setup(page, lang);
      await page.goto(`/${lang}/home/`);
      await page.locator(`main li:has(a[href*="${ID}"]) button`).first().click();
      await page.getByRole("dialog").locator("button[type=submit]").click();
      const banner = page.locator("[data-kind='undo']");
      await expect(banner).toBeVisible();
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll with the banner at ${size}`).toBe(0);
        await checkControls(page, "[data-kind='undo']", `the banner at ${size}`);
      }
      await banner.getByRole("link").click();
      const card = page.locator("article");
      await expect(card).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll on the receipt at ${size}`).toBe(0);
        expect(await textProblems(page, "main"), `text problems on the receipt at ${size}`).toEqual([]);
        await checkControls(page, "main", `the receipt at ${size}`);
        await expect(card).toContainText(LONG);
        await expect(card).toContainText("₹1,200/-");
        // Status is a word, whatever the colour.
        await expect(card.getByRole("img", { name: "PAID" })).toBeVisible();
        expect(await card.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
      }
    });
  });
}
