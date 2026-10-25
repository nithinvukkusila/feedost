// Spec UX-review-fixes-2, PR1 (items 1, 2, 3, 4, 10): Due today and Overdue on the India day, part payments with two
// tags and counted in Collected, the summary bar following the filter and the month, and the status chips on
// Students. At 360px against the fake host. The clock is fixed at 2026-10-12 05:00 UTC (10:30 in India) unless a
// test says otherwise.
import { expect, test, type Page } from "@playwright/test";
import { USER_ID } from "./auth-helpers";
import { MATHS, NOW, S, STUDENTS, signedIn } from "./board-fixture";
import { box, messageText, rgb, sidewaysScroll, textProblems } from "./helpers";
import { stubPayments, type PaymentRow, type Payments } from "./pay-helpers";
import type { Dues } from "./dues-helpers";

const rows = (page: Page) => page.locator('main li > a[href*="/students/edit/"]').filter({ visible: true });
const row = (page: Page, name: string) => page.locator("main li").filter({ hasText: name });
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const labels = (page: Page) => page.locator("[data-label]");
const sheet = (page: Page) => page.getByRole("dialog", { name: "Mark paid" });
const banner = (page: Page) => page.locator("[data-kind='undo']");

/** A payment row put straight into the fake table, leaving the fees as the fixture has them. */
function paymentRow(n: number, due_id: string, amount: number, paid_on: string): PaymentRow {
  return {
    id: `00000000-0000-4000-8000-${String(950 + n).padStart(12, "0")}`,
    tutor_id: USER_ID,
    due_id,
    amount,
    method: "cash",
    paid_on,
    receipt_no: n,
    receipt_token: "t".repeat(24),
    request_id: `q${n}`,
    balance_after: 0,
    created_at: NOW.toISOString(),
    voided_at: null,
  };
}
const feeOf = (dues: Dues, student: string, day: string) => dues.dues.find((d) => d.student_id === student && d.due_date === day)!.id;

async function pay(page: Page, name: string, rupees: string) {
  await row(page, name).getByRole("button", { name: /^Mark paid/ }).click();
  await expect(sheet(page)).toBeVisible();
  await sheet(page).getByLabel(/Amount received/).fill(rupees);
  await sheet(page).getByRole("button", { name: "Mark as paid" }).click();
  await expect(banner(page)).toContainText(`${name} marked paid`);
}

test.describe("item 1: Due today, then Overdue the next morning (1.5)", () => {
  test("a fee due on 25 Oct says Due today on 25 Oct in India and Overdue 1 day on the 26th", async ({ page }) => {
    await signedIn(page, { dues: [{ student_id: S.asha, due_date: "2026-10-25", amount: 150000 }], clock: new Date("2026-10-25T05:00:00Z") });
    await page.goto("/en/home/");
    await expect(tab(page, "Due")).toHaveAttribute("aria-selected", "true");
    await expect(row(page, "Asha Rao").locator("[data-status]")).toHaveText(["Due today"]);
    await page.clock.setFixedTime(new Date("2026-10-26T03:00:00Z"));
    await page.reload();
    await expect(tab(page, "Overdue")).toHaveAttribute("aria-selected", "true");
    await expect(row(page, "Asha Rao").locator("[data-status]")).toHaveText(["Overdue 1 day"]);
  });
});

