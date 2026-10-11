// Spec R1-3, the batch screens (criteria 39 to 43 and 45 to 47). Runs against a build made with the CI's
// made-up Supabase address; Playwright answers every request to it (auth-helpers.ts for the session and the
// tutor, roster-helpers.ts for the two tables).
import { expect, test, type Page } from "@playwright/test";
import { completeTutor, seedSession, stubSupabase } from "./auth-helpers";
import { box } from "./helpers";
import { stubRoster, type BatchRow, type StudentRow } from "./roster-helpers";

const MATHS = "00000000-0000-4000-8000-0000000000b1";
const SCIENCE = "00000000-0000-4000-8000-0000000000b2";
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

async function signedIn(page: Page, seed: { students?: Partial<StudentRow>[]; batches?: Partial<BatchRow>[] } = {}) {
  await stubSupabase(page, { tutor: completeTutor() });
  const roster = await stubRoster(page, seed);
  await seedSession(page);
  return roster;
}

const BATCHES = [
  { id: MATHS, name: "Class 10 Maths", timings: "Mon, Wed 5 pm" },
  { id: SCIENCE, name: "Class 8 Science" },
];
const STUDENTS: Partial<StudentRow>[] = [
  { name: "Ravi Kumar", monthly_fee: 120000, due_day: 5, batch_id: MATHS },
  { name: "Asha Rao", monthly_fee: 150000, due_day: 1, batch_id: MATHS },
  { name: "Old Student", monthly_fee: 999900, active: false, batch_id: MATHS },
  { name: "Meena Shetty", monthly_fee: 100000, due_day: 22, batch_id: SCIENCE },
  { name: "No Batch Kid", monthly_fee: 80000 },
];

test.describe("1, 2: signed out, and the nav", () => {
  for (const route of ["batches", "batches/edit"]) {
    test(`/en/${route}/ goes to sign-in when signed out`, async ({ page }) => {
      await stubSupabase(page);
      await page.goto(`/en/${route}/`);
      await expect(page).toHaveURL(/\/en\/sign-in\/$/);
    });
  }

  test("the batch list has the nav, with Students current; the batch screen has none", async ({ page }) => {
    await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto("/en/batches/");
    await expect(nav(page)).toBeVisible();
    await expect(nav(page).locator('[data-item="students"]')).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: /Class 10 Maths/ }).click();
    await expect(page).toHaveURL(/\/en\/batches\/edit\/\?id=/);
    await expect(page.locator("h1")).toHaveText("Class 10 Maths");
    await expect(nav(page)).toHaveCount(0);
  });
});

test.describe("39: the list", () => {
  test("no batches: the words, and the form", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/batches/");
    await expect(page.locator("h1")).toHaveText("Batches");
    await expect(page.getByText("No batches yet.")).toBeVisible();
    await expect(page.getByText("A batch is a class or group, like Class 10 Maths.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to students" })).toHaveAttribute("href", "/en/students/");
  });

  test("each batch: name, timings, students counted without the archived, the monthly total, one link", async ({ page }) => {
    await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto("/en/batches/");
    const rows = page.locator('main a[href*="/batches/edit/"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Class 10 Maths");
    await expect(rows.nth(0)).toContainText("Mon, Wed 5 pm");
    await expect(rows.nth(0)).toContainText("2 students");
    await expect(rows.nth(0)).toContainText("₹2,700 each month");
    await expect(rows.nth(1)).toContainText("Class 8 Science");
    await expect(rows.nth(1)).toContainText("1 student");
    await expect(rows.nth(1)).toContainText("₹1,000 each month");
    for (const row of await rows.all()) expect((await box(row)).height).toBeGreaterThanOrEqual(60);
    await expect(rows.nth(0)).toHaveAttribute("href", `/en/batches/edit/?id=${MATHS}`);
  });
});

