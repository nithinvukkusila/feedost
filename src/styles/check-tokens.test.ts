import { describe, expect, it } from "vitest";
import { findViolations, isScanned, withoutComments } from "../../scripts/check-tokens.mjs";

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
  // Added in review (S5): ways round the rules above.
  ["an arbitrary box-shadow property", '<div className="[box-shadow:0_4px_12px_black]" />'],
  ["an arbitrary border-radius property", '<div className="[border-radius:10px]" />'],
  ["an arbitrary color property", '<div className="[color:red]" />'],
  ["an arbitrary background-color property", '<div className="[background-color:tomato]" />'],
  ["an arbitrary font-size property", '<p className="[font-size:13px]" />'],
  ["a named colour in an arbitrary background", '<div className="bg-[red]" />'],
  ["a named colour in an arbitrary border", '<div className="border-[rebeccapurple]" />'],
  ["a named colour in an arbitrary side border", '<div className="border-b-[red]" />'],
  ["a named colour on an outline", '<div className="outline-[gold]" />'],
  ["an inline style colour", 'const a = <p style={{ color: "red" }} />;'],
  ["an inline style box shadow", 'const a = <p style={{ boxShadow: "0 4px 12px black" }} />;'],
  ["an inline style radius", "const a = <p style={{ borderRadius: 10 }} />;"],
  ["an inline style font size in rem", 'const a = <p style={{ fontSize: "1rem" }} />;'],
  ["an inline style background colour", 'const a = <p style={{ backgroundColor: "var(--color-cloth)" }} />;'],
  ["an inline style spread over several lines", 'const a = (\n  <p\n    style={{\n      margin: 0,\n      color: "red",\n    }}\n  />\n);'],
  ["a rem font size under 14px", "font-size: 0.75rem;"],
  ["a rem font size under 14px with no leading zero", "font-size: .8rem;"],
  ["an em font size under 0.875", "font-size: 0.8em;"],
  ["a size variable under 14px", "--caption-size: 0.8125rem;"],
  ["a style font size under 14px in rem", 'const s = { fontSize: "0.75rem" };'],
  ["truncate", '<p className="truncate" />'],
  ["text-ellipsis", '<p className="overflow-hidden text-ellipsis" />'],
  ["a line clamp", '<p className="line-clamp-2" />'],
  ["a CSS ellipsis", "text-overflow: ellipsis;"],
  ["a CSS line clamp", "-webkit-line-clamp: 2;"],
  ["a bare blur class", '<div className="blur" />'],
  ["a colour-mix", "color: color-mix(in oklab, red 50%, blue);"],
];

// Flagged in a component, where the type roles decide these; allowed in a page.
const componentOnly: [string, string][] = [
  ["uppercase", '<span className="uppercase" />'],
  ["a tracking class", '<span className="tracking-wide" />'],
  ["a negative tracking class", '<span className="-tracking-wider" />'],
  ["font-mono", '<span className="font-mono" />'],
  ["font-sans", '<span className="font-sans text-lg" />'],
  ["font-serif", '<span className="font-serif" />'],
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
  ["a pixel border width in brackets", '<div className="border-[3px] outline-[3px]" />'],
  ["a custom property in an inline style", 'const a = <p style={{ "--amount-em": 4.2 } as CSSProperties} />;'],
  ["a layout key in an inline style", "const a = <p style={{ gridColumn: 2, width: w }} />;"],
  ["a font size of exactly 14px in rem", "font-size: 0.875rem;"],
  ["a size variable of 15px", "--body-sm-size: 0.9375rem;"],
  ["a background size", "background-size: 0.5rem 0.5rem;"],
  ["the blur event, by name", 'el.addEventListener("blur", sync);'],
  ["font weight classes", '<span className="font-bold font-semibold" />'],
  ["the word truncate in a comment", "// Rows grow; they never truncate a label. No uppercase here either."],
  ["a rule named in a block comment", "/* no blur, no gradient( ), no #A81C22 */ const a = 1;"],
  ["a URL in a string", 'const u = "https://example.com/#A81C22x";'],
  ["a type named after colour", "type Tone = { colour: string }; const tone: Tone = { colour: name };"],
];

describe("check-tokens detector (criterion 2)", () => {
  it.each(bad)("flags %s", (_name, source) => {
    expect(findViolations(source).length).toBeGreaterThan(0);
  });

  it.each(good)("allows %s", (_name, source) => {
    expect(findViolations(source)).toEqual([]);
  });

  it.each(componentOnly)("flags %s in a component", (_name, source) => {
    expect(findViolations(source, "src/components/ui/thing.tsx").length).toBeGreaterThan(0);
  });

  it.each(componentOnly)("allows %s in a page", (_name, source) => {
    expect(findViolations(source, "src/app/dev/components/sections/rupee.tsx")).toEqual([]);
  });

  it.each(bad)("also flags %s in a component", (_name, source) => {
    expect(findViolations(source, "src/components/ui/thing.tsx").length).toBeGreaterThan(0);
  });

  it("reports an inline style on the line it begins", () => {
    const found = findViolations('const a = 1;\nconst b = (\n  <p\n    style={{\n      color: "red",\n    }}\n  />\n);');
    expect(found.map((f) => [f.line, f.rule])).toEqual([[4, "inline style with a token"]]);
  });

  it("blanks comments without moving any line", () => {
    const source = "a /* one\ntwo */ b // three\nc";
    const blanked = withoutComments(source);
    expect(blanked.split("\n")).toHaveLength(3);
    expect(blanked).not.toMatch(/one|two|three/);
    expect(blanked).toMatch(/^a\s+\n\s+b\s+\nc$/);
  });

  it("reports the line number and the rule", () => {
    const found = findViolations("const a = 1;\nconst c = '#A81C22';\n");
    expect(found).toHaveLength(1);
    expect(found[0].line).toBe(2);
    expect(found[0].rule).toBe("raw hex colour");
  });

  it("scans source and CSS files in app, components and styles, but not tests or the token file", () => {
    expect(isScanned("src/components/ui/button.tsx")).toBe(true);
    expect(isScanned("src/app/globals.css")).toBe(true);
    expect(isScanned("src/app/dev/components/page.dev.tsx")).toBe(true);
    expect(isScanned("src/components/ui/legacy.js")).toBe(true);
    expect(isScanned("src/components/ui/legacy.jsx")).toBe(true);
    expect(isScanned("src/styles/type.css")).toBe(true);
    expect(isScanned("src/styles/states.css")).toBe(true);
    expect(isScanned("src/styles/fonts.ts")).toBe(true);
    expect(isScanned("src/styles/tokens.css")).toBe(false);
    expect(isScanned("src/components/ui/button.test.tsx")).toBe(false);
    expect(isScanned("src/components/ui/legacy.test.js")).toBe(false);
    expect(isScanned("src/styles/tokens.test.ts")).toBe(false);
    expect(isScanned("src/app/favicon.ico")).toBe(false);
  });
});
