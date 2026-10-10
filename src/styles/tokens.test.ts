import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { group, parseTokens, readTokens, resolve } from "./read-tokens";

const tokens = readTokens();
const css = readFileSync(join(process.cwd(), "src", "styles", "tokens.css"), "utf8");

/** The colour table in docs/DESIGN.md: | `name` | `#HEX` | use | */
function designColours(): Record<string, string> {
  const doc = readFileSync(join(process.cwd(), "docs", "DESIGN.md"), "utf8");
  const section = doc.slice(doc.indexOf("## Colour tokens"), doc.indexOf("## What each colour means"));
  const out: Record<string, string> = {};
  for (const row of section.matchAll(/^\|\s*`([\w-]+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`/gm)) {
    out[row[1]] = row[2].toUpperCase();
  }
  return out;
}

describe("parseTokens", () => {
  it("reads declarations from every @theme block and skips comments", () => {
    const parsed = parseTokens("/* --color-x: red; */ @theme { --a: 1px; } @theme inline { --b: var(--a), x; }");
    expect(parsed).toEqual({ "--a": "1px", "--b": "var(--a), x" });
  });
});

describe("colour tokens (criterion 1)", () => {
  const colours = group(tokens, "--color-");
  const doc = designColours();

  it("finds all 17 colours in docs/DESIGN.md", () => {
    expect(Object.keys(doc)).toHaveLength(17);
    expect(Object.keys(doc)[0]).toBe("cloth");
    expect(Object.keys(doc).at(-1)).toBe("bubble");
  });

  it("has every documented colour with the same name and hex value", () => {
    for (const [name, hex] of Object.entries(doc)) {
      expect(colours[name]?.toUpperCase(), name).toBe(hex);
    }
  });

  it("adds exactly two colours beyond the documented ones", () => {
    const extras = Object.keys(colours).filter((name) => !(name in doc));
    expect(extras.sort()).toEqual(["blue-pressed", "sheet-ground"]);
  });

  it("removes the default Tailwind palette", () => {
    expect(tokens["--color-*"]).toBe("initial");
  });
});

describe("radius tokens (criterion 5)", () => {
  it("offers only square, 4px, 6px, full circle and the message bubble's 18px (R0-2)", () => {
    expect(tokens["--radius-*"]).toBe("initial");
    expect(group(tokens, "--radius-")).toEqual({ none: "0px", sm: "4px", tab: "6px", bubble: "18px", full: "9999px" });
  });

  it("records the bubble radius in docs/DESIGN.md as an exception for the message preview only", () => {
    const doc = readFileSync(join(process.cwd(), "docs", "DESIGN.md"), "utf8");
    const shape = doc.slice(doc.indexOf("## Shape and depth"), doc.indexOf("## Components"));
    expect(shape).toMatch(/WhatsApp message preview bubble[^\n]*18px[^\n]*4px at its top-left/);
  });
});

describe("shadow tokens (criterion 6)", () => {
  const shadows = group(tokens, "--shadow-");

  it("removes default shadows and blurs", () => {
    for (const name of ["--shadow-*", "--inset-shadow-*", "--drop-shadow-*", "--text-shadow-*", "--blur-*"]) {
      expect(tokens[name], name).toBe("initial");
    }
  });

  it("defines the four solid offsets, and one more for the error banner", () => {
    expect(shadows).toEqual({
      button: "5px 5px 0 var(--color-ink)",
      record: "5px 5px 0 var(--color-ink-label)",
      slip: "6px 6px 0 var(--color-ink)",
      round: "3px 3px 0 var(--color-ink)",
      // Spec open question 17a: allowed by name, for the error banner only.
      "banner-error": "5px 5px 0 var(--color-cloth)",
    });
  });

  it("gives every shadow a zero blur and no spread", () => {
    for (const [name, value] of Object.entries(shadows)) {
      const parts = resolve(tokens, value).split(/\s+/);
      expect(parts, name).toHaveLength(4);
      expect(parts[2], name).toBe("0");
      expect(parts[3], name).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("has cloth-deep available as the shadow colour on cloth", () => {
    expect(tokens["--color-cloth-deep"]).toBe("#5E0D11");
  });

  it("contains no gradient and no blur anywhere in the token file", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/gradient\(/);
    expect(code).not.toMatch(/blur\(/);
  });
});

describe("size tokens (criterion 7)", () => {
  it("names the three minimums in rem: 44, 48 and 64px", () => {
    expect(group(tokens, "--spacing-")).toEqual({ tap: "2.75rem", control: "3rem", row: "4rem" });
  });
});

describe("text size tokens (criterion 4)", () => {
  it("removes the only default size below 14px", () => {
    expect(tokens["--text-xs"]).toBe("initial");
  });

  it("defines no pixel font size", () => {
    for (const [name, value] of Object.entries(tokens)) {
      if (name.startsWith("--text-")) expect(value, name).not.toMatch(/px/);
    }
  });
});

describe("font stacks (criterion 15)", () => {
  const fonts = group(tokens, "--font-");

  it("has a stack for Latin text, labels and each Indian script", () => {
    expect(Object.keys(fonts).sort()).toEqual(["hi", "kn", "mono", "sans", "te"]);
  });

  it("ends every stack in 'Anek Latin', system-ui and a generic family", () => {
    for (const [name, value] of Object.entries(fonts)) {
      expect(value, name).toMatch(/'Anek Latin', system-ui, (sans-serif|monospace)$/);
    }
  });

  it("puts Bricolage Grotesque straight after DM Mono so it draws the rupee sign", () => {
    expect(fonts.mono.startsWith("var(--font-dm-mono), var(--font-bricolage),")).toBe(true);
  });

  it("starts each script stack with its own Anek face, then Bricolage", () => {
    expect(fonts.hi.startsWith("var(--font-anek-devanagari), var(--font-bricolage),")).toBe(true);
    expect(fonts.kn.startsWith("var(--font-anek-kannada), var(--font-bricolage),")).toBe(true);
    expect(fonts.te.startsWith("var(--font-anek-telugu), var(--font-bricolage),")).toBe(true);
  });
});
