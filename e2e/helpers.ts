// Shared helpers for the F2 Playwright specs. Test code only.
import { expect, type CDPSession, type Locator, type Page, type TestInfo } from "@playwright/test";
import { group, readTokens } from "../src/styles/read-tokens";

export const DEV = "/dev/components/";

export const langs = ["en", "hi", "kn", "te"] as const;
export const indicLangs = ["hi", "kn", "te"] as const;
export type Lang = (typeof langs)[number];
export type IndicLang = (typeof indicLangs)[number];

/** A character class for each Indian script, to prove a block really holds text in that script. */
export const scriptPattern: Record<IndicLang, RegExp> = {
  hi: /\p{Script=Devanagari}/u,
  kn: /\p{Script=Kannada}/u,
  te: /\p{Script=Telugu}/u,
};

/** The CSS variable next/font defines for each script's face (src/styles/fonts.ts). */
export const scriptFontVariable: Record<IndicLang, string> = {
  hi: "--font-anek-devanagari",
  kn: "--font-anek-kannada",
  te: "--font-anek-telugu",
};

// Colour tokens, read from the same file the build reads. No second copy of the hex values.
const hexByName = group(readTokens(), "--color-");

/** The hex value of a colour token, exactly as written in tokens.css. */
export function hex(name: string): string {
  const value = hexByName[name];
  if (!value) throw new Error(`No colour token named ${name}`);
  return value;
}

/** A colour token the way getComputedStyle reports it: "rgb(r, g, b)". */
export function rgb(name: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex(name));
  if (!m) throw new Error(`Token ${name} is not a six-digit hex colour`);
  return `rgb(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)})`;
}

export function rgbTuple(name: string): [number, number, number] {
  const m = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(rgb(name));
  if (!m) throw new Error(`Token ${name} did not convert`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export const colourNames = Object.keys(hexByName);

/** Opens the dev page and waits until every font the page needs has arrived, so sizes are final. */
export async function openDevPage(page: Page): Promise<void> {
  await page.goto(DEV);
  await fontsSettled(page);
}

export async function fontsSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // A font can start loading after `ready` resolves when a late layout first draws its characters.
  await expect
    .poll(() => page.evaluate(() => [...document.fonts].filter((f) => f.status === "loading").length))
    .toBe(0);
}

/** Computed style values of the first element a locator matches. */
export async function css<K extends string>(locator: Locator, props: readonly K[]): Promise<Record<K, string>> {
  return locator.first().evaluate((el, names) => {
    const style = getComputedStyle(el);
    const out: Record<string, string> = {};
    for (const name of names) out[name] = style.getPropertyValue(name);
    return out;
  }, props as readonly string[]) as Promise<Record<K, string>>;
}

export async function box(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await locator.first().boundingBox();
  if (!b) throw new Error("Element has no box");
  return b;
}

/** The same box in document coordinates, so it does not change when the page scrolls. */
export async function docBox(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  return locator.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + window.scrollX, y: r.top + window.scrollY, width: r.width, height: r.height };
  });
}

/**
 * The shadow that is actually drawn. Tailwind composes box-shadow from five layers and leaves the
 * unused ones as fully transparent zero-size shadows; those draw nothing and are dropped here.
 */
export async function shadow(locator: Locator): Promise<string> {
  const value = (await css(locator, ["box-shadow"]))["box-shadow"];
  if (value === "none") return "none";
  const drawn = value
    .split(/,(?![^(]*\))/)
    .map((layer) => layer.trim())
    .filter((layer) => layer !== "rgba(0, 0, 0, 0) 0px 0px 0px 0px");
  return drawn.length === 0 ? "none" : drawn.join(", ");
}

