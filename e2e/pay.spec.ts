// Spec R1-7 Part A, criteria 12 to 21 and 38: Mark paid, undo, the receipt screen and the Already owes lock,
// at 360px against the fake host (pay-helpers.ts). The clock is fixed at 2026-10-12 05:00 UTC (10:30 in India).
import { expect, test, type Page } from "@playwright/test";
import { watchOtherHosts } from "./auth-helpers";
import { NOW, S, signedIn } from "./board-fixture";
import { box } from "./helpers";
import { stubPayments, type Payments } from "./pay-helpers";
import type { Dues } from "./dues-helpers";

const ORIGIN = process.env.E2E_BASE_URL ?? "http://localhost:4173";

type Board = { dues: Dues; pay: Payments };

async function board(page: Page, seed: Parameters<typeof signedIn>[1] = {}, payments: Parameters<typeof stubPayments>[2] = []): Promise<Board> {
  const { dues } = await signedIn(page, seed);
  const pay = await stubPayments(page, dues, payments);
  return { dues, pay };
}
const dueOf = (dues: Dues, student: string, month: string | null) => {
  const row = dues.dues.find((d) => d.student_id === student && d.month === month);
  if (!row) throw new Error("no such due");
  return row;
};
const OCT = "2026-10-01";
const row = (page: Page, name: string, tag: string | RegExp) => page.locator("main li").filter({ hasText: name }).filter({ hasText: tag });
const tab = (page: Page, name: string) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const sheet = (page: Page) => page.getByRole("dialog", { name: "Mark paid" });
const amount = (page: Page) => sheet(page).getByLabel(/Amount received/);
const banner = (page: Page) => page.locator("[data-kind='undo']");
const markPaid = (page: Page) => sheet(page).getByRole("button", { name: /^(Mark as paid|Saving…)$/ });

async function openSheet(page: Page, name = "Ravi Kumar", tag: string | RegExp = "Overdue 7 days") {
  await row(page, name, tag).getByRole("button", { name: /^Mark paid/ }).click();
  await expect(sheet(page)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("probe", "1"));
});

test.describe("12: Mark paid on the row", () => {
  test("Overdue, Due and Part paid rows have it as their own 44px button beside the link; Paid rows have none", async ({ page }) => {
    await board(page);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Still to come in");
    const overdue = row(page, "Ravi Kumar", "Overdue 7 days");
    const button = overdue.getByRole("button", { name: "Mark paid, Ravi Kumar" });
    await expect(button).toHaveText("Mark paid");
    expect((await box(button)).height).toBeGreaterThanOrEqual(44);
    // Not inside the link: the link holds no control.
    expect(await overdue.locator("a button").count()).toBe(0);
    expect(await overdue.locator("a").first().evaluate((a) => a.querySelector("button, a, input") === null)).toBe(true);
    await expect(row(page, "Imran Ali", "Overdue 5 days").getByRole("button", { name: /^Mark paid/ })).toBeVisible();
    await tab(page, "Due").click();
    await expect(row(page, "Asha Rao", "Due today").getByRole("button", { name: /^Mark paid/ })).toBeVisible();
    await tab(page, "Paid").click();
    await expect(page.getByRole("button", { name: /^Mark paid/ })).toHaveCount(0);
    await expect(row(page, "Dev Patil", "Paid").getByRole("link", { name: "Receipt, Dev Patil" })).toBeVisible();
  });

  test("tapping the name still opens the student", async ({ page }) => {
    await board(page);
    await page.goto("/en/home/");
    await row(page, "Ravi Kumar", "Overdue 7 days").getByRole("link", { name: /Ravi Kumar/ }).first().click();
    await expect(page).toHaveURL(/\/en\/students\/edit\/\?id=/);
  });

  test("the sheet: student and month in the header, the amount, chips, Paid by, Paid on, Mark as paid, Cancel", async ({ page }) => {
    await board(page);
    await page.goto("/en/home/");
    await openSheet(page);
    await expect(sheet(page).getByText("Ravi Kumar")).toBeVisible();
    await expect(sheet(page).getByText("October")).toBeVisible();
    await expect(sheet(page).getByText("Class 10 Maths")).toBeVisible();
    await expect(amount(page)).toHaveValue("1,200");
    await expect(sheet(page).getByRole("button", { name: "Full ₹1,200" })).toHaveAttribute("aria-pressed", "true");
    await expect(sheet(page).getByRole("button", { name: "Half ₹600" })).toBeVisible();
    await expect(sheet(page).getByRole("button", { name: "Other" })).toBeVisible();
    await expect(sheet(page).getByRole("radio", { name: "UPI" })).toBeChecked();
    await expect(sheet(page).getByRole("radio")).toHaveCount(5);
    await expect(sheet(page).getByRole("radio", { name: "Today" })).toBeChecked();
    await expect(markPaid(page)).toBeVisible();
    await sheet(page).getByRole("button", { name: "Cancel" }).click();
    await expect(sheet(page)).toHaveCount(0);
  });
});

