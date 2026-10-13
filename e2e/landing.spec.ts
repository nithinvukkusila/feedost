// Spec R0-1, the landing page: criteria 1 to 5, 7, 9 to 12, 14 to 21, 23 to 27, 32 and 33 (the rest are unit
// tests or CI scripts, named in the spec). Runs against the static export in out/ at the 360px phone project.
// Every test name starts with its criterion number. The page has no database, so there is no second tutor,
// no money in the database and no offline flow here; those edge cases are not applicable to this slice.
import { expect, test, type Page } from "@playwright/test";
import { brand } from "../src/config/brand";
import { localeNames } from "../src/config/locales";
import {
  css,
  docBox,
  familyOf,
  firstFamily,
  fontProbe,
  fontsSettled,
  indicLangs,
  langs,
  recordRequests,
  scriptFontVariable,
  scriptPattern,
  shadow,
  sidewaysScroll,
  slow4G,
  textProblems,
  type IndicLang,
  type Lang,
} from "./helpers";
import { builtFileFor, flaggedPaths, headTags, htmlLang, largestText, pageWords, shown, smallTargets, smallText, titles } from "./landing-helpers";

const path = (lang: Lang) => `/${lang}/`;
const ogLocales: Record<Lang, string> = { en: "en_IN", hi: "hi_IN", kn: "kn_IN", te: "te_IN" };

async function openLanding(page: Page, lang: Lang): Promise<void> {
  await page.goto(path(lang));
  await fontsSettled(page);
}

// The wordmark in the footer is clipped on purpose (it is aria-hidden and sits in overflow-hidden).
const notWordmark = (p: { text: string; where: string }) => !(p.text === brand.name && p.where.includes("footer"));

