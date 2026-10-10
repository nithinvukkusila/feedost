// Spec F3, the language routes /en/ /hi/ /kn/ /te/ and the Formats section: criteria 1 to 7, 9, 29, 40, 41, 42.
// Runs against the static export in out/ at the phone viewport (360 wide, touch) from playwright.config.ts.
// The jump page on "/" (criteria 10 to 18) is in jump.spec.ts.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { brand } from "../src/config/brand";
import {
  DEV,
  familyOf,
  firstFamily,
  fontFiles,
  fontsSettled,
  indicLangs,
  langs,
  messageText,
  openDevPage,
  recordRequests,
  scriptFontVariable,
  scriptPattern,
  sidewaysScroll,
  slow4G,
  type Lang,
} from "./helpers";

const OUT = join(__dirname, "..", "out");
const MARKER = "TODO-translate: ";

type Tree = { [key: string]: string | Tree };
function messages(lang: Lang): Tree {
  return JSON.parse(readFileSync(join(__dirname, "..", "messages", `${lang}.json`), "utf8"));
}
/** The words a page shows for a key, the way the app shows them (an untranslated value reads as its English text). */
function placeholderOf(lang: Lang): string {
  const value = ((messages(lang).landing as Tree).hero as Tree).kicker as string;
  return value.startsWith(MARKER) ? value.slice(MARKER.length) : value;
}
function leaves(node: Tree, out: string[] = []): string[] {
  for (const v of Object.values(node)) {
    if (typeof v === "string") out.push(v.startsWith(MARKER) ? v.slice(MARKER.length) : v);
    else leaves(v, out);
  }
  return out;
}

test.describe("criterion 1: the build holds one page per language and the jump page", () => {
  for (const file of ["index.html", "en/index.html", "hi/index.html", "kn/index.html", "te/index.html"]) {
    test(`out/${file} exists and is not empty`, () => {
      const path = join(OUT, file);
      expect(existsSync(path), path).toBe(true);
      expect(readFileSync(path, "utf8").length).toBeGreaterThan(500);
    });
  }
});

test.describe("criterion 3: <html lang> is in the file as built, not set by a script", () => {
  for (const lang of langs) {
    test(`${lang}: the raw HTML file and the raw HTTP body both open with <html lang="${lang}">`, async ({ request }) => {
      const file = readFileSync(join(OUT, lang, "index.html"), "utf8");
      expect(file).toMatch(new RegExp(`^<!DOCTYPE html><html lang="${lang}"[ >]`, "i"));
      const body = await (await request.get(`/${lang}/`)).text();
      expect(body).toMatch(new RegExp(`<html lang="${lang}"[ >]`));
      expect(body.match(/<html\b/g)).toHaveLength(1);
    });
  }
});

test.describe("criteria 2 and 40: JavaScript off, each page reads in its own language", () => {
  test.use({ javaScriptEnabled: false });
  for (const lang of langs) {
    test(`2, 40: /${lang}/ has its own headline and the ${lang} kicker`, async ({ page }) => {
      await page.goto(`/${lang}/`);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(messageText(lang, "landing.hero.title"));
      const kicker = page.locator("main p").first();
      await expect(kicker).toHaveText(placeholderOf(lang));
      if (lang !== "en") await expect(kicker).toHaveText(scriptPattern[lang]);
      expect(await sidewaysScroll(page)).toBe(0);
    });
  }
  test("2: the four lines really differ, so each page is in its own language", () => {
    expect(new Set(langs.map(placeholderOf)).size).toBe(4);
  });
});

test.describe("criterion 9: every language page has its own title, led by the product name", () => {
  for (const lang of langs) {
    test(`/${lang}/ <title> starts with the product name`, async ({ page }) => {
      const title = messageText(lang, "landing.meta.title").replace("{brand}", brand.name);
      expect(title.startsWith(brand.name)).toBe(true);
      await page.goto(`/${lang}/`);
      await expect(page).toHaveTitle(title);
      expect(readFileSync(join(OUT, lang, "index.html"), "utf8")).toContain(`<title>${title}</title>`);
    });
  }
});

