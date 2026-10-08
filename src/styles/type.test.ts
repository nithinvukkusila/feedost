import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(join(process.cwd(), "src", "styles", name), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const type = read("type.css");
const states = read("states.css");

/** Declarations of the first rule whose selector list contains `selector`. */
function rule(css: string, selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|[},{\\s])${escaped}\\s*(?:,[^{]*)?\\{([^{}]*)\\}`, "m").exec(css);
  if (!m) throw new Error(`No rule for ${selector}`);
  return Object.fromEntries(
    [...m[1].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map((d) => [d[1], d[2].trim()]),
  );
}

const utility = (name: string) => rule(type, `@utility ${name}`);
const base = rule(type, ":root");
const indic = rule(type, '[lang|="hi"]');

describe("type roles (criterion 3)", () => {
  it("headline: Bricolage 800, -0.04em, line-height 0.9 to 0.95", () => {
    expect(base["--script-font"]).toBe("var(--font-sans)");
    expect(base["--headline-weight"]).toBe("800");
    expect(base["--headline-tracking"]).toBe("-0.04em");
    expect(Number(base["--headline-leading"])).toBeGreaterThanOrEqual(0.9);
    expect(Number(base["--headline-leading"])).toBeLessThanOrEqual(0.95);
    expect(utility("type-headline")).toMatchObject({
      "font-family": "var(--script-font)",
      "font-weight": "var(--headline-weight)",
      "letter-spacing": "var(--headline-tracking)",
      "line-height": "var(--headline-leading)",
    });
  });

  it("reading text: 15, 16 and 18px at line-height 1.4", () => {
    expect([base["--body-sm-size"], base["--body-size"], base["--body-lg-size"]]).toEqual([
      "0.9375rem",
      "1rem",
      "1.125rem",
    ]);
    expect(base["--body-leading"]).toBe("1.4");
    for (const name of ["type-body-sm", "type-body", "type-body-lg"]) {
      expect(utility(name)["font-family"], name).toBe("var(--script-font)");
      expect(utility(name)["line-height"], name).toBe("var(--body-leading)");
    }
  });

  it("caption: 14px at 1.35, the smallest reading text", () => {
    expect(base["--caption-size"]).toBe("0.875rem");
    expect(base["--caption-leading"]).toBe("1.35");
    expect(utility("type-caption")).toMatchObject({
      "font-family": "var(--script-font)",
      "font-size": "var(--caption-size)",
      "line-height": "var(--caption-leading)",
      "letter-spacing": "0em",
    });
  });

  it("label: DM Mono 500, 14px, uppercase, 0.04em", () => {
    expect(base["--script-label-font"]).toBe("var(--font-mono)");
    expect(base["--label-size"]).toBe("0.875rem");
    expect(base["--label-weight"]).toBe("500");
    expect(base["--label-tracking"]).toBe("0.04em");
    expect(base["--label-transform"]).toBe("uppercase");
    expect(utility("type-label")).toMatchObject({
      "font-family": "var(--script-label-font)",
      "text-transform": "var(--label-transform)",
      "letter-spacing": "var(--label-tracking)",
    });
  });
});

describe("Hindi, Kannada and Telugu (criterion 13)", () => {
  it("overrides apply to all three languages", () => {
    expect(type).toMatch(/\[lang\|="hi"\],\s*\[lang\|="kn"\],\s*\[lang\|="te"\]\s*\{/);
  });

  it("headline weight 700, line-height at least 1.25, no letter-spacing", () => {
    expect(indic["--headline-weight"]).toBe("700");
    expect(Number(indic["--headline-leading"])).toBeGreaterThanOrEqual(1.25);
    expect(indic["--headline-tracking"]).toBe("0em");
  });

  it("reading text 17px at 1.6, caption 15px at 1.5", () => {
    expect(indic["--body-size"]).toBe("1.0625rem");
    expect(indic["--body-leading"]).toBe("1.6");
    expect(indic["--caption-size"]).toBe("0.9375rem");
    expect(indic["--caption-leading"]).toBe("1.5");
  });

  it("labels are weight 600 at 15px with no capitals and no letter-spacing", () => {
    expect(indic["--label-size"]).toBe("0.9375rem");
    expect(indic["--label-weight"]).toBe("600");
    expect(indic["--label-transform"]).toBe("none");
    expect(indic["--label-tracking"]).toBe("0em");
  });

  it("stamps lose their capitals and letter-spacing", () => {
    expect(indic["--stamp-transform"]).toBe("none");
    expect(indic["--stamp-tracking"]).toBe("0em");
  });

  it.each([
    ["hi", "var(--font-hi)"],
    ["kn", "var(--font-kn)"],
    ["te", "var(--font-te)"],
  ])("%s uses its own Anek stack for text and labels", (lang, stack) => {
    const own = [...type.matchAll(new RegExp(`\\[lang\\|="${lang}"\\]\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]).join("");
    expect(own).toContain(`--script-font: ${stack};`);
    expect(own).toContain(`--script-label-font: ${stack};`);
  });

  it("every variable a script overrides has a default, so a nested English block resets it", () => {
    for (const name of Object.keys(indic)) expect(base[name], name).toBeDefined();
  });
});

