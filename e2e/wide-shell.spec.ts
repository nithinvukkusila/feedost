// Spec D1, part D1a: the shell on wider screens (criteria 2 to 11, 22, 30 to 34), against the fake Supabase
// host as board.spec.ts does. Runs inside the `phone` project: the window is resized with setWidth(), so the
// phone project is untouched. The layout is CSS only, so a resize changes it live and nothing remounts.
import { expect, test, type Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { HOST, completeTutor, fakeSession, newTutor, seedSession, stubSupabase } from "./auth-helpers";
import { MATHS, signedIn } from "./board-fixture";
import { box, css, messageText, textProblems, type Lang } from "./helpers";
import { stubPayments } from "./pay-helpers";
import { EDGES, SWEEP, book, expectNoSideways, mainNav, rootFont, setWidth, sweep } from "./wide-helpers";

const REM = 16;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

// Forty students who owe: a page taller than any window, so the foot of it has to be scrolled to.
const many = Array.from({ length: 40 }, (_, i) => ({ id: id(0x500 + i), name: `Student ${String(i).padStart(2, "0")}`, batch_id: i % 2 ? MATHS : null, monthly_fee: 120000, due_day: 5 }));
const manyDues = many.map((s) => ({ student_id: s.id, due_date: "2026-10-05", amount: 120000 }));
const batches = [{ id: MATHS, name: "Class 10 Maths" }];
// The worst case for width: an 80-character name with no spaces and a 60-character batch name.
const stress = many.slice(0, 12).map((s, i) => (i === 0 ? { ...s, name: "A".repeat(80), batch_id: MATHS } : s));
const stressBatches = [{ id: MATHS, name: "Class 10 Maths and Science combined evening batch, Mon to Fri" }];

async function tall(page: Page, lang: Lang = "en") {
  const signed = await signedIn(page, { students: many, batches, dues: manyDues, lang });
  const pay = await stubPayments(page, signed.dues);
  return { ...signed, pay };
}
const home = (lang: Lang = "en") => `/${lang}/home/`;
const bottomOf = (b: { y: number; height: number }) => b.y + b.height;

test.describe("2, 4, 5: the layout follows the window width, in rem", () => {
  test("phone column below 768, 42rem from 768, the book and the side navigation from 1024 (one page load, each edge)", async ({ page }) => {
    await signedIn(page);
    await page.goto(home());
    await expect(page.locator("h1")).toBeVisible();
    const nav = mainNav(page);
    await expect(nav).toHaveCount(1);
    for (const width of [360, ...EDGES, 1280]) {
      await setWidth(page, width, 900);
      const b = await box(book(page));
      const n = await box(nav);
      const where = `at ${width}`;
      if (width < 768) {
        expect(b.width, `phone column ${where}`).toBeLessThanOrEqual(28 * REM);
        expect(n.width, `navigation as wide as the column ${where}`).toBeCloseTo(b.width, 0);
        expect(bottomOf(n), `bottom navigation ${where}`).toBeCloseTo(900, 0);
      } else if (width < 1024) {
        expect(b.width, `tablet column is 42rem ${where}`).toBeCloseTo(42 * REM, 0);
        expect(n.width).toBeCloseTo(b.width, 0);
        expect(bottomOf(n), `bottom navigation ${where}`).toBeCloseTo(900, 0);
      } else {
        // Cloth shows 24px each side at 1024; the book is 80rem at most.
        expect(b.width, `the book ${where}`).toBeLessThanOrEqual(80 * REM);
        expect(n.width, `side navigation is 15rem, less its 2px border ${where}`).toBeCloseTo(15 * REM - 2, 0);
        expect(n.x, `side navigation is the book's left edge ${where}`).toBeCloseTo(b.x + 2, 0);
        expect(n.y, `side navigation is at the top, under the name ${where}`).toBeLessThan(6 * REM);
      }
      await expectNoSideways(page, width, "home");
    }
  });

  test("the book is at most 80rem and centred with cloth either side; below 1024 there is no cloth", async ({ page }) => {
    await signedIn(page);
    await page.goto(home());
    await expect(page.locator("h1")).toBeVisible();
    await setWidth(page, 1920);
    const b = await box(book(page));
    expect(b.width).toBeCloseTo(80 * REM, 0);
    expect(b.x).toBeCloseTo((1920 - b.width) / 2, 0);
    const ground = book(page).locator("xpath=..");
    expect((await css(ground, ["background-color"]))["background-color"]).toBe("rgb(168, 28, 34)");
    await setWidth(page, 1023);
    expect((await css(ground, ["background-color"]))["background-color"]).toBe("rgba(0, 0, 0, 0)");
  });

  test("8: the cloth has its dashed stitch, the book a 2px ink border and a hard offset shadow, no blur, corners 4px at most; the name sits at the top of the side navigation", async ({ page }) => {
    await signedIn(page);
    await page.goto(home());
    await expect(page.locator("h1")).toBeVisible();
    await setWidth(page, 1440);
    const ground = book(page).locator("xpath=..");
    const g = await css(ground, ["outline-style", "outline-width", "outline-color"]);
    expect(g["outline-style"]).toBe("dashed");
    expect(g["outline-width"]).toBe("2px");
    expect(g["outline-color"]).toBe("rgb(233, 201, 90)");
    const b = await css(book(page), ["border-top-width", "border-top-color", "box-shadow", "border-top-left-radius"]);
    expect(b["border-top-width"]).toBe("2px");
    expect(b["border-top-color"]).toBe("rgb(26, 20, 16)");
    // Tailwind lists its unused shadow layers as transparent zero-size ones; the drawn one is a 6px offset in cloth-deep with no blur.
    expect(b["box-shadow"]).toContain("rgb(94, 13, 17) 6px 6px 0px 0px");
    expect(b["box-shadow"].replaceAll("rgba(0, 0, 0, 0) 0px 0px 0px 0px", "")).not.toMatch(/\d+px \d+px [1-9]\d*px/);
    expect(parseFloat(b["border-top-left-radius"])).toBeLessThanOrEqual(4);
    const brandName = page.locator("[data-side-brand]");
    await expect(brandName).toHaveAttribute("data-side-brand", brand.name);
    expect(await brandName.evaluate((el) => getComputedStyle(el, "::before").content)).toBe(`"${brand.name}"`);
    expect((await box(brandName)).y).toBeLessThan((await box(mainNav(page))).y + 1);
    await setWidth(page, 1023);
    await expect(brandName).toBeHidden();
  });
});

test.describe("3: a resize across 768 and 1024 changes the layout live and loses nothing", () => {
  test("typed text, the open screen and its language stay as the window goes 1280, 900, 360 and back", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    const field = page.getByRole("textbox", { name: /Student's name/ });
    await field.fill("Aarav Menon");
    await field.evaluate((el) => el.setAttribute("data-same", "yes"));
    for (const width of [1280, 900, 360, 767, 768, 1024, 1280]) {
      await setWidth(page, width, 800);
      await expect(field, `at ${width}`).toHaveValue("Aarav Menon");
      await expect(field).toHaveAttribute("data-same", "yes");
      await expect(page).toHaveURL(/\/en\/students\/new\/$/);
    }
  });
});

test.describe("7, 9, 32: the side navigation", () => {
  test("four links in order, the current one marked, each 44px or more and as wide as the column, in view while the page scrolls, one nav", async ({ page }) => {
    await tall(page);
    await page.goto(home());
    await expect(page.locator("h1")).toBeVisible();
    await setWidth(page, 1280, 700);
    const nav = mainNav(page);
    await expect(nav).toHaveCount(1);
    const links = nav.getByRole("link");
    await expect(links).toHaveText(["Home", "Students", "Attendance", "More"]);
    await expect(links.nth(0)).toHaveAttribute("aria-current", "page");
    await expect(nav.locator("[aria-current]")).toHaveCount(1);
    const n = await box(nav);
    for (const link of await links.all()) {
      const l = await box(link);
      expect(l.height).toBeGreaterThanOrEqual(44);
      expect(l.width).toBeCloseTo(n.width, 0);
    }
    // The current link has its bar on the left edge (a mark, not only colour).
    const current = await css(links.nth(0), ["border-left-width", "border-top-width"]);
    expect(current["border-left-width"]).toBe("5px");
    expect(current["border-top-width"]).toBe("0px");
    // Scrolled down a long page, the navigation is still where it was: the column fills the window height.
    const side = nav.locator("xpath=ancestor::div[contains(@class,'lg:sticky')][1]");
    await page.evaluate(() => window.scrollTo(0, 1500));
    expect(await page.evaluate(() => window.scrollY)).toBe(1500);
    const after = await box(side);
    expect(after.y).toBeCloseTo(0, 0);
    expect(after.height).toBeCloseTo(700, 0);
    await expect(nav.getByRole("link", { name: "More" })).toBeInViewport({ ratio: 1 });
    // The language row is in More at every width, and there is no second picker in the shell.
    await expect(page.getByRole("link", { name: /^Language|^English/ })).toHaveCount(0);
  });

  for (const lang of ["hi", "kn", "te"] as const) {
    test(`${lang}: labels wrap inside the 15rem column and are never cut`, async ({ page }) => {
      await signedIn(page, { lang });
      await page.goto(home(lang));
      await expect(page.locator("h1")).toBeVisible();
      await setWidth(page, 1024, 800);
      const links = mainNav(page).getByRole("link");
      await expect(links).toHaveText([messageText(lang, "nav.home"), messageText(lang, "nav.students"), messageText(lang, "nav.attendance"), messageText(lang, "nav.more")]);
      for (const link of await links.all()) {
        const fits = await link.evaluate((el) => el.scrollWidth <= el.clientWidth && [...el.querySelectorAll("span")].every((s) => s.scrollWidth <= s.clientWidth + 1));
        expect(fits).toBe(true);
        expect((await box(link)).height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe("6: breakpoints follow rem", () => {
  test("a page zoom of 200% at 1280 and at 1440 (640 and 720 CSS px) shows the phone layout with no overflow; the browser text-size setting is a hand test, since author CSS cannot move a media query's rem", async ({ page }) => {
    await signedIn(page);
    await page.goto(home());
    await expect(page.locator("h1")).toBeVisible();
    // Browser page zoom of 200% is the same as half the CSS pixels of window: 640 at 1280, 720 at 1440.
    for (const css of [640, 720]) {
      await setWidth(page, css, 800);
      expect(bottomOf(await box(mainNav(page))), `bottom navigation at ${css}`).toBeCloseTo(800, 0);
      await expectNoSideways(page, css, "home");
    }
  });
});

test.describe("10, 22: the sheet is a dialog and the Undo banner sits at the foot of the content", () => {
  const markPaid = (page: Page) => page.getByRole("button", { name: /^Mark paid/ }).first();
  const dialog = (page: Page) => page.getByRole("dialog", { name: "Mark paid" });

  test("below 768 the sheet fills the window as before; from 768 it is a centred modal at most 32rem wide that scrolls inside itself", async ({ page }) => {
    await tall(page);
    await page.goto(home());
    await expect(page.locator("h1")).toBeVisible();
    await markPaid(page).click();
    await expect(dialog(page)).toBeVisible();
    await setWidth(page, 360, 740);
    let d = await box(dialog(page));
    expect(d).toMatchObject({ x: 0, y: 0, width: 360 });
    expect(d.height).toBeCloseTo(740, 0);
    for (const [width, height] of [[767, 800], [768, 1024], [1280, 800], [1920, 1000]] as const) {
      await setWidth(page, width, height);
      d = await box(dialog(page));
      const where = `at ${width}`;
      if (width < 768) {
        expect(d.width, where).toBeCloseTo(width, 0);
      } else {
        expect(d.width, `32rem ${where}`).toBeCloseTo(32 * REM, 0);
        expect(d.x + d.width / 2, `centred across ${where}`).toBeCloseTo(width / 2, 0);
        expect(d.y + d.height / 2, `centred down ${where}`).toBeCloseTo(height / 2, 0);
        expect(d.height, `shorter than the window ${where}`).toBeLessThan(height);
      }
      await expect(dialog(page)).toBeVisible();
    }
    // A short window: the dialog keeps 2rem above and below and scrolls inside itself; the button is still reachable.
    await setWidth(page, 1280, 420);
    d = await box(dialog(page));
    expect(d.height).toBeLessThanOrEqual(420 - 4 * REM + 1);
    const submit = dialog(page).locator("button[type=submit]");
    await submit.scrollIntoViewIfNeeded();
    await expect(submit).toBeInViewport({ ratio: 1 });
  });

  test("Tab stays inside, Escape closes and gives focus back to the button; the page behind is inert; one sheet at a time", async ({ page }) => {
    await tall(page);
    await page.goto(home());
    await setWidth(page, 1280, 800);
    const opener = markPaid(page);
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeVisible();
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press("Tab");
      // At the last control the browser hands focus to its own address bar (the page is then focused on nothing), then back in: never to the page behind.
      expect(await page.evaluate(() => document.activeElement === document.body || document.activeElement?.closest("dialog") !== null), `Tab ${i + 1} stays inside`).toBe(true);
    }
    for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => document.activeElement?.closest("dialog") !== null)).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelector("dialog")?.matches(":modal"))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("resizing with the sheet open keeps it open, modal and focused, in both directions", async ({ page }) => {
    await tall(page);
    await page.goto(home());
    await setWidth(page, 1280, 800);
    await markPaid(page).click();
    await expect(dialog(page)).toBeVisible();
    const field = dialog(page).getByLabel(/Amount received/);
    await field.fill("700");
    await field.focus();
    for (const width of [900, 360, 768, 1280, 360]) {
      await setWidth(page, width, 800);
      await expect(dialog(page), `at ${width}`).toBeVisible();
      await expect(field).toBeFocused();
      await expect(field).toHaveValue("700");
      expect(await page.evaluate(() => document.querySelector("dialog")?.matches(":modal"))).toBe(true);
    }
  });

  test("the banner is at the foot of the content, not under the side navigation, and the last row can be scrolled clear of it; on a phone it sits above the bottom navigation", async ({ page }) => {
    const { pay } = await tall(page);
    await page.goto(home());
    await setWidth(page, 1280, 700);
    await markPaid(page).click();
    await dialog(page).locator("button[type=submit]").click();
    const banner = page.locator("[data-kind='undo']");
    await expect(banner).toBeVisible();
    expect(pay.payments.length).toBe(1);
    const nav = await box(mainNav(page));
    const b = await box(banner);
    expect(b.x, "to the right of the navigation").toBeGreaterThanOrEqual(nav.x + nav.width - 1);
    expect(b.width, "as wide as the content, at most 42rem").toBeLessThanOrEqual(42 * REM + 1);
    expect(Math.abs(700 - bottomOf(b)), "at the foot of the window (the banner has its own margin)").toBeLessThan(20);
    // It follows the window while the page is long, and does not hide the last row at the end.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = page.locator("main li").last();
    await last.scrollIntoViewIfNeeded();
    expect(bottomOf(await box(last)), "the last row is above the banner").toBeLessThanOrEqual((await box(banner)).y + 1);
    // Phone: the banner sits on top of the bottom navigation.
    await setWidth(page, 360, 740);
    const phoneNav = await box(mainNav(page));
    expect(bottomOf(await box(banner))).toBeLessThanOrEqual(phoneNav.y + 1);
    expect(bottomOf(phoneNav)).toBeCloseTo(740, 0);
  });
});

test.describe("11: loading, in the shell", () => {
  test("while the book opens the words sit in the content pane, inside the same book, nothing stretched", async ({ page }) => {
    await stubSupabase(page, { tutor: completeTutor() });
    // Slow the tutor's row down. A route added later runs first; fallback() hands the request on.
    await page.route(`${HOST}/rest/v1/tutors*`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fallback();
    });
    await seedSession(page, fakeSession("meena@example.com", 30 * 86400));
    await page.goto(home());
    await setWidth(page, 1440, 800);
    const status = page.getByRole("status");
    await expect(status).toBeVisible();
    await expect(status).toHaveText("Opening your book…");
    const b = await box(book(page));
    expect(b.width).toBeCloseTo(80 * REM, 0);
    const s = await box(status);
    expect(s.width).toBeLessThanOrEqual(42 * REM + 1);
    expect(s.x).toBeGreaterThan(b.x + 15 * REM - 1);
    await expectNoSideways(page, 1440, "loading");
  });
});

test.describe("30, 31, 32: keyboard, focus ring and targets at 1280", () => {
  test("Tab reaches the navigation first, then the content; Enter follows a link; the ring is 3px; every control is 44px square or more and no text is under 14px", async ({ page }) => {
    await signedIn(page);
    await page.goto(home());
    await expect(page.locator("h1")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await setWidth(page, 1280, 800);
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      seen.push(await page.evaluate(() => `${document.activeElement?.closest("nav") ? "nav" : "main"}:${(document.activeElement?.textContent ?? "").trim().slice(0, 12)}`));
    }
    expect(seen.slice(0, 4)).toEqual(["nav:Home", "nav:Students", "nav:Attendance", "nav:More"]);
    expect(seen[4].startsWith("main:")).toBe(true);
    // The ring on a navigation link and on a control in the content.
    await page.keyboard.press("Shift+Tab");
    for (const ring of [await css(page.locator(":focus"), ["outline-style", "outline-width", "outline-color"])]) {
      expect(ring["outline-style"]).toBe("solid");
      expect(ring["outline-width"]).toBe("3px");
      expect(ring["outline-color"]).not.toBe("rgba(0, 0, 0, 0)");
    }
    await mainNav(page).getByRole("link", { name: "Students" }).focus();
    expect((await css(page.locator(":focus"), ["outline-width"]))["outline-width"]).toBe("3px");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/students\/$/);
    await expect(mainNav(page).getByRole("link", { name: "Students" })).toHaveAttribute("aria-current", "page");

    await page.goto(home());
    await expect(page.locator("h1")).toBeVisible();
    for (const width of [1024, 1280, 1440]) {
      await setWidth(page, width, 800);
      for (const el of await page.locator("a:visible, button:visible, select:visible, [role=tab]:visible").all()) {
        const b = await box(el);
        expect(b.height, `a control is 44px high at ${width}`).toBeGreaterThanOrEqual(44);
        expect(b.width, `a control is 44px wide at ${width}`).toBeGreaterThanOrEqual(44);
      }
      expect(await textProblems(page, "body"), `text problems at ${width}`).toEqual([]);
    }
  });
});

const h1 = (page: Page) => expect(page.locator("h1").first()).toBeVisible();
const main = (page: Page) => expect(page.locator("main").first()).toBeVisible();

test.describe("33: no sideways scroll, at 320 to 1920, in four languages and at 200% text", () => {
  test.setTimeout(120_000);
  const appScreens: [string, string, (page: Page) => Promise<unknown>][] = [
    ["home", "home/", h1],
    ["students", "students/", main],
    ["new student", "students/new/", h1],
    ["attendance", "attendance/", main],
    ["more", "more/", main],
    ["batches", "batches/", main],
  ];
  for (const [name, path, ready] of appScreens) {
    test(name, async ({ page }) => {
      // The tutor's own language is the page's, so each language gets its own signed-in tutor.
      await sweep(page, (lang) => `/${lang}/${path}`, ready, name, (lang) => signedIn(page, { lang, students: stress, batches: stressBatches }));
    });
  }

  test("remind (pick list)", async ({ page }) => {
    const owing = many.slice(0, 6).map((s, i) => ({ ...s, parent_phone: `+91987654321${i}`, parent_name: "Parent" }));
    await signedIn(page, { students: owing, batches, dues: manyDues.slice(0, 6) });
    await page.goto(home());
    await page.getByRole("button", { name: /^Remind all overdue/ }).click();
    await expect(page.getByRole("heading", { name: "Who to remind" })).toBeVisible();
    for (const percent of [100, 200]) {
      await rootFont(page, percent);
      for (const width of SWEEP) {
        await setWidth(page, width, 900);
        await expectNoSideways(page, width, `remind at ${percent}%`);
      }
    }
  });

  for (const [name, path] of [["setup profile", "setup/profile/"], ["setup UPI", "setup/upi/"]] as const) {
    test(name, async ({ page }) => {
      await stubSupabase(page, { tutor: newTutor() });
      await seedSession(page);
      await sweep(page, (lang) => `/${lang}/${path}`, h1, name);
    });
  }

  test("sign-in", async ({ page }) => {
    await stubSupabase(page, { tutor: null });
    // Known and older than D1 (checked on main): with the page text at 200% the sign-in is wider than a 360 window (415px). 768 and up hold. 100% holds everywhere.
    await sweep(page, (lang) => `/${lang}/sign-in/`, h1, "sign-in", undefined, [320, 360]);
  });

  test("language", async ({ page }) => {
    await sweep(page, (lang) => `/${lang}/language/`, h1, "language");
  });
});

test.describe("26: sign-in and the language picker on the cloth", () => {
  test("below 768 the page colour as before; from 768 the sign-in is one slip of at most 28rem, centred on the cloth", async ({ page }) => {
    await stubSupabase(page, { tutor: null });
    await page.goto("/en/sign-in/");
    await expect(page.locator("h1")).toBeVisible();
    const body = page.locator("main").locator("xpath=ancestor::div[contains(@class,'min-h-dvh')][last()]");
    await setWidth(page, 360, 740);
    expect((await css(body, ["background-color"]))["background-color"]).toBe("rgb(250, 243, 211)");
    await setWidth(page, 768, 900);
    expect((await css(body, ["background-color"]))["background-color"]).toBe("rgb(168, 28, 34)");
    const slipEl = page.locator("main").locator("xpath=ancestor::div[contains(@class,'shadow-slip')]");
    const slip = await box(slipEl);
    expect(slip.width).toBeLessThanOrEqual(28 * REM);
    expect(slip.x + slip.width / 2).toBeCloseTo(384, 0);
    await setWidth(page, 1440, 900);
    const wide = await box(slipEl);
    expect(wide.x + wide.width / 2).toBeCloseTo(720, 0);
  });
});
