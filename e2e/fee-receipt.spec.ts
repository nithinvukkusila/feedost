// Spec R0-3, the fee receipt maker. Against the static export in out/ at the 360px phone project.
// The PDF is really made in the browser here (the library and the fonts are fetched from out/), so
// these tests show that nothing heavy loads before a tap, that a tap yields a real one-page PDF, that
// only the fonts a receipt needs are fetched, and that the page holds at 360px and at 200% text.
// What a native reader sees in the PDF is NOT judged here: that check is still pending (criterion 1).
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { fontsSettled, langs, recordRequests, sidewaysScroll, textProblems, type Lang } from "./helpers";
import { builtFileFor, headTags, htmlLang, largestText, OUT, shown, smallTargets, smallText, titles } from "./landing-helpers";

const tool = (lang: Lang) => `/${lang}/tools/fee-receipt/`;
const part = (page: Page, name: string) => page.getByTestId(`receipt-${name}`);

async function openTool(page: Page, lang: Lang): Promise<void> {
  await page.goto(tool(lang));
  await expect(part(page, "tutor")).toBeEnabled();
  await fontsSettled(page);
}

async function fill(page: Page, tutor: string, student: string, amount: string): Promise<void> {
  await part(page, "tutor").fill(tutor);
  await part(page, "student").fill(student);
  await part(page, "amount-field").fill(amount);
}

const libraryRequest = (url: string) => /\/_next\/static\/chunks\/.+\.js/.test(url);
const fontRequest = (url: string) => /\/pdf-fonts\/.+\.ttf/.test(url);

for (const lang of langs) {
  test.describe(`fee receipt [${lang}]`, () => {
    test("page shell: one header, main, footer and h1; header links; footer languages; head tags", async ({ page }) => {
      await openTool(page, lang);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      for (const landmark of ["header", "main", "footer", "h1"]) await expect(page.locator(landmark)).toHaveCount(1);
      await expect(page.locator("h1")).toHaveText(shown(lang, "receipt.title"));
      await expect(page.locator("form")).toHaveCount(0);
      const header = page.locator("header a");
      await expect(header).toHaveCount(2);
      await expect(header.nth(0)).toHaveText(brand.name);
      await expect(header.nth(0)).toHaveAttribute("href", `/${lang}/`);
      await expect(header.nth(1)).toHaveAttribute("href", `/${lang}/tools/fee-reminder/`);
      await expect(page.locator('header [aria-current="page"]')).toHaveText(shown(lang, "toolNav.receipt"));
      const others = langs.filter((code) => code !== lang);
      expect(await page.locator("footer nav a").evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual(others.map(tool));

      const html = readFileSync(`${OUT}${tool(lang)}index.html`, "utf8");
      expect(htmlLang(html)).toBe(lang);
      expect(titles(html)).toEqual([shown(lang, "receipt.meta.title")]);
      const tags = headTags(html);
      expect(tags.find((t) => t.name === "link" && t.attrs.rel === "canonical")?.attrs.href).toBe(`https://${brand.domain}${tool(lang)}`);
      expect(tags.filter((t) => t.name === "link" && t.attrs.rel === "alternate")).toHaveLength(5);
      expect(builtFileFor(tool(lang))).toBe(true);
    });

    test("nothing heavy loads before a tap, and nothing is sent or stored while typing", async ({ page, context }) => {
      const requests = recordRequests(page);
      await openTool(page, lang);
      await fill(page, "Meena Iyer", "Arjun", "1200");
      await expect(part(page, "download")).toBeEnabled();
      // Neither the PDF library chunk (it is a lazy chunk, not in the page's script tags) nor a PDF font.
      const html = readFileSync(`${OUT}${tool(lang)}index.html`, "utf8");
      const initial = new Set([...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1].split("?")[0]));
      const lazy = requests.filter((url) => libraryRequest(new URL(url).pathname) && !initial.has(new URL(url).pathname));
      const libraryLike = lazy.filter((url) => /pdf|font/i.test(url));
      expect(libraryLike).toEqual([]);
      expect(requests.filter((url) => fontRequest(url))).toEqual([]);
      expect(requests.filter((url) => !url.startsWith("http://localhost"))).toEqual([]);
      expect(await context.cookies()).toEqual([]);
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
      expect(new URL(page.url()).search).toBe("");
    });

    test("360 px: no sideways scroll, nothing under 14px or 44px, no clipped or overlapping text, also at 200% text", async ({ page }) => {
      await openTool(page, lang);
      await fill(page, "Meena Iyer", "Arjun", "1200");
      expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
      expect(await smallText(page)).toEqual([]);
      expect(await smallTargets(page)).toEqual([]);
      expect(await textProblems(page, "main")).toEqual([]);
      const before = (await part(page, "download").boundingBox())!.height;
      await largestText(page);
      await fontsSettled(page);
      expect(await sidewaysScroll(page)).toBeLessThanOrEqual(0);
      expect(await textProblems(page, "main")).toEqual([]);
      // Buttons grow with their text; they do not cut it.
      expect((await part(page, "download").boundingBox())!.height).toBeGreaterThan(before);
    });
  });
}

