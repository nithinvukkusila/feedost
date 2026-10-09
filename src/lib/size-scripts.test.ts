// Criteria 29 and 30: pnpm size and pnpm check:leak, run as commands against a fake out/ in a
// throwaway folder, so each one is shown to pass and to fail.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const sizeScript = join(process.cwd(), "scripts", "size.mjs");
const leakScript = join(process.cwd(), "scripts", "check-locale-leak.mjs");
const made: string[] = [];
const pages = ["index.html", "en/index.html", "hi/index.html", "kn/index.html", "te/index.html"];

const messages = {
  en: { home: { placeholder: "English home line here" } },
  hi: { home: { placeholder: "हिन्दी का घर वाक्य यहाँ" } },
  kn: { home: { placeholder: "ಕನ್ನಡ ಮನೆ ವಾಕ್ಯ ಇಲ್ಲಿ" } },
  te: { home: { placeholder: "తెలుగు ఇంటి వాక్యం ఇక్కడ" } },
};

function html(body: string, script = "/_next/a.js") {
  return `<html><body>${body}<script src="${script}" async></script></body></html>`;
}

type Options = {
  skip?: string[];
  scriptBytes?: number;
  scriptText?: Record<string, string>;
  body?: (locale: string) => string;
  messages?: Record<string, unknown>;
};

function project(options: Options = {}): string {
  const root = mkdtempSync(join(tmpdir(), "size-scripts-"));
  made.push(root);
  mkdirSync(join(root, "out", "_next"), { recursive: true });
  mkdirSync(join(root, "messages"));
  writeFileSync(join(root, "out", "_next", "a.js"), options.scriptBytes ? randomBytes(options.scriptBytes) : "console.log(1)");
  for (const [path, text] of Object.entries(options.scriptText ?? {})) writeFileSync(join(root, "out", "_next", path), text);
  for (const page of pages) {
    if (options.skip?.includes(page)) continue;
    const locale = page.split("/")[0];
    mkdirSync(join(root, "out", page, ".."), { recursive: true });
    const own = locale in messages ? (messages as Record<string, { home: { placeholder: string } }>)[locale].home.placeholder : "";
    const script = options.scriptText ? `/_next/${Object.keys(options.scriptText)[0]}` : "/_next/a.js";
    writeFileSync(join(root, "out", page), html(options.body ? options.body(locale) : `<p>${own}</p>`, script));
  }
  for (const [locale, tree] of Object.entries(options.messages ?? messages)) {
    writeFileSync(join(root, "messages", `${locale}.json`), JSON.stringify(tree));
  }
  return root;
}

function run(script: string, cwd: string) {
  const result = spawnSync(process.execPath, [script], { cwd, encoding: "utf8" });
  return { status: result.status, out: result.stdout + result.stderr };
}

afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("pnpm size (criterion 30)", () => {
  it("passes when all five routes exist and are small", () => {
    const result = run(sizeScript, project());
    expect(result.status).toBe(0);
    for (const page of pages) expect(result.out).toContain(`out/${page}`);
  });

  it.each(pages)("fails when %s is missing", (page) => {
    const result = run(sizeScript, project({ skip: [page] }));
    expect(result.status).toBe(1);
    expect(result.out).toContain(`out/${page} is missing`);
  });

  it("warns, and still passes, between 150 KB and 200 KB", () => {
    const result = run(sizeScript, project({ scriptBytes: 170 * 1024 }));
    expect(result.status).toBe(0);
    expect(result.out).toContain("WARN");
  });

  it("fails over 200 KB", () => {
    const result = run(sizeScript, project({ scriptBytes: 210 * 1024 }));
    expect(result.status).toBe(1);
    expect(result.out).toContain("OVER");
  });
});

describe("pnpm check:leak (criterion 29)", () => {
  it("passes when each page holds only its own language", () => {
    const result = run(leakScript, project());
    expect(result.status).toBe(0);
    expect(result.out).toContain("no language page carries another language's messages");
  });

  it("fails, naming both languages and the file, when a hi page carries a kn message", () => {
    const result = run(leakScript, project({ body: (l) => (l === "hi" ? `<p>${messages.hi.home.placeholder}${messages.kn.home.placeholder}</p>` : `<p>${(messages as Record<string, typeof messages.en>)[l]?.home.placeholder ?? ""}</p>`) }));
    expect(result.status).toBe(1);
    expect(result.out).toContain("hi page loads a kn message");
    expect(result.out).toContain("out/hi/index.html");
  });

  it("fails when another language's message is in a script the page loads", () => {
    const result = run(leakScript, project({ scriptText: { "chunk.js": `var m="${messages.te.home.placeholder}"` } }));
    expect(result.status).toBe(1);
    expect(result.out).toContain("out/_next/chunk.js");
  });

  it("fails when English words appear on a Kannada page", () => {
    const result = run(leakScript, project({ body: (l) => (l === "kn" ? `<p>${messages.en.home.placeholder}</p>` : "<p></p>") }));
    expect(result.status).toBe(1);
    expect(result.out).toContain("kn page loads a en message");
  });

  it("does not call an untranslated value a leak: TODO-translate shows the English text", () => {
    const todo = { ...messages, hi: { home: { placeholder: `TODO-translate: ${messages.en.home.placeholder}` } } };
    const result = run(
      leakScript,
      project({ messages: todo, body: (l) => (l === "hi" ? `<p>${messages.en.home.placeholder}</p>` : `<p>${(messages as Record<string, typeof messages.en>)[l]?.home.placeholder ?? ""}</p>`) }),
    );
    expect(result.status).toBe(0);
  });

  it("fails closed when no page shows any word of its own (an empty or stale out/)", () => {
    const result = run(leakScript, project({ body: () => "<p></p>" }));
    expect(result.status).toBe(1);
    expect(result.out).toContain("proves nothing");
  });

  it("fails when a language page is missing", () => {
    const result = run(leakScript, project({ skip: ["kn/index.html"] }));
    expect(result.status).toBe(1);
    expect(result.out).toContain("out/kn/index.html is missing");
  });
});