test.describe("13: the amount", () => {
  test("Half, Full, typing and Other; a numeric keypad; ₹ and 0 to 9", async ({ page }) => {
    await board(page);
    await page.goto("/en/home/");
    await openSheet(page);
    await expect(amount(page)).toHaveAttribute("inputmode", "numeric");
    await sheet(page).getByRole("button", { name: "Half ₹600" }).click();
    await expect(amount(page)).toHaveValue("600");
    await sheet(page).getByRole("button", { name: "Full ₹1,200" }).click();
    await expect(amount(page)).toHaveValue("1,200");
    await amount(page).fill("450");
    await expect(sheet(page).getByRole("button", { name: "Other" })).toHaveAttribute("aria-pressed", "true");
    await expect(sheet(page).getByRole("button", { name: "Full ₹1,200" })).toHaveAttribute("aria-pressed", "false");
  });

  for (const [text, message] of [
    ["", "Enter an amount of ₹1 or more"],
    ["0", "Enter an amount of ₹1 or more"],
    ["abc", "Use digits only, in whole rupees"],
    ["12.5", "Use digits only, in whole rupees"],
    ["1,201", "Only ₹1,200 is left on this fee"],
  ] as const) {
    test(`${JSON.stringify(text)} is refused beside the field and nothing is sent`, async ({ page }) => {
      const { pay } = await board(page);
      await page.goto("/en/home/");
      await openSheet(page);
      await amount(page).fill(text);
      await markPaid(page).click();
      await expect(sheet(page).getByText(message)).toBeVisible();
      await expect(amount(page)).toHaveAttribute("aria-invalid", "true");
      expect(pay.calls("record_payment")).toEqual([]);
    });
  }

  test("a date in the future or more than 90 days back is refused", async ({ page }) => {
    const { pay } = await board(page);
    await page.goto("/en/home/");
    await openSheet(page);
    await sheet(page).getByRole("radio", { name: "Pick date" }).check({ force: true });
    const picker = sheet(page).getByLabel("Date paid");
    await expect(picker).toHaveAttribute("min", "2026-07-14");
    await expect(picker).toHaveAttribute("max", "2026-10-12");
    await picker.fill("2026-10-13");
    await markPaid(page).click();
    await expect(sheet(page).getByText("Pick a date that is not in the future")).toBeVisible();
    await picker.fill("2026-07-13");
    await markPaid(page).click();
    await expect(sheet(page).getByText("Pick a date within the last 90 days")).toBeVisible();
    expect(pay.calls("record_payment")).toEqual([]);
  });
});

