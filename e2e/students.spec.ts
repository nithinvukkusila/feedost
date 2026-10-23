// Spec R1-3, the Students list, the bottom navigation, Attendance and the home (criteria 1 to 15 and 54).
// Runs against a build made with the CI's made-up Supabase address; Playwright answers every request to it
// (auth-helpers.ts for the session and the tutor, roster-helpers.ts for the two tables).
import { expect, test, type Page } from "@playwright/test";
import { completeTutor, seedSession, stubSupabase, watchOtherHosts } from "./auth-helpers";
import { box } from "./helpers";
import { stubRoster, type BatchRow, type StudentRow } from "./roster-helpers";

const ORIGIN = "http://localhost:4173";
// The archived students are in the page but folded away; only what is shown counts.
const rows = (page: Page) => page.locator('main a[href*="/students/edit/"]').filter({ visible: true });
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

type Seed = { students?: Partial<StudentRow>[]; batches?: Partial<BatchRow>[] };

/** A signed-in tutor with a finished profile and these rows in the two tables. */
async function signedIn(page: Page, seed: Seed = {}) {
  const stub = await stubSupabase(page, { tutor: completeTutor() });
  const roster = await stubRoster(page, seed);
  await seedSession(page);
  return { stub, roster };
}

const THREE_BATCHES = [
  { id: "00000000-0000-4000-8000-0000000000b1", name: "Class 10 Maths", timings: "Mon, Wed 5 pm" },
  { id: "00000000-0000-4000-8000-0000000000b2", name: "Class 8 Science" },
];
const PEOPLE: Partial<StudentRow>[] = [
  { name: "Ravi Kumar", parent_name: "Suresh Kumar", parent_phone: "+919886044321", monthly_fee: 120000, due_day: 5, batch_id: THREE_BATCHES[0].id },
  { name: "Asha Rao", parent_phone: "+919845012345", monthly_fee: 150000, due_day: 1, batch_id: THREE_BATCHES[1].id },
  { name: "Meena Shetty", monthly_fee: 100000, due_day: 22 },
  { name: "Old Student", monthly_fee: 90000, active: false },
];

test.describe("1: a signed-out visitor never sees the new screens", () => {
  for (const route of ["students", "attendance"]) {
    test(`/en/${route}/ goes to sign-in`, async ({ page }) => {
      await stubSupabase(page);
      await page.goto(`/en/${route}/`);
      await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    });
  }
});

