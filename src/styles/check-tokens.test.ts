import { describe, expect, it } from "vitest";
import { findViolations, isScanned } from "../../scripts/check-tokens.mjs";

const bad: [string, string][] = [
  ["a hex colour in a class", '<div className="bg-[#A81C22]" />'],
  ["a hex colour in a style", "color: #1A1410;"],
  ["a short hex colour", 'const c = "#fff";'],
  ["rgb()", "background: rgb(26, 20, 16);"],
  ["hsl()", "color: hsl(0 70% 40%);"],
  ["oklch()", "color: oklch(0.5 0.2 20);"],
  ["an arbitrary pixel text size", '<p className="text-[13px]" />'],
  ["an arbitrary rem text size", '<p className="text-[0.8rem]" />'],
  ["font-size in px", "font-size: 13px;"],
  ["fontSize as a number", "style={{ fontSize: 13 }}"],
  ["fontSize as a px string", 'style={{ fontSize: "13px" }}'],
  ["an arbitrary radius", '<div className="rounded-[10px]" />'],
  ["an arbitrary corner radius", '<div className="rounded-t-[10px]" />'],
  ["an arbitrary shadow", '<div className="shadow-[0_4px_12px_black]" />'],
  ["a blur class", '<div className="blur-sm" />'],
  ["a backdrop blur", '<div className="backdrop-blur" />'],
  ["a blur filter", "filter: blur(4px);"],
  ["a drop shadow", '<div className="drop-shadow-md" />'],
  ["a Tailwind 4 gradient", '<div className="bg-linear-to-r" />'],
  ["a Tailwind 3 gradient", '<div className="bg-gradient-to-r" />'],
  ["a radial gradient", '<div className="bg-radial" />'],
  ["a CSS gradient", "background-image: linear-gradient(red, blue);"],
];

const good: [string, string][] = [
  ["token classes", '<button className="bg-blue text-slip shadow-button rounded-sm text-lg" />'],
  ["a rem font size", "font-size: 0.875rem;"],
  ["a link to an anchor", '<a href="#top">'],
  ["an HTML entity", "<span>&#8377;1,200</span>"],
  ["a blur handler", "<input onBlur={handleBlur} />"],
  ["calling blur() on an element", "input.blur();"],
  ["a pixel border", "border-bottom-width: 2px;"],
  ["an arbitrary grid template", '<div className="grid-cols-[minmax(0,1fr)_auto]" />'],
  ["a variable shadow colour", '<button className="shadow-(color:--ground-shadow)" />'],
];

describe("check-tokens detector (criterion 2)", () => {
  it.each(bad)("flags %s", (_name, source) => {
    expect(findViolations(source).length).toBeGreaterThan(0);
  });

  it.each(good)("allows %s", (_name, source) => {
    expect(findViolations(source)).toEqual([]);
  });

  it("reports the line number and the rule", () => {
    const found = findViolations("const a = 1;\nconst c = '#A81C22';\n");
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(2);
    expect(found[0].rule).toBe("raw hex colour");
  });

  it("scans source and CSS files but not tests", () => {
    expect(isScanned("src/components/ui/button.tsx")).toBe(true);
    expect(isScanned("src/app/globals.css")).toBe(true);
    expect(isScanned("src/app/dev/components/page.dev.tsx")).toBe(true);
    expect(isScanned("src/components/ui/button.test.tsx")).toBe(false);
    expect(isScanned("src/app/favicon.ico")).toBe(false);
  });
});
