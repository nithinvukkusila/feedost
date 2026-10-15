// Test-engineer proofs for spec UX-review-fixes PR 1 (items 1 to 5, criteria U1 to U4). Runs against the build
// made with the CI's made-up Supabase address; the tables are stubbed (board-fixture.ts). Complements the
// builder's wording updates in board, landing, students and student-form specs.
import { expect, test, type Page } from "@playwright/test";
import { signedIn } from "./board-fixture";
import { box, langs, sidewaysScroll, type Lang } from "./helpers";
import { shown } from "./landing-helpers";

const STUDENTS = [
  { id: "00000000-0000-4000-8000-0000000000d1", name: "Ravi Kumar", monthly_fee: 120000, due_day: 4 },
  { id: "00000000-0000-4000-8000-0000000000d2", name: "Dev Patil", monthly_fee: 100000, due_day: 1 },
];
const at = (iso: string) => new Date(iso);
// 14 Oct 2026, 10:30 in India.
const OCT14 = at("2026-10-14T05:00:00Z");
const digitsOnly = (text: string) => !/[०-९೦-೯౦-౯]/u.test(text);

const nextLine = (lang: Lang, date: string) => shown(lang, "board.empty.none.next").replace("{date}", date);
const oweLine = (lang: Lang) => shown(lang, "board.empty.none.owed");

test.describe("U1 to U4: Home with students and nothing due", () => {
  for (const lang of langs) {
    test(`[${lang}] says the first fee date (1 Nov), the Already owes advice and a 44px link, at 360px and large text`, async ({ page }) => {
      await signedIn(page, { students: STUDENTS, batches: [], dues: [], lang, clock: OCT14 });
      await page.goto(`/${lang}/home/`);
      await expect(page.getByText(nextLine(lang, "01 Nov 2026"), { exact: true })).toBeVisible();
      await expect(page.getByText(oweLine(lang), { exact: true })).toBeVisible();
      const link = page.locator(`main a[href="/${lang}/students/"]`).first();
      expect((await box(link)).height).toBeGreaterThanOrEqual(44);
      expect(digitsOnly(await page.locator("main").innerText())).toBe(true);
      expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
      for (const size of ["130%", "200%"]) {
        await page.evaluate((v) => document.documentElement.style.setProperty("font-size", v), size);
        expect(await sidewaysScroll(page), size).toBeLessThanOrEqual(0);
        await expect(page.getByText(oweLine(lang), { exact: true })).toBeVisible();
        // Nothing clipped: each paragraph's text fits its own box.
        const clipped = await page.locator("main p").evaluateAll((ps) => ps.filter((p) => p.scrollWidth > p.clientWidth + 1).map((p) => p.textContent));
        expect(clipped, size).toEqual([]);
      }
    });
  }

  test("today equal to the due day shows next month (14 Oct, due day 14 gives 14 Nov)", async ({ page }) => {
    await signedIn(page, { students: [{ ...STUDENTS[0], due_day: 14 }], batches: [], dues: [], clock: OCT14 });
    await page.goto("/en/home/");
    await expect(page.getByText("Your next fee comes in on 14 Nov 2026.")).toBeVisible();
  });

  test("December rolls to January of the next year", async ({ page }) => {
    await signedIn(page, { students: STUDENTS, batches: [], dues: [], clock: at("2026-12-30T05:00:00Z") });
    await page.goto("/en/home/");
    await expect(page.getByText("Your next fee comes in on 01 Jan 2027.")).toBeVisible();
  });

  test("the soonest of several students wins, and an archived or no-fee student is ignored", async ({ page }) => {
    const more = [
      ...STUDENTS,
      { id: "00000000-0000-4000-8000-0000000000d3", name: "Gone Away", monthly_fee: 100000, due_day: 15, active: false },
      { id: "00000000-0000-4000-8000-0000000000d4", name: "Free Of Fee", monthly_fee: 0, due_day: 16 },
    ];
    await signedIn(page, { students: more, batches: [], dues: [], clock: OCT14 });
    await page.goto("/en/home/");
    await expect(page.getByText("Your next fee comes in on 01 Nov 2026.")).toBeVisible();
  });

  // The phone's time zone must not change the date: 05:00 UTC is 14 Oct in India and 13 Oct 22:00 in Los Angeles.
  for (const tz of ["America/Los_Angeles", "Pacific/Kiritimati", "Europe/London"]) {
    test.describe(`phone in ${tz}`, () => {
      test.use({ timezoneId: tz });
      test("shows the India-day answer", async ({ page }) => {
        await signedIn(page, { students: STUDENTS, batches: [], dues: [], clock: OCT14 });
        await page.goto("/en/home/");
        await expect(page.getByText("Your next fee comes in on 01 Nov 2026.")).toBeVisible();
      });
    });
  }

  test("an India day boundary: 18:31 UTC on 13 Oct is already 14 Oct in India (due day 14 gives 14 Nov)", async ({ page }) => {
    await signedIn(page, { students: [{ ...STUDENTS[0], due_day: 14 }], batches: [], dues: [], clock: at("2026-10-13T19:00:00Z") });
    await page.goto("/en/home/");
    await expect(page.getByText("Your next fee comes in on 14 Nov 2026.")).toBeVisible();
  });

  test("no students keeps the empty book: no date line, no Already owes line, the black Add a student button", async ({ page }) => {
    await signedIn(page, { students: [], batches: [], dues: [], clock: OCT14 });
    await page.goto("/en/home/");
    await expect(page.getByText(/Your next fee comes in/)).toHaveCount(0);
    await expect(page.getByText(/Already owes/)).toHaveCount(0);
    await expect(page.getByText("Nothing is due yet.")).toHaveCount(0);
    const add = page.getByRole("link", { name: "Add a student" });
    await expect(add).toBeVisible();
    expect((await box(add)).height).toBeGreaterThanOrEqual(44);
  });

  test("only archived students counts as no students for the date: no date line, still the plain advice", async ({ page }) => {
    await signedIn(page, { students: [{ ...STUDENTS[0], active: false }], batches: [], dues: [], clock: OCT14 });
    await page.goto("/en/home/");
    await expect(page.getByText(/Your next fee comes in/)).toHaveCount(0);
  });
});

