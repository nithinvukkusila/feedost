// Spec R0-1, the 404 (criteria 28, 29 and 30; 10, 19, 20, 21 for the 404 page). Against the static export in out/
// at the 360px phone project. scripts/serve-out.mjs answers any unknown address with out/404.html and status 404.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { localeNames } from "../src/config/locales";
import { check404 } from "../scripts/check-404-lib.mjs";
import { firstFamily, fontFiles, fontsSettled, langs, recordRequests, sidewaysScroll, textProblems } from "./helpers";
import { builtFileFor, flaggedPaths, headTags, htmlLang, largestText, OUT, shown, smallTargets, smallText, titles } from "./landing-helpers";

const missing = ["/fr/", "/en/nope/", "/xyz"] as const;

async function openMissing(page: Page, address: string) {
  const response = await page.goto(address);
  await fontsSettled(page);
  return response!;
}

test.describe("criterion 28: any unknown address returns the built 404", () => {
  for (const address of missing) {
    test(`criterion 28: ${address} is a 404 with lang, one h1, four h2, four language blocks and four links`, async ({ page }) => {
      const response = await openMissing(page, address);
      expect(response.status()).toBe(404);
      expect(response.headers()["content-type"]).toContain("text/html");
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page).toHaveTitle(brand.name);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(brand.name);
      await expect(page.locator("h2")).toHaveCount(4);
      await expect(page.locator("section[lang]")).toHaveCount(4);
      await expect(page.locator("a[href]")).toHaveCount(4);
      await expect(page.locator("a:not([href])")).toHaveCount(0);
      for (const [i, code] of langs.entries()) {
        const block = page.locator("section[lang]").nth(i);
        await expect(block).toHaveAttribute("lang", code);
        await expect(block.locator("h2")).toHaveText(shown(code, "notFound.title"));
        await expect(block.locator("p")).toHaveText(shown(code, "notFound.body"));
        const link = block.locator("a");
        await expect(link).toHaveCount(1);
        await expect(link).toHaveAttribute("href", `/${code}/`);
        await expect(link).toHaveText(localeNames[code]);
        expect(builtFileFor(`/${code}/`)).toBe(true);
      }
      await expect(page.locator("main")).toHaveCount(1);
      // No form, no off-origin anything.
      await expect(page.locator("form, input, select, textarea, img")).toHaveCount(0);
    });
  }

  test("criterion 28: the raw 404 carries noindex, a title from the brand and no TODO-translate marker", async ({ request }) => {
    for (const address of missing) {
      const response = await request.get(address);
      expect(response.status(), address).toBe(404);
      const raw = await response.text();
      expect(htmlLang(raw), address).toBe("en");
      expect(titles(raw), address).toEqual([brand.name]);
      const robots = headTags(raw).filter((t) => t.attrs.name === "robots");
      expect(robots.map((t) => t.attrs.content), address).toEqual(["noindex"]);
      expect(raw).not.toContain("TODO-translate");
      expect(raw).not.toMatch(/<script[^>]*src=[^>]*\/\//);
    }
    // The built file itself, the one scripts/check-404.mjs reads.
    expect(check404(readFileSync(join(OUT, "404.html"), "utf8"))).toEqual([]);
  });

  test("criterion 28: a real page is not a 404, and the address /404.html is the file itself", async ({ request }) => {
    expect((await request.get("/en/")).status()).toBe(200);
    expect((await request.get("/")).status()).toBe(200);
    expect((await request.get("/en/nope")).status()).toBe(404);
  });

  test("criterion 28: with JavaScript off the four links still follow to each language's landing page", async ({ browser }) => {
    for (const code of langs) {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      await page.goto("/en/nope/");
      await page.getByRole("link", { name: localeNames[code] }).click();
      await expect(page).toHaveURL(`/${code}/`);
      await expect(page.locator("html")).toHaveAttribute("lang", code);
      await expect(page.locator("h1")).toHaveText(shown(code, "landing.hero.title"));
      await context.close();
    }
  });

  test("criterion 28: it makes no request to another origin and no POST", async ({ page, baseURL }) => {
    const requests: { url: string; method: string }[] = [];
    page.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
    await openMissing(page, "/fr/");
    await page.waitForLoadState("networkidle");
    const origin = new URL(baseURL!).origin;
    expect(requests.filter((r) => new URL(r.url).origin !== origin)).toEqual([]);
    expect(requests.filter((r) => r.method !== "GET")).toEqual([]);
  });
});

