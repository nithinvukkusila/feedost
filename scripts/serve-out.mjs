// Minimal static server for the exported site, used by Playwright and for local checks.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = "out";
const PORT = Number(process.env.PORT ?? 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};

async function resolve(urlPath) {
  try {
    // decodeURIComponent throws on a malformed escape; treat that as "not found".
    const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
    let file = join(ROOT, safe);
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    return file;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const file = (await resolve(pathname)) ?? join(ROOT, "404.html");
  try {
    const body = await readFile(file);
    res.writeHead(file.endsWith("404.html") && pathname !== "/404.html" ? 404 : 200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`Serving ${ROOT}/ on http://localhost:${PORT}`));