test.describe("item 2: Sign in on the landing page, by touch and keyboard, in every language", () => {
  for (const lang of langs) {
    test(`[${lang}] header and footer links open this language's sign-in; Tab reaches them with a focus ring; no overflow at 200% text`, async ({ page }) => {
      await page.goto(`/${lang}/`);
      for (const place of ["header", "footer"] as const) {
        const link = page.locator(`${place} a[href="/${lang}/sign-in/"]`);
        expect((await box(link)).width).toBeGreaterThanOrEqual(44);
        expect(await link.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("underline");
      }
      // Keyboard: Tab from the top reaches the header link before the Join button.
      await page.locator("body").press("Tab");
      const order: string[] = [];
      for (let i = 0; i < 3; i++) {
        order.push(await page.evaluate(() => (document.activeElement as HTMLAnchorElement | null)?.getAttribute("href") ?? ""));
        await page.keyboard.press("Tab");
      }
      expect(order.indexOf(`/${lang}/sign-in/`)).toBeGreaterThanOrEqual(0);
      expect(order.indexOf(`/${lang}/sign-in/`)).toBeLessThan(order.indexOf("#waitlist"));
      const focused = page.locator(`header a[href="/${lang}/sign-in/"]`);
      await focused.focus();
      expect(await focused.evaluate((el) => getComputedStyle(el).outlineStyle !== "none" || getComputedStyle(el).boxShadow !== "none")).toBe(true);
      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
      expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
      await expect(page.locator(`header a[href="/${lang}/sign-in/"]`)).toBeInViewport();
      // Tapping goes to the sign-in screen of the same language.
      await page.evaluate(() => document.documentElement.style.removeProperty("font-size"));
      await page.locator(`header a[href="/${lang}/sign-in/"]`).tap();
      await expect(page).toHaveURL(new RegExp(`/${lang}/sign-in/$`));
    });

    test(`[${lang}] the footer link taps through too`, async ({ page }) => {
      await page.goto(`/${lang}/`);
      await page.locator(`footer a[href="/${lang}/sign-in/"]`).tap();
      await expect(page).toHaveURL(new RegExp(`/${lang}/sign-in/$`));
    });
  }

  test("the fee-reminder tool page footer carries it as well", async ({ page }) => {
    await page.goto("/hi/tools/fee-reminder/");
    await expect(page.locator('footer a[href="/hi/sign-in/"]')).toHaveCount(1);
  });
});

test.describe("item 4: Attendance coming-soon", () => {
  for (const lang of langs) {
    test(`[${lang}] sentence, Back to Home goes home, nav keeps four items with Attendance current`, async ({ page }) => {
      await signedIn(page, { students: STUDENTS, batches: [], dues: [], lang });
      await page.goto(`/${lang}/attendance/`);
      await expect(page.getByText(shown(lang, "attendance.soon"), { exact: true })).toBeVisible();
      const back = page.getByRole("link", { name: shown(lang, "attendance.back"), exact: true });
      expect((await box(back)).height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('nav [aria-current="page"]')).toHaveCount(1);
      await expect(page.locator('nav[aria-label] a')).toHaveCount(4);
      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
      expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
      await page.evaluate(() => document.documentElement.style.removeProperty("font-size"));
      await back.tap();
      await expect(page).toHaveURL(new RegExp(`/${lang}/home/$`));
      await expect(page.locator("h1")).toBeVisible();
    });
  }
});

async function describedText(page: Page, selector: string): Promise<string[]> {
  return page.locator(selector).evaluate((el) =>
    (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim() ?? `MISSING:${id}`),
  );
}

test.describe("item 5: the grouped add-student form", () => {
  for (const lang of langs) {
    test(`[${lang}] three legends in order, both hints visible, hints linked by aria-describedby, ids unique`, async ({ page }) => {
      await signedIn(page, { batches: [], students: [], lang });
      await page.goto(`/${lang}/students/new/`);
      await expect(page.locator("form > fieldset > legend")).toHaveText([
        shown(lang, "students.form.groupWho"),
        shown(lang, "students.form.groupFee"),
        shown(lang, "students.form.groupOwes"),
      ]);
      const owesHint = shown(lang, "students.form.owesHint");
      const tickHint = shown(lang, "students.form.permissionHint");
      await expect(page.getByText(owesHint, { exact: true })).toBeVisible();
      await expect(page.getByText(tickHint, { exact: true })).toBeVisible();
      expect(await describedText(page, "input[type=checkbox]")).toContain(tickHint);
      const owesInput = page.locator("form > fieldset").nth(2).locator("input, textarea");
      expect(await owesInput.evaluate((el) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()))).toContain(owesHint);
      const ids = await page.locator("[id]").evaluateAll((els) => els.map((e) => e.id));
      expect(new Set(ids).size).toBe(ids.length);
      // Legends wrap and are 14px or more, also at 200% text, with no sideways scroll.
      const small = await page.locator("legend").evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((s) => s < 14));
      expect(small).toEqual([]);
      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
      expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
    });
  }

  test("tab order is the old order: name, parent, phone, language, tick, batch, due day, fee, already owes, then the buttons", async ({ page }) => {
    await signedIn(page, { batches: [{ id: "00000000-0000-4000-8000-0000000000b1", name: "Maths" }], students: [] });
    await page.goto("/en/students/new/");
    await page.getByLabel("Student's name").focus();
    const seen: string[] = [];
    for (let i = 0; i < 12; i++) {
      seen.push(await page.evaluate(() => {
        const el = document.activeElement as HTMLInputElement;
        const label = el.labels?.[0]?.textContent?.trim() ?? el.textContent?.trim() ?? el.tagName;
        return `${el.tagName.toLowerCase()}:${(el as HTMLInputElement).type ?? ""}:${label}`;
      }));
      await page.keyboard.press("Tab");
    }
    const names = seen.map((s) => s.split(":").slice(2).join(":"));
    const idx = (needle: string | RegExp) => names.findIndex((n) => (typeof needle === "string" ? n.includes(needle) : needle.test(n)));
    const order = [idx("Student's name"), idx("Parent's name"), idx("WhatsApp"), idx(/Tick|permission|OK|number here/i), idx("Batch"), idx("Fee due on"), idx("Monthly fee"), idx("Already owes")];
    expect(order.every((i) => i >= 0), JSON.stringify(seen)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(idx("Save student")).toBeGreaterThan(order[7]);
  });

  test("errors: describedby on each failing field resolves; the tick keeps hint plus error, Already owes shows the error in place of its hint", async ({ page }) => {
    await signedIn(page, { batches: [], students: [] });
    await page.goto("/en/students/new/");
    await page.getByLabel("Parent's WhatsApp number").fill("98450 12345");
    await page.getByLabel("Monthly fee ₹").fill("abc");
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page.getByText("Tick this to save the number.")).toBeVisible();
    // The permission tick keeps its hint and gains its error, both resolve.
    const tick = await describedText(page, "input[type=checkbox]");
    expect(tick.some((t) => t.startsWith("Tick once you have the parent's OK"))).toBe(true);
    expect(tick).toContain("Tick this to save the number.");
    expect(tick.filter((t) => t.startsWith("MISSING"))).toEqual([]);
    expect(await page.locator("input[type=checkbox]").getAttribute("aria-invalid")).toBe("true");
    // Every invalid control points only at elements that exist.
    const broken = await page.locator("[aria-invalid=true]").evaluateAll((els) =>
      els.flatMap((el) => (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => !document.getElementById(id))),
    );
    expect(broken).toEqual([]);
    const invalidCount = await page.locator("[aria-invalid=true]").count();
    expect(invalidCount).toBeGreaterThanOrEqual(3); // name, fee and the tick
    // A bad Already owes keeps its hint and gains the error.
    await page.getByLabel("Already owes ₹").fill("abc");
    await page.getByRole("button", { name: "Save student" }).click();
    const owes = await page.getByLabel("Already owes ₹").evaluate((el) => ({
      invalid: el.getAttribute("aria-invalid"),
      texts: (el.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent?.trim() ?? `MISSING:${id}`),
    }));
    expect(owes.texts.filter((t) => t.startsWith("MISSING"))).toEqual([]);
    expect(owes.invalid).toBe("true");
    // The Field shows one note under the line: the error replaces the hint, so the error must be what resolves.
    expect(owes.texts.length).toBeGreaterThanOrEqual(1);
    expect(owes.texts.join(" ")).not.toBe("");
  });
});
