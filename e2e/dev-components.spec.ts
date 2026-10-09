// Spec F2a, /dev/components: the eight components and the page itself, at the phone viewport.
// Each describe block names the acceptance criteria it proves (docs/specs/F2-design-system.md).
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  attachScreenshot,
  box,
  colourNames,
  css,
  DEV,
  docBox,
  fontsSettled,
  hex,
  indicLangs,
  langs,
  near,
  openDevPage,
  pixels,
  rgb,
  rgbTuple,
  scriptFontVariable,
  scriptPattern,
  shadow,
  sidewaysScroll,
  textProblems,
} from "./helpers";

const INTERACTIVE = 'a[href], button, input, select, textarea, [role="tab"], [role="link"], [role="button"], [tabindex]:not([tabindex="-1"])';

/** How many lines of text an element's content takes. */
function lineCount(locator: Locator): Promise<number> {
  return locator.first().evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const middles = [...range.getClientRects()]
      .filter((r) => r.width > 0)
      .map((r) => r.top + r.height / 2)
      .sort((a, b) => a - b);
    let count = 0;
    let last = -Infinity;
    for (const y of middles) {
      if (y - last > line * 0.6) {
        count++;
        last = y;
      }
    }
    return count;
  });
}

/** The first family in an element's computed font-family. */
function firstFamily(locator: Locator): Promise<string> {
  return locator.first().evaluate((el) => getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, ""));
}

function familyOf(page: Page, variable: string): Promise<string> {
  return page.evaluate((name) => getComputedStyle(document.documentElement).getPropertyValue(name).split(",")[0].trim().replace(/^["']|["']$/g, ""), variable);
}

/** Interactive elements under `scope` that are smaller than 44 by 44. */
function smallTargets(page: Page, scope: string): Promise<{ found: number; small: string[] }> {
  return page.evaluate(
    ([rootSelector, selector]) => {
      const root = document.querySelector(rootSelector);
      if (!root) throw new Error(`Nothing matches ${rootSelector}`);
      const small: string[] = [];
      let found = 0;
      for (const el of root.querySelectorAll(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        found++;
        if (r.width < 43.99 || r.height < 43.99) {
          const name = el.getAttribute("aria-label") ?? (el.textContent ?? "").trim().slice(0, 30);
          small.push(`${el.tagName.toLowerCase()} "${name}" is ${r.width.toFixed(1)} by ${r.height.toFixed(1)}`);
        }
      }
      return { found, small };
    },
    [scope, INTERACTIVE] as const,
  );
}

/** Text nodes, inputs and placeholders under `scope` whose computed font size is below 14px. */
function smallText(page: Page, scope: string): Promise<{ seen: number; small: string[] }> {
  return page.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector);
    if (!root) throw new Error(`Nothing matches ${rootSelector}`);
    const small: string[] = [];
    let seen = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (!el || (node.textContent ?? "").trim() === "" || el.closest("script, style, noscript")) continue;
      seen++;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 14) small.push(`${size}px: ${(node.textContent ?? "").trim().slice(0, 40)}`);
    }
    for (const input of root.querySelectorAll("input, textarea, select")) {
      seen++;
      const size = parseFloat(getComputedStyle(input).fontSize);
      const placeholder = parseFloat(getComputedStyle(input, "::placeholder").fontSize);
      if (size < 14) small.push(`${size}px: an input`);
      if (placeholder < 14) small.push(`${placeholder}px: a placeholder`);
    }
    return { seen, small };
  }, scope);
}

async function openSheet(page: Page, id: string): Promise<Locator> {
  await page.getByTestId(`sheet-open-${id}`).tap();
  const dialog = page.locator("dialog[open]");
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The scrolling slip panel inside an open sheet, found from the title upwards. Marks it for later lookups. */
async function sheetPanel(dialog: Locator): Promise<Locator> {
  await dialog.evaluate((d) => {
    let node: HTMLElement | null = d.querySelector("h2");
    while (node && node !== d && !["auto", "scroll"].includes(getComputedStyle(node).overflowY)) node = node.parentElement;
    if (!node || node === d) throw new Error("The sheet has no scrolling panel");
    node.setAttribute("data-e2e-panel", "1");
  });
  return dialog.locator('[data-e2e-panel="1"]');
}

test.beforeEach(async ({ page }, testInfo) => {
  // Tests that need a different start (reduced motion, the home page) open their own page.
  if (testInfo.titlePath.some((t) => t.includes("[own page]"))) return;
  await openDevPage(page);
});

test.describe("the page: criteria 58, 59, 61, 65", () => {
  test("58: has a section for the tokens, the type roles, the rupee sign and each of the eight components", async ({ page }) => {
    for (const id of ["tokens", "type", "rupee", "button", "field", "slip", "row", "status-tag", "stamp", "tabs", "sheet"]) {
      const section = page.getByTestId(`section-${id}`);
      await expect(section, id).toBeVisible();
      await expect(section.getByRole("heading", { level: 2 }).first(), id).toBeVisible();
      await expect(section).toHaveAccessibleName(/\S/);
    }
  });

  test("58: shows every colour token with its name, its value and a swatch of that colour", async ({ page }) => {
    expect(colourNames).toHaveLength(19);
    await expect(page.getByTestId("section-tokens").locator("li")).toHaveCount(colourNames.length);
    for (const name of colourNames) {
      const swatch = page.getByTestId(`swatch-${name}`);
      await expect(swatch.getByText(name, { exact: true })).toBeVisible();
      await expect(swatch.getByText(hex(name), { exact: true })).toBeVisible();
      expect((await css(swatch.locator("div"), ["background-color"]))["background-color"], name).toBe(rgb(name));
    }
  });

  test("58: shows every type role", async ({ page }) => {
    const english = page.getByTestId("section-type").locator('[lang="en"]');
    for (const role of ["headline", "amount", "body-lg", "body", "body-sm", "caption", "label", "control", "control-sm", "name", "amount-row"]) {
      await expect(english.locator(`[data-role="${role}"]`), role).toBeVisible();
    }
  });

  test("58: shows every variant and state of the eight components without anyone touching it", async ({ page }) => {
    // Button: three variants, then pressed, focus, busy, disabled, long label, icons, link, round, cloth, dark.
    for (const id of ["send", "record", "outline", "pressed", "focus", "busy", "busy-demo", "disabled", "long", "icons", "link", "round", "on-cloth", "on-dark"]) {
      await expect(page.getByTestId(`button-${id}`), `button ${id}`).toBeVisible();
    }
    await expect(page.getByTestId("button-pressed").locator('[data-force="pressed"]')).toHaveCount(3);
    await expect(page.getByTestId("button-focus").locator('[data-force="focus"]')).toHaveCount(2);
    await expect(page.getByTestId("button-busy").locator('[aria-busy="true"]')).toHaveCount(1);
    await expect(page.getByTestId("button-disabled").getByRole("button")).toBeDisabled();
    await expect(page.getByTestId("button-link").getByRole("link")).toBeVisible();
    await expect(page.getByTestId("button-icons").locator("svg")).toHaveCount(2);

    // Field: empty, typing, correct, needs fixing, helper, long.
    for (const id of ["empty", "typing", "correct", "error", "helper", "long"]) {
      await expect(page.getByTestId(`field-${id}`), `field ${id}`).toBeVisible();
    }
    await expect(page.getByTestId("field-typing").getByRole("textbox")).toHaveAttribute("data-force", "focus");
    await expect(page.getByTestId("field-correct").locator('[data-state="correct"]')).toHaveCount(1);
    await expect(page.getByTestId("field-error").locator('[data-state="error"]')).toHaveCount(1);

    // Slip: standard and joined.
    await expect(page.getByTestId("slip-standard")).toBeVisible();
    await expect(page.getByTestId("slip-joined")).toBeVisible();

    // Row: the three tones, a round action, a tag, a small stamp, a link row, a long row, a plain row.
    const rows = page.getByTestId("section-row").locator('[lang="en"]');
    for (const tone of ["overdue", "due", "paid"]) await expect(rows.locator(`[data-tone="${tone}"]`).first()).toBeVisible();
    await expect(rows.locator("li")).toHaveCount(6);
    await expect(rows.locator("li a[href]").first()).toBeVisible();
    await expect(rows.locator('li [data-size="sm"]')).toHaveCount(1);
    await expect(rows.locator("li [data-status]")).toHaveCount(1);

    // StatusTag: the four statuses.
    for (const status of ["overdue", "due", "part-paid", "paid"]) {
      await expect(page.getByTestId("section-status-tag").locator(`[lang="en"] [data-status="${status}"]`).first()).toBeVisible();
    }

    // Stamp: three sizes, both tones, an animated one.
    for (const size of ["sm", "md", "lg"]) await expect(page.getByTestId(`stamp-${size}`).locator(`[data-size="${size}"]`)).toHaveCount(2);
    await expect(page.getByTestId("stamp-animated").locator("[data-size]")).toHaveCount(1);
    await expect(page.getByTestId("stamp-replay")).toBeVisible();

    // Tabs: joined to a slip, standard and long.
    await expect(page.getByTestId("tabs-tabs-en").getByRole("tab")).toHaveCount(3);
    await expect(page.getByTestId("tabs-tabs-long-en").getByRole("tab")).toHaveCount(3);
    await expect(page.getByTestId("tabs-tabs-en").getByRole("tabpanel")).toBeVisible();

    // Sheet: a still copy that can be seen without opening it, and the buttons that open it.
    await expect(page.getByTestId("sheet-still").getByRole("heading", { level: 2 })).toBeVisible();
    await expect(page.getByTestId("sheet-open-en")).toBeVisible();
    await expect(page.getByTestId("sheet-open-tall")).toBeVisible();
  });

  test("59: every text-bearing section repeats in Hindi, Kannada and Telugu, each block marked with its lang", async ({ page }) => {
    for (const id of ["type", "rupee", "button", "field", "row", "status-tag", "stamp", "tabs", "sheet"]) {
      for (const lang of indicLangs) {
        const block = page.getByTestId(`section-${id}`).getByTestId(`lang-${lang}`);
        await expect(block, `${id} ${lang}`).toHaveCount(1);
        await expect(block).toHaveAttribute("lang", lang);
        await expect(block, `${id} ${lang} holds text in its script`).toContainText(scriptPattern[lang]);
      }
    }
    // English type sample and English components are marked too.
    for (const id of ["type", "row", "status-tag", "tabs", "sheet"]) {
      await expect(page.getByTestId(`section-${id}`).getByTestId("lang-en")).toHaveAttribute("lang", "en");
    }
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  for (const lang of langs) {
    test(`59: ${lang} has a deliberately long label on a button, a tab, a tag, a row and a field, and each wraps`, async ({ page }) => {
      const scope = (id: string) => (lang === "en" ? page.getByTestId(`section-${id}`) : page.getByTestId(`section-${id}`).getByTestId(`lang-${lang}`));
      const longButton =
        lang === "en"
          ? page.getByTestId("button-long").getByRole("button")
          : scope("button").getByRole("button").nth(3);
      expect(await lineCount(longButton), "button").toBeGreaterThanOrEqual(2);
      const longTab = page.getByTestId(`tabs-tabs-long-${lang}`).getByRole("tab").first();
      expect(await lineCount(longTab), "tab").toBeGreaterThanOrEqual(2);
      const tagBlock = page.getByTestId("section-status-tag").getByTestId(`lang-${lang}`);
      expect(await lineCount(tagBlock.locator('[data-status="overdue"]').nth(1)), "tag").toBeGreaterThanOrEqual(2);
      const longRow = page.getByTestId("section-row").getByTestId(`lang-${lang}`).locator("li").nth(4);
      expect(await lineCount(longRow.locator("a > span > span").first()), "row name").toBeGreaterThanOrEqual(2);
      const longField = lang === "en" ? page.getByTestId("field-long") : scope("field");
      expect(await lineCount(longField.locator('[data-state="error"] label').last()), "field label").toBeGreaterThanOrEqual(2);
      if (lang !== "en") await expect(longButton).toContainText(scriptPattern[lang]);
    });
  }

  test("61: no sideways scroll at 360px, also while a button is held down and while a sheet is open", async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 360, height: 740 });
    expect(await sidewaysScroll(page)).toBe(0);
    // Sideways scrolling must be impossible, not merely not happened yet.
    await page.evaluate(() => window.scrollTo(500, 0));
    expect(await page.evaluate(() => window.scrollX)).toBe(0);

    const button = page.getByTestId("button-outline").getByRole("button");
    await button.scrollIntoViewIfNeeded();
    const b = await box(button);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect.poll(async () => (await css(button, ["translate"])).translate).toBe("5px 5px");
    expect(await sidewaysScroll(page)).toBe(0);
    await page.mouse.up();

    await openSheet(page, "en");
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("65: is marked noindex", async ({ page }) => {
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  });

  test("65: the home page does not link to it or mention it [own page]", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator('a[href*="dev"]')).toHaveCount(0);
    const html = await (await request.get("/")).text();
    expect(html).not.toContain("dev/components");
    // A route that was never built gives "not found"; this is what production gives for /dev/components.
    const missing = await request.get("/dev/not-a-page/");
    expect(missing.status()).toBe(404);
  });

  test("the home page has no text below 14px either [own page]", async ({ page }) => {
    await page.goto("/");
    await fontsSettled(page);
    const result = await smallText(page, "body");
    expect(result.seen).toBeGreaterThan(0);
    expect(result.small).toEqual([]);
  });
});

