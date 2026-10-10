// Spec R1-1, the signed-in guard and the empty home (criteria 15 to 20, 32, 33, 46 and 49). Runs against
// a build made with the CI's made-up Supabase address; Playwright answers every request to it
// (see auth-helpers.ts). The guard is a convenience: these tests show what the person sees, not what is safe.
import { expect, test, type Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { HOST, SESSION_KEY, completeTutor, fakeSession, newTutor, seedSession, stubSupabase, watchOtherHosts } from "./auth-helpers";
import { box, langs, messageText, sidewaysScroll, textProblems } from "./helpers";

const ORIGIN = "http://localhost:4173";
const LOADING = "Opening your book…";
const notice = (page: Page) => page.locator('[role="alert"][data-kind="error"]');
const stored = (page: Page) => page.evaluate((k) => localStorage.getItem(k) !== null, SESSION_KEY);

/** Remember, across the page's loads, if the words of the empty home were ever in the DOM. */
async function watchForHomeContent(page: Page) {
  await page.addInitScript(() => {
    const look = () => {
      if ((document.body?.innerText ?? "").includes("Your book is empty.")) window.sessionStorage.setItem("saw-home", "1");
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true, characterData: true });
  });
}
const sawHome = (page: Page) => page.evaluate(() => window.sessionStorage.getItem("saw-home"));

test.describe("15, 16: a signed-out visitor", () => {
  for (const route of ["home", "setup/profile", "setup/upi"]) {
    test(`/en/${route}/ never shows tutor content and is replaced with sign-in`, async ({ page }) => {
      await stubSupabase(page);
      await watchForHomeContent(page);
      await page.goto(`/en/${route}/`);
      await expect(page).toHaveURL(/\/en\/sign-in\/$/);
      await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
      expect(await sawHome(page)).toBeNull();
    });
  }

  test("16: the address is replaced, so Back does not loop", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/en/sign-in/");
    await page.goto("/en/home/");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    await page.goBack();
    await page.waitForTimeout(500);
    expect(page.url()).toBe(`${ORIGIN}/en/sign-in/`);
    await page.goForward();
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
  });

  test("16: the page's language is kept", async ({ page }) => {
    await stubSupabase(page);
    await page.goto("/kn/home/");
    await expect(page).toHaveURL(/\/kn\/sign-in\/$/);
  });

  test("a signed-out visitor needs no library: none of the scripts the page loads is the Supabase client", async ({ page }) => {
    await stubSupabase(page);
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(request.url());
    });
    await page.goto("/en/home/");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    expect(scripts.length).toBeGreaterThan(0);
    for (const url of scripts) {
      const text = await (await page.request.get(url)).text();
      // A private method name only the library has; our own code calls the public one.
      expect(text.includes("_exchangeCodeForSession"), url).toBe(false);
    }
  });
});

