// Spec docs/specs/parent-pages-english.md, criteria 1, 2, 4 and 5: with the review records as they are on main (hi, kn
// and te "not reviewed"), every state of /p/{token} and /r/{token} shows only English words, whatever the student's
// language or the browser's, with no language button and `lang="en"`. Names stay as saved, in any script, with
// translate="no"; amounts and dates use 0-9 digits. The functions are answered by page.route, as in the other specs.
import { expect, test, type Page } from "@playwright/test";
import { fontsSettled, messageText as text } from "./helpers";
import { fee, link as payLink, notice, stubPayPage } from "./pay-page-helpers";
import { cancelled, link as receiptLink, okBody, stubReceipt } from "./receipt-public-helpers";

const studentLanguages = ["en", "hi", "kn", "te"] as const;
const browsers = { hi: "hi-IN", kn: "kn-IN", te: "te-IN" } as const;
// A Telugu tutor and a Hindi student: names are shown as saved, in their own script, and set apart from the words.
const names = { tutor_name: "మీనా అయ్యర్", student_name: "रवि कुमार" };
const INDIC = /[ऀ-ॿఀ-౿ಀ-೿]/;
const INDIC_DIGITS = /[०-९౦-౯೦-೯]/;

/** What the page says outside the saved names: its text and its accessible labels, with every translate="no" part taken out. */
async function words(page: Page): Promise<string> {
  return page.locator("main").evaluate((main) => {
    const copy = main.cloneNode(true) as HTMLElement;
    for (const name of copy.querySelectorAll('[translate="no"]')) name.remove();
    const labels = [...copy.querySelectorAll("[aria-label], [title], [alt]")].map((el) => [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("alt")].join(" "));
    return `${copy.textContent ?? ""} ${labels.join(" ")}`;
  });
}

/** Criteria 1, 2 and 4 on whatever state is drawn: English words only, `lang="en"` on <html> and <main>, no Anek, no language button. */
async function expectEnglish(page: Page, state: string) {
  const main = page.locator("main");
  await expect(main).toHaveAttribute("data-state", state);
  await fontsSettled(page);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(main).toHaveAttribute("lang", "en");
  expect(await words(page), `${state}: words outside names`).not.toMatch(INDIC);
  expect(await main.textContent(), `${state}: digits`).not.toMatch(INDIC_DIGITS);
  expect(await page.content()).not.toContain("TODO-translate");
  await expect(main.locator('[aria-haspopup="dialog"]')).toHaveCount(0);
  await expect(main.getByRole("button", { name: /^(English|हिन्दी|ಕನ್ನಡ|తెలుగు)$/ })).toHaveCount(0);
  // The English words are in the Latin stack, never an Indic Anek face (criterion 4). "Anek Latin" is a fallback name
  // in every stack, so the test is the Devanagari, Kannada and Telugu faces.
  const families = await main.evaluate((el) => [...el.querySelectorAll("h1, h2, p, button, a")].filter((n) => !n.closest('[translate="no"]')).map((n) => getComputedStyle(n).fontFamily));
  expect(families.length, `${state}: something to measure`).toBeGreaterThan(0);
  for (const family of families) expect(family, `${state}: font`).not.toMatch(/Anek (Devanagari|Kannada|Telugu)/i);
}

/** Criterion 5: each name is on the page as saved, inside a translate="no" part. */
async function expectNames(page: Page, saved: readonly string[]) {
  for (const name of saved) await expect(page.locator('main [translate="no"]', { hasText: name }).first()).toBeVisible();
}