test.describe("2, 3: the bottom navigation and Attendance", () => {
  test("shows on home, students and attendance with the right item current, 44px high, and a tap does not reload the page", async ({ page }) => {
    await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toBeVisible();
    await page.evaluate(() => ((window as unknown as { kept: number }).kept = 1));
    for (const [name, key, path] of [
      ["Home", "home", "/en/home/"],
      ["Students", "students", "/en/students/"],
      ["Attendance", "attendance", "/en/attendance/"],
    ] as const) {
      await nav(page).getByRole("link", { name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator("h1")).toBeVisible();
      const links = nav(page).getByRole("link");
      await expect(links).toHaveCount(4);
      for (const item of ["home", "students", "attendance", "more"]) {
        const link = nav(page).locator(`[data-item="${item}"]`);
        if (item === key) await expect(link).toHaveAttribute("aria-current", "page");
        else await expect(link).not.toHaveAttribute("aria-current", "page");
        expect((await box(link)).height).toBeGreaterThanOrEqual(44);
      }
    }
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(1);
  });

  test("Attendance is a title, one line and the nav", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/attendance/");
    await expect(page.locator("h1")).toHaveText("Attendance");
    await expect(page.getByText("Attendance is not ready yet. Your students and fees work without it.")).toBeVisible();
    // The four links of the navigation and the way back to Home.
    await expect(page.locator("a")).toHaveCount(5);
    await expect(page.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/en/home/");
    await expect(nav(page).getByRole("link")).toHaveCount(4);
    await expect(page.locator("button")).toHaveCount(0);
  });
});

test.describe("4 to 9: the list", () => {
  test("header, rows, order, fee and day, batch, no phone, archived hidden", async ({ page }) => {
    await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    await page.goto("/en/students/");
    await expect(page.locator("h1")).toHaveText("Students");
    await expect(page.getByText(/^3 students/)).toContainText("2 batches");
    const add = page.getByRole("link", { name: "Add", exact: true });
    await expect(add).toHaveAttribute("href", "/en/students/new/");
    expect((await box(add)).height).toBeGreaterThanOrEqual(48);

    await expect(rows(page)).toHaveCount(3);
    const first = rows(page).nth(0);
    await expect(first).toContainText("01");
    await expect(first).toContainText("Asha Rao");
    await expect(first).toContainText("₹1,500 on the 1st");
    await expect(first).toContainText("Class 8 Science");
    const second = rows(page).nth(1);
    await expect(second).toContainText("Meena Shetty");
    await expect(second).toContainText("₹1,000 on the 22nd");
    await expect(second).not.toContainText("Class");
    const third = rows(page).nth(2);
    await expect(third).toContainText("Ravi Kumar");
    await expect(third).toContainText("Suresh Kumar");
    await expect(third).toContainText("₹1,200 on the 5th");
    for (const row of await rows(page).all()) expect((await box(row)).height).toBeGreaterThanOrEqual(60);
    await expect(page.getByText("Old Student")).toBeHidden();
    await expect(page.getByText("98860")).toHaveCount(0);
    await expect(third).toHaveAttribute("href", /\/en\/students\/edit\/\?id=00000000-0000-4000-8000-/);
  });

  test("search by name, parent and phone digits, no match with Clear search, and combined with a batch tab", async ({ page }) => {
    await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    await page.goto("/en/students/");
    const box = page.getByLabel("Search student or parent");
    await box.fill("ravi");
    await expect(rows(page)).toHaveCount(1);
    await box.fill("suresh");
    await expect(rows(page).first()).toContainText("Ravi Kumar");
    await box.fill("98450");
    await expect(rows(page).first()).toContainText("Asha Rao");
    await box.fill("   ");
    await expect(rows(page)).toHaveCount(3);
    await box.fill("zzz");
    await expect(page.getByText("No student matches “zzz”.")).toBeVisible();
    await page.getByRole("button", { name: "Clear search" }).click();
    await expect(rows(page)).toHaveCount(3);
    await expect(box).toHaveValue("");

    await page.getByRole("tab", { name: /Class 10 Maths/ }).click();
    await box.fill("a");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Ravi Kumar");
  });

  test("tabs for two batches, with counts and No batch; choosing one does not read the tables again", async ({ page }) => {
    const { roster } = await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    await page.goto("/en/students/");
    await expect(page.getByRole("tab")).toHaveText(["All 3", "Class 10 Maths 1", "Class 8 Science 1", "No batch 1"]);
    const reads = roster.requests.length;
    await page.getByRole("tab", { name: "No batch 1" }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Meena Shetty");
    await page.getByRole("tab", { name: "All 3" }).click();
    await expect(rows(page)).toHaveCount(3);
    expect(roster.requests.length).toBe(reads);
  });

  test("a select above three batches", async ({ page }) => {
    const batches = ["Alpha", "Bravo", "Charlie", "Delta"].map((name, i) => ({ id: `00000000-0000-4000-8000-00000000c00${i}`, name }));
    await signedIn(page, { students: [{ name: "Zed", batch_id: batches[3].id }, { name: "Yan" }], batches });
    await page.goto("/en/students/");
    await expect(page.getByRole("tab")).toHaveCount(0);
    const select = page.getByLabel("Show");
    await expect(select.locator("option")).toHaveText(["All 2", "Alpha 0", "Bravo 0", "Charlie 0", "Delta 1", "No batch 1"]);
    await select.selectOption({ label: "Delta 1" });
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Zed");
  });

  test("a Batches link of 44px or more, and a folded list of archived students", async ({ page }) => {
    await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    await page.goto("/en/students/");
    const link = page.getByRole("link", { name: "Batches", exact: true });
    await expect(link).toHaveAttribute("href", "/en/batches/");
    expect((await box(link)).height).toBeGreaterThanOrEqual(44);
    const fold = page.getByRole("button", { name: "Archived students (1)" });
    await expect(page.getByText("Old Student")).toBeHidden();
    await fold.click();
    await expect(page.getByText("Old Student")).toBeVisible();
    await expect(page.getByText("Archived", { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(4);
    await fold.click();
    await expect(page.getByText("Old Student")).toBeHidden();
  });
});

test.describe("10, 11, 12: empty, loading and failing", () => {
  test("empty: the heading, one line and a black Add a student button, and not when a search finds nothing", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/");
    await expect(page.getByRole("heading", { name: "No students yet." })).toBeVisible();
    await expect(page.getByText("Add your first student. It takes a minute.")).toBeVisible();
    const add = page.getByRole("link", { name: "Add a student" });
    await expect(add).toHaveAttribute("href", "/en/students/new/");
    expect((await box(add)).height).toBeGreaterThanOrEqual(48);
    await expect(page.getByLabel("Search student or parent")).toHaveCount(0);
  });

  test("loading: grey blocks and the words, then the list", async ({ page }) => {
    const { roster } = await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    roster.listDelayMs = 2500;
    await page.goto("/en/students/");
    await expect(page.getByRole("status")).toHaveText("Opening your book…");
    await expect(page.locator("h1")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(3);
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("failed: the banner says what happened and what is safe, Try again reads again, nobody is signed out", async ({ page }) => {
    test.setTimeout(60_000);
    const { roster } = await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    roster.networkDown = true;
    await page.goto("/en/students/");
    const alert = page.locator('[role="alert"][data-kind="error"]');
    await expect(alert).toContainText("Couldn't load your students", { timeout: 25_000 });
    await expect(alert).toContainText("The network dropped. Nothing is lost.");
    expect(page.url()).toBe(`${ORIGIN}/en/students/`);
    roster.networkDown = false;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(rows(page)).toHaveCount(3);
    expect(page.url()).toBe(`${ORIGIN}/en/students/`);
  });

  test("a refresh that fails keeps the cached list under a quiet note", async ({ page }) => {
    test.setTimeout(60_000);
    const { roster } = await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    await page.goto("/en/students/");
    await expect(rows(page)).toHaveCount(3);
    roster.networkDown = true;
    await nav(page).getByRole("link", { name: "Home", exact: true }).click();
    await nav(page).getByRole("link", { name: "Students", exact: true }).click();
    await expect(page.getByText("Showing what was saved on this phone.")).toBeVisible({ timeout: 25_000 });
    await expect(rows(page)).toHaveCount(3);
    await expect(page.locator('[role="alert"][data-kind="error"]')).toHaveCount(0);
  });
});

test.describe("13 to 15: the home", () => {
  test("with no students: the empty book and a black Add a student button", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Your book is empty.");
    await expect(page.getByText("Adding students arrives in the next update.")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Add a student" })).toHaveAttribute("href", "/en/students/new/");
  });

  test("with students and no fee reached yet: the board says nothing is due yet and the R1-3 filled home is gone", async ({ page }) => {
    // The words below depend on today, so fix it to 12 Oct 2026 (India) rather than read the real clock.
    await page.clock.setFixedTime(new Date("2026-10-12T05:00:00Z"));
    await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    await page.goto("/en/home/");
    // R1-6 replaced the R1-3 filled home (the count, the monthly total, "See all students", the later line).
    await expect(page.locator("h1")).toHaveText("Nothing is due yet.");
    // Today is 12 Oct; the soonest ahead is the 22nd, so the first fee is made on 22 Oct 2026 (UX-review-fixes, U1).
    await expect(page.getByText("Your next fee comes in on 22 Oct 2026.")).toBeVisible();
    await expect(page.getByText("add it under Already owes")).toBeVisible();
    await expect(page.getByRole("link", { name: "See your students" })).toHaveAttribute("href", "/en/students/");
    await expect(page.getByText("each month")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "See all students" })).toHaveCount(0);
    await expect(page.getByText("Who owes what appears here in a later update.")).toHaveCount(0);
    await expect(page.locator("main li")).toHaveCount(0);
    await page.getByRole("link", { name: "See your students" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    await expect(rows(page)).toHaveCount(3);
  });

  test("loading and failing look as they do on the list", async ({ page }) => {
    test.setTimeout(60_000);
    const { roster } = await signedIn(page, { students: PEOPLE });
    roster.listDelayMs = 2000;
    await page.goto("/en/home/");
    await expect(page.getByRole("status")).toHaveText("Opening your book…");
    await expect(page.locator("h1")).toHaveText("Nothing is due yet.");
    roster.listDelayMs = 0;
    roster.networkDown = true;
    await page.goto("/en/home/");
    await expect(page.locator('[role="alert"][data-kind="error"]')).toContainText("Couldn't load your students", { timeout: 25_000 });
  });
});

test.describe("54: nothing leaves, nothing is set", () => {
  test("the list talks only to its own host and the Supabase host, sets no cookie, never asks for pay_token, and sends no tutor_id", async ({ page, context }) => {
    const { roster } = await signedIn(page, { students: PEOPLE, batches: THREE_BATCHES });
    const others = watchOtherHosts(page, ORIGIN);
    await page.goto("/en/students/");
    await expect(rows(page)).toHaveCount(3);
    expect(others).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    const reads = roster.requests.filter((request) => request.method === "GET");
    expect(reads.map((request) => request.table).sort()).toEqual(["batches", "students"]);
    for (const read of reads) {
      expect(read.query).not.toContain("pay_token");
      expect(read.query).not.toContain("tutor_id");
      expect(read.query).not.toContain("select=%2A");
      expect(read.query).not.toContain("select=*");
    }
  });
});