describe("amounts never follow the script (criteria 14 and 40)", () => {
  it("headline amounts are fixed to Bricolage 800 at -0.04em", () => {
    const amount = utility("type-amount");
    expect(amount["font-family"]).toBe("var(--font-sans)");
    expect(amount["font-weight"]).toBe("800");
    expect(amount["letter-spacing"]).toBe("-0.04em");
    expect(amount["overflow-wrap"]).toBe("anywhere");
  });

  it("row amounts are fixed to DM Mono", () => {
    const row = utility("type-amount-row");
    expect(row["font-family"]).toBe("var(--font-mono)");
    expect(row["font-weight"]).toBe("500");
  });

  it("neither amount role reads a variable", () => {
    for (const name of ["type-amount", "type-amount-row"]) {
      const used = Object.entries(utility(name))
        .filter(([prop]) => !prop.startsWith("--"))
        .flatMap(([, value]) => [...value.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]));
      expect(used.filter((v) => !v.startsWith("--font-")), name).toEqual([]);
    }
  });
});

describe("sizes (criterion 4)", () => {
  it("uses rem only, and nothing below 0.875rem (14px)", () => {
    expect(type).not.toMatch(/font-size:\s*[\d.]+px/);
    const sizes = [...type.matchAll(/(?:-size|font-size):\s*([\d.]+)rem/g)].map((m) => Number(m[1]));
    expect(sizes.length).toBeGreaterThan(8);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(0.875);
  });
});

describe("states (criteria 6, 21 and 69)", () => {
  it("animates only the stamp (ring and words), once, and only where motion is allowed", () => {
    expect([...states.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])).toEqual(["stamp-land", "stamp-settle"]);
    const animations = [...states.matchAll(/prefers-reduced-motion:\s*no-preference\)\s*\{\s*animation: ([^;]+);/g)].map((m) => m[1]);
    expect(animations).toEqual(["stamp-land 200ms ease-out 1 both", "stamp-settle 200ms ease-out 1 both"]);
    // No animation is declared outside the reduced-motion guard, and nothing transitions here.
    expect(states.match(/animation:/g)).toHaveLength(2);
    expect(states).not.toMatch(/transition/);
  });

  it("the focus ring is 3px, 4px from the edge, blue unless the ground says otherwise", () => {
    expect(rule(states, "@utility ground-ring")).toEqual({
      outline: "3px solid var(--ground-ring)",
      "outline-offset": "4px",
    });
    expect(rule(states, ":root")["--ground-ring"]).toBe("var(--color-blue)");
  });

  it("cloth and dark grounds turn the ring yellow; cloth also deepens the shadow", () => {
    expect(rule(states, "@utility on-cloth-ground")).toEqual({
      "--ground-shadow": "var(--color-cloth-deep)",
      "--ground-ring": "var(--color-highlight)",
    });
    expect(rule(states, "@utility on-dark-ground")["--ground-ring"]).toBe("var(--color-highlight)");
    expect(rule(states, "@utility on-paper-ground")["--ground-ring"]).toBe("var(--color-blue)");
  });

  it("the press moves by the shadow's own offset and removes the shadow", () => {
    expect(rule(states, "@utility press-button")).toEqual({ translate: "5px 5px", "box-shadow": "none" });
    expect(rule(states, "@utility press-round")).toEqual({ translate: "3px 3px", "box-shadow": "none" });
  });

  it("has no blur and no gradient", () => {
    expect(states + type).not.toMatch(/blur\(|gradient\(/);
  });
});
