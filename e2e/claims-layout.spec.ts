// Spec R1-10 Part B, criterion 28: the chip, the inbox and its cards in en, hi, kn and te at 360px and with larger text,
// with an 80-character student name and a claim for ₹10,00,000: no sideways scroll, nothing cut, every control at
// least 44px, nothing under 14px, Confirm reachable by scrolling. And with the colour taken away, CONFIRMED and
// NOT RECEIVED still say so in words and each carries a mark.
import { expect, test, type Page } from "@playwright/test";
import { S, signedIn } from "./board-fixture";
import { stubClaims } from "./claims-helpers";
import { box, langs, sidewaysScroll, textProblems } from "./helpers";
import { stubPayments } from "./pay-helpers";

const LONG = "A".repeat(80);
const ID = "00000000-0000-4000-8000-0000000000c9";
const sizes = ["100%", "130%", "200%"] as const;

async function setup(page: Page, lang: string) {
  const { dues, roster } = await signedIn(page, {
    lang,
    students: [
      { id: ID, name: LONG, monthly_fee: 120000, due_day: 5, parent_name: "Suresh Kumar" },
      { id: S.asha, name: "Asha Rao", monthly_fee: 100000, due_day: 1 },
      { id: S.ravi, name: "Ravi Kumar", monthly_fee: 120000, due_day: 5 },
    ],
    batches: [],
    dues: [
      { student_id: ID, due_date: "2026-10-05", amount: 100000000 },
      { student_id: S.asha, due_date: "2026-10-01", amount: 100000 },
      { student_id: S.ravi, due_date: "2026-10-05", amount: 120000 },
    ],
  });
  const pay = await stubPayments(page, dues);
  const due = (student: string) => dues.dues.find((d) => d.student_id === student)!.id;
  const claims = await stubClaims(page, dues, pay, roster, [
    { student_id: ID, due_id: due(ID), amount: 100000000, created_at: "2026-10-12T03:00:00Z" },
    { student_id: S.asha, due_id: due(S.asha), amount: 100000, upi_ref: "111122223333", created_at: "2026-10-11T16:10:00Z" },
    { student_id: S.ravi, due_id: due(S.ravi), amount: 120000, status: "confirmed", handled_at: "2026-10-06T06:00:00Z", confirm_request_id: "00000000-0000-4000-8000-0000000000f1", confirmed_receipt_from: 214, confirmed_receipt_count: 2 },
    { student_id: S.ravi, due_id: due(S.ravi), amount: 100000, upi_ref: "999988887777", status: "rejected", handled_at: "2026-10-02T06:00:00Z" },
  ]);
  return { claims };
}

async function checkControls(page: Page, where: string) {
  for (const el of await page.locator("main a:visible, main button:visible").all()) {
    expect((await box(el)).height, `a control in ${where}`).toBeGreaterThanOrEqual(44);
  }
}

// Every word in a card's buttons sits on one line: a label may wrap between words, never inside one ("Not / receiv /
// ed" was the defect at 360px). Each word is measured with a Range: a word broken across lines has rects on two lines.
function brokenWords(page: Page): Promise<string[]> {
  return page.locator("main article button:visible").evaluateAll((buttons) => {
    const broken: string[] = [];
    for (const button of buttons) {
      const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        for (const match of (node.textContent ?? "").matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const tops = new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top)));
          if (tops.size > 1) broken.push(`${match[0]} in "${button.textContent?.trim()}"`);
        }
      }
    }
    return broken;
  });
}

for (const lang of langs) {
  test.describe(`/${lang}/`, () => {
    test("Home's chip", async ({ page }) => {
      test.setTimeout(90_000);
      await setup(page, lang);
      await page.goto(`/${lang}/home/`);
      const chip = page.locator(`a[href="/${lang}/claims/"]`).filter({ hasText: /2/ });
      await expect(chip).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        expect((await box(chip)).height, `the chip at ${size}`).toBeGreaterThanOrEqual(44);
        await expect(chip).toBeInViewport({ ratio: 1 });
      }
      expect(await chip.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
    });

    test("the inbox", async ({ page }) => {
      test.setTimeout(90_000);
      await setup(page, lang);
      await page.goto(`/${lang}/claims/`);
      const long = page.getByRole("article").filter({ hasText: LONG });
      await expect(long).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        expect(await textProblems(page, "main"), `text problems at ${size}`).toEqual([]);
        await checkControls(page, `the inbox at ${size}`);
        expect(await brokenWords(page), `a word broken across lines in a card button at ${size}`).toEqual([]);
        // Confirm is reachable on the card with the longest name, whole in the window after scrolling to it.
        const confirm = long.getByRole("button").last();
        await confirm.scrollIntoViewIfNeeded();
        await expect(confirm).toBeInViewport({ ratio: 1 });
        expect((await box(confirm)).height).toBeGreaterThanOrEqual(52);
        // The amount is whole and in 0 to 9 digits.
        await expect(long.getByText("₹10,00,000")).toBeVisible();
        const amount = await long.getByText("₹10,00,000").evaluate((el) => ({ w: el.scrollWidth, c: el.clientWidth }));
        expect(amount.w).toBeLessThanOrEqual(amount.c + 1);
        expect(await page.locator("main").textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
        // Nothing is cut with an ellipsis.
        expect(await page.locator("main *").evaluateAll((els) => els.filter((el) => getComputedStyle(el).textOverflow === "ellipsis").length)).toBe(0);
      }
    });

    test("Not received and its question: no word in a card button breaks across lines", async ({ page }) => {
      test.setTimeout(90_000);
      await setup(page, lang);
      await page.goto(`/${lang}/claims/`);
      const card = page.getByRole("article").filter({ hasText: "Asha Rao" });
      await expect(card).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await brokenWords(page), `at rest, at ${size}`).toEqual([]);
        // Not received is the first of the two buttons; it grows in height and is never under 44px.
        const notReceived = card.getByRole("button").nth(-2);
        expect((await box(notReceived)).height, `Not received at ${size}`).toBeGreaterThanOrEqual(52);
      }
      await page.evaluate(() => document.documentElement.style.removeProperty("font-size"));
      await card.getByRole("button").nth(-2).click();
      await expect(card.getByRole("alert")).toBeVisible();
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll while asking at ${size}`).toBe(0);
        expect(await brokenWords(page), `while asking, at ${size}`).toEqual([]);
        await checkControls(page, `the question at ${size}`);
      }
    });

    test("Earlier: the status is words and a mark, whatever the colour", async ({ page }) => {
      test.setTimeout(90_000);
      await setup(page, lang);
      await page.goto(`/${lang}/claims/`);
      const rows = page.locator("section li");
      await expect(rows).toHaveCount(2);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        for (const row of await rows.all()) {
          expect((await box(row)).height).toBeGreaterThanOrEqual(56);
          // A mark (a tick or a cross) sits beside the words.
          expect(await row.locator("svg").count()).toBe(1);
          expect((await row.textContent())?.trim().length).toBeGreaterThan(10);
        }
      }
      // The words are in the page's language (the date and numbers stay 0 to 9).
      expect(await rows.first().textContent()).toMatch(/\b2026\b/);
    });
  });
}
