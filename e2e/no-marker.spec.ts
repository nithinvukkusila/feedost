// Review fix for R1-1: no tutor ever sees the translator's marker, "TODO-translate", on a screen that is
// drawn after the page loads (the server-rendered HTML was checked separately). Every app screen and
// every state, in all four languages, against the build made with the CI's made-up Supabase address
// (see auth-helpers.ts). It looks at the text, every attribute that holds words, the HTML as the browser
// now has it, and the HTML the server sent.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { completeTutor, fakeSession, newTutor, seedSession, seedVerifier, stubSupabase } from "./auth-helpers";
import { langs, type Lang } from "./helpers";
import { stubRoster } from "./roster-helpers";
import { fee, link as payLink, notice, stubPayPage } from "./pay-page-helpers";

const MARKER = "TODO-translate";

/** Every message value that is still flagged for translation, exactly as written in the files. */
function flaggedValues(lang: Lang): string[] {
  const tree = JSON.parse(readFileSync(join(__dirname, "..", "messages", `${lang}.json`), "utf8")) as unknown;
  const found: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === "string") {
      if (node.startsWith(MARKER)) found.push(node);
    } else if (node && typeof node === "object") Object.values(node).forEach(walk);
  };
  walk(tree);
  return found;
}

/** Fails if the marker, or any flagged raw value, is anywhere the browser holds. */
async function expectNoMarker(page: Page, lang: Lang, where: string) {
  const flagged = flaggedValues(lang);
  const seen = await page.evaluate(() => {
    const attributes: string[] = [];
    for (const el of document.querySelectorAll("*")) {
      for (const name of ["placeholder", "aria-label", "title", "alt", "aria-description", "value"]) {
        const value = el.getAttribute(name);
        if (value) attributes.push(value);
      }
    }
    return {
      text: document.documentElement.textContent ?? "",
      shown: document.body.innerText,
      attributes,
      html: document.documentElement.outerHTML,
      title: document.title,
    };
  });
  const sent = await (await page.request.get(page.url())).text();
  const haystacks: [string, string][] = [
    ["text", seen.text],
    ["visible text", seen.shown],
    ["attributes", seen.attributes.join("\n")],
    ["title", seen.title],
    ["html in the browser", seen.html],
    ["html from the server", sent],
  ];
  for (const [name, hay] of haystacks) {
    expect(hay.includes(MARKER), `${where}: "${MARKER}" in the ${name}`).toBe(false);
    // One assertion per haystack: a failing run still names every raw value found. (One expect per flagged value
    // made this test cost thousands of assertions per screen and run past its 90 s limit as keys were added.)
    expect(flagged.filter((raw) => hay.includes(raw)), `${where}: raw flagged values in the ${name}`).toEqual([]);
  }
}

const error = (page: Page) => page.locator('[role="alert"][data-kind="error"]');

