// Rules for the wide-screen layout (spec D1, criteria 28, 35 and 36), read from the source text:
// the layout is CSS only, and one place (the shell) owns how wide a signed-in page is.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..", "..");
const src = (...parts: string[]) => join(root, "src", ...parts);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const sources = (dir: string) => walk(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
const read = (file: string) => readFileSync(file, "utf8");
const rel = (file: string) => relative(root, file);

describe("the layout is CSS only (criterion 36)", () => {
  const layoutFiles = [
    ...sources(src("components", "app")),
    src("components", "ui", "sheet.tsx"),
    src("components", "ui", "bottom-nav.tsx"),
    ...sources(src("components", "board")),
    ...sources(src("components", "students")),
    ...sources(src("components", "landing")),
  ];

  it("finds the files it is meant to check", () => {
    expect(layoutFiles.length).toBeGreaterThan(20);
    expect(layoutFiles.map(rel)).toContain("src/components/app/app-screen.tsx");
  });

  it("reads no window width: no matchMedia, innerWidth, outerWidth, clientWidth or ResizeObserver", () => {
    const offenders = layoutFiles.filter((f) => /matchMedia|innerWidth|outerWidth|clientWidth|ResizeObserver/.test(read(f)));
    expect(offenders.map(rel)).toEqual([]);
  });
});

describe("one shell owns the page width (criterion 28)", () => {
  // Every file that draws a signed-in screen inside the shell.
  const inShell = sources(src("components")).filter((f) => /<(?:AppScreen|BookBlocks|LoadingBook)\b/.test(read(f)));
  // The widths that limit a whole page. A small `max-w-full` or `max-w-xs` on a part of a row is not one.
  const pageWidth = /(?<![\w-])(?:[a-z0-9]+:)*max-w-(?:sm|md|lg|xl|[2-7]xl|screen(?:-[a-z0-9]+)?|prose)(?![\w-])/;

  it("finds the screens", () => {
    expect(inShell.length).toBeGreaterThanOrEqual(10);
    expect(inShell.map(rel)).toContain("src/components/board/board-screen.tsx");
  });

  it("no screen inside the shell sets its own page-width class", () => {
    const offenders = inShell.filter((f) => pageWidth.test(read(f)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("the shell itself sets the widths: 448px, 42rem, then 80rem from 1024", () => {
    const shell = read(src("components", "app", "app-screen.tsx"));
    expect(shell).toContain("max-w-md");
    expect(shell).toContain("md:max-w-2xl");
    expect(shell).toContain("lg:max-w-7xl");
  });

  it("uses rem breakpoints only (md and lg), never a pixel media query", () => {
    for (const f of [src("components", "app", "app-screen.tsx"), src("components", "ui", "sheet.tsx"), src("components", "ui", "bottom-nav.tsx")]) {
      expect(read(f), rel(f)).not.toMatch(/min-\[\d+px\]|max-\[\d+px\]|@media/);
    }
  });
});

describe("the navigation stays one element in one place (criterion 7)", () => {
  const shell = read(src("components", "app", "app-screen.tsx"));

  it("draws the navigation once and before the content in the page", () => {
    expect(shell.match(/<AppNav\b/g)).toHaveLength(1);
    expect(shell.indexOf("<AppNav")).toBeLessThan(shell.indexOf("<main"));
  });

  it("is drawn last on a phone (order-last) and has no box of its own wrapper from 1024 (lg:contents)", () => {
    expect(shell).toMatch(/data-sticky-nav[^>]*order-last/);
    expect(shell).toContain("lg:contents");
  });
});
