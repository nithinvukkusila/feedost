// Criteria 19 to 25 and 28: the key check, run as a command in throwaway folders.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { locales as appLocales } from "@/config/locales";
import { locales as checkLocales } from "../../scripts/i18n-check-lib.mjs";

const script = join(process.cwd(), "scripts", "i18n-check.mjs");
const made: string[] = [];

type Tree = Record<string, unknown>;
type Files = Partial<Record<"en" | "hi" | "kn" | "te", Tree | string>>;

const good: Tree = {
  common: { loading: "Loading…" },
  home: {
    greeting: "Hello {name}, read <b>this</b>",
    count: "{count, plural, one {# student} other {# students}}",
    kind: "{kind, select, a {Alpha} other {Other}}",
  },
};

const goodHi: Tree = {
  common: { loading: "लोड हो रहा है…" },
  home: {
    greeting: "नमस्ते {name}, <b>यह</b> पढ़ें",
    count: "{count, plural, one {# छात्र} other {# छात्र}}",
    kind: "{kind, select, a {अल्फा} other {अन्य}}",
  },
};

/** Four message files: the passing set, with any file or key replaced. */
function folder(overrides: Files = {}): string {
  const root = mkdtempSync(join(tmpdir(), "i18n-check-"));
  made.push(root);
  mkdirSync(join(root, "messages"));
  for (const locale of ["en", "hi", "kn", "te"] as const) {
    const tree = structuredClone(locale === "en" ? good : goodHi);
    const given = overrides[locale];
    const content = typeof given === "string" ? given : given ?? tree;
    writeFileSync(join(root, "messages", `${locale}.json`), typeof content === "string" ? content : JSON.stringify(content));
  }
  return root;
}

/** The passing set with one value in one file changed. */
function withValue(locale: "en" | "hi" | "kn" | "te", path: string[], value: unknown): string {
  const tree = structuredClone(locale === "en" ? good : goodHi) as Tree;
  let node = tree;
  for (const key of path.slice(0, -1)) node = node[key] as Tree;
  node[path[path.length - 1]] = value;
  return folder({ [locale]: tree });
}

function run(cwd: string, ...args: string[]) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8" });
  return { status: result.status, out: result.stdout + result.stderr };
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("pass (criteria 19, 20)", () => {
  it("passes four files with the same keys, placeholders, tags and plurals", () => {
    const result = run(folder());
    expect(result.status).toBe(0);
    expect(result.out).toContain("4 keys present in all 4 languages");
    expect(result.out).toContain("0 values marked TODO-translate");
  });

  it("lists the same four languages as the app", () => {
    expect([...checkLocales]).toEqual([...appLocales]);
  });

  it("passes the real message files", () => {
    const result = run(process.cwd());
    expect(result.status).toBe(0);
  });
});

describe("fail: criterion 21 (keys, empty, not a string)", () => {
  it("names the file and the key when a key is missing in kn", () => {
    const result = run(folder({ kn: { common: {}, home: goodHi.home } }));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/kn.json is missing "common.loading"');
  });

  it("names the file and the key when te has a key en.json does not", () => {
    const tree = structuredClone(goodHi) as Tree;
    (tree.home as Tree).extra = "Extra";
    const result = run(folder({ te: tree }));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/te.json has "home.extra" which en.json does not');
  });

  it("fails on an empty value", () => {
    const result = run(withValue("hi", ["common", "loading"], ""));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/hi.json "common.loading" is empty');
  });

  it("fails on a value of only spaces", () => {
    const result = run(withValue("kn", ["common", "loading"], "   "));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/kn.json "common.loading" is empty');
  });

  it("fails on a number instead of a string", () => {
    const result = run(withValue("te", ["common", "loading"], 5));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/te.json "common.loading" is a number, not a string');
  });

  it("fails on an array value", () => {
    const result = run(withValue("hi", ["common", "loading"], ["a"]));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/hi.json "common.loading" is an array, not a string');
  });

  it("fails on a file that is not JSON, naming the file", () => {
    const result = run(folder({ kn: "{ nope" }));
    expect(result.status).toBe(1);
    expect(result.out).toContain("messages/kn.json is not valid JSON");
  });

  it("fails on a missing file, naming it", () => {
    const cwd = folder();
    rmSync(join(cwd, "messages", "te.json"));
    const result = run(cwd);
    expect(result.status).toBe(1);
    expect(result.out).toContain("messages/te.json does not exist");
  });

  it("prints every problem, not only the first", () => {
    const tree = structuredClone(goodHi) as Tree;
    (tree.common as Tree).loading = "";
    (tree.home as Tree).extra = "Extra";
    const result = run(folder({ hi: tree }));
    expect(result.out).toContain("is empty");
    expect(result.out).toContain("which en.json does not");
  });
});