for (const lang of langs) {
  test.describe(`/${lang}/: no marker on any screen or state`, () => {
    test("language and sign-in, with every message the sign-in screen can carry", async ({ page }) => {
      await stubSupabase(page);
      await page.goto(`/${lang}/language/`);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoMarker(page, lang, "language");

      await page.goto(`/${lang}/sign-in/`);
      await expect(page.locator("main button").first()).toBeVisible();
      await expectNoMarker(page, lang, "sign-in");

      await page.goto(`/${lang}/auth/callback/?error=access_denied`);
      await expect(page).toHaveURL(new RegExp(`/${lang}/sign-in/$`));
      await expect(error(page)).toBeVisible();
      await expectNoMarker(page, lang, "sign-in, cancelled");

      await page.goto(`/${lang}/auth/callback/`);
      await expect(page).toHaveURL(new RegExp(`/${lang}/sign-in/$`));
      await expect(error(page)).toBeVisible();
      await expectNoMarker(page, lang, "sign-in, failed");
    });

    test("sign-in offline, and the callback while it waits", async ({ page, context }) => {
      const stub = await stubSupabase(page);
      await page.goto(`/${lang}/sign-in/`);
      const button = page.locator("main button").first();
      await expect(button).toBeVisible();
      await context.setOffline(true);
      await button.click();
      await expect(page.locator('[role="status"], [role="alert"]').filter({ hasText: /\S/ }).first()).toBeVisible();
      await expectNoMarker(page, lang, "sign-in, offline");
      await context.setOffline(false);

      stub.tokenDelayMs = 3000;
      await seedVerifier(page);
      await page.goto(`/${lang}/auth/callback/?code=made-up-code`);
      await expect(page.locator("body")).toContainText(/\S/);
      await expectNoMarker(page, lang, "callback, waiting");
    });

    test("the signed-in screens: home, more, setup steps 1 and 2 and their errors", async ({ page }) => {
      const stub = await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
      await seedSession(page);
      for (const [path, name] of [
        ["home", "home"],
        ["more", "more"],
        ["setup/profile", "setup step 1"],
        ["setup/upi", "setup step 2"],
      ] as const) {
        await page.goto(`/${lang}/${path}/`);
        await expect(page.locator("h1")).toBeVisible();
        await expectNoMarker(page, lang, name);
      }
      // Step 2 with a UPI ID that is wrong, and a save the server refuses.
      await page.goto(`/${lang}/setup/upi/`);
      const field = page.getByRole("textbox").first();
      await field.fill("not-a-upi-id");
      await page.locator("main button:not([aria-pressed])").last().click();
      await expect(error(page).or(page.locator('[aria-invalid="true"]')).first()).toBeVisible();
      await expectNoMarker(page, lang, "setup step 2, wrong ID");
      await field.fill("meena.tuitions@okhdfc");
      stub.refuseWrites = true;
      await page.locator("main button:not([aria-pressed])").last().click();
      await expect(error(page).first()).toBeVisible();
      await expectNoMarker(page, lang, "setup step 2, save failed");
    });

    test("the student screens: empty, with students (home, list with batch tabs and a select, archived, search with no match), attendance, loading and failing (R1-3)", async ({ page }) => {
      test.setTimeout(90_000);
      await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
      const roster = await stubRoster(page);
      await seedSession(page);
      for (const [path, name] of [
        ["home", "home, no students"],
        ["students", "students, none yet"],
        ["attendance", "attendance"],
      ] as const) {
        await page.goto(`/${lang}/${path}/`);
        await expect(page.locator("h1, h2").first()).toBeVisible();
        await expectNoMarker(page, lang, name);
      }

      const batches = ["One", "Two", "Three"].map((name, i) => roster.addBatch({ name, id: `00000000-0000-4000-8000-00000000d00${i}` }));
      roster.addStudent({ name: "Ravi Kumar", parent_name: "Suresh", parent_phone: "+919886044321", batch_id: batches[0].id, due_day: 2 });
      roster.addStudent({ name: "ಕಿರಣ್ ಪಾಟೀಲ್", due_day: 22 });
      roster.addStudent({ name: "Old", active: false });
      await page.goto(`/${lang}/home/`);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoMarker(page, lang, "home, with students");

      await page.goto(`/${lang}/students/`);
      await expect(page.getByRole("tab").first()).toBeVisible();
      await expectNoMarker(page, lang, "students, tabs");
      await page.getByRole("button", { name: /\(1\)/ }).click();
      await expectNoMarker(page, lang, "students, archived shown");
      await page.getByRole("searchbox").or(page.locator('input[type="text"]')).first().fill("zzzz");
      await expectNoMarker(page, lang, "students, search found nothing");
      roster.addBatch({ name: "Four" });
      await page.goto(`/${lang}/students/`);
      await expect(page.locator("select")).toBeVisible();
      await expectNoMarker(page, lang, "students, batch select");

      await page.goto(`/${lang}/batches/`);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoMarker(page, lang, "batches");
      await page.locator("textarea").first().fill("one");
      await page.locator("main form button").first().click();
      await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
      await expectNoMarker(page, lang, "batches, name taken");
      await page.goto(`/${lang}/batches/edit/?id=${batches[0].id}`);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoMarker(page, lang, "batch screen");
      await page.locator("main button").last().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expectNoMarker(page, lang, "batch, delete sheet");
      await page.keyboard.press("Escape");
      await page.goto(`/${lang}/batches/edit/?id=nope`);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoMarker(page, lang, "batch not found");

      await page.goto(`/${lang}/students/new/`);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoMarker(page, lang, "add student");
      await page.locator("textarea").nth(2).fill("123");
      await page.locator("main form button").last().click();
      await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
      await expectNoMarker(page, lang, "add student, errors");
      await page.goto(`/${lang}/students/edit/?id=${roster.students[0].id}`);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoMarker(page, lang, "edit student");
      await page.goto(`/${lang}/students/edit/?id=nope`);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoMarker(page, lang, "student not found");

      roster.listDelayMs = 2500;
      await page.goto(`/${lang}/students/`);
      await expect(page.getByRole("status")).toBeVisible();
      await expectNoMarker(page, lang, "students, loading");
      await expect(page.getByRole("status")).toHaveCount(0, { timeout: 15_000 });
      roster.listDelayMs = 0;
      roster.networkDown = true;
      await page.goto(`/${lang}/students/`);
      await expect(error(page)).toBeVisible({ timeout: 25_000 });
      await expectNoMarker(page, lang, "students, failed");
    });

    test("setup step 1 with nothing filled in, and a new tutor's step 1", async ({ page }) => {
      await stubSupabase(page, { tutor: newTutor() });
      await seedSession(page);
      await page.goto(`/${lang}/setup/profile/`);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoMarker(page, lang, "step 1, new tutor");
      await page.locator("main button:not([aria-pressed])").last().click();
      await expect(page.locator('[aria-invalid="true"]').first()).toBeVisible();
      await expectNoMarker(page, lang, "step 1, errors");
    });

    test("loading, error (network and 503), missing profile and expired", async ({ page }) => {
      test.setTimeout(90_000);
      const stub = await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
      await seedSession(page);

      stub.tutorDelayMs = 3000;
      await page.goto(`/${lang}/home/`);
      await expect(page.getByRole("status")).toBeVisible();
      await expectNoMarker(page, lang, "loading");
      await expect(page.getByRole("status")).toHaveCount(0, { timeout: 15_000 });
      stub.tutorDelayMs = 0;

      stub.networkDown = true;
      await page.goto(`/${lang}/home/`);
      await expect(error(page)).toBeVisible({ timeout: 20_000 });
      await expectNoMarker(page, lang, "error, network");
      stub.networkDown = false;

      stub.tutorReadStatus = 503;
      await page.goto(`/${lang}/home/`);
      await expect(error(page)).toBeVisible({ timeout: 20_000 });
      await expectNoMarker(page, lang, "error, server");
      stub.tutorReadStatus = null;

      stub.tutor = null;
      await page.goto(`/${lang}/home/`);
      await expect(error(page)).toBeVisible();
      await expectNoMarker(page, lang, "missing profile");
    });

    test("expired: a refused session and a refused renewal", async ({ page }) => {
      const stub = await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
      stub.tutorReadStatus = 401;
      await seedSession(page);
      await page.goto(`/${lang}/home/`);
      await expect(page).toHaveURL(new RegExp(`/${lang}/sign-in/$`));
      await expect(error(page)).toBeVisible();
      await expectNoMarker(page, lang, "expired, refused session");

      const other = await page.context().newPage();
      const second = await stubSupabase(other, { tutor: completeTutor({ language: lang }) });
      second.refuseToken = true;
      await seedSession(other, fakeSession("meena@example.com", -120));
      await other.goto(`/${lang}/home/`);
      await expect(other).toHaveURL(new RegExp(`/${lang}/sign-in/$`));
      await expect(error(other)).toBeVisible();
      await expectNoMarker(other, lang, "expired, refused renewal");
    });
  });
}