test.describe("14, 15: recording and undo", () => {
  test("a full payment: Saving…, the sheet closes, the row moves to Paid, the total drops, the banner shows Undo and View receipt; Undo puts it all back with no reload", async ({ page }) => {
    const { dues, pay } = await board(page);
    pay.delayMs = 600;
    await page.goto("/en/home/");
    await expect(page.getByText("₹7,800", { exact: true })).toBeVisible();
    await page.evaluate(() => ((window as unknown as { marker: number }).marker = 7));
    await openSheet(page);
    await sheet(page).getByRole("radio", { name: "Cash" }).check({ force: true });
    await markPaid(page).click();
    await expect(sheet(page).getByRole("button", { name: "Saving…" })).toBeVisible();
    // Nothing says paid until the database answered.
    await expect(banner(page)).toHaveCount(0);
    await expect(sheet(page)).toHaveCount(0);
    await expect(banner(page)).toContainText("Ravi Kumar marked paid, ₹1,200");
    await expect(banner(page).getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(banner(page).getByRole("link", { name: "View receipt" })).toBeVisible();
    await expect(page.getByText("₹6,600", { exact: true })).toBeVisible();
    await expect(tab(page, "Overdue")).toContainText("3");
    await expect(row(page, "Ravi Kumar", "Overdue 7 days")).toHaveCount(0);
    await tab(page, "Paid").click();
    await expect(row(page, "Ravi Kumar", "Paid")).toBeVisible();
    expect(dueOf(dues, S.ravi, OCT)).toMatchObject({ amount_paid: 120000, status: "paid" });

    // The request carries only the five things.
    const [call] = pay.calls("record_payment");
    expect(Object.keys(call).sort()).toEqual(["p_amount", "p_due", "p_method", "p_paid_on", "p_request_id"]);
    expect(call).toMatchObject({ p_amount: 120000, p_method: "cash", p_paid_on: "2026-10-12" });

    await banner(page).getByRole("button", { name: "Undo" }).click();
    await expect(page.locator("[data-kind='undo']")).toHaveText("Payment undone");
    await expect(page.getByText("₹7,800", { exact: true })).toBeVisible();
    await tab(page, "Overdue").click();
    await expect(row(page, "Ravi Kumar", "Overdue 7 days")).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { marker: number }).marker)).toBe(7);
    expect(dueOf(dues, S.ravi, OCT)).toMatchObject({ amount_paid: 0, status: "due" });
    expect(pay.payments[0].voided_at).not.toBeNull();
  });

  test("a part payment keeps the fee on the board as Part paid with what is left", async ({ page }) => {
    await board(page);
    await page.goto("/en/home/");
    await openSheet(page);
    await amount(page).fill("500");
    await sheet(page).getByRole("radio", { name: "Yesterday" }).check({ force: true });
    await markPaid(page).click();
    await expect(banner(page)).toContainText("Ravi Kumar marked paid, ₹500");
    const part = row(page, "Ravi Kumar", /Part paid ₹500/);
    await expect(part).toBeVisible();
    await expect(part).toContainText("Overdue 7 days");
    await expect(part).toContainText("₹700");
    await expect(part.getByRole("button", { name: /^Mark paid/ })).toBeVisible();
    await expect(part.getByRole("link", { name: /^Receipt/ })).toBeVisible();
    await expect(page.getByText("₹7,300", { exact: true })).toBeVisible();
  });

  test("the banner goes after 10 seconds", async ({ page }) => {
    await board(page);
    await page.goto("/en/home/");
    await openSheet(page);
    await markPaid(page).click();
    await expect(banner(page)).toBeVisible();
    await page.waitForTimeout(9_000);
    await expect(banner(page)).toBeVisible();
    await expect(banner(page)).toHaveCount(0, { timeout: 4_000 });
  });
});

test.describe("16, 17: failure and offline", () => {
  test("a failed save keeps the sheet and the typed values; Try again sends the same request id", async ({ page }) => {
    const { pay } = await board(page);
    pay.failNext = true;
    await page.goto("/en/home/");
    await openSheet(page);
    await amount(page).fill("700");
    await sheet(page).getByRole("radio", { name: "Cash" }).check({ force: true });
    await markPaid(page).click();
    await expect(sheet(page).getByText("Couldn't save. Nothing was recorded. Try again.")).toBeVisible();
    await expect(amount(page)).toHaveValue("700");
    await expect(sheet(page).getByRole("radio", { name: "Cash" })).toBeChecked();
    expect(pay.payments).toHaveLength(0);
    await markPaid(page).click();
    await expect(sheet(page)).toHaveCount(0);
    expect(pay.payments).toHaveLength(1);
    const calls = pay.calls("record_payment");
    expect(calls).toHaveLength(2);
    expect(calls[1].p_request_id).toBe(calls[0].p_request_id);
  });

  test("a lost answer after the database saved: Try again returns the same receipt, one payment", async ({ page }) => {
    const { pay } = await board(page);
    pay.loseNextResponse = true;
    await page.goto("/en/home/");
    await openSheet(page);
    await markPaid(page).click();
    await expect(sheet(page).getByText("Couldn't save. Nothing was recorded. Try again.")).toBeVisible();
    expect(pay.payments).toHaveLength(1);
    await markPaid(page).click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(banner(page)).toContainText("Ravi Kumar marked paid, ₹1,200");
    expect(pay.payments).toHaveLength(1);
    const calls = pay.calls("record_payment");
    expect(calls[1].p_request_id).toBe(calls[0].p_request_id);
  });

  test("a double tap sends one request", async ({ page }) => {
    const { pay } = await board(page);
    pay.delayMs = 500;
    await page.goto("/en/home/");
    await openSheet(page);
    await markPaid(page).dblclick();
    await expect(sheet(page)).toHaveCount(0);
    expect(pay.calls("record_payment")).toHaveLength(1);
    expect(pay.payments).toHaveLength(1);
  });

  test("offline: the button is tappable, says so, sends nothing, keeps the values; back online Try again works", async ({ page, context }) => {
    const { pay } = await board(page);
    await page.goto("/en/home/");
    await openSheet(page);
    await amount(page).fill("300");
    await context.setOffline(true);
    await markPaid(page).click();
    await expect(sheet(page).getByText("You are offline. Payments need a connection for now. Nothing was saved.")).toBeVisible();
    await expect(amount(page)).toHaveValue("300");
    expect(pay.requests).toEqual([]);
    await context.setOffline(false);
    await markPaid(page).click();
    await expect(sheet(page)).toHaveCount(0);
    expect(pay.payments).toHaveLength(1);
  });
});

