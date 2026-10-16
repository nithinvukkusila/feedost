// Spec R1-8: Remind on the board, the Remind screen (one and many), the pick list, the log, and privacy, at
// 360px against the fake host (remind-helpers.ts). The clock is fixed at 2026-10-12 05:00 UTC (10:30 in India).
import { expect, test, type Page } from "@playwright/test";
import { completeTutor, HOST, watchOtherHosts } from "./auth-helpers";
import { NOW, signedIn } from "./board-fixture";
import { box, langs, sidewaysScroll, textProblems } from "./helpers";
import type { Reminders } from "./remind-helpers";
import type { Dues } from "./dues-helpers";
import type { Roster } from "./roster-helpers";

const ORIGIN = process.env.E2E_BASE_URL ?? "http://localhost:4173";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const MATHS = id(0xb1);
const R = id(0xd1); // Ravi: phone, Hindi parent with a name
const A = id(0xd2); // Asha: phone, English parent with no name
const M = id(0xd3); // Meena: no phone
const I = id(0xd4); // Imran: phone, part paid
const PHONE_R = "+919876543210";
const PHONE_A = "+918765432109";

const STUDENTS = [
  { id: R, name: "Ravi Kumar", batch_id: MATHS, monthly_fee: 120000, due_day: 5, parent_name: "Kavitha Shetty", parent_phone: PHONE_R, parent_language: "hi" },
  { id: A, name: "Asha Rao", monthly_fee: 150000, due_day: 12, parent_phone: PHONE_A, parent_language: "en" },
  { id: M, name: "Meena Shetty", monthly_fee: 100000, due_day: 20 },
  { id: I, name: "Imran Ali", monthly_fee: 100000, due_day: 7, parent_name: "Salma Ali", parent_phone: "+917654321098", parent_language: "te" },
];
const DUES = [
  { student_id: R, due_date: "2026-10-05", amount: 120000 },
  { student_id: A, due_date: "2026-10-12", amount: 150000 },
  { student_id: M, due_date: "2026-10-20", amount: 100000 },
  { student_id: I, due_date: "2026-10-07", amount: 100000, amount_paid: 50000, status: "partial" as const },
  { student_id: M, kind: "opening" as const, month: null, amount: 240000, due_date: "2026-09-30" },
];

type Ctx = { dues: Dues; roster: Roster; rem: Reminders };
async function setup(page: Page, seed: Parameters<typeof signedIn>[1] = {}, tutor?: Parameters<typeof completeTutor>[0]): Promise<Ctx> {
  const { dues, roster, stub, rem } = await signedIn(page, { students: STUDENTS, batches: [{ id: MATHS, name: "Class 10 Maths" }], dues: DUES, ...seed });
  if (tutor) stub.tutor = completeTutor(tutor);
  // WhatsApp itself is not reached from a test: its address answers with an empty page.
  await page.context().route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>x</title>" }));
  return { dues, roster, rem };
}
const dueOf = (dues: Dues, student: string, month: string | null = "2026-10-01") => dues.dues.find((d) => d.student_id === student && d.month === month)!;
const row = (page: Page, name: string) => page.locator("main li").filter({ hasText: name });
const remindBtn = (page: Page, name: string) => page.getByRole("button", { name: `Remind ${name}` });
const openLink = (page: Page) => page.getByRole("link", { name: "Open WhatsApp" });
const hidden = (page: Page) => page.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
});
const visible = (page: Page) => page.evaluate(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
});
const messageText = (page: Page) => page.getByRole("group", { name: "The message" }).innerText();

async function openLinkTapped(page: Page) {
  const [popup] = await Promise.all([page.context().waitForEvent("page"), openLink(page).click()]);
  await popup.close();
}

