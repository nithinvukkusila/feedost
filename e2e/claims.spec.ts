// Spec R1-10 Part B, criteria 16 to 27: the "to confirm" chip on Home, the inbox, Confirm and Not received, at 360px
// against the fake host (claims-helpers.ts). The clock is fixed at 2026-10-12 05:00 UTC (10:30 in India).
import { expect, test, type Page } from "@playwright/test";
import { HOST, watchOtherHosts } from "./auth-helpers";
import { S, signedIn } from "./board-fixture";
import { stubClaims, type Claims } from "./claims-helpers";
import { box } from "./helpers";
import { stubPayments, type Payments } from "./pay-helpers";
import type { Dues } from "./dues-helpers";

const ORIGIN = process.env.E2E_BASE_URL ?? "http://localhost:4173";

type Setup = { dues: Dues; pay: Payments; claims: Claims };
const dueOf = (dues: Dues, student: string, month: string | null) => {
  const row = dues.dues.find((d) => d.student_id === student && d.month === month);
  if (!row) throw new Error("no such due");
  return row;
};

/** Ravi owes Sept and Oct (₹1,200 each); Asha owes October (₹1,500); Imran owes ₹500 of October. */
async function board(page: Page, seed: Parameters<typeof signedIn>[1] = {}, claimsFor?: (dues: Dues) => Parameters<typeof stubClaims>[4]): Promise<Setup> {
  const { dues, roster } = await signedIn(page, seed);
  const pay = await stubPayments(page, dues);
  const claims = await stubClaims(page, dues, pay, roster, claimsFor?.(dues) ?? []);
  return { dues, pay, claims };
}

const standard = (dues: Dues) => [
  // Two fees: the claim is for both, and names the older one.
  { student_id: S.ravi, due_id: dueOf(dues, S.ravi, "2026-09-01").id, amount: 240000, fee_count: 2, created_at: "2026-10-12T03:00:00Z" },
  { student_id: S.asha, due_id: dueOf(dues, S.asha, "2026-10-01").id, amount: 150000, upi_ref: "111122223333", created_at: "2026-10-11T16:10:00Z" },
];

const chip = (page: Page) => page.getByRole("link", { name: /to confirm$/ });
const card = (page: Page, name: string) => page.getByRole("article").filter({ hasText: name });
const confirmBtn = (page: Page, name: string) => card(page, name).getByRole("button", { name: /^(Confirm paid|Saving…)$/ });
const banner = (page: Page) => page.locator("[data-kind='undo']");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("probe", "1"));
});

