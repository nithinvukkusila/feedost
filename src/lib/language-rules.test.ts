// Criterion 44: a component never decides how a language works. It calls useTranslations,
// formatRupees and formatDate and nothing else about language. Only src/lib, src/config and
// src/i18n may compare a locale to a code.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { walk } from "@/test-utils/find-own-words";

const root = process.cwd();
const src = join(root, "src");
// src/app/dev is the internal design page: it lays out its own four sample blocks, so its
// `lang === "en"` is about a sample, not about the visitor's language. It is not in production.
const allowed = [join(src, "lib"), join(src, "config"), join(src, "i18n"), join(src, "app", "dev")].map((dir) => dir + "/");

// `locale === "hi"`, `lang !== 'kn'`, `"te" == locale`, `case "hi":` after a switch on a locale.
const branch = /\b(?:locale|lang|language)\w*\s*[!=]==?\s*["'`](?:en|hi|kn|te)["'`]|["'`](?:en|hi|kn|te)["'`]\s*[!=]==?\s*\b(?:locale|lang|language)\b|switch\s*\(\s*(?:locale|lang|language)\s*\)/;

describe("no language branch outside src/lib, src/config and src/i18n (criterion 44)", () => {
  it("catches the patterns it is meant to catch", () => {
    for (const bad of [
      'if (locale === "hi") {}',
      "if (locale !== 'kn') {}",
      'const x = lang == "te" ? 1 : 2;',
      'if ("hi" === locale) {}',
      "switch (locale) { }",
    ]) {
      expect(branch.test(bad), bad).toBe(true);
    }
    for (const fine of ['<html lang="hi">', "const t = useTranslations('home');", 'isLocale(locale)']) {
      expect(branch.test(fine), fine).toBe(false);
    }
  });

  it("finds none in app code", () => {
    const files = walk(src).filter(
      (path) => /\.(tsx?|mts)$/.test(path) && !/\.(test|spec)\.tsx?$/.test(path) && !allowed.some((dir) => path.startsWith(dir)),
    );
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((path) => branch.test(readFileSync(path, "utf8"))).map((path) => path.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });
});
