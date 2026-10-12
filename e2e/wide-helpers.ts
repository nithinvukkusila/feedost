// Helpers for the wide-screen specs (spec D1). They run inside the existing `phone` project: the window
// is resized with setViewportSize, so the phone project is untouched. Touch emulation stays on, which is
// harmless for layout (the 44px rule is the same). Test code only.
import { expect, type Locator, type Page } from "@playwright/test";
import { langs, type Lang } from "./helpers";

/** The widths the layout is judged at: the phone, the two breakpoints (768 and 1024 in rem) and the usual windows. */
export const SWEEP = [320, 360, 768, 1024, 1280, 1440, 1920] as const;
/** One pixel either side of each breakpoint. */
export const EDGES = [767, 768, 1023, 1024] as const;

export async function setWidth(page: Page, width: number, height = 900): Promise<void> {
  await page.setViewportSize({ width, height });
}

/** Sets the browser's root font size, which moves every rem and so the rem breakpoints, as the browser setting does. */
export async function rootFont(page: Page, percent: number): Promise<void> {
  await page.evaluate((value) => document.documentElement.style.setProperty("font-size", `${value}%`), percent);
}

export const mainNav = (page: Page): Locator => page.getByRole("navigation", { name: "Main" });
export const book = (page: Page): Locator => page.locator("[data-book]");

export type Sideways = { doc: number; book: number; inner: number };

/** How far the page and the book are wider than the window (0 is none), and the window width the browser really uses. */
export function sideways(page: Page): Promise<Sideways> {
  return page.evaluate(() => {
    const root = document.documentElement;
    const b = document.querySelector("[data-book]");
    return { doc: root.scrollWidth - root.clientWidth, book: b ? b.scrollWidth - b.clientWidth : 0, inner: window.innerWidth };
  });
}

/** No sideways scroll on the page or the book at this width (the window really is that wide: a phone browser would zoom out instead). */
export async function expectNoSideways(page: Page, width: number, where: string): Promise<void> {
  const s = await sideways(page);
  expect(s.inner, `${where}: the window is ${width} wide`).toBe(width);
  expect(s.doc, `${where}: sideways scroll on the page at ${width}`).toBe(0);
  expect(s.book, `${where}: sideways scroll in the book at ${width}`).toBe(0);
}

/**
 * No sideways scroll at every width in SWEEP, in each of the four languages, at the browser's text size of 100% and 200%.
 * The widths are looped inside one page load, so a screen costs four loads, not twenty-eight tests. `before` runs
 * before each language's page load (a signed-in screen needs the tutor's language set first).
 */
export async function sweep(
  page: Page,
  path: (lang: Lang) => string,
  ready: (page: Page) => Promise<unknown>,
  where: string,
  before?: (lang: Lang) => Promise<unknown>,
  /** Widths to leave out at 200% text. Only for a known fault that is older than D1 (see the PR). */
  skipLarge: readonly number[] = [],
): Promise<void> {
  for (const lang of langs) {
    if (before) await before(lang);
    await setWidth(page, 360, 900);
    await page.goto(path(lang));
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
    for (const percent of [100, 200]) {
      await rootFont(page, percent);
      for (const width of SWEEP) {
        if (percent === 200 && skipLarge.includes(width)) continue;
        await setWidth(page, width, 900);
        await expectNoSideways(page, width, `${where} ${lang} at ${percent}%`);
      }
    }
    await rootFont(page, 100);
  }
}