test.describe("15, 33: while it is not known yet", () => {
  test("a signed-in tutor sees only the loading words and grey blocks until the row is read", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    stub.tutorDelayMs = 900;
    await seedSession(page);
    await watchForHomeContent(page);
    await page.goto("/en/home/");
    await expect(page.getByRole("status")).toHaveText(LOADING);
    // Nothing of the tutor's is on the screen yet, and the blocks are not read out.
    expect(await sawHome(page)).toBeNull();
    expect(await page.locator("h1").count()).toBe(0);
    expect(await page.locator('[aria-hidden="true"] > section, [aria-hidden="true"]').count()).toBeGreaterThan(0);
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("the static page holds the loading words for a browser that has not run the script yet", async ({ request }) => {
    const raw = await (await request.get("/en/home/")).text();
    expect(raw).toContain(LOADING);
  });
});

test.describe("17: where a signed-in tutor belongs", () => {
  const cases: [string, Parameters<typeof newTutor>[0], string, string][] = [
    ["a new tutor on home", {}, "/en/home/", "/en/setup/profile/"],
    ["a new tutor on step 2", {}, "/en/setup/upi/", "/en/setup/profile/"],
    ["a new tutor on step 1", {}, "/en/setup/profile/", "/en/setup/profile/"],
    ["a blank name on home", { name: "   ", subjects: ["maths"], upi_id: "a@okhdfc" }, "/en/home/", "/en/setup/profile/"],
    ["no subjects on home", { name: "Meena", subjects: [], upi_id: "a@okhdfc" }, "/en/home/", "/en/setup/profile/"],
    ["no UPI ID on home", { name: "Meena", subjects: ["maths"] }, "/en/home/", "/en/setup/upi/"],
    ["no UPI ID on step 1 (Edit)", { name: "Meena", subjects: ["maths"] }, "/en/setup/profile/", "/en/setup/profile/"],
    ["no UPI ID on step 2", { name: "Meena", subjects: ["maths"] }, "/en/setup/upi/", "/en/setup/upi/"],
    ["a finished profile on home", { name: "Meena", subjects: ["maths"], upi_id: "a@okhdfc" }, "/en/home/", "/en/home/"],
    ["a finished profile on step 1 (Edit)", { name: "Meena", subjects: ["maths"], upi_id: "a@okhdfc" }, "/en/setup/profile/", "/en/setup/profile/"],
    ["a finished profile on step 2 (Edit)", { name: "Meena", subjects: ["maths"], upi_id: "a@okhdfc" }, "/en/setup/upi/", "/en/setup/upi/"],
    ["a finished profile on sign-in", { name: "Meena", subjects: ["maths"], upi_id: "a@okhdfc" }, "/en/sign-in/", "/en/home/"],
    ["a new tutor on sign-in", {}, "/hi/sign-in/", "/hi/setup/profile/"],
  ];
  for (const [label, tutor, from, to] of cases) {
    test(`${label}: ${from} ends at ${to}`, async ({ page }) => {
      await stubSupabase(page, { tutor: newTutor(tutor) });
      await seedSession(page);
      await page.goto(from);
      await expect(page).toHaveURL(new RegExp(`${to.replace(/\//g, "\\/")}$`));
      await page.waitForTimeout(300);
      expect(page.url()).toBe(`${ORIGIN}${to}`);
    });
  }
});

test.describe("18: signing out", () => {
  test("ends this device's session only, clears the stored session and goes to sign-in", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    await seedSession(page);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    expect(await stored(page)).toBe(true);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    expect(await stored(page)).toBe(false);
    const logout = stub.where((r) => r.path === "/auth/v1/logout");
    expect(logout).toHaveLength(1);
    expect(logout[0].query).toContain("scope=local");
    // No "you were signed out" message after the tutor's own sign-out.
    await expect(notice(page)).toHaveCount(0);
    // And the app is closed to this phone again.
    await page.goto("/en/home/");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
  });

  test("clears the stored session even when the network call fails", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    stub.logoutFails = true;
    await seedSession(page);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    expect(await stored(page)).toBe(false);
  });
});

test.describe("19: a session that ends on its own", () => {
  test("a refused refresh sends the tutor to sign-in with the message, once", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    stub.refuseToken = true;
    await seedSession(page, fakeSession("meena@example.com", -120));
    await page.goto("/en/home/");
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    await expect(notice(page)).toHaveText("You were signed out. Sign in again to carry on.");
    expect(await stored(page)).toBe(false);
    await page.reload();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test("a sign-out in a second tab ends this one too, with the message", async ({ page, context }) => {
    // Both tabs share the phone's storage, so both share the one stub and the one session.
    await stubSupabase(context, { tutor: completeTutor() });
    await seedSession(context);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toBeVisible();
    const other = await context.newPage();
    await other.goto("/en/home/");
    await expect(other.locator("h1")).toBeVisible();
    await other.getByRole("button", { name: "Sign out" }).click();
    await expect(other).toHaveURL(/\/en\/sign-in\/$/);
    await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    await expect(notice(page)).toHaveText("You were signed out. Sign in again to carry on.");
  });
});

test.describe("20: the network is down", () => {
  test("says so with Try again, does not sign the tutor out, and recovers", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    stub.networkDown = true;
    await seedSession(page);
    await page.goto("/en/home/");
    // The library tries a read three times, one and two seconds apart, before it gives up.
    await expect(notice(page)).toContainText("Couldn't load your details", { timeout: 15_000 });
    await expect(notice(page)).toContainText("The network dropped. Nothing is lost.");
    expect(page.url()).toBe(`${ORIGIN}/en/home/`);
    expect(await stored(page)).toBe(true);
    stub.networkDown = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    expect(page.url()).toBe(`${ORIGIN}/en/home/`);
  });
});

