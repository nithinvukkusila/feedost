// Criterion 66: design-system components hold no user-visible words of their own, and the product
// name is typed only in src/config/brand.ts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { brand } from "@/config/brand";

const root = process.cwd();
const uiDir = join(root, "src", "components", "ui");

// Attributes whose value is read out or shown to the user.
const spoken = new Set([
  "aria-label",
  "aria-description",
  "aria-roledescription",
  "aria-valuetext",
  "aria-placeholder",
  "title",
  "placeholder",
  "alt",
  "label",
]);

const hasLetter = (text: string) => /\p{L}/u.test(text);

/** Words a component would show or speak by itself: JSX text, string children, spoken attributes. */
export function findOwnWords(source: string, fileName = "component.tsx"): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && hasLetter(node.text)) {
      found.push(`text "${node.text.trim()}"`);
    } else if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isStringLiteral(node.expression) || ts.isNoSubstitutionTemplateLiteral(node.expression)) &&
      !ts.isJsxAttribute(node.parent) &&
      hasLetter(node.expression.text)
    ) {
      found.push(`text "${node.expression.text}"`);
    } else if (ts.isJsxAttribute(node) && spoken.has(node.name.getText(file)) && node.initializer) {
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      if (value && (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) && hasLetter(value.text)) {
        found.push(`${node.name.getText(file)}="${value.text}"`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe("findOwnWords", () => {
  it("flags JSX text, string children and spoken attributes", () => {
    expect(findOwnWords("const a = <button>Save</button>;")).toEqual(['text "Save"']);
    expect(findOwnWords('const a = <p>{"Saved"}</p>;')).toEqual(['text "Saved"']);
    expect(findOwnWords('const a = <button aria-label="Close" />;')).toEqual(['aria-label="Close"']);
    expect(findOwnWords('const a = <input placeholder={"name@bank"} />;')).toEqual(['placeholder="name@bank"']);
    expect(findOwnWords("const a = <p>जमा</p>;")).toEqual(['text "जमा"']);
  });

  it("allows passed-in text, class names, roles, spacing and comments", () => {
    const source = `
      const a = (
        <button type="button" role="tab" className="type-label" aria-hidden="true" aria-label={label}>
          {/* a comment with words */}
          {children}{" "}
          <span>{count}</span>
        </button>
      );`;
    expect(findOwnWords(source)).toEqual([]);
  });
});

describe("components hold no words of their own (criterion 66)", () => {
  const files = readdirSync(uiDir).filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"));

  it("finds the eight component files", () => {
    expect(files.sort()).toEqual(
      ["button.tsx", "field.tsx", "row.tsx", "sheet.tsx", "slip.tsx", "stamp.tsx", "status-tag.tsx", "tabs.tsx"].sort(),
    );
  });

  it.each(files)("%s shows and speaks only what it is given", (name) => {
    expect(findOwnWords(readFileSync(join(uiDir, name), "utf8"), name)).toEqual([]);
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
