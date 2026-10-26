// Spec F2b, /dev/components: Segmented, SummaryBar (was StudentStrip), Switch, BottomNav and Banner (criteria 70 to 93),
// at the phone viewport. Each describe block names the acceptance criteria it proves
// (docs/specs/F2-design-system.md). The whole-page checks in dev-components.spec.ts walk these
// sections too; the block at the end of this file holds the ones that needed new code.
//
// Sizes that depend on how a word is set are given slack on purpose: exact-pixel checks on text
// failed on the Linux CI runner in F2a. Exact checks are kept for things CSS fixes outright
// (border widths, colours, a min-height with short text).
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  attachScreenshot,
  box,
  css,
  familyOf,
  firstFamily,
  fontProbe,
  indicLangs,
  langs,
  openDevPage,
  rgb,
  scriptFontVariable,
  scriptPattern,
  shadow,
  sidewaysScroll,
  textProblems,
} from "./helpers";

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

/**
 * True when the element's content is not wider or taller than its box: nothing is cut.
 * Sideways the check is tight. Downwards it allows 15% of the font size: the Anek faces' own
 * content area is a little taller than their line (2px at 19.5px text), which overhangs the line
 * box without anything being cut. Whether an ancestor clips is checked by `textProblems`.
 */
function holdsItsContent(locator: Locator): Promise<boolean> {
  return locator.first().evaluate((el) => {
    const slack = Math.max(1, parseFloat(getComputedStyle(el).fontSize) * 0.15);
    return el.scrollWidth <= el.clientWidth + 1 && el.scrollHeight <= el.clientHeight + slack;
  });
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

  test("71: every segment on the page is at least 48px tall, and the target inside its 2px line is at least 44 by 44", async ({ page }) => {
    // The segment is the label: the box that is filled when chosen and that draws the 2px lines.
    // The radio is laid over the inside of those lines, so it is 2px shorter and narrower than its segment.
    const all = section(page, "segmented").locator("fieldset [data-segment]");
    const measured = await all.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        const radio = el.querySelector('input[type="radio"]');
        const t = radio?.getBoundingClientRect();
        return {
          tag: el.tagName,
          height: r.height,
          sizing: s.boxSizing,
          line: s.borderTopWidth,
          radios: el.querySelectorAll('input[type="radio"]').length,
          target: t ? { width: t.width, height: t.height } : null,
          // How far the target's top and left are inside the segment's: the 2px line.
          inset: t ? { top: t.top - r.top, left: t.left - r.left, bottom: r.bottom - t.bottom, right: r.right - t.right } : null,
        };
      }),
    );
    expect(measured.length).toBeGreaterThan(50);
    // Every radio in the section is in exactly one of the segments measured: none is missed.
    await expect(section(page, "segmented").getByRole("radio")).toHaveCount(measured.length);
    for (const m of measured) {
      expect({ tag: m.tag, sizing: m.sizing, line: m.line, radios: m.radios }).toEqual({ tag: "LABEL", sizing: "border-box", line: "2px", radios: 1 });
      expect(m.height, "the segment").toBeGreaterThanOrEqual(48);
      expect(m.target!.height, "the target").toBeGreaterThanOrEqual(44);
      expect(m.target!.width, "the target").toBeGreaterThanOrEqual(44);
      // The target is the inside of the segment: under the 2px line at the top and left, and reaching the other two edges.
      expect(m.inset!.top).toBeCloseTo(2, 1);
      expect(m.inset!.left).toBeCloseTo(2, 1);
      expect(m.inset!.bottom).toBeCloseTo(0, 1);
      expect(m.inset!.right).toBeCloseTo(0, 1);
    }
    // With short text the minimum is what sets the height: exactly 48, and a 46px target.
    const short = await group(page, "two-en")
      .locator("[data-segment]")
      .evaluateAll((els) => els.map((el) => ({ height: el.getBoundingClientRect().height, target: el.querySelector("input")!.getBoundingClientRect().height })));
    expect(short).toEqual([
      { height: 48, target: 46 },
      { height: 48, target: 46 },
    ]);
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

  /** The visible words that name a switch, found the way a screen reader finds them: by the id in aria-labelledby. */
  const wordsOf = async (page: Page, control: Locator): Promise<Locator> => {
    const id = await control.getAttribute("aria-labelledby");
    expect(id, "the switch names its words by id").toBeTruthy();
    expect(id!.trim().split(/\s+/), "one id").toHaveLength(1);
    return page.locator(`[id="${id}"]`);
  };

  test("82: a switch can be named by the visible words beside it, and the knob's word is not part of the name", async ({ page }) => {
    for (const lang of langs) {
      const control = sw(page, `${lang}-labelled`);
      const words = await wordsOf(page, control);
      await expect(words, lang).toHaveCount(1);
      await expect(words, lang).toBeVisible();
      const text = ((await words.textContent()) ?? "").trim();
      expect(text.length, lang).toBeGreaterThan(5);
      if (lang !== "en") expect(text, lang).toMatch(scriptPattern[lang]);
      // The name is the words, whole and once: a label that both points at the switch and is
      // named by it must not be counted twice, and the knob's ON or OFF must not be added.
      await expect(control, lang).toHaveAccessibleName(text);
      await expect(control, lang).not.toHaveAttribute("aria-label");
      await expect(control.locator("> span"), lang).toHaveAttribute("aria-hidden", "true");
      for (const word of await control.locator("> span > span").allTextContents()) {
        expect(word.trim().length, lang).toBeGreaterThan(0);
        expect(text, `${lang}: the knob's word is not in the name`).not.toContain(word.trim());
      }
      await expect(page.getByTestId("section-switch").getByRole("switch", { name: text, exact: true }), lang).toHaveCount(1);
    }
    await expect(sw(page, "en-on")).toHaveAccessibleName("Automatic reminders");
  });

  for (const lang of langs) {
    test(`82: ${lang}: a tap on the visible words switches it, and a second tap switches it back`, async ({ page }) => {
      const control = sw(page, `${lang}-labelled`);
      const words = await wordsOf(page, control);
      await expect(words).toHaveCount(1);
      // The words are a separate box beside the switch: a tap on them does not land on the switch itself.
      const [w, c] = [await box(words), await box(control)];
      expect(w.x + w.width, "the words end before the switch starts").toBeLessThanOrEqual(c.x);
      expect(w.width).toBeGreaterThan(20);

      const before = await control.getAttribute("aria-checked");
      expect(["true", "false"]).toContain(before);
      const flipped = before === "true" ? "false" : "true";
      // A real tap in the middle of the words. Playwright checks that the words, not something over them, receive it.
      await words.tap();
      await expect(control).toHaveAttribute("aria-checked", flipped);
      // The knob has changed sides and shows the other word, as it does for a tap on the switch.
      const k = await box(knob(page, `${lang}-labelled`));
      if (flipped === "true") expect(k.x + k.width / 2).toBeGreaterThan(c.x + c.width / 2);
      else expect(k.x + k.width / 2).toBeLessThan(c.x + c.width / 2);
      expect(await shownWord(page, `${lang}-labelled`)).toHaveLength(1);
      await words.tap();
      await expect(control).toHaveAttribute("aria-checked", before!);
      // One tap, one change: a third tap is a third change, not two.
      await words.tap();
      await expect(control).toHaveAttribute("aria-checked", flipped);
      // The other switches in this language's block were not touched.
      await expect(sw(page, `${lang}-on`)).toHaveAttribute("aria-checked", "true");
      await expect(sw(page, `${lang}-off`)).toHaveAttribute("aria-checked", "false");
    });
  }

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

