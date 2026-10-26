// UX-review-fixes-2, PR2: the edge cases and the four-language run that ux2-forms.spec.ts does not cover. Section 6
// of the spec (offline unticking, a long name in the Move sheet, select all then search), the caret in the middle of
// the phone field (13.10: Android jumps it to the end unless it is set after the value updates), 7.1's "not required
// unless a number is typed", and the Save and add another flow in en, hi, kn and te.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { completeTutor, seedSession, stubSupabase } from "./auth-helpers";
import { box, docBox, langs, messageText, sidewaysScroll, slow4G, type Lang } from "./helpers";
import { stubRoster, type BatchRow, type StudentRow } from "./roster-helpers";
import { localeNames } from "../src/config/locales";

const MATHS = "00000000-0000-4000-8000-0000000000b1";
const SCIENCE = "00000000-0000-4000-8000-0000000000b2";
const RAVI = "00000000-0000-4000-8000-0000000000e1";
const ASHA = "00000000-0000-4000-8000-0000000000e2";
const BATCHES: Partial<BatchRow>[] = [
  { id: MATHS, name: "Class 10 Maths" },
  { id: SCIENCE, name: "Class 8 Science" },
];
const ravi: Partial<StudentRow> = { id: RAVI, name: "Ravi Kumar", parent_phone: "+919845012345", monthly_fee: 120000, due_day: 5 };
const asha: Partial<StudentRow> = { id: ASHA, name: "Asha Rao", parent_phone: null, monthly_fee: 100000, due_day: 1 };
const LONG = "B".repeat(80);

async function signedIn(page: Page, seed: { students?: Partial<StudentRow>[]; batches?: Partial<BatchRow>[] } = {}, lang = "en") {
  await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
  const roster = await stubRoster(page, seed);
  await seedSession(page);
  return roster;
}

const phone = (page: Page) => page.getByLabel("Parent's WhatsApp number");
const tick = (page: Page) => page.getByRole("checkbox", { name: /permission/ });
const WARNING = messageText("en", "students.form.permissionRemove");

test.describe("the key flow in every language: Save and add another", () => {
  // A name in each language's own script, so the toast's {name} is checked with Indic text too.
  const NAMES: Record<Lang, string> = { en: "Ravi Kumar", hi: "रवि कुमार", kn: "ರವಿ ಕುಮಾರ್", te: "రవి కుమార్" };

  for (const lang of langs) {
    test(`${lang}, slow 4G: the toast says who and what was kept, the radios carry both names, the buttons move 0px`, async ({ page }) => {
      const roster = await signedIn(page, { batches: BATCHES }, lang);
      await slow4G(page);
      const w = (key: string) => messageText(lang, `students.form.${key}`);
      await page.goto(`/${lang}/students/new/?batch=${MATHS}`);
      await expect(page.locator("h1")).toBeVisible();

      // A.2 in this page's language: Kannada is read as its own name and its name here.
      const kn = localeNames.kn;
      const knHere = messageText(lang, "language.name.kn");
      await expect(page.getByRole("radio", { name: `${kn}, ${knHere}`, exact: true })).toBeVisible();

      await page.getByLabel(w("fee"), { exact: true }).fill("1500");
      await page.getByLabel(w("dueDay")).selectOption("7");
      await page.locator('input[name="parent-language"][value="te"]').check();

      const save = page.getByRole("button", { name: w("save"), exact: true });
      const another = page.getByRole("button", { name: w("saveAnother"), exact: true });
      const before = [await docBox(save), await docBox(another)];
      await page.getByLabel(w("name"), { exact: true }).fill(NAMES[lang]);
      await another.click();

      const status = page.locator("[data-saved-toast]").getByRole("status");
      await expect(status).toHaveText(w("savedKept").replace("{name}", NAMES[lang]));
      await expect(page.getByLabel(w("name"), { exact: true })).toBeFocused();
      await expect(page.getByLabel(w("name"), { exact: true })).toHaveValue("");
      await expect.poll(async () => [await docBox(save), await docBox(another)]).toEqual(before);

      // Kept for the next one.
      await expect(page.getByLabel(w("batch"))).toHaveValue(MATHS);
      await expect(page.getByLabel(w("dueDay"))).toHaveValue("7");
      await expect(page.getByLabel(w("fee"), { exact: true })).toHaveValue("1,500");
      await expect(page.locator('input[name="parent-language"]:checked')).toHaveAttribute("value", "te");

      // Exact paise and the stored fields.
      const posted = roster.bodies("POST", "students");
      expect(posted).toHaveLength(1);
      expect(posted[0]).toMatchObject({ name: NAMES[lang], monthly_fee: 150000, due_day: 7, batch_id: MATHS, parent_language: "te" });
      expect(await sidewaysScroll(page)).toBe(0);
    });
  }
});

