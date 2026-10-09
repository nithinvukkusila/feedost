// Spec F3, the jump page on "/": criteria 10 to 18 (and 16's layout rules), at the phone viewport.
// "/" is a static page of four links plus one inline script that picks the language before paint.
import { expect, test, type Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { langs, sidewaysScroll, slow4G, type Lang } from "./helpers";

const KEY = "ui-language";
const endonym: Record<Lang, string> = { en: "English", hi: "हिन्दी", kn: "ಕನ್ನಡ", te: "తెలుగు" };

/** Opens "/#choose" (the jump does not run there), puts a value in storage, and leaves "/" unvisited. */
async function save(page: Page, value: string): Promise<void> {
  await page.goto("/#choose");
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, value]);
}
const saved = (page: Page) => page.evaluate((k) => localStorage.getItem(k), KEY);

/** Sets what the browser reports as its language list, before any script of the page runs. */
async function browserLanguages(page: Page, list: string[]): Promise<void> {
  await page.addInitScript((languages) => {
    Object.defineProperty(navigator, "languages", { get: () => languages, configurable: true });
    Object.defineProperty(navigator, "language", { get: () => languages[0] ?? "", configurable: true });
  }, list);
}

test.describe("criterion 12: the browser's language picks the page", () => {
  test.describe("Hindi browser", () => {
    test.use({ locale: "hi-IN" });
    test("12: / lands on /hi/ and the page reads in Hindi", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/hi\/$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "hi");
      await expect(page.locator("main p")).toHaveText(/\p{Script=Devanagari}/u);
      expect(await saved(page), "nothing was saved by the jump (criterion 18)").toBeNull();
    });

    test("15: Back from /hi/ does not return to /, and does not bounce forward again", async ({ page }) => {
      await page.goto("/en/");
      await page.goto("/");
      await expect(page).toHaveURL(/\/hi\/$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/en\/$/);
      await page.waitForTimeout(700);
      await expect(page).toHaveURL(/\/en\/$/);
      await page.goForward();
      await expect(page).toHaveURL(/\/hi\/$/);
    });

    test("12, 13: a saved kn beats the Hindi browser", async ({ page }) => {
      await save(page, "kn");
      await page.goto("/");
      await expect(page).toHaveURL(/\/kn\/$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "kn");
      expect(await saved(page)).toBe("kn");
    });

    test("14: a saved value that is not one of the four codes is ignored", async ({ page }) => {
      for (const junk of ["fr", "KN", "", "kn ", "undefined", "{\"a\":1}"]) {
        await save(page, junk);
        await page.goto("/");
        await expect(page, `saved ${JSON.stringify(junk)}`).toHaveURL(/\/hi\/$/);
      }
    });

    test("14: blocked storage (every read and write throws) still jumps by browser language, with no error", async ({ page }) => {
      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(e.message));
      page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
      await page.addInitScript(() => {
        for (const name of ["getItem", "setItem", "removeItem"] as const) {
          Storage.prototype[name] = () => {
            throw new DOMException("blocked", "SecurityError");
          };
        }
      });
      await page.goto("/");
      await expect(page).toHaveURL(/\/hi\/$/);
      expect(problems).toEqual([]);
      // On the chooser, a click on a link with blocked storage still navigates.
      await page.goto("/#choose");
      await page.locator('a[data-locale="te"]').tap();
      await expect(page).toHaveURL(/\/te\/$/);
      expect(problems).toEqual([]);
    });

    test("14: the choice is in localStorage and not in a cookie", async ({ page, context }) => {
      await page.goto("/#choose");
      await page.locator('a[data-locale="kn"]').tap();
      await expect(page).toHaveURL(/\/kn\/$/);
      expect(await saved(page)).toBe("kn");
      expect(await context.cookies()).toEqual([]);
      expect(await page.evaluate(() => document.cookie)).toBe("");
    });
  });

  test.describe("Tamil browser", () => {
    test.use({ locale: "ta-IN" });
    test("12: only Tamil is not supported, so / lands on /en/", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/en\/$/);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
    });
  });
});

test.describe("criterion 10 and 11 in a real browser: the order of choice", () => {
  const cases: [string[], Lang][] = [
    [["hi-IN", "en-US"], "hi"],
    [["ta-IN", "kn"], "kn"],
    [["TE"], "te"],
    [["en-GB"], "en"],
    [["ta-IN", "ml"], "en"],
    [[], "en"],
  ];
  for (const [list, want] of cases) {
    test(`10, 11: ${JSON.stringify(list)} lands on /${want}/`, async ({ page }) => {
      await browserLanguages(page, list);
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`/${want}/$`));
    });
  }

  test("10: saved choice, then browser language, then English", async ({ page }) => {
    await save(page, "te");
    await browserLanguages(page, ["hi-IN"]);
    await page.goto("/");
    await expect(page).toHaveURL(/\/te\/$/);
  });

  test("10, 15: the jump is a replace on slow 4G too, and the Back entry is still the page before", async ({ page }) => {
    test.slow();
    await slow4G(page);
    await browserLanguages(page, ["kn-IN"]);
    await page.goto("/en/");
    await page.goto("/", { waitUntil: "commit" });
    await expect(page).toHaveURL(/\/kn\/$/, { timeout: 20_000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/en\/$/);
  });

  test("offline then back online: / cannot load offline, then jumps once the network returns", async ({ page, context }) => {
    await browserLanguages(page, ["hi-IN"]);
    await page.goto("/en/");
    await context.setOffline(true);
    await expect(page.goto("/")).rejects.toThrow(/net::/);
    await context.setOffline(false);
    await page.goto("/");
    await expect(page).toHaveURL(/\/hi\/$/);
  });
});

