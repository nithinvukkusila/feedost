// UX-review-fixes-2, PR2: forms and controls (items 5, 6, 7, 12, 17 and 24). Runs against a build made with the
// CI's made-up Supabase address (auth-helpers.ts for the session, roster-helpers.ts for the tables). The
// accessibility walk (A.1 to A.4) is in a11y-forms.spec.ts.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { completeTutor, seedSession, stubSupabase } from "./auth-helpers";
import { S, signedIn as boardSignedIn, STUDENTS as BOARD_STUDENTS } from "./board-fixture";
import { box, css, docBox, fontsSettled, messageText, rgb, shadow, sidewaysScroll, type Lang } from "./helpers";
import { stubRoster, type BatchRow, type StudentRow } from "./roster-helpers";

const MATHS = "00000000-0000-4000-8000-0000000000b1";
const SCIENCE = "00000000-0000-4000-8000-0000000000b2";
const RAVI = "00000000-0000-4000-8000-0000000000e1";
const ASHA = "00000000-0000-4000-8000-0000000000e2";
const BATCHES: Partial<BatchRow>[] = [
  { id: MATHS, name: "Class 10 Maths" },
  { id: SCIENCE, name: "Class 8 Science" },
];
const ravi: Partial<StudentRow> = { id: RAVI, name: "Ravi Kumar", parent_name: "Suresh", parent_phone: "+919845012345", parent_language: "kn", monthly_fee: 120000, due_day: 5 };
const asha: Partial<StudentRow> = { id: ASHA, name: "Asha Rao", parent_phone: null, monthly_fee: 100000, due_day: 1 };
const LONG = "A".repeat(80);

async function signedIn(page: Page, seed: { students?: Partial<StudentRow>[]; batches?: Partial<BatchRow>[] } = {}, lang = "en") {
  await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
  const roster = await stubRoster(page, seed);
  await seedSession(page);
  return roster;
}

const words = (lang: Lang, key: string) => messageText(lang, `students.form.${key}`);
const phone = (page: Page) => page.getByLabel("Parent's WhatsApp number");
const tick = (page: Page) => page.getByRole("checkbox", { name: /permission/ });
const toast = (page: Page) => page.locator("[data-saved-toast]");

async function largestFont(page: Page) {
  await page.addStyleTag({ content: "html{font-size:200%}" });
  await fontsSettled(page);
}

test.describe("item 5: the month arrows", () => {
  test("5.1: with no month before this one, the month shows alone with no arrow buttons", async ({ page }) => {
    await boardSignedIn(page, { dues: [{ student_id: S.ravi, due_date: "2026-10-05", amount: 120000 }] });
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText(/october 2026/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Previous month" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Next month" })).toHaveCount(0);
  });

  test("5.2: the dead arrow is 44px, disabled, not-allowed, no shadow, dashed, its icon in rule; the live one is ink", async ({ page }) => {
    await boardSignedIn(page);
    await page.goto("/en/home/");
    const next = page.getByRole("button", { name: "Next month" });
    const prev = page.getByRole("button", { name: "Previous month" });
    await expect(next).toBeDisabled();
    await expect(prev).toBeEnabled();
    const b = await box(next);
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    const dead = await css(next, ["cursor", "border-top-style", "color"]);
    expect(dead).toEqual({ cursor: "not-allowed", "border-top-style": "dashed", color: rgb("rule") });
    expect(await shadow(next)).toBe("none");
    const live = await css(prev, ["color", "border-top-style"]);
    expect(live.color).toBe(rgb("ink"));
    expect(live["border-top-style"]).not.toBe("dashed");
  });
});