test.describe("criterion 7: the 404 never shows the marker", () => {
  test("every flagged notFound value shows its English text, in its own block, and the marker nowhere", async ({ page }) => {
    await openMissing(page, "/fr/");
    const body = (await page.evaluate(() => document.body.textContent ?? "")).replace(/\s+/g, " ");
    expect(body).not.toContain("TODO-translate");
    expect(await page.content()).not.toContain("TODO-translate");
    let seen = 0;
    for (const code of langs) {
      const flagged = flaggedPaths(code, "notFound");
      if (code === "en") expect(flagged).toEqual([]);
      for (const key of flagged) {
        seen++;
        const block = page.locator(`section[lang="${code}"]`);
        await expect(block.locator(key.endsWith("title") ? "h2" : "p")).toHaveText(shown("en", key));
      }
    }
    expect(seen).toBeGreaterThan(0); // kn and te flag notFound.body today; this fails loudly if that changes so the loop is not vacuous
  });
});

test.describe("criterion 10, 19, 20, 21 on the 404 page", () => {
  test("the four links resolve to built files and nothing else is a link", async ({ page }) => {
    await openMissing(page, "/xyz");
    const hrefs = await page.locator("a").evaluateAll((els) => els.map((a) => a.getAttribute("href")));
    expect(hrefs).toEqual(["/en/", "/hi/", "/kn/", "/te/"]);
    for (const href of hrefs) expect(builtFileFor(href!), href!).toBe(true);
  });

  test("no sideways scroll at 360px, and none at 200% root font size; no clipped or overlapping text", async ({ page }) => {
    await openMissing(page, "/en/nope/");
    expect(await sidewaysScroll(page)).toBe(0);
    expect(await textProblems(page, "body")).toEqual([]);
    await largestText(page);
    expect(await sidewaysScroll(page)).toBe(0);
    expect(await textProblems(page, "body")).toEqual([]);
    expect(await smallText(page)).toEqual([]);
    expect(await smallTargets(page)).toEqual([]);
  });

  test("every link is at least 44 by 44 and no text is under 14px", async ({ page }) => {
    await openMissing(page, "/xyz");
    expect(await smallTargets(page)).toEqual([]);
    expect(await smallText(page)).toEqual([]);
  });
});

test.describe("criterion 24: fonts on the 404", () => {
  test("it loads the Latin faces and all three Anek files (it shows all three scripts), from its own origin", async ({ page, baseURL }) => {
    const urls = recordRequests(page);
    await openMissing(page, "/fr/");
    const files = await fontFiles(page);
    const familyByUrl = new Map(files.map((f) => [f.url, f.family]));
    const families = new Set(urls.filter((u) => u.endsWith(".woff2")).map((u) => familyByUrl.get(u)));
    for (const family of ["Bricolage Grotesque", "Anek Devanagari", "Anek Kannada", "Anek Telugu"]) expect(families, family).toContain(family);
    expect(urls.filter((u) => new URL(u).origin !== new URL(baseURL!).origin)).toEqual([]);
    // Each block is drawn in its own script's face.
    const hi = page.locator('section[lang="hi"] h2');
    expect(await firstFamily(hi)).toMatch(/^Anek Devanagari/);
    expect(await firstFamily(page.locator('section[lang="kn"] h2'))).toMatch(/^Anek Kannada/);
    expect(await firstFamily(page.locator('section[lang="te"] h2'))).toMatch(/^Anek Telugu/);
  });
});

test.describe("criterion 24: the English landing fetches no Anek file", () => {
  test("/en/ requests no Anek font file at all", async ({ page }) => {
    const urls = recordRequests(page);
    await page.goto("/en/");
    await fontsSettled(page);
    const files = await fontFiles(page);
    const anek = new Set(files.filter((f) => /^Anek/.test(f.family)).map((f) => f.url));
    expect(anek.size).toBeGreaterThan(0);
    expect(urls.filter((u) => anek.has(u))).toEqual([]);
  });
});
