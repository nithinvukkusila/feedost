// R0-4: the waitlist form on the landing page, with the waitlist-join function stubbed by page.route.
// Nothing here talks to a real database. The real function is covered by waitlist-staging.spec.ts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { fontsSettled, indicLangs, langs, sidewaysScroll, slow4G, type Lang } from "./helpers";
import { largestText, shown } from "./landing-helpers";

const FUNCTION = "**/functions/v1/waitlist-join";
const ROOT = join(__dirname, "..");

type Sent = { method: string; url: string; body: Record<string, unknown> };

/** Per-language values a tutor would type: the name in the language's own script, the number in its own digits. */
const typed: Record<Lang, { name: string; phone: string; city: string; students: string; storedPhone: string }> = {
  en: { name: "Asha Rao", phone: "98765 43210", city: "Mysuru", students: "10", storedPhone: "+919876543210" },
  hi: { name: "आशा शर्मा", phone: "९८७६५ ४३२१०", city: "जयपुर", students: "30", storedPhone: "+919876543210" },
  kn: { name: "ಆಶಾ ರಾವ್", phone: "೯೮೭೬೫ ೪೩೨೧೦", city: "ಮೈಸೂರು", students: "0", storedPhone: "+919876543210" },
  te: { name: "ఆశా రెడ్డి", phone: "౯౮౭౬౫ ౪౩౨౧౦", city: "హైదరాబాద్", students: "60", storedPhone: "+919876543210" },
};

const section = (page: Page) => page.locator("section#waitlist");
const form = (page: Page) => section(page).locator("form");
const word = (lang: Lang, key: string) => shown(lang, `waitlistForm.${key}`);

// By position, not by label: a field in the needs-fixing state changes its accessible name, and the order is itself criterion 5.
const CONTROLS = { name: "textarea >> nth=0", phone: "input[type=tel]", city: "textarea >> nth=1", students: "select" } as const;
function control(page: Page, _lang: Lang, which: keyof typeof CONTROLS): Locator {
  return form(page).locator(CONTROLS[which]);
}
const submitButton = (page: Page) => form(page).locator("button[type=submit]");

async function openForm(page: Page, lang: Lang): Promise<void> {
  await page.goto(`/${lang}/`);
  await fontsSettled(page);
  await expect(form(page)).toHaveCount(1);
}

async function fillAll(page: Page, lang: Lang, values = typed[lang]): Promise<void> {
  await control(page, lang, "name").fill(values.name);
  await control(page, lang, "phone").fill(values.phone);
  await control(page, lang, "city").fill(values.city);
  await control(page, lang, "students").selectOption(values.students);
}

type Answer = { status: number; body: unknown } | "abort" | "never" | { status: number; body: unknown; delayMs: number };

/** Stubs the function. Returns the list of requests it received. */
async function stub(page: Page, answer: Answer): Promise<Sent[]> {
  const sent: Sent[] = [];
  await page.route(FUNCTION, async (route: Route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" },
      });
      return;
    }
    sent.push({ method: request.method(), url: request.url(), body: JSON.parse(request.postData() ?? "{}") });
    if (answer === "abort") return route.abort("connectionfailed");
    if (answer === "never") return; // the request hangs
    if ("delayMs" in answer) await new Promise((r) => setTimeout(r, answer.delayMs));
    await route.fulfill({
      status: answer.status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify(answer.body),
    });
  });
  return sent;
}

const OK: Answer = { status: 200, body: { code: "ok" } };