test.describe("16: the chip on Home", () => {
  test("is not there when nothing is waiting", async ({ page }) => {
    await board(page);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Still to come in");
    await expect(chip(page)).toHaveCount(0);
  });

  test("says how many are waiting, is 44px high with the offset shadow, and opens the inbox", async ({ page }) => {
    await board(page, {}, standard);
    await page.goto("/en/home/");
    await expect(chip(page)).toHaveText("2 to confirm");
    expect((await box(chip(page))).height).toBeGreaterThanOrEqual(44);
    expect(await chip(page).evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe("none");
    await chip(page).click();
    await expect(page).toHaveURL(/\/en\/claims\/$/);
    await expect(page.locator("h1")).toHaveText("2 parents say they've paid");
  });

  test("reads again when the app comes back to the foreground, and never on a timer", async ({ page }) => {
    const { claims } = await board(page, {}, standard);
    await page.goto("/en/home/");
    await expect(chip(page)).toHaveText("2 to confirm");
    const heads = () => claims.requests.filter((r) => r.method === "HEAD").length;
    const before = heads();
    claims.claims[0].status = "rejected";
    claims.claims[0].handled_at = "2026-10-12T04:00:00Z";
    await page.waitForTimeout(1500);
    expect(heads()).toBe(before);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(chip(page)).toHaveText("1 to confirm");
    claims.claims[1].status = "rejected";
    claims.claims[1].handled_at = "2026-10-12T04:00:00Z";
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(chip(page)).toHaveCount(0);
  });

  test("shows no number when the count cannot be read", async ({ page }) => {
    const { claims } = await board(page, {}, standard);
    claims.readStatus = 500;
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Still to come in");
    await expect(chip(page)).toHaveCount(0);
  });

  test("the count is a head request: no row is downloaded, and no write is sent", async ({ page }) => {
    const { claims } = await board(page, {}, standard);
    await page.goto("/en/home/");
    await expect(chip(page)).toBeVisible();
    const counts = claims.requests.filter((r) => r.method === "HEAD");
    expect(counts.length).toBeGreaterThan(0);
    expect(counts[0].headers["prefer"]).toContain("count=exact");
    expect(claims.requests.filter((r) => r.method === "GET")).toHaveLength(0);
    expect(claims.writes()).toEqual([]);
  });
});

test.describe("17, 18, 19: the inbox and its cards", () => {
  test("heading, sub-line, a back arrow of 44px, and the cards newest first", async ({ page }) => {
    await board(page, {}, standard);
    await page.goto("/en/claims/");
    await expect(page.locator("h1")).toHaveText("2 parents say they've paid");
    await expect(page.getByText("Check your UPI app, then confirm.")).toBeVisible();
    const back = page.getByRole("link", { name: "Back to home" });
    expect((await box(back)).height).toBeGreaterThanOrEqual(44);
    expect((await box(back)).width).toBeGreaterThanOrEqual(44);
    const cards = page.getByRole("article");
    await expect(cards).toHaveCount(2);
    await expect(cards.nth(0)).toContainText("Ravi Kumar");
    await expect(cards.nth(1)).toContainText("Asha Rao");
    await back.click();
    await expect(page).toHaveURL(/\/en\/home\/$/);
  });

  test("one parent says: the singular heading", async ({ page }) => {
    await board(page, {}, (dues) => standard(dues).slice(1));
    await page.goto("/en/claims/");
    await expect(page.locator("h1")).toHaveText("1 parent says they've paid");
  });

  test("a card: the time and fee, the name, the amount, the reference in fours, Copy; named as the PRD's notification", async ({ page }) => {
    await board(page, {}, standard);
    await page.goto("/en/claims/");
    const ravi = card(page, "Ravi Kumar");
    await expect(page.getByRole("article", { name: "Ravi Kumar's parent says ₹2,400 paid. Confirm?" })).toBeVisible();
    await expect(ravi).toContainText("Today 8:30 am");
    await expect(ravi).toContainText("2 fees");
    await expect(ravi.getByText("₹2,400")).toBeVisible();
    await expect(ravi.getByText("6281 0473 9915")).toBeVisible();
    const asha = card(page, "Asha Rao");
    await expect(asha).toContainText("Yesterday 9:40 pm");
    await expect(asha).toContainText("October");
    await expect(asha.getByText("1111 2222 3333")).toBeVisible();
    // Row amounts and references are DM Mono, the headline amount is Bricolage.
    expect(await asha.getByText("1111 2222 3333").evaluate((el) => getComputedStyle(el).fontFamily)).toContain("DM Mono");
    for (const control of await page.locator("main a:visible, main button:visible").all()) expect((await box(control)).height).toBeGreaterThanOrEqual(44);
  });

  test("an earlier balance and an older day", async ({ page }) => {
    await board(page, {}, (dues) => [
      { student_id: S.meena, due_id: dues.dues.find((d) => d.student_id === S.meena && d.kind === "opening")!.id, amount: 240000, created_at: "2026-10-06T05:00:00Z" },
    ]);
    await page.goto("/en/claims/");
    const meena = card(page, "Meena Shetty");
    await expect(meena).toContainText("06 Oct 2026");
    await expect(meena).toContainText("Earlier balance");
  });

  test("Copy puts the 12 digits on the clipboard and says Copied, then Copy again", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await board(page, {}, standard);
    await page.goto("/en/claims/");
    const ravi = card(page, "Ravi Kumar");
    const copy = ravi.getByRole("button", { name: /Copy/ });
    expect((await box(copy)).height).toBeGreaterThanOrEqual(44);
    await copy.click();
    await expect(ravi.getByText("Copied")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("628104739915");
    await expect(ravi.getByText("Copied")).toHaveCount(0, { timeout: 4000 });
    await expect(ravi.getByRole("button", { name: /Copy/ })).toBeVisible();
  });

  test("no Copy button when the browser has no clipboard", async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined }));
    await board(page, {}, standard);
    await page.goto("/en/claims/");
    await expect(card(page, "Ravi Kumar")).toBeVisible();
    await expect(page.getByRole("button", { name: /Copy/ })).toHaveCount(0);
  });
});