// UX-review-fixes-2 item 4 replaced StudentStrip with SummaryBar (R1-6 criteria 14 and 34 amended). Its section sits
// where the strip's was; the strip's criteria 75 to 79 are retired with it.
test.describe("SummaryBar: UX-review-fixes-2, criteria 4.2 to 4.4", () => {
  const parts = (page: Page, id: string) =>
    page
      .getByTestId(`summary-${id}`)
      .locator("[data-part]")
      .evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return { part: el.getAttribute("data-part"), width: r.width, height: r.height, bottom: r.bottom, fill: s.backgroundColor, border: s.borderTopWidth };
        }),
      );

  test("4.2, 4.3: three parts in order, widths in proportion, bottoms level; Collected solid, Due highlighted with an edge, Overdue taller", async ({ page }) => {
    const p = await parts(page, "typical-en");
    expect(p.map((x) => x.part)).toEqual(["collected", "due", "overdue"]);
    // ₹12,000 : ₹4,500 : ₹3,000.
    expect(p[0].width / p[2].width).toBeCloseTo(4, 0);
    expect(p[1].width / p[2].width).toBeCloseTo(1.5, 0);
    for (const x of p) expect(Math.abs(x.bottom - p[0].bottom)).toBeLessThanOrEqual(0.5);
    expect({ height: p[0].height, fill: p[0].fill, border: p[0].border }).toEqual({ height: 14, fill: rgb("stamp"), border: "0px" });
    expect({ height: p[1].height, fill: p[1].fill, border: p[1].border }).toEqual({ height: 14, fill: rgb("highlight"), border: "2px" });
    expect({ height: p[2].height, fill: p[2].fill, border: p[2].border }).toEqual({ height: 24, fill: rgb("cloth"), border: "0px" });
  });

  test("4.3: a zero part is not drawn but its label shows ₹0; all zero draws no bar; a tiny part is still 4px", async ({ page }) => {
    expect((await parts(page, "one-zero")).map((x) => x.part)).toEqual(["collected", "due"]);
    await expect(page.getByTestId("summary-one-zero").locator("[data-label='overdue']")).toHaveText("Overdue ₹0");
    await expect(page.getByTestId("summary-all-zero").locator("[data-summary-bar]")).toHaveCount(0);
    await expect(page.getByTestId("summary-all-zero").locator("[data-label]")).toHaveText(["Collected ₹0", "Due ₹0", "Overdue ₹0"]);
    const tiny = await parts(page, "tiny");
    for (const x of tiny) expect(x.width).toBeGreaterThanOrEqual(4);
  });

  test("4.4: the bar is hidden from screen readers and nothing in it can be focused; the labels are a list in order", async ({ page }) => {
    const example = page.getByTestId("summary-typical-en");
    await expect(example.locator("[data-summary-bar]")).toHaveAttribute("aria-hidden", "true");
    await expect(example.getByRole("listitem")).toHaveText(["Collected ₹12,000", "Due ₹4,500", "Overdue ₹3,000"]);
    expect(await section(page, "summary-bar").locator("a, button, input, [tabindex]").count()).toBe(0);
  });

  test("while Collected is read its label has a grey block and screen-reader words, and no Collected part", async ({ page }) => {
    const example = page.getByTestId("summary-pending");
    await expect(example.locator("[data-label='collected'] [data-pending]")).toBeVisible();
    await expect(example.locator("[data-label='collected'] .sr-only")).toHaveText("Reading");
    expect((await parts(page, "pending")).map((x) => x.part)).toEqual(["due", "overdue"]);
  });

  for (const lang of langs) {
    test(`4.4: ${lang}: the long labels wrap inside 360px; amounts are DM Mono with 0 to 9 digits`, async ({ page }) => {
      const list = page.getByTestId(`summary-long-${lang}`).getByRole("list");
      for (const item of await list.getByRole("listitem").all()) expect((await box(item)).x + (await box(item)).width).toBeLessThanOrEqual(360.5);
      expect(await textProblems(page, `[data-testid="summary-long-${lang}"]`)).toEqual([]);
      for (const amount of await list.locator(".type-amount-row").all()) {
        expect((await css(amount, ["font-family"]))["font-family"].split(",")[0]).toBe('"DM Mono"');
        await expect(amount).toHaveText(/^₹[0-9,]+$/);
      }
    });
  }
});