// R1-9 Part B, criterion 36: the parent's pay page never shows the marker, in any language, on the consent screen, the
// fee page, the read-only notice or any state. The consent wording is English in hi, kn and te until it is approved.
for (const lang of langs) {
  test(`/p/ in ${lang}: no marker on the consent screen, the fee page, the notice or a state`, async ({ page }) => {
    await stubPayPage(page, { pay: notice({ language: lang }) });
    await page.goto(payLink());
    await expect(page.locator("main")).toHaveAttribute("data-state", "consent");
    await expectNoMarker(page, lang, "pay page, consent");

    await stubPayPage(page, { pay: fee({ language: lang }) });
    await page.goto(payLink());
    await expect(page.locator("main")).toHaveAttribute("data-state", "fee");
    await expectNoMarker(page, lang, "pay page, fee");
    await page.locator("main").getByRole("button", { name: /\S/ }).last().click();
    await expect(page.locator("main")).toHaveAttribute("data-state", "notice");
    await expectNoMarker(page, lang, "pay page, notice");

    await stubPayPage(page, { pay: { status: 404, body: { code: "not_found" } } });
    await page.goto(payLink());
    await expect(page.locator("main")).toHaveAttribute("data-state", "not_found");
    await expectNoMarker(page, lang, "pay page, not found");
  });
}
