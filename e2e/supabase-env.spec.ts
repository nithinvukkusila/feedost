// Spec F4a, /dev/supabase: the page that says which Supabase project this build talks to.
// Criteria 44 and 45 (docs/specs/F4-supabase-environments.md). Run against the normal build made
// with the CI fake address, so every request to that host is answered here by Playwright and no
// real project is ever contacted:
//   rm -rf .next out && NEXT_PUBLIC_SUPABASE_URL=https://cicicicicicicicicici.supabase.co pnpm build
import { expect, test, type ConsoleMessage, type Page, type Route } from "@playwright/test";
import { fontsSettled, sidewaysScroll, slow4G } from "./helpers";

const PAGE = "/dev/supabase/";
const HOST = "https://cicicicicicicicicici.supabase.co";
const HEALTH = `${HOST}/functions/v1/health`;
// What the real function sends with every answer (supabase/functions/health/handler.ts).
const CORS = { "access-control-allow-origin": "*" };

type Seen = { method: string; headers: Record<string, string> };

/** Answers every request to the health URL with `answer`, and records each one. */
async function serve(page: Page, answer: (route: Route, n: number) => Promise<void> | void): Promise<Seen[]> {
  const seen: Seen[] = [];
  await page.route(`${HOST}/**`, async (route) => {
    const request = route.request();
    seen.push({ method: request.method(), headers: request.headers() });
    await answer(route, seen.length);
  });
  return seen;
}

const reply = (status: number, body: string) => (route: Route) =>
  route.fulfill({ status, body, headers: { ...CORS, "content-type": "application/json" } });

/** Console errors and uncaught page errors, from now on. */
function watchErrors(page: Page): { console: ConsoleMessage[]; page: Error[] } {
  const out = { console: [] as ConsoleMessage[], page: [] as Error[] };
  page.on("console", (message) => {
    if (message.type() === "error") out.console.push(message);
  });
  page.on("pageerror", (error) => out.page.push(error));
  return out;
}

const result = (page: Page) => page.getByTestId("env-check-result");
const word = (page: Page) => page.getByTestId("env-check-word");