test.describe("BottomNav: criteria 84, 85, 86, 87", () => {
  const nav = (page: Page, id: string) => page.getByTestId(`nav-${id}`).getByRole("navigation");
  const links = (page: Page, id: string) => nav(page, id).getByRole("link");
  const currentIn = { en: 0, hi: 1, kn: 2, te: 3 } as const;

  test("84: a slip bar with a 2px ink top border, at least 64px tall, in four equal columns in the fixed order", async ({ page }) => {
    const bar = nav(page, "en");
    expect(await css(bar, ["background-color", "border-top-width", "border-top-style", "border-top-color", "border-bottom-width"])).toEqual({
      "background-color": rgb("slip"),
      "border-top-width": "2px",
      "border-top-style": "solid",
      "border-top-color": rgb("ink"),
      "border-bottom-width": "0px",
    });
    const b = await box(bar);
    expect(b.height).toBeGreaterThanOrEqual(64);
    expect(b.width).toBe(360);
    await expect(links(page, "en")).toHaveText(["Home", "Students", "Attendance", "More"]);
    const cells = await boxes(links(page, "en"));
    expect(cells).toHaveLength(4);
    for (const [i, cell] of cells.entries()) {
      expect(cell.width, "equal columns").toBeCloseTo(90, 1);
      expect(cell.x - b.x, "columns side by side").toBeCloseTo(90 * i, 1);
    }
  });

  test("84: each item is a link with a 24px icon above a label of 14px or more at weight 700", async ({ page }) => {
    for (const link of await links(page, "en").all()) {
      await expect(link).toHaveAttribute("href", "#top");
      const icon = await box(link.locator("svg"));
      const label = await box(link.locator("> span").nth(1));
      expect(icon.width).toBe(24);
      expect(icon.height).toBe(24);
      expect(icon.y + icon.height, "the icon is above the label").toBeLessThanOrEqual(label.y + 0.5);
      // Centred over it.
      expect(Math.abs(icon.x + icon.width / 2 - (label.x + label.width / 2))).toBeLessThanOrEqual(1);
      expect(await css(link.locator("> span").nth(1), ["font-size", "font-weight"])).toEqual({ "font-size": "14px", "font-weight": "700" });
    }
  });

  for (const lang of langs) {
    test(`85: ${lang}: only the current item has the 5px red bar and ink text; the others have no visible bar and ink-label text; it is the current page`, async ({ page }) => {
      const all = await links(page, lang).all();
      for (const [i, link] of all.entries()) {
        const look = await css(link, ["border-top-width", "border-top-style", "border-top-color", "color"]);
        const current = i === currentIn[lang];
        // Every item has the 5px slot, so labels line up; only the current one's is drawn.
        expect(look["border-top-width"], `${lang} ${i}`).toBe("5px");
        expect(look["border-top-color"], `${lang} ${i}`).toBe(current ? rgb("cloth") : TRANSPARENT);
        expect(look.color, `${lang} ${i}`).toBe(current ? rgb("ink") : rgb("ink-label"));
        if (current) await expect(link).toHaveAttribute("aria-current", "page");
        else await expect(link).not.toHaveAttribute("aria-current");
      }
      await expect(nav(page, lang).locator('[aria-current="page"]')).toHaveCount(1);
      // The labels sit on one line across the bar whichever item is current.
      const labels = await boxes(links(page, lang).locator("> span:nth-child(2)"));
      for (const l of labels) expect(Math.abs(l.y - labels[0].y), lang).toBeLessThanOrEqual(1);
    });
  }

  test("85: with colour removed the current item is still the one with a bar across its top", async ({ page }, testInfo) => {
    await page.addStyleTag({ content: "html { filter: grayscale(1); }" });
    for (const lang of langs) {
      const bars = await links(page, lang).evaluateAll((els) => els.map((el) => getComputedStyle(el).borderTopColor !== "rgba(0, 0, 0, 0)"));
      expect(bars, lang).toEqual([0, 1, 2, 3].map((i) => i === currentIn[lang]));
    }
    await nav(page, "en").scrollIntoViewIfNeeded();
    await attachScreenshot(testInfo, "bottom-nav-greyscale.png", await page.screenshot());
  });

  test("86: a named navigation landmark; each link's target is its whole column at the bar's full height; icons are hidden", async ({ page }) => {
    await expect(nav(page, "en")).toHaveAccessibleName("Main");
    await expect(nav(page, "hi")).toHaveAccessibleName(/\p{Script=Devanagari}/u);
    for (const id of ["en", "hi", "kn", "te", "long-en", "long-te"]) {
      const bar = await box(nav(page, id));
      for (const cell of await boxes(links(page, id))) {
        expect(cell.width, id).toBeCloseTo(bar.width / 4, 1);
        // The bar's height less its own 2px top border.
        expect(cell.height, id).toBeCloseTo(bar.height - 2, 1);
        expect(cell.y, id).toBeCloseTo(bar.y + 2, 1);
        expect(cell.height, id).toBeGreaterThanOrEqual(64);
      }
    }
    for (const link of await links(page, "en").all()) {
      await expect(link.locator("> span").first()).toHaveAttribute("aria-hidden", "true");
      await expect(link.locator("> span").first().locator("svg")).toHaveCount(1);
    }
    await expect(links(page, "en").nth(2)).toHaveAccessibleName("Attendance");
  });

  test("86: Tab reaches each item and draws a 3px blue ring inside it, not clipped by the screen edge; a tap draws none", async ({ page }) => {
    const first = links(page, "en").first();
    await tabTo(page, first);
    const ring = ["outline-style", "outline-width", "outline-offset", "outline-color"] as const;
    const inside = { "outline-style": "solid", "outline-width": "3px", "outline-offset": "-3px", "outline-color": rgb("blue") };
    expect(await css(first, ring)).toEqual(inside);
    // The first item starts at the screen's left edge; a ring drawn inside it is wholly on screen.
    const b = await box(first);
    expect(b.x).toBe(0);
    for (let i = 1; i < 4; i++) {
      await page.keyboard.press("Tab");
      await expect(links(page, "en").nth(i)).toBeFocused();
      expect(await css(links(page, "en").nth(i), ring), `item ${i}`).toEqual(inside);
    }
    const last = await box(links(page, "en").nth(3));
    expect(last.x + last.width).toBe(360);
    expect(await sidewaysScroll(page)).toBe(0);

    // The frozen example shows it without a keyboard, on the current item and on another.
    const forced = page.getByTestId("nav-focus").locator('[data-force="focus"]');
    await expect(forced).toHaveCount(2);
    for (const link of await forced.all()) expect(await css(link, ring)).toEqual(inside);

    // A link that is tapped is not ringed. (The links go to the top of this page.)
    await page.reload();
    await links(page, "en").nth(1).tap();
    expect((await css(links(page, "en").nth(1), ["outline-style"]))["outline-style"]).toBe("none");
  });

  for (const lang of langs) {
    test(`87: ${lang}: long labels wrap and the bar grows; nothing is cut, at the default size and at 130%`, async ({ page }) => {
      const standard = (await box(nav(page, lang))).height;
      const long = nav(page, `long-${lang}`);
      const check = async (when: string) => {
        for (const link of await links(page, `long-${lang}`).all()) {
          const label = link.locator("> span").nth(1);
          expect(await holdsItsContent(link), `${when}: a link holds its label`).toBe(true);
          expect(await holdsItsContent(label), `${when}: the label is whole`).toBe(true);
          expect(await css(label, ["text-overflow", "white-space", "overflow-x"]), when).toEqual({ "text-overflow": "clip", "white-space": "normal", "overflow-x": "visible" });
          expect(parseFloat((await css(label, ["font-size"]))["font-size"]), when).toBeGreaterThanOrEqual(14);
          // The label stays inside its own column.
          const [cell, text] = [await box(link), await box(label)];
          expect(text.x, when).toBeGreaterThanOrEqual(cell.x - 0.5);
          expect(text.x + text.width, when).toBeLessThanOrEqual(cell.x + cell.width + 0.5);
          expect(text.y + text.height, when).toBeLessThanOrEqual(cell.y + cell.height + 0.5);
        }
        expect(await sidewaysScroll(page), when).toBe(0);
      };

      // The long labels take more than one line, so the bar is taller than the standard one.
      expect(await lineCount(links(page, `long-${lang}`).nth(2).locator("> span").nth(1)), "the long label wraps").toBeGreaterThanOrEqual(2);
      const grown = (await box(long)).height;
      expect(grown, "the bar grows").toBeGreaterThan(standard + 10);
      await check("default size");
      if (lang !== "en") await expect(long).toContainText(scriptPattern[lang]);

      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "130%"));
      await expect.poll(async () => parseFloat((await css(links(page, `long-${lang}`).first().locator("> span").nth(1), ["font-size"]))["font-size"])).toBeGreaterThan(18);
      expect((await box(long)).height, "taller again at 130%").toBeGreaterThan(grown + 10);
      await check("130%");
      // The standard bar's labels are whole at 130% as well.
      for (const link of await links(page, lang).all()) expect(await holdsItsContent(link), "standard bar at 130%").toBe(true);
    });
  }

  for (const lang of indicLangs) {
    test(`${lang}: nav labels are the script's own face at 15px, weight 700, with no letter-spacing`, async ({ page }) => {
      const label = links(page, lang).first().locator("> span").nth(1);
      expect(await css(label, ["font-size", "font-weight", "letter-spacing", "text-transform"])).toEqual({
        "font-size": "15px",
        "font-weight": "700",
        "letter-spacing": "normal",
        "text-transform": "none",
      });
    });
  }
});

