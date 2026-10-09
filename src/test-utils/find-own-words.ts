// Finds the words a component would show or speak by itself. Used by the "no words" scans.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

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

export function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