test.describe("44: the answer, in words", () => {
  for (const env of ["staging", "local", "production"]) {
    test(`44: {"ok":true,"env":"${env}"} says "${env}"`, async ({ page }) => {
      await serve(page, reply(200, `{"ok":true,"env":"${env}"}`));
      await page.goto(PAGE);
      await expect(result(page)).toHaveAttribute("data-state", "ok");
      await expect(word(page)).toHaveText(env);
      await expect(result(page)).toContainText("Environment");
      // The word is the answer, not a title: nothing else on the page names another environment.
      for (const other of ["staging", "local", "production"].filter((n) => n !== env)) {
        await expect(page.locator("main")).not.toContainText(other);
      }
    });
  }

  test("44: the request is a plain GET to the health URL, with no custom header and no preflight", async ({ page }) => {
    const seen = await serve(page, reply(200, '{"ok":true,"env":"staging"}'));
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "ok");
    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe("GET");
    // A cross-origin request with a custom header is preceded by an OPTIONS preflight. None was sent.
    expect(seen.filter((s) => s.method === "OPTIONS")).toEqual([]);
    for (const name of ["apikey", "authorization", "x-client-info", "content-type"]) {
      expect(seen[0].headers[name], `request header ${name}`).toBeUndefined();
    }
    // Only the headers a browser adds to any fetch are present.
    const allowed = /^(accept|accept-encoding|accept-language|origin|referer|user-agent|sec-.*|priority|cache-control|pragma|connection|host)$/;
    expect(Object.keys(seen[0].headers).filter((h) => !allowed.test(h))).toEqual([]);
  });

  test("44: the URL asked is exactly <project>/functions/v1/health, asked once", async ({ page }) => {
    const urls: string[] = [];
    await page.route(`${HOST}/**`, (route) => {
      urls.push(route.request().url());
      return reply(200, '{"ok":true,"env":"staging"}')(route);
    });
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "ok");
    expect(urls).toEqual([HEALTH]);
  });

  test("44: no console error and no page error when the answer is good", async ({ page }) => {
    const errors = watchErrors(page);
    await serve(page, reply(200, '{"ok":true,"env":"staging"}'));
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "ok");
    await fontsSettled(page);
    expect(errors.console.map((m) => m.text())).toEqual([]);
    expect(errors.page.map((e) => e.message)).toEqual([]);
  });

  test("44: a request that cannot be made says unreachable and \"paused\"; the one console error is that request", async ({ page }) => {
    const errors = watchErrors(page);
    await serve(page, (route) => route.abort());
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "unreachable");
    await expect(result(page)).toContainText("Cannot reach Supabase");
    await expect(result(page)).toContainText("paused");
    await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
    expect(errors.page.map((e) => e.message)).toEqual([]);
    // Chrome reports the aborted request itself, once, naming the health URL. Nothing else.
    expect(errors.console.map((m) => m.location().url)).toEqual([HEALTH]);
    expect(errors.console.map((m) => m.text())).toEqual([expect.stringContaining("Failed to load resource")]);
  });

  const unexpected: { name: string; status: number; body: string; says: string }[] = [
    { name: "a 500", status: 500, body: '{"ok":false}', says: "answered 500: it has no valid APP_ENV setting" },
    { name: "a 405", status: 405, body: '{"ok":false}', says: "answered 405: the health function refused this kind of request" },
    { name: "a 404", status: 404, body: "Not Found", says: "answered with status 404" },
    { name: "a 503", status: 503, body: "", says: "answered with status 503" },
    { name: "a 200 that is not JSON", status: 200, body: "<html>hello</html>", says: "answered 200, but the body was not the expected shape" },
    { name: "a 200 with an extra key", status: 200, body: '{"ok":true,"env":"staging","extra":1}', says: "answered 200, but the body was not the expected shape" },
    { name: "a 200 with an unknown env", status: 200, body: '{"ok":true,"env":"qa"}', says: "answered 200, but the body was not the expected shape" },
    { name: "a 200 whose ok is not true", status: 200, body: '{"ok":false,"env":"staging"}', says: "answered 200, but the body was not the expected shape" },
    { name: "a 200 whose ok is the string true", status: 200, body: '{"ok":"true","env":"staging"}', says: "answered 200, but the body was not the expected shape" },
    { name: "a 200 with no env", status: 200, body: '{"ok":true}', says: "answered 200, but the body was not the expected shape" },
  ];
  for (const c of unexpected) {
    test(`44: ${c.name} says "Unexpected answer" with its own reason, and never names an environment`, async ({ page }) => {
      const errors = watchErrors(page);
      await serve(page, reply(c.status, c.body));
      await page.goto(PAGE);
      await expect(result(page)).toHaveAttribute("data-state", "unexpected");
      await expect(result(page)).toContainText("Unexpected answer");
      await expect(result(page)).toContainText(c.says);
      await expect(page.locator("[data-env]")).toHaveCount(0);
      await expect(word(page)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Check again" })).toBeVisible();
      expect(errors.page.map((e) => e.message)).toEqual([]);
      // A 4xx or 5xx is reported by Chrome as a failed load of the health URL; nothing else may be.
      for (const m of errors.console) {
        expect(m.location().url).toBe(HEALTH);
        expect(m.text()).toContain("Failed to load resource");
      }
    });
  }
});

test.describe("44: slow and hung answers", () => {
  test("44: a request that never answers is cut off at 5 seconds and says unreachable", async ({ page }) => {
    await page.clock.install();
    let held = 0;
    // Never answered; it ends only when the page aborts it.
    await page.route(`${HOST}/**`, () => {
      held++;
    });
    await page.goto(PAGE);
    await expect.poll(() => held).toBe(1);
    await expect(result(page)).toHaveAttribute("data-state", "checking");
    await page.clock.fastForward(4500);
    await expect(result(page)).toHaveAttribute("data-state", "checking");
    await page.clock.fastForward(1000);
    await expect(result(page)).toHaveAttribute("data-state", "unreachable");
    await expect(result(page)).toContainText("paused");
  });

  test("44: a slow phone connection shows Checking first, then the answer", async ({ page }) => {
    await slow4G(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`${HOST}/**`, async (route) => {
      await gate;
      await reply(200, '{"ok":true,"env":"staging"}')(route);
    });
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "checking");
    await expect(word(page)).toHaveText("Checking");
    await expect(result(page)).toContainText("Asking the health function");
    release();
    await expect(result(page)).toHaveAttribute("data-state", "ok");
    await expect(word(page)).toHaveText("staging");
  });
});