test.describe("21: a stale board", () => {
  test("another phone paid ₹700: the sheet says only ₹500 is left, nothing is recorded, the board refreshes", async ({ page }) => {
    const { dues, pay } = await board(page);
    await page.goto("/en/home/");
    await openSheet(page);
    pay.payElsewhere(dueOf(dues, S.ravi, OCT).id, 70000);
    await markPaid(page).click();
    await expect(sheet(page).getByText("Only ₹500 is left on this fee")).toBeVisible();
    expect(pay.payments).toHaveLength(1);
    await sheet(page).getByRole("button", { name: "Cancel" }).click();
    const part = row(page, "Ravi Kumar", /Part paid ₹700/);
    await expect(part).toBeVisible();
    await expect(part).toContainText("₹500");
  });
});

test.describe("18, 19: the receipt screen", () => {
  test("View receipt opens the receipt: number, month, amount, method, date, balance, names, stamp and the India time", async ({ page }) => {
    await board(page);
    await page.goto("/en/home/");
    await openSheet(page);
    await markPaid(page).click();
    await banner(page).getByRole("link", { name: "View receipt" }).click();
    await expect(page).toHaveURL(/\/en\/receipt\/\?due=/);
    await expect(page.locator("h1")).toHaveText("Receipt");
    const card = page.locator("article");
    await expect(card).toHaveCount(1);
    await expect(card).toContainText("Meena Iyer");
    await expect(card.getByText("Receipt no.")).toBeVisible();
    await expect(card.getByText("1", { exact: true })).toBeVisible();
    await expect(card).toContainText("October 2026");
    await expect(card).toContainText("₹1,200/-");
    await expect(card).toContainText("UPI");
    await expect(card).toContainText("Date 12 Oct 2026");
    await expect(card).toContainText("Nil");
    await expect(card).toContainText("Ravi Kumar");
    await expect(card).toContainText("Recorded 12 Oct 2026 10:30");
    await expect(card.getByRole("img", { name: "PAID" })).toBeVisible();
    // The receipt's token is never in the address.
    expect(page.url()).not.toMatch(/token/i);
  });

  test("a fee with two payments lists both, newest first; Undo asks once, cancels the receipt, and the board takes it back", async ({ page }) => {
    const { dues, pay } = await board(page);
    const id = dueOf(dues, S.ravi, OCT).id;
    pay.seed({ due_id: id, amount: 50000, method: "cash" });
    pay.seed({ due_id: id, amount: 70000 });
    await page.goto(`/en/receipt/?due=${id}`);
    const cards = page.locator("article");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("₹700/-");
    await expect(cards.nth(1)).toContainText("₹500/-");
    await expect(cards.nth(0).getByRole("img", { name: "PAID" })).toBeVisible();
    await expect(cards.nth(1).getByRole("img", { name: "PART PAID" })).toBeVisible();
    await expect(page.getByText(/Balance on this fee now/)).toContainText("Nil");

    await cards.nth(0).getByRole("button", { name: "Undo this payment" }).click();
    await expect(cards.nth(0)).toContainText("Undo this payment? The receipt will be cancelled.");
    expect(pay.calls("void_payment")).toHaveLength(0);
    await cards.nth(0).getByRole("button", { name: "Yes, undo it" }).click();
    await expect(cards.nth(0).getByRole("img", { name: "CANCELLED" })).toBeVisible();
    await expect(cards.nth(0)).toContainText("2");
    await expect(cards.nth(0).locator(".line-through")).toContainText("₹700/-");
    await expect(cards.nth(0).getByRole("button", { name: /Undo/ })).toHaveCount(0);
    await expect(page.getByText(/Balance on this fee now/)).toContainText("₹700");
    expect(dueOf(dues, S.ravi, OCT)).toMatchObject({ amount_paid: 50000, status: "partial" });

    await page.getByRole("link", { name: "Back to fees" }).click();
    await expect(row(page, "Ravi Kumar", /Part paid ₹500/)).toBeVisible();
  });

  test("no Undo after 24 hours", async ({ page }) => {
    const { dues, pay } = await board(page);
    const id = dueOf(dues, S.ravi, OCT).id;
    pay.seed({ due_id: id, amount: 120000, created_at: new Date(NOW.getTime() - 25 * 3_600_000).toISOString() });
    await page.goto(`/en/receipt/?due=${id}`);
    await expect(page.locator("article")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Undo/ })).toHaveCount(0);
  });

  test("a paid fee's Receipt button on the board opens it", async ({ page }) => {
    const { dues, pay } = await board(page);
    pay.seed({ due_id: dueOf(dues, S.dev, OCT).id, amount: 100000 });
    await page.goto("/en/home/");
    await tab(page, "Paid").click();
    await row(page, "Dev Patil", "Paid").getByRole("link", { name: /^Receipt/ }).click();
    await expect(page).toHaveURL(/\/en\/receipt\/\?due=/);
    await expect(page.locator("article")).toContainText("Dev Patil");
  });

  test("an unknown fee says so", async ({ page }) => {
    await board(page);
    await page.goto("/en/receipt/?due=00000000-0000-4000-8000-00000000dead");
    await expect(page.getByText("Couldn't find this fee")).toBeVisible();
  });
});