test.describe("item 3: a part payment on an earlier balance (3.2, 3.4, 3.5)", () => {
  async function earlier(page: Page): Promise<{ dues: Dues; payments: Payments }> {
    const { dues } = await signedIn(page, {
      students: [STUDENTS[0], STUDENTS[3]],
      dues: [
        { student_id: S.ravi, kind: "opening", month: null, amount: 50000, due_date: "2026-10-12" },
        { student_id: S.dev, due_date: "2026-10-01", amount: 100000, amount_paid: 100000, status: "paid" },
      ],
    });
    return { dues, payments: await stubPayments(page, dues) };
  }

  test("₹250 of ₹500: stays Overdue with Part paid ₹250 and ₹250 owed, Collected rises, Paid unchanged; the rest moves it out", async ({ page }) => {
    await earlier(page);
    await page.goto("/en/home/");
    await expect(row(page, "Ravi Kumar")).toContainText("Earlier balance · Added 12 Oct 2026");
    await expect(labels(page)).toHaveText(["Collected ₹0", "Due ₹0", "Overdue ₹500"]);
    await expect(tab(page, "Paid")).toContainText("1");

    await pay(page, "Ravi Kumar", "250");
    await expect(row(page, "Ravi Kumar").locator("[data-status]")).toHaveText(["Overdue", "Part paid ₹250"]);
    await expect(row(page, "Ravi Kumar").locator("a").first()).toContainText(/₹250$/);
    await expect(labels(page)).toHaveText(["Collected ₹250", "Due ₹0", "Overdue ₹250"]);
    await expect(tab(page, "Paid")).toContainText("1");
    // The part-paid tag is a dashed outline; its amount is DM Mono.
    const part = row(page, "Ravi Kumar").locator("[data-status='part-paid']");
    expect(await part.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe("dashed");
    expect(await part.locator(".type-amount-row").evaluate((el) => getComputedStyle(el).fontFamily.split(",")[0])).toBe('"DM Mono"');

    await pay(page, "Ravi Kumar", "250");
    await expect(row(page, "Ravi Kumar")).toHaveCount(0);
    await expect(page.locator("[data-label='collected']")).toHaveText("Collected ₹500");
    // It does not drop when the board reads again.
    await page.reload();
    await expect(page.locator("[data-label='collected']")).toHaveText("Collected ₹500");
  });

  test("Undo within 24 hours: Collected falls back and the row returns to one Overdue tag", async ({ page }) => {
    await earlier(page);
    await page.goto("/en/home/");
    await pay(page, "Ravi Kumar", "250");
    await expect(labels(page).first()).toHaveText("Collected ₹250");
    await banner(page).getByRole("button", { name: "Undo" }).click();
    await expect(banner(page)).toHaveText("Payment undone");
    await expect(labels(page)).toHaveText(["Collected ₹0", "Due ₹0", "Overdue ₹500"]);
    await expect(row(page, "Ravi Kumar").locator("[data-status]")).toHaveText(["Overdue"]);
  });
});

test.describe("item 4: the summary bar follows the Show filter and the month (4.5)", () => {
  test("Maths, then All in September: each label recomputed; nothing drawn for a month with no rows", async ({ page }) => {
    const { dues } = await signedIn(page);
    const payments = await stubPayments(page, dues);
    payments.payments.push(
      paymentRow(1, feeOf(dues, S.dev, "2026-10-01"), 100000, "2026-10-01"),
      paymentRow(2, feeOf(dues, S.imran, "2026-10-07"), 50000, "2026-10-08"),
      // Recorded today but dated 30 September: September's Collected, not October's.
      paymentRow(3, feeOf(dues, S.asha, "2026-09-12"), 150000, "2026-09-30"),
    );
    await page.goto("/en/home/");
    await expect(labels(page)).toHaveText(["Collected ₹1,500", "Due ₹2,500", "Overdue ₹5,300"]);
    await page.getByRole("combobox", { name: "Show" }).selectOption(MATHS);
    await expect(page.getByText("1 of 2 students still owe")).toBeVisible();
    await expect(labels(page)).toHaveText(["Collected ₹1,000", "Due ₹0", "Overdue ₹2,400"]);
    await page.getByRole("combobox", { name: "Show" }).selectOption("all");
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(labels(page)).toHaveText(["Collected ₹1,500", "Due ₹0", "Overdue ₹1,200"]);
  });

  test("a month with no fees draws no bar", async ({ page }) => {
    const { dues } = await signedIn(page, { dues: [{ student_id: S.dev, month: "2026-08-01", due_date: "2026-08-01" }, { student_id: S.ravi, due_date: "2026-10-05" }] });
    await stubPayments(page, dues);
    await page.goto("/en/home/");
    await expect(labels(page)).toHaveCount(3);
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(page.getByText("No fees were due in September 2026.")).toBeVisible();
    await expect(labels(page)).toHaveCount(0);
  });
});

test.describe("item 3 and 4 at the largest text, in Hindi, at 360px", () => {
  test("an 80-character name with two tags, the round buttons and the bar's labels wrap; nothing cut, no sideways scroll", async ({ page }) => {
    const LONG = "क".repeat(80);
    const { dues } = await signedIn(page, {
      lang: "hi",
      students: [{ ...STUDENTS[0], name: LONG }],
      dues: [{ student_id: S.ravi, due_date: "2026-10-05", amount: 120000, amount_paid: 25000, status: "partial" }],
    });
    await stubPayments(page, dues);
    await page.goto("/hi/home/");
    await expect(page.locator("h1").first()).toHaveText(messageText("hi", "board.hero.label"));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
    expect(await sidewaysScroll(page)).toBe(0);
    await expect(rows(page).first().locator("[data-status]")).toHaveCount(2);
    expect(await textProblems(page, "main")).toEqual([]);
    for (const label of await labels(page).all()) expect((await box(label)).x + (await box(label)).width).toBeLessThanOrEqual(360.5);
  });
});

test.describe("item 10: status chips on Students (10.1 to 10.3)", () => {
  const KIRAN = "00000000-0000-4000-8000-0000000000c9";

  test("one chip per active student, a word plus a mark; Next fee when there is no fee yet; none for archived; no ensure_my_dues", async ({ page }) => {
    const { dues } = await signedIn(page, { students: [...STUDENTS, { id: KIRAN, name: "Kiran Das", monthly_fee: 80000, due_day: 25 }] });
    await page.goto("/en/students/");
    const chip = (name: string) => row(page, name).locator("[data-status]");
    await expect(chip("Ravi Kumar")).toHaveText("Overdue ₹2,400");
    await expect(chip("Ravi Kumar")).toHaveAttribute("data-status", "overdue");
    await expect(chip("Asha Rao")).toHaveText("Due today");
    await expect(chip("Meena Shetty")).toHaveText("Overdue ₹2,400");
    await expect(chip("Dev Patil")).toHaveText("Paid");
    await expect(chip("Dev Patil")).toHaveAttribute("data-status", "paid");
    await expect(chip("Imran Ali")).toHaveText("Overdue ₹500");
    await expect(chip("Kiran Das")).toHaveCount(0);
    await expect(row(page, "Kiran Das")).toContainText("Next fee 25 Oct 2026");
    await expect(row(page, "Ravi Kumar")).not.toContainText("Next fee");
    expect(dues.ensures()).toEqual([]);
  });

  test("if the fees cannot be read, rows show without chips", async ({ page }) => {
    const { dues } = await signedIn(page);
    dues.readStatus = 500;
    await page.goto("/en/students/");
    await expect(row(page, "Ravi Kumar")).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator("main [data-status]")).toHaveCount(0);
  });

  test("Home then Students reuses the board's cached fees: no second read", async ({ page }) => {
    const { dues } = await signedIn(page);
    await stubPayments(page, dues);
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    const before = dues.reads().length;
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Students", exact: true }).click();
    await expect(row(page, "Asha Rao").locator("[data-status]")).toHaveText("Due today");
    expect(dues.reads().length).toBe(before);
  });
});

