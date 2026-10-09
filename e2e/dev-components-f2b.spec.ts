// Spec F2b, /dev/components: Segmented, StudentStrip, Switch, BottomNav and Banner (criteria 70 to 93),
// at the phone viewport. Each describe block names the acceptance criteria it proves
// (docs/specs/F2-design-system.md). The whole-page checks in dev-components.spec.ts walk these
// sections too; the block at the end of this file holds the ones that needed new code.
//
// Sizes that depend on how a word is set are given slack on purpose: exact-pixel checks on text
// failed on the Linux CI runner in F2a. Exact checks are kept for things CSS fixes outright
// (border widths, colours, a min-height with short text).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { attachScreenshot, box, css, indicLangs, langs, openDevPage, rgb, scriptPattern, shadow, sidewaysScroll } from "./helpers";

const TRANSPARENT = "rgba(0, 0, 0, 0)";

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

/** Boxes of every element a locator matches, in document order. */
async function boxes(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }[]> {
  return locator.evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
    }),
  );
}

/** True when the element's content is not wider or taller than its box: nothing is cut. */
function holdsItsContent(locator: Locator): Promise<boolean> {
  return locator.first().evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + 1);
}

/** Puts keyboard focus on `target` the way a person would: Tab from the focusable thing before it. */
async function tabTo(page: Page, target: Locator): Promise<void> {
  await target.evaluate((el) => {
    const all = [...document.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter(
      (e) => e.getClientRects().length > 0 && !(e instanceof HTMLInputElement && e.type === "radio" && !e.checked),
    );
    const i = all.indexOf(el as HTMLElement);
    if (i < 1) throw new Error("Nothing focusable before the target");
    all[i - 1].focus();
  });
  await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
}

const section = (page: Page, id: string) => page.getByTestId(`section-${id}`);

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.titlePath.some((t) => t.includes("[own page]"))) return;
  await openDevPage(page);
});

