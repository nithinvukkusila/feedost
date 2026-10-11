// Spec R1-3, criterion 51: every new screen in four languages at 360px and at larger text, with long and
// Indian-script names in the data: no sideways scroll, no cut or tiny text (textProblems), every link and
// button at least 44px. A build made with the CI's made-up Supabase address (see auth-helpers.ts).
import { expect, test } from "@playwright/test";
import { completeTutor, seedSession, stubSupabase } from "./auth-helpers";
import { box, langs, messageText, sidewaysScroll, textProblems } from "./helpers";
import { stubRoster } from "./roster-helpers";

const LONG = "A".repeat(80);
const MATHS = "00000000-0000-4000-8000-0000000000b1";
const SCIENCE = "00000000-0000-4000-8000-0000000000b2";
const STUDENT = "00000000-0000-4000-8000-0000000000c1";
const BATCHES = [
  { id: MATHS, name: "Class 10 Maths, Mon Wed Fri evening batch", timings: "Mon, Wed 5 pm" },
  { id: SCIENCE, name: "कक्षा 8 विज्ञान" },
];
const STUDENTS = [
  { id: STUDENT, name: LONG, parent_name: "ಲಕ್ಷ್ಮಿ ನರಸಿಂಹನ್", parent_phone: "+919886044321", monthly_fee: 12345600, due_day: 5, batch_id: MATHS },
  { name: "रवि कुमार शर्मा", parent_name: "సుబ్రమణ్యం", monthly_fee: 120000, due_day: 1, batch_id: SCIENCE },
  { name: "Old Student", monthly_fee: 99900, active: false, batch_id: MATHS },
  { name: "No Batch Kid", monthly_fee: 80000 },
];

const routes: { path: string; heading: string | null }[] = [
  { path: "home/", heading: null },
  { path: "students/", heading: "students.title" },
  { path: "students/new/", heading: "students.form.addTitle" },
  { path: `students/edit/?id=${STUDENT}`, heading: null },
  { path: "batches/", heading: "batches.title" },
  { path: `batches/edit/?id=${MATHS}`, heading: null },
  { path: "attendance/", heading: "attendance.title" },
];

test.describe("51: the new screens in each language, at 360px and with larger text", () => {
  for (const lang of langs) {
    for (const route of routes) {
      test(`/${lang}/${route.path}`, async ({ page }) => {
        await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
        await stubRoster(page, { students: STUDENTS, batches: BATCHES });
        await seedSession(page);
        await page.goto(`/${lang}/${route.path}`);
        await expect(page.locator("h1").first()).toBeVisible();
        if (route.heading) await expect(page.locator("h1").first()).toHaveText(messageText(lang, route.heading));
        if (route.path.startsWith("students/edit")) await expect(page.locator("main")).toContainText(LONG);
        if (route.path.startsWith("students/") && !route.path.includes("new") && !route.path.includes("edit")) await expect(page.locator("main")).toContainText(LONG);
        await page.evaluate(() => document.fonts.ready);
        // The nav sticks to the bottom of the screen and so floats over whatever is scrolled under it; the overlap
        // check would report that on a long page. Put it back in the flow for the check (it is last in the page).
        await page.addStyleTag({ content: "div.sticky { position: static !important; }" });
        for (const size of ["100%", "130%"]) {
          await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
          expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
          expect(await textProblems(page, "body"), `text problems at ${size}`).toEqual([]);
          for (const el of await page.locator("a:visible, button:visible").all()) {
            expect((await box(el)).height, `a link or button at ${size}`).toBeGreaterThanOrEqual(44);
          }
        }
      });
    }
  }
});

test.describe("51: the Move students sheet", () => {
  for (const lang of langs) {
    test(`/${lang}/batches/edit/ with the sheet open, at 100% and 130%`, async ({ page }) => {
      await stubSupabase(page, { tutor: completeTutor({ language: lang }) });
      await stubRoster(page, { students: STUDENTS, batches: BATCHES });
      await seedSession(page);
      await page.goto(`/${lang}/batches/edit/?id=${SCIENCE}`);
      await page.getByRole("button", { name: messageText(lang, "batches.move.link") }).click();
      const sheet = page.getByRole("dialog");
      await expect(sheet.getByRole("checkbox").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      for (const size of ["100%", "130%"]) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        expect(await textProblems(page, "dialog"), `text problems at ${size}`).toEqual([]);
        for (const el of await sheet.locator("button:visible, label").all()) {
          expect((await box(el)).height, `a control at ${size}`).toBeGreaterThanOrEqual(44);
        }
      }
    });
  }
});
