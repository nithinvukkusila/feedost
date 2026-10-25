// Spec R1-6, criteria 34 and 35: the board in en, hi, kn and te at 360px and with larger text, with 60
// students, an 80-character name with no spaces, Hindi, Kannada and Telugu names, a 60-character batch
// name, a part paid row, an earlier balance, ₹10,00,000 on a row and ₹1,00,00,000 in total: no sideways
// scroll, nothing cut or tiny, every button, link and tab at least 44px. The 80-character name is part paid and
// late, so its row has two tags (UX-review-fixes-2, 3.2), and the summary bar's labels wrap (4.4). The strip and its
// "no block under 8px" check are gone: R1-6 criteria 14 and 34 were amended by UX-review-fixes-2 item 4. And with
// the colour taken away, every row still says its word and has its mark.
import { expect, test } from "@playwright/test";
import { MATHS, signedIn } from "./board-fixture";
import { box, langs, messageText, sidewaysScroll, textProblems } from "./helpers";
import type { DueRow } from "./dues-helpers";
import type { StudentRow } from "./roster-helpers";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const LONG = "A".repeat(80);
const LONG_BATCH = "Class 10 Maths and Science combined evening batch, Mon to Fri";
const NAMES = [LONG, "रवि कुमार शर्मा", "ಲಕ್ಷ್ಮಿ ನರಸಿಂಹನ್", "సుబ్రమణ్యం గారి అబ్బాయి"];

const students: Partial<StudentRow>[] = Array.from({ length: 60 }, (_, i) => ({
  id: id(0x100 + i),
  name: i < NAMES.length ? NAMES[i] : `Student ${String(i).padStart(2, "0")}`,
  batch_id: i % 2 === 0 ? MATHS : null,
  monthly_fee: 120000,
  due_day: 5,
}));

// Eight students owe ₹10,00,000 each (the last a little less; the first has part paid ₹500 and is late), two owe an
// earlier balance of ₹10,00,000, and one has part paid and is not late. The total is exactly ₹1,00,00,000. The other
// students have paid.
const paid = (i: number) => ({ student_id: students[i].id as string, amount: 120000, amount_paid: 120000, status: "paid" as const, due_date: "2026-10-01" });
const dues: (Partial<DueRow> & { student_id: string })[] = students.map((s, i) => {
  const student_id = s.id as string;
  if (i === 0) return { student_id, amount: 100050000, amount_paid: 50000, status: "partial" as const, due_date: "2026-10-05" };
  if (i < 7) return { student_id, amount: 100000000, due_date: "2026-10-05" };
  if (i === 7) return { student_id, amount: 99930000, due_date: "2026-10-05" };
  if (i === 10) return { student_id, amount: 120000, amount_paid: 50000, status: "partial" as const, due_date: "2026-10-25" };
  return paid(i);
});
dues.push({ student_id: students[8].id as string, kind: "opening", month: null, amount: 100000000, due_date: "2026-09-30" });
dues.push({ student_id: students[9].id as string, kind: "opening", month: null, amount: 100000000, due_date: "2026-09-30" });

const batches = [{ id: MATHS, name: LONG_BATCH }];