/** How far the document scrolls sideways. Zero means no sideways scroll. */
export function sidewaysScroll(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

export type PlatformFont = { family: string; glyphs: number; custom: boolean };

export type FontProbe = {
  /** The faces that actually drew the element's own text, with how many glyphs each drew. */
  facesFor(locator: Locator): Promise<PlatformFont[]>;
};

/** Chromium can say which font file drew a node. Face names look like "DM Mono Medium": match by prefix. */
export async function fontProbe(page: Page): Promise<FontProbe> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  return {
    async facesFor(locator) {
      const handle = await locator.first().elementHandle();
      if (!handle) throw new Error("No element for the font probe");
      // Mark the node, find it by the mark, and remove the mark again.
      await handle.evaluate((el) => el.setAttribute("data-font-probe", "1"));
      try {
        const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
        const { nodeId } = await cdp.send("DOM.querySelector", {
          nodeId: root.nodeId,
          selector: '[data-font-probe="1"]',
        });
        const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
        return fonts.map((f) => ({ family: f.familyName, glyphs: f.glyphCount, custom: f.isCustomFont }));
      } finally {
        await handle.evaluate((el) => el.removeAttribute("data-font-probe"));
      }
    },
  };
}

export type Pixels = { width: number; height: number; at(x: number, y: number): [number, number, number] };

/**
 * Takes a screenshot of a rectangle of the viewport and returns its pixels. The PNG is decoded in a
 * blank page of the same browser, so no image library is needed.
 */