test.describe("Banner and its flat buttons: criteria 89, 90, 91, 92, 93 (and 88 in a real browser)", () => {
  const banner = (page: Page, id: string, kind?: string) => page.getByTestId(`banner-${id}`).locator(kind ? `[data-kind="${kind}"]` : "[data-kind]");
  const actions = (b: Locator) => b.locator("button, a");
  const ring = ["outline-style", "outline-width", "outline-offset", "outline-color"] as const;

  test("88, in the browser: offline and undo are polite statuses, error is an alert; the page shows no fourth kind", async ({ page }) => {
    await expect(banner(page, "offline-en")).toHaveRole("status");
    await expect(banner(page, "undo-en")).toHaveRole("status");
    await expect(banner(page, "error-en")).toHaveRole("alert");
    const kinds = await section(page, "banner").locator("[data-kind]").evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("data-kind")))].sort());
    expect(kinds).toEqual(["error", "offline", "undo"]);
    // Shape, not colour: a square strip with no border, a bordered square box with a shadow, a rounded block.
    const shape = async (b: Locator) => ({ ...(await css(b, ["border-top-width", "border-top-left-radius"])), shadow: (await shadow(b)) !== "none" });
    expect(await shape(banner(page, "offline-en"))).toEqual({ "border-top-width": "0px", "border-top-left-radius": "0px", shadow: false });
    expect(await shape(banner(page, "error-en"))).toEqual({ "border-top-width": "2px", "border-top-left-radius": "0px", shadow: true });
    expect(await shape(banner(page, "undo-en"))).toEqual({ "border-top-width": "0px", "border-top-left-radius": "4px", shadow: false });
  });

  test("89: offline is a full-width ink strip with a highlight mark, a slip title at 16px bold and an on-cloth detail, and no actions", async ({ page }) => {
    const b = banner(page, "offline-en");
    const strip = await box(b);
    expect(strip.x).toBe(0);
    expect(strip.width).toBe(360);
    expect((await css(b, ["background-color"]))["background-color"]).toBe(rgb("ink"));
    const [title, detail] = [b.locator("p").first(), b.locator("p").nth(1)];
    await expect(title).toHaveText("You are offline");
    expect(await css(title, ["color", "font-size", "font-weight"])).toEqual({ color: rgb("slip"), "font-size": "16px", "font-weight": "700" });
    expect((await css(detail, ["color"])).color).toBe(rgb("on-cloth"));
    expect(parseFloat((await css(detail, ["font-size"]))["font-size"])).toBeGreaterThanOrEqual(14);
    // The mark leads, is 24px, is drawn in highlight, and is hidden from screen readers.
    const mark = b.locator("svg");
    const m = await box(mark);
    expect(m.width).toBe(24);
    expect(m.x + m.width).toBeLessThanOrEqual((await box(title)).x);
    expect((await css(mark, ["stroke"])).stroke).toBe(rgb("highlight"));
    await expect(b.locator("> span").first()).toHaveAttribute("aria-hidden", "true");
    await expect(actions(b)).toHaveCount(0);
    expect(await b.evaluate((el) => el.querySelectorAll("[tabindex], input").length)).toBe(0);
  });

  test("90: error is slip with a 2px red border and a solid red offset shadow; red title at 18px/800, soft-ink detail", async ({ page }) => {
    const b = banner(page, "error-en");
    expect(await css(b, ["background-color", "border-top-width", "border-top-style", "border-top-color", "border-left-color", "border-bottom-color", "border-right-color"])).toEqual({
      "background-color": rgb("slip"),
      "border-top-width": "2px",
      "border-top-style": "solid",
      "border-top-color": rgb("cloth"),
      "border-left-color": rgb("cloth"),
      "border-bottom-color": rgb("cloth"),
      "border-right-color": rgb("cloth"),
    });
    // 5px right, 5px down, zero blur, zero spread, in cloth.
    expect(await shadow(b)).toBe(`${rgb("cloth")} 5px 5px 0px 0px`);
    const [title, detail] = [b.locator("p").first(), b.locator("p").nth(1)];
    expect(await css(title, ["color", "font-size", "font-weight"])).toEqual({ color: rgb("cloth"), "font-size": "18px", "font-weight": "800" });
    expect((await css(detail, ["color"])).color).toBe(rgb("ink-soft"));
    expect(parseFloat((await css(detail, ["font-size"]))["font-size"])).toBeGreaterThanOrEqual(14);
    // It says what happened and what is safe.
    await expect(detail).toContainText("Nothing is lost");
    // The shadow stays on the screen.
    const outer = await box(b);
    expect(outer.x + outer.width + 5).toBeLessThanOrEqual(360);
    expect(await sidewaysScroll(page)).toBe(0);
  });

  test("90: up to two actions, each at least 48px tall: the main one black, the other outlined, neither with a shadow, none red", async ({ page }) => {
    const [main, other] = await actions(banner(page, "error-en")).all();
    expect(await css(main, ["background-color", "color", "border-top-color", "border-top-width", "border-top-left-radius"])).toEqual({
      "background-color": rgb("ink"),
      color: rgb("slip"),
      "border-top-color": rgb("ink"),
      "border-top-width": "2px",
      "border-top-left-radius": "4px",
    });
    expect(await css(other, ["background-color", "color", "border-top-color", "border-top-width"])).toEqual({
      "background-color": TRANSPARENT,
      color: rgb("ink"),
      "border-top-color": rgb("ink"),
      "border-top-width": "2px",
    });
    for (const action of [main, other]) {
      expect((await box(action)).height).toBeGreaterThanOrEqual(48);
      expect(await shadow(action)).toBe("none");
    }
    await expect(actions(banner(page, "error-one"))).toHaveCount(1);
    await expect(actions(banner(page, "error-none"))).toHaveCount(0);
    await expect(banner(page, "error-none")).toBeVisible();

    // Red is never a button, in any banner on the page.
    const redControls = await section(page, "banner")
      .locator("button, a")
      .evaluateAll(
        (els, red) =>
          els.filter((el) => {
            const s = getComputedStyle(el);
            return s.backgroundColor === red || s.color === red || s.borderTopColor === red;
          }).length,
        rgb("cloth"),
      );
    expect(redControls).toBe(0);
  });

  test("91: undo is an ink block with 4px corners and a slip message at 16px bold; one action outlined in slip, one filled slip with ink text", async ({ page }) => {
    const b = banner(page, "undo-en");
    expect(await css(b, ["background-color", "border-top-left-radius", "border-bottom-right-radius"])).toEqual({
      "background-color": rgb("ink"),
      "border-top-left-radius": "4px",
      "border-bottom-right-radius": "4px",
    });
    const message = b.locator("p");
    await expect(message).toHaveText("Ravi Kumar marked paid, ₹1,200");
    expect(await css(message, ["color", "font-size", "font-weight"])).toEqual({ color: rgb("slip"), "font-size": "16px", "font-weight": "700" });
    const [first, second] = await actions(b).all();
    expect(await css(first, ["background-color", "color", "border-top-color", "border-top-width"])).toEqual({
      "background-color": TRANSPARENT,
      color: rgb("slip"),
      "border-top-color": rgb("slip"),
      "border-top-width": "2px",
    });
    expect(await css(second, ["background-color", "color", "border-top-color"])).toEqual({ "background-color": rgb("slip"), color: rgb("ink"), "border-top-color": rgb("slip") });
    for (const action of [first, second]) {
      expect((await box(action)).height).toBeGreaterThanOrEqual(48);
      expect(await shadow(action)).toBe("none");
    }
    // The second is a link with an icon before its words.
    expect(await second.evaluate((el) => el.tagName)).toBe("A");
    await expect(second).toHaveAttribute("href", "#top");
    const icon = await box(second.locator("svg"));
    expect(icon.x + icon.width).toBeLessThanOrEqual((await box(second.locator("> span").nth(1))).x + 0.5);
    await expect(second).toHaveAccessibleName("Send receipt");
    expect(await first.evaluate((el) => el.tagName)).toBe("BUTTON");
  });

  test("the actions report back: each tap on the working banners is counted once", async ({ page }) => {
    const live = page.getByTestId("banner-live");
    const taps = page.getByTestId("banner-live-taps");
    await expect(taps).toHaveText("0 0 0 0");
    await live.getByRole("button", { name: "Try again" }).tap();
    await expect(taps).toHaveText("1 0 0 0");
    await live.getByRole("button", { name: "Later" }).tap();
    await live.getByRole("button", { name: "Undo" }).tap();
    await live.getByRole("button", { name: "Send receipt" }).tap();
    await live.getByRole("button", { name: "Send receipt" }).tap();
    await expect(taps).toHaveText("1 1 1 2");
    // The banners are still there: they never close themselves.
    await expect(live.locator("[data-kind]")).toHaveCount(2);
  });

  for (const lang of langs) {
    test(`92: ${lang}: side by side the two actions share one height; long text and labels wrap, nothing is cut, also at 130%`, async ({ page }) => {
      // Side by side: the two-action error banner in every language has short labels.
      const pair = await boxes(actions(banner(page, `error-${lang}`)));
      expect(pair).toHaveLength(2);
      expect(Math.abs(pair[0].y - pair[1].y), "on one row").toBeLessThanOrEqual(0.5);
      expect(Math.abs(pair[0].height - pair[1].height), "one height").toBeLessThanOrEqual(0.5);
      expect(pair[0].width, "the main action takes the spare width").toBeGreaterThan(pair[1].width);
      expect(pair[1].width, "the lesser action keeps a thumb's width").toBeGreaterThanOrEqual(96);

      const check = async (when: string) => {
        for (const kind of ["error", "undo"]) {
          const b = banner(page, `long-${lang}`, kind);
          const outer = await box(b);
          for (const text of await b.locator("p").all()) {
            expect(await holdsItsContent(text), `${when} ${kind}: text is whole`).toBe(true);
            expect(await css(text, ["text-overflow", "white-space", "overflow-x"]), when).toEqual({ "text-overflow": "clip", "white-space": "normal", "overflow-x": "visible" });
          }
          const row = await boxes(actions(b));
          expect(row, `${when} ${kind}`).toHaveLength(2);
          for (const [i, a] of row.entries()) {
            expect(a.height, `${when} ${kind}: at least 48px`).toBeGreaterThanOrEqual(48);
            // Inside the banner, and inside the screen.
            expect(a.x, `${when} ${kind}`).toBeGreaterThanOrEqual(outer.x);
            expect(a.x + a.width, `${when} ${kind}: the action is inside its banner`).toBeLessThanOrEqual(outer.x + outer.width + 0.5);
            expect(a.x + a.width, `${when} ${kind}: the action is on the screen`).toBeLessThanOrEqual(360);
            expect(a.y + a.height, `${when} ${kind}: the banner grows with its actions`).toBeLessThanOrEqual(outer.y + outer.height + 0.5);
            const control = actions(b).nth(i);
            expect(await holdsItsContent(control), `${when} ${kind}: the label is whole`).toBe(true);
            expect((await css(control.locator("span").last(), ["text-overflow", "white-space"])), when).toEqual({ "text-overflow": "clip", "white-space": "normal" });
          }
          // Either they share a row and a height, or the second has dropped below the first, whole.
          const sameRow = Math.abs(row[0].y - row[1].y) <= 0.5;
          if (sameRow) expect(Math.abs(row[0].height - row[1].height), `${when} ${kind}: one height on one row`).toBeLessThanOrEqual(0.5);
          else {
            expect(row[1].y, `${when} ${kind}: the second is below, not overlapping`).toBeGreaterThanOrEqual(row[0].y + row[0].height);
            expect(Math.abs(row[0].width - row[1].width), `${when} ${kind}: both fill the row`).toBeLessThanOrEqual(0.5);
          }
        }
        expect(await sidewaysScroll(page), when).toBe(0);
      };

      const longDetail = banner(page, `long-${lang}`, "error").locator("p").nth(1);
      expect(await lineCount(longDetail), "the long detail wraps").toBeGreaterThanOrEqual(3);
      if (lang !== "en") await expect(longDetail).toContainText(scriptPattern[lang]);
      const before = (await box(banner(page, `long-${lang}`, "error"))).height;
      expect(before, "a banner with long text is taller").toBeGreaterThan((await box(banner(page, `error-${lang}`))).height + 20);
      await check("default size");

      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "130%"));
      await expect.poll(async () => parseFloat((await css(longDetail, ["font-size"]))["font-size"])).toBeGreaterThan(19);
      expect((await box(banner(page, `long-${lang}`, "error"))).height, "taller again at 130%").toBeGreaterThan(before + 20);
      await check("130%");
    });
  }

  test("93: Tab reaches both undo actions and rings them in yellow on the dark ground; in the error banner the ring is blue; a tap rings nothing", async ({ page }) => {
    const [first, second] = await actions(banner(page, "undo-en")).all();
    await tabTo(page, first);
    const yellow = { "outline-style": "solid", "outline-width": "3px", "outline-offset": "4px", "outline-color": rgb("highlight") };
    expect(await css(first, ring)).toEqual(yellow);
    await page.keyboard.press("Tab");
    await expect(second).toBeFocused();
    expect(await css(second, ring)).toEqual(yellow);

    const main = actions(banner(page, "error-en")).first();
    await tabTo(page, main);
    expect(await css(main, ring)).toEqual({ ...yellow, "outline-color": rgb("blue") });
    await page.keyboard.press("Tab");
    await expect(actions(banner(page, "error-en")).nth(1)).toBeFocused();

    // The frozen examples: yellow in the undo banner, blue in the error banner.
    const forced = page.getByTestId("banner-focus");
    for (const control of await forced.locator('[data-kind="undo"] [data-force="focus"]').all()) expect(await css(control, ring)).toEqual(yellow);
    expect(await css(forced.locator('[data-kind="error"] [data-force="focus"]'), ring)).toEqual({ ...yellow, "outline-color": rgb("blue") });

    await page.getByTestId("banner-live").getByRole("button", { name: "Undo" }).tap();
    expect((await css(page.getByTestId("banner-live").getByRole("button", { name: "Undo" }), ["outline-style"]))["outline-style"]).toBe("none");
  });

  test("93: no banner has a timer: after a wait every one of them is still on the page, unchanged", async ({ page }) => {
    const count = await section(page, "banner").locator("[data-kind]").count();
    expect(count).toBeGreaterThan(20);
    const before = await section(page, "banner").locator("[data-kind]").evaluateAll((els) => els.map((el) => el.outerHTML).join("|"));
    await page.waitForTimeout(6000);
    await expect(section(page, "banner").locator("[data-kind]")).toHaveCount(count);
    expect(await section(page, "banner").locator("[data-kind]").evaluateAll((els) => els.map((el) => el.outerHTML).join("|"))).toBe(before);
    // The page's working examples set no timer of their own until something is tapped.
    expect(await page.evaluate(() => document.getAnimations().filter((a) => (a.effect instanceof KeyframeEffect ? a.effect.target?.closest("[data-kind]") : null)).length)).toBe(0);
  });

  test("FlatButton: pressed, it moves 2px right and down in 80ms with no shadow before or after", async ({ page }) => {
    const button = page.getByTestId("banner-live").getByRole("button", { name: "Try again" });
    await button.scrollIntoViewIfNeeded();
    expect(await css(button, ["transition-duration", "transition-timing-function"])).toEqual({ "transition-duration": "0.08s", "transition-timing-function": "linear" });
    expect((await css(button, ["translate"])).translate).toBe("none");
    const rest = await box(button);
    await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height / 2);
    await page.mouse.down();
    await expect.poll(async () => (await box(button)).x - rest.x).toBe(2);
    expect((await css(button, ["translate"])).translate).toBe("2px 2px");
    expect((await box(button)).y - rest.y).toBe(2);
    expect(await shadow(button)).toBe("none");
    await page.mouse.up();
    await expect.poll(async () => (await box(button)).x - rest.x).toBe(0);

    // The frozen examples show all four looks pressed.
    const pressed = page.getByTestId("banner-pressed").locator('[data-force="pressed"]');
    await expect(pressed).toHaveCount(4);
    for (const control of await pressed.all()) {
      expect((await css(control, ["translate"])).translate).toBe("2px 2px");
      expect(await shadow(control)).toBe("none");
    }
  });

  // The amount in an undo message (criterion 14 inside a banner): the same checks as the amounts
  // section in fonts.spec.ts, by computed style and by which font file drew the glyphs.
  const AMOUNT = /^₹[0-9,]+$/;
  const amountIn = (b: Locator) => b.locator('[data-rupee="reading"]');
  /** The amount is one unbroken piece of text, wholly inside its message, its banner and the screen. */
  const amountIsWhole = async (b: Locator, when: string) => {
    const m = await amountIn(b).evaluate((el) => {
      const rects = [...el.getClientRects()].filter((r) => r.width > 0);
      const r = el.getBoundingClientRect();
      const p = el.closest("p")!.getBoundingClientRect();
      const outer = el.closest("[data-kind]")!.getBoundingClientRect();
      const s = getComputedStyle(el);
      const clipping: string[] = [];
      for (let up = el.parentElement; up && up !== document.body; up = up.parentElement) {
        const o = getComputedStyle(up);
        if (o.overflowX !== "visible" || o.overflowY !== "visible") {
          const c = up.getBoundingClientRect();
          if (r.left < c.left - 0.5 || r.right > c.right + 0.5 || r.top < c.top - 0.5 || r.bottom > c.bottom + 0.5) clipping.push(up.tagName);
        }
      }
      return {
        lines: rects.length,
        width: r.width,
        insideMessage: r.left >= p.left - 0.5 && r.right <= p.right + 0.5,
        insideBanner: r.left >= outer.left && r.right <= outer.right && r.top >= outer.top && r.bottom <= outer.bottom,
        onScreen: r.left >= 0 && r.right <= document.documentElement.clientWidth,
        wrap: s.whiteSpace,
        overflow: s.textOverflow,
        clipping,
      };
    });
    expect(m, when).toEqual({ lines: 1, width: m.width, insideMessage: true, insideBanner: true, onScreen: true, wrap: "nowrap", overflow: "clip", clipping: [] });
    expect(m.width, when).toBeGreaterThan(30);
  };

  test("every undo banner on the page shows its amount in the amount role: one in each, none plain", async ({ page }) => {
    const undo = section(page, "banner").locator('[data-kind="undo"]');
    // en, hi, kn and te each have the plain and the long example; English has the pressed, focus and working ones too.
    await expect(undo).toHaveCount(11);
    for (const b of await undo.all()) {
      await expect(amountIn(b)).toHaveCount(1);
      await expect(amountIn(b)).toHaveText(AMOUNT);
      // No rupee sign or digit is left in the message's own text, outside the amount.
      const own = await b.locator("p").evaluate((el) => [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(""));
      expect(own).not.toMatch(/[₹0-9०-९೦-೯౦-౯]/);
    }
    await expect(section(page, "banner").locator('[data-rupee="reading"]')).toHaveCount(11);
  });

  for (const lang of langs) {
    test(`14 in a banner: ${lang}: the amount in the undo message is Bricolage at -0.04em with digits 0-9${lang === "en" ? "" : ", beside words in Anek"}; it is whole, also in the long example and at 130%`, async ({ page }) => {
      const bricolage = await familyOf(page, "--font-bricolage");
      expect(bricolage).toMatch(/^Bricolage Grotesque/);
      const probe = await fontProbe(page);
      const ids = lang === "en" ? ["undo-en", "long-en", "pressed", "focus", "live"] : [`undo-${lang}`, `long-${lang}`];

      const check = async (when: string) => {
        for (const id of ids) {
          const b = banner(page, id, "undo");
          await expect(b, id).toHaveCount(1);
          const amount = amountIn(b);
          await expect(amount, id).toHaveCount(1);
          await expect(amount, id).toBeVisible();
          const text = (await amount.textContent()) ?? "";
          expect(text, id).toMatch(AMOUNT);
          expect(await amount.evaluate((el) => el.closest("[lang]")?.getAttribute("lang")), id).toBe(lang);

          // Computed style: the amount role, whatever the script around it.
          const family = await firstFamily(amount);
          expect(family, `${when} ${id}`).toBe(bricolage);
          expect(family, `${when} ${id}`).not.toMatch(/^Anek /);
          const s = await amount.evaluate((el) => {
            const c = getComputedStyle(el);
            return { weight: c.fontWeight, spacing: c.letterSpacing, tracking: parseFloat(c.letterSpacing) / parseFloat(c.fontSize), size: parseFloat(c.fontSize), transform: c.textTransform };
          });
          expect(s.spacing, `${when} ${id}: letter-spacing is not zero`).not.toBe("normal");
          expect(s.spacing, `${when} ${id}: letter-spacing is not zero`).not.toBe("0px");
          expect(s.tracking, `${when} ${id}`).toBeCloseTo(-0.04, 3);
          expect(s.weight, `${when} ${id}`).toBe("800");
          expect(s.transform, `${when} ${id}`).toBe("none");
          // It is the size of the words it sits in, never smaller.
          const messageSize = parseFloat((await css(b.locator("p"), ["font-size"]))["font-size"]);
          expect(s.size, `${when} ${id}`).toBe(messageSize);
          expect(s.size, `${when} ${id}`).toBeGreaterThanOrEqual(14);

          // What was drawn: Bricolage Grotesque drew the sign and every digit, and nothing else did.
          const faces = await probe.facesFor(amount);
          expect(faces.map((f) => f.family.replace(/ \d+pt.*$/, "")), `${when} ${id}`).toEqual(["Bricolage Grotesque"]);
          expect(faces[0].glyphs, `${when} ${id}`).toBe(text.length);
          expect(faces[0].custom, `${when} ${id}`).toBe(true);

          // The other side: the words around the amount are still set in the script's own face.
          // The probe counts a node's whole subtree, so the message reports its words and its amount.
          const message = b.locator("p");
          const whole = Object.entries(
            (await probe.facesFor(message)).reduce<Record<string, number>>((sum, f) => {
              expect(f.custom, `${when} ${id}: ${f.family} is one of our own font files`).toBe(true);
              const name = f.family.replace(/ (Thin|ExtraLight|Light|Regular|Medium|SemiBold|Bold|ExtraBold|\d+pt.*)$/, "");
              sum[name] = (sum[name] ?? 0) + f.glyphs;
              return sum;
            }, {}),
          );
          if (lang === "en") {
            expect(await firstFamily(message), `${when} ${id}`).toBe(bricolage);
            expect(whole.map(([name]) => name), `${when} ${id}`).toEqual(["Bricolage Grotesque"]);
            expect(whole[0][1], `${when} ${id}: there are words beside the amount`).toBeGreaterThan(text.length + 5);
          } else {
            const anek = await familyOf(page, scriptFontVariable[lang]);
            expect(anek).toMatch(/^Anek /);
            expect(await firstFamily(message), `${when} ${id}`).toBe(anek);
            expect((await css(message, ["letter-spacing"]))["letter-spacing"], `${when} ${id}`).toBe("normal");
            await expect(message).toContainText(scriptPattern[lang]);
            // Two faces and no third: Anek drew the words, and Bricolage drew the amount's glyphs and not one more.
            const drawn = Object.fromEntries(whole);
            expect(Object.keys(drawn).sort(), `${when} ${id}`).toEqual([anek, "Bricolage Grotesque"].sort());
            expect(drawn["Bricolage Grotesque"], `${when} ${id}: Bricolage drew only the amount`).toBe(text.length);
            expect(drawn[anek], `${when} ${id}: Anek drew the words`).toBeGreaterThan(5);
          }

          await amountIsWhole(b, `${when} ${id}`);
          expect(await holdsItsContent(message), `${when} ${id}: the message is whole`).toBe(true);
        }
        expect(await sidewaysScroll(page), when).toBe(0);
      };

      await check("default size");
      // The amount takes the size of its message (16px in English, the script's own reading size otherwise),
      // and its letter-spacing is 4% of that, in pixels: it grows with the text.
      const first = amountIn(banner(page, ids[0], "undo"));
      const before = await css(first, ["font-size", "letter-spacing"]);
      const px = parseFloat(before["font-size"]);
      if (lang === "en") expect(before).toEqual({ "font-size": "16px", "letter-spacing": "-0.64px" });
      expect(px).toBeGreaterThanOrEqual(16);
      expect(parseFloat(before["letter-spacing"])).toBeCloseTo(px * -0.04, 2);

      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "130%"));
      await expect.poll(async () => parseFloat((await css(first, ["font-size"]))["font-size"])).toBeCloseTo(px * 1.3, 1);
      expect(parseFloat((await css(first, ["letter-spacing"]))["letter-spacing"])).toBeCloseTo(px * 1.3 * -0.04, 2);
      await check("130%");
    });
  }

  for (const lang of indicLangs) {
    test(`${lang}: banner text and action labels are the script's own face with no letter-spacing and no capitals, 14px or larger`, async ({ page }) => {
      const texts = [
        banner(page, `offline-${lang}`).locator("p").first(),
        banner(page, `offline-${lang}`).locator("p").nth(1),
        banner(page, `error-${lang}`).locator("p").first(),
        banner(page, `error-${lang}`).locator("p").nth(1),
        actions(banner(page, `error-${lang}`)).first(),
        banner(page, `undo-${lang}`).locator("p"),
      ];
      for (const text of texts) {
        const style = await css(text, ["font-size", "letter-spacing", "text-transform"]);
        expect(parseFloat(style["font-size"])).toBeGreaterThanOrEqual(14);
        expect({ "letter-spacing": style["letter-spacing"], "text-transform": style["text-transform"] }).toEqual({ "letter-spacing": "normal", "text-transform": "none" });
        await expect(text).toContainText(scriptPattern[lang]);
      }
    });
  }
});

