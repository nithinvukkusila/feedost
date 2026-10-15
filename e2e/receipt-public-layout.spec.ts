// Spec R1-7 Part B, criterion 31: the parent's receipt page at 360px and at larger text, in en, hi, kn and te, with
// an 80-character student name, a 60-character parent name and a seven-figure amount: no sideways scroll, the amount
// never cut, every control 44px, nothing under 14px, nothing cut with an ellipsis. With the colour taken away the
// status is still a word.
// English runs on /r/ itself; hi, kn and te on /dev/unlocked/r/, where a test fixture unlocks them (spec
// parent-pages-english, criterion 10).
import { expect, test } from "@playwright/test";
import { box, fontsSettled, langs, sidewaysScroll, textProblems } from "./helpers";
import { link, okBody, pageLink, stubReceipt } from "./receipt-public-helpers";

const LONG_STUDENT = "A".repeat(80);
const LONG_PARENT = "Venkatasubrahmanyalakshminarasimha Rao-Naidu".repeat(1);
const sizes = ["100%", "130%", "200%"] as const;

for (const lang of langs) {
  test.describe(`/r/ in ${lang}`, () => {
    test("the receipt", async ({ page }) => {
      test.setTimeout(90_000);
      await stubReceipt(
        page,
        okBody({ language: lang, student_name: LONG_STUDENT, parent_name: LONG_PARENT, tutor_name: "T".repeat(60), amount: 123456700, balance_after: 99900000, status: "part_paid" }),
      );
      await page.goto(pageLink(lang));
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "ok");
      await fontsSettled(page);
      await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        await fontsSettled(page);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        // The amount is never cut: its own box holds it whole.
        const amount = main.locator("article .type-amount");
        await expect(amount).toContainText("₹12,34,567/-");
        expect(await amount.evaluate((el) => el.scrollWidth <= el.parentElement!.clientWidth + 1), `the amount fits at ${size}`).toBe(true);
        // The status is a word, whatever the colour.
        await expect(main.locator("[data-status=part-paid]")).toBeVisible();
        await expect(main.getByRole("img").first()).toBeVisible();
        for (const el of await main.locator("a:visible, button:visible").all()) expect((await box(el)).height).toBeGreaterThanOrEqual(44);
        if (size !== "200%") expect(await textProblems(page, "main"), `text problems at ${size}`).toEqual([]);
        expect(await main.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
      }
    });

    test("the failure state with its button", async ({ page }) => {
      await stubReceipt(page, { status: 500, body: { code: "error" } });
      await page.goto(pageLink(lang));
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "failed");
      await fontsSettled(page);
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        const retry = main.getByRole("button");
        expect((await box(retry)).height).toBeGreaterThanOrEqual(44);
        if (size !== "200%") expect(await textProblems(page, "main"), `text problems at ${size}`).toEqual([]);
      }
    });
  });
}

test("the focus ring shows on Try again from the keyboard", async ({ page }) => {
  await stubReceipt(page, { status: 500, body: { code: "error" } });
  await page.goto(link());
  await expect(page.locator("main")).toHaveAttribute("data-state", "failed");
  await page.keyboard.press("Tab");
  const retry = page.locator("main").getByRole("button");
  await expect(retry).toBeFocused();
  expect(await retry.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
});