for (const lang of langs) {
  test.describe(`landing /${lang}/`, () => {
    test(`criterion 1 [${lang}]: one header, one main, one footer, one h1, four h2 in page order`, async ({ page }) => {
      await openLanding(page, lang);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("header")).toHaveCount(1);
      await expect(page.locator("main")).toHaveCount(1);
      await expect(page.locator("footer")).toHaveCount(1);
      await expect(page.locator("main header, main footer")).toHaveCount(0);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("main h1")).toHaveCount(1);
      await expect(page.locator("h2")).toHaveCount(4);
      const h2 = page.locator("main h2");
      await expect(h2).toHaveCount(4);
      expect((await h2.allTextContents()).map((t) => t.replace(/\s+/g, " ").trim())).toEqual([
        `${shown(lang, "landing.steps.title")} ${shown(lang, "landing.steps.accent")}`,
        shown(lang, "landing.tools.title"),
        shown(lang, "landing.promises.title"),
        shown(lang, "landing.waitlist.title"),
      ]);
      await expect(page.locator("h1")).toHaveText(shown(lang, "landing.hero.title"));
      // Seven blocks, top to bottom: header, hero (h1 and card), ribbon, steps, tools, promises, waitlist, footer.
      const order = [
        page.locator("header"),
        page.locator("h1"),
        page.locator('[role="group"]'),
        page.locator('main > div[aria-hidden="true"]'),
        h2.nth(0),
        h2.nth(1),
        h2.nth(2),
        h2.nth(3),
        page.locator("footer"),
      ];
      const tops: number[] = [];
      for (const locator of order) {
        await expect(locator).toHaveCount(1);
        tops.push((await docBox(locator)).y);
      }
      expect(tops).toEqual([...tops].sort((a, b) => a - b));
      expect(new Set(tops).size).toBe(tops.length);
    });

    test(`criterion 3 [${lang}]: three steps; digits 1 and 2 in the headline face, never Anek; the third is a stamp with the word for paid`, async ({ page }) => {
      await openLanding(page, lang);
      const steps = page.locator('section[aria-labelledby="steps-title"] ol > li');
      await expect(steps).toHaveCount(3);
      for (const [i, digit] of ["1", "2"].entries()) {
        const number = steps.nth(i).locator('span[translate="no"]');
        await expect(number).toHaveText(digit);
        expect(await firstFamily(number)).not.toMatch(/^Anek/);
        expect(await firstFamily(number)).toMatch(/Bricolage/);
      }
      const stamp = steps.nth(2).locator('[role="img"]');
      await expect(stamp).toHaveCount(1);
      await expect(stamp).toHaveAttribute("aria-label", shown(lang, "landing.steps.stamp"));
      await expect(stamp).toHaveText(shown(lang, "landing.steps.stamp"));
      // Each step has a title and a body, in the language.
      for (const [i, n] of ["s1", "s2", "s3"].entries()) {
        await expect(steps.nth(i).locator("h3")).toHaveText(shown(lang, `landing.steps.${n}.title`));
        await expect(steps.nth(i).locator("p")).toHaveText(shown(lang, `landing.steps.${n}.body`));
      }
    });

    test(`criterion 4 [${lang}]: four promises numbered 01 to 04 in DM Mono, each with a title and a body`, async ({ page }) => {
      await openLanding(page, lang);
      const items = page.locator('section[aria-labelledby="promises-title"] ol > li');
      await expect(items).toHaveCount(4);
      for (const [i, key] of ["p1", "p2", "p3", "p4"].entries()) {
        const number = items.nth(i).locator('span[translate="no"]');
        await expect(number).toHaveText(`0${i + 1}`);
        expect(await firstFamily(number)).toMatch(/^DM Mono/);
        await expect(items.nth(i).locator("h3")).toHaveText(shown(lang, `landing.promises.${key}.title`));
        await expect(items.nth(i).locator("p")).toHaveText(shown(lang, `landing.promises.${key}.body`));
      }
    });

    test(`criterion 5 [${lang}]: the ledger card is labelled Example and shows exactly ₹18,500 and ₹1,200 in 0-9 digits`, async ({ page }) => {
      await openLanding(page, lang);
      const card = page.locator('[role="group"]');
      await expect(card).toHaveCount(1);
      await expect(card).toHaveAttribute("aria-label", shown(lang, "landing.example.label"));
      await expect(card.getByText(shown(lang, "landing.example.label"), { exact: true })).toBeVisible();
      await expect(card.getByText("₹18,500", { exact: true })).toHaveCount(1);
      await expect(card.getByText("₹1,200", { exact: true })).toHaveCount(2);
      // Every rupee amount in the card, nothing else.
      const amounts = (await card.innerText()).match(/₹[\p{N},]+/gu) ?? [];
      expect(amounts.sort()).toEqual(["₹1,200", "₹1,200", "₹18,500"]);
      expect(amounts.join("")).toMatch(/^[₹0-9,]+$/);
      // No month, no year, no date: the canvas's "October 2026" and "06 OCT" are not copied.
      expect(await card.innerText()).not.toMatch(/\b(19|20)\d\d\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i);
      // Names are in the page's own script, or in English where the value is flagged for translation.
      if (lang !== "en") {
        for (const key of ["student1", "student2"]) {
          const name = shown(lang, `landing.example.${key}`);
          await expect(card.getByText(name, { exact: true })).toBeVisible();
          expect(name).toMatch(scriptPattern[lang as IndicLang]);
        }
      }
      // The example amounts are in a numeric face, never Anek.
      expect(await firstFamily(card.getByText("₹18,500", { exact: true }))).not.toMatch(/^Anek/);
      expect(await firstFamily(card.getByText("₹1,200", { exact: true }).first())).not.toMatch(/^Anek/);
    });

    test(`criterion 7 [${lang}]: no TODO-translate marker anywhere in the page, and every flagged value shows its English text`, async ({ page, request }) => {
      await openLanding(page, lang);
      expect(await pageWords(page)).not.toContain("TODO-translate");
      const raw = await (await request.get(path(lang))).text();
      expect(raw).not.toContain("TODO-translate");
      const words = await pageWords(page);
      const head = { "landing.meta.title": titles(raw)[0], "landing.meta.description": headTags(raw).find((t) => t.attrs.name === "description")?.attrs.content };
      const flagged = flaggedPaths(lang, "landing");
      if (lang === "en") expect(flagged).toEqual([]);
      else expect(flagged.length).toBeGreaterThan(0);
      for (const key of flagged) {
        const english = shown(lang, key).replace(/\s+/g, " ");
        // A flagged value is English text, not an Indian script (that is what makes the marker safe to hide).
        expect(english, key).not.toMatch(/\p{Script=Devanagari}|\p{Script=Kannada}|\p{Script=Telugu}/u);
        if (key in head) expect(head[key as keyof typeof head], key).toBe(english);
        else expect(words, `${key} shows as English text`).toContain(english);
      }
    });

    test(`criterion 9 [${lang}]: no image element and no image request`, async ({ page }) => {
      const urls = recordRequests(page);
      await openLanding(page, lang);
      await expect(page.locator("img, picture, video, canvas, object, embed, iframe")).toHaveCount(0);
      expect(urls.filter((u) => /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(u))).toEqual([]);
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundImage.includes("url(") || [...document.querySelectorAll("*")].some((e) => getComputedStyle(e).backgroundImage.includes("url(")))).toBe(false);
    });

    test(`criterion 10 [${lang}]: every a[href] is #waitlist, a language page, the reminder writer (R0-2) or sign-in, and resolves`, async ({ page }) => {
      await openLanding(page, lang);
      await expect(page.locator("a:not([href])")).toHaveCount(0);
      const hrefs = await page.locator("a").evaluateAll((els) => els.map((a) => a.getAttribute("href") ?? ""));
      expect(hrefs.length).toBeGreaterThanOrEqual(7);
      expect([...new Set(hrefs)].sort()).toEqual(["#waitlist", "/en/", "/hi/", "/kn/", "/te/", `/${lang}/tools/fee-reminder/`, `/${lang}/sign-in/`].filter((h) => h !== path(lang)).sort());
      for (const href of hrefs) {
        if (href.startsWith("#")) {
          expect(href).not.toBe("#");
          await expect(page.locator(`[id="${href.slice(1)}"]`), href).toHaveCount(1);
        } else {
          expect(builtFileFor(href), `${href} is a built file in out/`).toBe(true);
        }
      }
    });

    test(`sign-in [${lang}]: the header and the footer each carry a Sign in link of 44px or more that goes to this language's sign-in screen`, async ({ page }) => {
      await openLanding(page, lang);
      for (const place of ["header", "footer"]) {
        const link = page.locator(`${place} a[href='/${lang}/sign-in/']`);
        await expect(link).toHaveCount(1);
        await expect(link).toHaveText(shown(lang, `landing.${place}.signIn`));
        const box = await link.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        await link.focus();
        await expect(link).toBeFocused();
      }
      const width = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(width[0]).toBeLessThanOrEqual(width[1]);
    });

    test(`criterion 11 [${lang}]: header and hero buttons go to #waitlist; header 44px or more, hero 56px or more and full width`, async ({ page }) => {
      await openLanding(page, lang);
      const header = page.locator("header a[href='#waitlist']");
      // The hero's first link is the button; R0-2 added a text link to the reminder writer under it.
      const hero = page.locator("main section").first().locator("a").first();
      await expect(header).toHaveCount(1);
      await expect(page.locator("main section").first().locator("a")).toHaveCount(2);
      await expect(header).toHaveAttribute("href", "#waitlist");
      await expect(hero).toHaveAttribute("href", "#waitlist");
      await expect(header).toHaveText(shown(lang, "landing.header.join"));
      await expect(hero).toHaveText(shown(lang, "landing.hero.join"));
      const h = await header.boundingBox();
      const b = await hero.boundingBox();
      expect(h!.height).toBeGreaterThanOrEqual(44);
      expect(b!.height).toBeGreaterThanOrEqual(56);
      // Full width: as wide as the room its container leaves (the container reserves a few pixels for the button's shadow).
      const room = await hero.evaluate((a) => {
        const parent = a.parentElement as HTMLElement;
        const s = getComputedStyle(parent);
        return parent.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      });
      expect(Math.abs(b!.width - room)).toBeLessThanOrEqual(1);
      expect(b!.width).toBeGreaterThanOrEqual(360 * 0.8);
    });

    test(`criterion 12 [${lang}]: the waitlist block is the live form (R0-4): heading, body, one form, one black button, no leftover placeholder`, async ({ page }) => {
      await openLanding(page, lang);
      const section = page.locator("section#waitlist");
      await expect(section).toHaveCount(1);
      await expect(section.locator("h2")).toHaveText(shown(lang, "landing.waitlist.title"));
      await expect(section.getByText(shown(lang, "landing.waitlist.body"), { exact: true })).toBeVisible();
      await expect(section.locator("form")).toHaveCount(1);
      const button = section.locator("form button[type=submit]");
      await expect(button).toHaveCount(1);
      await expect(button).toHaveText(shown(lang, "waitlistForm.submit"));
      await expect(button).toBeEnabled();
      // The old placeholder is gone: no disabled button, no "opens soon" line, no dashed outline.
      await expect(section.locator("button[disabled]")).toHaveCount(0);
      const style = await css(button, ["border-top-style"]);
      expect(style["border-top-style"]).toBe("solid");
      expect(await shadow(button)).not.toBe("none");
      const words = await pageWords(page);
      expect(words).not.toContain("TODO-translate");
    });

    test(`criterion 14 [${lang}]: the one waitlist form is there; from load to scroll-end no request to another origin, none but GET, nothing stored`, async ({ page, baseURL, context }) => {
      const requests: { url: string; method: string }[] = [];
      page.on("request", (r) => requests.push({ url: r.url(), method: r.method() }));
      await openLanding(page, lang);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForLoadState("networkidle");
      // R0-4: exactly one form (the waitlist), and it sends nothing until someone submits.
      await expect(page.locator("form")).toHaveCount(1);
      await expect(page.locator("section#waitlist form")).toHaveCount(1);
      const origin = new URL(baseURL!).origin;
      expect(requests.length).toBeGreaterThan(0);
      expect(requests.filter((r) => new URL(r.url).origin !== origin)).toEqual([]);
      expect(requests.filter((r) => r.method !== "GET")).toEqual([]);
      expect(await context.cookies()).toEqual([]);
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    });

    test(`criterion 15 [${lang}]: two tool cards with number, title and body; card 1 has the Coming soon mark and is not a link; card 2 has one link to the reminder writer (R0-2, criterion 3)`, async ({ page }) => {
      await openLanding(page, lang);
      const section = page.locator("section#tools");
      const cards = section.locator("article");
      await expect(cards).toHaveCount(2);
      for (const [i, tool] of ["t1", "t2"].entries()) {
        const card = cards.nth(i);
        await expect(card.getByText(shown(lang, `landing.tools.${tool}.no`), { exact: true })).toBeVisible();
        await expect(card.locator("h3")).toHaveText(shown(lang, `landing.tools.${tool}.title`));
        await expect(card.getByText(shown(lang, `landing.tools.${tool}.body`), { exact: true })).toBeVisible();
      }
      // Card 1, the receipt maker: unchanged. The mark is a word with a dashed outline, not colour alone.
      await expect(cards.nth(0).locator("a, [role='link'], button, [onclick], [tabindex]")).toHaveCount(0);
      const mark = cards.nth(0).getByText(shown(lang, "landing.tools.tag"), { exact: true });
      await expect(mark).toBeVisible();
      expect((await css(mark, ["border-top-style"]))["border-top-style"]).toBe("dashed");
      // Card 2, the reminder writer: no mark, exactly one link, to the tool in this language, 44px high or more.
      await expect(cards.nth(1).getByText(shown(lang, "landing.tools.tag"), { exact: true })).toHaveCount(0);
      await expect(section.locator("a, [role='link'], button")).toHaveCount(1);
      const link = cards.nth(1).locator("a");
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute("href", `/${lang}/tools/fee-reminder/`);
      await expect(link).toHaveText(shown(lang, "landing.tools.t2.open"));
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(builtFileFor(`/${lang}/tools/fee-reminder/`)).toBe(true);
    });

    test(`criterion 16 [${lang}]: exactly two links to the reminder writer (hero and card 2, R0-2 criteria 3 and 5), none to a receipt maker, none in the header`, async ({ page }) => {
      await openLanding(page, lang);
      await expect(page.locator('a[href*="tools"]')).toHaveCount(2);
      await expect(page.locator(`a[href="/${lang}/tools/fee-reminder/"]`)).toHaveCount(2);
      await expect(page.locator('a[href*="receipt"]')).toHaveCount(0);
      await expect(page.locator('a[href="#waitlist"]')).toHaveCount(2);
      await expect(page.locator("main a")).toHaveCount(3);
      await expect(page.locator("header a")).toHaveCount(2); // Sign in and Join waitlist
      await expect(page.locator('header a[href*="tools"]')).toHaveCount(0);
      // The hero's second link, at least 44px high.
      const heroTool = page.locator("main section").first().locator("a").nth(1);
      await expect(heroTool).toHaveAttribute("href", `/${lang}/tools/fee-reminder/`);
      await expect(heroTool).toHaveText(shown(lang, "landing.hero.tool"));
      expect((await heroTool.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      // The receipt maker's title is still not the name of any link.
      const names = (await page.locator("a").allTextContents()).join(" | ");
      expect(names).not.toContain(shown(lang, "landing.tools.t1.title"));
    });

    test(`criterion 17 [${lang}]: no price, no Pro plan; the only rupee amounts are the two example ones; the kicker says free once`, async ({ page }) => {
      await openLanding(page, lang);
      const text = await page.evaluate(() => document.body.innerText);
      const rupees = text.match(/₹\s?[\p{N},.]+/gu) ?? [];
      expect([...new Set(rupees)].sort()).toEqual(["₹1,200", "₹18,500"]);
      expect(text).not.toMatch(/149|999|\bPro\b|\bpricing\b|\bpremium\b|per month|\/month/i);
      const raw = await page.content();
      expect(raw).not.toMatch(/₹\s?149|₹\s?999/);
      if (lang === "en") expect((shown("en", "landing.hero.kicker").match(/\bfree\b/gi) ?? []).length).toBe(1);
    });

    test(`criterion 19 [${lang}]: no sideways scroll at 360px`, async ({ page }) => {
      await openLanding(page, lang);
      expect(await page.evaluate(() => window.innerWidth)).toBe(360);
      expect(await sidewaysScroll(page)).toBe(0);
      expect(await page.evaluate(() => document.body.scrollWidth - document.body.clientWidth)).toBe(0);
    });

    test(`criterion 20 [${lang}]: at 200% root font size there is no sideways scroll, no clipped or overlapping text, nothing under 14px`, async ({ page }) => {
      await openLanding(page, lang);
      await largestText(page);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("32px");
      expect(await sidewaysScroll(page)).toBe(0);
      // Walked block by block, so one broken block names itself and does not hide the others.
      for (const scope of [
        "header",
        "main > section:first-of-type > div:first-child",
        'main > div[aria-hidden="true"]',
        'section[aria-labelledby="steps-title"]',
        "section#tools",
        'section[aria-labelledby="promises-title"]',
        "section#waitlist",
        "footer",
      ]) {
        expect.soft((await textProblems(page, scope)).filter(notWordmark), scope).toEqual([]);
      }
      expect(await smallText(page)).toEqual([]);
      // No button or link label is cut: its text fits inside its own box.
      const cut = await page.evaluate(() =>
        [...document.querySelectorAll("a, button")]
          .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
          .map((el) => (el.textContent ?? "").trim()),
      );
      expect(cut).toEqual([]);
      // The hero headline is allowed to break inside a word at this size; it must still be inside the screen.
      const h1 = await page.locator("h1").boundingBox();
      expect(h1!.x).toBeGreaterThanOrEqual(0);
      expect(h1!.x + h1!.width).toBeLessThanOrEqual(360);
    });

    test(`criterion 20 [${lang}]: at 200% the ledger card keeps every name readable and its amount and stamp apart`, async ({ page }) => {
      await openLanding(page, lang);
      await largestText(page);
      const card = page.locator('[role="group"]');
      expect(await textProblems(page, '[role="group"]')).toEqual([]);
      const rows = card.locator("ul > li");
      await expect(rows).toHaveCount(2);
      for (const i of [0, 1]) {
        const row = rows.nth(i);
        // The name is at least as wide as its longest word, so it breaks between words, not between letters.
        const name = row.locator(".type-name");
        const width = await name.evaluate((el) => el.getBoundingClientRect().width);
        const longestWord = await name.evaluate((el) => {
          const probe = document.createElement("span");
          probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
          probe.className = el.className.replace("wrap-anywhere", "");
          document.body.append(probe);
          let widest = 0;
          for (const word of (el.textContent ?? "").split(/\s+/)) {
            probe.textContent = word;
            widest = Math.max(widest, probe.getBoundingClientRect().width);
          }
          probe.remove();
          return widest;
        });
        expect(width, `row ${i + 1} name is ${width}px wide, its longest word needs ${longestWord}px`).toBeGreaterThanOrEqual(longestWord - 1);
        // The amount never overlaps the name or the stamp. At this size the card is too narrow to put the
        // name, the amount and the stamp side by side, so they may wrap onto their own lines.
        const amount = (await row.locator(".type-amount-row").boundingBox())!;
        const nameBox = (await name.boundingBox())!;
        const apart = (a: typeof amount, b: typeof amount) =>
          a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1 || a.y + a.height <= b.y + 1 || b.y + b.height <= a.y + 1;
        expect(apart(amount, nameBox), "the amount overlaps the name").toBe(true);
        const stamp = row.locator('[data-size="sm"]');
        if ((await stamp.count()) > 0) {
          const ring = (await stamp.boundingBox())!;
          expect(apart(amount, ring), "the amount overlaps the stamp").toBe(true);
          expect(apart(nameBox, ring), "the name overlaps the stamp").toBe(true);
          const sameLine = amount.y < ring.y + ring.height && ring.y < amount.y + amount.height;
          if (sameLine) expect(amount.x + amount.width, "on one line, the amount ends before the stamp begins").toBeLessThanOrEqual(ring.x + 1);
        }
      }
    });

    test(`criterion 21 [${lang}]: every link and button is at least 44 by 44, and no text is under 14px`, async ({ page }) => {
      await openLanding(page, lang);
      expect(await page.locator("a, button").count()).toBeGreaterThanOrEqual(6);
      expect(await smallTargets(page)).toEqual([]);
      expect(await smallText(page)).toEqual([]);
    });

    test(`criterion 23 [${lang}]: the ribbon is static: animation-name none, nothing on the page animates`, async ({ page }) => {
      await openLanding(page, lang);
      const ribbon = page.locator('main > div[aria-hidden="true"]');
      await expect(ribbon).toHaveCount(1);
      for (const word of ["fees", "hindi", "kannada", "telugu", "remind", "pay", "paid"]) {
        await expect(ribbon.getByText(shown(lang, `landing.ribbon.${word}`), { exact: true })).toHaveCount(1);
      }
      const names = await ribbon.evaluate((el) => [el, ...el.querySelectorAll("*")].map((e) => getComputedStyle(e).animationName));
      expect(names.length).toBeGreaterThan(7);
      expect(new Set(names)).toEqual(new Set(["none"]));
      expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
      expect(await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => getComputedStyle(e).animationName !== "none").length)).toBe(0);
      await expect(page.locator("marquee")).toHaveCount(0);
      // It does not move: same box a moment later.
      const first = await docBox(ribbon.locator("span").first());
      await page.waitForTimeout(500);
      expect(await docBox(ribbon.locator("span").first())).toEqual(first);
    });

    test(`criterion 25 [${lang}]: the ledger card and everything around it is flat; only stamps tilt`, async ({ page }) => {
      await openLanding(page, lang);
      const flat = await page.locator('[role="group"]').evaluate((card) => {
        const bad: string[] = [];
        for (let el: Element | null = card; el; el = el.parentElement) {
          const s = getComputedStyle(el);
          if (s.rotate !== "none" || s.transform !== "none") bad.push(`${el.tagName}: rotate ${s.rotate}, transform ${s.transform}`);
        }
        return bad;
      });
      expect(flat).toEqual([]);
      // Cards, sections and list items nowhere on the page are rotated either.
      const tilted = await page.evaluate(() =>
        [...document.querySelectorAll("body *")]
          .filter((e) => { const s = getComputedStyle(e); return s.rotate !== "none" || s.transform !== "none"; })
          .map((e) => (e.closest('[role="img"], [aria-hidden="true"]') ? "stamp-or-decoration" : e.tagName)),
      );
      expect(tilted.filter((t) => t !== "stamp-or-decoration")).toEqual([]);
    });

    test(`criterion 32 [${lang}]: the footer has the sentence, four endonym links, the current one marked and not a link, and a decorative wordmark`, async ({ page }) => {
      await openLanding(page, lang);
      const footer = page.locator("footer");
      await expect(footer.getByText(shown(lang, "landing.footer.line"), { exact: true })).toBeVisible();
      const nav = footer.locator("nav");
      await expect(nav).toHaveAttribute("aria-label", shown(lang, "landing.footer.languages"));
      await expect(nav.locator("li")).toHaveCount(4);
      for (const [i, code] of langs.entries()) {
        const item = nav.locator("li").nth(i);
        await expect(item).toHaveText(localeNames[code]);
        if (code === lang) {
          await expect(item.locator("a")).toHaveCount(0);
          await expect(item.locator('[aria-current="page"]')).toHaveCount(1);
          await expect(item.locator('[aria-current="page"]')).toHaveAttribute("lang", code);
        } else {
          const link = item.locator("a");
          await expect(link).toHaveAttribute("href", `/${code}/`);
          await expect(link).toHaveAttribute("lang", code);
          await expect(link).not.toHaveAttribute("aria-current", /.*/);
        }
      }
      await expect(footer.locator('[aria-current="page"]')).toHaveCount(1);
      const wordmark = footer.locator('p[aria-hidden="true"]');
      await expect(wordmark).toHaveCount(1);
      await expect(wordmark).toHaveText(brand.name);
    });

    test(`criterion 33 [${lang}]: no Privacy link and no WhatsApp help link`, async ({ page }) => {
      await openLanding(page, lang);
      const links = await page.locator("a").evaluateAll((els) => els.map((a) => `${a.getAttribute("href")} ${a.textContent}`));
      expect(links.filter((l) => /privacy|whatsapp|wa\.me|api\.whatsapp|tel:|mailto:|help/i.test(l))).toEqual([]);
      await expect(page.locator('a[href^="http"], a[href^="//"]')).toHaveCount(0);
      await expect(page.locator("footer a")).toHaveCount(4); // Sign in and the three other languages
    });
  });
}

