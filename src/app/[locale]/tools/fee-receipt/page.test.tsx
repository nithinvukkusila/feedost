// The fee receipt page as a whole (spec R0-3, criteria 6, 7, 29), rendered with the real messages.
import { cleanup, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";
import { brand } from "@/config/brand";
import type { Locale } from "@/config/locales";
import { loadMessages } from "@/i18n/messages";

const state: { locale: Locale } = { locale: "en" };

vi.mock("next-intl/server", () => ({
  getLocale: async () => state.locale,
  getMessages: async () => loadMessages(state.locale),
  getTranslations: async (namespace: string) => {
    const messages = (await loadMessages(state.locale)) as unknown as Record<string, unknown>;
    return (key: string, values?: { brand?: string }) => {
      let node: unknown = messages;
      for (const part of `${namespace}.${key}`.split(".")) node = (node as Record<string, unknown>)[part];
      return (node as string).replaceAll("{brand}", values?.brand ?? "");
    };
  },
}));

const { default: FeeReceiptPage } = await import("./page");

afterEach(cleanup);

async function renderPage(locale: Locale = "en") {
  state.locale = locale;
  const page = await FeeReceiptPage();
  return render(
    <NextIntlClientProvider locale={locale} messages={await loadMessages(locale)}>
      {page}
    </NextIntlClientProvider>,
  );
}

describe("the fee receipt page", () => {
  it("has one banner, one main, one contentinfo and exactly one h1", async () => {
    await renderPage();
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(screen.getByRole("main").querySelector("header, footer")).toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["A proper fee receipt, in one minute."]);
  });

  it("shows the free-tool kicker and the island", async () => {
    await renderPage();
    expect(screen.getByText("Free tool · no sign-up")).toBeTruthy();
    expect(screen.getByTestId("receipt-tool")).toBeTruthy();
  });

  it("header: the brand name links home in the same language, the reminder writer is a link and the receipt maker is the current word", async () => {
    await renderPage("kn");
    const banner = within(screen.getByRole("banner"));
    const links = banner.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/kn/", "/kn/tools/fee-reminder/"]);
    expect(links[0].textContent).toBe(brand.name);
    for (const link of links) expect(link.className).toContain("min-h-tap");
    const current = screen.getByRole("banner").querySelector("[aria-current=page]")!;
    expect(current.tagName).toBe("SPAN");
  });

  it("footer: the other three languages link to this tool in that language; the current one is not a link", async () => {
    await renderPage("hi");
    const nav = within(screen.getByRole("contentinfo")).getByRole("navigation");
    const links = within(nav).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/en/tools/fee-receipt/", "/kn/tools/fee-receipt/", "/te/tools/fee-receipt/"]);
    const current = nav.querySelector("[aria-current=page]")!;
    expect(current.tagName).toBe("SPAN");
    expect(current.textContent).toBe("हिन्दी");
  });

  it("the yellow block names the brand from the config and links to the waitlist, with no form", async () => {
    await renderPage("te");
    const block = screen.getByTestId("receipt-promo");
    expect(block.className).toContain("bg-highlight");
    expect(block.textContent).toContain(brand.name);
    expect(block.textContent).not.toContain("{brand}");
    expect(within(block).getByRole("link").getAttribute("href")).toBe("/te/#waitlist");
    expect(block.querySelectorAll("form, input, select, textarea")).toHaveLength(0);
  });

  it("has no form element and no checkout words", async () => {
    const { container } = await renderPage();
    expect(container.querySelectorAll("form")).toHaveLength(0);
    expect(container.textContent).not.toMatch(/₹149|₹999|\bPro\b|verified|official|\bGST\b/i);
  });

  it("carries a line for a browser with JavaScript off", async () => {
    const { container } = await renderPage();
    expect(container.querySelectorAll("noscript")).toHaveLength(1);
  });
});