test.describe("/p/ is English while only English is unlocked (criteria 1, 4 and 5)", () => {
  test("the shell itself holds no Hindi, Kannada or Telugu text", async ({ request }) => {
    const shell = await (await request.get(payLink())).text();
    expect(shell).not.toMatch(INDIC);
  });

  for (const language of studentLanguages) {
    test(`a ${language} student: consent, the privacy notice, the fee page and all paid`, async ({ page }) => {
      await stubPayPage(page, { pay: (call) => (call === 1 ? notice({ ...names, language }) : fee({ ...names, language })) });
      await page.goto(payLink());
      await expectEnglish(page, "consent");
      await expect(page.locator("main h1")).toHaveText(text("en", "payPage.consent.title"));
      await expectNames(page, [names.tutor_name, names.student_name]);

      await page.locator("main").getByRole("button", { name: text("en", "payPage.consent.agree") }).click();
      await expectEnglish(page, "fee");
      await expect(page.locator("main")).toContainText(text("en", "payPage.total"));
      await expectNames(page, [names.tutor_name]);
      // The amount in its face, 0-9 digits; dates the same.
      await expect(page.locator("main .type-amount")).toHaveText("₹3,400");
      await expect(page.locator("main")).toContainText("2026");

      await page.locator("main").getByRole("button", { name: text("en", "payPage.consent.notice") }).click();
      await expectEnglish(page, "notice");

      await page.unrouteAll();
      await stubPayPage(page, { pay: fee({ ...names, language, total_remaining: 0, open_dues: [] }) });
      await page.goto(payLink());
      await expectEnglish(page, "fee");
      await expect(page.locator("main")).toContainText(text("en", "payPage.allPaid"));
    });
  }

  for (const [lang, locale] of Object.entries(browsers)) {
    test.describe(`with the browser in ${locale}`, () => {
      test.use({ locale });

      test("opening, not found, too many tries and failed are English", async ({ page }) => {
        expect(await page.evaluate(() => navigator.language)).toBe(locale);
        await stubPayPage(page, { pay: "never" });
        await page.goto(payLink());
        await expectEnglish(page, "loading");
        await expect(page.locator("main")).toContainText(text("en", "payPage.loading"));

        for (const [status, code, state, key] of [
          [404, "not_found", "not_found", "payPage.state.notFound"],
          [429, "rate_limited", "rate_limited", "payPage.state.rateLimited"],
          [500, "error", "failed", "payPage.state.error"],
        ] as const) {
          await page.unrouteAll();
          await stubPayPage(page, { pay: { status, body: { code } } });
          await page.goto(payLink());
          await expectEnglish(page, state);
          await expect(page.locator("main")).toContainText(text("en", key));
        }
      });

      test(`a ${lang} student's fee page is English too`, async ({ page }) => {
        await stubPayPage(page, { pay: fee({ ...names, language: lang }) });
        await page.goto(payLink());
        await expectEnglish(page, "fee");
      });
    });
  }
});

test.describe("/r/ is English while only English is unlocked (criteria 2, 4 and 5)", () => {
  const people = { tutor_name: "మీనా అయ్యర్", student_name: "रवि कुमार", parent_name: "ಸುರೇಶ್ ಕುಮಾರ್" };

  test("the shell itself holds no Hindi, Kannada or Telugu text", async ({ request }) => {
    const shell = await (await request.get(receiptLink())).text();
    expect(shell).not.toMatch(INDIC);
  });

  for (const language of studentLanguages) {
    test(`a ${language} receipt: paid, part paid and cancelled`, async ({ page }) => {
      await stubReceipt(page, okBody({ ...people, language }));
      await page.goto(receiptLink());
      await expectEnglish(page, "ok");
      await expect(page.locator("[data-status=paid]")).toHaveText(text("en", "receipt.paid"));
      await expectNames(page, [people.tutor_name, people.student_name, people.parent_name]);
      await expect(page.locator("main")).toContainText("₹1,200/-");
      await expect(page.locator("main")).toContainText("08 Oct 2026");

      await page.unrouteAll();
      await stubReceipt(page, okBody({ ...people, language, balance_after: 20000, status: "part_paid" }));
      await page.goto(receiptLink());
      await expectEnglish(page, "ok");
      await expect(page.locator("[data-status=part-paid]")).toHaveText(text("en", "receipt.partPaid"));

      await page.unrouteAll();
      await stubReceipt(page, { status: 200, body: { code: "ok", receipt: { ...cancelled, ...people, language } } });
      await page.goto(receiptLink());
      await expectEnglish(page, "cancelled");
      await expect(page.locator("main")).toContainText(text("en", "receipt.cancelled.title"));
      await expectNames(page, [people.student_name]);
    });
  }

  for (const [lang, locale] of Object.entries(browsers)) {
    test.describe(`with the browser in ${locale}`, () => {
      test.use({ locale });

      test("opening, not found, too many tries and failed are English", async ({ page }) => {
        expect(await page.evaluate(() => navigator.language)).toBe(locale);
        await stubReceipt(page, "never");
        await page.goto(receiptLink());
        await expectEnglish(page, "loading");
        await expect(page.locator("main")).toContainText(text("en", "receipt.loading"));

        for (const [status, code, state, key] of [
          [404, "not_found", "not_found", "receipt.notFound.title"],
          [429, "rate_limited", "rate_limited", "receipt.rateLimited.title"],
          [500, "error", "failed", "receipt.failed.title"],
        ] as const) {
          await page.unrouteAll();
          await stubReceipt(page, { status, body: { code } });
          await page.goto(receiptLink());
          await expectEnglish(page, state);
          await expect(page.locator("main")).toContainText(text("en", key));
        }
      });

      test(`a ${lang} receipt is English too`, async ({ page }) => {
        await stubReceipt(page, okBody({ ...people, language: lang }));
        await page.goto(receiptLink());
        await expectEnglish(page, "ok");
      });
    });
  }
});