describe("fail: criterion 19 (nesting, camelCase)", () => {
  it("fails when a key is an object in en and a string in hi", () => {
    const en = structuredClone(good) as Tree;
    (en.home as Tree).group = { title: "Title" };
    const hi = structuredClone(goodHi) as Tree;
    (hi.home as Tree).group = "Title";
    const result = run(folder({ en, hi, kn: structuredClone(en), te: structuredClone(en) }));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/hi.json "home.group" is not nested like en.json');
  });

  it("fails on a key that is not camelCase", () => {
    const en = structuredClone(good) as Tree;
    (en.common as Tree).Not_Camel = "x";
    const result = run(folder({ en, hi: en, kn: en, te: en }));
    expect(result.status).toBe(1);
    expect(result.out).toContain('"common.Not_Camel", which is not camelCase');
  });
});

describe("fail: criterion 22 (placeholders)", () => {
  it("fails when {name} is renamed", () => {
    const result = run(withValue("hi", ["home", "greeting"], "नमस्ते {nam}, <b>यह</b> पढ़ें"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/hi.json "home.greeting": expected');
    expect(result.out).toContain("{name}");
    expect(result.out).toContain("{nam}");
  });

  it("fails when the <b> tag is dropped", () => {
    const result = run(withValue("kn", ["home", "greeting"], "ನಮಸ್ಕಾರ {name}, ಇದನ್ನು ಓದಿ"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/kn.json "home.greeting"');
    expect(result.out).toContain("<b>");
  });

  it("fails on a plural without an other branch", () => {
    const result = run(withValue("te", ["home", "count"], "{count, plural, one {# విద్యార్థి}}"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/te.json "home.count" is not valid message syntax');
  });

  it("fails on a select without an other branch", () => {
    const result = run(withValue("hi", ["home", "kind"], "{kind, select, a {अल्फा}}"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/hi.json "home.kind" is not valid message syntax');
  });

  it("allows different plural wording in another language", () => {
    const result = run(withValue("hi", ["home", "count"], "{count, plural, one {# छात्र} few {# छात्र} other {सभी #}}"));
    expect(result.status).toBe(0);
  });
});

describe("fail: criterion 23 (syntax)", () => {
  it("fails on an unclosed {", () => {
    const result = run(withValue("kn", ["home", "greeting"], "Hello {name"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/kn.json "home.greeting" is not valid message syntax');
  });

  it("fails on an unfinished plural", () => {
    const result = run(withValue("en", ["home", "count"], "{count, plural, one {x}"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/en.json "home.count" is not valid message syntax');
  });
});

describe("TODO-translate: criteria 24 and 25", () => {
  it("is allowed in hi and counted", () => {
    const result = run(withValue("hi", ["common", "loading"], "TODO-translate: Loading…"));
    expect(result.status).toBe(0);
    expect(result.out).toContain("1 values marked TODO-translate");
  });

  it("is never allowed in en", () => {
    const result = run(withValue("en", ["common", "loading"], "TODO-translate: Loading…"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/en.json "common.loading" starts with TODO-translate');
  });

  it("must be written with the colon and a space", () => {
    const result = run(withValue("hi", ["common", "loading"], "TODO-translate Loading…"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('must be written "TODO-translate: <the English text>"');
  });

  it("still checks the placeholders in the English text after it", () => {
    const result = run(withValue("kn", ["home", "greeting"], "TODO-translate: Hello {nam}, read <b>this</b>"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/kn.json "home.greeting": expected');
  });

  it("passes a TODO value that keeps its placeholders", () => {
    const result = run(withValue("te", ["home", "greeting"], "TODO-translate: Hello {name}, read <b>this</b>"));
    expect(result.status).toBe(0);
  });

  it("--strict fails on the same folder the plain run passes, naming the key", () => {
    const cwd = withValue("hi", ["common", "loading"], "TODO-translate: Loading…");
    expect(run(cwd).status).toBe(0);
    const strict = run(cwd, "--strict");
    expect(strict.status).toBe(1);
    expect(strict.out).toContain('messages/hi.json "common.loading" is still marked TODO-translate');
  });

  it("--strict passes a folder with none", () => {
    expect(run(folder(), "--strict").status).toBe(0);
  });
});
