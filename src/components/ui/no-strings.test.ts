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

/**
 * Words a component would show or speak by itself: JSX text, string children, spoken attributes.
 * A string is followed through `a ? "x" : "y"`, `a && "x"`, `a ?? "x"`, brackets, template strings,
 * and a module-level `const NAME = "x"` used by name.
 * Not followed: a string returned by a function, held in an object or array, or imported from
 * another file. Those need a reviewer's eye.
 */
export function findOwnWords(source: string, fileName = "component.tsx"): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];

  // Module-level constants that are plain strings.
  const constants = new Map<string, ts.Expression>();
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const decl of statement.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer) constants.set(decl.name.text, decl.initializer);
    }
  }

  /** Every literal string an expression can turn into. */
  const words = (expr: ts.Expression | undefined, seen = new Set<string>()): string[] => {
    if (!expr) return [];
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text];
    if (ts.isTemplateExpression(expr)) return [expr.head.text, ...expr.templateSpans.map((span) => span.literal.text)];
    if (ts.isConditionalExpression(expr)) return [...words(expr.whenTrue, seen), ...words(expr.whenFalse, seen)];
    if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isNonNullExpression(expr) || ts.isSatisfiesExpression(expr)) {
      return words(expr.expression, seen);
    }
    if (ts.isBinaryExpression(expr)) {
      const op = expr.operatorToken.kind;
      const joins =
        op === ts.SyntaxKind.AmpersandAmpersandToken ||
        op === ts.SyntaxKind.BarBarToken ||
        op === ts.SyntaxKind.QuestionQuestionToken ||
        op === ts.SyntaxKind.PlusToken;
      return joins ? [...words(expr.left, seen), ...words(expr.right, seen)] : [];
    }
    if (ts.isIdentifier(expr) && constants.has(expr.text) && !seen.has(expr.text)) {
      seen.add(expr.text);
      return words(constants.get(expr.text), seen);
    }
    return [];
  };

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && hasLetter(node.text)) {
      found.push(`text "${node.text.trim()}"`);
    } else if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
      for (const text of words(node.expression)) if (hasLetter(text)) found.push(`text "${text}"`);
    } else if (ts.isJsxAttribute(node) && spoken.has(node.name.getText(file)) && node.initializer) {
      const value = ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer;
      for (const text of words(value)) if (hasLetter(text)) found.push(`${node.name.getText(file)}="${text}"`);
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

  it("follows a string through a condition, a fallback and a template", () => {
    expect(findOwnWords('const a = <button>{open ? "Close" : "Open"}</button>;')).toEqual(['text "Close"', 'text "Open"']);
    expect(findOwnWords('const a = <p>{busy && "Saving"}</p>;')).toEqual(['text "Saving"']);
    expect(findOwnWords('const a = <p>{label ?? "Untitled"}</p>;')).toEqual(['text "Untitled"']);
    expect(findOwnWords("const a = <p>{`Step ${n}`}</p>;")).toEqual(['text "Step "']);
    expect(findOwnWords('const a = <button aria-label={open ? "Close" : label} />;')).toEqual(['aria-label="Close"']);
  });

  it("follows a module constant used by name", () => {
    expect(findOwnWords('const LABEL = "Close";\nconst a = <button aria-label={LABEL} />;')).toEqual(['aria-label="Close"']);
    expect(findOwnWords('const WORD = "Paid";\nconst a = <span>{WORD}</span>;')).toEqual(['text "Paid"']);
    expect(findOwnWords('const A = B;\nconst B = "Loop";\nconst a = <span>{A}</span>;')).toEqual(['text "Loop"']);
    // Class-name constants are not words shown to anyone.
    expect(findOwnWords('const base = "flex items-center";\nconst a = <span className={base}>{children}</span>;')).toEqual([]);
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

  it("finds the thirteen component files: the eight from F2a and the five from F2b", () => {
    expect(files).toHaveLength(13);
    expect(files.sort()).toEqual(
      ["banner.tsx", "bottom-nav.tsx", "button.tsx", "field.tsx", "row.tsx", "segmented.tsx", "sheet.tsx", "slip.tsx", "stamp.tsx", "status-tag.tsx", "student-strip.tsx", "switch.tsx", "tabs.tsx"].sort(),
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
