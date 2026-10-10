// Spec R1-1, the states of the signed-in app (criteria 19, 20, 26, 46 and 49): a session that cannot be
// checked because the network is down, the loading, error and missing-profile screens in every language
// at larger text, the sign-in screen's messages at larger text, and nothing leaving from More. Runs against
// a build made with the CI's made-up Supabase address (see auth-helpers.ts).
import { expect, test, type Page } from "@playwright/test";
import { SESSION_KEY, completeTutor, fakeSession, seedSession, stubSupabase, watchOtherHosts } from "./auth-helpers";
import { box, langs, messageText, sidewaysScroll, textProblems, type Lang } from "./helpers";

const ORIGIN = "http://localhost:4173";
const error = (page: Page) => page.locator('[role="alert"][data-kind="error"]');
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k) !== null, SESSION_KEY);

/** No sideways scroll, no cut text, every link and button at least 44px, at 100% and at 130% (the phone's "large" text). */
async function holdsAtLargeText(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  for (const size of ["100%", "130%"]) {
    await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
    expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
    expect(await textProblems(page, "body"), `text problems at ${size}`).toEqual([]);
    for (const el of await page.locator("a, button").all()) {
      expect((await box(el)).height, `a link or button at ${size}`).toBeGreaterThanOrEqual(44);
    }
  }
}

test.describe("20: the session cannot be checked because the network is down", () => {
  test("says so with Try again, keeps the stored session, and carries on once the network is back", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    stub.tokenDown = true;
    // The library waits and retries a renewal for about half a minute, then holds the failure for a minute
    // (a cooldown of its own). A fake clock lets the test pass that time without waiting for it.
    await page.clock.install();
    // A token that has run out, so the library must reach the server to renew it.
    await seedSession(page, fakeSession("meena@example.com", -120));
    await page.goto("/en/home/");
    await expect(page.getByRole("status")).toHaveText("Opening your book…");
    for (let i = 0; i < 40 && (await error(page).count()) === 0; i++) {
      await page.clock.fastForward(5_000);
      await page.waitForTimeout(100);
    }
    await expect(error(page)).toContainText("Couldn't load your details");
    await expect(error(page)).toContainText("The network dropped. Nothing is lost.");
    expect(page.url()).toBe(`${ORIGIN}/en/home/`);
    // Not signed out: the session is kept and no "you were signed out" message was left.
    expect(await stored(page)).toBe(true);
    // The network is back, and the library's own cooldown after a failed renewal has passed.
    stub.tokenDown = false;
    await page.clock.fastForward(90_000);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    expect(page.url()).toBe(`${ORIGIN}/en/home/`);
  });
});

test.describe("20 (review fix): a session the server refuses, and a server that keeps failing", () => {
  test("a 401 on the tutor's row ends on the sign-in screen with the expired message, signed out", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    stub.tutorReadStatus = 401;
    await seedSession(page);
    await page.goto("/en/home/");
    await expect(page).toHaveURL(`${ORIGIN}/en/sign-in/`);
    await expect(error(page)).toHaveText(messageText("en", "signIn.expired"));
    expect(await stored(page)).toBe(false);
  });

  test("a 503 shows the banner with Try again and Sign out, and Sign out leaves for sign-in", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    stub.tutorReadStatus = 503;
    await seedSession(page);
    await page.goto("/en/home/");
    await expect(error(page)).toContainText("The network dropped. Nothing is lost.");
    await expect(error(page).getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(error(page).getByRole("button", { name: "Sign out" })).toBeVisible();
    // Try again reads again, and it still fails: no way to get stuck.
    await error(page).getByRole("button", { name: "Try again" }).click();
    await expect(error(page).getByRole("button", { name: "Sign out" })).toBeVisible();
    await error(page).getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(`${ORIGIN}/en/sign-in/`);
    expect(await stored(page)).toBe(false);
  });
});

test.describe("33, 46: the loading screen in every language at larger text", () => {
  for (const lang of langs) {
    test(`/${lang}/home/ while the row is read: the words, no sideways scroll, nothing cut`, async ({ page }) => {
      const stub = await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
      stub.tutorDelayMs = 4000;
      await seedSession(page);
      await page.goto(`/${lang}/home/`);
      const status = page.getByRole("status");
      await expect(status).toHaveText(messageText(lang, "appState.loading"));
      await holdsAtLargeText(page);
      await expect(status).toHaveCount(0, { timeout: 15_000 });
    });
  }
});

test.describe("26, 46: a missing profile row, in every language at larger text", () => {
  for (const lang of langs) {
    test(`/${lang}/home/: says to sign out and in again, offers Sign out and no Try again`, async ({ page }) => {
      await stubSupabase(page, { tutor: null });
      await seedSession(page);
      await page.goto(`/${lang}/home/`);
      await expect(error(page)).toContainText(messageText(lang, "setup.rowMissing"));
      await expect(error(page).getByRole("button")).toHaveCount(1);
      await expect(error(page).getByRole("button", { name: messageText(lang, "more.signOut") })).toBeVisible();
      await holdsAtLargeText(page);
    });
  }
});

test.describe("9, 11, 19, 46: what the sign-in screen can say, in every language at larger text", () => {
  const cases: [string, (lang: Lang) => string, (page: Page, lang: Lang) => Promise<void>][] = [
    [
      "cancelled",
      (lang) => messageText(lang, "signIn.cancelled"),
      async (page, lang) => {
        await page.goto(`/${lang}/auth/callback/?error=access_denied`);
      },
    ],
    [
      "failed",
      (lang) => messageText(lang, "signIn.failed"),
      async (page, lang) => {
        await page.goto(`/${lang}/auth/callback/`);
      },
    ],
  ];
  for (const lang of langs) {
    for (const [name, words, open] of cases) {
      test(`/${lang}/: ${name}`, async ({ page }) => {
        await stubSupabase(page);
        await open(page, lang);
        await expect(page).toHaveURL(new RegExp(`/${lang}/sign-in/$`));
        await expect(error(page)).toHaveText(words(lang));
        await holdsAtLargeText(page);
      });
    }

    test(`/${lang}/: expired`, async ({ page }) => {
      const stub = await stubSupabase(page, { tutor: completeTutor() });
      stub.refuseToken = true;
      await seedSession(page, fakeSession("meena@example.com", -120));
      await page.goto(`/${lang}/home/`);
      await expect(page).toHaveURL(new RegExp(`/${lang}/sign-in/$`));
      await expect(error(page)).toHaveText(messageText(lang, "signIn.expired"));
      await holdsAtLargeText(page);
    });

    test(`/${lang}/: offline`, async ({ page, context }) => {
      await stubSupabase(page);
      await page.goto(`/${lang}/sign-in/`);
      const google = page.getByRole("button", { name: messageText(lang, "signIn.google") });
      await expect(google).toBeVisible();
      await context.setOffline(true);
      await google.click();
      await expect(error(page)).toHaveText(messageText(lang, "signIn.offline"));
      await holdsAtLargeText(page);
    });
  }
});

test.describe("49: More talks only to itself and the Supabase host", () => {
  test("opening More sets no cookie, reads only the tutor's own row and sends no write", async ({ page, context }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    const others = watchOtherHosts(page, ORIGIN);
    await seedSession(page);
    await page.goto("/en/more/");
    await expect(page.locator("h1")).toHaveText("More");
    await page.waitForTimeout(400);
    expect(others).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    expect(stub.patches).toEqual([]);
    expect(stub.unknown).toEqual([]);
  });
});