test.describe("32: the empty home", () => {
  test("shows the brand, the first name, the heading, the body and the next-update line; no Add students button", async ({ page }) => {
    await stubSupabase(page, { tutor: completeTutor() });
    await seedSession(page);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    await expect(page.getByText(brand.name, { exact: true })).toBeVisible();
    await expect(page.getByText("Hello, Meena", { exact: true })).toBeVisible();
    await expect(page.getByText("Add your students and you will see who owes what, with one tap to remind each parent.")).toBeVisible();
    await expect(page.getByText("Adding students arrives in the next update.")).toBeVisible();
    await expect(page.getByText(/add students/i)).toHaveCount(0);
    await expect(page.getByText(/sample data/i)).toHaveCount(0);
    const signOut = page.getByRole("button", { name: "Sign out" });
    expect((await box(signOut)).height).toBeGreaterThanOrEqual(44);
  });

  test("keeps the saved language of the tutor in step with the page (36)", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor({ language: "en" }) });
    await seedSession(page);
    await page.goto("/hi/home/");
    await expect(page.locator("h1")).toBeVisible();
    await expect.poll(() => stub.patches.length).toBe(1);
    expect(stub.patches[0]).toEqual({ language: "hi" });
  });

  test("sends nothing about the language when it already matches", async ({ page }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor({ language: "kn" }) });
    await seedSession(page);
    await page.goto("/kn/home/");
    await expect(page.locator("h1")).toBeVisible();
    await page.waitForTimeout(500);
    expect(stub.patches).toEqual([]);
  });
});

test.describe("49: nothing leaves, nothing is set", () => {
  test("the app talks only to itself and the Supabase host, sets no cookie, and reads rows with the tutor's token", async ({ page, context }) => {
    const stub = await stubSupabase(page, { tutor: completeTutor() });
    const others = watchOtherHosts(page, ORIGIN);
    await seedSession(page);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toBeVisible();
    expect(others).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    const read = stub.where((r) => r.path === "/rest/v1/tutors" && r.method === "GET");
    expect(read.length).toBeGreaterThan(0);
    expect(read[0].headers["authorization"]).toMatch(/^Bearer \S+/);
    expect(read[0].headers["apikey"]).toBe("ci-anon-key");
    expect(read[0].query).not.toContain("service");
    expect(HOST).toContain("supabase.co");
  });
});

test.describe("46: every app screen, in each language, at 360px and with larger text", () => {
  for (const lang of langs) {
    for (const route of ["home", "setup/profile", "setup/upi"]) {
      test(`/${lang}/${route}/: no sideways scroll, nothing cut, every link and button at least 44px, at 100% and at 130%`, async ({ page }) => {
        await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
        await seedSession(page);
        await page.goto(`/${lang}/${route}/`);
        await expect(page.locator("h1")).toBeVisible();
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
  }

  for (const lang of langs) {
    test(`/${lang}/home/: the loading and error states hold at 130%`, async ({ page }) => {
      const stub = await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
      stub.networkDown = true;
      await seedSession(page);
      await page.goto(`/${lang}/home/`);
      await expect(notice(page)).toBeVisible({ timeout: 15_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "130%"));
      expect(await sidewaysScroll(page)).toBe(0);
      expect(await textProblems(page, "body")).toEqual([]);
      await expect(notice(page)).toContainText(messageText(lang, "appState.errorTitle"));
    });
  }
});