test.describe("item 7 edges", () => {
  test("7.1: a student with no number is not asked for the tick until a number is typed", async ({ page }) => {
    const roster = await signedIn(page, { students: [asha] });
    await page.goto(`/en/students/edit/?id=${ASHA}`);
    await expect(tick(page)).not.toBeChecked();
    await phone(page).fill("9886044321");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Tick this to save the number.")).toBeVisible();
    expect(roster.bodies("PATCH", "students")).toEqual([]);
    // No removal warning: there was no saved number to remove.
    await expect(page.getByText(WARNING)).toHaveCount(0);
    await tick(page).check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("PATCH", "students")).toEqual([{ parent_phone: "+919886044321" }]);
  });

  test("7.2: no warning while the number is changed; typing the saved one back leaves the tick off and warns it will go", async ({ page }) => {
    const roster = await signedIn(page, { students: [ravi] });
    await page.goto(`/en/students/edit/?id=${RAVI}`);
    await expect(phone(page)).toHaveValue("98450 12345");
    await phone(page).fill("9886044321");
    await expect(tick(page)).not.toBeChecked();
    await expect(page.getByText(WARNING)).toHaveCount(0);
    await phone(page).fill("9845012345");
    await expect(phone(page)).toHaveValue("98450 12345");
    await expect(tick(page)).not.toBeChecked();
    await expect(page.getByText(WARNING)).toBeVisible();
    await tick(page).check();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("PATCH", "students")).toEqual([]);
  });

  test("7.3 offline: unticking and saving while offline says so and sends nothing; back online the number is removed", async ({ page, context }) => {
    const roster = await signedIn(page, { students: [ravi] });
    await page.goto(`/en/students/edit/?id=${RAVI}`);
    await tick(page).uncheck();
    await expect(page.getByText(WARNING)).toBeVisible();
    await context.setOffline(true);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("You are offline. Connect to the internet to save.")).toBeVisible();
    expect(roster.bodies("PATCH", "students")).toEqual([]);
    // Nothing typed is lost: still unticked, still warned.
    await expect(tick(page)).not.toBeChecked();
    await expect(page.getByText(WARNING)).toBeVisible();
    await context.setOffline(false);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(roster.bodies("PATCH", "students")).toEqual([{ parent_phone: null }]);
    expect(roster.students.find((s) => s.id === RAVI)?.parent_phone).toBeNull();
  });

  test("7.4: removing the number writes only the students row; nothing is sent to consents", async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (request) => {
      if (request.method() !== "GET" && request.method() !== "HEAD" && request.method() !== "OPTIONS" && request.url().includes("/rest/v1/")) {
        writes.push(`${request.method()} ${new URL(request.url()).pathname}`);
      }
    });
    await signedIn(page, { students: [ravi] });
    await page.goto(`/en/students/edit/?id=${RAVI}`);
    await tick(page).uncheck();
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page).toHaveURL(/\/en\/students\/$/);
    expect(writes).toEqual(["PATCH /rest/v1/students"]);
  });
});