// ---- Test-engineer additions (stage 4): gaps in the PR1 criteria and the spec's edge cases (section 6). ----

test.describe("money in exact paise and Indian grouping (3.3, 3.4)", () => {
  test("₹1,23,456 of a ₹2,00,000 earlier balance: 12345600 paise sent, and every figure grouped the Indian way", async ({ page }) => {
    const { dues } = await signedIn(page, {
      students: [STUDENTS[0]],
      dues: [{ student_id: S.ravi, kind: "opening", month: null, amount: 20000000, due_date: "2026-10-12" }],
    });
    const payments = await stubPayments(page, dues);
    await page.goto("/en/home/");
    await expect(labels(page)).toHaveText(["Collected ₹0", "Due ₹0", "Overdue ₹2,00,000"]);
    await pay(page, "Ravi Kumar", "123456");
    expect(payments.calls("record_payment").map((c) => c.p_amount)).toEqual([12345600]);
    expect(payments.payments.map((p) => p.amount)).toEqual([12345600]);
    expect(dues.dues[0]).toMatchObject({ amount_paid: 12345600, status: "partial" });
    await expect(row(page, "Ravi Kumar").locator("[data-status]")).toHaveText(["Overdue", "Part paid ₹1,23,456"]);
    await expect(row(page, "Ravi Kumar").locator("a").first()).toContainText(/₹76,544$/);
    await expect(labels(page)).toHaveText(["Collected ₹1,23,456", "Due ₹0", "Overdue ₹76,544"]);
    await expect(page.getByText("₹76,544", { exact: true }).first()).toBeVisible();
  });

  test("the two ₹250 payments of 3.4 are 25000 paise each, and the fee ends at 50000 paid", async ({ page }) => {
    // Dev's paid October fee keeps the month on the board once the earlier balance leaves it (as in 3.4 above).
    const { dues } = await signedIn(page, {
      students: [STUDENTS[0], STUDENTS[3]],
      dues: [
        { student_id: S.ravi, kind: "opening", month: null, amount: 50000, due_date: "2026-10-12" },
        { student_id: S.dev, due_date: "2026-10-01", amount: 100000, amount_paid: 100000, status: "paid" },
      ],
    });
    const payments = await stubPayments(page, dues);
    await page.goto("/en/home/");
    await pay(page, "Ravi Kumar", "250");
    await expect(labels(page).first()).toHaveText("Collected ₹250");
    await pay(page, "Ravi Kumar", "250");
    await expect(labels(page).first()).toHaveText("Collected ₹500");
    expect(payments.calls("record_payment").map((c) => c.p_amount)).toEqual([25000, 25000]);
    expect(dues.dues[0]).toMatchObject({ amount: 50000, amount_paid: 50000, status: "paid" });
  });
});