test.describe("20: Already owes", () => {
  test("is read-only with the line once the earlier balance has a payment, and editable before", async ({ page }) => {
    const { dues, pay } = await board(page);
    await page.goto(`/en/students/edit/?id=${S.meena}`);
    await expect(page.getByLabel("Already owes ₹")).toBeEditable();
    await expect(page.getByText("A payment has been recorded against this, so it can't be changed")).toHaveCount(0);
    const opening = dues.dues.find((d) => d.student_id === S.meena && d.kind === "opening")!;
    pay.seed({ due_id: opening.id, amount: 50000 });
    await page.goto(`/en/students/edit/?id=${S.meena}`);
    await expect(page.getByText("A payment has been recorded against this, so it can't be changed")).toBeVisible();
    await expect(page.getByLabel("Already owes ₹")).not.toBeEditable();
  });
});

test.describe("38: privacy on the tutor side", () => {
  test("only the two functions write; only the page's host and the Supabase host are contacted; no cookie", async ({ page, context }) => {
    const { dues, pay } = await board(page);
    const others = watchOtherHosts(page, ORIGIN);
    await page.goto("/en/home/");
    await openSheet(page);
    await markPaid(page).click();
    await expect(banner(page)).toBeVisible();
    await banner(page).getByRole("link", { name: "View receipt" }).click();
    await expect(page.locator("article")).toBeVisible();
    await page.locator("article").getByRole("button", { name: "Undo this payment" }).click();
    await page.getByRole("button", { name: "Yes, undo it" }).click();
    await expect(page.getByRole("img", { name: "CANCELLED" })).toBeVisible();
    expect(pay.writes()).toEqual([]);
    expect(dues.writes()).toEqual([]);
    expect(pay.requests.filter((r) => r.method !== "GET").map((r) => r.path)).toEqual(["/rest/v1/rpc/record_payment", "/rest/v1/rpc/void_payment"]);
    expect(others).toEqual([]);
    expect(await context.cookies()).toEqual([]);
  });
});