test.describe("the form: fields, sizes, labels (criteria 4, 5, 9, 10, 18)", () => {
  test("criteria 5, 9, 10 [en]: fields in canvas order, attributes, sizes, consent above the button, no checkbox, honeypot hidden, nothing focused", async ({ page }) => {
    await openForm(page, "en");
    // Order: name, phone, city, students, then the consent line, then the button.
    const order = await form(page).evaluate((f) => {
      const items = [...f.querySelectorAll("textarea, input, select, button")].filter((e) => !(e.closest('[aria-hidden="true"]')));
      return items.map((e) => `${e.tagName.toLowerCase()}:${e.getAttribute("autocomplete") ?? e.getAttribute("type") ?? ""}`);
    });
    expect(order).toEqual(["textarea:name", "input:tel", "textarea:address-level2", "select:", "button:submit"]);
    const labels = await form(page).locator("label").allTextContents();
    expect(labels.map((l) => l.trim())).toEqual([
      word("en", "name.label"),
      word("en", "phone.label"),
      word("en", "city.label"),
      word("en", "students.label"),
    ]);
    // Phone: tel keyboard and autofill.
    const phone = control(page, "en", "phone");
    await expect(phone).toHaveAttribute("inputmode", "tel");
    await expect(phone).toHaveAttribute("autocomplete", "tel");
    await expect(phone).toHaveAttribute("placeholder", "+91");
    // Select: native, four bands, first option "Choose how many", none chosen.
    const select = control(page, "en", "students");
    expect(await select.evaluate((s) => s.tagName)).toBe("SELECT");
    expect(await select.locator("option").allTextContents()).toEqual([
      word("en", "students.choose"),
      word("en", "students.under10"),
      word("en", "students.from10"),
      word("en", "students.from30"),
      word("en", "students.over60"),
    ]);
    expect(await select.locator("option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value))).toEqual(["", "0", "10", "30", "60"]);
    await expect(select).toHaveValue("");
    // Empty at the start; no autofocus.
    for (const which of ["name", "phone", "city"] as const) await expect(control(page, "en", which)).toHaveValue("");
    expect(await page.evaluate(() => document.activeElement?.tagName)).toBe("BODY");
    // Sizes: every control 44px or more, text 14px or more, button 56px or more and full width.
    for (const which of ["name", "phone", "city", "students"] as const) {
      const box = await control(page, "en", which).boundingBox();
      expect(box!.height, which).toBeGreaterThanOrEqual(44);
      const size = await control(page, "en", which).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(size, which).toBeGreaterThanOrEqual(14);
    }
    const button = await submitButton(page).boundingBox();
    expect(button!.height).toBeGreaterThanOrEqual(56);
    const room = await submitButton(page).evaluate((b) => {
      const p = b.parentElement as HTMLElement;
      const s = getComputedStyle(p);
      return p.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    });
    expect(Math.abs(button!.width - room)).toBeLessThanOrEqual(1);
    // The consent line: exact words, visible, directly above the button, no checkbox anywhere.
    const consent = form(page).getByText(word("en", "consent"), { exact: true });
    await expect(consent).toBeVisible();
    expect(word("en", "consent")).toBe("We will use your number only to message you on WhatsApp when the app opens. Nothing is sold or shared.");
    const consentBox = await consent.boundingBox();
    const buttonBox = await submitButton(page).boundingBox();
    expect(consentBox!.y + consentBox!.height).toBeLessThanOrEqual(buttonBox!.y);
    expect(buttonBox!.y - (consentBox!.y + consentBox!.height)).toBeLessThanOrEqual(40);
    await expect(form(page).locator('input[type="checkbox"], [role="checkbox"], a')).toHaveCount(0);
    // Honeypot: aria-hidden, out of the tab order, not announced.
    const trap = form(page).locator('input[name="website"]');
    await expect(trap).toHaveCount(1);
    await expect(trap).toHaveAttribute("tabindex", "-1");
    expect(await trap.evaluate((e) => e.closest('[aria-hidden="true"]') !== null)).toBe(true);
    await expect(trap).toHaveValue("");
    // Tabbing through the whole form never lands on it.
    await control(page, "en", "name").focus();
    const visited: string[] = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      visited.push(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name || document.activeElement?.tagName || ""));
    }
    expect(visited).not.toContain("website");
  });

  test("criterion 5 [en]: the phone field is type=tel (spec wording)", async ({ page }) => {
    await openForm(page, "en");
    await expect(control(page, "en", "phone")).toHaveAttribute("type", "tel");
  });

  test("criterion 18 [en]: every typed field is masked from PostHog and Sentry", async ({ page }) => {
    await openForm(page, "en");
    for (const which of ["name", "phone", "city", "students"] as const) {
      const el = control(page, "en", which);
      await expect(el, which).toHaveAttribute("data-ph-no-capture", "");
      await expect(el, which).toHaveAttribute("data-sentry-mask", "");
    }
  });

  test("criterion 4: the old placeholder words are gone from all four message files and from src", async () => {
    for (const lang of langs) {
      const tree = JSON.parse(readFileSync(join(ROOT, "messages", `${lang}.json`), "utf8")) as { landing: { waitlist: Record<string, string> } };
      expect(Object.keys(tree.landing.waitlist).sort(), lang).toEqual(["body", "title"]);
    }
    const slot = readFileSync(join(ROOT, "src/components/landing/waitlist-slot.tsx"), "utf8");
    expect(slot).not.toMatch(/waitlist\.(soon|reason|button)/);
  });
});

