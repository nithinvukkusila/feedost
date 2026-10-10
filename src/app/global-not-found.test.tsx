// The 404 rendered on the server (spec R0-1, criterion 28): its own <html lang>, four language blocks, four links,
// the English text where a value is still flagged TODO-translate. The CSS and font modules need Next, so they are stubbed.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import { localeNames, locales } from "@/config/locales";
import { loadMessages } from "@/i18n/messages";
import GlobalNotFound, { metadata } from "./global-not-found";

vi.mock("./globals.css", () => ({}));
vi.mock("@/styles/fonts", () => ({ fontVariables: "font-vars" }));

async function render() {
  return renderToStaticMarkup(await GlobalNotFound());
}

describe("global-not-found", () => {
  it("writes its own html lang and body, since Next skips every layout for it", async () => {
    const html = await render();
    expect(html).toMatch(/^<html lang="en" class="font-vars">/);
    expect(html).toContain("<body");
    expect(html).toContain("</html>");
  });

  it("has one h1 with the brand name, four h2, four language blocks and four links", async () => {
    const html = await render();
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain(`>${brand.name}</h1>`);
    expect(html.match(/<h2[ >]/g)).toHaveLength(4);
    expect(html.match(/<section\b[^>]*\blang="/g)).toHaveLength(4);
    expect(html.match(/<a /g)).toHaveLength(4);
    for (const code of locales) {
      expect(html).toContain(`<section lang="${code}"`);
      expect(html).toMatch(new RegExp(`<a href="/${code}/" hrefLang="${code}"[^>]*>${localeNames[code]}</a>`, "i"));
    }
  });

  it("shows each language's own title and sentence, and never the TODO-translate marker", async () => {
    const html = await render();
    expect(html).not.toContain("TODO-translate");
    for (const code of locales) {
      const { notFound } = (await loadMessages(code)) as unknown as { notFound: { title: string; body: string } };
      expect(html).toContain(notFound.title);
      expect(html.replaceAll("&#x27;", "'")).toContain(notFound.body);
    }
  });

  it("is titled with the brand, and contains no script, form or image", async () => {
    expect(metadata.title).toBe(brand.name);
    const html = await render();
    expect(html).not.toMatch(/<(script|form|input|img)\b/);
  });
});