test.describe("whole page: criteria 4, 62, 63, 64 and the runtime side of 69", () => {
  test("4: no rendered text, input value or placeholder is below 14px, on the page or in an open sheet", async ({ page }) => {
    const onPage = await smallText(page, "body");
    expect(onPage.seen).toBeGreaterThan(500);
    expect(onPage.small).toEqual([]);
    for (const id of ["en", "hi", "kn", "te", "tall"]) {
      const dialog = await openSheet(page, id);
      const inSheet = await smallText(page, "dialog[open]");
      expect(inSheet.seen, id).toBeGreaterThan(4);
      expect(inSheet.small, id).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
  });

  test("62: every interactive element is at least 44 by 44, on the page and in every sheet", async ({ page }) => {
    const onPage = await smallTargets(page, "body");
    expect(onPage.found).toBeGreaterThan(100);
    expect(onPage.small).toEqual([]);
    for (const id of ["en", "hi", "kn", "te", "tall"]) {
      const dialog = await openSheet(page, id);
      const inSheet = await smallTargets(page, "dialog[open]");
      expect(inSheet.found, id).toBe(3);
      expect(inSheet.small, id).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
    }
  });

  test("nothing is truncated, clipped or overlapping at the default text size", async ({ page }) => {
    expect(await textProblems(page, "main")).toEqual([]);
  });

  test("the check above can fail: it reports an ellipsis, a clip, text off the screen and an overlap", async ({ page }) => {
    await page.evaluate(() => {
      const host = document.createElement("div");
      host.setAttribute("data-e2e", "broken");
      host.innerHTML = `
        <p id="e2e-ellipsis" style="width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">A label that is cut off with dots</p>
        <div style="height:10px;overflow:hidden"><p id="e2e-clipped" style="margin:0">Clipped at the bottom</p></div>
        <p id="e2e-offscreen" style="width:500px;white-space:nowrap">This line of text is far too wide for a phone screen to hold</p>
        <div style="position:relative;height:30px"><p id="e2e-under" style="position:absolute;top:0;margin:0">Underneath</p><p id="e2e-over" style="position:absolute;top:4px;margin:0">On top</p></div>`;
      document.querySelector("main")!.prepend(host);
    });
    const found = (await textProblems(page, '[data-e2e="broken"]')).map((p) => p.what);
    expect(found.some((w) => w.startsWith("text-overflow is ellipsis"))).toBe(true);
    expect(found.some((w) => w.startsWith("clipped by"))).toBe(true);
    expect(found.some((w) => w.startsWith("reaches from"))).toBe(true);
    expect(found.some((w) => w.startsWith("overlaps"))).toBe(true);
    expect(found.some((w) => w.startsWith("content is"))).toBe(true);

    // A value that does not fit its field. The real field wraps and grows, so nothing is reported...
    const example = page.getByTestId("field-correct");
    const control = example.getByRole("textbox");
    const long = "a.very.long.upi.id.that.cannot.fit.on.one.line@okhdfcbank";
    await control.fill(long);
    await expect(control).toHaveValue(long);
    expect(await textProblems(page, '[data-testid="field-correct"]')).toEqual([]);
    // ...but the same value held to one row is cut off below, and that is reported.
    await control.evaluate((el) => ((el.previousElementSibling as HTMLElement).style.display = "none"));
    expect((await textProblems(page, '[data-testid="field-correct"]')).map((p) => p.what.slice(0, 12))).toEqual(["value is cut"]);
    await control.evaluate((el) => ((el.previousElementSibling as HTMLElement).style.display = ""));
    expect(await textProblems(page, '[data-testid="field-correct"]')).toEqual([]);
    // A value that cannot wrap and is wider than the control is reported too.
    await control.evaluate((el) => ((el as HTMLElement).style.whiteSpace = "nowrap"));
    expect((await textProblems(page, '[data-testid="field-correct"]')).map((p) => p.what.slice(0, 12))).toEqual(["value is cut"]);
    await control.evaluate((el) => ((el as HTMLElement).style.whiteSpace = ""));
    // So is a tick that has slid over the value.
    await example.locator("svg").evaluate((el) => ((el as unknown as HTMLElement).style.marginLeft = "-80px"));
    expect((await textProblems(page, '[data-testid="field-correct"]')).map((p) => p.what.slice(0, 15))).toEqual(["value runs unde"]);
    // An old-style single-line input with too long a value is still caught.
    await page.evaluate((value) => {
      const input = document.createElement("input");
      input.value = value;
      input.style.width = "120px";
      input.setAttribute("data-e2e", "old-input");
      document.querySelector("main")!.prepend(input);
    }, long);
    expect((await textProblems(page, "main")).filter((p) => p.where.endsWith("> input")).map((p) => p.what.slice(0, 12))).toEqual(["value is cut"]);
  });

  test("8, as rendered: every piece of text on the page reaches 4.5:1 against the ground it sits on", async ({ page }) => {
    const pairs = async () =>
      page.evaluate(() => {
        const seen = new Map<string, string>();
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const add = (el: Element, colour: string, sample: string) => {
          let ground = "";
          for (let node: Element | null = el; node; node = node.parentElement) {
            const bg = getComputedStyle(node).backgroundColor;
            if (/^rgb\(/.test(bg)) {
              ground = bg;
              break;
            }
          }
          const key = `${colour} on ${ground}`;
          if (!seen.has(key)) seen.set(key, sample);
        };
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const el = node.parentElement;
          if (!el || (node.textContent ?? "").trim() === "" || el.closest("script, style, noscript")) continue;
          if (el.getClientRects().length === 0) continue;
          add(el, getComputedStyle(el).color, (node.textContent ?? "").trim().slice(0, 30));
        }
        const controls = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
        if (controls.length < 10) throw new Error(`Only ${controls.length} form controls found`);
        for (const input of controls) {
          if (input.getClientRects().length === 0) continue;
          add(input, getComputedStyle(input).color, "an input value");
          if (input.placeholder) add(input, getComputedStyle(input, "::placeholder").color, "a placeholder");
        }
        return [...seen.entries()];
      });
    const luminance = (colour: string) => {
      const m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(colour);
      if (!m) throw new Error(`Not an opaque colour: ${colour}`);
      const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
        const c = Number(v) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const failing = (entries: [string, string][]) =>
      entries
        .map(([pair, sample]) => {
          const [fg, bg] = pair.split(" on ");
          const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
          return { pair, sample, ratio: Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100 };
        })
        .filter((p) => p.ratio < 4.5);

    const onPage = await pairs();
    expect(onPage.length).toBeGreaterThan(12);
    expect(failing(onPage)).toEqual([]);
    await openSheet(page, "en");
    expect(failing(await pairs())).toEqual([]);
  });

  test("5, as rendered: every corner on the page is square, 4px, 6px or a full circle", async ({ page }) => {
    const radii = await page.evaluate(() => {
      const found = new Set<string>();
      for (const el of document.querySelectorAll("*")) {
        const s = getComputedStyle(el);
        for (const corner of [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomLeftRadius, s.borderBottomRightRadius]) found.add(corner);
      }
      return [...found].map((r) => (parseFloat(r) > 1000 ? "full" : r)).sort();
    });
    expect([...new Set(radii)]).toEqual(["0px", "4px", "6px", "full"]);
  });

  // Two ways of making text 130%. The plan's way scales the root font size, so every rem (text, box
  // minimums, stamp rings) grows together. `text-size-adjust` enlarges text only and leaves rem boxes
  // alone, which is closer to what a phone's font-size setting does to a page.
  const scales = [
    { name: "root font size 130% (the plan's method)", boxesGrow: true, apply: () => document.documentElement.style.setProperty("font-size", "130%") },
    { name: "text only, text-size-adjust 130%", boxesGrow: false, apply: () => document.documentElement.style.setProperty("text-size-adjust", "130%") },
  ];
  for (const scale of scales) {
    test(`63: ${scale.name}: nothing clipped, overlapped or truncated and no sideways scroll`, async ({ page }, testInfo) => {
      const body = page.getByTestId("section-type").locator('[lang="en"] [data-role="body"]');
      const button = page.getByTestId("button-record").getByRole("button");
      const row = page.getByTestId("section-row").locator('[lang="en"] li').first();
      const sixDigits = page.getByTestId("rupee-headline").locator('[data-rupee="headline"]').first();
      const smallStamp = page.getByTestId("stamp-sm").locator("[data-size]").first();
      const before = { button: (await box(button)).height, row: (await box(row)).height, stamp: (await box(smallStamp)).width };
      expect((await css(body, ["font-size"]))["font-size"]).toBe("16px");
      await expect(sixDigits).toHaveText("₹1,23,456");
      expect(await lineCount(sixDigits), "a six-digit headline amount is one line at the default size").toBe(1);

      await page.evaluate(scale.apply);
      // The scale really took: 16px reading text is now 20.8px.
      await expect.poll(async () => (await css(body, ["font-size"]))["font-size"]).toBe("20.8px");
      await fontsSettled(page);

      expect(await sidewaysScroll(page)).toBe(0);
      // A value cut off inside a field is checked by the next test, so that one fault does not hide the rest.
      expect((await textProblems(page, "main")).filter((p) => !p.what.startsWith("value "))).toEqual([]);

      // Buttons and rows grow; they are not clipped at their old height.
      expect((await box(button)).height).toBeGreaterThan(before.button);
      expect((await box(row)).height).toBeGreaterThanOrEqual(before.row);
      const small = await smallTargets(page, "body");
      expect(small.small).toEqual([]);

      // A headline amount is never broken in the middle of the number ("₹78,90" then "0" reads as a
      // different amount). One wider than its space gets smaller instead: it stays on one line, at
      // most its token size, never under 14px, and never scrolls the page sideways.
      expect((await css(sixDigits, ["white-space"]))["white-space"]).toBe("nowrap");
      const amounts = page.locator('[data-rupee="headline"], [data-role="amount"]');
      await expect(amounts).toHaveCount(9);
      for (const amount of await amounts.all()) {
        const text = (await amount.textContent()) ?? "";
        const token = await amount.evaluate((el) => (el.classList.contains("amount-size-7xl") ? 72 : el.classList.contains("amount-size-6xl") ? 60 : 0));
        expect(token, text).not.toBe(0);
        expect(await lineCount(amount), `${text} at the ${token}px size`).toBe(1);
        const size = parseFloat((await css(amount, ["font-size"]))["font-size"]);
        // Root scaling raises the token itself; text-only scaling leaves a fitted amount alone.
        expect(size, text).toBeLessThanOrEqual(token * (scale.boxesGrow ? 1.3 : 1) + 0.01);
        expect(size, text).toBeGreaterThanOrEqual(14);
        const amountBox = await box(amount);
        expect(amountBox.x, text).toBeGreaterThanOrEqual(0);
        expect(amountBox.x + amountBox.width, text).toBeLessThanOrEqual(360);
        // The digits themselves end inside the amount's own space.
        const fits = await amount.evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          return range.getBoundingClientRect().right <= el.parentElement!.getBoundingClientRect().right + 0.5;
        });
        expect(fits, text).toBe(true);
      }
      // The six-digit amount no longer fits at its 93.6px token when the root is 130%, so it is smaller.
      if (scale.boxesGrow) expect(parseFloat((await css(sixDigits, ["font-size"]))["font-size"])).toBeLessThan(93.6);

      // A stamp's ring is sized in rem. It grows with the root font size; with text-only scaling it
      // grows only as far as its word needs.
      const stampNow = (await box(smallStamp)).width;
      if (scale.boxesGrow) expect(stampNow).toBeCloseTo(before.stamp * 1.3, 1);
      else expect(stampNow).toBeGreaterThanOrEqual(before.stamp);
      expect(Math.abs(stampNow - (await box(smallStamp)).height)).toBeLessThanOrEqual(1);

      // The long row keeps its amount and its action on screen.
      for (const lang of langs) {
        const long = page.getByTestId("section-row").getByTestId(`lang-${lang}`).locator("li").nth(4);
        const amount = await box(long.locator('[translate="no"]'));
        const action = await box(long.getByRole("button"));
        expect(amount.x + amount.width, lang).toBeLessThanOrEqual(action.x + 0.5);
        expect(action.x + action.width, lang).toBeLessThanOrEqual(360);
        expect(await lineCount(long.locator('[translate="no"]')), lang).toBe(1);
      }

      // The same holds inside each sheet.
      for (const id of ["en", "hi", "kn", "te", "tall"]) {
        const dialog = await openSheet(page, id);
        expect(await sidewaysScroll(page), id).toBe(0);
        expect((await textProblems(page, "dialog[open]")).filter((p) => !p.what.startsWith("value ")), id).toEqual([]);
        expect((await smallTargets(page, "dialog[open]")).small, id).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }

      await attachScreenshot(testInfo, "130-percent-top-of-page.png", await page.screenshot());
    });

    test(`63: ${scale.name}: a value written in a field is not cut off`, async ({ page }) => {
      const body = page.getByTestId("section-type").locator('[lang="en"] [data-role="body"]');
      await page.evaluate(scale.apply);
      await expect.poll(async () => (await css(body, ["font-size"]))["font-size"]).toBe("20.8px");
      await fontsSettled(page);
      const cut = (await textProblems(page, "main")).filter((p) => p.what.startsWith("value "));
      for (const id of ["en", "hi", "kn", "te"]) {
        const dialog = await openSheet(page, id);
        cut.push(...(await textProblems(page, "dialog[open]")).filter((p) => p.what.startsWith("value ")));
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      }
      expect(cut).toEqual([]);
    });
  }

  test("64: with reduce motion on, the stamp does not animate and nothing else moves [own page]", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDevPage(page);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);

    const stamp = page.getByTestId("stamp-animated").locator("[data-size]");
    expect((await css(stamp, ["animation-name"]))["animation-name"]).toBe("none");
    expect((await css(stamp.locator("> span"), ["animation-name"]))["animation-name"]).toBe("none");
    await page.getByTestId("stamp-replay").tap();
    expect((await css(stamp, ["animation-name"]))["animation-name"]).toBe("none");

    // Nothing on the page animates or eases.
    const moving = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll("*")) {
        const s = getComputedStyle(el);
        if (s.animationName !== "none") out.push(`animation ${s.animationName} on ${el.tagName}`);
        if (s.transitionDuration.split(",").some((d) => parseFloat(d) > 0)) out.push(`transition ${s.transitionDuration} on ${el.tagName}`);
      }
      return out;
    });
    expect(moving).toEqual([]);
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);

    // A state change still happens: the button drops into its shadow, at once.
    const button = page.getByTestId("button-send").getByRole("button");
    await button.scrollIntoViewIfNeeded();
    const rest = await box(button);
    await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height / 2);
    await page.mouse.down();
    // No polling: with motion reduced the move is finished the moment the press lands.
    expect((await css(button, ["translate"])).translate).toBe("5px 5px");
    expect((await box(button)).x - rest.x).toBe(5);
    expect((await shadow(button))).toBe("none");
    await page.mouse.up();

    // Opening a sheet and changing a tab start no animation either.
    await page.getByTestId("tabs-tabs-en").getByRole("tab").nth(1).tap();
    await openSheet(page, "en");
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test("69: the only motion on the page is the button press and the stamp", async ({ page }) => {
    const moving = await page.evaluate(() => {
      const transitions: string[] = [];
      const animations: string[] = [];
      for (const el of document.querySelectorAll("*")) {
        const s = getComputedStyle(el);
        if (s.transitionDuration.split(",").some((d) => parseFloat(d) > 0)) {
          const isButton = el.matches("button, a") && !el.matches('[role="tab"]');
          transitions.push(`${isButton ? "button" : el.tagName.toLowerCase()}|${s.transitionProperty}|${s.transitionDuration}|${s.transitionTimingFunction}`);
        }
        if (s.animationName !== "none") animations.push(`${s.animationName}|${el.closest('[data-testid="stamp-animated"]') ? "stamp" : el.tagName}`);
      }
      return { transitions: [...new Set(transitions)], animations: animations.sort() };
    });
    expect(moving.transitions).toEqual(["button|transform, translate, scale, rotate|0.08s|linear"]);
    expect(moving.animations).toEqual(["stamp-land|stamp", "stamp-settle|stamp"]);

    // The sheet does not slide or fade in.
    await openSheet(page, "en");
    const inSheet = await page.evaluate(() =>
      document
        .getAnimations()
        .map((a) => (a instanceof CSSAnimation ? a.animationName : "transition"))
        .filter((name) => !name.startsWith("stamp-")),
    );
    expect(inSheet).toEqual([]);
  });
});