test.describe("the lateness tag beside Part paid keeps its own mark (3.2)", () => {
  test("Overdue is a solid red outline, Due today a highlight fill, Part paid a dashed blue outline", async ({ page }) => {
    const { dues } = await signedIn(page, {
      students: [STUDENTS[0], STUDENTS[1]],
      dues: [
        { student_id: S.ravi, due_date: "2026-10-09", amount: 50000, amount_paid: 25000, status: "partial" },
        { student_id: S.asha, due_date: "2026-10-12", amount: 50000, amount_paid: 25000, status: "partial" },
      ],
    });
    await stubPayments(page, dues);
    await page.goto("/en/home/");
    const late = row(page, "Ravi Kumar").locator("[data-status]");
    await expect(late).toHaveText(["Overdue 3 days", "Part paid ₹250"]);
    const style = (el: Element) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopStyle, borderWidth: s.borderTopWidth, borderColour: s.borderTopColor, background: s.backgroundColor };
    };
    expect(await late.nth(0).evaluate(style)).toMatchObject({ border: "solid", borderColour: rgb("cloth") });
    expect(await late.nth(1).evaluate(style)).toMatchObject({ border: "dashed", borderColour: rgb("blue") });
    await tab(page, "Due").click();
    const today = row(page, "Asha Rao").locator("[data-status]");
    await expect(today).toHaveText(["Due today", "Part paid ₹250"]);
    // A fill, no outline (the border style may read "solid" from the reset, at zero width).
    expect(await today.nth(0).evaluate(style)).toMatchObject({ borderWidth: "0px", background: rgb("highlight") });
    await expect(row(page, "Asha Rao").locator("a").first()).toContainText(/₹250$/);
    // No blue caption line repeats "Part paid".
    expect((await row(page, "Asha Rao").textContent())?.match(/Part paid/g)).toHaveLength(1);
  });

  test("at the largest text in English the two tags wrap onto two lines, nothing cut", async ({ page }) => {
    const { dues } = await signedIn(page, {
      students: [STUDENTS[0]],
      dues: [{ student_id: S.ravi, month: "2026-09-01", due_date: "2026-09-05", amount: 20000000, amount_paid: 12345600, status: "partial" }],
    });
    await stubPayments(page, dues);
    await page.goto("/en/home/");
    const tags = row(page, "Ravi Kumar").locator("[data-status]");
    await expect(tags).toHaveText(["Overdue 37 days", "Part paid ₹1,23,456"]);
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
    const [a, b] = [await box(tags.nth(0)), await box(tags.nth(1))];
    expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
    for (const t of [a, b]) expect(t.x + t.width).toBeLessThanOrEqual(360.5);
    expect(await sidewaysScroll(page)).toBe(0);
    expect(await textProblems(page, "main")).toEqual([]);
  });
});

