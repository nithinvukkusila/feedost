// Spec R1-9 criterion 41 (amended in Part C): the QR encoder is a chunk of its own that no page lists. It is fetched on
// the first tap of "Show QR code" and never counted in a page's initial JavaScript. Reads the built `out/` folder.
import { expect, test } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = join(process.cwd(), "out");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? walk(join(dir, name)) : [join(dir, name)]));

test("the encoder chunk exists, is small, and is listed by no page's <script> tags", () => {
  test.skip(!existsSync(OUT), "needs `pnpm build`");
  const chunks = walk(join(OUT, "_next", "static", "chunks")).filter((f) => f.endsWith(".js"));
  // The encoder's own module-type names are kept by the minifier, and nothing else in the app has all three.
  const encoder = chunks.filter((f) => {
    const text = readFileSync(f, "utf8");
    return /Alignment/.test(text) && /Timing/.test(text) && /Position/.test(text);
  });
  expect(encoder).toHaveLength(1);
  expect(gzipSync(readFileSync(encoder[0])).length).toBeLessThan(8 * 1024);
  const name = encoder[0].split("/").at(-1)!;
  for (const page of walk(OUT).filter((f) => f.endsWith(".html"))) {
    const scripts = [...readFileSync(page, "utf8").matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]);
    expect(scripts.some((src) => src.endsWith(name)), page).toBe(false);
  }
});