test.describe("Button: criteria 17, 18, 20, 21, 22, 23, 25", () => {
  const variant = (page: Page, name: string) => page.getByTestId(`button-${name}`).getByRole("button");

  test("17: send, record and outline have their fills, text, shadows, 2px ink border and 4px corners", async ({ page }) => {
    const want = {
      send: { fill: rgb("blue"), text: rgb("slip"), shadow: `${rgb("ink")} 5px 5px 0px 0px` },
      record: { fill: rgb("ink"), text: rgb("slip"), shadow: `${rgb("ink-label")} 5px 5px 0px 0px` },
      outline: { fill: rgb("slip"), text: rgb("ink"), shadow: `${rgb("ink")} 5px 5px 0px 0px` },
    };
    for (const [name, expected] of Object.entries(want)) {
      const s = await css(variant(page, name), ["background-color", "color", "box-shadow", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-style", "border-top-color", "border-top-left-radius", "border-bottom-right-radius", "background-image"]);
      expect(s["background-color"], name).toBe(expected.fill);
      expect(s.color, name).toBe(expected.text);
      expect(await shadow(variant(page, name)), name).toBe(expected.shadow);
      expect([s["border-top-width"], s["border-right-width"], s["border-bottom-width"], s["border-left-width"]], name).toEqual(["2px", "2px", "2px", "2px"]);
      expect(s["border-top-style"], name).toBe("solid");
      expect(s["border-top-color"], name).toBe(rgb("ink"));
      expect(s["border-top-left-radius"], name).toBe("4px");
      expect(s["border-bottom-right-radius"], name).toBe("4px");
      expect(s["background-image"], name).toBe("none");
    }
  });

  test("17: there is no red button anywhere on the page, and no blurred shadow or gradient", async ({ page }) => {
    const found = await page.evaluate(
      ([selector, red]) => {
        const out: string[] = [];
        for (const el of document.querySelectorAll(selector)) {
          if (getComputedStyle(el).backgroundColor === red) out.push(`red control: ${(el.textContent ?? "").trim().slice(0, 30)}`);
        }
        for (const el of document.querySelectorAll("*")) {
          const s = getComputedStyle(el);
          if (s.backgroundImage !== "none") out.push(`background image on ${el.tagName}`);
          if (s.filter !== "none" || s.backdropFilter !== "none") out.push(`filter on ${el.tagName}`);
          if (s.boxShadow !== "none") {
            // "rgb(r, g, b) x y blur spread": the blur and the spread must both be zero.
            for (const part of s.boxShadow.split(/,(?![^(]*\))/)) {
              const lengths = part.replace(/rgba?\([^)]*\)/, "").trim().split(/\s+/);
              if (lengths[2] !== "0px" || lengths[3] !== "0px") out.push(`soft shadow ${s.boxShadow} on ${el.tagName}`);
            }
          }
        }
        return out;
      },
      [INTERACTIVE, rgb("cloth")] as const,
    );
    expect(found).toEqual([]);
  });

  test("18: every button is at least 48px tall", async ({ page }) => {
    const heights = await page.getByTestId("section-button").locator("button, a").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(heights.length).toBeGreaterThan(30);
    expect(heights.filter((h) => h < 48)).toEqual([]);
  });

  for (const lang of langs) {
    test(`18: a long ${lang} label wraps and the button grows; the text is not cut and not made smaller`, async ({ page }) => {
      const block = lang === "en" ? page.getByTestId("section-button") : page.getByTestId("section-button").getByTestId(`lang-${lang}`);
      const short = lang === "en" ? variant(page, "send") : block.getByRole("button").first();
      const long = lang === "en" ? variant(page, "long") : block.getByRole("button").nth(3);
      const lines = await lineCount(long);
      expect(lines).toBeGreaterThanOrEqual(2);
      expect((await box(long)).height).toBeGreaterThan((await box(short)).height);
      // Tall enough for every line of its label.
      const line = parseFloat((await css(long, ["line-height"]))["line-height"]);
      expect((await box(long)).height).toBeGreaterThanOrEqual(lines * line);
      const s = await css(long, ["text-overflow", "overflow-x", "overflow-y", "white-space", "font-size"]);
      expect(s["text-overflow"]).toBe("clip");
      expect([s["overflow-x"], s["overflow-y"]]).toEqual(["visible", "visible"]);
      expect(s["white-space"]).toBe("normal");
      expect(s["font-size"]).toBe((await css(short, ["font-size"]))["font-size"]);
      expect(s["font-size"]).toBe("18px");
      // The label fits inside the button's own box.
      const fits = await long.evaluate((el) => {
        const outer = el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        return [...range.getClientRects()].every((r) => r.left >= outer.left && r.right <= outer.right && r.top >= outer.top && r.bottom <= outer.bottom);
      });
      expect(fits).toBe(true);
    });
  }

  test("19, as rendered: a button that is a link looks like the button; icons sit before and after the label", async ({ page }) => {
    const look = ["background-color", "color", "border-top-width", "border-top-style", "border-top-color", "border-top-left-radius", "font-size", "font-weight", "text-decoration-line"] as const;
    const link = page.getByTestId("button-link").getByRole("link");
    await expect(link).toHaveAttribute("href", "#top");
    expect(await css(link, look)).toEqual(await css(variant(page, "outline"), look));
    expect(await shadow(link)).toBe(await shadow(variant(page, "outline")));
    expect((await box(link)).height).toBe((await box(variant(page, "outline"))).height);

    const withIcons = page.getByTestId("button-icons").getByRole("button");
    const first = { icon: await box(withIcons.nth(0).locator("svg")), label: await box(withIcons.nth(0).locator("span").last()) };
    expect(first.icon.x + first.icon.width).toBeLessThanOrEqual(first.label.x);
    const second = { icon: await box(withIcons.nth(1).locator("svg")), label: await box(withIcons.nth(1).locator("span").first()) };
    expect(second.label.x + second.label.width).toBeLessThanOrEqual(second.icon.x);
    await expect(withIcons.nth(0)).toHaveAccessibleName("Mark paid");
  });

  test("20: pressed, the button moves 5px right and down into its shadow and the shadow goes, in 80ms", async ({ page }) => {
    for (const name of ["send", "record", "outline"]) {
      const button = variant(page, name);
      await button.scrollIntoViewIfNeeded();
      const rest = await box(button);
      const before = await css(button, ["translate", "box-shadow", "transition-duration", "transition-timing-function", "transition-property", "transition-delay"]);
      expect(before.translate, name).toBe("none");
      expect(before["box-shadow"], name).not.toBe("none");
      expect(before["transition-duration"], name).toBe("0.08s");
      expect(before["transition-timing-function"], name).toBe("linear");
      expect(before["transition-delay"], name).toBe("0s");
      expect(before["transition-property"], name).toContain("translate");

      await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height / 2);
      await page.mouse.down();
      expect((await shadow(button)), name).toBe("none");
      await expect.poll(async () => (await css(button, ["translate"])).translate, name).toBe("5px 5px");
      const pressed = await box(button);
      expect([pressed.x - rest.x, pressed.y - rest.y], name).toEqual([5, 5]);
      expect([pressed.width, pressed.height], name).toEqual([rest.width, rest.height]);

      await page.mouse.up();
      await expect.poll(async () => (await css(button, ["translate"])).translate, name).toBe("none");
      expect((await shadow(button)), name).not.toBe("none");
    }
    // The send button also darkens while pressed.
    const held = page.getByTestId("button-pressed").getByRole("button");
    await expect(held).toHaveCount(3);
    expect((await css(held.first(), ["background-color"]))["background-color"]).toBe(rgb("blue-pressed"));
    for (const button of await held.all()) {
      const s = await css(button, ["translate", "box-shadow"]);
      expect(s).toEqual({ translate: "5px 5px", "box-shadow": "none" });
    }
  });

  test("20: the round button moves 3px into its 3px shadow", async ({ page }) => {
    const round = page.getByTestId("button-round").getByRole("button");
    const rest = await css(round.first(), ["box-shadow", "translate", "border-top-left-radius", "background-color", "transition-duration"]);
    expect(await shadow(round.first())).toBe(`${rgb("ink")} 3px 3px 0px 0px`);
    expect(rest.translate).toBe("none");
    expect(rest["background-color"]).toBe(rgb("blue"));
    expect(rest["transition-duration"]).toBe("0.08s");
    expect(await box(round.first())).toMatchObject({ width: 48, height: 48 });
    expect(parseFloat(rest["border-top-left-radius"])).toBeGreaterThanOrEqual(24);
    expect(await css(round.nth(1), ["translate", "box-shadow"])).toEqual({ translate: "3px 3px", "box-shadow": "none" });
  });

  test("21: Tab shows a 3px blue ring 4px from the edge; a tap does not", async ({ page }) => {
    const send = variant(page, "send");
    const record = variant(page, "record");

    await send.tap();
    await expect(send).toBeFocused();
    expect(await send.evaluate((el) => el.matches(":focus-visible"))).toBe(false);
    expect((await css(send, ["outline-style"]))["outline-style"]).toBe("none");

    await page.keyboard.press("Tab");
    await expect(record).toBeFocused();
    expect(await record.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
    expect(await css(record, ["outline-style", "outline-width", "outline-offset", "outline-color"])).toEqual({
      "outline-style": "solid",
      "outline-width": "3px",
      "outline-offset": "4px",
      "outline-color": rgb("blue"),
    });

    // Tapping the focused button's neighbour takes the ring away again.
    await send.tap();
    expect((await css(record, ["outline-style"]))["outline-style"]).toBe("none");
  });

  test("21: the ring is blue on the page and on a slip, yellow on cloth and on the dark ground", async ({ page }) => {
    const ring = async (locator: Locator) => css(locator, ["outline-style", "outline-width", "outline-offset", "outline-color"]);
    const blue = { "outline-style": "solid", "outline-width": "3px", "outline-offset": "4px", "outline-color": rgb("blue") };
    const yellow = { ...blue, "outline-color": rgb("highlight") };

    // The frozen examples.
    for (const button of await page.getByTestId("button-focus").getByRole("button").all()) expect(await ring(button)).toEqual(blue);
    expect(await ring(page.getByTestId("button-on-cloth").getByRole("button").first())).toEqual(yellow);
    expect(await ring(page.getByTestId("button-on-dark").getByRole("button"))).toEqual(yellow);
    expect((await css(page.getByTestId("button-on-cloth").locator("> div").last(), ["background-color"]))["background-color"]).toBe(rgb("cloth"));
    expect((await css(page.getByTestId("button-on-dark").locator("> div").last(), ["background-color"]))["background-color"]).toBe(rgb("sheet-ground"));

    // Real keyboard focus on cloth: Tab from the first button to the second.
    const onCloth = page.getByTestId("button-on-cloth").getByRole("button");
    await onCloth.first().focus();
    await page.keyboard.press("Tab");
    await expect(onCloth.nth(1)).toBeFocused();
    expect(await ring(onCloth.nth(1))).toEqual(yellow);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(onCloth.nth(3)).toBeFocused();
    expect(await ring(onCloth.nth(3)), "round button on cloth").toEqual(yellow);

    // Real keyboard focus inside a slip: the row link.
    const rows = page.getByTestId("section-row").locator('[lang="en"]');
    await rows.getByRole("button").first().focus();
    await page.keyboard.press("Tab");
    const link = rows.locator("li a[href]").first();
    await expect(link).toBeFocused();
    expect(await ring(link)).toEqual(blue);
  });

  test("22: the frozen busy button stays pressed, shows its busy label, is marked busy and has no spinner", async ({ page }) => {
    const busy = variant(page, "busy");
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect(busy).toHaveText("Opening WhatsApp…");
    expect(await css(busy, ["translate", "box-shadow", "animation-name"])).toEqual({ translate: "5px 5px", "box-shadow": "none", "animation-name": "none" });
    await expect(busy.locator("svg, img, [role='progressbar']")).toHaveCount(0);
    expect(await busy.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
  });

  test("22: a tapped button goes busy and ignores further taps until it is done", async ({ page }) => {
    const demo = page.getByTestId("busy-demo");
    await demo.scrollIntoViewIfNeeded();
    await expect(demo).toHaveAttribute("data-taps", "0");
    await expect(demo).toHaveText("Remind");
    const b = await box(demo);
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;

    await page.touchscreen.tap(x, y);
    await expect(demo).toHaveAttribute("aria-busy", "true");
    await expect(demo).toHaveText("Opening WhatsApp…");
    await expect(demo).toHaveAttribute("data-taps", "1");
    await expect.poll(async () => (await css(demo, ["translate"])).translate).toBe("5px 5px");
    expect((await shadow(demo))).toBe("none");

    // Raw touches, so nothing waits for the button to become available again.
    await page.touchscreen.tap(x, y);
    await page.touchscreen.tap(x, y);
    await page.keyboard.press("Enter");
    await expect(demo).toHaveAttribute("aria-busy", "true");
    await expect(demo).toHaveAttribute("data-taps", "1");

    // It comes back by itself and has still counted one tap.
    await expect(demo).not.toHaveAttribute("aria-busy", "true", { timeout: 5000 });
    await expect(demo).toHaveText("Remind");
    await expect(demo).toHaveAttribute("data-taps", "1");
    await page.touchscreen.tap(x, y);
    await expect(demo).toHaveAttribute("data-taps", "2");
  });

  test("23: disabled is a dashed ink-label outline with no fill and no shadow, cannot be tapped or tabbed to, and says why", async ({ page }) => {
    const disabled = variant(page, "disabled");
    await expect(disabled).toBeDisabled();
    expect(await css(disabled, ["border-top-style", "border-top-width", "border-top-color", "background-color", "box-shadow", "color", "translate"])).toEqual({
      "border-top-style": "dashed",
      "border-top-width": "2px",
      "border-top-color": rgb("ink-label"),
      "background-color": "rgba(0, 0, 0, 0)",
      "box-shadow": "none",
      color: rgb("ink-soft"),
      translate: "none",
    });
    await expect(disabled).toHaveAccessibleDescription("Add a parent's phone number first.");
    await expect(page.getByTestId("button-disabled").getByText("Add a parent's phone number first.")).toBeVisible();

    // A touch does not press it or focus it.
    await disabled.scrollIntoViewIfNeeded();
    const b = await box(disabled);
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await expect(disabled).not.toBeFocused();
    expect((await css(disabled, ["translate"])).translate).toBe("none");

    // The keyboard passes over it: from the button before it, Tab lands on the button after it.
    await page.getByTestId("busy-demo").focus();
    await page.keyboard.press("Tab");
    await expect(variant(page, "long")).toBeFocused();
  });

  test("25: on cloth every button's shadow is cloth-deep", async ({ page }) => {
    const onCloth = page.getByTestId("button-on-cloth").getByRole("button");
    await expect(onCloth).toHaveCount(4);
    for (const index of [0, 1, 2]) {
      expect((await shadow(onCloth.nth(index))), `button ${index}`).toBe(`${rgb("cloth-deep")} 5px 5px 0px 0px`);
    }
    expect((await shadow(onCloth.nth(3))), "round").toBe(`${rgb("cloth-deep")} 3px 3px 0px 0px`);
    // And a slip placed on cloth would be paper again: off cloth, the shadows are the usual ones.
    expect(await shadow(variant(page, "record"))).toBe(`${rgb("ink-label")} 5px 5px 0px 0px`);
  });
});

test.describe("Field: criteria 26 to 32", () => {
  const field = (page: Page, id: string) => page.getByTestId(`field-${id}`).locator("[data-state]");
  const line = (root: Locator) => root.getByRole("textbox").locator("xpath=..");
  const lineStyle = (root: Locator) => css(line(root), ["border-bottom-width", "border-bottom-style", "border-bottom-color", "border-top-width", "border-left-width", "border-right-width", "padding-bottom"]);

  test("26, 27: empty is a label above a 2px ink line with no box, at least 48px tall, placeholder in ink-label", async ({ page }) => {
    const root = field(page, "empty");
    const input = root.getByRole("textbox");
    await expect(page.getByTestId("field-empty").getByLabel("Your UPI ID")).toHaveCount(1);
    const label = await box(root.locator("label"));
    const control = await box(input);
    expect(label.y + label.height).toBeLessThanOrEqual(control.y + 0.5);
    expect((await box(line(root))).height).toBeGreaterThanOrEqual(48);

    expect(await lineStyle(root)).toMatchObject({
      "border-bottom-width": "2px",
      "border-bottom-style": "solid",
      "border-bottom-color": rgb("ink"),
      "border-top-width": "0px",
      "border-left-width": "0px",
      "border-right-width": "0px",
    });
    const own = await css(input, ["border-top-width", "border-bottom-width", "border-left-width", "border-right-width", "background-color", "outline-style", "box-shadow"]);
    expect(own).toEqual({
      "border-top-width": "0px",
      "border-bottom-width": "0px",
      "border-left-width": "0px",
      "border-right-width": "0px",
      "background-color": "rgba(0, 0, 0, 0)",
      "outline-style": "none",
      "box-shadow": "none",
    });
    await expect(input).toHaveAttribute("placeholder", "name@bank");
    expect(await input.evaluate((el) => getComputedStyle(el, "::placeholder").color)).toBe(rgb("ink-label"));
    expect((await css(root.locator("label"), ["color"])).color).toBe(rgb("ink-label"));
  });

  test("28: typing turns the line 4px blue and the label and value blue, and back again", async ({ page }) => {
    const root = field(page, "empty");
    const input = root.getByRole("textbox");
    await input.tap();
    await expect(input).toBeFocused();
    expect(await lineStyle(root)).toMatchObject({ "border-bottom-width": "4px", "border-bottom-style": "solid", "border-bottom-color": rgb("blue") });
    expect((await css(root.locator("label"), ["color"])).color).toBe(rgb("blue"));
    await page.keyboard.type("meena.tui");
    await expect(input).toHaveValue("meena.tui");
    expect((await css(input, ["color"])).color).toBe(rgb("blue"));

    await page.keyboard.press("Tab");
    expect(await lineStyle(root)).toMatchObject({ "border-bottom-width": "2px", "border-bottom-color": rgb("ink") });
    expect((await css(root.locator("label"), ["color"])).color).toBe(rgb("ink-label"));

    // The frozen example shows the same look without focus.
    const frozen = field(page, "typing");
    expect(await lineStyle(frozen)).toMatchObject({ "border-bottom-width": "4px", "border-bottom-color": rgb("blue") });
    expect((await css(frozen.locator("label"), ["color"])).color).toBe(rgb("blue"));
    expect((await css(frozen.getByRole("textbox"), ["color"])).color).toBe(rgb("blue"));
  });

  test("29: correct has a green line, a tick, a message, and says so in words for a screen reader", async ({ page }) => {
    const root = field(page, "correct");
    expect(await lineStyle(root)).toMatchObject({ "border-bottom-width": "2px", "border-bottom-color": rgb("stamp") });
    const tick = root.locator("svg");
    await expect(tick).toBeVisible();
    await expect(tick).toHaveAttribute("aria-hidden", "true");
    expect((await css(tick, ["color"])).color).toBe(rgb("stamp"));
    await expect(root.getByText("That looks like a valid UPI ID.")).toBeVisible();
    await expect(root.getByRole("textbox")).toHaveAccessibleName("Your UPI ID correct");
    await expect(root.getByRole("textbox")).toHaveAccessibleDescription("That looks like a valid UPI ID.");
  });

  test("30: needs fixing has a 3px red line, a mark, the words in the red label, and a message tied to the invalid input", async ({ page }) => {
    const root = field(page, "error");
    expect(await lineStyle(root)).toMatchObject({ "border-bottom-width": "3px", "border-bottom-color": rgb("cloth") });
    await expect(root.locator("svg")).toBeVisible();
    expect((await css(root.locator("svg"), ["color"])).color).toBe(rgb("cloth"));
    expect((await css(root.locator("label"), ["color"])).color).toBe(rgb("cloth"));
    await expect(root.locator("label").getByText("needs fixing")).toBeVisible();
    await expect(root.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    await expect(root.getByRole("textbox")).toHaveAccessibleDescription("Add the part after @, like name@bank");
    await expect(root.getByText("Add the part after @, like name@bank")).toBeVisible();
    // Red is a line and words here, never a button.
    await expect(root.locator("button")).toHaveCount(0);
  });

  test("31: the four states have the same outer height and leave what follows in the same place", async ({ page }) => {
    const heights: number[] = [];
    const exampleHeights: number[] = [];
    const lineHeights: number[] = [];
    for (const id of ["empty", "typing", "correct", "error"]) {
      heights.push((await box(field(page, id))).height);
      exampleHeights.push((await box(page.getByTestId(`field-${id}`))).height);
      lineHeights.push((await box(line(field(page, id)))).height);
    }
    expect(new Set(heights).size, `field heights ${heights.join(", ")}`).toBe(1);
    expect(new Set(exampleHeights).size, `example heights ${exampleHeights.join(", ")}`).toBe(1);
    expect(new Set(lineHeights).size, `line heights ${lineHeights.join(", ")}`).toBe(1);

    // The examples sit in one column, so equal heights mean equal steps from one to the next.
    const tops: number[] = [];
    for (const id of ["empty", "typing", "correct", "error", "helper"]) tops.push((await box(page.getByTestId(`field-${id === "helper" ? "helper" : id}`))).y);
    const steps = [tops[1] - tops[0], tops[2] - tops[1], tops[3] - tops[2]];
    expect(new Set(steps).size, `steps ${steps.join(", ")}`).toBe(1);

    // One field moving through the states: focusing it changes nothing around it.
    const root = field(page, "empty");
    const next = page.getByTestId("field-typing");
    // Document coordinates: focusing scrolls the page, which must not count as movement.
    const before = { field: await docBox(root), next: await docBox(next), input: await docBox(root.getByRole("textbox")) };
    await root.getByRole("textbox").focus();
    expect((await lineStyle(root))["border-bottom-width"]).toBe("4px");
    expect(await docBox(root)).toEqual(before.field);
    expect(await docBox(next)).toEqual(before.next);
    expect(await docBox(root.getByRole("textbox"))).toEqual(before.input);
    // Typing a value that fits on one line changes nothing either.
    await page.keyboard.type("meena@okhdfc");
    await expect(root.getByRole("textbox")).toHaveValue("meena@okhdfc");
    expect(await docBox(root)).toEqual(before.field);
    expect(await docBox(next)).toEqual(before.next);
    expect(await docBox(root.getByRole("textbox"))).toEqual(before.input);
  });

  const LONG_VALUE = "meena.kumari.sharma.tuitions.bengaluru@okhdfcbank";

  for (const lang of langs) {
    test(`a long value in a ${lang} field wraps and the field grows, in all four states, with the mark still beside it`, async ({ page }) => {
      const roots =
        lang === "en"
          ? { idle: field(page, "empty"), correct: field(page, "correct"), error: field(page, "error") }
          : (() => {
              const block = page.getByTestId("section-field").getByTestId(`lang-${lang}`).locator("[data-state]");
              return { idle: block.nth(0), correct: block.nth(1), error: block.nth(2) };
            })();
      const lineWant = {
        idle: { "border-bottom-width": "2px", "border-bottom-color": rgb("ink") },
        typing: { "border-bottom-width": "4px", "border-bottom-color": rgb("blue") },
        correct: { "border-bottom-width": "2px", "border-bottom-color": rgb("stamp") },
        error: { "border-bottom-width": "3px", "border-bottom-color": rgb("cloth") },
      };

      const check = async (root: Locator, state: keyof typeof lineWant, hasMark: boolean, before: { field: number; control: number }) => {
        const control = root.getByRole("textbox");
        const what = `${lang} ${state}${hasMark ? " with a mark" : ""}`;
        await expect(control, what).toHaveValue(LONG_VALUE);
        expect(await lineStyle(root), what).toMatchObject(lineWant[state]);
        const lineHeight = parseFloat((await css(control, ["line-height"]))["line-height"]);
        const c = await docBox(control);
        const wrapper = await docBox(line(root));
        const whole = await docBox(root);
        // Two lines or more, all of them shown.
        expect(c.height, what).toBeGreaterThanOrEqual(2 * lineHeight);
        expect(await control.evaluate((el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1), what).toBe(true);
        // The field grew by exactly what the value grew by, and by more than half a line.
        expect(c.height - before.control, what).toBeGreaterThan(lineHeight / 2);
        expect(whole.height - before.field, what).toBeCloseTo(c.height - before.control, 1);
        // The value sits on the line: the line is drawn below every row of it, and the note below the line.
        expect(c.x, what).toBeGreaterThanOrEqual(wrapper.x - 0.5);
        expect(c.y + c.height, what).toBeLessThanOrEqual(wrapper.y + wrapper.height + 0.5);
        const note = await docBox(root.locator("> p"));
        expect(note.y, what).toBeGreaterThanOrEqual(wrapper.y + wrapper.height - 0.5);
        expect(wrapper.x + wrapper.width, what).toBeLessThanOrEqual(360);
        // The tick or error mark stays beside the value, full size, inside the line.
        const marks = root.locator("svg");
        expect(await marks.count(), what).toBe(hasMark ? 1 : 0);
        if ((await marks.count()) === 1) {
          const m = await docBox(marks);
          expect([m.width, m.height], what).toEqual([24, 24]);
          expect(m.x, what).toBeGreaterThanOrEqual(c.x + c.width - 0.5);
          expect(m.x + m.width, what).toBeLessThanOrEqual(wrapper.x + wrapper.width + 0.5);
          expect(m.y, what).toBeGreaterThanOrEqual(wrapper.y - 0.5);
          expect(m.y + m.height, what).toBeLessThanOrEqual(wrapper.y + wrapper.height + 0.5);
        }
        // The shared checker agrees: nothing cut, clipped, overlapping or under the mark.
        await root.evaluate((el) => el.setAttribute("data-e2e-field", "now"));
        expect(await textProblems(page, '[data-e2e-field="now"]'), what).toEqual([]);
        await root.evaluate((el) => el.removeAttribute("data-e2e-field"));
      };

      for (const state of ["idle", "correct", "error"] as const) {
        const root = roots[state];
        const control = root.getByRole("textbox");
        const before = { field: (await docBox(root)).height, control: (await docBox(control)).height };
        await control.fill(LONG_VALUE);
        // Still focused after filling: this is the typing look, whatever the field's own state.
        await expect(control).toBeFocused();
        await check(root, "typing", state !== "idle", before);
        await control.blur();
        await check(root, state, state !== "idle", before);
      }
      expect(await sidewaysScroll(page)).toBe(0);

      // Given a short value again, a field goes back to one row and its first height.
      const root = roots.correct;
      const control = root.getByRole("textbox");
      const tall = (await docBox(root)).height;
      await control.fill("a@b");
      await control.blur();
      expect((await docBox(root)).height).toBeLessThan(tall);
      expect((await docBox(control)).height).toBeLessThan(2 * parseFloat((await css(control, ["line-height"]))["line-height"]));
    });
  }

  test("the frozen typing example also grows with a long value", async ({ page }) => {
    const root = field(page, "typing");
    const control = root.getByRole("textbox");
    const before = await docBox(root);
    await control.fill(LONG_VALUE);
    await control.blur();
    expect((await lineStyle(root))["border-bottom-width"]).toBe("4px");
    expect((await docBox(root)).height).toBeGreaterThan(before.height);
    expect(await control.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  });

  test("Enter in a field inside a form submits the form once and never adds a line", async ({ page }) => {
    const root = field(page, "empty");
    const control = root.getByRole("textbox");
    // The page has no form, so the test puts one round the field, in place.
    await root.evaluate((el) => {
      const form = document.createElement("form");
      form.setAttribute("data-e2e", "form");
      form.setAttribute("data-submits", "0");
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        form.setAttribute("data-submits", String(Number(form.getAttribute("data-submits")) + 1));
      });
      el.parentNode!.insertBefore(form, el);
      form.append(el);
    });
    const form = page.locator('form[data-e2e="form"]');
    await control.tap();
    await page.keyboard.type("meena@okhdfc");
    const height = (await docBox(control)).height;
    await page.keyboard.press("Enter");
    await expect(form).toHaveAttribute("data-submits", "1");
    await expect(control).toHaveValue("meena@okhdfc");
    expect(await control.evaluate((el) => (el as HTMLTextAreaElement).value.includes("\n"))).toBe(false);
    expect((await docBox(control)).height).toBe(height);
    // Typing goes on after it on the same line.
    await page.keyboard.type("bank");
    await expect(control).toHaveValue("meena@okhdfcbank");
    // Shift+Enter is no way round it.
    await page.keyboard.press("Shift+Enter");
    await expect(control).toHaveValue("meena@okhdfcbank");
    expect((await docBox(control)).height).toBe(height);
    await expect(form).toHaveAttribute("data-submits", "2");
  });

  test("Enter in a field with no form round it does nothing and adds no line", async ({ page }) => {
    const control = field(page, "empty").getByRole("textbox");
    await control.tap();
    await page.keyboard.type("meena");
    const height = (await docBox(control)).height;
    await page.keyboard.press("Enter");
    await page.keyboard.type("@okhdfc");
    await expect(control).toHaveValue("meena@okhdfc");
    expect((await docBox(control)).height).toBe(height);
  });

  test("pasted text with line breaks ends up as one line", async ({ page, context }) => {
    const control = field(page, "empty").getByRole("textbox");
    await control.tap();
    const height = (await docBox(control)).height;

    // Inserted in one go, as a paste or an input method does.
    await page.keyboard.insertText("meena\ntuitions \r\n  @okhdfc");
    await expect(control).toHaveValue("meena tuitions @okhdfc");
    expect((await docBox(control)).height).toBe(height);

    // A real paste from the clipboard.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await control.fill("");
    await page.evaluate(() => navigator.clipboard.writeText("name\n@bank\n"));
    await control.focus();
    await page.keyboard.press("ControlOrMeta+V");
    await expect(control).toHaveValue("name @bank ");
    expect(await control.evaluate((el) => /[\r\n]/.test((el as HTMLTextAreaElement).value))).toBe(false);
    expect((await docBox(control)).height).toBe(height);

    // It is announced as a single-line text box.
    await expect(control).toHaveAttribute("aria-multiline", "false");
    await expect(control).toHaveAttribute("rows", "1");
  });

  test("32: helper text is at least 14px, and a long label and a long message wrap", async ({ page }) => {
    const helper = page.getByTestId("field-helper").getByText("Parents pay you directly to this ID.");
    await expect(helper).toBeVisible();
    expect(parseFloat((await css(helper, ["font-size"]))["font-size"])).toBeGreaterThanOrEqual(14);
    await expect(page.getByTestId("field-helper").getByRole("textbox")).toHaveAccessibleDescription("Parents pay you directly to this ID.");

    for (const lang of langs) {
      const root =
        lang === "en"
          ? field(page, "long")
          : page.getByTestId("section-field").getByTestId(`lang-${lang}`).locator('[data-state="error"]');
      const label = root.locator("label");
      const message = root.locator("p");
      expect(await lineCount(label), `${lang} label`).toBeGreaterThanOrEqual(2);
      expect(await lineCount(message), `${lang} message`).toBeGreaterThanOrEqual(2);
      for (const el of [label, message]) {
        const s = await css(el, ["text-overflow", "overflow-x", "white-space", "font-size"]);
        expect(s["text-overflow"], lang).toBe("clip");
        expect(s["overflow-x"], lang).toBe("visible");
        expect(s["white-space"], lang).toBe("normal");
        expect(parseFloat(s["font-size"]), lang).toBeGreaterThanOrEqual(14);
        expect(await el.evaluate((node) => node.scrollWidth <= node.clientWidth), lang).toBe(true);
      }
    }
  });
});

test.describe("Headline amounts shrink to fit (follow-up to criterion 63; replaces the mid-number break)", () => {
  const scales = [
    { name: "at the default text size", root: 1, apply: null },
    { name: "with the root font size at 130%", root: 1.3, apply: () => document.documentElement.style.setProperty("font-size", "130%") },
    { name: "with text-only scaling at 130%", root: 1, apply: () => document.documentElement.style.setProperty("text-size-adjust", "130%") },
  ];
  const AMOUNTS = '[data-rupee="headline"], [data-rupee="fit"], [data-role="amount"]';

  for (const scale of scales) {
    test(`${scale.name}: every amount, six and seven digits included, is on one line inside its space and at least 14px`, async ({ page }) => {
      const body = page.getByTestId("section-type").locator('[lang="en"] [data-role="body"]');
      if (scale.apply) {
        await page.evaluate(scale.apply);
        await expect.poll(async () => (await css(body, ["font-size"]))["font-size"]).toBe("20.8px");
        await fontsSettled(page);
      }
      const amounts = page.locator(AMOUNTS);
      await expect(amounts).toHaveCount(13);
      const texts = await amounts.allTextContents();
      expect(texts).toContain("₹1,23,456");
      expect(texts).toContain("₹9,87,650");
      expect(texts.filter((t) => t === "₹99,99,999")).toHaveLength(2);

      let shrunk = 0;
      let atToken = 0;
      for (const amount of await amounts.all()) {
        const m = await amount.evaluate((el) => {
          let space: HTMLElement | null = el.parentElement;
          while (space && getComputedStyle(space).containerType !== "inline-size") space = space.parentElement;
          if (!space) throw new Error("The amount has no amount-box round it");
          const range = document.createRange();
          range.selectNodeContents(el);
          const ink = range.getBoundingClientRect();
          const outer = space.getBoundingClientRect();
          const s = getComputedStyle(el);
          return {
            text: el.textContent ?? "",
            size: parseFloat(s.fontSize),
            whiteSpace: s.whiteSpace,
            adjust: s.getPropertyValue("text-size-adjust"),
            em: parseFloat(s.getPropertyValue("--amount-em")),
            token: el.classList.contains("amount-size-7xl") ? 72 : el.classList.contains("amount-size-6xl") ? 60 : 0,
            ink: { left: ink.left, right: ink.right, width: ink.width },
            space: { left: outer.left, right: outer.right, width: space.clientWidth },
          };
        });
        const what = `${m.text} in ${m.space.width}px`;
        expect(m.token, what).not.toBe(0);
        expect(m.em, what).toBeGreaterThan(1);
        expect(await lineCount(amount), what).toBe(1);
        expect(m.whiteSpace, what).toBe("nowrap");
        await expect(amount).toHaveText(/^₹[0-9,]+$/);
        // The digits begin and end inside the amount's own space, and inside the screen.
        expect(m.ink.left, what).toBeGreaterThanOrEqual(m.space.left - 0.5);
        expect(m.ink.right, what).toBeLessThanOrEqual(m.space.right + 0.5);
        expect(m.ink.right, what).toBeLessThanOrEqual(360);
        // Never under 14px.
        expect(m.size, what).toBeGreaterThanOrEqual(14);
        // The size is the token (which follows the root font size), or what fits, whichever is smaller.
        const token = m.token * scale.root;
        const expected = Math.max(14 * scale.root, Math.min(token, m.space.width / m.em));
        expect(Math.abs(m.size - expected), `${what}: ${m.size}px, expected ${expected.toFixed(2)}px`).toBeLessThanOrEqual(0.1);
        if (m.size < token - 0.1) {
          shrunk++;
          // Shrunk no further than needed: it uses nearly all of its space.
          expect(m.ink.width / m.space.width, `${what} fills its space`).toBeGreaterThanOrEqual(0.9);
        } else {
          atToken++;
        }
      }
      // The page shows both cases at every scale: amounts at full size and amounts that had to shrink.
      expect(shrunk).toBeGreaterThanOrEqual(4);
      expect(atToken).toBeGreaterThanOrEqual(scale.root === 1 ? 4 : 1);
      expect(await sidewaysScroll(page)).toBe(0);
    });
  }

  test("a fitted amount still grows with the root font size, but not with text-only scaling", async ({ page }) => {
    // "₹18,500" at the 60px size has room to spare at 360px, so it shows the scaling plainly.
    const amount = page.getByTestId("section-type").locator('[lang="en"] [data-role="amount"]');
    const body = page.getByTestId("section-type").locator('[lang="en"] [data-role="body"]');
    const width = async () => amount.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect().width;
    });
    // The amount role declares `text-size-adjust: none`. Chromium reports that as "100%", which is
    // also what every other element on the page already has (Tailwind's base styles set it on <html>).
    expect((await css(amount, ["font-size", "text-size-adjust"]))).toEqual({ "font-size": "60px", "text-size-adjust": "100%" });
    expect((await css(page.locator("html"), ["text-size-adjust"]))["text-size-adjust"]).toBe("100%");
    expect((await css(body, ["text-size-adjust"]))["text-size-adjust"]).toBe("100%");
    const drawn = await width();

    await page.evaluate(() => document.documentElement.style.setProperty("font-size", "130%"));
    await expect.poll(async () => (await css(amount, ["font-size"]))["font-size"]).toBe("78px");
    expect((await width()) / drawn).toBeCloseTo(1.3, 1);

    // As built: with text-only scaling the reading text grows to 20.8px and the amount stays as it was.
    await page.evaluate(() => {
      document.documentElement.style.removeProperty("font-size");
      document.documentElement.style.setProperty("text-size-adjust", "130%");
    });
    await expect.poll(async () => (await css(body, ["font-size"]))["font-size"]).toBe("20.8px");
    expect((await css(amount, ["font-size"]))["font-size"]).toBe("60px");
    expect((await width()) / drawn).toBeCloseTo(1, 2);
    // Amounts that are not fitted (reading size inside a sentence, row amounts) do follow it.
    const inline = page.getByTestId("section-rupee").locator('[lang="hi"] [data-rupee="reading"]');
    expect((await css(inline, ["font-size"]))["font-size"]).toBe("23.4px");
    const row = page.getByTestId("section-type").locator('[lang="en"] [data-role="amount-row"]');
    expect((await css(row, ["font-size"]))["font-size"]).toBe("20.8px");
  });

  test("in a space too narrow for 14px the amount stops at 14px and stays on one line", async ({ page }) => {
    const amount = page.getByTestId("rupee-fit-narrow").locator('[data-rupee="fit"]').last();
    await expect(amount).toHaveText("₹99,99,999");
    await amount.evaluate((el) => ((el.parentElement as HTMLElement).style.width = "40px"));
    await expect.poll(async () => (await css(amount, ["font-size"]))["font-size"]).toBe("14px");
    expect(await lineCount(amount)).toBe(1);
  });
});

test.describe("Slip: criteria 33, 34, 35", () => {
  test("33: slip surface, 2px ink border, square corners, a 6px solid ink shadow", async ({ page }) => {
    const slip = page.getByTestId("slip-standard").locator("> div");
    const s = await css(slip, ["background-color", "border-top-width", "border-right-width", "border-bottom-width", "border-left-width", "border-top-style", "border-top-color", "border-top-left-radius", "border-bottom-right-radius"]);
    expect(await shadow(slip)).toBe(`${rgb("ink")} 6px 6px 0px 0px`);
    expect(s).toEqual({
      "background-color": rgb("slip"),
      "border-top-width": "2px",
      "border-right-width": "2px",
      "border-bottom-width": "2px",
      "border-left-width": "2px",
      "border-top-style": "solid",
      "border-top-color": rgb("ink"),
      "border-top-left-radius": "0px",
      "border-bottom-right-radius": "0px",
    });
  });

  test("34: the joined form has no shadow, and no line shows between the selected tab and the slip", async ({ page }) => {
    const joined = page.getByTestId("slip-joined").locator("> div");
    expect((await css(joined, ["box-shadow", "border-top-width", "background-color"]))).toEqual({ "box-shadow": "none", "border-top-width": "2px", "background-color": rgb("slip") });

    for (const lang of langs) {
      const demo = page.getByTestId(`tabs-tabs-${lang}`);
      await demo.scrollIntoViewIfNeeded();
      const panel = demo.getByRole("tabpanel");
      expect((await shadow(panel)), lang).toBe("none");
      const selected = await box(demo.getByRole("tab", { selected: true }));
      const idle = await box(demo.getByRole("tab", { selected: false }).first());
      const slip = await box(panel);
      // The selected tab stands on the slip's top edge.
      expect(selected.y + selected.height, lang).toBeCloseTo(slip.y, 0);

      // Look at the pixels of the slip's top border: slip colour under the selected tab, ink under the others.
      const shot = await pixels(page, { x: 0, y: slip.y - 4, width: 360, height: 10 });
      const borderRow = 5; // 1px into the 2px border
      const underSelected = shot.at(selected.x + selected.width / 2, borderRow);
      const underIdle = shot.at(idle.x + idle.width / 2, borderRow);
      expect(near(underSelected, rgbTuple("slip")), `${lang}: under the selected tab the border is ${underSelected}`).toBe(true);
      expect(near(underIdle, rgbTuple("ink")), `${lang}: under an unselected tab the border is ${underIdle}`).toBe(true);
      // The selected tab's own side borders run down into the slip's, so the outline stays closed.
      expect(near(shot.at(selected.x + 1, borderRow), rgbTuple("ink")), lang).toBe(true);
    }
  });

  test("35: a slip across the full 360px, shadow included, adds no sideways scroll", async ({ page }) => {
    const slip = page.getByTestId("slip-standard").locator("> div");
    // As the page shows it: inside the page padding, shadow within the screen.
    const shown = await box(slip);
    expect(shown.x + shown.width + 6).toBeLessThanOrEqual(360);
    expect(await sidewaysScroll(page)).toBe(0);

    // Edge to edge: pull this one slip out over the page padding so it spans the screen and its shadow hangs off the right.
    await slip.evaluate((el) => {
      const pad = el.getBoundingClientRect().left;
      (el as HTMLElement).style.marginInline = `-${pad}px`;
    });
    const full = await box(slip);
    expect([full.x, full.width]).toEqual([0, 360]);
    expect((await shadow(slip))).toBe(`${rgb("ink")} 6px 6px 0px 0px`);
    expect(await sidewaysScroll(page)).toBe(0);
    await page.evaluate(() => window.scrollTo(100, window.scrollY));
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
  });
});

test.describe("Row: criteria 36, 38, 39", () => {
  const rows = (page: Page, lang: string) => page.getByTestId("section-row").getByTestId(`lang-${lang}`).locator("li");

  for (const lang of langs) {
    test(`36: ${lang} rows are at least 64px tall with a 1px rule below; name and meta left, amount right, trailing item last`, async ({ page }) => {
      const all = rows(page, lang);
      const count = await all.count();
      expect(count).toBeGreaterThanOrEqual(5);
      for (let i = 0; i < count; i++) {
        const row = all.nth(i);
        expect((await box(row)).height, `row ${i}`).toBeGreaterThanOrEqual(64);
        expect(await css(row, ["border-bottom-width", "border-bottom-style", "border-bottom-color"]), `row ${i}`).toEqual({
          "border-bottom-width": "1px",
          "border-bottom-style": "solid",
          "border-bottom-color": rgb("rule"),
        });
      }
      const first = all.first();
      const name = await box(first.locator("span > span").first());
      const meta = await box(first.locator("[data-tone]"));
      const amount = await box(first.locator('[translate="no"]'));
      const action = await box(first.getByRole("button"));
      expect(name.y + name.height).toBeLessThanOrEqual(meta.y + 0.5);
      expect(name.x + name.width).toBeLessThanOrEqual(amount.x);
      expect(amount.x + amount.width).toBeLessThanOrEqual(action.x);
      expect([action.width, action.height]).toEqual([48, 48]);
      // The three tones, each with words.
      expect((await css(all.nth(0).locator("[data-tone]"), ["color"])).color).toBe(rgb("cloth"));
      expect((await css(all.nth(1).locator("[data-tone]"), ["color"])).color).toBe(rgb("ink-soft"));
      expect((await css(all.nth(2).locator("[data-tone]"), ["color"])).color).toBe(rgb("stamp"));
      for (const i of [0, 1, 2]) await expect(all.nth(i).locator("[data-tone]")).toHaveText(/\S/);
    });

    test(`38: a long ${lang} name and meta wrap and the row grows; the amount and the action keep their size`, async ({ page }) => {
      const all = rows(page, lang);
      const normal = all.nth(3);
      const long = all.nth(4);
      const name = long.locator("a > span > span").first();
      const meta = long.locator("[data-tone]");
      expect(await lineCount(name)).toBeGreaterThanOrEqual(2);
      expect(await lineCount(meta)).toBeGreaterThanOrEqual(2);
      expect((await box(long)).height).toBeGreaterThan((await box(normal)).height);
      for (const el of [name, meta]) {
        const s = await css(el, ["text-overflow", "overflow-x", "overflow-y", "white-space"]);
        expect(s).toEqual({ "text-overflow": "clip", "overflow-x": "visible", "overflow-y": "visible", "white-space": "normal" });
        expect(await el.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      }
      // Every line of the name and the meta is inside the row.
      const rowBox = await box(long);
      const nameBox = await box(name);
      const metaBox = await box(meta);
      expect(nameBox.y).toBeGreaterThanOrEqual(rowBox.y);
      expect(metaBox.y + metaBox.height).toBeLessThanOrEqual(rowBox.y + rowBox.height);

      // Same amount text in both rows: same width, one line, never squeezed.
      const amountLong = long.locator('[translate="no"]');
      const amountNormal = normal.locator('[translate="no"]');
      await expect(amountLong).toHaveText("₹1,23,456");
      await expect(amountNormal).toHaveText("₹1,23,456");
      expect((await box(amountLong)).width).toBe((await box(amountNormal)).width);
      expect(await lineCount(amountLong)).toBe(1);
      expect((await css(amountLong, ["white-space", "flex-shrink"]))).toEqual({ "white-space": "nowrap", "flex-shrink": "0" });
      const action = await box(long.getByRole("button"));
      expect([action.width, action.height]).toEqual([48, 48]);
      // Nothing is pushed off the slip.
      const slip = await box(long.locator("xpath=ancestor::ul/.."));
      expect(action.x + action.width).toBeLessThanOrEqual(slip.x + slip.width);
      expect(nameBox.x).toBeGreaterThanOrEqual(slip.x);
    });

    test(`39: a ${lang} row that is a link with an action has two separate targets, each 44px or taller, each reached by Tab`, async ({ page }) => {
      const row = rows(page, lang).nth(3);
      const link = row.locator("a[href]");
      const action = row.getByRole("button");
      await expect(link).toHaveCount(1);
      await expect(action).toHaveCount(1);
      // Separate: the action is not inside the link, and their boxes do not overlap.
      await expect(link.locator("button, a")).toHaveCount(0);
      const l = await box(link);
      const a = await box(action);
      expect(l.height).toBeGreaterThanOrEqual(44);
      expect(l.width).toBeGreaterThanOrEqual(44);
      expect(a.height).toBeGreaterThanOrEqual(44);
      expect(a.width).toBeGreaterThanOrEqual(44);
      expect(l.x + l.width).toBeLessThanOrEqual(a.x);
      await expect(action).toHaveAccessibleName(/\S/);

      // Keyboard: Tab from whatever comes before reaches the link, then the action.
      await rows(page, lang).first().getByRole("button").focus();
      await page.keyboard.press("Tab");
      await expect(link).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(action).toBeFocused();

      // Tapping the action does not follow the link.
      await page.evaluate(() => (location.hash = ""));
      await action.tap();
      expect(await page.evaluate(() => location.hash)).toBe("");
      await link.tap();
      expect(await page.evaluate(() => location.hash)).toBe("#top");
    });
  }
});

test.describe("StatusTag: criteria 41, 42, 43", () => {
  const tags = (page: Page, lang: string) => page.getByTestId("section-status-tag").getByTestId(`lang-${lang}`);
  const tag = (page: Page, lang: string, status: string) => tags(page, lang).locator(`[data-status="${status}"]`).first();

  test("41: overdue is a 2px solid red outline, due a yellow fill, part paid a 2px dashed blue outline, paid a double green outline", async ({ page }) => {
    const props = ["border-top-style", "border-top-width", "border-top-color", "background-color", "color"] as const;
    for (const lang of langs) {
      expect(await css(tag(page, lang, "overdue"), props), lang).toEqual({ "border-top-style": "solid", "border-top-width": "2px", "border-top-color": rgb("cloth"), "background-color": "rgba(0, 0, 0, 0)", color: rgb("cloth") });
      expect(await css(tag(page, lang, "due"), props), lang).toMatchObject({ "border-top-width": "0px", "background-color": rgb("highlight"), color: rgb("ink") });
      expect(await css(tag(page, lang, "part-paid"), props), lang).toEqual({ "border-top-style": "dashed", "border-top-width": "2px", "border-top-color": rgb("blue"), "background-color": "rgba(0, 0, 0, 0)", color: rgb("blue") });
      expect(await css(tag(page, lang, "paid"), props), lang).toMatchObject({ "border-top-style": "double", "border-top-color": rgb("stamp"), "background-color": "rgba(0, 0, 0, 0)", color: rgb("stamp") });
      await expect(tags(page, lang).locator("[data-status]")).toHaveCount(6);
    }
    // No tag anywhere on the page has a status outside the four.
    const statuses = await page.locator("[data-status]").evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("data-status")))].sort());
    expect(statuses).toEqual(["due", "overdue", "paid", "part-paid"]);
  });

  test("42: with colour removed the four differ by outline style and fill, and the double outline is two lines", async ({ page }, testInfo) => {
    // Without colour, what is left is the outline style and whether there is a fill. No two tags share both.
    const marks: string[] = [];
    for (const status of ["overdue", "due", "part-paid", "paid"]) {
      const s = await css(tag(page, "en", status), ["border-top-style", "border-top-width", "background-color"]);
      // A border of no width draws nothing, whatever its style says.
      const outline = s["border-top-width"] === "0px" ? "none" : s["border-top-style"];
      marks.push(`${outline}/${s["background-color"] === "rgba(0, 0, 0, 0)" ? "no fill" : "fill"}`);
      await expect(tag(page, "en", status)).toHaveText(/\S/);
    }
    expect(marks).toEqual(["solid/no fill", "none/fill", "dashed/no fill", "double/no fill"]);

    await page.evaluate(() => (document.documentElement.style.filter = "grayscale(1)"));
    const example = tags(page, "en").locator("> div").first();
    await example.scrollIntoViewIfNeeded();
    for (const lang of langs) {
      await tags(page, lang).scrollIntoViewIfNeeded();
      await attachScreenshot(testInfo, `status-tags-greyscale-${lang}.png`, await tags(page, lang).screenshot());
    }
    await example.scrollIntoViewIfNeeded();

    // The screenshot really is grey.
    const paid = await box(tag(page, "en", "paid"));
    const due = await box(tag(page, "en", "due"));
    const overdue = await box(tag(page, "en", "overdue"));
    const strip = async (b: { x: number; y: number; height: number }) => pixels(page, { x: b.x - 3, y: b.y + b.height / 2, width: 13, height: 1 });
    const luma = (p: readonly number[]) => p[0];
    const runs = (shot: Awaited<ReturnType<typeof strip>>) => {
      // Dark runs along a line that crosses the tag's left edge: one per drawn line of the outline.
      let count = 0;
      let dark = false;
      for (let x = 0; x < shot.width; x++) {
        const p = shot.at(x, 0);
        expect(Math.abs(p[0] - p[1]) + Math.abs(p[1] - p[2]), "pixel is grey").toBeLessThanOrEqual(6);
        const isDark = luma(p) < 170;
        if (isDark && !dark) count++;
        dark = isDark;
      }
      return count;
    };
    expect(runs(await strip(paid)), "paid: two lines across its left edge").toBe(2);
    expect(runs(await strip(overdue)), "overdue: one line across its left edge").toBe(1);
    expect(runs(await strip(due)), "due: no outline").toBe(0);
    // The due tag's fill is still visibly darker than the slip around it.
    const inside = (await pixels(page, { x: due.x + 2, y: due.y + 2, width: 1, height: 1 })).at(0, 0);
    const outside = (await pixels(page, { x: due.x - 3, y: due.y + 2, width: 1, height: 1 })).at(0, 0);
    expect(luma(outside) - luma(inside)).toBeGreaterThan(25);
  });

  test("43: the tag shows the words it was given; label style in English", async ({ page }) => {
    await expect(tag(page, "en", "overdue")).toHaveText("Overdue 7 days");
    await expect(tag(page, "en", "due")).toHaveText("Due 12 Oct");
    await expect(tag(page, "en", "part-paid")).toHaveText("Part paid");
    await expect(tag(page, "en", "paid")).toHaveText("Paid");
    const mono = await familyOf(page, "--font-dm-mono");
    for (const status of ["overdue", "due", "part-paid", "paid"]) {
      const el = tag(page, "en", status);
      expect(await firstFamily(el), status).toBe(mono);
      const s = await css(el, ["font-size", "font-weight", "text-transform", "letter-spacing"]);
      expect(s["font-size"], status).toBe("14px");
      expect(s["font-weight"], status).toBe("500");
      expect(s["text-transform"], status).toBe("uppercase");
      expect(parseFloat(s["letter-spacing"]), status).toBeCloseTo(0.56, 2);
    }
  });

  for (const lang of indicLangs) {
    test(`43: ${lang} tags are Anek 600 at 15px with no capitals and no letter-spacing`, async ({ page }) => {
      const anek = await familyOf(page, scriptFontVariable[lang]);
      for (const status of ["overdue", "due", "part-paid", "paid"]) {
        const el = tag(page, lang, status);
        await expect(el).toHaveText(/\S/);
        expect(await firstFamily(el), status).toBe(anek);
        expect(await css(el, ["font-size", "font-weight", "text-transform", "letter-spacing"]), status).toEqual({
          "font-size": "15px",
          "font-weight": "600",
          "text-transform": "none",
          "letter-spacing": "normal",
        });
      }
    });
  }

  for (const lang of langs) {
    test(`43: a long ${lang} tag wraps inside a narrow column and is not truncated`, async ({ page }) => {
      const column = tags(page, lang).locator("> div").nth(1).locator("> div");
      const columnBox = await box(column);
      expect(columnBox.width).toBe(160);
      for (const status of ["overdue", "paid"]) {
        const long = column.locator(`[data-status="${status}"]`);
        expect(await lineCount(long), status).toBeGreaterThanOrEqual(2);
        const b = await box(long);
        expect(b.width, status).toBeLessThanOrEqual(160);
        expect(b.x + b.width, status).toBeLessThanOrEqual(columnBox.x + columnBox.width + 0.5);
        const s = await css(long, ["text-overflow", "overflow-x", "overflow-y", "white-space"]);
        expect(s, status).toEqual({ "text-overflow": "clip", "overflow-x": "visible", "overflow-y": "visible", "white-space": "normal" });
        expect(await long.evaluate((node) => node.scrollWidth <= node.clientWidth), status).toBe(true);
      }
    });
  }
});