test.describe("errors (criterion 8)", () => {
  for (const lang of langs) {
    test(`criterion 8 [${lang}]: empty submit shows a word, a mark and a sentence on every field, focuses the first, sends nothing`, async ({ page }) => {
      const sent = await stub(page, OK);
      await openForm(page, lang);
      await submitButton(page).click();
      const f = form(page);
      for (const which of ["name", "phone", "city", "students"] as const) {
        await expect(f.getByText(word(lang, `${which}.missing.word`), { exact: true }).first()).toBeVisible();
        await expect(f.getByText(word(lang, `${which}.missing.fix`))).toBeVisible();
      }
      // A mark as well as colour: each error carries an svg.
      expect(await f.locator("svg").count()).toBeGreaterThanOrEqual(4);
      await expect(control(page, lang, "name")).toBeFocused();
      expect(sent).toEqual([]);
    });
  }

  test("criterion 8 [en]: blur shows the error, correcting clears it at once, the first bad field gets focus on submit", async ({ page }) => {
    const sent = await stub(page, OK);
    await openForm(page, "en");
    const phone = control(page, "en", "phone");
    await phone.fill("12345");
    await phone.blur();
    await expect(form(page).getByText("Check this", { exact: true })).toBeVisible();
    await expect(form(page).getByText("Use a 10-digit mobile number.", { exact: true })).toBeVisible();
    await phone.fill("98765 43210");
    await expect(form(page).getByText("Use a 10-digit mobile number.", { exact: true })).toHaveCount(0);
    // Name fine, phone fine, city missing: submit focuses the city.
    await control(page, "en", "name").fill("Asha");
    await control(page, "en", "students").selectOption("10");
    await submitButton(page).click();
    await expect(control(page, "en", "city")).toBeFocused();
    expect(sent).toEqual([]);
  });

  const badPhones = ["12345", "5876543210", "98765 4321a", "+1 415 555 2671", "009876543210", "98765432101", "987654321"];
  for (const bad of badPhones) {
    test(`criterion 7 [en]: "${bad}" is refused with the same sentence and nothing is sent`, async ({ page }) => {
      const sent = await stub(page, OK);
      await openForm(page, "en");
      await fillAll(page, "en", { ...typed.en, phone: bad });
      await submitButton(page).click();
      await expect(form(page).getByText("Use a 10-digit mobile number.", { exact: true })).toBeVisible();
      expect(sent).toEqual([]);
    });
  }

  for (const bad of ["<b>Asha</b>", "Asha>", "Asha\u0007"]) {
    test(`criterion 6 [en]: name ${JSON.stringify(bad)} is refused as Check this`, async ({ page }) => {
      const sent = await stub(page, OK);
      await openForm(page, "en");
      await fillAll(page, "en", { ...typed.en, name: bad });
      await submitButton(page).click();
      await expect(form(page).getByText(word("en", "name.check.fix"), { exact: true })).toBeVisible();
      expect(sent).toEqual([]);
    });
  }

  test("criterion 6 [en]: the 61st character of a name and the 41st of a city are refused, not cut", async ({ page }) => {
    const sent = await stub(page, OK);
    await openForm(page, "en");
    await fillAll(page, "en", { ...typed.en, name: "a".repeat(61), city: "b".repeat(41) });
    await expect(control(page, "en", "name")).toHaveValue("a".repeat(61));
    await submitButton(page).click();
    await expect(form(page).getByText(word("en", "name.check.fix"), { exact: true })).toBeVisible();
    await expect(form(page).getByText(word("en", "city.check.fix"), { exact: true })).toBeVisible();
    expect(sent).toEqual([]);
  });
});

