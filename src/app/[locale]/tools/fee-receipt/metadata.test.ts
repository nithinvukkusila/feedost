// generateMetadata of the fee receipt page (spec R0-3, criteria 29 and 30): nothing for an unknown
// language, the full set for a real one, and four different titles and descriptions.
import { describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import { locales } from "@/config/locales";
import { loadMessages } from "@/i18n/messages";

vi.mock("next-intl/server", () => ({
  getLocale: async () => "en",
  getMessages: async () => loadMessages("en"),
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const messages = (await loadMessages(locale as "en")) as unknown as Record<string, unknown>;
    let node: unknown = messages;
    for (const key of namespace.split(".")) node = (node as Record<string, unknown>)[key];
    const strings = node as Record<string, string>;
    return (key: string) => strings[key];
  },
}));

const { generateMetadata } = await import("./page");
const meta = (locale: string) => generateMetadata({ params: Promise.resolve({ locale }) });

describe("generateMetadata on the fee receipt page", () => {
  for (const bad of ["fr", "", "EN", "en/", "xyz", "__proto__", "hi-IN"]) {
    it(`returns {} for the unknown language ${JSON.stringify(bad)}`, async () => {
      expect(await meta(bad)).toEqual({});
    });
  }

  for (const locale of locales) {
    it(`gives ${locale} its own title, description, canonical, five alternates and Open Graph, with no image`, async () => {
      const m = await meta(locale);
      const url = `https://${brand.domain}/${locale}/tools/fee-receipt/`;
      expect(typeof m.title).toBe("string");
      expect(Array.from(m.title as string).length).toBeLessThanOrEqual(60);
      expect(Array.from(m.description as string).length).toBeLessThanOrEqual(155);
      expect(m.title).not.toContain("TODO-translate");
      expect(m.title).not.toContain("{");
      expect(m.alternates?.canonical).toBe(url);
      expect(m.alternates?.languages).toEqual({
        en: `https://${brand.domain}/en/tools/fee-receipt/`,
        hi: `https://${brand.domain}/hi/tools/fee-receipt/`,
        kn: `https://${brand.domain}/kn/tools/fee-receipt/`,
        te: `https://${brand.domain}/te/tools/fee-receipt/`,
        "x-default": `https://${brand.domain}/en/tools/fee-receipt/`,
      });
      expect(Object.keys(m.alternates?.languages ?? {})).toEqual(["en", "hi", "kn", "te", "x-default"]);
      expect(m.openGraph).toMatchObject({ type: "website", title: m.title, description: m.description, url });
      expect((m.openGraph as { locale?: string }).locale).toBe(`${locale}_IN`);
      expect((m.openGraph as { images?: unknown }).images).toBeUndefined();
    });
  }

  it("has the English title and description, exactly", async () => {
    const m = await meta("en");
    expect(m.title).toBe("Free fee receipt maker for tutors: PDF in 4 languages");
    expect(m.description).toBe("Make a fee receipt PDF in English, Hindi, Kannada or Telugu. Free, no sign-up, made on your phone and not saved anywhere.");
  });

  it("has four different titles and four different descriptions: none is English left in place", async () => {
    const all = await Promise.all(locales.map((locale) => meta(locale)));
    expect(new Set(all.map((m) => m.title)).size).toBe(4);
    expect(new Set(all.map((m) => m.description)).size).toBe(4);
  });
});