test.describe("12.2: the caret in the middle of the phone number", () => {
  const caret = (page: Page) => phone(page).evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.selectionEnd]);

  test("a digit typed in the middle and a digit deleted before the space leave the caret where the finger is", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    await phone(page).click();
    await page.keyboard.type("987654321", { delay: 20 });
    await expect(phone(page)).toHaveValue("98765 4321");
    await phone(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(3, 3));
    await page.keyboard.type("0");
    await expect(phone(page)).toHaveValue("98706 54321");
    expect(await caret(page)).toEqual([4, 4]);
    await page.keyboard.press("Backspace");
    await expect(phone(page)).toHaveValue("98765 4321");
    expect(await caret(page)).toEqual([3, 3]);
    // Typing the tenth digit at the caret crosses the space.
    await phone(page).evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(5, 5));
    await page.keyboard.type("1");
    await expect(phone(page)).toHaveValue("98765 14321");
    expect(await caret(page)).toEqual([7, 7]);
  });

  test("an 11-digit number starting 0 typed in full ends grouped, and one too many digits is left for the field's error", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    await phone(page).click();
    await page.keyboard.type("09876543210", { delay: 20 });
    await expect(phone(page)).toHaveValue("98765 43210");
    await page.keyboard.type("9");
    await expect(phone(page)).toHaveValue("98765 432109");
  });

  test("a Kannada and a Telugu paste end as 98765 43210", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/new/");
    for (const pasted of ["೦೯೮೭೬೫ ೪೩೨೧೦", "+91 ౯౮౭౬౫-౪౩౨౧౦"]) {
      await phone(page).fill("");
      await phone(page).focus();
      await page.keyboard.insertText(pasted);
      await expect(phone(page)).toHaveValue("98765 43210");
      expect(await caret(page)).toEqual([11, 11]);
    }
  });
});

test.describe("item 17 edges: the Move sheet", () => {
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

  test("17.4: select all, then search: the count keeps every tick, including those the search hides", async ({ page }) => {
    const { roster, sheet } = await open(page);
    await sheet.getByRole("checkbox", { name: /Select all shown \(3\)/ }).check();
    await expect(confirm(sheet)).toHaveText("Move 3 students here");
    await search(sheet).fill("asha");
    await expect(sheet.getByRole("checkbox", { name: /Select all shown \(1\)/ })).toBeChecked();
    await expect(confirm(sheet)).toHaveText("Move 3 students here");
    // Clearing "all shown" while searching clears only the one shown.
    await sheet.getByRole("checkbox", { name: /Select all shown \(1\)/ }).uncheck();
    await expect(confirm(sheet)).toHaveText("Move 2 students here");
    await search(sheet).fill("");
    await expect(sheet.getByRole("checkbox", { name: /Asha Rao/ })).not.toBeChecked();
    await confirm(sheet).click();
    await expect(sheet).toBeHidden();
    expect(roster.students.filter((s) => s.batch_id === MATHS).map((s) => s.name).sort()).toEqual(["Rahul Shetty", "Ravi Kumar", LONG].sort());
  });

  test("an 80-character name found by search wraps inside the sheet: nothing cut, no sideways scroll", async ({ page }) => {
    const { sheet } = await open(page);
    await search(sheet).fill("BBBB");
    const row = sheet.getByRole("checkbox", { name: new RegExp(LONG) });
    await expect(row).toHaveCount(1);
    await expect(sheet.getByRole("checkbox", { name: /Select all shown \(1\)/ })).toBeVisible();
    const name = sheet.getByText(LONG, { exact: true });
    const n = await box(name);
    const s = await box(sheet);
    expect(n.x).toBeGreaterThanOrEqual(s.x);
    expect(n.x + n.width).toBeLessThanOrEqual(s.x + s.width + 0.5);
    expect(await name.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await sidewaysScroll(page)).toBe(0);
  });
});