test.describe("phone reading (criterion 7)", () => {
  const cases: [string, string][] = [
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["098765 43210", "+919876543210"],
    ["(98765) 43210", "+919876543210"],
    ["‎+91 98765 43210", "+919876543210"],
    ["९८७६५४३२१०", "+919876543210"],
    ["೯೮೭೬೫೪೩೨೧೦", "+919876543210"],
    ["౯౮౭౬౫౪౩౨౧౦", "+919876543210"],
  ];
  for (const [typedPhone, stored] of cases) {
    test(`criterion 7 [en]: ${JSON.stringify(typedPhone)} is sent as ${stored} and shows grouped on blur`, async ({ page }) => {
      const sent = await stub(page, OK);
      await openForm(page, "en");
      const phone = control(page, "en", "phone");
      await phone.fill(typedPhone);
      await phone.blur();
      await expect(phone).toHaveValue("+91 98765 43210");
      await control(page, "en", "name").fill("Asha");
      await control(page, "en", "city").fill("Mysuru");
      await control(page, "en", "students").selectOption("10");
      await submitButton(page).click();
      await expect(section(page).getByRole("status")).toBeVisible();
      expect(sent).toHaveLength(1);
      expect(sent[0].body.phone).toBe(stored);
    });
  }
});

test.describe("submitting, in each language (criteria 11, 12, 18, 23)", () => {
  for (const lang of langs) {
    test(`criteria 11, 18, 23 [${lang}]: on slow 4G, nothing is sent until Join; then one request with the exact body; success replaces the form, focus moves, nothing stored`, async ({ page, context, baseURL }) => {
      await slow4G(page);
      const requests: string[] = [];
      page.on("request", (r) => requests.push(r.url()));
      const sent = await stub(page, OK);
      await openForm(page, lang);
      await fillAll(page, lang);
      await control(page, lang, "phone").blur();
      await expect(control(page, lang, "phone")).toHaveValue("+91 98765 43210");
      await page.waitForLoadState("networkidle");
      // Before the tap: nothing to the function, and nothing to any other origin.
      expect(sent).toEqual([]);
      const origin = new URL(baseURL!).origin;
      expect(requests.filter((u) => new URL(u).origin !== origin)).toEqual([]);
      const before = requests.length;
      await submitButton(page).tap();
      const status = section(page).getByRole("status");
      await expect(status).toBeVisible();
      expect(sent).toHaveLength(1);
      expect(sent[0].method).toBe("POST");
      expect(new URL(sent[0].url).pathname).toBe("/functions/v1/waitlist-join");
      const t = typed[lang];
      expect(sent[0].body).toEqual({ name: t.name, phone: t.storedPhone, city: t.city, students_count: Number(t.students), language: lang, website: "" });
      // Exactly one new request after the tap: the function.
      expect(requests.slice(before).filter((u) => !u.includes("waitlist-join"))).toEqual([]);
      // Confirmation: the stamp word, the sentences, no number, focus on it, form gone.
      await expect(status).toContainText(word(lang, "done.title"));
      await expect(status).toContainText(word(lang, "done.body"));
      await expect(status).toContainText(word(lang, "done.stamp"));
      await expect(status).toBeFocused();
      await expect(form(page)).toHaveCount(0);
      const text = await section(page).innerText();
      expect(text).not.toContain("98765");
      expect(text).not.toContain("9876");
      expect(await context.cookies()).toEqual([]);
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    });
  }

  test("honeypot [en]: a value set in the hidden box through the DOM is sent as website; the box is not keyboard-reachable", async ({ page }) => {
    const sent = await stub(page, OK);
    await openForm(page, "en");
    const trap = form(page).locator("input[name=website]");
    await expect(trap).toHaveAttribute("tabindex", "-1");
    await expect(trap.locator("xpath=..")).toHaveAttribute("aria-hidden", "true");
    await fillAll(page, "en");
    await trap.evaluate((el) => {
      (el as HTMLInputElement).value = "http://spam.test";
    });
    await submitButton(page).tap();
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0].body.website).toBe("http://spam.test");
  });

  test("criterion 11 [en]: back button / reload after success gives an empty form again", async ({ page }) => {
    await stub(page, OK);
    await openForm(page, "en");
    await fillAll(page, "en");
    await submitButton(page).click();
    await expect(section(page).getByRole("status")).toBeVisible();
    await page.reload();
    await fontsSettled(page);
    for (const which of ["name", "phone", "city"] as const) await expect(control(page, "en", which)).toHaveValue("");
    await expect(control(page, "en", "students")).toHaveValue("");
  });

  test("criterion 12 [en]: a double tap and two clicks in the same frame send one request; the button shows the working word and is marked busy", async ({ page }) => {
    const sent = await stub(page, { status: 200, body: { code: "ok" }, delayMs: 3000 });
    await openForm(page, "en");
    await fillAll(page, "en");
    await submitButton(page).dblclick();
    await expect(section(page).getByText(word("en", "working"), { exact: true })).toBeVisible();
    await expect(section(page).locator("[aria-busy=true]")).toHaveCount(1);
    // Two more clicks in one frame, as a fast thumb on a slow phone can produce.
    await form(page).locator("button").evaluate((b) => {
      (b as HTMLButtonElement).click();
      (b as HTMLButtonElement).click();
    });
    await expect(section(page).getByRole("status")).toBeVisible({ timeout: 10_000 });
    expect(sent).toHaveLength(1);
  });

  test("criterion 12 [en]: two submits in one frame before any re-render send one request", async ({ page }) => {
    const sent = await stub(page, { status: 200, body: { code: "ok" }, delayMs: 1500 });
    await openForm(page, "en");
    await fillAll(page, "en");
    await form(page).evaluate((f) => {
      (f as HTMLFormElement).requestSubmit();
      (f as HTMLFormElement).requestSubmit();
    });
    await expect(section(page).getByRole("status")).toBeVisible({ timeout: 10_000 });
    expect(sent).toHaveLength(1);
  });

  test("criterion 12 [en]: pressing Enter in a field while sending does not send a second request", async ({ page }) => {
    const sent = await stub(page, { status: 200, body: { code: "ok" }, delayMs: 1500 });
    await openForm(page, "en");
    await fillAll(page, "en");
    await control(page, "en", "city").press("Enter");
    await expect(section(page).getByText(word("en", "working"), { exact: true })).toBeVisible();
    await control(page, "en", "city").press("Enter");
    await control(page, "en", "city").press("Enter");
    await expect(section(page).getByRole("status")).toBeVisible();
    expect(sent).toHaveLength(1);
  });
});