test.describe("2 to 4: the board's buttons", () => {
  test("Remind, Add number, nothing on a paid row", async ({ page }) => {
    await setup(page);
    await page.goto("/en/home/");
    await expect(remindBtn(page, "Ravi Kumar")).toBeVisible();
    expect((await box(remindBtn(page, "Ravi Kumar"))).height).toBeGreaterThanOrEqual(44);
    await expect(remindBtn(page, "Imran Ali")).toBeVisible();
    // Meena's earlier balance has no phone.
    const add = page.getByRole("link", { name: "Add number for Meena Shetty" });
    await expect(add).toBeVisible();
    await expect(add).toHaveAttribute("href", /\/en\/students\/edit\/\?id=/);
    await page.getByRole("tab", { name: /^Paid/ }).click();
    await expect(page.getByRole("button", { name: /^Remind/ })).toHaveCount(0);
    await expect(page.getByText("Add number")).toHaveCount(0);
  });

  test("no UPI ID: every Remind is Add your UPI ID, one line says why, and nothing opens WhatsApp", async ({ page }) => {
    // A tutor with no UPI ID at all is sent to setup; one whose saved ID is not a valid one still reaches the board.
    await setup(page, {}, { upi_id: "not a upi id" });
    await page.goto("/en/home/");
    await expect(page.getByText("Reminders carry your UPI ID so parents can pay. Add it first.")).toHaveCount(1);
    await expect(page.getByRole("button", { name: /^Remind/ })).toHaveCount(0);
    const link = page.getByRole("link", { name: "Add your UPI ID" }).first();
    await expect(link).toHaveAttribute("href", "/en/setup/upi/");
    await expect(page.getByRole("button", { name: "Remind all overdue (1)" })).toHaveCount(0);
  });
});

test.describe("13 to 19, 24, 31: one reminder", () => {
  test("the screen, the tone, the link, the log and the return", async ({ page }) => {
    const others = watchOtherHosts(page, ORIGIN);
    const { dues, rem, roster } = await setup(page);
    await page.goto("/en/home/");
    await remindBtn(page, "Ravi Kumar").click();
    await expect(page).toHaveURL(/\/en\/remind\/$/);
    expect(page.url()).not.toMatch(/Ravi|Kavitha|9876|\?|#/);
    await expect(page.getByText("Reminder 1 of 1")).toBeVisible();
    await expect(page.getByText("To Kavitha Shetty · हिन्दी")).toBeVisible();
    await expect(page.getByText("October · 7 days late")).toBeVisible();
    await expect(page.getByText("₹1,200", { exact: true }).first()).toBeVisible();
    // One reminder has no Skip and no Up next.
    await expect(page.getByRole("button", { name: "Skip" })).toHaveCount(0);
    await expect(page.getByText("Up next")).toHaveCount(0);
    // The parent's phone is on the screen only inside the link.
    await expect(page.locator("main")).not.toContainText("9876");

    const bubble = page.locator("main [lang=hi]");
    await expect(bubble).toHaveAttribute("translate", "no");
    await expect(bubble).toContainText("Kavitha Shetty");
    const link = openLink(page);
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    const polite = await link.getAttribute("href");
    expect(polite).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/);
    expect(decodeURIComponent(polite!.split("?text=")[1])).toBe((await messageText(page)).replace(/\n$/, ""));
    // R1-9: the message carries the pay page's link, not the raw UPI link; the UPI ID line stays.
    const sent = decodeURIComponent(polite!.split("?text=")[1]);
    const ravi = roster.students.find((student) => student.id === R)!;
    expect(sent).toContain(`https://feedost.vercel.app/p/${ravi.pay_token}`);
    expect(sent).not.toContain("upi://");
    expect(sent).toContain("@");

    // Polite to Firm: the message and the link change, and nothing is asked of the network.
    const before = rem.requests.length;
    await page.getByRole("radio", { name: "Firm" }).check({ force: true });
    expect(await link.getAttribute("href")).not.toBe(polite);
    expect(rem.requests.length).toBe(before);

    await openLinkTapped(page);
    await expect(page.getByText("Opened for Ravi Kumar's parent")).toBeVisible();
    await expect(page.getByText("WhatsApp only opens the message. You press send there.")).toBeVisible();
    await expect(page.getByText(/\bSent\b/)).toHaveCount(0);
    await expect.poll(() => rem.calls().length).toBe(1);
    const call = rem.calls()[0];
    expect(Object.keys(call).sort()).toEqual(["p_due", "p_request_id", "p_template"]);
    expect(call.p_due).toBe(dueOf(dues, R).id);
    expect(call.p_template).toBe("firm:hi:month");
    // The pay token is read for the message only: it is not in the log call.
    expect(JSON.stringify(rem.requests.map((r) => [r.path, r.body]))).not.toContain(ravi.pay_token);

    // Back from WhatsApp: the page was hidden, then it is visible.
    await hidden(page);
    await visible(page);
    await visible(page);
    await expect(page.getByText("1 parent opened, 0 skipped.")).toBeVisible();
    await expect(page.getByText(/\bsent\b/i)).toHaveCount(0);
    await page.getByRole("button", { name: "Back to home" }).click();
    await expect(page).toHaveURL(/\/en\/home\/$/);
    await expect(row(page, "Ravi Kumar").getByText("Reminded today")).toBeVisible();
    expect(others).toEqual([]);
  });

  test("a second tap on the Next-less path: the same step's request id is reused for a double tap", async ({ page }) => {
    const { rem } = await setup(page);
    await page.goto("/en/home/");
    await page.getByRole("tab", { name: /^Due/ }).click();
    await remindBtn(page, "Asha Rao").click();
    await expect(page.getByText("To the parent of Asha Rao")).toBeVisible();
    const [p1] = await Promise.all([page.context().waitForEvent("page"), openLink(page).click()]);
    await p1.close();
    const [p2] = await Promise.all([page.context().waitForEvent("page"), openLink(page).click()]);
    await p2.close();
    await expect.poll(() => rem.calls().length).toBe(1);
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("1 parent opened, 0 skipped.")).toBeVisible();
  });

  test("opening the address directly with nothing queued goes home", async ({ page }) => {
    await setup(page);
    await page.goto("/en/remind/");
    await expect(page).toHaveURL(/\/en\/home\/$/);
  });

  test("Stop goes home and logs nothing", async ({ page }) => {
    const { rem } = await setup(page);
    await page.goto("/en/home/");
    await remindBtn(page, "Ravi Kumar").click();
    await page.getByRole("button", { name: "Stop" }).click();
    await expect(page).toHaveURL(/\/en\/home\/$/);
    expect(rem.calls()).toEqual([]);
  });
});

