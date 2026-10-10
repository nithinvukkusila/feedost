// Spec R1-1, the sign-in screen and its callback (criteria 6 to 14, 49). Runs against a build made with
// the CI's made-up Supabase address; Playwright answers every request to it, so no real project and no
// Google is ever contacted (see auth-helpers.ts). The library's code (storage, PKCE, request shape) is real.
import { expect, test, type Page } from "@playwright/test";
import { localeNames } from "../src/config/locales";
import { brand } from "../src/config/brand";
import {
  BUILD_HINT,
  HOST,
  SESSION_KEY,
  completeTutor,
  seedSession,
  seedVerifier,
  stubSupabase,
  watchOtherHosts,
} from "./auth-helpers";
import { box, css, langs, messageText, sidewaysScroll, textProblems, type Lang } from "./helpers";

const ORIGIN = "http://localhost:4173";
const GOOGLE = (lang: Lang) => messageText(lang, "signIn.google");
const text = (lang: Lang, path: string) => messageText(lang, path);
/** The message above the button. (The route announcer Next adds also has role alert, so the role alone is not enough.) */
const notice = (page: Page) => page.locator('[role="alert"][data-kind="error"]');

/** The scripts the HTML of a page names, which are the ones it loads up front. */
async function upFront(page: Page): Promise<Set<string>> {
  const html = await page.evaluate(() => document.documentElement.outerHTML);
  return new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js)[^"]*"/g)].map((m) => new URL(m[1], ORIGIN).pathname));
}