test.describe("failure (criteria 15, 17)", () => {
  const failureLine = (lang: Lang) => [word(lang, "failed.title"), word(lang, "failed.detail")];

  for (const [name, answer] of [
    ["500 with code error", { status: 500, body: { code: "error" } }],
    ["400 invalid", { status: 400, body: { code: "invalid" } }],
    ["200 with a body that is not the function's", { status: 200, body: { hello: "world" } }],
    ["200 with a body that is not JSON", { status: 200, body: "<html>" }],
    ["network failure", "abort"],
  ] as [string, Answer][]) {
    test(`criterion 17 [en]: ${name} shows the failure line, keeps every value, and the button works again`, async ({ page }) => {
      const sent = await stub(page, answer);
      await openForm(page, "en");
      await fillAll(page, "en");
      await submitButton(page).click();
      const [title, detail] = failureLine("en");
      expect(title).toBe("Could not save.");
      expect(detail).toBe("Check your connection and try again.");
      await expect(section(page).getByText(title, { exact: true })).toBeVisible();
      await expect(section(page).getByText(detail, { exact: true })).toBeVisible();
      await expect(form(page)).toHaveCount(1);
      await expect(section(page).getByRole("status")).toHaveCount(0);
      await expect(control(page, "en", "name")).toHaveValue(typed.en.name);
      await expect(control(page, "en", "city")).toHaveValue(typed.en.city);
      await expect(control(page, "en", "students")).toHaveValue(typed.en.students);
      await expect(submitButton(page)).toBeEnabled();
      await expect(section(page).locator("[aria-busy=true]")).toHaveCount(0);
      // Try again after the network comes back.
      await page.unroute(FUNCTION);
      const again = await stub(page, OK);
      await submitButton(page).click();
      await expect(section(page).getByRole("status")).toBeVisible();
      expect(again).toHaveLength(1);
      expect(sent).toHaveLength(1);
    });
  }

  for (const lang of langs) {
    test(`criterion 15 [${lang}]: HTTP 429 shows the rate-limit sentence in the page language and keeps the typed values`, async ({ page }) => {
      const sent = await stub(page, { status: 429, body: { code: "rate_limited" } });
      await openForm(page, lang);
      await fillAll(page, lang);
      await submitButton(page).click();
      await expect(section(page).getByText(word(lang, "rateLimited.title"), { exact: true })).toBeVisible();
      await expect(section(page).getByText(word(lang, "rateLimited.detail"), { exact: true })).toBeVisible();
      if (lang === "en") {
        expect(word(lang, "rateLimited.title")).toBe("Too many tries.");
        expect(word(lang, "rateLimited.detail")).toBe("Please try again in an hour.");
      }
      await expect(control(page, lang, "name")).toHaveValue(typed[lang].name);
      await expect(control(page, lang, "city")).toHaveValue(typed[lang].city);
      await expect(control(page, lang, "students")).toHaveValue(typed[lang].students);
      await expect(submitButton(page)).toBeEnabled();
      expect(sent).toHaveLength(1);
    });
  }

  test("criterion 17 [en]: offline then back online: typing works, Join shows the failure line, going online and tapping again succeeds", async ({ page, context }) => {
    await openForm(page, "en");
    await context.setOffline(true);
    await fillAll(page, "en");
    await submitButton(page).click();
    await expect(section(page).getByText(word("en", "failed.title"), { exact: true })).toBeVisible();
    await expect(control(page, "en", "name")).toHaveValue(typed.en.name);
    await expect(submitButton(page)).toBeEnabled();
    await context.setOffline(false);
    const sent = await stub(page, OK);
    await submitButton(page).click();
    await expect(section(page).getByRole("status")).toBeVisible();
    expect(sent).toHaveLength(1);
  });

  test("criterion 17 [en]: a request that never answers stops after 15 seconds with the failure line; values kept", async ({ page }) => {
    test.setTimeout(60_000);
    const sent = await stub(page, "never");
    await openForm(page, "en");
    await fillAll(page, "en");
    const started = Date.now();
    await submitButton(page).click();
    await expect(section(page).getByText(word("en", "working"), { exact: true })).toBeVisible();
    // Still working at 10 seconds: success or failure is never shown early.
    await page.waitForTimeout(10_000);
    await expect(section(page).getByText(word("en", "working"), { exact: true })).toBeVisible();
    await expect(section(page).getByText(word("en", "failed.title"), { exact: true })).toBeVisible({ timeout: 10_000 });
    const took = Date.now() - started;
    expect(took).toBeGreaterThanOrEqual(14_500);
    expect(took).toBeLessThan(19_000);
    await expect(control(page, "en", "name")).toHaveValue(typed.en.name);
    await expect(submitButton(page)).toBeEnabled();
    expect(sent).toHaveLength(1);
  });

  test("criterion 11 [en]: success is never shown before the function says ok", async ({ page }) => {
    await stub(page, { status: 200, body: { code: "ok" }, delayMs: 2000 });
    await openForm(page, "en");
    await fillAll(page, "en");
    await submitButton(page).click();
    await page.waitForTimeout(800);
    await expect(section(page).getByRole("status")).toHaveCount(0);
    await expect(section(page).getByRole("status")).toBeVisible({ timeout: 5000 });
  });
});