// Added by test-engineer after mutation testing: each test fails when the rule it names is removed from the script.
describe("pnpm size, gaps found by mutation (criterion 30)", () => {
  /** A project whose en page is rewritten with the given head markup and extra files in out/_next. */
  function withEnPage(scriptTags: string, files: Record<string, Buffer | string> = {}): string {
    const root = project();
    for (const [name, content] of Object.entries(files)) writeFileSync(join(root, "out", "_next", name), content);
    writeFileSync(join(root, "out", "en", "index.html"), `<html><body><p>English home line here</p>${scriptTags}</body></html>`);
    return root;
  }

  it("says nothing about the 150 KB target below it: ok, no WARN", () => {
    const result = run(sizeScript, project({ scriptBytes: 140 * 1024 }));
    expect(result.status).toBe(0);
    expect(result.out).not.toContain("WARN");
    expect(result.out).not.toContain("OVER");
  });

  it("marks a page over 200 KB as OVER and not as WARN", () => {
    const result = run(sizeScript, project({ scriptBytes: 210 * 1024 }));
    const line = result.out.split("\n").find((l) => l.includes("out/index.html"))!;
    expect(line).toContain("OVER");
    expect(line).not.toContain("WARN");
  });

  it("adds up every script a page loads", () => {
    const root = withEnPage('<script src="/_next/b1.js"></script><script src="/_next/b2.js"></script>', {
      "b1.js": randomBytes(120 * 1024),
      "b2.js": randomBytes(120 * 1024),
    });
    const result = run(sizeScript, root);
    expect(result.status).toBe(1);
    expect(result.out).toMatch(/OVER\s+\d+\.\d KB\s+out\/en\/index\.html/);
  });

  it("counts gzipped bytes, not raw bytes", () => {
    const root = withEnPage('<script src="/_next/zeros.js"></script>', { "zeros.js": Buffer.alloc(900 * 1024) });
    const result = run(sizeScript, root);
    expect(result.status).toBe(0);
    expect(result.out).not.toContain("OVER");
  });

  it("does not count a nomodule script", () => {
    const root = withEnPage('<script src="/_next/legacy.js" nomodule=""></script><script src="/_next/a.js"></script>', {
      "legacy.js": randomBytes(300 * 1024),
    });
    const result = run(sizeScript, root);
    expect(result.status).toBe(0);
  });

  it("fails closed on a page with no script at all", () => {
    const result = run(sizeScript, withEnPage(""));
    expect(result.status).toBe(1);
    expect(result.out).toContain("out/en/index.html: no scripts found");
  });

  it("fails closed on a script it cannot find, instead of counting it as zero", () => {
    const result = run(sizeScript, withEnPage('<script src="/_next/gone.js"></script>'));
    expect(result.status).toBe(1);
    expect(result.out).toContain('cannot measure script "/_next/gone.js"');
  });

  it("fails with a clear message when there is no out/ folder", () => {
    const root = mkdtempSync(join(tmpdir(), "size-scripts-"));
    made.push(root);
    const result = run(sizeScript, root);
    expect(result.status).toBe(1);
    expect(result.out).toContain("No out/ folder");
  });
});

describe("pnpm check:leak, gaps found by mutation (criterion 29)", () => {
  it("finds a message written inside a script with its quotes escaped", () => {
    const quoted = 'Kannada says "hello" here';
    const kn = { home: { placeholder: quoted } };
    const root = project({
      messages: { ...messages, kn },
      scriptText: { "chunk.js": `var m="${quoted.replace(/"/g, '\\"')}"` },
      body: (l) => (l === "kn" ? `<p>${quoted.replace(/"/g, "&quot;")}</p>` : `<p>${(messages as Record<string, typeof messages.en>)[l]?.home.placeholder ?? ""}</p>`),
    });
    const result = run(leakScript, root);
    expect(result.status).toBe(1);
    expect(result.out).toContain("out/_next/chunk.js");
  });

  it("finds a leak of the Telugu message on the English page, and of the English message on the Telugu page", () => {
    const page = (l: string, extra: string) => `<p>${(messages as Record<string, typeof messages.en>)[l]?.home.placeholder ?? ""}${extra}</p>`;
    const te = run(leakScript, project({ body: (l) => (l === "en" ? page(l, messages.te.home.placeholder) : page(l, "")) }));
    expect(te.status).toBe(1);
    expect(te.out).toContain("en page loads a te message");
    const en = run(leakScript, project({ body: (l) => (l === "te" ? page(l, messages.en.home.placeholder) : page(l, "")) }));
    expect(en.status).toBe(1);
    expect(en.out).toContain("te page loads a en message");
  });
});