test.describe("44: Check again", () => {
  test("44: goes to Checking, then to the new answer, and asks again", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const seen = await serve(page, async (route, n) => {
      if (n === 1) return route.abort();
      await gate;
      return reply(200, '{"ok":true,"env":"production"}')(route);
    });
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "unreachable");
    await page.getByRole("button", { name: "Check again" }).tap();
    // The old answer is not left on screen while the new check runs.
    await expect(result(page)).toHaveAttribute("data-state", "checking");
    await expect(page.getByText("Cannot reach Supabase")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Check again" })).toHaveCount(0);
    release();
    await expect(result(page)).toHaveAttribute("data-state", "ok");
    await expect(word(page)).toHaveText("production");
    expect(seen.map((s) => s.method)).toEqual(["GET", "GET"]);
  });

  test("44: a second failure after Check again still says what is wrong", async ({ page }) => {
    const seen = await serve(page, (route, n) => (n === 1 ? route.abort() : reply(500, '{"ok":false}')(route)));
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "unreachable");
    await page.getByRole("button", { name: "Check again" }).tap();
    await expect(result(page)).toHaveAttribute("data-state", "unexpected");
    await expect(result(page)).toContainText("answered 500");
    expect(seen).toHaveLength(2);
  });

  test("44: works from the keyboard, with a visible focus ring", async ({ page }) => {
    const seen = await serve(page, (route, n) => (n === 1 ? route.abort() : reply(200, '{"ok":true,"env":"local"}')(route)));
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "unreachable");
    const again = page.getByRole("button", { name: "Check again" });
    await page.keyboard.press("Tab");
    await expect(again).toBeFocused();
    const ring = await again.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), offset: parseFloat(s.outlineOffset), colour: s.outlineColor };
    });
    expect(ring.style).toBe("solid");
    expect(ring.width).toBeGreaterThanOrEqual(2);
    expect(ring.colour).not.toBe("rgba(0, 0, 0, 0)");
    await page.keyboard.press("Enter");
    await expect(result(page)).toHaveAttribute("data-state", "ok");
    await expect(word(page)).toHaveText("local");
    expect(seen).toHaveLength(2);
  });

  test("44: the Space key works too", async ({ page }) => {
    await serve(page, (route, n) => (n === 1 ? route.abort() : reply(200, '{"ok":true,"env":"staging"}')(route)));
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "unreachable");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Space");
    await expect(word(page)).toHaveText("staging");
  });
});