test.describe("no JavaScript (criterion 22)", () => {
  test.use({ javaScriptEnabled: false });
  for (const lang of langs) {
    test(`criterion 22 [${lang}]: heading and the needs-JavaScript line, no dead inputs`, async ({ page }) => {
      await page.goto(`/${lang}/`);
      await expect(section(page).locator("h2")).toHaveText(shown(lang, "landing.waitlist.title"));
      await expect(section(page).getByText(word(lang, "noScript"), { exact: true })).toBeVisible();
      await expect(section(page).locator("input, select, textarea, button, form")).toHaveCount(0);
    });
  }
  test("criterion 22 [en]: the line reads 'This form needs JavaScript turned on.'", async ({ page }) => {
    await page.goto("/en/");
    await expect(section(page).getByText("This form needs JavaScript turned on.", { exact: true })).toBeVisible();
  });
});

test.describe("layout at 360px (criterion 21)", () => {
  const longest: Record<Lang, { name: string; city: string }> = {
    en: { name: "Wolfeschlegelsteinhausenbergerdorff Subramanian Iyer-Krishnamurthy", city: "Thiruvananthapuram Municipal Corporation Area" },
    hi: { name: "आ".repeat(30) + "श".repeat(30), city: "ज".repeat(40) },
    kn: { name: "ಆ".repeat(30) + "ಶ".repeat(30), city: "ಮ".repeat(40) },
    te: { name: "ఆ".repeat(30) + "శ".repeat(30), city: "హ".repeat(40) },
  };

  async function noClipping(page: Page) {
    expect(await sidewaysScroll(page)).toBe(0);
    const bad = await section(page).evaluate((root) => {
      const vw = document.documentElement.clientWidth;
      const out: string[] = [];
      for (const el of root.querySelectorAll("label, p, span, button, select, textarea, option, h2")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 0.5 || r.left < -0.5) out.push(`outside: ${(el.textContent ?? "").trim().slice(0, 30)}`);
        if (el.tagName === "BUTTON" && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)) out.push(`cut button: ${el.textContent}`);
      }
      return out;
    });
    expect(bad).toEqual([]);
  }

  for (const lang of langs) {
    test(`criterion 21 [${lang}]: empty, all errors showing, and the longest values: no sideways scroll, nothing outside the screen`, async ({ page }) => {
      await openForm(page, lang);
      await section(page).scrollIntoViewIfNeeded();
      await noClipping(page);
      await submitButton(page).click();
      await noClipping(page);
      await fillAll(page, lang, { ...typed[lang], ...longest[lang] });
      await control(page, lang, "phone").blur();
      await noClipping(page);
      // Every field holds its full value; nothing is silently cut.
      await expect(control(page, lang, "name")).toHaveValue(longest[lang].name);
      await expect(control(page, lang, "city")).toHaveValue(longest[lang].city);
    });

    test(`criterion 21 [${lang}]: root font at 200%: no sideways scroll, labels and the button not cut, controls still 44px, button still full width`, async ({ page }) => {
      await openForm(page, lang);
      await largestText(page);
      await section(page).scrollIntoViewIfNeeded();
      await noClipping(page);
      await submitButton(page).click();
      await noClipping(page);
      for (const which of ["name", "phone", "city", "students"] as const) {
        const box = await control(page, lang, which).boundingBox();
        expect(box!.height, which).toBeGreaterThanOrEqual(44);
      }
      const labels = await form(page).locator("label").evaluateAll((ls) => ls.map((l) => {
      // Truncation needs a clip: a label is cut only if it hides its overflow, or runs wider than its box. (Indic glyphs reach a few pixels past the line box; with overflow visible that is not a cut.)
      const overflow = getComputedStyle(l).overflow;
      return l.scrollWidth <= l.clientWidth + 1 && !/hidden|clip/.test(overflow) && getComputedStyle(l).textOverflow !== "ellipsis";
    }));
      expect(labels).toEqual([true, true, true, true]);
      // The select's band words fit: the closed select shows the chosen band inside the screen.
      await control(page, lang, "students").selectOption("60");
      await noClipping(page);
    });
  }

  for (const lang of indicLangs) {
    test(`criterion 21 [${lang}]: Anek is used for the labels and sentences, letter-spacing is 0`, async ({ page }) => {
      await openForm(page, lang);
      await submitButton(page).click();
      const probes = [
        form(page).locator("label").first(),
        form(page).getByText(word(lang, "consent"), { exact: true }),
        form(page).getByText(word(lang, "name.missing.fix"), { exact: true }),
        submitButton(page),
      ];
      for (const probe of probes) {
        const style = await probe.evaluate((e) => {
          const s = getComputedStyle(e);
          return { family: s.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, ""), spacing: s.letterSpacing };
        });
        expect(style.family).toMatch(/^Anek/);
        expect(["0px", "normal"]).toContain(style.spacing);
      }
    });
  }

  test("criterion 21 [en]: no text under 14px anywhere in the waitlist block, errors showing", async ({ page }) => {
    await openForm(page, "en");
    await submitButton(page).click();
    const small = await section(page).evaluate((root) => {
      const out: string[] = [];
      for (const el of root.querySelectorAll("*")) {
        const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
        if (own && parseFloat(getComputedStyle(el).fontSize) < 14) out.push((el.textContent ?? "").trim().slice(0, 30));
      }
      return out;
    });
    expect(small).toEqual([]);
  });
});

test.describe("the entry points (criterion 4)", () => {
  for (const lang of langs) {
    test(`criterion 4 [${lang}]: #waitlist exists once and the header, hero and tool-page links still point at it`, async ({ page }) => {
      await openForm(page, lang);
      await expect(page.locator("#waitlist")).toHaveCount(1);
      await expect(page.locator('a[href="#waitlist"]')).toHaveCount(2);
      await page.goto(`/${lang}/tools/fee-reminder/`);
      await expect(page.locator(`a[href="/${lang}/#waitlist"]`).first()).toBeVisible();
    });
  }
});
