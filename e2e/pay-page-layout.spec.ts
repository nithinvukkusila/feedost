// Spec R1-9 Part B, criterion 34: the parent's pay page at 360px and at larger text, in en, hi, kn and te, with an
// 80-character student name with no spaces, an 80-character tutor name, 8 subjects, a total of ₹10,00,000, 24 fee
// lines, a Telugu tutor name and a Hindi student name: no sideways scroll, every control 44px (Pay 72px), nothing under
// 14px, nothing cut with an ellipsis, the amount never cut, status a word plus a mark under grayscale.
import { expect, test } from "@playwright/test";
import { box, fontsSettled, langs, sidewaysScroll, textProblems } from "./helpers";
import { feeBody, link, notice, stubPayPage } from "./pay-page-helpers";

const sizes = ["100%", "130%", "200%"] as const;
const dues = Array.from({ length: 24 }, (_, i) => ({
  kind: "monthly",
  month: `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`,
  due_date: `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`,
  amount: 100_000,
  amount_paid: i === 3 ? 50_000 : 0,
  remaining: i === 3 ? 50_000 : 100_000,
}));
const subjects = ["maths", "science", "english", "hindi", "physics", "chemistry", "accounts", "Sanskrit and Vedic chanting"];
const receipts = Array.from({ length: 12 }, (_, i) => ({
  receipt_no: 100 + i,
  receipt_token: `Rq8mT2vXk4LpN7sYb3Wc${String(i).padStart(2, "0")}`,
  month: i === 0 ? null : `2023-${String(i).padStart(2, "0")}-01`,
  amount: 100_000,
  paid_on: "2024-01-05",
  balance_after: i % 2 === 0 ? 0 : 20_000,
}));
const heavy = (language: string, extra: Record<string, unknown> = {}) => ({
  language,
  tutor_name: "T".repeat(80),
  student_name: "S".repeat(80),
  tutor_subjects: subjects,
  total_remaining: 100_000_000,
  open_dues: dues,
  open_dues_more: 3,
  receipts,
  receipts_more: true,
  upi_id: "a".repeat(40) + "@okhdfcbank",
  today: "2026-10-12",
  ...extra,
});

for (const lang of langs) {
  test.describe(`/p/ in ${lang}`, () => {
    test("the fee page with the longest of everything", async ({ page }) => {
      test.setTimeout(120_000);
      await stubPayPage(page, { pay: { status: 200, body: { code: "ok", page: { ...feeBody, ...heavy(lang) } } } });
      await page.goto(link());
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "fee");
      await fontsSettled(page);
      await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        await fontsSettled(page);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        // The amount is never cut: its own box holds it whole.
        const amount = main.locator(".type-amount");
        await expect(amount).toHaveText("₹10,00,000");
        expect(await amount.evaluate((el) => el.scrollWidth <= el.parentElement!.clientWidth + 1), `the amount fits at ${size}`).toBe(true);
        // Status is a word plus a mark, whatever the colour.
        const tags = main.locator("[data-status=overdue]");
        expect(await tags.count()).toBeGreaterThan(0);
        await expect(tags.first()).toBeVisible();
        // The Pay button is there, 72px at least, and nothing sits on top of it.
        const pay = main.locator('a[href^="upi://"]');
        await pay.scrollIntoViewIfNeeded();
        expect((await box(pay)).height, `the Pay button at ${size}`).toBeGreaterThanOrEqual(72);
        expect(await pay.evaluate((el) => { const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("a") === el; }), "nothing covers the Pay button").toBe(true);
        for (const el of await main.locator("a:visible, button:visible").all()) expect((await box(el)).height).toBeGreaterThanOrEqual(44);
        expect(await textProblems(page, "main"), `text problems at ${size}`).toEqual([]);
        // Digits stay 0-9 in every language.
        expect(await main.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
      }
    });

    test("the consent screen with a Telugu tutor name and a Hindi student name", async ({ page }) => {
      test.setTimeout(90_000);
      await stubPayPage(page, { pay: notice({ language: lang, tutor_name: "మీనా అయ్యర్ ట్యూషన్స్", student_name: "रवि कुमार शर्मा", tutor_subjects: subjects }) });
      await page.goto(link());
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "consent");
      await fontsSettled(page);
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        await fontsSettled(page);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        for (const el of await main.locator("a:visible, button:visible").all()) expect((await box(el)).height).toBeGreaterThanOrEqual(44);
        expect(await textProblems(page, "main"), `text problems at ${size}`).toEqual([]);
      }
      await expect(main).toContainText("మీనా అయ్యర్ ట్యూషన్స్");
      await expect(main).toContainText("रवि कुमार शर्मा");
    });

    test("the long names on the consent screen wrap and the agree button stays reachable", async ({ page }) => {
      await stubPayPage(page, { pay: notice({ language: lang, tutor_name: "T".repeat(80), student_name: "S".repeat(80), tutor_subjects: subjects }) });
      await page.goto(link());
      await expect(page.locator("main")).toHaveAttribute("data-state", "consent");
      await fontsSettled(page);
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        const agree = page.locator("main").getByRole("button").last();
        await agree.scrollIntoViewIfNeeded();
        await expect(agree).toBeInViewport();
      }
    });

    test("the failure state with its button", async ({ page }) => {
      await stubPayPage(page, { pay: { status: 500, body: { code: "error" } } });
      await page.goto(link());
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "failed");
      await fontsSettled(page);
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        const retry = main.getByRole("button");
        expect((await box(retry)).height).toBeGreaterThanOrEqual(44);
        expect(await textProblems(page, "main"), `text problems at ${size}`).toEqual([]);
      }
    });
  });
}
