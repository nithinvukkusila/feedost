// @vitest-environment node
// Spec R1-9 Part C, criterion 43, plan C5: the wrapper around the QR encoder.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { walk } from "@/test-utils/find-own-words";
import { pathOf, qrMatrix } from "./qr";

const LINK = "upi://pay?pa=ravi@okhdfc&pn=Meera%20Iyer&am=1500.00&cu=INR&tn=Fee%20Oct%202026%20Ravi";

describe("qrMatrix", () => {
  it("gives a square of a plausible size for a UPI link", async () => {
    const { size, path } = await qrMatrix(LINK);
    expect(size).toBeGreaterThanOrEqual(25);
    expect(size).toBeLessThanOrEqual(57);
    expect(path.startsWith("M")).toBe(true);
    expect(path).toMatch(/^(M\d+ \d+h\d+v1h-\d+z)+$/);
  });

  it("matches the stored fixture, so an update of the library that changes the output fails here", async () => {
    const { size, path } = await qrMatrix(LINK);
    const fixture = JSON.parse(readFileSync(join(process.cwd(), "src", "lib", "qr.fixture.json"), "utf8")) as { text: string; size: number; path: string };
    expect(fixture.text).toBe(LINK);
    expect(size).toBe(fixture.size);
    expect(path).toBe(fixture.path);
  });

  it("has the three finder patterns (7 by 7 rings in three corners, none bottom-right)", async () => {
    const { size, path } = await qrMatrix(LINK);
    const dark = new Set<string>();
    for (const m of path.matchAll(/M(\d+) (\d+)h(\d+)v1/g)) {
      for (let i = 0; i < Number(m[3]); i += 1) dark.add(`${m[1] === undefined ? "" : String(Number(m[1]) + i)},${m[2] ?? ""}`);
    }
    const ring = (x0: number, y0: number) => {
      for (let i = 0; i < 7; i += 1) {
        for (const [x, y] of [[x0 + i, y0], [x0 + i, y0 + 6], [x0, y0 + i], [x0 + 6, y0 + i]] as const) expect(dark.has(`${String(x)},${String(y)}`)).toBe(true);
      }
      expect(dark.has(`${String(x0 + 3)},${String(y0 + 3)}`)).toBe(true);
      expect(dark.has(`${String(x0 + 1)},${String(y0 + 1)}`)).toBe(false);
    };
    ring(0, 0);
    ring(size - 7, 0);
    ring(0, size - 7);
  });

  it("encodes text with Hindi and percent signs", async () => {
    const { size } = await qrMatrix("upi://pay?pa=a@b&pn=%E0%A4%B0%E0%A4%B5%E0%A4%BF&tn=रवि");
    expect(size).toBeGreaterThan(20);
  });

  it("draws a real link with a long Hindi tutor name", async () => {
    const link = `upi://pay?pa=a@okhdfc&pn=${encodeURIComponent("मीना अय्यर ट्यूशन्स गणित विज्ञान")}&am=3400.00&cu=INR&tn=Fees%20due%20Ravi`;
    expect(link.length).toBeGreaterThan(200);
    await expect(qrMatrix(link)).resolves.toBeDefined();
  });

  it("rejects empty text and text over 800 characters", async () => {
    await expect(qrMatrix("")).rejects.toThrow();
    await expect(qrMatrix("x".repeat(801))).rejects.toThrow();
    await expect(qrMatrix("x".repeat(800))).resolves.toBeDefined();
  });
});

describe("pathOf", () => {
  it("runs the dark modules of each row", () => {
    expect(pathOf([[true, true, false, true], [false, false, false, false]])).toBe("M0 0h2v1h-2zM3 0h1v1h-1z");
  });
});

describe("the encoder is imported in one place only", () => {
  const files = walk(join(process.cwd(), "src")).filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p));
  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  it("uqr appears only in src/lib/qr.ts, and only as a dynamic import", () => {
    const users = files.filter((p) => /["']uqr["']/.test(strip(readFileSync(p, "utf8"))));
    expect(users.map((p) => p.slice(process.cwd().length + 1))).toEqual(["src/lib/qr.ts"]);
    const text = strip(readFileSync(join(process.cwd(), "src", "lib", "qr.ts"), "utf8"));
    expect(text).toContain('import("uqr")');
    expect(/from\s+["']uqr["']/.test(text)).toBe(false);
  });
  it("the wrapper and the block make no request", () => {
    for (const name of ["src/lib/qr.ts", "src/components/pay-page/qr-block.tsx"]) {
      let text: string;
      try {
        text = strip(readFileSync(join(process.cwd(), name), "utf8"));
      } catch {
        continue;
      }
      expect(/\b(fetch|XMLHttpRequest|Image|sendBeacon|WebSocket)\b|https?:\/\//.test(text), name).toBe(false);
      expect(text, name).not.toContain("dangerouslySetInnerHTML");
    }
  });
});
