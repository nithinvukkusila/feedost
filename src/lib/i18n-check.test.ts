// Criteria 19 to 25 and 28: the key check, run as a command in throwaway folders.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

// Added by test-engineer after mutation testing: each test below fails when the rule it names is removed.
describe("gaps found by mutation (criteria 21, 22, 24)", () => {
  /** A folder whose English has one key and every other file has the given value for it. */
  function oneKey(en: string, other: string): string {
    const tree = (value: string) => ({ home: { line: value } });
    return folder({ en: tree(en), hi: tree(other), kn: tree(en), te: tree(en) });
  }

  it("21: a value of only spaces is reported as empty, by the empty-value rule (not as 'empty after TODO-translate')", () => {
    const result = run(withValue("kn", ["common", "loading"], "   "));
    expect(result.out).toContain('messages/kn.json "common.loading" is empty');
    expect(result.out).not.toContain("after TODO-translate");
  });

  it("24: TODO-translate with nothing after it fails and says so", () => {
    const result = run(withValue("hi", ["common", "loading"], "TODO-translate: "));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/hi.json "common.loading" is empty after TODO-translate');
  });

  it("24: TODO-translate followed only by spaces fails the same way", () => {
    const result = run(withValue("te", ["common", "loading"], "TODO-translate:    "));
    expect(result.status).toBe(1);
    expect(result.out).toContain("is empty after TODO-translate");
  });

  it("22: a renamed argument inside a rich-text tag is found", () => {
    const result = run(oneKey("<b>Hi {name}</b>", "<b>Hi {nam}</b>"));
    expect(result.status).toBe(1);
    expect(result.out).toContain('messages/hi.json "home.line": expected');
    expect(result.out).toContain("{nam}");
  });

  it("22: a tag nested inside another tag is compared too", () => {
    const result = run(oneKey("<b>one <i>two</i></b>", "<b>one two</b>"));
    expect(result.status).toBe(1);
    expect(result.out).toContain("<i>");
  });

  it("22: a renamed argument inside a plural branch is found", () => {
    const result = run(oneKey("{count, plural, one {{name} has one} other {{name} has #}}", "{count, plural, one {{nam} has one} other {{name} has #}}"));
    expect(result.status).toBe(1);
    expect(result.out).toContain("{nam}");
  });

  it("22: a renamed argument inside a select branch is found", () => {
    const result = run(oneKey("{kind, select, a {{name} A} other {{name} B}}", "{kind, select, a {{name} A} other {{nam} B}}"));
    expect(result.status).toBe(1);
    expect(result.out).toContain("{nam}");
  });

  it("22: a placeholder that appears only inside a branch is required in the translation", () => {
    const result = run(oneKey("{count, plural, one {{name} one} other {{name} many}}", "{count, plural, one {एक} other {कई}}"));
    expect(result.status).toBe(1);
    expect(result.out).toContain("{name}");
  });

  it("22: the same placeholders in a different order pass", () => {
    expect(run(oneKey("{a} then {b}", "{b} पहले {a}")).status).toBe(0);
  });
});

describe("duplicate keys (spec F3, Edge cases: 'Duplicates')", () => {
  // The spec says two equal keys in one JSON file are silently merged by JSON.parse, the check cannot
  // see them, and code review catches them. This pins that statement. It is not a wish: if a later
  // slice adds a duplicate-key rule, the spec changes first and this test is replaced with it.
  it("stay invisible to the check: a file with the same key twice passes", () => {
    const hi = '{"common":{"loading":"लोड हो रहा है…","loading":"फिर से लोड"},"home":{"greeting":"नमस्ते {name}, <b>यह</b> पढ़ें","count":"{count, plural, one {# छात्र} other {# छात्र}}","kind":"{kind, select, a {अल्फा} other {अन्य}}"}}';
    const result = run(folder({ hi }));
    expect(result.status).toBe(0);
    expect(result.out).toContain("4 keys present in all 4 languages");
  });
});

