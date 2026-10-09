// Spec F2, fonts: criteria 9, 11, 12, 13, 14, 40, 60 and the automatic part of 16.
// Runs against the static export in out/ at the phone viewport from playwright.config.ts.
import { expect, test, type CDPSession, type Locator, type Page } from "@playwright/test";
import {
  DEV,
  familyOf,
  firstFamily,
  fontFiles,
  fontProbe,
  fontsSettled,
  indicLangs,
  openDevPage,
  pixels,
  recordRequests,
  scriptFontVariable,
  scriptPattern,
  type IndicLang,
  HOME,
} from "./helpers";

const ANEK = /^Anek /;

function loadedFamilies(page: Page): Promise<string[]> {
  return page.evaluate(() => [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/^["']|["']$/g, "")))]);
}

test.describe("criterion 9: fonts come from our own origin", () => {
  for (const path of [HOME, DEV]) {
    test(`${path} makes no request to another host, for fonts or anything else`, async ({ page, baseURL }) => {
      const origin = new URL(baseURL!).origin;
      const urls = recordRequests(page);
      const fontResponses: { url: string; status: number; type: string }[] = [];
      page.on("response", (response) => {
        if (response.request().resourceType() === "font") {
          fontResponses.push({ url: response.url(), status: response.status(), type: response.headers()["content-type"] ?? "" });
        }
      });
      await page.goto(path);
      await fontsSettled(page);

      expect(urls.length).toBeGreaterThan(0);
      expect(urls.filter((u) => new URL(u).origin !== origin)).toEqual([]);

      expect(fontResponses.length).toBeGreaterThan(0);
      for (const font of fontResponses) {
        expect(new URL(font.url).origin, font.url).toBe(origin);
        expect(font.status, font.url).toBe(200);
        expect(font.type, font.url).toBe("font/woff2");
      }

      // Nothing in the page or its stylesheets even names a font host.
      const html = await page.content();
      expect(html).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
      for (const file of await fontFiles(page)) expect(new URL(file.url).origin, file.url).toBe(origin);
    });
  }

  test("all five families are declared and are the ones the page loads", async ({ page }) => {
    await openDevPage(page);
    const declared = new Set((await fontFiles(page)).map((f) => f.family));
    for (const family of ["Bricolage Grotesque", "DM Mono", "Anek Devanagari", "Anek Kannada", "Anek Telugu"]) {
      expect(declared.has(family), `${family} has an @font-face`).toBe(true);
    }
    const loaded = await loadedFamilies(page);
    for (const family of ["Bricolage Grotesque", "DM Mono", "Anek Devanagari", "Anek Kannada", "Anek Telugu"]) {
      expect(loaded, `${family} loaded on the dev page`).toContain(family);
    }
  });
});

test.describe("font bytes a page does not need (follow-up to criterion 12's slow-network case)", () => {
  test("the home page preloads the two Bricolage files and nothing else, and never asks for DM Mono", async ({ page }) => {
    const urls = recordRequests(page);
    await page.goto(HOME);
    await fontsSettled(page);
    const files = await fontFiles(page);
    const familyByUrl = new Map(files.map((f) => [f.url, f.family]));
    const preloaded = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map((link) => link.href),
    );
    expect(preloaded.map((url) => familyByUrl.get(url))).toEqual(["Bricolage Grotesque", "Bricolage Grotesque"]);
    expect(new Set(preloaded).size).toBe(2);
    const requested = urls.filter((u) => u.endsWith(".woff2"));
    expect(requested.map((u) => familyByUrl.get(u)).sort()).toEqual(["Bricolage Grotesque", "Bricolage Grotesque"]);
    expect(requested.filter((u) => familyByUrl.get(u) === "DM Mono")).toEqual([]);
  });

  test("14 font files are declared; DM Mono has weight 500 only and loads, unpreloaded, where a label is drawn", async ({ page }) => {
    await openDevPage(page);
    const files = await fontFiles(page);
    expect(new Set(files.map((f) => f.url)).size).toBe(14);
    const faces = await page.evaluate(() =>
      [...document.fonts].map((f) => ({ family: f.family.replace(/^["']|["']$/g, ""), weight: f.weight, status: f.status })),
    );
    const mono = faces.filter((f) => f.family === "DM Mono");
    expect(mono.length).toBeGreaterThan(0);
    expect([...new Set(mono.map((f) => f.weight))]).toEqual(["500"]);
    expect(mono.some((f) => f.status === "loaded")).toBe(true);
    const familyByUrl = new Map(files.map((f) => [f.url, f.family]));
    const preloaded = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLLinkElement>('link[rel="preload"][as="font"]')].map((link) => link.href),
    );
    // (The dev page itself carries no font preload at all; whatever it preloads, it is not DM Mono.)
    expect(preloaded.map((url) => familyByUrl.get(url)).filter((family) => family !== "Bricolage Grotesque")).toEqual([]);
    // No element on the page asks for a mono weight that has no file.
    const monoWeights = await page.evaluate(() => {
      const found = new Set<string>();
      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
        if (own && /^"?DM Mono/.test(s.fontFamily)) found.add(s.fontWeight);
      }
      return [...found];
    });
    expect(monoWeights).toEqual(["500"]);
  });
});

test.describe("criterion 11: an Indian-script font loads only when its script is on the page", () => {
  test("the English home page requests no Hindi, Kannada or Telugu font file", async ({ page }) => {
    const urls = recordRequests(page);
    await page.goto(HOME);
    await fontsSettled(page);

    const files = await fontFiles(page);
    const anekUrls = new Set(files.filter((f) => ANEK.test(f.family)).map((f) => f.url));
    expect(anekUrls.size, "the Anek files are declared, so the check below means something").toBeGreaterThan(0);
    expect(urls.filter((u) => anekUrls.has(u))).toEqual([]);
    expect((await loadedFamilies(page)).filter((f) => ANEK.test(f))).toEqual([]);

    // The Latin faces did load, so "nothing loaded" is not the reason the list is empty.
    expect(await loadedFamilies(page)).toContain("Bricolage Grotesque");
  });

  for (const lang of indicLangs) {
    test(`text in ${lang} on the home page fetches that script's file and no other script's`, async ({ page }) => {
      const urls = recordRequests(page);
      await page.goto(HOME);
      await fontsSettled(page);
      const files = await fontFiles(page);
      const own = await familyOf(page, scriptFontVariable[lang]);
      expect(own).toMatch(ANEK);

      const words: Record<IndicLang, string> = { hi: "फ़ीस जमा", kn: "ಶುಲ್ಕ ಪಾವತಿ", te: "ఫీజు చెల్లింపు" };
      await page.evaluate(
        ([code, text]) => {
          const p = document.createElement("p");
          p.lang = code;
          p.textContent = text;
          document.querySelector("main")!.append(p);
        },
        [lang, words[lang]] as const,
      );
      await expect.poll(() => loadedFamilies(page)).toContain(own);
      await fontsSettled(page);

      const requestedFamilies = new Set(files.filter((f) => urls.includes(f.url)).map((f) => f.family));
      expect([...requestedFamilies].filter((f) => ANEK.test(f))).toEqual([own]);
    });
  }

  test("the dev page, which shows all three scripts, loads all three", async ({ page }) => {
    await openDevPage(page);
    const loaded = await loadedFamilies(page);
    for (const lang of indicLangs) expect(loaded).toContain(await familyOf(page, scriptFontVariable[lang]));
  });
});

test.describe("criterion 12: text shows at once in a fallback face", () => {
  /** How many pixels in the element's box are clearly darker or lighter than its background. */
  async function inkIn(page: Page, locator: Locator, cdp: CDPSession): Promise<number> {
    await locator.scrollIntoViewIfNeeded();
    const b = await locator.boundingBox();
    if (!b) throw new Error("No box");
    const shot = await pixels(page, b, { cdp });
    const ground = shot.at(0, 0);
    let count = 0;
    for (let y = 0; y < shot.height; y++) {
      for (let x = 0; x < shot.width; x++) {
        const p = shot.at(x, y);
        if (Math.abs(p[0] - ground[0]) + Math.abs(p[1] - ground[1]) + Math.abs(p[2] - ground[2]) > 150) count++;
      }
    }
    return count;
  }

  test("on a slow connection with every font file held back, text is painted, then swaps without a jump", async ({ page }) => {
    test.slow();
    // Slow 4G as Chrome DevTools defines it, so the page itself also arrives slowly.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 562.5,
      downloadThroughput: (1.6 * 1024 * 1024 * 0.9) / 8,
      uploadThroughput: (750 * 1024 * 0.9) / 8,
    });

    // Hold every font file until the test lets go. Nothing here depends on timing.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const held: string[] = [];
    await page.route("**/*.woff2", async (route) => {
      held.push(route.request().url());
      await gate;
      await route.continue();
    });

    await page.goto(DEV, { waitUntil: "domcontentloaded" });
    const probe = await fontProbe(page);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();
    await expect.poll(() => held.length, "the fonts were asked for").toBeGreaterThan(0);

    const type = page.getByTestId("section-type");
    const samples = {
      heading,
      label: type.locator('[lang="en"] [data-role="label"]'),
      hindi: type.locator('[lang="hi"] [data-role="headline"]'),
      kannada: type.locator('[lang="kn"] [data-role="body"]'),
      telugu: type.locator('[lang="te"] [data-role="body"]'),
      button: page.getByTestId("button-record").getByRole("button"),
    };

    // No web font has arrived.
    const before = await page.evaluate(() =>
      [...document.fonts].map((f) => ({ family: f.family.replace(/^["']|["']$/g, ""), status: f.status, display: f.display })),
    );
    const webFonts = before.filter((f) => !f.family.endsWith(" Fallback"));
    expect(webFonts.length).toBeGreaterThanOrEqual(10);
    expect(webFonts.filter((f) => f.status === "loaded")).toEqual([]);

    // Every web font is `swap`. The one exception is the local fallback face next/font generates
    // (Arial with adjusted metrics): it has no file to wait for, so its display value does not matter.
    expect(webFonts.filter((f) => f.display !== "swap")).toEqual([]);
    const local = before.filter((f) => f.family.endsWith(" Fallback"));
    expect(local.map((f) => f.family)).toEqual(["Bricolage Grotesque Fallback"]);

    // Text is on screen now: it has a box, it has ink in it, and a system face drew it.
    const heights: Record<string, number> = {};
    for (const [name, locator] of Object.entries(samples)) {
      const b = await locator.boundingBox();
      expect(b, name).not.toBeNull();
      expect(b!.width, name).toBeGreaterThan(0);
      expect(b!.height, name).toBeGreaterThan(0);
      expect(await inkIn(page, locator, cdp), `${name} has visible ink before its font arrives`).toBeGreaterThan(40);
      const faces = await probe.facesFor(locator);
      expect(faces.length, name).toBeGreaterThan(0);
      for (const face of faces) {
        expect(face.family, `${name} is drawn by a fallback, not by a web font`).not.toMatch(/^(Bricolage Grotesque \d|DM Mono|Anek )/);
        expect(face.glyphs, name).toBeGreaterThan(0);
      }
      heights[name] = b!.height;
    }
    const rowBefore = await page.getByTestId("section-row").locator("li").first().boundingBox();

    // Let the fonts through: the same text is now drawn by the web fonts.
    release();
    await fontsSettled(page);
    expect((await probe.facesFor(samples.heading)).map((f) => f.family)[0]).toMatch(/^Bricolage Grotesque/);
    expect((await probe.facesFor(samples.label)).map((f) => f.family)[0]).toMatch(/^DM Mono/);
    expect((await probe.facesFor(samples.hindi)).map((f) => f.family)[0]).toMatch(/^Anek Devanagari/);
    expect((await probe.facesFor(samples.kannada)).map((f) => f.family)[0]).toMatch(/^Anek Kannada/);
    expect((await probe.facesFor(samples.telugu)).map((f) => f.family)[0]).toMatch(/^Anek Telugu/);

    // Edge case "slow network": the swap moves a button or a row by no more than one line.
    for (const [name, locator] of Object.entries(samples)) {
      const line = await locator.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
      const after = (await locator.boundingBox())!.height;
      expect(Math.abs(after - heights[name]), `${name} changed height by more than one line in the swap`).toBeLessThanOrEqual(line + 0.5);
    }
    const rowAfter = await page.getByTestId("section-row").locator("li").first().boundingBox();
    expect(Math.abs(rowAfter!.height - rowBefore!.height)).toBeLessThanOrEqual(24);
  });
});

test.describe("criterion 13: Hindi, Kannada and Telugu settings", () => {
  for (const lang of indicLangs) {
    test(`${lang}: Anek face, no letter-spacing, no capitals, and the documented weights and sizes`, async ({ page }) => {
      await openDevPage(page);
      const anek = await familyOf(page, scriptFontVariable[lang]);
      expect(anek).toMatch(ANEK);
      const block = page.getByTestId("section-type").locator(`[lang="${lang}"]`);
      const probe = await fontProbe(page);

      // The sample really is in this script, and its own Anek file drew it.
      const headline = block.locator('[data-role="headline"]');
      await expect(headline).toHaveText(scriptPattern[lang]);
      for (const role of ["headline", "body-lg", "body", "body-sm", "caption", "label", "control", "control-sm", "name"]) {
        const el = block.locator(`[data-role="${role}"]`);
        expect(await firstFamily(el), role).toBe(anek);
        const faces = await probe.facesFor(el);
        expect(faces.length, role).toBeGreaterThan(0);
        for (const face of faces) expect(face.family, `${role} was drawn by ${face.family}`).toMatch(new RegExp(`^${anek}`));
      }

      // Headlines: weight 700, line-height at least 1.25.
      const h = await headline.evaluate((el) => {
        const s = getComputedStyle(el);
        return { weight: s.fontWeight, size: parseFloat(s.fontSize), leading: parseFloat(s.lineHeight) };
      });
      expect(h.weight).toBe("700");
      expect(h.leading / h.size).toBeGreaterThanOrEqual(1.25);

      // Reading text: 17px at 1.6.
      const body = await block.locator('[data-role="body"]').evaluate((el) => {
        const s = getComputedStyle(el);
        return { size: s.fontSize, leading: parseFloat(s.lineHeight) };
      });
      expect(body.size).toBe("17px");
      expect(body.leading).toBeCloseTo(17 * 1.6, 1);

      // Small labels: Anek 600 at 15px.
      const label = await block.locator('[data-role="label"]').evaluate((el) => {
        const s = getComputedStyle(el);
        return { size: s.fontSize, weight: s.fontWeight, transform: s.textTransform, tracking: s.letterSpacing };
      });
      expect(label).toEqual({ size: "15px", weight: "600", transform: "none", tracking: "normal" });
    });

    test(`${lang}: everywhere on the page, text in this language has no letter-spacing, no capitals and the Anek face`, async ({ page }) => {
      await openDevPage(page);
      const anek = await familyOf(page, scriptFontVariable[lang]);
      const wrong = await page.evaluate(
        ([code, face]) => {
          const out: string[] = [];
          let seen = 0;
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const el = node.parentElement;
            if (!el || (node.textContent ?? "").trim() === "") continue;
            if (el.closest("script, style, noscript")) continue;
            if (el.closest("[lang]")?.getAttribute("lang") !== code) continue;
            // Amounts keep their own face and tracking in every language (criteria 14 and 40).
            if (el.closest('[translate="no"]')) continue;
            seen++;
            const s = getComputedStyle(el);
            const first = s.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
            const text = (node.textContent ?? "").trim().slice(0, 30);
            if (s.letterSpacing !== "normal" && s.letterSpacing !== "0px") out.push(`letter-spacing ${s.letterSpacing}: ${text}`);
            if (s.textTransform !== "none") out.push(`text-transform ${s.textTransform}: ${text}`);
            if (first !== face) out.push(`font ${first}: ${text}`);
          }
          // Values typed into fields are text too.
          let controls = 0;
          for (const input of document.querySelectorAll("input, textarea")) {
            if (input.closest("[lang]")?.getAttribute("lang") !== code) continue;
            seen++;
            controls++;
            const s = getComputedStyle(input);
            const first = s.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, "");
            if (s.letterSpacing !== "normal" && s.letterSpacing !== "0px") out.push(`input letter-spacing ${s.letterSpacing}`);
            if (s.textTransform !== "none") out.push(`input text-transform ${s.textTransform}`);
            if (first !== face) out.push(`input font ${first}`);
          }
          if (controls < 3) out.push(`only ${controls} form controls found in ${code}`);
          if (seen < 40) out.push(`only ${seen} pieces of text found in ${code}`);
          return out;
        },
        [lang, anek] as const,
      );
      expect(wrong).toEqual([]);
    });

    test(`${lang}: every small label on the page is Anek 600 at 15px`, async ({ page }) => {
      await openDevPage(page);
      const anek = await familyOf(page, scriptFontVariable[lang]);
      const labels = await page.evaluate((code) => {
        return [...document.querySelectorAll(".type-label")]
          .filter((el) => el.closest("[lang]")?.getAttribute("lang") === code)
          .map((el) => {
            const s = getComputedStyle(el);
            return [s.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, ""), s.fontWeight, s.fontSize, s.textTransform].join(" | ");
          });
      }, lang);
      expect(labels.length).toBeGreaterThan(10);
      expect([...new Set(labels)]).toEqual([`${anek} | 600 | 15px | none`]);
    });
  }

  test("English keeps its own settings beside them: Bricolage 800 headlines, DM Mono capital labels", async ({ page }) => {
    await openDevPage(page);
    const block = page.getByTestId("section-type").locator('[lang="en"]');
    const bricolage = await familyOf(page, "--font-bricolage");
    const mono = await familyOf(page, "--font-dm-mono");
    const headline = await block.locator('[data-role="headline"]').evaluate((el) => {
      const s = getComputedStyle(el);
      return { weight: s.fontWeight, ratio: parseFloat(s.lineHeight) / parseFloat(s.fontSize), tracking: parseFloat(s.letterSpacing) / parseFloat(s.fontSize) };
    });
    expect(await firstFamily(block.locator('[data-role="headline"]'))).toBe(bricolage);
    expect(headline.weight).toBe("800");
    expect(headline.ratio).toBeGreaterThanOrEqual(0.9);
    expect(headline.ratio).toBeLessThanOrEqual(0.95);
    expect(headline.tracking).toBeCloseTo(-0.04, 3);

    const label = block.locator('[data-role="label"]');
    expect(await firstFamily(label)).toBe(mono);
    const l = await label.evaluate((el) => {
      const s = getComputedStyle(el);
      return { size: s.fontSize, weight: s.fontWeight, transform: s.textTransform, tracking: parseFloat(s.letterSpacing) };
    });
    expect(l.size).toBe("14px");
    expect(l.weight).toBe("500");
    expect(l.transform).toBe("uppercase");
    expect(l.tracking).toBeCloseTo(14 * 0.04, 2);

    // A caption in English nested inside a Hindi block resets to the English settings.
    const nested = page.getByTestId("section-type").locator('[lang="hi"] p[lang="en"]').first();
    expect(await firstFamily(nested)).toBe(mono);
    expect(await nested.evaluate((el) => getComputedStyle(el).textTransform)).toBe("uppercase");
  });
});

test("criterion 15, as rendered: every font stack ends in 'Anek Latin', system-ui and a generic family", async ({ page }) => {
  await openDevPage(page);
  const type = page.getByTestId("section-type");
  const stacks = {
    headline: type.locator('[lang="en"] [data-role="headline"]'),
    reading: type.locator('[lang="en"] [data-role="body"]'),
    label: type.locator('[lang="en"] [data-role="label"]'),
    rowAmount: type.locator('[lang="en"] [data-role="amount-row"]'),
    hindi: type.locator('[lang="hi"] [data-role="body"]'),
    kannada: type.locator('[lang="kn"] [data-role="body"]'),
    telugu: type.locator('[lang="te"] [data-role="body"]'),
  };
  for (const [name, locator] of Object.entries(stacks)) {
    const stack = await locator.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(stack, name).toMatch(/"Anek Latin", system-ui, (sans-serif|monospace)$/);
  }
  // DM Mono has no rupee sign: Bricolage Grotesque comes straight after it in the label and row stacks.
  for (const name of ["label", "rowAmount"] as const) {
    const stack = await stacks[name].evaluate((el) => getComputedStyle(el).fontFamily);
    expect(stack.split(",").slice(0, 2).map((f) => f.trim().replace(/"/g, ""))).toEqual(["DM Mono", "Bricolage Grotesque"]);
  }
  // No generated Arial-based fallback face sits between a script's face and Bricolage.
  const faces = await page.evaluate(() => [...new Set([...document.fonts].map((f) => f.family.replace(/^["']|["']$/g, "")))].filter((f) => f.endsWith("Fallback")));
  expect(faces).toEqual(["Bricolage Grotesque Fallback"]);
});

test.describe("criteria 14, 40, 60 and 16 (automatic part): amounts, digits and the rupee sign", () => {
  const AMOUNT = /^₹[0-9,]+$/;

  for (const lang of indicLangs) {
    test(`14: inside ${lang} text a headline amount keeps Bricolage, -0.04em and digits 0-9`, async ({ page }) => {
      await openDevPage(page);
      const bricolage = await familyOf(page, "--font-bricolage");
      const probe = await fontProbe(page);
      const amounts = [
        page.getByTestId("section-type").locator(`[lang="${lang}"] [data-role="amount"]`),
        page.getByTestId("section-rupee").locator(`[lang="${lang}"] [data-rupee="headline"]`),
        page.getByTestId("section-rupee").locator(`[lang="${lang}"] [data-rupee="reading"]`),
      ];
      for (const amount of amounts) {
        await expect(amount).toHaveCount(1);
        const text = (await amount.textContent()) ?? "";
        expect(text).toMatch(AMOUNT);
        // It really does sit inside this language's block.
        expect(await amount.evaluate((el) => el.closest("[lang]")?.getAttribute("lang"))).toBe(lang);
        expect(await firstFamily(amount)).toBe(bricolage);
        const s = await amount.evaluate((el) => {
          const c = getComputedStyle(el);
          return { weight: c.fontWeight, tracking: parseFloat(c.letterSpacing) / parseFloat(c.fontSize) };
        });
        expect(s.weight).toBe("800");
        expect(s.tracking).toBeCloseTo(-0.04, 3);
        // Sign and digits were all drawn by Bricolage Grotesque: one face, every glyph.
        const faces = await probe.facesFor(amount);
        expect(faces.map((f) => f.family.replace(/ \d+pt.*$/, ""))).toEqual(["Bricolage Grotesque"]);
        expect(faces[0].glyphs).toBe(text.length);
        expect(faces[0].custom).toBe(true);
      }
    });
  }

  test("40: a row amount is DM Mono digits with the sign from Bricolage, in all four languages", async ({ page }) => {
    await openDevPage(page);
    const mono = await familyOf(page, "--font-dm-mono");
    const probe = await fontProbe(page);
    for (const lang of ["en", ...indicLangs]) {
      const rowAmounts = page.getByTestId("section-row").locator(`[lang="${lang}"] li [translate="no"]`);
      const tabAmounts = page.getByTestId("section-tabs").locator(`[lang="${lang}"] li [translate="no"]`);
      expect(await rowAmounts.count(), lang).toBeGreaterThanOrEqual(4);
      expect(await tabAmounts.count(), lang).toBe(2);
      const all = [...(await rowAmounts.all()), ...(await tabAmounts.all())];
      for (const amount of all) {
        const text = (await amount.textContent()) ?? "";
        expect(text, lang).toMatch(AMOUNT);
        expect(await firstFamily(amount), lang).toBe(mono);
        const s = await amount.evaluate((el) => {
          const c = getComputedStyle(el);
          // Chromium reports a letter-spacing of zero as "normal".
          return { tracking: c.letterSpacing === "normal" ? "0px" : c.letterSpacing, transform: c.textTransform, weight: c.fontWeight, size: c.fontSize };
        });
        expect(s, lang).toEqual({ tracking: "0px", transform: "none", weight: "500", size: "16px" });
        // Which face drew what: DM Mono drew every digit and comma, Bricolage drew the one sign.
        const faces = await probe.facesFor(amount);
        const byFamily = Object.fromEntries(faces.map((f) => [f.family.replace(/ (Medium|\d+pt.*)$/, ""), f.glyphs]));
        expect(byFamily, `${lang} ${text}`).toEqual({ "DM Mono": text.length - 1, "Bricolage Grotesque": 1 });
      }
    }
    // The sign set alone in the row stack is Bricolage and nothing else.
    const alone = await probe.facesFor(page.locator('[data-rupee="sign-alone"]'));
    expect(alone.map((f) => [f.family.replace(/ \d+pt.*$/, ""), f.glyphs])).toEqual([["Bricolage Grotesque", 1]]);
  });

  test("60: the sign with digits 0-9 is shown at headline, reading and row size, alone and inside each script", async ({ page }) => {
    await openDevPage(page);
    const probe = await fontProbe(page);
    const section = page.getByTestId("section-rupee");

    const sizes = { headline: [60, 80], reading: [15, 18], row: [16, 16] } as const;
    for (const [size, [min, max]] of Object.entries(sizes)) {
      // Alone: the English examples, outside any script block.
      const alone = page.getByTestId(`rupee-${size}`).locator(`[data-rupee="${size}"]`);
      expect(await alone.count(), size).toBeGreaterThanOrEqual(2);
      const digits = new Set((await alone.allTextContents()).join("").replace(/[^0-9]/g, ""));
      expect([...digits].sort().join(""), `all ten digits at ${size} size`).toBe("0123456789");
      for (const el of await alone.all()) {
        await expect(el).toBeVisible();
        await expect(el).toHaveText(/^₹[0-9,]+$/);
        const px = await el.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
        expect(px, size).toBeGreaterThanOrEqual(min);
        expect(px, size).toBeLessThanOrEqual(max);
      }
      // Inside each script.
      for (const lang of indicLangs) {
        const inside = section.locator(`[lang="${lang}"] [data-rupee="${size}"]`);
        await expect(inside, `${size} in ${lang}`).toHaveCount(1);
        await expect(inside).toBeVisible();
        await expect(inside).toHaveText(/^₹[0-9,]+$/);
      }
    }

    // Which face drew the sign at each size (the look is hand check H3).
    for (const size of ["headline", "reading"]) {
      for (const el of await section.locator(`[data-rupee="${size}"]`).all()) {
        const faces = await probe.facesFor(el);
        expect(faces.map((f) => f.family.replace(/ \d+pt.*$/, "")), size).toEqual(["Bricolage Grotesque"]);
      }
    }
    for (const el of await section.locator('[data-rupee="row"]').all()) {
      const text = (await el.textContent()) ?? "";
      const faces = await probe.facesFor(el);
      const byFamily = Object.fromEntries(faces.map((f) => [f.family.replace(/ (Medium|\d+pt.*)$/, ""), f.glyphs]));
      expect(byFamily, text).toEqual({ "DM Mono": text.length - 1, "Bricolage Grotesque": 1 });
    }
  });

  test("digits are 0-9 everywhere: no Devanagari, Kannada or Telugu digit is on the page", async ({ page }) => {
    await openDevPage(page);
    const text = await page.locator("main").innerText();
    expect(text.length).toBeGreaterThan(5000);
    expect(text.match(/[०-९೦-೯౦-౯]/g)).toBeNull();
  });
});