// The whole page, now with thirteen components. The whole-page tests in dev-components.spec.ts walk
// `body` and `main`, so they already cover these sections; the tests here prove that the five new
// sections are really in what gets walked (each has things to find) and hold them to the same rules
// one section at a time, so a failure names the component.
test.describe("whole page with thirteen components: criteria 58, 59, 61, 62, 63, 64 and 4, 8, 69 as rendered", () => {
  const F2A = ["button", "field", "slip", "row", "status-tag", "stamp", "tabs", "sheet"];
  const F2B = ["segmented", "switch", "summary-bar", "bottom-nav", "banner"];
  const sel = (id: string) => `[data-testid="section-${id}"]`;
  const TARGETS = 'a[href], button, input, select, textarea, [role="tab"], [role="link"], [role="button"], [role="switch"], [tabindex]:not([tabindex="-1"])';

  /** Interactive elements under `scope` smaller than 44 by 44, and how many were measured. */
  const smallTargets = (page: Page, scope: string) =>
    page.evaluate(
      ([root, selector]) => {
        const small: string[] = [];
        let found = 0;
        for (const el of document.querySelector(root)!.querySelectorAll(selector)) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          found++;
          if (r.width < 43.99 || r.height < 43.99) small.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}" is ${r.width.toFixed(1)} by ${r.height.toFixed(1)}`);
        }
        return { found, small };
      },
      [scope, TARGETS] as const,
    );

  /** Text under `scope` below 14px, and how many pieces of text were measured. */
  const smallText = (page: Page, scope: string) =>
    page.evaluate((root) => {
      const small: string[] = [];
      let seen = 0;
      const walker = document.createTreeWalker(document.querySelector(root)!, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!el || (node.textContent ?? "").trim() === "") continue;
        seen++;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 14) small.push(`${size}px: ${(node.textContent ?? "").trim().slice(0, 40)}`);
      }
      return { seen, small };
    }, scope);

  /** Text colour against the ground it sits on, for every piece of visible text under `scope`: the pairs under 4.5:1. */
  const lowContrast = (page: Page, scope: string) =>
    page.evaluate((root) => {
      const lum = (colour: string) => {
        const m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(colour);
        if (!m) throw new Error(`Not an opaque colour: ${colour}`);
        const [r, g, b] = [m[1], m[2], m[3]].map((v) => {
          const c = Number(v) / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const pairs = new Map<string, string>();
      const walker = document.createTreeWalker(document.querySelector(root)!, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!el || (node.textContent ?? "").trim() === "" || el.getClientRects().length === 0) continue;
        if (getComputedStyle(el).visibility === "hidden") continue;
        let ground = "";
        for (let up: Element | null = el; up; up = up.parentElement) {
          const bg = getComputedStyle(up).backgroundColor;
          if (/^rgb\(/.test(bg)) {
            ground = bg;
            break;
          }
        }
        const key = `${getComputedStyle(el).color} on ${ground}`;
        if (!pairs.has(key)) pairs.set(key, (node.textContent ?? "").trim().slice(0, 30));
      }
      const failing: string[] = [];
      for (const [pair, sample] of pairs) {
        const [fg, bg] = pair.split(" on ");
        const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05);
        if (ratio < 4.5) failing.push(`${pair} is ${ratio.toFixed(2)}:1 ("${sample}")`);
      }
      return { pairs: pairs.size, failing };
    }, scope);

  test("58: the page has a section for each of the thirteen components, in the plan's order, the five new ones after Sheet", async ({ page }) => {
    for (const id of [...F2A, ...F2B]) {
      const s = section(page, id);
      await expect(s, id).toBeVisible();
      await expect(s.getByRole("heading", { level: 2 }).first(), id).toBeVisible();
      await expect(s, id).toHaveAccessibleName(/\S/);
    }
    const order = await page.locator('[data-testid^="section-"]').evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")!.replace("section-", "")));
    expect(order).toEqual(["tokens", "type", "rupee", "button", "field", "slip", "row", "status-tag", "stamp", "tabs", "sheet", "segmented", "switch", "summary-bar", "bottom-nav", "banner", "select-field", "formats"]);
  });

  test("58: every variant and state of the five new components is on the page without anyone touching it", async ({ page }) => {
    // Segmented: two, three and four choices, two-line segments, long text, and both frozen focus rings.
    for (const id of ["two-en", "two-line-en", "three-en", "four-en", "long-en", "focus-chosen", "focus-other", "live"]) await expect(page.getByTestId(`segmented-${id}`), `segmented ${id}`).toBeVisible();
    await expect(page.getByTestId("segmented-two-en").getByRole("radio")).toHaveCount(2);
    await expect(page.getByTestId("segmented-three-en").getByRole("radio")).toHaveCount(3);
    await expect(page.getByTestId("segmented-four-en").getByRole("radio")).toHaveCount(4);
    await expect(section(page, "segmented").locator('input[data-force="focus"]')).toHaveCount(2);

    // Switch: on, off, long words, named by visible text, frozen focus.
    for (const id of ["en-on", "en-off", "en-long-on", "en-long-off", "en-labelled", "focus-on", "focus-off"]) await expect(page.getByTestId(`switch-${id}`), `switch ${id}`).toBeVisible();
    await expect(page.getByTestId("switch-en-on")).toHaveAttribute("aria-checked", "true");
    await expect(page.getByTestId("switch-en-off")).toHaveAttribute("aria-checked", "false");

    // SummaryBar (replaced StudentStrip): typical, long labels, one zero, all zero, pending, tiny, on a slip.
    for (const id of ["typical-en", "long-en", "one-zero", "all-zero", "pending", "tiny", "on-slip"]) await expect(page.getByTestId(`summary-${id}`).getByRole("list"), `summary ${id}`).toBeVisible();
    for (const part of ["collected", "due", "overdue"]) await expect(page.getByTestId("summary-typical-en").locator(`[data-part="${part}"]`)).toBeVisible();

    // BottomNav: all four positions of the current item, long labels, frozen focus.
    for (const id of ["en", "hi", "kn", "te", "long-en", "focus"]) await expect(page.getByTestId(`nav-${id}`).getByRole("navigation"), `nav ${id}`).toBeVisible();
    const currents = await section(page, "bottom-nav").locator('[aria-current="page"]').evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute("data-item")))].sort());
    expect(currents).toEqual(["attendance", "home", "more", "students"]);

    // Banner: the three kinds; error with two, one and no actions; undo with a link and icon; pressed and focus frozen; working.
    for (const id of ["offline-en", "error-en", "undo-en", "long-en", "error-one", "error-none", "pressed", "focus", "live"]) await expect(page.getByTestId(`banner-${id}`).locator("[data-kind]").first(), `banner ${id}`).toBeVisible();
    await expect(section(page, "banner").locator('[data-force="pressed"]')).toHaveCount(4);
    await expect(section(page, "banner").locator('[data-force="focus"]')).toHaveCount(3);
    await expect(page.getByTestId("banner-undo-en").locator("a[href] svg")).toHaveCount(1);
  });

  test("59: each of the five new sections repeats in English, Hindi, Kannada and Telugu, each block marked with its lang and holding its script", async ({ page }) => {
    for (const id of F2B) {
      await expect(section(page, id).getByTestId("lang-en"), id).toHaveAttribute("lang", "en");
      for (const lang of indicLangs) {
        const block = section(page, id).getByTestId(`lang-${lang}`);
        await expect(block, `${id} ${lang}`).toHaveCount(1);
        await expect(block, `${id} ${lang}`).toHaveAttribute("lang", lang);
        await expect(block, `${id} ${lang} holds text in its script`).toContainText(scriptPattern[lang]);
      }
    }
  });

  for (const lang of langs) {
    test(`59: ${lang} has one deliberately long label in each of the five, and each takes more than one line`, async ({ page }) => {
      expect(await lineCount(page.getByTestId(`segmented-long-${lang}`).locator("legend")), "segmented label").toBeGreaterThanOrEqual(2);
      expect(await lineCount(page.getByTestId(`segmented-long-${lang}`).locator("label span").first()), "segment").toBeGreaterThanOrEqual(2);
      const list = page.getByTestId(`summary-long-${lang}`).getByRole("list");
      expect((await box(list)).height, "summary labels").toBeGreaterThan(parseFloat((await css(list, ["line-height"]))["line-height"]) * 1.8);
      expect(await lineCount(page.getByTestId(`nav-long-${lang}`).getByRole("link").nth(2).locator("> span").nth(1)), "nav label").toBeGreaterThanOrEqual(2);
      expect(await lineCount(page.getByTestId(`banner-long-${lang}`).locator('[data-kind="error"] p').nth(1)), "banner detail").toBeGreaterThanOrEqual(3);
      // A switch's long word does not wrap: the switch is wider instead.
      expect((await box(page.getByTestId(`switch-${lang}-long-on`))).width, "switch").toBeGreaterThan((await box(page.getByTestId(`switch-${lang}-on`))).width + 10);
    });
  }

  test("61: no sideways scroll at 360px with thirteen components, also while a flat button is held down", async ({ page }) => {
    expect(page.viewportSize()).toEqual({ width: 360, height: 740 });
    expect(await sidewaysScroll(page)).toBe(0);
    await page.evaluate(() => window.scrollTo(500, 0));
    expect(await page.evaluate(() => window.scrollX)).toBe(0);
    // Nothing in the five sections reaches past the screen.
    for (const id of F2B) {
      const past = await section(page, id).evaluate((el) => [...el.querySelectorAll("*")].filter((n) => n.getBoundingClientRect().right > 360.5 || n.getBoundingClientRect().left < -0.5).length);
      expect(past, id).toBe(0);
    }
    const button = page.getByTestId("banner-live").getByRole("button", { name: "Later" });
    await button.scrollIntoViewIfNeeded();
    const b = await box(button);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect.poll(async () => (await css(button, ["translate"])).translate).toBe("2px 2px");
    expect(await sidewaysScroll(page)).toBe(0);
    await page.mouse.up();
  });

  test("62: every interactive element in each of the five sections is at least 44 by 44, and the page as a whole has none smaller", async ({ page }) => {
    // What each section has to be measured: radios, switches, nothing (the summary bar is a picture with labels), links, buttons.
    const expected: Record<string, number> = { segmented: 60, switch: 20, "summary-bar": 0, "bottom-nav": 36, banner: 40 };
    for (const id of F2B) {
      const result = await smallTargets(page, sel(id));
      if (expected[id] === 0) expect(result.found, `${id}: a picture has no targets`).toBe(0);
      else expect(result.found, `${id}: targets found`).toBeGreaterThanOrEqual(expected[id]);
      expect(result.small, id).toEqual([]);
    }
    const whole = await smallTargets(page, "body");
    // 280 on this build. The floor only proves the walk is not empty-handed; it is not a count to keep.
    expect(whole.found).toBeGreaterThan(250);
    expect(whole.small).toEqual([]);
  });

  test("4: no text in any of the five sections is below 14px", async ({ page }) => {
    for (const id of F2B) {
      const result = await smallText(page, sel(id));
      expect(result.seen, `${id}: text found`).toBeGreaterThan(20);
      expect(result.small, id).toEqual([]);
    }
  });

  test("8, as rendered: every piece of text in the five sections reaches 4.5:1 against its ground", async ({ page }) => {
    const seen: Record<string, number> = {};
    for (const id of F2B) {
      const result = await lowContrast(page, sel(id));
      seen[id] = result.pairs;
      expect(result.failing, id).toEqual([]);
    }
    // Each section really has its own pairs: slip on ink in a segment, the knob word, the three
    // legend colours, the two nav label colours, and the banners' five.
    expect(seen.segmented).toBeGreaterThanOrEqual(4);
    expect(seen.switch).toBeGreaterThanOrEqual(3);
    expect(seen["summary-bar"]).toBeGreaterThanOrEqual(3);
    expect(seen["bottom-nav"]).toBeGreaterThanOrEqual(4);
    expect(seen.banner).toBeGreaterThanOrEqual(7);
  });

  test("nothing in the five sections is truncated, clipped or overlapping at the default text size", async ({ page }) => {
    for (const id of F2B) expect(await textProblems(page, sel(id)), id).toEqual([]);
  });

  test("63: at root 130% nothing in the five sections is clipped, overlapped or truncated, targets stay 44px, and there is no sideways scroll", async ({ page }, testInfo) => {
    const before = {
      segment: (await box(page.getByTestId("segmented-two-en").locator("label").first())).height,
      switch: (await box(page.getByTestId("switch-en-on"))).width,
      bar: (await box(page.getByTestId("summary-typical-en").locator('[data-part="overdue"]'))).height,
      nav: (await box(page.getByTestId("nav-en").getByRole("navigation"))).height,
      banner: (await box(page.getByTestId("banner-error-en").locator("[data-kind]"))).height,
    };
    const probe = page.getByTestId("banner-offline-en").locator("[data-kind] p").first();
    expect((await css(probe, ["font-size"]))["font-size"]).toBe("16px");
    await page.evaluate(() => document.documentElement.style.setProperty("font-size", "130%"));
    await expect.poll(async () => (await css(probe, ["font-size"]))["font-size"]).toBe("20.8px");

    expect(await sidewaysScroll(page)).toBe(0);
    for (const id of F2B) {
      expect(await textProblems(page, sel(id)), id).toEqual([]);
      expect((await smallTargets(page, sel(id))).small, id).toEqual([]);
      expect((await smallText(page, sel(id))).small, id).toEqual([]);
    }

    // Everything is sized in rem, so each grows with the text and is not clipped at its old size.
    expect((await box(page.getByTestId("segmented-two-en").locator("label").first())).height).toBeGreaterThan(before.segment + 8);
    expect((await box(page.getByTestId("switch-en-on"))).width).toBeGreaterThan(before.switch + 8);
    expect((await box(page.getByTestId("summary-typical-en").locator('[data-part="overdue"]'))).height).toBeCloseTo(before.bar * 1.3, 0);
    expect((await box(page.getByTestId("nav-en").getByRole("navigation"))).height).toBeGreaterThan(before.nav + 8);
    expect((await box(page.getByTestId("banner-error-en").locator("[data-kind]"))).height).toBeGreaterThan(before.banner + 8);

    // The summary bar still fits: no part past the screen, a tiny part still 4px or more.
    for (const id of ["typical-en", "tiny"]) {
      const parts = await boxes(page.getByTestId(`summary-${id}`).locator("[data-part]"));
      for (const b of parts) {
        expect(b.x + b.width, id).toBeLessThanOrEqual(360);
        expect(b.width, id).toBeGreaterThanOrEqual(4);
      }
    }
    await page.getByTestId("banner-long-te").scrollIntoViewIfNeeded();
    await attachScreenshot(testInfo, "130-percent-telugu-banner.png", await page.screenshot());
  });

  test("64: with reduce motion on, nothing in the five sections animates or eases, and a flat button's press is instant [own page]", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openDevPage(page);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
    for (const id of F2B) {
      const moving = await section(page, id).evaluate((el) => {
        const out: string[] = [];
        for (const node of [el, ...el.querySelectorAll("*")]) {
          const s = getComputedStyle(node);
          if (s.animationName !== "none") out.push(`animation ${s.animationName} on ${node.tagName}`);
          if (s.transitionDuration.split(",").some((d) => parseFloat(d) > 0)) out.push(`transition ${s.transitionDuration} on ${node.tagName}`);
        }
        return out;
      });
      expect(moving, id).toEqual([]);
    }
    const button = page.getByTestId("banner-live").getByRole("button", { name: "Try again" });
    await button.scrollIntoViewIfNeeded();
    const rest = await box(button);
    await page.mouse.move(rest.x + rest.width / 2, rest.y + rest.height / 2);
    await page.mouse.down();
    // No polling: the move is finished the moment the press lands.
    expect((await css(button, ["translate"])).translate).toBe("2px 2px");
    expect((await box(button)).x - rest.x).toBe(2);
    await page.mouse.up();

    // State changes still happen, at once: a switch flips and a segment is chosen.
    await page.getByTestId("switch-en-off").tap();
    await expect(page.getByTestId("switch-en-off")).toHaveAttribute("aria-checked", "true");
    await page.getByTestId("segmented-two-en").getByRole("radio").nth(1).tap();
    await expect(page.getByTestId("segmented-two-en").getByRole("radio").nth(1)).toBeChecked();
    expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  });

  test("69, as rendered: the only motion in the five sections is the 80ms press of a banner's buttons", async ({ page }) => {
    const found: Record<string, string[]> = {};
    for (const id of F2B) {
      found[id] = await section(page, id).evaluate((el) => {
        const out = new Set<string>();
        for (const node of [el, ...el.querySelectorAll("*")]) {
          const s = getComputedStyle(node);
          if (s.animationName !== "none") out.add(`animation ${s.animationName}`);
          if (s.transitionDuration.split(",").some((d) => parseFloat(d) > 0)) {
            out.add(`${node.matches("[data-kind] button, [data-kind] a") ? "banner action" : node.tagName.toLowerCase()}|${s.transitionProperty}|${s.transitionDuration}|${s.transitionTimingFunction}`);
          }
        }
        return [...out];
      });
    }
    expect(found).toEqual({
      segmented: [],
      switch: [],
      "summary-bar": [],
      "bottom-nav": [],
      banner: ["banner action|transform, translate, scale, rotate|0.08s|linear"],
    });
  });

  test("the dev page with thirteen components loads with no console error and no failed request [own page]", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("requestfailed", (request) => errors.push(`failed: ${request.url()}`));
    await openDevPage(page);
    await page.getByTestId("section-banner").scrollIntoViewIfNeeded();
    await page.getByTestId("switch-en-off").tap();
    await page.getByTestId("banner-live").getByRole("button", { name: "Undo" }).tap();
    expect(errors).toEqual([]);
  });
});
