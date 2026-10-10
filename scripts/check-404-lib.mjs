// The rules of `pnpm check:404` (spec R0-1, criteria 28 and 29). Reads the text of out/404.html.
// If a Next upgrade changes the experimental globalNotFound behaviour, the file falls back to a bare
// 404 with no <html lang>, and this check fails the build instead of shipping it.
const locales = ["en", "hi", "kn", "te"];

/** Returns a list of problems; empty means the 404 page is the one we built. */
export function check404(html) {
  const problems = [];
  if (!/<html\s[^>]*\blang="[a-z]{2}"/.test(html)) problems.push('out/404.html has no <html lang="..">');
  if (!/<meta name="robots" content="[^"]*noindex/.test(html)) problems.push("out/404.html has no noindex robots tag");
  for (const code of locales) {
    if (!new RegExp(`<section[^>]*\\blang="${code}"`).test(html)) problems.push(`out/404.html has no block with lang="${code}"`);
    if (!new RegExp(`<a [^>]*href="/${code}/"`).test(html)) problems.push(`out/404.html has no link to /${code}/`);
  }
  if (html.includes("TODO-translate")) problems.push("out/404.html shows a TODO-translate marker");
  return problems;
}
