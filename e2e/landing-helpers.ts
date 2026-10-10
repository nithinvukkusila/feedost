// Helpers shared by the landing and 404 specs (R0-1). Test code only.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { langs, messageText, type Lang } from "./helpers";

export const OUT = join(__dirname, "..", "out");

export type Tag = { name: string; attrs: Record<string, string> };

const entities: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#x27;": "'", "&#39;": "'", "&nbsp;": " " };

/** Decodes the handful of entities React writes into attribute values and text. */
export function decode(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|nbsp|#x27|#39);/g, (m) => entities[m] ?? m);
}

/** Every `<meta>` and `<link>` tag of a raw HTML string, with lower-cased attribute names. */
export function headTags(html: string): Tag[] {
  const tags: Tag[] = [];
  for (const m of html.matchAll(/<(meta|link)\b([^>]*)>/gi)) {
    const attrs: Record<string, string> = {};
    for (const a of m[2].matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) attrs[a[1].toLowerCase()] = decode(a[2]);
    tags.push({ name: m[1].toLowerCase(), attrs });
  }
  return tags;
}

/** The text of every `<title>` in a raw HTML string. */
export function titles(html: string): string[] {
  return [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => decode(m[1]));
}

/** The `<html lang>` of a raw HTML string, or null when there is none. */
export function htmlLang(html: string): string | null {
  return /<html\s[^>]*\blang="([^"]*)"/.exec(html)?.[1] ?? null;
}

/** A message the way the page shows it: marker removed, `{brand}` filled in. */
export function shown(lang: Lang, path: string): string {
  return messageText(lang, path).replaceAll("{brand}", brand.name);
}

/** Every key path under a prefix in a language file whose raw value is `TODO-translate: <English>`. */
export function flaggedPaths(lang: Lang, prefix: string): string[] {
  const tree = JSON.parse(readFileSync(join(__dirname, "..", "messages", `${lang}.json`), "utf8")) as Record<string, unknown>;
  const found: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === "string") {
      if (node.startsWith("TODO-translate")) found.push(path);
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk((tree as Record<string, unknown>)[prefix], prefix);
  return found;
}

/** True when a built file exists for a site-absolute path such as `/hi/`. */
export function builtFileFor(path: string): boolean {
  const clean = path.split("#")[0];
  return existsSync(join(OUT, clean.endsWith("/") ? join(clean, "index.html") : clean));
}

/** The visible text of the page plus the aria-labels, whitespace squeezed, to look for a message in. */
export function pageWords(page: Page): Promise<string> {
  return page.evaluate(() => {
    const labels = [...document.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label") ?? "");
    return (document.body.textContent + " " + labels.join(" ")).replace(/\s+/g, " ");
  });
}

export type Target = { tag: string; text: string; width: number; height: number };

/** Every `a` and `button` on the page that is smaller than 44 by 44 CSS pixels. */
export function smallTargets(page: Page): Promise<Target[]> {
  return page.evaluate(() => {
    const out: { tag: string; text: string; width: number; height: number }[] = [];
    for (const el of document.querySelectorAll("a, button")) {
      const r = el.getBoundingClientRect();
      if (r.width < 44 - 0.5 || r.height < 44 - 0.5) {
        out.push({ tag: el.tagName.toLowerCase(), text: (el.textContent ?? "").trim().slice(0, 40), width: r.width, height: r.height });
      }
    }
    return out;
  });
}

export type SmallText = { text: string; size: number };

/** Every element that owns visible text drawn smaller than 14px. */
export function smallText(page: Page): Promise<SmallText[]> {
  return page.evaluate(() => {
    const out: { text: string; size: number }[] = [];
    for (const el of document.body.querySelectorAll("*")) {
      if (el.closest("script, style, noscript, template")) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
      if (!own) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 14) out.push({ text: (el.textContent ?? "").trim().slice(0, 40), size });
    }
    return out;
  });
}

/** Sets the root font size to 200%, the way a phone set to its largest text size does, and waits for layout. */
export async function largestText(page: Page): Promise<void> {
  await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

export { langs };