test.describe("6: the screen", () => {
  test("shows the brand, the language link, the headline, three taps, one black Google button and the note; no email field", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/en/sign-in/");
    await expect(page.getByText(brand.name, { exact: true }).first()).toBeVisible();
    const language = page.getByRole("link", { name: localeNames.en });
    await expect(language).toHaveAttribute("href", "/en/language/");
    expect((await box(language)).height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("h1")).toHaveText("Fees collected. Not chased.");
    await expect(page.getByText("Tap 1")).toBeVisible();
    await expect(page.getByText("You tap Remind.", { exact: false })).toBeVisible();
    await expect(page.getByText("WhatsApp opens, message ready.", { exact: false })).toBeVisible();
    await expect(page.getByText("Tap 2")).toBeVisible();
    await expect(page.getByText("The parent taps Pay.", { exact: false })).toBeVisible();
    await expect(page.getByText("UPI opens, amount filled.", { exact: false })).toBeVisible();
    await expect(page.getByRole("img", { name: "Paid" })).toBeVisible();
    await expect(page.getByText("Straight to your UPI.", { exact: false })).toBeVisible();
    await expect(page.getByText("We never hold it.", { exact: false })).toBeVisible();
    await expect(page.getByText("Free for tutors. No password, no OTP.")).toBeVisible();

    const button = page.getByRole("button", { name: "Continue with Google" });
    await expect(button).toBeVisible();
    expect((await box(button)).height).toBeGreaterThanOrEqual(60);
    expect((await css(button, ["background-color"]))["background-color"]).toBe("rgb(26, 20, 16)");
    await expect(page.locator("input, textarea")).toHaveCount(0);
  });

  for (const lang of langs) {
    test(`6, 46: ${lang}: in its own language, no sideways scroll, nothing cut, at 100% and at 130%`, async ({ page }) => {
      await stubSupabase(page);
      await page.goto(`/${lang}/sign-in/`);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.getByRole("button", { name: GOOGLE(lang) })).toBeVisible();
      await expect(page.getByRole("link", { name: localeNames[lang] })).toHaveAttribute("href", `/${lang}/language/`);
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

test.describe("7: tapping the button starts Google sign-in with PKCE", () => {
  test("goes to the project's authorize address with a code challenge and this origin's callback", async ({ page }) => {
    const stub = await stubSupabase(page);
    await page.goto("/en/sign-in/");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect
      .poll(() => stub.authorize.length, { message: `The browser did not go to ${HOST}/auth/v1/authorize. ${BUILD_HINT}` })
      .toBe(1);
    const url = stub.authorize[0];
    expect(url.origin).toBe(HOST);
    expect(url.pathname).toBe("/auth/v1/authorize");
    expect(url.searchParams.get("provider")).toBe("google");
    expect(url.searchParams.get("code_challenge")).toMatch(/^[\w-]{20,}$/);
    expect(url.searchParams.get("code_challenge_method")?.toLowerCase()).toBe("s256");
    expect(url.searchParams.get("redirect_to")).toBe(`${ORIGIN}/en/auth/callback/`);
    // The verifier waits in this origin's storage for the way back. (The page itself is now on the stub's
    // address, so read the page's origin from the browser's saved state.)
    const state = await page.context().storageState();
    const keys = state.origins.find((origin) => origin.origin === ORIGIN)?.localStorage.map((entry) => entry.name) ?? [];
    expect(keys.some((key) => key.startsWith(SESSION_KEY) && key.endsWith("-code-verifier"))).toBe(true);
  });

  test("the callback address follows the page's language", async ({ page }) => {
    const stub = await stubSupabase(page);
    await page.goto("/kn/sign-in/");
    await page.getByRole("button", { name: GOOGLE("kn") }).click();
    await expect.poll(() => stub.authorize.length).toBe(1);
    expect(stub.authorize[0].searchParams.get("redirect_to")).toBe(`${ORIGIN}/kn/auth/callback/`);
  });
});

test.describe("9: offline", () => {
  test("nothing starts, and the page says the phone is offline", async ({ page, context }) => {
    const stub = await stubSupabase(page);
    await page.goto("/en/sign-in/");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(notice(page)).toContainText("You are offline. Connect to the internet to sign in.");
    await page.waitForTimeout(300);
    expect(stub.authorize).toHaveLength(0);
    // The button is back to normal.
    await expect(page.getByRole("button", { name: "Continue with Google" })).not.toHaveAttribute("aria-busy", "true");
  });
});

test.describe("10, 11: the callback", () => {
  test("exchanges the code once, takes it out of the address, and goes on to the app", async ({ page }) => {
    const stub = await stubSupabase(page);
    stub.tokenDelayMs = 700;
    await seedVerifier(page);
    await page.goto("/en/auth/callback/?code=made-up-code");
    await expect(page.getByRole("status")).toHaveText("Signing you in…");
    // While the exchange is under way the address is already clean.
    expect(page.url()).toBe(`${ORIGIN}/en/auth/callback/`);
    await expect(page).toHaveURL(/\/en\/home\/$/);
    const exchanges = stub.where((r) => r.path === "/auth/v1/token");
    expect(exchanges).toHaveLength(1);
    expect(exchanges[0].query).toContain("grant_type=pkce");
    expect(JSON.parse(exchanges[0].body ?? "{}").auth_code).toBe("made-up-code");
    // The session is kept for the next visit.
    expect(await page.evaluate((k) => localStorage.getItem(k) !== null, SESSION_KEY)).toBe(true);
  });

  test("11: Google's Cancel (an error in the query) lands on sign-in with the cancelled message", async ({ page }) => {
    const stub = await stubSupabase(page);
    await page.goto("/en/auth/callback/?error=access_denied&error_description=User+cancelled");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    await expect(notice(page)).toHaveText("Sign-in was cancelled. Tap Continue with Google to try again.");
    expect(stub.where((r) => r.path === "/auth/v1/token")).toHaveLength(0);
    await expect(notice(page)).not.toContainText("access_denied");
  });

  test("11: an error in the hash does the same", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/en/auth/callback/#error=access_denied&error_code=bad_oauth_callback");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    await expect(notice(page)).toHaveText("Sign-in was cancelled. Tap Continue with Google to try again.");
  });

  test("11: a refused code says Google did not finish, with no code shown", async ({ page }) => {
    const stub = await stubSupabase(page);
    stub.refuseToken = true;
    await seedVerifier(page);
    await page.goto("/en/auth/callback/?code=used-code");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    await expect(notice(page)).toHaveText("Google sign-in did not finish. Nothing was saved. Try again.");
  });

  test("11: a callback address with no code (a reload) says Google did not finish", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/en/auth/callback/");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    await expect(notice(page)).toHaveText("Google sign-in did not finish. Nothing was saved. Try again.");
  });

  test("11: a code with no stored verifier (storage cleared, private mode) says Google did not finish", async ({ page }) => {
    const stub = await stubSupabase(page);
    await page.goto("/en/auth/callback/?code=made-up-code");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    await expect(notice(page)).toHaveText("Google sign-in did not finish. Nothing was saved. Try again.");
    expect(stub.where((r) => r.path === "/auth/v1/token")).toHaveLength(0);
  });

  test("11: the message is seen once: a reload shows the form without it", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/en/auth/callback/?error=access_denied");
    await expect(notice(page)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test("the callback keeps the page's language", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/hi/auth/callback/?error=access_denied");
    await expect(page).toHaveURL(/\/hi\/sign-in\/$/);
    await expect(notice(page)).toHaveText(text("hi", "signIn.cancelled"));
  });
});

test.describe("12: the library is fetched only when it is needed", () => {
  test("a first-time visitor's page loads no script that its HTML does not name, until the button is tapped", async ({ page }) => {
    await stubSupabase(page);
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/en/sign-in/");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await page.waitForTimeout(500);
    const named = await upFront(page);
    const extra = scripts.filter((path) => !named.has(path));
    expect(extra, "a script the page did not name was fetched before any tap").toEqual([]);

    const before = scripts.length;
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect.poll(() => scripts.length, { message: "tapping the button should fetch the library's chunk" }).toBeGreaterThan(before);
  });

  test("a stored session fetches it at once", async ({ page }) => {
    await stubSupabase(page, { tutor: completeTutor() });
    await seedSession(page);
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/en/sign-in/");
    await expect(page).toHaveURL(/\/en\/home\/$/);
    expect(scripts.length).toBeGreaterThan(0);
  });
});

test.describe("13: a tutor who is already signed in", () => {
  test("is sent on without the form ever being drawn", async ({ page }) => {
    await stubSupabase(page, { tutor: completeTutor() });
    await seedSession(page);
    // Remember, across the page's loads, if a button ever stood on the screen.
    await page.addInitScript(() => {
      const look = () => {
        if (location.pathname.includes("sign-in") && document.querySelector("main button")) window.sessionStorage.setItem("saw-form", "1");
      };
      new MutationObserver(look).observe(document, { childList: true, subtree: true });
    });
    await page.goto("/en/sign-in/");
    await expect(page).toHaveURL(/\/en\/home\/$/);
    expect(await page.evaluate(() => window.sessionStorage.getItem("saw-form"))).toBeNull();
  });
});

test.describe("49: nothing leaves, nothing is set", () => {
  test("the sign-in page talks only to itself and the Supabase host, and sets no cookie", async ({ page, context }) => {
    await stubSupabase(page);
    const others = watchOtherHosts(page, ORIGIN);
    await page.goto("/en/sign-in/");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await page.waitForTimeout(500);
    expect(others).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });
});