test.describe("20: Confirm paid", () => {
  test("Saving…, a second tap ignored, the card leaves only after the database answered; Earlier, the banner and the board follow", async ({ page }) => {
    const { claims, pay, dues } = await board(page, {}, standard);
    claims.delayMs = 700;
    await page.goto("/en/claims/");
    const asha = confirmBtn(page, "Asha Rao");
    expect((await box(asha)).height).toBeGreaterThanOrEqual(52);
    // Black, not green: it records.
    expect(await asha.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(26, 20, 16)");
    await asha.click();
    await expect(asha).toHaveText("Saving…");
    await asha.click({ force: true });
    // Not optimistic: the card is still there while the database is busy.
    await expect(card(page, "Asha Rao")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("2 parents say they've paid");
    await expect(card(page, "Asha Rao")).toHaveCount(0);
    expect(claims.calls("confirm_claim")).toHaveLength(1);
    expect(Object.keys(claims.calls("confirm_claim")[0]).sort()).toEqual(["p_claim", "p_request_id"]);
    expect(pay.payments).toHaveLength(1);
    expect(pay.payments[0]).toMatchObject({ amount: 150000, method: "upi", paid_on: "2026-10-11" });
    // The count in the heading drops, and the claim is under Earlier with its receipt number.
    await expect(page.locator("h1")).toHaveText("1 parent says they've paid");
    await expect(page.getByRole("heading", { name: "Earlier" })).toBeVisible();
    await expect(page.locator("section").filter({ hasText: "Earlier" }).getByText("CONFIRMED 12 Oct 2026 · NO. 1")).toBeVisible();
    // R1-7's banner: the amount, Undo and the receipt.
    await expect(banner(page)).toContainText("Asha Rao marked paid, ₹1,500");
    await expect(banner(page).getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(banner(page).getByRole("link", { name: "View receipt" })).toHaveAttribute("href", `/en/receipt/?due=${dueOf(dues, S.asha, "2026-10-01").id}`);
    // Home has one less to confirm, and the fee is paid, without a reload.
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(chip(page)).toHaveText("1 to confirm");
    await page.getByRole("tab", { name: /^Paid/ }).click();
    await expect(page.locator("main li").filter({ hasText: "Asha Rao" }).filter({ hasText: "Paid" })).toBeVisible();
  });

  test("Undo from the banner takes the payment back", async ({ page }) => {
    const { pay, dues } = await board(page, {}, standard);
    await page.goto("/en/claims/");
    await confirmBtn(page, "Asha Rao").click();
    await banner(page).getByRole("button", { name: "Undo" }).click();
    await expect(banner(page)).toContainText("Payment undone");
    expect(pay.payments[0].voided_at).not.toBeNull();
    expect(dueOf(dues, S.asha, "2026-10-01").amount_paid).toBe(0);
  });

  test("a claim that covered two fees makes two payments with consecutive receipts, and one Undo takes both back", async ({ page }) => {
    const { pay, dues } = await board(page, {}, standard);
    await page.goto("/en/claims/");
    await confirmBtn(page, "Ravi Kumar").click();
    await expect(card(page, "Ravi Kumar")).toHaveCount(0);
    expect(pay.payments.map((p) => [p.due_id, p.amount, p.receipt_no])).toEqual([
      [dueOf(dues, S.ravi, "2026-09-01").id, 120000, 1],
      [dueOf(dues, S.ravi, "2026-10-01").id, 120000, 2],
    ]);
    await expect(page.locator("section").filter({ hasText: "Earlier" }).getByText("CONFIRMED 12 Oct 2026 · NO. 1 and 1 more")).toBeVisible();
    await expect(banner(page)).toContainText("Ravi Kumar marked paid, ₹2,400");
    // View receipt is the last payment made.
    await expect(banner(page).getByRole("link", { name: "View receipt" })).toHaveAttribute("href", `/en/receipt/?due=${dueOf(dues, S.ravi, "2026-10-01").id}`);
    await banner(page).getByRole("button", { name: "Undo" }).click();
    await expect(banner(page)).toContainText("Payment undone");
    expect(pay.payments.every((p) => p.voided_at !== null)).toBe(true);
    // The claim stays confirmed under Earlier: it is never reopened.
    await expect(page.getByText("CONFIRMED 12 Oct 2026 · NO. 1 and 1 more")).toBeVisible();
  });
});

test.describe("21: Not received", () => {
  test("asks once; Cancel changes nothing; Yes moves it to Earlier and records no payment", async ({ page }) => {
    const { claims, pay, dues } = await board(page, {}, standard);
    await page.goto("/en/claims/");
    const asha = card(page, "Asha Rao");
    const notReceived = asha.getByRole("button", { name: "Not received" });
    expect((await box(notReceived)).height).toBeGreaterThanOrEqual(52);
    await notReceived.click();
    await expect(asha.getByRole("alert")).toHaveText("Not received? Asha Rao's parent will not be told.");
    await asha.getByRole("button", { name: "Cancel" }).click();
    expect(claims.calls("reject_claim")).toHaveLength(0);
    await asha.getByRole("button", { name: "Not received" }).click();
    await asha.getByRole("button", { name: "Yes, not received" }).click();
    await expect(card(page, "Asha Rao")).toHaveCount(0);
    expect(claims.calls("reject_claim")).toEqual([{ p_claim: claims.claims[1].id }]);
    await expect(page.getByText("NOT RECEIVED 12 Oct 2026")).toBeVisible();
    await expect(page.locator("h1")).toHaveText("1 parent says they've paid");
    // No payment, the fee unchanged, and nothing else was called.
    expect(pay.payments).toHaveLength(0);
    expect(claims.calls("confirm_claim")).toHaveLength(0);
    expect(dueOf(dues, S.asha, "2026-10-01").amount_paid).toBe(0);
    expect(pay.requests.filter((r) => r.path.includes("/rpc/")).length).toBe(0);
  });
});

test.describe("22: refusals show a message on the card itself", () => {
  test("only part is open now", async ({ page }) => {
    await board(page, {}, (dues) => [{ student_id: S.imran, due_id: dueOf(dues, S.imran, "2026-10-01").id, amount: 100000 }]);
    await page.goto("/en/claims/");
    await confirmBtn(page, "Imran Ali").click();
    await expect(card(page, "Imran Ali").getByRole("alert")).toHaveText("Only ₹500 is open now. Mark it paid yourself or tap Not received.");
    // The card stays, with both buttons.
    await expect(confirmBtn(page, "Imran Ali")).toBeVisible();
    await expect(card(page, "Imran Ali").getByRole("button", { name: "Not received" })).toBeVisible();
  });

  test("archived: Confirm is off with the reason; Not received still works", async ({ page }) => {
    const { pay } = await board(page, {}, (dues) => [{ student_id: S.old, due_id: dues.dues.find((d) => d.student_id === S.old)!.id, amount: 90000 }]);
    await page.goto("/en/claims/");
    const old = card(page, "Old Student");
    await expect(old.getByRole("button", { name: "Confirm paid" })).toBeDisabled();
    await expect(old.getByText("Old Student is archived. Restore the student to confirm.")).toBeVisible();
    await old.getByRole("button", { name: "Not received" }).click();
    await old.getByRole("button", { name: "Yes, not received" }).click();
    await expect(card(page, "Old Student")).toHaveCount(0);
    expect(pay.payments).toHaveLength(0);
  });

  test("sent over 90 days ago: Confirm is off with the reason", async ({ page }) => {
    await board(page, {}, (dues) => [{ student_id: S.asha, due_id: dueOf(dues, S.asha, "2026-10-01").id, amount: 150000, created_at: "2026-07-01T05:00:00Z" }]);
    await page.goto("/en/claims/");
    await expect(card(page, "Asha Rao").getByRole("button", { name: "Confirm paid" })).toBeDisabled();
    await expect(card(page, "Asha Rao").getByText("This was sent over 90 days ago. Use Mark paid on the fee.")).toBeVisible();
  });
});

test.describe("23: failure and offline", () => {
  test("a failed request says nothing was recorded; Try again reuses the same request id", async ({ page }) => {
    const { claims, pay } = await board(page, {}, standard);
    await page.goto("/en/claims/");
    claims.failNext = true;
    await confirmBtn(page, "Asha Rao").click();
    await expect(card(page, "Asha Rao").getByRole("alert")).toHaveText("Couldn't save. Nothing was recorded. Try again.");
    await confirmBtn(page, "Asha Rao").click();
    await expect(card(page, "Asha Rao")).toHaveCount(0);
    const ids = claims.calls("confirm_claim").map((c) => c.p_request_id);
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe(ids[0]);
    expect(pay.payments).toHaveLength(1);
  });

  test("an answer that was lost: Try again records nothing twice", async ({ page }) => {
    const { claims, pay } = await board(page, {}, standard);
    await page.goto("/en/claims/");
    claims.loseNextResponse = true;
    await confirmBtn(page, "Asha Rao").click();
    await expect(card(page, "Asha Rao").getByRole("alert")).toContainText("Couldn't save");
    expect(pay.payments).toHaveLength(1);
    await confirmBtn(page, "Asha Rao").click();
    await expect(card(page, "Asha Rao")).toHaveCount(0);
    expect(pay.payments).toHaveLength(1);
    expect(claims.calls("confirm_claim")).toHaveLength(2);
  });

  test("offline: R1-7's words, and nothing is sent", async ({ page, context }) => {
    const { claims } = await board(page, {}, standard);
    await page.goto("/en/claims/");
    await expect(card(page, "Asha Rao")).toBeVisible();
    await context.setOffline(true);
    await confirmBtn(page, "Asha Rao").click();
    await expect(card(page, "Asha Rao").getByText("You are offline. Payments need a connection for now. Nothing was saved.")).toBeVisible();
    await card(page, "Asha Rao").getByRole("button", { name: "Not received" }).click();
    await card(page, "Asha Rao").getByRole("button", { name: "Yes, not received" }).click();
    await expect(card(page, "Asha Rao").getByText("You are offline. Payments need a connection for now. Nothing was saved.")).toBeVisible();
    expect(claims.calls("confirm_claim")).toHaveLength(0);
    expect(claims.calls("reject_claim")).toHaveLength(0);
  });
});

test.describe("24: two phones", () => {
  test("the other phone confirmed first: this phone says Already handled and no second payment exists", async ({ page }) => {
    const { claims, pay } = await board(page, {}, standard);
    await page.goto("/en/claims/");
    await expect(card(page, "Asha Rao")).toBeVisible();
    claims.handleElsewhere(claims.claims[1].id, "confirm");
    expect(pay.payments).toHaveLength(1);
    await confirmBtn(page, "Asha Rao").click();
    await expect(card(page, "Asha Rao").getByRole("alert")).toHaveText("Already handled.");
    expect(pay.payments).toHaveLength(1);
    // The list was read again: the heading counts what is still waiting, and the claim is under Earlier.
    await expect(page.locator("h1")).toHaveText("1 parent says they've paid");
    await expect(page.getByText("CONFIRMED 12 Oct 2026 · NO. 1")).toBeVisible();
  });

  test("Mark paid on the other phone first: Confirm is refused, never double-recorded", async ({ page }) => {
    const { pay, dues } = await board(page, {}, standard);
    await page.goto("/en/claims/");
    await expect(card(page, "Asha Rao")).toBeVisible();
    pay.payElsewhere(dueOf(dues, S.asha, "2026-10-01").id, 150000);
    await confirmBtn(page, "Asha Rao").click();
    await expect(card(page, "Asha Rao").getByRole("alert")).toContainText("Only ₹0 is open now");
    expect(pay.payments).toHaveLength(1);
  });
});

test.describe("25, 26: Earlier and the empty inbox", () => {
  test("nothing waiting: says so, and still lists Earlier, 56px rows at least", async ({ page }) => {
    await board(page, {}, (dues) => [
      { student_id: S.ravi, due_id: dueOf(dues, S.ravi, "2026-10-01").id, amount: 120000, status: "confirmed", handled_at: "2026-10-06T06:00:00Z", confirm_request_id: "00000000-0000-4000-8000-0000000000f1", confirmed_receipt_from: 214, confirmed_receipt_count: 1 },
      { student_id: S.asha, due_id: dueOf(dues, S.asha, "2026-10-01").id, amount: 100000, status: "rejected", handled_at: "2026-10-02T06:00:00Z" },
    ]);
    await page.goto("/en/home/");
    await expect(page.locator("h1")).toHaveText("Still to come in");
    await expect(chip(page)).toHaveCount(0);
    await page.goto("/en/claims/");
    await expect(page.locator("h1")).toHaveText("Nothing to confirm right now.");
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.getByText("CONFIRMED 06 Oct 2026 · NO. 214")).toBeVisible();
    await expect(page.getByText("NOT RECEIVED 02 Oct 2026")).toBeVisible();
    for (const row of await page.locator("section li").all()) expect((await box(row)).height).toBeGreaterThanOrEqual(56);
  });

  test("Earlier holds the last 20 handled claims, newest first", async ({ page }) => {
    await board(page, {}, (dues) =>
      Array.from({ length: 23 }, (_, i) => ({
        student_id: S.ravi,
        due_id: dueOf(dues, S.ravi, "2026-10-01").id,
        amount: 100 * (i + 1) * 100,
        upi_ref: String(100000000000 + i),
        status: "rejected" as const,
        handled_at: `2026-09-${String(i + 1).padStart(2, "0")}T06:00:00Z`,
      })),
    );
    await page.goto("/en/claims/");
    await expect(page.locator("section li")).toHaveCount(20);
    await expect(page.locator("section li").first()).toContainText("NOT RECEIVED 23 Sep 2026");
  });
});

test.describe("section 17: Already owes while a claim waits on the earlier balance", () => {
  test("the field is read-only with the claim's line, and opens again after Not received", async ({ page }) => {
    const { claims } = await board(page, {}, (dues) => [
      { student_id: S.meena, due_id: dues.dues.find((d) => d.student_id === S.meena && d.kind === "opening")!.id, amount: 240000, created_at: "2026-10-06T05:00:00Z" },
    ]);
    await page.goto(`/en/students/edit/?id=${S.meena}`);
    const owes = page.getByLabel("Already owes ₹");
    await expect(page.getByText("A parent says this is paid, so it can't be changed. Open \u201cto confirm\u201d on Home, then tap Confirm paid or Not received.")).toBeVisible();
    await expect(owes).toHaveJSProperty("readOnly", true);
    await expect(page.getByText("A payment has been recorded against this, so it can't be changed")).toHaveCount(0);
    expect(claims.reads().some((r) => r.query.includes("due_id=eq.") && r.query.includes("status=eq.pending"))).toBe(true);

    claims.handleElsewhere(claims.claims[0].id, "reject");
    await page.reload();
    await expect(page.getByText("A parent says this is paid", { exact: false })).toHaveCount(0);
    await expect(owes).toHaveJSProperty("readOnly", false);
    expect(claims.writes()).toEqual([]);
  });
});

test.describe("26: an 80-character name and a claim for ₹10,00,000", () => {
  test("wrap and fit: no sideways scroll, nothing cut", async ({ page }) => {
    const LONG = "A".repeat(80);
    const ID = "00000000-0000-4000-8000-0000000000c9";
    await board(
      page,
      { students: [{ id: ID, name: LONG, monthly_fee: 120000, due_day: 5 }, { id: S.asha, name: "Asha Rao", monthly_fee: 100000, due_day: 1 }], dues: [{ student_id: ID, due_date: "2026-10-05", amount: 100000000 }, { student_id: S.asha, due_date: "2026-10-01", amount: 100000 }], batches: [] },
      (dues) => [{ student_id: ID, due_id: dues.dues.find((d) => d.student_id === ID)!.id, amount: 100000000 }],
    );
    await page.goto("/en/claims/");
    const c = card(page, LONG);
    await expect(c.getByText("₹10,00,000")).toBeVisible();
    await expect(c.getByRole("button", { name: "Confirm paid" })).toBeInViewport({ ratio: 0.1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    // The amount fits its box: not wider than the card.
    const amount = await c.getByText("₹10,00,000").evaluate((el) => ({ w: el.scrollWidth, c: el.clientWidth }));
    expect(amount.w).toBeLessThanOrEqual(amount.c + 1);
    // Digits are 0 to 9.
    expect(await c.textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
  });
});

test.describe("27: what the app asks of the database", () => {
  test("named columns only, no write to the table or to payments, and only the two hosts", async ({ page }) => {
    const others = watchOtherHosts(page, ORIGIN);
    const { claims, pay } = await board(page, {}, standard);
    await page.goto("/en/home/");
    await chip(page).click();
    await expect(page.getByRole("article")).toHaveCount(2);
    await confirmBtn(page, "Asha Rao").click();
    await expect(card(page, "Asha Rao")).toHaveCount(0);
    await card(page, "Ravi Kumar").getByRole("button", { name: "Not received" }).click();
    await card(page, "Ravi Kumar").getByRole("button", { name: "Yes, not received" }).click();
    await expect(card(page, "Ravi Kumar")).toHaveCount(0);
    const reads = claims.reads().filter((r) => r.method === "GET");
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) {
      const select = new URL(`${HOST}${read.path}${read.query}`).searchParams.get("select") ?? "";
      expect(select).not.toBe("*");
      expect(select).not.toContain("tutor_id");
      expect(select).not.toContain("confirm_request_id");
    }
    expect(claims.writes()).toEqual([]);
    expect(pay.writes()).toEqual([]);
    expect(others).toEqual([]);
  });
});
