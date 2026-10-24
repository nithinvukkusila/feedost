// Spec R1-9 Part B, criterion 34: the parent's pay page at 360px and at larger text, in en, hi, kn and te, with an
// 80-character student name with no spaces, an 80-character tutor name, 8 subjects, a total of ₹10,00,000, 24 fee
// lines, a Telugu tutor name and a Hindi student name: no sideways scroll, every control 44px (Pay 72px), nothing under
// 14px, nothing cut with an ellipsis, the amount never cut, status a word plus a mark under grayscale.
// English runs on /p/ itself; hi, kn and te on /dev/unlocked/p/, where a test fixture unlocks them (spec
// parent-pages-english, criterion 10), so a sign-off never waits on a layout fix.
import { expect, test } from "@playwright/test";
import { box, fontsSettled, langs, sidewaysScroll, textProblems } from "./helpers";
import { draftConsentLink, feeBody, notice, pageLink, stubPayPage } from "./pay-page-helpers";

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

// The browser's language too, so the states with no data (failed) are laid out in that language and not in English.
const browserLocale = { en: "en-IN", hi: "hi-IN", kn: "kn-IN", te: "te-IN" } as const;

for (const lang of langs) {
  test.describe(`/p/ in ${lang}`, () => {
    test.use({ locale: browserLocale[lang] });
    test("the fee page with the longest of everything", async ({ page }) => {
      test.setTimeout(120_000);
      await stubPayPage(page, { pay: { status: 200, body: { code: "ok", page: { ...feeBody, ...heavy(lang) } } } });
      await page.goto(pageLink(lang));
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "fee");
      // Laid out in {lang} itself: the fixture page must really show it (criterion 10).
      await expect(main).toHaveAttribute("lang", lang);
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

    // Spec R1-10 Part C, criterion 40: the claim sheet with 80-character names, a refusal and the success words, at
    // 100%, 130% and 200%, then with half the screen taken by the keypad: no sideways scroll, every control 44px (Send
    // 62px), nothing under 14px, nothing cut, the sheet scrolls and Send can be reached. Digits and ₹ stay 0-9.
    test("the claim sheet with the longest names, a refusal and the keypad open", async ({ page }) => {
      test.setTimeout(150_000);
      await stubPayPage(page, {
        pay: { status: 200, body: { code: "ok", page: { ...feeBody, ...heavy(lang) } } },
        claim: (call) => (call === 1 ? { status: 409, body: { code: "duplicate_reference" } } : { status: 200, body: { code: "ok" } }),
      });
      await page.goto(pageLink(lang));
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "fee");
      await expect(main).toHaveAttribute("lang", lang);
      await main.locator("[data-claim=ask] button").click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();
      await sheet.getByRole("textbox").fill("6281 0473 9915");
      const send = sheet.locator('button[type="submit"]');
      await send.click();
      await expect(sheet.locator("[data-claim=problem]")).not.toBeEmpty();
      await fontsSettled(page);
      await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
      // As pay-layout.spec.ts does for the Mark paid sheet: measured from the top of the sheet (a scrolled sheet has
      // content behind its pinned title, which is not a fault), and the text checks at the default size; at the larger
      // sizes the header scrolls inside itself and the checks are reachability, controls and sideways scroll.
      const check = async (label: string, text: boolean) => {
        expect(await sidewaysScroll(page), `sideways scroll ${label}`).toBe(0);
        await sheet.evaluate((el) => el.querySelectorAll("*").forEach((node) => void (node.scrollTop = 0)));
        for (const el of await sheet.locator("a:visible, button:visible").all()) expect((await box(el)).height, `control ${label}`).toBeGreaterThanOrEqual(44);
        if (text) expect(await textProblems(page, "dialog"), `text problems ${label}`).toEqual([]);
        expect(await sheet.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
        await expect(sheet.locator('[translate="no"]', { hasText: "T".repeat(80) }).first()).toBeAttached();
      };
      // The reference is never cut (criterion 40, "nothing cut"): the field shows the whole grouped value, wrapping onto
      // another line rather than scrolling it out of sight, at every size and in the needs-fixing state too.
      const input = sheet.getByRole("textbox");
      const fieldWhole = async (value: string, label: string) => {
        await expect(input).toHaveValue(value);
        const fits = await input.evaluate((el) => ({ width: el.scrollWidth <= el.clientWidth, height: el.scrollHeight <= el.clientHeight + 1 }));
        expect(fits, `the reference "${value}" is whole ${label}`).toEqual({ width: true, height: true });
      };
      for (const size of sizes) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        await fontsSettled(page);
        await fieldWhole("6281 0473 9915", `at ${size}`);
        // The needs-fixing state: 11 digits refused on the phone (no request), with its words and mark beside the field.
        await input.fill("6281 0473 991");
        await send.click();
        await expect(input).toHaveAttribute("aria-invalid", "true");
        await fieldWhole("6281 0473 991", `in the error state at ${size}`);
        if (size === "100%") {
          await sheet.evaluate((el) => el.querySelectorAll("*").forEach((node) => void (node.scrollTop = 0)));
          expect(await textProblems(page, "dialog"), `text problems in the error state at ${size}`).toEqual([]);
        }
        await input.fill("6281 0473 9915");
        await check(`at ${size}`, size === "100%");
        await send.scrollIntoViewIfNeeded();
        await expect(send).toBeInViewport();
        expect((await box(send)).height, `Send at ${size}`).toBeGreaterThanOrEqual(62);
      }
      // The keypad open: half the screen. The panel scrolls inside itself and Send is still reachable.
      await page.setViewportSize({ width: 360, height: 400 });
      await sheet.getByRole("textbox").focus();
      await send.scrollIntoViewIfNeeded();
      await expect(send).toBeInViewport();
      // At 200% an 80-character name makes Send taller than this half screen, so the tap is checked in the middle of
      // the part of it that is on screen: Send is what is there, nothing pinned sits over it.
      const tappable = await send.evaluate((el) => {
        // The panel that scrolls clips Send: the part that can be tapped is inside both the panel and the window.
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
      // The success words, laid out the same way.
      await send.click();
      await expect(sheet.locator("[data-claim=sent]")).toBeVisible();
      await page.setViewportSize({ width: 360, height: 800 });
      await check("after sending, at 200%", false);
      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "100%"));
      await fontsSettled(page);
      await check("after sending, at 100%", true);
    });

    test("the consent screen with a Telugu tutor name and a Hindi student name", async ({ page }) => {
      test.setTimeout(90_000);
      await stubPayPage(page, { pay: notice({ language: lang, tutor_name: "మీనా అయ్యర్ ట్యూషన్స్", student_name: "रवि कुमार शर्मा", tutor_subjects: subjects }) });
      await page.goto(pageLink(lang));
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "consent");
      // Laid out in {lang} itself: the fixture page must really show it (criterion 10).
      await expect(main).toHaveAttribute("lang", lang);
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
      await page.goto(pageLink(lang));
      await expect(page.locator("main")).toHaveAttribute("data-state", "consent");
      // Laid out in {lang} itself: the fixture page must really show it (criterion 10).
      await expect(page.locator("main")).toHaveAttribute("lang", lang);
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
      await page.goto(pageLink(lang));
      const main = page.locator("main");
      await expect(main).toHaveAttribute("data-state", "failed");
      // Laid out in {lang} itself: the fixture page must really show it (criterion 10).
      await expect(main).toHaveAttribute("lang", lang);
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

// Spec parent-pages-english, criteria 4 and 10: a language signed while the consent wording is still a draft. The
// consent screen and the notice link are English inside a hi, kn or te page, and say so with lang="en", so they are
// laid out in the Latin face and line height while the rest of the page is in the language's own.
for (const lang of ["hi", "kn", "te"] as const) {
  test.describe(`/p/ in ${lang} with the consent wording a draft`, () => {
    test.use({ locale: browserLocale[lang] });
    test("the consent screen and the privacy notice: English lines marked en, at 100%, 130% and 200%", async ({ page }) => {
      test.setTimeout(120_000);
      await stubPayPage(page, {
        pay: (call) => (call === 1 ? notice({ language: lang, tutor_name: "మీనా అయ్యర్ ట్యూషన్స్", student_name: "रवि कुमार शर्मा", tutor_subjects: subjects }) : { status: 200, body: { code: "ok", page: { ...feeBody, ...heavy(lang) } } }),
      });
      await page.goto(draftConsentLink());
      const main = page.locator("main");
      for (const state of ["consent", "notice"] as const) {
        if (state === "notice") {
          await main.locator("section button").first().click();
          await expect(main).toHaveAttribute("data-state", "fee");
          const link = main.locator('button[lang="en"]');
          await expect(link).toHaveCount(1);
          await link.click();
        }
        await expect(main).toHaveAttribute("data-state", state);
        await expect(main).toHaveAttribute("lang", lang);
        const section = main.locator("section[aria-labelledby=consent-title]");
        await expect(section).toHaveAttribute("lang", "en");
        await fontsSettled(page);
        const heading = await section.locator("h1").evaluate((el) => getComputedStyle(el).fontFamily);
        expect(heading, "the English heading is not in an Indic face").not.toMatch(/Anek (Devanagari|Kannada|Telugu)/i);
        for (const size of sizes) {
          await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
          await fontsSettled(page);
          expect(await sidewaysScroll(page), `${state}: sideways scroll at ${size}`).toBe(0);
          for (const el of await main.locator("a:visible, button:visible").all()) expect((await box(el)).height, `${state}: control at ${size}`).toBeGreaterThanOrEqual(44);
          expect(await textProblems(page, "main"), `${state}: text problems at ${size}`).toEqual([]);
        }
        await page.evaluate(() => document.documentElement.style.removeProperty("font-size"));
      }
    });
  });
}