test.describe("Stamp: criteria 44, 45, 47, 48", () => {
  test("44: a double-ring circle in three sizes, 52, 132 and 232px, with its words tilted -12 degrees", async ({ page }) => {
    const sizes = { sm: 52, md: 132, lg: 232 };
    for (const [size, px] of Object.entries(sizes)) {
      for (const stamp of await page.getByTestId(`stamp-${size}`).locator("[data-size]").all()) {
        const b = await box(stamp);
        expect([b.width, b.height], size).toEqual([px, px]);
        const s = await css(stamp, ["border-top-style", "border-top-left-radius", "rotate", "transform"]);
        expect(s["border-top-style"], size).toBe("double");
        expect(parseFloat(s["border-top-left-radius"]), size).toBeGreaterThanOrEqual(px / 2);
        // As built: the ring itself is not turned (a circle looks the same at any angle); the words are.
        expect([s.rotate, s.transform], size).toEqual(["none", "none"]);
        expect((await css(stamp.locator("> span"), ["rotate"])).rotate, size).toBe("-12deg");
      }
    }
    // Rotation is for stamps only.
    const tilted = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll("*")) {
        const s = getComputedStyle(el);
        if (s.rotate !== "none" && !el.parentElement?.hasAttribute("data-size")) out.push(el.tagName);
      }
      return out;
    });
    expect(tilted).toEqual([]);
  });

  test("45: PAID and ALL PAID are green, SENT is blue; a second line shows on md and lg only, 14px or larger", async ({ page }) => {
    const small = page.getByTestId("stamp-sm").locator("[data-size]");
    const medium = page.getByTestId("stamp-md").locator("[data-size]");
    const large = page.getByTestId("stamp-lg").locator("[data-size]");
    for (const [group, words] of [
      [small, ["PAID", "SENT"]],
      [medium, ["PAID", "SENT"]],
      [large, ["ALL PAID", "SENT"]],
    ] as const) {
      await expect(group.nth(0).locator(".type-stamp")).toHaveText(words[0]);
      await expect(group.nth(1).locator(".type-stamp")).toHaveText(words[1]);
      expect(await css(group.nth(0), ["color", "border-top-color"])).toEqual({ color: rgb("stamp"), "border-top-color": rgb("stamp") });
      expect(await css(group.nth(1), ["color", "border-top-color"])).toEqual({ color: rgb("blue"), "border-top-color": rgb("blue") });
    }
    await expect(medium.nth(0)).toContainText("08 Oct 2026");
    await expect(medium.nth(1)).toContainText("1 of 5");
    await expect(large.nth(0)).toContainText("Oct 2026");
    for (const second of [...(await medium.locator("> span > span").nth(1).all()), ...(await large.locator("> span > span").nth(1).all())]) {
      expect(parseFloat((await css(second, ["font-size"]))["font-size"])).toBeGreaterThanOrEqual(14);
    }
    // Small stamps, here and in rows, hold one line only. Their word is 14px.
    const smallAll = page.locator('[data-size="sm"]');
    expect(await smallAll.count()).toBeGreaterThanOrEqual(9);
    for (const stamp of await smallAll.all()) {
      await expect(stamp.locator("> span > span")).toHaveCount(1);
      expect(parseFloat((await css(stamp.locator(".type-stamp"), ["font-size"]))["font-size"])).toBeGreaterThanOrEqual(14);
    }
    // A stamp that stands alone says what it means.
    await expect(medium.nth(0)).toHaveAttribute("role", "img");
    await expect(medium.nth(0)).toHaveAccessibleName("Stamped paid on 08 Oct 2026");
  });

  test("47: asked to animate, the stamp lands once in 200ms, from 1.15 to 1 with its words settling; others do not animate", async ({ page }) => {
    const stamp = page.getByTestId("stamp-animated").locator("[data-size]");
    await page.getByTestId("stamp-replay").tap();
    const read = () =>
      stamp.evaluate((el) =>
        el.getAnimations({ subtree: true }).map((a) => {
          const effect = a.effect as KeyframeEffect;
          const timing = effect.getComputedTiming();
          return {
            name: a instanceof CSSAnimation ? a.animationName : "?",
            duration: timing.duration,
            iterations: timing.iterations,
            delay: timing.delay,
            frames: effect.getKeyframes().map((k) => `${k.scale ?? ""}${k.rotate ?? ""}`),
          };
        }),
      );
    const animations = (await read()).sort((a, b) => a.name.localeCompare(b.name));
    expect(animations).toEqual([
      { name: "stamp-land", duration: 200, iterations: 1, delay: 0, frames: ["1.15", "1"] },
      { name: "stamp-settle", duration: 200, iterations: 1, delay: 0, frames: ["-16deg", "-12deg"] },
    ]);
    // It finishes and stays at rest: full size, words at -12 degrees.
    await expect.poll(() => stamp.evaluate((el) => el.getAnimations({ subtree: true }).every((a) => a.playState === "finished"))).toBe(true);
    expect((await css(stamp, ["scale"])).scale).toBe("1");
    expect((await css(stamp.locator("> span"), ["rotate"])).rotate).toBe("-12deg");
    expect((await box(stamp)).width).toBe(132);

    // By default a stamp does not animate: every other stamp on the page is still.
    const others = await page.locator("[data-size]").evaluateAll((els) =>
      els.filter((el) => !el.closest('[data-testid="stamp-animated"]')).map((el) => `${getComputedStyle(el).animationName}/${getComputedStyle(el.firstElementChild!).animationName}`),
    );
    expect(others.length).toBeGreaterThanOrEqual(20);
    expect([...new Set(others)]).toEqual(["none/none"]);
  });

  test("48: English stamps are capitals with letter-spacing; Hindi, Kannada and Telugu stamps have neither", async ({ page }) => {
    const english = page.getByTestId("stamp-md").locator(".type-stamp").first();
    const e = await css(english, ["text-transform", "letter-spacing", "font-size", "font-weight"]);
    expect(e["text-transform"]).toBe("uppercase");
    expect(parseFloat(e["letter-spacing"]) / parseFloat(e["font-size"])).toBeCloseTo(0.04, 3);
    expect(e["font-weight"]).toBe("800");

    for (const lang of indicLangs) {
      const anek = await familyOf(page, scriptFontVariable[lang]);
      const block = page.getByTestId("section-stamp").getByTestId(`lang-${lang}`);
      const words = block.locator(".type-stamp");
      await expect(words).toHaveCount(4);
      for (const word of await words.all()) {
        await expect(word).toHaveText(scriptPattern[lang]);
        expect(await firstFamily(word), lang).toBe(anek);
        expect(await css(word, ["text-transform", "letter-spacing", "font-weight"]), lang).toEqual({ "text-transform": "none", "letter-spacing": "normal", "font-weight": "700" });
      }
      // The second line follows the same rule.
      for (const second of await block.locator("[data-size] > span > span:nth-child(2)").all()) {
        expect(await css(second, ["text-transform", "letter-spacing"]), lang).toEqual({ "text-transform": "none", "letter-spacing": "normal" });
      }
    }
  });

  test("as built: a stamp whose word is too long for its ring grows, stays a circle and keeps the word whole", async ({ page }) => {
    const nominal: Record<string, number> = { sm: 52, md: 132, lg: 232 };
    const stamps = page.locator("[data-size]");
    const count = await stamps.count();
    expect(count).toBeGreaterThanOrEqual(20);
    let grown = 0;
    for (let i = 0; i < count; i++) {
      const stamp = stamps.nth(i);
      const size = (await stamp.getAttribute("data-size"))!;
      const measured = await stamp.evaluate((el) => {
        const ring = el as HTMLElement;
        const inner = ring.firstElementChild as HTMLElement;
        const word = inner.firstElementChild as HTMLElement;
        const s = getComputedStyle(ring);
        return {
          width: ring.offsetWidth,
          height: ring.offsetHeight,
          room: ring.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight),
          word: word.offsetWidth,
          wordScroll: word.scrollWidth,
          fontSize: parseFloat(getComputedStyle(word).fontSize),
          text: word.textContent,
        };
      });
      expect(measured.width, measured.text ?? "").toBeGreaterThanOrEqual(nominal[size]);
      expect(Math.abs(measured.width - measured.height), `${measured.text} is a circle`).toBeLessThanOrEqual(1);
      expect(measured.word, `${measured.text} fits between the rings`).toBeLessThanOrEqual(measured.room + 0.5);
      expect(measured.wordScroll, measured.text ?? "").toBeLessThanOrEqual(measured.word);
      expect(measured.fontSize, measured.text ?? "").toBeGreaterThanOrEqual(14);
      if (measured.width > nominal[size]) grown++;
    }
    // At least one sample word is too long for its nominal ring, so this test has something to show.
    expect(grown).toBeGreaterThan(0);
  });
});

