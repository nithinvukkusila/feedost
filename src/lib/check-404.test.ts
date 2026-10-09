// @vitest-environment node
// R0-1 criterion 29: the 404 check can fail, and passes the page we build.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { check404 } from "../../scripts/check-404-lib.mjs";

const good = [
  '<!DOCTYPE html><html lang="en" class="x"><head><meta name="robots" content="noindex"/><title>x</title></head><body>',
  ...["en", "hi", "kn", "te"].map((c) => `<section lang="${c}"><a href="/${c}/" hrefLang="${c}">n</a></section>`),
  "</body></html>",
].join("");

describe("check404", () => {
  it("passes the page with a lang, four blocks and four links", () => {
    expect(check404(good)).toEqual([]);
  });

  it("fails the bare 404 Next writes without the flag", () => {
    const bare = '<!DOCTYPE html><html><head><meta name="robots" content="noindex"/></head><body>404</body></html>';
    const problems = check404(bare);
    expect(problems[0]).toMatch(/no <html lang/);
    expect(problems.length).toBeGreaterThan(4);
  });

  it("fails when a language block, a link, noindex or the marker is wrong", () => {
    expect(check404(good.replace('<section lang="kn">', "<section>"))).toEqual(['out/404.html has no block with lang="kn"']);
    expect(check404(good.replace('href="/te/"', 'href="/en/x"'))).toEqual(["out/404.html has no link to /te/"]);
    expect(check404(good.replace("noindex", "index"))).toEqual(["out/404.html has no noindex robots tag"]);
    expect(check404(good + "TODO-translate: x")).toEqual(["out/404.html shows a TODO-translate marker"]);
  });
});

describe("the real build", () => {
  const built = existsSync(join(process.cwd(), "out", "404.html"));
  it.skipIf(!built)("out/404.html passes (needs pnpm build first)", () => {
    expect(check404(readFileSync(join(process.cwd(), "out", "404.html"), "utf8"))).toEqual([]);
  });
  it.skipIf(!built)("the script exits 0", () => {
    expect(spawnSync("node", ["scripts/check-404.mjs"], { cwd: process.cwd() }).status).toBe(0);
  });
});
