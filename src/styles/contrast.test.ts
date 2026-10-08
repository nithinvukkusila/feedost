import { describe, expect, it } from "vitest";
import { contrast, luminance, markPairs, reportedPairs, textPairs } from "./contrast";
import { group, readTokens } from "./read-tokens";

const colours = group(readTokens(), "--color-");

function ratio(fg: string, bg: string): number {
  if (!(fg in colours) || !(bg in colours)) throw new Error(`Unknown colour token in pair ${fg} on ${bg}`);
  return contrast(colours[fg], colours[bg]);
}

describe("contrast", () => {
  it("gives 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrast("#1B2B8F", "#1B2B8F")).toBe(1);
  });

  it("does not depend on the order of the two colours", () => {
    expect(contrast("#FAF3D3", "#1A1410")).toBe(contrast("#1A1410", "#FAF3D3"));
  });

  it("rejects anything that is not a six-digit hex colour", () => {
    expect(() => luminance("#FFF")).toThrow();
    expect(() => luminance("red")).toThrow();
  });
});

describe("pairs the components use (criterion 8)", () => {
  it.each(textPairs)("text $fg on $bg reaches 4.5:1 ($use)", ({ fg, bg }) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(markPairs)("ring or outline $fg on $bg reaches 3:1 ($use)", ({ fg, bg }) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
  });

  // These fall short. They are listed so the shortfall is on record; the answer is not to change a token.
  it.each(reportedPairs)("reported: $fg on $bg is below $min:1 ($use)", ({ fg, bg, min }) => {
    expect(ratio(fg, bg)).toBeLessThan(min);
  });

  it("never uses a reported text pair in the list of pairs in use", () => {
    for (const bad of reportedPairs.filter((p) => p.min === 4.5)) {
      expect(textPairs.some((p) => p.fg === bad.fg && p.bg === bad.bg)).toBe(false);
    }
  });
});