test.describe("44: the page fits a phone", () => {
  async function smallest(page: Page): Promise<{ texts: number; small: string[]; targets: number; smallTargets: string[] }> {
    return page.evaluate(() => {
      const small: string[] = [];
      let texts = 0;
      const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!el || (node.textContent ?? "").trim() === "") continue;
        texts++;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < 14) small.push(`${size}px: ${(node.textContent ?? "").trim().slice(0, 40)}`);
      }
      const smallTargets: string[] = [];
      let targets = 0;
      for (const el of document.querySelectorAll("main a[href], main button")) {
        targets++;
        const r = el.getBoundingClientRect();
        if (r.width < 43.99 || r.height < 43.99) smallTargets.push(`${(el.textContent ?? "").trim()}: ${r.width} by ${r.height}`);
      }
      return { texts, small, targets, smallTargets };
    });
  }

  const states: { name: string; answer: (route: Route) => Promise<void> | void; state: string; buttons: number }[] = [
    { name: "ok", answer: reply(200, '{"ok":true,"env":"staging"}'), state: "ok", buttons: 0 },
    { name: "unreachable", answer: (route) => route.abort(), state: "unreachable", buttons: 1 },
    { name: "unexpected", answer: reply(200, '{"ok":true,"env":"qa"}'), state: "unexpected", buttons: 1 },
  ];
  for (const s of states) {
    test(`44: ${s.name}: no sideways scroll, no text under 14px, targets at least 44px`, async ({ page }) => {
      await serve(page, s.answer);
      await page.goto(PAGE);
      await expect(result(page)).toHaveAttribute("data-state", s.state);
      await fontsSettled(page);
      expect(await sidewaysScroll(page)).toBe(0);
      const found = await smallest(page);
      expect(found.texts).toBeGreaterThan(2);
      expect(found.small).toEqual([]);
      expect(found.targets).toBe(s.buttons);
      expect(found.smallTargets).toEqual([]);
    });
  }

  test("44: Checking: no sideways scroll, no text under 14px", async ({ page }) => {
    await page.route(`${HOST}/**`, () => {});
    await page.goto(PAGE);
    await expect(result(page)).toHaveAttribute("data-state", "checking");
    expect(await sidewaysScroll(page)).toBe(0);
    const found = await smallest(page);
    expect(found.texts).toBeGreaterThan(2);
    expect(found.small).toEqual([]);
  });

  for (const [name, answer, state] of [
    ["ok", reply(200, '{"ok":true,"env":"production"}'), "ok"],
    ["unreachable", (route: Route) => route.abort(), "unreachable"],
    ["unexpected", reply(404, ""), "unexpected"],
  ] as const) {
    // DEFECT D1 (frontend-dev): from 150% root text size the h1 "Supabase check" (text-5xl, no wrapping
    // rule) is wider than the 360px screen, so the page scrolls sideways. These three fail until fixed.
    test(`44: ${name} at 200% root text size: the page does not scroll sideways and the heading fits [DEFECT D1]`, async ({ page }) => {
      await serve(page, answer);
      await page.goto(PAGE);
      await expect(result(page)).toHaveAttribute("data-state", state);
      await fontsSettled(page);
      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
      const heading = await page.getByRole("heading", { level: 1 }).evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return Math.max(...[...range.getClientRects()].map((r) => r.right)) - document.documentElement.clientWidth;
      });
      expect(heading, "px the heading reaches past the right edge").toBeLessThanOrEqual(0);
      expect(await sidewaysScroll(page)).toBe(0);
    });

    test(`44: ${name} at 200% root text size: the text grows, nothing in the result is cut off, targets still 44px`, async ({ page }) => {
      await serve(page, answer);
      await page.goto(PAGE);
      await expect(result(page)).toHaveAttribute("data-state", state);
      await fontsSettled(page);
      const before = await page.locator("main").evaluate((el) => el.getBoundingClientRect().height);
      await page.evaluate(() => document.documentElement.style.setProperty("font-size", "200%"));
      await expect.poll(() => page.locator("main").evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThan(before);
      const found = await smallest(page);
      expect(found.small).toEqual([]);
      expect(found.smallTargets).toEqual([]);
      // Every piece of text under the result lies inside the 360px screen and is not wider than its box.
      // (The h1 is left to the D1 test above.)
      const outside = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of document.querySelectorAll("main *:not(h1)")) {
          const own = [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim() !== "");
          if (!own) continue;
          const range = document.createRange();
          range.selectNodeContents(el);
          for (const r of range.getClientRects()) {
            if (r.left < -0.5 || r.right > document.documentElement.clientWidth + 0.5) bad.push(`${el.textContent?.slice(0, 30)} ${r.left}..${r.right}`);
          }
          if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).display !== "inline") bad.push(`wider than its box: ${el.textContent?.slice(0, 30)}`);
        }
        return bad;
      });
      expect(outside).toEqual([]);
    });
  }
});

test.describe("44: not configured, and the page is not in the language tree", () => {
  test("44: the page is noindex and has a title", async ({ page }) => {
    await serve(page, reply(200, '{"ok":true,"env":"staging"}'));
    await page.goto(PAGE);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await expect(page).toHaveTitle("Supabase check");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Supabase check");
  });

  test("44: /dev/supabase/ is absent from the locale tree: /en/dev/supabase/ and its neighbours are 404", async ({ request }) => {
    for (const lang of ["en", "hi", "kn", "te"]) {
      expect((await request.get(`/${lang}/dev/supabase/`)).status(), `/${lang}/dev/supabase/`).toBe(404);
    }
    expect((await request.get(PAGE)).status()).toBe(200);
    expect((await request.get("/dev/supabase/nothing/")).status()).toBe(404);
  });

  test("44: the home page and the language pages do not link to it or mention it", async ({ page, request }) => {
    for (const path of ["/en/", "/hi/", "/kn/", "/te/"]) {
      await page.goto(path);
      await expect(page.locator('a[href*="supabase"]')).toHaveCount(0);
      const html = await (await request.get(path)).text();
      expect(html).not.toContain("dev/supabase");
      expect(html).not.toContain(HOST);
    }
  });

  test("45: the normal build holds the page's sentence and chunk marker (the production build must hold neither; CI greps for both)", async ({ request }) => {
    const html = await (await request.get(PAGE)).text();
    expect(html).toContain("Which Supabase does this build talk to?");
    // The page's own chunk carries the address that was baked in, nothing else about a project.
    // (Built from pieces so this file does not trip check:secrets.)
    expect(html).not.toMatch(new RegExp([["service", "role"].join("_"), ["sb", "secret"].join("_")].join("|")));
  });
});