test.describe("26: Remind again?", () => {
  test("asks first, Not now changes nothing, Remind again opens the screen", async ({ page }) => {
    const { dues, rem } = await setup(page);
    rem.seed(dueOf(dues, R).id, "2026-10-12T03:30:00.000Z");
    await page.goto("/en/home/");
    await expect(row(page, "Ravi Kumar").getByText("Reminded today")).toBeVisible();
    await remindBtn(page, "Ravi Kumar").click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("You reminded Kavitha Shetty today at 9:00 am. Remind again?");
    await expect(openLink(page)).toHaveCount(0);
    await dialog.getByRole("button", { name: "Not now" }).first().click();
    await expect(page).toHaveURL(/\/en\/home\/$/);
    expect(rem.calls()).toEqual([]);
    await remindBtn(page, "Ravi Kumar").click();
    await page.getByRole("dialog").getByRole("button", { name: "Remind again" }).click();
    await expect(openLink(page)).toBeVisible();
  });
});

test.describe("21 to 23: Remind all overdue", () => {
  test("pick, defaults, cannot group, start, skip, next, summary", async ({ page }) => {
    const { dues, rem } = await setup(page);
    // Asha's fee is due today (not overdue); add an overdue one for her, and remind Ravi today.
    dues.addDue({ student_id: A, month: "2026-09-01", due_date: "2026-09-12", amount: 150000 });
    rem.seed(dueOf(dues, R).id, "2026-10-12T03:30:00.000Z");
    await page.goto("/en/home/");
    const all = page.getByRole("button", { name: "Remind all overdue (3)" });
    await expect(all).toBeVisible();
    await all.click();
    await expect(page).toHaveURL(/\/en\/remind\/$/);
    await expect(page.getByRole("heading", { name: "Who to remind" })).toBeVisible();
    const check = (name: string) => page.getByRole("checkbox", { name: new RegExp(name) });
    await expect(check("Ravi Kumar")).not.toBeChecked();
    await expect(page.getByText("Reminded today")).toBeVisible();
    await expect(check("Asha Rao")).toBeChecked();
    await expect(check("Imran Ali")).toBeChecked();
    await expect(page.getByText("Selected").first()).toBeVisible();
    await page.getByText("Cannot remind (1)").click();
    await expect(page.getByText("No phone number")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remind 2 parents" })).toBeVisible();
    await check("Asha Rao").uncheck();
    await check("Imran Ali").uncheck();
    const start = page.getByRole("button", { name: "Remind 0 parents" });
    await expect(start).toBeDisabled();
    await expect(page.getByText("Select at least one parent to start.")).toBeVisible();
    await check("Asha Rao").check();
    await check("Imran Ali").check();
    await page.getByRole("button", { name: "Remind 2 parents" }).click();

    await expect(page.getByText("Reminder 1 of 2")).toBeVisible();
    await expect(page.getByText("Up next")).toBeVisible();
    // Skip logs nothing.
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByText("Reminder 2 of 2")).toBeVisible();
    expect(rem.calls()).toEqual([]);
    await openLinkTapped(page);
    await expect(page.getByText(/Opened for .* parent/)).toBeVisible();
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("1 parent opened, 1 skipped.")).toBeVisible();
    await expect.poll(() => rem.calls().length).toBe(1);
  });

  test("a soft note above 20, and it does not block", async ({ page }) => {
    const students = Array.from({ length: 21 }, (_, n) => ({ id: id(0xf000 + n), name: `Student ${String(n).padStart(2, "0")}`, monthly_fee: 100000, due_day: 1, parent_phone: PHONE_A, parent_language: "en" }));
    await setup(page, { students, dues: students.map((s) => ({ student_id: s.id, due_date: "2026-10-01", amount: 100000 })) });
    await page.goto("/en/home/");
    await page.getByRole("button", { name: "Remind all overdue (21)" }).click();
    const note = "That is a lot at once. WhatsApp can limit numbers that message many people. Do 20 now and the rest later if you like.";
    await expect(page.getByText(note)).toBeVisible();
    await page.getByRole("checkbox", { name: /Student 00/ }).uncheck();
    await expect(page.getByText(note)).toHaveCount(0);
    await page.getByRole("checkbox", { name: /Student 00/ }).check();
    await page.getByRole("button", { name: "Remind 21 parents" }).click();
    await expect(page.getByText("Reminder 1 of 21")).toBeVisible();
  });
});