test.describe("items 6 and 12.3: Save and add another", () => {
  async function fillOne(page: Page, name: string, lang: Lang = "en") {
    await page.getByLabel(words(lang, "name"), { exact: false }).first().fill(name);
  }
  const buttons = (page: Page, lang: Lang = "en") => [
    page.getByRole("button", { name: words(lang, "save"), exact: true }),
    page.getByRole("button", { name: words(lang, "saveAnother"), exact: true }),
  ];

  // "Before" is read with the name field empty, as it is again after the save: an 80-character name wraps the field
  // onto several lines at the largest font, and the form clearing it is not the toast moving anything. Every other
  // field keeps its value, so the two states differ only by the toast.
  async function boxesStay(page: Page, name: string, lang: Lang = "en") {
    const [save, another] = buttons(page, lang);
    const before = [await docBox(save), await docBox(another)];
    await fillOne(page, name, lang);
    await another.click();
    await expect(toast(page).getByRole("status")).toContainText(words(lang, "savedKept").replace("{name}", name).slice(0, 10));
    // The tapped button springs back out of its shadow in 80ms (its own press, not the layout): read once it has.
    await expect.poll(async () => [await docBox(save), await docBox(another)]).toEqual(before);
    return before;
  }

  test("6.1 and 12.3: a toast at the foot says who and what was kept; focus goes to the name; the buttons move 0px", async ({ page }) => {
    const roster = await signedIn(page, { batches: BATCHES });
    await page.goto(`/en/students/new/?batch=${MATHS}`);
    await page.getByLabel("Fee due on").selectOption("10");
    await page.getByLabel("Monthly fee ₹").fill("1500");
    await page.locator('input[name="parent-language"][value="kn"]').check();
    await boxesStay(page, "First");
    await expect(page.getByRole("status").filter({ hasText: "Saved First." })).toHaveText(
      "Saved First. Batch, fee, due day and language kept for the next one.",
    );
    // Not in the form's flow: pinned at the foot of the window.
    await expect(page.locator("form [data-saved-toast]")).toHaveCount(0);
    const t = await box(toast(page));
    expect(Math.round(t.y + t.height)).toBe(740);
    await expect(page.getByLabel("Student's name")).toBeFocused();
    await expect(page.getByLabel("Batch")).toHaveValue(MATHS);
    await expect(page.getByLabel("Fee due on")).toHaveValue("10");
    await expect(page.getByLabel("Monthly fee ₹")).toHaveValue("1,500");
    await expect(page.locator('input[name="parent-language"]:checked')).toHaveAttribute("value", "kn");
    expect(roster.bodies("POST", "students")).toHaveLength(1);
  });

  test("6.1: at the largest font with an 80-character name with no spaces, the buttons still move 0px", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    await expect(page.locator("h1")).toBeVisible();
    await largestFont(page);
    await page.getByLabel("Monthly fee ₹").fill("1000");
    await boxesStay(page, LONG);
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("6.2: role=status, announced from one region, and gone after 10 seconds without moving anything", async ({ page }) => {
    await page.clock.install();
    await signedIn(page);
    await page.goto("/en/students/new/");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    const before = await boxesStay(page, "Ravi");
    await expect(page.getByRole("status")).toHaveCount(1);
    await expect(toast(page)).toHaveAttribute("aria-live", "polite");
    await page.clock.runFor(10_500);
    await expect(page.getByRole("status")).toHaveCount(0);
    const [save, another] = buttons(page);
    expect([await docBox(save), await docBox(another)]).toEqual(before);
  });

  test("6.2: the toast goes when the next save starts, and when the tutor leaves the screen", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    await boxesStay(page, "Ravi");
    // The next save starts (and stops at the empty name): the toast goes.
    await page.getByRole("button", { name: "Save and add another" }).click();
    await expect(page.getByText("Type the student's name.")).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
    await fillOne(page, "Asha");
    await page.getByRole("button", { name: "Save and add another" }).click();
    await expect(page.getByRole("status")).toContainText("Saved Asha.");
    await page.getByRole("link", { name: "Back to students" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    await expect(page.getByText(/^Saved Asha\./)).toHaveCount(0);
  });

  test("6.4: in Hindi at the largest font both buttons scroll fully above the toast, whose words wrap inside the screen", async ({ page }) => {
    await signedIn(page, {}, "hi");
    await page.goto("/hi/students/new/");
    await expect(page.locator("h1")).toBeVisible();
    await largestFont(page);
    await page.getByLabel(new RegExp(words("hi", "fee").slice(0, 6))).first().fill("1000");
    await fillOne(page, LONG, "hi");
    await buttons(page, "hi")[1].click();
    await expect(toast(page).getByRole("status")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const t = await box(toast(page));
    for (const button of buttons(page, "hi")) {
      const b = await box(button);
      expect(b.y + b.height, "a button is covered by the toast").toBeLessThanOrEqual(t.y + 0.5);
    }
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.x + t.width).toBeLessThanOrEqual(360);
    const status = toast(page).getByRole("status");
    expect(await status.evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("6.3: a quick double tap on Save and add another makes one student and does not Save student", async ({ page }) => {
    const roster = await signedIn(page);
    roster.writeDelayMs = 700;
    await page.goto("/en/students/new/");
    await page.getByLabel("Student's name").fill("Ravi");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    await page.getByRole("button", { name: "Save and add another" }).dblclick();
    await expect(page.getByRole("status")).toContainText("Saved Ravi.");
    await expect(page).toHaveURL(/\/en\/students\/new\/$/);
    expect(roster.bodies("POST", "students")).toHaveLength(1);
  });
});

test.describe("item 7: the permission tick on edit", () => {
  test("7.1: ticked for a saved number; unticked and not required for a student with none", async ({ page }) => {
    const roster = await signedIn(page, { students: [ravi, asha] });
    await page.goto(`/en/students/edit/?id=${RAVI}`);
    await expect(tick(page)).toBeChecked();
    await page.goto(`/en/students/edit/?id=${ASHA}`);
    await expect(tick(page)).not.toBeChecked();
    await page.getByLabel("Monthly fee ₹").fill("1100");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("PATCH", "students")).toEqual([{ monthly_fee: 110000 }]);
  });

  test("7.2: a different number unticks the tick and asks for it again before Save", async ({ page }) => {
    const roster = await signedIn(page, { students: [ravi] });
    await page.goto(`/en/students/edit/?id=${RAVI}`);
    await phone(page).fill("9886044321");
    await expect(tick(page)).not.toBeChecked();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Tick this to save the number.")).toBeVisible();
    expect(roster.bodies("PATCH", "students")).toEqual([]);
  });

  test("7.3: unticking warns under the tick and Save removes the number; ticking again keeps it", async ({ page }) => {
    const roster = await signedIn(page, { students: [ravi] });
    await page.goto(`/en/students/edit/?id=${RAVI}`);
    await tick(page).uncheck();
    const warning = page.getByText(
      "Without the parent's OK the number can't be kept. Saving will remove it, and you won't be able to send reminders to this parent until you add it again.",
    );
    await expect(warning).toBeVisible();
    await expect(tick(page)).toHaveAccessibleDescription(/Saving will remove it/);
    await tick(page).check();
    await expect(warning).toHaveCount(0);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("PATCH", "students")).toEqual([]);

    await page.goto(`/en/students/edit/?id=${RAVI}`);
    await tick(page).uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("PATCH", "students")).toEqual([{ parent_phone: null }]);
  });

  test("7.5: after the number is removed, the board row offers Add number instead of Remind", async ({ page }) => {
    const students = BOARD_STUDENTS.map((s) => (s.id === S.ravi ? { ...s, parent_phone: "+919845012345" } : s));
    await boardSignedIn(page, { students });
    await page.goto("/en/home/");
    await expect(page.getByRole("button", { name: "Remind Ravi Kumar" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Add number for Ravi Kumar" })).toHaveCount(0);
    await page.goto(`/en/students/edit/?id=${S.ravi}`);
    await tick(page).uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    await page.goto("/en/home/");
    await expect(page.getByRole("link", { name: "Add number for Ravi Kumar" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Remind Ravi Kumar" })).toHaveCount(0);
  });
});

test.describe("item 12: the add form", () => {
  test("12.1: +91 is fixed before the digits on the field's line, in DM Mono, not in the value, read with the field", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    const prefix = page.locator("form").getByText("+91", { exact: true });
    await expect(prefix).toBeVisible();
    expect((await css(prefix, ["font-family"]))["font-family"]).toMatch(/DM Mono/);
    const p = await box(prefix);
    const field = await box(phone(page));
    expect(p.x + p.width).toBeLessThanOrEqual(field.x + 0.5);
    expect(p.y).toBeLessThan(field.y + field.height);
    expect(p.y + p.height).toBeGreaterThan(field.y);
    await expect(phone(page)).toHaveAccessibleDescription(/^\+91/);
    await phone(page).click();
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await expect(phone(page)).toHaveValue("");
    await expect(prefix).toBeVisible();
  });

  test("12.2: digits group as typed with the caret after the last; a pasted number ends grouped; saved as E.164", async ({ page }) => {
    const roster = await signedIn(page);
    await page.goto("/en/students/new/");
    await phone(page).click();
    await page.keyboard.type("9876543210", { delay: 20 });
    await expect(phone(page)).toHaveValue("98765 43210");
    expect(await phone(page).evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(11);
    await phone(page).fill("");
    await page.keyboard.insertText("+91 98765-43210");
    await expect(phone(page)).toHaveValue("98765 43210");
    await phone(page).fill("");
    await page.keyboard.insertText("०९८७६५ ४३२१०");
    await expect(phone(page)).toHaveValue("98765 43210");
    await page.getByLabel("Student's name").fill("Ravi");
    await page.getByLabel("Monthly fee ₹").fill("1000");
    await tick(page).check();
    await page.getByRole("button", { name: "Save student" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("POST", "students")[0]).toMatchObject({ parent_phone: "+919876543210" });
  });

  test("12.4: the section headings are headline words, at least 20px, in ink, stronger than labels, 32px apart", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    const legends = page.locator("form > fieldset > legend");
    await expect(legends).toHaveText(["Who", "Fee", "Opening balance"]);
    const label = await css(page.locator("form label").first(), ["font-size", "font-family"]);
    for (const legend of await legends.all()) {
      const c = await css(legend, ["font-size", "color", "font-family"]);
      expect(parseFloat(c["font-size"])).toBeGreaterThanOrEqual(20);
      expect(parseFloat(c["font-size"])).toBeGreaterThan(parseFloat(label["font-size"]));
      expect(c.color).toBe(rgb("ink"));
      expect(c["font-family"]).not.toBe(label["font-family"]);
    }
    const sets = await page.locator("form > fieldset").all();
    for (let i = 1; i < sets.length; i++) {
      const above = await box(sets[i - 1]);
      const here = await box(sets[i]);
      expect(Math.round(here.y - (above.y + above.height))).toBe(32);
    }
  });

  test("12.5: a select focused by keyboard draws the 3px blue ring 4px around its line and keeps its chevron", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    await page.getByLabel("Fee due on").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Fee due on")).toBeFocused();
    const line = page.getByLabel("Fee due on").locator("xpath=..");
    expect(await css(line, ["outline-style", "outline-width", "outline-color", "outline-offset"])).toEqual({
      "outline-style": "solid",
      "outline-width": "3px",
      "outline-color": rgb("blue"),
      "outline-offset": "4px",
    });
    await expect(line.locator("svg")).toBeVisible();
  });
});

test.describe("item 17: the Move students sheet", () => {
  const STUDENTS: Partial<StudentRow>[] = [
    { name: "Ravi Kumar", monthly_fee: 120000, batch_id: MATHS },
    { name: "Asha Rao", monthly_fee: 150000, batch_id: SCIENCE },
    { name: "Rahul Shetty", monthly_fee: 100000, batch_id: SCIENCE },
    { name: LONG, monthly_fee: 100000 },
  ];
  async function open(page: Page) {
    const roster = await signedIn(page, { students: STUDENTS, batches: BATCHES });
    await page.goto(`/en/batches/edit/?id=${MATHS}`);
    await page.getByRole("button", { name: "Move students" }).click();
    return { roster, sheet: page.getByRole("dialog") };
  }
  const search = (sheet: Locator) => sheet.getByRole("textbox", { name: "Search student or parent" });
  const confirm = (sheet: Locator) => sheet.getByRole("button", { name: /^Move (here|\d+ students? here)$/ });

  test("17.1: one Cancel, the sheet's own close at the top", async ({ page }) => {
    const { sheet } = await open(page);
    await expect(sheet.getByRole("button", { name: "Cancel" })).toHaveCount(1);
    expect((await box(sheet.getByRole("button", { name: "Cancel" }))).y).toBeLessThan((await box(search(sheet))).y);
  });

  test("17.2: a labelled search filters by name; no match says so and Clear search brings everyone back", async ({ page }) => {
    const { sheet } = await open(page);
    await search(sheet).fill("ra");
    await expect(sheet.getByRole("checkbox", { name: /Asha Rao/ })).toBeVisible();
    await expect(sheet.getByRole("checkbox", { name: /Rahul Shetty/ })).toBeVisible();
    await search(sheet).fill("rahul");
    await expect(sheet.getByRole("checkbox", { name: /Asha Rao/ })).toHaveCount(0);
    await search(sheet).fill("zzz");
    await expect(sheet.getByText("No student matches “zzz”.")).toBeVisible();
    await sheet.getByRole("button", { name: "Clear search" }).click();
    await expect(search(sheet)).toHaveValue("");
    await expect(sheet.getByRole("checkbox", { name: /Asha Rao/ })).toBeVisible();
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("17.3 and 17.4: Select all shown, its state in words; the count keeps hidden ticks and is disabled at 0", async ({ page }) => {
    const { roster, sheet } = await open(page);
    const all = (n: number) => sheet.getByRole("checkbox", { name: new RegExp(`Select all shown \\(${n}\\)`) });
    await expect(all(3)).not.toBeChecked();
    await expect(sheet.getByText("Not selected").first()).toBeVisible();
    await expect(confirm(sheet)).toBeDisabled();
    await all(3).check();
    await expect(confirm(sheet)).toHaveText("Move 3 students here");
    await all(3).uncheck();
    await expect(confirm(sheet)).toHaveText("Move here");
    await expect(confirm(sheet)).toBeDisabled();
    await sheet.getByRole("checkbox", { name: /Asha Rao/ }).check();
    await search(sheet).fill("rahul");
    await expect(confirm(sheet)).toHaveText("Move 1 student here");
    await all(1).check();
    await expect(confirm(sheet)).toHaveText("Move 2 students here");
    await confirm(sheet).click();
    await expect(sheet).toBeHidden();
    expect(roster.students.filter((s) => s.batch_id === MATHS).map((s) => s.name).sort()).toEqual(["Asha Rao", "Rahul Shetty", "Ravi Kumar"]);
  });
});

test.describe("item 24: needs fixing wins over focus", () => {
  test("24.1: a field in error keeps its red line, 4px while focused, and its red label with the words; never blue", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    await page.getByRole("button", { name: "Save student" }).click();
    const name = page.getByLabel(/^Student's name/);
    await expect(name).toBeFocused();
    const line = name.locator("xpath=..");
    const label = page.locator("form label").filter({ hasText: "Student's name" }).first();
    expect(await css(line, ["border-bottom-color", "border-bottom-width"])).toEqual({ "border-bottom-color": rgb("cloth"), "border-bottom-width": "4px" });
    expect((await css(label, ["color"])).color).toBe(rgb("cloth"));
    expect((await css(name, ["color"])).color).not.toBe(rgb("blue"));
    // The state word after the label (the missing tag), still there while focused.
    await expect(label).toHaveText(/^Student's name.+/);
    await page.getByLabel("Monthly fee ₹").focus();
    expect(await css(line, ["border-bottom-color", "border-bottom-width"])).toEqual({ "border-bottom-color": rgb("cloth"), "border-bottom-width": "3px" });
  });
});
