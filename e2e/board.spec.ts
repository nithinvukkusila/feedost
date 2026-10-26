// Spec R1-6, criteria 10 to 32: the dues board in the browser, at 360px, against the fake host. The build
// under test is made with the CI's made-up Supabase address (auth-helpers.ts). The clock is fixed at
// 2026-10-12 05:00 UTC (10:30 in India) unless a test says otherwise.
import { expect, test, type Page } from "@playwright/test";
import { USER_ID, watchOtherHosts } from "./auth-helpers";
import { BATCHES, DUES, MATHS, NOW, S, STUDENTS, signedIn } from "./board-fixture";
import { box } from "./helpers";
import { stubPayments, type PaymentRow } from "./pay-helpers";

const ORIGIN = process.env.E2E_BASE_URL ?? "http://localhost:4173";
const rows = (page: Page) => page.locator('main li > a[href*="/students/edit/"]').filter({ visible: true });
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const month = (page: Page) => page.getByRole("button", { name: "Previous month" }).locator("xpath=following-sibling::p[1]");
const prev = (page: Page) => page.getByRole("button", { name: "Previous month" });
const next = (page: Page) => page.getByRole("button", { name: "Next month" });
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });

/** Out to the Students screen and back, so the board opens again. Each step is waited for: a second tap in the middle of the first is not a visit. */
async function bounce(page: Page) {
  await nav(page).getByRole("link", { name: "Students", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/students\/$/);
  await expect(page.locator("h1")).toHaveText("Students");
  await nav(page).getByRole("link", { name: "Home", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/home\/$/);
}

test.describe("10: no active students", () => {
  for (const [name, students] of [
    ["none", []],
    ["all archived", [{ name: "Old", active: false }]],
  ] as const) {
    test(`${name}: the empty home, no month switcher, no dues request`, async ({ page }) => {
      const { dues } = await signedIn(page, { students: [...students], dues: [] });
      await page.goto("/en/home/");
      await expect(page.locator("h1")).toHaveText("Your book is empty.");
      await expect(page.getByRole("button", { name: "Previous month" })).toHaveCount(0);
      await page.waitForTimeout(500);
      expect(dues.requests).toEqual([]);
    });
  }
});

test.describe("11, 13, 14, 16, 17, 24: the board", () => {
  test("top to bottom, with the amount, the summary bar, the tabs and a row for each fee", async ({ page }) => {
    const { dues } = await signedIn(page);
    // The month's payments, as the table holds them (UX-review-fixes-2, 3.3): Dev's ₹1,000 and Imran's ₹500 in
    // October, and one dated 30 September that October does not count.
    const payments = await stubPayments(page, dues);
    const fee = (student: string, day: string) => dues.dues.find((d) => d.student_id === student && d.due_date === day)!.id;
    const row = (n: number, due_id: string, amount: number, paid_on: string): PaymentRow => ({
      id: `00000000-0000-4000-8000-${String(900 + n).padStart(12, "0")}`,
      tutor_id: USER_ID,
      due_id,
      amount,
      method: "cash",
      paid_on,
      receipt_no: n,
      receipt_token: "t".repeat(24),
      request_id: `r${n}`,
      balance_after: 0,
      created_at: NOW.toISOString(),
      voided_at: null,
    });
    payments.payments.push(row(1, fee(S.dev, "2026-10-01"), 100000, "2026-10-01"), row(2, fee(S.imran, "2026-10-07"), 50000, "2026-10-08"), row(3, fee(S.asha, "2026-09-12"), 150000, "2026-09-30"));
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Still to come in");
    await expect(month(page)).toHaveText(/october 2026/i);
    await expect(page.getByText("₹7,800", { exact: true })).toBeVisible();
    // 2.2: the five active students, whether or not they have a fee, of whom four owe.
    await expect(page.getByText("4 of 5 students still owe")).toBeVisible();
    await expect(page.getByText("from 4 of 5 students")).toHaveCount(0);

    // The order on the screen.
    const y = async (locator: ReturnType<Page["locator"]>) => (await box(locator.first())).y;
    const order = [
      await y(page.getByRole("button", { name: "Previous month" })),
      await y(page.getByText("Still to come in")),
      await y(page.getByRole("combobox", { name: "Show" })),
      await y(page.locator("[data-label='collected']")),
      await y(page.getByRole("tablist")),
      await y(rows(page)),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // 4.1, 4.2, 4.4: no strip and no legend; the bar's three labels, in order, each a word, an amount and a mark.
    await expect(page.getByText(/hollow|tall/)).toHaveCount(0);
    await expect(page.locator("[data-kind]")).toHaveCount(0);
    await expect(page.getByRole("list").filter({ has: page.locator("[data-label]") }).getByRole("listitem")).toHaveText(["Collected ₹1,500", "Due ₹2,500", "Overdue ₹5,300"]);
    const bar = page.locator("[data-summary-bar]");
    await expect(bar).toHaveAttribute("aria-hidden", "true");
    await expect(bar.locator("[data-part]")).toHaveCount(3);
    const widths = await bar.locator("[data-part]").evaluateAll((parts) => parts.map((p) => p.getBoundingClientRect().width));
    // Widths follow the paise: 1,500 : 2,500 : 5,300 (the gaps aside).
    expect(widths[2]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[0]);
    const amounts = await page.locator("[data-label] .type-amount-row").evaluateAll((spans) => spans.map((s) => getComputedStyle(s).fontFamily));
    for (const family of amounts) expect(family.split(",")[0]).toBe('"DM Mono"');

    // Tabs with their counts; Overdue is open because it has rows.
    await expect(page.getByRole("tab")).toHaveText(["Overdue 4", "Due 2", "Paid 1"]);
    await expect(tab(page, "Overdue")).toHaveAttribute("aria-selected", "true");
    // Opening balance first, then the most days late, then the next.
    await expect(rows(page)).toHaveCount(4);
    await expect(rows(page).nth(0)).toContainText("Meena Shetty");
    await expect(rows(page).nth(0)).toContainText("Overdue");
    await expect(rows(page).nth(0)).toContainText("Earlier balance · Added 30 Sep 2026");
    await expect(rows(page).nth(0)).not.toContainText("Due 30 Sep 2026");
    await expect(rows(page).nth(0)).toContainText("₹2,400");
    await expect(rows(page).nth(0)).not.toContainText("days");
    await expect(rows(page).nth(1)).toContainText("Overdue 37 days");
    await expect(rows(page).nth(1)).toContainText("September fee");
    await expect(rows(page).nth(1)).toContainText("Due 05 Sep 2026");
    await expect(rows(page).nth(1)).toContainText("Class 10 Maths");
    await expect(rows(page).nth(2)).toContainText("Overdue 7 days");
    await expect(rows(page).nth(2)).toContainText("Due 05 Oct 2026");
    await expect(rows(page).nth(2)).toContainText("₹1,200");
    await expect(rows(page).nth(3)).toContainText("Imran Ali");
    await expect(rows(page).nth(3)).toContainText("Overdue 5 days");
    await expect(rows(page).nth(3).locator("[data-status]")).toHaveText(["Overdue 5 days", "Part paid ₹500"]);
    await expect(rows(page).nth(3)).toContainText("₹500");
    // Ravi has two rows (17: one row per fee). The archived student's fee is nowhere.
    await expect(page.getByText("Old Student")).toHaveCount(0);
    await expect(page.getByText("₹900")).toHaveCount(0);

    await expect(page.getByText("That is everyone who is overdue.")).toBeVisible();
    for (const row of await rows(page).all()) {
      expect((await box(row)).height).toBeGreaterThanOrEqual(66);
      await expect(row).toHaveAttribute("href", /^\/en\/students\/edit\/\?id=00000000-0000-4000-8000-/);
      expect(await row.locator("button, a, input").count()).toBe(0);
    }
    // Remind is R1-8's; Mark paid (R1-7) is a button beside the link of each fee that has something owed, and never inside it.
    await expect(page.getByRole("button", { name: /remind/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Mark paid/ })).toHaveCount(4);

    // Home is the current item of the bottom navigation.
    await expect(nav(page).locator('[data-item="home"]')).toHaveAttribute("aria-current", "page");
    // The R1-3 filled home is gone.
    await expect(page.getByRole("link", { name: "See all students" })).toHaveCount(0);
    await expect(page.getByText("Who owes what appears here in a later update.")).toHaveCount(0);
  });

  test("a tab shows its own rows without a request, with Due today and the end line", async ({ page }) => {
    const { dues } = await signedIn(page);
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    const before = dues.requests.length;
    await tab(page, "Due").click();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(0)).toContainText("Asha Rao");
    await expect(rows(page).nth(0)).toContainText("Due today");
    await expect(rows(page).nth(1)).toContainText("Meena Shetty");
    await expect(rows(page).nth(1)).toContainText("Due 20 Oct 2026");
    await expect(page.getByText("That is everyone who is due.")).toBeVisible();
    await tab(page, "Paid").click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Dev Patil");
    await expect(rows(page).first()).toContainText("Paid");
    // A paid row shows the whole amount.
    await expect(rows(page).first()).toContainText("₹1,000");
    await expect(page.getByText("That is everyone who has paid.")).toBeVisible();
    expect(dues.requests.length).toBe(before);
  });

  test("a tab with no rows says so, for this month and for a past one", async ({ page }) => {
    await signedIn(page, {
      dues: [
        { student_id: S.dev, due_date: "2026-10-01", status: "paid", amount_paid: 100000 },
        { student_id: S.dev, month: "2026-09-01", due_date: "2026-09-01", status: "paid", amount_paid: 100000 },
      ],
    });
    await page.goto("/en/home/");
    // Nothing overdue or due in October; Paid opens by default.
    await expect(tab(page, "Paid")).toHaveAttribute("aria-selected", "true");
    await tab(page, "Overdue").click();
    await expect(page.getByText("Nobody is overdue.")).toBeVisible();
    await tab(page, "Due").click();
    await expect(page.getByText("Nothing else is due this month.")).toBeVisible();
    await prev(page).click();
    await expect(month(page)).toHaveText(/september 2026/i);
    await expect(page.getByText("Nothing else was due that month.")).toBeVisible();
    await tab(page, "Overdue").click();
    await expect(page.getByText("Nobody is overdue.")).toBeVisible();
  });

  test("a past month where nobody paid says so", async ({ page }) => {
    await signedIn(page, {
      dues: [
        { student_id: S.ravi, due_date: "2026-10-05", status: "paid", amount_paid: 120000, amount: 120000 },
        { student_id: S.ravi, month: "2026-09-01", due_date: "2026-09-05", amount: 120000 },
      ],
    });
    await page.goto("/en/home/");
    await prev(page).click();
    await expect(month(page)).toHaveText(/september 2026/i);
    await tab(page, "Paid").click();
    await expect(page.getByText("Nobody paid that month.")).toBeVisible();
  });
});

test.describe("12: the month switcher", () => {
  test("44px buttons, disabled ones still drawn and announced, and a tap moves the whole screen", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/home/");
    await expect(month(page)).toHaveText(/october 2026/i);
    for (const button of [prev(page), next(page)]) {
      const b = await box(button);
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
    }
    await expect(next(page)).toBeDisabled();
    await expect(prev(page)).toBeEnabled();
    await prev(page).click();
    await expect(month(page)).toHaveText(/september 2026/i);
    // September: Ravi's unpaid fee and Asha's paid one, and no carried rows.
    await expect(page.getByText("₹1,200", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1 of 5 students still owe")).toBeVisible();
    await expect(prev(page)).toBeDisabled();
    expect((await box(prev(page))).height).toBeGreaterThanOrEqual(44);
    await expect(next(page)).toBeEnabled();
    await expect(page.getByText("Earlier balance")).toHaveCount(0);
    await expect(page.getByText("Meena Shetty")).toHaveCount(0);
    await next(page).click();
    await expect(month(page)).toHaveText(/october 2026/i);
    await expect(page.getByText("₹7,800", { exact: true })).toBeVisible();
  });

  test("moving between months already read sends no request", async ({ page }) => {
    const { dues } = await signedIn(page);
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    await prev(page).click();
    await expect(month(page)).toHaveText(/september 2026/i);
    const before = dues.reads().length;
    await next(page).click();
    await prev(page).click();
    await next(page).click();
    await expect(month(page)).toHaveText(/october 2026/i);
    expect(dues.reads().length).toBe(before);
  });

  test("a month with nothing says so, and the next button still works", async ({ page }) => {
    await signedIn(page, { dues: [{ student_id: S.dev, month: "2026-08-01", due_date: "2026-08-01" }, { student_id: S.ravi, due_date: "2026-10-05" }] });
    await page.goto("/en/home/");
    await prev(page).click();
    await expect(month(page)).toHaveText(/september 2026/i);
    await expect(page.getByText("No fees were due in September 2026.")).toBeVisible();
    await expect(next(page)).toBeEnabled();
    await prev(page).click();
    await expect(month(page)).toHaveText(/august 2026/i);
    await expect(prev(page)).toBeDisabled();
  });
});

test.describe("18, 19: the batch select and the remembered view", () => {
  test("offers every batch with its count, filters everything together with no request, and falls back when the batch is gone", async ({ page }) => {
    const CLASS6 = "00000000-0000-4000-8000-0000000000b3";
    const { dues, roster } = await signedIn(page, {
      batches: [...BATCHES, { id: CLASS6, name: "Class 6 English" }],
      students: [...STUDENTS, { id: "00000000-0000-4000-8000-0000000000c7", name: "Zed Nobody", batch_id: CLASS6 }],
    });
    await page.goto("/en/home/");
    const select = page.getByRole("combobox", { name: "Show" });
    expect((await box(select)).height).toBeGreaterThanOrEqual(44);
    await expect(select.locator("option")).toHaveText(["All 6", "Class 10 Maths 2", "Class 6 English 1", "Class 8 Science 1", "No batch 2"]);
    const before = dues.requests.length;
    await select.selectOption(MATHS);
    // Ravi's two fees (₹1,200 + ₹1,200) and Dev's paid one.
    await expect(page.getByText("₹2,400", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1 of 2 students still owe")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveText(["Overdue 2", "Due 0", "Paid 1"]);
    await expect(rows(page)).toHaveCount(2);
    await select.selectOption("none");
    await expect(page.getByRole("tab")).toHaveText(["Overdue 2", "Due 1", "Paid 0"]);
    expect(dues.requests.length).toBe(before);

    // The batch is deleted elsewhere: after the next read of the roster the board is on All batches.
    await select.selectOption(CLASS6);
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText("Nothing in Class 6 English for October 2026.")).toBeVisible();
    roster.batches = roster.batches.filter((b) => b.id !== CLASS6);
    await bounce(page);
    await expect(page.getByText("₹7,800", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Show" })).toHaveValue("all");
  });

  test("Show all batches clears the filter", async ({ page }) => {
    const CLASS6 = "00000000-0000-4000-8000-0000000000b3";
    await signedIn(page, { batches: [...BATCHES, { id: CLASS6, name: "Class 6 English" }], students: [...STUDENTS, { id: "00000000-0000-4000-8000-0000000000c7", name: "Zed Nobody", batch_id: CLASS6 }] });
    await page.goto("/en/home/");
    await page.getByRole("combobox", { name: "Show" }).selectOption(CLASS6);
    await page.getByRole("button", { name: "Show all batches" }).click();
    await expect(page.getByText("₹7,800", { exact: true })).toBeVisible();
    await expect(rows(page)).toHaveCount(4);
  });

  test("with no batch there is no select", async ({ page }) => {
    await signedIn(page, { batches: [], students: STUDENTS.map((s) => ({ ...s, batch_id: null })) });
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    await expect(page.getByRole("combobox")).toHaveCount(0);
  });

  test("month, tab and batch are the same after opening a student and coming back, and reset after leaving the book", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/home/");
    await prev(page).click();
    await expect(month(page)).toHaveText(/september 2026/i);
    await page.getByRole("combobox", { name: "Show" }).selectOption(MATHS);
    await tab(page, "Paid").click();
    await expect(page.getByText("Nobody paid that month.")).toBeVisible();
    await tab(page, "Overdue").click();
    await rows(page).first().click();
    await expect(page).toHaveURL(/\/en\/students\/edit\/\?id=/);
    await page.goBack();
    await expect(month(page)).toHaveText(/september 2026/i);
    await expect(page.getByRole("combobox", { name: "Show" })).toHaveValue(MATHS);
    await expect(tab(page, "Overdue")).toHaveAttribute("aria-selected", "true");
    await expect(rows(page)).toHaveCount(1);
    // Leaving the book group (More) forgets it all.
    await nav(page).getByRole("link", { name: "More", exact: true }).click();
    await expect(page).toHaveURL(/\/en\/more\/$/);
    await page.goto("/en/home/");
    await expect(month(page)).toHaveText(/october 2026/i);
    await expect(page.getByRole("combobox", { name: "Show" })).toHaveValue("all");
  });

  test("a tab the tutor chose stays when the data is read again", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/home/");
    await tab(page, "Paid").click();
    await bounce(page);
    await expect(tab(page, "Paid")).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("21, 22, 23: nothing, nothing in this batch, and all paid", () => {
  test("a new tutor's board says nothing is due yet and links to the students", async ({ page }) => {
    await signedIn(page, { dues: [] });
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Nothing is due yet.");
    await expect(page.getByText("Fees appear on each student's due day.")).toBeVisible();
    await expect(page.getByRole("link", { name: "See your students" })).toHaveAttribute("href", "/en/students/");
    // No other month to go to: the month alone, no arrow buttons (UX-review-fixes-2, 5.1; was two disabled arrows).
    await expect(prev(page)).toHaveCount(0);
    await expect(next(page)).toHaveCount(0);
  });

  test("everyone paid: the stamp, the three lines and the tabs below", async ({ page }) => {
    const { dues } = await signedIn(page, { dues: [
      { student_id: S.ravi, status: "paid", amount: 120000, amount_paid: 120000 },
      { student_id: S.dev, status: "paid", amount: 100000, amount_paid: 100000 },
    ] });
    // 3.6: Collected is the month's payments, the same figure as the bar's.
    const payments = await stubPayments(page, dues);
    for (const due of dues.dues) payments.seed({ due_id: due.id, amount: due.amount, paid_on: "2026-10-05" });
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Nothing left to collect.");
    await expect(page.getByRole("img", { name: "ALL PAID" })).toContainText("OCTOBER 2026".replace("OCTOBER", "October"));
    await expect(page.locator("p.type-amount").getByText("₹2,200", { exact: true })).toBeVisible();
    await expect(page.getByText("2 of 2")).toBeVisible();
    await expect(page.locator("[data-label]")).toHaveText(["Collected ₹2,200", "Due ₹0", "Overdue ₹0"]);
    await expect(page.getByText("November fees will appear here on each student's due day. You do not need to do anything.")).toBeVisible();
    await expect(page.getByText("Still to come in")).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveText(["Overdue 0", "Due 0", "Paid 2"]);
    await expect(tab(page, "Paid")).toHaveAttribute("aria-selected", "true");
    await expect(rows(page)).toHaveCount(2);
  });
});

test.describe("25 to 28, 30: loading, failing, offline and freshness", () => {
  test("loading shows the month, the label, grey blocks and the words; then the board", async ({ page }) => {
    const { dues } = await signedIn(page);
    dues.listDelayMs = 1500;
    await page.goto("/en/home/");
    await expect(page.getByRole("status")).toHaveText("Opening your book…");
    await expect(page.getByText("Still to come in")).toBeVisible();
    await expect(page.getByText(/october 2026/i)).toBeVisible();
    await expect(page.locator("h1")).toHaveText("Still to come in", { timeout: 15_000 });
    await expect(rows(page)).toHaveCount(4);
  });

  test("a failed first read says what happened and Try again reads again, never signing out", async ({ page }) => {
    test.setTimeout(60_000);
    const { dues } = await signedIn(page);
    dues.readStatus = 500;
    await page.goto("/en/home/");
    const alert = page.locator('[role="alert"][data-kind="error"]');
    await expect(alert).toContainText("Couldn't load your fees", { timeout: 25_000 });
    await expect(alert).toContainText("The network dropped. Nothing is lost.");
    expect(page.url()).toBe(`${ORIGIN}/en/home/`);
    dues.readStatus = null;
    await alert.getByRole("button", { name: "Try again" }).click();
    await expect(rows(page)).toHaveCount(4);
    expect(page.url()).toBe(`${ORIGIN}/en/home/`);
  });

  test("offline, Previous month is not opened and says so; the current month and the navigation stay", async ({ page }) => {
    await signedIn(page);
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    await page.evaluate(() => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }));
    await prev(page).click();
    await expect(page.getByText("Can't open September 2026 without a network.")).toBeVisible();
    await expect(month(page)).toHaveText(/october 2026/i);
    await expect(rows(page)).toHaveCount(4);
    await expect(nav(page)).toBeVisible();
    // Reopening Home does not strand her either.
    await bounce(page);
    await expect(month(page)).toHaveText(/october 2026/i);
  });

  test("a month that fails to read keeps the month buttons and the navigation, and Next goes back", async ({ page }) => {
    test.setTimeout(60_000);
    const { dues } = await signedIn(page);
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    dues.readStatus = 500;
    await prev(page).click();
    await expect(page.locator('[data-kind="error"]')).toContainText("Couldn't load your fees", { timeout: 25_000 });
    await expect(month(page)).toHaveText(/september 2026/i);
    await expect(nav(page)).toBeVisible();
    dues.readStatus = null;
    await next(page).click();
    await expect(month(page)).toHaveText(/october 2026/i);
    await expect(rows(page)).toHaveCount(4);
    await prev(page).click();
    await expect(month(page)).toHaveText(/september 2026/i);
    await expect(page.getByText("Showing what was saved on this phone.")).toHaveCount(0);
  });

  test("a failed refresh keeps the saved board under a quiet line; offline sends no dues request", async ({ page }) => {
    test.setTimeout(60_000);
    const { dues } = await signedIn(page);
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    dues.readStatus = 500;
    await bounce(page);
    await expect(page.getByText("Showing what was saved on this phone.")).toBeVisible({ timeout: 25_000 });
    await expect(rows(page)).toHaveCount(4);
    await expect(page.locator('[role="alert"][data-kind="error"]')).toHaveCount(0);
  });

  test("offline: the saved board stays under the quiet line and no dues request is sent", async ({ page }) => {
    const { dues } = await signedIn(page);
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    // The phone says it has no network (the fake host keeps answering the roster; the board must not ask).
    await page.evaluate(() => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }));
    const before = dues.requests.length;
    await bounce(page);
    await expect(page.getByText("Showing what was saved on this phone.")).toBeVisible();
    await expect(rows(page)).toHaveCount(4);
    await page.waitForTimeout(300);
    expect(dues.requests.length).toBe(before);
  });

  test("ensure_my_dues: one POST with an empty body on each opening, in parallel; more than 0 reads again; slow or failed changes nothing", async ({ page }) => {
    const { dues } = await signedIn(page);
    dues.ensure.delayMs = 1500;
    await page.goto("/en/home/");
    // The board is shown before the call has answered.
    await expect(rows(page)).toHaveCount(4);
    await page.waitForTimeout(2000);
    expect(dues.ensures()).toHaveLength(1);
    expect(dues.ensures()[0].method).toBe("POST");
    expect(JSON.parse(dues.ensures()[0].body ?? "{}")).toEqual({});
    // Not made again on a tab, a month or a filter.
    await tab(page, "Due").click();
    await prev(page).click();
    await next(page).click();
    await page.getByRole("combobox", { name: "Show" }).selectOption(MATHS);
    expect(dues.ensures()).toHaveLength(1);

    // It made one: the dues are read once more, and the new row shows.
    dues.ensure.delayMs = 0;
    dues.ensure.add = [{ id: "00000000-0000-4000-8000-0000000fffff", tutor_id: "x", student_id: S.meena, kind: "monthly", month: "2026-10-01", amount: 77700, amount_paid: 0, status: "due", due_date: "2026-10-10" }];
    await page.getByRole("combobox", { name: "Show" }).selectOption("all");
    const readsBefore = dues.reads().length;
    await bounce(page);
    await expect(page.getByText("₹8,577", { exact: true })).toBeVisible();
    expect(dues.ensures()).toHaveLength(2);
    // Two sets of reads: the first and the re-read.
    expect(dues.reads().length - readsBefore).toBeGreaterThanOrEqual(6);
  });

  test("ensure_my_dues failing changes nothing on screen", async ({ page }) => {
    const { dues } = await signedIn(page);
    dues.ensure.fail = true;
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    await expect(page.getByText("Showing what was saved on this phone.")).toHaveCount(0);
    await expect(page.locator('[data-kind="error"]')).toHaveCount(0);
  });

  test("a fee of a student this phone has not seen reads the roster once, and then shows", async ({ page }) => {
    const { dues, roster } = await signedIn(page, { dues: [{ student_id: S.ravi, due_date: "2026-10-05" }] });
    const late = "00000000-0000-4000-8000-0000000000c9";
    dues.addDue({ student_id: late, due_date: "2026-10-04" });
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(1);
    roster.addStudent({ id: late, name: "Late Arrival" });
    const reads = () => roster.requests.filter((r) => r.method === "GET" && r.table === "students").length;
    const before = reads();
    await bounce(page);
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByText("Late Arrival")).toBeVisible();
    expect(reads() - before).toBeLessThanOrEqual(3);
  });
});

test.describe("29: the day changes while the board is open", () => {
  test("Due today becomes Overdue 1 day, the counts follow, and the dues are asked for again", async ({ page }) => {
    const { dues } = await signedIn(page, { clock: new Date("2026-10-12T15:00:00Z"), dues: [{ student_id: S.asha, due_date: "2026-10-12" }, { student_id: S.ravi, due_date: "2026-10-20" }] });
    await page.goto("/en/home/");
    await expect(tab(page, "Due")).toHaveAttribute("aria-selected", "true");
    await expect(rows(page).first()).toContainText("Due today");
    await expect(page.getByRole("tab")).toHaveText(["Overdue 0", "Due 2", "Paid 0"]);
    const before = dues.ensures().length;
    // 00:01 on the 13th in India.
    await page.clock.setFixedTime(new Date("2026-10-12T18:31:00Z"));
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByRole("tab")).toHaveText(["Overdue 1", "Due 1", "Paid 0"]);
    await tab(page, "Overdue").click();
    await expect(rows(page).first()).toContainText("Overdue 1 day");
    await expect.poll(() => dues.ensures().length).toBe(before + 1);
  });
});

for (const timezoneId of ["America/Los_Angeles", "Pacific/Kiritimati"]) {
  test.describe(`31: browser time zone ${timezoneId}`, () => {
    test.use({ timezoneId });
    test("days late, the month and the counts are the same as in India", async ({ page }) => {
      await signedIn(page);
      await page.goto("/en/home/");
      await expect(month(page)).toHaveText(/october 2026/i);
      await expect(page.getByRole("tab")).toHaveText(["Overdue 4", "Due 2", "Paid 1"]);
      await expect(rows(page).nth(2)).toContainText("Overdue 7 days");
      await expect(rows(page).nth(1)).toContainText("Overdue 37 days");
      await tab(page, "Due").click();
      await expect(rows(page).nth(0)).toContainText("Due today");
    });
  });
}

test.describe("32: nothing is written, nothing leaves", () => {
  test("only reads and the one function call; no pay_token or tutor_id; no cookie; no other host", async ({ page, context }) => {
    const { dues, roster, stub } = await signedIn(page);
    const others = watchOtherHosts(page, ORIGIN);
    await page.goto("/en/home/");
    await expect(rows(page)).toHaveCount(4);
    await prev(page).click();
    await next(page).click();
    await tab(page, "Paid").click();
    await page.getByRole("combobox", { name: "Show" }).selectOption(MATHS);
    await page.waitForTimeout(300);
    expect(dues.writes()).toEqual([]);
    expect(dues.ensures().length).toBeGreaterThan(0);
    for (const request of dues.requests) {
      expect(request.method === "GET" || request.path.endsWith("/rpc/ensure_my_dues")).toBe(true);
      expect(`${request.query} ${request.body ?? ""}`).not.toMatch(/pay_token|tutor_id|parent_phone|parent_name|\*/);
    }
    // No write to any table from Home.
    expect(roster.requests.filter((r) => r.method !== "GET")).toEqual([]);
    // HEAD is a read: the "to confirm" chip counts pending claims without downloading rows (R1-10 criterion 16).
    expect(stub.log.filter((r) => r.method !== "GET" && r.method !== "HEAD" && !r.path.startsWith("/auth/") && !r.path.endsWith("/rpc/ensure_my_dues"))).toEqual([]);
    expect(await context.cookies()).toEqual([]);
    expect(others).toEqual([]);
  });
});

test("the fixed clock is what the specs think it is", () => {
  expect(NOW.toISOString()).toBe("2026-10-12T05:00:00.000Z");
  expect(DUES.length).toBeGreaterThan(5);
});