test.describe("the hero line and the summary bar in all four languages at the largest text (2.2, 4.4)", () => {
  for (const lang of ["en", "hi", "kn", "te"] as const) {
    test(`${lang}: the labels wrap inside 360px, amounts in DM Mono with 0-9 digits, the bar hidden from screen readers`, async ({ page }) => {
      const { dues } = await signedIn(page, { lang });
      const payments = await stubPayments(page, dues);
      payments.payments.push(paymentRow(1, feeOf(dues, S.dev, "2026-10-01"), 100000, "2026-10-01"));
      await page.goto(`/${lang}/home/`);
      await expect(page.locator("h1").first()).toHaveText(messageText(lang, "board.hero.label"));
      await expect(labels(page)).toHaveCount(3);
      await expect(labels(page).first()).toContainText("₹1,000");
      await expect(labels(page).nth(1)).toContainText("₹2,500");
      await expect(labels(page).nth(2)).toContainText("₹5,300");
      // The hero line: the counts 4 and 5 in 0-9 digits, never the TODO marker.
      const line = page.locator("main section p.type-body").first();
      await expect(line).toContainText(/4\D+5/);
      await expect(page.locator("main")).not.toContainText("TODO-translate");
      await expect(page.locator("[data-summary-bar]")).toHaveAttribute("aria-hidden", "true");
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
      expect(await sidewaysScroll(page)).toBe(0);
      for (const label of await labels(page).all()) {
        const b = await box(label);
        expect(b.x).toBeGreaterThanOrEqual(-0.5);
        expect(b.x + b.width).toBeLessThanOrEqual(360.5);
      }
      const families = await page.locator("[data-label] .type-amount-row").evaluateAll((spans) => spans.map((s) => getComputedStyle(s).fontFamily));
      expect(families).toHaveLength(3);
      // DM Mono first in every language (Anek appears only as a late fallback in the stack).
      for (const family of families) expect(family.split(",")[0]).toBe('"DM Mono"');
      for (const text of await page.locator("[data-label] .type-amount-row").allTextContents()) expect(text).toMatch(/^₹[0-9,]+$/);
      expect(await textProblems(page, "main")).toEqual([]);
    });
  }

  test("one student in the filter reads in the singular", async ({ page }) => {
    const { dues } = await signedIn(page, { students: [STUDENTS[0]], dues: [{ student_id: S.ravi, due_date: "2026-10-05", amount: 120000 }] });
    await stubPayments(page, dues);
    await page.goto("/en/home/");
    await expect(page.getByText("1 of 1 student still owes", { exact: true })).toBeVisible();
  });
});

