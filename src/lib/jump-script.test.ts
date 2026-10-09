import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { JUMP_SCRIPT } from "./jump-script";
import { STORAGE_KEY } from "./locale-choice";

type Fake = {
  languages?: string[] | null;
  language?: string;
  saved?: unknown;
  storageThrows?: boolean;
  hash?: string;
};

type Target = { getAttribute?: (name: string) => string | null; parentNode?: Target | null };

function run(fake: Fake = {}) {
  const calls: string[] = [];
  const store = new Map<string, string>();
  if (fake.saved !== undefined) store.set(STORAGE_KEY, fake.saved as string);
  let onClick: ((e: { target: Target }) => void) | undefined;
  const context = {
    navigator: {
      ...(fake.languages === null ? {} : { languages: fake.languages ?? [] }),
      language: fake.language,
    },
    localStorage: {
      getItem: (k: string) => {
        if (fake.storageThrows) throw new Error("blocked");
        return store.has(k) ? store.get(k)! : null;
      },
      setItem: (k: string, v: string) => {
        if (fake.storageThrows) throw new Error("blocked");
        store.set(k, v);
      },
    },
    location: { hash: fake.hash ?? "", replace: (url: string) => calls.push(url) },
    document: { addEventListener: (type: string, fn: typeof onClick) => type === "click" && (onClick = fn) },
  };
  vm.runInNewContext(JUMP_SCRIPT, context);
  const link = (code: string): Target => ({ getAttribute: (n) => (n === "data-locale" ? code : null), parentNode: null });
  return {
    calls,
    store,
    click: (target: Target) => onClick!({ target }),
    clickLink: (code: string) => onClick!({ target: { getAttribute: () => null, parentNode: link(code) } }),
    link,
  };
}

describe("the browser's language list (criterion 11)", () => {
  const cases: [string[], string][] = [
    [["hi-IN", "en-US"], "hi"],
    [["ta-IN", "kn"], "kn"],
    [["TE"], "te"],
    [["en-GB"], "en"],
    [["ta-IN", "ml"], "en"],
    [[], "en"],
  ];
  it.each(cases)("%j goes to /%s/", (languages, expected) => {
    expect(run({ languages }).calls).toEqual([`/${expected}/`]);
  });

  it("falls back to navigator.language when the list is empty or missing", () => {
    expect(run({ languages: [], language: "kn-IN" }).calls).toEqual(["/kn/"]);
    expect(run({ languages: null, language: "te" }).calls).toEqual(["/te/"]);
  });

  it("gives English when the browser says nothing at all", () => {
    expect(run({ languages: null }).calls).toEqual(["/en/"]);
  });
});

describe("the saved choice (criteria 13 and 14)", () => {
  it("beats the browser's language", () => {
    expect(run({ saved: "kn", languages: ["hi-IN"] }).calls).toEqual(["/kn/"]);
  });

  it("is ignored when it is not one of the four codes", () => {
    for (const saved of ["fr", "HI", "hi-IN", "", "null"]) {
      expect(run({ saved, languages: ["hi-IN"] }).calls).toEqual(["/hi/"]);
    }
  });

  it("does not stop the jump when storage throws", () => {
    expect(run({ storageThrows: true, languages: ["te-IN"] }).calls).toEqual(["/te/"]);
  });

  it("saves nothing by jumping", () => {
    expect(run({ languages: ["hi-IN"] }).store.size).toBe(0);
  });
});

describe("#choose keeps the page on screen", () => {
  it("does not navigate, but still saves a click", () => {
    const page = run({ hash: "#choose", saved: "hi", languages: ["hi"] });
    expect(page.calls).toEqual([]);
    page.click(page.link("kn"));
    expect(page.store.get(STORAGE_KEY)).toBe("kn");
  });
});

describe("a click on one of the four links (criterion 17)", () => {
  it("saves that language, also when the click lands on something inside the link", () => {
    const page = run({ languages: ["en"] });
    page.clickLink("te");
    expect(page.store.get(STORAGE_KEY)).toBe("te");
  });

  it("saves nothing for a click elsewhere or for an unknown code", () => {
    const page = run({ languages: ["en"] });
    page.click({ getAttribute: () => null, parentNode: null });
    page.click({ getAttribute: (n) => (n === "data-locale" ? "fr" : null), parentNode: null });
    expect(page.store.size).toBe(0);
  });

  it("does not throw when storage is blocked", () => {
    const page = run({ storageThrows: true, hash: "#choose" });
    expect(() => page.click(page.link("hi"))).not.toThrow();
  });
});

describe("the script text", () => {
  it("is plain ES5: no arrow, let, const or template string", () => {
    expect(JUMP_SCRIPT).not.toMatch(/=>|\blet\b|\bconst\b|`/);
  });

  it("cannot close its own script tag", () => {
    expect(JUMP_SCRIPT.toLowerCase()).not.toContain("</script");
  });
});