test.describe("fonts and type (criterion 18)", () => {
  for (const lang of indicLangs) {
    test(`criterion 18 [${lang}]: Anek first, letter-spacing 0, no uppercase on the script, line-height 1.25 and 1.5; digits and amounts are not Anek`, async ({ page }) => {
      await openLanding(page, lang);
      const anek = await familyOf(page, scriptFontVariable[lang]);
      expect(anek).toMatch(/^Anek/);
      const h1 = page.locator("h1");
      expect(await firstFamily(h1)).toBe(anek);
      const body = page.locator("main section").first().locator("p").nth(1);
      expect(await firstFamily(body)).toBe(anek);
      for (const el of [h1, body]) {
        const s = await css(el, ["letter-spacing", "text-transform", "line-height", "font-size"]);
        expect(parseFloat(s["letter-spacing"]) || 0).toBe(0);
        expect(s["text-transform"]).not.toBe("uppercase");
      }
      const h1s = await css(h1, ["line-height", "font-size"]);
      expect(parseFloat(h1s["line-height"]) / parseFloat(h1s["font-size"])).toBeGreaterThanOrEqual(1.25);
      const bs = await css(body, ["line-height", "font-size"]);
      expect(parseFloat(bs["line-height"]) / parseFloat(bs["font-size"])).toBeGreaterThanOrEqual(1.5);
      // The page really draws the script in that Anek face (not a fallback).
      // (The Anek file is fetched lazily, after first layout, so wait for it rather than read once.)
      const probe = await fontProbe(page);
      await expect.poll(async () => (await probe.facesFor(h1)).some((f) => f.family.startsWith("Anek") && f.custom)).toBe(true);
      // Anywhere script text is drawn: no uppercase, no letter-spacing.
      const bad = await page.evaluate((source) => {
        const re = new RegExp(source, "u");
        const out: string[] = [];
        for (const el of document.body.querySelectorAll("*")) {
          const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? "").join("");
          if (!re.test(own)) continue;
          const s = getComputedStyle(el);
          if (s.textTransform === "uppercase" || (parseFloat(s.letterSpacing) || 0) !== 0) out.push(`${el.tagName} ${s.textTransform} ${s.letterSpacing}: ${own.trim().slice(0, 30)}`);
        }
        return out;
      }, scriptPattern[lang].source);
      expect(bad).toEqual([]);
      // Amounts, step digits and promise numbers: 0-9 digits in a Latin face.
      const nums = [
        page.getByText("₹18,500", { exact: true }),
        page.locator('section[aria-labelledby="steps-title"] span[translate="no"]').first(),
        page.locator('section[aria-labelledby="promises-title"] span[translate="no"]').first(),
      ];
      for (const n of nums) expect(await firstFamily(n)).not.toMatch(/^Anek/);
    });
  }

  test("criterion 18 [en]: the h1 is in the Latin headline face, not Anek", async ({ page }) => {
    await openLanding(page, "en");
    expect(await firstFamily(page.locator("h1"))).toMatch(/Bricolage/);
  });
});

