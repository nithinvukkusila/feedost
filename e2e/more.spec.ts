// Spec R1-1, the More screen and the language change (criteria 34, 35 and 36, and 46 for this page). Runs
// against a build made with the CI's made-up Supabase address; Playwright answers every request to it
// (see auth-helpers.ts).
import { expect, test } from "@playwright/test";
import { localeNames } from "../src/config/locales";
import { completeTutor, seedSession, stubSupabase } from "./auth-helpers";
import { box, langs, messageText, sidewaysScroll, textProblems } from "./helpers";

const ORIGIN = "http://localhost:4173";

test.describe("34: what More shows", () => {
  test("the profile, Edit, Language, Sign out and Back to home, and nothing else", async ({ page }) => {
    await stubSupabase(page, { tutor: completeTutor({ subjects: ["maths", "science", "Sanskrit"] }) });
    await seedSession(page);
    await page.goto("/en/more/");
    await expect(page.locator("h1")).toHaveText("More");
    const profile = page.getByRole("region", { name: "Your profile" });
    await expect(profile.getByText("Meena Iyer", { exact: true })).toBeVisible();
    await expect(profile.getByText("Maths, Science, Sanskrit", { exact: true })).toBeVisible();
    await expect(profile.getByText("meena.tuitions@okhdfc", { exact: true })).toBeVisible();
    await expect(profile.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/en/setup/profile/");
    await expect(page.getByRole("link", { name: /Language/ })).toHaveAttribute("href", "/en/language/");
    await expect(page.getByRole("link", { name: /Language/ })).toContainText("English");
    await expect(page.getByRole("link", { name: /Back to home/ })).toHaveAttribute("href", "/en/home/");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    // Three links and one button: no Pro, export, help or delete account.
    await expect(page.locator("main a")).toHaveCount(3);
    await expect(page.locator("main button")).toHaveCount(1);
    for (const word of [/Pro\b/, /export/i, /help/i, /delete/i]) await expect(page.getByText(word)).toHaveCount(0);
  });

  test("Edit opens step 1 with the saved values; Back to home goes home; both without a page load", async ({ page }) => {
    await stubSupabase(page, { tutor: completeTutor() });
    await seedSession(page);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    await page.evaluate(() => ((window as unknown as { kept: number }).kept = 1));
    await page.getByRole("link", { name: "More", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/more\/$/);
    await expect(page.locator("h1")).toHaveText("More");
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page).toHaveURL(/\/en\/setup\/profile\/$/);
    await expect(page.getByLabel("Your name")).toHaveValue("Meena Iyer");
    await page.goBack();
    await page.getByRole("link", { name: /Back to home/ }).click();
    await expect(page).toHaveURL(/\/en\/home\/$/);
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    // The page was never reloaded: the script's own marker is still there.
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(1);
  });

  test("a signed-out visitor never sees More", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/en/more/");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
  });
});

test.describe("35, 36: changing the language from More", () => {
  test("Language, then a language, then Continue, lands on home in the new language and saves it to the tutor's row", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor({ language: "en" }) });
    await seedSession(page);
    await page.goto("/en/more/");
    await page.getByRole("link", { name: /Language/ }).click();
    await expect(page).toHaveURL(/\/en\/language\/$/);
    await page.getByRole("link", { name: new RegExp(localeNames.hi) }).click();
    await expect(page).toHaveURL(/\/hi\/language\/$/);
    await page.getByRole("link", { name: messageText("hi", "language.continue") }).click();
    // Sign-in sends a signed-in tutor straight on; home in the new language.
    await expect(page).toHaveURL(/\/hi\/home\/$/);
    await expect(page.locator("h1")).toBeVisible();
    await expect.poll(() => stub.patches.length).toBe(1);
    expect(stub.patches[0]).toEqual({ language: "hi" });
    expect(stub.tutor?.language).toBe("hi");
    expect(await page.evaluate(() => localStorage.getItem("ui-language"))).toBe("hi");
    expect(await page.evaluate(() => document.documentElement.lang)).toBe("hi");
    // Where the tutor is now: More in Hindi names Hindi as the language.
    await page.goto("/hi/more/");
    await expect(page.getByRole("link", { name: new RegExp(localeNames.hi) })).toHaveAttribute("href", "/hi/language/");
  });

  test("a failed language save is ignored: the page still shows", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor({ language: "en" }) });
    stub.refuseWrites = true;
    await seedSession(page);
    await page.goto("/te/more/");
    await expect(page.locator("h1")).toBeVisible();
    await expect.poll(() => stub.patches.length).toBe(1);
    await page.waitForTimeout(300);
    expect(page.url()).toBe(`${ORIGIN}/te/more/`);
    await expect(page.locator('[role="alert"][data-kind="error"]')).toHaveCount(0);
  });
});

test.describe("46: More in each language, at 360px and with larger text", () => {
  for (const lang of langs) {
    test(`/${lang}/more/: a long name, long subjects and a long UPI ID wrap; nothing is cut; every link and button at least 44px, at 100% and at 130%`, async ({ page }) => {
      await stubSupabase(page, {
        tutor: completeTutor({
          language: lang,
          name: "Lakshmi Narasimhan Venkataramanan Subramaniam Iyengar",
          subjects: ["maths", "science", "english", "hindi", "physics", "chemistry", "accounts", "Sanskrit grammar"],
          upi_id: "lakshmi.narasimhan.venkataramanan.tuitions@okhdfcbank",
        }),
      });
      await seedSession(page);
      await page.goto(`/${lang}/more/`);
      await expect(page.locator("h1")).toHaveText(messageText(lang, "more.title"));
      await page.evaluate(() => document.fonts.ready);
      for (const size of ["100%", "130%"]) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        expect(await textProblems(page, "body"), `text problems at ${size}`).toEqual([]);
        for (const el of await page.locator("a, button").all()) {
          expect((await box(el)).height, `a link or button at ${size}`).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }
});
