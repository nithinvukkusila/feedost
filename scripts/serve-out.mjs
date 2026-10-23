// Minimal static server for the exported site, used by Playwright and for local checks.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = "out";
const PORT = Number(process.env.PORT ?? 4173);
// HOST=0.0.0.0 lets a phone on the same Wi-Fi open the site (`pnpm serve:lan`). Default: this machine only.
const HOST = process.env.HOST ?? "127.0.0.1";
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

// vercel.json is the source of truth for the production routing; the local server follows the same rewrites
// and headers, so the end-to-end tests exercise that file and not a copy of it. Only the two forms it uses
// are understood: `:name` (one path segment) and `(.*)` (the rest). Like Vercel, a file that exists wins
// over a rewrite.
//
// Vercel serves an exported page at its clean address only: out/p/index.html is the page `/p/`, and the
// address `/p/index.html` is a 404 there (it is not a file Vercel serves). This server does the same, both
// for a request and for a rewrite destination, so a destination like `/p/index.html` fails here as it does
// on Vercel. /404.html is still served here as a file with 200; Vercel answers that address with its
// not-found status, so no test may depend on /404.html returning 200.
const isIndexFile = (urlPath) => /(^|\/)index\.html$/i.test(urlPath);
const config = JSON.parse(readFileSync("vercel.json", "utf8"));
const matcher = (source) => {
  const pieces = source.split(/(:[A-Za-z]+|\(\.\*\))/);
  const body = pieces.map((p) => (p.startsWith(":") ? "[^/]+" : p === "(.*)" ? ".*" : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))).join("");
  return new RegExp(`^${body}$`);
};
const rewrites = (config.rewrites ?? []).map((r) => ({ test: matcher(r.source), destination: r.destination }));
const headerRules = (config.headers ?? []).map((h) => ({ test: matcher(h.source), headers: Object.fromEntries(h.headers.map(({ key, value }) => [key.toLowerCase(), value])) }));

async function resolve(urlPath) {
  try {
    // decodeURIComponent throws on a malformed escape; treat that as "not found".
    const safe = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
    if (isIndexFile(safe)) return null;
    let file = join(ROOT, safe);
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
    return file;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  let file = await resolve(pathname);
  if (file === null) {
    const rewrite = rewrites.find((r) => r.test.test(pathname));
    if (rewrite) file = await resolve(rewrite.destination);
  }
  file ??= join(ROOT, "404.html");
  const extra = Object.assign({}, ...headerRules.filter((h) => h.test.test(pathname)).map((h) => h.headers));
  try {
    const body = await readFile(file);
    res.writeHead(file.endsWith("404.html") && pathname !== "/404.html" ? 404 : 200, {
      "content-type": types[extname(file)] ?? "application/octet-stream",
      ...extra,
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, HOST, () => console.log(`Serving ${ROOT}/ on http://${HOST === "127.0.0.1" ? "localhost" : HOST}:${PORT}`));