test.describe("28: offline and a failed log", () => {
  test("WhatsApp still opens, the step says it will try again, and the same request id goes again with one mark", async ({ page }) => {
    const { rem } = await setup(page);
    await page.goto("/en/home/");
    await remindBtn(page, "Ravi Kumar").click();
    rem.failRecord = true;
    await openLinkTapped(page);
    await expect(page.getByText("Couldn't save that you reminded them. We'll try again.")).toBeVisible();
    await expect.poll(() => rem.calls().length).toBe(1);
    rem.failRecord = false;
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => rem.calls().length).toBe(2);
    const [a, b] = rem.calls();
    expect(a.p_request_id).toBe(b.p_request_id);
    expect(rem.rows).toHaveLength(1);
    await expect(page.getByText("Couldn't save that you reminded them. We'll try again.")).toHaveCount(0);
  });

  test("a lost response gives one row", async ({ page }) => {
    const { rem } = await setup(page);
    await page.goto("/en/home/");
    await remindBtn(page, "Ravi Kumar").click();
    rem.loseNextResponse = true;
    await openLinkTapped(page);
    await expect.poll(() => rem.calls().length).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => rem.calls().length).toBe(2);
    expect(rem.rows).toHaveLength(1);
  });
});

test.describe("29: the marks", () => {
  test("they survive a reload, and a failed read shows no marks and no banner", async ({ page }) => {
    const { dues, rem } = await setup(page);
    rem.seed(dueOf(dues, R).id, "2026-10-11T03:30:00.000Z");
    await page.goto("/en/home/");
    await expect(row(page, "Ravi Kumar").getByText("Reminded yesterday")).toBeVisible();
    await page.reload();
    await expect(row(page, "Ravi Kumar").getByText("Reminded yesterday")).toBeVisible();
    rem.failRead = true;
    await page.reload();
    await expect(remindBtn(page, "Ravi Kumar")).toBeVisible();
    await expect(page.getByText(/Reminded/)).toHaveCount(0);
    await expect(page.locator("[data-kind=error]")).toHaveCount(0);
  });
});

test.describe("31: privacy", () => {
  test("no name, phone or message in an address, a title, storage, a cookie or a request to our hosts", async ({ page }) => {
    const others = watchOtherHosts(page, ORIGIN);
    const urls: string[] = [];
    page.on("request", (r) => urls.push(r.url()));
    const { rem } = await setup(page);
    await page.goto("/en/home/");
    await remindBtn(page, "Ravi Kumar").click();
    await expect(openLink(page)).toBeVisible();
    await openLinkTapped(page);
    await expect.poll(() => rem.calls().length).toBe(1);
    const secrets = ["Kavitha", "Shetty", "Ravi", "9876543210", "Kumar"];
    const ours = urls.filter((u) => !u.startsWith("https://wa.me/"));
    for (const word of secrets) {
      for (const u of ours) expect(decodeURIComponent(u), u).not.toContain(word);
      expect(page.url()).not.toContain(word);
      expect(await page.title()).not.toContain(word);
    }
    for (const call of rem.requests) expect(call.body ?? "").not.toMatch(/Kavitha|Ravi|9876|मेरा|₹/);
    const stored = await page.evaluate(() => JSON.stringify({ l: { ...localStorage }, s: { ...sessionStorage }, c: document.cookie }));
    for (const word of secrets) expect(stored).not.toContain(word);
    expect(await page.evaluate(() => document.cookie)).toBe("");
    expect(others.filter((u) => !u.startsWith("https://wa.me/"))).toEqual([]);
    void HOST;
  });
});