test.describe("Segmented: criteria 70, 71, 72, 74 (and 73 in a real browser)", () => {
  const group = (page: Page, id: string) => page.getByTestId(`segmented-${id}`).locator("fieldset");
  const frame = (page: Page, id: string) => group(page, id).locator("legend + div");
  const segments = (page: Page, id: string) => group(page, id).locator("label");
  const radios = (page: Page, id: string) => group(page, id).getByRole("radio");

  test("70: one 2px ink border with 4px corners; the chosen segment is ink with slip text, the others have no fill and ink text", async ({ page }) => {
    for (const [id, count] of [["two-en", 2], ["three-en", 3], ["four-en", 4]] as const) {
      await expect(radios(page, id), id).toHaveCount(count);
      await expect(group(page, id).getByRole("radio", { checked: true }), id).toHaveCount(1);
      const f = await css(frame(page, id), ["border-top-width", "border-left-width", "border-right-width", "border-bottom-width", "border-top-color", "border-top-style", "border-top-left-radius", "border-bottom-right-radius"]);
      expect(f, id).toEqual({
        "border-top-width": "2px",
        "border-left-width": "2px",
        "border-right-width": "2px",
        "border-bottom-width": "2px",
        "border-top-color": rgb("ink"),
        "border-top-style": "solid",
        "border-top-left-radius": "4px",
        "border-bottom-right-radius": "4px",
      });
      for (const segment of await segments(page, id).all()) {
        const chosen = await segment.getByRole("radio").isChecked();
        const look = await css(segment, ["background-color", "color"]);
        expect(look, `${id} ${chosen ? "chosen" : "other"}`).toEqual(
          chosen ? { "background-color": rgb("ink"), color: rgb("slip") } : { "background-color": TRANSPARENT, color: rgb("ink") },
        );
      }
    }
  });

  test("70: segments are equal width, with a 2px ink line between them and no second line at the group's edge", async ({ page }) => {
    for (const id of ["two-en", "three-en"]) {
      const targets = await boxes(radios(page, id));
      const outer = await box(frame(page, id));
      for (const t of targets) expect(Math.abs(t.width - targets[0].width), id).toBeLessThanOrEqual(0.5);
      for (let i = 1; i < targets.length; i++) {
        // The gap between one segment's inside and the next is exactly the 2px line.
        expect(targets[i].x - (targets[i - 1].x + targets[i - 1].width), id).toBeCloseTo(2, 1);
        expect((await css(segments(page, id).nth(i), ["border-left-width", "border-left-color", "border-left-style"])), id).toEqual({
          "border-left-width": "2px",
          "border-left-color": rgb("ink"),
          "border-left-style": "solid",
        });
      }
      // The first segment starts straight after the group's own 2px border, the last ends at the other one.
      expect(targets[0].x - outer.x, id).toBeCloseTo(2, 1);
      expect(outer.x + outer.width - (targets.at(-1)!.x + targets.at(-1)!.width), id).toBeCloseTo(2, 1);
      expect(targets[0].y - outer.y, id).toBeCloseTo(2, 1);
    }
  });

  test("71: every segment on the page is at least 44px tall, and so is the target inside it", async ({ page }) => {
    const all = await boxes(section(page, "segmented").locator("fieldset label"));
    expect(all.length).toBeGreaterThan(50);
    for (const b of all) expect(b.height).toBeGreaterThanOrEqual(44);
    for (const b of await boxes(section(page, "segmented").getByRole("radio"))) {
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.width).toBeGreaterThanOrEqual(44);
    }
  });

  for (const lang of langs) {
    test(`71: ${lang}: a second, smaller line is 14px or larger; long text wraps, segments in a row share one height, nothing is cut`, async ({ page }) => {
      const twoLine = `two-line-${lang}`;
      await expect(segments(page, twoLine).first().locator("span")).toHaveCount(2);
      for (const segment of await segments(page, twoLine).all()) {
        const [main, detail] = await Promise.all([css(segment.locator("span").first(), ["font-size"]), css(segment.locator("span").nth(1), ["font-size"])]);
        expect(parseFloat(detail["font-size"]), twoLine).toBeGreaterThanOrEqual(14);
        expect(parseFloat(detail["font-size"]), twoLine).toBeLessThanOrEqual(parseFloat(main["font-size"]));
      }

      const long = `long-${lang}`;
      expect(await lineCount(segments(page, long).first().locator("span").first()), "the long choice wraps").toBeGreaterThanOrEqual(2);
      expect(await lineCount(group(page, long).locator("legend")), "the long label wraps").toBeGreaterThanOrEqual(2);
      if (lang !== "en") await expect(group(page, long)).toContainText(scriptPattern[lang]);

      for (const id of [twoLine, long, `three-${lang}`, `two-${lang}`]) {
        const row = await boxes(segments(page, id));
        for (const b of row) {
          expect(Math.abs(b.height - row[0].height), `${id}: one height`).toBeLessThanOrEqual(0.5);
          expect(Math.abs(b.y - row[0].y), `${id}: one row`).toBeLessThanOrEqual(0.5);
        }
        for (const segment of await segments(page, id).all()) {
          expect(await holdsItsContent(segment), `${id}: a segment holds its text`).toBe(true);
          for (const span of await segment.locator("span").all()) {
            const t = await css(span, ["text-overflow", "white-space", "overflow-x"]);
            expect(t, id).toEqual({ "text-overflow": "clip", "white-space": "normal", "overflow-x": "visible" });
          }
        }
        // The text sits inside the group's frame, which is the one thing here that hides overflow.
        const outer = await box(frame(page, id));
        for (const b of await boxes(segments(page, id).locator("span"))) {
          expect(b.x, id).toBeGreaterThanOrEqual(outer.x);
          expect(b.x + b.width, id).toBeLessThanOrEqual(outer.x + outer.width);
          expect(b.y + b.height, id).toBeLessThanOrEqual(outer.y + outer.height);
        }
      }
      expect(await sidewaysScroll(page)).toBe(0);
    });

    test(`72: ${lang}: four choices at 360px are two rows of two, with the lines kept between them`, async ({ page }) => {
      const id = `four-${lang}`;
      const [a, b, c, d] = await boxes(radios(page, id));
      // Two rows.
      expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(c.y - d.y)).toBeLessThanOrEqual(0.5);
      expect(c.y).toBeGreaterThan(a.y + a.height - 0.5);
      // Two columns.
      expect(Math.abs(a.x - c.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(b.x - d.x)).toBeLessThanOrEqual(0.5);
      expect(b.x).toBeGreaterThan(a.x + a.width - 0.5);
      // Equal cells, and a 2px line between the columns and between the rows.
      for (const cell of [b, c, d]) {
        expect(Math.abs(cell.width - a.width)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(cell.height - a.height)).toBeLessThanOrEqual(0.5);
      }
      expect(b.x - (a.x + a.width)).toBeCloseTo(2, 1);
      expect(c.y - (a.y + a.height)).toBeCloseTo(2, 1);
      const lines = await css(segments(page, id).nth(3), ["border-top-width", "border-left-width", "border-top-color", "border-left-color"]);
      expect(lines).toEqual({ "border-top-width": "2px", "border-left-width": "2px", "border-top-color": rgb("ink"), "border-left-color": rgb("ink") });
      expect(await sidewaysScroll(page)).toBe(0);
    });
  }

  test("72: the rule is the group's own width: 28rem or more inside its border, and four choices are one row", async ({ page }) => {
    // Nothing on a 360px screen is that wide, so the group is given the width by hand.
    // The width that counts is the inside of the 2px border, so the group itself is 4px wider.
    const id = "four-en";
    await group(page, id).evaluate((el) => {
      el.style.width = "calc(28rem + 3px)";
    });
    let cells = await boxes(radios(page, id));
    expect(cells[2].y, "a pixel under 28rem inside: still two rows").toBeGreaterThan(cells[0].y + 10);
    await group(page, id).evaluate((el) => {
      el.style.width = "calc(28rem + 4px)";
    });
    cells = await boxes(radios(page, id));
    for (const cell of cells) expect(Math.abs(cell.y - cells[0].y), "28rem inside: one row").toBeLessThanOrEqual(0.5);
    for (let i = 1; i < 4; i++) expect(cells[i].x - (cells[i - 1].x + cells[i - 1].width)).toBeCloseTo(2, 1);
  });

  test("72: three long choices never go two by two; they wrap inside their segments", async ({ page }) => {
    for (const lang of langs) {
      const row = await boxes(radios(page, `long-${lang}`));
      expect(row).toHaveLength(3);
      for (const b of row) expect(Math.abs(b.y - row[0].y), lang).toBeLessThanOrEqual(0.5);
    }
  });

  test("73, in the browser: a tap chooses, only one is chosen at a time, and the arrow keys move the choice", async ({ page }) => {
    const id = "three-en";
    await radios(page, id).nth(1).tap();
    await expect(radios(page, id).nth(1)).toBeChecked();
    await expect(group(page, id).getByRole("radio", { checked: true })).toHaveCount(1);
    expect((await css(segments(page, id).nth(1), ["background-color"]))["background-color"]).toBe(rgb("ink"));
    expect((await css(segments(page, id).first(), ["background-color"]))["background-color"]).toBe(TRANSPARENT);
    // A tap where the words are. The radio lies over the whole segment, so the tap lands on the radio;
    // `force` only skips Playwright's check that the span itself receives it.
    await segments(page, id).nth(2).locator("span").tap({ force: true });
    await expect(radios(page, id).nth(2)).toBeChecked();

    // The screen is told: the working example shows the value it was given back.
    const live = page.getByTestId("segmented-live");
    await expect(page.getByTestId("segmented-live-value")).toHaveText("en");
    await live.getByRole("radio").nth(2).tap();
    await expect(page.getByTestId("segmented-live-value")).toHaveText("kn");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("segmented-live-value")).toHaveText("te");
    await expect(live.getByRole("radio").nth(3)).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByTestId("segmented-live-value")).toHaveText("hi");
    await expect(live.getByRole("radio", { checked: true })).toHaveCount(1);
  });

  test("73, in the browser: the group is named by its visible label, and the whole group is one Tab stop", async ({ page }) => {
    await expect(page.getByTestId("segmented-three-en").getByRole("group")).toHaveAccessibleName("When");
    await expect(page.getByTestId("segmented-two-line-en").getByRole("radio").first()).toHaveAccessibleName("Polite A gentle first nudge");
    const chosen = group(page, "three-en").getByRole("radio", { checked: true });
    await tabTo(page, chosen);
    await page.keyboard.press("Tab");
    // Focus has left the group: it did not stop on the other two radios.
    expect(await group(page, "three-en").evaluate((el) => el.contains(document.activeElement))).toBe(false);
  });

  test("74: keyboard focus draws a 3px ring inside the segment, yellow on the chosen one; a tap draws none", async ({ page }) => {
    const id = "three-en";
    // The first radio is the chosen one when the page loads.
    const chosen = radios(page, id).first();
    await expect(chosen).toBeChecked();
    await tabTo(page, chosen);
    expect(await css(chosen, ["outline-style", "outline-width", "outline-offset", "outline-color"])).toEqual({
      "outline-style": "solid",
      "outline-width": "3px",
      "outline-offset": "-3px",
      "outline-color": rgb("highlight"),
    });
    // The ring belongs to the radio, and the radio lies wholly inside the frame that hides overflow:
    // with a negative offset the ring is inside that again, so the border cannot clip it.
    const outer = await box(frame(page, id));
    const target = await box(chosen);
    expect(target.x).toBeGreaterThanOrEqual(outer.x + 2 - 0.5);
    expect(target.y).toBeGreaterThanOrEqual(outer.y + 2 - 0.5);
    expect(target.x + target.width).toBeLessThanOrEqual(outer.x + outer.width - 2 + 0.5);
    expect(target.y + target.height).toBeLessThanOrEqual(outer.y + outer.height - 2 + 0.5);

    // The arrow key moves focus and the choice together; the ring follows and stays yellow.
    await page.keyboard.press("ArrowRight");
    const next = radios(page, id).nth(1);
    await expect(next).toBeFocused();
    await expect(next).toBeChecked();
    expect((await css(next, ["outline-style", "outline-color"]))).toEqual({ "outline-style": "solid", "outline-color": rgb("highlight") });
    expect((await css(chosen, ["outline-style"]))["outline-style"]).toBe("none");

    // A tap chooses without drawing a ring.
    await radios(page, "two-en").nth(1).tap();
    await expect(radios(page, "two-en").nth(1)).toBeChecked();
    expect((await css(radios(page, "two-en").nth(1), ["outline-style"]))["outline-style"]).toBe("none");
  });

  test("74: the frozen examples show the ring on a chosen segment (yellow) and on another one (blue), both inside", async ({ page }, testInfo) => {
    const onChosen = page.getByTestId("segmented-focus-chosen").locator('[data-force="focus"]');
    const onOther = page.getByTestId("segmented-focus-other").locator('[data-force="focus"]');
    await expect(onChosen).toBeChecked();
    await expect(onOther).not.toBeChecked();
    const ring = ["outline-style", "outline-width", "outline-offset", "outline-color"] as const;
    expect(await css(onChosen, ring)).toEqual({ "outline-style": "solid", "outline-width": "3px", "outline-offset": "-3px", "outline-color": rgb("highlight") });
    expect(await css(onOther, ring)).toEqual({ "outline-style": "solid", "outline-width": "3px", "outline-offset": "-3px", "outline-color": rgb("blue") });
    // The grounds the two rings sit on: ink, and the slip behind an unfilled segment.
    expect((await css(onChosen.locator(".."), ["background-color"]))["background-color"]).toBe(rgb("ink"));
    expect((await css(onOther.locator(".."), ["background-color"]))["background-color"]).toBe(TRANSPARENT);
    for (const forced of [onChosen, onOther]) {
      const outer = await box(forced.locator("xpath=ancestor::fieldset").locator("legend + div"));
      const target = await box(forced);
      expect(target.x).toBeGreaterThanOrEqual(outer.x + 1.5);
      expect(target.x + target.width).toBeLessThanOrEqual(outer.x + outer.width - 1.5);
    }
    await page.getByTestId("segmented-focus-other").scrollIntoViewIfNeeded();
    await attachScreenshot(testInfo, "segmented-focus-rings.png", await page.screenshot());
  });

  test("74: with colour removed the chosen segment is still the one that is filled", async ({ page }, testInfo) => {
    await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
    for (const lang of langs) {
      const id = `four-${lang}`;
      const fills = await segments(page, id).evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
      expect(fills.filter((f) => f !== "rgba(0, 0, 0, 0)"), lang).toEqual([rgb("ink")]);
    }
    // For a person to look at: no pixel comparison (baselines differ between macOS and the CI runner).
    await page.getByTestId("segmented-four-en").scrollIntoViewIfNeeded();
    await attachScreenshot(testInfo, "segmented-greyscale.png", await page.screenshot());
  });

  for (const lang of indicLangs) {
    test(`${lang}: the group label is Anek 600 at 15px with no capitals and no letter-spacing; segment text is 14px or larger`, async ({ page }) => {
      const legend = group(page, `two-line-${lang}`).locator("legend");
      expect(await css(legend, ["font-size", "font-weight", "text-transform", "letter-spacing"])).toEqual({
        "font-size": "15px",
        "font-weight": "600",
        "text-transform": "none",
        "letter-spacing": "normal",
      });
      for (const span of await segments(page, `two-line-${lang}`).locator("span").all()) {
        expect(parseFloat((await css(span, ["font-size"]))["font-size"])).toBeGreaterThanOrEqual(14);
      }
    });
  }
});