test.describe("the key flow on slow 4G, one run per language (criteria 2, 11, 12)", () => {
  for (const lang of langs) {
    test(`criterion 11 and 12 [${lang}]: open on slow 4G, tap the hero button, land on the waitlist form`, async ({ page }) => {
      await slow4G(page);
      await page.goto(path(lang), { waitUntil: "load" });
      await expect(page.locator("h1")).toHaveText(shown(lang, "landing.hero.title"));
      const waitlist = page.locator("section#waitlist");
      await expect(waitlist).not.toBeInViewport();
      await page.locator("main section").first().getByRole("link").first().tap();
      await expect(page).toHaveURL(new RegExp(`${path(lang)}#waitlist$`));
      await expect(waitlist).toBeInViewport({ ratio: 0.5 });
      await expect(waitlist.getByRole("button", { name: shown(lang, "waitlistForm.submit") })).toBeVisible();
      // The header button does the same from the top of the page.
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(waitlist).not.toBeInViewport();
      await page.locator("header a[href='#waitlist']").tap();
      await expect(waitlist).toBeInViewport({ ratio: 0.5 });
    });
  }
});

test.describe("JavaScript off (criterion 2)", () => {
  test.use({ javaScriptEnabled: false });

  for (const lang of langs) {
    test(`criterion 2 [${lang}]: every section reads in the page language and the anchors and language links work`, async ({ page }) => {
      await page.goto(path(lang));
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("h1")).toHaveText(shown(lang, "landing.hero.title"));
      await expect(page.locator("main h2")).toHaveCount(4);
      // R0-4, criterion 22: heading and the needs-JavaScript line, and no dead inputs.
      await expect(page.locator("section#waitlist h2")).toHaveText(shown(lang, "landing.waitlist.title"));
      await expect(page.locator("section#waitlist").getByText(shown(lang, "waitlistForm.noScript"), { exact: true })).toBeAttached();
      await expect(page.locator("section#waitlist input, section#waitlist select, section#waitlist button")).toHaveCount(0);
      await expect(page.locator("section#tools article")).toHaveCount(2);
      await expect(page.locator('section[aria-labelledby="promises-title"] ol > li')).toHaveCount(4);
      await expect(page.locator('[role="group"]').getByText("₹18,500", { exact: true })).toBeVisible();
      const scripts = await page.evaluate(() => document.scripts.length).catch(() => -1);
      expect(scripts).not.toBe(0); // the page does carry its scripts; they are simply not run
      // Anchor links scroll without JavaScript: the header button first, then the hero button.
      const waitlist = page.locator("section#waitlist");
      await expect(waitlist).not.toBeInViewport();
      await page.locator("header a[href='#waitlist']").click();
      await expect(page).toHaveURL(new RegExp(`#waitlist$`));
      await expect(waitlist).toBeInViewport({ ratio: 0.5 });
      await page.goto(path(lang));
      await page.locator("main section").first().getByRole("link").first().click();
      await expect(page).toHaveURL(new RegExp(`#waitlist$`));
      await expect(waitlist).toBeInViewport({ ratio: 0.5 });
      // The hero's link to the reminder writer is a plain link too (R0-2, criterion 5).
      await page.goto(path(lang));
      await page.locator("main section").first().getByRole("link").nth(1).click();
      await expect(page).toHaveURL(`/${lang}/tools/fee-reminder/`);
      await expect(page.locator("h1")).toHaveText(shown(lang, "reminder.title"));
      await page.goto(path(lang));
      // A footer language link is a plain link to that page.
      const other = langs.find((l) => l !== lang)!;
      await page.locator("footer nav").getByRole("link", { name: localeNames[other] }).click();
      await expect(page).toHaveURL(path(other));
      await expect(page.locator("html")).toHaveAttribute("lang", other);
      await expect(page.locator("h1")).toHaveText(shown(other, "landing.hero.title"));
    });
  }
});