test("a tap makes a real one-page PDF, fetching only the Latin font, with a generic file name", async ({ page }) => {
  const requests = recordRequests(page);
  await openTool(page, "en");
  await fill(page, "Meena Iyer", "Arjun", "1200");
  const [file] = await Promise.all([page.waitForEvent("download"), part(page, "download").click()]);
  expect(file.suggestedFilename()).toMatch(/^fee-receipt-[A-Z][a-z]{2}-\d{4}\.pdf$/);
  const path = await file.path();
  const bytes = readFileSync(path);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.length).toBeLessThan(300 * 1024);
  expect(bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
  // No typed value in the file name or the document properties.
  expect(bytes.toString("latin1")).not.toContain("Meena");
  expect(requests.filter(fontRequest).map((url) => new URL(url).pathname)).toEqual(["/pdf-fonts/NotoSans.ttf"]);
  await expect(part(page, "download")).toBeEnabled();
  await expect(part(page, "status")).toHaveText("");
});

test("a Kannada name on a Hindi receipt fetches the Devanagari and Kannada fonts as well as the Latin one", async ({ page }) => {
  const requests = recordRequests(page);
  await openTool(page, "hi");
  await fill(page, "Meena Iyer", "ಲಕ್ಷ್ಮಿ", "1200");
  const [file] = await Promise.all([page.waitForEvent("download"), part(page, "download").click()]);
  expect(readFileSync(await file.path()).subarray(0, 5).toString()).toBe("%PDF-");
  const fonts = requests.filter(fontRequest).map((url) => new URL(url).pathname.split("/").pop());
  expect(new Set(fonts)).toEqual(new Set(["NotoSans.ttf", "NotoSansDevanagari.ttf", "NotoSansKannada.ttf"]));
});

test("Share without a share sheet saves the PDF and opens WhatsApp with a short text, no number", async ({ page }) => {
  await page.route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>stub</p>" }));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await openTool(page, "en");
  await fill(page, "Meena Iyer", "Arjun", "1200");
  const [file, popup] = await Promise.all([page.waitForEvent("download"), page.waitForEvent("popup"), part(page, "share").click()]).then(
    ([f, p]) => [f, p] as const,
  );
  expect(file.suggestedFilename()).toMatch(/\.pdf$/);
  const url = new URL(popup.url());
  expect([url.protocol, url.host, url.pathname]).toEqual(["https:", "wa.me", "/"]);
  expect(url.searchParams.get("text")).toMatch(/^Fee receipt for [A-Z][a-z]+ \d{4}\./);
  await expect(part(page, "status")).toContainText(shown("en", "receiptForm.saved"));
  await expect(part(page, "open-whatsapp")).toHaveAttribute("rel", /noopener/);
});

test("when the library cannot load, one sentence with a mark is shown and the button works again", async ({ page }) => {
  await page.route(/\/pdf-fonts\/.*\.ttf/, (route) => route.abort());
  await openTool(page, "en");
  await fill(page, "Meena Iyer", "Arjun", "1200");
  await part(page, "download").click();
  await expect(part(page, "status")).toContainText(shown("en", "receiptForm.failed"));
  await expect(part(page, "download")).toBeEnabled();
});