test.describe("Collected when its read fails or the phone is offline (section 6)", () => {
  test("a failed read of the month's payments never blocks the board: Collected shows a dash and no part", async ({ page }) => {
    const { dues } = await signedIn(page);
    const payments = await stubPayments(page, dues);
    payments.failMonthRead = true;
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    await expect(labels(page)).toHaveText(["Collected —", "Due ₹2,500", "Overdue ₹5,300"]);
    await expect(page.locator("[data-part='collected']")).toHaveCount(0);
    await expect(page.locator("[data-part]")).toHaveCount(2);
  });

  test("offline, a month already read keeps its cached Collected; back online the next payment still counts", async ({ page, context }) => {
    const { dues } = await signedIn(page);
    const payments = await stubPayments(page, dues);
    payments.payments.push(
      paymentRow(1, feeOf(dues, S.dev, "2026-10-01"), 100000, "2026-10-01"),
      paymentRow(3, feeOf(dues, S.asha, "2026-09-12"), 150000, "2026-09-30"),
    );
    await page.goto("/en/home/");
    await expect(labels(page).first()).toHaveText("Collected ₹1,000");
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(labels(page).first()).toHaveText("Collected ₹1,500");
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(labels(page).first()).toHaveText("Collected ₹1,000");
    await context.setOffline(true);
    await page.getByRole("button", { name: "Previous month" }).click();
    await expect(labels(page).first()).toHaveText("Collected ₹1,500");
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(labels(page).first()).toHaveText("Collected ₹1,000");
    await context.setOffline(false);
    await pay(page, "Imran Ali", "500");
    await expect(labels(page).first()).toHaveText("Collected ₹1,500");
    expect(payments.calls("record_payment").map((c) => c.p_amount)).toEqual([50000]);
  });
});

test.describe("a phone set to London shows the India day's tags (section 6, clock and zone)", () => {
  test.use({ timezoneId: "Europe/London" });

  test("at 01:30 on 25 Oct in India (24 Oct in London) the fee is Due today; at 01:30 on the 26th it is Overdue 1 day", async ({ page }) => {
    const { dues } = await signedIn(page, { dues: [{ student_id: S.asha, due_date: "2026-10-25", amount: 150000 }], clock: new Date("2026-10-24T20:00:00Z") });
    await stubPayments(page, dues);
    await page.goto("/en/home/");
    await expect(row(page, "Asha Rao").locator("[data-status]")).toHaveText(["Due today"]);
    await page.clock.setFixedTime(new Date("2026-10-25T20:00:00Z"));
    await page.reload();
    await expect(tab(page, "Overdue")).toHaveAttribute("aria-selected", "true");
    await expect(row(page, "Asha Rao").locator("[data-status]")).toHaveText(["Overdue 1 day"]);
  });
});

test.describe("Students chips: archived and the late arrival of the fees (10.2, 10.3)", () => {
  test("an archived student shows no chip and no Next fee line", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/students/");
    await expect(row(page, "Ravi Kumar").locator("[data-status]")).toHaveText("Overdue ₹2,400");
    await page.getByRole("button", { name: /^Archived students/ }).click();
    const old = row(page, "Old Student");
    await expect(old).toBeVisible();
    await expect(old.locator("[data-status]")).toHaveCount(0);
    await expect(old).not.toContainText("Next fee");
    await expect(old).not.toContainText("Overdue");
  });

  test("rows show at once; when the fees arrive each row grows by no more than its chip's line", async ({ page }) => {
    const { dues } = await signedIn(page);
    dues.listDelayMs = 1500;
    await page.goto("/en/students/");
    const ravi = row(page, "Ravi Kumar");
    await expect(ravi).toBeVisible();
    await expect(ravi.locator("[data-status]")).toHaveCount(0);
    const name = ravi.getByText("Ravi Kumar", { exact: true });
    const [rowBefore, nameBefore] = [await box(ravi), await box(name)];
    await expect(ravi.locator("[data-status]")).toHaveText("Overdue ₹2,400");
    const [rowAfter, nameAfter, chip] = [await box(ravi), await box(name), await box(ravi.locator("[data-status]"))];
    expect(rowAfter.height - rowBefore.height).toBeLessThanOrEqual(chip.height + 4);
    expect(Math.abs(nameAfter.x - nameBefore.x)).toBeLessThanOrEqual(0.5);
  });
});