test.describe("criterion 16: with JavaScript off, / shows four plain links", () => {
  test.use({ javaScriptEnabled: false });

  test("four real <a href> links, each labelled in its own language, at least 44px high, no sideways scroll", async ({ page }) => {
    await page.goto("/");
    await expect(page, "no script, so no jump").toHaveURL(/\/$/);
    const links = page.locator("main a");
    await expect(links).toHaveCount(4);
    await expect(page.locator("a[href]")).toHaveCount(4);
    for (const [i, lang] of langs.entries()) {
      const link = links.nth(i);
      await expect(link).toHaveText(endonym[lang]);
      await expect(link).toHaveAttribute("href", `/${lang}/`);
      await expect(link).toHaveAttribute("lang", lang);
      const box = (await link.boundingBox())!;
      expect(box.height, `${lang} link height`).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    }
    expect(await sidewaysScroll(page)).toBe(0);
    // The page says nothing but the four names (they are the one exception to translated strings).
    expect((await page.locator("body").innerText()).split("\n").map((l) => l.trim()).filter(Boolean)).toEqual(langs.map((l) => endonym[l]));
  });

  test("16: each link works as a plain link", async ({ page }) => {
    for (const lang of langs) {
      await page.goto("/");
      await page.locator("main a").nth(langs.indexOf(lang)).tap();
      await expect(page).toHaveURL(new RegExp(`/${lang}/$`));
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
    }
  });
});

test.describe("criteria 16, 17: the links on / carry their language", () => {
  test("16: with the text size at 200% (kept on screen by #choose) the links stay at least 44px, inside 360px, no sideways scroll", async ({ page }) => {
    await page.goto("/#choose");
    await page.addStyleTag({ content: "html{font-size:200%}" });
    expect(await sidewaysScroll(page)).toBe(0);
    for (const link of await page.locator("main a").all()) {
      const box = (await link.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(360);
    }
  });
  test("hreflang and data-locale on each of the four links, in the delivered HTML", async ({ request }) => {
    const html = await (await request.get("/")).text();
    for (const lang of langs) {
      const a = new RegExp(`<a [^>]*href="/${lang}/"[^>]*>`).exec(html)?.[0] ?? "";
      expect(a, `link for ${lang}`).not.toBe("");
      expect(a).toMatch(new RegExp(`hreflang="${lang}"`, "i")); // HTML attribute names are case-insensitive
      expect(a).toContain(`data-locale="${lang}"`);
      expect(a).toContain(`lang="${lang}"`);
    }
  });
  test("the page title is the product name", async ({ page }) => {
    await page.goto("/#choose");
    await expect(page).toHaveTitle(brand.name);
  });
});

test.describe("criteria 17, 18: only a deliberate pick saves a language", () => {
  test("17: /#choose keeps the page and the four links on screen", async ({ page }) => {
    await page.goto("/#choose");
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/#choose$/);
    await expect(page.locator("main a")).toHaveCount(4);
    expect(await saved(page)).toBeNull();
  });

  for (const lang of langs) {
    test(`17: tapping ${endonym[lang]} on /#choose saves ${lang} and opens /${lang}/`, async ({ page }) => {
      await page.goto("/#choose");
      await page.getByRole("link", { name: endonym[lang] }).tap();
      await expect(page).toHaveURL(new RegExp(`/${lang}/$`));
      expect(await saved(page)).toBe(lang);
      // Next visit to "/" now ignores the browser's language.
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`/${lang}/$`));
    });
  }

  test("17: a mouse click saves too, and a later pick replaces an earlier one", async ({ page }) => {
    await page.goto("/#choose");
    await page.locator('a[data-locale="kn"]').click();
    expect(await saved(page)).toBe("kn");
    await page.goto("/#choose");
    await page.locator('a[data-locale="te"]').click();
    await expect(page).toHaveURL(/\/te\/$/);
    expect(await saved(page)).toBe("te");
  });

  test.describe("a Hindi browser", () => {
    test.use({ locale: "hi-IN" });
    test("18: opening /hi/, /kn/ and /te/ directly leaves the saved choice alone", async ({ page }) => {
      await save(page, "kn");
      for (const lang of ["hi", "te", "en"]) {
        await page.goto(`/${lang}/`);
        expect(await saved(page), `after opening /${lang}/`).toBe("kn");
      }
    });

    test("18: opening /hi/ with nothing saved saves nothing", async ({ page }) => {
      await page.goto("/hi/");
      await expect(page.locator("main p")).toBeVisible();
      expect(await saved(page)).toBeNull();
      expect(await page.evaluate(() => localStorage.length)).toBe(0);
      await page.goto("/kn/");
      expect(await page.evaluate(() => localStorage.length)).toBe(0);
    });

    test("18: the jump itself saves nothing", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/hi\/$/);
      expect(await page.evaluate(() => localStorage.length)).toBe(0);
    });
  });
});

test.describe("the key flow in each language (slow 4G): arrive from a browser in that language, read the page, switch on purpose", () => {
  for (const lang of langs) {
    test.describe(lang, () => {
      test.use({ locale: lang === "en" ? "en-GB" : `${lang}-IN` });
      test(`/ -> /${lang}/ -> change language from /#choose`, async ({ page }) => {
        test.slow();
        await slow4G(page);
        await page.goto("/");
        await expect(page).toHaveURL(new RegExp(`/${lang}/$`), { timeout: 20_000 });
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(brand.name);
        const other = langs.find((l) => l !== lang)!;
        await page.goto("/#choose");
        await page.getByRole("link", { name: endonym[other] }).tap();
        await expect(page).toHaveURL(new RegExp(`/${other}/$`), { timeout: 20_000 });
        expect(await saved(page)).toBe(other);
      });
    });
  }
});