test.describe("Tabs: criteria 49, 50, 51, 52", () => {
  test("49: folder tabs with a 2px ink border on three sides and 6px top corners; selected 48px slip, unselected 44px tab-idle", async ({ page }) => {
    const demo = page.getByTestId("tabs-tabs-en");
    const selected = demo.getByRole("tab", { selected: true });
    const idle = demo.getByRole("tab", { selected: false });
    await expect(selected).toHaveCount(1);
    await expect(idle).toHaveCount(2);
    const shape = ["border-top-width", "border-left-width", "border-right-width", "border-bottom-width", "border-top-color", "border-top-style", "border-top-left-radius", "border-top-right-radius", "border-bottom-left-radius", "border-bottom-right-radius"] as const;
    const wantShape = {
      "border-top-width": "2px",
      "border-left-width": "2px",
      "border-right-width": "2px",
      "border-bottom-width": "0px",
      "border-top-color": rgb("ink"),
      "border-top-style": "solid",
      "border-top-left-radius": "6px",
      "border-top-right-radius": "6px",
      "border-bottom-left-radius": "0px",
      "border-bottom-right-radius": "0px",
    };
    for (const tab of await demo.getByRole("tab").all()) expect(await css(tab, shape)).toEqual(wantShape);

    expect((await box(selected)).height).toBe(48);
    expect(await css(selected, ["background-color", "color"])).toEqual({ "background-color": rgb("slip"), color: rgb("ink") });
    for (const tab of await idle.all()) {
      expect((await box(tab)).height).toBe(44);
      expect(await css(tab, ["background-color", "color"])).toEqual({ "background-color": rgb("tab-idle"), color: rgb("ink-soft") });
    }
    // Joined: all three stand on the slip's top edge.
    const slip = await box(demo.getByRole("tabpanel"));
    for (const tab of await demo.getByRole("tab").all()) {
      const b = await box(tab);
      expect(b.y + b.height).toBeCloseTo(slip.y, 0);
    }
  });

  for (const lang of langs) {
    test(`50, 51: ${lang} tabs show a label and a count, expose the selected one, and change by tap and by keyboard`, async ({ page }) => {
      const demo = page.getByTestId(`tabs-tabs-${lang}`);
      const tabs = demo.getByRole("tab");
      const panel = demo.getByRole("tabpanel");
      await expect(demo.getByRole("tablist")).toHaveAccessibleName(/\S/);
      await expect(tabs).toHaveCount(3);
      await expect(tabs.nth(0)).toContainText("5");
      await expect(tabs.nth(1)).toContainText("4");
      await expect(tabs.nth(2)).toContainText("14");
      await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
      await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "false");
      const firstRow = (await panel.locator("li").textContent()) ?? "";
      expect(firstRow).not.toBe("");

      // Tap.
      await tabs.nth(1).tap();
      await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
      await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "false");
      await expect(panel.locator("li")).not.toHaveText(firstRow);
      await expect(panel).toHaveAttribute("aria-labelledby", (await tabs.nth(1).getAttribute("id"))!);
      // The chosen one is now the tall slip-coloured one; the old one is short and idle.
      const chosen = await box(tabs.nth(1));
      const left = await box(tabs.nth(0));
      expect(chosen.height - left.height).toBe(4);
      expect((await css(tabs.nth(1), ["background-color"]))["background-color"]).toBe(rgb("slip"));
      expect((await css(tabs.nth(0), ["background-color"]))["background-color"]).toBe(rgb("tab-idle"));

      // Keyboard: arrows move and select, wrapping at the end; only the selected tab is in the tab order.
      await page.keyboard.press("ArrowRight");
      await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
      await expect(tabs.nth(2)).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
      await expect(tabs.nth(0)).toBeFocused();
      await expect(panel.locator("li")).toHaveText(firstRow);
      expect(await tabs.evaluateAll((els) => els.map((el) => el.getAttribute("tabindex")))).toEqual(["0", "-1", "-1"]);
    });

    test(`52: three long ${lang} labels at 360px are not truncated, share one bottom edge, and add no sideways scroll`, async ({ page }) => {
      const demo = page.getByTestId(`tabs-tabs-long-${lang}`);
      const tabs = demo.getByRole("tab");
      const list = await box(demo.getByRole("tablist"));
      expect(list.x).toBeGreaterThanOrEqual(0);
      expect(list.x + list.width).toBeLessThanOrEqual(360);
      const boxes = [];
      for (const tab of await tabs.all()) {
        const b = await box(tab);
        boxes.push(b);
        expect(b.x).toBeGreaterThanOrEqual(list.x);
        expect(b.x + b.width).toBeLessThanOrEqual(list.x + list.width + 0.5);
        const s = await css(tab, ["text-overflow", "overflow-x", "overflow-y", "white-space"]);
        expect(s).toEqual({ "text-overflow": "clip", "overflow-x": "visible", "overflow-y": "visible", "white-space": "normal" });
        // Every line of the label is inside the tab.
        const fits = await tab.evaluate((el) => {
          const outer = el.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(el);
          return [...range.getClientRects()].every((r) => r.left >= outer.left - 0.5 && r.right <= outer.right + 0.5 && r.top >= outer.top - 0.5 && r.bottom <= outer.bottom + 0.5);
        });
        expect(fits).toBe(true);
        expect(parseFloat((await css(tab, ["font-size"]))["font-size"])).toBeGreaterThanOrEqual(15);
      }
      // Equal columns, one bottom edge, and the selected tab still 4px taller than the rest.
      expect(new Set(boxes.map((b) => Math.round(b.width))).size).toBe(1);
      expect(new Set(boxes.map((b) => Math.round((b.y + b.height) * 10))).size).toBe(1);
      expect(boxes[0].height - boxes[1].height).toBe(4);
      expect(boxes[1].height).toBe(boxes[2].height);
      expect(boxes[1].height).toBeGreaterThanOrEqual(44);
      // No tab scrolls sideways as a strip.
      expect((await css(demo.getByRole("tablist"), ["overflow-x"]))["overflow-x"]).toBe("visible");
      expect(await sidewaysScroll(page)).toBe(0);
    });
  }
});