test.describe("40, 41, 46: adding a batch", () => {
  test("a name and timings, one POST with id, name and timings only, and the batch is in the list at once", async ({ page }) => {
    const roster = await signedIn(page, { batches: BATCHES });
    await page.goto("/en/batches/");
    await page.getByLabel("Batch name").fill("  Class  9   English ");
    await page.getByLabel("Timings (optional)").fill("Tue 4 pm");
    const add = page.getByRole("button", { name: "Add batch" });
    expect((await box(add)).height).toBeGreaterThanOrEqual(48);
    await add.click();
    await expect(page.locator('main a[href*="/batches/edit/"]')).toHaveCount(3);
    await expect(page.getByRole("link", { name: /Class 9 English/ })).toContainText("Tue 4 pm");
    await expect(page.getByLabel("Batch name")).toHaveValue("");
    const posts = roster.bodies("POST", "batches");
    expect(posts).toHaveLength(1);
    expect(Object.keys(posts[0]).sort()).toEqual(["id", "name", "timings"]);
    expect(posts[0]).toMatchObject({ name: "Class 9 English", timings: "Tue 4 pm" });
    expect(posts[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(roster.requests.find((r) => r.method === "POST")?.prefer).toContain("return=representation");
  });

  test("empty timings are sent as null; an empty name and a 61-character name are refused with words and nothing is sent", async ({ page }) => {
    const roster = await signedIn(page);
    await page.goto("/en/batches/");
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByText("Type the batch name.")).toBeVisible();
    await expect(page.getByText("Missing", { exact: true })).toBeVisible();
    await page.getByLabel("Batch name").fill("a".repeat(61));
    await expect(page.getByText("Use 60 characters or fewer.")).toBeVisible();
    await expect(page.getByText("Too long", { exact: true })).toBeVisible();
    expect(roster.bodies("POST", "batches")).toEqual([]);
    await page.getByLabel("Batch name").fill("Evening");
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.locator('main a[href*="/batches/edit/"]')).toHaveCount(1);
    expect(roster.bodies("POST", "batches")[0]).toMatchObject({ name: "Evening", timings: null });
  });

  test("the same name in another letter case is refused in the browser first, keeping what was typed", async ({ page }) => {
    const roster = await signedIn(page, { batches: BATCHES });
    await page.goto("/en/batches/");
    await page.getByLabel("Batch name").fill("class 10 MATHS");
    await page.getByLabel("Timings (optional)").fill("Fri");
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByText("You already have a batch called class 10 MATHS. Pick another name.")).toBeVisible();
    await expect(page.getByText("Name taken", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Batch name")).toHaveValue("class 10 MATHS");
    await expect(page.getByLabel("Timings (optional)")).toHaveValue("Fri");
    expect(roster.bodies("POST", "batches")).toEqual([]);
  });

  test("the database refusing a name the browser did not know (made on another phone) is said the same way", async ({ page }) => {
    const roster = await signedIn(page);
    await page.goto("/en/batches/");
    await expect(page.getByText("No batches yet.")).toBeVisible();
    roster.addBatch({ name: "Evening" });
    await page.getByLabel("Batch name").fill("evening");
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByText("You already have a batch called evening. Pick another name.")).toBeVisible();
    await expect(page.getByLabel("Batch name")).toHaveValue("evening");
    expect(roster.bodies("POST", "batches")).toHaveLength(1);
    await page.getByLabel("Batch name").fill("Evening B");
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByRole("link", { name: /Evening B/ })).toBeVisible();
  });

  test("a failed save keeps everything typed, says nothing was saved, and the retry is the same id", async ({ page }) => {
    const roster = await signedIn(page);
    await page.goto("/en/batches/");
    await page.getByLabel("Batch name").fill("Evening");
    await page.getByLabel("Timings (optional)").fill("Mon");
    roster.refuseWrites = true;
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByText("Couldn't save just now. Nothing was saved. Check your connection and tap Save again.")).toBeVisible();
    await expect(page.getByLabel("Batch name")).toHaveValue("Evening");
    await expect(page.getByLabel("Timings (optional)")).toHaveValue("Mon");
    roster.refuseWrites = false;
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByRole("link", { name: /Evening/ })).toBeVisible();
    const posts = roster.bodies("POST", "batches");
    expect(posts).toHaveLength(2);
    expect(posts[0].id).toBe(posts[1].id);
    expect(roster.batches).toHaveLength(1);
  });

  test("an answer lost on the way back: the retry finds the batch already saved and counts it once", async ({ page }) => {
    const roster = await signedIn(page);
    await page.goto("/en/batches/");
    await page.getByLabel("Batch name").fill("Evening");
    roster.dropNextAnswer = true;
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByText("Couldn't save just now.")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByRole("link", { name: /Evening/ })).toBeVisible();
    expect(roster.batches).toHaveLength(1);
    await expect(page.locator('main a[href*="/batches/edit/"]')).toHaveCount(1);
  });

  test("offline: its own words, nothing sent, nothing lost", async ({ page, context }) => {
    const roster = await signedIn(page);
    await page.goto("/en/batches/");
    await page.getByLabel("Batch name").fill("Evening");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByText("You are offline. Connect to the internet to save.")).toBeVisible();
    await expect(page.getByLabel("Batch name")).toHaveValue("Evening");
    expect(roster.bodies("POST", "batches")).toEqual([]);
    await context.setOffline(false);
    await page.getByRole("button", { name: "Add batch" }).click();
    await expect(page.getByRole("link", { name: /Evening/ })).toBeVisible();
  });

  test("a double tap sends one POST", async ({ page }) => {
    const roster = await signedIn(page);
    roster.writeDelayMs = 800;
    await page.goto("/en/batches/");
    await page.getByLabel("Batch name").fill("Evening");
    const add = page.getByRole("button", { name: "Add batch" });
    await add.dblclick();
    await expect(page.getByRole("link", { name: /Evening/ })).toBeVisible();
    expect(roster.bodies("POST", "batches")).toHaveLength(1);
  });
});