test.describe("page metadata in the raw HTML (criteria 26 and 27)", () => {
  test("criterion 26: each page has its own title and description, within the English limits, in the delivered HTML", async ({ request }) => {
    const seenTitles = new Set<string>();
    const seenDescriptions = new Set<string>();
    for (const lang of langs) {
      const raw = await (await request.get(path(lang))).text();
      const t = titles(raw);
      expect(t, lang).toHaveLength(1);
      expect(t[0], lang).toBe(shown(lang, "landing.meta.title"));
      expect(t[0], lang).not.toBe(brand.name);
      const tags = headTags(raw);
      const descriptions = tags.filter((x) => x.attrs.name === "description");
      expect(descriptions, lang).toHaveLength(1);
      expect(descriptions[0].attrs.content, lang).toBe(shown(lang, "landing.meta.description"));
      seenTitles.add(t[0]);
      seenDescriptions.add(descriptions[0].attrs.content);
    }
    // Four different titles; the descriptions of flagged languages are the English one, so they may repeat.
    expect(seenTitles.size).toBe(4);
    expect(seenDescriptions.has(shown("en", "landing.meta.description"))).toBe(true);
    expect(shown("en", "landing.meta.title").length).toBeLessThanOrEqual(60);
    expect(shown("en", "landing.meta.description").length).toBeLessThanOrEqual(155);
    expect(shown("en", "landing.meta.title")).toContain(brand.name);
    expect(shown("en", "landing.meta.title").length).toBeGreaterThan(brand.name.length + 10);
  });

  test("criterion 27: canonical, five hreflang entries, Open Graph title, description and locale; no og:image", async ({ request }) => {
    const alternates = [`https://${brand.domain}/en/`, `https://${brand.domain}/hi/`, `https://${brand.domain}/kn/`, `https://${brand.domain}/te/`, `https://${brand.domain}/en/`];
    const ogTitles = new Set<string>();
    for (const lang of langs) {
      const response = await request.get(path(lang));
      const raw = await response.text();
      const tags = headTags(raw);
      const canonical = tags.filter((x) => x.name === "link" && x.attrs.rel === "canonical");
      expect(canonical, lang).toHaveLength(1);
      expect(canonical[0].attrs.href, lang).toBe(`https://${brand.domain}/${lang}/`);
      const alt = tags.filter((x) => x.name === "link" && x.attrs.rel === "alternate" && x.attrs.hreflang);
      expect(alt.map((x) => x.attrs.hreflang), lang).toEqual(["en", "hi", "kn", "te", "x-default"]);
      expect(alt.map((x) => x.attrs.href), lang).toEqual(alternates);
      for (const a of alt) {
        expect(a.attrs.href).toMatch(/^https:\/\/[^/]+\/(en|hi|kn|te)\/$/);
      }
      const og = (property: string) => tags.filter((x) => x.attrs.property === property).map((x) => x.attrs.content);
      expect(og("og:title"), lang).toEqual([shown(lang, "landing.meta.title")]);
      expect(og("og:description"), lang).toEqual([shown(lang, "landing.meta.description")]);
      expect(og("og:locale"), lang).toEqual([ogLocales[lang]]);
      expect(og("og:image"), lang).toEqual([]);
      expect(tags.filter((x) => /image/.test(x.attrs.name ?? "") || /image/.test(x.attrs.property ?? "")), lang).toEqual([]);
      ogTitles.add(og("og:title")[0]!);
      expect(htmlLang(raw), lang).toBe(lang);
    }
    expect(ogTitles.size).toBe(4);
  });
});

// Found 2026-10-13 on a wide window: the hero's half-width gap was a percentage padding on the same element
// that caps the width, so it was half of the window, not half of the column, and the headline shrank to a
// sliver (one letter per line at about 2000px). The text column must stay readable at every width.
test.describe("hero text column on wide windows", () => {
  for (const width of [1024, 1280, 1440, 1920, 2560]) {
    test(`the headline column is at least 450px wide and the headline is one block at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path("en"));
      const box = await page.locator("h1").boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(450);
      // "Fees collected. Not chased." is about 1.2 lines of 5xl type; a collapsed column makes it dozens of lines.
      expect(box!.height).toBeLessThan(200);
    });
  }
});