test.describe("20: layout", () => {
  for (const lang of langs) {
    test(`the screen in ${lang} at 360px and large text, with a long name and ₹10,00,000`, async ({ page }) => {
      test.setTimeout(90_000);
      const long = "A".repeat(80);
      await setup(page, {
        lang,
        students: [
          { id: R, name: long, batch_id: MATHS, monthly_fee: 100000000, due_day: 5, parent_name: "Kavitha Shetty", parent_phone: PHONE_R, parent_language: "te" },
          { id: A, name: "Zed", monthly_fee: 100000, due_day: 1, parent_phone: PHONE_A },
        ],
        batches: [{ id: MATHS, name: "Class 10 Maths and Science combined evening batch, Mon to Fri" }],
        dues: [
          { student_id: R, due_date: "2026-10-05", amount: 100000000 },
          { student_id: A, due_date: "2026-10-01", amount: 100000 },
        ],
      });
      await page.goto(`/${lang}/home/`);
      await page.locator(`main li:has(a[href*="${R}"]) button`).first().click();
      await page.getByRole("link", { name: /WhatsApp/ }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      for (const size of ["100%", "130%", "200%"]) {
        await page.evaluate((value) => document.documentElement.style.setProperty("font-size", value), size);
        expect(await sidewaysScroll(page), `sideways scroll at ${size}`).toBe(0);
        for (const el of await page.locator("main a:visible, main button:visible").all()) {
          expect((await box(el)).height, `a control at ${size}`).toBeGreaterThanOrEqual(44);
        }
        if (size === "100%") expect(await textProblems(page, "main")).toEqual([]);
      }
      const link = page.getByRole("link", { name: /WhatsApp/ });
      await link.scrollIntoViewIfNeeded();
      await expect(link).toBeInViewport({ ratio: 1 });
      expect(await page.locator("main").textContent()).not.toMatch(/[०-९౦-౯೦-೯]/);
    });
  }
});
void NOW;

test.describe("R1-9 criteria 45 to 47: the pay-page link in the message", () => {
  test("the token is read once, after the Remind screen opens, and the preview shows the pay page link", async ({ page }) => {
    const { roster } = await setup(page);
    await page.goto("/en/home/");
    const reads = () => roster.requests.filter((r) => r.method === "GET" && r.query.includes("pay_token"));
    expect(reads()).toHaveLength(0);
    await remindBtn(page, "Ravi Kumar").click();
    const ravi = roster.students.find((student) => student.id === R)!;
    await expect(page.locator('[data-slot="link"]')).toHaveText(`https://feedost.vercel.app/p/${ravi.pay_token}`);
    expect(reads()).toHaveLength(1);
    expect(reads()[0].query).toContain("select=id%2Cpay_token");
    await expect(page.getByText("Or pay to UPI ID").or(page.locator('[data-slot="upiId"]')).first()).toBeVisible();
    const href = await openLink(page).getAttribute("href");
    expect(decodeURIComponent(href!.split("?text=")[1])).toBe((await messageText(page)).replace(/\n$/, ""));
  });

  test("when the read fails the message carries the raw UPI link and nothing breaks", async ({ page }) => {
    const { rem } = await setup(page);
    await page.route(
      (url) => url.origin === HOST && url.pathname === "/rest/v1/students" && url.search.includes("pay_token"),
      (route) => route.fulfill({ status: 500, body: "{}", contentType: "application/json", headers: { "access-control-allow-origin": route.request().headers()["origin"] ?? "*" } }),
    );
    await page.goto("/en/home/");
    await remindBtn(page, "Ravi Kumar").click();
    await expect(page.locator('[data-slot="link"]')).toContainText("upi://pay?");
    await expect(openLink(page)).toBeVisible();
    await openLinkTapped(page);
    await expect.poll(() => rem.calls().length).toBe(1);
  });
});