test.describe("criterion 4: the script's Anek face and the F2 Indian-script rules apply on the language route", () => {
  for (const lang of langs) {
    test(`/${lang}/ first font in body text, letter-spacing, capitals`, async ({ page }) => {
      await page.goto(`/${lang}/`);
      await fontsSettled(page);
      const body = page.locator("main h1 + p");
      const style = await page.locator("main p:not([translate=no]), main h1").evaluateAll((els) =>
        els.map((el) => {
          const s = getComputedStyle(el);
          return { tag: el.tagName, tracking: s.letterSpacing, transform: s.textTransform };
        }),
      );
      if (lang === "en") {
        expect(await firstFamily(body)).toBe("Bricolage Grotesque");
        expect(await firstFamily(page.locator("body"))).toBe("Bricolage Grotesque");
        return;
      }
      const anek = await familyOf(page, scriptFontVariable[lang]);
      expect(anek).toMatch(/^Anek /);
      expect(await firstFamily(body)).toBe(anek);
      for (const s of style) {
        expect(["normal", "0px"], `${s.tag} letter-spacing ${s.tracking}`).toContain(s.tracking);
        expect(s.transform, s.tag).toBe("none");
      }
    });
  }
});

test.describe("criterion 5: each route downloads only its own script's Anek file", () => {
  for (const lang of langs) {
    test(`/${lang}/ requests ${lang === "en" ? "no Anek file" : `the ${lang} Anek file only`}`, async ({ page }) => {
      const urls = recordRequests(page);
      await page.goto(`/${lang}/`);
      await fontsSettled(page);
      const files = await fontFiles(page);
      const familyByUrl = new Map(files.map((f) => [f.url, f.family]));
      expect(files.filter((f) => /^Anek /.test(f.family)).length, "Anek files are declared, so the check means something").toBeGreaterThan(0);
      const requestedAnek = [...new Set(urls.filter((u) => u.endsWith(".woff2")).map((u) => familyByUrl.get(u)))].filter(
        (f): f is string => !!f && /^Anek /.test(f),
      );
      if (lang === "en") {
        expect(requestedAnek).toEqual([]);
      } else {
        expect(requestedAnek).toEqual([await familyOf(page, scriptFontVariable[lang])]);
      }
      const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/^["']|["']$/g, "")));
      expect([...new Set(loaded.filter((f) => /^Anek /.test(f)))]).toEqual(lang === "en" ? [] : [await familyOf(page, scriptFontVariable[lang])]);
    });
  }
});

test.describe("criterion 6: /dev/components stays English with four language blocks", () => {
  test("html lang is en and each block keeps its own lang", async ({ page }) => {
    await openDevPage(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    for (const lang of langs) {
      const blocks = page.locator(`[data-testid="lang-${lang}"]`);
      expect(await blocks.count()).toBeGreaterThan(0);
      for (const el of await blocks.all()) await expect(el).toHaveAttribute("lang", lang);
    }
  });
});

test.describe("criterion 7: an unknown language segment is the 404 page", () => {
  for (const path of ["/fr/", "/fr", "/xx/dev/", "/en/nothing/"]) {
    test(`${path} answers 404 and shows no locale page`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      const html = await page.content();
      for (const lang of langs) expect(html).not.toContain(placeholderOf(lang));
      // The 404 is its own page: the name as its one h1, then one block per language, each with a link to that language.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(brand.name);
      expect(await page.locator("body").innerText()).toContain(messageText("en", "notFound.title"));
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });
  }
});

/**
 * Whether a message stands in the text as words of its own, the rule `pnpm check:leak` uses since
 * R0-2. A value that starts or ends with a Latin letter or digit does not count where it is glued
 * into a longer name: the English word "Missing" is not on a Hindi page because the framework's own
 * code has a `MissingSlotContext`. In quotes, between tags, in a sentence or after an escaped line
 * break it still counts.
 */
function standsAsWords(text: string, value: string): boolean {
  const wordChar = /[A-Za-z0-9_$]/;
  for (const spelling of [value, JSON.stringify(value).slice(1, -1)]) {
    for (let at = text.indexOf(spelling); at !== -1; at = text.indexOf(spelling, at + 1)) {
      const before = text[at - 1] ?? "";
      const after = text[at + spelling.length] ?? "";
      const escapeBefore = /[nrt]/.test(before) && text[at - 2] === "\\";
      const gluedBefore = wordChar.test(spelling[0]) && wordChar.test(before) && !escapeBefore;
      const gluedAfter = wordChar.test(spelling[spelling.length - 1]) && wordChar.test(after);
      if (!gluedBefore && !gluedAfter) return true;
    }
  }
  return false;
}

test.describe("criteria 29 and 41: only the active language ships", () => {
  test("29: the word rule itself: a piece of a longer name is not the word, the word in quotes or a sentence is", () => {
    expect(standsAsWords("var MissingSlotContext=1;findMissingRoutes()", "Missing")).toBe(false);
    expect(standsAsWords('children:"Missing"', "Missing")).toBe(true);
    expect(standsAsWords("<p>Fee is Missing.</p>", "Missing")).toBe(true);
    expect(standsAsWords('"Total:\\nMissing"', "Missing")).toBe(true);
    expect(standsAsWords("abcफ़ीस जमाdef", "फ़ीस जमा")).toBe(true);
  });

  for (const lang of langs) {
    test(`29: /${lang}/ and every script it loads hold none of the other languages' words`, async ({ page }) => {
      const bodies: { url: string; text: string }[] = [];
      page.on("response", async (response) => {
        const type = response.request().resourceType();
        if (!["document", "script"].includes(type)) return;
        bodies.push({ url: response.url(), text: await response.text().catch(() => "") });
      });
      await page.goto(`/${lang}/`);
      await fontsSettled(page);
      await page.waitForLoadState("networkidle");
      expect(bodies.length).toBeGreaterThan(1);
      const all = bodies.map((b) => b.text).join("\n");
      const own = new Set(leaves(messages(lang)));
      const theirs = langs
        .filter((other) => other !== lang)
        .flatMap((other) => leaves(messages(other)).map((v) => ({ other, v })))
        // an untranslated value shows English text; the same text in two files is not a leak
        .filter(({ v }) => v.length >= 6 && !own.has(v));
      expect(theirs.length).toBeGreaterThan(0);
      for (const { other, v } of theirs) {
        expect(standsAsWords(all, v), `${other} text "${v}" found in ${lang} page`).toBe(false);
      }
      expect(all, "the page's own line is in the delivered HTML").toContain(placeholderOf(lang));
    });
  }

  test("29: the check script agrees (pnpm check:leak exits 0 on this build)", () => {
    const out = execFileSync("node", ["scripts/check-locale-leak.mjs"], { cwd: join(__dirname, ".."), encoding: "utf8" });
    expect(out.length).toBeGreaterThan(0);
  });
});

test.describe("criteria 2, 4, 40 at the edges: large text, slow 4G, offline", () => {
  for (const lang of langs) {
    test(`/${lang}/ with the browser's text size at 200%: nothing runs sideways, the line wraps inside 360px`, async ({ page }) => {
      await page.addInitScript(() => {
        // The browser's "font size" setting scales the root size that rem units are measured from.
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.style.fontSize = "200%";
        });
      });
      await page.goto(`/${lang}/`);
      await fontsSettled(page);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("32px");
      expect(await sidewaysScroll(page)).toBe(0);
      const p = page.locator("main p").first();
      const box = (await p.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
      await expect(p).toBeVisible();
    });
  }

  for (const lang of langs) {
    test(`/${lang}/ on slow 4G: headline and line arrive in the delivered HTML and the right font loads`, async ({ page }) => {
      test.slow();
      await slow4G(page);
      await page.goto(`/${lang}/`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(messageText(lang, "landing.hero.title"));
      await expect(page.locator("main p").first()).toHaveText(placeholderOf(lang));
      await fontsSettled(page);
      if (lang !== "en") {
        const anek = await familyOf(page, scriptFontVariable[lang]);
        await expect.poll(() => page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/^["']|["']$/g, "")))).toContain(anek);
      }
    });
  }

  test("offline then back online: a language page that cannot load fails, then loads when the network returns", async ({ page, context }) => {
    await page.goto("/en/");
    await context.setOffline(true);
    await expect(page.goto("/hi/")).rejects.toThrow(/ERR_INTERNET_DISCONNECTED|net::/);
    await context.setOffline(false);
    await page.goto("/hi/");
    await expect(page.locator("main p").first()).toHaveText(placeholderOf("hi"));
  });
});

test.describe("criterion 42: the Formats section on /dev/components", () => {
  const expectedRupees = ["₹0", "₹0.99", "₹1,000", "₹1,23,456"];
  const expectedDate = "08 Oct 2026";
  const expectedPhone = "+91 98765 43210";

  for (const lang of langs) {
    test(`${lang}: the block has its own lang and shows the six figures with 0-9 digits`, async ({ page }) => {
      await openDevPage(page);
      const section = page.getByTestId("section-formats");
      await expect(section).toBeVisible();
      const block = section.locator(`[data-testid="lang-${lang}"]`);
      await expect(block).toHaveAttribute("lang", lang);
      await expect(block.locator('[data-format="rupees"]')).toHaveText(expectedRupees);
      await expect(block.locator('[data-format="date"]')).toHaveText(expectedDate);
      await expect(block.locator('[data-format="phone"]')).toHaveText(expectedPhone);
      const text = (await block.locator("[data-format]").allInnerTexts()).join(" ");
      // Only the rupee sign, ASCII digits, grouping, and the words of a date and a phone number.
      expect(text.replace(/[₹0-9,.+ ]|Oct/g, "")).toBe("");
      for (const el of await block.locator("[data-format]").all()) {
        const lowerLang = await el.evaluate((n) => n.closest("[lang]")?.getAttribute("lang"));
        expect(lowerLang).toBe(lang);
      }
    });
  }

  test("the text is identical in all four blocks", async ({ page }) => {
    await openDevPage(page);
    const texts = [];
    for (const lang of langs) {
      texts.push(await page.locator(`[data-testid="section-formats"] [data-testid="lang-${lang}"] [data-format]`).allInnerTexts());
    }
    expect(texts[0]).toEqual([...expectedRupees, expectedDate, expectedPhone]);
    for (const t of texts.slice(1)) expect(t).toEqual(texts[0]);
  });

  test("on the Hindi, Kannada and Telugu phones no native digit appears anywhere in the Formats section", async ({ page }) => {
    await openDevPage(page);
    const text = await page.getByTestId("section-formats").innerText();
    for (const range of [/[०-९]/, /[೦-೯]/, /[౦-౯]/]) {
      expect(text).not.toMatch(range);
    }
    expect(indicLangs.length).toBe(3);
  });

  test("the formats section holds at 360px with no sideways scroll", async ({ page }) => {
    await openDevPage(page);
    expect(await sidewaysScroll(page)).toBe(0);
  });
});

test.describe("criterion 41: the dev page is outside the locale routes", () => {
  test("/dev/components/ answers 200 and is not served under a language prefix", async ({ page }) => {
    expect((await page.goto(DEV))?.status()).toBe(200);
    for (const lang of langs) expect((await page.goto(`/${lang}${DEV}`))?.status()).toBe(404);
  });
});