test.describe("Sheet: criteria 53, 54, 55, 56, 57", () => {
  for (const lang of langs) {
    test(`53, 54, 55: ${lang}: opens as a named dialog on the dark ground, holds focus, closes with Escape and gives focus back`, async ({ page }) => {
      const opener = page.getByTestId(`sheet-open-${lang}`);
      await opener.scrollIntoViewIfNeeded();
      const scrollBefore = await page.evaluate(() => window.scrollY);
      expect(scrollBefore).toBeGreaterThan(1000);
      const dialog = await openSheet(page, lang);
      const panel = await sheetPanel(dialog);
      const title = dialog.getByRole("heading", { level: 2 });
      const close = dialog.getByRole("button").first();

      // 55: a dialog with a name.
      const name = ((await title.textContent()) ?? "").trim();
      expect(name).not.toBe("");
      await expect(page.getByRole("dialog", { name })).toBeVisible();
      expect(await dialog.evaluate((d) => d.matches(":modal"))).toBe(true);

      // 53: the dark ground fills the screen; the slip panel has a 2px ink top edge and sits on the bottom.
      expect(await box(dialog)).toEqual({ x: 0, y: 0, width: 360, height: 740 });
      expect((await css(dialog, ["background-color"]))["background-color"]).toBe(rgb("sheet-ground"));
      const p = await box(panel);
      expect([p.x, p.width]).toEqual([0, 360]);
      expect(p.y + p.height).toBe(740);
      expect(p.y).toBeGreaterThan(0);
      expect(await css(panel, ["background-color", "border-top-width", "border-top-style", "border-top-color", "border-top-left-radius"])).toEqual({
        "background-color": rgb("slip"),
        "border-top-width": "2px",
        "border-top-style": "solid",
        "border-top-color": rgb("ink"),
        "border-top-left-radius": "0px",
      });
      // The dark ground really is what shows above the panel.
      const above = (await pixels(page, { x: 350, y: 2, width: 1, height: 1 })).at(0, 0);
      expect(near(above, rgbTuple("sheet-ground")), `ground pixel is ${above}`).toBe(true);

      // 54: context header in on-cloth on the dark ground, a title in the panel, a text close control 44px or taller.
      const context = dialog.locator("p").first();
      const contextTitle = dialog.locator("p").nth(1);
      for (const el of [context, contextTitle]) {
        await expect(el).toBeVisible();
        expect((await css(el, ["color"])).color).toBe(rgb("on-cloth"));
        expect((await box(el)).y + (await box(el)).height).toBeLessThanOrEqual(p.y);
      }
      await expect(title).toBeVisible();
      expect((await box(title)).y).toBeGreaterThanOrEqual(p.y);
      await expect(close).toHaveText(/\S/);
      await expect(close.locator("svg")).toHaveCount(0);
      expect((await box(close)).height).toBeGreaterThanOrEqual(44);

      // 55: focus moved in, and Tab cannot take it to the page behind.
      const inside = () => dialog.evaluate((d) => d.contains(document.activeElement) && document.activeElement !== d);
      expect(await inside()).toBe(true);
      const visited = new Set<string>();
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Tab");
        const where = await dialog.evaluate((d) => {
          const a = document.activeElement;
          if (!a || a === document.body) return "browser";
          return d.contains(a) ? `inside:${a.tagName}:${(a.textContent ?? "").trim().slice(0, 12)}` : "outside";
        });
        expect(where).not.toBe("outside");
        visited.add(where);
      }
      expect([...visited].filter((v) => v.startsWith("inside")).length).toBe(3);

      // 55: the page behind cannot be focused, tapped or scrolled.
      await opener.evaluate((el) => (el as HTMLElement).focus());
      expect(await opener.evaluate((el) => document.activeElement === el)).toBe(false);
      expect(await page.evaluate(() => document.elementFromPoint(180, 20)?.closest("dialog") !== null)).toBe(true);
      expect((await css(page.locator("html"), ["overflow-y"]))["overflow-y"]).toBe("hidden");
      // A wheel and a finger drag, up and down, over the dark ground and over the panel.
      const cdp = await page.context().newCDPSession(page);
      for (const y of [100, 600]) {
        await page.mouse.move(180, y);
        for (const distance of [600, -600]) {
          await page.mouse.wheel(0, distance);
          await cdp.send("Input.synthesizeScrollGesture", { x: 180, y, yDistance: distance / 2, gestureSourceType: "touch" });
          expect(await page.evaluate(() => window.scrollY), `after moving ${distance} at y=${y}`).toBe(scrollBefore);
        }
      }

      // 55: Escape closes it and focus returns to the control that opened it.
      await page.keyboard.press("Escape");
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(opener).toBeFocused();
      expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
      expect((await css(page.locator("html"), ["overflow-y"]))["overflow-y"]).toBe("visible");

      // The close control and the action inside close it too, and it opens again afterwards.
      await openSheet(page, lang);
      await page.locator("dialog[open]").getByRole("button").first().tap();
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(opener).toBeFocused();
      await openSheet(page, lang);
      await page.locator("dialog[open]").getByRole("button").last().tap();
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(opener).toBeFocused();
    });
  }

  test("54: the close control shows the words it was given", async ({ page }) => {
    const dialog = await openSheet(page, "en");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 2 })).toHaveText("Mark paid");
    await expect(dialog.getByText("Class 10 Maths · October")).toBeVisible();
    await expect(dialog.getByText("Ravi Kumar")).toBeVisible();
    // A sheet without a context header has none.
    await page.keyboard.press("Escape");
    const tall = await openSheet(page, "tall");
    await expect(tall.getByText("Class 10 Maths · October")).toHaveCount(0);
  });

  test("56: content taller than the screen scrolls inside the panel and the close control stays reachable", async ({ page }) => {
    await page.getByTestId("sheet-open-tall").scrollIntoViewIfNeeded();
    const pageScroll = await page.evaluate(() => window.scrollY);
    const dialog = await openSheet(page, "tall");
    const panel = await sheetPanel(dialog);
    const close = dialog.getByRole("button", { name: "Cancel" });
    const metrics = await panel.evaluate((el) => ({ scroll: el.scrollHeight, client: el.clientHeight, overflowY: getComputedStyle(el).overflowY, overscroll: getComputedStyle(el).overscrollBehaviorY }));
    expect(metrics.scroll).toBeGreaterThan(metrics.client + 500);
    expect(metrics.overflowY).toBe("auto");
    expect(metrics.overscroll).toBe("contain");
    const p = await box(panel);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y + p.height).toBe(740);
    // The dialog itself does not scroll; only the panel does.
    expect(await dialog.evaluate((d) => d.scrollHeight <= d.clientHeight)).toBe(true);

    const closeAtTop = await box(close);
    const action = dialog.getByRole("button").last();
    await expect(action).not.toBeInViewport();

    // Scroll with a wheel over the panel, then all the way to the end.
    await page.mouse.move(180, 400);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect.poll(() => panel.evaluate((el) => Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight)).toBe(true);
    await expect(action).toBeInViewport();
    // Scrolling the panel to its end did not move the page behind.
    expect(await page.evaluate(() => window.scrollY)).toBe(pageScroll);

    // The close control has not moved, nothing covers it, and it works.
    const closeAtEnd = await box(close);
    expect(closeAtEnd).toEqual(closeAtTop);
    expect(closeAtEnd.y).toBeGreaterThanOrEqual(0);
    expect(closeAtEnd.y + closeAtEnd.height).toBeLessThanOrEqual(740);
    const hit = await close.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
    });
    expect(hit).toBe(true);
    // The title stays with it.
    await expect(dialog.getByRole("heading", { level: 2 })).toBeInViewport();
    await close.tap();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.getByTestId("sheet-open-tall")).toBeFocused();
  });

  test("57: a focus ring in the context header area (dark ground) is yellow; in the slip panel it is blue again", async ({ page }) => {
    // The header holds a label and a title and nothing that takes focus, so the criterion has no
    // element of its own to test. This test puts a plain button with the shared ring class into the
    // header of the open sheet and focuses it with the keyboard.
    const dialog = await openSheet(page, "en");
    const panel = await sheetPanel(dialog);
    const header = dialog.locator("p").first().locator("xpath=..");
    expect(await header.evaluate((el) => el.querySelectorAll("a, button, input, textarea, select, [tabindex]").length)).toBe(0);

    // The mechanism: the dark area names the yellow ring, the paper panel names blue.
    const ringColour = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).getPropertyValue("--ground-ring").trim().toLowerCase());
    expect(await ringColour(header)).toBe(hex("highlight").toLowerCase());
    expect(await ringColour(panel)).toBe(hex("blue").toLowerCase());

    await header.evaluate((el) => {
      const probe = document.createElement("button");
      probe.type = "button";
      probe.textContent = "probe";
      probe.className = "ring:ground-ring";
      probe.setAttribute("data-e2e", "ring-probe");
      el.prepend(probe);
    });
    const probe = dialog.locator('[data-e2e="ring-probe"]');
    const close = dialog.getByRole("button", { name: "Cancel" });
    await close.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(probe).toBeFocused();
    expect(await probe.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
    expect(await css(probe, ["outline-style", "outline-width", "outline-offset", "outline-color"])).toEqual({
      "outline-style": "solid",
      "outline-width": "3px",
      "outline-offset": "4px",
      "outline-color": rgb("highlight"),
    });
    // It sits on the dark ground.
    const b = await box(probe);
    const ground = (await pixels(page, { x: b.x + b.width + 12, y: b.y + b.height / 2, width: 1, height: 1 })).at(0, 0);
    expect(near(ground, rgbTuple("sheet-ground")), `ground pixel is ${ground}`).toBe(true);
    // And the ring's pixels are yellow: 5px outside the button's edge is inside the 3px ring.
    const ringPixel = (await pixels(page, { x: b.x + b.width / 2, y: b.y - 5.5, width: 1, height: 1 })).at(0, 0);
    expect(near(ringPixel, rgbTuple("highlight")), `ring pixel is ${ringPixel}`).toBe(true);

    // The real controls in the sheet are on paper: keyboard focus on the close control is blue.
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    expect(await css(close, ["outline-style", "outline-width", "outline-offset", "outline-color"])).toEqual({
      "outline-style": "solid",
      "outline-width": "3px",
      "outline-offset": "4px",
      "outline-color": rgb("blue"),
    });
  });

  test("the still copy on the page shows the same sheet without opening it", async ({ page }) => {
    const still = page.getByTestId("sheet-still");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(still.getByRole("heading", { level: 2 })).toHaveText("Mark paid");
    await expect(still.getByRole("button", { name: "Cancel" })).toBeVisible();
    const ground = still.locator("> div").last().locator("> div");
    expect((await css(ground, ["background-color"]))["background-color"]).toBe(rgb("sheet-ground"));
    expect((await css(still.getByText("Ravi Kumar"), ["color"])).color).toBe(rgb("on-cloth"));
  });
});

test("the dev page loads with no console error and no failed request", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("requestfailed", (request) => problems.push(`failed: ${request.url()}`));
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`${response.status()}: ${response.url()}`);
  });
  await page.goto(DEV);
  await fontsSettled(page);
  await page.getByTestId("tabs-tabs-en").getByRole("tab").nth(1).tap();
  await openSheet(page, "en");
  expect(problems).toEqual([]);
});
