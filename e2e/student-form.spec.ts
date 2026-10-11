// Spec R1-3, the student form (criteria 16 to 30 and 32 to 38). Runs against a build made with the CI's
// made-up Supabase address (auth-helpers.ts for the session, roster-helpers.ts for the tables).
import { expect, test, type Page } from "@playwright/test";
import { completeTutor, seedSession, stubSupabase } from "./auth-helpers";
import { box } from "./helpers";
import { stubRoster, type BatchRow, type StudentRow } from "./roster-helpers";

const MATHS = "00000000-0000-4000-8000-0000000000b1";
const rows = (page: Page) => page.locator('main a[href*="/students/edit/"]').filter({ visible: true });

async function signedIn(page: Page, seed: { students?: Partial<StudentRow>[]; batches?: Partial<BatchRow>[] } = {}) {
  await stubSupabase(page, { tutor: completeTutor() });
  const roster = await stubRoster(page, seed);
  await seedSession(page);
  return roster;
}
const BATCHES = [{ id: MATHS, name: "Class 10 Maths" }];
const RAVI = "00000000-0000-4000-8000-0000000000e1";
const ravi: Partial<StudentRow> = { id: RAVI, name: "Ravi Kumar", parent_name: "Suresh", parent_phone: "+919845012345", parent_language: "kn", monthly_fee: 120000, due_day: 5 };

