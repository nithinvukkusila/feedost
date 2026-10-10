import { describe, expect, it } from "vitest";
import { locales } from "@/config/locales";
import { feeReminderPath, localeHref } from "./routes";

describe("localeHref", () => {
  it.each(locales)("%s with no path is the language's landing", (locale) => {
    expect(localeHref(locale)).toBe(`/${locale}/`);
  });

  it.each(locales)("%s with the tool path is the language's fee reminder page", (locale) => {
    expect(localeHref(locale, feeReminderPath)).toBe(`/${locale}/tools/fee-reminder/`);
  });
});

describe("feeReminderPath", () => {
  it("has no leading slash and ends in one, as the export writes folders", () => {
    expect(feeReminderPath).toBe("tools/fee-reminder/");
  });
});