test.describe("42, 43, 47: one batch", () => {
  test("title, timings, totals of active students, the students, and an Add a student link that carries the batch", async ({ page }) => {
    await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await expect(page.locator("h1")).toHaveText("Class 10 Maths");
    await expect(page.getByLabel("Timings (optional)")).toHaveValue("Mon, Wed 5 pm");
    await expect(page.getByText("2 students", { exact: true })).toBeVisible();
    await expect(page.getByText("₹2,700", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending")).toHaveCount(0);
    await expect(page.getByText(/attendance/i)).toHaveCount(0);
    const rows = page.locator('main a[href*="/students/edit/"]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Asha Rao");
    await expect(rows.nth(0)).toContainText("₹1,500 on the 1st");
    await expect(rows.nth(1)).toContainText("Ravi Kumar");
    await expect(page.getByText("Old Student")).toHaveCount(0);
    const add = page.getByRole("link", { name: "Add a student" });
    await expect(add).toHaveAttribute("href", `/en/students/new/?batch=${MATHS}`);
    expect((await box(add)).height).toBeGreaterThanOrEqual(48);
  });

  test("an empty batch says so", async ({ page }) => {
    await signedIn(page, { batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${SCIENCE}`);
    await expect(page.getByText("No students in this batch yet.")).toBeVisible();
    await expect(page.getByText("0 students", { exact: true })).toBeVisible();
  });

  test("Rename: a field with Save and Cancel; one PATCH of name and timings; the title changes", async ({ page }) => {
    const roster = await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Batch name").fill("Changed");
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.locator("h1")).toHaveText("Class 10 Maths");
    expect(roster.bodies("PATCH", "batches")).toEqual([]);
    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Batch name").fill("Class 10 Maths A");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator("h1")).toHaveText("Class 10 Maths A");
    expect(roster.bodies("PATCH", "batches")).toEqual([{ name: "Class 10 Maths A", timings: "Mon, Wed 5 pm" }]);
    expect(roster.requests.find((r) => r.method === "PATCH")?.query).toContain(`id=eq.${MATHS}`);
    // The name is the new one on the list, and nothing about the students changed.
    await page.getByRole("link", { name: "Back to batches" }).click();
    await expect(page.getByRole("link", { name: /Class 10 Maths A/ })).toContainText("2 students");
  });

  test("Rename to another batch's name, in any case, is refused with words", async ({ page }) => {
    const roster = await signedIn(page, { batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Batch name").fill("class 8 SCIENCE");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("You already have a batch called class 8 SCIENCE. Pick another name.")).toBeVisible();
    expect(roster.bodies("PATCH", "batches")).toEqual([]);
  });

  test("Save timings sends the saved name and the new timings", async ({ page }) => {
    const roster = await signedIn(page, { batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await page.getByLabel("Timings (optional)").fill("Tue, Thu 6 pm");
    await page.getByRole("button", { name: "Save timings" }).click();
    await expect(page.getByText("Timings saved.")).toBeVisible();
    expect(roster.bodies("PATCH", "batches")).toEqual([{ name: "Class 10 Maths", timings: "Tue, Thu 6 pm" }]);
    await page.getByLabel("Timings (optional)").fill("");
    await page.getByRole("button", { name: "Save timings" }).click();
    await expect.poll(() => roster.bodies("PATCH", "batches").length).toBe(2);
    expect(roster.bodies("PATCH", "batches")[1]).toEqual({ name: "Class 10 Maths", timings: null });
  });

  test("a failed rename keeps the field and says nothing was saved", async ({ page }) => {
    const roster = await signedIn(page, { batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Batch name").fill("Renamed");
    roster.refuseWrites = true;
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Nothing was saved/)).toBeVisible();
    await expect(page.getByLabel("Batch name")).toHaveValue("Renamed");
  });

  test("not found: no id, an id that is not a batch, another tutor's: a plain message and a link back, no loop", async ({ page }) => {
    await signedIn(page, { batches: BATCHES });
    for (const query of ["", "?id=nope", "?id=00000000-0000-4000-8000-00000000ffff"]) {
      await page.goto(`/en/batches/edit/${query}`);
      await expect(page.getByText("Couldn't find this batch")).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to batches" })).toHaveAttribute("href", "/en/batches/");
      expect(page.url()).toContain("/en/batches/edit/");
    }
  });
});

test.describe("45: delete", () => {
  test("a red text link, a sheet that says the students stay, and Cancel changes nothing", async ({ page }) => {
    const roster = await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await expect(page.getByText("Deleting keeps the students.")).toBeVisible();
    const link = page.getByRole("button", { name: "Delete batch" });
    expect((await box(link)).height).toBeGreaterThanOrEqual(44);
    expect(await link.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("underline");
    expect(await link.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
    await link.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Delete Class 10 Maths?")).toBeVisible();
    await expect(sheet.getByText("2 students stay in your book with no batch.")).toBeVisible();
    await sheet.getByRole("button", { name: "Cancel" }).last().click();
    await expect(sheet).toBeHidden();
    expect(roster.requests.filter((r) => r.method === "DELETE")).toEqual([]);
  });

  test("Delete batch deletes it, goes to the list, and its students stay with no batch", async ({ page }) => {
    const roster = await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await page.getByRole("button", { name: "Delete batch" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete batch" }).click();
    await expect(page).toHaveURL(/\/en\/batches\/$/);
    await expect(page.locator('main a[href*="/batches/edit/"]')).toHaveCount(1);
    expect(roster.requests.filter((r) => r.method === "DELETE")).toHaveLength(1);
    expect(roster.batches.map((b) => b.name)).toEqual(["Class 8 Science"]);
    expect(roster.students).toHaveLength(5);
    // Students keep existing: on the list they show no batch.
    await nav(page).getByRole("link", { name: "Students", exact: true }).click();
    await expect(page.getByRole("tab", { name: "No batch 3" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ravi Kumar/ })).not.toContainText("Class 10 Maths");
  });

  test("a failed delete keeps the sheet and says nothing happened", async ({ page }) => {
    const roster = await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await page.getByRole("button", { name: "Delete batch" }).click();
    roster.refuseWrites = true;
    await page.getByRole("dialog").getByRole("button", { name: "Delete batch" }).click();
    await expect(page.getByRole("dialog").getByText(/Nothing was saved/)).toBeVisible();
    await expect(page).toHaveURL(/\/en\/batches\/edit\//);
    expect(roster.batches).toHaveLength(2);
  });
});

test.describe("44: move students", () => {
  test("lists active students from other batches with their batch, moves the ticked ones in one update", async ({ page }) => {
    const roster = await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await page.getByRole("button", { name: "Move students" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Move students to Class 10 Maths")).toBeVisible();
    // Not those already here, and not the archived one.
    await expect(sheet.getByRole("checkbox")).toHaveCount(2);
    await expect(sheet.getByText("In Class 8 Science")).toBeVisible();
    await expect(sheet.getByText("No batch", { exact: true })).toBeVisible();
    // Nothing ticked: nothing to send.
    await expect(sheet.getByRole("button", { name: "Move here" })).toBeDisabled();
    for (const box of await sheet.getByRole("checkbox").all()) expect((await box.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
    await sheet.getByRole("checkbox", { name: /Meena Shetty/ }).check();
    await sheet.getByRole("checkbox", { name: /No Batch Kid/ }).check();
    await sheet.getByRole("button", { name: "Move 2 students here" }).click();
    await expect(sheet).toBeHidden();
    const patches = roster.requests.filter((r) => r.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0].body).toEqual({ batch_id: MATHS });
    expect(roster.students.filter((s) => s.batch_id === MATHS && s.active)).toHaveLength(4);
    await expect(page.getByText("4 students", { exact: true })).toBeVisible();
  });

  test("a failed move keeps the sheet and the ticks and says nothing was moved", async ({ page }) => {
    const roster = await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await page.getByRole("button", { name: "Move students" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("checkbox", { name: /Meena Shetty/ }).check();
    roster.refuseWrites = true;
    await sheet.getByRole("button", { name: "Move 1 student here" }).click();
    await expect(sheet.getByText(/Nothing was moved/)).toBeVisible();
    await expect(sheet.getByRole("checkbox", { name: /Meena Shetty/ })).toBeChecked();
  });
});