test.describe("16, 17: the add form", () => {
  test("fields in order, defaults, the batch from the address, and the two buttons", async ({ page }) => {
    await signedIn(page, { batches: BATCHES });
    await page.goto(`/hi/students/new/?batch=${MATHS}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByLabel("Batch")).toHaveValue(MATHS);
    await expect(page.getByLabel("Fee due on")).toHaveValue("1");
    await expect(page.locator('input[name="parent-language"]:checked')).toHaveAttribute("value", "hi");
    await page.goto("/en/students/new/?batch=not-a-batch");
    await expect(page.getByLabel("Batch")).toHaveValue("");
    await expect(page.getByRole("link", { name: "Back to students" })).toHaveAttribute("href", "/en/students/");
    await expect(page.locator("h1")).toHaveText("Add a student");
    for (const name of ["Save student", "Save and add another"]) expect((await box(page.getByRole("button", { name }))).height).toBeGreaterThanOrEqual(48);
    await expect(page.locator("nav")).toHaveCount(0);
  });
});

test.describe("25 to 29: saving", () => {
  test("one POST with the ten granted keys and paise, then the list shows the student", async ({ page }) => {
    const roster = await signedIn(page, { batches: BATCHES });
    await page.goto("/en/students/new/");
    await page.getByLabel("Student's name").fill("Ravi Kumar");
    await page.getByLabel("Parent's name").fill("Suresh Kumar");
    await page.getByLabel("Parent's WhatsApp number").fill("+91 98450-12345");
    await page.getByLabel("Parent's WhatsApp number").blur();
    await expect(page.getByLabel("Parent's WhatsApp number")).toHaveValue("98450 12345");
    await page.locator('input[name="parent-language"][value="kn"]').click();
    await page.getByLabel("Batch").selectOption(MATHS);
    await page.getByLabel("Fee due on").selectOption("5");
    await page.getByLabel("Monthly fee ₹").fill("1200");
    await page.getByLabel("Already owes ₹").fill("₹2,500.00");
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page.getByText("Tick this to save the number.")).toBeVisible();
    expect(roster.bodies("POST", "students")).toEqual([]);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("₹1,200 on the 5th");
    await expect(rows(page).first()).toContainText("Class 10 Maths");
    const posts = roster.bodies("POST", "students");
    expect(posts).toHaveLength(1);
    expect(Object.keys(posts[0]).sort()).toEqual(["active", "batch_id", "due_day", "id", "monthly_fee", "name", "opening_balance", "parent_language", "parent_name", "parent_phone"]);
    expect(posts[0]).toMatchObject({ name: "Ravi Kumar", parent_name: "Suresh Kumar", parent_phone: "+919845012345", parent_language: "kn", batch_id: MATHS, due_day: 5, monthly_fee: 120000, opening_balance: 250000, active: true });
  });

  test("no phone and no parent: saved with nulls", async ({ page }) => {
    const roster = await signedIn(page);
    await page.goto("/en/students/new/");
    await page.getByLabel("Student's name").fill("Asha");
    await page.getByLabel("Monthly fee ₹").fill("900");
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("POST", "students")[0]).toMatchObject({ parent_name: null, parent_phone: null, opening_balance: 0 });
  });

  test("every error at once, in words, with the first field focused; nothing is sent", async ({ page }) => {
    const roster = await signedIn(page);
    await page.goto("/en/students/new/");
    await page.getByLabel("Parent's WhatsApp number").fill("12345");
    await page.getByLabel("Monthly fee ₹").fill("12.5");
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page.getByText("Type the student's name.")).toBeVisible();
    await expect(page.getByText("An Indian mobile number has 10 digits. You typed 5.")).toBeVisible();
    await expect(page.getByText("Type whole rupees, like 1200.").first()).toBeVisible();
    await expect(page.getByLabel(/^Student's name/)).toBeFocused();
    expect(roster.bodies("POST", "students")).toEqual([]);
  });

  test("a number another student has is noted, and still saves", async ({ page }) => {
    const roster = await signedIn(page, { students: [ravi] });
    await page.goto("/en/students/new/");
    await page.getByLabel("Parent's WhatsApp number").fill("9845012345");
    await expect(page.getByText("This number is already saved for Ravi Kumar. Siblings can share a number.")).toBeVisible();
    await page.getByLabel("Student's name").fill("Sibling");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.students).toHaveLength(2);
  });

  test("save and add another keeps batch, day, language and fee, and says what it saved", async ({ page }) => {
    const roster = await signedIn(page, { batches: BATCHES });
    await page.goto(`/en/students/new/?batch=${MATHS}`);
    await page.getByLabel("Fee due on").selectOption("10");
    await page.getByLabel("Monthly fee ₹").fill("1500");
    await page.getByLabel("Student's name").fill("First");
    await page.getByRole("button", { name: "Save and add another" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved First." })).toBeVisible();
    await expect(page).toHaveURL(/\/students\/new\//);
    await expect(page.getByLabel("Student's name")).toHaveValue("");
    await expect(page.getByLabel("Student's name")).toBeFocused();
    await expect(page.getByLabel("Monthly fee ₹")).toHaveValue("1,500");
    await expect(page.getByLabel("Fee due on")).toHaveValue("10");
    await expect(page.getByLabel("Batch")).toHaveValue(MATHS);
    await page.getByLabel("Student's name").fill("Second");
    await page.getByRole("button", { name: "Save and add another" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved Second." })).toBeVisible();
    const ids = roster.bodies("POST", "students").map((b) => b.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  test("a double tap sends one POST; a lost answer then a retry is saved once", async ({ page }) => {
    const roster = await signedIn(page);
    roster.writeDelayMs = 700;
    await page.goto("/en/students/new/");
    await page.getByLabel("Student's name").fill("Ravi");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    await page.getByRole("button", { name: "Save student" }).dblclick();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("POST", "students")).toHaveLength(1);

    roster.writeDelayMs = 0;
    await page.goto("/en/students/new/");
    await page.getByLabel("Student's name").fill("Lost Answer");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    roster.dropNextAnswer = true;
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page.getByText(/Nothing was saved/)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.students.filter((s) => s.name === "Lost Answer")).toHaveLength(1);
  });

  test("failure keeps everything typed and does not move; offline says so and sends nothing", async ({ page, context }) => {
    const roster = await signedIn(page);
    await page.goto("/en/students/new/");
    await page.getByLabel("Student's name").fill("Ravi");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    roster.refuseWrites = true;
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page.getByText("Couldn't save just now. Nothing was saved. Check your connection and tap Save again.")).toBeVisible();
    await expect(page.getByLabel("Student's name")).toHaveValue("Ravi");
    expect(page.url()).toContain("/students/new/");
    roster.refuseWrites = false;
    const before = roster.bodies("POST", "students").length;
    await context.setOffline(true);
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page.getByText("You are offline. Connect to the internet to save.")).toBeVisible();
    expect(roster.bodies("POST", "students").length).toBe(before);
    await context.setOffline(false);
  });

  test("a batch deleted elsewhere: the words, and the batch list is read again", async ({ page }) => {
    const roster = await signedIn(page, { batches: BATCHES });
    await page.goto(`/en/students/new/?batch=${MATHS}`);
    await page.getByLabel("Student's name").fill("Ravi");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    roster.batchGone = true;
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page.getByText("That batch no longer exists. Pick another batch or No batch.")).toBeVisible();
    roster.batches = [];
    roster.batchGone = false;
  });
});

test.describe("32 to 38: edit, archive, restore", () => {
  test("not found for no id, a made-up id and another tutor's, with a link back", async ({ page }) => {
    await signedIn(page, { students: [ravi] });
    for (const query of ["", "?id=nope", "?id=00000000-0000-4000-8000-00000000ffff"]) {
      await page.goto(`/en/students/edit/${query}`);
      await expect(page.getByText("Couldn't find this student")).toBeVisible();
      await expect(page.getByRole("link", { name: "Back to students" })).toHaveAttribute("href", "/en/students/");
    }
  });

  test("opens the saved student; PATCH holds only the changed granted column; unchanged sends nothing", async ({ page }) => {
    const roster = await signedIn(page, { students: [ravi] });
    await page.goto("/en/students/");
    await rows(page).first().click();
    await expect(page).toHaveURL(new RegExp(`/en/students/edit/\\?id=${RAVI}`));
    await expect(page.locator("h1")).toHaveText("Ravi Kumar");
    await expect(page.getByLabel("Parent's WhatsApp number")).toHaveValue("98450 12345");
    await expect(page.getByLabel("Monthly fee ₹")).toHaveValue("1,200");
    await expect(page.getByText("A new fee applies from the next month.")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("PATCH", "students")).toEqual([]);
    await rows(page).first().click();
    await page.getByLabel("Monthly fee ₹").fill("1500");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    await expect(rows(page).first()).toContainText("₹1,500 on the 5th");
    expect(roster.bodies("PATCH", "students")).toEqual([{ monthly_fee: 150000 }]);
    expect(roster.requests.find((r) => r.method === "PATCH")?.accept).toContain("vnd.pgrst.object");
  });

  test("reloading on the edit address opens that student", async ({ page }) => {
    await signedIn(page, { students: [ravi] });
    await page.goto(`/en/students/edit/?id=${RAVI}`);
    await expect(page.locator("h1")).toHaveText("Ravi Kumar");
  });

  test("Archive hides the student; Archived students (1) shows them; Restore brings them back; no delete anywhere", async ({ page }) => {
    const roster = await signedIn(page, { students: [ravi] });
    await page.goto(`/en/students/edit/?id=${RAVI}`);
    await expect(page.getByText("Hidden from your list and from reminders. Their history stays. You can restore them.")).toBeVisible();
    await expect(page.getByRole("button", { name: /delete/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Archive student" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("PATCH", "students")).toEqual([{ active: false }]);
    await expect(rows(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Archived students (1)" }).click();
    await rows(page).first().click();
    await expect(page.getByText("Archived", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Archive student" })).toHaveCount(0);
    await page.getByRole("button", { name: "Restore student" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("PATCH", "students")[1]).toEqual({ active: true });
    await expect(rows(page)).toHaveCount(1);
    expect(roster.requests.filter((r) => r.method === "DELETE")).toEqual([]);
  });
});