export async function pixels(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
  options: { cdp?: CDPSession } = {},
): Promise<Pixels> {
  // page.screenshot() waits for web fonts. A test that holds the fonts back on purpose passes a CDP
  // session and captures the screen as it is.
  let png: Buffer;
  if (options.cdp) {
    // CDP clips in document coordinates; the caller gives viewport coordinates, like page.screenshot().
    const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const shot = await options.cdp.send("Page.captureScreenshot", {
      format: "png",
      clip: { x: clip.x + scroll.x, y: clip.y + scroll.y, width: clip.width, height: clip.height, scale: 1 },
    });
    png = Buffer.from(shot.data, "base64");
  } else {
    png = await page.screenshot({ clip, animations: "disabled", scale: "css" });
  }
  const decoder = await page.context().newPage();
  try {
    const data = await decoder.evaluate(async (base64) => {
      const image = new Image();
      image.src = `data:image/png;base64,${base64}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No 2d context");
      context.drawImage(image, 0, 0);
      const { data: rgba, width, height } = context.getImageData(0, 0, canvas.width, canvas.height);
      return { rgba: Array.from(rgba), width, height };
    }, png.toString("base64"));
    return {
      width: data.width,
      height: data.height,
      at(x, y) {
        const i = (Math.round(y) * data.width + Math.round(x)) * 4;
        return [data.rgba[i], data.rgba[i + 1], data.rgba[i + 2]];
      },
    };
  } finally {
    await decoder.close();
  }
}

/** True when two colours are the same to within anti-aliasing noise. */
export function near(a: readonly number[], b: readonly number[], tolerance = 12): boolean {
  return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance && Math.abs(a[2] - b[2]) <= tolerance;
}

export async function attachScreenshot(testInfo: TestInfo, name: string, body: Buffer): Promise<void> {
  await testInfo.attach(name, { body, contentType: "image/png" });
}

export type TextProblem = { what: string; text: string; where: string };

/**
 * Walks every element that holds text of its own and reports anything truncated, clipped, pushed
 * outside the screen, or lying on top of another piece of text. Used at the default text size and at 130%.
 * `scope` is a CSS selector for the root to walk.
 */
export function textProblems(page: Page, scope: string): Promise<TextProblem[]> {
  return page.evaluate((rootSelector) => {
    const root = document.querySelector(rootSelector);
    if (!root) throw new Error(`Nothing matches ${rootSelector}`);
    const problems: { what: string; text: string; where: string }[] = [];
    const viewport = document.documentElement.clientWidth;

    const describe = (el: Element) => {
      const parts: string[] = [];
      for (let node: Element | null = el; node && node !== document.body && parts.length < 6; node = node.parentElement) {
        const id = node.getAttribute("data-testid");
        const lang = node.getAttribute("lang");
        parts.unshift(node.tagName.toLowerCase() + (id ? `[${id}]` : "") + (lang ? `(${lang})` : ""));
      }
      return parts.join(" > ");
    };
    const words = (el: Element) => (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    const report = (what: string, el: Element) => problems.push({ what, text: words(el), where: describe(el) });

    const isSrOnly = (el: Element) => el.closest(".sr-only") !== null;
    const isTilted = (el: Element) => {
      for (let node: Element | null = el; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        if (style.rotate !== "none" || style.transform !== "none") return true;
      }
      return false;
    };

    // The box an element's text takes on each line. An inline element reports its font's full content
    // area, which is taller than its line when the line-height is tight; what it really occupies is
    // one line-height, centred on the same middle.
    const boxes = (el: Element, min: number) => {
      const style = getComputedStyle(el);
      const line = parseFloat(style.lineHeight);
      return [...el.getClientRects()]
        .filter((r) => r.width > min && r.height > min)
        .map((r) => {
          if (style.display !== "inline" || !(line > 0) || r.height <= line) return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
          const middle = (r.top + r.bottom) / 2;
          return { left: r.left, right: r.right, top: middle - line / 2, bottom: middle + line / 2 };
        });
    };

    // Elements with a text node of their own, or a form control that shows a value.
    const holders: Element[] = [];
    for (const el of root.querySelectorAll("*")) {
      if (el.closest("script, style, noscript, template")) continue;
      if (isSrOnly(el)) continue;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (el.getClientRects().length === 0) continue;
      const ownText = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
      if (ownText || el instanceof HTMLInputElement) holders.push(el);
    }

    for (const el of holders) {
      const style = getComputedStyle(el);

      // Truncated: an ellipsis, a line clamp, or text wider than the box that holds it.
      if (style.textOverflow !== "clip") report(`text-overflow is ${style.textOverflow}`, el);
      if (style.getPropertyValue("-webkit-line-clamp") !== "none") report("line clamp", el);
      if (el instanceof HTMLInputElement) {
        // A single-line input cannot wrap: a value wider than the input is cut off at its edge.
        if (el.scrollWidth > el.clientWidth + 1) {
          problems.push({ what: `value is ${el.scrollWidth}px wide in a ${el.clientWidth}px input`, text: el.value, where: describe(el) });
        }
      } else if (style.display !== "inline" && el.scrollWidth > el.clientWidth + 1) {
        report(`content is ${el.scrollWidth}px wide in a ${el.clientWidth}px box`, el);
      }

      const rects = boxes(el, 0);
      if (isTilted(el)) continue;

      // Pushed outside the screen.
      for (const r of rects) {
        if (r.left < -0.5 || r.right > viewport + 0.5) {
          report(`reaches from ${Math.round(r.left)}px to ${Math.round(r.right)}px on a ${viewport}px screen`, el);
          break;
        }
      }

      // Clipped: an ancestor that hides overflow and is smaller than this text.
      for (let node = el.parentElement; node && node !== document.documentElement; node = node.parentElement) {
        const s = getComputedStyle(node);
        const hidesX = s.overflowX === "hidden" || s.overflowX === "clip";
        const hidesY = s.overflowY === "hidden" || s.overflowY === "clip";
        if (!hidesX && !hidesY) continue;
        const outer = node.getBoundingClientRect();
        for (const r of rects) {
          if ((hidesX && (r.left < outer.left - 1 || r.right > outer.right + 1)) || (hidesY && (r.top < outer.top - 1 || r.bottom > outer.bottom + 1))) {
            report(`clipped by ${describe(node)}`, el);
            break;
          }
        }
      }
    }

    // Overlapping: boxes of two pieces of text, neither inside the other, that cover the same pixels.
    const flat = holders
      .filter((el) => !isTilted(el))
      .map((el) => ({ el, rects: boxes(el, 1) }));
    flat.sort((a, b) => (a.rects[0]?.top ?? 0) - (b.rects[0]?.top ?? 0));
    for (let i = 0; i < flat.length; i++) {
      const a = flat[i];
      const aBottom = Math.max(...a.rects.map((r) => r.bottom), -Infinity);
      for (let j = i + 1; j < flat.length; j++) {
        const b = flat[j];
        if ((b.rects[0]?.top ?? Infinity) > aBottom) break;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const hit = a.rects.some((ra) =>
          b.rects.some(
            (rb) => Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 1.5 && Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 1.5,
          ),
        );
        if (hit) problems.push({ what: `overlaps "${words(b.el)}" (${describe(b.el)})`, text: words(a.el), where: describe(a.el) });
      }
    }
    return problems;
  }, scope);
}
