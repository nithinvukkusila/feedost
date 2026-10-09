// Spec F2b, /dev/components: Segmented, StudentStrip, Switch, BottomNav and Banner (criteria 70 to 93),
// at the phone viewport. Each describe block names the acceptance criteria it proves
// (docs/specs/F2-design-system.md). The whole-page checks in dev-components.spec.ts walk these
// sections too; the block at the end of this file holds the ones that needed new code.
//
// Sizes that depend on how a word is set are given slack on purpose: exact-pixel checks on text
// failed on the Linux CI runner in F2a. Exact checks are kept for things CSS fixes outright
// (border widths, colours, a min-height with short text).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { attachScreenshot, box, css, indicLangs, langs, openDevPage, rgb, scriptPattern, sidewaysScroll } from "./helpers";

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

test.describe("Switch: criteria 80, 81, 82, 83", () => {
  const sw = (page: Page, id: string) => page.getByTestId(`switch-${id}`);
  const knob = (page: Page, id: string) => sw(page, id).locator("> span");
  /** The one word that can be seen on the knob. */
  const shownWord = (page: Page, id: string) =>
    knob(page, id).evaluate((el) => [...el.children].filter((w) => getComputedStyle(w).visibility === "visible").map((w) => w.textContent));

  test("80: on is at least 76 by 44 with a 2px ink border and 4px corners, a green track, and the knob at the right carrying its word", async ({ page }) => {
    const on = sw(page, "en-on");
    await expect(on).toHaveAttribute("aria-checked", "true");
    const b = await box(on);
    // 76 by 44 are minimums in rem. "ON" and "OFF" fit the smallest knob with a few pixels to spare
    // on this machine; another platform may set them a little wider, and then the switch is wider.
    expect(b.width).toBeGreaterThanOrEqual(76);
    expect(b.width).toBeLessThanOrEqual(84);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeLessThanOrEqual(46);
    expect(await css(on, ["border-top-width", "border-top-style", "border-top-color", "border-top-left-radius", "background-color"])).toEqual({
      "border-top-width": "2px",
      "border-top-style": "solid",
      "border-top-color": rgb("ink"),
      "border-top-left-radius": "4px",
      "background-color": rgb("stamp"),
    });
    const k = await box(knob(page, "en-on"));
    expect(k.x + k.width / 2, "the knob is right of centre").toBeGreaterThan(b.x + b.width / 2);
    // 3px of padding and the 2px border on the knob's side; a strip of track on the other.
    expect(b.x + b.width - (k.x + k.width)).toBeCloseTo(5, 0);
    expect(k.x - b.x).toBeGreaterThanOrEqual(30);
    expect(await css(knob(page, "en-on"), ["background-color", "border-top-width", "border-top-color", "font-size", "font-weight", "color"])).toEqual({
      "background-color": rgb("slip"),
      "border-top-width": "2px",
      "border-top-color": rgb("ink"),
      "font-size": "14px",
      "font-weight": "800",
      color: rgb("ink"),
    });
    expect(await shownWord(page, "en-on")).toEqual(["ON"]);
  });

  test("81: off has the knob at the left carrying the off word, on a track that is not green", async ({ page }) => {
    const off = sw(page, "en-off");
    await expect(off).toHaveAttribute("aria-checked", "false");
    const b = await box(off);
    const k = await box(knob(page, "en-off"));
    expect(k.x + k.width / 2, "the knob is left of centre").toBeLessThan(b.x + b.width / 2);
    expect(k.x - b.x).toBeCloseTo(5, 0);
    expect(b.x + b.width - (k.x + k.width)).toBeGreaterThanOrEqual(30);
    const track = (await css(off, ["background-color"]))["background-color"];
    expect(track).toBe(rgb("tab-idle"));
    expect(track).not.toBe(rgb("stamp"));
    expect(await shownWord(page, "en-off")).toEqual(["OFF"]);
    // Same shape as the on switch.
    expect(await css(off, ["border-top-width", "border-top-color", "border-top-left-radius"])).toEqual({ "border-top-width": "2px", "border-top-color": rgb("ink"), "border-top-left-radius": "4px" });
  });

  test("81: with colour removed, on and off still differ by the knob's side and its word", async ({ page }, testInfo) => {
    await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
    for (const lang of langs) {
      const [on, off] = [await box(sw(page, `${lang}-on`)), await box(sw(page, `${lang}-off`))];
      const [onKnob, offKnob] = [await box(knob(page, `${lang}-on`)), await box(knob(page, `${lang}-off`))];
      expect(onKnob.x - on.x, lang).toBeGreaterThan(offKnob.x - off.x + 20);
      const [onWord, offWord] = [await shownWord(page, `${lang}-on`), await shownWord(page, `${lang}-off`)];
      expect(onWord, lang).toHaveLength(1);
      expect(offWord, lang).toHaveLength(1);
      expect(onWord[0], lang).not.toBe(offWord[0]);
    }
    await sw(page, "en-on").scrollIntoViewIfNeeded();
    await attachScreenshot(testInfo, "switch-greyscale.png", await page.screenshot());
  });

  test("82: it is a switch with its name and state; a tap, Space and Enter each flip it; the knob jumps with no animation", async ({ page }) => {
    const control = page.getByTestId("section-switch").getByTestId("lang-en").getByRole("switch", { name: "Automatic reminders" }).nth(1);
    await expect(control).toHaveAttribute("data-testid", "switch-en-off");
    await expect(control).toHaveAttribute("aria-checked", "false");
    expect((await css(control, ["transition-duration", "animation-name"]))).toEqual({ "transition-duration": "0s", "animation-name": "none" });
    expect((await css(knob(page, "en-off"), ["transition-duration", "animation-name"]))).toEqual({ "transition-duration": "0s", "animation-name": "none" });
    const width = (await box(control)).width;

    await control.tap();
    await expect(control).toHaveAttribute("aria-checked", "true");
    // No polling: with no transition the knob is already on the other side.
    let b = await box(control);
    let k = await box(knob(page, "en-off"));
    expect(k.x + k.width / 2).toBeGreaterThan(b.x + b.width / 2);
    expect((await css(control, ["background-color"]))["background-color"]).toBe(rgb("stamp"));
    expect(await shownWord(page, "en-off")).toEqual(["ON"]);
    expect(b.width, "the width does not change when it is switched").toBe(width);
    // The page's landing stamp keeps its two finished animations; nothing in or on a switch has one.
    expect(
      await page.evaluate(() =>
        document.getAnimations().filter((a) => (a.effect instanceof KeyframeEffect ? a.effect.target?.closest('[role="switch"]') : null)).length,
      ),
    ).toBe(0);

    await control.focus();
    await page.keyboard.press("Space");
    await expect(control).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Enter");
    await expect(control).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Enter");
    await expect(control).toHaveAttribute("aria-checked", "false");
    b = await box(control);
    k = await box(knob(page, "en-off"));
    expect(k.x + k.width / 2).toBeLessThan(b.x + b.width / 2);
    expect(await shownWord(page, "en-off")).toEqual(["OFF"]);
  });

  test("82: a switch can be named by the visible words beside it, and the knob's word is not part of the name", async ({ page }) => {
    for (const lang of langs) {
      const control = sw(page, `${lang}-labelled`);
      const words = await control.locator("xpath=preceding-sibling::span").textContent();
      expect(words?.trim().length, lang).toBeGreaterThan(5);
      await expect(control, lang).toHaveAccessibleName(words!.trim());
      await expect(control.locator("> span"), lang).toHaveAttribute("aria-hidden", "true");
    }
    await expect(sw(page, "en-on")).toHaveAccessibleName("Automatic reminders");
  });

  test("82: Tab reaches it and shows the 3px ring 4px away; a tap shows none", async ({ page }) => {
    const control = sw(page, "en-on");
    await tabTo(page, control);
    expect(await css(control, ["outline-style", "outline-width", "outline-offset", "outline-color"])).toEqual({
      "outline-style": "solid",
      "outline-width": "3px",
      "outline-offset": "4px",
      "outline-color": rgb("blue"),
    });
    await sw(page, "en-off").tap();
    expect((await css(sw(page, "en-off"), ["outline-style"]))["outline-style"]).toBe("none");
    for (const id of ["focus-on", "focus-off"]) {
      expect((await css(sw(page, id), ["outline-style", "outline-width", "outline-color"])), id).toEqual({ "outline-style": "solid", "outline-width": "3px", "outline-color": rgb("blue") });
    }
  });

  for (const lang of langs) {
    test(`83: ${lang}: a longer word is whole and at least 14px, the switch is wider than 76px, and the same width on and off`, async ({ page }) => {
      const [on, off] = [sw(page, `${lang}-long-on`), sw(page, `${lang}-long-off`)];
      for (const [id, control] of [[`${lang}-long-on`, on], [`${lang}-long-off`, off]] as const) {
        const k = knob(page, id);
        expect(await holdsItsContent(k), `${id}: the knob holds its word`).toBe(true);
        for (const word of await k.locator("> span").all()) {
          expect(await holdsItsContent(word), id).toBe(true);
          expect(parseFloat((await css(word, ["font-size"]))["font-size"]), id).toBeGreaterThanOrEqual(14);
          expect((await css(word, ["text-overflow", "overflow-x"])), id).toEqual({ "text-overflow": "clip", "overflow-x": "visible" });
          expect(await lineCount(word), `${id}: the word is on one line`).toBe(1);
        }
        const b = await box(control);
        // Well clear of 76, not a pixel over it: the long words are 60 to 90px wide.
        expect(b.width, id).toBeGreaterThan(90);
        expect(b.height, id).toBeGreaterThanOrEqual(44);
        // The knob and its strip of track are both inside the switch.
        const kb = await box(k);
        expect(kb.x, id).toBeGreaterThanOrEqual(b.x + 4.5);
        expect(kb.x + kb.width, id).toBeLessThanOrEqual(b.x + b.width - 4.5);
        expect(b.width - kb.width, `${id}: track still shows beside the knob`).toBeGreaterThanOrEqual(38);
      }
      const before = (await box(off)).width;
      expect(Math.abs((await box(on)).width - before), "on and off are the same width").toBeLessThanOrEqual(0.5);
      await off.tap();
      await expect(off).toHaveAttribute("aria-checked", "true");
      expect(Math.abs((await box(off)).width - before), "switching does not change the width").toBeLessThanOrEqual(0.01);
      if (lang !== "en") await expect(knob(page, `${lang}-long-on`)).toContainText(scriptPattern[lang]);
      expect(await sidewaysScroll(page)).toBe(0);
    });
  }

  for (const lang of indicLangs) {
    test(`${lang}: the knob word is the script's own face at 15px with no letter-spacing`, async ({ page }) => {
      const word = knob(page, `${lang}-on`).locator("> span").nth(1);
      expect(await css(word, ["font-size", "font-weight", "letter-spacing", "text-transform"])).toEqual({
        "font-size": "15px",
        "font-weight": "800",
        "letter-spacing": "normal",
        "text-transform": "none",
      });
    });
  }
});