// Spec R0-2, criteria 21, 23, 28 and 30: the fee reminder's templates and their review record.
describe("the reminder templates and their review record (R0-2)", () => {
  type Entry = { polite: string[]; firm: string[]; months: string[] };
  type Templates = Record<"en" | "hi" | "kn" | "te", Entry>;
  type Review = Record<string, { status: string; reviewer: string; date: string; sha256: string }>;

  const real = JSON.parse(readFileSync(join(process.cwd(), "src", "lib", "reminder", "templates.json"), "utf8")) as Templates;
  const open = { status: "not reviewed", reviewer: "", date: "", sha256: "" };
  const notReviewed: Review = { hi: { ...open }, kn: { ...open }, te: { ...open } };
  const hash = (entry: Entry) =>
    createHash("sha256").update(JSON.stringify({ polite: entry.polite, firm: entry.firm, months: entry.months })).digest("hex");
  const signed = (entry: Entry, reviewer = "A Reader", date = "2026-10-20") => ({ status: "reviewed", reviewer, date, sha256: hash(entry) });
  const allSigned = (t: Templates): Review => ({ hi: signed(t.hi), kn: signed(t.kn), te: signed(t.te) });

  /** The passing message files plus a templates file and, unless `null`, a review record. */
  function withTemplates(templates: unknown, review: unknown = notReviewed): string {
    const root = folder();
    const dir = join(root, "src", "lib", "reminder");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "templates.json"), typeof templates === "string" ? templates : JSON.stringify(templates));
    if (review !== null) writeFileSync(join(dir, "templates.review.json"), typeof review === "string" ? review : JSON.stringify(review));
    return root;
  }

  /** The real templates with one language changed. */
  function changed(locale: keyof Templates, change: (entry: Entry) => void): Templates {
    const copy = structuredClone(real);
    change(copy[locale]);
    return copy;
  }

  describe("pass", () => {
    it("a folder with no templates file is checked as before, and the summary does not mention templates", () => {
      const result = run(folder());
      expect(result.status).toBe(0);
      expect(result.out).not.toContain("templates");
    });

    it("the plain run passes drafts, and prints the count and each language's hash to copy", () => {
      const result = run(withTemplates(real));
      expect(result.status).toBe(0);
      expect(result.out).toContain("8 templates, 3 languages not reviewed (hi, kn, te)");
      for (const locale of ["hi", "kn", "te"] as const) expect(result.out).toContain(`${locale}: not reviewed; current text ${hash(real[locale])}`);
    });

    it("the real files pass the plain run and say what is not reviewed", () => {
      const result = run(process.cwd());
      expect(result.status).toBe(0);
      expect(result.out).toMatch(/8 templates, (all 3 languages reviewed|\d languages? not reviewed \([a-z, ]+\))/);
    });
  });

  describe("fail: the shape (criterion 21)", () => {
    it("a missing language", () => {
      const { te: _te, ...rest } = real;
      void _te;
      const result = run(withTemplates(rest));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json is missing "te"');
    });

    it("a language that is not one of the four", () => {
      const result = run(withTemplates({ ...real, ta: real.te }));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json has "ta"');
    });

    it("a template that is a string, not a list of lines", () => {
      const result = run(withTemplates({ ...real, kn: { ...real.kn, firm: real.kn.firm.join("\n") } }));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "kn.firm" must be a list of lines');
    });

    it("an empty line in a template", () => {
      const result = run(withTemplates(changed("hi", (e) => e.polite.push(" "))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "hi.polite" must be a list of lines, none of them empty');
    });

    it("eleven month names", () => {
      const result = run(withTemplates(changed("kn", (e) => e.months.pop())));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "kn.months" has 11 names, expected 12');
    });

    it("the same month name twice", () => {
      const result = run(withTemplates(changed("te", (e) => (e.months[11] = e.months[10]))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "te.months" has the same name twice');
    });

    it("a file that is not JSON", () => {
      const result = run(withTemplates("{ nope"));
      expect(result.status).toBe(1);
      expect(result.out).toContain("templates.json is not valid JSON");
    });
  });

  describe("fail: the placeholders (criteria 21, 23)", () => {
    it("a missing {link}", () => {
      const result = run(withTemplates(changed("te", (e) => e.firm.splice(1, 1))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "te.firm": {link} appears 0 times');
    });

    it("{amount} twice", () => {
      const result = run(withTemplates(changed("en", (e) => (e.polite[3] = "Thank you! {amount}"))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "en.polite": {amount} appears 2 times');
    });

    it("a placeholder the code does not know", () => {
      const result = run(withTemplates(changed("hi", (e) => (e.firm[3] = "धन्यवाद। {student}"))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "hi.firm" has a brace that is not one of');
    });

    it("{link} with words glued to it", () => {
      const result = run(withTemplates(changed("hi", (e) => (e.polite[1] = "{link} देखें"))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "hi.polite": {link} must be alone on its line');
    });
  });

  describe("fail: a template is never English in disguise (criterion 28)", () => {
    it("a TODO-translate marker", () => {
      const result = run(withTemplates(changed("kn", (e) => (e.polite[3] = "TODO-translate: Thank you!"))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "kn.polite" contains TODO-translate; a template cannot be marked, see the review record');
    });

    it("a marked month name", () => {
      const result = run(withTemplates(changed("te", (e) => (e.months[0] = "TODO-translate: January"))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "te.months" contains TODO-translate');
    });

    it("the English template pasted into Hindi", () => {
      const result = run(withTemplates(changed("hi", (e) => (e.firm = [...real.en.firm]))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "hi.firm" has no Devanagari text');
      expect(result.out).toContain('templates.json "hi.firm" is the same as the English template');
    });

    it("Telugu text where Kannada belongs", () => {
      const result = run(withTemplates(changed("kn", (e) => (e.polite = [...real.te.polite]))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "kn.polite" has no Kannada text');
    });

    it("an English month name in the Telugu list", () => {
      const result = run(withTemplates(changed("te", (e) => (e.months[4] = "May"))));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.json "te.months" name 5 has no Telugu text');
    });
  });

  describe("the review record (criterion 30)", () => {
    it("--strict fails while a language is not reviewed, naming each one", () => {
      const cwd = withTemplates(real);
      expect(run(cwd).status).toBe(0);
      const strict = run(cwd, "--strict");
      expect(strict.status).toBe(1);
      for (const locale of ["hi", "kn", "te"]) {
        expect(strict.out).toContain(
          `templates.json "${locale}" is not reviewed (2 templates, 12 month names): get a native reader's sign-off and record it in templates.review.json`,
        );
      }
      expect(strict.out).toContain("i18n: 3 problems");
    });

    it("--strict names only the languages still waiting", () => {
      const strict = run(withTemplates(real, { ...notReviewed, hi: signed(real.hi) }), "--strict");
      expect(strict.status).toBe(1);
      expect(strict.out).not.toContain('templates.json "hi" is not reviewed');
      expect(strict.out).toContain('templates.json "kn" is not reviewed');
      expect(strict.out).toContain("i18n: 2 problems");
    });

    it("a matching hash with a name and a date passes --strict", () => {
      const cwd = withTemplates(real, allSigned(real));
      const strict = run(cwd, "--strict");
      expect(strict.status).toBe(0);
      expect(strict.out).toContain("8 templates, all 3 languages reviewed");
    });

    it("a template changed after the review fails --strict, naming the review", () => {
      const edited = changed("hi", (e) => (e.polite[3] = "बहुत धन्यवाद!"));
      const cwd = withTemplates(edited, allSigned(real));
      const strict = run(cwd, "--strict");
      expect(strict.status).toBe(1);
      expect(strict.out).toContain('templates.json "hi" changed after the review of 2026-10-20 by A Reader');
      expect(strict.out).not.toContain('templates.json "kn"');
    });

    it("a month name changed after the review reopens that language in the plain run too, without failing it", () => {
      const edited = changed("te", (e) => (e.months[2] = "మార్చ్"));
      const result = run(withTemplates(edited, allSigned(real)));
      expect(result.status).toBe(0);
      expect(result.out).toContain("8 templates, 1 language not reviewed (te)");
      expect(result.out).toContain('templates.json "te" changed after the review of 2026-10-20 by A Reader');
      expect(result.out).toContain(hash(edited.te));
    });

    it("a missing record fails the plain run", () => {
      const result = run(withTemplates(real, null));
      expect(result.status).toBe(1);
      expect(result.out).toContain("templates.review.json does not exist");
    });

    it("a record with a language missing fails the plain run", () => {
      const result = run(withTemplates(real, { hi: { ...open }, kn: { ...open } }));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.review.json is missing "te"');
    });

    it("a status that is neither of the two fails the plain run", () => {
      const result = run(withTemplates(real, { ...notReviewed, kn: { ...open, status: "ok" } }));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.review.json "kn": status must be "reviewed" or "not reviewed"');
    });

    it("reviewed with no name fails the plain run", () => {
      const result = run(withTemplates(real, { ...notReviewed, hi: signed(real.hi, " ") }));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.review.json "hi" is marked reviewed with no reviewer\'s name');
    });

    it("reviewed with no proper date, or no hash, fails the plain run", () => {
      const noDate = run(withTemplates(real, { ...notReviewed, hi: signed(real.hi, "A Reader", "20 Oct") }));
      expect(noDate.status).toBe(1);
      expect(noDate.out).toContain('templates.review.json "hi" is marked reviewed with no date written YYYY-MM-DD');
      const noHash = run(withTemplates(real, { ...notReviewed, te: { ...signed(real.te), sha256: "" } }));
      expect(noHash.status).toBe(1);
      expect(noHash.out).toContain('templates.review.json "te" is marked reviewed with no sha256');
    });

    it("a record that is not JSON fails the plain run", () => {
      const result = run(withTemplates(real, "{ nope"));
      expect(result.status).toBe(1);
      expect(result.out).toContain("templates.review.json is not valid JSON");
    });

    it("an entry for English, which is the source, fails the plain run", () => {
      const result = run(withTemplates(real, { ...notReviewed, en: { ...open } }));
      expect(result.status).toBe(1);
      expect(result.out).toContain('templates.review.json has "en"');
    });
  });
});

// Spec R0-3, criteria 16, 17, 26 and 32: the receipt wording and its review record.
describe("the receipt wording and its review record (R0-3)", () => {
  type Entry = {
    heading: string;
    date: string;
    sentence: string;
    stamp: string;
    footer: string;
    whatsApp: string;
    months: string[];
    shortMonths: string[];
    modes: Record<string, string>;
  };
  type Wording = Record<"en" | "hi" | "kn" | "te", Entry>;

  const real = JSON.parse(readFileSync(join(process.cwd(), "src", "lib", "receipt", "templates.json"), "utf8")) as Wording;
  const open = { status: "not reviewed", reviewer: "", date: "", sha256: "" };
  const notReviewed = { hi: { ...open }, kn: { ...open }, te: { ...open } };
  const hash = (e: Entry) =>
    createHash("sha256")
      .update(JSON.stringify({ heading: e.heading, date: e.date, sentence: e.sentence, stamp: e.stamp, footer: e.footer, whatsApp: e.whatsApp, months: e.months, shortMonths: e.shortMonths, modes: e.modes }))
      .digest("hex");
  const signed = (e: Entry) => ({ status: "reviewed", reviewer: "A Reader", date: "2026-10-20", sha256: hash(e) });

  function withWording(wording: unknown, review: unknown = notReviewed): string {
    const root = folder();
    const dir = join(root, "src", "lib", "receipt");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "templates.json"), typeof wording === "string" ? wording : JSON.stringify(wording));
    if (review !== null) writeFileSync(join(dir, "templates.review.json"), JSON.stringify(review));
    return root;
  }
  function changed(locale: keyof Wording, change: (entry: Entry) => void): Wording {
    const copy = structuredClone(real);
    change(copy[locale]);
    return copy;
  }

  it("the real files pass the plain run, count 24 texts and print each language's hash to copy", () => {
    const result = run(withWording(real));
    expect(result.status).toBe(0);
    expect(result.out).toContain("receipt: 24 texts, 3 languages not reviewed (hi, kn, te)");
    for (const locale of ["hi", "kn", "te"] as const) expect(result.out).toContain(`receipt ${locale}: not reviewed; current text ${hash(real[locale])}`);
    expect(run(process.cwd()).status).toBe(0);
  });

  it("a folder with no receipt wording is checked as before", () => {
    expect(run(folder()).out).not.toContain("receipt");
  });

  it("fails a sentence that lost a placeholder", () => {
    const result = run(withWording(changed("en", (e) => (e.sentence = "Received with thanks from the family of {student} by {mode} for {month}."))));
    expect(result.status).toBe(1);
    expect(result.out).toContain('receipt templates.json "en.sentence": {amount} appears 0 times');
  });

  it("fails a stray brace", () => {
    const result = run(withWording(changed("hi", (e) => (e.stamp = "भुगतान {प्राप्त}"))));
    expect(result.status).toBe(1);
    expect(result.out).toContain('receipt templates.json "hi.stamp" has a brace');
  });

  it("fails TODO-translate: a parent reads this, so it cannot be marked", () => {
    const result = run(withWording(changed("kn", (e) => (e.heading = `TODO-translate: ${e.heading}`))));
    expect(result.status).toBe(1);
    expect(result.out).toContain('receipt templates.json "kn.heading" contains TODO-translate');
  });

  it("fails English pasted into Telugu", () => {
    const result = run(withWording(changed("te", (e) => (e.sentence = real.en.sentence))));
    expect(result.status).toBe(1);
    expect(result.out).toContain('"te.sentence" has no Telugu text');
    expect(result.out).toContain('"te.sentence" is the same as the English one');
  });

  it.each(["verified", "Official receipt", "GST", "tax invoice", "tracked"])("fails the word a receipt must not use: %s (criterion 17)", (word) => {
    const result = run(withWording(changed("en", (e) => (e.heading = `${word} fee receipt`))));
    expect(result.status).toBe(1);
    expect(result.out).toContain('receipt templates.json "en.heading" uses a word a receipt must not use');
  });

  it("fails a month list with 11 names", () => {
    const result = run(withWording(changed("kn", (e) => e.shortMonths.pop())));
    expect(result.status).toBe(1);
    expect(result.out).toContain('"kn.shortMonths" has 11 names, expected 12');
  });

  it("fails a missing payment phrase", () => {
    const result = run(withWording(changed("hi", (e) => delete e.modes.bank)));
    expect(result.status).toBe(1);
    expect(result.out).toContain('"hi.modes" must have a text for each of upi, cash, bank');
  });

  it("fails a language that is missing", () => {
    const { te: _te, ...rest } = real;
    void _te;
    const result = run(withWording(rest));
    expect(result.status).toBe(1);
    expect(result.out).toContain('receipt templates.json is missing "te"');
  });

  it("--strict fails while any language is not reviewed, and passes when all three are signed", () => {
    const strict = run(withWording(real), "--strict");
    expect(strict.status).toBe(1);
    expect(strict.out).toContain('receipt templates.json "kn" is not reviewed');
    const signedAll = run(withWording(real, { hi: signed(real.hi), kn: signed(real.kn), te: signed(real.te) }), "--strict");
    expect(signedAll.out).toContain("receipt: 24 texts, all 3 languages reviewed");
  });

  it("a text changed after the review is named", () => {
    const edited = changed("hi", (e) => (e.heading = `${e.heading} `.trim() + "।"));
    const result = run(withWording(edited, { hi: signed(real.hi), kn: signed(real.kn), te: signed(real.te) }), "--strict");
    expect(result.status).toBe(1);
    expect(result.out).toContain('receipt templates.json "hi" changed after the review of 2026-10-20 by A Reader');
  });
});