test.describe("34: 60 students in each language, at 360px and with larger text", () => {
  for (const lang of langs) {
    test(`/${lang}/home/`, async ({ page }) => {
      test.setTimeout(90_000);
      await signedIn(page, { students, batches, dues, lang });
      await page.goto(`/${lang}/home/`);
      await expect(page.locator("h1").first()).toHaveText(messageText(lang, "board.hero.label"));
      await expect(page.locator("main")).toContainText(LONG);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: "[data-sticky-nav] { position: static !important; }" });

      // No strip; the summary bar's three labels are there, inside the screen.
      await expect(page.locator("[data-kind]")).toHaveCount(0);
      await expect(page.locator("[data-label]")).toHaveCount(3);
      for (const label of await page.locator("[data-label]").all()) expect((await box(label)).x + (await box(label)).width).toBeLessThanOrEqual(360.5);
      // The long name's row has its two tags, side by side or wrapped, never cut.
      const longRow = page.locator('main li > a[href*="/students/edit/"]').filter({ hasText: LONG });
      await expect(longRow.locator("[data-status]")).toHaveCount(2);
      await expect(longRow.locator("[data-status='part-paid']")).toContainText("₹500");

      for (const size of ["100%", "130%"]) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        expect(await textProblems(page, "body"), `text problems at ${size}`).toEqual([]);
        for (const el of await page.locator("a:visible, button:visible, select:visible").all()) {
          expect((await box(el)).height, `a link, button or select at ${size}`).toBeGreaterThanOrEqual(44);
        }
        for (const row of await page.locator('main li > a[href*="/students/edit/"]').filter({ visible: true }).all()) {
          expect((await box(row)).height, `a row at ${size}`).toBeGreaterThanOrEqual(66);
        }
      }

      // The amounts are 0 to 9 digits with Indian grouping, in every language.
      const amount = page.locator("main section p.type-amount").first();
      await expect(amount).toHaveText(/^₹[0-9,]+$/);
      const main = (await page.locator("main").textContent()) ?? "";
      expect(main).toContain("₹1,00,00,000");
      expect(main).toContain("₹10,00,000");
      expect(main).not.toMatch(/[०-९౦-౯೦-೯]/);

      // The largest text: the headline amount still fits its box.
      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
      expect(await sidewaysScroll(page), "sideways scroll at 200%").toBe(0);
      for (const el of await page.locator("a:visible, button:visible, select:visible").all()) {
        expect((await box(el)).height, "a link, button or select at 200%").toBeGreaterThanOrEqual(44);
      }
      for (const row of await page.locator('main li > a[href*="/students/edit/"]').filter({ visible: true }).all()) {
        expect((await box(row)).height, "a row at 200%").toBeGreaterThanOrEqual(66);
      }
      const fits = await amount.evaluate((el) => el.scrollWidth <= (el.parentElement as HTMLElement).clientWidth + 1);
      expect(fits, "the headline amount fits at 200%").toBe(true);
    });
  }
});

test.describe("35: status is never colour alone", () => {
  test("with the colour taken away each row still has its word and its mark", async ({ page }) => {
    await signedIn(page, { students, batches, dues, lang: "en" });
    await page.goto("/en/home/");
    await expect(page.locator("h1").first()).toBeVisible();
    await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
    const marks = async () =>
      page.locator("[data-status]").evaluateAll((tags) =>
        tags.map((tag) => {
          const style = getComputedStyle(tag);
          return { status: tag.getAttribute("data-status"), text: (tag.textContent ?? "").trim(), border: style.borderTopStyle, width: style.borderTopWidth, fill: style.backgroundColor };
        }),
      );

    const all = await marks();
    // The one late part-paid row has a second tag, Part paid, with its dashed mark.
    const extra = all.filter((tag) => tag.status === "part-paid");
    expect(extra.map((tag) => [tag.text, tag.border])).toEqual([["Part paid ₹500", "dashed"]]);
    const overdue = all.filter((tag) => tag.status !== "part-paid");
    expect(overdue.length).toBeGreaterThan(5);
    for (const tag of overdue) {
      expect(tag.status).toBe("overdue");
      expect(tag.text).toMatch(/^Overdue/);
      expect([tag.border, tag.width]).toEqual(["solid", "2px"]);
    }

    await page.getByRole("tab", { name: /^Due/ }).click();
    const due = await marks();
    expect(due.map((t) => t.status)).toEqual(["due", "part-paid"]);
    expect(due[0].text).toBe("Due");
    expect(due[1].text).toBe("Part paid ₹500");
    expect(due[1].border).toBe("dashed");

    await page.getByRole("tab", { name: /^Paid/ }).click();
    const paidTags = await marks();
    expect(paidTags.length).toBe(51);
    for (const tag of paidTags) {
      expect(tag.text).toBe("Paid");
      expect(tag.border).toBe("double");
    }
  });

  test("a Due row has a fill and no outline, so it differs from the others without colour", async ({ page }) => {
    await signedIn(page, { students: students.slice(0, 3), batches, dues: [{ student_id: students[0].id as string, due_date: "2026-10-20" }, { student_id: students[1].id as string, due_date: "2026-10-12" }] });
    await page.goto("/en/home/");
    await expect(page.getByRole("tab", { name: /^Due/ })).toHaveAttribute("aria-selected", "true");
    const tag = page.locator("[data-status='due']").first();
    const style = await tag.evaluate((el) => ({ border: getComputedStyle(el).borderTopWidth, fill: getComputedStyle(el).backgroundColor, text: el.textContent }));
    expect(style.border).toBe("0px");
    expect(style.fill).not.toBe("rgba(0, 0, 0, 0)");
    expect(["Due", "Due today"]).toContain(style.text);
  });
});
