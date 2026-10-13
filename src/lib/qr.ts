// The only file that imports the QR encoder (`uqr`, pinned exactly; spec R1-9 Part C, plan C2). It turns text into a
// square matrix on the parent's phone and returns it as one SVG path, so no request is made and nothing is sent to
// a QR service. The encoder is loaded with `import()` the first time a code is drawn, never at start-up.
//
// Integer arithmetic only: the path is built from whole module coordinates.

/**
 * A UPI link is about 100 characters, but a tutor name in Hindi, Kannada or Telugu is percent-encoded at 9 characters a
 * letter, so a real link can reach 500. The plan said 200 (C3); 800 keeps every real link and still refuses nonsense.
 */
export const QR_TEXT_MAX = 800;

export type QrMatrix = { size: number; path: string };

/** The dark modules as run-length rectangles in module units: `M x y h w v1 h-w z` per run of dark modules in a row. */
export function pathOf(rows: readonly (readonly boolean[])[]): string {
  const parts: string[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < row.length && row[x]) x += 1;
      const w = x - start;
      parts.push(`M${String(start)} ${String(y)}h${String(w)}v1h-${String(w)}z`);
    }
  });
  return parts.join("");
}

/** The QR matrix of `text` (error correction M, no border; the drawing adds the quiet border). Rejects an empty or over-long text. */
export async function qrMatrix(text: string): Promise<QrMatrix> {
  if (text === "") throw new RangeError("qr needs some text");
  if (text.length > QR_TEXT_MAX) throw new RangeError("qr text is too long");
  const { encode } = await import("uqr");
  const { data, size } = encode(text, { ecc: "M", border: 0 });
  return { size, path: pathOf(data) };
}
