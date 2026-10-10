// @vitest-environment node
// R0-1 criterion 29, gaps found by mutation: the 404 check must judge the <html> tag itself (not a lang written
// elsewhere), each of the four blocks and links on its own, and the script must fail when the file is missing or bare.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { check404 } from "../../scripts/check-404-lib.mjs";

const codes = ["en", "hi", "kn", "te"];
const blocks = (without = "") =>
  codes.filter((c) => c !== without).map((c) => `<section lang="${c}"><a href="/${c}/" hrefLang="${c}">n</a></section>`).join("");
const page = (head = '<html lang="en" class="x">', body = blocks()) =>
  `<!DOCTYPE html>${head}<head><meta name="robots" content="noindex"/><title>x</title></head><body>${body}</body></html>`;

describe("check404, one rule at a time", () => {
  it("passes the good page", () => {
    expect(check404(page())).toEqual([]);
  });

  it("fails a bare <html> even when lang appears elsewhere in the file (the RSC payload, a section, a script)", () => {
    const payload = '<script>self.__next_f.push([1,"{\\"lang\\":\\"en\\"} <html lang=\\"en\\">"])</script><div lang="en"></div>';
    const problems = check404(page("<html>", blocks() + payload));
    expect(problems).toEqual(['out/404.html has no <html lang="..">']);
    expect(check404(page('<html lang="">'))).toEqual(['out/404.html has no <html lang="..">']);
    expect(check404(page('<htmlx lang="en">'))).toEqual(['out/404.html has no <html lang="..">']);
  });

  for (const code of codes) {
    it(`fails when only the ${code} block is missing, and when only the ${code} link is missing`, () => {
      expect(check404(page(undefined, blocks(code)))).toEqual([`out/404.html has no block with lang="${code}"`, `out/404.html has no link to /${code}/`]);
      expect(check404(page().replace(`<section lang="${code}">`, `<section><span lang="${code}"></span>`))).toEqual([
        `out/404.html has no block with lang="${code}"`,
      ]);
      expect(check404(page().replace(`href="/${code}/"`, `href="/${code}"`))).toEqual([`out/404.html has no link to /${code}/`]);
    });
  }

  it("fails the 404 that has no sections and no links at all", () => {
    expect(check404(page(undefined, "404")).length).toBe(8);
  });
});

describe("scripts/check-404.mjs as a command", () => {
  const dirs: string[] = [];
  afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
  const run = (html: string | null) => {
    const dir = mkdtempSync(join(tmpdir(), "check404-"));
    dirs.push(dir);
    if (html !== null) {
      mkdirSync(join(dir, "out"));
      writeFileSync(join(dir, "out", "404.html"), html);
    }
    return spawnSync("node", [join(process.cwd(), "scripts", "check-404.mjs")], { cwd: dir, encoding: "utf8" });
  };

  it("exits 1 and says to build first when out/404.html does not exist", () => {
    const r = run(null);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("does not exist");
  });

  it("exits 1 for the bare 404 and names the missing lang", () => {
    const r = run('<!DOCTYPE html><html><head><meta name="robots" content="noindex"/></head><body>404</body></html>');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('no <html lang="..">');
  });

  it("exits 0 for the good page", () => {
    const r = run(page());
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("check-404");
  });
});
