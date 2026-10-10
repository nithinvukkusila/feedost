// generateMetadata of the landing page (spec R0-1, criteria 26 and 27): nothing for an unknown language, the full set for a real one.
import { describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import { locales } from "@/config/locales";
import { loadMessages } from "@/i18n/messages";

vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
    const messages = (await loadMessages(locale as "en")) as unknown as Record<string, unknown>;
    let node: unknown = messages;
    for (const key of namespace.split(".")) node = (node as Record<string, unknown>)[key];
    const strings = node as Record<string, string>;
    return (key: string, values?: { brand?: string }) => strings[key].replaceAll("{brand}", values?.brand ?? "");
  },
}));

const { generateMetadata } = await import("./page");
const meta = (locale: string) => generateMetadata({ params: Promise.resolve({ locale }) });

describe("generateMetadata on the landing page", () => {
  for (const bad of ["fr", "", "EN", "en/", "xyz", "__proto__", "hi-IN"]) {
    it(`returns {} for the unknown language ${JSON.stringify(bad)}`, async () => {
      expect(await meta(bad)).toEqual({});
    });
  }

  for (const locale of locales) {
    it(`gives ${locale} its own title, description, canonical, five alternates and Open Graph, with no image`, async () => {
      const m = await meta(locale);
      const raw = ((await loadMessages(locale)) as unknown as { landing: { meta: { title: string } } }).landing.meta.title;
      expect(m.title).toBe(raw.replaceAll("{brand}", brand.name));
      expect(m.description).toBeTruthy();
      expect(m.alternates?.canonical).toBe(`https://${brand.domain}/${locale}/`);
      expect(Object.keys(m.alternates?.languages ?? {})).toEqual(["en", "hi", "kn", "te", "x-default"]);
      expect(m.openGraph).toMatchObject({ title: m.title, description: m.description, url: `https://${brand.domain}/${locale}/` });
      expect((m.openGraph as { locale?: string }).locale).toBe(`${locale}_IN`);
      expect((m.openGraph as { images?: unknown }).images).toBeUndefined();
    });
  }
});
