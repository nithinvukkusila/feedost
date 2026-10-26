// Criterion 66 (F2) and criterion 43 (F3): components and pages hold no user-visible words of their
// own, and the product name is typed only in src/config/brand.ts.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";
import { findOwnWords, walk } from "@/test-utils/find-own-words";

const root = process.cwd();
const uiDir = join(root, "src", "components", "ui");

describe("components hold no words of their own (criterion 66)", () => {
  const files = readdirSync(uiDir).filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"));

  it("finds the fifteen component files: the eight from F2a, the five from F2b (StudentStrip replaced by SummaryBar in UX-review-fixes-2), SelectField from R0-2 and Check from R1-8", () => {
    expect(files).toHaveLength(15);
    expect(files.sort()).toEqual(
      ["banner.tsx", "bottom-nav.tsx", "button.tsx", "check.tsx", "field.tsx", "row.tsx", "segmented.tsx", "select-field.tsx", "sheet.tsx", "slip.tsx", "stamp.tsx", "status-tag.tsx", "summary-bar.tsx", "switch.tsx", "tabs.tsx"].sort(),
    );
  });

  it.each(files)("%s shows and speaks only what it is given", (name) => {
    expect(findOwnWords(readFileSync(join(uiDir, name), "utf8"), name)).toEqual([]);
  });
});

/** Criterion 43: every .tsx under src/app (not dev) and src/components (not ui), tests aside. */
function pageAndFeatureFiles(base: string): string[] {
  const app = join(base, "src", "app");
  const components = join(base, "src", "components");
  const exists = (dir: string) => {
    try {
      return readdirSync(dir).length >= 0;
    } catch {
      return false;
    }
  };
  return [...(exists(app) ? walk(app) : []), ...(exists(components) ? walk(components) : [])]
    .filter((path) => path.endsWith(".tsx") && !/\.(test|spec)\.tsx$/.test(path))
    .filter((path) => !path.startsWith(join(app, "dev") + "/") && !path.startsWith(join(components, "ui") + "/"));
}

function wordsIn(base: string): string[] {
  return pageAndFeatureFiles(base).flatMap((path) =>
    findOwnWords(readFileSync(path, "utf8"), path).map((word) => `${path.slice(base.length + 1)}: ${word}`),
  );
}

describe("pages and feature components hold no words of their own (criterion 43)", () => {
  it("finds the real files, so the scan means something", () => {
    const names = pageAndFeatureFiles(root).map((path) => path.slice(root.length + 1));
    expect(names).toContain("src/app/[locale]/page.tsx");
    expect(names).toContain("src/app/[locale]/layout.tsx");
    expect(names).toContain("src/app/(jump)/page.tsx");
    expect(names).toContain("src/components/shell/html-shell.tsx");
    expect(names).toContain("src/components/i18n/client-messages.tsx");
    expect(names.some((name) => name.startsWith("src/app/dev/") || name.startsWith("src/components/ui/"))).toBe(false);
  });

  it("finds no English or other word typed in them", () => {
    expect(wordsIn(root)).toEqual([]);
  });

  it("does flag a word typed in a page, and skips dev, ui and test files", () => {
    const fake = mkdtempSync(join(tmpdir(), "no-strings-"));
    try {
      const put = (path: string, source: string) => {
        mkdirSync(join(fake, path, ".."), { recursive: true });
        writeFileSync(join(fake, path), source);
      };
      put("src/app/page.tsx", "export default function P() { return <p>Hello</p>; }\n");
      put("src/components/feature/card.tsx", 'export const C = () => <button aria-label="Close" />;\n');
      put("src/app/dev/page.dev.tsx", "export const D = () => <p>Hello</p>;\n");
      put("src/app/dev/other.tsx", "export const D = () => <p>Hello</p>;\n");
      put("src/components/ui/thing.tsx", "export const T = () => <p>Hello</p>;\n");
      put("src/components/feature/card.test.tsx", "export const T = () => <p>Hello</p>;\n");
      expect(wordsIn(fake).sort()).toEqual(['src/app/page.tsx: text "Hello"', 'src/components/feature/card.tsx: aria-label="Close"']);
    } finally {
      rmSync(fake, { recursive: true, force: true });
    }
  });
});

describe("the product name (criterion 66)", () => {
  it("is typed only in src/config/brand.ts", () => {
    const allowed = join(root, "src", "config", "brand.ts");
    const folders = ["src", "e2e", "messages", "scripts", "public"].map((d) => join(root, d));
    const offenders = folders
      .flatMap((dir) => walk(dir))
      .filter((path) => path !== allowed && /\.(tsx?|mts|mjs|js|json|css|txt|html|md)$/.test(path))
      // src/CLAUDE.md is a guide for people working in the repo, not app code.
      .filter((path) => !path.endsWith("CLAUDE.md"))
      .filter((path) => readFileSync(path, "utf8").includes(brand.name))
      .map((path) => path.slice(root.length + 1));
    expect(offenders).toEqual([]);
  });
});
